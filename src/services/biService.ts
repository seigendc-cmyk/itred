/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BIReport,
  Vendor,
  Product,
  CAHLink,
  CatalogueGeneration,
} from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { vendorService } from "./vendorService.ts";
import { productService } from "./productService.ts";
import { rpnService } from "./rpnService.ts";
import { catalogueService } from "./catalogueService.ts";
import { cahService } from "./cahService.ts";
import { analyticsService } from "./analyticsService.ts";

const BI_REPORTS_KEY = "itred_bi_reports";

export interface SectorInsight {
  sector: string;
  vendorCount: number;
  productCount: number;
  readinessScore: number;
  isReady: boolean;
  issues: string[];
}

export interface VendorInsight {
  vendorId: string;
  name: string;
  score: number;
  issues: string[];
  recommendations: string[];
}

export interface MarketInsights {
  summary: any;
  sectors: string[];
  riskSectors: string[];
  topSectors: [string, number][];
  topLocations: [string, number][];
  vendorsWithPoorImages: Vendor[];
  overdueSubs: Vendor[];
  missingPrice: Product[];
  missingImage: Product[];
  hiddenAvailable: Product[];
  stockOutPublished: Product[];
  sectorsWithoutCah: string[];
  whatsappHits?: number;
  catalogueViews?: number;
  productViews?: number;
  leadsCreated?: number;
  activeVendors?: number;
  activeProducts?: number;
  rpnCount?: number;
  eventCount?: number;
}

const normalizeArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as T[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const obj = value as Record<string, unknown>;

  if (Array.isArray(obj.data)) {
    return obj.data.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.items)) {
    return obj.items.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.docs)) {
    return obj.docs.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.results)) {
    return obj.results.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.records)) {
    return obj.records.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.vendors)) {
    return obj.vendors.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.products)) {
    return obj.products.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.events)) {
    return obj.events.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.activityLogs)) {
    return obj.activityLogs.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.catalogueHistory)) {
    return obj.catalogueHistory.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.cahLinks)) {
    return obj.cahLinks.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.rpns)) {
    return obj.rpns.filter(Boolean) as T[];
  }

  return [];
};

const safeString = (value: unknown, fallback = "Unknown"): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
};

const safeNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getVendorId = (vendor: Partial<Vendor> | any): string => {
  return safeString(vendor?.id || vendor?.vendorId || vendor?.uid, "");
};

const getProductVendorId = (product: Partial<Product> | any): string => {
  return safeString(
    product?.vendorId || product?.vendor_id || product?.ownerUid,
    "",
  );
};

const getProductSector = (product: Partial<Product> | any): string => {
  return safeString(
    product?.sector || product?.category || product?.businessSector,
    "Unclassified",
  );
};

const getVendorSector = (vendor: Partial<Vendor> | any): string => {
  return safeString(
    vendor?.sector || vendor?.businessSector || vendor?.category,
    "Unclassified",
  );
};

const getSellingPrice = (product: Partial<Product> | any): number => {
  return safeNumber(
    product?.sellingPrice || product?.price || product?.unitPrice,
    0,
  );
};

const getStockQuantity = (product: Partial<Product> | any): number => {
  return safeNumber(
    product?.stockQuantity ||
      product?.stockQty ||
      product?.quantity ||
      product?.qty ||
      product?.stock,
    0,
  );
};

const isActiveProduct = (product: Partial<Product> | any): boolean => {
  const status = safeString(product?.status, "");
  return status === "active" || status === "published";
};

const getEventType = (event: any): string => {
  return safeString(event?.eventType || event?.type || event?.action, "");
};

