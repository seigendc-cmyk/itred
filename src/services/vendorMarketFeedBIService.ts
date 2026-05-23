/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  VendorMarketFeedInsight,
  VendorMarketFeedRecommendation,
  VendorMarketFeedReport,
  VendorMarketFeedScore,
  WhatsAppActivityLog,
  WhatsAppIntelligenceLog,
} from "../types.ts";

export interface VendorMarketFeedReportFilters {
  vendorId?: string;
  vendorName?: string;
  dateFrom?: string;
  dateTo?: string;
  sector?: string;
  branch?: string;
}

type FeedLog = {
  id: string;
  date: string;
  vendorId: string;
  vendorName: string;
  sector?: string;
  branch?: string;
  customerKey?: string;
  productName?: string;
  category?: string;
  location?: string;
  type: string;
  leadStatus?: string;
  resolutionStatus?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  responseTimeMinutes?: number;
  urgency?: string;
};

const normalize = (value?: string) => (value || "").trim();
const label = (value?: string, fallback = "Unspecified") =>
  normalize(value) || fallback;
const dateKey = (value?: string) => String(value || "").slice(0, 10);
const today = () => new Date().toISOString().split("T")[0];

const increment = (record: Record<string, number>, key?: string) => {
  const nextKey = label(key);
  record[nextKey] = (record[nextKey] || 0) + 1;
};

const topEntries = (record: Record<string, number>, limit = 8) =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));

const isProductEnquiry = (type: string) =>
  ["Enquiry", "Product Search", "PRODUCT_ENQUIRY", "CUSTOMER_REQUEST", "DEMAND_SIGNAL"].includes(type);
const isPriceEnquiry = (type: string) => type === "Price Request";
const isStockEnquiry = (type: string) => type === "Stock Request";
const isConfirmedOrder = (type: string, leadStatus?: string) =>
  leadStatus === "CONVERTED" || type === "VENDOR_RESPONDED";
const isLostLead = (type: string, leadStatus?: string, responseStatus?: string) =>
  leadStatus === "LOST" ||
  type === "VENDOR_DID_NOT_RESPOND" ||
  responseStatus === "MISSED";
const isComplaint = (type: string) =>
  ["Complaint", "Delivery Complaint", "Warranty Issue", "Fraud Alert", "COMPLAINT_RECEIVED", "SPAM_OR_FALSE_LISTING"].includes(type);

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const buildScore = (metrics: {
  totalInteractions: number;
  productEnquiries: number;
  priceEnquiries: number;
  stockAvailabilityEnquiries: number;
  convertedLeads: number;
  lostLeads: number;
  pendingFollowUps: number;
  complaints: number;
  fraudAlerts: number;
  unresolvedIssues: number;
  averageResponseTimeMinutes: number;
}): VendorMarketFeedScore => {
  const demandTotal =
    metrics.productEnquiries +
    metrics.priceEnquiries +
    metrics.stockAvailabilityEnquiries;
  const conversionRate =
    demandTotal > 0 ? metrics.convertedLeads / Math.max(demandTotal, 1) : 0;
  const lossRate =
    metrics.totalInteractions > 0
      ? metrics.lostLeads / metrics.totalInteractions
      : 0;
  const complaintRate =
    metrics.totalInteractions > 0
      ? metrics.complaints / metrics.totalInteractions
      : 0;

  const demandScore = clamp(45 + demandTotal * 4);
  const conversionScore = clamp(35 + conversionRate * 65 - lossRate * 25);
  const handlingScore = clamp(
    100 -
      Math.max(0, metrics.averageResponseTimeMinutes - 20) * 0.8 -
      metrics.pendingFollowUps * 5 -
      metrics.unresolvedIssues * 7,
  );
  const riskScore = clamp(
    100 - complaintRate * 80 - metrics.fraudAlerts * 18 - metrics.lostLeads * 4,
  );
  const value = Math.round(
    demandScore * 0.25 +
      conversionScore * 0.3 +
      handlingScore * 0.25 +
      riskScore * 0.2,
  );
  const grade =
    value >= 85 ? "A" : value >= 70 ? "B" : value >= 55 ? "C" : value >= 40 ? "D" : "E";

  return {
    value,
    grade,
    demandScore: Math.round(demandScore),
    conversionScore: Math.round(conversionScore),
    handlingScore: Math.round(handlingScore),
    riskScore: Math.round(riskScore),
    summary:
      value >= 70
        ? "Healthy market feed performance with manageable operational pressure."
        : value >= 55
          ? "Moderate performance with conversion, follow-up or service gaps to address."
          : "At-risk market feed performance requiring urgent remedial action.",
  };
};

