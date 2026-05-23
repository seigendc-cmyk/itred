/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BIAnalyticsLevel,
  PricingPlan,
  Vendor,
  VendorEntitlementSnapshot,
} from "../types.ts";
import { pricingPlanService } from "./pricingPlanService.ts";
import { subscriptionService } from "./subscriptionService.ts";
import { vendorService } from "./vendorService.ts";
import { vendorPlanUsageService } from "./vendorPlanUsageService.ts";

const levelRank: Record<BIAnalyticsLevel, number> = {
  none: 0,
  basic: 1,
  standard: 2,
  advanced: 3,
};

const lockedStatus = new Set(["suspended", "cancelled"]);
const restrictedOverdueStatus = new Set(["overdue"]);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};

const getDefaultPlan = async () => {
  const plans = await pricingPlanService.getPlans();
  return plans.find((plan) => plan.id === "starter") || plans[0];
};

const resolveVendor = async (vendorId: string): Promise<Vendor> => {
  const vendor = await vendorService.getVendorById(vendorId);
  if (!vendor) throw new Error("Vendor not found.");
  return vendor;
};

const resolvePlan = async (vendor: Vendor): Promise<PricingPlan> => {
  const plan = vendor.planId ? await pricingPlanService.getPlan(vendor.planId) : undefined;
  return plan || (await getDefaultPlan());
};

const subscriptionLockedReason = (vendor: Vendor) => {
  const sub = subscriptionService.getSubscriptionByVendor(vendor.id);
  const status = sub?.status || vendor.subscriptionStatus;
  if (lockedStatus.has(status)) return `Subscription is ${status}.`;
  if (restrictedOverdueStatus.has(status)) {
    const graceDate = addDays(
      sub?.dueDate || vendor.subscriptionDueDate || today(),
      sub?.gracePeriodDays ?? 7,
    );
    if (today() > graceDate) return "Subscription is overdue beyond grace period.";
  }
  return "";
};

