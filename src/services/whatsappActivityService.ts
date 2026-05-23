/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  WhatsAppActivityLog,
  WhatsAppIntelligenceLog,
  InteractionType,
} from "../types.ts";
import { notificationService } from "./notificationService.ts";
import { readDiagnosticsService } from "./readDiagnosticsService.ts";

const STORAGE_KEY = "itred_whatsapp_activity_logs";
const INTEL_STORAGE_KEY = "itred_whatsapp_intelligence_logs";

const todayKey = () => new Date().toISOString().split("T")[0];
const normalizeKey = (value?: string) => (value || "Unspecified").trim();
const isComplaintType = (type?: InteractionType) =>
  type === "Complaint" ||
  type === "Delivery Complaint" ||
  type === "Warranty Issue" ||
  type === "Fraud Alert";
const isDemandType = (type?: InteractionType) =>
  type === "Enquiry" ||
  type === "Price Request" ||
  type === "Stock Request" ||
  type === "Product Search";
const topEntries = (record: Record<string, number>, limit = 10) =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));

const daysBetween = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diff / 86400000));
};

export const whatsappActivityService = {
  getLogs(): WhatsAppActivityLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const logs = Array.isArray(parsed) ? parsed : [];
      readDiagnosticsService.track("whatsappActivityService", STORAGE_KEY, "getLogs", logs.length);
      return logs;
    } catch (e) {
      console.error("Failed to parse whatsapp activity logs", e);
      return [];
    }
  },

  saveLog(log: WhatsAppActivityLog): void {
    const logs = this.getLogs();
    const existingIndex = logs.findIndex((l) => l.id === log.id);
    if (existingIndex >= 0) {
      logs[existingIndex] = { ...log, updatedAt: new Date().toISOString() };
    } else {
      logs.push(log);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    this.evaluateLogRules(log);
  },

  deleteLog(id: string): void {
    const logs = this.getLogs();
    const filtered = logs.filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  updateLog(id: string, patch: Partial<WhatsAppActivityLog>): void {
    const logs = this.getLogs();
    const existingIndex = logs.findIndex((l) => l.id === id);
    if (existingIndex >= 0) {
      logs[existingIndex] = {
        ...logs[existingIndex],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
      this.evaluateLogRules(logs[existingIndex]);
    }
  },

  getIntelligenceLogs(): WhatsAppIntelligenceLog[] {
    try {
      const raw = localStorage.getItem(INTEL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  saveIntelligenceLog(log: WhatsAppIntelligenceLog): void {
    const logs = this.getIntelligenceLogs();
    const existingIndex = logs.findIndex((l) => l.id === log.id);
    const scoredLog = this.scoreIntelligenceLog(log, logs);
    if (existingIndex >= 0) {
      logs[existingIndex] = {
        ...scoredLog,
        updatedAt: new Date().toISOString(),
      };
    } else {
      logs.push(scoredLog);
    }
    localStorage.setItem(INTEL_STORAGE_KEY, JSON.stringify(logs));
    this.detectMarketSignals(scoredLog, logs);
  },

  getRecent(limit = 100): WhatsAppActivityLog[] {
    return whatsappActivityService
      .getLogs()
      .sort(
        (a, b) =>
          new Date((b as any).createdAt || (b as any).date || 0).getTime() -
          new Date((a as any).createdAt || (a as any).date || 0).getTime(),
      )
      .slice(0, limit);
  },

  getByVendorId(vendorId: string): WhatsAppActivityLog[] {
    return whatsappActivityService
      .getLogs()
      .filter((log) => (log as any).vendorId === vendorId);
  },

  getByRpnId(rpnId: string): WhatsAppActivityLog[] {
    return whatsappActivityService
      .getLogs()
      .filter((log) => (log as any).rpnId === rpnId || (log as any).assignedRpnId === rpnId);
  },

  getByDateRange(from: string, to: string): WhatsAppActivityLog[] {
    return whatsappActivityService.getLogs().filter((log) => {
      const date = String((log as any).createdAt || (log as any).date || "").slice(0, 10);
      return (!from || date >= from) && (!to || date <= to);
    });
  },

  deleteIntelligenceLog(id: string): void {
    const logs = this.getIntelligenceLogs().filter((l) => l.id !== id);
    localStorage.setItem(INTEL_STORAGE_KEY, JSON.stringify(logs));
  },

  getBI(logs: WhatsAppActivityLog[]) {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const totalLogs = safeLogs.length;
    let totalEnquiries = 0;
    let convertedLeads = 0;
    let followUpsDue = 0;
    let highPriorityCount = 0;
    let memberGrowthTotal = 0;
    let activeSectorsSet = new Set<string>();
    let activeSourcesSet = new Set<string>();
    let overdueFollowUps = 0;
    let followUpsDueToday = 0;
    let completedFollowUps = 0;
    let vendorNonResponseCount = 0;
    let conversionsAfterFollowUp = 0;

    const today = new Date().toISOString().split("T")[0];

    safeLogs.forEach((log) => {
      totalEnquiries += Number(log.enquiryCount) || 0;
      if (log.leadStatus === "CONVERTED") convertedLeads++;
      if (log.followUpRequired && log.followUpDate && log.followUpDate <= today)
        followUpsDue++;

      if (log.followUpRequired && log.followUpDate && log.followUpDate < today)
        overdueFollowUps++;
      if (log.followUpRequired && log.followUpDate === today)
        followUpsDueToday++;
      if (log.activityType === "FOLLOW_UP_DONE") completedFollowUps++;
      if (log.activityType === "VENDOR_DID_NOT_RESPOND")
        vendorNonResponseCount++;
      if (log.leadStatus === "CONVERTED" && log.followUpDate)
        conversionsAfterFollowUp++;

      if (log.priority === "HIGH" || log.priority === "CRITICAL")
        highPriorityCount++;
      if (
        log.memberCount !== undefined &&
        log.previousMemberCount !== undefined
      ) {
        memberGrowthTotal +=
          Number(log.memberCount) - Number(log.previousMemberCount);
      }
      if (log.sector) activeSectorsSet.add(log.sector);
      if (log.sourceName) activeSourcesSet.add(log.sourceName);
    });

    const conversionRate =
      totalLogs > 0 ? ((convertedLeads / totalLogs) * 100).toFixed(1) : "0.0";

    return {
      totalLogs,
      totalEnquiries,
      convertedLeads,
      conversionRate,
      followUpsDue,
      highPriorityCount,
      activeSectorsCount: activeSectorsSet.size,
      activeSourcesCount: activeSourcesSet.size,
      memberGrowthTotal,
      overdueFollowUps,
      followUpsDueToday,
      completedFollowUps,
      vendorNonResponseCount,
      conversionsAfterFollowUp,
    };
  },

  scoreIntelligenceLog(
    log: WhatsAppIntelligenceLog,
    allLogs: WhatsAppIntelligenceLog[],
  ): WhatsAppIntelligenceLog {
    const similar = allLogs.filter((l) => {
      if (l.id === log.id) return false;
      const sameCustomer = l.customerPhone && l.customerPhone === log.customerPhone;
      const sameVendor =
        normalizeKey(l.vendorName).toLowerCase() ===
        normalizeKey(log.vendorName).toLowerCase();
      const sameProduct =
        normalizeKey(l.productName).toLowerCase() ===
        normalizeKey(log.productName).toLowerCase();
      const sameRegion =
        normalizeKey(l.region || l.city || l.province).toLowerCase() ===
        normalizeKey(log.region || log.city || log.province).toLowerCase();
      const sameType = l.interactionType === log.interactionType;
      return sameType && (sameCustomer || (sameVendor && sameProduct) || (sameProduct && sameRegion));
    });

    let biScore = 50;
    if (isDemandType(log.interactionType)) biScore += 10;
    if (log.interactionType === "Stock Request") biScore += 10;
    if (isComplaintType(log.interactionType)) biScore += 20;
    if (log.urgencyLevel === "High") biScore += 15;
    if (log.urgencyLevel === "Critical") biScore += 30;
    if (log.sentiment === "Negative") biScore += 15;
    if (similar.length > 0) biScore += Math.min(20, similar.length * 4);

    const flaggedRisk =
      log.urgencyLevel === "Critical" ||
      log.interactionType === "Fraud Alert" ||
      (isComplaintType(log.interactionType) &&
        log.resolutionStatus !== "Resolved") ||
      log.sentiment === "Negative";

    return {
      ...log,
      biScore: Math.max(0, Math.min(100, biScore)),
      flaggedRisk,
      duplicatePatternDetected: similar.length > 0,
    };
  },

  calculateCommerceBI(intelLogs: WhatsAppIntelligenceLog[]) {
    const safeLogs = Array.isArray(intelLogs) ? intelLogs : [];
    const today = todayKey();
    const stats = {
      totalInteractions: safeLogs.length,
      complaintsToday: 0,
      complimentsToday: 0,
      unresolvedComplaints: 0,
      followUpsOverdue: 0,
      fraudAlerts: 0,
      averageResolutionDays: 0,
      returnInteractionRate: 0,
      productDemand: {} as Record<string, number>,
      productComplaints: {} as Record<string, number>,
      unavailableProducts: {} as Record<string, number>,
      vendorComplaints: {} as Record<string, number>,
      sectorActivity: {} as Record<string, number>,
      categoryActivity: {} as Record<string, number>,
      provinceDemand: {} as Record<string, number>,
      regionDemand: {} as Record<string, number>,
      complaintKeywords: {} as Record<string, number>,
      vendorReputation: {} as Record<
        string,
        {
          score: number;
          trend: "Improving" | "Stable" | "Declining";
          riskLevel: "Low" | "Medium" | "High" | "Critical";
          complaints: number;
          compliments: number;
          deliveryIssues: number;
          unresolved: number;
          negativeSentiment: number;
          total: number;
          returns: number;
          responseQuality: number;
        }
      >,
      regionalEnquiryRank: {} as Record<string, number>,
      sentimentAnalysis: { Positive: 0, Neutral: 0, Negative: 0 },
      staffActivity: {} as Record<string, number>,
      alerts: [] as Array<{
        id: string;
        title: string;
        message: string;
        severity: "info" | "warning" | "high" | "critical";
        category: string;
      }>,
      productDemandHeatmap: {} as Record<string, Record<string, number>>,
    };

    const customerCounts: Record<string, number> = {};
    let resolvedDays = 0;
    let resolvedCount = 0;

    safeLogs.forEach((log) => {
      const isToday = log.createdAt.startsWith(today);
      const region = normalizeKey(log.region || log.city || log.province);
      const product = normalizeKey(log.productName);
      const vendor = normalizeKey(log.vendorName);

      if (isToday && isComplaintType(log.interactionType)) stats.complaintsToday++;
      if (isToday && log.interactionType === "Compliment")
        stats.complimentsToday++;

      if (
        isComplaintType(log.interactionType) &&
        log.resolutionStatus !== "Resolved"
      ) {
        stats.unresolvedComplaints++;
      }
      if (log.interactionType === "Fraud Alert") stats.fraudAlerts++;

      if (
        log.followUpRequired &&
        log.followUpDate &&
        log.followUpDate < today &&
        log.resolutionStatus !== "Resolved"
      ) {
        stats.followUpsOverdue++;
      }

      if (log.resolutionStatus === "Resolved") {
        resolvedDays += daysBetween(log.createdAt, log.updatedAt);
        resolvedCount++;
      }

      if (log.customerPhone) {
        customerCounts[log.customerPhone] = (customerCounts[log.customerPhone] || 0) + 1;
      }

      if (isDemandType(log.interactionType)) {
        stats.productDemand[product] = (stats.productDemand[product] || 0) + 1;
        stats.provinceDemand[normalizeKey(log.province)] =
          (stats.provinceDemand[normalizeKey(log.province)] || 0) + 1;
        stats.regionDemand[region] = (stats.regionDemand[region] || 0) + 1;
        stats.productDemandHeatmap[region] = stats.productDemandHeatmap[region] || {};
        stats.productDemandHeatmap[region][product] =
          (stats.productDemandHeatmap[region][product] || 0) + 1;
      }

      if (isComplaintType(log.interactionType)) {
        stats.vendorComplaints[vendor] = (stats.vendorComplaints[vendor] || 0) + 1;
        stats.productComplaints[product] = (stats.productComplaints[product] || 0) + 1;
        (log.tags || []).forEach((tag) => {
          const key = normalizeKey(tag);
          stats.complaintKeywords[key] = (stats.complaintKeywords[key] || 0) + 1;
        });
      }
      if (log.interactionType === "Stock Request") {
        stats.unavailableProducts[product] =
          (stats.unavailableProducts[product] || 0) + 1;
      }

      stats.sentimentAnalysis[log.sentiment || "Neutral"]++;
      stats.sectorActivity[normalizeKey(log.sector)] =
        (stats.sectorActivity[normalizeKey(log.sector)] || 0) + 1;
      stats.categoryActivity[normalizeKey(log.category)] =
        (stats.categoryActivity[normalizeKey(log.category)] || 0) + 1;

      if (log.vendorName) {
        const v = stats.vendorReputation[log.vendorName] || {
          score: 100,
          trend: "Stable" as const,
          riskLevel: "Low" as const,
          complaints: 0,
          compliments: 0,
          deliveryIssues: 0,
          unresolved: 0,
          negativeSentiment: 0,
          total: 0,
          returns: 0,
          responseQuality: 100,
        };
        v.total++;
        if (isComplaintType(log.interactionType)) v.complaints++;
        if (log.interactionType === "Compliment") v.compliments++;
        if (log.interactionType === "Delivery Complaint") v.deliveryIssues++;
        if (log.resolutionStatus !== "Resolved" && isComplaintType(log.interactionType))
          v.unresolved++;
        if (log.sentiment === "Negative") v.negativeSentiment++;
        if (log.customerPhone && customerCounts[log.customerPhone] > 1) v.returns++;
        stats.vendorReputation[log.vendorName] = v;
      }

      stats.regionalEnquiryRank[region] =
        (stats.regionalEnquiryRank[region] || 0) + 1;

      stats.staffActivity[log.loggedByStaffName] =
        (stats.staffActivity[log.loggedByStaffName] || 0) + 1;
    });

    Object.keys(stats.vendorReputation).forEach((key) => {
      const v = stats.vendorReputation[key];
      let score = 80;
      score -= v.complaints * 12;
      score -= v.deliveryIssues * 8;
      score -= v.unresolved * 10;
      score -= v.negativeSentiment * 6;
      score += v.compliments * 10;
      score += Math.min(10, v.returns * 2);
      v.score = Math.max(0, Math.min(100, score));
      v.responseQuality = Math.max(0, Math.min(100, 100 - v.unresolved * 15));
      v.trend =
        v.compliments > v.complaints ? "Improving" : v.complaints > v.compliments ? "Declining" : "Stable";
      v.riskLevel =
        v.score < 35 ? "Critical" : v.score < 55 ? "High" : v.score < 75 ? "Medium" : "Low";
    });

    stats.averageResolutionDays =
      resolvedCount > 0 ? Math.round((resolvedDays / resolvedCount) * 10) / 10 : 0;
    const returningCustomers = Object.values(customerCounts).filter((count) => count > 1).length;
    stats.returnInteractionRate =
      Object.keys(customerCounts).length > 0
        ? Math.round((returningCustomers / Object.keys(customerCounts).length) * 100)
        : 0;

    const alertCandidates = [
      ...topEntries(stats.vendorComplaints, 5)
        .filter((x) => x.count >= 3)
        .map((x) => ({
          id: `vendor-complaints-${x.name}`,
          title: "High complaint volume",
          message: `High complaint volume detected for ${x.name}.`,
          severity: "critical" as const,
          category: "Vendor Reputation",
        })),
      ...topEntries(stats.productDemand, 5)
        .filter((x) => x.count >= 5)
        .map((x) => ({
          id: `product-demand-${x.name}`,
          title: "Product demand spike",
          message: `Repeated stock requests or searches detected for ${x.name}.`,
          severity: "high" as const,
          category: "Product Intelligence",
        })),
      ...topEntries(stats.regionDemand, 5)
        .filter((x) => x.count >= 5)
        .map((x) => ({
          id: `regional-demand-${x.name}`,
          title: "Regional demand rising",
          message: `Customer demand is increasing in ${x.name}.`,
          severity: "warning" as const,
          category: "Regional BI",
        })),
    ];
    stats.alerts = alertCandidates;

    return stats;
  },

  detectMarketSignals(
    newLog: WhatsAppIntelligenceLog,
    allLogs: WhatsAppIntelligenceLog[],
  ) {
    const today = todayKey();
    const sameRecent = (predicate: (log: WhatsAppIntelligenceLog) => boolean) =>
      allLogs.filter(predicate).length;

    if (newLog.productName) {
      const recentProductRequests = sameRecent(
        (l) =>
          l.productName === newLog.productName &&
          (l.interactionType === "Stock Request" ||
            l.interactionType === "Product Search" ||
            l.interactionType === "Price Request"),
      );

      if (recentProductRequests >= 5) {
        void notificationService.createNotification({
          type: "system_alert",
          priority: "high",
          title: "High Demand Signal",
          message: `Repeated stock requests detected for "${newLog.productName}". Consider verifying vendor supply.`,
          recordType: "intelligence",
          recordId: newLog.id,
          dedupeKey: `demand:${newLog.productName}:${today}`,
        });
      }
    }

    if (newLog.vendorName && isComplaintType(newLog.interactionType)) {
      const vendorComplaints = sameRecent(
        (l) =>
          l.vendorName === newLog.vendorName &&
          isComplaintType(l.interactionType) &&
          l.resolutionStatus !== "Resolved",
      );

      if (vendorComplaints >= 3) {
        void notificationService.createNotification({
          type: "system_alert",
          priority: "critical",
          title: "Vendor Reputation Risk",
          message: `High complaint volume detected for "${newLog.vendorName}". ${vendorComplaints} unresolved issues.`,
          recordType: "intelligence",
          recordId: newLog.id,
          dedupeKey: `reputation:${newLog.vendorName}:${today}`,
        });
      }
    }

    if (newLog.region || newLog.city || newLog.province) {
      const region = normalizeKey(newLog.region || newLog.city || newLog.province);
      const regionalDemand = sameRecent(
        (l) =>
          normalizeKey(l.region || l.city || l.province) === region &&
          isDemandType(l.interactionType),
      );
      if (regionalDemand >= 5) {
        void notificationService.createNotification({
          type: "system_alert",
          priority: "medium",
          title: "Regional Demand Signal",
          message: `Demand signals are increasing in ${region}.`,
          recordType: "intelligence",
          recordId: newLog.id,
          dedupeKey: `regional-demand:${region}:${today}`,
        });
      }
    }

    const similar = allLogs.filter(
      (l) =>
        l.id !== newLog.id &&
        l.interactionType === newLog.interactionType &&
        l.resolutionStatus !== "Resolved" &&
        ((l.customerPhone === newLog.customerPhone && !!newLog.customerPhone) ||
          (normalizeKey(l.vendorName) === normalizeKey(newLog.vendorName) &&
            normalizeKey(l.productName) === normalizeKey(newLog.productName)) ||
          (normalizeKey(l.productName) === normalizeKey(newLog.productName) &&
            normalizeKey(l.region || l.city || l.province) ===
              normalizeKey(newLog.region || newLog.city || newLog.province))),
    );

    if (similar.length >= 3) {
      void notificationService.createNotification({
        type: "system_alert",
        priority: "high",
        title: "Repeated Issue Pattern",
        message: `Similar issue already reported ${similar.length} times.`,
        recordType: "intelligence",
        recordId: newLog.id,
        dedupeKey: `duplicate-pattern:${newLog.interactionType}:${normalizeKey(newLog.vendorName)}:${normalizeKey(newLog.productName)}:${today}`,
      });
    }

    if (newLog.interactionType === "Fraud Alert") {
      void notificationService.createNotification({
        type: "system_alert",
        priority: "critical",
        title: "FRAUD ALERT",
        message: `Fraud warning reported regarding ${newLog.vendorName || "unknown"}. Investigating required.`,
        recordType: "intelligence",
        recordId: newLog.id,
        dedupeKey: `fraud-alert:${normalizeKey(newLog.vendorName)}:${newLog.id}`,
      });
    }

    if (
      newLog.followUpRequired &&
      newLog.followUpDate &&
      newLog.followUpDate < today &&
      newLog.resolutionStatus !== "Resolved"
    ) {
      void notificationService.createNotification({
        type: "task_due",
        priority: "critical",
        title: "Overdue Intelligence Follow-up",
        message: `${newLog.assignedToStaffName || "Assigned staff"} has an overdue follow-up for ${newLog.customerPhone}.`,
        recordType: "intelligence",
        recordId: newLog.id,
        assignedToStaffId: newLog.assignedToStaffId,
        assignedToName: newLog.assignedToStaffName,
        dedupeKey: `intel-followup:${newLog.id}:${today}`,
      });
    }
  },

  evaluateLogRules(log: WhatsAppActivityLog): void {
    try {
      const today = new Date().toISOString().split("T")[0];

      if (log.priority === "HIGH" || log.priority === "CRITICAL") {
        void notificationService.createNotification({
          type: "lead_followup",
          priority: log.priority === "CRITICAL" ? "critical" : "high",
          title: `Priority Activity: ${log.priority}`,
          message: `Activity log ${log.id} requires immediate attention.`,
          recordType: "whatsapp_activity",
          recordId: log.id,
          dedupeKey: `lead_followup:whatsapp_activity:${log.id}:${today}`,
        });
      }

      if (log.followUpRequired && log.followUpDate) {
        if (log.followUpDate <= today) {
          void notificationService.createNotification({
            type: "task_due",
            priority: log.followUpDate < today ? "critical" : "high",
            title:
              log.followUpDate < today
                ? "Overdue Follow-up"
                : "Follow-up Due Today",
            message: `Follow-up is required for task ${log.id}.`,
            recordType: "whatsapp_activity",
            recordId: log.id,
            dedupeKey: `task_due:whatsapp_activity:${log.id}:${today}`,
          });
        }
      }

      if (
        log.responseStatus === "MISSED" ||
        log.responseStatus === "ESCALATED" ||
        log.activityType === "VENDOR_DID_NOT_RESPOND"
      ) {
        void notificationService.createNotification({
          type: "system_alert",
          priority: "critical",
          title:
            log.activityType === "VENDOR_DID_NOT_RESPOND"
              ? "Vendor Did Not Respond"
              : `Vendor Response: ${log.responseStatus}`,
          message: `Vendor engagement failure requires escalation.`,
          recordType: "whatsapp_activity",
          recordId: log.id,
          dedupeKey: `system_alert:whatsapp_activity:${log.id}:${today}`,
        });
      }
    } catch (error) {
      console.error("Failed to evaluate log rules", error);
    }
  },
};
