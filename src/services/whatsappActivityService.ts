/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WhatsAppActivityLog } from "../types.ts";

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

    const today = new Date().toISOString().split("T")[0];

    safeLogs.forEach((log) => {
      totalEnquiries += Number(log.enquiryCount) || 0;
      if (log.leadStatus === "CONVERTED") convertedLeads++;
      if (log.followUpRequired && log.followUpDate && log.followUpDate <= today)
        followUpsDue++;
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
    };
  },
};
