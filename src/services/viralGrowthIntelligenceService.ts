/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityLog, WhatsAppActivityLog, WhatsAppIntelligenceLog } from "../types.ts";
import { asArray } from "../utils/safeData.ts";
import { analyticsService } from "./analyticsService.ts";
import { contactHubService } from "./contactHubService.ts";
import { getStorageAdapter } from "./storageService.ts";
import { whatsappActivityService } from "./whatsappActivityService.ts";

const OUTPUTS_KEY = "viral_growth_outputs";

export interface ViralGrowthFilters {
  dateFrom?: string;
  dateTo?: string;
  sector?: string;
  category?: string;
  city?: string;
  vendorId?: string;
  rpnId?: string;
}

export interface NormalizedViralGrowthFilters {
  dateFrom: string;
  dateTo: string;
  sector?: string;
  category?: string;
  city?: string;
  vendorId?: string;
  rpnId?: string;
}

export interface ViralGrowthTotals {
  referrals: number;
  catalogueShares: number;
  missingProductDemand: number;
  vendorProofSignals: number;
  whatsappGroupGrowth: number;
  postPerformance: number;
  customerShares: number;
  rpnViralImpact: number;
  vendorResponseQuality: number;
  sectorMomentum: number;
}

export interface ViralGrowthRankRow {
  key: string;
  label: string;
  sector?: string;
  category?: string;
  city?: string;
  referrals: number;
  catalogueShares: number;
  demandSignals: number;
  proofSignals: number;
  groupGrowth: number;
  postPerformance: number;
  customerShares: number;
  rpnImpact: number;
  responseQuality: number;
  momentumScore: number;
}

export interface ViralGrowthNarrativeOutput {
  id: string;
  generatedAt: string;
  period: string;
  weeklyProofPosts: string[];
  vendorAdvisoryReports: ViralGrowthRankRow[];
  rpnPerformanceReports: ViralGrowthRankRow[];
  customerTrendingUpdates: string[];
}

export interface ViralGrowthIntelligenceReport {
  filters: NormalizedViralGrowthFilters;
  generatedAt: string;
  totals: ViralGrowthTotals;
  bySector: ViralGrowthRankRow[];
  byVendor: ViralGrowthRankRow[];
  byRpn: ViralGrowthRankRow[];
  byCity: ViralGrowthRankRow[];
  byCustomerBehaviour: ViralGrowthRankRow[];
  byWhatsAppGroup: ViralGrowthRankRow[];
  missingDemand: ViralGrowthRankRow[];
  proofPosts: string[];
  vendorAdvisoryReports: ViralGrowthRankRow[];
  rpnPerformanceReports: ViralGrowthRankRow[];
  customerTrendingUpdates: string[];
  sourceCounts: {
    activityEvents: number;
    whatsappLogs: number;
    intelligenceLogs: number;
    whatsappGroups: number;
  };
  empty: boolean;
}

const dayMs = 24 * 60 * 60 * 1000;

const todayKey = () => new Date().toISOString().slice(0, 10);

const daysAgo = (days: number) =>
  new Date(Date.now() - days * dayMs).toISOString().slice(0, 10);

const safeString = (value: unknown, fallback = "Unspecified") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const safeNumber = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const dateKey = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "object" && typeof (value as any).toDate === "function") {
    const parsed = (value as any).toDate();
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }
  const parsed =
    typeof value === "object" && "seconds" in (value as any)
      ? new Date(safeNumber((value as any).seconds) * 1000)
      : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
};

const normaliseFilters = (
  filters?: ViralGrowthFilters | null,
): NormalizedViralGrowthFilters => {
  const input = filters ?? {};
  const rawTo = dateKey(input.dateTo) || todayKey();
  const rawFrom = dateKey(input.dateFrom) || daysAgo(7);
  const dateFrom = rawFrom > rawTo ? rawTo : rawFrom;
  const dateTo = rawFrom > rawTo ? rawFrom : rawTo;

  return {
    dateFrom,
    dateTo,
    sector: input.sector || undefined,
    category: input.category || undefined,
    city: input.city || undefined,
    vendorId: input.vendorId || undefined,
    rpnId: input.rpnId || undefined,
  };
};

const inRange = (date: string, filters: NormalizedViralGrowthFilters) =>
  !date || (date >= filters.dateFrom && date <= filters.dateTo);

const matchesFilters = (record: any, filters: NormalizedViralGrowthFilters) => {
  const city = safeString(record?.city || record?.cityTown || record?.region || "", "");
  if (filters.sector && safeString(record?.sector, "") !== filters.sector) return false;
  if (filters.category && safeString(record?.category, "") !== filters.category) return false;
  if (filters.city && city !== filters.city) return false;
  if (filters.vendorId && safeString(record?.vendorId, "") !== filters.vendorId) return false;
  if (
    filters.rpnId &&
    safeString(record?.rpnId || record?.assignedRpnId || record?.assignedToStaffId, "") !== filters.rpnId
  ) {
    return false;
  }
  return true;
};

