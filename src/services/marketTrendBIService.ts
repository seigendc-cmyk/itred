/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CustomerBehaviourSummary,
  LocationTrend,
  MarketRecommendation,
  MarketRiskSignal,
  MarketTrendFilters,
  MarketTrendReport,
  TrendingProduct,
  VendorMarketPerformance,
  WhatsAppActivityLog,
} from "../types.ts";

type NormalizedMarketLog = {
  id: string;
  date: string;
  vendorId?: string;
  vendorName?: string;
  productId?: string;
  productName: string;
  customerKey?: string;
  sector?: string;
  category?: string;
  suburb?: string;
  city?: string;
  province?: string;
  country?: string;
  interactionType: string;
  source?: string;
  buyingIntent?: string;
  status?: string;
  leadStatus?: string;
  responseStatus?: string;
  responseTimeMinutes?: number;
  followUpRequired: boolean;
  followUpDate?: string;
};

const today = () => new Date().toISOString().split("T")[0];
const normalize = (value?: string) => (value || "").trim();
const label = (value?: string, fallback = "Unspecified") =>
  normalize(value) || fallback;
const dateKey = (value?: string) => String(value || "").slice(0, 10);
const lower = (value?: string) => normalize(value).toLowerCase();
const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const increment = (record: Record<string, number>, key?: string) => {
  const nextKey = label(key);
  record[nextKey] = (record[nextKey] || 0) + 1;
};

const topEntries = (record: Record<string, number>, limit = 8) =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));

const isProductEnquiry = (log: NormalizedMarketLog) =>
  ["PRODUCT_ENQUIRY", "CUSTOMER_REQUEST", "DEMAND_SIGNAL"].includes(
    log.interactionType,
  ) ||
  lower(log.interactionType).includes("enquiry") ||
  lower(log.interactionType).includes("product search");

const isPriceEnquiry = (log: NormalizedMarketLog) =>
  lower(log.interactionType).includes("price");

const isStockQuery = (log: NormalizedMarketLog) =>
  lower(log.interactionType).includes("stock") ||
  lower(log.buyingIntent).includes("stock");

const isClickSignal = (log: NormalizedMarketLog) =>
  lower(log.interactionType).includes("catalogue") ||
  lower(log.interactionType).includes("storefront") ||
  lower(log.source).includes("call") ||
  lower(log.source).includes("whatsapp");

const isConfirmedOrder = (log: NormalizedMarketLog) =>
  log.leadStatus === "CONVERTED" ||
  lower(log.status).includes("converted") ||
  lower(log.buyingIntent).includes("confirmed") ||
  log.interactionType === "VENDOR_RESPONDED";

const isConvertedLead = (log: NormalizedMarketLog) =>
  log.leadStatus === "CONVERTED" || lower(log.status).includes("converted");

const isLostLead = (log: NormalizedMarketLog) =>
  log.leadStatus === "LOST" ||
  log.responseStatus === "MISSED" ||
  log.interactionType === "VENDOR_DID_NOT_RESPOND" ||
  lower(log.status).includes("lost") ||
  lower(log.status).includes("missed");

const isComplaint = (log: NormalizedMarketLog) =>
  log.interactionType === "COMPLAINT_RECEIVED" ||
  log.interactionType === "SPAM_OR_FALSE_LISTING" ||
  lower(log.interactionType).includes("complaint") ||
  lower(log.interactionType).includes("fraud") ||
  lower(log.interactionType).includes("warranty");

const isPendingFollowUp = (log: NormalizedMarketLog) =>
  log.followUpRequired &&
  (!log.followUpDate || log.followUpDate <= today()) &&
  log.responseStatus !== "RESPONDED" &&
  !lower(log.status).includes("resolved");

const getBuyingIntent = (log: WhatsAppActivityLog) => {
  const raw = (log as any).buyingIntent || log.leadStatus || log.activityType;
  if (log.leadStatus === "CONVERTED") return "confirmed";
  if (log.leadStatus === "LOST") return "lost";
  if (log.followUpRequired) return "follow_up";
  return String(raw || "");
};

