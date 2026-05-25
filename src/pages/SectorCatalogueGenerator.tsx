/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  collection,
  getDocs,
  limit as firestoreLimit,
  query,
  where
} from 'firebase/firestore'
import {
  PageHeader,
  DataPanel,
  PrimaryButton,
  SecondaryButton,
  BrandedAlertModal,
  ConfirmDialog,
  SearchableComboBox,
  StatusBadge
} from '../components/CommonUI.tsx'
import {
  FileCode,
  Play,
  Download,
  Copy,
  Search,
  CheckCircle2,
  Package,
  Users,
  Building,
  Eye,
  Settings,
  AlertTriangle,
  Archive,
  Globe,
  Trash2,
  Edit3,
  Filter,
  Plus,
  MessageSquare,
  Loader2
} from 'lucide-react'
import { catalogueService } from '../services/catalogueService.ts'
import {
  CatalogueGeneration,
  Vendor,
  Product,
  MasterProduct,
  VendorProductOffer,
  CAHLink,
  PricingPlan,
  DeploymentStatus,
  CatalogueContactHubSettings,
  SystemSettings,
  WhatsAppActivityLog,
  WhatsAppIntelligenceLog,
  Branch
} from '../types.ts'
import { generateCatalogueHtml } from '../lib/catalogueTemplate.ts'
import { cahService } from '../services/cahService.ts'
import { pricingPlanService } from '../services/pricingPlanService.ts'
import { permissionService } from '../services/permissionService.ts'
import { analyticsService } from '../services/analyticsService.ts'
import { asArray as safeDataArray } from '../utils/safeData.ts'
import { vendorService } from '../services/vendorService.ts'
import { productService } from '../services/productService.ts'
import { contactHubService } from '../services/contactHubService.ts'
import { settingsService } from '../services/settingsService.ts'
import { focusMainContent } from '../utils/uiHelpers.ts'
import {
  buildSearchText,
  matchesFreeOrderSearch
} from '../utils/searchUtils.ts'
import { WhatsAppActivityQuickLog } from '../components/WhatsAppActivityQuickLog.tsx'
import { staffAuditService } from '../services/staffAuditService.ts'
import { approvalService } from '../services/approvalService.ts'
import { notificationService } from '../services/notificationService.ts'
import { whatsappActivityService } from '../services/whatsappActivityService.ts'
import { taxonomyService } from '../services/taxonomyService.ts'
import {
  optimizeCatalogueImages,
  CatalogueImageOptimizationSummary
} from '../services/catalogueImageOptimizer.ts'
import { planEntitlementService } from '../services/planEntitlementService.ts'
import { vendorPlanUsageService } from '../services/vendorPlanUsageService.ts'
import { catalogueUsageLedgerService } from '../services/catalogueUsageLedgerService.ts'
import {
  generateVendorPlanUsageBillPdf,
  VendorPlanUsageBill
} from '../services/vendorPlanUsageBillPdfService.ts'
import { catalogueDeploymentService } from '../services/catalogueDeploymentService.ts'
import { subscriptionService } from '../services/subscriptionService.ts'
import {
  SectorOption,
  sectorIndexService
} from '../services/sectorIndexService.ts'
import { masterDataCacheService } from '../services/masterDataCacheService.ts'
import { useMasterDataCache } from '../hooks/useMasterDataCache.ts'
import { sanitizeForFirestore } from '../utils/firestoreSanitize.ts'
import { firebaseHealthService } from '../services/firebaseHealthService.ts'
import {
  isProductQuotaBillable,
  getBillableProductsForVendor
} from '../utils/planQuotaUtils.ts'
import {
  canGenerateCatalogue,
  resolveCatalogueProductLimit
} from '../services/entitlementEngine.ts'
import { db } from '../lib/firebase.ts'
import {
  buildVendorProductExportRows,
  exportVendorProductRows
} from '../utils/vendorProductExport.ts'
import {
  getMaxImagesForListing,
  listingImageMetrics,
  normalizeListingImages
} from '../utils/listingImageEntitlements.ts'

const MAX_CATALOGUE_SIZE_BYTES = 12 * 1024 * 1024
const MAX_CATALOGUE_IMAGE_SIZE_BYTES = 8 * 1024

const asArray = <T = any,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : safeDataArray<T>(value)

const normalizeImageList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map(item =>
        typeof item === 'string'
          ? item
          : String((item as any)?.url || (item as any)?.imageUrl || '')
      )
      .filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return [value]
  }

  return []
}

const safeDateFromUnknown = (value: unknown): Date | null => {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).toDate === 'function'
  ) {
    const date = (value as any).toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).seconds === 'number'
  ) {
    const date = new Date((value as any).seconds * 1000)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

const safeIsoString = (value: unknown, fallback = ''): string => {
  const date = safeDateFromUnknown(value)
  return date ? date.toISOString() : fallback
}

const safeDateLabel = (value: unknown, fallback = 'N/A'): string => {
  const date = safeDateFromUnknown(value)
  return date ? date.toLocaleDateString() : fallback
}

const safeNumber = (value: unknown, fallback = 0): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const safeText = (value: unknown, fallback = ''): string =>
  String(value ?? fallback)

type ImageHandlingPolicy =
  | 'auto_compress'
  | 'exclude_oversized'
  | 'block_oversized'
type VendorCreditSortMode = 'most_credit' | 'least_credit'
type VendorCatalogueEntitlementStatus =
  | 'OK'
  | 'CREDIT_REQUIRED'
  | 'UPGRADE_RECOMMENDED'
  | 'DEPLOYMENT_LIMIT_REACHED'
  | 'IMAGE_LIMIT_EXCEEDED'
  | 'BLOCKED'
  | 'OVERRIDE_USED'

type VendorCatalogueCreditRow = {
  vendorId: string
  vendorName: string
  planId: string
  planName: string
  sector?: string
  city?: string
  suburb?: string
  creditBalance: number
  productsAllowed: number
  productsSelected: number
  productsOverLimit: number
  overageDue: number
  creditUsed: number
  remainingCredit: number
  imagesAllowed: number
  imagesSelected: number
  imagesDue: number
  deploymentsAllowedThisMonth: number
  deploymentsUsedThisMonth: number
  deploymentsDue: number
  lastDeploymentDate?: string
  nextDeploymentDate?: string
  status: VendorCatalogueEntitlementStatus
  recommendedAction: string
  actionLabel: string
  billDue: number
  subscriptionStatus?: string
}

async function assetUrlToDataUri (url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to load asset: ' + url)
  const blob = await response.blob()

  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

interface CatalogueConfig {
  id: string
  serialNumber: string
  sector: string
  category: string
  province?: string
  cityTown?: string
  vendorIds: string[]
  cahLinkIds: string[]
  notes?: string
  expiryPeriodDays: number
  onlyActive: boolean
  onlyPublished: boolean
  includeOutOfStock: boolean
  maxProducts: number
  maxImages: number
}

interface CatalogueEntitlementSummary {
  vendorId: string
  vendorName: string
  planName: string
  selectedProducts: number
  allowedProducts: number
  includedProducts: number
  excludedProducts: number
  overageQuantity: number
  overageUnitPrice: number
  overageDue: number
  creditUsed: number
  remainingCredit: number
  overrideUsed: boolean
  upgradeRecommendation: string
  excludedProductNames: string[]
}

type CatalogueBiStatus =
  | 'OK'
  | 'Near Limit'
  | 'Limit Reached'
  | 'Over Limit'
  | 'Credit Required'

interface VendorCatalogueBiRow {
  vendorId: string
  vendorName: string
  tradingName: string
  planName: string
  planGroup: string
  sector: string
  category: string
  city: string
  district: string
  suburb: string
  productsSelected: number
  productLimit: number | null
  productsRemaining: number | null
  imagesUsed: number
  imageLimit: number | null
  imagesRemaining: number | null
  cataloguesGeneratedThisMonth: number
  catalogueLimit: number | null
  cataloguesRemaining: number | null
  branchesUsed: number
  branchLimit: number | null
  branchesRemaining: number | null
  staffUsed: number
  staffLimit: number | null
  staffRemaining: number | null
  noticesUsed: number
  noticeLimit: number | null
  noticesRemaining: number | null
  creditBalance: number | null
  overageDue: number
  status: CatalogueBiStatus
  statusReasons: string[]
  allowedProducts: number
  excludedProducts: number
  includedProducts: number
  upgradeRecommendation: string
  searchText: string
  productNames: string[]
}

type BiYesNoFilter = 'all' | 'yes' | 'no'

interface CatalogueBiFilters {
  search: string
  plan: string
  status: 'all' | CatalogueBiStatus
  sector: string
  cityRegion: string
  hasProducts: BiYesNoFilter
  hasImagesRemaining: BiYesNoFilter
  hasCataloguesRemaining: BiYesNoFilter
  overLimitOnly: boolean
  noCreditOnly: boolean
  nearLimitOnly: boolean
  selectedVendorsOnly: boolean
  selectedProductsOnly: boolean
}

interface CatalogueOverageChargeRecord {
  id: string
  catalogueId: string
  vendorId: string
  vendorName: string
  quantity: number
  amount: number
  creditUsed: number
  createdAt: string
}

export interface VendorCatalogueStat {
  vendorId: string
  vendorName: string
  sector: string
  category: string
  city: string
  suburb: string
  planId: string
  planName: string
  productCount: number
  billableProductCount: number
  imageCount: number
  catalogueCountThisPeriod: number
  branchCount: number
  staffCount: number
  noticeCount: number
  whatsappLinkCount: number
  activeSubscriptionId: string
  updatedAt: string
}

type VendorListRow = {
  vendorId: string
  vendorName: string
  sector?: string
  category?: string
  city?: string
  suburb?: string
  logoUrl?: string | null
  entitlementStatus?: 'loading' | 'ready' | 'missing'
}

const normalizeFilterValue = (value?: string | null) => {
  if (!value) return ''
  return String(value).trim().toLowerCase()
}

const normalizeCatalogueFilterText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const categoryMatchesProduct = (item: any, selectedCategory: string) => {
  const nCategory = normalizeCatalogueFilterText(selectedCategory)
  if (!nCategory || nCategory === 'all' || nCategory === 'all categories')
    return true

  const productCategories = [
    item.category,
    item.productCategory,
    item.categoryName,
    item.masterCategory
  ]
    .map(normalizeCatalogueFilterText)
    .filter(Boolean)

  if (productCategories.length === 0) return true

  return productCategories.includes(nCategory)
}

const getVendorDisplayName = (row: any) =>
  String(
    row.vendorName ||
      row.tradingName ||
      row.name ||
      row.businessName ||
      'Unnamed Vendor'
  )

const mapVendorListRow = (row: any): VendorListRow => ({
  vendorId: String(row.vendorId || row.id || ''),
  vendorName: getVendorDisplayName(row),
  sector: row.sector || '',
  category: row.category || row.businessType || '',
  city: row.city || row.cityTown || '',
  suburb: row.suburb || '',
  logoUrl:
    row.logoUrl ||
    row.logoAssetUrl ||
    row.businessLogoUrl ||
    row.imageUrl ||
    null,
  entitlementStatus: row.entitlementStatus || 'loading'
})

const getVendorMatchKeys = (vendor: any) =>
  [
    vendor?.id,
    vendor?.vendorId,
    vendor?.vendorCode,
    vendor?.code,
    vendor?.businessId,
    vendor?.serial,
    vendor?.vendorSerial
  ]
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase())

const productMatchesVendor = (product: any, vendor: any) => {
  const vendorKeys = getVendorMatchKeys(vendor)

  const productKeys = [
    product?.vendorId,
    product?.vendorCode,
    product?.vendorSerial,
    product?.businessId,
    product?.ownerVendorId,
    product?.sourceVendorId
  ]
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase())

  return productKeys.some(key => vendorKeys.includes(key))
}

const normalizeStorefrontProductForCatalogue = (
  product: any,
  vendor: Vendor
): Product => {
  const rawMode = String(
    product?.productMode || product?.mode || product?.sourceType || ''
  ).toLowerCase()
  const productMode =
    rawMode.includes('brand') || product?.isVendorBranded === true
      ? 'branded_product'
      : 'linked_product'

  return {
    ...product,
    id:
      product?.id ||
      product?.offerId ||
      product?.vendorProductId ||
      `${vendor.id}_${product?.productId || product?.sku || product?.name}`,
    vendorId: vendor.id,
    vendorName:
      product?.vendorName || vendor.name || vendor.tradingName || vendor.id,
    productName:
      product?.productName ||
      product?.name ||
      product?.title ||
      product?.itemName ||
      'Product',
    name:
      product?.name ||
      product?.productName ||
      product?.title ||
      product?.itemName ||
      'Product',
    sku:
      product?.vendorSku ||
      product?.sku ||
      product?.masterSku ||
      product?.productSku ||
      product?.productCode ||
      '',
    productMode,
    masterProductId:
      productMode === 'branded_product'
        ? product?.masterProductId || null
        : product?.masterProductId || product?.productId || null,
    offerId:
      product?.offerId || product?.vendorProductId || product?.id || '',
    productId: product?.productId || product?.masterProductId || product?.id,
    status: product?.status || (product?.active === false ? 'inactive' : 'active'),
    active: product?.active !== false,
    publishToCatalogue: product?.publishToCatalogue !== false,
    stockQuantity: safeNumber(
      product?.stockQuantity ??
        product?.currentQty ??
        product?.qty ??
        product?.quantity,
      0
    ),
    sellingPrice: safeNumber(
      product?.sellingPrice ?? product?.price ?? product?.unitPrice,
      0
    ),
    imageUrl:
      normalizeImageList(
        product?.imageUrl ||
          product?.vendorProductImage ||
          product?.brandLogoUrl ||
          product?.images ||
          product?.imageUrls
      )[0] || '',
    category: product?.category || product?.productCategory || '',
    sector: product?.sector || vendor.sector || ''
  } as Product
}

const normalizeSectorKey = (value?: string | null) => {
  if (!value) return ''
  return value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bcomputer\b/g, 'computers')
    .replace(/\bphone\b/g, 'phones')
    .split(/\s+/)
    .filter(w => !['and', 'deals', 'the', 'in', 'of'].includes(w) && w !== '')
    .sort()
    .join('-')
}

const OVERAGE_CHARGE_STORAGE_KEY = 'itred_catalogue_overage_charges'

