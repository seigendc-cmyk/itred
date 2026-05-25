import {
  CatalogueDiagnostics,
  CatalogueEntitlementResult,
  CatalogueMetrics,
  CatalogueProduct,
  CatalogueVendor,
  CatalogueVendorMetrics,
  ImagePolicy
} from './types'
import { safeArray, safeString } from './safe'
import { productMatchesVendor } from './vendorKeys'
import { normalizeCatalogueProduct } from './catalogueProductNormalizer'
import { estimateCatalogueImages } from './catalogueImageOptimizer'

const fallbackEntitlement: CatalogueEntitlementResult = {
  planName: 'No plan',
  productLimit: null,
  imageAllowance: null,
  deploymentsRemaining: null,
  unresolvedLimit: false,
  blockedReasons: ['No active plan.']
}

const compositeProductId = (vendor: CatalogueVendor, product: CatalogueProduct) =>
  `${safeString(vendor.id || vendor.vendorId || vendor.vendorCode)}:${safeString(product.id)}`

const vendorLabel = (vendor: CatalogueVendor) =>
  safeString(vendor.name || vendor.tradingName || vendor.vendorCode || vendor.id || 'Vendor')

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

const vendorHasVerifiedBadge = (vendor: CatalogueVendor) =>
  vendor.inventorySpotCheckVerified === true && vendor.showVerifiedVendorBadge !== false

const productTrendScore = (product: CatalogueProduct) => {
  const raw = (product.raw || {}) as Record<string, unknown>
  const values = [
    raw.trendScore,
    raw.trendingScore,
    raw.popularityScore,
    raw.viewCount
  ].map(value => Number(value))
  return Math.max(0, ...values.filter(Number.isFinite))
}

const compareCatalogueProducts = (a: CatalogueProduct, b: CatalogueProduct) => {
  if (a.isVerifiedVendor !== b.isVerifiedVendor) return a.isVerifiedVendor ? -1 : 1
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
  if (a.publishToCatalogue !== b.publishToCatalogue) return a.publishToCatalogue ? -1 : 1
  const aInStock = a.stockQuantity > 0
  const bInStock = b.stockQuantity > 0
  if (aInStock !== bInStock) return aInStock ? -1 : 1
  const trendDifference = productTrendScore(b) - productTrendScore(a)
  if (trendDifference !== 0) return trendDifference
  return a.productName.localeCompare(b.productName)
}

const sortCatalogueProducts = (products: CatalogueProduct[]) =>
  products.slice().sort(compareCatalogueProducts)

