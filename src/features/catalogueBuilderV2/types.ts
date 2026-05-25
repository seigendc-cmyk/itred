export type CatalogueProductMode = 'linked' | 'branded'
export type ImagePolicy = 'auto_compress' | 'exclude_oversized' | 'block_oversized'

export interface CatalogueVendor {
  id: string
  vendorId?: string
  vendorCode?: string
  code?: string
  businessId?: string
  serial?: string
  vendorSerial?: string
  name: string
  tradingName?: string
  planId?: string
  planName?: string
  subscriptionStatus?: string
  whatsappNumber?: string
  catalogueDisplayName?: string
  sector?: string
  category?: string
  inventorySpotCheckVerified?: boolean
  inventorySpotCheckVerifiedAt?: unknown
  showVerifiedVendorBadge?: boolean
  verifiedBadgeDisabledAt?: unknown
  verifiedBadgeDisabledBy?: string
  [key: string]: unknown
}

export interface CatalogueProduct {
  id: string
  vendorId: string
  vendorCode: string
  vendorName: string
  productName: string
  sku: string
  productMode: CatalogueProductMode
  masterProductId: string
  vendorProductId: string
  status: string
  isActive: boolean
  publishToCatalogue: boolean
  stockQuantity: number
  sellingPrice: number
  imageUrl: string
  category: string
  sector: string
  source: string
  isVerifiedVendor?: boolean
  vendorVerifiedAt?: string
  raw?: unknown
}

export interface CataloguePlan {
  id: string
  name: string
  maxProductsPerCatalogue?: unknown
  catalogueProductLimit?: unknown
  productLimit?: unknown
  maxProducts?: unknown
  productsAllowed?: unknown
  maxImagesPerCatalogue?: unknown
  cataloguesIncludedPerMonth?: unknown
  maxDeploymentsPerMonth?: unknown
  enableCatalogueGeneration?: boolean
  features?: Record<string, unknown> | unknown[]
  entitlements?: Record<string, unknown>
  [key: string]: unknown
}

export interface CatalogueEntitlementResult {
  planName: string
  productLimit: number | 'unlimited' | null
  imageAllowance: number | 'unlimited' | null
  deploymentsRemaining: number | 'unlimited' | null
  unresolvedLimit: boolean
  blockedReasons: string[]
}

export interface CatalogueDiagnostics {
  warnings: string[]
  vendorName: string
  vendorId: string
  vendorCode: string
  storefrontSourceCount: number
  vendorMatchedCount: number
  activeCount: number
  publishedCount: number
  inStockCount: number
  outOfStockCount: number
  activeFilteredCount: number
  publishFilteredCount: number
  stockFilteredCount: number
  includeOutOfStock: boolean
  catalogueCandidateCount: number
  linkedCount: number
  brandedCount: number
  selectedCount: number
  includedCount: number
  resolvedPlanName: string
  resolvedProductLimit: number | 'unlimited' | null
  blockReason: string
}

export interface CatalogueVendorMetrics {
  vendorId: string
  vendorName: string
  vendorCode: string
  planName: string
  productLimit: number | 'unlimited' | null
  remainingAllowance: number | 'unlimited' | null
  matchedCount: number
  activeCount: number
  publishedCount: number
  candidateCount: number
  activeFilteredCount: number
  publishFilteredCount: number
  stockFilteredCount: number
  inStockCount: number
  outOfStockCount: number
  selectedCount: number
  includedCount: number
  excludedCount: number
  linkedCount: number
  brandedCount: number
  blockReason: string
  warnings: string[]
}

export interface CatalogueMetrics {
  storefrontSourceCount: number
  vendorMatchedCount: number
  candidateCount: number
  activeFilteredCount: number
  publishFilteredCount: number
  stockFilteredCount: number
  inStockCount: number
  outOfStockCount: number
  selectedCount: number
  includedCount: number
  excludedCount: number
  linkedCount: number
  brandedCount: number
  includedImageCount: number
  imagesExcludedCount: number
  estimatedPayloadBytes: number
  oversizedImageCount: number
  estimatedPayloadKB: number
  estimatedPayloadMB: number
  diagnostics: CatalogueDiagnostics
  vendorMetrics: CatalogueVendorMetrics[]
  candidateProducts: CatalogueProduct[]
  includedProducts: CatalogueProduct[]
  excludedProducts: CatalogueProduct[]
}

export interface CatalogueSelectionState {
  selectedVendorIds: string[]
  selectedProductIds: string[]
  search: string
  imagePolicy: ImagePolicy
}
