/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CollectionRecord,
  RPNPaymentLedgerEntry,
  RPNPaymentSummary,
  RPNPerformanceSettings,
  Vendor,
  VendorSubscriptionPayment,
} from "../types.ts";
import { approvalService } from "./approvalService.ts";
import { financeLedgerService } from "./financeLedgerService.ts";
import { financeService } from "./financeService.ts";
import { notificationService } from "./notificationService.ts";
import { pricingPlanService } from "./pricingPlanService.ts";
import { rpnService } from "./rpnService.ts";
import { settingsService } from "./settingsService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { subscriptionService } from "./subscriptionService.ts";
import { vendorService } from "./vendorService.ts";
import { generateApprovalId, generateRpnPaymentId } from "../utils/idGenerator.ts";
import { getSession as getActiveSession, getSessionStaffName } from "../utils/session.ts";

const STORAGE_KEY = "itred_rpn_payment_ledger";

const readLedger = (): RPNPaymentLedgerEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLedger = (entries: RPNPaymentLedgerEntry[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

const makeId = () => generateRpnPaymentId();

const normalizeMoney = (value: unknown, fieldName: string): number => {
  const numberValue =
    typeof value === "number" ? value : Number(String(value || "0"));
  if (!Number.isFinite(numberValue) || Number.isNaN(numberValue)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return numberValue;
};

const getSession = () => {
  return getActiveSession() || {};
};

const assignedRpnId = (vendor: Vendor) =>
  vendor.rpnId ||
  vendor.assignedRPNId ||
  vendor.assignedStaffId ||
  vendor.onboardedByStaffId ||
  "";

const monthsBetween = (from?: string, to = new Date()) => {
  if (!from) return 0;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return (
    (to.getFullYear() - start.getFullYear()) * 12 +
    (to.getMonth() - start.getMonth())
  );
};

const commissionSettings = (
  settings?: RPNPerformanceSettings,
): Required<
  Pick<
    RPNPerformanceSettings,
    | "rpnOnboardingCommissionAmount"
    | "rpnRecurringCommissionPercent"
    | "rpnRecurringCommissionAfterMonths"
    | "rpnSalaryDropAfterMonths"
    | "rpnPostSalaryRecurringCommissionPercent"
    | "rpnCommissionCurrency"
  >
> => ({
  rpnOnboardingCommissionAmount:
    settings?.rpnOnboardingCommissionAmount ?? 4.5,
  rpnRecurringCommissionPercent:
    settings?.rpnRecurringCommissionPercent ?? 5,
  rpnRecurringCommissionAfterMonths:
    settings?.rpnRecurringCommissionAfterMonths ?? 0,
  rpnSalaryDropAfterMonths: settings?.rpnSalaryDropAfterMonths ?? 5,
  rpnPostSalaryRecurringCommissionPercent:
    settings?.rpnPostSalaryRecurringCommissionPercent ?? 15,
  rpnCommissionCurrency: settings?.rpnCommissionCurrency ?? "USD",
});

const dedupeKey = (entry: RPNPaymentLedgerEntry) =>
  [
    entry.sourceType,
    entry.rpnId,
    entry.vendorId,
    entry.sourcePaymentId || entry.sourceSubscriptionId || entry.sourceTransactionId,
    entry.periodStart || "",
    entry.periodEnd || "",
  ].join("|");

const audit = (
  action: string,
  beforeSnapshot?: unknown,
  afterSnapshot?: unknown,
  severity: "info" | "warning" | "high" = "info",
) => {
  try {
    void staffAuditService.logAction({
      eventType: beforeSnapshot ? "RECORD_UPDATED" : "RECORD_CREATED",
      module: "finance",
      severity,
      action,
      recordType: "RPNPaymentLedgerEntry",
      recordId: (afterSnapshot as any)?.id,
      recordName: (afterSnapshot as any)?.rpnName,
      beforeSnapshot,
      afterSnapshot,
    });
  } catch (error) {
    console.warn("RPN payment audit failed", error);
  }
};

const notify = async (
  title: string,
  message: string,
  recordId: string,
  dedupe?: string,
) => {
  try {
    await notificationService.createNotification({
      title,
      message,
      type: "finance_report",
      priority: "medium",
      targetRole: "Admin",
      recordType: "rpn_payment_ledger",
      recordId,
      dedupeKey: dedupe || `${recordId}:${Date.now()}`,
    });
  } catch (error) {
    console.warn("RPN payment notification failed", error);
  }
};

export const rpnPaymentService = {
  getLedgerEntries: (): RPNPaymentLedgerEntry[] => {
    return readLedger().sort(
      (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    );
  },

  saveLedgerEntry: (
    entry: RPNPaymentLedgerEntry,
  ): RPNPaymentLedgerEntry => {
    const entries = rpnPaymentService.getLedgerEntries();
    const existing = entries.find((item) => item.id === entry.id);
    const due = normalizeMoney(entry.commissionAmountDue, "Commission due");
    const paid = normalizeMoney(entry.commissionAmountPaid, "Commission paid");
    const vendorPaymentAmount = normalizeMoney(
      entry.vendorPaymentAmount,
      "Vendor payment amount",
    );
    const now = new Date().toISOString();
    const saved: RPNPaymentLedgerEntry = {
      ...entry,
      id: entry.id || makeId(),
      vendorPaymentAmount,
      commissionAmountDue: due,
      commissionAmountPaid: paid,
      balanceDue: Math.max(due - paid, 0),
      currency: entry.currency || "USD",
      status: entry.status || "due",
      createdAt: existing?.createdAt || entry.createdAt || now,
      updatedAt: now,
    };
    const nextEntries = existing
      ? entries.map((item) => (item.id === saved.id ? saved : item))
      : [...entries, saved];
    writeLedger(nextEntries);
    audit(
      existing
        ? `Updated RPN commission ${saved.id}`
        : `Created RPN commission ${saved.id}`,
      existing,
      saved,
    );
    return saved;
  },

  calculateCommissionForVendorPayment: (
    vendor: Vendor,
    payment: CollectionRecord,
    settings: RPNPerformanceSettings,
  ): RPNPaymentLedgerEntry[] => {
    if (payment.status !== "approved") return [];
    const rpnId = payment.rpnId || assignedRpnId(vendor);
    if (!rpnId) return [];
    const rpn = rpnService.getById(rpnId);
    const config = commissionSettings(settings);
    const amount = normalizeMoney(payment.amountCollected, "Payment amount");
    const workedMonths = monthsBetween(rpn?.createdAt || vendor.onboardedAt);
    const recurringRate =
      workedMonths >= config.rpnSalaryDropAfterMonths
        ? config.rpnPostSalaryRecurringCommissionPercent
        : config.rpnRecurringCommissionPercent;

    const recurringEntry: RPNPaymentLedgerEntry = {
      id: "",
      rpnId,
      rpnName: rpn?.name || vendor.rpnName || "Unknown RPN",
      vendorId: vendor.id,
      vendorName: vendor.name,
      sourceType: "Recurring Subscription",
      sourcePaymentId: payment.id,
      sourceSubscriptionId: subscriptionService.getSubscriptionByVendor(vendor.id)?.id,
      vendorPlan: vendor.planId,
      vendorPaymentAmount: amount,
      commissionRate: recurringRate,
      commissionAmountDue: Number(((amount * recurringRate) / 100).toFixed(2)),
      commissionAmountPaid: 0,
      balanceDue: Number(((amount * recurringRate) / 100).toFixed(2)),
      currency: payment.currency || config.rpnCommissionCurrency,
      periodStart: payment.collectionDate,
      periodEnd: payment.collectionDate,
      dueDate: payment.collectionDate,
      status: "due",
      createdAt: "",
      updatedAt: "",
    };

    return [recurringEntry];
  },

  generateFromSubscriptionPayment: async (
    payment: VendorSubscriptionPayment,
  ): Promise<RPNPaymentLedgerEntry | undefined> => {
    if (payment.paymentStatus !== "paid" || !payment.rpnId) return undefined;
    const settings = await settingsService.getSettings();
    const config = commissionSettings(settings.rpnPerformanceSettings);
    const vendors = await vendorService.getVendors();
    const vendor = vendors.find((item) => item.id === payment.vendorId);
    const rpn = rpnService.getById(payment.rpnId);
    const amount = normalizeMoney(payment.amountPaid, "Payment amount");
    const workedMonths = monthsBetween(rpn?.createdAt || vendor?.onboardedAt);
    const rate =
      workedMonths >= config.rpnSalaryDropAfterMonths
        ? config.rpnPostSalaryRecurringCommissionPercent
        : config.rpnRecurringCommissionPercent;
    const due = Number(((amount * rate) / 100).toFixed(2));
    const entry: RPNPaymentLedgerEntry = {
      id: "",
      rpnId: payment.rpnId,
      rpnName: payment.rpnName || rpn?.name || "Unknown RPN",
      vendorId: payment.vendorId,
      vendorName: payment.vendorName,
      sourceType: "Recurring Subscription",
      sourcePaymentId: payment.id,
      sourceSubscriptionId: payment.id,
      vendorPlan: payment.planName || payment.planId,
      vendorPaymentAmount: amount,
      commissionRate: rate,
      commissionAmountDue: due,
      commissionAmountPaid: 0,
      balanceDue: due,
      currency: payment.currency || config.rpnCommissionCurrency,
      periodStart: payment.billingPeriodStart,
      periodEnd: payment.billingPeriodEnd,
      dueDate: payment.paymentDate || payment.dueDate,
      status: "due",
      notes: payment.receiptNumber
        ? `Generated from receipt ${payment.receiptNumber}`
        : undefined,
      createdAt: "",
      updatedAt: "",
    };
    const existing = rpnPaymentService.getLedgerEntries();
    if (existing.some((item) => dedupeKey(item) === dedupeKey(entry))) {
      return existing.find((item) => dedupeKey(item) === dedupeKey(entry));
    }
    const saved = rpnPaymentService.saveLedgerEntry(entry);
    await notify(
      "RPN Commission Generated",
      `${saved.rpnName} recurring commission for ${saved.vendorName} is due.`,
      saved.id,
      `rpn_commission_due:${saved.rpnId}:${saved.periodStart || saved.dueDate}`,
    );
    return saved;
  },

  generateDueCommissions: async (): Promise<RPNPaymentLedgerEntry[]> => {
    const [settings, vendors, plans] = await Promise.all([
      settingsService.getSettings(),
      vendorService.getVendors(),
      pricingPlanService.getPlans(),
    ]);
    const config = commissionSettings(settings.rpnPerformanceSettings);
    const collections = subscriptionService
      .getAllCollections()
      .filter((collection) => collection.status === "approved");
    const subscriptions = subscriptionService.getAllSubscriptions();
    const existing = rpnPaymentService.getLedgerEntries();
    const existingKeys = new Set(existing.map(dedupeKey));
    const candidates: RPNPaymentLedgerEntry[] = [];

    for (const vendor of vendors) {
      const rpnId = assignedRpnId(vendor);
      if (!rpnId) continue;
      const rpn = rpnService.getById(rpnId);
      const vendorCollections = collections.filter(
        (collection) => collection.vendorId === vendor.id,
      );

      const firstPaidCollection = vendorCollections[0];
      if (firstPaidCollection) {
        candidates.push({
          id: "",
          rpnId,
          rpnName: rpn?.name || vendor.rpnName || "Unknown RPN",
          vendorId: vendor.id,
          vendorName: vendor.name,
          sourceType: "Paid Onboarding",
          sourcePaymentId: firstPaidCollection.id,
          vendorPlan: plans.find((plan) => plan.id === vendor.planId)?.name || vendor.planId,
          vendorPaymentAmount: firstPaidCollection.amountCollected || 0,
          commissionAmountDue: config.rpnOnboardingCommissionAmount,
          commissionAmountPaid: 0,
          balanceDue: config.rpnOnboardingCommissionAmount,
          currency: firstPaidCollection.currency || config.rpnCommissionCurrency,
          periodStart: firstPaidCollection.collectionDate,
          periodEnd: firstPaidCollection.collectionDate,
          dueDate: firstPaidCollection.collectionDate,
          status: "due",
          createdAt: "",
          updatedAt: "",
        });
      }

      for (const collection of vendorCollections) {
        candidates.push(
          ...rpnPaymentService.calculateCommissionForVendorPayment(
            vendor,
            collection,
            settings.rpnPerformanceSettings || {},
          ),
        );
      }

      const paidSub = subscriptions.find(
        (sub) =>
          sub.vendorId === vendor.id &&
          sub.status === "paid" &&
          (sub.lastCollectionAmount || sub.amountDue),
      );
      if (paidSub) {
        const amount = paidSub.lastCollectionAmount || paidSub.amountDue;
        const workedMonths = monthsBetween(rpn?.createdAt || vendor.onboardedAt);
        const rate =
          workedMonths >= config.rpnSalaryDropAfterMonths
            ? config.rpnPostSalaryRecurringCommissionPercent
            : config.rpnRecurringCommissionPercent;
        candidates.push({
          id: "",
          rpnId,
          rpnName: rpn?.name || vendor.rpnName || "Unknown RPN",
          vendorId: vendor.id,
          vendorName: vendor.name,
          sourceType: "Recurring Subscription",
          sourceSubscriptionId: paidSub.id,
          vendorPlan: plans.find((plan) => plan.id === paidSub.planId)?.name || paidSub.planId,
          vendorPaymentAmount: amount,
          commissionRate: rate,
          commissionAmountDue: Number(((amount * rate) / 100).toFixed(2)),
          commissionAmountPaid: 0,
          balanceDue: Number(((amount * rate) / 100).toFixed(2)),
          currency: paidSub.currency || config.rpnCommissionCurrency,
          periodStart: paidSub.lastPaymentDate || paidSub.startDate,
          periodEnd: paidSub.lastPaymentDate || paidSub.dueDate,
          dueDate: paidSub.lastPaymentDate || paidSub.dueDate,
          status: "due",
          createdAt: "",
          updatedAt: "",
        });
      }
    }

    const newEntries = candidates.filter((entry) => {
      const key = dedupeKey(entry);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return entry.commissionAmountDue > 0;
    });

    const saved = newEntries.map((entry) =>
      rpnPaymentService.saveLedgerEntry(entry),
    );
    if (saved.length > 0) {
      await notify(
        "RPN Commission Generated",
        `${saved.length} RPN commission entries were generated.`,
        `generation-${new Date().toISOString().slice(0, 10)}`,
        `rpn_commission_due:all:${new Date().toISOString().slice(0, 10)}`,
      );
    }
    return saved;
  },

  markEntryPendingApproval: async (entryId: string): Promise<void> => {
    const session = getSession();
    const entry = rpnPaymentService.getLedgerEntries().find((item) => item.id === entryId);
    if (!entry) return;
    const before = { ...entry };
    const updated = rpnPaymentService.saveLedgerEntry({
      ...entry,
      status: "pending_approval",
      updatedAt: new Date().toISOString(),
    });
    try {
      await approvalService.create({
        id: generateApprovalId(),
        requestType: "rpn_commission_payout",
        recordType: "rpn_payment_ledger",
        recordId: entry.id,
        recordName: `${entry.rpnName} / ${entry.vendorName}`,
        submittedByStaffId: session.staffId || session.id || "unknown",
        submittedByName: getSessionStaffName(session, "Unknown staff"),
        assignedManagerName: "Finance Manager",
        status: "pending",
        riskLevel: "high",
        afterSnapshot: updated,
        submittedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Approval request saved as ledger status only", error);
    }
    audit("Sent RPN commission for approval", before, updated, "high");
    await notify(
      "RPN Commission Awaiting Approval",
      `${entry.rpnName} commission for ${entry.vendorName} is awaiting approval.`,
      entry.id,
    );
  },

  approveEntry: async (entryId: string, staff: any): Promise<void> => {
    const entry = rpnPaymentService.getLedgerEntries().find((item) => item.id === entryId);
    if (!entry) return;
    const before = { ...entry };
    const updated = rpnPaymentService.saveLedgerEntry({
      ...entry,
      status: "approved",
      approvedByStaffId: staff?.staffId || staff?.id,
      approvedAt: new Date().toISOString(),
    });
    audit("Approved RPN commission", before, updated, "high");
    await notify(
      "RPN Commission Approved",
      `${entry.rpnName} commission for ${entry.vendorName} was approved.`,
      entry.id,
    );
  },

  markEntryPaid: async (
    entryId: string,
    staff: any,
    paymentReference?: string,
    cashBankAccountId?: string,
  ): Promise<void> => {
    const entry = rpnPaymentService.getLedgerEntries().find((item) => item.id === entryId);
    if (!entry) return;
    const before = { ...entry };
    const updated = rpnPaymentService.saveLedgerEntry({
      ...entry,
      status: "paid",
      commissionAmountPaid: entry.commissionAmountDue,
      balanceDue: 0,
      paidByStaffId: staff?.staffId || staff?.id,
      paidAt: new Date().toISOString(),
      notes: [entry.notes, paymentReference ? `Payment ref: ${paymentReference}` : ""]
        .filter(Boolean)
        .join(" | "),
    });
    try {
      const cashBankAccounts = financeService.getCashBankAccounts();
      const cashBank =
        cashBankAccounts.find((account) => account.id === cashBankAccountId) ||
        cashBankAccounts.find((account) => account.status === "active");
      if (cashBank) {
        financeLedgerService.saveLedgerEntry({
          id: "",
          transactionNumber: "",
          transactionDate: new Date().toISOString().slice(0, 10),
          transactionType: "Payment",
          accountId: cashBank.accountId,
          cashBankAccountId: cashBank.id,
          description: `RPN commission paid: ${entry.rpnName} / ${entry.vendorName}`,
          payeeName: entry.rpnName,
          debit: 0,
          credit: entry.commissionAmountDue,
          amount: entry.commissionAmountDue,
          reference: paymentReference || entry.id,
          status: "posted",
          createdAt: "",
          updatedAt: "",
        });
      }
    } catch (error) {
      console.warn("Finance posting will activate when Cash/Bank ledger is configured.", error);
    }
    audit("Paid RPN commission", before, updated, "high");
    await notify(
      "RPN Commission Paid",
      `${entry.rpnName} commission for ${entry.vendorName} was marked paid.`,
      entry.id,
    );
  },

  holdEntry: async (entryId: string, reason: string): Promise<void> => {
    const entry = rpnPaymentService.getLedgerEntries().find((item) => item.id === entryId);
    if (!entry) return;
    const before = { ...entry };
    const updated = rpnPaymentService.saveLedgerEntry({
      ...entry,
      status: "held",
      notes: [entry.notes, reason].filter(Boolean).join(" | "),
    });
    audit("Held RPN commission", before, updated, "warning");
    await notify("RPN Commission Held", reason || "Commission was held.", entry.id);
  },

  rejectEntry: async (entryId: string, reason: string): Promise<void> => {
    const entry = rpnPaymentService.getLedgerEntries().find((item) => item.id === entryId);
    if (!entry) return;
    const before = { ...entry };
    const updated = rpnPaymentService.saveLedgerEntry({
      ...entry,
      status: "rejected",
      notes: [entry.notes, reason].filter(Boolean).join(" | "),
    });
    audit("Rejected RPN commission", before, updated, "warning");
    await notify("RPN Commission Rejected", reason || "Commission was rejected.", entry.id);
  },

  getEntriesByRpn: (rpnId: string): RPNPaymentLedgerEntry[] => {
    return rpnPaymentService
      .getLedgerEntries()
      .filter((entry) => entry.rpnId === rpnId);
  },

  getSummaryByRpn: (dateRange?: {
    dateFrom?: string;
    dateTo?: string;
  }): RPNPaymentSummary[] => {
    const entries = rpnPaymentService.getLedgerEntries().filter((entry) => {
      const dueDate = entry.dueDate.slice(0, 10);
      return (
        (!dateRange?.dateFrom || dueDate >= dateRange.dateFrom) &&
        (!dateRange?.dateTo || dueDate <= dateRange.dateTo)
      );
    });
    const map = new Map<string, RPNPaymentSummary>();
    entries.forEach((entry) => {
      const current =
        map.get(entry.rpnId) ||
        {
          rpnId: entry.rpnId,
          rpnName: entry.rpnName,
          totalDue: 0,
          totalPaid: 0,
          balanceDue: 0,
          entryCount: 0,
        };
      current.totalDue += entry.commissionAmountDue;
      current.totalPaid += entry.commissionAmountPaid;
      current.balanceDue += entry.balanceDue;
      current.entryCount += 1;
      map.set(entry.rpnId, current);
    });
    return Array.from(map.values()).sort((a, b) => b.balanceDue - a.balanceDue);
  },
};
