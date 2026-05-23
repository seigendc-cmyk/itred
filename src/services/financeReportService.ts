/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ApprovalRequest,
  FinanceLedgerEntry,
  FinanceReportFilters,
  FinanceReportPrintLog,
  FinanceReportResult,
  FinanceReportType,
} from "../types.ts";
import { approvalService } from "./approvalService.ts";
import { financeLedgerService } from "./financeLedgerService.ts";
import { financeService } from "./financeService.ts";
import { notificationService } from "./notificationService.ts";
import { rpnPaymentService } from "./rpnPaymentService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { subscriptionService } from "./subscriptionService.ts";
import {
  generateApprovalId,
  generateReportPrintLogId,
} from "../utils/idGenerator.ts";
import {
  getSession,
  getSessionDesk,
  getSessionStaffId,
  getSessionStaffName,
} from "../utils/session.ts";

const PRINT_LOG_KEY = "itred_finance_report_print_logs";

const readPrintLogs = (): FinanceReportPrintLog[] => {
  try {
    const raw = localStorage.getItem(PRINT_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePrintLogs = (logs: FinanceReportPrintLog[]) => {
  localStorage.setItem(PRINT_LOG_KEY, JSON.stringify(logs));
};

const dateInRange = (
  value: string | undefined,
  filters?: Partial<FinanceReportFilters> | null,
) => {
  const safeFilters = filters ?? {};
  if (!value) return true;
  const date = value.slice(0, 10);
  return (
    (!safeFilters.dateFrom || date >= safeFilters.dateFrom) &&
    (!safeFilters.dateTo || date <= safeFilters.dateTo)
  );
};

const amountInRange = (
  value: number,
  filters?: Partial<FinanceReportFilters> | null,
) => {
  const safeFilters = filters ?? {};
  return (
    (safeFilters.amountMin === undefined || value >= safeFilters.amountMin) &&
    (safeFilters.amountMax === undefined || value <= safeFilters.amountMax)
  );
};

const normalize = (value: unknown) => String(value || "").toLowerCase();

const reportTitles: Record<FinanceReportType, string> = {
  "Cash / Bank Ledger Report": "Cash / Bank Ledger Report",
  "Transaction Listing Report": "Transaction Listing Report",
  "Chart of Accounts Report": "Chart of Accounts Report",
  "Cash / Bank Account Balances Report": "Cash / Bank Account Balances Report",
  "Receipts Report": "Receipts Report",
  "Payments Report": "Payments Report",
  "Journal Entries Report": "Journal Entries Report",
  "RPN Payments / Commissions Report": "RPN Payments / Commissions Report",
  "Asset Register Report": "Asset Register Report",
  "Asset Maintenance Report": "Asset Maintenance Report",
  "Finance Approval Report": "Finance Approval Report",
  "Print / Export Audit Report": "Print / Export Audit Report",
};

const unavailable = (filters: FinanceReportFilters): FinanceReportResult => ({
  reportRef: financeReportService.generateReportRef(filters.reportType),
  reportType: filters.reportType,
  title: reportTitles[filters.reportType],
  filters,
  rows: [],
  totals: {},
  generatedAt: new Date().toISOString(),
  unavailableMessage:
    "This report will activate when the related module is configured.",
});

const applyLedgerFilters = (
  entries: FinanceLedgerEntry[],
  filters: FinanceReportFilters,
) =>
  entries.filter((entry) => {
    const party = `${entry.payeeName || ""} ${entry.payerName || ""}`;
    return (
      dateInRange(entry.transactionDate, filters) &&
      (!filters.accountId || entry.accountId === filters.accountId) &&
      (!filters.cashBankAccountId ||
        entry.cashBankAccountId === filters.cashBankAccountId) &&
      (!filters.transactionType ||
        entry.transactionType === filters.transactionType) &&
      (!filters.status || entry.status === filters.status) &&
      (!filters.staff ||
        normalize(entry.createdByStaffName).includes(
          normalize(filters.staff),
        )) &&
      (!filters.payeePayer ||
        normalize(party).includes(normalize(filters.payeePayer))) &&
      amountInRange(
        entry.amount || Math.abs(entry.debit - entry.credit),
        filters,
      )
    );
  });

export const financeReportService = {
  generateReportRef: (reportType: FinanceReportType): string => {
    const prefix = reportType
      .replace(/[^A-Z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 18)
      .toUpperCase();
    return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now()
      .toString()
      .slice(-6)}`;
  },

  isSensitiveReport: (reportType: FinanceReportType): boolean => {
    return [
      "Cash / Bank Ledger Report",
      "Payments Report",
      "RPN Payments / Commissions Report",
      "Asset Register Report",
      "Print / Export Audit Report",
      "Finance Approval Report",
    ].includes(reportType);
  },

  canPrintReport: (
    reportType: FinanceReportType,
    userPermissions: {
      canPrint: boolean;
      canViewSensitive: boolean;
      hasApprovedRequest?: boolean;
    },
  ) => {
    if (!userPermissions.canPrint) return false;
    if (
      financeReportService.isSensitiveReport(reportType) &&
      !userPermissions.canViewSensitive &&
      !userPermissions.hasApprovedRequest
    ) {
      return false;
    }
    return true;
  },

  getReportData: async (
    reportType: FinanceReportType,
    filters: FinanceReportFilters,
  ): Promise<FinanceReportResult> => {
    const reportRef = financeReportService.generateReportRef(reportType);
    const scopedFilters = { ...filters, reportType };
    let rows: any[] = [];
    let unavailableMessage: string | undefined;

    if (reportType === "Cash / Bank Ledger Report") {
      const entries = filters.accountId
        ? financeLedgerService.calculateRunningBalance(filters.accountId)
        : financeLedgerService.getLedgerEntries();
      rows = applyLedgerFilters(entries, scopedFilters);
    } else if (reportType === "Transaction Listing Report") {
      rows = applyLedgerFilters(
        financeLedgerService.getLedgerEntries(),
        scopedFilters,
      );
    } else if (reportType === "Chart of Accounts Report") {
      rows = financeService.getChartOfAccounts().filter((account) => {
        return (
          (!filters.accountId || account.id === filters.accountId) &&
          (!filters.status || account.status === filters.status) &&
          (!filters.transactionType ||
            account.accountType === filters.transactionType)
        );
      });
    } else if (reportType === "Cash / Bank Account Balances Report") {
      rows = financeService.getCashBankAccounts().filter((account) => {
        return (
          (!filters.cashBankAccountId ||
            account.id === filters.cashBankAccountId) &&
          (!filters.status || account.status === filters.status) &&
          amountInRange(account.currentBalance, scopedFilters)
        );
      });
    } else if (reportType === "Receipts Report") {
      rows = subscriptionService.getAllPayments().filter((payment) => {
        return (
          dateInRange(
            payment.paymentDate || payment.createdAt,
            scopedFilters,
          ) &&
          (!filters.status || payment.paymentStatus === filters.status) &&
          (!filters.vendor ||
            normalize(payment.vendorName).includes(
              normalize(filters.vendor),
            )) &&
          (!filters.rpn ||
            normalize(payment.rpnName).includes(normalize(filters.rpn))) &&
          (!filters.payeePayer ||
            normalize(payment.vendorName).includes(
              normalize(filters.payeePayer),
            )) &&
          amountInRange(payment.amountPaid, scopedFilters)
        );
      });
    } else if (reportType === "Asset Register Report") {
      rows = financeService.getAssets().filter((asset) => {
        return (
          (!filters.assetCategory ||
            asset.category === filters.assetCategory) &&
          (!filters.assetStatus || asset.status === filters.assetStatus) &&
          amountInRange(asset.currentValue, scopedFilters)
        );
      });
    } else if (reportType === "Asset Maintenance Report") {
      const assets = financeService.getAssets();
      rows = financeService
        .getAssetMaintenanceRecords()
        .filter((record) => dateInRange(record.maintenanceDate, scopedFilters))
        .map((record) => ({
          ...record,
          assetName:
            assets.find((asset) => asset.id === record.assetId)?.assetName ||
            "Unknown asset",
          category:
            assets.find((asset) => asset.id === record.assetId)?.category ||
            "Unknown",
        }))
        .filter((record) => {
          return (
            (!filters.assetCategory ||
              record.category === filters.assetCategory) &&
            (!filters.status || record.status === filters.status) &&
            amountInRange(record.cost, scopedFilters)
          );
        });
    } else if (reportType === "Finance Approval Report") {
      rows = (await approvalService.getAll()).filter((request) => {
        return (
          dateInRange(request.submittedAt, scopedFilters) &&
          (!filters.approvalStatus ||
            request.status === filters.approvalStatus) &&
          (!filters.staff ||
            normalize(request.submittedByName).includes(
              normalize(filters.staff),
            ))
        );
      });
    } else if (reportType === "RPN Payments / Commissions Report") {
      rows = rpnPaymentService.getLedgerEntries().filter((entry) => {
        return (
          dateInRange(entry.dueDate, scopedFilters) &&
          (!filters.status || entry.status === filters.status) &&
          (!filters.vendor ||
            normalize(entry.vendorName).includes(normalize(filters.vendor))) &&
          (!filters.rpn ||
            normalize(entry.rpnName).includes(normalize(filters.rpn))) &&
          (!filters.transactionType ||
            entry.sourceType === filters.transactionType) &&
          amountInRange(entry.commissionAmountDue, scopedFilters)
        );
      });
    } else if (reportType === "Print / Export Audit Report") {
      rows = financeReportService.getPrintLogs(scopedFilters);
    } else {
      const result = unavailable(scopedFilters);
      unavailableMessage = result.unavailableMessage;
      rows = result.rows;
    }

    return {
      reportRef,
      reportType,
      title: reportTitles[reportType],
      filters: scopedFilters,
      rows,
      totals: financeReportService.calculateTotals(reportType, rows),
      generatedAt: new Date().toISOString(),
      unavailableMessage,
    };
  },

  calculateTotals: (
    reportType: FinanceReportType,
    rows: any[],
  ): Record<string, number | string> => {
    if (
      reportType === "Cash / Bank Ledger Report" ||
      reportType === "Transaction Listing Report"
    ) {
      return {
        rows: rows.length,
        debits: rows.reduce((sum, row) => sum + Number(row.debit || 0), 0),
        credits: rows.reduce((sum, row) => sum + Number(row.credit || 0), 0),
        netMovement: rows.reduce(
          (sum, row) => sum + Number(row.debit || 0) - Number(row.credit || 0),
          0,
        ),
      };
    }
    if (reportType === "Cash / Bank Account Balances Report") {
      return {
        rows: rows.length,
        openingBalance: rows.reduce(
          (sum, row) => sum + Number(row.openingBalance || 0),
          0,
        ),
        currentBalance: rows.reduce(
          (sum, row) => sum + Number(row.currentBalance || 0),
          0,
        ),
      };
    }
    if (reportType === "Receipts Report") {
      return {
        rows: rows.length,
        amountDue: rows.reduce(
          (sum, row) => sum + Number(row.amountDue || 0),
          0,
        ),
        amountPaid: rows.reduce(
          (sum, row) => sum + Number(row.amountPaid || 0),
          0,
        ),
        balanceDue: rows.reduce(
          (sum, row) => sum + Number(row.balanceDue || 0),
          0,
        ),
      };
    }
    if (reportType === "Asset Register Report") {
      return {
        rows: rows.length,
        purchaseValue: rows.reduce(
          (sum, row) => sum + Number(row.purchaseCost || 0),
          0,
        ),
        netBookValue: rows.reduce(
          (sum, row) => sum + Number(row.currentValue || 0),
          0,
        ),
      };
    }
    if (reportType === "Asset Maintenance Report") {
      return {
        rows: rows.length,
        maintenanceCost: rows.reduce(
          (sum, row) => sum + Number(row.cost || 0),
          0,
        ),
      };
    }
    if (reportType === "RPN Payments / Commissions Report") {
      return {
        rows: rows.length,
        commissionDue: rows.reduce(
          (sum, row) => sum + Number(row.commissionAmountDue || 0),
          0,
        ),
        commissionPaid: rows.reduce(
          (sum, row) => sum + Number(row.commissionAmountPaid || 0),
          0,
        ),
        balanceDue: rows.reduce(
          (sum, row) => sum + Number(row.balanceDue || 0),
          0,
        ),
      };
    }
    return { rows: rows.length };
  },

  createPrintLog: (
    payload: Omit<FinanceReportPrintLog, "id" | "createdAt">,
  ): FinanceReportPrintLog => {
    const session = getSession();
    const staffId = payload.staffId || getSessionStaffId(session);
    if (
      !payload.reportRef ||
      !payload.reportType ||
      !payload.action ||
      !staffId
    ) {
      throw new Error(
        "Finance print log is missing required operational fields.",
      );
    }
    const log: FinanceReportPrintLog = {
      ...payload,
      id: generateReportPrintLogId(),
      staffId,
      staffName:
        payload.staffName || getSessionStaffName(session, "Unknown staff"),
      staffDesk: payload.staffDesk || getSessionDesk(session),
      createdAt: new Date().toISOString(),
    };
    writePrintLogs([...readPrintLogs(), log]);
    return log;
  },

  getPrintLogs: (filters?: Partial<FinanceReportFilters> | null) => {
    const safeFilters = filters ?? {};
    return readPrintLogs()
      .filter((log) => {
        return (
          (!safeFilters.reportType ||
            log.reportType === safeFilters.reportType) &&
          dateInRange(log.createdAt, safeFilters) &&
          (!safeFilters.staff ||
            normalize(log.staffName).includes(normalize(safeFilters.staff)))
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  },

  requestReportApproval: async (payload: {
    reportType: FinanceReportType;
    reportRef: string;
    filters: FinanceReportFilters;
    reason: string;
  }): Promise<string> => {
    const session = getSession();
    const submittedByStaffId = getSessionStaffId(session);
    if (!submittedByStaffId) {
      throw new Error("Session expired. Please login again.");
    }
    const approvalId = generateApprovalId();
    const request: ApprovalRequest = {
      id: approvalId,
      requestType: "finance_report_print",
      recordType: "finance_report",
      recordId: payload.reportRef,
      recordName: payload.reportType,
      submittedByStaffId,
      submittedByName: getSessionStaffName(session, "Unknown staff"),
      assignedManagerName: "Finance Manager",
      status: "pending",
      riskLevel: "high",
      afterSnapshot: {
        reportType: payload.reportType,
        reportRef: payload.reportRef,
        filters: payload.filters,
        reason: payload.reason,
      },
      submittedAt: new Date().toISOString(),
    };
    await approvalService.create(request);
    financeReportService.createPrintLog({
      reportRef: payload.reportRef,
      reportType: payload.reportType,
      filters: payload.filters,
      action: "approval_requested",
      approvalId,
      status: "pending_approval",
    });
    await notificationService.createNotification({
      title: "Finance Report Print Approval Requested",
      message: `${request.submittedByName} requested print/PDF approval for ${payload.reportType}.`,
      type: "approval_request",
      priority: "high",
      recordType: "approval_request",
      recordId: approvalId,
      targetRole: "Admin",
      createdByStaffId: request.submittedByStaffId,
      createdByName: request.submittedByName,
      dedupeKey: `finance-report-approval:${payload.reportRef}`,
    });
    void staffAuditService.logAction({
      eventType: "APPROVAL_SUBMITTED",
      module: "finance_reports",
      severity: "high",
      action: `Requested print approval for finance report ${payload.reportType}`,
      recordType: "finance_report",
      recordId: payload.reportRef,
      recordName: payload.reportType,
      afterSnapshot: request,
    });
    return approvalId;
  },

  formatFiltersSummary: (filters: FinanceReportFilters): string => {
    return Object.entries(filters)
      .filter(
        ([, value]) => value !== undefined && value !== "" && value !== "all",
      )
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" | ");
  },
};
