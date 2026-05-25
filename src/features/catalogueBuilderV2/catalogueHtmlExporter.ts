import { CatalogueProduct, CatalogueVendor } from './types'
import { safeArray, safeNumber, safeString } from './safe'
import { getOptimizedWebpThumbnail } from './catalogueImageOptimizer'
import { CATALOGUE_LEGAL_SOT } from './catalogueLegalSot'

export interface ItredCatalogueExportInput {
  title: string
  catalogueSerial: string
  generatedAt: string
  expiresAt: string
  products: CatalogueProduct[]
  vendors: CatalogueVendor[]
  cahLinks?: any[]
  legal?: {
    privacyPolicy?: string
    businessTerms?: string
    warranties?: string
    indemnity?: string
  }
  branding?: {
    appName?: string
    poweredBy?: string
    logoDataUri?: string
  }
  analytics?: {
    syncEndpoint?: string
  }
}

export const ITRED_OFFLINE_HTML_SIZE_LIMIT_BYTES = 8 * 1024 * 1024

const escapeHtml = (value: unknown): string =>
  safeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeAttribute = (value: unknown): string => escapeHtml(value).replace(/`/g, '&#96;')

const formatCataloguePrice = (value: unknown): string => {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 'Price on request'
  }

  return `$${Math.round(numberValue).toLocaleString('en-US')}`
}

const dataUriOnly = (value: unknown): string => {
  const url = safeString(value).trim()
  return url.startsWith('data:image/') ? url : ''
}

const DEFAULT_HEADER_LOGO_DATA_URI =
  'data:image/png;base64,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'

const optimizedThumbnailOnly = (product: CatalogueProduct): string =>
  getOptimizedWebpThumbnail(product)

const SEIGEN_SUPPORT_PHONE = '+263775747198'
const SEIGEN_SUPPORT_TEL = 'tel:+263775747198'
const SEIGEN_SUPPORT_WHATSAPP =
  'https://wa.me/263775747198?text=Hello%20seiGEN%20Commerce,%20I%20need%20help%20with%20the%20iTred%20catalogue.'

const compactText = (value: unknown, fallback = 'N/A'): string => {
  const text = safeString(value).trim()
  return text || fallback
}

const phoneValue = (value: unknown): string => safeString(value).replace(/[^\d+]/g, '')

const whatsappHref = (value: unknown): string => {
  const phone = phoneValue(value).replace(/^\+/, '')
  return phone ? `https://wa.me/${phone}` : ''
}

const trendScore = (product: CatalogueProduct): number => {
  const raw = (product.raw || {}) as Record<string, unknown>
  return Math.max(
    safeNumber(raw.trendScore, 0),
    safeNumber(raw.trendingScore, 0),
    safeNumber(raw.popularityScore, 0),
    safeNumber(raw.viewCount, 0)
  )
}

const isVerifiedVendor = (vendor: CatalogueVendor): boolean =>
  vendor.inventorySpotCheckVerified === true && vendor.showVerifiedVendorBadge !== false

const vendorSearchText = (vendor: CatalogueVendor): string =>
  [
    vendor.name,
    vendor.tradingName,
    vendor.catalogueDisplayName,
    vendor.vendorCode,
    vendor.sector,
    vendor.category,
    vendor.cityTown,
    vendor.city,
    vendor.town,
    vendor.suburb,
    vendor.location,
    vendor.province,
    vendor.whatsappNumber,
    vendor.whatsapp,
    vendor.phoneNumber,
    vendor.phone,
    vendor.mainPhone,
    vendor.businessDescription,
    vendor.servicesSummary,
    vendor.productsSummary,
    isVerifiedVendor(vendor) ? 'verified verified vendor' : ''
  ]
    .map(value => safeString(value).trim())
    .filter(Boolean)
    .join(' ')

const compareProductsForDiscovery = (a: CatalogueProduct, b: CatalogueProduct): number => {
  if (a.isVerifiedVendor !== b.isVerifiedVendor) return a.isVerifiedVendor ? -1 : 1
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
  if (a.publishToCatalogue !== b.publishToCatalogue) return a.publishToCatalogue ? -1 : 1
  const aInStock = a.stockQuantity > 0
  const bInStock = b.stockQuantity > 0
  if (aInStock !== bInStock) return aInStock ? -1 : 1
  const trendDifference = trendScore(b) - trendScore(a)
  if (trendDifference !== 0) return trendDifference
  return a.productName.localeCompare(b.productName)
}

const productLocation = (product: CatalogueProduct): string => {
  const raw = (product.raw || {}) as Record<string, unknown>
  return (
    safeString(raw.location).trim() ||
    safeString(raw.city).trim() ||
    safeString(raw.town).trim() ||
    safeString(raw.region).trim() ||
    safeString(raw.vendorLocation).trim()
  )
}

const productDescription = (product: CatalogueProduct): string => {
  const raw = (product.raw || {}) as Record<string, unknown>
  return (
    safeString(raw.description).trim() ||
    safeString(raw.productDescription).trim() ||
    safeString(raw.shortDescription).trim() ||
    safeString(raw.notes).trim()
  )
}

const productGroupKey = (product: CatalogueProduct): string =>
  (
    safeString(product.masterProductId).trim() ||
    safeString(product.sku).trim() ||
    safeString(product.productName).trim() ||
    safeString(product.id).trim()
  ).toLowerCase()

const vendorPhoneForProduct = (
  product: CatalogueProduct,
  vendors: CatalogueVendor[]
): string => {
  const productKeys = [
    product.vendorId,
    product.vendorCode,
    product.vendorName
  ].map(value => safeString(value).trim().toLowerCase()).filter(Boolean)
  const vendor = vendors.find(item => {
    const vendorKeys = [
      item.id,
      item.vendorId,
      item.vendorCode,
      item.code,
      item.name,
      item.tradingName
    ].map(value => safeString(value).trim().toLowerCase()).filter(Boolean)
    return vendorKeys.some(key => productKeys.includes(key))
  })
  return safeString(vendor?.whatsappNumber).trim()
}

const jsonForHtml = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

const productDiscoveryData = (products: CatalogueProduct[], vendors: CatalogueVendor[]) =>
  products.map(product => {
    const priceText = formatCataloguePrice(product.sellingPrice)
    const availability = product.stockQuantity > 0 ? 'in stock' : 'out of stock'
    const location = productLocation(product)
    const vendorPhone = vendorPhoneForProduct(product, vendors)
    return {
      id: product.id,
      g: productGroupKey(product),
      n: product.productName,
      s: product.sku,
      v: product.vendorName || product.vendorCode || 'Vendor',
      vk: product.vendorId || product.vendorCode || product.vendorName || 'vendor',
      c: product.category || 'Uncategorised',
      se: product.sector,
      d: productDescription(product),
      p: priceText,
      up: safeNumber(product.sellingPrice, 0),
      q: product.stockQuantity,
      a: availability,
      l: location,
      m: product.productMode,
      vv: product.isVerifiedVendor === true,
      t: trendScore(product),
      i: optimizedThumbnailOnly(product),
      ph: phoneValue(vendorPhone),
      x: [
        product.productName,
        product.sku,
        product.vendorName,
        product.category,
        product.sector,
        priceText,
        availability,
        location,
        product.productMode
      ]
        .join(' ')
        .toLowerCase()
    }
  })

