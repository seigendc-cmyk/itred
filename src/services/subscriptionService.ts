/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CollectionRecord,
  Subscription,
  VendorSubscriptionPayment,
} from '../types.ts';
import { financeLedgerService } from './financeLedgerService.ts';
import { financeService } from './financeService.ts';
import { localStorageService } from './localStorageService.ts';
import { notificationService } from './notificationService.ts';
import { staffAuditService } from './staffAuditService.ts';
import { vendorService } from './vendorService.ts';
import { generateSubscriptionPaymentId } from '../utils/idGenerator.ts';
import { getSession as getActiveSession } from '../utils/session.ts';

const SUBSCRIPTIONS_KEY = 'itred_subscriptions';
const COLLECTIONS_KEY = 'itred_collections';
const PAYMENTS_KEY = 'itred_vendor_subscription_payments';

const normalizeMoney = (value: unknown, fieldName: string): number => {
  const numberValue =
    typeof value === "number" ? value : Number(String(value || "0"));
  if (!Number.isFinite(numberValue) || Number.isNaN(numberValue)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return numberValue;
};

const makePaymentId = () => generateSubscriptionPaymentId();

const nextReceiptNumber = (): string => {
  const stamp = new Date().toISOString().slice(0, 7).replace("-", "");
  const count =
    subscriptionService
      .getAllPayments()
      .filter((payment) => payment.receiptNumber?.includes(`SCI-RCT-${stamp}`))
      .length + 1;
  return `SCI-RCT-${stamp}-${String(count).padStart(4, "0")}`;
};

const getSession = () => {
  return getActiveSession() || {};
};

const assignedRpnId = (vendor: any) =>
  vendor?.rpnId ||
  vendor?.assignedRPNId ||
  vendor?.assignedStaffId ||
  vendor?.onboardedByStaffId ||
  "";

const audit = (action: string, beforeSnapshot: unknown, afterSnapshot: unknown) => {
  try {
    void staffAuditService.logAction({
      eventType: beforeSnapshot ? "RECORD_UPDATED" : "RECORD_CREATED",
      module: "finance",
      severity: "info",
      action,
      recordType: "VendorSubscriptionPayment",
      recordId: (afterSnapshot as any)?.id,
      recordName: (afterSnapshot as any)?.vendorName,
      beforeSnapshot,
      afterSnapshot,
    });
  } catch (error) {
    console.warn("Subscription collection audit failed", error);
  }
};

const notify = async (
  title: string,
  message: string,
  recordId: string,
  dedupeKey: string,
) => {
  try {
    await notificationService.createNotification({
      title,
      message,
      type: "finance_report",
      priority: "medium",
      targetRole: "Admin",
      recordType: "subscription_collection",
      recordId,
      dedupeKey,
    });
  } catch (error) {
    console.warn("Subscription collection notification failed", error);
  }
};

const postPaymentToFinance = (
  payment: VendorSubscriptionPayment,
): string | undefined => {
  try {
    const cashBank = financeService
      .getCashBankAccounts()
      .find((account) => account.status === "active");
    const revenueAccount = financeService
      .getChartOfAccounts()
      .find(
        (account) =>
          account.status === "active" &&
          (account.accountCode === "4000" ||
            account.accountName.toLowerCase().includes("subscription revenue")),
      );

    if (!cashBank || !revenueAccount || payment.amountPaid <= 0) {
      return undefined;
    }

    const reference = payment.receiptNumber || payment.paymentReference || payment.id;
    const cashEntry = financeLedgerService.saveLedgerEntry({
      id: "",
      transactionNumber: "",
      transactionDate:
        payment.paymentDate || new Date().toISOString().slice(0, 10),
      transactionType: "Receipt",
      accountId: cashBank.accountId,
      cashBankAccountId: cashBank.id,
      description: `Subscription receipt from ${payment.vendorName}`,
      payerName: payment.vendorName,
      debit: payment.amountPaid,
      credit: 0,
      amount: payment.amountPaid,
      reference,
      status: "posted",
      createdAt: "",
      updatedAt: "",
    });

    financeLedgerService.saveLedgerEntry({
      id: "",
      transactionNumber: "",
      transactionDate:
        payment.paymentDate || new Date().toISOString().slice(0, 10),
      transactionType: "Receipt",
      accountId: revenueAccount.id,
      description: `Subscription revenue from ${payment.vendorName}`,
      payerName: payment.vendorName,
      debit: 0,
      credit: payment.amountPaid,
      amount: payment.amountPaid,
      reference,
      status: "posted",
      createdAt: "",
      updatedAt: "",
    });

    return cashEntry.id;
  } catch (error) {
    console.warn(
      "Finance posting pending until Cash/Bank Ledger is configured.",
      error,
    );
    return undefined;
  }
};

export const subscriptionService = {
  getAllPayments: (): VendorSubscriptionPayment[] => {
    return localStorageService.get<VendorSubscriptionPayment[]>(PAYMENTS_KEY) || [];
  },

  getRecentPayments: (limit = 100): VendorSubscriptionPayment[] => {
    return subscriptionService
      .getAllPayments()
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, limit);
  },

  getPaymentsByVendorId: (vendorId: string): VendorSubscriptionPayment[] => {
    return subscriptionService
      .getAllPayments()
      .filter((payment) => payment.vendorId === vendorId);
  },

  getPaymentsByRpnId: (rpnId: string): VendorSubscriptionPayment[] => {
    return subscriptionService
      .getAllPayments()
      .filter((payment) => payment.rpnId === rpnId);
  },

  getPaymentsByDateRange: (
    from: string,
    to: string,
  ): VendorSubscriptionPayment[] => {
    return subscriptionService.getAllPayments().filter((payment) => {
      const date = (payment.paymentDate || payment.createdAt || "").slice(0, 10);
      return (!from || date >= from) && (!to || date <= to);
    });
  },

  savePayment: (
    payment: VendorSubscriptionPayment,
  ): VendorSubscriptionPayment => {
    const payments = subscriptionService.getAllPayments();
    const existing = payments.find((item) => item.id === payment.id);
    const now = new Date().toISOString();
    const amountDue = normalizeMoney(payment.amountDue, "Amount due");
    const amountPaid = normalizeMoney(payment.amountPaid, "Amount paid");
    const balanceDue = Math.max(amountDue - amountPaid, 0);
    const saved: VendorSubscriptionPayment = {
      ...payment,
      id: payment.id || makePaymentId(),
      amountDue,
      amountPaid,
      balanceDue,
      paymentStatus:
        payment.paymentStatus ||
        (amountPaid >= amountDue ? "paid" : amountPaid > 0 ? "partial" : "unpaid"),
      receiptNumber:
        payment.receiptNumber ||
        (amountPaid > 0 ? nextReceiptNumber() : undefined),
      createdAt: existing?.createdAt || payment.createdAt || now,
      updatedAt: now,
    };
    const next = existing
      ? payments.map((item) => (item.id === saved.id ? saved : item))
      : [...payments, saved];
    localStorageService.set(PAYMENTS_KEY, next);
    audit(
      existing
        ? `Updated subscription payment ${saved.id}`
        : `Recorded subscription payment ${saved.id}`,
      existing,
      saved,
    );
    return saved;
  },

  recordSubscriptionPayment: async (
    payment: VendorSubscriptionPayment,
    options?: {
      postToFinance?: boolean;
      generateRpnCommission?: boolean;
      staffId?: string;
    },
  ): Promise<VendorSubscriptionPayment> => {
    const session = getSession();
    const amountDue = normalizeMoney(payment.amountDue, "Amount due");
    const amountPaid = normalizeMoney(payment.amountPaid, "Amount paid");
    let saved = subscriptionService.savePayment({
      ...payment,
      amountDue,
      amountPaid,
      balanceDue: Math.max(amountDue - amountPaid, 0),
      paymentStatus:
        payment.paymentStatus ||
        (amountPaid >= amountDue ? "paid" : amountPaid > 0 ? "partial" : "unpaid"),
    });

    if (options?.postToFinance !== false && amountPaid > 0) {
      const financeTransactionId =
        saved.financeTransactionId || postPaymentToFinance(saved);
      if (financeTransactionId) {
        saved = subscriptionService.savePayment({
          ...saved,
          financeTransactionId,
        });
        audit("Posted subscription payment to finance ledger", payment, saved);
      }
    }

    const collection: CollectionRecord = {
      id: saved.id,
      vendorId: saved.vendorId,
      vendorNameSnapshot: saved.vendorName,
      rpnId: saved.rpnId,
      staffId: options?.staffId || session.staffId || session.id || "system",
      amountCollected: saved.amountPaid,
      currency: saved.currency,
      collectionDate: saved.paymentDate || new Date().toISOString().slice(0, 10),
      collectionMethod: (saved.paymentMethod as any) || "manual",
      referenceNumber: saved.paymentReference || saved.receiptNumber || saved.id,
      notes: `Subscription payment ${saved.receiptNumber || saved.id}`,
      status: saved.paymentStatus === "paid" ? "approved" : "pending approval",
      approvedBy:
        saved.paymentStatus === "paid"
          ? options?.staffId || session.staffId || session.id || "system"
          : undefined,
      approvedAt:
        saved.paymentStatus === "paid" ? new Date().toISOString() : undefined,
      receiptNumber: saved.receiptNumber,
      financeTransactionId: saved.financeTransactionId,
      rpnCommissionGenerated: saved.rpnCommissionGenerated,
      createdAt: saved.createdAt,
    };
    subscriptionService.saveCollection(collection);

    const subscription = subscriptionService.getSubscriptionByVendor(saved.vendorId);
    if (subscription) {
      subscription.status =
        saved.paymentStatus === "paid"
          ? "paid"
          : saved.paymentStatus === "partial"
            ? "due"
            : subscription.status;
      subscription.lastPaymentDate = saved.paymentDate;
      subscription.lastCollectionAmount = saved.amountPaid;
      subscription.collectionMethod = (saved.paymentMethod as any) || "manual";
      subscription.popNote = saved.paymentReference;
      subscriptionService.saveSubscription(subscription);
    }

    if (
      options?.generateRpnCommission !== false &&
      saved.paymentStatus === "paid" &&
      saved.rpnId &&
      !saved.rpnCommissionGenerated
    ) {
      try {
        const { rpnPaymentService } = await import("./rpnPaymentService.ts");
        const commission = await rpnPaymentService.generateFromSubscriptionPayment(
          saved,
        );
        if (commission) {
          saved = subscriptionService.savePayment({
            ...saved,
            rpnCommissionGenerated: true,
          });
          audit("Generated RPN recurring commission from subscription payment", payment, saved);
        }
      } catch (error) {
        console.warn("RPN commission generation pending.", error);
      }
    }

    await notify(
      "Subscription Payment Recorded",
      `${saved.vendorName} payment of ${saved.currency} ${saved.amountPaid.toFixed(2)} was recorded.`,
      saved.id,
      `subscription_payment:${saved.id}`,
    );
    return saved;
  },

  markPaymentWaived: (paymentId: string): VendorSubscriptionPayment | undefined => {
    const payment = subscriptionService
      .getAllPayments()
      .find((item) => item.id === paymentId);
    if (!payment) return undefined;
    const saved = subscriptionService.savePayment({
      ...payment,
      paymentStatus: "waived",
      amountPaid: payment.amountPaid || 0,
      balanceDue: 0,
    });
    audit("Waived subscription payment", payment, saved);
    return saved;
  },

  generateOverdueAlerts: async (): Promise<void> => {
    const vendors = await vendorService.getVendors();
    const today = new Date();
    for (const vendor of vendors) {
      if (!vendor.subscriptionDueDate) continue;
      const dueDate = new Date(vendor.subscriptionDueDate);
      if (Number.isNaN(dueDate.getTime())) continue;
      const days = Math.floor(
        (today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (days >= -3 && days < 0) {
        await notify(
          "Vendor Subscription Due Soon",
          `${vendor.name} subscription is due on ${vendor.subscriptionDueDate}.`,
          vendor.id,
          `subscription_due:${vendor.id}:${vendor.subscriptionDueDate}`,
        );
      }
      if (days > 0) {
        const stage = days >= 30 ? "churn-risk" : days >= 14 ? "high-risk" : "overdue";
        await notify(
          "Vendor Subscription Overdue",
          `${vendor.name} subscription is ${days} day(s) overdue. Assigned RPN follow-up is required.`,
          vendor.id,
          `subscription_overdue:${vendor.id}:${vendor.subscriptionDueDate}:${stage}`,
        );
      }
    }
  },

  // Subscriptions
  getAllSubscriptions: (): Subscription[] => {
    return localStorageService.get<Subscription[]>(SUBSCRIPTIONS_KEY) || [];
  },

  getSubscriptionById: (id: string): Subscription | undefined => {
    return subscriptionService.getAllSubscriptions().find(s => s.id === id);
  },

  getSubscriptionByVendor: (vendorId: string): Subscription | undefined => {
    return subscriptionService.getAllSubscriptions().find(s => s.vendorId === vendorId);
  },

  saveSubscription: (sub: Subscription): void => {
    const subs = subscriptionService.getAllSubscriptions();
    const index = subs.findIndex(s => s.id === sub.id);
    if (index >= 0) {
      subs[index] = { ...sub, updatedAt: new Date().toISOString() };
    } else {
      subs.push({ ...sub, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    localStorageService.set(SUBSCRIPTIONS_KEY, subs);
  },

  deleteSubscription: (id: string): void => {
    const subs = subscriptionService.getAllSubscriptions().filter(s => s.id !== id);
    localStorageService.set(SUBSCRIPTIONS_KEY, subs);
  },

  // Collections
  getAllCollections: (): CollectionRecord[] => {
    return localStorageService.get<CollectionRecord[]>(COLLECTIONS_KEY) || [];
  },

  saveCollection: (record: CollectionRecord): void => {
    const collections = subscriptionService.getAllCollections();
    const index = collections.findIndex(c => c.id === record.id);
    if (index >= 0) {
      collections[index] = record;
    } else {
      collections.push({ ...record, createdAt: new Date().toISOString() });
    }
    localStorageService.set(COLLECTIONS_KEY, collections);

    // If it's a new approved collection, we might want to update the subscription status
    if (record.status === 'approved') {
      const sub = subscriptionService.getSubscriptionByVendor(record.vendorId);
      if (sub) {
        sub.status = 'paid';
        sub.lastPaymentDate = record.collectionDate;
        sub.lastCollectionAmount = record.amountCollected;
        sub.collectionMethod = record.collectionMethod;
        subscriptionService.saveSubscription(sub);
      }
    }
  },

  approveCollection: (collectionId: string, adminId: string): void => {
    const collections = subscriptionService.getAllCollections();
    const index = collections.findIndex(c => c.id === collectionId);
    if (index >= 0) {
      const record = collections[index];
      record.status = 'approved';
      record.approvedBy = adminId;
      record.approvedAt = new Date().toISOString();
      subscriptionService.saveCollection(record);
    }
  }
};
