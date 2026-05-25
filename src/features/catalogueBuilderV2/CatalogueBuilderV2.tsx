import React, { useEffect, useMemo, useState } from 'react'
import { Search, CheckCircle2, AlertTriangle, Upload, Trash2 } from 'lucide-react'
import { DataPanel, PrimaryButton, SecondaryButton } from '../../components/CommonUI.tsx'
import { productService } from '../../services/productService.ts'
import { vendorService } from '../../services/vendorService.ts'
import { pricingPlanService } from '../../services/pricingPlanService.ts'
import { cahService } from '../../services/cahService.ts'
import { CAHLink } from '../../types.ts'
import { safeArray, safeBoolean, safeString } from './safe'
import {
  CataloguePlan,
  CatalogueProduct,
  CatalogueVendor,
  ImagePolicy
} from './types'
import { calculateCatalogueMetrics } from './catalogueMetrics'
import { resolveCatalogueEntitlements } from './catalogueEntitlements'
import {
  ITRED_OFFLINE_HTML_SIZE_LIMIT_BYTES,
  buildItredOfflineCatalogueHtml,
  estimateItredOfflineCatalogueHtmlBytes
} from './catalogueHtmlExporter'

const normalizePlanText = (value: unknown) =>
  safeString(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '')

const resolveVendorPlan = (
  vendor: CatalogueVendor | undefined,
  plans: CataloguePlan[]
) => {
  if (!vendor) return undefined
  const planId = safeString(vendor.planId).trim()
  const planName = normalizePlanText(vendor.planName)
  return (
    plans.find(plan => plan.id === planId) ||
    plans.find(plan => normalizePlanText(plan.name) === planName) ||
    plans.find(plan => normalizePlanText(plan.id) === planName)
  )
}

const formatLimit = (value: number | 'unlimited' | null) => {
  if (value === 'unlimited') return 'Unlimited'
  if (value === null) return 'Unresolved'
  return String(value)
}

const productBelongsToVendor = (product: CatalogueProduct, vendorId: string) =>
  product.id.startsWith(`${vendorId}:`)

const formatDateForFile = (date: Date) => date.toISOString().slice(0, 10)

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

const CATALOGUE_HEADER_LOGO_STORAGE_KEY = 'catalogueBuilderV2.catalogueHeaderLogoDataUri'
const HEADER_LOGO_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const HEADER_LOGO_MAX_SOURCE_BYTES = 12 * 1024 * 1024
const HEADER_LOGO_TARGET_HEIGHT = 40
const HEADER_LOGO_MAX_WIDTH = 240
const HEADER_LOGO_MAX_DATA_URI_BYTES = 48 * 1024

const supportsCanvasWebp = (canvas: HTMLCanvasElement): boolean => {
  try {
    return canvas.toDataURL('image/webp', 0.8).startsWith('data:image/webp')
  } catch {
    return false
  }
}

const readImageFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Unable to read the selected logo file.'))
    reader.readAsDataURL(file)
  })

const loadLogoImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load the selected logo image.'))
    image.src = src
  })

const optimizeCatalogueHeaderLogo = async (
  file: File
): Promise<{ dataUri: string; warning: string }> => {
  if (!HEADER_LOGO_ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Use a PNG, JPG/JPEG, or WebP logo.')
  }

  if (file.size > HEADER_LOGO_MAX_SOURCE_BYTES) {
    throw new Error(`Logo file is too large. Use an image below ${formatBytes(HEADER_LOGO_MAX_SOURCE_BYTES)}.`)
  }

  const sourceDataUrl = await readImageFileAsDataUrl(file)
  const image = await loadLogoImage(sourceDataUrl)
  const scale = Math.min(
    HEADER_LOGO_TARGET_HEIGHT / Math.max(1, image.naturalHeight),
    HEADER_LOGO_MAX_WIDTH / Math.max(1, image.naturalWidth),
    1
  )
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Logo optimization is not available in this browser.')
  }

  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)

  const webpSupported = supportsCanvasWebp(canvas)
  const candidates = webpSupported
    ? [
        canvas.toDataURL('image/webp', 0.78),
        canvas.toDataURL('image/webp', 0.62),
        canvas.toDataURL('image/png')
      ]
    : [canvas.toDataURL('image/png')]
  const dataUri =
    candidates.find(candidate => candidate.length <= HEADER_LOGO_MAX_DATA_URI_BYTES) ||
    candidates[candidates.length - 1]

  if (!dataUri.startsWith('data:image/')) {
    throw new Error('Logo optimization failed. Try a different PNG, JPG, or WebP file.')
  }

  return {
    dataUri,
    warning:
      dataUri.length > HEADER_LOGO_MAX_DATA_URI_BYTES
        ? `Logo was optimized, but is still ${formatBytes(dataUri.length)}. A simpler logo will keep the catalogue lighter.`
        : file.size > 2 * 1024 * 1024
          ? 'Large logo was compressed for offline export.'
          : ''
  }
}

const buildCatalogueSerial = () => {
  const datePart = formatDateForFile(new Date()).replace(/-/g, '')
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `ITRED-${datePart}-${randomPart.toUpperCase()}`
}

const isPublishedCahLink = (link: CAHLink) => {
  const status = safeString(link.status || 'active').trim().toLowerCase()
  return link.showInCatalogue !== false && status === 'active' && !!cahLinkUrl(link)
}

const cahLinkName = (link: CAHLink) =>
  safeString(
    link.name ||
      (link as Record<string, unknown>).title ||
      link.whatsappCommunityName ||
      link.whatsappGroupName ||
      link.whatsappChannelName ||
      link.id
  )