const emptyRow = (key: string, label = key): ViralGrowthRankRow => ({
  key,
  label,
  referrals: 0,
  catalogueShares: 0,
  demandSignals: 0,
  proofSignals: 0,
  groupGrowth: 0,
  postPerformance: 0,
  customerShares: 0,
  rpnImpact: 0,
  responseQuality: 0,
  momentumScore: 0,
});

const addRowMetric = (
  map: Map<string, ViralGrowthRankRow>,
  key: string,
  label: string,
  metric: keyof Omit<ViralGrowthRankRow, "key" | "label" | "sector" | "category" | "city">,
  amount: number,
  meta?: Pick<ViralGrowthRankRow, "sector" | "category" | "city">,
) => {
  const resolvedKey = safeString(key);
  const row = map.get(resolvedKey) || emptyRow(resolvedKey, safeString(label, resolvedKey));
  (row[metric] as number) += amount;
  row.sector = row.sector || meta?.sector;
  row.category = row.category || meta?.category;
  row.city = row.city || meta?.city;
  row.momentumScore =
    row.referrals * 3 +
    row.catalogueShares * 4 +
    row.customerShares * 3 +
    row.demandSignals * 2 +
    row.proofSignals * 2 +
    row.groupGrowth +
    row.postPerformance +
    row.rpnImpact * 2 +
    Math.round(row.responseQuality / 10);
  map.set(resolvedKey, row);
};

const sortRows = (map: Map<string, ViralGrowthRankRow>, limit = 20) =>
  Array.from(map.values())
    .sort((a, b) => b.momentumScore - a.momentumScore || a.label.localeCompare(b.label))
    .slice(0, limit);

const readCollection = async <T>(key: string): Promise<T[]> => {
  try {
    return asArray<T>(await Promise.resolve(getStorageAdapter().getItem<T[]>(key)));
  } catch (error) {
    console.warn(`Viral growth collection read failed for ${key}`, error);
    return [];
  }
};

const eventText = (event: ActivityLog) =>
  `${event.eventType || ""} ${JSON.stringify(event.details || {})}`.toUpperCase();

const hasAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

const proofLine = (row: ViralGrowthRankRow) =>
  `${row.label}: ${row.catalogueShares} catalogue shares, ${row.demandSignals} demand signals, ${row.customerShares} customer shares, ${row.momentumScore} momentum score.`;

const buildCustomerTrend = (row: ViralGrowthRankRow) =>
  `${row.label} is trending with ${row.demandSignals} demand signals and ${row.catalogueShares + row.customerShares} sharing actions this week.`;

const toOutput = (
  report: ViralGrowthIntelligenceReport,
): ViralGrowthNarrativeOutput => ({
  id: `viral-growth-${Date.now()}`,
  generatedAt: report.generatedAt,
  period: `${report.filters.dateFrom} to ${report.filters.dateTo}`,
  weeklyProofPosts: report.proofPosts,
  vendorAdvisoryReports: report.vendorAdvisoryReports,
  rpnPerformanceReports: report.rpnPerformanceReports,
  customerTrendingUpdates: report.customerTrendingUpdates,
});

