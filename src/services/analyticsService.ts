/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityLog } from "../types.ts";
import { asArray } from "../utils/safeData.ts";
import { getStorageAdapter } from "./storageService.ts";
import { generateActivityEventId } from "../utils/idGenerator.ts";
import { firebaseHealthService } from "./firebaseHealthService.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";

const EVENTS_KEY = "itred_activity_logs";

export type AnalyticsPeriod = "day" | "week" | "month";

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  vendorId?: string;
  productId?: string;
  sector?: string;
  suburb?: string;
  city?: string;
  country?: string;
  period?: AnalyticsPeriod;
}

export interface NormalizedAnalyticsFilters {
  dateFrom: string;
  dateTo: string;
  vendorId?: string;
  productId?: string;
  sector?: string;
  suburb?: string;
  city?: string;
  country?: string;
  period: AnalyticsPeriod;
}

export interface AnalyticsMetricRow {
  key: string;
  label: string;
  catalogueViews: number;
  productClicks: number;
  whatsappEnquiries: number;
  vendorOrders: number;
  subscriptions: number;
  rpnAssignments: number;
  totalSignals: number;
}

export interface ConsoleAnalyticsResult {
  filters: NormalizedAnalyticsFilters;
  generatedAt: string;
  totals: Omit<AnalyticsMetricRow, "key" | "label" | "totalSignals">;
  byVendor: AnalyticsMetricRow[];
  byProduct: AnalyticsMetricRow[];
  bySector: AnalyticsMetricRow[];
  bySuburb: AnalyticsMetricRow[];
  byCity: AnalyticsMetricRow[];
  byCountry: AnalyticsMetricRow[];
  byPeriod: AnalyticsMetricRow[];
  sourceCounts: {
    vendors: number;
    products: number;
    catalogues: number;
    catalogueViews: number;
    productClicks: number;
    whatsappEnquiries: number;
    vendorOrders: number;
    subscriptions: number;
    rpnStaff: number;
    rpnAssignments: number;
  };
  empty: boolean;
}

const dayMs = 24 * 60 * 60 * 1000;

const todayKey = () => new Date().toISOString().slice(0, 10);

const dateDaysAgo = (days: number) =>
  new Date(Date.now() - days * dayMs).toISOString().slice(0, 10);

const safeString = (value: unknown, fallback = "Unspecified"): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const safeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function normalizeAnalyticsEvent(event: any) {
  return sanitizeForFirestore({
    ...event,

    vendorId: event?.vendorId ?? null,
    vendorName: event?.vendorName ?? null,

    userId: event?.userId ?? null,
    staffId: event?.staffId ?? null,

    sector: event?.sector ?? null,
    category: event?.category ?? null,

    source: event?.source ?? null,

    entityId: event?.entityId ?? null,
    entityType: event?.entityType ?? null,

    metadata: sanitizeForFirestore(event?.metadata ?? {}),
  });
}

const normalizeDateKey = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object" && typeof (value as any).toDate === "function") {
    const date = (value as any).toDate();
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  const raw =
    typeof value === "object" && "seconds" in (value as any)
      ? new Date(safeNumber((value as any).seconds) * 1000)
      : new Date(String(value));
  return Number.isNaN(raw.getTime()) ? String(value).slice(0, 10) : raw.toISOString().slice(0, 10);
};

export const normalizeAnalyticsFilters = (
  filters?: Partial<AnalyticsFilters> | null,
): NormalizedAnalyticsFilters => {
  const safeFilters = filters ?? {};
  const dateTo = normalizeDateKey(safeFilters.dateTo) || todayKey();
  const dateFrom = normalizeDateKey(safeFilters.dateFrom) || dateDaysAgo(30);
  const from = dateFrom > dateTo ? dateTo : dateFrom;
  const to = dateFrom > dateTo ? dateFrom : dateTo;

  return {
    dateFrom: from,
    dateTo: to,
    vendorId: safeFilters.vendorId || undefined,
    productId: safeFilters.productId || undefined,
    sector: safeFilters.sector || undefined,
    suburb: safeFilters.suburb || undefined,
    city: safeFilters.city || undefined,
    country: safeFilters.country || undefined,
    period: safeFilters.period || "day",
  };
};

const dateInRange = (date: string, filters: NormalizedAnalyticsFilters) => {
  if (!date) return true;
  return date >= filters.dateFrom && date <= filters.dateTo;
};

