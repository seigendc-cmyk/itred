/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WhatsAppActivityLog } from "../types.ts";
import { notificationService } from "./notificationService.ts";

const STORAGE_KEY = "itred_whatsapp_activity_logs";

export const whatsappActivityService = {
  getLogs(): WhatsAppActivityLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
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

  evaluateLogRules(log: WhatsAppActivityLog): void {
    if (log.priority === "HIGH" || log.priority === "CRITICAL") {
      notificationService.addNotification({
        type: "WHATSAPP",
        severity: "CRITICAL",
        title: `Priority Activity: ${log.priority}`,
        message: `Activity log ${log.id} requires immediate attention.`,
        relatedModule: "WhatsApp Activity",
        relatedRecordId: `priority-${log.id}`,
      });
    }

    if (log.followUpRequired && log.followUpDate) {
      const today = new Date().toISOString().split("T")[0];
      if (log.followUpDate <= today) {
        notificationService.addNotification({
          type: "WHATSAPP",
          severity: log.followUpDate < today ? "CRITICAL" : "WARNING",
          title:
            log.followUpDate < today
              ? "Overdue Follow-up"
              : "Follow-up Due Today",
          message: `Follow-up is required for task ${log.id}.`,
          relatedModule: "WhatsApp Activity",
          relatedRecordId: `followup-${log.id}`,
        });
      }
    }

    if (
      log.responseStatus === "MISSED" ||
      log.responseStatus === "ESCALATED" ||
      log.activityType === "VENDOR_DID_NOT_RESPOND"
    ) {
      notificationService.addNotification({
        type: "WHATSAPP",
        severity: "CRITICAL",
        title:
          log.activityType === "VENDOR_DID_NOT_RESPOND"
            ? "Vendor Did Not Respond"
            : `Vendor Response: ${log.responseStatus}`,
        message: `Vendor engagement failure requires escalation.`,
        relatedModule: "WhatsApp Activity",
        relatedRecordId: `response-${log.id}`,
      });
    }
  },
};
