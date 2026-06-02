import {
  DEFAULT_OFFLINE_COMMERCE_SUPPORT,
  OFFLINE_COMMERCE_PACK_TYPE,
  OFFLINE_COMMERCE_PACK_VERSION,
} from "./offlineShellConstants";
import {
  OfflineImageQualityMode,
  OfflineAccessHubLink,
  OfflineCommercePack,
  OfflineDeliveryPersonnel,
  OfflineLegalContent,
  OfflineProduct,
  OfflineShellPackGenerationOptions,
  OfflineShellPackGenerationResult,
  OfflineShellExportOptions,
  OfflineShellValidationReport,
  OfflineVendor,
} from "./types";
import { normalizeCatalogueProduct } from "../catalogueBuilderV2/catalogueProductNormalizer";
import { cahService } from "../../services/cahService";
import { productService } from "../../services/productService";
import { vendorService } from "../../services/vendorService";
import { CAHLink, Product, Vendor } from "../../types";
import { validateOfflineCommercePack } from "./dataPackValidator";
import { estimateBase64Size } from "../../services/catalogueImageOptimizer";

const fallbackString = (value: unknown, fallback = "") =>
  value === undefined || value === null ? fallback : String(value);

const compactUndefined = <T,>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) => (item === undefined ? undefined : item)),
  ) as T;

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const sizeLabel = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const IMAGE_QUALITY_OPTIONS: Record<
  OfflineImageQualityMode,
  { productMaxWidth: number; quality: number }
> = {
  light: { productMaxWidth: 360, quality: 0.65 },
  standard: { productMaxWidth: 600, quality: 0.75 },
  high: { productMaxWidth: 900, quality: 0.85 },
};

const isDataUriImage = (value: string) =>
  /^data:image\//i.test(String(value || "").trim());

const isRemoteImage = (value: string) =>
  /^https?:\/\//i.test(String(value || "").trim());

const imageBytes = (value: string) => {
  if (!value) return 0;
  if (isDataUriImage(value)) return estimateBase64Size(value);
  return 0;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
  });

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const compressDataUriToWebP = async (
  image: string,
  options: { maxWidth: number; quality: number },
) => {
  const img = new Image();
  img.decoding = "async";
  img.src = image;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image could not be loaded"));
  });

  const sourceWidth = img.naturalWidth || img.width || options.maxWidth;
  const sourceHeight = img.naturalHeight || img.height || options.maxWidth;
  const ratio = Math.min(1, options.maxWidth / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, options.quality);
  if (!blob) throw new Error("WebP conversion failed");
  return blobToDataUrl(blob);
};

const optimizeInlineImage = async (
  image: string,
  options: { maxWidth: number; quality: number },
) => {
  if (!isDataUriImage(image)) return image;
  try {
    const optimized = await compressDataUriToWebP(image, options);
    return imageBytes(optimized) < imageBytes(image) ? optimized : image;
  } catch (error) {
    console.warn("Offline shell image optimization failed", error);
    return image;
  }
};

const vendorLogo = (vendor: Vendor) =>
  vendor.logoAssetUrl ||
  vendor.logoUrl ||
  vendor.businessLogoUrl ||
  "";

const vendorBanner = (vendor: Vendor) =>
  vendor.bannerAssetUrl ||
  vendor.bannerUrl ||
  vendor.businessBannerUrl ||
  "";

const mapDeliveryPersonnel = (vendor: Vendor): OfflineDeliveryPersonnel[] => {
  const internal = (Array.isArray(vendor.deliveryStaff) ? vendor.deliveryStaff : [])
    .filter((item) => item.status === "active")
    .map((item) => ({
      id: fallbackString(item.id),
      fullName: fallbackString(item.fullName),
      whatsapp: fallbackString(item.whatsapp),
      phone: fallbackString(item.phone),
      vehicleType: fallbackString(item.vehicleType),
      vehicleRegistration: fallbackString(item.vehicleRegistration),
      serviceArea: fallbackString(item.serviceArea),
      isVerified: true,
      providerType: "internal" as const,
      status: "active",
    }));

  const external = (Array.isArray(vendor.deliveryProviders) ? vendor.deliveryProviders : [])
    .filter((item) => item.status === "verified")
    .map((item) => ({
      id: fallbackString(item.id),
      fullName: fallbackString(item.providerName),
      whatsapp: fallbackString(item.whatsappNumber),
      phone: fallbackString(item.phoneNumber),
      vehicleType: fallbackString(item.vehicleType),
      vehicleRegistration: fallbackString(item.vehicleNumber),
      serviceArea: [item.district, item.suburb, item.cityTown].filter(Boolean).join(", "),
      isVerified: true,
      providerType: "external" as const,
      status: "active",
    }));

  return [...internal, ...external].filter((item) => item.id && item.fullName);
};