const getVendorCreditBalance = (vendor: Vendor): number => {
  const candidate =
    (vendor as any).creditBalance ??
    (vendor as any).walletBalance ??
    (vendor as any).prepaidAllowance ??
    (vendor as any).catalogueCreditBalance ??
    0
  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

const getVendorCreditField = (vendor: Vendor): string => {
  const keys = [
    'creditBalance',
    'walletBalance',
    'prepaidAllowance',
    'catalogueCreditBalance'
  ]
  return (
    keys.find(key => Object.prototype.hasOwnProperty.call(vendor, key)) ||
    'creditBalance'
  )
}

const getOverageUnitPrice = (plan?: PricingPlan): number => {
  const candidate =
    (plan as any)?.catalogueProductOveragePrice ??
    (plan as any)?.overageProductPrice ??
    (plan as any)?.productOveragePrice ??
    (plan as any)?.extraProductPrice ??
    1
  const parsed = Number(candidate)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const addDays = (date: string, days: number) => {
  const next = safeDateFromUnknown(date) || new Date()
  next.setDate(next.getDate() + days)
  return safeIsoString(next).slice(0, 10)
}

const getNextDeploymentDate = (
  lastDeploymentDate: string | undefined,
  plan?: PricingPlan
) => {
  if (!lastDeploymentDate) return undefined
  const frequency = plan?.deploymentFrequency || 'monthly'
  if (frequency === 'weekly') return addDays(lastDeploymentDate, 7)
  if (frequency === 'bi-weekly') return addDays(lastDeploymentDate, 14)
  return addDays(lastDeploymentDate, 30)
}

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

const escapeCsv = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const getPlanLimit = (
  plan: PricingPlan | undefined,
  keys: string[]
): number | null => {
  for (const key of keys) {
    const value = (plan as any)?.[key]
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

const normalizePlanLookupText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const resolveCataloguePlan = (
  vendor: Vendor,
  plans: PricingPlan[],
  entitlement?: { planName?: string }
) => {
  const sub = subscriptionService.getSubscriptionByVendor(vendor.id)
  const isActiveSub =
    sub &&
    ['active', 'trial', 'past_due', 'grace_period', 'due', 'overdue'].includes(
      sub.status
    )
  const resolvedPlanId = isActiveSub
    ? sub.planId
    : (vendor as any).subscription?.planId ||
      (vendor as any).activePlanId ||
      vendor.planId
  const planById = resolvedPlanId
    ? plans.find(plan => plan.id === resolvedPlanId)
    : undefined
  const planName = entitlement?.planName
  const nPlanName = normalizePlanLookupText(planName)
  const planByName = nPlanName
    ? plans.find(
        plan =>
          normalizePlanLookupText(plan.name) === nPlanName ||
          normalizePlanLookupText(plan.id) === nPlanName ||
          normalizePlanLookupText(plan.name).includes(nPlanName) ||
          nPlanName.includes(normalizePlanLookupText(plan.name))
      )
    : undefined

  return {
    plan: planById || planByName,
    planSource: isActiveSub
      ? 'active subscription'
      : planById
      ? 'vendor fallback'
      : planByName
      ? 'entitlement plan name'
      : 'none',
    planStatus: sub ? sub.status : vendor.subscriptionStatus || 'no subscription'
  }
}

const resolveCatalogueAllowedProducts = (
  plan: PricingPlan | undefined,
  fallback: number
): number => {
  const limit = resolveCatalogueProductLimit(plan)
  if (limit === 'unlimited') return Infinity
  if (typeof limit === 'number') return Math.max(0, limit)
  return fallback
}

const formatLimitValue = (value: number | null): string =>
  value === null ? 'Unlimited' : String(value)

const formatRemainingValue = (value: number | null): string =>
  value === null ? 'Not capped' : String(Math.max(0, value))

const getUsageStatus = (
  used: number,
  limit: number | null
): CatalogueBiStatus | null => {
  if (limit === null) return null
  if (used > limit) return 'Over Limit'
  if (used === limit) return 'Limit Reached'
  if (limit > 0 && used / limit >= 0.8) return 'Near Limit'
  return null
}

const mergeBiStatus = (
  current: CatalogueBiStatus,
  next: CatalogueBiStatus | null
): CatalogueBiStatus => {
  const rank: Record<CatalogueBiStatus, number> = {
    OK: 0,
    'Near Limit': 1,
    'Limit Reached': 2,
    'Credit Required': 3,
    'Over Limit': 4
  }
  if (!next) return current
  return rank[next] > rank[current] ? next : current
}

const getProductImageCount = (product: Product): number => {
  const imageValues = [
    product.imageUrl,
    ...(((product as any).imageUrls || []) as unknown[]),
    ...(((product as any).images || []) as unknown[]),
    ...((product.additionalImages || []) as unknown[])
  ]
  return imageValues.filter(Boolean).length
}

const getVendorStaticImageCount = (vendor: Vendor): number => {
  const directImages = [
    vendor.logoUrl,
    vendor.bannerUrl,
    vendor.logoAssetUrl,
    vendor.bannerAssetUrl,
    vendor.businessLogoUrl,
    vendor.businessBannerUrl,
    (vendor as any).imageUrl
  ].filter(Boolean).length
  const branchImages = (vendor.branches || []).reduce(
    (count, branch) =>
      count +
      [
        (branch as any).imageUrl,
        (branch as any).photoUrl,
        (branch as any).bannerUrl
      ].filter(Boolean).length,
    0
  )
  const staffImages = (vendor.staff || []).reduce(
    (count, staff) =>
      count +
      [
        (staff as any).photoUrl,
        (staff as any).imageUrl,
        (staff as any).avatarUrl
      ].filter(Boolean).length,
    0
  )
  const deliveryImages = [
    ...((vendor.deliveryStaff || []) as unknown[]),
    ...(((vendor as any).deliveryProviders || []) as unknown[])
  ].reduce(
    (count, item: any) =>
      count +
      [item?.photoUrl, item?.imageUrl, item?.logoUrl].filter(Boolean).length,
    0
  )
  return directImages + branchImages + staffImages + deliveryImages
}

const isCurrentMonth = (dateValue: string | undefined): boolean => {
  const date = safeDateFromUnknown(dateValue)
  if (!date) return false
  const now = new Date()
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

const classifyPlanGroup = (planName: string): string => {
  const normalized = planName.toLowerCase()
  if (normalized.includes('starter')) return 'Starter'
  if (normalized.includes('growth')) return 'Growth'
  if (normalized.includes('pro')) return 'Pro'
  if (normalized.includes('custom')) return 'Custom'
  return 'Custom'
}

const saveOverageChargeRecord = (record: CatalogueOverageChargeRecord) => {
  try {
    const raw = localStorage.getItem(OVERAGE_CHARGE_STORAGE_KEY)
    const existing = raw ? JSON.parse(raw) : []
    const records = Array.isArray(existing) ? existing : []
    localStorage.setItem(
      OVERAGE_CHARGE_STORAGE_KEY,
      JSON.stringify([...records, record])
    )
  } catch (error) {
    console.warn('Failed to save catalogue overage charge', error)
  }
}

const buildCatalogueProductFromOffer = (
  offer: VendorProductOffer,
  master: MasterProduct,
  vendor: Vendor
): Product => {
  const branch = (vendor.branches || []).find(
    (item: Branch) => item.id === offer.branchId
  )
  if (offer.productMode === 'branded_product') {
    const productName = offer.productName || 'Unnamed branded product'
    const brandDisplayName =
      offer.brandDisplayName ||
      vendor.catalogueDisplayName ||
      vendor.tradingName ||
      vendor.name ||
      ''
    const imageUrl =
      offer.vendorProductImage ||
      offer.brandLogoUrl ||
      vendor.logoAssetUrl ||
      vendor.logoUrl ||
      vendor.businessLogoUrl ||
      ''
    const maxImages = getMaxImagesForListing(vendor, undefined, offer)
    const images = normalizeListingImages(
      {
        ...offer,
        imageUrl
      },
      maxImages
    )
    const metrics = listingImageMetrics(
      { ...offer, imageUrl, images },
      maxImages
    )

    return {
      id: offer.id,
      offerId: offer.id,
      productId: offer.id,
      productMode: 'branded_product',
      sourceType: 'vendor_branded',
      masterProductId: null,
      brandOwnerVendorId: offer.brandOwnerVendorId || offer.vendorId,
      isVendorBranded: true,
      brandDisplayName,
      brandLogoUrl:
        offer.brandLogoUrl ||
        vendor.logoAssetUrl ||
        vendor.logoUrl ||
        vendor.businessLogoUrl ||
        '',
      brandBannerUrl:
        offer.brandBannerUrl ||
        vendor.bannerAssetUrl ||
        vendor.bannerUrl ||
        vendor.businessBannerUrl ||
        '',
      vendorId: offer.vendorId,
      vendorName: vendor.name || vendor.tradingName || brandDisplayName,
      name: productName,
      productName,
      brand: brandDisplayName,
      category: offer.category || vendor.category || '',
      sector: offer.sector || vendor.sector || '',
      description: offer.description || offer.notes || '',
      sku: offer.vendorSku || offer.sku || '',
      productCode: offer.sku || offer.vendorSku || '',
      branchId: offer.branchId || '',
      branchName: branch?.name || '',
      country: branch?.country || vendor.country || '',
      province: branch?.province || vendor.province || '',
      cityTown: branch?.cityTown || vendor.cityTown || '',
      district: branch?.district || vendor.district || '',
      suburb: branch?.suburb || vendor.suburb || '',
      streetAddress:
        branch?.streetAddress || branch?.address || vendor.streetAddress || '',
      sellingPrice: Number(offer.discountPrice || offer.sellingPrice) || 0,
      buyingPrice: offer.buyingPrice,
      oldPrice: offer.discountPrice ? offer.sellingPrice : undefined,
      stockQuantity: Number(offer.stockQuantity) || 0,
      publishToCatalogue: offer.publishToCatalogue !== false,
      status: offer.active === false ? 'hidden' : 'active',
      deliveryAvailable: offer.deliveryAvailable,
      tags: [brandDisplayName, offer.category, offer.sector].filter(Boolean),
      keywords: [productName, brandDisplayName, offer.vendorSku].filter(
        Boolean
      ),
      searchableText: [
        productName,
        brandDisplayName,
        offer.category,
        offer.sector,
        offer.description,
        offer.vendorSku
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      additionalImages: asArray<{ url: string }>(images)
        .slice(1)
        .map(image => image.url),
      images,
      ...metrics,
      model: '',
      unitOfMeasure: 'Each',
      minStockAlert: 5,
      locationDisplayText:
        branch?.suburb ||
        branch?.district ||
        branch?.cityTown ||
        vendor.suburb ||
        vendor.cityTown ||
        '',
      imageUrl,
      imageStatus: imageUrl ? 'uploaded' : 'missing',
      source: 'backend entered',
      enteredByStaffId: '',
      lastUpdatedBy: '',
      createdAt: safeIsoString(offer.createdAt, safeIsoString(new Date())),
      updatedAt: safeIsoString(offer.updatedAt, safeIsoString(new Date()))
    }
  }
  const productName =
    master.productName || (master as any).name || offer.productName || 'Product'
  const imageUrl = offer.vendorProductImage || master.imageUrl || ''
  const maxImages = getMaxImagesForListing(vendor, undefined, master)
  const images = normalizeListingImages(
    {
      ...master,
      ...offer,
      imageUrl
    },
    maxImages
  )
  const metrics = listingImageMetrics(
    { ...master, ...offer, imageUrl, images },
    maxImages
  )
  const searchableParts = [
    productName,
    master.brand,
    master.category,
    master.sector,
    master.description,
    offer.vendorSku,
    master.standardSku,
    (master as any).sku,
    master.barcode,
    vendor.name,
    vendor.tradingName,
    branch?.name,
    branch?.cityTown,
    branch?.district,
    branch?.suburb,
    branch?.streetAddress,
    branch?.address,
    ...(master.tags || []),
    ...(master.keywords || [])
  ]

  return {
    id: offer.id,
    offerId: offer.id,
    productId: offer.productId,
    productMode: 'linked_product',
    sourceType: 'master_linked',
    masterProductId: master.id,
    brandOwnerVendorId: offer.vendorId,
    isVendorBranded: false,
    vendorId: offer.vendorId,
    vendorName: vendor.name || vendor.tradingName || '',
    name: productName,
    productName,
    brand: master.brand || '',
    category: master.category || '',
    sector: master.sector || vendor.sector || '',
    description: master.description || '',
    sku: offer.vendorSku || master.standardSku || (master as any).sku || '',
    productCode: master.barcode || '',
    barcode: master.barcode,
    imageUrl,
    sellingPrice: Number(offer.sellingPrice) || 0,
    buyingPrice: offer.buyingPrice,
    stockQuantity: Number(offer.stockQuantity) || 0,
    branchId: offer.branchId || '',
    branchName: branch?.name || '',
    country: branch?.country || vendor.country || '',
    province: branch?.province || vendor.province || '',
    cityTown: branch?.cityTown || vendor.cityTown || '',
    district: branch?.district || vendor.district || '',
    suburb: branch?.suburb || vendor.suburb || '',
    streetAddress:
      branch?.streetAddress || branch?.address || vendor.streetAddress || '',
    publishToCatalogue: offer.publishToCatalogue !== false,
    status: offer.active === false ? 'hidden' : 'active',
    deliveryAvailable: offer.deliveryAvailable,
    tags: master.tags || [],
    keywords: master.keywords || [],
    searchableText: searchableParts.filter(Boolean).join(' ').toLowerCase(),
    additionalImages: asArray<{ url: string }>(images)
      .slice(1)
      .map(image => image.url),
    images,
    ...metrics,
    model: '',
    unitOfMeasure: master.unit || 'Each',
    minStockAlert: 5,
    locationDisplayText:
      branch?.suburb ||
      branch?.district ||
      branch?.cityTown ||
      vendor.suburb ||
      vendor.cityTown ||
      '',
    imageStatus: imageUrl ? 'uploaded' : 'missing',
    source: 'backend entered',
    enteredByStaffId: '',
    lastUpdatedBy: '',
    createdAt: safeIsoString(
      offer.createdAt || master.createdAt,
      safeIsoString(new Date())
    ),
    updatedAt: safeIsoString(
      offer.updatedAt || master.updatedAt,
      safeIsoString(new Date())
    )
  }
}

const safeLogEvent = (event: any) => {
  const safeEvent = sanitizeForFirestore({
    ...event,
    vendorId: event.vendorId ?? null,
    sector: event.sector ?? null,
    category: event.category ?? null,
    source: event.source ?? null
  })

  void analyticsService.logEvent(safeEvent).catch((error: any) => {
    firebaseHealthService?.reportError?.(error, 'analyticsService.logEvent')
  })
}

export const SectorCatalogueGenerator: React.FC = () => {
  const masterCache = useMasterDataCache()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [detailedVendors, setDetailedVendors] = useState<Vendor[]>([])
  const [detailedProducts, setDetailedProducts] = useState<Product[]>([])
  const [vendorStats, setVendorStats] = useState<VendorCatalogueStat[]>([])
  const [activePlanVendorSummaries, setActivePlanVendorSummaries] = useState<
    VendorListRow[]
  >([])
  const [entitlementByVendorId, setEntitlementByVendorId] = useState<
    Record<
      string,
      { status: 'loading' | 'ready' | 'missing' | 'error'; planName?: string }
    >
  >({})
  const [vendorListStatus, setVendorListStatus] = useState<
    'idle' | 'loading' | 'cached' | 'refreshing' | 'ready' | 'error'
  >('idle')
  const [vendorListQueryCompleted, setVendorListQueryCompleted] =
    useState(false)
  const [vendorListError, setVendorListError] = useState('')
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([])
  const [vendorProductOffers, setVendorProductOffers] = useState<
    VendorProductOffer[]
  >([])
  const [intelligenceLogs, setIntelligenceLogs] = useState<
    WhatsAppIntelligenceLog[]
  >([])
  const [allActiveCahLinks, setAllActiveCahLinks] = useState<CAHLink[]>([])
  const [selectedCahLinkIds, setSelectedCahLinkIds] = useState<string[]>([])
  const [cahLinkSearch, setCahLinkSearch] = useState('')
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [history, setHistory] = useState<CatalogueGeneration[]>([])
  const [contactSettings, setContactSettings] =
    useState<CatalogueContactHubSettings | null>(null)
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(
    null
  )
  const [sectorOptions, setSectorOptions] = useState<SectorOption[]>(() =>
    sectorIndexService.getDefaultSectors()
  )
  const [isSectorLoading, setIsSectorLoading] = useState(false)
  const [sectorSource, setSectorSource] = useState<
    'default' | 'cache' | 'firebase'
  >('default')
  const [loadingState, setLoadingState] = useState('')
  const [linksSource, setLinksSource] = useState('Loading...')
  const [overridePlanLimits, setOverridePlanLimits] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [optimizationSummary, setOptimizationSummary] =
    useState<CatalogueImageOptimizationSummary | null>(null)
  const [imageHandlingPolicy, setImageHandlingPolicy] =
    useState<ImageHandlingPolicy>('exclude_oversized')
  const [vendorCreditSort, setVendorCreditSort] =
    useState<VendorCreditSortMode>('most_credit')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [selectedProductsOnly, setSelectedProductsOnly] = useState(false)
  const [productSelectionSearch, setProductSelectionSearch] = useState('')
  const [vendorCreditFilters, setVendorCreditFilters] = useState({
    overLimitOnly: false,
    noCreditOnly: false,
    selectedVendorsOnly: true,
    selectedProductsOnly: false,
    plan: '',
    sector: '',
    city: '',
    suburb: ''
  })

  const isSectorDataLoading =
    isSectorLoading ||
    vendorListStatus === 'loading' ||
    vendorListStatus === 'refreshing'

  // Filters
  const [filterSector, setFilterSector] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState<DeploymentStatus | 'all'>(
    'all'
  )

  // Catalogue Config State
  const [config, setConfig] = useState<CatalogueConfig>({
    id: `CAT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    serialNumber: '',
    sector: '',
    category: '',
    province: '',
    cityTown: '',
    vendorIds: [],
    cahLinkIds: [],
    notes: '',
    expiryPeriodDays: 7,
    onlyActive: true,
    onlyPublished: true,
    includeOutOfStock: false,
    maxProducts: 800,
    maxImages: 800
  })

  // History Management & Editing State
  const [editingCatalogueId, setEditingCatalogueId] = useState<string | null>(
    null
  )
  const [historySearch, setHistorySearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showReplaced, setShowReplaced] = useState(false)
  const [showDeploymentReport, setShowDeploymentReport] = useState(false)
  const [biFilters, setBiFilters] = useState<CatalogueBiFilters>({
    search: '',
    plan: 'all',
    status: 'all',
    sector: '',
    cityRegion: '',
    hasProducts: 'all',
    hasImagesRemaining: 'all',
    hasCataloguesRemaining: 'all',
    overLimitOnly: false,
    noCreditOnly: false,
    nearLimitOnly: false,
    selectedVendorsOnly: true,
    selectedProductsOnly: false
  })

  const [lastGenerated, setLastGenerated] = useState<{
    html: string
    id: string
    fileName: string
    hostedUrl?: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean
    message: string
    confirmLabel: string
    variant: 'danger' | 'warning' | 'info'
    onConfirm: () => void
  }>({
    isOpen: false,
    message: '',
    confirmLabel: 'Confirm',
    variant: 'info',
    onConfirm: () => {}
  })

  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [quickLogData, setQuickLogData] = useState<
    Partial<WhatsAppActivityLog>
  >({})

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean
    title?: string
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: 'seiGEN Commerce', message: '', type: 'success' })
  const [isLoadingData, setIsLoadingData] = useState(true)

  const showBrandedAlert = (config: {
    title?: string
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
  }) => {
    setAlertConfig({ ...config, isOpen: true })
  }

  const mergeVendorListRows = (
    rows: VendorListRow[],
    entitlementStatus: 'loading' | 'ready' | 'missing' | 'error' = 'loading'
  ) => {
    if (rows.length === 0) return
    setActivePlanVendorSummaries(prev => {
      const nextMap = new Map<string, VendorListRow>(
        prev.map(row => [row.vendorId, row])
      )

      rows.forEach(row => {
        if (!row.vendorId) return
        const existing = nextMap.get(row.vendorId)

        nextMap.set(row.vendorId, {
          ...existing,
          ...row,
          vendorId: row.vendorId,
          vendorName: row.vendorName || existing?.vendorName || 'Unnamed Vendor'
        })
      })

      return Array.from(nextMap.values())
    })

    setEntitlementByVendorId(prev => {
      const next = { ...prev }
      rows.forEach(row => {
        if (!row.vendorId) return
        if (!next[row.vendorId]) {
          next[row.vendorId] = { status: entitlementStatus }
        }
      })
      return next
    })
  }

  const fetchDirectVendorRows = async (): Promise<VendorListRow[]> => {
    const fetchCollection = async (collectionName: string) => {
      try {
        const snap = await getDocs(
          query(collection(db, collectionName), firestoreLimit(500))
        )
        return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      } catch (e) {
        console.warn(`Failed to fetch ${collectionName}`, e)
        return []
      }
    }

    const [vendorsSnap, itredVendorsSnap] = await Promise.all([
      fetchCollection('vendors'),
      fetchCollection('itred_vendors')
    ])

    const merged = new Map<string, any>()
    ;[...vendorsSnap, ...itredVendorsSnap].forEach(row => {
      const vendorId = row.vendorId || row.id
      if (!vendorId) return
      merged.set(vendorId, { ...merged.get(vendorId), ...row })
    })

    const activeRows: VendorListRow[] = []
    merged.forEach((row, vendorId) => {
      const isActive =
        row.active === true ||
        row.isActive === true ||
        normalizeFilterValue(row.status) === 'active'

      if (isActive) {
        activeRows.push(mapVendorListRow({ ...row, vendorId }))
      }
    })

    return activeRows
  }

  useEffect(() => {
    const defaults = sectorIndexService.getDefaultSectors()
    setSectorOptions(defaults)
    setSectorSource('default')

    const cached = sectorIndexService.getCachedSectors()
    if (cached.length > 0) {
      setSectorOptions(cached)
      setSectorSource('cache')
    }

    setIsSectorLoading(true)
    sectorIndexService
      .refreshSectorsFromSource()
      .then(sectors => {
        setSectorOptions(sectors)
        setSectorSource('firebase')
      })
      .catch(error => {
        console.warn(
          'Sector index refresh failed. Using cached/default sectors.',
          error
        )
        setSectorSource(cached.length > 0 ? 'cache' : 'default')
      })
      .finally(() => setIsSectorLoading(false))
  }, [])

  useEffect(() => {
    void loadData()
    void fetchAllActiveVendors()
  }, [])

  const loadData = async () => {
    const startMs = performance.now()
    try {
      const [
        rawPlans,
        rawHistory,
        rawSettings,
        rawSystemSettings,
        rawVendors,
        rawProducts,
        rawMasterProducts,
        rawVendorProductOffers
      ] = await Promise.all([
        pricingPlanService.getPlans(),
        catalogueService.getHistory().catch((error: any) => {
          if (firebaseHealthService.isMissingFirestoreIndexError?.(error)) {
            console.warn(
              'Missing catalogueGenerations index. Skipping non-critical history query.',
              error
            )
            return []
          }
          throw error
        }),
        contactHubService.getSettings(),
        settingsService.getSettings(),
        vendorService.getVendors().catch(() => []),
        productService.getProducts().catch(() => []),
        productService.getMasterProducts().catch(() => []),
        productService.getVendorProductOffers().catch(() => [])
      ])

      const retentionDays =
        rawSystemSettings?.catalogueArchiveRetentionDays || 21
      let cleanup = { deletedCount: 0, history: rawHistory, retentionDays }
      cleanup = await safeCleanupOldCatalogueArchives(retentionDays)

      let rawCahLinks: CAHLink[] = []
      try {
        rawCahLinks = await cahService.loadCAHLinksFromFirebase()
        setLinksSource('Firebase')
      } catch (e) {
        rawCahLinks = cahService.getLinks()
        setLinksSource('Local Fallback')
      }

      setIntelligenceLogs(whatsappActivityService.getIntelligenceLogs())
      setDetailedVendors(asArray<Vendor>(rawVendors))
      setDetailedProducts(asArray<Product>(rawProducts))
      setProducts(asArray<Product>(rawProducts))
      setMasterProducts(asArray<MasterProduct>(rawMasterProducts))
      setVendorProductOffers(asArray<VendorProductOffer>(rawVendorProductOffers))
      setAllActiveCahLinks(
        asArray<CAHLink>(rawCahLinks).filter(isActiveCatalogueHubLink)
      )
      setPlans(asArray<PricingPlan>(rawPlans))
      const loadedHistory =
        cleanup.deletedCount > 0 && cleanup.history.length > 0
          ? cleanup.history
          : asArray<CatalogueGeneration>(rawHistory)
      setHistory(loadedHistory)
      setContactSettings(rawSettings)
      setSystemSettings(rawSystemSettings)

      if (cleanup.deletedCount > 0) {
        showBrandedAlert({
          title: 'Catalogue Archive Cleanup',
          message: `Old catalogue archives older than ${cleanup.retentionDays} days were cleaned.`,
          type: 'info'
        })
      }

      if (typeof (catalogueService as any).checkExpirations === 'function') {
        try {
          const expirationResult = await (
            catalogueService as any
          ).checkExpirations()
          const expirationHistory = Array.isArray(expirationResult)
            ? expirationResult
            : Array.isArray(expirationResult?.history)
            ? expirationResult.history
            : loadedHistory

          setHistory(asArray<CatalogueGeneration>(expirationHistory))
        } catch (error: any) {
          if (firebaseHealthService.isMissingFirestoreIndexError?.(error)) {
            console.warn(
              'Missing catalogueGenerations index. Skipping non-critical expiration query.',
              error
            )
          } else {
            throw error
          }
        }
      }
    } catch (error) {
      console.warn(
        'Create Catalogue data failed to load. Using empty arrays.',
        error
      )
      setPlans([])
      setHistory([])
    } finally {
      setIsLoadingData(false)
      console.info('Data load completed', {
        page: 'SectorCatalogueGenerator',
        elapsedMs: Math.round(performance.now() - startMs)
      })
    }
  }

  const fetchAllActiveVendors = async () => {
    setVendorListError('')
    setVendorListQueryCompleted(false)
    setVendorListStatus(
      activePlanVendorSummaries.length > 0 ? 'refreshing' : 'loading'
    )

    try {
      const cachedVendors = await masterDataCacheService
        .getVendors()
        .catch(() => [])
      const cachedRows = cachedVendors.map(mapVendorListRow)
      mergeVendorListRows(cachedRows, 'loading')
      if (cachedRows.length > 0) {
        setVendorListStatus('cached')
      }

      const directRows = await fetchDirectVendorRows().catch(() => [])
      mergeVendorListRows(directRows, 'loading')

      const freshStats = await masterDataCacheService
        .getVendorCatalogueStats()
        .catch(() => [])
      setVendorStats(freshStats as VendorCatalogueStat[])
      setActivePlanVendorSummaries(prev => {
        const nextMap = new Map(prev.map(r => [r.vendorId, r]))
        freshStats.forEach(stat => {
          if (!nextMap.has(stat.vendorId)) return
          nextMap.set(stat.vendorId, {
            ...nextMap.get(stat.vendorId),
            vendorId: stat.vendorId,
            vendorName:
              nextMap.get(stat.vendorId)?.vendorName ||
              stat.vendorName ||
              'Unnamed Vendor',
            sector: stat.sector || nextMap.get(stat.vendorId)?.sector,
            category: stat.category || nextMap.get(stat.vendorId)?.category,
            city: stat.city || nextMap.get(stat.vendorId)?.city,
            suburb: stat.suburb || nextMap.get(stat.vendorId)?.suburb
          } as VendorListRow)
        })
        return Array.from(nextMap.values())
      })

      setEntitlementByVendorId(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(key => {
          if (next[key].status === 'loading') {
            next[key] = { ...next[key], status: 'missing' }
          }
        })
        freshStats.forEach(stat => {
          const hasPlan =
            stat.activeSubscriptionId || stat.planId || stat.planName
          next[stat.vendorId] = {
            status: hasPlan ? 'ready' : 'missing',
            planName: stat.planName || stat.planId
          }
        })
        return next
      })

      setVendorListStatus('ready')
      setVendorListQueryCompleted(true)
    } catch (error) {
      console.error(error)
      setVendorListStatus('error')
      setVendorListError('Failed to load active vendors')
      setVendorListQueryCompleted(true)
    }
  }

  const loadSectorData = async (
    sector: string,
    options: { preserveSelections?: boolean; updateConfig?: boolean } = {}
  ) => {
    if (options.updateConfig !== false) {
      setConfig(prev => ({
        ...prev,
        sector,
        vendorIds: options.preserveSelections ? prev.vendorIds : []
      }))
    }
  }

  const refreshHistory = async () => {
    try {
      setHistory(
        asArray<CatalogueGeneration>(await catalogueService.getHistory())
      )
    } catch (error: any) {
      if (firebaseHealthService.isMissingFirestoreIndexError?.(error)) {
        console.warn(
          'Missing catalogueGenerations index. Skipping non-critical history query.',
          error
        )
        return
      }
      throw error
    }
  }

  const generateSerialNumber = (sector: string, category: string) => {
    const now = new Date()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const year = String(now.getFullYear()).slice(-2)
    return `${sector || 'SECTOR'} | ${category || 'CAT'} | ${month}${year}`
  }

  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      serialNumber: generateSerialNumber(prev.sector, prev.category)
    }))
  }, [config.sector, config.category])

  const safeVendors = useMemo(
    () => asArray<Vendor>(detailedVendors),
    [detailedVendors]
  )
  const safeProducts = useMemo(
    () => asArray<Product>(detailedProducts),
    [detailedProducts]
  )
  const safeMasterProducts = useMemo(
    () => asArray<MasterProduct>(masterProducts),
    [masterProducts]
  )
  const safeVendorProductOffers = useMemo(
    () => asArray<VendorProductOffer>(vendorProductOffers),
    [vendorProductOffers]
  )
  const safeIntelligenceLogs = useMemo(
    () => asArray<WhatsAppIntelligenceLog>(intelligenceLogs),
    [intelligenceLogs]
  )
  const safeCahLinks = useMemo(
    () => asArray<CAHLink>(allActiveCahLinks),
    [allActiveCahLinks]
  )
  const safePlans = useMemo(() => asArray<PricingPlan>(plans), [plans])
  const safeHistory = useMemo(
    () => asArray<CatalogueGeneration>(history),
    [history]
  )

  const safeCleanupOldCatalogueArchives = async (retentionDays: number) => {
    try {
      return await catalogueService.cleanupOldCatalogueArchives(retentionDays)
    } catch (error: any) {
      if (firebaseHealthService.isMissingFirestoreIndexError?.(error)) {
        console.warn(
          'Missing catalogueGenerations index. Skipping non-critical cleanup query.',
          error
        )
        return { deletedCount: 0, history: safeHistory, retentionDays }
      }

      throw error
    }
  }
  const vendorStatsById = useMemo(
    () => new Map(vendorStats.map(stat => [stat.vendorId, stat])),
    [vendorStats]
  )
  const filteredVendorSummaries = useMemo(() => {
    const nSector = normalizeSectorKey(config.sector)
    const nCity = normalizeFilterValue(config.cityTown)
    return activePlanVendorSummaries
      .filter(row => {
        if (nSector && normalizeSectorKey(row.sector) !== nSector) return false
        if (nCity && normalizeFilterValue(row.city) !== nCity) return false
        return true
      })
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName))
  }, [config.cityTown, config.sector, activePlanVendorSummaries])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.table({
        activeVendorCount: activePlanVendorSummaries.length,
        filteredVendorCount: filteredVendorSummaries.length,
        entitlementPendingCount: filteredVendorSummaries.filter(
          row => entitlementByVendorId[row.vendorId]?.status !== 'ready'
        ).length,
        entitlementReadyCount: filteredVendorSummaries.filter(
          row => entitlementByVendorId[row.vendorId]?.status === 'ready'
        ).length,
        selectedSectorFilter: config.sector || null
      })
    }
  }, [
    config.sector,
    activePlanVendorSummaries.length,
    filteredVendorSummaries.length,
    entitlementByVendorId
  ])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const nSector = normalizeSectorKey(config.sector)
      const nCity = normalizeFilterValue(config.cityTown)
      const diagnostics = activePlanVendorSummaries.map(row => {
        const rowSector = normalizeSectorKey(row.sector)
        const sectorMatch = !nSector || rowSector === nSector
        const cityMatch = !nCity || normalizeFilterValue(row.city) === nCity
        return {
          vendorName: row.vendorName,
          rawSector: row.sector,
          normalizedSector: rowSector,
          selectedSector: config.sector,
          selectedSectorKey: nSector,
          activeFlag: true,
          status: entitlementByVendorId[row.vendorId]?.status || 'unknown',
          collectionSource: 'merged',
          includedInVendorList: sectorMatch && cityMatch,
          excludedReason: !sectorMatch
            ? 'Sector mismatch'
            : !cityMatch
            ? 'City mismatch'
            : 'None'
        }
      })
      if (diagnostics.length > 0) console.table(diagnostics)
    }
  }, [
    config.sector,
    config.cityTown,
    activePlanVendorSummaries,
    entitlementByVendorId
  ])

  const sectorLabels = useMemo(
    () => sectorOptions.map(option => option.label),
    [sectorOptions]
  )

  const selectedVendors = useMemo(
    () => safeVendors.filter(v => config.vendorIds.includes(v.id)),
    [safeVendors, config.vendorIds]
  )

  const catalogueOfferProducts = useMemo(() => {
    if (safeVendorProductOffers.length === 0) return []

    const selectedVendorIds = new Set(config.vendorIds)
    const masterById = new Map(
      safeMasterProducts.map(master => [master.id, master])
    )
    const vendorById = new Map(safeVendors.map(vendor => [vendor.id, vendor]))

    const mapped = safeVendorProductOffers
      .filter(offer => selectedVendorIds.has(offer.vendorId))
      .filter(offer => offer.active !== false)
      .filter(offer => {
        const master = masterById.get(offer.productId)
        return categoryMatchesProduct(
          {
            ...master,
            category: offer.category || master?.category,
            productCategory: (offer as any).productCategory,
            categoryName: (offer as any).categoryName,
            masterCategory: master?.category
          },
          config.category
        )
      })
      .map(offer => {
        const vendor = vendorById.get(offer.vendorId)
        if (!vendor) return null
        if (String(vendor.status || '').toLowerCase() !== 'active') return null
        const master =
          offer.productMode === 'branded_product'
            ? ({} as MasterProduct)
            : masterById.get(offer.productId)
        if (!master) return null
        if (
          offer.productMode !== 'branded_product' &&
          String(master.status || '').toLowerCase() !== 'active'
        )
          return null
        return buildCatalogueProductFromOffer(offer, master, vendor)
      })
      .filter(Boolean) as Product[]

    const deduplicated: Product[] = []
    const seen = new Set<string>()
    let linkedOfferProductsCount = 0
    let brandedVendorProductsCount = 0

    for (const p of mapped) {
      const key =
        p.productMode === 'branded_product'
          ? p.id
          : p.offerId || `${p.vendorId}_${p.masterProductId}`

      if (!seen.has(key)) {
        seen.add(key)
        deduplicated.push(p)
        if (p.productMode === 'branded_product') {
          brandedVendorProductsCount++
        } else {
          linkedOfferProductsCount++
        }
      }
    }

    console.log('Export Product Pipeline Counts:', {
      linkedOfferProducts: linkedOfferProductsCount,
      brandedVendorProducts: brandedVendorProductsCount,
      combinedExportProducts: deduplicated.length
    })

    return deduplicated
  }, [
    config.vendorIds,
    config.category,
    safeMasterProducts,
    safeVendorProductOffers,
    safeVendors
  ])

  useEffect(() => {
    const loadDetailedResources = async () => {
      const idsToFetch = asArray<string>(config.vendorIds).filter(
        id => !detailedVendors.some(v => v.id === id)
      )
      if (idsToFetch.length === 0) return

      setLoadingState('Loading detailed vendor resources')
      try {
        const chunks = []
        for (let i = 0; i < idsToFetch.length; i += 10) {
          chunks.push(asArray<string>(idsToFetch).slice(i, i + 10))
        }

        const newVendors: Vendor[] = []
        const newProducts: Product[] = []

        for (const chunk of chunks) {
          try {
            const vSnap = await getDocs(
              query(collection(db, 'vendors'), where('__name__', 'in', chunk))
            )

            newVendors.push(
              ...vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))
            )
          } catch (err: any) {
            console.warn('Fallback: Failed to fetch vendor details chunk', err)
            firebaseHealthService?.reportError?.(err, 'getDocs vendors')
          }

          try {
            const pSnap = await getDocs(
              query(collection(db, 'products'), where('vendorId', 'in', chunk))
            )

            newProducts.push(
              ...pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product))
            )
          } catch (err: any) {
            console.warn('Fallback: Failed to fetch product details chunk', err)
            firebaseHealthService?.reportError?.(err, 'getDocs products')
          }
        }

        setDetailedVendors(prev => [...prev, ...newVendors])
        setDetailedProducts(prev => [...prev, ...newProducts])
        setLoadingState('')
      } catch (error) {
        console.error('Error loading details:', error)
        setLoadingState('Retry loading vendors')
      }
    }

    if (config.vendorIds.length > 0) {
      void loadDetailedResources()
    }
  }, [config.vendorIds, detailedVendors])

  const canOverridePlanLimits = permissionService.hasActionPermission(
    'catalogue.overridePlanLimit'
  )

  const rawSelectedProducts = useMemo(() => {
    const combined = [...catalogueOfferProducts]
    const seen = new Set(combined.map(p => p.id))

    safeProducts.forEach(p => {
      const matchedVendor = selectedVendors.find(vendor =>
        productMatchesVendor(p, vendor)
      )
      if (!matchedVendor) return

      const normalizedProduct = normalizeStorefrontProductForCatalogue(
        p,
        matchedVendor
      )
      if (!seen.has(normalizedProduct.id)) {
        combined.push(normalizedProduct)
        seen.add(normalizedProduct.id)
      }
    })

    let filtered = combined

    if (config.onlyActive) {
      filtered = filtered.filter(p => {
        const isActive =
          p.status === 'active' ||
          (p as any).active === true ||
          p.publishToCatalogue === true ||
          (p as any).catalogue === true
        return config.includeOutOfStock
          ? isActive || p.status === 'out_of_stock'
          : isActive
      })
    }
    if (config.onlyPublished) {
      filtered = filtered.filter(p => p.publishToCatalogue !== false)
    }
    filtered = filtered.filter(p => categoryMatchesProduct(p, config.category))
    if (!config.includeOutOfStock) {
      filtered = filtered.filter(
        p =>
          Number(p.stockQuantity) > 0 ||
          p.stockQuantity === undefined ||
          (p as any).stockStatus === 'in_stock'
      )
    }

    if (selectedVendors.length > 0 && filtered.length === 0) {
      const storefrontEquivalent = safeProducts.filter(p =>
        productMatchesVendor(p, selectedVendors[0])
      )
      console.log('Product Selection Diagnostics:', {
        selectedVendorName: selectedVendors[0]?.name,
        selectedVendorKeys: getVendorMatchKeys(selectedVendors[0]),
        storefrontEquivalentProductCount: storefrontEquivalent.length,
        catalogueProductCount: filtered.length,
        linkedProductCount: storefrontEquivalent.filter(
          p => p.productMode !== 'branded_product'
        ).length,
        brandedProductCount: storefrontEquivalent.filter(
          p => p.productMode === 'branded_product'
        ).length,
        selectedProductCount: selectedProductIds.length,
        resolvedPlanName:
          entitlementByVendorId[selectedVendors[0]?.id]?.planName,
        blockReason:
          'Products exist in Storefront Builder but are not entering catalogue selection. Check vendor key matching or source alignment.'
      })
    }

    return filtered
  }, [
    catalogueOfferProducts,
    safeProducts,
    selectedVendors,
    config,
    entitlementByVendorId,
    selectedProductIds.length
  ])

  const visibleSelectionProducts = useMemo(() => {
    if (!productSelectionSearch.trim()) return rawSelectedProducts

    return rawSelectedProducts.filter(product => {
      const searchBlob = buildSearchText(
        [
          product.name || product.productName,
          product.sku || product.productCode,
          product.vendorName,
          product.category,
          product.productMode === 'branded_product' ? 'branded' : 'linked'
        ]
      )

      return matchesFreeOrderSearch(searchBlob, productSelectionSearch)
    })
  }, [rawSelectedProducts, productSelectionSearch])

  const selectVisibleProducts = (
    predicate: (product: Product) => boolean = () => true
  ) => {
    setSelectedProductsOnly(true)
    setSelectedProductIds(prev =>
      Array.from(
        new Set([
          ...prev,
          ...visibleSelectionProducts.filter(predicate).map(p => p.id)
        ])
      )
    )
  }

  const clearSelectedProducts = () => {
    setSelectedProductIds([])
    setSelectedProductsOnly(false)
  }

  const productSignalCounts = useMemo(() => {
    const counts = new Map<string, number>()
    safeIntelligenceLogs.forEach(log => {
      const isDemandSignal =
        log.interactionType === 'Enquiry' ||
        log.interactionType === 'Price Request' ||
        log.interactionType === 'Stock Request' ||
        log.interactionType === 'Product Search'
      if (!isDemandSignal) return
      ;[
        log.productId,
        log.productName,
        `${log.vendorId || ''}:${log.productName || ''}`
      ]
        .filter(Boolean)
        .forEach(key => {
          const normalized = String(key).toLowerCase().trim()
          counts.set(normalized, (counts.get(normalized) || 0) + 1)
        })
    })
    return counts
  }, [safeIntelligenceLogs])

  const entitlementResult = useMemo(() => {
    const includedProducts: Product[] = []
    const excludedProducts: (Product & { catalogueExclusionReason: string })[] =
      []
    const summaries: CatalogueEntitlementSummary[] = []
    const shouldOverride =
      canOverridePlanLimits &&
      overridePlanLimits &&
      overrideReason.trim().length > 0

    selectedVendors.forEach(vendor => {
      const { plan, planSource, planStatus } = resolveCataloguePlan(
        vendor,
        safePlans,
        entitlementByVendorId[vendor.id]
      )

      const vendorProducts = rawSelectedProducts.filter(
        p =>
          p.vendorId === vendor.id &&
          isProductQuotaBillable(p) &&
          (!selectedProductsOnly || selectedProductIds.includes(p.id))
      )
      const vendorHistory = safeHistory.filter(item =>
        (item.vendorIds || []).includes(vendor.id)
      )
      const cataloguesThisPeriod = vendorHistory.filter(item =>
        isCurrentMonth(item.generatedAt)
      ).length

      const isCatalogueEnabled = plan?.enableCatalogueGeneration !== false
      const isMultiVendorAllowed =
        selectedVendors.length === 1 || !!plan?.enableMultiVendorCatalogue
      const hasActivePlan = !!plan && isCatalogueEnabled && isMultiVendorAllowed

      const allowedProducts = hasActivePlan
        ? resolveCatalogueAllowedProducts(plan, config.maxProducts)
        : 0

      const overageQuantity =
        allowedProducts === Infinity
          ? 0
          : Math.max(0, vendorProducts.length - allowedProducts)

      const allowOverage = !!plan?.allowCatalogueOverage
      const allowCredit = !!plan?.allowCatalogueCredit
      const overageUnitPrice =
        plan?.catalogueOveragePrice || getOverageUnitPrice(plan)
      const overageDue = overageQuantity * overageUnitPrice
      const creditBalance = getVendorCreditBalance(vendor)
      const creditCovers =
        overageQuantity > 0 &&
        allowOverage &&
        allowCredit &&
        creditBalance >= overageDue

      const rankedProducts = [...vendorProducts].sort((a, b) => {
        const aFeatured = (a as any).featured ? 1 : 0
        const bFeatured = (b as any).featured ? 1 : 0
        if (aFeatured !== bFeatured) return bFeatured - aFeatured

        const aSignals =
          productSignalCounts.get(String(a.productId || a.id).toLowerCase()) ||
          productSignalCounts.get(a.name.toLowerCase()) ||
          productSignalCounts.get(`${a.vendorId}:${a.name}`.toLowerCase()) ||
          0
        const bSignals =
          productSignalCounts.get(String(b.productId || b.id).toLowerCase()) ||
          productSignalCounts.get(b.name.toLowerCase()) ||
          productSignalCounts.get(`${b.vendorId}:${b.name}`.toLowerCase()) ||
          0
        if (aSignals !== bSignals) return bSignals - aSignals

        const aInStock = a.stockQuantity > 0 ? 1 : 0
        const bInStock = b.stockQuantity > 0 ? 1 : 0
        if (aInStock !== bInStock) return bInStock - aInStock

        const aHasImage = a.imageUrl ? 1 : 0
        const bHasImage = b.imageUrl ? 1 : 0
        if (aHasImage !== bHasImage) return bHasImage - aHasImage

        return (
          (safeDateFromUnknown(b.updatedAt || b.createdAt)?.getTime() || 0) -
          (safeDateFromUnknown(a.updatedAt || a.createdAt)?.getTime() || 0)
        )
      })

      const allAllowed = overageQuantity === 0 || creditCovers || shouldOverride
      const vendorIncluded = allAllowed
        ? rankedProducts
        : asArray<Product>(rankedProducts).slice(0, allowedProducts)

      let exclusionReason = 'excluded_due_to_plan_limit'
      if (!hasActivePlan) {
        if (!plan)
          exclusionReason =
            'No active plan assigned. Assign a plan before catalogue generation.'
        else if (!isCatalogueEnabled)
          exclusionReason = 'Catalogue generation is disabled on this plan.'
        else if (!isMultiVendorAllowed)
          exclusionReason =
            'Multi-vendor catalogues are not enabled for this plan.'
      } else if (overageQuantity > 0 && !allowOverage) {
        exclusionReason = 'Plan limit exceeded and overage is not allowed.'
      } else if (overageQuantity > 0 && !allowCredit) {
        exclusionReason = 'Plan limit exceeded and credit payment is disabled.'
      }

      const vendorExcluded = allAllowed
        ? []
        : asArray<Product>(rankedProducts)
            .slice(
              allowedProducts === Infinity
                ? rankedProducts.length
                : allowedProducts
            )
            .map(product => ({
              ...product,
              catalogueExclusionReason: exclusionReason
            }))

      const finalEntitlement = canGenerateCatalogue({
        vendorId: vendor.id,
        plan: plan || {},
        selectedProductCount: vendorIncluded.length,
        selectedImageCount: vendorIncluded.reduce(
          (c, p) => c + getProductImageCount(p),
          0
        ),
        cataloguesThisPeriod,
        allowOverage,
        walletBalance: allowCredit ? creditBalance : 0,
        isMultiVendor: selectedVendors.length > 1
      })

      let upgradeRecommendation =
        overageQuantity > 0
          ? `Upgrade ${vendor.name} from ${
              plan?.name || 'current plan'
            } or preload catalogue credit.`
          : 'No upgrade required.'

      if (!hasActivePlan) {
        upgradeRecommendation = !plan
          ? 'No active plan assigned. Assign a plan before catalogue generation.'
          : !isCatalogueEnabled
          ? 'Catalogue generation is disabled on this plan.'
          : 'Multi-vendor catalogues are not enabled for this plan.'
      } else if (!finalEntitlement.allowed && !shouldOverride) {
        upgradeRecommendation = finalEntitlement.reasons
          .map((r: any) => r.message)
          .join('; ')
      }

      includedProducts.push(...vendorIncluded)
      excludedProducts.push(...vendorExcluded)

      summaries.push({
        vendorId: vendor.id,
        vendorName: vendor.name,
        planName: plan?.name || vendor.planId || 'Unassigned Plan',
        planSource,
        planStatus,
        selectedProducts: vendorProducts.length,
        allowedProducts,
        includedProducts: vendorIncluded.length,
        excludedProducts: vendorExcluded.length,
        overageQuantity,
        overageUnitPrice,
        overageDue,
        creditUsed: creditCovers && !shouldOverride ? overageDue : 0,
        remainingCredit:
          creditCovers && !shouldOverride
            ? creditBalance - overageDue
            : creditBalance,
        overrideUsed: !!shouldOverride && overageQuantity > 0,
        upgradeRecommendation,
        excludedProductNames: vendorExcluded.map(p => p.name)
      })
    })

    return {
      includedProducts: asArray<Product>(includedProducts).slice(
        0,
        config.maxProducts
      ),
      excludedProducts,
      summaries
    }
  }, [
    canOverridePlanLimits,
    config.maxProducts,
    overridePlanLimits,
    overrideReason,
    productSignalCounts,
    rawSelectedProducts,
    entitlementByVendorId,
    safePlans,
    selectedProductIds,
    selectedProductsOnly,
    selectedVendors
  ])

  const allSelectedProducts = entitlementResult.includedProducts
  const entitlementSummaries = entitlementResult.summaries
  const entitlementExcludedProducts = entitlementResult.excludedProducts

  const handleExportCatalogueProducts = () => {
    const vendorName =
      selectedVendors.length === 1
        ? selectedVendors[0].tradingName || selectedVendors[0].name || 'Vendor'
        : config.sector || 'Catalogue'
    const rows = buildVendorProductExportRows({
      products: allSelectedProducts,
      vendorName
    })

    if (!exportVendorProductRows(rows, vendorName, 'Catalogue-Product-List')) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'No products available to export.',
        type: 'info'
      })
    }
  }

  const entitlementSummaryByVendor = useMemo(
    () =>
      new Map(entitlementSummaries.map(summary => [summary.vendorId, summary])),
    [entitlementSummaries]
  )

  const vendorBiRows = useMemo<VendorCatalogueBiRow[]>(() => {
    const selectedVendorIdSet = new Set(config.vendorIds)
    const includedProductsByVendor = new Map<string, Product[]>()
    const rawProductsByVendor = new Map<string, Product[]>()

    allSelectedProducts.forEach(product => {
      const list = includedProductsByVendor.get(product.vendorId) || []
      list.push(product)
      includedProductsByVendor.set(product.vendorId, list)
    })
    rawSelectedProducts.forEach(product => {
      const list = rawProductsByVendor.get(product.vendorId) || []
      list.push(product)
      rawProductsByVendor.set(product.vendorId, list)
    })

    return safeVendors
      .filter(
        vendor =>
          !biFilters.selectedVendorsOnly || selectedVendorIdSet.has(vendor.id)
      )
      .map(vendor => {
        const sub = subscriptionService.getSubscriptionByVendor(vendor.id)
        const isActiveSub =
          sub &&
          [
            'active',
            'trial',
            'past_due',
            'grace_period',
            'due',
            'overdue'
          ].includes(sub.status)
        const { plan } = resolveCataloguePlan(
          vendor,
          safePlans,
          entitlementByVendorId[vendor.id]
        )
        const planName = plan?.name || vendor.planId || 'Unassigned Plan'
        const summary = entitlementSummaryByVendor.get(vendor.id)
        const rawVendorProducts =
          rawProductsByVendor.get(vendor.id) ||
          (biFilters.selectedProductsOnly
            ? []
            : getBillableProductsForVendor(safeProducts, vendor.id))
        const includedVendorProducts =
          includedProductsByVendor.get(vendor.id) || []
        const selectedProductCount =
          summary?.selectedProducts ?? rawVendorProducts.length

        const resolvedProductLimit = resolveCatalogueProductLimit(plan)
        const productLimit =
          resolvedProductLimit === 'unlimited'
            ? null
            : typeof resolvedProductLimit === 'number'
            ? resolvedProductLimit
            : getPlanLimit(plan, ['maxProducts', 'productLimit'])
        const imageLimit = getPlanLimit(plan, [
          'maxImages',
          'imageLimit',
          'maxImagesPerCatalogue'
        ])
        const catalogueLimit = getPlanLimit(plan, [
          'catalogueGenerationLimit',
          'maxCataloguesPerMonth',
          'maxDeploymentsPerMonth'
        ])
        const branchLimit = getPlanLimit(plan, [
          'maxBranches',
          'branchLimit',
          'maxBranchesPerVendor'
        ])
        const staffLimit = getPlanLimit(plan, [
          'maxStaff',
          'staffLimit',
          'maxStaffPerVendor'
        ])
        const noticeLimit = getPlanLimit(plan, ['noticeLimit', 'maxNotices'])

        const productsForImageCount =
          includedVendorProducts.length > 0
            ? includedVendorProducts
            : rawVendorProducts
        const imagesUsed =
          productsForImageCount.reduce(
            (count, product) => count + getProductImageCount(product),
            0
          ) + getVendorStaticImageCount(vendor)
        const cataloguesGeneratedThisMonth = safeHistory.filter(
          item =>
            (item.vendorIds || []).includes(vendor.id) &&
            isCurrentMonth(item.generatedAt)
        ).length
        const branchesUsed = (vendor.branches || []).length
        const staffUsed = (vendor.staff || []).length
        const noticesUsed = Number(
          (vendor as any).noticesUsed || (vendor as any).noticeCount || 0
        )
        const hasCreditField = [
          'creditBalance',
          'walletBalance',
          'prepaidAllowance',
          'catalogueCreditBalance'
        ].some(key => Object.prototype.hasOwnProperty.call(vendor, key))
        const creditBalance = hasCreditField
          ? getVendorCreditBalance(vendor)
          : null
        const overageDue = summary?.overageDue || 0

        const productStatus =
          summary && summary.overageQuantity > 0
            ? getUsageStatus(summary.selectedProducts, summary.allowedProducts)
            : getUsageStatus(selectedProductCount, productLimit)
        let status: CatalogueBiStatus = 'OK'
        const statusReasons: string[] = []
        ;[
          ['Products', productStatus],
          ['Images', getUsageStatus(imagesUsed, imageLimit)],
          [
            'Catalogues',
            getUsageStatus(cataloguesGeneratedThisMonth, catalogueLimit)
          ],
          ['Branches', getUsageStatus(branchesUsed, branchLimit)],
          ['Staff', getUsageStatus(staffUsed, staffLimit)],
          ['Notices', getUsageStatus(noticesUsed, noticeLimit)]
        ].forEach(([label, nextStatus]) => {
          const typedStatus = nextStatus as CatalogueBiStatus | null
          if (typedStatus) statusReasons.push(`${label}: ${typedStatus}`)
          status = mergeBiStatus(status, typedStatus)
        })
        if (
          summary &&
          summary.overageQuantity > 0 &&
          summary.creditUsed === 0 &&
          !summary.overrideUsed
        ) {
          status = mergeBiStatus(status, 'Credit Required')
          statusReasons.push(
            creditBalance === null
              ? 'Credit logic not configured'
              : 'Credit required for product overage'
          )
        }

        const productNames = rawVendorProducts.map(
          product => product.name || product.productName || ''
        )
        const branchNames = (vendor.branches || []).map(branch => branch.name)
        const assignedStaff = [
          vendor.assignedStaffName,
          vendor.assignedMemberName,
          ...(vendor.staff || []).map(
            staff => staff.fullName || staff.displayName
          )
        ]

        return {
          vendorId: vendor.id,
          vendorName: vendor.name || vendor.tradingName || 'Vendor',
          tradingName: vendor.tradingName || '',
          planName,
          planGroup: classifyPlanGroup(planName),
          sector: vendor.sector || '',
          category: (vendor as any).category || vendor.businessType || '',
          city: vendor.cityTown || '',
          district: vendor.district || '',
          suburb: vendor.suburb || '',
          productsSelected: selectedProductCount,
          productLimit,
          productsRemaining:
            productLimit === null ? null : productLimit - selectedProductCount,
          imagesUsed,
          imageLimit,
          imagesRemaining: imageLimit === null ? null : imageLimit - imagesUsed,
          cataloguesGeneratedThisMonth,
          catalogueLimit,
          cataloguesRemaining:
            catalogueLimit === null
              ? null
              : catalogueLimit - cataloguesGeneratedThisMonth,
          branchesUsed,
          branchLimit,
          branchesRemaining:
            branchLimit === null ? null : branchLimit - branchesUsed,
          staffUsed,
          staffLimit,
          staffRemaining: staffLimit === null ? null : staffLimit - staffUsed,
          noticesUsed,
          noticeLimit,
          noticesRemaining:
            noticeLimit === null ? null : noticeLimit - noticesUsed,
          creditBalance,
          overageDue,
          status,
          statusReasons,
          allowedProducts:
            summary?.allowedProducts ?? productLimit ?? selectedProductCount,
          excludedProducts: summary?.excludedProducts || 0,
          includedProducts:
            summary?.includedProducts ?? includedVendorProducts.length,
          upgradeRecommendation:
            summary?.upgradeRecommendation ||
            (status === 'OK'
              ? 'No upgrade required.'
              : `Upgrade ${
                  vendor.name || 'vendor'
                } or top up catalogue credit.`),
          productNames,
          searchText: buildSearchText([
            vendor.name,
            vendor.tradingName,
            planName,
            vendor.sector,
            (vendor as any).category,
            vendor.businessType,
            vendor.cityTown,
            vendor.district,
            vendor.suburb,
            branchNames.join(' '),
            productNames.join(' '),
            status,
            statusReasons.join(' '),
            vendor.rpnName,
            vendor.assignedStaffName,
            vendor.assignedMemberName,
            assignedStaff.join(' ')
          ])
        }
      })
  }, [
    allSelectedProducts,
    biFilters.selectedProductsOnly,
    biFilters.selectedVendorsOnly,
    config.vendorIds,
    entitlementSummaryByVendor,
    entitlementByVendorId,
    rawSelectedProducts,
    safeHistory,
    safePlans,
    safeProducts,
    safeVendors,
    entitlementByVendorId
  ])

  const vendorCreditRows = useMemo<VendorCatalogueCreditRow[]>(() => {
    const selectedVendorSet = new Set(config.vendorIds)
    const selectedProductVendorSet = new Set(
      rawSelectedProducts.map(product => product.vendorId)
    )

    return safeVendors
      .map(vendor => {
        const { plan } = resolveCataloguePlan(
          vendor,
          safePlans,
          entitlementByVendorId[vendor.id]
        )
        const summary = entitlementSummaryByVendor.get(vendor.id)
        const vendorProducts = rawSelectedProducts.filter(
          product =>
            product.vendorId === vendor.id && isProductQuotaBillable(product)
        )
        const productsAllowed =
          summary?.allowedProducts ??
          resolveCatalogueAllowedProducts(plan, config.maxProducts)
        const productsSelected =
          summary?.selectedProducts ?? vendorProducts.length
        const productsOverLimit =
          productsAllowed === Infinity
            ? 0
            : Math.max(0, productsSelected - productsAllowed)
        const overageDue = summary?.overageDue || 0
        const creditUsed = summary?.creditUsed || 0
        const creditBalance = getVendorCreditBalance(vendor)
        const remainingCredit =
          summary?.remainingCredit ?? Math.max(0, creditBalance - creditUsed)
        const imagesAllowedRaw = plan?.maxImagesPerCatalogue ?? config.maxImages
        const imagesAllowed =
          String(imagesAllowedRaw).toLowerCase() === 'unlimited'
            ? Infinity
            : Number(imagesAllowedRaw)
        const imagesSelected = vendorProducts.reduce(
          (count, product) => count + getProductImageCount(product),
          0
        )
        const imagesDue =
          imagesAllowed === Infinity ? 0 : imagesAllowed - imagesSelected
        const deploymentsAllowedRaw =
          plan?.cataloguesIncludedPerMonth ?? plan?.maxDeploymentsPerMonth ?? 0
        const deploymentsAllowedThisMonth =
          String(deploymentsAllowedRaw).toLowerCase() === 'unlimited'
            ? Infinity
            : Number(deploymentsAllowedRaw)
        const vendorHistory = safeHistory
          .filter(item => (item.vendorIds || []).includes(vendor.id))
          .sort(
            (a, b) =>
              (safeDateFromUnknown(b.generatedAt)?.getTime() || 0) -
              (safeDateFromUnknown(a.generatedAt)?.getTime() || 0)
          )
        const deploymentsUsedThisMonth = vendorHistory.filter(item =>
          isCurrentMonth(item.generatedAt)
        ).length
        const deploymentsDue =
          deploymentsAllowedThisMonth - deploymentsUsedThisMonth
        const lastDeploymentDate = safeIsoString(
          vendorHistory[0]?.generatedAt
        ).slice(0, 10)
        const nextDeploymentDate = getNextDeploymentDate(
          lastDeploymentDate,
          plan
        )
        const subscription = subscriptionService.getSubscriptionByVendor(
          vendor.id
        )
        const subscriptionStatus =
          subscription?.status || vendor.subscriptionStatus || 'not recorded'
        const subscriptionIsDue = ['due', 'overdue'].includes(
          subscriptionStatus
        )
        const billDue = Math.max(
          0,
          (subscriptionIsDue ? Number(plan?.monthlyPrice || 0) : 0) +
            overageDue -
            creditBalance
        )

        const allowOverage = !!plan?.allowCatalogueOverage
        const allowCredit = !!plan?.allowCatalogueCredit

        const entitlement = canGenerateCatalogue({
          vendorId: vendor.id,
          plan: plan || {},
          selectedProductCount: productsSelected,
          selectedImageCount: imagesSelected,
          cataloguesThisPeriod: deploymentsUsedThisMonth,
          allowOverage,
          walletBalance: allowCredit ? creditBalance : 0,
          isMultiVendor: selectedVendorSet.size > 1
        })

        let status: VendorCatalogueEntitlementStatus = 'OK'
        let recommendedAction = 'Ready to generate catalogue.'
        let actionLabel = 'READY FOR DEPLOYMENT'

        if (summary?.overrideUsed) {
          status = 'OVERRIDE_USED'
          recommendedAction =
            'Override will be logged with finance/admin audit.'
        } else if (!entitlement.allowed) {
          const reasons = entitlement.reasons.map((r: any) => r.key)
          if (reasons.includes('catalogues')) {
            status = 'DEPLOYMENT_LIMIT_REACHED'
            recommendedAction =
              'Wait for next deployment window or use admin override.'
            actionLabel = 'NEXT CYCLE'
          } else if (reasons.includes('images')) {
            status = 'IMAGE_LIMIT_EXCEEDED'
            recommendedAction =
              'Reduce images, split catalogue, or upgrade vendor plan.'
            actionLabel = 'REDUCE/COMPRESS IMAGES'
          } else if (
            reasons.includes('products') ||
            reasons.includes('credit')
          ) {
            status =
              remainingCredit <= 0 ? 'CREDIT_REQUIRED' : 'UPGRADE_RECOMMENDED'
            recommendedAction =
              remainingCredit <= 0
                ? 'Top up vendor credit or upgrade plan before including over-limit products.'
                : 'Credit exists but does not cover the full overage.'
            actionLabel = 'UPGRADE OR TOP-UP'
            if (
              selectedVendorSet.has(vendor.id) &&
              productsOverLimit > 0 &&
              creditUsed === 0 &&
              !summary?.overrideUsed
            ) {
              status = 'BLOCKED'
            }
          } else {
            status = 'BLOCKED'
            recommendedAction = entitlement.reasons
              .map((r: any) => r.message)
              .join('; ')
            actionLabel = 'BLOCKED'
          }
        } else {
          if (productsOverLimit > 0 && creditUsed > 0) {
            status = 'UPGRADE_RECOMMENDED'
            recommendedAction =
              'Credit will be consumed. Upgrade is recommended for repeat demand.'
            actionLabel = 'CREDIT AVAILABLE'
          } else if (deploymentsDue <= 0) {
            status = 'DEPLOYMENT_LIMIT_REACHED'
            recommendedAction = 'Deployment limit reached for this period.'
            actionLabel = 'NEXT CYCLE'
          }
        }

        if (billDue > 0 && status !== 'BLOCKED') {
          actionLabel = 'PAY / TOP-UP REQUIRED'
        }

        return {
          vendorId: vendor.id,
          vendorName: vendor.name || vendor.tradingName || 'Vendor',
          planId: plan?.id || vendor.planId || '',
          planName: plan?.name || vendor.planId || 'Unassigned Plan',
          sector: vendor.sector || '',
          city: vendor.cityTown || '',
          suburb: vendor.suburb || '',
          creditBalance,
          productsAllowed,
          productsSelected,
          productsOverLimit,
          overageDue,
          creditUsed,
          remainingCredit,
          imagesAllowed,
          imagesSelected,
          imagesDue,
          deploymentsAllowedThisMonth,
          deploymentsUsedThisMonth,
          deploymentsDue,
          lastDeploymentDate,
          nextDeploymentDate,
          status,
          recommendedAction,
          actionLabel,
          billDue,
          subscriptionStatus
        }
      })
      .filter(row => {
        if (
          vendorCreditFilters.selectedVendorsOnly &&
          !selectedVendorSet.has(row.vendorId)
        ) {
          return false
        }
        if (
          vendorCreditFilters.selectedProductsOnly &&
          !selectedProductVendorSet.has(row.vendorId)
        ) {
          return false
        }
        if (vendorCreditFilters.overLimitOnly && row.productsOverLimit <= 0)
          return false
        if (vendorCreditFilters.noCreditOnly && row.creditBalance > 0)
          return false
        if (
          vendorCreditFilters.plan &&
          row.planName.toLowerCase() !== vendorCreditFilters.plan.toLowerCase()
        ) {
          return false
        }
        if (
          vendorCreditFilters.sector &&
          row.sector !== vendorCreditFilters.sector
        )
          return false
        if (
          vendorCreditFilters.city &&
          !matchesFreeOrderSearch(row.city || '', vendorCreditFilters.city)
        ) {
          return false
        }
        if (
          vendorCreditFilters.suburb &&
          !matchesFreeOrderSearch(row.suburb || '', vendorCreditFilters.suburb)
        ) {
          return false
        }
        return true
      })
      .sort((a, b) =>
        vendorCreditSort === 'most_credit'
          ? b.remainingCredit - a.remainingCredit
          : a.remainingCredit - b.remainingCredit
      )
  }, [
    config.maxImages,
    config.maxProducts,
    config.vendorIds,
    entitlementSummaryByVendor,
    rawSelectedProducts,
    safeHistory,
    safePlans,
    safeVendors,
    vendorCreditFilters,
    vendorCreditSort
  ])

  const catalogueSizeControl = useMemo(() => {
    const selectedImages = allSelectedProducts.filter(
      product => product.imageUrl
    )
    const imagePayload = optimizationSummary
      ? optimizationSummary.totalEstimatedPayloadBytes
      : selectedImages.length * MAX_CATALOGUE_IMAGE_SIZE_BYTES
    const productPayload = allSelectedProducts.reduce(
      (sum, product) => sum + JSON.stringify(product).length,
      0
    )
    const estimatedBytes = 100000 + imagePayload + productPayload
    const oversizedCount = optimizationSummary
      ? optimizationSummary.aboveTargetCount + optimizationSummary.failedCount
      : 0
    const excludedDueToPolicy =
      imageHandlingPolicy === 'exclude_oversized' ? oversizedCount : 0
    return {
      selectedVendors: selectedVendors.length,
      selectedProducts: allSelectedProducts.length,
      selectedImages: selectedImages.length,
      estimatedBytes,
      remainingBytes: MAX_CATALOGUE_SIZE_BYTES - estimatedBytes,
      oversizedCount,
      excludedDueToPolicy,
      isOverSize: estimatedBytes > MAX_CATALOGUE_SIZE_BYTES
    }
  }, [
    allSelectedProducts,
    imageHandlingPolicy,
    optimizationSummary,
    selectedVendors.length
  ])

  const filteredVendorBiRows = useMemo(() => {
    return vendorBiRows.filter(row => {
      if (!matchesFreeOrderSearch(row.searchText, biFilters.search))
        return false
      if (biFilters.plan !== 'all' && row.planGroup !== biFilters.plan)
        return false
      if (biFilters.status !== 'all' && row.status !== biFilters.status)
        return false
      if (biFilters.sector && row.sector !== biFilters.sector) return false
      if (
        biFilters.cityRegion &&
        !matchesFreeOrderSearch(
          `${row.city} ${row.district} ${row.suburb}`,
          biFilters.cityRegion
        )
      ) {
        return false
      }
      if (biFilters.hasProducts !== 'all') {
        const hasProducts = row.productsSelected > 0
        if ((biFilters.hasProducts === 'yes') !== hasProducts) return false
      }
      if (biFilters.hasImagesRemaining !== 'all') {
        const hasImagesRemaining =
          row.imageLimit === null || (row.imagesRemaining ?? 0) > 0
        if ((biFilters.hasImagesRemaining === 'yes') !== hasImagesRemaining)
          return false
      }
      if (biFilters.hasCataloguesRemaining !== 'all') {
        const hasCataloguesRemaining =
          row.catalogueLimit === null || (row.cataloguesRemaining ?? 0) > 0
        if (
          (biFilters.hasCataloguesRemaining === 'yes') !==
          hasCataloguesRemaining
        ) {
          return false
        }
      }
      if (biFilters.overLimitOnly && row.status !== 'Over Limit') return false
      if (
        biFilters.noCreditOnly &&
        !(row.creditBalance === null || row.creditBalance <= 0)
      ) {
        return false
      }
      if (biFilters.nearLimitOnly && row.status !== 'Near Limit') return false
      return true
    })
  }, [biFilters, vendorBiRows])

  const biSectors = useMemo(
    () =>
      Array.from(
        new Set(vendorBiRows.map(row => row.sector).filter(Boolean))
      ).sort(),
    [vendorBiRows]
  )

  const catalogueAnalyticsSummary = useMemo(() => {
    const activeProducts = rawSelectedProducts.filter(
      product => product.status === 'active'
    ).length
    const publishedProducts = rawSelectedProducts.filter(
      product => product.publishToCatalogue
    ).length
    const totalRemainingImages = vendorBiRows.reduce((total, row) => {
      if (row.imagesRemaining === null) return total
      return total + Math.max(0, row.imagesRemaining)
    }, 0)
    const totalRemainingCatalogues = vendorBiRows.reduce((total, row) => {
      if (row.cataloguesRemaining === null) return total
      return total + Math.max(0, row.cataloguesRemaining)
    }, 0)

    return {
      selectedVendors: selectedVendors.length,
      selectedProducts: rawSelectedProducts.length,
      activeProducts,
      publishedProducts,
      productsExcluded: entitlementExcludedProducts.length,
      vendorsWithPlanLimitsReached: vendorBiRows.filter(row =>
        ['Limit Reached', 'Over Limit', 'Credit Required'].includes(row.status)
      ).length,
      totalVendorImagesUsed: vendorBiRows.reduce(
        (total, row) => total + row.imagesUsed,
        0
      ),
      totalRemainingVendorImageAllowance: totalRemainingImages,
      totalRemainingCatalogueAllowance: totalRemainingCatalogues,
      vendorsWithNoRemainingCatalogueCredits: vendorBiRows.filter(
        row =>
          row.catalogueLimit !== null && (row.cataloguesRemaining ?? 0) <= 0
      ).length,
      vendorsWithNoRemainingImageCredits: vendorBiRows.filter(
        row => row.imageLimit !== null && (row.imagesRemaining ?? 0) <= 0
      ).length,
      overLimitVendors: vendorBiRows.filter(row => row.status === 'Over Limit'),
      nearLimitVendors: vendorBiRows.filter(row => row.status === 'Near Limit'),
      creditRequiredVendors: vendorBiRows.filter(
        row => row.status === 'Credit Required'
      )
    }
  }, [
    entitlementExcludedProducts.length,
    rawSelectedProducts,
    selectedVendors.length,
    vendorBiRows
  ])

  const selectedCahLinks = useMemo(
    () => safeCahLinks.filter(l => selectedCahLinkIds.includes(l.id)),
    [safeCahLinks, selectedCahLinkIds]
  )

  const estimatedSize = useMemo(() => {
    if (config.vendorIds.length === 0 || allSelectedProducts.length === 0)
      return 0

    let totalBytes = 100000 // Base size with JS/CSS

    if (optimizationSummary) {
      totalBytes += optimizationSummary.totalEstimatedPayloadBytes
      allSelectedProducts.forEach(p => {
        totalBytes += JSON.stringify(p).length
      })
    } else {
      allSelectedProducts.forEach(p => {
        totalBytes += JSON.stringify(p).length
        if (p.imageUrl) {
          totalBytes += 8192 // Target optimization size
        }
      })
    }

    return totalBytes
  }, [config.vendorIds, allSelectedProducts, optimizationSummary])

  const catalogueBuildMetrics = useMemo(() => {
    const selectedVendorList = asArray<Vendor>(selectedVendors)
    const candidateProducts = asArray<Product>(rawSelectedProducts)
    const includedProducts = asArray<Product>(allSelectedProducts)
    const excludedProducts = asArray<
      Product & { catalogueExclusionReason?: string }
    >(entitlementExcludedProducts)
    const summaries = asArray<CatalogueEntitlementSummary>(
      entitlementSummaries
    )
    const storefrontSourceProducts = asArray<Product>(safeProducts)
    const storefrontProducts = asArray<Product>(safeProducts).filter(product =>
      selectedVendorList.some(vendor => productMatchesVendor(product, vendor))
    )

    const selectedVendorNames = selectedVendorList.map(
      vendor => vendor.name || vendor.tradingName || vendor.id
    )
    const vendorsWithContactIssues = selectedVendorList.filter(
      vendor => !vendor.whatsappNumber || !vendor.catalogueDisplayName
    ).length
    const vendorsWithNoPlan = summaries.filter(summary =>
      ['Unassigned Plan', 'NO ACTIVE PLAN'].includes(summary.planName)
    ).length
    const planBlockedSummaries = summaries.filter(summary => {
      const reason = summary.upgradeRecommendation || ''
      return (
        ['Unassigned Plan', 'NO ACTIVE PLAN'].includes(summary.planName) ||
        /disabled|multi-vendor|no active plan|explicitly zero/i.test(reason) ||
        (summary.allowedProducts === 0 && summary.selectedProducts > 0)
      )
    })
    const vendorsBlockedByPlan = planBlockedSummaries.length
    const stockoutProductCount = candidateProducts.filter(
      product =>
        safeNumber(product.stockQuantity) <= 0 &&
        product.stockQuantity !== undefined &&
        (product as any).stockStatus !== 'in_stock'
    ).length
    const selectedProductsForExport = selectedProductsOnly
      ? candidateProducts.filter(product => selectedProductIds.includes(product.id))
      : candidateProducts
    const selectedImageCount = selectedProductsForExport.reduce(
      (count, product) => count + getProductImageCount(product),
      0
    )
    const includedImageCount = includedProducts.reduce(
      (count, product) => count + getProductImageCount(product),
      0
    )
    const oversizedImageCount =
      safeNumber(optimizationSummary?.aboveMaxCount) ||
      includedProducts.filter(
        product =>
          safeNumber((product as any).imageOptimizationBytes) >
            MAX_CATALOGUE_IMAGE_SIZE_BYTES ||
          ['blocked', 'failed'].includes(
            safeText((product as any).imageOptimizationStatus).toLowerCase()
          )
      ).length
    const imagesExcludedCount =
      imageHandlingPolicy === 'block_oversized' ? oversizedImageCount : 0
    const estimatedPayloadBytes =
      safeNumber(optimizationSummary?.totalEstimatedPayloadBytes) ||
      includedImageCount * MAX_CATALOGUE_IMAGE_SIZE_BYTES
    const estimatedFileSizeKb = estimatedSize / 1024
    const estimatedPayloadMb = estimatedPayloadBytes / 1024 / 1024
    const includedProductCount = includedProducts.length
    const reviewWarnings: string[] = []
    const storefrontAlignmentIssue =
      selectedVendorList.length > 0 &&
      storefrontProducts.length > 0 &&
      candidateProducts.length === 0

    if (selectedVendorList.length === 0) {
      reviewWarnings.push('No selected vendor.')
    }
    if (
      storefrontSourceProducts.length > 0 &&
      storefrontProducts.length === 0 &&
      candidateProducts.length === 0 &&
      vendorsBlockedByPlan === 0
    ) {
      reviewWarnings.push(
        'Products exist in storefront source but did not match selected vendor keys.'
      )
    }
    if (
      storefrontProducts.length > 0 &&
      candidateProducts.length === 0 &&
      vendorsBlockedByPlan === 0
    ) {
      reviewWarnings.push(
        'Products filtered out by publish/stock rules.'
      )
    }
    if (
      selectedVendorList.length > 0 &&
      storefrontProducts.length === 0 &&
      candidateProducts.length === 0 &&
      vendorsBlockedByPlan === 0
    ) {
      reviewWarnings.push(
        'Products exist in Storefront Builder but are not entering catalogue metrics. Check vendor key matching or source alignment.'
      )
    }
    if (
      candidateProducts.length > 0 &&
      selectedProductsOnly &&
      selectedProductIds.length === 0
    ) {
      reviewWarnings.push('Products available but none selected.')
    }
    if (candidateProducts.length > 0 && includedProductCount === 0) {
      reviewWarnings.push(
        'No exportable products selected. Check product selection, publish status, stock status, and plan limits.'
      )
    }
    if (vendorsWithContactIssues > 0) {
      reviewWarnings.push(
        `${vendorsWithContactIssues} selected vendor(s) missing critical contact info.`
      )
    }
    if (vendorsWithNoPlan > 0) {
      reviewWarnings.push(`${vendorsWithNoPlan} selected vendor(s) have no active plan.`)
    }
    if (vendorsBlockedByPlan > 0) {
      reviewWarnings.push(`${vendorsBlockedByPlan} selected vendor(s) blocked by plan rules.`)
    }
    if (includedProductCount > 0 && includedImageCount === 0) {
      reviewWarnings.push('No images found for included products.')
    }
    if (imagesExcludedCount > 0) {
      reviewWarnings.push(`${imagesExcludedCount} oversized image(s) excluded.`)
    }
    if (selectedCahLinkIds.length === 0) {
      reviewWarnings.push('CAH links not selected.')
    }

    const deploymentRows = summaries.map(summary => {
      const planBlocked = planBlockedSummaries.some(
        item => item.vendorId === summary.vendorId
      )
      let blockReason = ''
      if (planBlocked) {
        blockReason = summary.upgradeRecommendation
      } else if (summary.excludedProducts > 0) {
        blockReason = summary.upgradeRecommendation
      } else if (
        storefrontProducts.length > 0 &&
        candidateProducts.length === 0
      ) {
        blockReason = 'Products filtered out by publish/stock rules.'
      } else if (
        candidateProducts.length > 0 &&
        selectedProductsOnly &&
        selectedProductIds.length === 0
      ) {
        blockReason = 'Products available but none selected.'
      }

      return {
        vendorId: summary.vendorId,
        vendorName: summary.vendorName,
        planName: summary.planName,
        selectedProducts: summary.selectedProducts,
        allowedProducts: summary.allowedProducts,
        includedProducts: summary.includedProducts,
        excludedProducts: summary.excludedProducts,
        overageDue: summary.overageDue,
        creditUsed: summary.creditUsed,
        remainingCredit: summary.remainingCredit,
        blockReason
      }
    })

    if (storefrontAlignmentIssue) {
      selectedVendorList.forEach(vendor => {
        const vendorStorefrontProducts = storefrontProducts.filter(product =>
          productMatchesVendor(product, vendor)
        )
        console.log('Catalogue metrics source alignment diagnostics:', {
          selectedVendorKeys: getVendorMatchKeys(vendor),
          storefrontSourceCount: storefrontSourceProducts.length,
          vendorMatchedCount: vendorStorefrontProducts.length,
          candidateProductCount: candidateProducts.length,
          linkedProductCount: vendorStorefrontProducts.filter(
            product => product.productMode !== 'branded_product'
          ).length,
          brandedProductCount: vendorStorefrontProducts.filter(
            product => product.productMode === 'branded_product'
          ).length,
          planName:
            deploymentRows.find(row => row.vendorId === vendor.id)?.planName ||
            entitlementByVendorId[vendor.id]?.planName ||
            vendor.planId ||
            'Unknown',
          blockReason:
            'Products exist in Storefront Builder but are not entering catalogue metrics. Check vendor key matching or source alignment.'
        })
      })
    }

    let imageStatus = 'GOOD'
    if (includedProductCount === 0) imageStatus = 'NOT READY'
    else if (includedImageCount === 0) imageStatus = 'WARNING'
    else if (imagesExcludedCount > 0) imageStatus = 'WARNING'
    else if (estimatedPayloadBytes > MAX_CATALOGUE_SIZE_BYTES)
      imageStatus = 'TOO HEAVY'
    else if (estimatedPayloadBytes > 8 * 1024 * 1024) imageStatus = 'WARNING'

    return {
      selectedVendorCount: selectedVendorList.length,
      selectedVendorNames,
      vendorsWithContactIssues,
      vendorsWithNoPlan,
      vendorsBlockedByPlan,
      candidateProductCount: candidateProducts.length,
      selectedProductCount: selectedProductsForExport.length,
      includedProductCount,
      excludedProductCount: excludedProducts.length,
      activeProductCount: candidateProducts.filter(
        product =>
          product.status === 'active' ||
          (product as any).active === true ||
          product.publishToCatalogue === true ||
          (product as any).catalogue === true
      ).length,
      publishedProductCount: candidateProducts.filter(
        product => product.publishToCatalogue !== false
      ).length,
      stockoutProductCount,
      linkedProductCount: candidateProducts.filter(
        product => product.productMode !== 'branded_product'
      ).length,
      brandedProductCount: candidateProducts.filter(
        product => product.productMode === 'branded_product'
      ).length,
      allowedProductCount: summaries.reduce((total, summary) => {
        if (summary.allowedProducts === Infinity) return total
        return total + safeNumber(summary.allowedProducts)
      }, 0),
      productsOverLimit: summaries.reduce(
        (total, summary) => total + safeNumber(summary.overageQuantity),
        0
      ),
      overageDue: summaries.reduce(
        (total, summary) => total + safeNumber(summary.overageDue),
        0
      ),
      creditUsed: summaries.reduce(
        (total, summary) => total + safeNumber(summary.creditUsed),
        0
      ),
      remainingCredit: summaries.reduce(
        (total, summary) => total + safeNumber(summary.remainingCredit),
        0
      ),
      selectedImageCount,
      includedImageCount,
      oversizedImageCount,
      imagesExcludedCount,
      estimatedPayloadBytes,
      estimatedPayloadMb,
      estimatedFileSizeKb,
      imageStatus,
      reviewWarnings,
      deploymentRows
    }
  }, [
    allSelectedProducts,
    entitlementByVendorId,
    entitlementExcludedProducts,
    entitlementSummaries,
    estimatedSize,
    imageHandlingPolicy,
    optimizationSummary,
    rawSelectedProducts,
    safeProducts,
    selectedCahLinkIds.length,
    selectedProductIds,
    selectedProductsOnly,
    selectedVendors
  ])

  const warnings = useMemo(() => {
    const safeSelectedVendors = asArray<Vendor>(selectedVendors)

    const list: string[] = []

    if (allSelectedProducts.length > 800) {
      list.push(`CRITICAL: Product limit exceeded. Stability not guaranteed.`)
    }

    const estimatedPayload = optimizationSummary
      ? optimizationSummary.totalEstimatedPayloadBytes
      : allSelectedProducts.filter(p => p.imageUrl).length * 8192

    if (estimatedPayload > 12 * 1024 * 1024) {
      list.push(
        `Catalogue image payload is high. Consider reducing products, grouping products, or reprocessing large images.`
      )
    } else if (estimatedPayload > 8 * 1024 * 1024) {
      list.push(
        `WARNING: Catalogue image payload is between 8MB-12MB. Performance may degrade.`
      )
    }

    const vendorsWithoutDetails = safeSelectedVendors.filter(
      v => !v.whatsappNumber || !v.catalogueDisplayName
    )
    if (vendorsWithoutDetails.length > 0) {
      list.push(
        `DATA QUALITY: ${vendorsWithoutDetails.length} vendors missing critical contact info.`
      )
    }

    const missingImages = allSelectedProducts.filter(p => !p.imageUrl).length
    if (missingImages > 0) {
      list.push(`AUDIT: ${missingImages} units missing visual assets.`)
    }

    entitlementSummaries
      .filter(summary => summary.overageQuantity > 0)
      .forEach(summary => {
        if (summary.overrideUsed) {
          list.push(
            `ENTITLEMENT OVERRIDE: ${summary.vendorName} includes ${summary.overageQuantity} over-limit products. Finance/admin will be notified.`
          )
        } else if (summary.creditUsed > 0) {
          list.push(
            `ENTITLEMENT CREDIT: ${
              summary.vendorName
            } used ${summary.creditUsed.toFixed(2)} credit for ${
              summary.overageQuantity
            } over-limit products.`
          )
        } else if (summary.excludedProducts > 0) {
          list.push(
            `AUTO-DROP: ${summary.vendorName} excluded ${summary.excludedProducts} products because ${summary.planName} allows ${summary.allowedProducts} and no covering credit was available.`
          )
        }
      })

    // Non-product plan checks still surface as warnings; they do not block export.
    safeSelectedVendors.forEach(vendor => {
      const plan = safePlans.find(p => p.id === vendor.planId)
      if (!plan) return

      const vendorProducts = rawSelectedProducts.filter(
        p => p.vendorId === vendor.id
      )
      const imagesExceeded =
        vendorProducts.filter(p => p.imageUrl).length >
        plan.maxImagesPerCatalogue
      const branchesExceeded =
        (vendor.branches?.length || 0) > plan.maxBranchesPerVendor
      const staffExceeded = (vendor.staff?.length || 0) > plan.maxStaffPerVendor

      if (imagesExceeded)
        list.push(
          `PLAN WARNING: ${vendor.name} exceeds image threshold (${
            vendorProducts.filter(p => p.imageUrl).length
          }/${plan.maxImagesPerCatalogue}).`
        )
      if (branchesExceeded)
        list.push(
          `PLAN WARNING: ${vendor.name} listed branches (${vendor.branches?.length}/${plan.maxBranchesPerVendor}) exceed ${plan.name} allowance.`
        )
      if (staffExceeded)
        list.push(`PLAN WARNING: ${vendor.name} team size exceeds plan limits.`)

      // Frequency Check
      const monthlyDeployments = safeHistory.filter(
        h => h.vendorIds.includes(vendor.id) && isCurrentMonth(h.generatedAt)
      ).length

      if (monthlyDeployments >= plan.maxDeploymentsPerMonth) {
        list.push(
          `POLICY: ${vendor.name} reached monthly deployment cap (${monthlyDeployments}/${plan.maxDeploymentsPerMonth}).`
        )
      }
    })

    return list
  }, [
    allSelectedProducts,
    entitlementSummaries,
    estimatedSize,
    selectedVendors,
    rawSelectedProducts,
    safeHistory,
    safePlans,
    optimizationSummary
  ])

  const filteredHistory = useMemo(() => {
    return safeHistory.filter(h => {
      if (!showArchived && h.status === 'archived') return false
      if (!showReplaced && h.status === 'replaced') return false

      const searchBlob =
        `${h.id} ${h.serialNumber} ${h.sector} ${h.category}`.toLowerCase()
      if (historySearch && !searchBlob.includes(historySearch.toLowerCase()))
        return false

      const matchesSector =
        !filterSector ||
        h.sector.toLowerCase().includes(filterSector.toLowerCase())
      const matchesCategory =
        !filterCategory ||
        h.category.toLowerCase().includes(filterCategory.toLowerCase())
      const matchesStatus = filterStatus === 'all' || h.status === filterStatus
      return matchesSector && matchesCategory && matchesStatus
    })
  }, [
    safeHistory,
    filterSector,
    filterCategory,
    filterStatus,
    showArchived,
    showReplaced,
    historySearch
  ])

  const uniqueSectors = useMemo(
    () => Array.from(new Set(safeHistory.map(h => h.sector))),
    [safeHistory]
  )

  const isActiveCatalogueHubLink = (link: CAHLink) => {
    const status = String(link.status || 'active').toLowerCase()
    const visible = link.showInCatalogue !== false
    const url =
      link.whatsappCommunityLink ||
      link.whatsappGroupLink ||
      link.whatsappChannelLink ||
      link.whatsappUrl ||
      (link as any).url ||
      (link as any).link ||
      ''

    return status === 'active' && visible && !!String(url).trim()
  }

  const getCahLinkPriority = (link: CAHLink) => {
    const text = normalizeFilterValue(
      `${link.name || ''} ${(link as any).title || ''} ${
        link.description || ''
      } ${link.sector || ''} ${link.category || ''}`
    )
    if (text.includes('vendors products discovery')) return 0
    if (text.includes('general commerce access hub')) return 1
    if (text.includes('global discovery')) return 2
    if (text.includes('all sector') || text.includes('all sectors')) return 3
    return 10
  }

  const getCahLinkSearchText = (link: CAHLink) =>
    buildSearchText([
      link.name,
      (link as any).title,
      link.description,
      link.whatsappCommunityLink,
      link.whatsappGroupLink,
      link.whatsappChannelLink,
      link.whatsappUrl,
      (link as any).url,
      (link as any).link,
      link.sector,
      link.category,
      (link as any).city,
      (link as any).cityTown,
      (link as any).suburb,
      (link as any).tags,
      (link as any).notes,
      link.type
    ])

  const filteredCahLinks = useMemo(() => {
    const activeLinks = safeCahLinks.filter(isActiveCatalogueHubLink)
    return activeLinks
      .filter(link =>
        cahLinkSearch
          ? matchesFreeOrderSearch(getCahLinkSearchText(link), cahLinkSearch)
          : true
      )
      .sort(
        (a, b) =>
          getCahLinkPriority(a) - getCahLinkPriority(b) ||
          String(a.name || (a as any).title || '').localeCompare(
            String(b.name || (b as any).title || '')
          )
      )
  }, [safeCahLinks, cahLinkSearch])

  const handleSelectFilteredCahLinks = () => {
    if (filteredCahLinks.length === 0) return
    setSelectedCahLinkIds(prev =>
      Array.from(new Set([...prev, ...filteredCahLinks.map(link => link.id)]))
    )
  }

  const handleGenerate = async (mode: 'new' | 'update' | 'replace' = 'new') => {
    const startedAt = performance.now()
    if (config.vendorIds.length === 0) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Select at least one vendor before creating a catalogue.',
        type: 'warning'
      })
      return
    }

    if (!config.sector || !config.category) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Please provide Sector and Category.',
        type: 'warning'
      })
      return
    }

    if (
      entitlementSummaries.length > 0 &&
      entitlementSummaries.every(s => s.planName === 'NO ACTIVE PLAN')
    ) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message:
          'Catalogue generation blocked. Selected vendors do not have active catalogue plans.',
        type: 'warning'
      })
      return
    }

    if (selectedProductsOnly && selectedProductIds.length === 0) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message:
          'No selected products found. Either select products or turn off Selected Products Only.',
        type: 'warning'
      })
      return
    }

    if (
      overridePlanLimits &&
      canOverridePlanLimits &&
      entitlementSummaries.some(s => s.overageQuantity > 0) &&
      !overrideReason.trim()
    ) {
      showBrandedAlert({
        title: 'Plan Override Reason Required',
        message:
          'Enter an override reason before exporting over-limit products without credit.',
        type: 'warning'
      })
      return
    }

    for (const vendor of selectedVendors) {
      try {
        await planEntitlementService.assertEntitlementOrThrow(
          vendor.id,
          'generate_catalogue'
        )
      } catch (error: any) {
        showBrandedAlert({
          title: 'Catalogue Generation Blocked',
          message:
            error?.message ||
            `${vendor.name} cannot generate a catalogue under the current subscription.`,
          type: 'warning'
        })
        return
      }
    }

    const selectedControlRows = vendorCreditRows.filter(row =>
      config.vendorIds.includes(row.vendorId)
    )
    const deploymentBlockedRows = selectedControlRows.filter(
      row => row.status === 'DEPLOYMENT_LIMIT_REACHED'
    )
    const entitlementBlockedRows = selectedControlRows.filter(
      row => row.status === 'BLOCKED' || row.status === 'IMAGE_LIMIT_EXCEEDED'
    )
    if (
      (deploymentBlockedRows.length > 0 || entitlementBlockedRows.length > 0) &&
      !(canOverridePlanLimits && overridePlanLimits && overrideReason.trim())
    ) {
      showBrandedAlert({
        title: 'Catalogue Generation Blocked',
        message: [
          ...deploymentBlockedRows.map(
            row =>
              `${row.vendorName} reached deployment limit (${row.deploymentsUsedThisMonth}/${row.deploymentsAllowedThisMonth}).`
          ),
          ...entitlementBlockedRows.map(
            row => `${row.vendorName}: ${row.recommendedAction}`
          )
        ].join(' '),
        type: 'warning'
      })
      return
    }

    const finalCahLinks = selectedCahLinks
    const finalCahLinkIds = finalCahLinks.map(link => link.id)

    console.log(
      'Selected CAH links for export',
      finalCahLinks.length,
      finalCahLinks
    )

    const newId = `CAT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    const finalId =
      mode === 'update' && editingCatalogueId ? editingCatalogueId : newId

    const sessionStr = localStorage.getItem('activeStaffSession')
    const activeStaffSession = sessionStr
      ? JSON.parse(sessionStr)
      : { staffId: 'STAFF-ADM', staffName: 'System Admin' }

    let catalogueAnalyticsSnapshot: any = sanitizeForFirestore({
      catalogueId: finalId ?? config.id ?? null,
      catalogueSerial: config.serialNumber ?? null,
      vendorIds: config.vendorIds ?? [],
      cahLinkIds: finalCahLinkIds ?? [],
      sector: config.sector ?? null,
      category: config.category ?? null,
      productCount: allSelectedProducts?.length ?? 0,
      selectedVendorCount: config.vendorIds?.length ?? 0,
      selectedCahLinkCount: finalCahLinkIds?.length ?? 0,
      generatedByStaffId: activeStaffSession?.staffId ?? null,
      generatedByStaffName: activeStaffSession?.staffName ?? null,
      generatedAt: safeIsoString(new Date())
    })

    setIsGenerating(true)
    setProgressMessage('checking entitlements')
    focusMainContent()

    try {
      await new Promise(resolve => setTimeout(resolve, 1200))
      setProgressMessage('checking wallet/overage')
      await new Promise(resolve => setTimeout(resolve, 400))
      const now = new Date()
      const expiry = new Date(now)
      expiry.setDate(now.getDate() + config.expiryPeriodDays)

      let seigenLogoDataUri = ''

      try {
        seigenLogoDataUri = await assetUrlToDataUri(
          '/brand/seigen-commerce-logo.png'
        )
      } catch (error) {
        console.warn('Failed to embed default seiGEN logo', error)
      }

      setOptimizationSummary(null)
      setProgressMessage('building catalogue')

      const planByVendorId = new Map<string, PricingPlan | undefined>()
      let maxPayloadMb = 8
      let maxWidth = 160
      let maxHeight = 160
      let quality = 0.82
      let outputFormat = 'image/webp'

      selectedVendors.forEach(vendor => {
        const sub = subscriptionService.getSubscriptionByVendor(vendor.id)
        const isActiveSub =
          sub &&
          [
            'active',
            'trial',
            'past_due',
            'grace_period',
            'due',
            'overdue'
          ].includes(sub.status)
        const resolvedPlanId = isActiveSub
          ? sub.planId
          : (vendor as any).subscription?.planId ||
            (vendor as any).activePlanId ||
            vendor.planId
        const plan = safePlans.find(p => p.id === resolvedPlanId)
        planByVendorId.set(vendor.id, plan)

        if (plan) {
          if (
            plan.maxCataloguePayloadMb &&
            plan.maxCataloguePayloadMb > maxPayloadMb
          )
            maxPayloadMb = plan.maxCataloguePayloadMb
          if (plan.imageMaxWidth && plan.imageMaxWidth > maxWidth)
            maxWidth = plan.imageMaxWidth
          if (plan.imageMaxHeight && plan.imageMaxHeight > maxHeight)
            maxHeight = plan.imageMaxHeight
          if (plan.imageQuality && plan.imageQuality > quality)
            quality = plan.imageQuality
          if (plan.imageFormat)
            outputFormat =
              plan.imageFormat === 'webp' ? 'image/webp' : 'image/jpeg'
        }
      })

      const maxCatalogueSizeBytes = maxPayloadMb * 1024 * 1024

      const optimizationResult = await optimizeCatalogueImages(
        allSelectedProducts,
        {
          targetBytes: MAX_CATALOGUE_IMAGE_SIZE_BYTES,
          warningBytes: MAX_CATALOGUE_IMAGE_SIZE_BYTES,
          maxBytes: MAX_CATALOGUE_IMAGE_SIZE_BYTES,
          maxWidth,
          maxHeight,
          minQuality: 0.35,
          maxQuality: quality,
          background: '#ffffff',
          outputType: outputFormat as any
        }
      )

      setOptimizationSummary(optimizationResult.summary)

      const oversizedOptimizedProducts = optimizationResult.products.filter(
        product => {
          const item = product as any
          return (
            item.imageUrl &&
            (Number(item.imageOptimizationBytes || 0) >
              MAX_CATALOGUE_IMAGE_SIZE_BYTES ||
              item.imageOptimizationStatus === 'blocked' ||
              item.imageOptimizationStatus === 'failed')
          )
        }
      )
      const optimizedProducts =
        imageHandlingPolicy === 'exclude_oversized'
          ? optimizationResult.products.map(product => {
              const item = product as any
              if (
                item.imageUrl &&
                (Number(item.imageOptimizationBytes || 0) >
                  MAX_CATALOGUE_IMAGE_SIZE_BYTES ||
                  item.imageOptimizationStatus === 'blocked' ||
                  item.imageOptimizationStatus === 'failed')
              ) {
                return {
                  ...product,
                  imageUrl: '',
                  catalogueImageExcludedReason: 'oversized_after_compression'
                }
              }
              return product
            })
          : imageHandlingPolicy === 'block_oversized'
          ? optimizationResult.products.filter(product => {
              const item = product as any
              const isOversized =
                item.imageUrl &&
                (Number(item.imageOptimizationBytes || 0) >
                  MAX_CATALOGUE_IMAGE_SIZE_BYTES ||
                  item.imageOptimizationStatus === 'blocked' ||
                  item.imageOptimizationStatus === 'failed')
              return !isOversized
            })
          : optimizationResult.products

      if (!optimizedProducts?.length) {
        const diagInfo = {
          selectedVendorsCount: config.vendorIds?.length || 0,
          selectedProductsCount: selectedProductIds?.length || 0,
          productsAfterVendorFilter: 'not available',
          productsAfterStockFilter: 'not available',
          productsAfterPublishFilter: 'not available',
          productsAfterEntitlementFilter: allSelectedProducts?.length || 0,
          productsAfterImagePolicy: optimizedProducts?.length || 0,
          oversizedBlockedCount: oversizedOptimizedProducts?.length || 0,
          rawProductsCount: safeProducts?.length || 0,
          afterVendorActiveStockCategoryFilter: rawSelectedProducts?.length || 0
        }

        console.warn('Catalogue export pipeline empty: diagnostics below')
        console.table(diagInfo)

        const errorMessage = `Catalogue generation could not continue because all products were filtered out.

Diagnostics:
- Selected vendors count: ${diagInfo.selectedVendorsCount}
- Selected products count: ${diagInfo.selectedProductsCount}
- Products after vendor filter: ${diagInfo.productsAfterVendorFilter}
- Products after stock filter: ${diagInfo.productsAfterStockFilter}
- Products after publish filter: ${diagInfo.productsAfterPublishFilter}
- Products after entitlement filter: ${diagInfo.productsAfterEntitlementFilter}
- Products after image policy: ${diagInfo.productsAfterImagePolicy}
- Oversized blocked count: ${diagInfo.oversizedBlockedCount}

Likely actions:
- Select products
- Select vendors
- Enable Include Out of Stock
- Check Publish to Catalogue
- Check plan limits
- Reduce oversized images`

        throw new Error(errorMessage)
      }

      const finalEstimatedSize =
        100000 +
        optimizedProducts.reduce(
          (sum, product) => sum + JSON.stringify(product).length,
          0
        ) +
        optimizedProducts.reduce(
          (sum, product) =>
            sum +
            (product.imageUrl
              ? Math.min(
                  Number((product as any).imageOptimizationBytes || 0) ||
                    MAX_CATALOGUE_IMAGE_SIZE_BYTES,
                  MAX_CATALOGUE_IMAGE_SIZE_BYTES
                )
              : 0),
          0
        )
      if (finalEstimatedSize > maxCatalogueSizeBytes) {
        throw new Error(
          `Catalogue exceeds ${maxPayloadMb}MB. Split catalogue by sector, category, suburb, or vendor group.`
        )
      }

      const imageDiagnostics = {
        originalSize: optimizationResult.summary.totalEstimatedPayloadBytes,
        optimizedSize: optimizedProducts.reduce(
          (sum, p) => sum + (Number((p as any).imageOptimizationBytes) || 0),
          0
        ),
        format: outputFormat,
        blockedCount,
        placeholderCount,
        imagePolicy: 'plan_resolved',
        productsBeforeImagePolicy: optimizationResult.products.length,
        oversizedImagesDetected: oversizedOptimizedProducts.length,
        imagesBlockedByPolicy: blockedCount + placeholderCount,
        productsAfterImagePolicy: optimizedProducts.length,
        estimatedPayloadMb: (finalEstimatedSize / 1024 / 1024).toFixed(2)
      }
      console.warn('Catalogue image diagnostics', imageDiagnostics)
      console.table(imageDiagnostics)

      console.log('Catalogue export source', {
        selectedVendors: selectedVendors.length,
        exportProducts: allSelectedProducts.length,
        rawProducts: safeProducts.length
      })

      const publicSlug = `${config.sector}-${config.category}-${finalId}`
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')

      const hostedUrl = ''

      const resolveFeedbackNumber = () => {
        const routes = (systemSettings?.feedbackWhatsAppRoutes || [])
          .filter(r => r.isActive)
          .sort((a, b) => b.priority - a.priority)
        let match = routes.find(
          r => r.sector === config.sector && r.category === config.category
        )
        if (match) return match.whatsappNumber
        match = routes.find(r => r.sector === config.sector)
        if (match) return match.whatsappNumber
        match = routes.find(r => r.purpose === 'DEFAULT')
        if (match) return match.whatsappNumber
        return systemSettings?.defaultFeedbackWhatsAppNumber || ''
      }

      const html = generateCatalogueHtml(
        selectedVendors,
        optimizedProducts,
        finalCahLinks,
        plans,
        {
          serialNumber: config.serialNumber,
          catalogueId: finalId,
          sector: config.sector,
          category: config.category,
          expiryDate: safeIsoString(expiry),
          seigenLogoDataUri,
          seigenLogoUrl:
            systemSettings?.seigenLogoUrl ||
            contactSettings?.seigenLogoUrl ||
            '',
          companyLogoUrl: contactSettings?.companyLogoUrl,
          systemLogoUrl: contactSettings?.systemLogoUrl,
          hostedUrl,
          feedbackWhatsAppNumber: resolveFeedbackNumber(),
          supportTitle: systemSettings?.catalogueSupportTitle,
          supportMessage: systemSettings?.catalogueSupportMessage,
          supportWhatsAppNumber:
            systemSettings?.catalogueSupportWhatsAppNumber ||
            resolveFeedbackNumber(),
          syncEndpointUrl: systemSettings?.syncEndpointUrl || ''
        }
      )

      const displaySector = config.sector ? config.sector.trim() : 'All Sectors'
      const displayCategory = config.category
        ? config.category.trim()
        : 'All Categories'
      const yyyyMmDd = safeIsoString(new Date()).split('T')[0]
      let safeFileName = `SCI_${displaySector}_${displayCategory}_${yyyyMmDd}`
      safeFileName = safeFileName
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .replace(/_+/g, '_')
      const finalFileName = `${safeFileName}.html`

      // Lightweight analytics snapshot
      catalogueAnalyticsSnapshot = sanitizeForFirestore({
        ...catalogueAnalyticsSnapshot,
        vendorCount: selectedVendors.length,
        productCount: optimizedProducts.length,
        imageCount: optimizedProducts.reduce(
          (count, product: any) =>
            count + normalizeListingImages(product, 6).length,
          0
        ),
        estimatedSize: finalEstimatedSize,
        overridesUsed: entitlementSummaries.filter(s => s.overrideUsed).length,
        creditUsed: entitlementSummaries.reduce(
          (sum, s) => sum + s.creditUsed,
          0
        ),
        productsExcluded: entitlementExcludedProducts.length,
        generatedAt: safeIsoString(new Date())
      })

      // Lightweight config snapshot
      const configSnapshot = {
        vendorIds: config.vendorIds,
        cahLinkIds: finalCahLinkIds,
        sector: config.sector,
        category: config.category,
        province: config.province || null,
        cityTown: config.cityTown || null,
        notes: config.notes || null,
        expiryPeriodDays: config.expiryPeriodDays,
        onlyActive: config.onlyActive,
        onlyPublished: config.onlyPublished,
        includeOutOfStock: config.includeOutOfStock,
        maxProducts: config.maxProducts,
        maxImages: config.maxImages,
        entitlementSummary: entitlementSummaries.map(s => ({
          vendorId: s.vendorId,
          vendorName: s.vendorName,
          planName: s.planName,
          includedProducts: s.includedProducts,
          excludedProducts: s.excludedProducts,
          overageDue: s.overageDue,
          creditUsed: s.creditUsed,
          overrideUsed: s.overrideUsed
        }))
      }

      const catalogueData: CatalogueGeneration = {
        id: finalId,
        serialNumber: config.serialNumber,
        sector: config.sector,
        category: config.category,
        province: config.province || null,
        cityTown: config.cityTown || null,
        vendorIds: config.vendorIds,
        cahLinkIds: finalCahLinkIds,
        generatedBy: 'System Admin',
        generatedAt: safeIsoString(new Date()),
        expiryPeriodDays: config.expiryPeriodDays,
        status: 'generated',
        notes: config.notes || null,
        productCount: optimizedProducts.length,
        htmlSize: finalEstimatedSize,
        fileName: finalFileName,
        hostedUrl,
        publicSlug,
        configSnapshot: configSnapshot,
        catalogueAnalyticsSnapshot
      }

      // Part C: Ensure htmlContent is not persisted.
      // The current implementation already omits it from catalogueData.
      // This is a defensive measure.
      delete (catalogueData as any).htmlContent

      // Batch usage and ledger recording
      const usageEntries: any[] = []
      const ledgerEntries: any[] = []
      setProgressMessage('saving ledger')

      for (const vendor of selectedVendors) {
        const controlRow = vendorCreditRows.find(
          row => row.vendorId === vendor.id
        )
        const summary = entitlementSummaryByVendor.get(vendor.id)
        usageEntries.push(
          sanitizeForFirestore({
            vendorId: vendor.id,
            planId: controlRow?.planId || vendor.planId || null,
            subscriptionId:
              subscriptionService.getSubscriptionByVendor(vendor.id)?.id ||
              null,
            catalogueId: finalId,
            serialNumber: config.serialNumber || null,
            generatedAt: catalogueAnalyticsSnapshot.generatedAt,
            productCount: controlRow?.productsSelected || 0,
            imageCount: controlRow?.imagesSelected || 0,
            generatedByStaffId: activeStaffSession?.staffId || null,
            usageType: 'catalogue_generated',
            quantity: 1,
            sourceId: finalId,
            description: `Catalogue generated for ${config.sector}/${config.category}`
          })
        )
        if (controlRow) {
          ledgerEntries.push({
            catalogueId: finalId,
            vendorId: vendor.id,
            vendorName: vendor.name || vendor.tradingName || 'Vendor',
            productCount: controlRow.productsSelected,
            imageCount: controlRow.imagesSelected,
            creditUsed: summary?.creditUsed || 0,
            overageDue: summary?.overageDue || 0,
            deploymentCount: 1,
            catalogueSizeBytes: finalEstimatedSize,
            oversizedImagesExcluded: oversizedOptimizedProducts.filter(
              product =>
                product.vendorId === vendor.id &&
                planByVendorId.get(vendor.id)?.imagePolicy !==
                  'compress_include'
            ).length,
            overrideUsed: !!summary?.overrideUsed,
            overrideReason: summary?.overrideUsed
              ? overrideReason.trim() || null
              : null,
            overageReason:
              summary && summary.creditUsed > 0
                ? 'Product quota exceeded'
                : null,
            generatedBy: catalogueAnalyticsSnapshot.generatedByStaffId || null,
            createdByStaffId:
              catalogueAnalyticsSnapshot.generatedByStaffId || null,
            createdByStaffName:
              catalogueAnalyticsSnapshot.generatedByStaffName || null
          })
        }
      }

      // Prepare entitlement settlement data
      const summariesWithCredit = entitlementSummaries.filter(
        s => s.creditUsed > 0
      )
      const summariesWithOverride = entitlementSummaries.filter(
        s => s.overrideUsed
      )
      const vendorUpdates: Partial<Vendor>[] = []
      const auditLogs: any[] = []
      const notifications: any[] = []

      summariesWithCredit.forEach(summary => {
        const vendor = safeVendors.find(v => v.id === summary.vendorId)
        if (!vendor) return

        const creditField = getVendorCreditField(vendor)
        const beforeCredit = getVendorCreditBalance(vendor)
        vendorUpdates.push({
          id: vendor.id,
          [creditField]: Math.max(0, beforeCredit - summary.creditUsed),
          updatedAt: safeIsoString(new Date())
        })

        auditLogs.push(
          sanitizeForFirestore({
            eventType: 'SUBSCRIPTION_CHANGED',
            module: 'catalogue',
            action: `Catalogue overage credit deducted for ${summary.vendorName}`,
            severity: 'warning',
            recordType: 'catalogue_overage_charge',
            recordId: finalId,
            recordName: summary.vendorName,
            beforeSnapshot: { vendorId: vendor.id, credit: beforeCredit },
            afterSnapshot: {
              vendorId: vendor.id,
              credit: beforeCredit - summary.creditUsed,
              overageQuantity: summary.overageQuantity,
              overageDue: summary.overageDue
            },
            reason: null,
            notes: null,
            generatedBy: null,
            overrideReason: null
          })
        )
      })

      summariesWithOverride.forEach(summary => {
        auditLogs.push(
          sanitizeForFirestore({
            eventType: 'SYSTEM_SETTING_CHANGED',
            module: 'catalogue',
            action: `Catalogue plan limit override for ${
              summary.vendorName
            }: ${overrideReason.trim()}`,
            severity: 'high',
            recordType: 'catalogue_plan_limit_override',
            recordId: finalId,
            recordName: summary.vendorName,
            beforeSnapshot: null,
            afterSnapshot: {
              vendorId: summary.vendorId,
              reason: overrideReason.trim(),
              overageQuantity: summary.overageQuantity,
              selectedProducts: summary.selectedProducts
            },
            reason: overrideReason.trim() || null,
            notes: null,
            generatedBy: null,
            overrideReason: overrideReason.trim() || null
          })
        )
        notifications.push(
          {
            title: 'Catalogue Plan Limit Override',
            message: `${summary.vendorName} was exported with ${
              summary.overageQuantity
            } over-limit products. Reason: ${overrideReason.trim()}`,
            type: 'system_alert',
            priority: 'high',
            targetRole: 'Finance',
            recordType: 'catalogue',
            recordId: finalId,
            dedupeKey: `catalogue_override:${finalId}:${summary.vendorId}`
          },
          {
            title: 'Catalogue Plan Limit Override',
            message: `${summary.vendorName} was exported with ${summary.overageQuantity} over-limit products. Finance review required.`,
            type: 'system_alert',
            priority: 'high',
            targetRole: 'Admin',
            recordType: 'catalogue',
            recordId: finalId,
            dedupeKey: `catalogue_override_admin:${finalId}:${summary.vendorId}`
          }
        )
      })

      // Single batched deployment write
      await catalogueDeploymentService.deployCatalogue(
        sanitizeForFirestore({
          catalogueData,
          vendorUpdates,
          ledgerEntries,
          auditLogs,
          notifications,
          replace: mode === 'replace' ? editingCatalogueId || null : null
        })
      )

      try {
        void vendorPlanUsageService.recordUsageBatch(usageEntries)
        if (
          typeof (catalogueUsageLedgerService as any)?.recordUsageBatch ===
          'function'
        ) {
          void (catalogueUsageLedgerService as any).recordUsageBatch(
            usageEntries
          )
        }
      } catch (usageError) {
        console.warn('Failed to record catalogue usage', usageError)
      }

      // Non-blocking analytics and audit for the main generation event
      try {
        void staffAuditService.logAction(
          sanitizeForFirestore({
            eventType: 'CATALOGUE_GENERATED',
            module: 'catalogue',
            action: `Generated catalogue ${finalId}`,
            severity: 'info',
            recordType: 'catalogue',
            recordId: finalId,
            recordName: config.serialNumber,
            beforeSnapshot: null,
            afterSnapshot: null,
            reason: null,
            notes: null,
            generatedBy: null,
            overrideReason: null
          })
        )

        safeLogEvent({
          eventType: 'CATALOGUE_ANALYTICS_SNAPSHOT',
          actorType: 'admin',
          actorId: catalogueAnalyticsSnapshot.generatedByStaffId,
          actorName:
            catalogueAnalyticsSnapshot.generatedByStaffName || 'System Admin',
          details: catalogueAnalyticsSnapshot
        })

        if (summariesWithOverride.length > 0) {
          safeLogEvent({
            eventType: 'CATALOGUE_PLAN_LIMIT_OVERRIDE',
            actorType: 'admin',
            actorName: 'System Admin',
            details: {
              catalogueId: finalId,
              overrideReason: overrideReason.trim(),
              overriddenVendors: summariesWithOverride.map(s => ({
                vendorId: s.vendorId,
                vendorName: s.vendorName,
                overageQuantity: s.overageQuantity
              }))
            }
          })
        }
      } catch (auditErr) {
        console.error('Audit log failed', auditErr)
      }

      setLastGenerated({
        html,
        id: finalId,
        fileName: finalFileName,
        hostedUrl
      })
      if (mode === 'update' || mode === 'replace') {
        setEditingCatalogueId(null)
      }

      // Post-deployment cleanup (can be slow, so not part of main deployment)
      await safeCleanupOldCatalogueArchives(
        systemSettings?.catalogueArchiveRetentionDays || 21
      )

      const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1)
      await refreshHistory()

      const hasBlockedOversized = blockedCount > 0
      const successMsg = `Catalogue generated in ${elapsedSeconds}s. Deployment metadata saved.`
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: hasBlockedOversized
          ? `${successMsg} Some products/images were excluded because oversized images are blocked by the current image policy.`
          : successMsg,
        type: hasBlockedOversized ? 'warning' : 'success'
      })
    } catch (err) {
      console.error(err)
      if (firebaseHealthService.isMissingFirestoreIndexError?.(err)) {
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message:
            'Catalogue history index is still preparing. Catalogue generation can continue, but historical reporting may be delayed.',
          type: 'info'
        })
      } else {
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: err instanceof Error ? err.message : 'Save failed',
          type: 'error'
        })
      }
    } finally {
      setIsGenerating(false)
      setProgressMessage('completed')
      setTimeout(() => setProgressMessage(''), 2000)
      const elapsedMs = Math.round(performance.now() - startedAt)
      safeLogEvent({
        eventType: 'CATALOGUE_DEPLOYMENT_COMPLETED',
        actorType: 'admin',
        actorName: 'System Admin',
        details: { ...catalogueAnalyticsSnapshot, elapsedMs }
      })
      console.log(
        `CATALOGUE_DEPLOYMENT_COMPLETED in ${elapsedMs}ms`,
        catalogueAnalyticsSnapshot
      )
    }
  }

  const handleMarkDeployed = async (id: string) => {
    const sessionStr = localStorage.getItem('activeStaffSession')
    const session = sessionStr
      ? JSON.parse(sessionStr)
      : { staffId: 'STAFF-ADM', staffName: 'System Admin' }
    const canApprove = permissionService.canApprove('createCatalogue')

    if (canApprove) {
      try {
        await catalogueService.markAsDeployed(id)
        refreshHistory()
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: 'Saved successfully.',
          type: 'success'
        })

        // Non-blocking staff audit logging
        try {
          void staffAuditService.logAction({
            eventType: 'CATALOGUE_DEPLOYED',
            module: 'catalogue',
            action: `Deployed catalogue ${id}`,
            severity: 'high',
            recordType: 'catalogue',
            recordId: id
          })
        } catch (auditErr) {
          console.error('Audit log failed', auditErr)
        }
      } catch (err) {
        console.error(err)
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: err instanceof Error ? err.message : 'Save failed',
          type: 'error'
        })
      }
    } else {
      try {
        await approvalService.submitApprovalRequest({
          requestType: 'catalogue_deploy',
          recordType: 'catalogue',
          recordId: id,
          recordName: `Catalogue ${id}`,
          submittedByStaffId: session.staffId,
          submittedByName: session.staffName,
          riskLevel: 'high',
          beforeSnapshot: null,
          afterSnapshot: null
        })
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: 'Saved successfully.',
          type: 'success'
        })
      } catch (err) {
        console.error('Failed to submit approval request.')
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: err instanceof Error ? err.message : 'Save failed',
          type: 'error'
        })
      }
    }
  }

  const handleRedeploy = async (id: string) => {
    try {
      await catalogueService.redeployCatalogue(id)
      refreshHistory()
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Saved successfully.',
        type: 'success'
      })
    } catch (err) {
      console.error(err)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: err instanceof Error ? err.message : 'Save failed',
        type: 'error'
      })
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await catalogueService.archiveCatalogue(id)
      refreshHistory()
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Saved successfully.',
        type: 'success'
      })
    } catch (err) {
      console.error(err)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: err instanceof Error ? err.message : 'Save failed',
        type: 'error'
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await catalogueService.deleteCatalogue(id)
      refreshHistory()
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Saved successfully.',
        type: 'success'
      })
    } catch (err) {
      console.error(err)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: err instanceof Error ? err.message : 'Save failed',
        type: 'error'
      })
    }
  }

  const handleCleanupOldArchives = async () => {
    try {
      const cleanup = await catalogueService.cleanupOldCatalogueArchives(
        systemSettings?.catalogueArchiveRetentionDays || 21
      )
      if (cleanup.history.length > 0) {
        setHistory(cleanup.history)
      }
      showBrandedAlert({
        title: 'Catalogue Archive Cleanup',
        message:
          cleanup.deletedCount > 0
            ? `Old catalogue archives older than ${cleanup.retentionDays} days were cleaned.`
            : `No catalogue archives older than ${cleanup.retentionDays} days were found.`,
        type: 'info'
      })
    } catch (error: any) {
      if (firebaseHealthService.isMissingFirestoreIndexError?.(error)) {
        console.warn(
          'Missing catalogueGenerations index. Skipping non-critical cleanup query.',
          error
        )
        showBrandedAlert({
          title: 'Catalogue Archive Cleanup',
          message: 'Firestore index is building; retry later',
          type: 'info'
        })
        return
      }
      console.error(error)
      showBrandedAlert({
        title: 'Catalogue Archive Cleanup',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to clean old catalogue archives.',
        type: 'error'
      })
    }
  }

  const handleEditConfig = (cat: CatalogueGeneration) => {
    const sector = cat.configSnapshot?.sector || cat.sector || ''
    if (cat.configSnapshot) {
      setConfig({ ...config, ...cat.configSnapshot })
      setSelectedCahLinkIds(cat.configSnapshot.cahLinkIds || [])
    } else {
      setConfig({
        ...config,
        sector: cat.sector || '',
        category: cat.category || '',
        vendorIds: cat.vendorIds || [],
        notes: cat.notes || '',
        expiryPeriodDays: cat.expiryPeriodDays || 7
      })
      setSelectedCahLinkIds(cat.cahLinkIds || [])
    }
    if (sector) {
      void loadSectorData(sector, {
        preserveSelections: true,
        updateConfig: false
      })
    }
    setEditingCatalogueId(cat.id)
    focusMainContent()
  }

  const handleViewPreview = (cat: CatalogueGeneration) => {
    if (cat.htmlContent) {
      setLastGenerated({
        html: cat.htmlContent,
        id: cat.id,
        fileName: cat.fileName || `${cat.serialNumber}.html`,
        hostedUrl: cat.hostedUrl
      })
      focusMainContent()
    } else {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message:
          'HTML content not available for this older record. Please regenerate.',
        type: 'warning'
      })
    }
  }

  const handleCopyHtml = async (html: string) => {
    await navigator.clipboard.writeText(html)
    showBrandedAlert({
      title: 'seiGEN Commerce',
      message: 'Catalogue HTML copied to clipboard.',
      type: 'success'
    })
  }

  const toggleVendorSelection = (vendorId: string) => {
    setConfig(prev => ({
      ...prev,
      vendorIds: prev.vendorIds.includes(vendorId)
        ? prev.vendorIds.filter(id => id !== vendorId)
        : [...prev.vendorIds, vendorId]
    }))
  }

  const toggleCAHLinkSelection = (linkId: string) => {
    setSelectedCahLinkIds(prev =>
      prev.includes(linkId)
        ? prev.filter(id => id !== linkId)
        : [...prev, linkId]
    )
  }

  const downloadFile = (html: string, filename: string) => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    safeLogEvent({
      eventType: 'CATALOGUE_DOWNLOADED',
      actorType: 'admin',
      actorName: 'System Admin',
      details: { filename }
    })

    // Non-blocking staff audit logging
    try {
      void staffAuditService.logAction({
        eventType: 'EXPORT_DOWNLOADED',
        module: 'catalogue',
        action: `Downloaded catalogue HTML: ${filename}`,
        severity: 'info',
        recordType: 'file',
        recordName: filename
      })
    } catch (auditErr) {
      console.error('Audit log failed', auditErr)
    }
  }

  const downloadVendorCreditCsv = () => {
    const headers = [
      'Vendor Name',
      'Plan',
      'Sector',
      'City',
      'Suburb',
      'Credit Balance',
      'Products Allowed',
      'Products Selected',
      'Products Over Limit',
      'Overage Due',
      'Credit Used',
      'Remaining Credit',
      'Images Allowed',
      'Images Selected',
      'Images Due',
      'Deployments Allowed',
      'Deployments Used',
      'Deployments Due',
      'Last Deployment Date',
      'Next Deployment Date',
      'Status',
      'Recommended Action'
    ]
    const rows = vendorCreditRows.map(row => [
      row.vendorName,
      row.planName,
      row.sector,
      row.city,
      row.suburb,
      row.creditBalance.toFixed(2),
      row.productsAllowed,
      row.productsSelected,
      row.productsOverLimit,
      row.overageDue.toFixed(2),
      row.creditUsed.toFixed(2),
      row.remainingCredit.toFixed(2),
      row.imagesAllowed,
      row.imagesSelected,
      row.imagesDue,
      row.deploymentsAllowedThisMonth,
      row.deploymentsUsedThisMonth,
      row.deploymentsDue,
      row.lastDeploymentDate || '',
      row.nextDeploymentDate || '',
      row.status,
      row.recommendedAction
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vendor-credit-deployment-control-${safeIsoString(
      new Date()
    ).slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const canDownloadVendorBill = () =>
    permissionService.hasActionPermission('catalogue.download' as any) ||
    permissionService.canExport('createCatalogue') ||
    permissionService.canView('pricing')

  const buildVendorPlanUsageBill = (
    row: VendorCatalogueCreditRow
  ): VendorPlanUsageBill | null => {
    const vendor = safeVendors.find(item => item.id === row.vendorId)
    const plan = safePlans.find(item => item.id === row.planId)
    if (!vendor || !plan) return null
    const now = new Date()
    const periodFrom = safeIsoString(
      new Date(now.getFullYear(), now.getMonth(), 1)
    ).slice(0, 10)
    const periodTo = safeIsoString(
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
    ).slice(0, 10)

    return {
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      vendorCode: vendor.systemCode || vendor.vendorCode || vendor.id,
      sector: row.sector,
      city: row.city,
      suburb: row.suburb,
      planId: row.planId,
      planName: row.planName,
      planMonthlyPrice: Number(plan.monthlyPrice || 0),
      currency: plan.currency || 'USD',
      subscriptionStatus: row.subscriptionStatus,
      periodFrom,
      periodTo,
      productsAllowed: row.productsAllowed,
      productsUsed: row.productsSelected,
      productsOverLimit: row.productsOverLimit,
      imagesAllowed: row.imagesAllowed,
      imagesUsed: row.imagesSelected,
      imagesDue: row.imagesDue,
      deploymentsAllowed: row.deploymentsAllowedThisMonth,
      deploymentsUsed: row.deploymentsUsedThisMonth,
      deploymentsDue: row.deploymentsDue,
      lastDeploymentDate: row.lastDeploymentDate,
      nextDeploymentDate: row.nextDeploymentDate || 'Ready now',
      creditBalance: row.creditBalance,
      creditUsed: row.creditUsed,
      remainingCredit: row.remainingCredit,
      overageDue: row.overageDue,
      billDue: row.billDue,
      recommendedAction: row.recommendedAction,
      generatedAt: safeIsoString(new Date())
    }
  }

  const handleDownloadVendorBill = (row: VendorCatalogueCreditRow) => {
    if (!canDownloadVendorBill()) {
      showBrandedAlert({
        title: 'Permission Required',
        message:
          'You do not have permission to download vendor plan usage bills.',
        type: 'warning'
      })
      return
    }
    const bill = buildVendorPlanUsageBill(row)
    if (!bill) {
      showBrandedAlert({
        title: 'Bill Not Available',
        message: 'Vendor or pricing plan data could not be resolved.',
        type: 'warning'
      })
      return
    }
    const result = generateVendorPlanUsageBillPdf(bill)
    safeLogEvent({
      eventType: 'VENDOR_PLAN_USAGE_BILL_DOWNLOADED',
      actorType: 'admin',
      actorName: 'System Admin',
      vendorId: bill.vendorId,
      vendorName: bill.vendorName,
      details: {
        billDue: bill.billDue,
        periodFrom: bill.periodFrom,
        periodTo: bill.periodTo,
        fileName: result.fileName
      }
    })
    try {
      void staffAuditService.logAction({
        eventType: 'EXPORT_DOWNLOADED',
        module: 'catalogue',
        action: `Downloaded vendor plan usage bill for ${bill.vendorName}`,
        severity: 'info',
        recordType: 'vendor_plan_usage_bill',
        recordId: bill.vendorId,
        recordName: bill.vendorName,
        afterSnapshot: {
          billDue: bill.billDue,
          periodFrom: bill.periodFrom,
          periodTo: bill.periodTo
        }
      })
    } catch (auditErr) {
      console.error('Audit log failed', auditErr)
    }
  }

  return (
    <div className='pb-20' id='create-catalogue-header' tabIndex={-1}>
      <PageHeader
        title='Create Catalogue'
        subtitle='Group multiple vendors into a single digital product catalogue.'
        actions={
          permissionService.canCreate('createCatalogue') &&
          (editingCatalogueId ? (
            <div className='flex gap-2'>
              <SecondaryButton onClick={() => setEditingCatalogueId(null)}>
                Cancel Edit
              </SecondaryButton>
              <PrimaryButton
                onClick={() => handleGenerate('update')}
                disabled={isGenerating || config.vendorIds.length === 0}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin inline' />{' '}
                    {progressMessage || 'Updating...'}
                  </>
                ) : (
                  'Update Existing'
                )}
              </PrimaryButton>
              <PrimaryButton
                onClick={() => handleGenerate('replace')}
                disabled={isGenerating || config.vendorIds.length === 0}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin inline' />{' '}
                    {progressMessage || 'Replacing...'}
                  </>
                ) : (
                  'Save as Replacement'
                )}
              </PrimaryButton>
            </div>
          ) : (
            <PrimaryButton
              onClick={() => handleGenerate('new')}
              disabled={isGenerating || config.vendorIds.length === 0}
              className={isGenerating ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isGenerating ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin inline' />{' '}
                  {progressMessage || 'Creating...'}
                </>
              ) : (
                <>
                  <Play className='w-4 h-4 mr-2 inline' /> Create Multi-Vendor
                  Catalogue
                </>
              )}
            </PrimaryButton>
          ))
        }
      />

      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <div className='mb-4 flex justify-end px-1'>
        <SecondaryButton
          disabled={allSelectedProducts.length === 0}
          onClick={handleExportCatalogueProducts}
        >
          <Download className='w-4 h-4 mr-2 inline' /> Export Products to Excel
        </SecondaryButton>
      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title='seiGEN Commerce'
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        cancelLabel='Cancel'
        variant={confirmConfig.variant}
        onConfirm={() => {
          const action = confirmConfig.onConfirm
          setConfirmConfig(prev => ({ ...prev, isOpen: false }))
          action()
        }}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <section className='mb-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3'>
        {[
          ['Selected Vendors', catalogueAnalyticsSummary.selectedVendors],
          ['Selected Products', catalogueAnalyticsSummary.selectedProducts],
          ['Active Products', catalogueAnalyticsSummary.activeProducts],
          [
            'Published to Catalogue',
            catalogueAnalyticsSummary.publishedProducts
          ],
          ['Products Excluded', catalogueAnalyticsSummary.productsExcluded],
          [
            'Plan Limits Reached',
            catalogueAnalyticsSummary.vendorsWithPlanLimitsReached
          ],
          [
            'Vendor Images Used',
            catalogueAnalyticsSummary.totalVendorImagesUsed
          ],
          [
            'Remaining Image Allowance',
            catalogueAnalyticsSummary.totalRemainingVendorImageAllowance
          ],
          [
            'Remaining Catalogue Allowance',
            catalogueAnalyticsSummary.totalRemainingCatalogueAllowance
          ],
          [
            'No Catalogue Credits',
            catalogueAnalyticsSummary.vendorsWithNoRemainingCatalogueCredits
          ],
          [
            'No Image Credits',
            catalogueAnalyticsSummary.vendorsWithNoRemainingImageCredits
          ]
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className='border border-stone-200 bg-white p-3'
          >
            <p className='text-[8px] font-black uppercase tracking-widest text-stone-400'>
              {label}
            </p>
            <p className='mt-2 text-2xl font-black font-mono text-brand-charcoal'>
              {value}
            </p>
          </div>
        ))}
      </section>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-10'>
        <div className='lg:col-span-2 space-y-8'>
          {/* Main Config */}
          <section className='card bg-white'>
            {editingCatalogueId && (
              <div className='mb-6 p-4 bg-orange-50 border-l-4 border-brand-orange flex items-center justify-between'>
                <div>
                  <h4 className='text-sm font-bold text-brand-orange uppercase'>
                    Editing Mode Active
                  </h4>
                  <p className='text-xs text-stone-600 font-medium mt-1'>
                    Editing catalogue {editingCatalogueId}. Regenerate to apply
                    changes.
                  </p>
                </div>
                <SecondaryButton onClick={() => setEditingCatalogueId(null)}>
                  Cancel Edit
                </SecondaryButton>
              </div>
            )}

            <div className='flex items-center gap-4 mb-6'>
              <div className='w-10 h-10 bg-brand-orange text-white flex items-center justify-center font-bold italic'>
                GEN
              </div>
              <h3 className='text-sm uppercase font-bold tracking-[0.2em]'>
                Build Configuration
              </h3>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <label className='block'>
                <span className='text-[10px] font-extrabold uppercase text-stone-400'>
                  Catalogue Serial Number
                </span>
                <input
                  type='text'
                  disabled
                  className='w-full mt-1 border-2 border-stone-50 bg-stone-50 p-3 text-xs font-mono font-bold text-brand-orange'
                  value={config.serialNumber}
                />
              </label>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <SearchableComboBox
                    label='Sector *'
                    value={config.sector}
                    options={sectorOptions}
                    getOptionLabel={sector => sector.label}
                    getOptionValue={sector => sector.label}
                    getOptionSearchText={sector =>
                      [
                        sector.label,
                        sector.normalized,
                        ...(sector.aliases || []),
                        ...(sector.categories || [])
                      ].join(' ')
                    }
                    placeholder='Search or select sector...'
                    allowAddNew
                    emptyMessage={
                      isSectorLoading
                        ? 'Refreshing sector list...'
                        : 'No matching sectors found.'
                    }
                    onAddNew={sector =>
                      void taxonomyService.addSector(sector).then(() =>
                        sectorIndexService
                          .refreshSectorsFromSource()
                          .then(sectors => {
                            setSectorOptions(sectors)
                            setSectorSource('firebase')
                            void loadSectorData(sector)
                          })
                      )
                    }
                    onSelect={sector =>
                      void loadSectorData(sector?.label || '')
                    }
                  />
                  <p className='mt-1 text-[9px] font-bold uppercase text-stone-400'>
                    {isSectorLoading
                      ? 'Refreshing sector list...'
                      : sectorSource === 'firebase'
                      ? 'Sector list refreshed'
                      : 'Using cached sector list'}
                    {isSectorDataLoading
                      ? ` / ${progressMessage || 'Loading sector data...'}`
                      : ''}
                  </p>
                </div>
                <label className='block'>
                  <span className='text-[10px] font-extrabold uppercase text-stone-400'>
                    Product Category Filter *
                  </span>
                  <input
                    type='text'
                    className='w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange'
                    placeholder='e.g. Brake Pads'
                    value={config.category}
                    onChange={e =>
                      setConfig({ ...config, category: e.target.value })
                    }
                  />
                  <p className='mt-1 text-[9px] font-bold uppercase text-stone-400'>
                    Category filters products included in the catalogue. It does
                    not hide vendors.
                  </p>
                </label>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <label className='block'>
                  <span className='text-[10px] font-extrabold uppercase text-stone-400'>
                    Province
                  </span>
                  <input
                    type='text'
                    className='w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange'
                    value={config.province}
                    onChange={e =>
                      setConfig({ ...config, province: e.target.value })
                    }
                  />
                </label>
                <label className='block'>
                  <span className='text-[10px] font-extrabold uppercase text-stone-400'>
                    City/Town
                  </span>
                  <input
                    type='text'
                    className='w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange'
                    value={config.cityTown}
                    onChange={e =>
                      setConfig({ ...config, cityTown: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>

            <div className='mt-8 pt-8 border-t border-stone-50 grid grid-cols-1 md:grid-cols-2 gap-6'>
              <label className='block'>
                <span className='text-[10px] font-extrabold uppercase text-stone-400'>
                  Build Notes & Internal Memo
                </span>
                <textarea
                  className='w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange h-20'
                  placeholder='Deployment context, source RPN etc.'
                  value={config.notes}
                  onChange={e =>
                    setConfig({ ...config, notes: e.target.value })
                  }
                />
              </label>
              <div className='space-y-4'>
                <div className='flex flex-col gap-1'>
                  <span className='text-[9px] font-bold text-stone-400 uppercase'>
                    Expiry Period
                  </span>
                  <select
                    className='bg-stone-50 p-3 text-xs font-bold outline-none'
                    value={config.expiryPeriodDays}
                    onChange={e =>
                      setConfig({
                        ...config,
                        expiryPeriodDays: parseInt(e.target.value)
                      })
                    }
                  >
                    <option value={7}>7 Days (Standard)</option>
                    <option value={14}>14 Days (Extended)</option>
                    <option value={30}>30 Days (Monthly)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className='mt-8 pt-8 border-t border-stone-50 grid grid-cols-2 lg:grid-cols-4 gap-4'>
              <ToggleItem
                label='Active Only'
                active={config.onlyActive}
                onClick={() =>
                  setConfig({ ...config, onlyActive: !config.onlyActive })
                }
              />
              <ToggleItem
                label='Published Only'
                active={config.onlyPublished}
                onClick={() =>
                  setConfig({ ...config, onlyPublished: !config.onlyPublished })
                }
              />
              <ToggleItem
                label='Incl. Stockouts'
                active={config.includeOutOfStock}
                onClick={() =>
                  setConfig({
                    ...config,
                    includeOutOfStock: !config.includeOutOfStock
                  })
                }
              />
              <div className='flex flex-col gap-1'>
                <span className='text-[9px] font-bold text-stone-400 uppercase'>
                  Product Limit
                </span>
                <select
                  className='bg-stone-50 p-2 text-[10px] font-bold outline-none'
                  value={config.maxProducts}
                  onChange={e =>
                    setConfig({
                      ...config,
                      maxProducts: parseInt(e.target.value)
                    })
                  }
                >
                  <option value={100}>100 Items</option>
                  <option value={400}>400 Items</option>
                  <option value={800}>800 Items</option>
                </select>
              </div>
            </div>
          </section>

          <DataPanel
            title='Vendor Credit & Deployment Control'
            subtitle='Spreadsheet view for credit exposure, product overages, image limits, deployment due dates and hard catalogue controls.'
            actions={
              <SecondaryButton size='sm' onClick={downloadVendorCreditCsv}>
                Download CSV
              </SecondaryButton>
            }
          >
            <div className='p-4 space-y-4 bg-white'>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-3'>
                <select
                  value={vendorCreditSort}
                  onChange={event =>
                    setVendorCreditSort(
                      event.target.value as VendorCreditSortMode
                    )
                  }
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                >
                  <option value='most_credit'>Most Available Credit</option>
                  <option value='least_credit'>Least Available Credit</option>
                </select>
                <select
                  value={imageHandlingPolicy}
                  onChange={event =>
                    setImageHandlingPolicy(
                      event.target.value as ImageHandlingPolicy
                    )
                  }
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                >
                  <option value='auto_compress'>
                    Auto-compress and include
                  </option>
                  <option value='exclude_oversized'>
                    Exclude oversized images
                  </option>
                  <option value='block_oversized'>
                    Block if oversized remain
                  </option>
                </select>
                <select
                  value={vendorCreditFilters.plan}
                  onChange={event =>
                    setVendorCreditFilters(prev => ({
                      ...prev,
                      plan: event.target.value
                    }))
                  }
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                >
                  <option value=''>All Plans</option>
                  {Array.from(new Set(safePlans.map(plan => plan.name))).map(
                    planName => (
                      <option key={planName} value={planName}>
                        {planName}
                      </option>
                    )
                  )}
                </select>
                <select
                  value={vendorCreditFilters.sector}
                  onChange={event =>
                    setVendorCreditFilters(prev => ({
                      ...prev,
                      sector: event.target.value
                    }))
                  }
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                >
                  <option value=''>All Sectors</option>
                  {biSectors.map(sector => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
                <input
                  value={vendorCreditFilters.city}
                  onChange={event =>
                    setVendorCreditFilters(prev => ({
                      ...prev,
                      city: event.target.value
                    }))
                  }
                  placeholder='City'
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                />
                <input
                  value={vendorCreditFilters.suburb}
                  onChange={event =>
                    setVendorCreditFilters(prev => ({
                      ...prev,
                      suburb: event.target.value
                    }))
                  }
                  placeholder='Suburb'
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                />
                <div className='md:col-span-2 flex flex-wrap gap-2'>
                  {[
                    ['overLimitOnly', 'Over Limit Only'],
                    ['noCreditOnly', 'No Credit Only'],
                    ['selectedVendorsOnly', 'Selected Vendors Only'],
                    ['selectedProductsOnly', 'Selected Products Only']
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className='flex items-center gap-2 border border-stone-200 bg-stone-50 px-3 py-2 text-[9px] font-black uppercase text-stone-600'
                    >
                      <input
                        type='checkbox'
                        checked={Boolean(
                          vendorCreditFilters[
                            key as keyof typeof vendorCreditFilters
                          ]
                        )}
                        onChange={event =>
                          setVendorCreditFilters(prev => ({
                            ...prev,
                            [key]: event.target.checked
                          }))
                        }
                        className='accent-brand-orange'
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                <ReportMetric
                  label='Selected Vendors'
                  value={catalogueSizeControl.selectedVendors}
                />
                <ReportMetric
                  label='Selected Products'
                  value={catalogueSizeControl.selectedProducts}
                />
                <ReportMetric
                  label='Selected Images'
                  value={catalogueSizeControl.selectedImages}
                />
                <ReportMetric
                  label='Estimated Size'
                  value={formatBytes(catalogueSizeControl.estimatedBytes)}
                />
                <ReportMetric label='Size Limit' value='12 MB' />
                <ReportMetric
                  label='Remaining Allowance'
                  value={formatBytes(
                    Math.max(0, catalogueSizeControl.remainingBytes)
                  )}
                />
                <ReportMetric
                  label='Oversized Images'
                  value={catalogueSizeControl.oversizedCount}
                />
                <ReportMetric
                  label='Images Excluded'
                  value={catalogueSizeControl.excludedDueToPolicy}
                />
              </div>

              {catalogueSizeControl.isOverSize && (
                <div className='border-2 border-red-300 bg-red-50 p-3 text-[10px] font-black uppercase text-red-700'>
                  Catalogue generation blocked: estimated size exceeds 12MB.
                  Split catalogue by sector, category, suburb, or vendor group.
                </div>
              )}

              <div className='overflow-x-auto border border-stone-300 max-h-[520px]'>
                <table className='w-full min-w-[2200px] border-collapse text-left'>
                  <thead className='sticky top-0 z-10 bg-stone-900 text-[8px] font-black uppercase tracking-widest text-white'>
                    <tr>
                      {[
                        'Vendor Name',
                        'Plan',
                        'Sector',
                        'City/Suburb',
                        'Credit Balance',
                        'Products Allowed',
                        'Products Selected',
                        'Products Over Limit',
                        'Overage Due',
                        'Credit Used',
                        'Remaining Credit',
                        'Images Allowed',
                        'Images Selected',
                        'Images Due',
                        'Deployments Allowed / Month',
                        'Deployments Used This Month',
                        'Deployments Due',
                        'Last Deployment Date',
                        'Next Deployment Date',
                        'Entitlement Status',
                        'Summary Action',
                        'Recommended Action',
                        'Bill PDF'
                      ].map(heading => (
                        <th
                          key={heading}
                          className='border border-stone-700 px-2 py-2'
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-stone-100'>
                    {vendorCreditRows.map(row => (
                      <tr
                        key={row.vendorId}
                        className='text-[9px] font-bold uppercase hover:bg-orange-50/30'
                      >
                        <td className='border border-stone-100 px-2 py-2 font-black text-brand-charcoal'>
                          {row.vendorName}
                        </td>
                        <td className='border border-stone-100 px-2 py-2'>
                          {row.planName}
                        </td>
                        <td className='border border-stone-100 px-2 py-2'>
                          {row.sector || '-'}
                        </td>
                        <td className='border border-stone-100 px-2 py-2'>
                          {[row.city, row.suburb].filter(Boolean).join(' / ') ||
                            '-'}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.creditBalance.toFixed(2)}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.productsAllowed === Infinity
                            ? '∞'
                            : row.productsAllowed}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.productsSelected}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono text-red-600'>
                          {row.productsOverLimit}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.overageDue.toFixed(2)}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.creditUsed.toFixed(2)}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.remainingCredit.toFixed(2)}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.imagesAllowed === Infinity
                            ? '∞'
                            : row.imagesAllowed}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.imagesSelected}
                        </td>
                        <td
                          className={`border border-stone-100 px-2 py-2 font-mono ${
                            row.imagesDue < 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {row.imagesAllowed === Infinity ? '∞' : row.imagesDue}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.deploymentsAllowedThisMonth === Infinity
                            ? '∞'
                            : row.deploymentsAllowedThisMonth}
                        </td>
                        <td className='border border-stone-100 px-2 py-2 font-mono'>
                          {row.deploymentsUsedThisMonth}
                        </td>
                        <td
                          className={`border border-stone-100 px-2 py-2 font-mono ${
                            row.deploymentsDue <= 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {row.deploymentsDue}
                        </td>
                        <td className='border border-stone-100 px-2 py-2'>
                          {row.lastDeploymentDate || '-'}
                        </td>
                        <td className='border border-stone-100 px-2 py-2'>
                          {row.nextDeploymentDate || '-'}
                        </td>
                        <td className='border border-stone-100 px-2 py-2'>
                          <VendorCreditStatusBadge status={row.status} />
                        </td>
                        <td className='border border-stone-100 px-2 py-2'>
                          <span
                            className={`inline-flex border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${
                              row.billDue > 0
                                ? 'border-red-300 bg-red-50 text-red-700'
                                : row.actionLabel === 'READY FOR DEPLOYMENT'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : row.actionLabel === 'CREDIT AVAILABLE'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                          >
                            {row.actionLabel}
                          </span>
                        </td>
                        <td className='border border-stone-100 px-2 py-2 normal-case text-stone-600'>
                          {row.recommendedAction}
                        </td>
                        <td className='border border-stone-100 px-2 py-2'>
                          <button
                            type='button'
                            onClick={() => handleDownloadVendorBill(row)}
                            disabled={!canDownloadVendorBill()}
                            className='inline-flex items-center gap-1 border border-stone-800 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-stone-800 hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300'
                            title='Download Vendor Plan Usage Bill PDF'
                          >
                            <Download size={10} />
                            Bill PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                    {vendorCreditRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={23}
                          className='p-8 text-center text-[10px] font-black uppercase text-stone-400'
                        >
                          No vendors match the current control filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {(!localStorage.getItem('activeStaffSession') ||
                ['SysAdmin', 'Super Admin', 'Admin'].includes(
                  JSON.parse(localStorage.getItem('activeStaffSession') || '{}')
                    .role || ''
                ) ||
                ['SysAdmin Desk'].includes(
                  JSON.parse(localStorage.getItem('activeStaffSession') || '{}')
                    .desk || ''
                )) && (
                <div className='mt-6 p-4 border border-stone-200 bg-stone-50'>
                  <details>
                    <summary className='text-xs font-black uppercase text-brand-charcoal cursor-pointer outline-none'>
                      Plan Linkage Diagnostics
                    </summary>
                    <div className='mt-4 overflow-x-auto'>
                      <table className='w-full text-left text-[10px]'>
                        <thead className='bg-stone-200 text-stone-600 uppercase'>
                          <tr>
                            <th className='p-2'>Vendor Name</th>
                            <th className='p-2'>Vendor ID</th>
                            <th className='p-2'>Vendor.planId</th>
                            <th className='p-2'>Active Sub ID</th>
                            <th className='p-2'>Active Sub planId</th>
                            <th className='p-2'>Resolved Plan ID</th>
                            <th className='p-2'>Resolved Plan Name</th>
                            <th className='p-2'>Plan Source</th>
                            <th className='p-2'>Gen Enabled</th>
                            <th className='p-2'>Max Products</th>
                            <th className='p-2'>Max Images</th>
                            <th className='p-2'>Cat Rem.</th>
                            <th className='p-2'>Block Reason</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-stone-200'>
                          {selectedVendors.map(vendor => {
                            const summary = entitlementSummaryByVendor.get(
                              vendor.id
                            )
                            const controlRow = vendorCreditRows.find(
                              r => r.vendorId === vendor.id
                            )
                            const sub =
                              subscriptionService.getSubscriptionByVendor(
                                vendor.id
                              )
                            const isActiveSub =
                              sub &&
                              [
                                'active',
                                'trial',
                                'past_due',
                                'grace_period',
                                'due',
                                'overdue'
                              ].includes(sub.status)
                            const resolvedPlanId = isActiveSub
                              ? sub.planId
                              : vendor.planId
                            const plan = safePlans.find(
                              p => p.id === resolvedPlanId
                            )
                            const planSource =
                              (summary as any)?.planSource ||
                              (isActiveSub
                                ? 'active subscription'
                                : vendor.planId
                                ? 'vendor fallback'
                                : 'none')

                            return (
                              <tr key={vendor.id} className='hover:bg-white'>
                                <td className='p-2 font-bold'>{vendor.name}</td>
                                <td className='p-2 font-mono'>{vendor.id}</td>
                                <td className='p-2 font-mono'>
                                  {vendor.planId || 'None'}
                                </td>
                                <td className='p-2 font-mono'>
                                  {isActiveSub ? sub?.id : 'None'}
                                </td>
                                <td className='p-2 font-mono'>
                                  {isActiveSub ? sub?.planId : 'None'}
                                </td>
                                <td className='p-2 font-mono'>
                                  {resolvedPlanId || 'None'}
                                </td>
                                <td className='p-2 font-bold'>
                                  {plan?.name || 'None'}
                                </td>
                                <td className='p-2 uppercase'>{planSource}</td>
                                <td className='p-2'>
                                  {plan?.enableCatalogueGeneration !== false
                                    ? 'Yes'
                                    : 'No'}
                                </td>
                                <td className='p-2 font-mono'>
                                  {formatLimitValue(
                                    plan?.maxProductsPerCatalogue ??
                                      plan?.maxProducts ??
                                      null
                                  )}
                                </td>
                                <td className='p-2 font-mono'>
                                  {formatLimitValue(
                                    plan?.maxImagesPerCatalogue ?? null
                                  )}
                                </td>
                                <td className='p-2 font-mono'>
                                  {controlRow?.deploymentsDue ?? 'N/A'}
                                </td>
                                <td
                                  className='p-2 text-red-600 max-w-[150px] truncate'
                                  title={
                                    controlRow?.status !== 'OK'
                                      ? controlRow?.recommendedAction
                                      : ''
                                  }
                                >
                                  {controlRow?.status !== 'OK'
                                    ? controlRow?.recommendedAction
                                    : '-'}
                                </td>
                              </tr>
                            )
                          })}
                          {selectedVendors.length === 0 && (
                            <tr>
                              <td
                                colSpan={13}
                                className='p-4 text-center text-stone-400 font-bold uppercase'
                              >
                                Select vendors to view plan diagnostics
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel
            title='Catalogue BI / Vendor Entitlements'
            subtitle='Plan usage, remaining allowances, overage risk and catalogue readiness.'
            actions={
              <SecondaryButton
                size='sm'
                onClick={() => setShowDeploymentReport(value => !value)}
              >
                View Catalogue Deployment Report
              </SecondaryButton>
            }
          >
            <div className='p-4 space-y-4 bg-white'>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-3'>
                <div className='relative md:col-span-2'>
                  <Search
                    className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400'
                    size={13}
                  />
                  <input
                    type='text'
                    value={biFilters.search}
                    onChange={event =>
                      setBiFilters(prev => ({
                        ...prev,
                        search: event.target.value
                      }))
                    }
                    placeholder='Search starter over limit, cosmetics harare, growth images remaining...'
                    className='w-full border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-[10px] font-bold outline-none focus:border-brand-orange'
                  />
                </div>
                <select
                  value={biFilters.plan}
                  onChange={event =>
                    setBiFilters(prev => ({
                      ...prev,
                      plan: event.target.value
                    }))
                  }
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                >
                  <option value='all'>All Plans</option>
                  <option value='Starter'>Starter</option>
                  <option value='Growth'>Growth</option>
                  <option value='Pro'>Pro</option>
                  <option value='Custom'>Custom</option>
                </select>
                <select
                  value={biFilters.status}
                  onChange={event =>
                    setBiFilters(prev => ({
                      ...prev,
                      status: event.target.value as CatalogueBiFilters['status']
                    }))
                  }
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                >
                  <option value='all'>All Statuses</option>
                  <option value='OK'>OK</option>
                  <option value='Near Limit'>Near Limit</option>
                  <option value='Limit Reached'>Limit Reached</option>
                  <option value='Over Limit'>Over Limit</option>
                  <option value='Credit Required'>Credit Required</option>
                </select>
                <select
                  value={biFilters.sector}
                  onChange={event =>
                    setBiFilters(prev => ({
                      ...prev,
                      sector: event.target.value
                    }))
                  }
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                >
                  <option value=''>All Sectors</option>
                  {biSectors.map(sector => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
                <input
                  type='text'
                  value={biFilters.cityRegion}
                  onChange={event =>
                    setBiFilters(prev => ({
                      ...prev,
                      cityRegion: event.target.value
                    }))
                  }
                  placeholder='City / region'
                  className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                />
                {[
                  ['hasProducts', 'Has Products'],
                  ['hasImagesRemaining', 'Has Images Remaining'],
                  ['hasCataloguesRemaining', 'Has Catalogues Remaining']
                ].map(([key, label]) => (
                  <select
                    key={key}
                    value={biFilters[key as keyof CatalogueBiFilters] as string}
                    onChange={event =>
                      setBiFilters(prev => ({
                        ...prev,
                        [key]: event.target.value as BiYesNoFilter
                      }))
                    }
                    className='border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                  >
                    <option value='all'>{label}: All</option>
                    <option value='yes'>{label}: Yes</option>
                    <option value='no'>{label}: No</option>
                  </select>
                ))}
              </div>

              <div className='flex flex-wrap gap-2'>
                {[
                  ['overLimitOnly', 'Over Limit Only'],
                  ['noCreditOnly', 'No Credit Only'],
                  ['nearLimitOnly', 'Near Limit Only'],
                  ['selectedVendorsOnly', 'Selected Vendors Only'],
                  ['selectedProductsOnly', 'Selected Products Only']
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className='flex items-center gap-2 border border-stone-200 bg-stone-50 px-3 py-2 text-[9px] font-black uppercase text-stone-600'
                  >
                    <input
                      type='checkbox'
                      checked={Boolean(
                        biFilters[key as keyof CatalogueBiFilters]
                      )}
                      onChange={event =>
                        setBiFilters(prev => ({
                          ...prev,
                          [key]: event.target.checked
                        }))
                      }
                      className='accent-brand-orange'
                    />
                    {label}
                  </label>
                ))}
              </div>

              {showDeploymentReport && (
                <div className='border-2 border-brand-orange bg-orange-50/40 p-4'>
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                    <ReportMetric
                      label='Vendors Included'
                      value={selectedVendors.length}
                    />
                    <ReportMetric
                      label='Products Included'
                      value={allSelectedProducts.length}
                    />
                    <ReportMetric
                      label='Products Excluded'
                      value={entitlementExcludedProducts.length}
                    />
                    <ReportMetric
                      label='Vendors Over/Credit Risk'
                      value={
                        catalogueAnalyticsSummary.overLimitVendors.length +
                        catalogueAnalyticsSummary.creditRequiredVendors.length
                      }
                    />
                    <ReportMetric
                      label='Vendors Near Limit'
                      value={catalogueAnalyticsSummary.nearLimitVendors.length}
                    />
                    <ReportMetric
                      label='Catalogues Consumed'
                      value={selectedVendors.length}
                    />
                    <ReportMetric
                      label='Image Allowance Consumed'
                      value={catalogueAnalyticsSummary.totalVendorImagesUsed}
                    />
                    <ReportMetric
                      label='Overage Due'
                      value={vendorBiRows
                        .reduce((total, row) => total + row.overageDue, 0)
                        .toFixed(2)}
                    />
                  </div>
                  <p className='mt-3 text-[10px] font-bold uppercase text-orange-900'>
                    Credit / overage summary:{' '}
                    {vendorBiRows.some(row => row.creditBalance === null)
                      ? 'Credit logic not configured for one or more vendors.'
                      : 'Credit balances detected where configured.'}
                  </p>
                </div>
              )}

              <div className='hidden xl:block overflow-x-auto border border-stone-200'>
                <table className='w-full min-w-[1320px] text-left'>
                  <thead className='bg-stone-100 text-[8px] font-black uppercase tracking-widest text-stone-500'>
                    <tr>
                      {[
                        'Vendor',
                        'Plan',
                        'Products',
                        'Images',
                        'Catalogues',
                        'Branches',
                        'Staff',
                        'Notices',
                        'Credit',
                        'Overage',
                        'Status'
                      ].map(heading => (
                        <th key={heading} className='px-3 py-3'>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-stone-100'>
                    {filteredVendorBiRows.map(row => (
                      <tr key={row.vendorId} className='text-[10px] font-bold'>
                        <td className='px-3 py-3'>
                          <p className='font-black uppercase text-brand-charcoal'>
                            {row.vendorName}
                          </p>
                          <p className='text-[8px] uppercase text-stone-400'>
                            {[row.sector, row.city, row.suburb]
                              .filter(Boolean)
                              .join(' / ')}
                          </p>
                        </td>
                        <td className='px-3 py-3'>{row.planName}</td>
                        <td className='px-3 py-3'>
                          {row.productsSelected} /{' '}
                          {formatLimitValue(row.productLimit)}
                          <br />
                          <span className='text-stone-400'>
                            Rem {formatRemainingValue(row.productsRemaining)}
                          </span>
                        </td>
                        <td className='px-3 py-3'>
                          {row.imagesUsed} / {formatLimitValue(row.imageLimit)}
                          <br />
                          <span className='text-stone-400'>
                            Rem {formatRemainingValue(row.imagesRemaining)}
                          </span>
                        </td>
                        <td className='px-3 py-3'>
                          {row.cataloguesGeneratedThisMonth} /{' '}
                          {formatLimitValue(row.catalogueLimit)}
                          <br />
                          <span className='text-stone-400'>
                            Rem {formatRemainingValue(row.cataloguesRemaining)}
                          </span>
                        </td>
                        <td className='px-3 py-3'>
                          {row.branchesUsed} /{' '}
                          {formatLimitValue(row.branchLimit)}
                          <br />
                          <span className='text-stone-400'>
                            Rem {formatRemainingValue(row.branchesRemaining)}
                          </span>
                        </td>
                        <td className='px-3 py-3'>
                          {row.staffUsed} / {formatLimitValue(row.staffLimit)}
                          <br />
                          <span className='text-stone-400'>
                            Rem {formatRemainingValue(row.staffRemaining)}
                          </span>
                        </td>
                        <td className='px-3 py-3'>
                          {row.noticesUsed} /{' '}
                          {formatLimitValue(row.noticeLimit)}
                          <br />
                          <span className='text-stone-400'>
                            Rem {formatRemainingValue(row.noticesRemaining)}
                          </span>
                        </td>
                        <td className='px-3 py-3'>
                          {row.creditBalance === null
                            ? 'Credit logic not configured'
                            : row.creditBalance.toFixed(2)}
                        </td>
                        <td className='px-3 py-3'>
                          {row.overageDue.toFixed(2)}
                        </td>
                        <td className='px-3 py-3'>
                          <BiStatusBadge status={row.status} />
                          <p className='mt-1 max-w-[170px] text-[8px] uppercase text-stone-400'>
                            {row.statusReasons[0] || row.upgradeRecommendation}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className='grid grid-cols-1 gap-3 xl:hidden'>
                {filteredVendorBiRows.map(row => (
                  <div
                    key={row.vendorId}
                    className='border border-stone-200 bg-white p-3'
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-[11px] font-black uppercase text-brand-charcoal'>
                          {row.vendorName}
                        </p>
                        <p className='text-[9px] font-bold uppercase text-stone-400'>
                          {row.planName} / {row.sector} / {row.city}
                        </p>
                      </div>
                      <BiStatusBadge status={row.status} />
                    </div>
                    <div className='mt-3 grid grid-cols-2 gap-2 text-[9px] font-bold uppercase text-stone-600'>
                      <span>
                        Products: {row.productsSelected}/
                        {formatLimitValue(row.productLimit)}
                      </span>
                      <span>
                        Images: {row.imagesUsed}/
                        {formatLimitValue(row.imageLimit)}
                      </span>
                      <span>
                        Catalogues: {row.cataloguesGeneratedThisMonth}/
                        {formatLimitValue(row.catalogueLimit)}
                      </span>
                      <span>
                        Credit:{' '}
                        {row.creditBalance === null
                          ? 'Not configured'
                          : row.creditBalance.toFixed(2)}
                      </span>
                    </div>
                    <p className='mt-2 text-[9px] font-bold uppercase text-stone-400'>
                      {row.statusReasons.join(' / ') ||
                        row.upgradeRecommendation}
                    </p>
                  </div>
                ))}
              </div>

              {filteredVendorBiRows.length === 0 && (
                <div className='border border-dashed border-stone-200 p-8 text-center text-[10px] font-black uppercase text-stone-400'>
                  No vendor entitlement rows match the current BI filters.
                </div>
              )}
            </div>
          </DataPanel>

          {/* Multi-Vendor Selection */}
          <section className='card'>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-4'>
                <div className='w-10 h-10 bg-brand-charcoal text-white flex items-center justify-center font-bold italic'>
                  VL
                </div>
                <h3 className='text-sm uppercase font-bold tracking-[0.2em]'>
                  Vendor List
                </h3>
              </div>
              <div className='text-[10px] font-bold text-brand-orange'>
                {config.vendorIds.length} Selected
              </div>
            </div>
            <div className='mb-3 flex flex-col gap-2 border border-stone-200 bg-stone-50 p-3 text-[10px] font-bold uppercase text-stone-500 sm:flex-row sm:items-center sm:justify-between'>
              <span>
                {vendorListStatus === 'loading'
                  ? 'Loading vendors...'
                  : vendorListStatus === 'cached' ||
                    vendorListStatus === 'refreshing' ||
                    masterCache.refreshing
                  ? 'Showing cached vendors - refreshing...'
                  : vendorListStatus === 'ready'
                  ? 'Vendors loaded, checking plans...'
                  : vendorListStatus === 'error'
                  ? vendorListError || 'Vendor lookup failed'
                  : 'Loading vendors...'}
                {masterCache.lastRefreshedAt
                  ? ` | Last refreshed ${
                      safeDateFromUnknown(masterCache.lastRefreshedAt)
                        ?.toLocaleString() || 'N/A'
                    }`
                  : ''}
              </span>
              <button
                type='button'
                onClick={() => {
                  void masterCache.refreshNow()
                  void fetchAllActiveVendors()
                }}
                className='text-brand-orange hover:text-brand-charcoal'
              >
                Refresh now
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar'>
              {filteredVendorSummaries.map(v => {
                const entitlement = entitlementByVendorId[v.vendorId] || {
                  status: 'loading'
                }
                return (
                  <div
                    key={v.vendorId}
                    onClick={() => toggleVendorSelection(v.vendorId)}
                    className={`p-3 border-2 flex items-center gap-4 cursor-pointer transition-all ${
                      config.vendorIds.includes(v.vendorId)
                        ? 'border-brand-orange bg-orange-50/20'
                        : 'border-stone-50 hover:border-stone-100'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 flex items-center justify-center font-bold text-[10px] italic ${
                        config.vendorIds.includes(v.vendorId)
                          ? 'bg-brand-orange text-white'
                          : 'bg-stone-100 text-stone-400'
                      }`}
                    >
                      {v.vendorName?.charAt(0) || 'V'}
                    </div>
                    <div className='flex-1'>
                      <p className='text-[11px] font-bold uppercase'>
                        {v.vendorName}
                      </p>
                      <p className='text-[9px] text-stone-400 font-bold uppercase'>
                        {v.sector} • {v.city}
                      </p>
                      <p className='mt-1 text-[8px] font-black uppercase text-stone-400'>
                        {entitlement.status === 'ready'
                          ? entitlement.planName || 'Plan ready'
                          : entitlement.status === 'missing'
                          ? 'No active plan'
                          : 'Checking plan...'}
                      </p>
                    </div>
                    {entitlement.status === 'loading' && (
                      <Loader2
                        size={12}
                        className='animate-spin text-stone-300'
                      />
                    )}
                    {config.vendorIds.includes(v.vendorId) && (
                      <CheckCircle2 size={12} className='text-brand-orange' />
                    )}
                  </div>
                )
              })}
              {vendorListStatus === 'error' && (
                <div className='col-span-2 text-center text-xs font-bold text-stone-400 p-4'>
                  <button
                    onClick={() => void fetchAllActiveVendors()}
                    className='text-brand-orange underline'
                  >
                    Retry loading vendors
                  </button>
                </div>
              )}
              {activePlanVendorSummaries.length === 0 &&
                (vendorListStatus === 'loading' ||
                  vendorListStatus === 'refreshing' ||
                  (vendorListStatus === 'cached' &&
                    !vendorListQueryCompleted)) && (
                  <div className='col-span-2 text-center text-xs font-bold text-brand-orange p-4 flex items-center justify-center gap-2'>
                    <Loader2 size={14} className='animate-spin' /> Loading
                    vendors...
                  </div>
                )}
              {activePlanVendorSummaries.length === 0 &&
                vendorListQueryCompleted &&
                vendorListStatus !== 'loading' &&
                vendorListStatus !== 'refreshing' &&
                vendorListStatus !== 'error' && (
                  <div className='col-span-2 text-center text-xs font-bold text-stone-400 p-4'>
                    No active vendors with valid plan found
                  </div>
                )}
              {activePlanVendorSummaries.length > 0 &&
                filteredVendorSummaries.length === 0 && (
                  <div className='col-span-2 text-center text-xs font-bold text-stone-400 p-4'>
                    No active vendors match this sector filter
                  </div>
                )}
            </div>
          </section>

          {/* Product Selection */}
          <section className='card'>
            <div className='flex items-start justify-between mb-6'>
              <div className='flex items-start gap-4'>
                <div className='w-10 h-10 bg-brand-charcoal text-white flex items-center justify-center font-bold italic shrink-0'>
                  PS
                </div>
                <div>
                  <h3 className='text-sm uppercase font-bold tracking-[0.2em] text-brand-charcoal'>
                    LINKED PRODUCTS FROM SELECTED VENDORS
                  </h3>
                  <p className='mt-1 text-[10px] font-bold uppercase text-stone-400'>
                    Selected Products Only means this catalogue will include
                    only products selected here.
                  </p>
                </div>
              </div>
              <div className='text-[10px] font-bold text-brand-orange shrink-0 ml-4 pt-1'>
                Selected products: {selectedProductIds.length}
              </div>
            </div>

            <div className='mb-6 p-4 bg-stone-50 border border-stone-200'>
              <label className='flex items-center gap-2 text-xs font-black uppercase text-brand-charcoal cursor-pointer'>
                <input
                  type='checkbox'
                  checked={selectedProductsOnly}
                  onChange={e => setSelectedProductsOnly(e.target.checked)}
                  className='accent-brand-orange w-4 h-4'
                />
                Selected Products Only
              </label>
            </div>

            <div className='space-y-4'>
              {config.vendorIds.length === 0 ? (
                <div className='p-6 text-center text-xs font-bold text-stone-400'>
                  Select at least one vendor to view linked products.
                </div>
              ) : rawSelectedProducts.length === 0 ? (
                <div className='p-6 bg-stone-50 border border-stone-200'>
                  {(() => {
                    const allRaw = safeProducts.filter(p =>
                      selectedVendors.some(v => productMatchesVendor(p, v))
                    )

                    const planStatuses = selectedVendors
                      .map(v =>
                        entitlementByVendorId[v.id]?.status === 'missing'
                          ? 'NO ACTIVE PLAN'
                          : entitlementByVendorId[v.id]?.planName ||
                            'Active Plan'
                      )
                      .join(', ')

                    const activeCount = allRaw.filter(
                      p =>
                        p.status === 'active' ||
                        (p as any).active === true ||
                        p.publishToCatalogue === true ||
                        (p as any).catalogue === true ||
                        (p as any).active !== false
                    ).length

                    const publishedCount = allRaw.filter(
                      p => p.publishToCatalogue !== false
                    ).length

                    const inStockCount = allRaw.filter(
                      p =>
                        Number(p.stockQuantity) > 0 ||
                        p.stockQuantity === undefined ||
                        (p as any).stockStatus === 'in_stock'
                    ).length

                    const categoryCount = allRaw.filter(p =>
                      categoryMatchesProduct(p, config.category)
                    ).length

                    return (
                      <div className='space-y-4'>
                        <div className='text-xs font-bold text-stone-500'>
                          No linked products found for selected vendors. Check
                          Vendor Management &gt; Product & Inventory Sheet.
                        </div>
                        {allRaw.length > 0 && (
                          <div className='border border-amber-300 bg-amber-50 p-3 text-[10px] font-black uppercase text-amber-800'>
                            Products exist in Storefront Builder but are not
                            entering catalogue selection. Check vendor key
                            matching or source alignment.
                          </div>
                        )}
                        <div className='flex items-center gap-3 text-brand-charcoal border-b border-stone-200 pb-3'>
                          <AlertTriangle
                            size={18}
                            className='text-brand-orange'
                          />
                          <h4 className='text-xs font-black uppercase'>
                            Why no products are showing
                          </h4>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[10px] font-mono text-stone-600'>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              selected vendors count
                            </span>
                            <span>{config.vendorIds.length}</span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              selected vendor names
                            </span>
                            <span
                              className='truncate ml-2'
                              title={selectedVendors
                                .map(v => v.name)
                                .join(', ')}
                            >
                              {selectedVendors
                                .map(v => v.name || v.tradingName)
                                .join(', ') || 'Unknown'}
                            </span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              selected vendor plan status
                            </span>
                            <span className='text-brand-orange font-bold truncate ml-2'>
                              {planStatuses || 'Unknown'}
                            </span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              total vendor offers found before filters
                            </span>
                            <span>{allRaw.length}</span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              linked products found
                            </span>
                            <span>
                              {
                                allRaw.filter(
                                  p => p.productMode !== 'branded_product'
                                ).length
                              }
                            </span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              branded products found
                            </span>
                            <span>
                              {
                                allRaw.filter(
                                  p => p.productMode === 'branded_product'
                                ).length
                              }
                            </span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              active products count
                            </span>
                            <span>{activeCount}</span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              publishToCatalogue count
                            </span>
                            <span>{publishedCount}</span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              in-stock count
                            </span>
                            <span>{inStockCount}</span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              after category filter count
                            </span>
                            <span>{categoryCount}</span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              after entitlement filter count
                            </span>
                            <span>
                              {entitlementResult.includedProducts.length}
                            </span>
                          </div>
                          <div className='flex justify-between border-b border-stone-200 pb-1'>
                            <span className='font-bold uppercase text-stone-400'>
                              rawSelectedProducts count
                            </span>
                            <span className='font-bold text-brand-charcoal'>
                              {rawSelectedProducts.length}
                            </span>
                          </div>
                        </div>

                        <div className='mt-4 pt-4 border-t border-stone-200'>
                          <p className='text-[10px] font-bold uppercase text-stone-500 mb-2'>
                            Likely actions:
                          </p>
                          <ul className='list-disc pl-4 space-y-1 text-[10px] font-bold text-stone-600 uppercase'>
                            <li>Assign an active plan to this vendor.</li>
                            <li>
                              Open Vendor Management &gt; Product & Inventory
                              Sheet and publish products to catalogue.
                            </li>
                            <li>Check product active status.</li>
                            <li>
                              Enable Include Out of Stock if products have zero
                              quantity.
                            </li>
                            <li>Check category/sector filters.</li>
                          </ul>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <>
                  <div className='mb-4 relative'>
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400' />
                    <input
                      value={productSelectionSearch}
                      onChange={e => setProductSelectionSearch(e.target.value)}
                      placeholder='Search linked products by name, SKU, vendor...'
                      className='w-full border-2 border-stone-200 bg-white py-3 pl-10 pr-3 text-xs font-bold uppercase outline-none focus:border-brand-orange'
                    />
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <SecondaryButton
                      size='sm'
                      onClick={() => selectVisibleProducts()}
                    >
                      Select All Visible
                    </SecondaryButton>
                    <SecondaryButton
                      size='sm'
                      onClick={() =>
                        selectVisibleProducts(
                          p => p.productMode !== 'branded_product'
                        )
                      }
                    >
                      Select Linked Only
                    </SecondaryButton>
                    <SecondaryButton
                      size='sm'
                      onClick={() =>
                        selectVisibleProducts(
                          p => p.productMode === 'branded_product'
                        )
                      }
                    >
                      Select Branded Only
                    </SecondaryButton>
                    <SecondaryButton
                      size='sm'
                      onClick={clearSelectedProducts}
                    >
                      Clear Selected
                    </SecondaryButton>
                  </div>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar'>
                    {visibleSelectionProducts.map(product => {
                      const imageUrl =
                        normalizeImageList(
                          product.imageUrl ||
                            (product as any).vendorProductImage ||
                            (product as any).brandLogoUrl ||
                            (product as any).images ||
                            (product as any).imageUrls
                        )[0] || ''
                      const imageStatus =
                        (product as any).imageStatus ||
                        (imageUrl ? 'uploaded' : 'missing')
                      const isSelected = selectedProductIds.includes(
                        product.id
                      )
                      const toggleProduct = () => {
                        setSelectedProductsOnly(true)
                        setSelectedProductIds(prev =>
                          prev.includes(product.id)
                            ? prev.filter(id => id !== product.id)
                            : [...prev, product.id]
                        )
                      }

                      return (
                      <div
                        key={product.id}
                        onClick={toggleProduct}
                        className={`p-3 border-2 flex items-start gap-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-brand-orange bg-orange-50/20'
                            : 'border-stone-50 hover:border-stone-100'
                        }`}
                      >
                        <input
                          type='checkbox'
                          checked={isSelected}
                          onClick={e => e.stopPropagation()}
                          onChange={toggleProduct}
                          className='mt-6 accent-brand-orange'
                        />
                        <div className='h-16 w-16 shrink-0 overflow-hidden border border-stone-200 bg-stone-50'>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product.name || product.productName}
                              className='h-full w-full object-cover'
                            />
                          ) : (
                            <div className='flex h-full w-full items-center justify-center text-[8px] font-black uppercase text-stone-300'>
                              No image
                            </div>
                          )}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='flex flex-wrap items-start justify-between gap-2'>
                            <p className='text-[11px] font-bold uppercase truncate'>
                              {product.name || product.productName}
                            </p>
                            <span
                              className={`shrink-0 px-2 py-1 text-[8px] font-black uppercase ${
                                product.productMode === 'branded_product'
                                  ? 'bg-brand-charcoal text-white'
                                  : 'bg-brand-orange text-white'
                              }`}
                            >
                              {product.productMode === 'branded_product'
                                ? 'BRANDED'
                                : 'LINKED'}
                            </span>
                          </div>
                          <p className='text-[9px] text-stone-400 font-bold uppercase truncate'>
                            {product.sku || product.productCode || 'No SKU'} •{' '}
                            {product.vendorName}
                          </p>
                          <div className='mt-2 grid grid-cols-1 gap-1 text-[9px] font-mono text-stone-500 sm:grid-cols-2'>
                            <span>
                              Master:{' '}
                              {product.productMode !== 'branded_product'
                                ? product.masterProductId || 'N/A'
                                : 'N/A'}
                            </span>
                            <span>
                              Offer: {product.offerId || product.id || 'N/A'}
                            </span>
                            <span>
                              Qty/current stock: {product.stockQuantity ?? 0}
                            </span>
                            <span>Price: {product.sellingPrice || 0}</span>
                            <span>
                              Status:{' '}
                              {product.status === 'active'
                                ? 'active'
                                : 'inactive'}
                            </span>
                            <span>
                              Publish:{' '}
                              {product.publishToCatalogue !== false
                                ? 'Yes'
                                : 'No'}
                            </span>
                            <span>Image: {imageStatus}</span>
                            <span>Category: {product.category || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* WhatsApp Access Hub Link Selection */}
          <section className='card'>
            <div className='flex items-start justify-between mb-6'>
              <div className='flex items-center gap-4'>
                <div className='w-10 h-10 bg-emerald-600 text-white flex items-center justify-center font-bold italic shrink-0'>
                  WA
                </div>
                <div>
                  <h3 className='text-sm uppercase font-bold tracking-[0.2em]'>
                    Active Access Hub Links
                  </h3>
                  <p className='text-[10px] text-stone-500 mt-1 leading-tight'>
                    Search and select distribution links for this export.
                    <br />
                    Loaded Hub Links: {safeCahLinks.length} | Active Access Hub
                    Links:{' '}
                    {safeCahLinks.filter(isActiveCatalogueHubLink).length} |
                    Selected Links: {selectedCahLinkIds.length}
                    <br />
                    Source: {linksSource}
                  </p>
                </div>
              </div>
              <div className='text-[10px] font-bold text-emerald-600 shrink-0 ml-4 pt-1'>
                {selectedCahLinkIds.length} Selected
              </div>
            </div>

            <div className='flex flex-wrap gap-2 mb-4'>
              <SecondaryButton
                size='sm'
                disabled={filteredCahLinks.length === 0}
                onClick={handleSelectFilteredCahLinks}
              >
                Select All Filtered
              </SecondaryButton>
              <SecondaryButton
                size='sm'
                onClick={() => setSelectedCahLinkIds([])}
              >
                Clear Selected Links
              </SecondaryButton>
            </div>

            <div className='mb-4 relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400' />
              <input
                value={cahLinkSearch}
                onChange={event => setCahLinkSearch(event.target.value)}
                placeholder='Search CAH links...'
                className='w-full border-2 border-stone-200 bg-white py-3 pl-10 pr-3 text-xs font-bold uppercase outline-none focus:border-emerald-600'
              />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar'>
              {filteredCahLinks.map(link => (
                <div
                  key={link.id}
                  onClick={() => toggleCAHLinkSelection(link.id)}
                  className={`p-3 border-2 flex items-center gap-4 cursor-pointer transition-all ${
                    selectedCahLinkIds.includes(link.id)
                      ? 'border-emerald-600 bg-emerald-50/20'
                      : 'border-stone-50 hover:border-stone-100'
                  }`}
                >
                  <input
                    type='checkbox'
                    checked={selectedCahLinkIds.includes(link.id)}
                    onChange={() => toggleCAHLinkSelection(link.id)}
                    onClick={event => event.stopPropagation()}
                    className='accent-emerald-600'
                  />
                  <div
                    className={`w-8 h-8 flex items-center justify-center font-bold text-[10px] italic ${
                      selectedCahLinkIds.includes(link.id)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    WA
                  </div>
                  <div className='flex-1'>
                    <p className='text-[11px] font-bold uppercase'>
                      {link.name}
                    </p>
                    <p className='text-[9px] text-stone-400 font-bold uppercase'>
                      {link.type} · {link.sector || 'General'}
                    </p>
                  </div>
                  {selectedCahLinkIds.includes(link.id) && (
                    <CheckCircle2 size={12} className='text-emerald-600' />
                  )}
                </div>
              ))}
              {filteredCahLinks.length === 0 && (
                <div className='col-span-2 py-10 text-center text-stone-400 text-xs'>
                  {safeCahLinks.filter(isActiveCatalogueHubLink).length === 0
                    ? 'No active Access Hub links configured. Catalogue generation can continue without CAH links.'
                    : 'No Access Hub links match this search.'}
                </div>
              )}
            </div>
          </section>

          {/* Compiler Success Frame */}
          {lastGenerated && (
            <section className='card border-2 border-emerald-500 bg-emerald-50/10'>
              <div className='flex items-center justify-between mb-8'>
                {' '}
                {/* Check permission for these buttons */}
                <div className='flex items-center gap-3'>
                  <CheckCircle2 className='text-emerald-500' size={24} />
                  <div>
                    <h4 className='text-sm font-bold uppercase tracking-tight'>
                      Catalogue Created
                    </h4>
                    <p className='text-[10px] text-stone-400 font-bold uppercase tracking-wider'>
                      Catalogue ID: {lastGenerated.id}
                    </p>
                    {lastGenerated.hostedUrl && (
                      <p className='text-[10px] font-bold text-brand-orange mt-1'>
                        iPhone users should use the hosted link.
                      </p>
                    )}
                  </div>
                </div>
                <div className='flex gap-2 flex-wrap justify-end'>
                  <SecondaryButton
                    onClick={() => {
                      handleMarkDeployed(lastGenerated.id)
                      if (
                        permissionService.canApprove('createCatalogue') &&
                        lastGenerated.hostedUrl
                      ) {
                        window.open(lastGenerated.hostedUrl, '_blank')
                      }
                    }}
                    size='sm'
                  >
                    <Globe size={14} className='mr-2' /> Deploy / Open Hosted
                    Catalogue
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => {
                      setQuickLogData({
                        activityType: 'CATALOGUE_SHARED',
                        catalogueId: lastGenerated.id,
                        sector: config.sector,
                        category: config.category,
                        province: config.province,
                        cityTown: config.cityTown,
                        vendorName: 'Multi-vendor Catalogue',
                        leadStatus: 'NOT_APPLICABLE',
                        priority: 'MEDIUM'
                      })
                      setIsQuickLogOpen(true)
                    }}
                    size='sm'
                  >
                    <MessageSquare size={14} className='mr-2' /> Log Share
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => {
                      if (permissionService.canEdit('createCatalogue'))
                        setLastGenerated(null)
                      else
                        showBrandedAlert({
                          title: 'seiGEN Commerce',
                          message:
                            'Permission denied to clear generated catalogue.',
                          type: 'error'
                        })
                    }}
                    size='sm'
                    disabled={!permissionService.canEdit('createCatalogue')}
                  >
                    Clear
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={() =>
                      downloadFile(lastGenerated.html, lastGenerated.fileName)
                    }
                    size='sm'
                    disabled={!permissionService.canExport('createCatalogue')}
                  >
                    <Download size={14} className='mr-2' /> Download Offline
                    HTML
                  </PrimaryButton>
                </div>
              </div>
              <div className='aspect-[3/4] w-full border-2 border-stone-200 shadow-inner relative overflow-hidden bg-white'>
                <iframe
                  srcDoc={lastGenerated.html}
                  title='Catalogue Preview'
                  className='w-full h-[250%] border-0 pointer-events-none transform scale-[0.4] origin-top border-stone-200'
                />
                <div className='absolute inset-0 bg-stone-900/5 flex items-center justify-center group cursor-pointer hover:bg-stone-900/20 transition-all'>
                  <div className='bg-white p-4 font-bold text-[10px] uppercase tracking-widest shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity'>
                    Audit View Active
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Catalogue Archive / History Manager */}
          <DataPanel title='Catalogue Archive & History Manager'>
            <div className='px-6 py-4 bg-stone-50 border-b border-stone-100 grid grid-cols-1 md:grid-cols-5 gap-4 items-center'>
              <div className='relative'>
                <Search
                  className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400'
                  size={12}
                />
                <input
                  type='text'
                  placeholder='Search Serial, Sector...'
                  className='w-full pl-8 pr-3 py-2 text-[10px] font-bold outline-none border border-stone-200'
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                />
              </div>
              <SearchableComboBox
                value={filterSector}
                options={sectorLabels.length > 0 ? sectorLabels : uniqueSectors}
                getOptionLabel={sector => sector}
                getOptionValue={sector => sector}
                getOptionSearchText={sector => sector}
                placeholder='All Sectors'
                onSelect={sector => setFilterSector(sector || '')}
              />
              <select
                className='p-2 text-[10px] font-bold outline-none border border-stone-200'
                value={filterStatus}
                onChange={e =>
                  setFilterStatus(e.target.value as DeploymentStatus | 'all')
                }
              >
                <option value='all'>All Statuses</option>
                <option value='draft'>Draft</option>
                <option value='generated'>Generated</option>
                <option value='deployed'>Deployed</option>
                <option value='expired'>Expired</option>
                <option value='replaced'>Replaced</option>
                <option value='archived'>Archived</option>
              </select>
              <div className='flex gap-4 items-center'>
                <label className='flex items-center gap-2 text-[9px] font-bold uppercase text-stone-500 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showArchived}
                    onChange={e => setShowArchived(e.target.checked)}
                    className='accent-brand-orange'
                  />{' '}
                  Show Archived
                </label>
                <label className='flex items-center gap-2 text-[9px] font-bold uppercase text-stone-500 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showReplaced}
                    onChange={e => setShowReplaced(e.target.checked)}
                    className='accent-brand-orange'
                  />{' '}
                  Show Replaced
                </label>
              </div>
              <button
                type='button'
                onClick={() => void handleCleanupOldArchives()}
                className='border border-stone-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:border-brand-orange hover:text-brand-orange'
              >
                Clean Old Archives Now
              </button>
            </div>

            <div className='overflow-x-auto min-h-[300px]'>
              <table className='w-full text-left text-sm border-collapse'>
                <thead>
                  <tr className='bg-stone-100 border-b border-stone-200 text-[9px] font-bold uppercase tracking-widest text-stone-400'>
                    <th className='px-4 py-3'>Serial / ID</th>
                    <th className='px-4 py-3'>Classification</th>
                    <th className='px-4 py-3'>Entities</th>
                    <th className='px-4 py-3'>Lifecycle</th>
                    <th className='px-4 py-3'>Timeline</th>
                    <th className='px-4 py-3'>Payload</th>
                    <th className='px-4 py-3 text-right'>Actions</th>
                  </tr>
                </thead>
                <tbody className='text-sm font-medium text-stone-600 divide-y divide-stone-100'>
                  {filteredHistory.map(cat => {
                    const expiryTime = safeDateFromUnknown(
                      cat.expiryDate
                    )?.getTime()
                    const nowTime = Date.now()
                    const isExpiringSoon =
                      cat.status === 'deployed' &&
                      typeof expiryTime === 'number' &&
                      expiryTime - nowTime <
                        2 * 24 * 60 * 60 * 1000
                    const isExpired =
                      cat.status === 'expired' ||
                      (cat.status === 'deployed' &&
                        typeof expiryTime === 'number' &&
                        expiryTime < nowTime)

                    return (
                      <tr
                        key={cat.id}
                        className='hover:bg-stone-50 transition-colors'
                      >
                        <td className='px-4 py-3'>
                          <p className='text-xs font-black uppercase tracking-tight'>
                            {cat.serialNumber}
                          </p>
                          <p className='text-[9px] text-stone-400 font-mono mt-0.5'>
                            {cat.id}
                          </p>
                        </td>
                        <td className='px-4 py-3 text-[10px] font-bold uppercase'>
                          <p className='text-brand-charcoal'>{cat.sector}</p>
                          <p className='text-stone-400'>{cat.category}</p>
                        </td>
                        <td className='px-4 py-3 text-[10px] font-mono'>
                          <p>{cat.productCount} Products</p>
                          <p>{cat.vendorIds?.length || 0} Vendors</p>
                        </td>
                        <td className='px-4 py-3'>
                          <div className='flex flex-col items-start gap-1'>
                            <CatalogueStatusBadge status={cat.status} />
                            {isExpiringSoon && !isExpired && (
                              <span className='px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase'>
                                Expiring Soon
                              </span>
                            )}
                            {isExpired && (
                              <span className='px-2 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase'>
                                Expired
                              </span>
                            )}
                          </div>
                        </td>
                        <td className='px-4 py-3 text-[9px] font-bold uppercase text-stone-500 whitespace-nowrap space-y-1'>
                          <span>
                            Gen:{' '}
                            {safeDateLabel(cat.generatedAt)}
                          </span>
                          <br />
                          {cat.deployedAt && (
                            <span>
                              Deployed: {safeDateLabel(cat.deployedAt)}
                            </span>
                          )}
                          <br />
                          {cat.expiryDate && (
                            <span>
                              Expiry: {safeDateLabel(cat.expiryDate)}
                            </span>
                          )}
                        </td>
                        <td className='px-4 py-3 text-[10px] font-mono text-stone-500'>
                          {cat.htmlSize
                            ? `${(cat.htmlSize / 1024).toFixed(1)} KB`
                            : 'N/A'}
                        </td>
                        <td className='px-4 py-3 text-right'>
                          <div className='flex justify-end gap-1.5 flex-wrap max-w-[140px] ml-auto'>
                            <button
                              onClick={() => handleViewPreview(cat)}
                              className='p-1.5 text-stone-400 hover:text-brand-charcoal border border-stone-200 bg-white'
                              title='View Preview'
                            >
                              <Eye size={12} />
                            </button>

                            {cat.htmlContent &&
                              permissionService.canExport(
                                'createCatalogue'
                              ) && (
                                <>
                                  <button
                                    onClick={() =>
                                      downloadFile(
                                        cat.htmlContent!,
                                        cat.fileName ||
                                          `${cat.serialNumber}.html`
                                      )
                                    }
                                    className='p-1.5 text-stone-400 hover:text-brand-charcoal border border-stone-200 bg-white'
                                    title='Download HTML'
                                  >
                                    <Download size={12} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleCopyHtml(cat.htmlContent!)
                                    }
                                    className='p-1.5 text-stone-400 hover:text-brand-charcoal border border-stone-200 bg-white'
                                    title='Copy HTML'
                                  >
                                    <Copy size={12} />
                                  </button>
                                </>
                              )}

                            {permissionService.canEdit('createCatalogue') && (
                              <button
                                onClick={() => handleEditConfig(cat)}
                                className='p-1.5 text-brand-orange hover:bg-orange-50 border border-orange-200 bg-white'
                                title='Edit Configuration'
                              >
                                <Edit3 size={12} />
                              </button>
                            )}

                            {cat.status === 'generated' && (
                              <button
                                onClick={() => {
                                  handleMarkDeployed(cat.id)
                                }}
                                className={`p-1.5 bg-stone-900 text-white hover:bg-brand-orange transition-colors`}
                                title='Deploy'
                              >
                                <Globe size={12} />
                              </button>
                            )}

                            {cat.status === 'deployed' &&
                              permissionService.canApprove(
                                'createCatalogue'
                              ) && (
                                <button
                                  onClick={() => handleRedeploy(cat.id)}
                                  className='p-1.5 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 bg-white'
                                  title='Redeploy / Reset Expiry'
                                >
                                  <Globe size={12} />
                                </button>
                              )}

                            <button
                              onClick={() => {
                                if (
                                  permissionService.canDelete('createCatalogue')
                                )
                                  handleArchive(cat.id)
                                else
                                  showBrandedAlert({
                                    title: 'seiGEN Commerce',
                                    message:
                                      'Permission denied to archive catalogues.',
                                    type: 'error'
                                  })
                              }}
                              className={`p-1.5 text-stone-400 border border-stone-200 hover:text-brand-charcoal transition-colors bg-white ${
                                !permissionService.canDelete('createCatalogue')
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                              title='Archive'
                            >
                              <Archive size={12} />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  permissionService.canDelete('createCatalogue')
                                ) {
                                  setConfirmConfig({
                                    isOpen: true,
                                    message:
                                      'Permanently delete this catalogue record? This cannot be undone.',
                                    confirmLabel: 'Delete Catalogue',
                                    variant: 'danger',
                                    onConfirm: () => void handleDelete(cat.id)
                                  })
                                } else
                                  showBrandedAlert({
                                    title: 'seiGEN Commerce',
                                    message:
                                      'Permission denied to delete catalogues.',
                                    type: 'error'
                                  })
                              }}
                              className={`p-1.5 text-stone-400 border border-stone-200 hover:text-red-500 hover:border-red-200 transition-colors bg-white ${
                                !permissionService.canDelete('createCatalogue')
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                              title='Delete'
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className='p-20 text-center text-stone-300'
                      >
                        <Package
                          size={48}
                          className='mx-auto mb-4 opacity-20'
                        />
                        <p className='text-[10px] font-extrabold uppercase'>
                          Repository Empty
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DataPanel>
        </div>

        {/* Sidebar / Build Stats */}
        <div className='space-y-8'>
          <DataPanel title='Review Checklist'>
            <div className='p-6 space-y-6'>
              {catalogueBuildMetrics.reviewWarnings.length > 0 ? (
                <div className='space-y-3'>
                  {catalogueBuildMetrics.reviewWarnings.map((w, i) => (
                    <div key={i} className='flex gap-3 text-red-600'>
                      <AlertTriangle size={14} className='shrink-0 mt-0.5' />
                      <p className='text-[10px] font-bold uppercase leading-tight italic'>
                        {w}
                      </p>
                    </div>
                  ))}
                  {selectedVendors[0] && (
                    <div className='border border-stone-200 bg-stone-50 p-3 text-[9px] font-mono uppercase text-stone-500'>
                      <p>
                        Vendor: {selectedVendors[0].name || selectedVendors[0].tradingName} /{' '}
                        {selectedVendors[0].vendorCode || selectedVendors[0].id}
                      </p>
                      <p>
                        Products: storefront {safeProducts.filter(product =>
                          productMatchesVendor(product, selectedVendors[0])
                        ).length} / candidates {catalogueBuildMetrics.candidateProductCount} / linked{' '}
                        {catalogueBuildMetrics.linkedProductCount} / branded{' '}
                        {catalogueBuildMetrics.brandedProductCount} / selected{' '}
                        {catalogueBuildMetrics.selectedProductCount} / included{' '}
                        {catalogueBuildMetrics.includedProductCount}
                      </p>
                      <p>
                        Plan:{' '}
                        {catalogueBuildMetrics.deploymentRows[0]?.planName || 'N/A'} / limit{' '}
                        {catalogueBuildMetrics.deploymentRows[0]?.allowedProducts === Infinity
                          ? 'unlimited'
                          : catalogueBuildMetrics.deploymentRows[0]?.allowedProducts ?? 'N/A'} /{' '}
                        {catalogueBuildMetrics.deploymentRows[0]?.blockReason || 'no plan block'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className='flex items-center gap-3 text-emerald-600'>
                  <CheckCircle2 size={16} />
                  <p className='text-[10px] font-bold uppercase'>
                    READY TO CREATE
                  </p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel title='Deployment Summary'>
            <div className='p-6 space-y-4'>
              <div className='grid grid-cols-2 gap-3'>
                <div className='p-3 border border-stone-200 bg-white'>
                  <p className='text-[8px] font-extrabold uppercase text-stone-400'>
                    Included
                  </p>
                  <p className='text-lg font-black text-brand-charcoal'>
                    {catalogueBuildMetrics.includedProductCount}
                  </p>
                </div>
                <div className='p-3 border border-orange-200 bg-orange-50'>
                  <p className='text-[8px] font-extrabold uppercase text-orange-700'>
                    Excluded
                  </p>
                  <p className='text-lg font-black text-orange-900'>
                    {catalogueBuildMetrics.excludedProductCount}
                  </p>
                </div>
              </div>

              {catalogueBuildMetrics.includedProductCount === 0 && (
                <div className='border border-amber-300 bg-amber-50 p-3 text-[10px] font-black uppercase leading-relaxed text-amber-800'>
                  No exportable products currently included. Check product
                  selection, publish status, stock status, and plan limits.
                </div>
              )}

              <div className='space-y-3 max-h-80 overflow-y-auto pr-1'>
                {catalogueBuildMetrics.deploymentRows.map(summary => (
                  <div
                    key={summary.vendorId}
                    className='border border-stone-200 bg-white p-3'
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-[10px] font-black uppercase text-brand-charcoal'>
                          {summary.vendorName}
                        </p>
                        <p className='text-[8px] font-bold uppercase text-stone-400'>
                          {summary.planName}
                        </p>
                      </div>
                      <span
                        className={`text-[8px] font-black uppercase px-2 py-1 border ${
                          summary.excludedProducts > 0
                            ? 'border-orange-300 bg-orange-50 text-orange-800'
                            : summary.creditUsed > 0
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {summary.excludedProducts > 0
                          ? 'Auto-dropped'
                          : summary.creditUsed > 0
                          ? 'Credit used'
                          : 'Clear'}
                      </span>
                    </div>
                    <div className='grid grid-cols-2 gap-2 mt-3 text-[9px] font-bold uppercase text-stone-500'>
                      <span>Selected: {summary.selectedProducts}</span>
                      <span>
                        Allowed:{' '}
                        {summary.allowedProducts === Infinity
                          ? '∞'
                          : summary.allowedProducts}
                      </span>
                      <span>Included: {summary.includedProducts}</span>
                      <span>Excluded: {summary.excludedProducts}</span>
                      <span>Overage Due: {summary.overageDue.toFixed(2)}</span>
                      <span>Credit Used: {summary.creditUsed.toFixed(2)}</span>
                      <span className='col-span-2'>
                        Remaining Credit: {summary.remainingCredit.toFixed(2)}
                      </span>
                    </div>
                    {summary.blockReason && (
                      <p className='mt-3 text-[9px] font-bold leading-relaxed text-orange-900'>
                        {summary.blockReason}
                      </p>
                    )}
                  </div>
                ))}
                {catalogueBuildMetrics.deploymentRows.length === 0 && (
                  <p className='text-[10px] font-bold uppercase text-stone-400'>
                    Select vendors to calculate entitlement.
                  </p>
                )}
              </div>

              {canOverridePlanLimits &&
                entitlementSummaries.some(s => s.overageQuantity > 0) && (
                  <div className='border border-stone-300 bg-stone-50 p-3 space-y-3'>
                    <label className='flex items-center gap-2 text-[10px] font-black uppercase text-brand-charcoal'>
                      <input
                        type='checkbox'
                        checked={overridePlanLimits}
                        onChange={event =>
                          setOverridePlanLimits(event.target.checked)
                        }
                      />
                      Override plan limits
                    </label>
                    <textarea
                      value={overrideReason}
                      onChange={event => setOverrideReason(event.target.value)}
                      placeholder='Required reason for finance/admin audit'
                      className='w-full border border-stone-200 bg-white p-2 text-[10px] font-bold outline-none focus:border-brand-orange'
                      rows={3}
                    />
                  </div>
                )}
            </div>
          </DataPanel>

          <DataPanel title='Catalogue Image Optimization'>
            <div className='p-6 space-y-4'>
              <ul className='text-xs font-medium text-stone-600 space-y-2'>
                <li className='flex justify-between'>
                  <span className='font-bold uppercase text-[10px] text-stone-400'>
                    Target:
                  </span>
                  <span>8KB WebP thumbnails</span>
                </li>
                <li className='flex justify-between'>
                  <span className='font-bold uppercase text-[10px] text-stone-400'>
                    Max dimension:
                  </span>
                  <span>160px</span>
                </li>
                <li className='flex justify-between'>
                  <span className='font-bold uppercase text-[10px] text-stone-400'>
                    Selected images:
                  </span>
                  <span>{catalogueBuildMetrics.selectedImageCount}</span>
                </li>
                <li className='flex justify-between'>
                  <span className='font-bold uppercase text-[10px] text-stone-400'>
                    Included images:
                  </span>
                  <span>{catalogueBuildMetrics.includedImageCount}</span>
                </li>
                <li className='flex justify-between'>
                  <span className='font-bold uppercase text-[10px] text-stone-400'>
                    Oversized images:
                  </span>
                  <span>{catalogueBuildMetrics.oversizedImageCount}</span>
                </li>
                <li className='flex justify-between'>
                  <span className='font-bold uppercase text-[10px] text-stone-400'>
                    Images excluded:
                  </span>
                  <span>{catalogueBuildMetrics.imagesExcludedCount}</span>
                </li>
                <li className='flex justify-between'>
                  <span className='font-bold uppercase text-[10px] text-stone-400'>
                    Estimated payload:
                  </span>
                  <span>
                    {catalogueBuildMetrics.estimatedPayloadMb.toFixed(2)} MB
                  </span>
                </li>
                <li className='flex justify-between'>
                  <span className='font-bold uppercase text-[10px] text-stone-400'>
                    Status:
                  </span>
                  <span className='font-bold'>
                    <span
                      className={
                        catalogueBuildMetrics.imageStatus === 'GOOD'
                          ? 'text-emerald-600'
                          : catalogueBuildMetrics.imageStatus === 'TOO HEAVY'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }
                    >
                      {catalogueBuildMetrics.imageStatus}
                    </span>
                  </span>
                </li>
              </ul>

              {optimizationSummary && (
                <div className='mt-4 pt-4 border-t border-stone-100 text-[10px] space-y-1 text-stone-600'>
                  <p className='font-bold text-brand-charcoal mb-2'>
                    {optimizationSummary.imagesOptimized} thumbnails optimized.
                    Average image size:{' '}
                    {(optimizationSummary.averageOptimizedBytes / 1024).toFixed(
                      1
                    )}
                    KB. Estimated image payload:{' '}
                    {(
                      optimizationSummary.totalEstimatedPayloadBytes /
                      1024 /
                      1024
                    ).toFixed(1)}
                    MB.
                  </p>
                  <p>
                    Raw product count: {optimizationSummary.rawProductCount}
                  </p>
                  <p>
                    Product images found:{' '}
                    {optimizationSummary.productImagesFound}
                  </p>
                  <p>
                    Images above 8KB target:{' '}
                    {optimizationSummary.aboveTargetCount}
                  </p>
                  <p>
                    Images above 8KB blocked/excluded by policy:{' '}
                    {optimizationSummary.aboveMaxCount}
                  </p>
                  <p className='mt-2 font-bold italic text-brand-orange'>
                    {optimizationSummary.groupedRows} vendor product rows
                    grouped into {optimizationSummary.uniqueThumbnails}{' '}
                    thumbnails.
                  </p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel title='Catalogue Performance'>
            <div className='p-6 space-y-8'>
              <div className='p-4 bg-stone-900 text-white flex flex-col items-center justify-center border-4 border-brand-orange'>
                <p className='text-[9px] font-bold uppercase tracking-[0.2em] mb-1 opacity-60'>
                  Estimated File Size
                </p>
                {catalogueBuildMetrics.includedProductCount === 0 ? (
                  <p className='text-sm font-black uppercase tracking-tight text-amber-200'>
                    No exportable products selected.
                  </p>
                ) : (
                  <p className='text-3xl font-bold tracking-tighter'>
                    {catalogueBuildMetrics.estimatedFileSizeKb > 1024
                      ? `${(
                          catalogueBuildMetrics.estimatedFileSizeKb / 1024
                        ).toFixed(2)} MB`
                      : `${catalogueBuildMetrics.estimatedFileSizeKb.toFixed(
                          0
                        )} KB`}
                  </p>
                )}
                <div className='w-full h-1 bg-white/20 mt-4 overflow-hidden'>
                  <div
                    className={`h-full transition-all duration-500 ${
                      catalogueBuildMetrics.estimatedPayloadBytes >
                      MAX_CATALOGUE_SIZE_BYTES
                        ? 'bg-red-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (catalogueBuildMetrics.estimatedPayloadBytes /
                          MAX_CATALOGUE_SIZE_BYTES) *
                          100
                      )}%`
                    }}
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='text-center p-3 border border-stone-100'>
                  <div className='text-xs font-bold'>
                    {catalogueBuildMetrics.includedProductCount}
                  </div>
                  <div className='text-[8px] font-extrabold uppercase text-stone-400'>
                    Products
                  </div>
                </div>
                <div className='text-center p-3 border border-stone-100'>
                  <div className='text-xs font-bold'>
                    {catalogueBuildMetrics.includedImageCount}
                  </div>
                  <div className='text-[8px] font-extrabold uppercase text-stone-400'>
                    Images
                  </div>
                </div>
              </div>
            </div>
          </DataPanel>

          <div className='p-6 bg-orange-50 border border-orange-100 text-orange-900 rounded-lg'>
            <h4 className='text-[10px] font-extrabold uppercase mb-2 flex items-center gap-2'>
              <Filter size={12} /> Optimization Tip
            </h4>
            <p className='text-[10px] font-bold leading-relaxed italic opacity-80'>
              Avoid catalogues larger than 12MB. Group items by price-point or
              specific vehicle category to keep asset size minimal for users on
              shared mobile data.
            </p>
          </div>
        </div>
      </div>

      <WhatsAppActivityQuickLog
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        initialData={quickLogData}
      />
    </div>
  )
}

const ToggleItem: React.FC<{
  label: string
  active: boolean
  onClick: () => void
}> = ({ label, active, onClick }) => (
  <div
    onClick={onClick}
    className={`p-3 border-2 cursor-pointer transition-all flex items-center justify-between ${
      active
        ? 'border-brand-orange bg-brand-orange text-white'
        : 'border-stone-50 text-stone-400'
    }`}
  >
    <span className='text-[9px] font-bold uppercase'>{label}</span>
    {active ? <CheckCircle2 size={10} /> : <Plus size={10} />}
  </div>
)

const CatalogueStatusBadge: React.FC<{ status: DeploymentStatus }> = ({
  status
}) => {
  const styles = {
    draft: 'bg-stone-100 text-stone-600',
    generated: 'bg-blue-100 text-blue-700',
    deployed: 'bg-emerald-100 text-emerald-700',
    expired: 'bg-red-100 text-red-700',
    replaced: 'bg-purple-100 text-purple-700',
    archived: 'bg-stone-800 text-stone-300'
  }
  return (
    <span
      className={`px-2 py-0.5 rounded-none text-[8px] font-black uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  )
}

const BiStatusBadge: React.FC<{ status: CatalogueBiStatus }> = ({ status }) => {
  const styles: Record<CatalogueBiStatus, string> = {
    OK: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'Near Limit': 'border-amber-200 bg-amber-50 text-amber-700',
    'Limit Reached': 'border-orange-200 bg-orange-50 text-orange-700',
    'Over Limit': 'border-red-200 bg-red-50 text-red-700',
    'Credit Required': 'border-red-300 bg-white text-red-700'
  }

  return (
    <span
      className={`inline-flex border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${styles[status]}`}
    >
      {status}
    </span>
  )
}

const VendorCreditStatusBadge: React.FC<{
  status: VendorCatalogueEntitlementStatus
}> = ({ status }) => {
  const styles: Record<VendorCatalogueEntitlementStatus, string> = {
    OK: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    CREDIT_REQUIRED: 'border-red-300 bg-red-50 text-red-700',
    UPGRADE_RECOMMENDED: 'border-amber-300 bg-amber-50 text-amber-800',
    DEPLOYMENT_LIMIT_REACHED: 'border-red-300 bg-white text-red-700',
    IMAGE_LIMIT_EXCEEDED: 'border-orange-300 bg-orange-50 text-orange-800',
    BLOCKED: 'border-red-500 bg-red-600 text-white',
    OVERRIDE_USED: 'border-purple-300 bg-purple-50 text-purple-700'
  }

  return (
    <span
      className={`inline-flex border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${styles[status]}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const ReportMetric: React.FC<{ label: string; value: string | number }> = ({
  label,
  value
}) => (
  <div className='border border-orange-200 bg-white p-3'>
    <p className='text-[8px] font-black uppercase tracking-widest text-orange-700'>
      {label}
    </p>
    <p className='mt-1 text-xl font-black font-mono text-brand-charcoal'>
      {value}
    </p>
  </div>
)
