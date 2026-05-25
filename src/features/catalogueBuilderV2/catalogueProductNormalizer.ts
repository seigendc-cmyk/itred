import { CatalogueProduct } from './types'
import { safeArray, safeNumber, safeString } from './safe'

const firstImage = (product: Record<string, unknown>) => {
  const direct = [
    product.imageUrl,
    product.vendorProductImage,
    product.brandLogoUrl,
    product.logoUrl
  ]
    .map(value => safeString(value).trim())
    .find(Boolean)
  if (direct) return direct

  const imageFromList = safeArray<unknown>(product.images)
    .concat(safeArray<unknown>(product.imageUrls))
    .concat(safeArray<unknown>(product.additionalImages))
    .map(item =>
      typeof item === 'string'
        ? item
        : safeString((item as Record<string, unknown>)?.url || (item as Record<string, unknown>)?.imageUrl)
    )
    .find(Boolean)

  return imageFromList || ''
}

const resolveStockQuantity = (product: Record<string, unknown>) => {
  const stockFields = [
    product.stockQuantity,
    product.currentQty,
    product.currentQuantity,
    product.quantity,
    product.qty,
    product.stock,
    product.availableQty,
    product.availableQuantity,
    product.inventoryQty,
    product.inventoryQuantity,
    product.onHand,
    product.balance,
    product.currentStock
  ]

  const value = stockFields.find(item => item !== undefined && item !== null && item !== '')
  return safeNumber(value, 0)
}

export const normalizeCatalogueProduct = (input: unknown): CatalogueProduct => {
  const product = (input || {}) as Record<string, unknown>
  const rawMode = safeString(
    product.productMode || product.mode || product.sourceType
  ).toLowerCase()
  const productMode =
    rawMode.includes('brand') || product.isVendorBranded === true
      ? 'branded'
      : 'linked'
  const status = safeString(product.status || product.lifecycleStatus || 'active')
    .trim()
    .toLowerCase()

  const productName =
    safeString(product.productName).trim() ||
    safeString(product.name).trim() ||
    safeString(product.title).trim() ||
    safeString(product.itemName).trim() ||
    'Unnamed Product'

  const vendorProductId =
    safeString(product.vendorProductId).trim() ||
    safeString(product.offerId).trim() ||
    safeString(product.id).trim()

  return {
    id:
      safeString(product.id).trim() ||
      vendorProductId ||
      `${safeString(product.vendorId)}_${safeString(product.sku || product.productName)}`,
    vendorId: safeString(product.vendorId).trim(),
    vendorCode: safeString(product.vendorCode).trim(),
    vendorName: safeString(product.vendorName).trim(),
    productName,
    sku:
      safeString(product.vendorSku).trim() ||
      safeString(product.sku).trim() ||
      safeString(product.productSku).trim() ||
      safeString(product.masterSku).trim(),
    productMode,
    masterProductId:
      safeString(product.masterProductId).trim() ||
      safeString(product.productId).trim(),
    vendorProductId,
    status,
    isActive: !['inactive', 'hidden', 'archived', 'deleted', 'draft'].includes(
      status
    ),
    publishToCatalogue: product.publishToCatalogue !== false,
    stockQuantity: resolveStockQuantity(product),
    sellingPrice: safeNumber(
      product.sellingPrice ?? product.price ?? product.unitPrice,
      0
    ),
    imageUrl: firstImage(product),
    category:
      safeString(product.category).trim() ||
      safeString(product.productCategory).trim(),
    sector: safeString(product.sector).trim(),
    source: safeString(product.source || product.sourceType || 'storefront'),
    isVerifiedVendor:
      product.isVerifiedVendor === true ||
      product.inventorySpotCheckVerified === true ||
      product.showVerifiedVendorBadge === true,
    vendorVerifiedAt: safeString(product.inventorySpotCheckVerifiedAt).trim(),
    raw: input
  }
}