const normalizeLogs = (logs: WhatsAppActivityLog[]): NormalizedMarketLog[] =>
  (Array.isArray(logs) ? logs : []).map((log) => ({
    id: log.id,
    date: dateKey(log.activityDate || log.createdAt),
    vendorId: log.vendorId,
    vendorName: log.vendorName,
    productId: (log as any).productId || log.catalogueId || log.storefrontId,
    productName: label(log.productName || log.customerNeed, "Unspecified Product"),
    customerKey: (log as any).customerPhone || (log as any).customerName,
    sector: log.sector,
    category: log.category,
    suburb: (log as any).suburb,
    city: log.cityTown,
    province: log.province,
    country: (log as any).country,
    interactionType: log.activityType,
    source: log.sourceName || log.sourceType,
    buyingIntent: getBuyingIntent(log),
    status: log.responseStatus || log.leadStatus,
    leadStatus: log.leadStatus,
    responseStatus: log.responseStatus,
    responseTimeMinutes: log.responseTimeMinutes,
    followUpRequired: !!log.followUpRequired,
    followUpDate: log.followUpDate,
  }));

const applyFilters = (
  logs: NormalizedMarketLog[],
  filters: MarketTrendFilters = {},
) =>
  logs.filter((log) => {
    if (filters.dateFrom && log.date < filters.dateFrom) return false;
    if (filters.dateTo && log.date > filters.dateTo) return false;
    if (filters.vendorId && log.vendorId !== filters.vendorId) return false;
    if (
      filters.productId &&
      log.productId !== filters.productId &&
      log.productName !== filters.productId
    ) {
      return false;
    }
    if (filters.sector && log.sector !== filters.sector) return false;
    if (filters.category && log.category !== filters.category) return false;
    if (filters.suburb && log.suburb !== filters.suburb) return false;
    if (filters.city && log.city !== filters.city) return false;
    if (filters.province && log.province !== filters.province) return false;
    if (filters.country && log.country !== filters.country) return false;
    if (filters.interactionType && log.interactionType !== filters.interactionType)
      return false;
    if (filters.source && log.source !== filters.source) return false;
    if (filters.buyingIntent && log.buyingIntent !== filters.buyingIntent)
      return false;
    if (filters.status && log.status !== filters.status) return false;
    return true;
  });

const buildTrendingProducts = (logs: NormalizedMarketLog[]): TrendingProduct[] => {
  const byProduct = new Map<string, NormalizedMarketLog[]>();
  logs.forEach((log) => {
    const key = log.productId || log.productName;
    byProduct.set(key, [...(byProduct.get(key) || []), log]);
  });

  return Array.from(byProduct.entries())
    .map(([key, rows]) => {
      const customerCounts: Record<string, number> = {};
      const locationCounts: Record<string, number> = {};
      let productEnquiries = 0;
      let priceEnquiries = 0;
      let stockQueries = 0;
      let clickSignals = 0;
      let confirmedOrders = 0;
      let convertedLeads = 0;
      let lostLeads = 0;
      let complaints = 0;

      rows.forEach((log) => {
        if (log.customerKey) increment(customerCounts, log.customerKey);
        increment(locationCounts, log.suburb || log.city || log.province || log.country);
        if (isProductEnquiry(log)) productEnquiries++;
        if (isPriceEnquiry(log)) priceEnquiries++;
        if (isStockQuery(log)) stockQueries++;
        if (isClickSignal(log)) clickSignals++;
        if (isConfirmedOrder(log)) confirmedOrders++;
        if (isConvertedLead(log)) convertedLeads++;
        if (isLostLead(log)) lostLeads++;
        if (isComplaint(log)) complaints++;
      });

      const repeatCustomerInterest = Object.values(customerCounts).filter(
        (count) => count > 1,
      ).length;
      const trendScore = Math.max(
        0,
        productEnquiries * 5 +
          priceEnquiries * 4 +
          stockQueries * 5 +
          clickSignals * 2 +
          repeatCustomerInterest * 4 +
          confirmedOrders * 10 +
          convertedLeads * 12 -
          lostLeads * 6 -
          complaints * 5,
      );

      return {
        productId: rows[0]?.productId || key,
        productName: rows[0]?.productName || key,
        vendorId: rows[0]?.vendorId,
        vendorName: rows[0]?.vendorName,
        sector: rows[0]?.sector,
        category: rows[0]?.category,
        trendScore,
        totalInteractions: rows.length,
        productEnquiries,
        priceEnquiries,
        stockQueries,
        clickSignals,
        repeatCustomerInterest,
        confirmedOrders,
        convertedLeads,
        lostLeads,
        complaints,
        topLocations: topEntries(locationCounts, 5),
      };
    })
    .sort((a, b) => b.trendScore - a.trendScore || b.totalInteractions - a.totalInteractions);
};