const cahLinkUrl = (link: CAHLink) =>
  safeString(
    link.whatsappCommunityLink ||
      link.whatsappGroupLink ||
      link.whatsappChannelLink ||
      link.whatsappUrl ||
      link.catalogueDistributionGroupLink ||
      link.customerDiscoveryGroupLink ||
      link.vendorSupportGroupLink ||
      link.rpnSupportGroupLink ||
      (link as Record<string, unknown>).url ||
      (link as Record<string, unknown>).link
  ).trim()

const cahLinkType = (link: CAHLink) => {
  const typeText = safeString(link.type).toLowerCase()
  const url = cahLinkUrl(link)
  if (typeText.includes('community') || link.whatsappCommunityLink) return 'Community'
  if (typeText.includes('channel') || link.whatsappChannelLink || url.includes('/channel/')) {
    return 'Channel'
  }
  if (typeText.includes('group') || link.whatsappGroupLink || url.includes('chat.whatsapp.com')) {
    return 'Group'
  }
  return 'Link'
}

const cahLinkStatus = (link: CAHLink) =>
  safeString(link.status || 'active').trim().toLowerCase() || 'active'

const cahLinkSearchText = (link: CAHLink) =>
  [
    cahLinkName(link),
    (link as Record<string, unknown>).title,
    link.description,
    link.sector,
    link.category,
    link.type,
    cahLinkType(link),
    cahLinkUrl(link),
    (link as Record<string, unknown>).city,
    link.cityTown,
    link.suburb,
    (link as Record<string, unknown>).tags,
    (link as Record<string, unknown>).notes
  ]
    .map(value => safeString(value).trim().toLowerCase())
    .filter(Boolean)
    .join(' ')

const cahLinkPriority = (link: CAHLink) => {
  const text = cahLinkSearchText(link)
  if (text.includes('vendors products discovery')) return 0
  if (text.includes('general commerce access hub')) return 1
  if (text.includes('global discovery')) return 2
  if (text.includes('all sector') || text.includes('all sectors')) return 3
  return 10
}

const cahLinkMatchesSearch = (link: CAHLink, query: string) => {
  const parts = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return true
  const text = cahLinkSearchText(link)
  return parts.every(part => text.includes(part))
}

const vendorWhatsapp = (vendor: CatalogueVendor) =>
  safeString(
    vendor.whatsappNumber ||
      vendor.supportWhatsappNumber ||
      vendor.whatsapp ||
      vendor.whatsappNo
  ).trim()

const vendorPhone = (vendor: CatalogueVendor) =>
  safeString(
    vendor.phoneNumber ||
      vendor.mobileNumber ||
      vendor.contactNumber ||
      vendor.phone ||
      vendor.tel ||
      vendor.whatsappNumber
  ).trim()

const vendorHasVerifiedBadge = (vendor: CatalogueVendor) =>
  vendor.inventorySpotCheckVerified === true && vendor.showVerifiedVendorBadge !== false

