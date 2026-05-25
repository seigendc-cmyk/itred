import { CatalogueProduct, ImagePolicy } from './types'
import { safeArray, safeNumber } from './safe'

export interface CatalogueImageOptimizationResult {
  targetThumbnailPx: number
  targetWebpBytes: number
  supportsWebP: boolean
  includedImageCount: number
  oversizedImageCount: number
  imagesExcludedCount: number
  estimatedPayloadBytes: number
  estimatedPayloadKB: number
  estimatedPayloadMB: number
}

export const getOptimizedWebpThumbnail = (product: CatalogueProduct): string => {
  const raw = (product.raw || {}) as Record<string, unknown>
  const candidates = [
    raw.optimizedWebpThumbnail,
    raw.webpThumbnailDataUri,
    raw.thumbnailWebpDataUri,
    raw.optimizedImageDataUri,
    raw.imageOptimizationDataUri,
    product.imageUrl
  ]

  const value = candidates
    .map(candidate => (typeof candidate === 'string' ? candidate.trim() : ''))
    .find(candidate => candidate.startsWith('data:image/webp;'))

  return value || ''
}

export const estimateCatalogueImages = (
  productsInput: unknown,
  imagePolicy: ImagePolicy = 'auto_compress'
): CatalogueImageOptimizationResult => {
  const products = safeArray<CatalogueProduct>(productsInput)
  const targetWebpBytes = 8 * 1024
  const imageProducts = products.filter(product => !!getOptimizedWebpThumbnail(product))
  const oversizedImageCount = imageProducts.filter(product => {
    const raw = (product.raw || {}) as Record<string, unknown>
    return safeNumber(raw.imageOptimizationBytes) > targetWebpBytes
  }).length
  const imagesExcludedCount =
    imagePolicy === 'block_oversized' ? oversizedImageCount : 0
  const includedImageCount = Math.max(0, imageProducts.length - imagesExcludedCount)
  const estimatedPayloadBytes = includedImageCount * targetWebpBytes

  return {
    targetThumbnailPx: 160,
    targetWebpBytes,
    supportsWebP: true,
    includedImageCount,
    oversizedImageCount,
    imagesExcludedCount,
    estimatedPayloadBytes,
    estimatedPayloadKB: estimatedPayloadBytes / 1024,
    estimatedPayloadMB: estimatedPayloadBytes / 1024 / 1024
  }
}