const mapAccessHubLink = (link: CAHLink): OfflineAccessHubLink => ({
  id: fallbackString(link.id),
  title: fallbackString(link.name),
  name: fallbackString(link.name),
  type: fallbackString(link.type),
  url: fallbackString(link.url || link.whatsappUrl || link.supportLink),
  sector: fallbackString(link.sector),
  category: fallbackString((link as any).category),
  isPublished: link.status === "active" && link.showInCatalogue !== false,
  description: fallbackString(link.description),
  province: fallbackString(link.province),
  cityTown: fallbackString(link.cityTown),
  district: fallbackString(link.district),
});

const mapProduct = async (
  product: Product,
  imageMode: OfflineImageQualityMode,
): Promise<OfflineProduct> => {
  const normalized = normalizeCatalogueProduct(product);
  const imageUrl = normalized.imageUrl || product.imageUrl || "";
  const imageOptions = IMAGE_QUALITY_OPTIONS[imageMode];
  const imageDataUri = await optimizeInlineImage(imageUrl, {
    maxWidth: imageOptions.productMaxWidth,
    quality: imageOptions.quality,
  });

  return {
    id: fallbackString(product.id || normalized.id),
    productName: fallbackString(normalized.productName || product.productName || product.name),
    sku: fallbackString(normalized.sku || product.sku || product.productCode),
    brand: fallbackString(product.brand || product.brandDisplayName),
    category: fallbackString(normalized.category || product.category),
    sector: fallbackString(normalized.sector || product.sector),
    unit: fallbackString(product.unitOfMeasure || product.quantityUnit || "Each"),
    price: Number(normalized.sellingPrice || product.sellingPrice || 0),
    stockQuantity: Number(normalized.stockQuantity || product.stockQuantity || 0),
    description: fallbackString(product.description || product.producerNotes),
    imageDataUri: fallbackString(imageDataUri),
    tags: Array.isArray(product.tags) ? product.tags.filter(Boolean).map(String) : [],
    keywords: Array.isArray(product.keywords)
      ? product.keywords.filter(Boolean).map(String)
      : fallbackString(product.searchableText)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 12),
  };
};

const mapVendor = async (
  vendor: Vendor,
  products: OfflineProduct[],
  expiresAt: string,
): Promise<OfflineVendor> => {
  const [logoDataUri, bannerDataUri] = await Promise.all([
    optimizeInlineImage(vendorLogo(vendor), { maxWidth: 256, quality: 0.72 }),
    optimizeInlineImage(vendorBanner(vendor), { maxWidth: 1200, quality: 0.76 }),
  ]);

  return {
    vendorId: fallbackString(vendor.id),
    vendorCode: fallbackString(vendor.vendorCode || vendor.systemCode),
    name: fallbackString(vendor.name),
    tradingName: fallbackString(vendor.tradingName || vendor.catalogueDisplayName),
    sector: fallbackString(vendor.sector),
    category: fallbackString(vendor.category),
    whatsapp: fallbackString(vendor.whatsapp || vendor.whatsappNumber),
    phone: fallbackString(vendor.phone || vendor.mainPhone),
    logoDataUri: fallbackString(logoDataUri),
    bannerDataUri: fallbackString(bannerDataUri),
    expiresAt,
    deliveryPersonnel: mapDeliveryPersonnel(vendor),
    products,
  };
};

const emptyReport = (): OfflineShellValidationReport => ({
  vendorsIncluded: 0,
  productsIncluded: 0,
  vendorsMissingWhatsapp: [],
  productsMissingImages: [],
  vendorsWithoutOfflineImages: [],
  totalImages: 0,
  dataUriImages: 0,
  remoteUrlImages: 0,
  heavyImageWarnings: [],
  accessHubLinksIncluded: 0,
  estimatedPayloadSizeBytes: 0,
  estimatedPayloadSizeLabel: "0 B",
  errors: [],
  warnings: [],
});

