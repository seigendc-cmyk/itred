import { PricingPlan, Vendor } from '../types.ts'

const GALLERY_PLAN_TERMS = [
  'property agent',
  'real estate',
  'vehicle agent',
  'vehicle dealer',
  'car sales'
]

const normalize = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()

export const isPropertyOrVehicleContext = (
  vendor?: Partial<Vendor> | null,
  plan?: Partial<PricingPlan> | null,
  listing?: { sector?: string | null; category?: string | null } | null
) => {
  const blob = [
    vendor?.sector,
    vendor?.category,
    (vendor as any)?.businessType,
    plan?.id,
    plan?.name,
    ...(plan?.features || []),
    listing?.sector,
    listing?.category
  ]
    .map(normalize)
    .join(' ')

  return GALLERY_PLAN_TERMS.some(term => blob.includes(term))
}

export const getMaxImagesForListing = (
  vendor?: Partial<Vendor> | null,
  plan?: Partial<PricingPlan> | null,
  listing?: { sector?: string | null; category?: string | null } | null
) => {
  const planLimit =
    Number(plan?.maxImagesPerListing ?? plan?.maxImagesPerProduct) || 0
  if (planLimit > 0) return planLimit
  return isPropertyOrVehicleContext(vendor, plan, listing) ? 6 : 1
}

export const normalizeListingImages = (
  record: any,
  limit = Number.MAX_SAFE_INTEGER
) => {
  const rawImages = [
    ...(Array.isArray(record?.images) ? record.images : []),
    ...(Array.isArray(record?.galleryImages) ? record.galleryImages : []),
    ...(Array.isArray(record?.imageUrls) ? record.imageUrls : []),
    ...(Array.isArray(record?.additionalImages) ? record.additionalImages : []),
    record?.imageUrl,
    record?.vendorProductImage
  ]

  const seen = new Set<string>()
  return rawImages
    .map((item: any, index) => {
      const url = String(
        typeof item === 'string' ? item : item?.url || item?.imageUrl || ''
      ).trim()
      if (!url || seen.has(url)) return null
      seen.add(url)
      return {
        url,
        alt: item?.alt ?? record?.name ?? record?.productName ?? null,
        sortOrder: Number(item?.sortOrder ?? index),
        isPrimary: item?.isPrimary === true || index === 0
      }
    })
    .filter(Boolean)
    .slice(0, Math.max(1, limit))
}

export const listingImageMetrics = (record: any, limit = 1) => {
  const imageCount = normalizeListingImages(record, limit).length
  return {
    imageCount,
    hasGallery: imageCount > 1,
    galleryCompletenessScore: Math.min(100, Math.round((imageCount / Math.max(1, limit)) * 100))
  }
}