const ProductGrid: React.FC<{
  title: string
  products: CatalogueProduct[]
  selectedProductIds: string[]
  onToggle: (id: string) => void
}> = ({ title, products, selectedProductIds, onToggle }) => (
  <DataPanel title={title}>
    <div className='p-4 space-y-3'>
      {products.length === 0 ? (
        <p className='text-[10px] font-bold uppercase text-stone-400'>
          No products in this group.
        </p>
      ) : (
        <div className='grid grid-cols-1 gap-3'>
          {products.map(product => {
            const selected = selectedProductIds.includes(product.id)
            return (
              <button
                key={product.id}
                type='button'
                onClick={() => onToggle(product.id)}
                className={`w-full border p-3 text-left transition-colors ${
                  selected
                    ? 'border-brand-orange bg-orange-50'
                    : 'border-stone-200 bg-white hover:border-brand-orange'
                }`}
              >
                <div className='flex gap-3'>
                  <div className='h-14 w-14 shrink-0 overflow-hidden bg-stone-100'>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.productName}
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center text-[8px] font-black uppercase text-stone-300'>
                        No image
                      </div>
                    )}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-start justify-between gap-2'>
                      <p className='truncate text-[11px] font-black uppercase text-brand-charcoal'>
                        {product.productName}
                      </p>
                      <span className='shrink-0 text-[8px] font-black uppercase text-brand-orange'>
                        {product.productMode}
                      </span>
                    </div>
                    <div className='mt-1 flex flex-wrap items-center gap-1'>
                      <p className='truncate text-[9px] font-black uppercase text-brand-charcoal'>
                        {product.vendorName || product.vendorCode || 'Vendor'}
                      </p>
                      {product.isVerifiedVendor && (
                        <span className='border border-brand-orange/40 bg-brand-charcoal/90 px-1.5 py-0.5 text-[7px] font-black uppercase text-orange-100 shadow-sm'>
                          Verified Vendor
                        </span>
                      )}
                    </div>
                    <p className='mt-1 truncate text-[9px] font-bold uppercase text-stone-400'>
                      {product.sku || 'No SKU'} / Stock {product.stockQuantity} /{' '}
                      {product.publishToCatalogue ? 'Published' : 'Hidden'}
                    </p>
                    <div className='mt-2 flex flex-wrap gap-1'>
                      <span
                        className={`border px-1.5 py-0.5 text-[8px] font-black uppercase ${
                          product.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span
                        className={`border px-1.5 py-0.5 text-[8px] font-black uppercase ${
                          product.publishToCatalogue
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {product.publishToCatalogue ? 'Published' : 'Unpublished'}
                      </span>
                      <span
                        className={`border px-1.5 py-0.5 text-[8px] font-black uppercase ${
                          product.stockQuantity > 0
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-stone-300 bg-stone-100 text-stone-600'
                        }`}
                      >
                        {product.stockQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                    <p className='mt-1 truncate text-[9px] font-mono text-stone-500'>
                      {product.status} / {product.imageUrl ? 'image' : 'no image'} /{' '}
                      {product.sellingPrice}
                    </p>
                  </div>
                  {selected && (
                    <CheckCircle2 className='mt-1 text-brand-orange' size={14} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  </DataPanel>
)

export const CatalogueBuilderV2: React.FC = () => {
  const [vendors, setVendors] = useState<CatalogueVendor[]>([])
  const [products, setProducts] = useState<unknown[]>([])
  const [plans, setPlans] = useState<CataloguePlan[]>([])
  const [cahLinks, setCahLinks] = useState<CAHLink[]>([])
  const [totalCahLinksLoaded, setTotalCahLinksLoaded] = useState(0)
  const [cahLinksSource, setCahLinksSource] = useState('Loading...')
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [selectedCahLinkIds, setSelectedCahLinkIds] = useState<string[]>([])
  const [cahLinkSearch, setCahLinkSearch] = useState('')
  const [search, setSearch] = useState('')
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('all')
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false)
  const [imagePolicy, setImagePolicy] = useState<ImagePolicy>('auto_compress')
  const [catalogueHeaderLogoDataUri, setCatalogueHeaderLogoDataUri] = useState('')
  const [catalogueHeaderLogoWarning, setCatalogueHeaderLogoWarning] = useState('')
  const [isOptimizingHeaderLogo, setIsOptimizingHeaderLogo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [exportWarning, setExportWarning] = useState('')

  useEffect(() => {
    try {
      const storedLogo = localStorage.getItem(CATALOGUE_HEADER_LOGO_STORAGE_KEY) || ''
      if (storedLogo.startsWith('data:image/')) {
        setCatalogueHeaderLogoDataUri(storedLogo)
      }
    } catch {
      setCatalogueHeaderLogoWarning('Saved logo could not be restored in this browser.')
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setLoadError('')
      try {
        const [rawVendors, rawProducts, rawPlans] = await Promise.all([
          vendorService.getVendors(),
          productService.getProducts(),
          pricingPlanService.getPlans()
        ])
        let rawCahLinks: CAHLink[] = []
        try {
          rawCahLinks = await cahService.loadCAHLinksFromFirebase()
          setCahLinksSource('Firebase')
        } catch {
          rawCahLinks = cahService.getLinks()
          setCahLinksSource('Local fallback')
        }
        const publishedCahLinks = safeArray<CAHLink>(rawCahLinks)
          .map((link, index) => ({
            ...link,
            id: safeString(link.id || link.firestoreDocId || link.cahId || `cah-link-${index}`)
          }))
          .filter(isPublishedCahLink)
          .sort(
            (a, b) =>
              cahLinkPriority(a) - cahLinkPriority(b) ||
              cahLinkName(a).localeCompare(cahLinkName(b))
          )
        setVendors(
          safeArray<Record<string, unknown>>(rawVendors).map(vendor => ({
            ...vendor,
            id: safeString(vendor.id || vendor.vendorId),
            name: safeString(vendor.name || vendor.tradingName || vendor.vendorName || 'Vendor'),
            tradingName: safeString(vendor.tradingName),
            planId: safeString(vendor.planId || vendor.activePlanId),
            planName: safeString(vendor.planName),
            subscriptionStatus: safeString(vendor.subscriptionStatus || 'active'),
            inventorySpotCheckVerified: safeBoolean(
              vendor.inventorySpotCheckVerified,
              false
            ),
            inventorySpotCheckVerifiedAt: vendor.inventorySpotCheckVerifiedAt,
            showVerifiedVendorBadge:
              vendor.showVerifiedVendorBadge === undefined
                ? safeBoolean(vendor.inventorySpotCheckVerified, false)
                : safeBoolean(vendor.showVerifiedVendorBadge, false),
            verifiedBadgeDisabledAt: vendor.verifiedBadgeDisabledAt,
            verifiedBadgeDisabledBy: safeString(vendor.verifiedBadgeDisabledBy)
          }))
        )
        setProducts(safeArray(rawProducts))
        setPlans(
          safeArray<Record<string, unknown>>(rawPlans).map(plan => ({
            ...plan,
            id: safeString(plan.id),
            name: safeString(plan.name || plan.id || 'Plan')
          }))
        )
        setTotalCahLinksLoaded(safeArray<CAHLink>(rawCahLinks).length)
        setCahLinks(publishedCahLinks)
        setSelectedCahLinkIds(publishedCahLinks.map(link => link.id))
      } catch (error) {
        console.warn('Catalogue Builder V2 failed to load source data', error)
        setLoadError('Failed to load catalogue builder source data.')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const selectedVendors = useMemo(
    () => vendors.filter(vendor => selectedVendorIds.includes(vendor.id)),
    [selectedVendorIds, vendors]
  )
  const selectedCahLinks = useMemo(
    () => cahLinks.filter(link => selectedCahLinkIds.includes(link.id)),
    [cahLinks, selectedCahLinkIds]
  )
  const filteredCahLinks = useMemo(
    () => cahLinks.filter(link => cahLinkMatchesSearch(link, cahLinkSearch)),
    [cahLinkSearch, cahLinks]
  )
  const entitlementsByVendorId = useMemo(
    () =>
      selectedVendors.reduce<Record<string, ReturnType<typeof resolveCatalogueEntitlements>>>(
        (entitlements, vendor) => {
          entitlements[vendor.id] = resolveCatalogueEntitlements(
            vendor,
            resolveVendorPlan(vendor, plans)
          )
          return entitlements
        },
        {}
      ),
    [plans, selectedVendors]
  )
  const metrics = useMemo(
    () =>
      calculateCatalogueMetrics({
        storefrontProducts: products,
        selectedVendors,
        selectedProductIds,
        search,
        entitlementsByVendorId,
        imagePolicy,
        includeOutOfStock
      }),
    [
      entitlementsByVendorId,
      imagePolicy,
      includeOutOfStock,
      products,
      search,
      selectedProductIds,
      selectedVendors
    ]
  )
  const exportPreviewInput = useMemo(() => {
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + 14)
    return {
      title: 'iTred Offline Catalogue',
      catalogueSerial: 'ITRED-PREVIEW',
      generatedAt: formatDateForFile(now),
      expiresAt: formatDateForFile(expiresAt),
      products: metrics.includedProducts,
      vendors: selectedVendors,
      cahLinks: selectedCahLinks,
      branding: {
        appName: 'iTred',
        logoDataUri: catalogueHeaderLogoDataUri,
        poweredBy: 'Powered by seiGEN Commerce OS'
      }
    }
  }, [catalogueHeaderLogoDataUri, metrics.includedProducts, selectedCahLinks, selectedVendors])
  const estimatedHtmlBytes = useMemo(
    () => estimateItredOfflineCatalogueHtmlBytes(exportPreviewInput),
    [exportPreviewInput]
  )
  const exportReadiness = useMemo(() => {
    const vendorsMissingWhatsapp = selectedVendors.filter(vendor => !vendorWhatsapp(vendor))
    const vendorsMissingPhone = selectedVendors.filter(vendor => !vendorPhone(vendor))
    const productsWithoutImages = Math.max(0, metrics.includedCount - metrics.includedImageCount)
    const outOfStockProducts = metrics.includedProducts.filter(
      product => product.stockQuantity <= 0
    ).length
    const largePayload =
      estimatedHtmlBytes > ITRED_OFFLINE_HTML_SIZE_LIMIT_BYTES
    const warnings = [
      ...vendorsMissingWhatsapp.map(
        vendor => `${vendor.name || vendor.vendorCode || vendor.id} missing WhatsApp.`
      ),
      ...vendorsMissingPhone.map(
        vendor => `${vendor.name || vendor.vendorCode || vendor.id} missing direct call.`
      ),
      ...(productsWithoutImages > 0
        ? [`${productsWithoutImages} product(s) without optimized images.`]
        : []),
      ...(outOfStockProducts > 0
        ? [`${outOfStockProducts} included product(s) are out of stock.`]
        : []),
      ...(largePayload
        ? [
            `Estimated HTML size ${formatBytes(
              estimatedHtmlBytes
            )} exceeds ${formatBytes(ITRED_OFFLINE_HTML_SIZE_LIMIT_BYTES)}.`
          ]
        : []),
      ...(selectedCahLinks.length === 0 ? ['No CAH links selected.'] : [])
    ]

    return {
      selectedVendorsCount: selectedVendors.length,
      includedProductsCount: metrics.includedCount,
      vendorsWithWhatsapp: selectedVendors.length - vendorsMissingWhatsapp.length,
      vendorsWithPhone: selectedVendors.length - vendorsMissingPhone.length,
      cahLinksCount: selectedCahLinks.length,
      totalCahLinksLoaded,
      publishedCahLinksCount: cahLinks.length,
      selectedCahLinksCount: selectedCahLinkIds.length,
      exportedCahLinksCount: selectedCahLinks.length,
      productsWithoutImages,
      outOfStockProducts,
      largePayload,
      warnings
    }
  }, [
    estimatedHtmlBytes,
    metrics.includedCount,
    metrics.includedImageCount,
    metrics.includedProducts,
    cahLinks.length,
    selectedCahLinkIds.length,
    selectedCahLinks.length,
    totalCahLinksLoaded,
    selectedVendors
  ])

  useEffect(() => {
    if (selectedVendorFilter !== 'all' && !selectedVendorIds.includes(selectedVendorFilter)) {
      setSelectedVendorFilter('all')
    }
  }, [selectedVendorFilter, selectedVendorIds])

  const visibleCandidateProducts = useMemo(
    () =>
      selectedVendorFilter === 'all'
        ? metrics.candidateProducts
        : metrics.candidateProducts.filter(product =>
            productBelongsToVendor(product, selectedVendorFilter)
          ),
    [metrics.candidateProducts, selectedVendorFilter]
  )

  const linkedProducts = visibleCandidateProducts.filter(
    product => product.productMode === 'linked'
  )
  const brandedProducts = visibleCandidateProducts.filter(
    product => product.productMode === 'branded'
  )
  const addSelectedProductIds = (ids: string[]) => {
    setSelectedProductIds(prev => Array.from(new Set([...prev, ...ids])))
  }
  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }
  const toggleCahLink = (id: string) => {
    setSelectedCahLinkIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }
  const selectAllPublishedCahLinks = () => {
    setSelectedCahLinkIds(cahLinks.map(link => link.id))
  }
  const clearSelectedCahLinks = () => {
    setSelectedCahLinkIds([])
  }
  const toggleVendor = (vendorId: string) => {
    setSelectedVendorIds(prev =>
      prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    )
    if (selectedVendorIds.includes(vendorId)) {
      setSelectedProductIds(prev => prev.filter(id => !id.startsWith(`${vendorId}:`)))
    }
  }
  const handleHeaderLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setIsOptimizingHeaderLogo(true)
    setCatalogueHeaderLogoWarning('')

    try {
      const result = await optimizeCatalogueHeaderLogo(file)
      setCatalogueHeaderLogoDataUri(result.dataUri)
      setCatalogueHeaderLogoWarning(result.warning)
      try {
        localStorage.setItem(CATALOGUE_HEADER_LOGO_STORAGE_KEY, result.dataUri)
      } catch {
        setCatalogueHeaderLogoWarning(
          result.warning || 'Logo preview is ready, but could not be saved for next time.'
        )
      }
    } catch (error) {
      setCatalogueHeaderLogoWarning(
        error instanceof Error
          ? error.message
          : 'Logo could not be processed. Use a PNG, JPG/JPEG, or WebP file.'
      )
    } finally {
      setIsOptimizingHeaderLogo(false)
    }
  }
  const handleClearHeaderLogo = () => {
    setCatalogueHeaderLogoDataUri('')
    setCatalogueHeaderLogoWarning('')
    try {
      localStorage.removeItem(CATALOGUE_HEADER_LOGO_STORAGE_KEY)
    } catch {
      setCatalogueHeaderLogoWarning('Logo removed for this session, but saved storage could not be cleared.')
    }
  }
  const handleGenerateOfflineHtml = () => {
    if (selectedVendors.length === 0) {
      setExportWarning('Select at least one vendor before generating an offline catalogue.')
      return
    }
    if (metrics.includedProducts.length === 0) {
      setExportWarning('Select at least one included product before generating an offline catalogue.')
      return
    }
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + 14)
    const catalogueSerial = buildCatalogueSerial()
    const html = buildItredOfflineCatalogueHtml({
      title: 'iTred Offline Catalogue',
      catalogueSerial,
      generatedAt: formatDateForFile(now),
      expiresAt: formatDateForFile(expiresAt),
      products: metrics.includedProducts,
      vendors: selectedVendors,
      cahLinks: selectedCahLinks,
      branding: {
          appName: 'iTred',
          logoDataUri: catalogueHeaderLogoDataUri,
          poweredBy: 'Powered by seiGEN Commerce OS'
        }
      })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `iTred_Catalogue_${catalogueSerial}_${formatDateForFile(now)}.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setExportWarning('')
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-xl font-black uppercase text-brand-charcoal'>
          Catalogue Builder
        </h2>
        <p className='text-xs font-bold uppercase text-stone-400'>
          Isolated source loading, normalization, matching, metrics, and entitlement checks.
        </p>
      </div>

      {loadError && (
        <div className='border border-red-200 bg-red-50 p-3 text-xs font-bold uppercase text-red-700'>
          {loadError}
        </div>
      )}

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='space-y-6'>
          <DataPanel title='Vendor Selection'>
            <div className='p-4 space-y-3'>
              <p className='text-[10px] font-bold uppercase text-stone-400'>
                {isLoading ? 'Loading source data...' : `${vendors.length} vendors loaded`}
              </p>
              <p className='text-[10px] font-black uppercase text-brand-orange'>
                Selected Vendors: {selectedVendorIds.length}
              </p>
              <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
                {vendors.map(vendor => {
                  const selected = selectedVendorIds.includes(vendor.id)
                  const verified = vendorHasVerifiedBadge(vendor)
                  return (
                    <button
                      key={vendor.id}
                      type='button'
                      onClick={() => toggleVendor(vendor.id)}
                      className={`border p-3 text-left ${
                        selected
                          ? 'border-brand-orange bg-orange-50'
                          : verified
                            ? 'border-brand-orange/40 bg-white shadow-sm'
                            : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div className='flex flex-wrap items-center gap-2'>
                        <p className='text-[11px] font-black uppercase text-brand-charcoal'>
                          {vendor.name}
                        </p>
                        {verified && (
                          <span className='border border-brand-orange/40 bg-brand-charcoal px-1.5 py-0.5 text-[7px] font-black uppercase text-orange-100'>
                            Verified Vendor
                          </span>
                        )}
                      </div>
                      <p className='text-[9px] font-bold uppercase text-stone-400'>
                        {vendor.vendorCode || vendor.id} / {vendor.planName || vendor.planId || 'No plan'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </DataPanel>

          <DataPanel title='Product Source Diagnostics'>
            <div className='grid grid-cols-2 gap-3 p-4 text-[10px] font-bold uppercase text-stone-500 md:grid-cols-4'>
              <span>Storefront source: {metrics.storefrontSourceCount}</span>
              <span>Vendor matched: {metrics.vendorMatchedCount}</span>
              <span>Active: {metrics.diagnostics.activeCount}</span>
              <span>Published: {metrics.diagnostics.publishedCount}</span>
              <span>In stock: {metrics.inStockCount}</span>
              <span>Out of stock: {metrics.outOfStockCount}</span>
              <span>Candidates: {metrics.candidateCount}</span>
              <span>Active filtered: {metrics.activeFilteredCount}</span>
              <span>Publish filtered: {metrics.publishFilteredCount}</span>
              <span>Stock filtered: {metrics.stockFilteredCount}</span>
              <span>
                Include out of stock: {includeOutOfStock ? 'Enabled' : 'Disabled'}
              </span>
              <span>Linked: {metrics.linkedCount}</span>
              <span>Branded: {metrics.brandedCount}</span>
              <span>Selected: {metrics.selectedCount}</span>
            </div>
          </DataPanel>

          <DataPanel title='Product Selection'>
            <div className='p-4 space-y-3'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400' size={14} />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder='Search by product name or SKU'
                  className='w-full border border-stone-200 py-2 pl-9 pr-3 text-xs font-bold uppercase outline-none focus:border-brand-orange'
                />
              </div>
              <div className='flex flex-wrap gap-2'>
                <SecondaryButton
                  size='sm'
                  onClick={() =>
                    addSelectedProductIds(visibleCandidateProducts.map(product => product.id))
                  }
                >
                  Select All Visible
                </SecondaryButton>
                <SecondaryButton size='sm' onClick={() => setSelectedProductIds([])}>
                  Clear Selected
                </SecondaryButton>
                <SecondaryButton
                  size='sm'
                  disabled={selectedVendorFilter === 'all'}
                  onClick={() =>
                    addSelectedProductIds(
                      visibleCandidateProducts
                        .filter(product => productBelongsToVendor(product, selectedVendorFilter))
                        .map(product => product.id)
                    )
                  }
                >
                  Select Vendor Products
                </SecondaryButton>
                <SecondaryButton
                  size='sm'
                  onClick={() =>
                    addSelectedProductIds(
                      visibleCandidateProducts
                        .filter(product => product.productMode === 'linked')
                        .map(product => product.id)
                    )
                  }
                >
                  Select Linked Only
                </SecondaryButton>
                <SecondaryButton
                  size='sm'
                  onClick={() =>
                    addSelectedProductIds(
                      visibleCandidateProducts
                        .filter(product => product.productMode === 'branded')
                        .map(product => product.id)
                    )
                  }
                >
                  Select Branded Only
                </SecondaryButton>
                <select
                  value={selectedVendorFilter}
                  onChange={event => setSelectedVendorFilter(event.target.value)}
                  className='border border-stone-200 px-2 text-[10px] font-bold uppercase'
                >
                  <option value='all'>All Selected Vendors</option>
                  {selectedVendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                <label className='flex items-center gap-2 border border-stone-200 px-2 py-1 text-[10px] font-bold uppercase text-stone-600'>
                  <input
                    type='checkbox'
                    checked={includeOutOfStock}
                    onChange={event => setIncludeOutOfStock(event.target.checked)}
                    className='h-3 w-3 accent-brand-orange'
                  />
                  Include Out-of-Stock Products
                </label>
                <select
                  value={imagePolicy}
                  onChange={event => setImagePolicy(event.target.value as ImagePolicy)}
                  className='border border-stone-200 px-2 text-[10px] font-bold uppercase'
                >
                  <option value='auto_compress'>Auto Compress</option>
                  <option value='exclude_oversized'>Exclude Oversized</option>
                  <option value='block_oversized'>Block Oversized</option>
                </select>
                <span className='text-[10px] font-black uppercase text-brand-orange'>
                  {selectedProductIds.length} selected
                </span>
              </div>
            </div>
          </DataPanel>

          <ProductGrid
            title='Linked Products'
            products={linkedProducts}
            selectedProductIds={selectedProductIds}
            onToggle={toggleProduct}
          />
          <ProductGrid
            title='Branded Products'
            products={brandedProducts}
            selectedProductIds={selectedProductIds}
            onToggle={toggleProduct}
          />

          <DataPanel title='Commerce Access Hub Links'>
            <div className='p-4 space-y-3'>
              <div className='grid grid-cols-2 gap-3 text-[10px] font-bold uppercase text-stone-500 md:grid-cols-4'>
                <span>Total loaded: {totalCahLinksLoaded}</span>
                <span>Published: {cahLinks.length}</span>
                <span>Selected: {selectedCahLinkIds.length}</span>
                <span>Exported: {selectedCahLinks.length}</span>
                <span className='md:col-span-4'>Source: {cahLinksSource}</span>
              </div>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400' size={14} />
                <input
                  value={cahLinkSearch}
                  onChange={event => setCahLinkSearch(event.target.value)}
                  placeholder='Search Access Hub links'
                  className='w-full border border-stone-200 py-2 pl-9 pr-3 text-xs font-bold uppercase outline-none focus:border-brand-orange'
                />
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <SecondaryButton
                  size='sm'
                  disabled={cahLinks.length === 0}
                  onClick={selectAllPublishedCahLinks}
                >
                  Select All Published Links
                </SecondaryButton>
                <SecondaryButton size='sm' onClick={clearSelectedCahLinks}>
                  Clear Selected Links
                </SecondaryButton>
                <span className='text-[10px] font-black uppercase text-brand-orange'>
                  {selectedCahLinks.length} Included
                </span>
              </div>
              {cahLinks.length === 0 ? (
                <p className='text-[10px] font-bold uppercase text-stone-400'>
                  No published Commerce Access Hub links found.
                </p>
              ) : (
                <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
                  {filteredCahLinks.map(link => {
                    const selected = selectedCahLinkIds.includes(link.id)
                    const url = cahLinkUrl(link)
                    return (
                      <button
                        key={link.id}
                        type='button'
                        onClick={() => toggleCahLink(link.id)}
                        className={`border p-3 text-left ${
                          selected
                            ? 'border-brand-orange bg-orange-50'
                            : 'border-stone-200 bg-white hover:border-brand-orange'
                        }`}
                      >
                        <div className='flex items-start gap-3'>
                          <input
                            type='checkbox'
                            checked={selected}
                            onChange={() => toggleCahLink(link.id)}
                            onClick={event => event.stopPropagation()}
                            className='mt-0.5 h-3 w-3 accent-brand-orange'
                          />
                          <div className='min-w-0 flex-1'>
                            <p className='truncate text-[11px] font-black uppercase text-brand-charcoal'>
                              {cahLinkName(link)}
                            </p>
                            <p className='text-[9px] font-bold uppercase text-stone-400'>
                              {cahLinkType(link)} / {link.sector || link.category || 'General'} / {cahLinkStatus(link)}
                            </p>
                            <p className='mt-1 break-all text-[9px] font-mono normal-case text-stone-500'>
                              {url}
                            </p>
                          </div>
                          {selected && (
                            <CheckCircle2 className='mt-0.5 shrink-0 text-brand-orange' size={14} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {filteredCahLinks.length === 0 && (
                    <div className='border border-stone-200 bg-stone-50 p-4 text-[10px] font-bold uppercase text-stone-400 md:col-span-2'>
                      No Access Hub links match this search.
                    </div>
                  )}
                </div>
              )}
            </div>
          </DataPanel>
        </div>

        <div className='space-y-6'>
          <DataPanel title='Plan Entitlements'>
            <div className='p-4 space-y-2 text-[10px] font-bold uppercase text-stone-500'>
              {metrics.vendorMetrics.length === 0 ? (
                <p>Select vendors to resolve plan entitlements.</p>
              ) : (
                metrics.vendorMetrics.map(row => {
                  const entitlement = entitlementsByVendorId[row.vendorId]
                  return (
                    <div key={row.vendorId} className='border-b border-stone-100 pb-2 last:border-0 last:pb-0'>
                      <p className='text-brand-charcoal'>{row.vendorName}</p>
                      <p>Plan: {row.planName}</p>
                      <p>Product limit: {formatLimit(row.productLimit)}</p>
                      <p>
                        Image allowance:{' '}
                        {formatLimit(entitlement?.imageAllowance ?? null)}
                      </p>
                      <p>
                        Deployments remaining:{' '}
                        {formatLimit(entitlement?.deploymentsRemaining ?? null)}
                      </p>
                      {entitlement?.unresolvedLimit && (
                        <p className='text-amber-600'>
                          Plan product limit is not configured.
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </DataPanel>

          <DataPanel title='Review Checklist'>
            <div className='p-4 space-y-3'>
              {metrics.diagnostics.warnings.length === 0 ? (
                <div className='flex items-center gap-2 text-emerald-600'>
                  <CheckCircle2 size={14} />
                  <p className='text-[10px] font-black uppercase'>Ready to create</p>
                </div>
              ) : (
                metrics.diagnostics.warnings.map((warning, index) => (
                  <div key={index} className='flex gap-2 text-red-600'>
                    <AlertTriangle size={14} className='shrink-0' />
                    <p className='text-[10px] font-bold uppercase'>{warning}</p>
                  </div>
                ))
              )}
              <div className='border border-stone-200 bg-stone-50 p-3 text-[9px] font-mono uppercase text-stone-500'>
                <p>
                  Vendors: {metrics.diagnostics.vendorName || 'N/A'}
                </p>
                <p>
                  Products: storefront {metrics.storefrontSourceCount} / matched{' '}
                  {metrics.vendorMatchedCount} / candidates {metrics.candidateCount}
                </p>
                <p>
                  Stock: active {metrics.diagnostics.activeCount} / published{' '}
                  {metrics.diagnostics.publishedCount} / in stock {metrics.inStockCount}{' '}
                  / out of stock {metrics.outOfStockCount} / filtered by stock{' '}
                  {metrics.stockFilteredCount} / include out of stock{' '}
                  {includeOutOfStock ? 'enabled' : 'disabled'}
                </p>
                <p>
                  Plan: {metrics.diagnostics.resolvedPlanName} / limit{' '}
                  {formatLimit(metrics.diagnostics.resolvedProductLimit)}
                </p>
                {metrics.vendorMetrics.map(row => (
                  <p key={row.vendorId}>
                    {row.vendorName}: matched {row.matchedCount} / candidates{' '}
                    {row.candidateCount} / selected {row.selectedCount} / included{' '}
                    {row.includedCount} / plan {row.planName} / limit{' '}
                    {formatLimit(row.productLimit)}
                  </p>
                ))}
              </div>
            </div>
          </DataPanel>

          <DataPanel title='Deployment Summary'>
            <div className='p-4 space-y-3 text-[10px] font-bold uppercase text-stone-500'>
              <div className='grid grid-cols-2 gap-3'>
                <span>Included: {metrics.includedCount}</span>
                <span>Excluded: {metrics.excludedCount}</span>
                <span>Selected: {metrics.selectedCount}</span>
                <span>Linked: {metrics.linkedCount}</span>
                <span>Branded: {metrics.brandedCount}</span>
                <span>Estimated payload: {metrics.estimatedPayloadMB.toFixed(2)} MB</span>
              </div>
              <div className='space-y-2'>
                {metrics.vendorMetrics.map(row => (
                  <div key={row.vendorId} className='border border-stone-200 bg-stone-50 p-2'>
                    <p className='font-black text-brand-charcoal'>{row.vendorName}</p>
                    <p>Plan: {row.planName}</p>
                    <p>
                      Matched {row.matchedCount} / candidates {row.candidateCount} /
                      selected {row.selectedCount} / included {row.includedCount}
                    </p>
                    <p>
                      Stock filtered {row.stockFilteredCount} / publish filtered{' '}
                      {row.publishFilteredCount}
                    </p>
                    <p>
                      Remaining allowance: {formatLimit(row.remainingAllowance)} / limit{' '}
                      {formatLimit(row.productLimit)}
                    </p>
                    {row.blockReason && <p className='text-red-600'>{row.blockReason}</p>}
                  </div>
                ))}
              </div>
            </div>
          </DataPanel>

          <DataPanel title='Catalogue Header Logo'>
            <div className='p-4 space-y-3 text-[10px] font-bold uppercase text-stone-500'>
              <div>
                <p className='text-[11px] font-black text-brand-charcoal'>
                  Catalogue header logo
                </p>
                <p className='mt-1 leading-relaxed'>
                  This logo appears before iTred Market Place in the exported offline catalogue.
                </p>
              </div>
              <div className='border border-stone-200 bg-stone-50 p-3'>
                <div className='flex items-center gap-3'>
                  <div className='flex h-11 w-24 shrink-0 items-center justify-center overflow-hidden border border-stone-200 bg-white'>
                    {catalogueHeaderLogoDataUri ? (
                      <img
                        src={catalogueHeaderLogoDataUri}
                        alt='Catalogue header logo preview'
                        className='max-h-10 max-w-full object-contain'
                      />
                    ) : (
                      <span className='text-[8px] font-black text-stone-300'>
                        No logo
                      </span>
                    )}
                  </div>
                  <div className='min-w-0'>
                    <p className='text-brand-charcoal'>
                      {catalogueHeaderLogoDataUri ? 'Preview ready' : 'Default header fallback'}
                    </p>
                    <p className='normal-case text-stone-400'>
                      PNG, JPG/JPEG, or WebP. Optimized to an embedded data URI.
                    </p>
                  </div>
                </div>
              </div>
              <div className='flex flex-wrap gap-2'>
                <label className='inline-flex cursor-pointer items-center gap-2 border border-brand-orange bg-brand-orange px-3 py-2 text-[10px] font-black uppercase text-white transition-colors hover:bg-orange-600'>
                  <Upload size={13} />
                  {isOptimizingHeaderLogo ? 'Optimizing...' : 'Upload Logo'}
                  <input
                    type='file'
                    accept='image/png,image/jpeg,image/webp'
                    onChange={handleHeaderLogoUpload}
                    disabled={isOptimizingHeaderLogo}
                    className='sr-only'
                  />
                </label>
                <SecondaryButton
                  size='sm'
                  onClick={handleClearHeaderLogo}
                  disabled={!catalogueHeaderLogoDataUri || isOptimizingHeaderLogo}
                >
                  <span className='inline-flex items-center gap-2'>
                    <Trash2 size={12} />
                    Clear Logo
                  </span>
                </SecondaryButton>
              </div>
              {catalogueHeaderLogoDataUri && (
                <p>
                  Embedded logo payload: {formatBytes(catalogueHeaderLogoDataUri.length)}
                </p>
              )}
              {catalogueHeaderLogoWarning && (
                <div className='flex gap-2 border border-amber-200 bg-amber-50 p-2 text-amber-700'>
                  <AlertTriangle size={14} className='shrink-0' />
                  <p>{catalogueHeaderLogoWarning}</p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel title='Image Optimization'>
            <div className='p-4 space-y-2 text-[10px] font-bold uppercase text-stone-500'>
              <p>Target: 160px WebP thumbnails</p>
              <p>Estimated payload: {metrics.estimatedPayloadMB.toFixed(2)} MB</p>
              <p>Included images: {metrics.includedImageCount}</p>
              <p>Oversized images: {metrics.oversizedImageCount}</p>
              <p>Oversized excluded: {metrics.imagesExcludedCount}</p>
            </div>
          </DataPanel>

          <DataPanel title='Offline Catalogue Export Readiness'>
            <div className='p-4 space-y-3 text-[10px] font-bold uppercase text-stone-500'>
              <div className='grid grid-cols-2 gap-3'>
                <span>Selected vendors: {exportReadiness.selectedVendorsCount}</span>
                <span>Included products: {exportReadiness.includedProductsCount}</span>
                <span>Vendors with WhatsApp: {exportReadiness.vendorsWithWhatsapp}</span>
                <span>Vendors with phone: {exportReadiness.vendorsWithPhone}</span>
                <span>CAH links: {exportReadiness.cahLinksCount}</span>
                <span>CAH loaded: {exportReadiness.totalCahLinksLoaded}</span>
                <span>CAH published: {exportReadiness.publishedCahLinksCount}</span>
                <span>CAH selected: {exportReadiness.selectedCahLinksCount}</span>
                <span>CAH exported: {exportReadiness.exportedCahLinksCount}</span>
                <span>Image payload: {formatBytes(metrics.estimatedPayloadBytes)}</span>
                <span>HTML estimate: {formatBytes(estimatedHtmlBytes)}</span>
                <span>Legal page: Included</span>
                <span>Cart: Enabled</span>
                <span>Zero-internet ready: Yes</span>
              </div>
              {exportReadiness.warnings.length > 0 ? (
                <div className='space-y-2'>
                  {exportReadiness.warnings.map((warning, index) => (
                    <div key={index} className='flex gap-2 text-amber-700'>
                      <AlertTriangle size={14} className='shrink-0' />
                      <p>{warning}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='flex items-center gap-2 text-emerald-600'>
                  <CheckCircle2 size={14} />
                  <p>Ready for offline export.</p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel title='Catalogue Performance'>
            <div className='p-4 space-y-2 text-[10px] font-bold uppercase text-stone-500'>
              <p>Product count: {metrics.includedCount}</p>
              <p>Image count: {metrics.includedImageCount}</p>
              <p>Estimated HTML size: {formatBytes(estimatedHtmlBytes)}</p>
              <p>Estimated image payload: {formatBytes(metrics.estimatedPayloadBytes)}</p>
              <p>Oversized excluded: {metrics.imagesExcludedCount}</p>
              {estimatedHtmlBytes > ITRED_OFFLINE_HTML_SIZE_LIMIT_BYTES && (
                <div className='border border-amber-200 bg-amber-50 p-2 text-amber-700'>
                  Estimated HTML size exceeds {formatBytes(ITRED_OFFLINE_HTML_SIZE_LIMIT_BYTES)}.
                  Reduce products or image payload before download.
                </div>
              )}
              {exportWarning && (
                <div className='border border-amber-200 bg-amber-50 p-2 text-amber-700'>
                  {exportWarning}
                </div>
              )}
              <PrimaryButton size='sm' onClick={handleGenerateOfflineHtml}>
                Generate iTred Offline HTML
              </PrimaryButton>
            </div>
          </DataPanel>
        </div>
      </div>
    </div>
  )
}

export default CatalogueBuilderV2
