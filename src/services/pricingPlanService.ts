/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PricingPlan } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { asArray } from "../utils/safeData.ts";
import { CACHE_TTL, dataCacheService } from "./dataCacheService.ts";
import { readDiagnosticsService } from "./readDiagnosticsService.ts";

const STORAGE_KEY = "itred_pricing_plans";

const DEFAULT_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 20,
    currency: "USD",
    maxProducts: 50,
    enableBrandedProducts: false,
    brandedProductsIncluded: 0,
    brandedProductAddOnEnabled: true,
    brandedProductAddOnPrice: 5,
    brandedProductAddOnQuantity: 50,
    maxBrandedProducts: "unlimited",
    maxVendorsPerCatalogue: 1,
    maxImagesPerCatalogue: 50,
    maxImagesPerListing: 1,
    maxImagesPerProduct: 1,
    deploymentFrequency: "monthly",
    maxDeploymentsPerMonth: 2,
    maxCahLinks: 1,
    maxNoticesPerMonth: 0,
    maxBranchesPerVendor: 1,
    maxStaffPerVendor: 1,
    maxDeliveryContactsPerVendor: 1,
    enableIDeliver: true,
    maxDeliveryProviders: 1,
    allowVerifiedDeliveryProvider: true,
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
    enableStorefrontCart: false,
    enableWhatsappOrders: false,
    maxStorefrontImages: 25,
    maxStorefrontDeploymentsPerMonth: 1,
    isCahBoothAccessEnabled: false,
    isWhatsAppCustomerSupportEnabled: true,
    farmProducerShowcaseLevel: "basic",
    cahFollowerTrackingLevel: "none",
    cahBoothSupportLevel: "none",
    isRpnOnboardingPdfEnabled: true,
    trialDays: 7,
    features: ["Basic BI", "Basic RPN follow-up", "iDeliver / Verified Delivery Provider"],
    status: "active",
    createdBy: "system",
    updatedBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 32,
    currency: "USD",
    maxProducts: 300,
    enableBrandedProducts: false,
    brandedProductsIncluded: 0,
    brandedProductAddOnEnabled: true,
    brandedProductAddOnPrice: 5,
    brandedProductAddOnQuantity: 50,
    maxBrandedProducts: "unlimited",
    maxVendorsPerCatalogue: 20,
    maxImagesPerCatalogue: 300,
    maxImagesPerListing: 1,
    maxImagesPerProduct: 1,
    deploymentFrequency: "bi-weekly",
    maxDeploymentsPerMonth: 4,
    maxCahLinks: 5,
    maxNoticesPerMonth: 5,
    maxBranchesPerVendor: 2,
    maxStaffPerVendor: 4,
    maxDeliveryContactsPerVendor: 4,
    enableIDeliver: true,
    maxDeliveryProviders: 3,
    allowVerifiedDeliveryProvider: true,
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
    enableStorefrontCart: true,
    enableWhatsappOrders: true,
    maxStorefrontImages: 150,
    maxStorefrontDeploymentsPerMonth: 4,
    isCahBoothAccessEnabled: true,
    isWhatsAppCustomerSupportEnabled: true,
    farmProducerShowcaseLevel: "full",
    cahFollowerTrackingLevel: "basic",
    cahBoothSupportLevel: "basic",
    isRpnOnboardingPdfEnabled: true,
    trialDays: 7,
    features: ["Standard BI", "Standard RPN follow-up", "iDeliver / Verified Delivery Provider"],
    status: "active",
    createdBy: "system",
    updatedBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 50,
    currency: "USD",
    maxProducts: 1000,
    enableBrandedProducts: true,
    brandedProductsIncluded: 100,
    brandedProductAddOnEnabled: true,
    brandedProductAddOnPrice: 5,
    brandedProductAddOnQuantity: 50,
    maxBrandedProducts: "unlimited",
    maxVendorsPerCatalogue: 100,
    maxImagesPerCatalogue: 800,
    maxImagesPerListing: 1,
    maxImagesPerProduct: 1,
    deploymentFrequency: "weekly",
    maxDeploymentsPerMonth: 20,
    maxCahLinks: 20,
    maxNoticesPerMonth: 20,
    maxBranchesPerVendor: 8,
    maxStaffPerVendor: 60,
    maxDeliveryContactsPerVendor: 60,
    enableIDeliver: true,
    maxDeliveryProviders: 999,
    allowVerifiedDeliveryProvider: true,
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
    enableStorefrontCart: true,
    enableWhatsappOrders: true,
    maxStorefrontImages: 500,
    maxStorefrontDeploymentsPerMonth: 20,
    isCahBoothAccessEnabled: true,
    isWhatsAppCustomerSupportEnabled: true,
    farmProducerShowcaseLevel: "full",
    cahFollowerTrackingLevel: "advanced",
    cahBoothSupportLevel: "priority",
    isRpnOnboardingPdfEnabled: true,
    trialDays: 7,
    features: [
      "Advanced BI",
      "Advanced RPN follow-up",
      "Hosted Catalogue Placeholder",
      "iDeliver / Verified Delivery Provider",
    ],
    status: "active",
    createdBy: "system",
    updatedBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const normalizePlan = (plan: PricingPlan): PricingPlan => ({
  ...plan,
  maxImagesPerListing:
    Number(plan.maxImagesPerListing ?? plan.maxImagesPerProduct) ||
    (/property agent|real estate|vehicle agent|vehicle dealer|car sales/i.test(
      [plan.id, plan.name, ...(plan.features || [])].join(" "),
    )
      ? 6
      : 1),
  maxImagesPerProduct:
    Number(plan.maxImagesPerProduct ?? plan.maxImagesPerListing) ||
    (/property agent|real estate|vehicle agent|vehicle dealer|car sales/i.test(
      [plan.id, plan.name, ...(plan.features || [])].join(" "),
    )
      ? 6
      : 1),
  enableIDeliver: plan.enableIDeliver !== false,
  maxDeliveryProviders:
    plan.maxDeliveryProviders ?? plan.maxDeliveryContactsPerVendor ?? 1,
  maxNoticesPerMonth:
    plan.maxNoticesPerMonth ??
    (plan.id === "pro" ? 20 : plan.id === "growth" ? 5 : 0),
  enableBrandedProducts: !!plan.enableBrandedProducts,
  brandedProductsIncluded: plan.brandedProductsIncluded ?? 0,
  brandedProductAddOnEnabled: plan.brandedProductAddOnEnabled !== false,
  brandedProductAddOnPrice: Number(plan.brandedProductAddOnPrice) || 5,
  brandedProductAddOnQuantity: Number(plan.brandedProductAddOnQuantity) || 50,
  maxBrandedProducts: plan.maxBrandedProducts ?? "unlimited",
  monthlyPrice:
    plan.id === "starter"
      ? 20
      : plan.id === "growth"
        ? 32
        : plan.id === "pro"
          ? 50
          : plan.monthlyPrice,
  allowVerifiedDeliveryProvider: plan.allowVerifiedDeliveryProvider !== false,
  enableStorefrontCart:
    plan.enableStorefrontCart ??
    (plan.isVendorStorefrontEnabled &&
      plan.isVendorStorefrontWhatsAppButtonEnabled !== false),
  enableWhatsappOrders:
    plan.enableWhatsappOrders ??
    (plan.isVendorStorefrontEnabled &&
      plan.isVendorStorefrontWhatsAppButtonEnabled !== false),
  features: Array.from(
    new Set([
      ...asArray<string>(plan.features),
      "iDeliver / Verified Delivery Provider",
    ]),
  ),
});

