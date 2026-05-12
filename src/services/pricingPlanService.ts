/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PricingPlan } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { asArray } from "../utils/safeData.ts";

const STORAGE_KEY = "itred_pricing_plans";

const DEFAULT_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 0,
    currency: "USD",
    maxProducts: 50,
    maxVendorsPerCatalogue: 1,
    maxImagesPerCatalogue: 50,
    deploymentFrequency: "monthly",
    maxDeploymentsPerMonth: 2,
    maxCahLinks: 1,
    maxBranchesPerVendor: 1,
    maxStaffPerVendor: 1,
    maxDeliveryContactsPerVendor: 1,
    isWhatsAppProductButtonEnabled: true,
    isDirectCallProductButtonEnabled: false,
    isVendorWhatsAppGroupLinkEnabled: false,
    isVendorWhatsAppChannelLinkEnabled: false,
    isInventorySpotCheckIncluded: false,
    inventorySpotChecksPerMonth: 0,
    biAnalyticsLevel: "basic",
    rpnSupportLevel: "basic",
    isCollectionReminderEnabled: true,
    isHostedCatalogueSupportEnabled: false,
    isVendorStorefrontEnabled: false,
    isVendorStorefrontBannerSupported: false,
    isVendorStorefrontSearchSupported: false,
    isVendorStorefrontCahLinksSupported: false,
    isVendorStorefrontWhatsAppButtonEnabled: true,
    isVendorStorefrontDirectCallButtonEnabled: false,
    maxStorefrontImages: 25,
    maxStorefrontDeploymentsPerMonth: 1,
    isCahBoothAccessEnabled: false,
    isWhatsAppCustomerSupportEnabled: true,
    farmProducerShowcaseLevel: "basic",
    cahFollowerTrackingLevel: "none",
    cahBoothSupportLevel: "none",
    isRpnOnboardingPdfEnabled: true,
    features: ["Basic BI", "Basic RPN follow-up"],
    status: "active",
    createdBy: "system",
    updatedBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 49,
    currency: "USD",
    maxProducts: 300,
    maxVendorsPerCatalogue: 20,
    maxImagesPerCatalogue: 300,
    deploymentFrequency: "bi-weekly",
    maxDeploymentsPerMonth: 4,
    maxCahLinks: 5,
    maxBranchesPerVendor: 2,
    maxStaffPerVendor: 4,
    maxDeliveryContactsPerVendor: 4,
    isWhatsAppProductButtonEnabled: true,
    isDirectCallProductButtonEnabled: true,
    isVendorWhatsAppGroupLinkEnabled: true,
    isVendorWhatsAppChannelLinkEnabled: true,
    isInventorySpotCheckIncluded: true,
    inventorySpotChecksPerMonth: 1,
    biAnalyticsLevel: "standard",
    rpnSupportLevel: "standard",
    isCollectionReminderEnabled: true,
    isHostedCatalogueSupportEnabled: false,
    isVendorStorefrontEnabled: true,
    isVendorStorefrontBannerSupported: true,
    isVendorStorefrontSearchSupported: true,
    isVendorStorefrontCahLinksSupported: true,
    isVendorStorefrontWhatsAppButtonEnabled: true,
    isVendorStorefrontDirectCallButtonEnabled: true,
    maxStorefrontImages: 150,
    maxStorefrontDeploymentsPerMonth: 2,
    isCahBoothAccessEnabled: true,
    isWhatsAppCustomerSupportEnabled: true,
    farmProducerShowcaseLevel: "full",
    cahFollowerTrackingLevel: "basic",
    cahBoothSupportLevel: "basic",
    isRpnOnboardingPdfEnabled: true,
    features: ["Standard BI", "Standard RPN follow-up"],
    status: "active",
    createdBy: "system",
    updatedBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 199,
    currency: "USD",
    maxProducts: 1000,
    maxVendorsPerCatalogue: 100,
    maxImagesPerCatalogue: 800,
    deploymentFrequency: "weekly",
    maxDeploymentsPerMonth: 20,
    maxCahLinks: 20,
    maxBranchesPerVendor: 8,
    maxStaffPerVendor: 60,
    maxDeliveryContactsPerVendor: 60,
    isWhatsAppProductButtonEnabled: true,
    isDirectCallProductButtonEnabled: true,
    isVendorWhatsAppGroupLinkEnabled: true,
    isVendorWhatsAppChannelLinkEnabled: true,
    isInventorySpotCheckIncluded: true,
    inventorySpotChecksPerMonth: 4,
    biAnalyticsLevel: "advanced",
    rpnSupportLevel: "priority",
    isCollectionReminderEnabled: true,
    isHostedCatalogueSupportEnabled: true,
    isVendorStorefrontEnabled: true,
    isVendorStorefrontBannerSupported: true,
    isVendorStorefrontSearchSupported: true,
    isVendorStorefrontCahLinksSupported: true,
    isVendorStorefrontWhatsAppButtonEnabled: true,
    isVendorStorefrontDirectCallButtonEnabled: true,
    maxStorefrontImages: 500,
    maxStorefrontDeploymentsPerMonth: 8,
    isCahBoothAccessEnabled: true,
    isWhatsAppCustomerSupportEnabled: true,
    farmProducerShowcaseLevel: "full",
    cahFollowerTrackingLevel: "advanced",
    cahBoothSupportLevel: "priority",
    isRpnOnboardingPdfEnabled: true,
    features: [
      "Advanced BI",
      "Advanced RPN follow-up",
      "Hosted Catalogue Placeholder",
    ],
    status: "active",
    createdBy: "system",
    updatedBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const pricingPlanService = {
  getPlans: async (): Promise<PricingPlan[]> => {
    try {
      const data =
        await getStorageAdapter().getItem<PricingPlan[]>(STORAGE_KEY);
      if (!data) {
        await getStorageAdapter().setItem(STORAGE_KEY, DEFAULT_PLANS);
        return DEFAULT_PLANS;
      }
      return asArray<PricingPlan>(data);
    } catch (error) {
      console.warn("Firebase Error: Failed to get pricing plans", error);
      return [];
    }
  },

  getPlan: async (id: string): Promise<PricingPlan | undefined> => {
    const plans = await pricingPlanService.getPlans();
    return plans.find((p) => p.id === id);
  },

  savePlan: async (plan: PricingPlan): Promise<void> => {
    const plans = await pricingPlanService.getPlans();
    const index = plans.findIndex((p) => p.id === plan.id);

    if (index >= 0) {
      plans[index] = { ...plan, updatedAt: new Date().toISOString() };
    } else {
      plans.push({
        ...plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await getStorageAdapter().setItem(STORAGE_KEY, plans);
  },

  deletePlan: async (id: string): Promise<void> => {
    const plans = (await pricingPlanService.getPlans()).filter(
      (p) => p.id !== id,
    );
    await getStorageAdapter().setItem(STORAGE_KEY, plans);
  },

  updateStatus: async (
    id: string,
    status: PricingPlan["status"],
  ): Promise<void> => {
    const plans = await pricingPlanService.getPlans();
    const plan = plans.find((p) => p.id === id);
    if (plan) {
      plan.status = status;
      plan.updatedAt = new Date().toISOString();
      await getStorageAdapter().setItem(STORAGE_KEY, plans);
    }
  },
};