const renderProductCard = (
  product: CatalogueProduct,
  vendors: CatalogueVendor[] = []
): string => {
  const imageUrl = optimizedThumbnailOnly(product)
  const stockLabel = product.stockQuantity > 0 ? 'In stock' : 'Out of stock'
  const description = productDescription(product)

  return `
    <article class="product-card${product.isVerifiedVendor ? ' verified-card' : ''}" data-product-id="${escapeAttribute(product.id)}" data-product-name="${escapeAttribute(product.productName)}" data-vendor-id="${escapeAttribute(product.vendorId || product.vendorCode || product.vendorName)}" data-vendor-name="${escapeAttribute(product.vendorName || product.vendorCode || 'Vendor')}" data-search="${escapeAttribute(`${product.productName} ${product.sku} ${product.vendorName} ${product.category} ${product.productMode}`)}" data-vendor="${escapeAttribute(product.vendorName)}" data-mode="${escapeAttribute(product.productMode)}">
      <div class="product-image">
        ${
          imageUrl
            ? `<img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(product.productName)}">`
            : '<span>No image</span>'
        }
      </div>
      <div class="product-body">
        <div class="product-topline">
          <span>${escapeHtml(product.productMode)}</span>
          <span>${escapeHtml(stockLabel)}</span>
        </div>
        <h3>${escapeHtml(product.productName)}</h3>
        <p class="muted vendor-line">${escapeHtml(product.vendorName || product.vendorCode || 'Vendor')}${product.isVerifiedVendor ? ' <span class="verified-badge">Verified vendor</span>' : ''}</p>
        ${description ? `<p class="muted">${escapeHtml(description)}</p>` : ''}
        <p class="sku">SKU: ${escapeHtml(product.sku || 'N/A')}</p>
        <div class="badges">
          <span>${escapeHtml(product.category || 'Uncategorised')}</span>
          <span>Available from 1 vendor</span>
        </div>
        <div class="price-row">
          <strong>${formatCataloguePrice(product.sellingPrice)}</strong>
          <small>Qty ${escapeHtml(product.stockQuantity)}</small>
        </div>
        <p class="tap-hint">Tap for vendor options</p>
      </div>
    </article>
  `
}

const renderVendorCard = (vendor: CatalogueVendor): string => `
  <article class="vendor-card${isVerifiedVendor(vendor) ? ' verified-card' : ''}" data-vendor-detail="1" data-vendor-id="${escapeAttribute(vendor.id || vendor.vendorId || vendor.vendorCode)}" data-vendor-name="${escapeAttribute(vendor.name || vendor.tradingName || 'Vendor')}" data-vendor-search="${escapeAttribute(vendorSearchText(vendor))}">
    <h3>${escapeHtml(vendor.name || vendor.tradingName || 'Vendor')}${isVerifiedVendor(vendor) ? ' <span class="verified-badge">Verified vendor</span>' : ''}</h3>
    <p>${escapeHtml(vendor.vendorCode || vendor.code || vendor.id || 'N/A')}</p>
    <p>${escapeHtml(vendor.sector || vendor.category || 'General')}</p>
    <p>${escapeHtml(vendor.whatsappNumber || 'No WhatsApp listed')}</p>
    <div class="action-row">
      ${
        phoneValue(vendor.whatsappNumber)
          ? `<a href="tel:${escapeAttribute(phoneValue(vendor.whatsappNumber))}" data-contact-event="direct_call" data-vendor-id="${escapeAttribute(vendor.id || vendor.vendorId || vendor.vendorCode)}" data-vendor-name="${escapeAttribute(vendor.name || vendor.tradingName || 'Vendor')}">Call</a>`
          : '<span>No call number</span>'
      }
      ${
        whatsappHref(vendor.whatsappNumber)
          ? `<a href="${escapeAttribute(whatsappHref(vendor.whatsappNumber))}" data-contact-event="whatsapp_vendor" data-vendor-id="${escapeAttribute(vendor.id || vendor.vendorId || vendor.vendorCode)}" data-vendor-name="${escapeAttribute(vendor.name || vendor.tradingName || 'Vendor')}">WhatsApp</a>`
          : '<span>No WhatsApp</span>'
      }
    </div>
  </article>
`

const renderCahLink = (link: unknown, index: number): string => {
  const record = (link || {}) as Record<string, unknown>
  const name = compactText(
    record.name ||
      record.whatsappCommunityName ||
      record.whatsappGroupName ||
      record.whatsappChannelName,
    `Access Link ${index + 1}`
  )
  const rawType = safeString(record.type || '').toLowerCase()
  const type = rawType.includes('channel')
    ? 'Channel'
    : rawType.includes('community')
      ? 'Community'
      : 'Group'
  const sector = compactText(record.sector || record.category, 'General')
  const url = safeString(
    record.whatsappUrl ||
      record.url ||
      record.whatsappCommunityLink ||
      record.whatsappGroupLink ||
      record.whatsappChannelLink ||
      record.catalogueDistributionGroupLink ||
      record.customerDiscoveryGroupLink ||
      record.vendorSupportGroupLink ||
      record.rpnSupportGroupLink
  ).trim()
  const safeWhatsappUrl =
    url.startsWith('https://chat.whatsapp.com/') ||
    url.startsWith('https://wa.me/') ||
    url.startsWith('https://whatsapp.com/channel/')
      ? url
      : ''
  const searchText = [
    name,
    type,
    sector,
    record.description,
    record.targetAudience,
    record.province,
    record.cityTown,
    record.district
  ].join(' ')

  return `
    <article class="link-card" data-hub-search="${escapeAttribute(searchText)}">
      <h3>${escapeHtml(name)}</h3>
      <p>${escapeHtml(type)} / ${escapeHtml(sector)}</p>
      <p>${escapeHtml(record.description || record.label || 'Commerce Access Hub WhatsApp link')}</p>
      ${
        safeWhatsappUrl
          ? `<a class="hub-open" href="${escapeAttribute(safeWhatsappUrl)}" data-hub-open="1" data-hub-name="${escapeAttribute(name)}" data-hub-type="${escapeAttribute(type)}">Open WhatsApp link</a>`
          : '<span class="hub-open disabled">No WhatsApp link</span>'
      }
    </article>
  `
}

const renderSupportCard = (): string => `
  <article class="support-card">
    <h3>Need help with this catalogue?</h3>
    <p>Contact seiGEN Commerce support.</p>
    <div class="support-actions">
      <a href="${escapeAttribute(SEIGEN_SUPPORT_TEL)}">Call direct</a>
      <a href="${escapeAttribute(SEIGEN_SUPPORT_WHATSAPP)}">Message via WhatsApp</a>
    </div>
  </article>
`

const renderLegalBlock = (title: string, value: unknown): string => `
  <article class="legal-block">
    <h3>${escapeHtml(title)}</h3>
    ${safeString(value)
      .split(/\n\s*\n/)
      .map(paragraph => `<p>${escapeHtml(paragraph.trim())}</p>`)
      .join('')}
  </article>