export const pricingPlanService = {
  getPlans: async (): Promise<PricingPlan[]> => {
    return dataCacheService.getOrFetch("pricing-plans", CACHE_TTL.PRICING_PLANS, async () => {
    try {
      const data =
        await getStorageAdapter().getItem<PricingPlan[]>(STORAGE_KEY);
      readDiagnosticsService.track("pricingPlanService", STORAGE_KEY, "getPlans", Array.isArray(data) ? data.length : 0);
      if (!data) {
        await getStorageAdapter().setItem(STORAGE_KEY, DEFAULT_PLANS);
        return DEFAULT_PLANS;
      }
      return asArray<PricingPlan>(data).map(normalizePlan);
    } catch (error) {
      console.warn("Firebase Error: Failed to get pricing plans", error);
      return [];
    }
    });
  },

  getActive: async (): Promise<PricingPlan[]> => {
    const plans = await pricingPlanService.getPlans();
    return plans.filter((plan) => plan.status === "active");
  },

  getPlan: async (id: string): Promise<PricingPlan | undefined> => {
    const plans = await pricingPlanService.getPlans();
    return plans.find((p) => p.id === id);
  },

  savePlan: async (plan: PricingPlan): Promise<void> => {
    const plans = await pricingPlanService.getPlans();
    const index = plans.findIndex((p) => p.id === plan.id);
    const planToSave = normalizePlan(plan);

    if (index >= 0) {
      plans[index] = { ...planToSave, updatedAt: new Date().toISOString() };
    } else {
      plans.push({
        ...planToSave,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await getStorageAdapter().setItem(STORAGE_KEY, plans);
    dataCacheService.clearCache("pricing-plans");
  },

  deletePlan: async (id: string): Promise<void> => {
    const plans = (await pricingPlanService.getPlans()).filter(
      (p) => p.id !== id,
    );
    await getStorageAdapter().setItem(STORAGE_KEY, plans);
    dataCacheService.clearCache("pricing-plans");
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
      dataCacheService.clearCache("pricing-plans");
    }
  },
};
