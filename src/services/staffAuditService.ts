/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffAuditLog } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";

const STORAGE_KEY = "itred_staff_audit_logs";
const SESSION_KEY = "activeStaffSession";

const sanitizeSnapshot = (data: any): any => {
  if (!data) return data;
  try {
    // Deep copy and remove undefined by dropping them in serialization
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    return data;
  }
};

export const staffAuditService = {
  getLogs: async (): Promise<StaffAuditLog[]> => {
    const data =
      await getStorageAdapter().getItem<StaffAuditLog[]>(STORAGE_KEY);
    return Array.isArray(data)
      ? data.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
      : [];
  },

  getRecentLogs: async (limit: number = 50): Promise<StaffAuditLog[]> => {
    const logs = await staffAuditService.getLogs();
    return logs.slice(0, limit);
  },

  getLogsByStaff: async (staffId: string): Promise<StaffAuditLog[]> => {
    const logs = await staffAuditService.getLogs();
    return logs.filter((l) => l.staffId === staffId);
  },

  getLogsByModule: async (
    module: StaffAuditLog["module"],
  ): Promise<StaffAuditLog[]> => {
    const logs = await staffAuditService.getLogs();
    return logs.filter((l) => l.module === module);
  },

  logAction: async (
    input: Partial<StaffAuditLog> & {
      eventType: StaffAuditLog["eventType"];
      module: StaffAuditLog["module"];
      action: string;
      severity: StaffAuditLog["severity"];
    },
  ): Promise<void> => {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    let staffSession: any = {
      staffId: "unknown",
      staffName: "Unknown Staff",
      role: "Unknown",
    };
    if (sessionStr) {
      try {
        staffSession = JSON.parse(sessionStr);
      } catch (e) {}
    }

    const newLog: StaffAuditLog = {
      ...input,
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      staffId: input.staffId || staffSession.staffId || "unknown",
      staffName:
        input.staffName ||
        staffSession.staffName ||
        staffSession.displayName ||
        "Unknown Staff",
      staffRole: input.staffRole || staffSession.role || "Unknown",
      beforeSnapshot: sanitizeSnapshot(input.beforeSnapshot),
      afterSnapshot: sanitizeSnapshot(input.afterSnapshot),
      sessionId: staffSession.loginAt,
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
      createdAt: new Date().toISOString(),
    };

    // Execute save asynchronously without blocking the caller
    Promise.resolve().then(async () => {
      try {
        const logs =
          (await getStorageAdapter().getItem<StaffAuditLog[]>(STORAGE_KEY)) ||
          [];
        logs.push(newLog);
        await getStorageAdapter().setItem(STORAGE_KEY, logs);
      } catch (err) {
        console.error("Failed to persist staff audit log non-blockingly:", err);
      }
    });
  },

  logCreate: async (
    module: StaffAuditLog["module"],
    recordType: string,
    recordId: string,
    recordName: string,
    afterSnapshot?: any,
  ) => {
    return staffAuditService.logAction({
      eventType: "RECORD_CREATED",
      severity: "info",
      module,
      action: `Created new ${recordType}: ${recordName}`,
      recordType,
      recordId,
      recordName,
      afterSnapshot,
    });
  },

  logUpdate: async (
    module: StaffAuditLog["module"],
    recordType: string,
    recordId: string,
    recordName: string,
    beforeSnapshot: any,
    afterSnapshot: any,
  ) => {
    return staffAuditService.logAction({
      eventType: "RECORD_UPDATED",
      severity: "info",
      module,
      action: `Updated ${recordType}: ${recordName}`,
      recordType,
      recordId,
      recordName,
      beforeSnapshot,
      afterSnapshot,
    });
  },

  logDelete: async (
    module: StaffAuditLog["module"],
    recordType: string,
    recordId: string,
    recordName: string,
    beforeSnapshot?: any,
  ) => {
    return staffAuditService.logAction({
      eventType: "RECORD_DELETED",
      severity: "high",
      module,
      action: `Deleted ${recordType}: ${recordName}`,
      recordType,
      recordId,
      recordName,
      beforeSnapshot,
    });
  },

  logAccessDenied: async (
    module: StaffAuditLog["module"],
    action: string,
    reason?: string,
  ) => {
    return staffAuditService.logAction({
      eventType: "ACCESS_DENIED",
      severity: "warning",
      module,
      action,
      reason,
    });
  },

  logPageView: async (module: StaffAuditLog["module"], pageName: string) => {
    return staffAuditService.logAction({
      eventType: "PAGE_VIEWED",
      severity: "info",
      module,
      action: `Navigated to ${pageName}`,
    });
  },

  calculateStaffBehaviourSummary: async (staffId: string) => {
    const logs = await staffAuditService.getLogsByStaff(staffId);

    let score = 100;
    let createdRecords = 0;
    let updatedRecords = 0;
    let deletedRecords = 0;
    let approvalActions = 0;
    let accessDeniedCount = 0;
    let highRiskActions = 0;
    let lastActivityAt = logs.length > 0 ? logs[0].createdAt : undefined;

    logs.forEach((log) => {
      if (log.eventType === "RECORD_CREATED") createdRecords++;
      if (log.eventType === "RECORD_UPDATED") updatedRecords++;
      if (log.eventType === "RECORD_DELETED") {
        deletedRecords++;
        score -= 10;
      }
      if (log.eventType === "ACCESS_DENIED") {
        accessDeniedCount++;
        score -= 5;
      }
      if (log.eventType === "APPROVAL_REJECTED") {
        score -= 8;
      }
      if (log.eventType.startsWith("APPROVAL_")) approvalActions++;
      if (log.severity === "high" || log.severity === "critical")
        highRiskActions++;
      if (log.severity === "critical") score -= 15;
    });

    score = Math.max(0, score);

    let riskLevel: "low" | "medium" | "high" = "low";
    if (score < 50) riskLevel = "high";
    else if (score < 75) riskLevel = "medium";

    return {
      staffId,
      totalActions: logs.length,
      createdRecords,
      updatedRecords,
      deletedRecords,
      approvalActions,
      accessDeniedCount,
      highRiskActions,
      lastActivityAt,
      behaviourScore: score,
      riskLevel,
    };
  },
};
