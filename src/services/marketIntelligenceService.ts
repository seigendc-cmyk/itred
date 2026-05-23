/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";
import { getStorageAdapter } from "./storageService.ts";
import { whatsappActivityService } from "./whatsappActivityService.ts";

export type MarketIntelligenceReportType =
  | "weekly_market_intelligence_summary"
  | "vendor_market_activity_forecast"
  | "product_demand_forecast"
  | "location_demand_forecast"
  | "sector_momentum_report"
  | "catalogue_viral_growth_report"
  | "rpn_vendor_support_action_report";

export type TrendDirection = "rising" | "flat" | "falling" | "new" | "no_data";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface MarketIntelligenceFilters {
  dateFrom: string;
  dateTo: string;
  previousDateFrom?: string;
  previousDateTo?: string;
  vendorId?: string;
  catalogueId?: string;
  sector?: string;
  category?: string;
  city?: string;
  suburb?: string;
  productId?: string;
  eventType?: string;
}

export interface TrendMetric {
  metric: string;
  previousValue: number;
  currentValue: number;
  absoluteChange: number;
  percentChange: number | null;
  trendDirection: TrendDirection;
}

export interface NamedTrend extends TrendMetric {
  key: string;
  label: string;
}

export interface MarketPrediction {
  predictionType:
    | "productDemandPrediction"
    | "vendorOpportunityPrediction"
    | "locationDemandPrediction"
    | "sectorMomentumPrediction"
    | "churnRiskPrediction"
    | "stockOpportunityPrediction"
    | "catalogueViralPrediction";
  label: string;
  finding: string;
  confidence: ConfidenceLevel;
  score: number;
  supportingMetrics: TrendMetric[];
  recommendedAction: string;
}

export interface MarketIntelligenceReportData {
  reportType: MarketIntelligenceReportType;
  filters: MarketIntelligenceFilters;
  currentPeriod: { dateFrom: string; dateTo: string };
  previousPeriod: { dateFrom: string; dateTo: string };
  comparisonMetrics: Record<string, TrendMetric>;
  productTrends: {
    topProducts: NamedTrend[];
    risingProducts: NamedTrend[];
    fallingProducts: NamedTrend[];
    missingSearchDemand: NamedTrend[];
  };
  vendorTrends: {
    topVendorsByInterest: NamedTrend[];
    weakVendors: NamedTrend[];
    vendorsWithRisingInterest: NamedTrend[];
    vendorsWithFallingInterest: NamedTrend[];
  };
  locationTrends: {
    topCities: NamedTrend[];
    topSuburbs: NamedTrend[];
    risingLocations: NamedTrend[];
    fallingLocations: NamedTrend[];
  };
  sectorTrends: {
    topSectors: NamedTrend[];
    risingSectors: NamedTrend[];
    fallingSectors: NamedTrend[];
    categoryDemand: NamedTrend[];
  };
  funnelMetrics: Record<string, TrendMetric>;
  viralMetrics: Record<string, TrendMetric>;
  predictions: MarketPrediction[];
  dataQuality: {
    hasEnoughData: boolean;
    missingFields: string[];
    eventCount: number;
    warningNotes: string[];
  };
}

export interface MarketIntelligenceReportOutput {
  id: string;
  reportType: MarketIntelligenceReportType;
  title: string;
  reportData: MarketIntelligenceReportData;
  aiNarrative: string;
  sections: {
    executiveSummary: string;
    previousVsCurrentComparison: string;
    productsGainingDemand: string;
    productsLosingDemand: string;
    locationDemandMovement: string;
    vendorOpportunitiesAndRisks: string;
    sectorMomentum: string;
    futureMarketPossibilities: string;
    recommendedActionPlan: string[];
    whatsappSummary: string;
  };
  generatedAt: string;
  createdByStaffId?: string | null;
  status: "generated" | "not_enough_data" | "failed";
  model: string;
}

const MODEL = "gemini-2.5-flash";
const OUTPUTS_KEY = "itred_ai_market_intelligence_reports";
const dayMs = 24 * 60 * 60 * 1000;
const trackedEventTypes = new Set([
  "catalogue_open",
  "product_search",
  "product_click",
  "product_view",
  "vendor_click",
  "whatsapp_click",
  "call_click",
  "cart_add",
  "cart_remove",
  "order_created",
  "share_click",
  "catalogue_expired_view",
]);

const reportTitles: Record<MarketIntelligenceReportType, string> = {
  weekly_market_intelligence_summary: "Weekly Market Intelligence Summary",
  vendor_market_activity_forecast: "Vendor Market Activity Forecast",
  product_demand_forecast: "Product Demand Forecast",
  location_demand_forecast: "Location Demand Forecast",
  sector_momentum_report: "Sector Momentum Report",
  catalogue_viral_growth_report: "Catalogue Viral Growth Report",
  rpn_vendor_support_action_report: "RPN/Vendor Support Action Report",
};

const safeString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const safeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const dateKey = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object" && typeof (value as any).toDate === "function") {
    const date = (value as any).toDate();
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && "seconds" in (value as any)) {
    return new Date(safeNumber((value as any).seconds) * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const dateDaysAgo = (days: number) => new Date(Date.now() - days * dayMs).toISOString().slice(0, 10);

const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const daysInclusive = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.round((end - start) / dayMs) + 1);
};