export const calculateCatalogueMetrics = (input: {
  storefrontProducts: unknown
  selectedVendors: unknown
  selectedProductIds: unknown
  search?: unknown
  entitlement?: CatalogueEntitlementResult
  entitlementsByVendorId?: Record<string, CatalogueEntitlementResult>
  imagePolicy?: ImagePolicy
  includeOutOfStock?: unknown
}): CatalogueMetrics => {
  const selectedVendors = safeArray<CatalogueVendor>(input.selectedVendors)
  const sourceProducts = safeArray<unknown>(input.storefrontProducts).map(
    normalizeCatalogueProduct
  )
  const selectedProductIds = new Set(safeArray<string>(input.selectedProductIds))
  const search = safeString(input.search).trim().toLowerCase()
  const includeOutOfStock = input.includeOutOfStock === true
  const entitlementsByVendorId = input.entitlementsByVendorId || {}

  const allCandidateProducts: CatalogueProduct[] = []
  const allSelectedProducts: CatalogueProduct[] = []
  const allIncludedProducts: CatalogueProduct[] = []
  const allExcludedProducts: CatalogueProduct[] = []
  const allWarnings: string[] = []

  const vendorMetrics: CatalogueVendorMetrics[] = selectedVendors.map(vendor => {
    const vendorId = safeString(vendor.id || vendor.vendorId || vendor.vendorCode)
    const verifiedVendor = vendorHasVerifiedBadge(vendor)
    const entitlement =
      entitlementsByVendorId[vendorId] || input.entitlement || fallbackEntitlement
    const matchedProducts = sourceProducts
      .filter(product => productMatchesVendor(product, vendor))
      .map(product => ({
        ...product,
        id: compositeProductId(vendor, product),
        vendorId: safeString(product.vendorId || vendor.id || vendor.vendorId),
        vendorCode: safeString(product.vendorCode || vendor.vendorCode || vendor.code),
        vendorName: safeString(product.vendorName || vendorLabel(vendor)),
        isVerifiedVendor: verifiedVendor,
        vendorVerifiedAt: safeString(vendor.inventorySpotCheckVerifiedAt)
      }))
    const searchedProducts = search
      ? matchedProducts.filter(product =>
          [
            product.productName,
            product.sku,
            product.vendorName,
            product.category,
            product.productMode
          ]
            .join(' ')
            .toLowerCase()
            .includes(search)
        )
      : matchedProducts
    const activeProducts = searchedProducts.filter(product => product.isActive)
    const publishProducts = activeProducts.filter(product => product.publishToCatalogue)
    const stockProducts = publishProducts.filter(product => product.stockQuantity > 0)
    const outOfStockProducts = publishProducts.filter(
      product => product.stockQuantity <= 0
    )
    const candidateProducts = sortCatalogueProducts(
      includeOutOfStock ? publishProducts : stockProducts
    )
    const selectedProducts = candidateProducts.filter(product =>
      selectedProductIds.has(product.id)
    )
    const limit = entitlement.productLimit
    const blockedByEntitlement = entitlement.blockedReasons.length > 0
    const allowedCount =
      limit === 'unlimited' || limit === null ? selectedProducts.length : limit
    const includedProducts = blockedByEntitlement
      ? []
      : selectedProducts.slice(0, Math.max(0, allowedCount))
    const excludedProducts = selectedProducts.filter(
      product => !includedProducts.some(included => included.id === product.id)
    )
    const warnings: string[] = []

    if (sourceProducts.length > 0 && matchedProducts.length === 0) {
      warnings.push(
        `${vendorLabel(vendor)}: products exist in storefront source but did not match selected vendor keys.`
      )
    }
    if (matchedProducts.length > 0 && activeProducts.length === 0) {
      warnings.push(`${vendorLabel(vendor)}: products filtered by active status rules.`)
    }
    if (activeProducts.length > 0 && publishProducts.length === 0) {
      warnings.push(`${vendorLabel(vendor)}: products filtered by publish rules.`)
    }
    if (!includeOutOfStock && publishProducts.length > 0 && stockProducts.length === 0) {
      warnings.push(`${vendorLabel(vendor)}: products filtered by stock rules.`)
    }
    if (candidateProducts.length > 0 && selectedProducts.length === 0) {
      warnings.push(`${vendorLabel(vendor)}: products available but none selected.`)
    }
    if (entitlement.unresolvedLimit) {
      warnings.push(`${vendorLabel(vendor)}: plan product limit is not configured.`)
    }
    entitlement.blockedReasons.forEach(reason =>
      warnings.push(`${vendorLabel(vendor)}: ${reason}`)
    )

    allCandidateProducts.push(...candidateProducts)
    allSelectedProducts.push(...selectedProducts)
    allIncludedProducts.push(...includedProducts)
    allExcludedProducts.push(...excludedProducts)
    allWarnings.push(...warnings)

    const remainingAllowance =
      limit === 'unlimited' || limit === null
        ? limit
        : Math.max(0, limit - includedProducts.length)

    return {
      vendorId,
      vendorName: vendorLabel(vendor),
      vendorCode: safeString(vendor.vendorCode || vendor.code || vendor.id),
      planName: entitlement.planName,
      productLimit: entitlement.productLimit,
      remainingAllowance,
      matchedCount: matchedProducts.length,
      activeCount: activeProducts.length,
      publishedCount: publishProducts.length,
      candidateCount: candidateProducts.length,
      activeFilteredCount: searchedProducts.length - activeProducts.length,
      publishFilteredCount: activeProducts.length - publishProducts.length,
      stockFilteredCount: includeOutOfStock ? 0 : outOfStockProducts.length,
      inStockCount: stockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      selectedCount: selectedProducts.length,
      includedCount: includedProducts.length,
      excludedCount: excludedProducts.length,
      linkedCount: candidateProducts.filter(product => product.productMode === 'linked')
        .length,
      brandedCount: candidateProducts.filter(product => product.productMode === 'branded')
        .length,
      blockReason: entitlement.blockedReasons[0] || '',
      warnings
    }
  })

  if (selectedVendors.length === 0) allWarnings.push('No selected vendor.')

  const images = estimateCatalogueImages(allIncludedProducts, input.imagePolicy)
  if (allIncludedProducts.length > 0 && images.estimatedPayloadKB === 0) {
    allWarnings.push('No images found for included products.')
  }

  const firstVendor = selectedVendors[0]
  const firstVendorMetrics = vendorMetrics[0]
  const diagnostics: CatalogueDiagnostics = {
    warnings: allWarnings,
    vendorName: selectedVendors.map(vendorLabel).join(', '),
    vendorId: safeString(firstVendor?.id || firstVendor?.vendorId || ''),
    vendorCode: safeString(firstVendor?.vendorCode || firstVendor?.code || ''),
    storefrontSourceCount: sourceProducts.length,
    vendorMatchedCount: sum(vendorMetrics.map(row => row.matchedCount)),
    activeCount: sum(vendorMetrics.map(row => row.activeCount)),
    publishedCount: sum(vendorMetrics.map(row => row.publishedCount)),
    inStockCount: sum(vendorMetrics.map(row => row.inStockCount)),
    outOfStockCount: sum(vendorMetrics.map(row => row.outOfStockCount)),
    activeFilteredCount: sum(vendorMetrics.map(row => row.activeFilteredCount)),
    publishFilteredCount: sum(vendorMetrics.map(row => row.publishFilteredCount)),
    stockFilteredCount: sum(vendorMetrics.map(row => row.stockFilteredCount)),
    includeOutOfStock,
    catalogueCandidateCount: allCandidateProducts.length,
    linkedCount: allCandidateProducts.filter(product => product.productMode === 'linked')
      .length,
    brandedCount: allCandidateProducts.filter(product => product.productMode === 'branded')
      .length,
    selectedCount: allSelectedProducts.length,
    includedCount: allIncludedProducts.length,
    resolvedPlanName:
      vendorMetrics.length === 1 ? safeString(firstVendorMetrics?.planName) : 'Multiple plans',
    resolvedProductLimit:
      vendorMetrics.length === 1 ? firstVendorMetrics?.productLimit ?? null : null,
    blockReason: vendorMetrics.find(row => row.blockReason)?.blockReason || ''
  }

  return {
    storefrontSourceCount: sourceProducts.length,
    vendorMatchedCount: diagnostics.vendorMatchedCount,
    candidateCount: allCandidateProducts.length,
    activeFilteredCount: diagnostics.activeFilteredCount,
    publishFilteredCount: diagnostics.publishFilteredCount,
    stockFilteredCount: diagnostics.stockFilteredCount,
    inStockCount: allCandidateProducts.filter(product => product.stockQuantity > 0).length,
    outOfStockCount: allCandidateProducts.filter(product => product.stockQuantity <= 0).length,
    selectedCount: allSelectedProducts.length,
    includedCount: allIncludedProducts.length,
    excludedCount: allExcludedProducts.length,
    linkedCount: diagnostics.linkedCount,
    brandedCount: diagnostics.brandedCount,
    includedImageCount: images.includedImageCount,
    imagesExcludedCount: images.imagesExcludedCount,
    estimatedPayloadBytes: images.estimatedPayloadBytes,
    oversizedImageCount: images.oversizedImageCount,
    estimatedPayloadKB: images.estimatedPayloadKB,
    estimatedPayloadMB: images.estimatedPayloadMB,
    diagnostics,
    vendorMetrics,
    candidateProducts: sortCatalogueProducts(allCandidateProducts),
    includedProducts: sortCatalogueProducts(allIncludedProducts),
    excludedProducts: sortCatalogueProducts(allExcludedProducts)
  }
}