const collectImageDiagnostics = (vendors: OfflineVendor[]) => {
  const heavyImageWarnings: string[] = [];
  const vendorsWithoutOfflineImages: string[] = [];
  let totalImages = 0;
  let dataUriImages = 0;
  let remoteUrlImages = 0;

  vendors.forEach((vendor) => {
    const vendorImages = [vendor.logoDataUri || "", vendor.bannerDataUri || ""].filter(Boolean);
    const vendorHasOfflineImage = vendorImages.some(isDataUriImage);
    if (!vendorHasOfflineImage) {
      vendorsWithoutOfflineImages.push(vendor.tradingName || vendor.name || vendor.vendorId);
    }

    vendorImages.forEach((image) => {
      totalImages += 1;
      if (isDataUriImage(image)) dataUriImages += 1;
      if (isRemoteImage(image)) remoteUrlImages += 1;
      const bytes = imageBytes(image);
      if (bytes > 250 * 1024) {
        heavyImageWarnings.push(`${vendor.tradingName || vendor.name || vendor.vendorId} vendor image is ${sizeLabel(bytes)}.`);
      }
    });

    vendor.products.forEach((product) => {
      const image = product.imageDataUri || "";
      if (!image) return;
      totalImages += 1;
      if (isDataUriImage(image)) dataUriImages += 1;
      if (isRemoteImage(image)) remoteUrlImages += 1;
      const bytes = imageBytes(image);
      if (bytes > 180 * 1024) {
        heavyImageWarnings.push(`${product.productName || product.id} image is ${sizeLabel(bytes)}.`);
      }
    });
  });

  return {
    totalImages,
    dataUriImages,
    remoteUrlImages,
    heavyImageWarnings,
    vendorsWithoutOfflineImages,
  };
};

export function createOfflineCommercePack(input: {
  vendors?: OfflineVendor[];
  accessHubLinks?: OfflineAccessHubLink[];
  legal?: OfflineLegalContent;
  support?: Partial<OfflineCommercePack["support"]>;
  metadata?: Record<string, unknown>;
  options?: Partial<OfflineShellExportOptions>;
}): OfflineCommercePack {
  return compactUndefined({
    packType: OFFLINE_COMMERCE_PACK_TYPE,
    version: OFFLINE_COMMERCE_PACK_VERSION,
    generatedAt: new Date().toISOString(),
    expiresAt: input.options?.expiresAt,
    vendors: input.vendors || [],
    accessHubLinks: input.accessHubLinks || [],
    legal: input.legal || {},
    support: {
      ...DEFAULT_OFFLINE_COMMERCE_SUPPORT,
      ...input.support,
    },
    metadata: input.metadata || {},
  });
}

export function serializeOfflineCommercePack(pack: OfflineCommercePack): string {
  return JSON.stringify(pack, null, 2);
}