const normalizeFilters = (filters?: Partial<MarketIntelligenceFilters>): MarketIntelligenceFilters => {
  const dateTo = dateKey(filters?.dateTo) || todayKey();
  const dateFrom = dateKey(filters?.dateFrom) || dateDaysAgo(21);
  const currentFrom = dateFrom > dateTo ? dateTo : dateFrom;
  const currentTo = dateFrom > dateTo ? dateFrom : dateTo;
  const duration = daysInclusive(currentFrom, currentTo);
  const previousDateTo = dateKey(filters?.previousDateTo) || addDays(currentFrom, -1);
  const previousDateFrom = dateKey(filters?.previousDateFrom) || addDays(previousDateTo, -(duration - 1));

  return {
    dateFrom: currentFrom,
    dateTo: currentTo,
    previousDateFrom,
    previousDateTo,
    vendorId: filters?.vendorId || undefined,
    catalogueId: filters?.catalogueId || undefined,
    sector: filters?.sector || undefined,
    category: filters?.category || undefined,
    city: filters?.city || undefined,
    suburb: filters?.suburb || undefined,
    productId: filters?.productId || undefined,
    eventType: filters?.eventType || undefined,
  };
};

const trendFor = (metric: string, previousValue: number, currentValue: number): TrendMetric => {
  const absoluteChange = currentValue - previousValue;
  const percentChange =
    previousValue === 0 ? (currentValue > 0 ? null : 0) : Number(((absoluteChange / previousValue) * 100).toFixed(1));
  let trendDirection: TrendDirection = "flat";
  if (previousValue === 0 && currentValue === 0) trendDirection = "no_data";
  else if (previousValue === 0 && currentValue > 0) trendDirection = "new";
  else if (percentChange !== null && percentChange > 10) trendDirection = "rising";
  else if (percentChange !== null && percentChange < -10) trendDirection = "falling";
  return { metric, previousValue, currentValue, absoluteChange, percentChange, trendDirection };
};

const increment = (map: Map<string, { key: string; label: string; value: number }>, key: string, label?: string, amount = 1) => {
  const safeKey = key || "Unspecified";
  const row = map.get(safeKey) || { key: safeKey, label: label || safeKey, value: 0 };
  row.value += amount;
  if (label && row.label === safeKey) row.label = label;
  map.set(safeKey, row);
};

const topNamedTrends = (
  current: Map<string, { key: string; label: string; value: number }>,
  previous: Map<string, { key: string; label: string; value: number }>,
  metric: string,
  sortBy: "current" | "rising" | "falling",
  limit = 10,
): NamedTrend[] => {
  const keys = new Set([...current.keys(), ...previous.keys()]);
  return Array.from(keys)
    .map((key) => {
      const c = current.get(key);
      const p = previous.get(key);
      return {
        key,
        label: c?.label || p?.label || key,
        ...trendFor(metric, p?.value || 0, c?.value || 0),
      };
    })
    .sort((a, b) => {
      if (sortBy === "rising") return b.absoluteChange - a.absoluteChange || b.currentValue - a.currentValue;
      if (sortBy === "falling") return a.absoluteChange - b.absoluteChange || b.previousValue - a.previousValue;
      return b.currentValue - a.currentValue || b.absoluteChange - a.absoluteChange;
    })
    .slice(0, limit);
};

const emptyAgg = () => ({
  eventCount: 0,
  catalogueOpens: 0,
  uniqueSessions: new Set<string>(),
  repeatSessionEvents: 0,
  productViews: 0,
  productClicks: 0,
  productSearches: 0,
  shareClicks: 0,
  expiredViews: 0,
  whatsappClicks: 0,
  callClicks: 0,
  cartAdds: 0,
  cartRemoves: 0,
  ordersCreated: 0,
  byProduct: new Map<string, { key: string; label: string; value: number }>(),
  byProductIntent: new Map<string, { key: string; label: string; value: number }>(),
  byMissingSearch: new Map<string, { key: string; label: string; value: number }>(),
  byVendor: new Map<string, { key: string; label: string; value: number }>(),
  byCity: new Map<string, { key: string; label: string; value: number }>(),
  bySuburb: new Map<string, { key: string; label: string; value: number }>(),
  bySector: new Map<string, { key: string; label: string; value: number }>(),
  byCategory: new Map<string, { key: string; label: string; value: number }>(),
});