const toFeedLogs = (
  activityLogs: WhatsAppActivityLog[],
  intelligenceLogs: WhatsAppIntelligenceLog[],
): FeedLog[] => [
  ...intelligenceLogs.map((log) => ({
    id: log.id,
    date: dateKey(log.createdAt),
    vendorId: normalize(log.vendorId),
    vendorName: label(log.vendorName, "Unknown Vendor"),
    sector: log.sector,
    branch: (log as any).branchName || (log as any).branchId,
    customerKey: log.customerPhone || log.customerName,
    productName: log.productName,
    category: log.category,
    location: log.city || log.region || log.province,
    type: log.interactionType,
    resolutionStatus: log.resolutionStatus,
    followUpRequired: !!log.followUpRequired,
    followUpDate: log.followUpDate,
    urgency: log.urgencyLevel,
  })),
  ...activityLogs.map((log) => ({
    id: log.id,
    date: dateKey(log.activityDate || log.createdAt),
    vendorId: normalize(log.vendorId),
    vendorName: label(log.vendorName, "Unknown Vendor"),
    sector: log.sector,
    branch: (log as any).branchName || (log as any).branchId,
    customerKey: (log as any).customerPhone || (log as any).customerName,
    productName: log.productName,
    category: log.category,
    location: log.cityTown || log.district || log.province,
    type: log.activityType,
    leadStatus: log.leadStatus,
    resolutionStatus: log.responseStatus,
    followUpRequired: !!log.followUpRequired,
    followUpDate: log.followUpDate,
    responseTimeMinutes: log.responseTimeMinutes,
    urgency: log.priority,
  })),
];