const dominantBehaviour = (rows: NormalizedMarketLog[]) => {
  const demand = rows.filter(isProductEnquiry).length;
  const price = rows.filter(isPriceEnquiry).length;
  const stock = rows.filter(isStockQuery).length;
  const complaints = rows.filter(isComplaint).length;
  const lost = rows.filter(isLostLead).length;
  const converted = rows.filter(isConvertedLead).length;
  const entries = [
    ["Product demand", demand],
    ["Price checking", price],
    ["Stock availability pressure", stock],
    ["Complaint risk", complaints],
    ["Lost opportunities", lost],
    ["Conversion activity", converted],
  ].sort((a, b) => Number(b[1]) - Number(a[1]));
  return Number(entries[0]?.[1] || 0) > 0 ? String(entries[0][0]) : "Low signal";
};

const buildLocationTrends = (
  logs: NormalizedMarketLog[],
  level: LocationTrend["level"],
): LocationTrend[] => {
  const byLocation = new Map<string, NormalizedMarketLog[]>();
  logs.forEach((log) => {
    const name = label(log[level], "Unknown");
    byLocation.set(name, [...(byLocation.get(name) || []), log]);
  });

  return Array.from(byLocation.entries())
    .map(([name, rows]) => {
      const productCounts: Record<string, number> = {};
      const sectorCounts: Record<string, number> = {};
      rows.forEach((log) => {
        increment(productCounts, log.productName);
        increment(sectorCounts, log.sector);
      });
      const confirmedBuyingIntent = rows.filter(isConfirmedOrder).length;
      const lostLeads = rows.filter(isLostLead).length;
      const complaints = rows.filter(isComplaint).length;
      return {
        level,
        name,
        totalInteractions: rows.length,
        topProducts: topEntries(productCounts, 5),
        topSectors: topEntries(sectorCounts, 5),
        confirmedBuyingIntent,
        lostLeads,
        complaints,
        conversionRate:
          rows.length > 0 ? Math.round((confirmedBuyingIntent / rows.length) * 100) : 0,
        dominantMarketBehaviour: dominantBehaviour(rows),
      };
    })
    .sort((a, b) => b.totalInteractions - a.totalInteractions);
};

const buildCustomerBehaviourSummary = (
  logs: NormalizedMarketLog[],
): CustomerBehaviourSummary => {
  const byCustomer = new Map<string, NormalizedMarketLog[]>();
  logs.forEach((log) => {
    if (!log.customerKey) return;
    byCustomer.set(log.customerKey, [...(byCustomer.get(log.customerKey) || []), log]);
  });

  const summary: CustomerBehaviourSummary = {
    totalCustomers: byCustomer.size,
    priceCheckers: 0,
    seriousBuyers: 0,
    repeatBuyers: 0,
    hotLeads: 0,
    lostBuyers: 0,
    complaintRisks: 0,
    convertedCustomers: 0,
    behaviourMix: [],
  };

  byCustomer.forEach((rows) => {
    const priceChecks = rows.filter(isPriceEnquiry).length;
    const demandSignals = rows.filter(
      (log) => isProductEnquiry(log) || isStockQuery(log),
    ).length;
    const converted = rows.some(isConvertedLead);
    const lost = rows.some(isLostLead);
    const complaint = rows.some(isComplaint);
    const followUp = rows.some(isPendingFollowUp);
    if (priceChecks > 0 && converted === false && demandSignals <= priceChecks)
      summary.priceCheckers++;
    if (demandSignals >= 2 || rows.some(isConfirmedOrder)) summary.seriousBuyers++;
    if (rows.length > 1) summary.repeatBuyers++;
    if (followUp && demandSignals > 0 && !lost) summary.hotLeads++;
    if (lost) summary.lostBuyers++;
    if (complaint) summary.complaintRisks++;
    if (converted) summary.convertedCustomers++;
  });

  summary.behaviourMix = [
    { behaviour: "Price checker", count: summary.priceCheckers },
    { behaviour: "Serious buyer", count: summary.seriousBuyers },
    { behaviour: "Repeat buyer", count: summary.repeatBuyers },
    { behaviour: "Hot lead", count: summary.hotLeads },
    { behaviour: "Lost buyer", count: summary.lostBuyers },
    { behaviour: "Complaint risk", count: summary.complaintRisks },
    { behaviour: "Converted customer", count: summary.convertedCustomers },
  ];
  return summary;
};