const periodKey = (date: string, period: AnalyticsPeriod): string => {
  if (!date) return "Unspecified";
  if (period === "month") return date.slice(0, 7);
  if (period === "week") {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    const first = new Date(parsed);
    const day = first.getUTCDay() || 7;
    first.setUTCDate(first.getUTCDate() - day + 1);
    return first.toISOString().slice(0, 10);
  }
  return date.slice(0, 10);
};

const emptyMetric = (key: string, label = key): AnalyticsMetricRow => ({
  key,
  label,
  catalogueViews: 0,
  productClicks: 0,
  whatsappEnquiries: 0,
  vendorOrders: 0,
  subscriptions: 0,
  rpnAssignments: 0,
  totalSignals: 0,
});

type MetricName =
  | "catalogueViews"
  | "productClicks"
  | "whatsappEnquiries"
  | "vendorOrders"
  | "subscriptions"
  | "rpnAssignments";

const addMetric = (
  map: Map<string, AnalyticsMetricRow>,
  key: string | undefined,
  metric: MetricName,
  amount = 1,
  label?: string,
) => {
  const resolvedKey = safeString(key);
  const row = map.get(resolvedKey) || emptyMetric(resolvedKey, label || resolvedKey);
  row[metric] += amount;
  row.totalSignals += amount;
  map.set(resolvedKey, row);
};

const sortedRows = (map: Map<string, AnalyticsMetricRow>, limit = 50) =>
  Array.from(map.values())
    .sort((a, b) => b.totalSignals - a.totalSignals || a.label.localeCompare(b.label))
    .slice(0, limit);

const readCollection = async <T>(names: string[]): Promise<T[]> => {
  const storage = getStorageAdapter();
  for (const name of names) {
    try {
      const data = await storage.getItem<T[]>(name);
      const rows = asArray<T>(data);
      if (rows.length > 0) return rows;
    } catch (error) {
      console.warn(`Analytics collection read failed for ${name}`, error);
    }
  }
  return [];
};

const firstValue = (record: any, keys: string[], fallback = ""): string => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return fallback;
};

const findById = (rows: any[], id?: string) =>
  id ? rows.find((row) => row?.id === id || row?.vendorId === id || row?.productId === id) : undefined;

const recordDate = (record: any) =>
  normalizeDateKey(
    record?.eventDate ||
      record?.activityDate ||
      record?.orderDate ||
      record?.assignedAt ||
      record?.subscriptionDate ||
      record?.createdAt ||
      record?.updatedAt ||
      record?.timestamp ||
      record?.date,
  );

const passesDimensionFilters = (
  record: any,
  filters: NormalizedAnalyticsFilters,
  vendors: any[],
  products: any[],
) => {
  const product = findById(products, firstValue(record, ["productId", "offerId"], ""));
  const vendor = findById(
    vendors,
    firstValue(record, ["vendorId", "vendor_id"], "") || product?.vendorId,
  );
  const sector = firstValue(record, ["sector", "category"], product?.sector || vendor?.sector || vendor?.category || "");
  const suburb = firstValue(record, ["suburb"], product?.suburb || vendor?.suburb || "");
  const city = firstValue(record, ["city", "cityTown"], product?.cityTown || vendor?.cityTown || vendor?.city || "");
  const country = firstValue(record, ["country"], product?.country || vendor?.country || "");

  if (filters.vendorId && vendor?.id !== filters.vendorId && record?.vendorId !== filters.vendorId) return false;
  if (filters.productId && product?.id !== filters.productId && record?.productId !== filters.productId) return false;
  if (filters.sector && sector !== filters.sector) return false;
  if (filters.suburb && suburb !== filters.suburb) return false;
  if (filters.city && city !== filters.city) return false;
  if (filters.country && country !== filters.country) return false;
  return true;
};