export const viralGrowthIntelligenceService = {
  normalizeFilters: normaliseFilters,

  getReport: async (
    filters?: ViralGrowthFilters | null,
  ): Promise<ViralGrowthIntelligenceReport> => {
    const safeFilters = normaliseFilters(filters);
    const [activityEvents, whatsappLogs, intelligenceLogs, storedShares, storedReferrals] =
      await Promise.all([
        analyticsService.getEvents(),
        Promise.resolve(whatsappActivityService.getLogs()),
        Promise.resolve(whatsappActivityService.getIntelligenceLogs()),
        readCollection<any>("catalogueShares"),
        readCollection<any>("referrals"),
      ]);

    const whatsappGroups = contactHubService
      .getCatalogueContactHub()
      .whatsappCommunityGroups.filter((group) => group.status === "active");

    const bySector = new Map<string, ViralGrowthRankRow>();
    const byVendor = new Map<string, ViralGrowthRankRow>();
    const byRpn = new Map<string, ViralGrowthRankRow>();
    const byCity = new Map<string, ViralGrowthRankRow>();
    const byCustomer = new Map<string, ViralGrowthRankRow>();
    const byGroup = new Map<string, ViralGrowthRankRow>();
    const missingDemand = new Map<string, ViralGrowthRankRow>();

    const totals: ViralGrowthTotals = {
      referrals: 0,
      catalogueShares: 0,
      missingProductDemand: 0,
      vendorProofSignals: 0,
      whatsappGroupGrowth: 0,
      postPerformance: 0,
      customerShares: 0,
      rpnViralImpact: 0,
      vendorResponseQuality: 0,
      sectorMomentum: 0,
    };

    const addEverywhere = (
      record: any,
      metric: keyof Omit<ViralGrowthRankRow, "key" | "label" | "sector" | "category" | "city">,
      amount = 1,
    ) => {
      const sector = safeString(record?.sector || record?.category, "Unspecified");
      const category = safeString(record?.category, "");
      const city = safeString(record?.city || record?.cityTown || record?.region, "Unspecified");
      const meta = { sector, category, city };
      addRowMetric(bySector, sector, sector, metric, amount, meta);
      addRowMetric(byCity, city, city, metric, amount, meta);
      if (record?.vendorId || record?.vendorName) {
        addRowMetric(
          byVendor,
          safeString(record.vendorId || record.vendorName),
          safeString(record.vendorName || record.vendorId),
          metric,
          amount,
          meta,
        );
      }
      if (record?.rpnId || record?.assignedRpnId || record?.assignedRpnName || record?.loggedByStaffName) {
        addRowMetric(
          byRpn,
          safeString(record.rpnId || record.assignedRpnId || record.loggedByStaffName),
          safeString(record.assignedRpnName || record.loggedByStaffName || record.rpnId || record.assignedRpnId),
          metric,
          amount,
          meta,
        );
      }
      if (record?.customerPhone || record?.customerName || record?.actorId || record?.actorName) {
        addRowMetric(
          byCustomer,
          safeString(record.customerPhone || record.customerName || record.actorId || record.actorName),
          safeString(record.customerName || record.actorName || record.customerPhone || record.actorId),
          metric,
          amount,
          meta,
        );
      }
      if (record?.communityId || record?.communityName || record?.sourceName) {
        addRowMetric(
          byGroup,
          safeString(record.communityId || record.communityName || record.sourceName),
          safeString(record.communityName || record.sourceName || record.communityId),
          metric,
          amount,
          meta,
        );
      }
    };

    activityEvents
      .filter((event) => inRange(dateKey(event.timestamp), safeFilters))
      .filter((event) => matchesFilters({ ...event, ...(event.details || {}) }, safeFilters))
      .forEach((event) => {
        const text = eventText(event);
        const record = { ...event, ...(event.details || {}) };
        if (hasAny(text, ["REFERRAL", "REFERRED"])) {
          totals.referrals++;
          addEverywhere(record, "referrals");
        }
        if (hasAny(text, ["CATALOGUE_SHARE", "CATALOGUE SHARED", "SHARE_CATALOGUE", "HTML_COPIED"])) {
          totals.catalogueShares++;
          addEverywhere(record, "catalogueShares");
        }
        if (hasAny(text, ["CUSTOMER_SHARE", "CUSTOMER SHARED", "SHARED_BY_CUSTOMER"])) {
          totals.customerShares++;
          addEverywhere(record, "customerShares");
        }
        if (hasAny(text, ["POST_VIEW", "POST_CLICK", "POST_SHARE", "POST PERFORMANCE"])) {
          totals.postPerformance++;
          addEverywhere(record, "postPerformance");
        }
        if (hasAny(text, ["PROOF", "COMPLIMENT", "CONVERTED", "ORDER"])) {
          totals.vendorProofSignals++;
          addEverywhere(record, "proofSignals");
        }
      });

    [...storedShares, ...storedReferrals]
      .filter((record) => inRange(dateKey(record.createdAt || record.timestamp || record.date), safeFilters))
      .filter((record) => matchesFilters(record, safeFilters))
      .forEach((record) => {
        const count = Math.max(1, safeNumber(record.count || record.shareCount || 1));
        if (record.referralCode || record.referrerId || record.type === "referral") {
          totals.referrals += count;
          addEverywhere(record, "referrals", count);
        } else {
          totals.catalogueShares += count;
          addEverywhere(record, "catalogueShares", count);
        }
      });

    whatsappLogs
      .filter((log: WhatsAppActivityLog) => inRange(dateKey(log.activityDate || log.createdAt), safeFilters))
      .filter((log: WhatsAppActivityLog) => matchesFilters(log, safeFilters))
      .forEach((log: WhatsAppActivityLog) => {
        const growth = Math.max(0, safeNumber(log.memberCount) - safeNumber(log.previousMemberCount));
        totals.whatsappGroupGrowth += growth;
        totals.rpnViralImpact += log.assignedRpnId ? 1 : 0;
        totals.vendorResponseQuality += log.responseStatus === "RESPONDED" ? 1 : log.responseStatus === "MISSED" ? -1 : 0;
        if (growth > 0) addEverywhere(log, "groupGrowth", growth);
        if (log.assignedRpnId) addEverywhere(log, "rpnImpact");
        if (log.responseStatus === "RESPONDED") addEverywhere(log, "responseQuality", 10);
        if (log.leadStatus === "CONVERTED") {
          totals.vendorProofSignals++;
          addEverywhere(log, "proofSignals");
        }
      });

    intelligenceLogs
      .filter((log: WhatsAppIntelligenceLog) => inRange(dateKey(log.createdAt), safeFilters))
      .filter((log: WhatsAppIntelligenceLog) => matchesFilters(log, safeFilters))
      .forEach((log: WhatsAppIntelligenceLog) => {
        const isMissingDemand =
          log.interactionType === "Stock Request" ||
          log.interactionType === "Product Search" ||
          (log.tags || []).some((tag) => /missing|unavailable|not found|out of stock/i.test(tag));
        if (isMissingDemand) {
          totals.missingProductDemand++;
          addEverywhere(log, "demandSignals");
          addRowMetric(
            missingDemand,
            safeString(log.productId || log.productName),
            safeString(log.productName || log.productId),
            "demandSignals",
            1,
            { sector: log.sector, category: log.category, city: log.city || log.region },
          );
        }
        if (log.sentiment === "Positive" || log.interactionType === "Compliment") {
          totals.vendorProofSignals++;
          addEverywhere(log, "proofSignals");
        }
      });

    whatsappGroups
      .filter((group) => matchesFilters(group, safeFilters))
      .forEach((group) => {
        addRowMetric(byGroup, group.id, group.displayName, "groupGrowth", 0, {
          sector: group.sector,
          category: group.category,
        });
      });

    const sectorRows = sortRows(bySector);
    const vendorRows = sortRows(byVendor);
    const rpnRows = sortRows(byRpn);
    const cityRows = sortRows(byCity);
    const customerRows = sortRows(byCustomer);
    const groupRows = sortRows(byGroup);
    const demandRows = sortRows(missingDemand);
    const responseRows = vendorRows.filter((row) => row.responseQuality > 0);
    totals.vendorResponseQuality =
      responseRows.length > 0
        ? Math.round(responseRows.reduce((sum, row) => sum + row.responseQuality, 0) / responseRows.length)
        : 0;
    totals.sectorMomentum = sectorRows.reduce((sum, row) => sum + row.momentumScore, 0);

    const proofPosts =
      sectorRows.length > 0
        ? sectorRows.slice(0, 4).map(proofLine)
        : ["Not enough data to publish a weekly proof post."];
    const customerTrendingUpdates =
      demandRows.length > 0
        ? demandRows.slice(0, 5).map(buildCustomerTrend)
        : ["Not enough data to publish customer-facing trending updates."];

    return {
      filters: safeFilters,
      generatedAt: new Date().toISOString(),
      totals,
      bySector: sectorRows,
      byVendor: vendorRows,
      byRpn: rpnRows,
      byCity: cityRows,
      byCustomerBehaviour: customerRows,
      byWhatsAppGroup: groupRows,
      missingDemand: demandRows,
      proofPosts,
      vendorAdvisoryReports: vendorRows.slice(0, 10),
      rpnPerformanceReports: rpnRows.slice(0, 10),
      customerTrendingUpdates,
      sourceCounts: {
        activityEvents: activityEvents.length,
        whatsappLogs: whatsappLogs.length,
        intelligenceLogs: intelligenceLogs.length,
        whatsappGroups: whatsappGroups.length,
      },
      empty:
        totals.referrals +
          totals.catalogueShares +
          totals.missingProductDemand +
          totals.vendorProofSignals +
          totals.whatsappGroupGrowth +
          totals.postPerformance +
          totals.customerShares +
          totals.rpnViralImpact ===
        0,
    };
  },

  storeOutput: async (
    report: ViralGrowthIntelligenceReport,
  ): Promise<ViralGrowthNarrativeOutput> => {
    const output = toOutput(report);
    const storage = getStorageAdapter();
    if (storage.batchSetItems) {
      await storage.batchSetItems(OUTPUTS_KEY, [output]);
      return output;
    }
    const existing = asArray<ViralGrowthNarrativeOutput>(
      await Promise.resolve(storage.getItem<ViralGrowthNarrativeOutput[]>(OUTPUTS_KEY)),
    );
    await storage.setItem(OUTPUTS_KEY, [output, ...existing].slice(0, 100));
    return output;
  },
};
