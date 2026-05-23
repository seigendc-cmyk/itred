import { MasterProduct, Product, VendorProductOffer } from '../types.ts'

type ExportRow = {
  SKU: string
  'Product Name': string
  QTY: number
  Price: number
  'Vendor Name': string
  Branch: string
  Category: string
  Sector: string
  Status: string
  'Delivery Available': string
  'Buying Price': number
  'Discount Price': number
  'Last Updated': string
}

const today = () => new Date().toISOString().slice(0, 10)

export const sanitizeExportFilename = (value: string) =>
  String(value || 'Vendor')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'Vendor'

const safeString = (value: unknown) =>
  String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const safeCsvValue = (value: unknown) => {
  const text = safeString(value)
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n]/.test(guarded)
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded
}

const getMasterById = (masterProducts: MasterProduct[] = []) =>
  new Map(masterProducts.map(product => [product.id, product]))

export const mapLinkedOfferToExportRow = (
  offer: VendorProductOffer,
  master?: MasterProduct,
  vendorName = '',
  branchName = ''
): ExportRow => ({
  SKU: safeString(
    offer.vendorSku ||
      (master as any)?.standardSku ||
      (master as any)?.sku ||
      offer.sku ||
      ''
  ),
  'Product Name': safeString(
    offer.productName ||
      (master as any)?.productName ||
      (master as any)?.name ||
      'Unnamed Product'
  ),
  QTY: safeNumber((offer as any).stockQuantity ?? (offer as any).qty),
  Price: safeNumber((offer as any).sellingPrice ?? (offer as any).price ?? (master as any)?.price),
  'Vendor Name': safeString(vendorName),
  Branch: safeString(branchName || (offer as any).branchName),
  Category: safeString(offer.category || master?.category),
  Sector: safeString(offer.sector || master?.sector),
  Status: safeString(offer.stockStatus || (offer.active ? 'active' : 'inactive')),
  'Delivery Available': offer.deliveryAvailable ? 'Yes' : 'No',
  'Buying Price': safeNumber(offer.buyingPrice),
  'Discount Price': safeNumber(offer.discountPrice),
  'Last Updated': safeString(offer.updatedAt || offer.createdAt)
})

export const mapProductToExportRow = (
  product: Product | any,
  vendorName = ''
): ExportRow => ({
  SKU: safeString(product.sku || product.vendorSku || ''),
  'Product Name': safeString(
    product.productName || product.name || 'Unnamed Product'
  ),
  QTY: safeNumber(product.stockQuantity ?? product.qty),
  Price: safeNumber(product.sellingPrice ?? product.price),
  'Vendor Name': safeString(product.vendorName || vendorName),
  Branch: safeString(product.branchName),
  Category: safeString(product.category),
  Sector: safeString(product.sector),
  Status: safeString(product.status || product.stockStatus),
  'Delivery Available': product.deliveryAvailable ? 'Yes' : 'No',
  'Buying Price': safeNumber(product.buyingPrice),
  'Discount Price': safeNumber(product.discountPrice ?? product.oldPrice),
  'Last Updated': safeString(product.updatedAt || product.createdAt)
})

export const buildVendorProductExportRows = (input: {
  offers?: VendorProductOffer[]
  products?: Array<Product | any>
  masterProducts?: MasterProduct[]
  vendorName?: string
  getBranchName?: (branchId?: string) => string
}): ExportRow[] => {
  const masterById = getMasterById(input.masterProducts || [])
  const offerRows = (input.offers || []).map(offer =>
    mapLinkedOfferToExportRow(
      offer,
      masterById.get(offer.productId || String((offer as any).masterProductId || '')),
      input.vendorName,
      input.getBranchName?.(offer.branchId)
    )
  )
  const productRows = (input.products || []).map(product =>
    mapProductToExportRow(product, input.vendorName)
  )

  return [...offerRows, ...productRows]
}

export const exportVendorProductRows = (
  rows: ExportRow[],
  vendorName: string,
  scope = 'Product-List'
) => {
  if (!rows.length) return false

  const headers: Array<keyof ExportRow> = [
    'SKU',
    'Product Name',
    'QTY',
    'Price',
    'Vendor Name',
    'Branch',
    'Category',
    'Sector',
    'Status',
    'Delivery Available',
    'Buying Price',
    'Discount Price',
    'Last Updated'
  ]
  const csv = [
    headers.map(safeCsvValue).join(','),
    ...rows.map(row => headers.map(header => safeCsvValue(row[header])).join(','))
  ].join('\n')

  const blob = new Blob(['\uFEFF', csv], {
    type: 'text/csv;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${sanitizeExportFilename(vendorName)}-${scope}-${today()}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
  return true
}

