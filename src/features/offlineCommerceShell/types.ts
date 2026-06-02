export interface OfflineCommercePack {
  packType: string;
  version: string;
  generatedAt: string;
  expiresAt?: string;
  vendors: OfflineVendor[];
  accessHubLinks: OfflineAccessHubLink[];
  legal: OfflineLegalContent;
  support: {
    supportName: string;
    supportPhone: string;
    phone?: string;
    message?: string;
    poweredBy: string;
    whatsapp?: string;
    email?: string;
  };
  metadata: Record<string, unknown>;
}

export interface OfflineVendor {
  vendorId: string;
  vendorCode: string;
  name: string;
  tradingName?: string;
  sector: string;
  category: string;
  whatsapp?: string;
  phone?: string;
  logoDataUri?: string;
  bannerDataUri?: string;
  expiresAt?: string;
  deliveryPersonnel?: OfflineDeliveryPersonnel[];
  products: OfflineProduct[];
}

export interface OfflineDeliveryPersonnel {
  id: string;
  fullName: string;
  whatsapp?: string;
  phone?: string;
  vehicleType?: string;
  vehicleRegistration?: string;
  serviceArea?: string;
  isVerified: boolean;
  providerType: "internal" | "external";
  status: string;
}

export interface OfflineProduct {
  id: string;
  productName: string;
  sku?: string;
  brand?: string;
  category: string;
  sector: string;
  unit?: string;
  price: number;
  stockQuantity?: number;
  description?: string;
  imageDataUri?: string;
  tags: string[];
  keywords: string[];
}

export interface OfflineDeliveryOption {
  id: string;
  label: string;
  description?: string;
  fee?: number;
  serviceArea?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
}

export interface OfflineAccessHubLink {
  id: string;
  title?: string;
  name: string;
  type: string;
  url: string;
  sector?: string;
  category?: string;
  isPublished?: boolean;
  description?: string;
  province?: string;
  cityTown?: string;
  district?: string;
}

export interface OfflineLegalContent {
  terms?: string;
  privacy?: string;
  returns?: string;
  disclaimer?: string;
}

export interface OfflineShellExportOptions {
  includeImages: boolean;
  includeStockQuantities: boolean;
  expiresAt?: string;
  fileName?: string;
}

export interface OfflineShellValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type OfflineProductInclusionMode =
  | "all_active_published_products"
  | "selected_vendors_only";

export type OfflineImageQualityMode = "light" | "standard" | "high";

export interface OfflineShellPackGenerationOptions {
  vendorIds: string[];
  productInclusionMode: OfflineProductInclusionMode;
  inStockOnly: boolean;
  expiryDays: 7 | 14 | 21 | 28;
  imageQualityMode: OfflineImageQualityMode;
  accessHubLinkIds: string[];
}

export interface OfflineShellValidationReport {
  vendorsIncluded: number;
  productsIncluded: number;
  vendorsMissingWhatsapp: string[];
  productsMissingImages: string[];
  vendorsWithoutOfflineImages: string[];
  totalImages: number;
  dataUriImages: number;
  remoteUrlImages: number;
  heavyImageWarnings: string[];
  accessHubLinksIncluded: number;
  estimatedPayloadSizeBytes: number;
  estimatedPayloadSizeLabel: string;
  errors: string[];
  warnings: string[];
}

export interface OfflineShellPackGenerationResult {
  pack: OfflineCommercePack | null;
  validation: OfflineShellValidationResult;
  report: OfflineShellValidationReport;
}

export type OfflinePayloadWeight = "good" | "warning" | "heavy";

export interface OfflineShellPayloadEstimate {
  sizeBytes: number;
  sizeLabel: string;
  vendorCount: number;
  productCount: number;
  imageCount: number;
  dataUriImageCount: number;
  weight: OfflinePayloadWeight;
}

export interface OfflineShellImportValidationReport {
  isValid: boolean;
  title: string;
  packType: string;
  version: string;
  generatedAt: string;
  expiresAt: string;
  vendorCount: number;
  productCount: number;
  errors: string[];
  warnings: string[];
  payload: OfflineShellPayloadEstimate;
}