export const vendorMarketFeedBIService = {
  generateReport(
    activityLogs: WhatsAppActivityLog[],
    intelligenceLogs: WhatsAppIntelligenceLog[],
    filters: VendorMarketFeedReportFilters,
  ): VendorMarketFeedReport {
    const logs = toFeedLogs(activityLogs || [], intelligenceLogs || []).filter(
      (log) => {
        if (filters.vendorId && log.vendorId !== filters.vendorId) return false;
        if (
          !filters.vendorId &&
          filters.vendorName &&
          log.vendorName.toLowerCase() !== filters.vendorName.toLowerCase()
        ) {
          return false;
        }
        if (filters.dateFrom && log.date < filters.dateFrom) return false;
        if (filters.dateTo && log.date > filters.dateTo) return false;
        if (filters.sector && log.sector !== filters.sector) return false;
        if (filters.branch && log.branch !== filters.branch) return false;
        return !!log.vendorId || !!filters.vendorName;
      },
    );

    const customerCounts: Record<string, number> = {};
    const productCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};
    const responseTimes: number[] = [];

    let productEnquiries = 0;
    let priceEnquiries = 0;
    let stockAvailabilityEnquiries = 0;
    let confirmedOrders = 0;
    let convertedLeads = 0;
    let lostLeads = 0;
    let pendingFollowUps = 0;
    let complaints = 0;
    let deliveryComplaints = 0;
    let warrantyIssues = 0;
    let fraudAlerts = 0;
    let unresolvedIssues = 0;

    logs.forEach((log) => {
      if (log.customerKey) increment(customerCounts, log.customerKey);
      if (log.productName && (isProductEnquiry(log.type) || isStockEnquiry(log.type))) {
        increment(productCounts, log.productName);
      }
      if (log.category) increment(categoryCounts, log.category);
      if (log.location) increment(locationCounts, log.location);
      if (typeof log.responseTimeMinutes === "number") {
        responseTimes.push(log.responseTimeMinutes);
      }

      if (isProductEnquiry(log.type)) productEnquiries++;
      if (isPriceEnquiry(log.type)) priceEnquiries++;
      if (isStockEnquiry(log.type)) stockAvailabilityEnquiries++;
      if (isConfirmedOrder(log.type, log.leadStatus)) confirmedOrders++;
      if (log.leadStatus === "CONVERTED") convertedLeads++;
      if (isLostLead(log.type, log.leadStatus, log.resolutionStatus)) lostLeads++;
      if (
        log.followUpRequired &&
        (!log.followUpDate || log.followUpDate <= today()) &&
        log.resolutionStatus !== "Resolved" &&
        log.resolutionStatus !== "RESPONDED"
      ) {
        pendingFollowUps++;
      }
      if (isComplaint(log.type)) complaints++;
      if (log.type === "Delivery Complaint") deliveryComplaints++;
      if (log.type === "Warranty Issue") warrantyIssues++;
      if (log.type === "Fraud Alert" || log.type === "SPAM_OR_FALSE_LISTING") {
        fraudAlerts++;
      }
      if (
        (isComplaint(log.type) || log.followUpRequired) &&
        log.resolutionStatus !== "Resolved" &&
        log.resolutionStatus !== "RESPONDED"
      ) {
        unresolvedIssues++;
      }
    });

    const uniqueCustomers = Object.keys(customerCounts).length;
    const repeatCustomerCount = Object.values(customerCounts).filter(
      (count) => count > 1,
    ).length;
    const averageResponseTimeMinutes =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((sum, value) => sum + value, 0) /
              responseTimes.length,
          )
        : 0;

    const score = buildScore({
      totalInteractions: logs.length,
      productEnquiries,
      priceEnquiries,
      stockAvailabilityEnquiries,
      convertedLeads,
      lostLeads,
      pendingFollowUps,
      complaints,
      fraudAlerts,
      unresolvedIssues,
      averageResponseTimeMinutes,
    });

    const insights: VendorMarketFeedInsight[] = [];
    const recommendations: VendorMarketFeedRecommendation[] = [];
    const topProducts = topEntries(productCounts);
    const topCategories = topEntries(categoryCounts);
    const topLocations = topEntries(locationCounts);
    const demandTotal = productEnquiries + priceEnquiries + stockAvailabilityEnquiries;

    if (demandTotal >= 5 && convertedLeads <= Math.max(1, Math.floor(demandTotal * 0.2))) {
      insights.push({
        id: "weak-conversion",
        category: "opportunity",
        severity: "high",
        title: "High demand but weak conversion",
        message: `${demandTotal} demand signals produced only ${convertedLeads} converted leads.`,
        metric: "conversion",
      });
      recommendations.push({
        id: "tighten-conversion",
        priority: "high",
        action: "Call serious buyers and confirm price, stock and delivery today.",
        reason: "Demand is visible but the vendor is not converting enough leads.",
        owner: "Sales / Vendor Support",
      });
    }

    if (averageResponseTimeMinutes > 60) {
      insights.push({
        id: "slow-response",
        category: "handling",
        severity: "high",
        title: "Slow response may be costing sales",
        message: `Average response time is ${averageResponseTimeMinutes} minutes.`,
        metric: "response_time",
      });
      recommendations.push({
        id: "response-sla",
        priority: "high",
        action: "Set a same-day WhatsApp response SLA and assign unanswered leads.",
        reason: "Delayed responses reduce buyer trust and conversion.",
        owner: "Vendor / SCI Office",
      });
    }

    if (complaints >= 3) {
      insights.push({
        id: "service-risk",
        category: "risk",
        severity: complaints >= 6 ? "critical" : "high",
        title: "Customer service risk",
        message: `${complaints} complaints were recorded in the selected period.`,
        metric: "complaints",
      });
      recommendations.push({
        id: "resolve-complaints",
        priority: complaints >= 6 ? "critical" : "high",
        action: "Review complaint records and close unresolved customer issues within 24 hours.",
        reason: "Complaint volume can damage vendor reputation and repeat buying.",
        owner: "Vendor Owner",
      });
    }

    if (topProducts[0]?.count >= 3) {
      insights.push({
        id: "top-product-demand",
        category: "demand",
        severity: "warning",
        title: "Restock or promote this product",
        message: `${topProducts[0].name} received ${topProducts[0].count} customer demand signals.`,
        metric: "top_product",
      });
      recommendations.push({
        id: "restock-promote",
        priority: "medium",
        action: `Confirm stock and promote ${topProducts[0].name}.`,
        reason: "Repeated customer requests show active market demand.",
        owner: "Vendor",
      });
    }

    if (pendingFollowUps >= 3) {
      insights.push({
        id: "pending-followups",
        category: "handling",
        severity: pendingFollowUps >= 8 ? "critical" : "high",
        title: "Pending follow-ups are building up",
        message: `${pendingFollowUps} follow-ups need attention.`,
        metric: "follow_ups",
      });
      recommendations.push({
        id: "assign-followups",
        priority: "high",
        action: "Assign staff to follow up serious buyers and unresolved issues.",
        reason: "Follow-up backlog creates avoidable lost sales.",
        owner: "SCI Office",
      });
    }

    if (lostLeads > 0) {
      insights.push({
        id: "lost-opportunities",
        category: "opportunity",
        severity: lostLeads >= 5 ? "high" : "warning",
        title: "Lost opportunities detected",
        message: `${lostLeads} leads were lost or missed.`,
        metric: "lost_leads",
      });
    }

    if (fraudAlerts > 0) {
      insights.push({
        id: "fraud-alerts",
        category: "risk",
        severity: "critical",
        title: "Fraud alerts require review",
        message: `${fraudAlerts} fraud or false-listing alerts were recorded.`,
        metric: "fraud",
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: "stable-feed",
        category: "observation",
        severity: "info",
        title: "Stable market feed",
        message: "No major demand, conversion or service risk thresholds were crossed.",
      });
      recommendations.push({
        id: "keep-monitoring",
        priority: "low",
        action: "Keep capturing WhatsApp interactions consistently.",
        reason: "More structured records improve trend detection.",
        owner: "SCI Office",
      });
    }

    const vendorName =
      label(filters.vendorName) ||
      label(logs[0]?.vendorName, "Selected Vendor");
    const topProductText =
      topProducts
        .slice(0, 3)
        .map((item) => item.name)
        .join(", ") || "no clear product yet";
    const primaryAction =
      recommendations[0]?.action ||
      "keep monitoring demand and respond quickly to customer enquiries.";

    return {
      vendorId: filters.vendorId || logs[0]?.vendorId || "",
      vendorName,
      sector: filters.sector || logs[0]?.sector,
      branch: filters.branch,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      totalInteractions: logs.length,
      uniqueCustomers,
      productEnquiries,
      priceEnquiries,
      stockAvailabilityEnquiries,
      confirmedOrders,
      convertedLeads,
      lostLeads,
      pendingFollowUps,
      complaints,
      deliveryComplaints,
      warrantyIssues,
      fraudAlerts,
      averageResponseTimeMinutes,
      topRequestedProducts: topProducts,
      topRequestedCategories: topCategories,
      topCustomerLocations: topLocations,
      repeatCustomerCount,
      unresolvedIssues,
      score,
      executiveSummary: `${vendorName} recorded ${logs.length} WhatsApp market-feed interactions from ${uniqueCustomers} unique customers. Top demand: ${topProductText}. The BI score is ${score.value}/100 (${score.grade}), with ${pendingFollowUps} pending follow-ups and ${lostLeads} lost leads.`,
      keyObservations: insights.filter((item) => item.category === "observation" || item.category === "opportunity"),
      riskWarnings: insights.filter((item) => item.category === "risk"),
      demandSignals: insights.filter((item) => item.category === "demand"),
      customerHandlingWeaknesses: insights.filter((item) => item.category === "handling"),
      remedialRecommendations: recommendations,
      whatsappSummary: `Hi ${vendorName}, your SCI Market Feed Report shows ${logs.length} customer interactions this period. Top demand: ${topProductText}. You have ${pendingFollowUps} pending follow-ups and ${lostLeads} lost leads. Recommended action: ${primaryAction}`,
    };
  },
};