const buildVendorPerformance = (
  logs: NormalizedMarketLog[],
): VendorMarketPerformance[] => {
  const byVendor = new Map<string, NormalizedMarketLog[]>();
  logs.forEach((log) => {
    const key = log.vendorId || log.vendorName || "unknown";
    byVendor.set(key, [...(byVendor.get(key) || []), log]);
  });

  return Array.from(byVendor.entries())
    .map(([vendorId, rows]) => {
      const customers = new Set(rows.map((row) => row.customerKey).filter(Boolean));
      const productCounts: Record<string, number> = {};
      const responseTimes = rows
        .map((row) => row.responseTimeMinutes)
        .filter((value): value is number => typeof value === "number");
      rows.forEach((row) => increment(productCounts, row.productName));
      const confirmedOrders = rows.filter(isConfirmedOrder).length;
      const convertedLeads = rows.filter(isConvertedLead).length;
      const lostLeads = rows.filter(isLostLead).length;
      const pendingFollowUps = rows.filter(isPendingFollowUp).length;
      const complaints = rows.filter(isComplaint).length;
      const averageResponseTimeMinutes =
        responseTimes.length > 0
          ? Math.round(
              responseTimes.reduce((sum, value) => sum + value, 0) /
                responseTimes.length,
            )
          : 0;
      const marketFeedScore = Math.round(
        clamp(
          65 +
            confirmedOrders * 6 +
            convertedLeads * 8 -
            lostLeads * 5 -
            pendingFollowUps * 4 -
            complaints * 6 -
            Math.max(0, averageResponseTimeMinutes - 60) * 0.2,
        ),
      );
      const remedialRecommendations: string[] = [];
      if (lostLeads > 0) remedialRecommendations.push("Recover missed buyers with same-day callbacks.");
      if (pendingFollowUps > 0) remedialRecommendations.push("Assign all pending follow-ups to staff.");
      if (complaints > 0) remedialRecommendations.push("Resolve complaints before promoting more traffic.");
      if (averageResponseTimeMinutes > 60) remedialRecommendations.push("Reduce WhatsApp response time below 60 minutes.");
      if (remedialRecommendations.length === 0)
        remedialRecommendations.push("Maintain active lead handling and keep product availability current.");

      return {
        vendorId,
        vendorName: label(rows[0]?.vendorName, "Unknown Vendor"),
        totalInteractions: rows.length,
        uniqueCustomers: customers.size,
        topRequestedProducts: topEntries(productCounts, 5),
        confirmedOrders,
        convertedLeads,
        lostLeads,
        pendingFollowUps,
        complaints,
        averageResponseTimeMinutes,
        marketFeedScore,
        remedialRecommendations,
      };
    })
    .sort((a, b) => b.totalInteractions - a.totalInteractions);
};