`

export function buildItredOfflineCatalogueHtml(
  input: ItredCatalogueExportInput
): string {
  const title = 'iTred Market Place'
  const appName = compactText(input.branding?.appName, 'iTred')
  const legal = {
    privacyPolicy: compactText(input.legal?.privacyPolicy, CATALOGUE_LEGAL_SOT.privacyPolicy),
    businessTerms: compactText(input.legal?.businessTerms, CATALOGUE_LEGAL_SOT.businessTerms),
    warranties: compactText(input.legal?.warranties, CATALOGUE_LEGAL_SOT.warranties),
    indemnity: compactText(input.legal?.indemnity, CATALOGUE_LEGAL_SOT.indemnity)
  }
  const logoDataUri = dataUriOnly(input.branding?.logoDataUri) || DEFAULT_HEADER_LOGO_DATA_URI
  const products = safeArray<CatalogueProduct>(input.products)
    .slice()
    .sort(compareProductsForDiscovery)
  const vendors = safeArray<CatalogueVendor>(input.vendors)
    .slice()
    .sort((a, b) => {
      if (isVerifiedVendor(a) !== isVerifiedVendor(b)) return isVerifiedVendor(a) ? -1 : 1
      return safeString(a.name || a.tradingName).localeCompare(safeString(b.name || b.tradingName))
    })
  const cahLinks = safeArray(input.cahLinks).filter(link => {
    const record = (link || {}) as Record<string, unknown>
    const status = safeString(record.status || record.publishStatus || 'published')
      .trim()
      .toLowerCase()
    return record.publishToCatalogue !== false && !['draft', 'inactive', 'hidden', 'unpublished'].includes(status)
  })
  const productsWithTrend = products.filter(product => trendScore(product) > 0)
  const trendingProducts = (productsWithTrend.length ? productsWithTrend : products)
    .slice()
    .sort(compareProductsForDiscovery)
    .slice(0, 12)
  const discoveryProducts = productDiscoveryData(products, vendors)
  const hasStockData = products.some(product => Number.isFinite(product.stockQuantity))

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--ink:#1f1b1c;--muted:#706b66;--line:#dedbd7;--paper:#f4f3f1;--card:#f8f7f4;--soft:#ece9e5;--accent:#f97316;--accent-dark:#c2410c;--ok:#047857;--warn:#b45309}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif;padding-bottom:86px}
    header{position:sticky;top:0;z-index:5;background:var(--accent);color:#fff;border-bottom:0;box-shadow:0 8px 22px rgba(31,27,28,.16)}
    .topbar{display:flex;align-items:center;gap:10px;padding:10px 12px}
    .logo{width:38px;height:38px;background:rgba(31,27,28,.18);color:#fff;display:grid;place-items:center;font-size:13px;font-weight:900;border:1px solid rgba(255,255,255,.35);overflow:hidden}
    .logo img{width:100%;height:100%;object-fit:contain}
    .title{min-width:0}
    .title h1{margin:0;font-size:14px;letter-spacing:0}
    .title p{margin:2px 0 0;color:#fff7ed;font-size:9px;font-weight:700;line-height:1.35}
    nav{position:fixed;left:10px;right:10px;bottom:10px;z-index:6;display:grid;grid-template-columns:repeat(6,1fr);background:rgba(248,247,244,.78);border:1px solid rgba(31,27,28,.12);box-shadow:0 14px 34px rgba(31,27,28,.2);backdrop-filter:blur(14px);padding:5px;border-radius:14px}
    nav button{border:0;background:transparent;padding:9px 4px 8px;font-size:8px;font-weight:900;color:var(--muted);min-height:50px;border-radius:10px;transition:background .18s ease,color .18s ease,transform .18s ease}
    nav button:active{transform:translateY(1px)}
    nav button.active{background:var(--accent);color:#fff;box-shadow:0 6px 16px rgba(249,115,22,.32)}
    main{padding:12px;max-width:980px;margin:0 auto}
    section{display:none}
    section.active{display:block}
    .section-head{margin:0 0 10px;border-left:4px solid var(--accent);padding-left:8px}
    .section-head h2{margin:0;font-size:16px;letter-spacing:0}
    .section-head p{margin:4px 0 0;color:var(--muted);font-size:10px;font-weight:800}
    .result-count{margin:0;color:var(--muted);font-size:10px;font-weight:900}
    .discovery-tools{position:sticky;top:58px;z-index:4;background:rgba(244,243,241,.78);padding:0 0 10px;display:grid;gap:7px;backdrop-filter:blur(10px)}
    .discovery-tools input,.discovery-tools select{width:100%;border:1px solid rgba(31,27,28,.16);background:rgba(255,255,255,.68);padding:10px;font-size:11px;font-weight:800;outline:0;border-radius:8px;box-shadow:0 5px 18px rgba(31,27,28,.06);backdrop-filter:blur(8px)}
    .filter-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .stock-toggle{display:flex;align-items:center;gap:7px;border:1px solid rgba(31,27,28,.16);background:rgba(255,255,255,.68);padding:9px 10px;font-size:10px;font-weight:900;border-radius:8px;box-shadow:0 5px 18px rgba(31,27,28,.06);backdrop-filter:blur(8px)}
    .stock-toggle input{width:auto;margin:0;accent-color:var(--accent)}
    .grid{display:grid;grid-template-columns:1fr;gap:8px}
    .product-card,.vendor-card,.link-card,.legal-block,.support-card{background:linear-gradient(135deg,var(--card),var(--soft));border:1px solid rgba(31,27,28,.1);padding:9px;box-shadow:0 8px 22px rgba(31,27,28,.07)}
    .product-card{display:grid;grid-template-columns:72px 1fr;gap:9px}
    .verified-card{border-color:rgba(249,115,22,.48);box-shadow:inset 0 0 0 1px rgba(31,27,28,.06)}
    .product-image{width:72px;height:72px;background:#f0ebe5;display:grid;place-items:center;color:#a8a19a;font-size:8px;font-weight:900;overflow:hidden}
    .product-image img{width:100%;height:100%;object-fit:cover}
    .product-topline,.badges,.price-row,.action-row,.product-actions,.cart-actions,.qty-row,.detail-actions{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
    .product-topline span,.badges span{border:1px solid var(--line);padding:2px 4px;font-size:7px;font-weight:900;color:var(--muted)}
    h3{margin:5px 0 3px;font-size:12px;line-height:1.2}
    .muted,.sku,.vendor-card p,.link-card p,.legal-block p,.support-card p{margin:3px 0;color:var(--muted);font-size:10px;line-height:1.35}
    .support-card{border-left:4px solid var(--accent);background:linear-gradient(135deg,#fff7ed,var(--card));margin:0 0 10px}
    .support-card h3{margin:0 0 4px;font-size:13px;color:var(--ink)}
    .support-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .support-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:34px;border:1px solid rgba(249,115,22,.34);background:var(--ink);color:#fff;text-decoration:none;padding:8px 10px;font-size:9px;font-weight:900}
    .vendor-line{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
    .verified-badge{display:inline-flex;align-items:center;border:1px solid rgba(249,115,22,.55);background:rgba(31,27,28,.86);color:#fff3e9;padding:2px 5px;font-size:7px;font-weight:900;line-height:1;backdrop-filter:blur(7px)}
    .legal-block p + p{margin-top:8px}
    .price-row{justify-content:space-between;margin-top:6px}
    .price-row strong{font-size:13px;color:var(--accent-dark)}
    .price-row small{font-size:9px;color:var(--muted);font-weight:900}
    .action-row{margin-top:8px}
    .action-row a,.action-row span,.hub-open{border:0;background:transparent;color:var(--ink);text-decoration:none;padding:8px 6px;font-size:10px;font-weight:900}
    .action-row span{color:var(--muted)}
    .hub-open{display:inline-block;margin-top:8px}
    .hub-open.disabled{background:#f3eee8;color:var(--muted);border-color:var(--line)}
    .product-actions{margin-top:7px}
    .product-actions button,.product-actions a,.product-actions span,.cart-actions button,.cart-actions a,.qty-row button,.detail-actions button,.detail-actions a{border:0;background:transparent;color:var(--ink);text-decoration:none;padding:7px 6px;font-size:9px;font-weight:900}
    .product-actions span{color:var(--muted)}
    .tap-hint{margin:7px 0 0;color:var(--accent-dark);font-size:9px;font-weight:900}
    .cart-count{display:inline-grid;place-items:center;min-width:16px;height:16px;background:var(--accent);color:#fff;margin-left:2px;font-size:9px}
    .cart-vendor{background:#fff;border:1px solid var(--line);padding:10px;margin-bottom:10px}
    .cart-item{border-top:1px solid var(--line);padding:8px 0}
    .cart-item:first-of-type{border-top:0}
    .cart-item h4{margin:0 0 4px;font-size:11px}
    .cart-meta{margin:0 0 6px;color:var(--muted);font-size:10px}
    .qty-row button{min-width:30px;padding:5px 8px}
    .qty-row strong{font-size:12px}
    .detail-backdrop{position:fixed;inset:0;z-index:7;background:rgba(31,27,28,.34);display:none;padding:12px;align-items:flex-end}
    .detail-backdrop.open{display:flex}
    .detail-panel{width:100%;max-height:88vh;overflow:auto;background:rgba(248,247,244,.94);border:1px solid rgba(255,255,255,.42);box-shadow:0 -16px 44px rgba(31,27,28,.3);backdrop-filter:blur(16px);padding:14px;border-radius:14px 14px 0 0}
    .detail-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:10px}
    .detail-close{border:0;background:transparent;color:var(--ink);font-size:20px;font-weight:900}
    .detail-head-actions{display:flex;align-items:center;gap:8px}
    .modal-cart-badge{display:inline-flex;align-items:center;background:rgba(249,115,22,.12);border:1px solid rgba(249,115,22,.35);color:var(--accent-dark);padding:5px 8px;font-size:9px;font-weight:900;border-radius:999px}
    .detail-vendor{border:1px solid rgba(31,27,28,.1);background:rgba(255,255,255,.54);padding:9px;margin-top:8px}
    .detail-vendor h4{margin:0 0 4px;font-size:11px}
    .detail-actions{margin-top:7px}
    .detail-actions .action-feedback{color:var(--accent-dark);background:rgba(249,115,22,.1);border-radius:999px}
    .detail-feedback{display:none;margin-top:6px;color:var(--accent-dark);font-size:9px;font-weight:900}
    .detail-feedback.show{display:block}
    .modal-image-wrap{display:grid;gap:5px}
    .modal-image-wrap .product-image{touch-action:manipulation;cursor:zoom-in}
    .zoom-backdrop{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:rgba(12,10,9,.9);padding:16px}
    .zoom-backdrop.open{display:flex}
    .zoom-panel{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
    .zoom-panel img{max-width:100%;max-height:100%;object-fit:contain;border:1px solid rgba(255,255,255,.16);box-shadow:0 22px 60px rgba(0,0,0,.45);background:rgba(255,255,255,.04)}
    .zoom-close{position:absolute;top:8px;right:8px;border:1px solid rgba(255,255,255,.3);background:rgba(31,27,28,.72);color:#fff;width:38px;height:38px;border-radius:999px;font-size:20px;font-weight:900}
    .bi-stack{position:fixed;left:10px;right:10px;bottom:66px;z-index:8;display:grid;gap:8px;pointer-events:none}
    .bi-card{position:relative;background:rgba(31,27,28,.82);color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.22);backdrop-filter:blur(10px);padding:10px 34px 12px 11px;border-radius:8px;pointer-events:auto;animation:biIn .22s ease-out}
    .bi-card:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--accent)}
    .bi-card h4{margin:0 0 4px;font-size:11px}
    .bi-card p{margin:0;color:#eee;font-size:10px;line-height:1.35}
    .bi-card button{border:0;background:rgba(255,255,255,.12);color:#fff;font-size:11px}
    .bi-card .bi-close{position:absolute;top:6px;right:6px;width:22px;height:22px;font-size:14px}
    .bi-actions{display:flex;gap:6px;margin-top:8px}
    .bi-actions button{padding:5px 8px}
    @keyframes biIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    code{display:block;white-space:pre-wrap;word-break:break-word;background:#f6f1eb;padding:8px;font-size:10px}
    .empty{border:1px dashed var(--line);padding:20px;text-align:center;color:var(--muted);font-size:11px;font-weight:900}
    footer{padding:18px 16px;color:var(--muted);font-size:9px;text-align:center}
    @media (min-width:720px){body{padding-bottom:80px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.product-card{grid-template-columns:84px 1fr}.product-image{width:84px;height:84px}nav button{font-size:10px}}
    @media (min-width:980px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <div class="logo"><img src="${escapeAttribute(logoDataUri)}" alt="seiGEN Commerce"></div>
      <div class="title">
        <h1>${escapeHtml(title)}</h1>
        <p>Powered by seiGEN Commerce | Expires ${escapeHtml(input.expiresAt)}</p>
      </div>
    </div>
    <nav aria-label="Catalogue pages">
      <button type="button" class="active" data-page="trending">Trending</button>
      <button type="button" data-page="discovery">Discover</button>
      <button type="button" data-page="vendors">Vendors</button>
      <button type="button" data-page="access">Access Hub</button>
      <button type="button" data-page="legal">Legal</button>
      <button type="button" data-page="cart">Cart <span class="cart-count" id="cartCount">0</span></button>
    </nav>
  </header>
  <main>
    <section id="page-trending" class="active">
      <div class="section-head"><h2>Trending products</h2><p>${trendingProducts.length} highlighted products</p></div>
      <div class="grid">${trendingProducts.length ? trendingProducts.map(product => renderProductCard(product, vendors)).join('') : '<div class="empty">No trending products supplied.</div>'}</div>
    </section>
    <section id="page-discovery">
      <div class="section-head"><h2>Product discovery</h2><p>${products.length} catalogue products</p></div>
      <div class="discovery-tools">
        <input id="productSearch" type="search" placeholder="Search products, vendors, SKU, location...">
        <div class="filter-row">
          <select id="vendorFilter"><option value="">All vendors</option></select>
          <select id="categoryFilter"><option value="">All categories</option></select>
        </div>
        ${
          hasStockData
            ? '<label class="stock-toggle"><input id="stockOnly" type="checkbox"> In stock only</label>'
            : ''
        }
      </div>
      <div class="grid" id="productGrid"></div>
      <div class="empty" id="productEmpty" style="display:none">No products match these filters.</div>
    </section>
    <section id="page-vendors">
      <div class="section-head"><h2>Vendor directory</h2><p>${vendors.length} selected vendors</p></div>
      <div class="discovery-tools">
        <input id="vendorSearch" type="search" placeholder="Search vendors, sectors, locations, services...">
        <p class="result-count" id="vendorResultCount">Vendors found: ${vendors.length}</p>
      </div>
      <div class="grid" id="vendorGrid">${vendors.length ? vendors.map(renderVendorCard).join('') : '<div class="empty">No vendors supplied.</div>'}</div>
      <div class="empty" id="vendorEmpty" style="display:none">No vendors match your search.</div>
    </section>
    <section id="page-access">
      <div class="section-head"><h2>Commerce Access Hub links</h2><p>${cahLinks.length} WhatsApp hubs included</p></div>
      ${renderSupportCard()}
      <div class="discovery-tools"><input id="hubSearch" type="search" placeholder="Search hubs, sectors, groups..."></div>
      <div class="grid" id="hubGrid">${cahLinks.length ? cahLinks.map(renderCahLink).join('') : '<div class="empty">No Commerce Access Hub links were included in this catalogue.</div>'}</div>
      <div class="empty" id="hubEmpty" style="display:none">No Commerce Access Hub links match this search.</div>
    </section>
    <section id="page-legal">
      <div class="section-head"><h2>Legal</h2><p>Catalogue terms and policies</p></div>
      <div class="grid">
        ${renderLegalBlock('Privacy policy', legal.privacyPolicy)}
        ${renderLegalBlock('Business terms', legal.businessTerms)}
        ${renderLegalBlock('Warranties', legal.warranties)}
        ${renderLegalBlock('Indemnity and limitation of liability', legal.indemnity)}
      </div>
    </section>
    <section id="page-cart">
      <div class="section-head"><h2>Cart</h2><p>Offline cart stored on this device</p></div>
      <div id="cartPanel"></div>
    </section>
  </main>
  <div class="detail-backdrop" id="detailBackdrop" role="dialog" aria-modal="true" aria-label="Product details">
    <div class="detail-panel" id="detailPanel"></div>
  </div>
  <div class="zoom-backdrop" id="imageZoomBackdrop" aria-hidden="true">
    <div class="zoom-panel">
      <button class="zoom-close" type="button" data-close-zoom="1" aria-label="Close zoom">x</button>
      <img id="imageZoomTarget" alt="">
    </div>
  </div>
  <div class="bi-stack" id="biStack" aria-live="polite"></div>
  <footer>Powered by seiGEN Commerce OS</footer>
  <script type="application/json" id="catalogueProductData">${jsonForHtml(discoveryProducts)}</script>
  <script>
    (function(){
      var buttons = Array.prototype.slice.call(document.querySelectorAll('nav button[data-page]'));
      var sections = Array.prototype.slice.call(document.querySelectorAll('main section'));
      var productSearch = document.getElementById('productSearch');
      var hubSearch = document.getElementById('hubSearch');
      var vendorSearch = document.getElementById('vendorSearch');
      var vendorFilter = document.getElementById('vendorFilter');
      var categoryFilter = document.getElementById('categoryFilter');
      var stockOnly = document.getElementById('stockOnly');
      var productGrid = document.getElementById('productGrid');
      var productEmpty = document.getElementById('productEmpty');
      var cartCount = document.getElementById('cartCount');
      var cartPanel = document.getElementById('cartPanel');
      var detailBackdrop = document.getElementById('detailBackdrop');
      var detailPanel = document.getElementById('detailPanel');
      var imageZoomBackdrop = document.getElementById('imageZoomBackdrop');
      var imageZoomTarget = document.getElementById('imageZoomTarget');
      var productDataNode = document.getElementById('catalogueProductData');
      var hubCards = Array.prototype.slice.call(document.querySelectorAll('#hubGrid .link-card'));
      var hubEmpty = document.getElementById('hubEmpty');
      var vendorCards = Array.prototype.slice.call(document.querySelectorAll('#vendorGrid .vendor-card'));
      var vendorEmpty = document.getElementById('vendorEmpty');
      var vendorResultCount = document.getElementById('vendorResultCount');
      var products = [];
      var cartKey = 'itred-cart-${escapeAttribute(input.catalogueSerial)}';
      var biKey = 'itred-bi-${escapeAttribute(input.catalogueSerial)}';
      var logKey = 'itred-log-${escapeAttribute(input.catalogueSerial)}';
      var syncEndpoint = '${escapeAttribute(input.analytics?.syncEndpoint || '')}';
      var cart = {};
      var lastModalImageTapAt = 0;
      var biState = {dismissed:{},lastShown:{},metrics:{}};
      var biConfig = {welcomeIntervalHours:24,popupIntervalMinutes:20,expiryThresholdDays:3};
      try{products = JSON.parse(productDataNode ? productDataNode.textContent || '[]' : '[]');}catch(error){products = [];}
      try{cart = JSON.parse(localStorage.getItem(cartKey) || '{}') || {};}catch(error){cart = {};}
      try{biState = JSON.parse(localStorage.getItem(biKey) || '') || biState;}catch(error){}
      function esc(value){
        return String(value == null ? '' : value)
          .replace(/&/g,'&amp;')
          .replace(/</g,'&lt;')
          .replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;')
          .replace(/'/g,'&#39;');
      }
      function unique(values){
        var seen = {};
        return values.filter(function(value){
          value = String(value || '').trim();
          if(!value || seen[value]) return false;
          seen[value] = true;
          return true;
        }).sort();
      }
      function fillSelect(select, values){
        if(!select) return;
        unique(values).forEach(function(value){
          var option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        });
      }
      function readQueue(){
        try{
          var queue = JSON.parse(localStorage.getItem(logKey) || '[]');
          return Array.isArray(queue) ? queue : [];
        }catch(error){return [];}
      }
      function writeQueue(queue){
        try{localStorage.setItem(logKey, JSON.stringify(queue.slice(-500)));}catch(error){}
      }
      function eventId(){
        return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
      }
      function appendLog(event){
        try{
          var queue = readQueue();
          var now = Date.now();
          var duplicate = queue.slice(-8).some(function(item){
            return item.type === event.type &&
              item.vendorId === event.vendorId &&
              item.productId === event.productId &&
              item.query === event.query &&
              now - Number(item.timestampMs || 0) < 1500;
          });
          if(duplicate) return;
          queue.push({
            id:eventId(),
            type:event.type || 'interaction',
            vendorId:event.vendorId || '',
            vendorName:event.vendorName || '',
            productId:event.productId || '',
            productName:event.productName || '',
            query:event.query || '',
            timestamp:new Date().toISOString(),
            timestampMs:now,
            catalogueSerial:'${escapeAttribute(input.catalogueSerial)}',
            metadata:event.metadata || {}
          });
          writeQueue(queue);
          silentSync();
        }catch(error){}
      }
      function silentSync(){
        if(!syncEndpoint || !navigator.onLine || typeof fetch !== 'function') return;
        var queue = readQueue();
        if(queue.length === 0) return;
        var batch = queue.slice(0,50);
        fetch(syncEndpoint,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({catalogueSerial:'${escapeAttribute(input.catalogueSerial)}',events:batch})
        }).then(function(response){
          if(!response.ok) return;
          var sent = {};
          batch.forEach(function(item){sent[item.id] = true;});
          writeQueue(readQueue().filter(function(item){return !sent[item.id];}));
        }).catch(function(){});
      }
      function saveBi(){
        try{localStorage.setItem(biKey, JSON.stringify(biState));}catch(error){}
      }
      function biMetric(name){
        biState.metrics[name] = Number(biState.metrics[name] || 0) + 1;
        saveBi();
      }
      function canShowBi(id, intervalMs){
        var last = Number(biState.lastShown[id] || 0);
        return !last || Date.now() - last > intervalMs;
      }
      function showBi(id, title, message, intervalMs, feedbackType){
        if(!canShowBi(id, intervalMs || biConfig.popupIntervalMinutes * 60000)) return;
        var stack = document.getElementById('biStack');
        if(!stack) return;
        biState.lastShown[id] = Date.now();
        biMetric('shown_' + id);
        var card = document.createElement('div');
        card.className = 'bi-card';
        card.setAttribute('data-bi-id', id);
        card.innerHTML = '<button class="bi-close" type="button" aria-label="Close">×</button><h4>' + esc(title) + '</h4><p>' + esc(message) + '</p>' +
          (feedbackType ? '<div class="bi-actions"><button type="button" data-bi-feedback="' + esc(feedbackType) + '" data-feedback-value="yes">Yes</button><button type="button" data-bi-feedback="' + esc(feedbackType) + '" data-feedback-value="no">No</button></div>' : '');
        stack.appendChild(card);
        if(stack.children.length > 2) stack.removeChild(stack.children[0]);
        window.setTimeout(function(){if(card.parentNode) card.parentNode.removeChild(card);}, 9000);
        saveBi();
      }
      function dismissBi(card){
        var id = card && card.getAttribute ? card.getAttribute('data-bi-id') : '';
        if(id) biState.dismissed[id] = Date.now();
        biMetric('dismissed_' + id);
        saveBi();
        if(card && card.parentNode) card.parentNode.removeChild(card);
      }
      function expiryReminder(){
        var expiry = new Date('${escapeAttribute(input.expiresAt)}');
        if(Number.isNaN(expiry.getTime())) return;
        var days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
        if(days >= 0 && days <= biConfig.expiryThresholdDays){
          showBi('expiry','Catalogue update','This catalogue expires soon. Ask your Commerce Access Hub for the latest catalogue update.',12 * 3600000);
        }
      }
      function productRank(product){
        return (product.vv ? 100000 : 0) + (Number(product.q) > 0 ? 1000 : 0) + Number(product.t || 0);
      }
      function groupProducts(list){
        var groups = {};
        list.forEach(function(product){
          var key = product.g || product.s || product.n || product.id;
          if(!groups[key]){
            groups[key] = {key:key,name:product.n,sku:product.s,category:product.c,sector:product.se,image:product.i,description:product.d,products:[],min:0,max:0,stock:0,verified:false,search:''};
          }
          groups[key].products.push(product);
          if(product.i && !groups[key].image) groups[key].image = product.i;
          if(product.d && !groups[key].description) groups[key].description = product.d;
          groups[key].stock += Number(product.q || 0);
          groups[key].verified = groups[key].verified || product.vv === true;
          groups[key].search += ' ' + (product.x || '');
        });
        return Object.keys(groups).map(function(key){
          var group = groups[key];
          var prices = group.products.map(function(product){return Number(product.up || 0);}).filter(function(value){return value > 0;});
          group.min = prices.length ? Math.min.apply(null, prices) : 0;
          group.max = prices.length ? Math.max.apply(null, prices) : 0;
          group.products.sort(function(a,b){return productRank(b) - productRank(a) || String(a.v).localeCompare(String(b.v));});
          return group;
        }).sort(function(a,b){
          if(a.verified !== b.verified) return a.verified ? -1 : 1;
          if((a.stock > 0) !== (b.stock > 0)) return a.stock > 0 ? -1 : 1;
          return String(a.name).localeCompare(String(b.name));
        });
      }
      function priceRange(group){
        if(!group.min) return 'Price on request';
        if(group.min === group.max) return '$' + Math.round(group.min).toLocaleString('en-US');
        return '$' + Math.round(group.min).toLocaleString('en-US') + ' - $' + Math.round(group.max).toLocaleString('en-US');
      }
      function card(group){
        var image = group.image ? '<img src="' + esc(group.image) + '" alt="' + esc(group.name) + '">' : '<span>No image</span>';
        var availability = group.stock > 0 ? 'In stock' : 'Out of stock';
        return '<article class="product-card' + (group.verified ? ' verified-card' : '') + '" data-group-key="' + esc(group.key) + '" data-product-id="' + esc(group.products[0] ? group.products[0].id : '') + '" data-product-name="' + esc(group.name) + '" data-vendor-id="' + esc(group.products[0] ? group.products[0].vk : '') + '" data-vendor-name="' + esc(group.products[0] ? group.products[0].v : '') + '">' +
          '<div class="product-image">' + image + '</div>' +
          '<div class="product-body">' +
            '<div class="product-topline"><span>' + esc(group.category || 'Uncategorised') + '</span><span>' + esc(availability) + '</span></div>' +
            '<h3>' + esc(group.name) + '</h3>' +
            '<p class="muted">Available from ' + esc(group.products.length) + ' vendor' + (group.products.length === 1 ? '' : 's') + '</p>' +
            '<p class="sku">SKU: ' + esc(group.sku || 'N/A') + '</p>' +
            '<div class="badges"><span>' + esc(group.sector || 'General') + '</span><span>Total qty ' + esc(group.stock) + '</span></div>' +
            '<div class="price-row"><strong>' + esc(priceRange(group)) + '</strong><small>Tap for vendors</small></div>' +
          '</div>' +
        '</article>';
      }
      function matchesFreeOrder(product, query){
        if(!query) return true;
        var text = String(product.x || '').toLowerCase();
        return query.toLowerCase().trim().split(/\\s+/).every(function(part){return text.indexOf(part) !== -1;});
      }
      function renderProducts(){
        if(!productGrid) return;
        var query = productSearch ? productSearch.value : '';
        var vendor = vendorFilter ? vendorFilter.value : '';
        var category = categoryFilter ? categoryFilter.value : '';
        var inStock = stockOnly ? stockOnly.checked : false;
        var filtered = products.filter(function(product){
          if(vendor && product.v !== vendor) return false;
          if(category && product.c !== category) return false;
          if(inStock && Number(product.q) <= 0) return false;
          return matchesFreeOrder(product, query);
        });
        var groups = groupProducts(filtered);
        productGrid.innerHTML = groups.map(card).join('');
        if(productEmpty) productEmpty.style.display = groups.length ? 'none' : '';
      }
      function renderHubs(){
        if(!hubSearch) return;
        var query = hubSearch.value.toLowerCase().trim();
        var shown = 0;
        hubCards.forEach(function(card){
          var text = (card.getAttribute('data-hub-search') || '').toLowerCase();
          var visible = !query || query.split(/\\s+/).every(function(part){return text.indexOf(part) !== -1;});
          card.style.display = visible ? '' : 'none';
          if(visible) shown += 1;
        });
        if(hubEmpty) hubEmpty.style.display = shown ? 'none' : '';
      }
      function renderVendors(){
        if(!vendorSearch) return;
        var parts = vendorSearch.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);
        var shown = 0;
        vendorCards.forEach(function(card){
          var text = (card.getAttribute('data-vendor-search') || '').toLowerCase();
          var visible = parts.length === 0 || parts.every(function(part){return text.indexOf(part) !== -1;});
          card.style.display = visible ? '' : 'none';
          if(visible) shown += 1;
        });
        if(vendorResultCount) vendorResultCount.textContent = 'Vendors found: ' + shown;
        if(vendorEmpty) vendorEmpty.style.display = shown ? 'none' : '';
      }
      function saveCart(){
        try{localStorage.setItem(cartKey, JSON.stringify(cart));}catch(error){}
        renderCart();
      }
      function productById(id){
        for(var i=0;i<products.length;i++){if(products[i].id === id) return products[i];}
        return null;
      }
      function groupByKey(key){
        var list = products.filter(function(product){return product.g === key;});
        return groupProducts(list)[0] || null;
      }
      function groupForProduct(product){
        if(!product) return null;
        return groupByKey(product.g) || groupProducts([product])[0] || null;
      }
      function closeDetail(){
        if(detailBackdrop) detailBackdrop.classList.remove('open');
      }
      function openImageZoomFromNode(node){
        if(!node || !imageZoomBackdrop || !imageZoomTarget) return;
        var img = node.tagName === 'IMG' ? node : node.querySelector ? node.querySelector('img') : null;
        var src = img && img.getAttribute ? img.getAttribute('src') || '' : '';
        if(!src || src.indexOf('data:image/') !== 0) return;
        imageZoomTarget.setAttribute('src', src);
        imageZoomTarget.setAttribute('alt', img.getAttribute('alt') || 'Product image');
        imageZoomBackdrop.classList.add('open');
        imageZoomBackdrop.setAttribute('aria-hidden', 'false');
        appendLog({type:'product_image_zoom',productName:img.getAttribute('alt') || ''});
      }
      function closeImageZoom(){
        if(!imageZoomBackdrop || !imageZoomTarget) return;
        imageZoomBackdrop.classList.remove('open');
        imageZoomBackdrop.setAttribute('aria-hidden', 'true');
        imageZoomTarget.removeAttribute('src');
      }
      function openProductDetail(group){
        if(!group || !detailBackdrop || !detailPanel) return;
        var image = group.image ? '<img src="' + esc(group.image) + '" alt="' + esc(group.name) + '">' : '<span>No image</span>';
        var vendorsHtml = group.products.map(function(product){
          var wa = product.ph ? 'https://wa.me/' + String(product.ph).replace(/^\\+/, '') : '';
          return '<div class="detail-vendor' + (product.vv ? ' verified-card' : '') + '">' +
            '<h4>' + esc(product.v) + (product.vv ? ' <span class="verified-badge">Verified vendor</span>' : '') + '</h4>' +
            '<p class="muted">' + esc(product.l || 'Location not listed') + '</p>' +
            '<p class="muted">Stock ' + esc(product.q) + ' / Price ' + esc(product.p) + '</p>' +
            '<div class="detail-actions">' +
              '<button type="button" data-add-cart="' + esc(product.id) + '">+ Add to cart</button>' +
              (wa ? '<a href="' + esc(wa) + '" data-contact-event="whatsapp_vendor" data-product-id="' + esc(product.id) + '" data-product-name="' + esc(product.n) + '" data-vendor-id="' + esc(product.vk) + '" data-vendor-name="' + esc(product.v) + '">WA WhatsApp vendor</a>' : '<span>No WhatsApp</span>') +
              (product.ph ? '<a href="tel:' + esc(product.ph) + '" data-contact-event="direct_call" data-product-id="' + esc(product.id) + '" data-product-name="' + esc(product.n) + '" data-vendor-id="' + esc(product.vk) + '" data-vendor-name="' + esc(product.v) + '">Call vendor</a>' : '<span>No call</span>') +
            '</div>' +
            '<div class="detail-feedback" aria-live="polite"></div>' +
          '</div>';
        }).join('');
        detailPanel.innerHTML = '<div class="detail-head">' +
          '<div><h3>' + esc(group.name) + '</h3><p class="muted">' + esc(group.category || 'Uncategorised') + ' / ' + esc(group.sector || 'General') + '</p></div>' +
          '<div class="detail-head-actions"><span class="modal-cart-badge" id="modalCartCount">Cart: ' + esc(cartTotalCount()) + '</span><button class="detail-close" type="button" data-close-detail="1">x</button></div>' +
          '</div>' +
          '<div class="product-card" style="box-shadow:none;margin-top:10px"><div class="modal-image-wrap"><div class="product-image" data-zoom-image="1">' + image + '</div></div><div class="product-body">' +
          '<p class="muted">' + esc(group.description || 'No product description supplied.') + '</p>' +
          '<p class="sku">SKU: ' + esc(group.sku || 'N/A') + '</p>' +
          '<div class="price-row"><strong>' + esc(priceRange(group)) + '</strong><small>Total qty ' + esc(group.stock) + '</small></div>' +
          '<p class="tap-hint">Available from ' + esc(group.products.length) + ' vendor' + (group.products.length === 1 ? '' : 's') + '</p>' +
          '</div></div>' +
          vendorsHtml;
        detailBackdrop.classList.add('open');
        var first = group.products[0] || {};
        appendLog({type:'product_detail_open',vendorId:first.vk || '',vendorName:first.v || '',productId:first.id || '',productName:group.name || ''});
        biMetric('product_card_open');
        showBi('product_availability','Product availability','Did you find the product you were looking for?',biConfig.popupIntervalMinutes * 60000,'product_availability_feedback');
      }
      function cartTotalCount(){
        return Object.keys(cart).reduce(function(total,id){return total + Number(cart[id] || 0);},0);
      }
      function updateCartBadges(){
        var count = String(cartTotalCount());
        if(cartCount) cartCount.textContent = count;
        var modalCartCount = document.getElementById('modalCartCount');
        if(modalCartCount) modalCartCount.textContent = 'Cart: ' + count;
      }
      function showActionFeedback(node, message){
        if(!node) return;
        var original = node.getAttribute('data-original-label') || node.textContent || '';
        if(!node.getAttribute('data-original-label')) node.setAttribute('data-original-label', original);
        node.textContent = message;
        node.classList.add('action-feedback');
        var panel = node.closest ? node.closest('.detail-vendor') : null;
        var feedback = panel ? panel.querySelector('.detail-feedback') : null;
        if(feedback){
          feedback.textContent = message;
          feedback.classList.add('show');
        }
        window.setTimeout(function(){
          node.textContent = node.getAttribute('data-original-label') || original;
          node.classList.remove('action-feedback');
          if(feedback) feedback.classList.remove('show');
        }, 1600);
      }
      function addToCart(id){
        var product = productById(id);
        if(!product) return;
        cart[id] = Number(cart[id] || 0) + 1;
        appendLog({type:'add_to_cart',vendorId:product.vk,vendorName:product.v,productId:product.id,productName:product.n,metadata:{qty:cart[id]}});
        saveCart();
      }
      window.itredAddToCart = addToCart;
      function changeQty(id, delta){
        var next = Number(cart[id] || 0) + delta;
        if(next <= 0){delete cart[id];}else{cart[id] = next;}
        saveCart();
      }
      function clearCart(){
        cart = {};
        saveCart();
      }
      function groupedCartItems(){
        var groups = {};
        Object.keys(cart).forEach(function(id){
          var product = productById(id);
          var qty = Number(cart[id] || 0);
          if(!product || qty <= 0) return;
          var key = product.vk || product.v || 'vendor';
          if(!groups[key]) groups[key] = {vendor:product.v || 'Vendor', phone:product.ph || '', items:[]};
          groups[key].items.push({product:product, qty:qty});
        });
        return groups;
      }
      function cartPrice(value){
        var numberValue = Number(value);
        if(!Number.isFinite(numberValue) || numberValue <= 0) return 'Price on request';
        return '$' + Math.round(numberValue).toLocaleString('en-US');
      }
      function money(value){
        var numberValue = Number(value || 0);
        if(!Number.isFinite(numberValue) || numberValue <= 0) return 'POR';
        return '$' + Math.round(numberValue).toLocaleString('en-US');
      }
      function truncateText(text, len){
        text = String(text == null ? '' : text).replace(/\\s+/g, ' ').trim();
        if(text.length <= len) return text;
        return text.slice(0, Math.max(0, len - 3)).replace(/\\s+$/g, '') + '...';
      }
      function padRight(text, len){
        text = String(text == null ? '' : text);
        if(text.length >= len) return text.slice(0, len);
        return text + Array(len - text.length + 1).join(' ');
      }
      function padLeft(text, len){
        text = String(text == null ? '' : text);
        if(text.length >= len) return text;
        return Array(len - text.length + 1).join(' ') + text;
      }
      function receiptLine(len){
        return Array((len || 48) + 1).join('-');
      }
      function receiptDate(){
        return new Date().toISOString().slice(0, 10);
      }
      function customerNameValue(){
        var input = document.getElementById('customerName');
        return input && input.value ? input.value.trim() : '';
      }
      function orderMessage(group, customerName){
        var total = 0;
        var width = 54;
        var lines = [
          'iTred sales lead voucher',
          '',
          'Customer name: ' + customerName,
          'Vendor: ' + group.vendor,
          'Date: ' + receiptDate(),
          '',
          'Products',
          receiptLine(width),
          padRight('No', 4) + padRight('Product', 24) + padLeft('Qty', 5) + padLeft('UP', 8) + padLeft('Amt', 10),
          receiptLine(width)
        ];
        group.items.forEach(function(item, index){
          var product = item.product;
          var unitPrice = Number(product.up || 0);
          var qty = Number(item.qty || 0);
          var lineTotal = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice * qty : 0;
          if(lineTotal > 0) total += lineTotal;
          lines.push(
            padRight(String(index + 1) + '.', 4) +
            padRight(truncateText(product.n || 'Product', 24), 24) +
            padLeft(qty, 5) +
            padLeft(money(unitPrice), 8) +
            padLeft(money(lineTotal), 10)
          );
        });
        lines.push(receiptLine(width));
        lines.push(padRight('Total sales lead value:', 36) + padLeft(money(total), 18));
        lines.push(receiptLine(width));
        lines.push('');
        lines.push('Please confirm stock availability, pricing, collection/delivery options and payment instructions.');
        lines.push('');
        lines.push('Powered by seiGEN Commerce');
        return lines.join('\\n');
      }
      function renderCart(){
        var currentCustomerName = customerNameValue();
        updateCartBadges();
        if(!cartPanel) return;
        var groups = groupedCartItems();
        var keys = Object.keys(groups);
        if(keys.length === 0){
          cartPanel.innerHTML = '<div class="empty">Your cart is empty.</div>';
          return;
        }
        var html = '<div class="cart-actions"><label class="stock-toggle" style="width:100%"><span>Customer name</span><input id="customerName" type="text" placeholder="Enter your name" style="flex:1;border:0;background:transparent;outline:0;font-size:11px;font-weight:800"></label><button type="button" data-clear-cart="1">Clear cart</button></div>';
        keys.forEach(function(key){
          var group = groups[key];
          html += '<div class="cart-vendor"><h3>' + esc(group.vendor) + '</h3>';
          group.items.forEach(function(item){
            var product = item.product;
            var subtotal = Number(product.up) > 0 ? Number(product.up) * item.qty : 0;
            html += '<div class="cart-item">' +
              '<h4>' + esc(product.n) + '</h4>' +
              '<p class="cart-meta">Qty ' + esc(item.qty) + ' / Unit ' + esc(product.p) + (subtotal ? ' / Subtotal $' + esc(Math.round(subtotal).toLocaleString('en-US')) : '') + '</p>' +
              '<div class="qty-row">' +
                '<button type="button" data-qty-id="' + esc(product.id) + '" data-delta="-1">-</button>' +
                '<strong>' + esc(item.qty) + '</strong>' +
                '<button type="button" data-qty-id="' + esc(product.id) + '" data-delta="1">+</button>' +
                '<button type="button" data-remove-id="' + esc(product.id) + '">Remove</button>' +
              '</div>' +
            '</div>';
          });
          if(group.phone){
            html += '<div class="cart-actions"><a data-send-order="1" data-vendor-id="' + esc(key) + '" data-vendor-name="' + esc(group.vendor) + '" href="#">Send order to vendor</a></div>';
          }else{
            html += '<div class="empty">No WhatsApp number for this vendor.</div>';
          }
          html += '</div>';
        });
        cartPanel.innerHTML = html;
        var nameInput = document.getElementById('customerName');
        if(nameInput) nameInput.value = currentCustomerName;
      }
      function show(page){
        buttons.forEach(function(button){button.classList.toggle('active', button.getAttribute('data-page') === page);});
        sections.forEach(function(section){section.classList.toggle('active', section.id === 'page-' + page);});
        window.scrollTo(0,0);
        if(page === 'vendors'){
          showBi('vendor_view','Vendor service','How was the vendor response experience?',biConfig.popupIntervalMinutes * 60000,'vendor_service_feedback');
        }
      }
      buttons.forEach(function(button){
        button.addEventListener('click', function(){show(button.getAttribute('data-page'));});
      });
      document.addEventListener('click', function(event){
        var target = event.target;
        if(!target || !target.getAttribute) return;
        var feedbackType = target.getAttribute('data-bi-feedback');
        if(feedbackType){
          appendLog({type:feedbackType,metadata:{value:target.getAttribute('data-feedback-value') || ''}});
          dismissBi(target.closest('.bi-card'));
          return;
        }
        if(target.closest && target.closest('.bi-card .bi-close')){
          dismissBi(target.closest('.bi-card'));
          return;
        }
        var addId = target.getAttribute('data-add-cart');
        var qtyId = target.getAttribute('data-qty-id');
        var removeId = target.getAttribute('data-remove-id');
        var hubOpen = target.getAttribute('data-hub-open');
        if(target.getAttribute('data-close-detail')) closeDetail();
        if(target === detailBackdrop) closeDetail();
        if(target.getAttribute('data-close-zoom')) closeImageZoom();
        if(target === imageZoomBackdrop) closeImageZoom();
        if(addId){addToCart(addId); showActionFeedback(target, 'Added to cart ✓');}
        if(qtyId){changeQty(qtyId, Number(target.getAttribute('data-delta') || 0));}
        if(removeId){delete cart[removeId]; saveCart(); updateCartBadges();}
        if(target.getAttribute('data-clear-cart')){clearCart(); updateCartBadges();}
        if(target.getAttribute('data-send-order')){
          event.preventDefault();
          var name = customerNameValue();
          var input = document.getElementById('customerName');
          if(!name){
            if(input){
              input.focus();
              input.style.outline = '2px solid var(--accent)';
            }
            showActionFeedback(target, 'Please enter customer name');
            return;
          }
          if(input) input.style.outline = '';
          var vendorId = target.getAttribute('data-vendor-id') || '';
          var groups = groupedCartItems();
          var group = groups[vendorId];
          if(!group || !group.phone) return;
          var totalLeadValue = group.items.reduce(function(total,item){
            var value = Number(item.product.up) > 0 ? Number(item.product.up) * item.qty : 0;
            return total + value;
          },0);
          appendLog({
            type:'sales_lead_sent',
            vendorId:vendorId,
            vendorName:target.getAttribute('data-vendor-name') || '',
            timestamp:new Date().toISOString(),
            metadata:{
              productCount:group.items.length,
              totalLeadValue:Math.round(totalLeadValue),
              customerNameProvided:!!name,
              catalogueSerial:'${escapeAttribute(input.catalogueSerial)}'
            }
          });
          window.location.href = 'https://wa.me/' + String(group.phone).replace(/^\\+/, '') + '?text=' + encodeURIComponent(orderMessage(group, name));
          return;
        }
        if(hubOpen){
          appendLog({type:'access_hub_link_open',metadata:{hubName:target.getAttribute('data-hub-name') || '',hubType:target.getAttribute('data-hub-type') || ''}});
        }
        if(target.tagName === 'A'){
          var href = target.getAttribute('href') || '';
          if(href.indexOf('https://wa.me/') === 0 || href.indexOf('tel:') === 0){
            showActionFeedback(target, href.indexOf('tel:') === 0 ? 'Call started ✓' : 'WhatsApp opened ✓');
            appendLog({
              type:target.getAttribute('data-contact-event') || (href.indexOf('tel:') === 0 ? 'direct_call' : 'whatsapp_vendor_click'),
              vendorId:target.getAttribute('data-vendor-id') || '',
              vendorName:target.getAttribute('data-vendor-name') || '',
              productId:target.getAttribute('data-product-id') || '',
              productName:target.getAttribute('data-product-name') || ''
            });
            biMetric('vendor_contact_clicks');
            showBi('vendor_service','Vendor service','How was the vendor response experience?',biConfig.popupIntervalMinutes * 60000,'vendor_service_feedback');
          }
        }
        if(target.closest && target.closest('.product-card') && !addId && target.tagName !== 'A' && !target.getAttribute('data-close-detail')){
          var cardNode = target.closest('.product-card');
          if(detailPanel && detailPanel.contains(cardNode)) return;
          var groupKey = cardNode.getAttribute('data-group-key') || '';
          var product = productById(cardNode.getAttribute('data-product-id') || '');
          openProductDetail(groupKey ? groupByKey(groupKey) : groupForProduct(product));
        }
        if(target.closest && target.closest('.vendor-card') && target.tagName !== 'A'){
          var vendorNode = target.closest('.vendor-card');
          appendLog({
            type:'vendor_detail_open',
            vendorId:vendorNode.getAttribute('data-vendor-id') || '',
            vendorName:vendorNode.getAttribute('data-vendor-name') || ''
          });
        }
      });
      if(detailPanel){
        detailPanel.addEventListener('dblclick', function(event){
          var target = event.target;
          var imageNode = target && target.closest ? target.closest('[data-zoom-image]') : null;
          if(!imageNode) return;
          event.preventDefault();
          openImageZoomFromNode(imageNode);
        });
        detailPanel.addEventListener('touchend', function(event){
          var target = event.target;
          var imageNode = target && target.closest ? target.closest('[data-zoom-image]') : null;
          if(!imageNode) return;
          var now = Date.now();
          if(now - lastModalImageTapAt > 0 && now - lastModalImageTapAt <= 320){
            event.preventDefault();
            lastModalImageTapAt = 0;
            openImageZoomFromNode(imageNode);
            return;
          }
          lastModalImageTapAt = now;
        }, {passive:false});
      }
      document.addEventListener('keydown', function(event){
        if(event.key === 'Escape') closeImageZoom();
      });
      fillSelect(vendorFilter, products.map(function(product){return product.v;}));
      fillSelect(categoryFilter, products.map(function(product){return product.c;}));
      if(productSearch) productSearch.addEventListener('input', function(){
        renderProducts();
        if(productSearch.value.trim()){
          biMetric('product_searches');
          appendLog({type:'search_query',query:productSearch.value.trim(),metadata:{results:productGrid ? productGrid.children.length : 0}});
          if(Number(biState.metrics.product_searches || 0) % 3 === 0){
            showBi('product_search','Product availability','Did you find the product you were looking for?',biConfig.popupIntervalMinutes * 60000,'product_availability_feedback');
          }
        }
      });
      if(hubSearch) hubSearch.addEventListener('input', renderHubs);
      if(vendorSearch) vendorSearch.addEventListener('input', renderVendors);
      if(vendorFilter) vendorFilter.addEventListener('change', renderProducts);
      if(categoryFilter) categoryFilter.addEventListener('change', renderProducts);
      if(stockOnly) stockOnly.addEventListener('change', renderProducts);
      renderProducts();
      renderHubs();
      renderVendors();
      renderCart();
      window.addEventListener('online', silentSync);
      window.setTimeout(silentSync, 1500);
      showBi('welcome','Welcome to iTred Marketplace','Discover products from verified local vendors even without continuous internet access.',biConfig.welcomeIntervalHours * 3600000);
      expiryReminder();
    })();
  </script>
</body>
</html>`
}

export const estimateItredOfflineCatalogueHtmlBytes = (
  input: ItredCatalogueExportInput
): number => buildItredOfflineCatalogueHtml(input).length
