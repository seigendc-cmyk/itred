/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CollectionMethod,
  PricingPlan,
  Subscription,
  Vendor,
  VendorSubscriptionPayment,
} from "../types.ts";
import { pricingPlanService } from "./pricingPlanService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { subscriptionService } from "./subscriptionService.ts";
import { vendorService } from "./vendorService.ts";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};
const makeId = (vendorId: string) => `SUB-${vendorId}`;

const audit = (action: string, beforeSnapshot: unknown, afterSnapshot: unknown) => {
  try {
    void staffAuditService.logAction({
      eventType: beforeSnapshot ? "RECORD_UPDATED" : "RECORD_CREATED",
      module: "subscriptions",
      severity: "info",
      action,
      recordType: "subscription",
      recordId: (afterSnapshot as any)?.id,
      recordName: (afterSnapshot as any)?.vendorNameSnapshot,
      beforeSnapshot,
      afterSnapshot,
    });
  } catch (error) {
    console.warn("Subscription billing audit failed", error);
  }
};

const saveVendorSubscriptionFields = async (
  vendor: Vendor,
  plan: PricingPlan,
  status: Vendor["subscriptionStatus"],
  startDate: string,
  dueDate: string,
) => {
  await vendorService.updateVendor({
    ...vendor,
    planId: plan.id,
    subscriptionStatus: status,
    subscriptionStartDate: startDate,
    subscriptionDueDate: dueDate,
    updatedAt: new Date().toISOString(),
  });
};