export async function generateOfflineCommercePack(
  options: OfflineShellPackGenerationOptions,
): Promise<OfflineShellPackGenerationResult> {
  const report = emptyReport();
  const selectedVendorIds = new Set(options.vendorIds);
  const selectedAccessHubLinkIds = new Set(options.accessHubLinkIds);
  const validExpiryDays = [7, 14, 21, 28].includes(options.expiryDays);

  if (selectedVendorIds.size === 0) {
    report.errors.push("Select at least one vendor.");
  }

  if (!validExpiryDays) {
    report.errors.push("Choose a valid expiry window.");
  }

  if (report.errors.length > 0) {
    return {
      pack: null,
      validation: { isValid: false, errors: report.errors, warnings: [] },
      report,
    };
  }

  const expiresAt = addDays(options.expiryDays);
  const [activeVendors, sourceProducts, accessHubLinks] = await Promise.all([
    vendorService.getActive(),
    productService.getCatalogueOfferProducts(options.vendorIds),
    Promise.resolve(cahService.getLinks()),
  ]);

  const vendors = activeVendors.filter((vendor) => selectedVendorIds.has(vendor.id));
  const sourceProductsByVendor = new Map<string, Product[]>();
  sourceProducts
    .filter((product) => !options.inStockOnly || Number(product.stockQuantity || 0) > 0)
    .forEach((product) => {
      const list = sourceProductsByVendor.get(product.vendorId) || [];
      list.push(product);
      sourceProductsByVendor.set(product.vendorId, list);
    });

  const offlineVendors = await Promise.all(
    vendors.map(async (vendor) =>
      mapVendor(
        vendor,
        await Promise.all(
          (sourceProductsByVendor.get(vendor.id) || []).map((product) =>
            mapProduct(product, options.imageQualityMode),
          ),
        ),
        expiresAt,
      ),
    ),
  );

  const offlineAccessHubLinks = accessHubLinks
    .filter((link) => link.status === "active" && link.showInCatalogue !== false)
    .filter((link) => selectedAccessHubLinkIds.has(link.id))
    .map(mapAccessHubLink)
    .filter((link) => link.url);

  const pack = createOfflineCommercePack({
    vendors: offlineVendors,
    accessHubLinks: offlineAccessHubLinks,
    legal: {
      disclaimer:
        "Offline prices and stock are valid only until the pack expiry date. Contact the vendor to confirm availability before purchase.",
    },
    support: {
      phone: DEFAULT_OFFLINE_COMMERCE_SUPPORT.phone,
      whatsapp: DEFAULT_OFFLINE_COMMERCE_SUPPORT.whatsapp,
      message: DEFAULT_OFFLINE_COMMERCE_SUPPORT.message,
    },
    metadata: {
      generator: "offline-commerce-shell",
      productInclusionMode: options.productInclusionMode,
      inStockOnly: options.inStockOnly,
      imageQualityMode: options.imageQualityMode,
      imageTargets: {
        productMaxWidth: IMAGE_QUALITY_OPTIONS[options.imageQualityMode].productMaxWidth,
        productQuality: IMAGE_QUALITY_OPTIONS[options.imageQualityMode].quality,
        logoMaxWidth: 256,
        bannerMaxWidth: 1200,
        format: "image/webp",
      },
      selectedVendorIds: options.vendorIds,
      selectedAccessHubLinkIds: options.accessHubLinkIds,
      dataSources: [
        "vendorService.getActive",
        "productService.getCatalogueOfferProducts",
        "cahService.getLinks",
      ],
    },
    options: {
      includeImages: true,
      includeStockQuantities: true,
      expiresAt,
    },
  });

  const serialized = serializeOfflineCommercePack(pack);
  const products = pack.vendors.flatMap((vendor) => vendor.products);
  const validation = validateOfflineCommercePack(pack);
  const imageDiagnostics = collectImageDiagnostics(pack.vendors);

  report.vendorsIncluded = pack.vendors.length;
  report.productsIncluded = products.length;
  report.vendorsMissingWhatsapp = pack.vendors
    .filter((vendor) => !vendor.whatsapp)
    .map((vendor) => vendor.tradingName || vendor.name || vendor.vendorId);
  report.productsMissingImages = products
    .filter((product) => !product.imageDataUri)
    .map((product) => product.productName || product.id);
  report.vendorsWithoutOfflineImages = imageDiagnostics.vendorsWithoutOfflineImages;
  report.totalImages = imageDiagnostics.totalImages;
  report.dataUriImages = imageDiagnostics.dataUriImages;
  report.remoteUrlImages = imageDiagnostics.remoteUrlImages;
  report.heavyImageWarnings = imageDiagnostics.heavyImageWarnings;
  report.accessHubLinksIncluded = pack.accessHubLinks.length;
  report.estimatedPayloadSizeBytes = new Blob([serialized]).size;
  report.estimatedPayloadSizeLabel = sizeLabel(report.estimatedPayloadSizeBytes);
  report.errors = validation.errors;
  report.warnings = validation.warnings;
  if (report.remoteUrlImages > 0) {
    report.warnings.push("Remote image links may not be visible offline.");
  }
  if (report.estimatedPayloadSizeBytes > 2 * 1024 * 1024) {
    report.warnings.push("Pack is heavy for WhatsApp distribution.");
  }

  return {
    pack,
    validation,
    report,
  };
}
