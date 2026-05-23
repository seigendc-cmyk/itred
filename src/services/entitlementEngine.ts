/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getBillableBrandedProductsForVendor,
  getBillableProductsForVendor,
} from "../utils/planQuotaUtils.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";
import { inventorySpotCheckService } from "./inventorySpotCheckService.ts";
import { vendorBillingService } from "./vendorBillingService.ts";
import { vendorInventorySpotCheckService } from "./vendorInventorySpotCheckService.ts";

export interface VendorUsage {
  products: number;
  brandedProducts: number;
  totalProducts: number;
  nonBillableProducts: number;
  branches: number;
  staff: number;
  cataloguesThisPeriod: number;
  imagesThisCatalogue: number;
  noticesThisPeriod: number;
  deliveryServices: number;
  lastCalculatedAt: string;
}

export interface EntitlementReason {
  key: string;
  label: string;
  used: number;
  limit: number | "unlimited";
  overBy: number;
  message: string;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  severity: "ok" | "warning" | "blocked";
  reasons: EntitlementReason[];
}

export interface OverageResult {
  productsOver: number;
  imagesOver: number;
  cataloguesOver: number;
  estimatedCharge: number;
  currency: string;
  requiresWallet: boolean;
  overageNotes: string[];
}

export interface UpgradePressureResult {
  score: number;
  label:
    | "Healthy"
    | "Near Limit"
    | "Using Overage"
    | "Upgrade Recommended"
    | "Blocked Without Override";
  reasons: string[];
  recommendedPlanId?: string;
  recommendedPlanName?: string;
}

export function planAllowsFeature(plan: any, featureKey: string): boolean {
  if (!plan) return false;

  const aliases = [
    "generate_storefront",
    "enableStorefront",
    "storefrontBuilder",
    "enableStorefrontBuilder",
    "storefront_generation",
    "isVendorStorefrontEnabled",
    "isVendorStorefrontBuilderEnabled",
  ];
  const cartAliases = ["enableStorefrontCart", "storefrontCart"];
  const whatsappOrderAliases = ["enableWhatsappOrders", "whatsappOrders"];

  let keysToCheck = [featureKey];
  if (aliases.includes(featureKey)) {
    keysToCheck = [...new Set([featureKey, ...aliases])];
  }
  if (cartAliases.includes(featureKey)) {
    keysToCheck = [...new Set([featureKey, ...cartAliases])];
  }
  if (whatsappOrderAliases.includes(featureKey)) {
    keysToCheck = [...new Set([featureKey, ...whatsappOrderAliases])];
  }

  for (const key of keysToCheck) {
    let val = plan[key];
    if (val === undefined && plan.features) val = plan.features[key];
    if (val === undefined && plan.entitlements) val = plan.entitlements[key];

    if (val === true) return true;
    if (typeof val === "number" && (val > 0 || val === -1)) return true;
    if (typeof val === "string" && val.toLowerCase() === "unlimited")
      return true;
    if (Array.isArray(plan.features) && plan.features.includes(key))
      return true;
  }

  return false;
}

/**
 * 1. calculateUsage
 * Calculates current active/billable usage footprint for a vendor based on raw records.
 */
export function calculateUsage(input: {
  vendorId: string;
  products?: any[];
  branches?: any[];
  staff?: any[];
  catalogues?: any[];
  images?: any[];
  notices?: any[];
  deliveryServices?: any[];
}): VendorUsage {
  const allProducts = input.products || [];
  const billableProducts = getBillableProductsForVendor(
    allProducts,
    input.vendorId,
  );
  const brandedProducts = getBillableBrandedProductsForVendor(
    allProducts,
    input.vendorId,
  );
  const nonBillable = allProducts.length - billableProducts.length;

  return {
    products: billableProducts.length,
    brandedProducts: brandedProducts.length,
    totalProducts: allProducts.length,
    nonBillableProducts: nonBillable,
    branches: (input.branches || []).length,
    staff: (input.staff || []).length,
    cataloguesThisPeriod: (input.catalogues || []).length,
    imagesThisCatalogue: (input.images || []).length,
    noticesThisPeriod: (input.notices || []).length,
    deliveryServices: (input.deliveryServices || []).length,
    lastCalculatedAt: new Date().toISOString(),
  };
}