const readCollection = async <T>(names: string[]): Promise<T[]> => {
  const storage = getStorageAdapter();
  const merged: T[] = [];
  for (const name of names) {
    try {
      const data = await storage.getItem<T[]>(name);
      if (Array.isArray(data)) merged.push(...data);
    } catch {
      // Best-effort analytics read. Missing collections are expected in local/demo mode.
    }
  }
  const seen = new Set<string>();
  return merged.filter((row: any, index) => {
    const key = row?.eventId || row?.id || `${nameFromRow(row)}-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const nameFromRow = (row: any) => safeString(row?.productName || row?.vendorName || row?.eventType, "row");

const normalizeEventType = (value: unknown) => {
  const raw = safeString(value, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
  if (raw === "catalogue_view" || raw === "catalogue_viewed" || raw === "catalogue_opened") return "catalogue_open";
  if (raw === "product_viewed") return "product_view";
  if (raw === "product_clicked") return "product_click";
  if (raw === "search_performed" || raw === "no_results_search") return "product_search";
  if (raw === "whatsapp_vendor_clicked" || raw === "vendor_whatsapp_clicked") return "whatsapp_click";
  if (raw === "call_vendor_clicked" || raw === "vendor_call_clicked") return "call_click";
  if (raw === "cart_item_added") return "cart_add";
  if (raw === "cart_vendor_group_removed") return "cart_remove";
  if (raw === "cart_vendor_lead_sent") return "order_created";
  if (raw === "expiry_survey_opened") return "catalogue_expired_view";
  return raw;
};

const normalizeEvent = (event: any, vendors: any[], products: any[]) => {
  const productId = safeString(event?.productId || event?.offerId || event?.entityId);
  const product = productId ? products.find((row) => row?.id === productId || row?.productId === productId) : null;
  const vendorId = safeString(event?.vendorId || product?.vendorId);
  const vendor = vendorId ? vendors.find((row) => row?.id === vendorId || row?.vendorId === vendorId) : null;
  const metadata = event?.metadata || event?.payload || {};
  return {
    eventId: safeString(event?.eventId || event?.id),
    eventType: normalizeEventType(event?.eventType || event?.type || event?.action),
    date: dateKey(event?.createdAt || event?.timestamp || event?.date || event?.receivedAt),
    catalogueId: safeString(event?.catalogueId || metadata?.catalogueId),
    catalogueSerial: safeString(event?.catalogueSerial || metadata?.catalogueSerial),
    vendorId,
    vendorName: safeString(event?.vendorName || metadata?.vendorName || vendor?.name || vendor?.tradingName),
    productId,
    productName: safeString(event?.productName || metadata?.productName || product?.name || product?.productName || metadata?.product),
    searchTerm: safeString(event?.searchTerm || event?.query || metadata?.query || metadata?.searchTerm || metadata?.product),
    city: safeString(event?.city || metadata?.city || product?.city || product?.cityTown || vendor?.cityTown || vendor?.city),
    suburb: safeString(event?.suburb || metadata?.suburb || product?.suburb || vendor?.suburb),
    sector: safeString(event?.sector || metadata?.sector || product?.sector || vendor?.sector || vendor?.category),
    category: safeString(event?.category || metadata?.category || product?.category || product?.productCategory),
    sessionId: safeString(event?.sessionId || event?.deviceSessionId),
    stockQuantity: safeNumber(product?.stockQuantity ?? product?.quantityAvailable ?? product?.quantity),
  };
};

const passesFilters = (event: ReturnType<typeof normalizeEvent>, filters: MarketIntelligenceFilters) => {
  if (!trackedEventTypes.has(event.eventType)) return false;
  if (filters.vendorId && event.vendorId !== filters.vendorId) return false;
  if (filters.catalogueId && event.catalogueId !== filters.catalogueId) return false;
  if (filters.sector && event.sector !== filters.sector) return false;
  if (filters.category && event.category !== filters.category) return false;
  if (filters.city && event.city !== filters.city) return false;
  if (filters.suburb && event.suburb !== filters.suburb) return false;
  if (filters.productId && event.productId !== filters.productId) return false;
  if (filters.eventType && event.eventType !== filters.eventType) return false;
  return true;
};

const aggregateEvents = (events: ReturnType<typeof normalizeEvent>[]) => {
  const agg = emptyAgg();
  const sessionCounts = new Map<string, number>();

  events.forEach((event) => {
    agg.eventCount++;
    if (event.sessionId) {
      sessionCounts.set(event.sessionId, (sessionCounts.get(event.sessionId) || 0) + 1);
      agg.uniqueSessions.add(event.sessionId);
    }

    if (event.eventType === "catalogue_open") agg.catalogueOpens++;
    if (event.eventType === "product_view") agg.productViews++;
    if (event.eventType === "product_click") agg.productClicks++;
    if (event.eventType === "product_search") agg.productSearches++;
    if (event.eventType === "share_click") agg.shareClicks++;
    if (event.eventType === "catalogue_expired_view") agg.expiredViews++;
    if (event.eventType === "whatsapp_click") agg.whatsappClicks++;
    if (event.eventType === "call_click") agg.callClicks++;
    if (event.eventType === "cart_add") agg.cartAdds++;
    if (event.eventType === "cart_remove") agg.cartRemoves++;
    if (event.eventType === "order_created") agg.ordersCreated++;

    const interestWeight =
      event.eventType === "whatsapp_click" || event.eventType === "call_click" || event.eventType === "order_created"
        ? 3
        : event.eventType === "cart_add"
          ? 2
          : 1;

    if (event.productId || event.productName) {
      increment(agg.byProduct, event.productId || event.productName, event.productName || event.productId, 1);
      increment(agg.byProductIntent, event.productId || event.productName, event.productName || event.productId, interestWeight);
    }
    if (event.eventType === "product_search" && event.searchTerm && !event.productId) {
      increment(agg.byMissingSearch, event.searchTerm, event.searchTerm);
    }
    if (event.vendorId || event.vendorName) {
      increment(agg.byVendor, event.vendorId || event.vendorName, event.vendorName || event.vendorId, interestWeight);
    }
    if (event.city) increment(agg.byCity, event.city, event.city);
    if (event.suburb) increment(agg.bySuburb, event.suburb, event.suburb);
    if (event.sector) increment(agg.bySector, event.sector, event.sector);
    if (event.category) increment(agg.byCategory, event.category, event.category);
  });

  agg.repeatSessionEvents = Array.from(sessionCounts.values()).filter((count) => count > 1).length;
  return agg;
};

const rate = (numerator: number, denominator: number) => (denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0);

const buildPredictions = (
  reportData: Omit<MarketIntelligenceReportData, "predictions" | "dataQuality">,
  currentEvents: ReturnType<typeof normalizeEvent>[],
): MarketPrediction[] => {
  const predictions: MarketPrediction[] = [];
  reportData.productTrends.risingProducts.slice(0, 5).forEach((product) => {
    if ((product.percentChange ?? 0) > 20 || product.trendDirection === "new") {
      predictions.push({
        predictionType: "productDemandPrediction",
        label: product.label,
        finding: "Likely demand growth next period based on rising product interest.",
        confidence: product.currentValue >= 10 ? "high" : product.currentValue >= 4 ? "medium" : "low",
        score: Math.min(100, product.currentValue * 8 + Math.max(0, product.absoluteChange) * 5),
        supportingMetrics: [product],
        recommendedAction: "Confirm stock, price accuracy, images, delivery options, and vendor response readiness.",
      });
    }
  });

  reportData.vendorTrends.weakVendors.slice(0, 5).forEach((vendor) => {
    predictions.push({
      predictionType: "vendorOpportunityPrediction",
      label: vendor.label,
      finding: "Vendor interest is weak or falling compared with the previous period.",
      confidence: vendor.previousValue + vendor.currentValue >= 8 ? "medium" : "low",
      score: Math.min(100, Math.abs(vendor.absoluteChange) * 10),
      supportingMetrics: [vendor],
      recommendedAction: "Review vendor product content, response time, WhatsApp routing, and catalogue placement.",
    });
  });

  reportData.locationTrends.risingLocations.slice(0, 5).forEach((location) => {
    predictions.push({
      predictionType: "locationDemandPrediction",
      label: location.label,
      finding: "Location demand is rising and may need more vendor coverage.",
      confidence: location.currentValue >= 8 ? "high" : location.currentValue >= 4 ? "medium" : "low",
      score: Math.min(100, location.currentValue * 8),
      supportingMetrics: [location],
      recommendedAction: "Check vendor density, stock availability, and delivery support in this city or suburb.",
    });
  });

  reportData.sectorTrends.risingSectors.slice(0, 5).forEach((sector) => {
    predictions.push({
      predictionType: "sectorMomentumPrediction",
      label: sector.label,
      finding: "Sector momentum is rising compared with the previous period.",
      confidence: sector.currentValue >= 12 ? "high" : sector.currentValue >= 5 ? "medium" : "low",
      score: Math.min(100, sector.currentValue * 6),
      supportingMetrics: [sector],
      recommendedAction: "Prioritise catalogue refreshes, CAH distribution, and vendor readiness checks for this sector.",
    });
  });

  reportData.productTrends.missingSearchDemand.slice(0, 5).forEach((search) => {
    const matchingProducts = currentEvents.filter((event) =>
      event.productName.toLowerCase().includes(search.label.toLowerCase()) ||
      event.category.toLowerCase().includes(search.label.toLowerCase()),
    );
    if (matchingProducts.length <= 2) {
      predictions.push({
        predictionType: "stockOpportunityPrediction",
        label: search.label,
        finding: "Search demand exists with low matching product evidence.",
        confidence: search.currentValue >= 5 ? "medium" : "low",
        score: Math.min(100, search.currentValue * 10),
        supportingMetrics: [search],
        recommendedAction: "Source matching products or ask vendors to add branded/linked offers for this demand.",
      });
    }
  });

  const shareRate = reportData.viralMetrics.shareRate;
  const repeatOpenRate = reportData.viralMetrics.repeatOpenRate;
  if (
    (shareRate.trendDirection === "rising" || shareRate.trendDirection === "new") &&
    (repeatOpenRate.trendDirection === "rising" || repeatOpenRate.trendDirection === "new")
  ) {
    predictions.push({
      predictionType: "catalogueViralPrediction",
      label: "Catalogue spread",
      finding: "Catalogue sharing and repeat activity are rising, so further organic reach is possible.",
      confidence: shareRate.currentValue >= 5 && repeatOpenRate.currentValue >= 5 ? "high" : "medium",
      score: Math.min(100, shareRate.currentValue * 5 + repeatOpenRate.currentValue * 5),
      supportingMetrics: [shareRate, repeatOpenRate],
      recommendedAction: "Keep catalogue links active, refresh top products, and route WhatsApp links to responsive vendors.",
    });
  }

  reportData.vendorTrends.vendorsWithFallingInterest.slice(0, 5).forEach((vendor) => {
    if ((vendor.percentChange ?? 0) <= -25) {
      predictions.push({
        predictionType: "churnRiskPrediction",
        label: vendor.label,
        finding: "Vendor engagement is falling and may need support before churn risk increases.",
        confidence: vendor.previousValue >= 6 ? "medium" : "low",
        score: Math.min(100, Math.abs(vendor.percentChange || 0)),
        supportingMetrics: [vendor],
        recommendedAction: "Assign RPN/vendor support to review stock, catalogue content, and lead handling.",
      });
    }
  });

  return predictions.sort((a, b) => b.score - a.score).slice(0, 20);
};

const buildReportData = async (
  reportType: MarketIntelligenceReportType,
  filters?: Partial<MarketIntelligenceFilters>,
): Promise<MarketIntelligenceReportData> => {
  const safeFilters = normalizeFilters(filters);
  const [rawEvents, vendors, products] = await Promise.all([
    readCollection<any>([
      "catalogueActivityEvents",
      "itred_catalogue_activity_logs",
      "publicCatalogueEvents",
      "itred_catalogue_activity_events",
      "itred_offline_events",
      "itred_catalogue_commerce_events",
      "itred_vendor_impact_events",
      "itred_product_demand_signals",
      "itred_activity_logs",
    ]),
    readCollection<any>(["vendors", "itred_vendors"]),
    readCollection<any>(["products", "itred_products", "itred_vendor_product_offers"]),
  ]);
  const normalized = rawEvents.map((event) => normalizeEvent(event, vendors, products)).filter((event) => event.date && passesFilters(event, safeFilters));
  const currentEvents = normalized.filter((event) => event.date >= safeFilters.dateFrom && event.date <= safeFilters.dateTo);
  const previousEvents = normalized.filter(
    (event) => event.date >= (safeFilters.previousDateFrom || "") && event.date <= (safeFilters.previousDateTo || ""),
  );
  const current = aggregateEvents(currentEvents);
  const previous = aggregateEvents(previousEvents);

  const comparisonMetrics = {
    catalogueOpens: trendFor("catalogueOpens", previous.catalogueOpens, current.catalogueOpens),
    uniqueSessions: trendFor("uniqueSessions", previous.uniqueSessions.size, current.uniqueSessions.size),
    repeatSessions: trendFor("repeatSessions", previous.repeatSessionEvents, current.repeatSessionEvents),
    shareClicks: trendFor("shareClicks", previous.shareClicks, current.shareClicks),
    expiredViews: trendFor("expiredViews", previous.expiredViews, current.expiredViews),
    productViews: trendFor("productViews", previous.productViews, current.productViews),
    productClicks: trendFor("productClicks", previous.productClicks, current.productClicks),
    productSearches: trendFor("productSearches", previous.productSearches, current.productSearches),
    whatsappClicks: trendFor("whatsappClicks", previous.whatsappClicks, current.whatsappClicks),
    callClicks: trendFor("callClicks", previous.callClicks, current.callClicks),
    cartAdds: trendFor("cartAdds", previous.cartAdds, current.cartAdds),
    ordersCreated: trendFor("ordersCreated", previous.ordersCreated, current.ordersCreated),
    enquiryConversionRate: trendFor(
      "enquiryConversionRate",
      rate(previous.whatsappClicks + previous.callClicks, previous.productClicks),
      rate(current.whatsappClicks + current.callClicks, current.productClicks),
    ),
  };

  const funnelMetrics = {
    openToProductClickRate: trendFor("openToProductClickRate", rate(previous.productClicks, previous.catalogueOpens), rate(current.productClicks, current.catalogueOpens)),
    productClickToWhatsappRate: trendFor("productClickToWhatsappRate", rate(previous.whatsappClicks, previous.productClicks), rate(current.whatsappClicks, current.productClicks)),
    productClickToCallRate: trendFor("productClickToCallRate", rate(previous.callClicks, previous.productClicks), rate(current.callClicks, current.productClicks)),
    cartToOrderRate: trendFor("cartToOrderRate", rate(previous.ordersCreated, previous.cartAdds), rate(current.ordersCreated, current.cartAdds)),
  };

  const viralMetrics = {
    shareRate: trendFor("shareRate", rate(previous.shareClicks, previous.catalogueOpens), rate(current.shareClicks, current.catalogueOpens)),
    catalogueViralScore: trendFor(
      "catalogueViralScore",
      rate(previous.shareClicks + previous.repeatSessionEvents, previous.catalogueOpens),
      rate(current.shareClicks + current.repeatSessionEvents, current.catalogueOpens),
    ),
    repeatOpenRate: trendFor("repeatOpenRate", rate(previous.repeatSessionEvents, previous.uniqueSessions.size), rate(current.repeatSessionEvents, current.uniqueSessions.size)),
  };

  const baseReport = {
    reportType,
    filters: safeFilters,
    currentPeriod: { dateFrom: safeFilters.dateFrom, dateTo: safeFilters.dateTo },
    previousPeriod: { dateFrom: safeFilters.previousDateFrom || "", dateTo: safeFilters.previousDateTo || "" },
    comparisonMetrics,
    productTrends: {
      topProducts: topNamedTrends(current.byProductIntent, previous.byProductIntent, "productInterest", "current"),
      risingProducts: topNamedTrends(current.byProductIntent, previous.byProductIntent, "productInterest", "rising").filter((row) => row.absoluteChange > 0),
      fallingProducts: topNamedTrends(current.byProductIntent, previous.byProductIntent, "productInterest", "falling").filter((row) => row.absoluteChange < 0),
      missingSearchDemand: topNamedTrends(current.byMissingSearch, previous.byMissingSearch, "missingSearchDemand", "current"),
    },
    vendorTrends: {
      topVendorsByInterest: topNamedTrends(current.byVendor, previous.byVendor, "vendorInterest", "current"),
      weakVendors: topNamedTrends(current.byVendor, previous.byVendor, "vendorInterest", "falling").filter((row) => row.currentValue <= row.previousValue),
      vendorsWithRisingInterest: topNamedTrends(current.byVendor, previous.byVendor, "vendorInterest", "rising").filter((row) => row.absoluteChange > 0),
      vendorsWithFallingInterest: topNamedTrends(current.byVendor, previous.byVendor, "vendorInterest", "falling").filter((row) => row.absoluteChange < 0),
    },
    locationTrends: {
      topCities: topNamedTrends(current.byCity, previous.byCity, "cityDemand", "current"),
      topSuburbs: topNamedTrends(current.bySuburb, previous.bySuburb, "suburbDemand", "current"),
      risingLocations: [
        ...topNamedTrends(current.byCity, previous.byCity, "cityDemand", "rising"),
        ...topNamedTrends(current.bySuburb, previous.bySuburb, "suburbDemand", "rising"),
      ].filter((row) => row.absoluteChange > 0).slice(0, 10),
      fallingLocations: [
        ...topNamedTrends(current.byCity, previous.byCity, "cityDemand", "falling"),
        ...topNamedTrends(current.bySuburb, previous.bySuburb, "suburbDemand", "falling"),
      ].filter((row) => row.absoluteChange < 0).slice(0, 10),
    },
    sectorTrends: {
      topSectors: topNamedTrends(current.bySector, previous.bySector, "sectorDemand", "current"),
      risingSectors: topNamedTrends(current.bySector, previous.bySector, "sectorDemand", "rising").filter((row) => row.absoluteChange > 0),
      fallingSectors: topNamedTrends(current.bySector, previous.bySector, "sectorDemand", "falling").filter((row) => row.absoluteChange < 0),
      categoryDemand: topNamedTrends(current.byCategory, previous.byCategory, "categoryDemand", "current"),
    },
    funnelMetrics,
    viralMetrics,
  };

  const predictions = buildPredictions(baseReport, currentEvents);
  const missingFields = Array.from(
    new Set(
      normalized.flatMap((event) => [
        event.vendorId ? "" : "vendorId",
        event.productId ? "" : "productId",
        event.city ? "" : "city",
        event.suburb ? "" : "suburb",
      ]).filter(Boolean),
    ),
  );

  return {
    ...baseReport,
    predictions,
    dataQuality: {
      hasEnoughData: current.eventCount >= 5 || previous.eventCount >= 5,
      missingFields,
      eventCount: current.eventCount + previous.eventCount,
      warningNotes: current.eventCount + previous.eventCount < 5 ? ["Not enough data"] : [],
    },
  };
};

const defaultSections = (reportData: MarketIntelligenceReportData) => {
  if (!reportData.dataQuality.hasEnoughData) {
    return {
      executiveSummary: "Not enough data",
      previousVsCurrentComparison: "Not enough data",
      productsGainingDemand: "Not enough data",
      productsLosingDemand: "Not enough data",
      locationDemandMovement: "Not enough data",
      vendorOpportunitiesAndRisks: "Not enough data",
      sectorMomentum: "Not enough data",
      futureMarketPossibilities: "Not enough data",
      recommendedActionPlan: ["Not enough data"],
      whatsappSummary: "Not enough data",
    };
  }

  const opens = reportData.comparisonMetrics.catalogueOpens;
  const whatsApp = reportData.comparisonMetrics.whatsappClicks;
  const topPrediction = reportData.predictions[0];
  const actions = reportData.predictions.slice(0, 6).map((prediction) => prediction.recommendedAction);
  return {
    executiveSummary: `Catalogue opens moved from ${opens.previousValue} to ${opens.currentValue}. WhatsApp clicks moved from ${whatsApp.previousValue} to ${whatsApp.currentValue}.`,
    previousVsCurrentComparison: `The current period is ${reportData.currentPeriod.dateFrom} to ${reportData.currentPeriod.dateTo}; the previous period is ${reportData.previousPeriod.dateFrom} to ${reportData.previousPeriod.dateTo}.`,
    productsGainingDemand: reportData.productTrends.risingProducts.map((row) => `${row.label}: ${row.previousValue} to ${row.currentValue}`).join("; ") || "Not enough data",
    productsLosingDemand: reportData.productTrends.fallingProducts.map((row) => `${row.label}: ${row.previousValue} to ${row.currentValue}`).join("; ") || "Not enough data",
    locationDemandMovement: reportData.locationTrends.risingLocations.map((row) => `${row.label}: ${row.previousValue} to ${row.currentValue}`).join("; ") || "Not enough data",
    vendorOpportunitiesAndRisks: reportData.vendorTrends.vendorsWithFallingInterest.map((row) => `${row.label}: ${row.previousValue} to ${row.currentValue}`).join("; ") || "Not enough data",
    sectorMomentum: reportData.sectorTrends.risingSectors.map((row) => `${row.label}: ${row.previousValue} to ${row.currentValue}`).join("; ") || "Not enough data",
    futureMarketPossibilities: topPrediction ? `${topPrediction.label}: ${topPrediction.finding} Confidence: ${topPrediction.confidence}.` : "Not enough data",
    recommendedActionPlan: actions.length ? actions : ["Review top products, vendor response readiness, and location demand."],
    whatsappSummary: topPrediction
      ? `AI Market Intelligence: ${topPrediction.label}. ${topPrediction.finding} Confidence: ${topPrediction.confidence}.`
      : `AI Market Intelligence: catalogue opens ${opens.previousValue} to ${opens.currentValue}, WhatsApp clicks ${whatsApp.previousValue} to ${whatsApp.currentValue}.`,
  };
};

const buildPrompt = (reportData: MarketIntelligenceReportData) => `
You are generating SCI/iTred market intelligence from calculated metrics.

Rules:
- Use only the structured JSON supplied below.
- App logic already calculated the metrics, trends, deltas and predictions.
- Do not invent numbers, sales, customer identities, or guarantees.
- Predictions are possibilities, not guarantees.
- If dataQuality.hasEnoughData is false, say "Not enough data" where needed.
- Do not expose raw session IDs.
- Return strict JSON with keys:
executiveSummary, previousVsCurrentComparison, productsGainingDemand, productsLosingDemand,
locationDemandMovement, vendorOpportunitiesAndRisks, sectorMomentum, futureMarketPossibilities,
recommendedActionPlan (array of strings), whatsappSummary.

Report JSON:
${JSON.stringify(reportData, null, 2)}
`;

const parseSession = () => {
  try {
    const raw = localStorage.getItem("activeStaffSession");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveReport = async (report: MarketIntelligenceReportOutput) => {
  const storage = getStorageAdapter();
  const safeReport = sanitizeForFirestore(report);
  if (storage.batchSetItems) {
    await storage.batchSetItems(OUTPUTS_KEY, [safeReport]);
    return;
  }
  const existing = await storage.getItem<MarketIntelligenceReportOutput[]>(OUTPUTS_KEY);
  await storage.setItem(OUTPUTS_KEY, [safeReport, ...((existing as MarketIntelligenceReportOutput[]) || [])]);
};

export const marketIntelligenceService = {
  async buildReportData(
    reportType: MarketIntelligenceReportType,
    filters?: Partial<MarketIntelligenceFilters>,
  ): Promise<MarketIntelligenceReportData> {
    return buildReportData(reportType, filters);
  },

  async generateReport(
    reportType: MarketIntelligenceReportType,
    filters?: Partial<MarketIntelligenceFilters>,
  ): Promise<MarketIntelligenceReportOutput> {
    const reportData = await buildReportData(reportType, filters);
    const fallback = defaultSections(reportData);
    let sections = fallback;
    let status: MarketIntelligenceReportOutput["status"] = reportData.dataQuality.hasEnoughData ? "generated" : "not_enough_data";

    if (reportData.dataQuality.hasEnoughData) {
      try {
        const apiKey =
          import.meta.env.VITE_GEMINI_API_KEY ||
          import.meta.env.VITE_GOOGLE_GENAI_API_KEY ||
          import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Missing Gemini API key");
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: buildPrompt(reportData),
          config: { temperature: 0.1, responseMimeType: "application/json" },
        });
        const parsed = JSON.parse(response.text || "{}");
        sections = {
          executiveSummary: safeString(parsed.executiveSummary, fallback.executiveSummary),
          previousVsCurrentComparison: safeString(parsed.previousVsCurrentComparison, fallback.previousVsCurrentComparison),
          productsGainingDemand: safeString(parsed.productsGainingDemand, fallback.productsGainingDemand),
          productsLosingDemand: safeString(parsed.productsLosingDemand, fallback.productsLosingDemand),
          locationDemandMovement: safeString(parsed.locationDemandMovement, fallback.locationDemandMovement),
          vendorOpportunitiesAndRisks: safeString(parsed.vendorOpportunitiesAndRisks, fallback.vendorOpportunitiesAndRisks),
          sectorMomentum: safeString(parsed.sectorMomentum, fallback.sectorMomentum),
          futureMarketPossibilities: safeString(parsed.futureMarketPossibilities, fallback.futureMarketPossibilities),
          recommendedActionPlan: Array.isArray(parsed.recommendedActionPlan)
            ? parsed.recommendedActionPlan.map(String).filter(Boolean).slice(0, 10)
            : fallback.recommendedActionPlan,
          whatsappSummary: safeString(parsed.whatsappSummary, fallback.whatsappSummary),
        };
      } catch {
        status = "failed";
      }
    }

    const session = parseSession();
    const output: MarketIntelligenceReportOutput = sanitizeForFirestore({
      id: `MIR-${Date.now()}`,
      reportType,
      title: reportTitles[reportType],
      reportData,
      aiNarrative: sections.executiveSummary,
      sections,
      generatedAt: new Date().toISOString(),
      createdByStaffId: session.staffId || session.id || null,
      status,
      model: MODEL,
    });
    await saveReport(output);
    return output;
  },

  async getReports(): Promise<MarketIntelligenceReportOutput[]> {
    const data = await getStorageAdapter().getItem<MarketIntelligenceReportOutput[]>(OUTPUTS_KEY);
    return Array.isArray(data) ? data : [];
  },

  copyWhatsappSummary(report: MarketIntelligenceReportOutput): string {
    return report.sections.whatsappSummary || "Not enough data";
  },

  logToWhatsappActivities(report: MarketIntelligenceReportOutput): void {
    const filters = report.reportData.filters;
    const confidenceCounts = report.reportData.predictions.reduce<Record<string, number>>((acc, item) => {
      acc[item.confidence] = (acc[item.confidence] || 0) + 1;
      return acc;
    }, {});
    const confidence: ConfidenceLevel =
      confidenceCounts.high ? "high" : confidenceCounts.medium ? "medium" : "low";
    const session = parseSession();
    whatsappActivityService.saveIntelligenceLog(
      sanitizeForFirestore({
        id: `WAI-${Date.now()}`,
        activityType: "ai_market_intelligence_prediction",
        source: "catalogue_activity_sync",
        reportType: report.reportType,
        vendorId: filters.vendorId ?? null,
        sector: filters.sector ?? null,
        catalogueId: filters.catalogueId ?? null,
        periodFrom: report.reportData.currentPeriod.dateFrom,
        periodTo: report.reportData.currentPeriod.dateTo,
        previousPeriodFrom: report.reportData.previousPeriod.dateFrom,
        previousPeriodTo: report.reportData.previousPeriod.dateTo,
        summary: report.sections.whatsappSummary,
        predictions: report.reportData.predictions,
        recommendedActions: report.sections.recommendedActionPlan,
        confidence,
        createdAt: new Date().toISOString(),
        createdByStaffId: session.staffId || session.id || null,
        aiGenerated: true,
      } as any),
    );
  },

  exportPdf(report: MarketIntelligenceReportOutput): void {
    const doc = new jsPDF();
    doc.setFillColor(46, 46, 46);
    doc.rect(0, 0, 210, 34, "F");
    doc.setFillColor(255, 107, 0);
    doc.rect(0, 34, 210, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.text("SCI/iTred Market Intelligence", 14, 16);
    doc.setFontSize(9);
    doc.text(report.title, 14, 25);

    doc.setTextColor(46, 46, 46);
    doc.setFontSize(11);
    doc.text(`Current: ${report.reportData.currentPeriod.dateFrom} to ${report.reportData.currentPeriod.dateTo}`, 14, 48);
    doc.text(`Previous: ${report.reportData.previousPeriod.dateFrom} to ${report.reportData.previousPeriod.dateTo}`, 14, 55);

    autoTable(doc, {
      startY: 64,
      head: [["Metric", "Previous", "Current", "Change", "%", "Trend"]],
      body: Object.values(report.reportData.comparisonMetrics).map((metric) => [
        metric.metric,
        metric.previousValue,
        metric.currentValue,
        metric.absoluteChange,
        metric.percentChange === null ? "new" : `${metric.percentChange}%`,
        metric.trendDirection,
      ]),
      theme: "striped",
      headStyles: { fillColor: [46, 46, 46] },
      styles: { fontSize: 7, cellPadding: 2 },
    });

    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY || 90) + 8,
      head: [["Prediction", "Finding", "Confidence", "Action"]],
      body: report.reportData.predictions.slice(0, 10).map((prediction) => [
        prediction.label,
        prediction.finding,
        prediction.confidence,
        prediction.recommendedAction,
      ]),
      theme: "striped",
      headStyles: { fillColor: [255, 107, 0] },
      styles: { fontSize: 7, cellPadding: 2 },
    });

    let y = ((doc as any).lastAutoTable?.finalY || 130) + 10;
    if (y > 240) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(12);
    doc.text("Recommended Action Plan", 14, y);
    doc.setFontSize(9);
    report.sections.recommendedActionPlan.slice(0, 8).forEach((action, index) => {
      doc.text(doc.splitTextToSize(`${index + 1}. ${action}`, 178), 14, y + 8 + index * 9);
    });

    y += 88;
    if (y > 240) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(12);
    doc.text("WhatsApp Summary", 14, y);
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(report.sections.whatsappSummary || "Not enough data", 178), 14, y + 8);

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Powered by seiGEN Commerce Infrastructure", 14, 287);
      doc.text(`Page ${page} of ${pageCount}`, 196, 287, { align: "right" });
    }
    doc.save(`itred_market_intelligence_${report.reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
  },
};
