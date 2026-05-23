import { MasterProduct, Product, VendorProductOffer } from '../types.ts'

export type VendorInventoryExportRow = {
  SKU: string
  'Product Name': string
  'Opening QTY': number
  'Vendor Receipts': number
  'Vendor Sales': number
  'Current Product QTY': number
  Notes: string
  'Vendor Name': string
  'Product Mode': string
  'Master Product ID': string
  'Vendor Product/Offer ID': string
  Branch: string
  'Selling Price': number
  'Buying Price': number
  'Publish To Catalogue': string
  Status: string
  'Last Updated': string
}

export type VendorInventoryImportRow = Partial<
  Record<keyof VendorInventoryExportRow | string, string>
>

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

export const safeNumber = (value: unknown, fallback = 0) => {
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

const normalizeHeader = (value: string) =>
  safeString(value).toLowerCase().replace(/[^a-z0-9]+/g, '')

const getMasterById = (masterProducts: MasterProduct[] = []) =>
  new Map(masterProducts.map(product => [product.id, product]))

const offerMasterId = (offer: VendorProductOffer) =>
  String((offer as any).masterProductId || offer.productId || '')

const offerSku = (offer: VendorProductOffer, master?: MasterProduct) =>
  offer.productMode === 'branded_product'
    ? safeString(offer.vendorSku || offer.sku || '')
    : safeString(
        offer.vendorSku ||
          (master as any)?.sku ||
          master?.standardSku ||
          offer.sku ||
          ''
      )

const offerProductName = (offer: VendorProductOffer, master?: MasterProduct) =>
  offer.productMode === 'branded_product'
    ? safeString(offer.productName || (offer as any).name || 'Unnamed Product')
    : safeString(
        master?.productName ||
          (master as any)?.name ||
          offer.productName ||
          'Unnamed Product'
      )

export const mapOfferToInventoryExportRow = (
  offer: VendorProductOffer,
  master?: MasterProduct,
  vendorName = '',
  branchName = ''
): VendorInventoryExportRow => ({
  SKU: offerSku(offer, master),
  'Product Name': offerProductName(offer, master),
  'Opening QTY': safeNumber((offer as any).openingQty),
  'Vendor Receipts': safeNumber((offer as any).vendorReceipts),
  'Vendor Sales': safeNumber((offer as any).vendorSales),
  'Current Product QTY': safeNumber(
    (offer as any).currentQty ?? (offer as any).stockQuantity ?? (offer as any).qty
  ),
  Notes: safeString(offer.notes),
  'Vendor Name': safeString(vendorName),
  'Product Mode':
    offer.productMode === 'branded_product'
      ? 'branded_product'
      : 'linked_product',
  'Master Product ID':
    offer.productMode === 'branded_product' ? '' : offerMasterId(offer),
  'Vendor Product/Offer ID': safeString(offer.id),
  Branch: safeString(branchName || (offer as any).branchName),
  'Selling Price': safeNumber((offer as any).sellingPrice ?? (offer as any).price),
  'Buying Price': safeNumber(offer.buyingPrice),
  'Publish To Catalogue': offer.publishToCatalogue !== false ? 'Yes' : 'No',
  Status: offer.active === false ? 'inactive' : 'active',
  'Last Updated': safeString(offer.updatedAt || offer.createdAt)
})

export const mapProductToExportRow = (
  product: Product | any,
  vendorName = ''
): VendorInventoryExportRow => ({
  SKU: safeString(product.vendorSku || product.sku || ''),
  'Product Name': safeString(
    product.productName || product.name || 'Unnamed Product'
  ),
  'Opening QTY': safeNumber(product.openingQty),
  'Vendor Receipts': safeNumber(product.vendorReceipts),
  'Vendor Sales': safeNumber(product.vendorSales),
  'Current Product QTY': safeNumber(product.currentQty ?? product.stockQuantity ?? product.qty),
  Notes: safeString(product.notes),
  'Vendor Name': safeString(product.vendorName || vendorName),
  'Product Mode': product.productMode || 'branded_product',
  'Master Product ID': safeString(product.masterProductId),
  'Vendor Product/Offer ID': safeString(product.id),
  Branch: safeString(product.branchName),
  'Selling Price': safeNumber(product.sellingPrice ?? product.price),
  'Buying Price': safeNumber(product.buyingPrice),
  'Publish To Catalogue': product.publishToCatalogue !== false ? 'Yes' : 'No',
  Status: safeString(product.status || product.stockStatus || (product.active === false ? 'inactive' : 'active')),
  'Last Updated': safeString(product.updatedAt || product.createdAt)
})

export const buildVendorProductExportRows = (input: {
  offers?: VendorProductOffer[]
  products?: Array<Product | any>
  masterProducts?: MasterProduct[]
  vendorName?: string
  getBranchName?: (branchId?: string | null) => string
}): VendorInventoryExportRow[] => {
  const masterById = getMasterById(input.masterProducts || [])
  const offerRows = (input.offers || []).map(offer =>
    mapOfferToInventoryExportRow(
      offer,
      masterById.get(offerMasterId(offer)),
      input.vendorName,
      input.getBranchName?.(offer.branchId)
    )
  )
  const productRows = (input.products || []).map(product =>
    mapProductToExportRow(product, input.vendorName)
  )

  return [...offerRows, ...productRows]
}

export const vendorInventoryExportHeaders: Array<keyof VendorInventoryExportRow> = [
  'SKU',
  'Product Name',
  'Opening QTY',
  'Vendor Receipts',
  'Vendor Sales',
  'Current Product QTY',
  'Notes',
  'Vendor Name',
  'Product Mode',
  'Master Product ID',
  'Vendor Product/Offer ID',
  'Branch',
  'Selling Price',
  'Buying Price',
  'Publish To Catalogue',
  'Status',
  'Last Updated'
]

export const exportVendorProductRows = (
  rows: VendorInventoryExportRow[],
  vendorName: string,
  scope = 'Vendor-Inventory'
) => {
  if (!rows.length) return false

  const csv = [
    vendorInventoryExportHeaders.map(safeCsvValue).join(','),
    ...rows.map(row =>
      vendorInventoryExportHeaders
        .map(header => safeCsvValue(row[header]))
        .join(',')
    )
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

export const parseVendorInventoryCsv = (text: string): VendorInventoryImportRow[] => {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let quoted = false
  const normalized = String(text || '').replace(/^\uFEFF/, '')

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (char === '"' && quoted && next === '"') {
      field += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(field)
      if (row.some(cell => safeString(cell))) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  row.push(field)
  if (row.some(cell => safeString(cell))) rows.push(row)
  if (rows.length < 2) return []

  const headers = rows[0].map(header => normalizeHeader(header))
  const canonicalHeaders = new Map(
    vendorInventoryExportHeaders.map(header => [normalizeHeader(header), header])
  )

  return rows.slice(1).map(cells => {
    const mapped: VendorInventoryImportRow = {}
    headers.forEach((header, index) => {
      const canonical = canonicalHeaders.get(header) || rows[0][index]
      mapped[canonical] = safeString(cells[index])
    })
    return mapped
  })
}