const buildRiskSignals = (
  logs: NormalizedMarketLog[],
  trendingProducts: TrendingProduct[],
  vendors: VendorMarketPerformance[],
): MarketRiskSignal[] => {
  const signals: MarketRiskSignal[] = [];
  const complaintCount = logs.filter(isComplaint).length;
  const lostLeadCount = logs.filter(isLostLead).length;
  const pendingFollowUps = logs.filter(isPendingFollowUp).length;
  const fraudCount = logs.filter((log) => lower(log.interactionType).includes("fraud")).length;

  if (complaintCount > 0) {
    signals.push({
      id: "complaints",
      type: "complaint",
      severity: complaintCount >= 5 ? "critical" : complaintCount >= 3 ? "high" : "warning",
      title: "Complaint pressure detected",
      message: `${complaintCount} complaint or risk interactions were recorded.`,
      count: complaintCount,
    });
  }
  if (lostLeadCount > 0) {
    signals.push({
      id: "lost-leads",
      type: "lost_opportunity",
      severity: lostLeadCount >= 5 ? "high" : "warning",
      title: "Lost opportunities detected",
      message: `${lostLeadCount} leads were lost or missed.`,
      count: lostLeadCount,
    });
  }
  if (pendingFollowUps > 0) {
    signals.push({
      id: "pending-followups",
      type: "follow_up",
      severity: pendingFollowUps >= 8 ? "critical" : "high",
      title: "Follow-up backlog",
      message: `${pendingFollowUps} follow-ups require action.`,
      count: pendingFollowUps,
    });
  }
  if (fraudCount > 0) {
    signals.push({
      id: "fraud",
      type: "fraud",
      severity: "critical",
      title: "Fraud signals require review",
      message: `${fraudCount} fraud-related interactions were detected.`,
      count: fraudCount,
    });
  }
  trendingProducts
    .filter((product) => product.stockQueries >= 3)
    .slice(0, 3)
    .forEach((product) =>
      signals.push({
        id: `stock-gap-${product.productName}`,
        type: "stock_gap",
        severity: "high",
        title: "Stock gap demand",
        message: `${product.productName} has ${product.stockQueries} stock availability queries.`,
        vendorId: product.vendorId,
        productName: product.productName,
        count: product.stockQueries,
      }),
    );
  vendors
    .filter((vendor) => vendor.averageResponseTimeMinutes > 60)
    .slice(0, 3)
    .forEach((vendor) =>
      signals.push({
        id: `slow-response-${vendor.vendorId}`,
        type: "slow_response",
        severity: "high",
        title: "Slow vendor response",
        message: `${vendor.vendorName} averages ${vendor.averageResponseTimeMinutes} minutes to respond.`,
        vendorId: vendor.vendorId,
        count: vendor.averageResponseTimeMinutes,
      }),
    );
  return signals;
};

const buildRecommendations = (
  report: Pick<
    MarketTrendReport,
    | "trendingProducts"
    | "vendorPerformance"
    | "riskSignals"
    | "lostLeads"
    | "complaints"
    | "pendingFollowUps"
  >,
): MarketRecommendation[] => {
  const recommendations: MarketRecommendation[] = [];
  const topProduct = report.trendingProducts[0];
  if (topProduct) {
    recommendations.push({
      id: "promote-top-product",
      priority: topProduct.trendScore >= 40 ? "high" : "medium",
      action: `Confirm stock and promote ${topProduct.productName}.`,
      reason: "It is the strongest product trend in the selected period.",
      target: topProduct.productName,
    });
  }
  if (report.lostLeads > 0) {
    recommendations.push({
      id: "recover-lost-leads",
      priority: "high",
      action: "Recover lost leads with direct follow-up and updated offer details.",
      reason: "Lost opportunities reduce market conversion.",
    });
  }
  if (report.pendingFollowUps > 0) {
    recommendations.push({
      id: "clear-followups",
      priority: report.pendingFollowUps >= 8 ? "critical" : "high",
      action: "Assign pending follow-ups to staff and close them today.",
      reason: "Follow-up backlog blocks conversion.",
    });
  }
  if (report.complaints > 0) {
    recommendations.push({
      id: "resolve-complaints",
      priority: report.complaints >= 5 ? "critical" : "high",
      action: "Resolve complaints before increasing product promotion.",
      reason: "Risk signals can damage trust and repeat buying.",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "continue-capture",
      priority: "low",
      action: "Continue capturing WhatsApp market interactions consistently.",
      reason: "More structured market records improve trend confidence.",
    });
  }
  return recommendations;
};

