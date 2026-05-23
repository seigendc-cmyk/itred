/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffAuditLog } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { readDiagnosticsService } from "./readDiagnosticsService.ts";
import { generateAuditLogId } from "../utils/idGenerator.ts";
import { firebaseHealthService } from "./firebaseHealthService.ts";
import {
  getSession,
  getSessionRole,
  getSessionStaffId,
  getSessionStaffName,
} from "../utils/session.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";

const STORAGE_KEY = "itred_staff_audit_logs";

const sanitizeSnapshot = (data: any): any => {
  if (!data) return null;
  try {
    const parsed = JSON.parse(JSON.stringify(data));
    return sanitizeForFirestore(parsed);
  } catch (e) {
    return null;
  }
};

export const staffAuditService = {
  getLogs: async (): Promise<StaffAuditLog[]> => {
    const data =
      await getStorageAdapter().getItem<StaffAuditLog[]>(STORAGE_KEY);
    const logs = Array.isArray(data)
      ? data.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
      : [];
    readDiagnosticsService.track(
      "staffAuditService",
      STORAGE_KEY,
      "getLogs",
      logs.length,
    );
    return logs;
  },

  getRecentLogs: async (limit: number = 50): Promise<StaffAuditLog[]> => {
    const logs = await staffAuditService.getLogs();
    return logs.slice(0, limit);
  },

  getPage: async (
    page = 0,
    pageSize = 100,
  ): Promise<{ items: StaffAuditLog[]; hasMore: boolean }> => {
    const logs = await staffAuditService.getLogs();
    const start = page * pageSize;
    return {
      items: logs.slice(start, start + pageSize),
      hasMore: logs.length > start + pageSize,
    };
  },

  getByDateRange: async (
    from: string,
    to: string,
    limit = 100,
  ): Promise<StaffAuditLog[]> => {
    const logs = await staffAuditService.getLogs();
    return logs
      .filter((log) => {
        const date = log.createdAt.slice(0, 10);
        return (!from || date >= from) && (!to || date <= to);
      })
      .slice(0, limit);
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
    const staffSession = getSession();

    const newLog: StaffAuditLog = sanitizeForFirestore({
      ...input,
      id: input.id || generateAuditLogId(),
      staffId: input.staffId || getSessionStaffId(staffSession) || "unknown",
      staffName:
        input.staffName || getSessionStaffName(staffSession, "Unknown staff"),
      staffRole: input.staffRole || getSessionRole(staffSession),
      beforeSnapshot: sanitizeSnapshot(input.beforeSnapshot),
      afterSnapshot: sanitizeSnapshot(input.afterSnapshot),
      sessionId: (staffSession as any)?.loginAt || null,
      deviceInfo: {
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
        platform: typeof navigator !== "undefined" ? navigator.platform : null,
        language: typeof navigator !== "undefined" ? navigator.language : null,
      },
      createdAt: new Date().toISOString(),
    }) as StaffAuditLog;

    // Execute save asynchronously without blocking the caller
    Promise.resolve().then(async () => {
      try {
        if (firebaseHealthService.shouldSkipNonEssentialWrites()) return;
        const storage = getStorageAdapter();
        if (storage.batchSetItems) {
          await storage.batchSetItems(STORAGE_KEY, [newLog]);
          return;
        }
        const logs =
          (await storage.getItem<StaffAuditLog[]>(STORAGE_KEY)) || [];
        await storage.setItem(STORAGE_KEY, [...logs, newLog]);
      } catch (err) {
        firebaseHealthService.reportError(err, "staffAuditService.logAction");
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