const enrich = (record: any, vendors: any[], products: any[]) => {
  const product = findById(products, firstValue(record, ["productId", "offerId"], ""));
  const vendor = findById(
    vendors,
    firstValue(record, ["vendorId", "vendor_id"], "") || product?.vendorId,
  );
  return {
    vendorId: firstValue(record, ["vendorId", "vendor_id"], vendor?.id || product?.vendorId || ""),
    vendorName: firstValue(record, ["vendorName", "vendor"], vendor?.tradingName || vendor?.name || ""),
    productId: firstValue(record, ["productId", "offerId"], product?.id || ""),
    productName: firstValue(record, ["productName", "name"], product?.productName || product?.name || ""),
    sector: firstValue(record, ["sector", "category"], product?.sector || vendor?.sector || vendor?.category || ""),
    suburb: firstValue(record, ["suburb"], product?.suburb || vendor?.suburb || ""),
    city: firstValue(record, ["city", "cityTown"], product?.cityTown || vendor?.cityTown || vendor?.city || ""),
    country: firstValue(record, ["country"], product?.country || vendor?.country || ""),
  };
};

const addAllDimensions = (
  maps: {
    byVendor: Map<string, AnalyticsMetricRow>;
    byProduct: Map<string, AnalyticsMetricRow>;
    bySector: Map<string, AnalyticsMetricRow>;
    bySuburb: Map<string, AnalyticsMetricRow>;
    byCity: Map<string, AnalyticsMetricRow>;
    byCountry: Map<string, AnalyticsMetricRow>;
    byPeriod: Map<string, AnalyticsMetricRow>;
  },
  enriched: ReturnType<typeof enrich>,
  date: string,
  period: AnalyticsPeriod,
  metric: MetricName,
  amount = 1,
) => {
  addMetric(maps.byVendor, enriched.vendorId || enriched.vendorName, metric, amount, enriched.vendorName);
  addMetric(maps.byProduct, enriched.productId || enriched.productName, metric, amount, enriched.productName);
  addMetric(maps.bySector, enriched.sector, metric, amount);
  addMetric(maps.bySuburb, enriched.suburb, metric, amount);
  addMetric(maps.byCity, enriched.city, metric, amount);
  addMetric(maps.byCountry, enriched.country, metric, amount);
  addMetric(maps.byPeriod, periodKey(date, period), metric, amount);
};

