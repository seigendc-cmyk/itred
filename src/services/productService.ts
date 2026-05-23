/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MasterProduct,
  Product,
  ProductListItem,
  ProductStatus,
  Vendor,
  VendorProductOffer,
  VendorProductStockStatus,
} from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { asArray } from "../utils/safeData.ts";
import { analyticsService } from "./analyticsService.ts";
import { vendorReadinessService } from "./vendorReadinessService.ts";
import { settingsService } from "./settingsService.ts";
import { CACHE_TTL, dataCacheService } from "./dataCacheService.ts";
import { readDiagnosticsService } from "./readDiagnosticsService.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";
import {
  listingImageMetrics,
  normalizeListingImages,
} from "../utils/listingImageEntitlements.ts";

const LEGACY_PRODUCTS_KEY = "itred_products";
const MASTER_PRODUCTS_KEY = "itred_master_products";
const VENDOR_OFFERS_KEY = "itred_vendor_product_offers";
const MIGRATION_KEY = "itred_product_master_offer_migrated_v1";
const VENDORS_KEY = "itred_vendors";

const nowIso = () => new Date().toISOString();
const normalize = (value?: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const slug = (value?: string) => normalize(value).replace(/\s+/g, "-");

const searchableTextFor = (product: Partial<MasterProduct>) =>
  [
    product.productName,
    product.brand,
    product.category,
    product.sector,
    product.description,
    product.barcode,
    product.standardSku,
    ...(product.tags || []),
    ...(product.keywords || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const stockStatusFromQuantity = (
  quantity: number,
  legacyStatus?: ProductStatus,
): VendorProductStockStatus => {
  if (legacyStatus === "out_of_stock" || quantity <= 0) return "out_of_stock";
  if (quantity <= 5) return "low_stock";
  return "in_stock";
};

const canonicalMasterKey = (product: Partial<Product>) => {
  if (product.productCode) return `barcode:${normalize(product.productCode)}`;
  return [
    "name",
    slug(product.name),
    slug(product.brand),
    slug(product.category),
    slug(product.sector),
  ].join(":");
};

const makeMasterFromLegacy = (product: Product): MasterProduct => {
  const now = product.createdAt || nowIso();
  const productName = product.name || "Unnamed Product";
  const master: MasterProduct = {
    id: `MP-${canonicalMasterKey(product).replace(/[^a-z0-9-]/gi, "-").toUpperCase()}`.slice(
      0,
      80,
    ),
    productName,
    brand: product.brand || "",
    category: product.category || "",
    sector: product.sector || "",
    description: product.description || "",
    barcode: product.productCode || "",
    standardSku: product.sku || "",
    tags: product.tags || [],
    keywords: [
      product.model,
      product.unitOfMeasure,
      ...(product.tags || []),
    ].filter(Boolean) as string[],
    imageUrl: product.imageUrl,
    additionalImages: [],
    unit: product.unitOfMeasure || "Each",
    searchableText: "",
    status:
      product.status === "out_of_stock" ? "active" : product.status || "active",
    createdAt: now,
    updatedAt: product.updatedAt || now,
  };
  master.searchableText = searchableTextFor(master);
  return master;
};

const makeOfferFromLegacy = (product: Product): VendorProductOffer => ({
  id: product.offerId || `VPO-${product.id}`,
  vendorId: product.vendorId,
  productId: product.productId || makeMasterFromLegacy(product).id,
  branchId: product.branchId,
  sellingPrice: Number(product.sellingPrice) || 0,
  stockQuantity: Number(product.stockQuantity) || 0,
  stockStatus: stockStatusFromQuantity(
    Number(product.stockQuantity) || 0,
    product.status,
  ),
  vendorSku: product.sku || "",
  vendorProductImage: product.imageUrl,
  publishToCatalogue: product.publishToCatalogue !== false,
  deliveryAvailable: product.deliveryAvailable !== false,
  featured: false,
  notes: product.producerNotes || "",
  active: product.status !== "hidden" && product.status !== "discontinued",
  createdAt: product.createdAt || nowIso(),
  updatedAt: product.updatedAt || nowIso(),
});

const joinProduct = (
  master: MasterProduct,
  offer: VendorProductOffer,
  vendors: Vendor[],
): Product => {
  const vendor = vendors.find((v) => v.id === offer.vendorId);
  const branch = vendor?.branches?.find((b) => b.id === offer.branchId);
  const images = normalizeListingImages({
    ...master,
    ...offer,
    imageUrl: offer.vendorProductImage || master.imageUrl || "",
  }, 6);
  if (images.length > 6) {
    console.warn("Listing exceeded image limit, truncating to first 6 images.");
  }
  const imageUrl = images[0]?.url || offer.vendorProductImage || master.imageUrl || "";
  const metrics = listingImageMetrics({ ...master, ...offer, imageUrl, images }, 6);
  const stockQuantity = Number(offer.stockQuantity) || 0;
  const status: ProductStatus =
    !offer.active || master.status === "hidden"
      ? "hidden"
      : offer.stockStatus === "out_of_stock"
        ? "out_of_stock"
        : master.status || "active";

  return {
    id: offer.id,
    productMode: "linked_product",
    sourceType: "master_linked",
    masterProductId: master.id,
    brandOwnerVendorId: offer.vendorId,
    isVendorBranded: false,
    offerId: offer.id,
    productId: master.id,
    vendorId: offer.vendorId,
    vendorName: vendor?.tradingName || vendor?.name || "",
    branchId: offer.branchId || "",
    branchName: branch?.name || "",
    productName: master.productName,
    country: branch?.country || vendor?.country || "",
    province: branch?.province || vendor?.province || "",
    cityTown: branch?.cityTown || vendor?.cityTown || "",
    district: branch?.district || vendor?.district || "",
    suburb: branch?.suburb || vendor?.suburb || "",
    streetAddress: branch?.streetAddress || branch?.address || vendor?.streetAddress || "",
    sector: master.sector || vendor?.sector || "",
    category: master.category || "",
    name: master.productName,
    sku: offer.vendorSku || master.standardSku || "",
    productCode: master.barcode || "",
    brand: master.brand || "",
    model: "",
    description: master.description || "",
    tags: [...(master.tags || []), ...(master.keywords || [])],
    keywords: master.keywords || [],
    searchableText: master.searchableText || searchableTextFor(master),
    additionalImages: images.slice(1).map((image) => image.url),
    images,
    ...metrics,
    unitOfMeasure: master.unit || "Each",
    sellingPrice: Number(offer.discountPrice || offer.sellingPrice) || 0,
    oldPrice: offer.discountPrice ? offer.sellingPrice : undefined,
    stockQuantity,
    minStockAlert: 5,
    locationDisplayText:
      branch?.suburb ||
      branch?.address ||
      vendor?.suburb ||
      vendor?.cityTown ||
      "",
    imageUrl,
    imageStatus: imageUrl ? "uploaded" : "missing",
    source: "backend entered",
    enteredByStaffId: "",
    lastUpdatedBy: "",
    status,
    publishToCatalogue: offer.publishToCatalogue,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    deliveryAvailable: offer.deliveryAvailable,
    producerNotes: offer.notes,
  };
};

const joinBrandedProduct = (
  offer: VendorProductOffer,
  vendors: Vendor[],
): Product => {
  const vendor = vendors.find((v) => v.id === offer.vendorId);
  const branch = vendor?.branches?.find((b) => b.id === offer.branchId);
  const images = normalizeListingImages(
    {
      ...offer,
      imageUrl: offer.vendorProductImage || offer.brandLogoUrl || vendor?.logoUrl || "",
    },
    6,
  );
  if (images.length > 6) {
    console.warn("Listing exceeded image limit, truncating to first 6 images.");
  }
  const imageUrl = images[0]?.url || offer.vendorProductImage || offer.brandLogoUrl || vendor?.logoUrl || "";
  const metrics = listingImageMetrics({ ...offer, imageUrl, images }, 6);
  const stockQuantity = Number(offer.stockQuantity) || 0;
  const status: ProductStatus =
    !offer.active
      ? "hidden"
      : offer.stockStatus === "out_of_stock"
        ? "out_of_stock"
        : "active";
  const productName = offer.productName || "Unnamed branded product";
  const brandDisplayName =
    offer.brandDisplayName ||
    vendor?.catalogueDisplayName ||
    vendor?.tradingName ||
    vendor?.name ||
    "";

  return {
    id: offer.id,
    productMode: "branded_product",
    sourceType: "vendor_branded",
    masterProductId: null,
    brandOwnerVendorId: offer.brandOwnerVendorId || offer.vendorId,
    isVendorBranded: true,
    brandDisplayName,
    brandLogoUrl: offer.brandLogoUrl || vendor?.logoAssetUrl || vendor?.logoUrl || vendor?.businessLogoUrl || "",
    brandBannerUrl: offer.brandBannerUrl || vendor?.bannerAssetUrl || vendor?.bannerUrl || vendor?.businessBannerUrl || "",
    offerId: offer.id,
    productId: offer.id,
    vendorId: offer.vendorId,
    vendorName: vendor?.tradingName || vendor?.name || brandDisplayName,
    branchId: offer.branchId || "",
    branchName: branch?.name || "",
    productName,
    country: branch?.country || vendor?.country || "",
    province: branch?.province || vendor?.province || "",
    cityTown: branch?.cityTown || vendor?.cityTown || "",
    district: branch?.district || vendor?.district || "",
    suburb: branch?.suburb || vendor?.suburb || "",
    streetAddress: branch?.streetAddress || branch?.address || vendor?.streetAddress || "",
    sector: offer.sector || vendor?.sector || "",
    category: offer.category || vendor?.category || "",
    name: productName,
    sku: offer.vendorSku || offer.sku || "",
    productCode: offer.sku || offer.vendorSku || "",
    brand: brandDisplayName,
    model: "",
    description: offer.description || offer.notes || "",
    tags: [brandDisplayName, offer.category, offer.sector].filter(Boolean) as string[],
    keywords: [productName, brandDisplayName, offer.vendorSku].filter(Boolean) as string[],
    searchableText: [productName, brandDisplayName, offer.category, offer.sector, offer.description, offer.vendorSku]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    additionalImages: images.slice(1).map((image) => image.url),
    images,
    ...metrics,
    unitOfMeasure: "Each",
    sellingPrice: Number(offer.discountPrice || offer.sellingPrice) || 0,
    buyingPrice: offer.buyingPrice,
    oldPrice: offer.discountPrice ? offer.sellingPrice : undefined,
    stockQuantity,
    minStockAlert: 5,
    locationDisplayText:
      branch?.suburb ||
      branch?.address ||
      vendor?.suburb ||
      vendor?.cityTown ||
      "",
    imageUrl,
    imageStatus: imageUrl ? "uploaded" : "missing",
    source: "backend entered",
    enteredByStaffId: "",
    lastUpdatedBy: "",
    status,
    publishToCatalogue: offer.publishToCatalogue,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    deliveryAvailable: offer.deliveryAvailable,
    producerNotes: offer.notes,
  };
};

const loadVendors = async (): Promise<Vendor[]> => {
  const data = await getStorageAdapter().getItem<Vendor[]>(VENDORS_KEY);
  return asArray<Vendor>(data);
};

export const productService = {
  async migrateLegacyProducts(): Promise<void> {
    const alreadyMigrated =
      await getStorageAdapter().getItem<boolean>(MIGRATION_KEY);
    const masters = asArray<MasterProduct>(
      await getStorageAdapter().getItem<MasterProduct[]>(MASTER_PRODUCTS_KEY),
    );
    const offers = asArray<VendorProductOffer>(
      await getStorageAdapter().getItem<VendorProductOffer[]>(VENDOR_OFFERS_KEY),
    );
    const legacyProducts = asArray<Product>(
      await getStorageAdapter().getItem<Product[]>(LEGACY_PRODUCTS_KEY),
    );

    if (alreadyMigrated && (masters.length > 0 || legacyProducts.length === 0)) {
      return;
    }

    const masterByKey = new Map<string, MasterProduct>();
    masters.forEach((master) => {
      const key =
        master.barcode?.trim()
          ? `barcode:${normalize(master.barcode)}`
          : [
              "name",
              slug(master.productName),
              slug(master.brand),
              slug(master.category),
              slug(master.sector),
            ].join(":");
      masterByKey.set(key, master);
    });

    const nextMasters = [...masters];
    const nextOffers = [...offers];
    const offerIds = new Set(nextOffers.map((offer) => offer.id));

    legacyProducts.forEach((legacy) => {
      if (!legacy.vendorId) return;
      const key = canonicalMasterKey(legacy);
      let master = masterByKey.get(key);
      if (!master) {
        master = makeMasterFromLegacy(legacy);
        masterByKey.set(key, master);
        nextMasters.push(master);
      }
      const offer = {
        ...makeOfferFromLegacy({ ...legacy, productId: master.id }),
        productId: master.id,
      };
      if (!offerIds.has(offer.id)) {
        offerIds.add(offer.id);
        nextOffers.push(offer);
      }
    });

    await getStorageAdapter().setItem(MASTER_PRODUCTS_KEY, nextMasters);
    await getStorageAdapter().setItem(VENDOR_OFFERS_KEY, nextOffers);
    await getStorageAdapter().setItem(MIGRATION_KEY, true);
  },

  async getMasterProducts(): Promise<MasterProduct[]> {
    return dataCacheService.getOrFetch("master-products", CACHE_TTL.PRODUCTS, async () => {
      await productService.migrateLegacyProducts();
      const data =
        await getStorageAdapter().getItem<MasterProduct[]>(MASTER_PRODUCTS_KEY, "once");
      const products = asArray<MasterProduct>(data);
      readDiagnosticsService.track("productService", MASTER_PRODUCTS_KEY, "getMasterProducts", products.length);
      return products;
    });
  },

  async getMasterProductsOnce(): Promise<MasterProduct[]> {
    return productService.getMasterProducts();
  },

  async saveMasterProduct(product: MasterProduct): Promise<void> {
    const products = await productService.getMasterProducts();
    const cleanProduct: MasterProduct = {
      ...product,
      tags: product.tags || [],
      keywords: product.keywords || [],
      searchableText: searchableTextFor(product),
      updatedAt: nowIso(),
      createdAt: product.createdAt || nowIso(),
    };
    const index = products.findIndex((p) => p.id === cleanProduct.id);
    if (index >= 0) products[index] = cleanProduct;
    else products.push(cleanProduct);
    const storage = getStorageAdapter();
    if (storage.batchSetItems) {
      await storage.batchSetItems(MASTER_PRODUCTS_KEY, [cleanProduct]);
    } else {
      await storage.setItem(MASTER_PRODUCTS_KEY, products);
    }
    dataCacheService.clearCache();
    try {
      void analyticsService.logEvent({
        eventType: index >= 0 ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
        actorType: "admin",
        actorName: "Product Library",
        productId: cleanProduct.id,
        productName: cleanProduct.productName,
        details: { layer: "master_product" },
      });
    } catch {}
  },

  async deleteMasterProduct(id: string): Promise<void> {
    const masters = (await productService.getMasterProducts()).filter(
      (p) => p.id !== id,
    );
    const storage = getStorageAdapter();
    if (storage.batchDeleteRecords) {
      await storage.batchDeleteRecords(MASTER_PRODUCTS_KEY, [id]);
    } else {
      await storage.setItem(MASTER_PRODUCTS_KEY, masters);
    }
    dataCacheService.clearCache();
  },

  async getVendorProductOffers(): Promise<VendorProductOffer[]> {
    return dataCacheService.getOrFetch("vendor-product-offers", CACHE_TTL.PRODUCTS, async () => {
      await productService.migrateLegacyProducts();
      const data =
        await getStorageAdapter().getItem<VendorProductOffer[]>(VENDOR_OFFERS_KEY);
      const offers = asArray<VendorProductOffer>(data);
      readDiagnosticsService.track("productService", VENDOR_OFFERS_KEY, "getVendorProductOffers", offers.length);
      return offers;
    });
  },

  async getOffersByVendor(vendorId: string): Promise<VendorProductOffer[]> {
    const offers = await productService.getVendorProductOffers();
    return offers.filter((offer) => offer.vendorId === vendorId);
  },

  async saveVendorProductOffer(offer: VendorProductOffer): Promise<void> {
    const offers = await productService.getVendorProductOffers();
    const normalizedOffer: VendorProductOffer = {
      ...offer,
      productMode: offer.productMode || "linked_product",
      sourceType:
        offer.productMode === "branded_product"
          ? "vendor_branded"
          : "master_linked",
      masterProductId:
        offer.productMode === "branded_product"
          ? null
          : offer.masterProductId || offer.productId,
      brandOwnerVendorId:
        offer.brandOwnerVendorId ||
        (offer.productMode === "branded_product" ? offer.vendorId : undefined),
      isVendorBranded: offer.productMode === "branded_product",
      stockStatus:
        offer.stockStatus ||
        stockStatusFromQuantity(Number(offer.stockQuantity) || 0),
      active: offer.active !== false,
      publishToCatalogue: offer.publishToCatalogue !== false,
      deliveryAvailable: offer.deliveryAvailable !== false,
      vendorProductImage:
        normalizeListingImages(offer, 6)[0]?.url || offer.vendorProductImage || "",
      images: normalizeListingImages(offer, 6),
      featured: !!offer.featured,
      createdAt: offer.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    const index = offers.findIndex((o) => o.id === normalizedOffer.id);
    const safeOffer = sanitizeForFirestore(normalizedOffer) as VendorProductOffer;
    if (index >= 0) offers[index] = safeOffer;
    else offers.push(safeOffer);
    await getStorageAdapter().setItem(VENDOR_OFFERS_KEY, sanitizeForFirestore(offers));
    dataCacheService.clearCache();
    void analyticsService.logEvent({
      eventType: index >= 0 ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
      actorType: "admin",
      actorName: "Vendor Offer Desk",
      productId: safeOffer.productId,
      vendorId: safeOffer.vendorId,
      details: {
        layer: "vendor_product_offer",
        productMode: safeOffer.productMode || "linked_product",
      },
      metadata: { productMode: safeOffer.productMode || "linked_product" },
    });
  },

  async deleteVendorProductOffer(id: string): Promise<void> {
    const currentOffers = await productService.getVendorProductOffers();
    const deletedOffer = currentOffers.find((offer) => offer.id === id);
    const offers = currentOffers.filter(
      (offer) => offer.id !== id,
    );
    await getStorageAdapter().setItem(VENDOR_OFFERS_KEY, offers);
    dataCacheService.clearCache();
    try {
      const [vendors, products, settings] = await Promise.all([
        loadVendors(),
        productService.getProducts(),
        settingsService.getSettings(),
      ]);
      const vendor = vendors.find((item) => item.id === deletedOffer?.vendorId);
      if (vendor) {
        await vendorReadinessService.ensureReadinessTask(
          vendor,
          products,
          settings,
          "Vendor product offer was saved or publish status changed.",
        );
      }
    } catch (error) {
      console.warn("Product readiness automation failed", error);
    }
  },

  async getProducts(): Promise<Product[]> {
    return dataCacheService.getOrFetch("products-full", CACHE_TTL.PRODUCTS, async () => {
      await productService.migrateLegacyProducts();
      const [masters, offers, vendors] = await Promise.all([
        productService.getMasterProducts(),
        productService.getVendorProductOffers(),
        loadVendors(),
      ]);
      const masterById = new Map(masters.map((master) => [master.id, master]));
      const products = offers
        .map((offer) => {
          if (offer.productMode === "branded_product") {
            return joinBrandedProduct(offer, vendors);
          }
          const master = masterById.get(offer.productId);
          return master ? joinProduct(master, offer, vendors) : null;
        })
        .filter(Boolean) as Product[];
      readDiagnosticsService.track("productService", "joined_products", "getProducts", products.length);
      return products;
    });
  },

  async getCatalogueOfferProducts(vendorIds: string[]): Promise<Product[]> {
    const legacyProductsBeforeMigration = asArray<Product>(
      await getStorageAdapter().getItem<Product[]>(LEGACY_PRODUCTS_KEY),
    );
    const rawOffersBeforeMigration = asArray<VendorProductOffer>(
      await getStorageAdapter().getItem<VendorProductOffer[]>(VENDOR_OFFERS_KEY),
    );
    await productService.migrateLegacyProducts();
    const [masters, offers, vendors] = await Promise.all([
      productService.getMasterProducts(),
      productService.getVendorProductOffers(),
      loadVendors(),
    ]);
    const selectedVendorIds = new Set(vendorIds);
    const activeVendors = vendors.filter(
      (vendor) =>
        selectedVendorIds.has(vendor.id) &&
        String(vendor.status || "").toLowerCase() === "active",
    );
    const vendorById = new Map(activeVendors.map((vendor) => [vendor.id, vendor]));
    const masterById = new Map(masters.map((master) => [master.id, master]));

    if (rawOffersBeforeMigration.length === 0 && legacyProductsBeforeMigration.length > 0) {
      return legacyProductsBeforeMigration
        .filter((product) => selectedVendorIds.has(product.vendorId))
        .filter((product) => product.publishToCatalogue && product.status === "active");
    }

    return offers
      .filter((offer) => selectedVendorIds.has(offer.vendorId))
      .filter((offer) => offer.active !== false && offer.publishToCatalogue === true)
      .map((offer) => {
        if (offer.productMode === "branded_product") {
          const vendor = vendorById.get(offer.vendorId);
          if (!vendor) return null;
          return joinBrandedProduct(offer, activeVendors);
        }
        const master = masterById.get(offer.productId);
        const vendor = vendorById.get(offer.vendorId);
        if (!master || !vendor) return null;
        if (String(master.status || "").toLowerCase() !== "active") return null;
        return joinProduct(master, offer, activeVendors);
      })
      .filter(Boolean) as Product[];
  },

  async getList(limit = 100): Promise<ProductListItem[]> {
    return dataCacheService.getOrFetch(`products-list:${limit}`, CACHE_TTL.PRODUCTS, async () => {
      const products = await productService.getProducts();
      return products
        .map((product) => ({
          id: product.id,
          name: product.name,
          productName: product.name || (product as any).productName || "Unnamed Product",
          vendorId: product.vendorId,
          vendorName: product.vendorName,
          sector: product.sector,
          category: product.category,
          status: product.status,
          publishToCatalogue: product.publishToCatalogue,
          sellingPrice: product.sellingPrice,
          stockQuantity: product.stockQuantity,
          imageThumbUrl: (product as any).imageThumbUrl || product.imageUrl,
          updatedAt: product.updatedAt,
        }))
        .slice(0, limit);
    });
  },

  async getActiveList(limit = 100): Promise<ProductListItem[]> {
    const products = await productService.getList(limit * 2);
    return products
      .filter((product) => product.status === "active")
      .slice(0, limit);
  },

  async getActive(): Promise<Product[]> {
    const products = await productService.getProducts();
    return products.filter((product) => product.status === "active");
  },

  async getByVendorId(vendorId: string): Promise<Product[]> {
    const products = await productService.getProducts();
    return products.filter((product) => product.vendorId === vendorId);
  },

  async getProductsBySector(sector: string): Promise<Product[]> {
    const normalizedSector = String(sector || "").trim().toLowerCase();
    if (!normalizedSector) return [];
    const products = await productService.getProducts();
    return products.filter(
      (product) =>
        String(product.sector || "").trim().toLowerCase() === normalizedSector,
    );
  },

  async getMasterProductsBySector(sector: string): Promise<MasterProduct[]> {
    const normalizedSector = String(sector || "").trim().toLowerCase();
    if (!normalizedSector) return [];
    const products = await productService.getMasterProducts();
    return products.filter(
      (product) =>
        String(product.sector || "").trim().toLowerCase() === normalizedSector,
    );
  },

  async getByDateRange(from: string, to: string): Promise<Product[]> {
    const products = await productService.getProducts();
    return products.filter((product) => {
      const date = (product.updatedAt || product.createdAt || "").slice(0, 10);
      return (!from || date >= from) && (!to || date <= to);
    });
  },

  async getProductById(id: string): Promise<Product | undefined> {
    const products = await productService.getProducts();
    return products.find((p) => p.id === id || p.productId === id);
  },

  async saveProduct(product: Product): Promise<void> {
    const masters = await productService.getMasterProducts();
    const existingMaster = product.productId
      ? masters.find((m) => m.id === product.productId)
      : undefined;
    const master = existingMaster || makeMasterFromLegacy(product);
    const mergedMaster: MasterProduct = {
      ...master,
      productName: product.name || master.productName,
      brand: product.brand || master.brand,
      category: product.category || master.category,
      sector: product.sector || master.sector,
      description: product.description || master.description,
      barcode: product.productCode || master.barcode,
      standardSku: product.sku || master.standardSku,
      tags: product.tags || master.tags || [],
      imageUrl: product.imageUrl || master.imageUrl,
      unit: product.unitOfMeasure || master.unit,
      status:
        product.status === "out_of_stock" ? master.status || "active" : product.status,
    };
    await productService.saveMasterProduct(mergedMaster);
    if (product.vendorId) {
      await productService.saveVendorProductOffer({
        ...makeOfferFromLegacy({ ...product, productId: mergedMaster.id }),
        id: product.offerId || product.id || `VPO-${Date.now()}`,
        productId: mergedMaster.id,
      });
    }
  },

  async deleteProduct(id: string): Promise<void> {
    await productService.deleteVendorProductOffer(id);
  },

  async getProductsByVendor(vendorId: string): Promise<Product[]> {
    const products = await productService.getProducts();
    return products.filter((p) => p.vendorId === vendorId);
  },

  async bulkUpdateSectorCategory(
    productIds: string[],
    sector: string,
    category: string,
  ): Promise<void> {
    const masters = await productService.getMasterProducts();
    const ids = new Set(productIds);
    const updated = masters.map((p) =>
      ids.has(p.id)
        ? {
            ...p,
            sector,
            category,
            searchableText: searchableTextFor({ ...p, sector, category }),
            updatedAt: nowIso(),
          }
        : p,
    );
    await getStorageAdapter().setItem(MASTER_PRODUCTS_KEY, updated);
  },

  async bulkUpdatePublishStatus(
    productIds: string[],
    publish: boolean,
  ): Promise<void> {
    const ids = new Set(productIds);
    const offers = (await productService.getVendorProductOffers()).map((offer) =>
      ids.has(offer.id) || ids.has(offer.productId)
        ? { ...offer, publishToCatalogue: publish, updatedAt: nowIso() }
        : offer,
    );
    await getStorageAdapter().setItem(VENDOR_OFFERS_KEY, offers);
  },

  async bulkUpdateStatus(
    productIds: string[],
    status: ProductStatus,
  ): Promise<void> {
    const ids = new Set(productIds);
    const masters = (await productService.getMasterProducts()).map((p) =>
      ids.has(p.id) ? { ...p, status, updatedAt: nowIso() } : p,
    );
    await getStorageAdapter().setItem(MASTER_PRODUCTS_KEY, masters);
  },

  async findDuplicateMasterProducts(input: Partial<MasterProduct>) {
    const masters = await productService.getMasterProducts();
    const name = normalize(input.productName);
    const words = new Set(name.split(" ").filter(Boolean));
    return masters
      .filter((product) => product.id !== input.id)
      .map((product) => {
        const productName = normalize(product.productName);
        const exactBarcode =
          input.barcode && product.barcode && normalize(input.barcode) === normalize(product.barcode);
        const exactName = name && productName === name;
        const otherWords = new Set(productName.split(" ").filter(Boolean));
        const overlap = [...words].filter((word) => otherWords.has(word)).length;
        const score = exactBarcode
          ? 100
          : exactName
            ? 95
            : words.size > 0
              ? Math.round((overlap / Math.max(words.size, otherWords.size)) * 100)
              : 0;
        return { product, score };
      })
      .filter((match) => match.score >= 55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  },

  async calculateProductCommerceAnalytics() {
    const [products, offers, vendors] = await Promise.all([
      productService.getMasterProducts(),
      productService.getVendorProductOffers(),
      loadVendors(),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
    const vendorsPerProduct: Record<string, number> = {};
    const stockShortages: Record<string, number> = {};
    const productPopularity: Record<string, number> = {};
    const priceVarianceByProduct: Record<
      string,
      { min: number; max: number; average: number; spread: number }
    > = {};
    const priceVarianceByRegion: Record<string, Record<string, number[]>> = {};
    const vendorCompetitiveness: Record<string, number> = {};

    const pricesByProduct: Record<string, number[]> = {};
    offers.forEach((offer) => {
      const product = productById.get(offer.productId);
      const vendor = vendorById.get(offer.vendorId);
      if (!product || !vendor || !offer.active) return;
      const productName = product.productName;
      vendorsPerProduct[productName] = (vendorsPerProduct[productName] || 0) + 1;
      productPopularity[productName] = (productPopularity[productName] || 0) + 1;
      if (offer.stockStatus === "out_of_stock" || offer.stockQuantity <= 0) {
        stockShortages[productName] = (stockShortages[productName] || 0) + 1;
      }
      pricesByProduct[productName] = pricesByProduct[productName] || [];
      pricesByProduct[productName].push(Number(offer.sellingPrice) || 0);

      const region = vendor.cityTown || vendor.province || "Unspecified";
      priceVarianceByRegion[region] = priceVarianceByRegion[region] || {};
      priceVarianceByRegion[region][productName] =
        priceVarianceByRegion[region][productName] || [];
      priceVarianceByRegion[region][productName].push(Number(offer.sellingPrice) || 0);
    });

    Object.entries(pricesByProduct).forEach(([productName, prices]) => {
      const valid = prices.filter((price) => price > 0);
      if (valid.length === 0) return;
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      const average = Math.round((valid.reduce((sum, price) => sum + price, 0) / valid.length) * 100) / 100;
      priceVarianceByProduct[productName] = {
        min,
        max,
        average,
        spread: max - min,
      };
    });

    offers.forEach((offer) => {
      const product = productById.get(offer.productId);
      if (!product || !offer.active) return;
      const variance = priceVarianceByProduct[product.productName];
      if (!variance || !variance.average) return;
      const price = Number(offer.sellingPrice) || 0;
      const advantage = variance.average - price;
      vendorCompetitiveness[offer.vendorId] =
        (vendorCompetitiveness[offer.vendorId] || 0) + advantage;
    });

    return {
      sameProductSoldByManyVendors: vendorsPerProduct,
      regionalDemand: priceVarianceByRegion,
      vendorPricingComparison: priceVarianceByProduct,
      stockShortages,
      productPopularity,
      fastestMovingProducts: productPopularity,
      mostSearchedProducts: productPopularity,
      priceVarianceByRegion,
      vendorCompetitiveness,
    };
  },
};