export const subscriptionBillingService = {
  createSubscriptionForVendor: async (
    vendorId: string,
    planId: string,
  ): Promise<Subscription> => {
    const [vendor, plan] = await Promise.all([
      vendorService.getVendorById(vendorId),
      pricingPlanService.getPlan(planId),
    ]);
    if (!vendor) throw new Error("Vendor not found.");
    if (!plan) throw new Error("Pricing plan not found.");
    const startDate = today();
    const dueDate = addDays(startDate, plan.trialDays || 0);
    const existing = subscriptionService.getSubscriptionByVendor(vendorId);
    const sub: Subscription = {
      id: existing?.id || makeId(vendorId),
      vendorId,
      vendorNameSnapshot: vendor.name,
      assignedRPNId: vendor.assignedRPNId || vendor.rpnId,
      planId,
      amountDue: plan.monthlyPrice,
      currency: plan.currency,
      billingPeriod: "monthly",
      startDate,
      dueDate,
      gracePeriodDays: 7,
      status: plan.trialDays ? "trial" : "active",
      followUpStatus: "not started",
      createdBy: existing?.createdBy || "system",
      updatedBy: "system",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    subscriptionService.saveSubscription(sub);
    await saveVendorSubscriptionFields(vendor, plan, sub.status, startDate, dueDate);
    audit("Created vendor subscription from pricing plan", existing, sub);
    return sub;
  },

  assignPlanToVendor: async (
    vendorId: string,
    planId: string,
    options?: { status?: Vendor["subscriptionStatus"]; overrideReason?: string },
  ): Promise<Subscription> => {
    const [vendor, plan] = await Promise.all([
      vendorService.getVendorById(vendorId),
      pricingPlanService.getPlan(planId),
    ]);
    if (!vendor) throw new Error("Vendor not found.");
    if (!plan) throw new Error("Pricing plan not found.");
    const existing = subscriptionService.getSubscriptionByVendor(vendorId);
    const startDate = existing?.startDate || today();
    const dueDate = existing?.dueDate || addDays(startDate, plan.trialDays || 0);
    const status = options?.status || existing?.status || (plan.trialDays ? "trial" : "active");
    const sub: Subscription = {
      id: existing?.id || makeId(vendorId),
      vendorId,
      vendorNameSnapshot: vendor.name,
      assignedRPNId: vendor.assignedRPNId || vendor.rpnId,
      planId,
      amountDue: plan.monthlyPrice,
      currency: plan.currency,
      billingPeriod: "monthly",
      startDate,
      dueDate,
      gracePeriodDays: existing?.gracePeriodDays || 7,
      status,
      lastPaymentDate: existing?.lastPaymentDate,
      lastCollectionAmount: existing?.lastCollectionAmount,
      collectionMethod: existing?.collectionMethod,
      popNote: options?.overrideReason || existing?.popNote,
      followUpStatus: existing?.followUpStatus || "not started",
      nextFollowUpDate: existing?.nextFollowUpDate,
      collectionNotes: existing?.collectionNotes,
      createdBy: existing?.createdBy || "system",
      updatedBy: "system",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    subscriptionService.saveSubscription(sub);
    await saveVendorSubscriptionFields(vendor, plan, status, startDate, dueDate);
    audit("Assigned pricing plan and updated subscription", existing, sub);
    return sub;
  },

  startTrial: async (vendorId: string, planId: string) => {
    const plan = await pricingPlanService.getPlan(planId);
    const sub = await subscriptionBillingService.assignPlanToVendor(vendorId, planId, {
      status: "trial",
    });
    sub.dueDate = addDays(today(), plan?.trialDays || 7);
    subscriptionService.saveSubscription(sub);
    return sub;
  },

  activateSubscription: async (vendorId: string) => {
    const sub = subscriptionService.getSubscriptionByVendor(vendorId);
    if (!sub) throw new Error("Subscription not found.");
    sub.status = "active";
    subscriptionService.saveSubscription(sub);
    const vendor = await vendorService.getVendorById(vendorId);
    const plan = await pricingPlanService.getPlan(sub.planId);
    if (vendor && plan) await saveVendorSubscriptionFields(vendor, plan, "active", sub.startDate, sub.dueDate);
    return sub;
  },

  markSubscriptionDue: async (vendorId: string) => {
    const sub = subscriptionService.getSubscriptionByVendor(vendorId);
    if (!sub) throw new Error("Subscription not found.");
    sub.status = "due";
    subscriptionService.saveSubscription(sub);
    const vendor = await vendorService.getVendorById(vendorId);
    if (vendor) await vendorService.updateVendor({ ...vendor, subscriptionStatus: "due" });
    return sub;
  },

  markSubscriptionOverdue: async (vendorId: string) => {
    const sub = subscriptionService.getSubscriptionByVendor(vendorId);
    if (!sub) throw new Error("Subscription not found.");
    sub.status = "overdue";
    subscriptionService.saveSubscription(sub);
    const vendor = await vendorService.getVendorById(vendorId);
    if (vendor) await vendorService.updateVendor({ ...vendor, subscriptionStatus: "overdue" });
    return sub;
  },

  suspendForNonPayment: async (vendorId: string) => {
    const sub = subscriptionService.getSubscriptionByVendor(vendorId);
    if (!sub) throw new Error("Subscription not found.");
    sub.status = "suspended";
    subscriptionService.saveSubscription(sub);
    const vendor = await vendorService.getVendorById(vendorId);
    if (vendor) await vendorService.updateVendor({ ...vendor, subscriptionStatus: "suspended" });
    return sub;
  },

  reactivateAfterPayment: async (vendorId: string) =>
    subscriptionBillingService.activateSubscription(vendorId),

  getAmountDue: async (vendorId: string) => {
    const sub = subscriptionService.getSubscriptionByVendor(vendorId);
    if (!sub) return 0;
    return Math.max(Number(sub.amountDue || 0) - Number(sub.lastCollectionAmount || 0), 0);
  },

  getNextDueDate: async (vendorId: string) =>
    subscriptionService.getSubscriptionByVendor(vendorId)?.dueDate,

  recordPaymentAgainstSubscription: async (
    vendorId: string,
    paymentRecord: Partial<VendorSubscriptionPayment> & {
      amountPaid: number;
      paymentMethod?: CollectionMethod | string;
    },
  ) => {
    const sub = subscriptionService.getSubscriptionByVendor(vendorId);
    const vendor = await vendorService.getVendorById(vendorId);
    if (!sub || !vendor) throw new Error("Subscription or vendor not found.");
    const payment = await subscriptionService.recordSubscriptionPayment({
      id: paymentRecord.id || "",
      vendorId,
      vendorName: vendor.name,
      rpnId: vendor.assignedRPNId || vendor.rpnId,
      rpnName: vendor.rpnName,
      planId: sub.planId,
      planName: paymentRecord.planName || sub.planId,
      billingPeriodStart: sub.startDate,
      billingPeriodEnd: sub.dueDate,
      dueDate: sub.dueDate,
      amountDue: sub.amountDue,
      amountPaid: paymentRecord.amountPaid,
      balanceDue: Math.max(sub.amountDue - paymentRecord.amountPaid, 0),
      currency: sub.currency,
      paymentStatus: paymentRecord.amountPaid >= sub.amountDue ? "paid" : "partial",
      paymentDate: paymentRecord.paymentDate || today(),
      paymentMethod: paymentRecord.paymentMethod,
      paymentReference: paymentRecord.paymentReference,
      createdAt: paymentRecord.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as VendorSubscriptionPayment);
    if (payment.paymentStatus === "paid") {
      await subscriptionBillingService.reactivateAfterPayment(vendorId);
    }
    return payment;
  },
};