const buildReport = (
  rawLogs: WhatsAppActivityLog[],
  filters: MarketTrendFilters = {},
): MarketTrendReport => {
  const logs = applyFilters(normalizeLogs(rawLogs), filters);
  const customers = new Set(logs.map((log) => log.customerKey).filter(Boolean));
  const trendingProducts = buildTrendingProducts(logs);
  const locationTrends = [
    ...buildLocationTrends(logs, "suburb"),
    ...buildLocationTrends(logs, "city"),
    ...buildLocationTrends(logs, "province"),
    ...buildLocationTrends(logs, "country"),
  ].filter((trend) => trend.name !== "Unknown");
  const customerBehaviour = buildCustomerBehaviourSummary(logs);
  const vendorPerformance = buildVendorPerformance(logs);
  const confirmedBuyingIntent = logs.filter(isConfirmedOrder).length;
  const convertedLeads = logs.filter(isConvertedLead).length;
  const lostLeads = logs.filter(isLostLead).length;
  const complaints = logs.filter(isComplaint).length;
  const pendingFollowUps = logs.filter(isPendingFollowUp).length;
  const riskSignals = buildRiskSignals(logs, trendingProducts, vendorPerformance);
  const recommendations = buildRecommendations({
    trendingProducts,
    vendorPerformance,
    riskSignals,
    lostLeads,
    complaints,
    pendingFollowUps,
  });
  const periodLabel = `${filters.dateFrom || "All time"} to ${filters.dateTo || "All time"}`;
  const topProductText =
    trendingProducts
      .slice(0, 3)
      .map((item) => item.productName)
      .join(", ") || "no dominant product yet";
  const topLocationText =
    locationTrends
      .filter((item) => item.level === "city" || item.level === "province")
      .slice(0, 3)
      .map((item) => item.name)
      .join(", ") || "no dominant location yet";
  const vendorName =
    filters.vendorId
      ? label(vendorPerformance.find((vendor) => vendor.vendorId === filters.vendorId)?.vendorName, "Selected Vendor")
      : "All Vendors";
  const topRecommendation = recommendations[0]?.action || "keep monitoring demand.";

  return {
    filters,
    generatedAt: new Date().toISOString(),
    periodLabel,
    executiveSummary: `SCI Market BI found ${logs.length} interactions from ${customers.size} customers for ${periodLabel}. Trending products: ${topProductText}. Strongest demand locations: ${topLocationText}. Lost leads: ${lostLeads}; complaints: ${complaints}.`,
    totalInteractions: logs.length,
    uniqueCustomers: customers.size,
    confirmedBuyingIntent,
    convertedLeads,
    lostLeads,
    complaints,
    pendingFollowUps,
    trendingProducts,
    locationTrends,
    customerBehaviour,
    vendorPerformance,
    riskSignals,
    recommendations,
    whatsappSummary: `Hi ${vendorName}, your SCI Market Feed Report for ${periodLabel} shows ${logs.length} customer interactions. Trending products: ${topProductText}. Strongest demand locations: ${topLocationText}. You have ${lostLeads} lost leads and ${complaints} complaints. Recommended action: ${topRecommendation}`,
  };
};

export const marketTrendBIService = {
  generateMarketTrendReport(
    logs: WhatsAppActivityLog[],
    filters: MarketTrendFilters = {},
  ): MarketTrendReport {
    return buildReport(logs, filters);
  },

  generateVendorMarketReport(
    logs: WhatsAppActivityLog[],
    vendorId: string,
    filters: MarketTrendFilters = {},
  ): MarketTrendReport {
    return buildReport(logs, { ...filters, vendorId });
  },

  generateProductTrendReport(
    logs: WhatsAppActivityLog[],
    productId: string,
    filters: MarketTrendFilters = {},
  ): MarketTrendReport {
    return buildReport(logs, { ...filters, productId });
  },

  generateCustomerBehaviourSummary(
    logs: WhatsAppActivityLog[],
    filters: MarketTrendFilters = {},
  ): CustomerBehaviourSummary {
    return buildCustomerBehaviourSummary(
      applyFilters(normalizeLogs(logs), filters),
    );
  },
};