export const planEntitlementService = {
  getVendorPlan: async (vendorId: string): Promise<PricingPlan> => {
    const vendor = await resolveVendor(vendorId);
    return resolvePlan(vendor);
  },

  getVendorEntitlementSnapshot: async (
    vendorId: string,
  ): Promise<VendorEntitlementSnapshot> => {
    const vendor = await resolveVendor(vendorId);
    const plan = await resolvePlan(vendor);
    const usage = await vendorPlanUsageService.getUsageSnapshot(vendorId);
    const lockReason = subscriptionLockedReason(vendor);
    return {
      vendorId,
      planId: plan.id,
      planName: plan.name,
      subscriptionStatus: vendor.subscriptionStatus,
      isLocked: !!lockReason,
      lockReason,
      limits: {
        maxProducts: plan.maxProducts,
        maxBranchesPerVendor: plan.maxBranchesPerVendor,
        maxStaffPerVendor: plan.maxStaffPerVendor,
        maxDeliveryContactsPerVendor: plan.maxDeliveryContactsPerVendor,
        maxDeploymentsPerMonth: plan.maxDeploymentsPerMonth,
        maxStorefrontDeploymentsPerMonth: plan.maxStorefrontDeploymentsPerMonth,
        maxStorefrontImages: plan.maxStorefrontImages,
        maxCahLinks: plan.maxCahLinks,
        maxNoticesPerMonth: plan.maxNoticesPerMonth ?? 0,
        inventorySpotChecksPerMonth: plan.inventorySpotChecksPerMonth,
        biAnalyticsLevel: plan.biAnalyticsLevel,
        isVendorStorefrontEnabled: plan.isVendorStorefrontEnabled,
        enableStorefrontCart: plan.enableStorefrontCart,
        enableWhatsappOrders: plan.enableWhatsappOrders,
      },
      usage,
      generatedAt: new Date().toISOString(),
    };
  },

  canUseFeature: async (vendorId: string, featureKey: string) => {
    const snapshot = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    if (snapshot.isLocked) return false;
    const plan = await planEntitlementService.getVendorPlan(vendorId);
    return !!(plan as any)[featureKey] || plan.features?.includes(featureKey);
  },

  canAddProduct: async (vendorId: string) => {
    const s = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    return !s.isLocked && s.usage.productCount < s.limits.maxProducts;
  },
  canAddBranch: async (vendorId: string) => {
    const s = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    return !s.isLocked && s.usage.branchCount < s.limits.maxBranchesPerVendor;
  },
  canAddStaff: async (vendorId: string) => {
    const s = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    return !s.isLocked && s.usage.staffCount < s.limits.maxStaffPerVendor;
  },
  canAddDeliveryContact: async (vendorId: string) => {
    const s = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    return !s.isLocked && s.usage.deliveryContactCount < s.limits.maxDeliveryContactsPerVendor;
  },
  canGenerateCatalogue: async (vendorId: string) => {
    const s = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    return !s.isLocked && s.usage.catalogueGenerationsThisMonth < s.limits.maxDeploymentsPerMonth;
  },
  canGenerateStorefront: async (vendorId: string) => {
    const s = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    return (
      !s.isLocked &&
      s.limits.isVendorStorefrontEnabled &&
      s.usage.storefrontGenerationsThisMonth < s.limits.maxStorefrontDeploymentsPerMonth
    );
  },
  canPublishNotice: async (vendorId: string) => {
    const s = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    return !s.isLocked && s.usage.noticesUsedThisMonth < s.limits.maxNoticesPerMonth;
  },
  canUseBIReport: async (vendorId: string, level: BIAnalyticsLevel) => {
    const s = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    return !s.isLocked && levelRank[s.limits.biAnalyticsLevel] >= levelRank[level];
  },

  assertEntitlementOrThrow: async (vendorId: string, actionKey: string) => {
    const allowed =
      actionKey === "add_product"
        ? await planEntitlementService.canAddProduct(vendorId)
        : actionKey === "add_branch"
          ? await planEntitlementService.canAddBranch(vendorId)
          : actionKey === "add_staff"
            ? await planEntitlementService.canAddStaff(vendorId)
            : actionKey === "add_delivery_contact"
              ? await planEntitlementService.canAddDeliveryContact(vendorId)
              : actionKey === "generate_catalogue"
                ? await planEntitlementService.canGenerateCatalogue(vendorId)
                : actionKey === "generate_storefront"
                  ? await planEntitlementService.canGenerateStorefront(vendorId)
                  : actionKey === "publish_notice"
                    ? await planEntitlementService.canPublishNotice(vendorId)
                    : await planEntitlementService.canUseFeature(vendorId, actionKey);
    if (!allowed) {
      const recommendation = await planEntitlementService.getUpgradeRecommendation(vendorId, actionKey);
      throw new Error(recommendation.message);
    }
  },

  getUpgradeRecommendation: async (vendorId: string, actionKey: string) => {
    const snapshot = await planEntitlementService.getVendorEntitlementSnapshot(vendorId);
    const plans = await pricingPlanService.getActive();
    const currentPrice = (await planEntitlementService.getVendorPlan(vendorId)).monthlyPrice;
    const next = plans
      .filter((plan) => plan.monthlyPrice >= currentPrice)
      .find((plan) => {
        if (actionKey === "add_product") return plan.maxProducts > snapshot.usage.productCount;
        if (actionKey === "generate_storefront") return plan.isVendorStorefrontEnabled;
        if (actionKey === "generate_catalogue") return plan.maxDeploymentsPerMonth > snapshot.usage.catalogueGenerationsThisMonth;
        if (actionKey === "publish_notice") return (plan.maxNoticesPerMonth || 0) > snapshot.usage.noticesUsedThisMonth;
        return true;
      });
    return {
      planId: next?.id,
      planName: next?.name || "higher plan",
      message: snapshot.isLocked
        ? `Blocked: ${snapshot.lockReason}`
        : `Plan limit reached for ${actionKey}. Upgrade to ${next?.name || "a higher plan"} to continue.`,
    };
  },
};