export const analyticsService = {
  getEvents: async (): Promise<ActivityLog[]> => {
    const data = await getStorageAdapter().getItem<ActivityLog[]>(EVENTS_KEY);
    return asArray<ActivityLog>(data);
  },

  logEvent: async (
    event: Omit<ActivityLog, "id" | "timestamp">,
  ): Promise<void> => {
    void (async () => {
      try {
        if (firebaseHealthService.shouldSkipNonEssentialWrites()) return;
        const newEvent: ActivityLog = {
          ...event,
          id: generateActivityEventId(),
          timestamp: new Date().toISOString(),
        };
        const safeEvent = normalizeAnalyticsEvent(newEvent);
        const storage = getStorageAdapter();
        if (storage.batchSetItems) {
          await storage.batchSetItems(EVENTS_KEY, [safeEvent]);
          return;
        }
        const events = await analyticsService.getEvents();
        await storage.setItem(EVENTS_KEY, [safeEvent, ...events].slice(0, 5000));
      } catch (error) {
        firebaseHealthService.reportError(error, "analyticsService.logEvent");
        console.warn("Non-blocking analytics failed", error);
      }
    })();
  },

  clearEvents: async (): Promise<void> => {
    await getStorageAdapter().removeItem(EVENTS_KEY);
  },

  clearLogs: async (): Promise<void> => {
    await getStorageAdapter().removeItem(EVENTS_KEY);
  },

  getConsoleAnalytics: async (
    filters?: Partial<AnalyticsFilters> | null,
  ): Promise<ConsoleAnalyticsResult> => {
    const safeFilters = normalizeAnalyticsFilters(filters);

    const [
      vendors,
      products,
      catalogues,
      catalogueViews,
      productClicks,
      whatsappEnquiries,
      vendorOrders,
      subscriptions,
      rpnStaff,
      rpnAssignments,
      activityEvents,
    ] = await Promise.all([
      readCollection<any>(["vendors", "itred_vendors"]),
      readCollection<any>(["products", "itred_products", "itred_vendor_product_offers"]),
      readCollection<any>(["catalogues", "catalogueGenerations"]),
      readCollection<any>(["catalogueViews", "itred_catalogue_views"]),
      readCollection<any>(["productClicks", "itred_product_clicks"]),
      readCollection<any>(["whatsappEnquiries", "itred_whatsapp_activity_logs"]),
      readCollection<any>(["vendorOrders", "itred_vendor_orders"]),
      readCollection<any>(["vendorSubscriptions", "itred_subscriptions"]),
      readCollection<any>(["rpnStaff", "itred_rpns"]),
      readCollection<any>(["rpnVendorAssignments", "itred_rpn_vendor_assignments"]),
      readCollection<any>(["itred_activity_logs"]),
    ]);

    const maps = {
      byVendor: new Map<string, AnalyticsMetricRow>(),
      byProduct: new Map<string, AnalyticsMetricRow>(),
      bySector: new Map<string, AnalyticsMetricRow>(),
      bySuburb: new Map<string, AnalyticsMetricRow>(),
      byCity: new Map<string, AnalyticsMetricRow>(),
      byCountry: new Map<string, AnalyticsMetricRow>(),
      byPeriod: new Map<string, AnalyticsMetricRow>(),
    };

    const totals = {
      catalogueViews: 0,
      productClicks: 0,
      whatsappEnquiries: 0,
      vendorOrders: 0,
      subscriptions: 0,
      rpnAssignments: 0,
    };

    const consume = (rows: any[], metric: MetricName) => {
      rows.forEach((record) => {
        const date = recordDate(record);
        if (!dateInRange(date, safeFilters)) return;
        if (!passesDimensionFilters(record, safeFilters, vendors, products)) return;
        const amount = Math.max(1, safeNumber(record?.count || record?.quantity || record?.enquiryCount || 1));
        totals[metric] += amount;
        addAllDimensions(maps, enrich(record, vendors, products), date, safeFilters.period, metric, amount);
      });
    };

    const eventType = (record: any) =>
      safeString(record?.eventType || record?.type || record?.action, "").toUpperCase();
    const fallbackCatalogueViews = activityEvents.filter((record) =>
      eventType(record).includes("CATALOGUE") && eventType(record).includes("VIEW"),
    );
    const fallbackProductClicks = activityEvents.filter((record) =>
      (eventType(record).includes("PRODUCT") && eventType(record).includes("CLICK")) ||
      eventType(record).includes("PRODUCT_VIEW"),
    );
    const fallbackWhatsapp = activityEvents.filter((record) =>
      eventType(record).includes("WHATSAPP") &&
      (eventType(record).includes("CLICK") ||
        eventType(record).includes("ENQUIRY") ||
        eventType(record).includes("LEAD")),
    );
    const fallbackOrders = activityEvents.filter((record) =>
      eventType(record).includes("ORDER"),
    );
    const fallbackSubscriptions = activityEvents.filter((record) =>
      eventType(record).includes("SUBSCRIPTION"),
    );
    const fallbackAssignments = activityEvents.filter((record) =>
      eventType(record).includes("RPN") && eventType(record).includes("ASSIGN"),
    );

    consume(catalogueViews.length ? catalogueViews : fallbackCatalogueViews, "catalogueViews");
    consume(productClicks.length ? productClicks : fallbackProductClicks, "productClicks");
    consume(whatsappEnquiries.length ? whatsappEnquiries : fallbackWhatsapp, "whatsappEnquiries");
    consume(vendorOrders.length ? vendorOrders : fallbackOrders, "vendorOrders");
    consume(subscriptions.length ? subscriptions : fallbackSubscriptions, "subscriptions");
    consume(rpnAssignments.length ? rpnAssignments : fallbackAssignments, "rpnAssignments");

    return {
      filters: safeFilters,
      generatedAt: new Date().toISOString(),
      totals,
      byVendor: sortedRows(maps.byVendor),
      byProduct: sortedRows(maps.byProduct),
      bySector: sortedRows(maps.bySector),
      bySuburb: sortedRows(maps.bySuburb),
      byCity: sortedRows(maps.byCity),
      byCountry: sortedRows(maps.byCountry),
      byPeriod: sortedRows(maps.byPeriod, 120),
      sourceCounts: {
        vendors: vendors.length,
        products: products.length,
        catalogues: catalogues.length,
        catalogueViews: catalogueViews.length,
        productClicks: productClicks.length,
        whatsappEnquiries: whatsappEnquiries.length,
        vendorOrders: vendorOrders.length,
        subscriptions: subscriptions.length,
        rpnStaff: rpnStaff.length,
        rpnAssignments: rpnAssignments.length,
      },
      empty: Object.values(totals).every((value) => value === 0),
    };
  },
};