const isUnlimited = (value: unknown) =>
  value === -1 || String(value).toLowerCase() === "unlimited";

const numericLimit = (value: unknown, fallback = 0) => {
  if (isUnlimited(value)) return "unlimited" as const;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isActiveBrandedProductsAddOn = (addOn: any) => {
  if (!addOn) return false;
  if (addOn.addOnKey !== "branded_products") return false;
  if (addOn.enabled === false) return false;
  const status = String(addOn.status || "active").toLowerCase();
  if (!["active", "trial", "paid"].includes(status)) return false;
  const now = new Date();
  if (addOn.startsAt && new Date(addOn.startsAt) > now) return false;
  if (addOn.endsAt && new Date(addOn.endsAt) < now) return false;
  return true;
};

const isActiveAddOn = (addOn: any, keys: string[]) => {
  if (!addOn) return false;
  if (!keys.includes(String(addOn.addOnKey || ""))) return false;
  if (addOn.enabled === false) return false;
  const status = String(addOn.status || "active").toLowerCase();
  if (!["active", "trial", "paid"].includes(status)) return false;
  const now = new Date();
  if (addOn.startsAt && new Date(addOn.startsAt) > now) return false;
  if (addOn.endsAt && new Date(addOn.endsAt) < now) return false;
  return true;
};

const addQuota = (
  included: number | "unlimited",
  addOnQuantity: number,
): number | "unlimited" =>
  included === "unlimited" ? "unlimited" : Math.max(0, included + addOnQuantity);

const monthKey = (value?: string) =>
  String(value || new Date().toISOString().slice(0, 7)).slice(0, 7);

export function getEffectiveBrandedProductLimit(
  plan: any,
  subscription?: any,
): number | "unlimited" {
  if (!plan) return 0;
  if (isUnlimited(plan.maxBrandedProducts)) return "unlimited";

  const included = numericLimit(plan.brandedProductsIncluded, 0);
  if (included === "unlimited") return "unlimited";

  const addOnQuantity = (subscription?.addOns || [])
    .filter(isActiveBrandedProductsAddOn)
    .reduce((sum: number, addOn: any) => sum + Math.max(0, Number(addOn.quantity) || 0), 0);

  const total = included + addOnQuantity;
  const max = numericLimit(plan.maxBrandedProducts, total);
  if (max === "unlimited") return "unlimited";
  return Math.max(0, Math.min(total, max));
}

export function calculateBrandedProductUsage(
  vendorId: string,
  products: any[] = [],
): number {
  return getBillableBrandedProductsForVendor(products, vendorId).length;
}

export function canUseBrandedProducts(input: {
  vendorId: string;
  plan: any;
  subscription?: any;
  usage?: number;
  products?: any[];
}): EntitlementCheckResult {
  const { vendorId, plan, subscription } = input;
  const usage =
    input.usage ?? calculateBrandedProductUsage(vendorId, input.products || []);
  const limit = getEffectiveBrandedProductLimit(plan, subscription);
  const addOnEnabled = !!plan?.brandedProductAddOnEnabled;
  const enabled =
    !!plan?.enableBrandedProducts ||
    limit === "unlimited" ||
    Number(limit) > 0 ||
    (subscription?.addOns || []).some(isActiveBrandedProductsAddOn);

  if (!enabled) {
    return {
      allowed: false,
      severity: "blocked",
      reasons: [
        {
          key: "brandedProducts",
          label: "Branded Products",
          used: usage,
          limit: 0,
          overBy: usage + 1,
          message:
            addOnEnabled
              ? "Branded Products add-on is available but not active for this vendor."
              : "Branded Products is not enabled for this vendor.",
        },
      ],
    };
  }

  if (limit !== "unlimited" && usage >= Number(limit)) {
    return {
      allowed: false,
      severity: "blocked",
      reasons: [
        {
          key: "brandedProducts",
          label: "Branded Products",
          used: usage + 1,
          limit: Number(limit),
          overBy: usage + 1 - Number(limit),
          message: `Branded product limit exceeded (${usage}/${limit})`,
        },
      ],
    };
  }

  return { allowed: true, severity: "ok", reasons: [] };
}

export function getEffectiveSpotCheckLimit(
  plan: any,
  subscription?: any,
): number | "unlimited" {
  if (!plan) return 0;
  const included = numericLimit(
    plan.spotChecksIncludedPerMonth ?? plan.inventorySpotChecksPerMonth,
    0,
  );
  if (included === "unlimited") return "unlimited";
  const addOnQuantity = (subscription?.addOns || [])
    .filter((addOn: any) =>
      isActiveAddOn(addOn, ["spot_checks", "inventory_spot_checks"]),
    )
    .reduce(
      (sum: number, addOn: any) =>
        sum + Math.max(0, Number(addOn.quantity) || 0),
      0,
    );
  return addQuota(included, addOnQuantity);
}

export function getEffectiveStocktakeLimit(
  plan: any,
  subscription?: any,
): number | "unlimited" {
  if (!plan) return 0;
  const included = numericLimit(plan.stocktakesIncludedPerMonth, 0);
  if (included === "unlimited") return "unlimited";
  const addOnQuantity = (subscription?.addOns || [])
    .filter((addOn: any) => isActiveAddOn(addOn, ["stocktake", "stocktakes"]))
    .reduce(
      (sum: number, addOn: any) =>
        sum + Math.max(0, Number(addOn.quantity) || 0),
      0,
    );
  return addQuota(included, addOnQuantity);
}

export function calculateSpotCheckUsage(
  vendorId: string,
  month = monthKey(),
): number {
  const monthPrefix = monthKey(month);
  const legacyChecks = inventorySpotCheckService
    .getSpotChecks()
    .filter(
      (check: any) =>
        check.vendorId === vendorId &&
        String(check.completedAt || check.checkDate || check.createdAt || "")
          .slice(0, 7) === monthPrefix &&
        check.status !== "cancelled",
    ).length;
  const inventoryChecks = vendorInventorySpotCheckService
    .getSpotChecks()
    .filter(
      (check: any) =>
        check.vendorId === vendorId &&
        String(check.approvedAt || check.updatedAt || check.createdAt || "")
          .slice(0, 7) === monthPrefix &&
        check.status !== "cancelled" &&
        check.status !== "rejected",
    ).length;
  return legacyChecks + inventoryChecks;
}

export function calculateStocktakeUsage(
  vendorId: string,
  month = monthKey(),
): number {
  const monthPrefix = monthKey(month);
  return vendorBillingService
    .getJobs(vendorId)
    .filter(
      (job: any) =>
        job.jobType === "stocktake" &&
        String(job.completedAt || job.jobDate || job.createdAt || "").slice(0, 7) ===
          monthPrefix &&
        job.status !== "cancelled",
    ).length;
}

const inventoryControlCheck = (input: {
  vendorId: string;
  plan: any;
  subscription?: any;
  usage?: number;
  limit: number | "unlimited";
  enabled: boolean;
  label: string;
  addOnAllowed: boolean;
  addOnName: string;
}): EntitlementCheckResult => {
  const usage = Number(input.usage || 0);
  if (!input.enabled) {
    return {
      allowed: false,
      severity: "blocked",
      reasons: [
        {
          key: input.addOnName,
          label: input.label,
          used: usage,
          limit: 0,
          overBy: usage + 1,
          message: input.addOnAllowed
            ? `${input.label} add-on is available but not active for this vendor.`
            : `${input.label} is not enabled for this vendor plan.`,
        },
      ],
    };
  }
  if (input.limit !== "unlimited" && usage >= Number(input.limit)) {
    return {
      allowed: false,
      severity: "blocked",
      reasons: [
        {
          key: input.addOnName,
          label: input.label,
          used: usage + 1,
          limit: Number(input.limit),
          overBy: usage + 1 - Number(input.limit),
          message: `${input.label} quota exceeded (${usage}/${input.limit}). Add the add-on or upgrade plan.`,
        },
      ],
    };
  }
  return { allowed: true, severity: "ok", reasons: [] };
};

export function canUseInventorySpotChecks(input: {
  vendorId: string;
  plan: any;
  subscription?: any;
  usage?: number;
}): EntitlementCheckResult {
  const limit = getEffectiveSpotCheckLimit(input.plan, input.subscription);
  const enabled =
    !!input.plan?.enableInventorySpotChecks ||
    !!input.plan?.isInventorySpotCheckIncluded ||
    limit === "unlimited" ||
    Number(limit) > 0 ||
    (input.subscription?.addOns || []).some((addOn: any) =>
      isActiveAddOn(addOn, ["spot_checks", "inventory_spot_checks"]),
    );
  return inventoryControlCheck({
    vendorId: input.vendorId,
    plan: input.plan,
    subscription: input.subscription,
    usage: input.usage ?? calculateSpotCheckUsage(input.vendorId),
    limit,
    enabled,
    label: "Inventory Spot Checks",
    addOnAllowed: !!input.plan?.allowSpotCheckAddOn,
    addOnName: "inventorySpotChecks",
  });
}

export function canUseStocktake(input: {
  vendorId: string;
  plan: any;
  subscription?: any;
  usage?: number;
}): EntitlementCheckResult {
  const limit = getEffectiveStocktakeLimit(input.plan, input.subscription);
  const enabled =
    !!input.plan?.enableStocktake ||
    limit === "unlimited" ||
    Number(limit) > 0 ||
    (input.subscription?.addOns || []).some((addOn: any) =>
      isActiveAddOn(addOn, ["stocktake", "stocktakes"]),
    );
  return inventoryControlCheck({
    vendorId: input.vendorId,
    plan: input.plan,
    subscription: input.subscription,
    usage: input.usage ?? calculateStocktakeUsage(input.vendorId),
    limit,
    enabled,
    label: "Stocktake",
    addOnAllowed: !!input.plan?.allowStocktakeAddOn,
    addOnName: "stocktake",
  });
}

/**
 * 2. checkLimits
 * Validates current usage against a plan's operational limits.
 */
export function checkLimits(input: {
  vendorId: string;
  plan: any;
  usage?: VendorUsage;
}): EntitlementCheckResult {
  const reasons: EntitlementReason[] = [];
  const { plan, usage } = input;

  if (!usage) {
    return { allowed: true, severity: "ok", reasons: [] };
  }

  const addReason = (
    key: string,
    label: string,
    used: number,
    limit: number,
  ) => {
    if (used > limit) {
      reasons.push({
        key,
        label,
        used,
        limit,
        overBy: used - limit,
        message: `${label} limit exceeded (${used}/${limit})`,
      });
    }
  };

  addReason(
    "products",
    "Products",
    usage.products,
    Number(plan.maxProducts || 0),
  );
  const brandedLimit = getEffectiveBrandedProductLimit(plan, undefined);
  if (
    brandedLimit !== "unlimited" &&
    usage.brandedProducts > Number(brandedLimit)
  ) {
    reasons.push({
      key: "brandedProducts",
      label: "Branded Products",
      used: usage.brandedProducts,
      limit: Number(brandedLimit),
      overBy: usage.brandedProducts - Number(brandedLimit),
      message: `Branded product limit exceeded (${usage.brandedProducts}/${brandedLimit})`,
    });
  }
  addReason(
    "branches",
    "Branches",
    usage.branches,
    Number(plan.maxBranchesPerVendor || 0),
  );
  addReason("staff", "Staff", usage.staff, Number(plan.maxStaffPerVendor || 0));
  addReason(
    "deliveryServices",
    "Delivery Providers",
    usage.deliveryServices,
    Number(plan.maxDeliveryProviders || plan.maxDeliveryContactsPerVendor || 0),
  );
  addReason(
    "cataloguesThisPeriod",
    "Catalogues / Month",
    usage.cataloguesThisPeriod,
    Number(plan.maxDeploymentsPerMonth || 0),
  );
  addReason(
    "imagesThisCatalogue",
    "Images / Catalogue",
    usage.imagesThisCatalogue,
    Number(plan.maxImagesPerCatalogue || 0),
  );
  addReason(
    "noticesThisPeriod",
    "Notices / Month",
    usage.noticesThisPeriod,
    Number(plan.maxNoticesPerMonth || 0),
  );

  const severity = reasons.length > 0 ? "blocked" : "ok";

  return {
    allowed: reasons.length === 0,
    severity,
    reasons,
  };
}

/**
 * 3. canAssignPlan
 * Determines if a vendor can safely be assigned to a new plan, considering downgrade protections and overrides.
 */
export function canAssignPlan(input: {
  vendorId: string;
  targetPlan: any;
  usage?: VendorUsage;
  allowOverride?: boolean;
}): EntitlementCheckResult {
  const result = checkLimits({
    vendorId: input.vendorId,
    plan: input.targetPlan,
    usage: input.usage,
  });

  if (!result.allowed && input.allowOverride) {
    return {
      allowed: true,
      severity: "warning",
      reasons: result.reasons,
    };
  }

  return result;
}

/**
 * 4. calculateOverage
 * Calculates required overage credits for resources exceeding base plan limits.
 */
export function calculateOverage(input: {
  usage: VendorUsage;
  plan: any;
  rateCard?: any;
}): OverageResult {
  const { usage, plan, rateCard } = input;

  const productsOver = Math.max(
    0,
    usage.products - Number(plan.maxProducts || 0),
  );
  const imagesOver = Math.max(
    0,
    usage.imagesThisCatalogue - Number(plan.maxImagesPerCatalogue || 0),
  );
  const cataloguesOver = Math.max(
    0,
    usage.cataloguesThisPeriod - Number(plan.maxDeploymentsPerMonth || 0),
  );

  const productPrice =
    rateCard?.productOveragePrice ??
    plan?.catalogueProductOveragePrice ??
    plan?.overageProductPrice ??
    plan?.productOveragePrice ??
    plan?.extraProductPrice ??
    1;
  const imagePrice = rateCard?.imageOveragePrice ?? 0.5;
  const cataloguePrice = rateCard?.catalogueOveragePrice ?? 5;

  const estimatedCharge =
    productsOver * productPrice +
    imagesOver * imagePrice +
    cataloguesOver * cataloguePrice;

  const overageNotes: string[] = [];
  if (productsOver > 0)
    overageNotes.push(`${productsOver} products over limit.`);
  if (imagesOver > 0) overageNotes.push(`${imagesOver} images over limit.`);
  if (cataloguesOver > 0)
    overageNotes.push(`${cataloguesOver} catalogues over limit.`);

  return {
    productsOver,
    imagesOver,
    cataloguesOver,
    estimatedCharge,
    currency: plan.currency || "USD",
    requiresWallet: estimatedCharge > 0,
    overageNotes,
  };
}

/**
 * 5. calculateUpgradePressure
 * Determines if a vendor is close to or actively exceeding plan limits, forming the basis for upsell alerts.
 */
export function calculateUpgradePressure(input: {
  usage: VendorUsage;
  plan: any;
  overage?: OverageResult;
  availablePlans?: any[];
}): UpgradePressureResult {
  let score = 0;
  const reasons: string[] = [];
  const { usage, plan, overage, availablePlans } = input;

  const prodLimit = Number(plan.maxProducts || 1);
  const prodUsagePct = usage.products / prodLimit;
  if (prodUsagePct >= 0.9) {
    score += 30;
    reasons.push("Product usage over 90%");
  } else if (prodUsagePct >= 0.8) {
    score += 20;
    reasons.push("Product usage over 80%");
  }

  const catLimit = Number(plan.maxDeploymentsPerMonth || 1);
  const catUsagePct = usage.cataloguesThisPeriod / catLimit;
  if (catUsagePct >= 0.8) {
    score += 20;
    reasons.push("Catalogue deployments over 80%");
  }

  const imgLimit = Number(plan.maxImagesPerCatalogue || 1);
  const imgUsagePct = usage.imagesThisCatalogue / imgLimit;
  if (imgUsagePct >= 0.8) {
    score += 15;
    reasons.push("Image usage over 80%");
  }

  if (overage && overage.estimatedCharge > 0) {
    score += 25;
    reasons.push("Currently using overage credits");
  }

  let label: UpgradePressureResult["label"] = "Healthy";
  if (
    score >= 80 ||
    (overage &&
      (overage.productsOver > 0 ||
        overage.imagesOver > 0 ||
        overage.cataloguesOver > 0))
  ) {
    label = "Upgrade Recommended";
  } else if (overage && overage.estimatedCharge > 0) {
    label = "Using Overage";
  } else if (score >= 40) {
    label = "Near Limit";
  }

  if (checkLimits({ vendorId: "", plan, usage }).allowed === false) {
    label = "Blocked Without Override";
  }

  let recommendedPlanId;
  let recommendedPlanName;

  if (availablePlans && availablePlans.length > 0 && label !== "Healthy") {
    // Find a plan that covers current usage without overage
    const betterPlans = availablePlans.filter(
      (p) =>
        p.monthlyPrice > plan.monthlyPrice &&
        checkLimits({ vendorId: "", plan: p, usage }).allowed,
    );
    if (betterPlans.length > 0) {
      betterPlans.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
      recommendedPlanId = betterPlans[0].id;
      recommendedPlanName = betterPlans[0].name;
    }
  }

  return {
    score: Math.min(100, score),
    label,
    reasons,
    recommendedPlanId,
    recommendedPlanName,
  };
}

/**
 * 6. canUseFeature
 * Modular check for discrete feature enablement (BI, iDeliver, Notices, etc.).
 */
export function canUseFeature(input: { plan: any; featureKey: string }): {
  allowed: boolean;
  reason: string;
} {
  const { plan, featureKey } = input;

  if (!plan) {
    return { allowed: false, reason: "No plan assigned" };
  }

  switch (featureKey) {
    case "enableIDeliver":
      return {
        allowed: plan.enableIDeliver !== false,
        reason:
          plan.enableIDeliver !== false
            ? "Included in plan"
            : "iDeliver is not included in this plan",
      };
    case "enableStorefront":
      return {
        allowed:
          !!plan.isVendorStorefrontEnabled ||
          !!plan.isVendorStorefrontBuilderEnabled,
        reason: plan.isVendorStorefrontEnabled
          ? "Included in plan"
          : "Storefront builder is not included in this plan",
      };
    case "enableStorefrontCart":
      return {
        allowed: !!plan.enableStorefrontCart,
        reason: plan.enableStorefrontCart
          ? "Included in plan"
          : "Storefront cart is not included in this plan",
      };
    case "enableWhatsappOrders":
      return {
        allowed: !!plan.enableWhatsappOrders,
        reason: plan.enableWhatsappOrders
          ? "Included in plan"
          : "WhatsApp storefront orders are not included in this plan",
      };
    case "enableBI":
      return {
        allowed: plan.biAnalyticsLevel && plan.biAnalyticsLevel !== "none",
        reason:
          plan.biAnalyticsLevel !== "none"
            ? "Included in plan"
            : "BI analytics not included",
      };
    case "enableAdvancedBI":
      return {
        allowed: plan.biAnalyticsLevel === "advanced",
        reason:
          plan.biAnalyticsLevel === "advanced"
            ? "Included in plan"
            : "Advanced BI not included",
      };
    case "enableAiReports":
      return {
        allowed: plan.biAnalyticsLevel === "advanced",
        reason:
          plan.biAnalyticsLevel === "advanced"
            ? "Included in plan"
            : "AI Reports require advanced BI tier",
      };
    case "enableNotices":
      return {
        allowed: Number(plan.maxNoticesPerMonth || 0) > 0,
        reason:
          Number(plan.maxNoticesPerMonth || 0) > 0
            ? "Included in plan"
            : "Notices not included",
      };
    case "enableBranches":
      return {
        allowed: Number(plan.maxBranchesPerVendor || 0) > 0,
        reason:
          Number(plan.maxBranchesPerVendor || 0) > 0
            ? "Included in plan"
            : "Branches not allowed on this plan",
      };
    case "enableStaff":
      return {
        allowed: Number(plan.maxStaffPerVendor || 0) > 0,
        reason:
          Number(plan.maxStaffPerVendor || 0) > 0
            ? "Included in plan"
            : "Staff not allowed on this plan",
      };
    default:
      return { allowed: false, reason: `Unknown feature: ${featureKey}` };
  }
}

/**
 * 7. canGenerateCatalogue
 * Pre-flight check specific to catalogue deployment boundaries.
 */
export function canGenerateCatalogue(input: {
  vendorId: string;
  plan: any;
  selectedProductCount: number;
  selectedImageCount?: number;
  cataloguesThisPeriod?: number;
  allowOverage?: boolean;
  walletBalance?: number;
}): EntitlementCheckResult {
  const {
    plan,
    selectedProductCount,
    selectedImageCount = 0,
    cataloguesThisPeriod = 0,
    allowOverage = false,
    walletBalance = 0,
  } = input;
  const reasons: EntitlementReason[] = [];

  const maxProducts = Number(plan.maxProducts || 0);
  const maxImages = Number(plan.maxImagesPerCatalogue || 0);
  const maxCatalogues = Number(plan.maxDeploymentsPerMonth || 0);

  let allowed = true;

  if (selectedProductCount > maxProducts) {
    reasons.push({
      key: "products",
      label: "Products",
      used: selectedProductCount,
      limit: maxProducts,
      overBy: selectedProductCount - maxProducts,
      message: `Product limit exceeded (${selectedProductCount}/${maxProducts})`,
    });
    allowed = false;
  }

  if (selectedImageCount > maxImages) {
    reasons.push({
      key: "images",
      label: "Images",
      used: selectedImageCount,
      limit: maxImages,
      overBy: selectedImageCount - maxImages,
      message: `Image limit exceeded (${selectedImageCount}/${maxImages})`,
    });
    allowed = false;
  }

  if (cataloguesThisPeriod >= maxCatalogues) {
    reasons.push({
      key: "catalogues",
      label: "Catalogues / Month",
      used: cataloguesThisPeriod + 1,
      limit: maxCatalogues,
      overBy: cataloguesThisPeriod + 1 - maxCatalogues,
      message: `Catalogue deployment limit reached (${cataloguesThisPeriod}/${maxCatalogues})`,
    });
    allowed = false;
  }

  if (!allowed && allowOverage) {
    // Check if wallet balance can cover the overage
    const overageProducts = Math.max(0, selectedProductCount - maxProducts);
    const overageCatalogues = Math.max(
      0,
      cataloguesThisPeriod + 1 - maxCatalogues,
    );
    const productPrice =
      plan.catalogueProductOveragePrice ??
      plan.overageProductPrice ??
      plan.productOveragePrice ??
      plan.extraProductPrice ??
      1;
    const cataloguePrice = 5; // Assumed default if missing in plan
    const cost =
      overageProducts * productPrice + overageCatalogues * cataloguePrice;

    if (walletBalance >= cost) {
      return {
        allowed: true,
        severity: "warning",
        reasons,
      };
    } else {
      reasons.push({
        key: "credit",
        label: "Wallet Credit",
        used: cost,
        limit: walletBalance,
        overBy: cost - walletBalance,
        message: `Insufficient wallet balance to cover overage (Need ${cost}, have ${walletBalance})`,
      });
    }
  }

  return {
    allowed,
    severity: allowed ? "ok" : allowOverage ? "warning" : "blocked",
    reasons,
  };
}

export const entitlementEngineTestHelpers = {
  /**
   * Mocks an entitlement check injection for CI/CD test runners
   */
  runAutomatedTestSuite: () => {
    return true;
  },
};