export const biService = {
  getReports: (): BIReport[] => {
    const reports = getStorageAdapter().getItem<BIReport[]>(BI_REPORTS_KEY);
    return normalizeArray<BIReport>(reports);
  },

  calculateVendorReadiness: (
    vendorInput: Vendor,
    productsInput: Product[],
  ): VendorInsight => {
    const vendor = vendorInput || ({} as Vendor);
    const products = normalizeArray<Product>(productsInput);

    let score = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    const vendorId = getVendorId(vendor);
    const vendorProducts = products.filter(
      (p) => getProductVendorId(p) === vendorId,
    );
    const activeProducts = vendorProducts.filter((p) => isActiveProduct(p));

    if (vendor.name && vendor.tradingName && vendor.email && vendor.mainPhone) {
      score += 15;
    } else {
      issues.push("Profile incomplete");
      recommendations.push(
        "Complete business profile details (Owner, Email, Phone)",
      );
    }

    if (vendor.province && vendor.cityTown && vendor.streetAddress) {
      score += 10;
    } else {
      issues.push("Location incomplete");
      recommendations.push("Add full street address and city details");
    }

    if (vendor.assignedRPNId) {
      score += 10;
    } else {
      issues.push("No assigned RPN");
      recommendations.push("Assign an RPN for field data validation");
    }

    if (vendor.subscriptionStatus === "active") {
      score += 10;
    } else {
      issues.push(`Subscription is ${vendor.subscriptionStatus || "unknown"}`);
      recommendations.push(
        "Activate vendor subscription to enable all features",
      );
    }

    if (activeProducts.length >= 10) {
      score += 15;
    } else {
      issues.push("Low product count");
      recommendations.push(
        "Add at least 10 active products for a viable catalogue",
      );
    }

    const imageCount = activeProducts.filter((p) => !!p.imageUrl).length;
    const imageRatio =
      activeProducts.length > 0 ? imageCount / activeProducts.length : 0;

    if (imageRatio >= 0.8) {
      score += 15;
    } else {
      issues.push("Poor image coverage");
      recommendations.push("Upload images for at least 80% of active products");
    }

    const descCount = activeProducts.filter(
      (p) => !!p.description && String(p.description).length > 30,
    ).length;
    const descRatio =
      activeProducts.length > 0 ? descCount / activeProducts.length : 0;

    if (descRatio >= 0.8) {
      score += 10;
    } else {
      issues.push("Weak product descriptions");
      recommendations.push(
        "Improve descriptions for better customer discovery",
      );
    }

    const priceCount = activeProducts.filter(
      (p) => getSellingPrice(p) > 0,
    ).length;
    const priceRatio =
      activeProducts.length > 0 ? priceCount / activeProducts.length : 0;

    if (priceRatio >= 0.9) {
      score += 10;
    } else {
      issues.push("Missing pricing");
      recommendations.push("Ensure 90%+ products have valid selling prices");
    }

    const branches = normalizeArray<any>((vendor as any)?.branches);

    if ((vendor as any).whatsappNumber || branches.some((b) => b?.whatsapp)) {
      score += 5;
    } else {
      issues.push("No WhatsApp contact");
      recommendations.push(
        "Add a WhatsApp number for routing catalogue orders",
      );
    }

    const farmProduceProducts = vendorProducts.filter(
      (p: any) => p?.isFarmProduce,
    );

    if (farmProduceProducts.length > 0) {
      const missingAvailability = farmProduceProducts.filter(
        (p: any) => !p?.availabilityDate,
      ).length;

      if (missingAvailability === 0) {
        score += 5;
      } else {
        issues.push(
          `${missingAvailability} farm produce items missing availability dates`,
        );
        recommendations.push(
          "Set availability dates for all farm produce to help customers plan",
        );
      }

      const missingQuantities = farmProduceProducts.filter(
        (p: any) =>
          !p?.quantityAvailable || safeNumber(p?.quantityAvailable) <= 0,
      ).length;

      if (missingQuantities === 0) {
        score += 5;
      } else {
        issues.push(
          `${missingQuantities} farm produce items missing quantity information`,
        );
        recommendations.push(
          "Specify available quantities for accurate inventory management",
        );
      }

      const missingPackaging = farmProduceProducts.filter(
        (p: any) => !p?.packagingType,
      ).length;

      if (missingPackaging === 0) {
        score += 5;
      } else {
        issues.push(
          `${missingPackaging} farm produce items missing packaging details`,
        );
        recommendations.push(
          "Add packaging information for better customer expectations",
        );
      }

      const readyNowExpired = farmProduceProducts.filter((p: any) => {
        if (p?.harvestStatus !== "ready now") return false;
        if (!p?.availabilityDate) return true;

        const availDate = new Date(p.availabilityDate);
        const now = new Date();

        if (Number.isNaN(availDate.getTime())) return true;

        return availDate < now;
      }).length;

      if (readyNowExpired === 0) {
        score += 5;
      } else {
        issues.push(
          `${readyNowExpired} items marked 'ready now' but availability dates have expired`,
        );
        recommendations.push(
          "Update harvest status or availability dates for accurate product status",
        );
      }

      const upcomingHarvest = farmProduceProducts.filter((p: any) => {
        if (!p?.availabilityDate) return false;

        const availDate = new Date(p.availabilityDate);
        const now = new Date();

        if (Number.isNaN(availDate.getTime())) return false;

        const daysUntil =
          (availDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntil >= 0 && daysUntil <= 7;
      });

      if (upcomingHarvest.length > 0) {
        recommendations.push(
          `Fresh harvest approaching for ${upcomingHarvest.length} items - consider deploying updated catalogue`,
        );
      }
    }

    return {
      vendorId: vendorId || "unknown_vendor",
      name: safeString(vendor.name, "Unnamed Vendor"),
      score: Math.max(0, Math.min(100, score)),
      issues,
      recommendations,
    };
  },

  calculateSectorReadiness: (
    sectorInput: string,
    vendorsInput: Vendor[],
    productsInput: Product[],
    cahLinksInput: CAHLink[],
    catalogueHistoryInput: CatalogueGeneration[],
  ): SectorInsight => {
    const sector = safeString(sectorInput, "Unclassified");
    const vendors = normalizeArray<Vendor>(vendorsInput);
    const products = normalizeArray<Product>(productsInput);
    const cahLinks = normalizeArray<CAHLink>(cahLinksInput);
    const catalogueHistory = normalizeArray<CatalogueGeneration>(
      catalogueHistoryInput,
    );

    let score = 0;
    const issues: string[] = [];

    const sectorVendors = vendors.filter((v) => getVendorSector(v) === sector);
    const sectorProducts = products.filter(
      (p) => getProductSector(p) === sector && isActiveProduct(p),
    );

    const sectorCahLink = cahLinks.find(
      (l: any) => l?.sector === sector && l?.status === "active",
    );

    const recentGen = catalogueHistory.some((h: any) => {
      const genDate = new Date(h?.generatedAt);
      const now = new Date();

      if (Number.isNaN(genDate.getTime())) return false;

      return now.getTime() - genDate.getTime() < 7 * 24 * 60 * 60 * 1000;
    });

    if (sectorVendors.length >= 5) {
      score += 20;
    } else {
      issues.push(`Only ${sectorVendors.length} vendors (Need 5)`);
    }

    if (sectorProducts.length >= 100) {
      score += 20;
    } else {
      issues.push(`Only ${sectorProducts.length} products (Need 100)`);
    }

    const imageCount = sectorProducts.filter((p) => !!p.imageUrl).length;
    const imageRatio =
      sectorProducts.length > 0 ? imageCount / sectorProducts.length : 0;

    if (imageRatio >= 0.8) {
      score += 20;
    } else {
      issues.push("Poor sector image coverage");
    }

    const priceCount = sectorProducts.filter(
      (p) => getSellingPrice(p) > 0,
    ).length;
    const priceRatio =
      sectorProducts.length > 0 ? priceCount / sectorProducts.length : 0;

    if (priceRatio >= 0.9) {
      score += 15;
    } else {
      issues.push("Missing pricing in sector");
    }

    const locCount = sectorVendors.filter(
      (v) => v.province && v.cityTown,
    ).length;
    const locRatio =
      sectorVendors.length > 0 ? locCount / sectorVendors.length : 0;

    if (locRatio >= 0.8) {
      score += 10;
    } else {
      issues.push("Incomplete vendor locations");
    }

    if (sectorCahLink) {
      score += 10;
    } else {
      issues.push("No active CAH distribution link");
    }

    if (recentGen) {
      score += 5;
    } else {
      issues.push("No recent catalogue generation");
    }

    return {
      sector,
      vendorCount: sectorVendors.length,
      productCount: sectorProducts.length,
      readinessScore: Math.max(0, Math.min(100, score)),
      isReady: score >= 70,
      issues,
    };
  },

  getMarketInsights: (
    productsInput: unknown,
    vendorsInput: unknown,
    eventsInput: unknown,
    cahLinksInput?: unknown,
    catalogueHistoryInput?: unknown,
    rpnsInput?: unknown,
  ): MarketInsights => {
    const products = normalizeArray<any>(productsInput);
    const vendors = normalizeArray<any>(vendorsInput);
    const events = normalizeArray<any>(eventsInput);
    const cahLinks = normalizeArray<CAHLink>(cahLinksInput);
    const catalogueHistory = normalizeArray<CatalogueGeneration>(
      catalogueHistoryInput,
    );
    const rpns = normalizeArray<any>(rpnsInput);

    const activeProducts = products.filter((p) => isActiveProduct(p));

    const sectorStats: Record<string, number> = {};

    products.forEach((p) => {
      const sector = getProductSector(p);
      sectorStats[sector] = (sectorStats[sector] || 0) + 1;
    });

    const topSectors = Object.entries(sectorStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const locationStats: Record<string, number> = {};

    vendors.forEach((v) => {
      const vendorId = getVendorId(v);
      const prodCount = products.filter(
        (p) => getProductVendorId(p) === vendorId,
      ).length;
      const location = safeString(
        (v as any)?.cityTown || (v as any)?.city || (v as any)?.location,
        "Unknown",
      );

      locationStats[location] = (locationStats[location] || 0) + prodCount;
    });

    const topLocations = Object.entries(locationStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const vendorsWithPoorImages = vendors
      .filter((v) => {
        const vendorId = getVendorId(v);
        const vendorProducts = products.filter(
          (p) => getProductVendorId(p) === vendorId && isActiveProduct(p),
        );

        if (vendorProducts.length === 0) return false;

        const images = vendorProducts.filter((p) => !!p.imageUrl).length;
        return images / vendorProducts.length < 0.5;
      })
      .slice(0, 10);

    const overdueSubs = vendors.filter(
      (v) => safeString((v as any)?.subscriptionStatus, "") === "overdue",
    );

    const missingPrice = products.filter(
      (p) => isActiveProduct(p) && getSellingPrice(p) <= 0,
    );

    const missingImage = products.filter(
      (p) => isActiveProduct(p) && !p.imageUrl,
    );

    const hiddenAvailable = products.filter(
      (p: any) =>
        safeString(p?.status, "") === "hidden" && getStockQuantity(p) > 0,
    );

    const stockOutPublished = products.filter(
      (p: any) => p?.publishToCatalogue === true && getStockQuantity(p) <= 0,
    );

    const vendorSectors = vendors.map((v) => getVendorSector(v));
    const productSectors = products.map((p) => getProductSector(p));

    const sectors = [...new Set([...vendorSectors, ...productSectors])].filter(
      (s) => s && s !== "Unknown" && s !== "Unclassified",
    );

    const groupedCahs = cahLinks.filter(
      (l: any) =>
        safeString(l?.status, "") === "active" &&
        safeString(l?.type, "") === "Catalogue Distribution Group",
    );

    const cahSectors = groupedCahs.map((l: any) => safeString(l?.sector, ""));
    const sectorsWithoutCah = sectors.filter((s) => !cahSectors.includes(s));

    let whatsappHits = 0;
    let catalogueViews = 0;
    let productViews = 0;
    let leadsCreated = 0;

    events.forEach((event) => {
      const eventType = getEventType(event);

      if (
        eventType === "WHATSAPP_ENQUIRY_CLICKED" ||
        eventType === "WHATSAPP_CLICKED" ||
        eventType === "WHATSAPP_HIT" ||
        eventType === "itred_whatsapp_hit"
      ) {
        whatsappHits += 1;
      }

      if (
        eventType === "CATALOGUE_VIEWED" ||
        eventType === "CATALOGUE_VIEW" ||
        eventType === "itred_catalogue_viewed"
      ) {
        catalogueViews += 1;
      }

      if (
        eventType === "PRODUCT_VIEWED" ||
        eventType === "PRODUCT_VIEW" ||
        eventType === "itred_product_viewed"
      ) {
        productViews += 1;
      }

      if (
        eventType === "LEAD_CREATED" ||
        eventType === "WHATSAPP_LEAD_CREATED" ||
        eventType === "CUSTOMER_ENQUIRY_CREATED"
      ) {
        leadsCreated += 1;
      }
    });

    return {
      summary: {
        whatsappHits,
        catalogueViews,
        productViews,
        leadsCreated,
        activeVendors: vendors.length,
        activeProducts: activeProducts.length,
        rpnCount: rpns.length,
        eventCount: events.length,
      },
      sectors: sectors,
      riskSectors: sectorsWithoutCah,
      topSectors,
      topLocations,
      vendorsWithPoorImages,
      overdueSubs,
      missingPrice,
      missingImage,
      hiddenAvailable,
      stockOutPublished,
      sectorsWithoutCah,
      whatsappHits,
      catalogueViews,
      productViews,
      leadsCreated,
      activeVendors: vendors.length,
      activeProducts: activeProducts.length,
      rpnCount: rpns.length,
      eventCount: events.length,
    };
  },
};
