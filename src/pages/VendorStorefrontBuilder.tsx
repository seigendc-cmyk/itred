/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  PageHeader,
  DataPanel,
  PrimaryButton,
  SecondaryButton,
  FormSection,
  FormField,
  StatusBadge,
  TablePanel,
  EmptyState,
  BrandedAlertModal
} from '../components/CommonUI.tsx'
import {
  Download,
  Copy,
  Eye,
  FileCode,
  Archive,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Phone,
  MessageCircle,
  Zap,
  ShieldCheck,
  Layers,
  MessageSquare,
  RefreshCcw,
  Share2,
  Loader2
} from 'lucide-react'
import {
  getDoc,
  getDocs,
  query,
  where,
  collection,
  doc
} from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { getBillableProductsForVendor } from '../utils/planQuotaUtils.ts'
import { vendorService } from '../services/vendorService.ts'
import { productService } from '../services/productService.ts'
import { cahService } from '../services/cahService.ts'
import { pricingPlanService } from '../services/pricingPlanService.ts'
import { permissionService } from '../services/permissionService.ts'
import { storefrontService } from '../services/storefrontService.ts'
import { settingsService } from '../services/settingsService.ts'
import { analyticsService } from '../services/analyticsService.ts'
import { firebaseHealthService } from '../services/firebaseHealthService.ts'
import { planEntitlementService } from '../services/planEntitlementService.ts'
import { vendorPlanUsageService } from '../services/vendorPlanUsageService.ts'
import { generateVendorStorefrontHtml } from '../lib/storefrontTemplate.ts'
import { planAllowsFeature } from '../services/entitlementEngine.ts'
import { sanitizeForFirestore } from '../utils/firestoreSanitize.ts'
import {
  buildVendorProductExportRows,
  exportVendorProductRows
} from '../utils/vendorProductExport.ts'
import {
  Vendor,
  Product,
  CAHLink,
  VendorStorefront,
  PricingPlan,
  Branch,
  Staff,
  DeliveryStaff,
  WhatsAppActivityLog,
  SystemSettings
} from '../types.ts'
import { asArray } from '../utils/safeData.ts'
import { focusMainContent } from '../utils/uiHelpers.ts'
import { WhatsAppActivityQuickLog } from '../components/WhatsAppActivityQuickLog.tsx'
import { masterDataCacheService } from '../services/masterDataCacheService.ts'

const logAnalyticsEvent = (payload: any) => {
  void analyticsService.logEvent(payload).catch((error: any) => {
    firebaseHealthService.reportError('analyticsService.logEvent', error)
  })
}

const getBase64ImageSize = (dataUrl: string) => {
  if (!dataUrl) return 0
  const matches = dataUrl.match(/base64,(.*)$/)
  if (!matches) return 0
  const length = matches[1].length
  return Math.ceil((length * 3) / 4)
}

const estimateHtmlSize = (html: string) => new Blob([html]).size

export const VendorStorefrontBuilder: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cahLinks, setCahLinks] = useState<CAHLink[]>([])
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [storefronts, setStorefronts] = useState<VendorStorefront[]>([])
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(
    null
  )

  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [title, setTitle] = useState('')
  const [slogan, setSlogan] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<string[]>([])
  const [selectedCAHLinkIds, setSelectedCAHLinkIds] = useState<string[]>([])
  const [storefrontId, setStorefrontId] = useState<string | null>(null)
  const [generatedHtml, setGeneratedHtml] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeStorefrontId, setActiveStorefrontId] = useState<string | null>(
    null
  )
  const [isLoadingData, setIsLoadingData] = useState(true)

  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [quickLogData, setQuickLogData] = useState<
    Partial<WhatsAppActivityLog>
  >({})
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean
    title?: string
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: 'seiGEN Commerce',
    message: '',
    type: 'success'
  })

  const showAlert = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) =>
    setAlertConfig({
      isOpen: true,
      title: 'seiGEN Commerce',
      message,
      type
    })

  // Safe array wrappers
  const safeVendors = asArray<Vendor>(vendors)
  const safeProducts = asArray<Product>(products)
  const safeCahLinks = asArray<CAHLink>(cahLinks)
  const safePlans = asArray<PricingPlan>(plans)
  const safeStorefronts = asArray<VendorStorefront>(storefronts)

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true)
      const startMs = performance.now()
      try {
        const [cachedVendors, cachedLinks, cachedPlans] = await Promise.all([
          masterDataCacheService.getVendors(),
          masterDataCacheService.getWhatsappLinks(),
          masterDataCacheService.getPlans()
        ])
        if (cachedVendors.length > 0) {
          setVendors(
            cachedVendors.map(v => ({
              id: v.vendorId || v.id,
              systemCode: '',
              name: v.name || v.vendorName,
              tradingName: v.tradingName || v.vendorName,
              ownerFullName: '',
              sector: v.sector || '',
              category: v.category,
              businessType: v.category || '',
              vendorType: 'other',
              mainPhone: '',
              whatsappNumber: '',
              email: '',
              country: '',
              province: '',
              cityTown: v.cityTown || v.city || '',
              district: '',
              suburb: v.suburb || '',
              streetAddress: '',
              businessDescription: '',
              catalogueDisplayName: v.vendorName,
              catalogueSlogan: '',
              openingHours: '',
              status: (v.status as any) || 'active',
              planId: v.planId || '',
              subscriptionStatus: (v.subscriptionStatus as any) || 'active',
              dataSource: 'master_cache',
              createdBy: '',
              updatedBy: '',
              createdAt: '',
              updatedAt: v.updatedAt || '',
              branches: [],
              staff: [],
              deliveryStaff: []
            }) as Vendor)
          )
        }
        if (cachedLinks.length > 0) setCahLinks(cachedLinks)
        if (cachedPlans.length > 0) setPlans(cachedPlans)

        const [
          rawVendors,
          rawProducts,
          rawCahLinks,
          rawPlans,
          rawStorefronts,
          rawSettings
        ] = await Promise.all([
          vendorService.getVendors(),
          productService.getProducts(),
          cahService.getLinks(),
          pricingPlanService.getPlans(),
          storefrontService.getAllStorefronts(),
          settingsService.getSettings()
        ])

        setVendors(asArray<Vendor>(rawVendors))
        setProducts(asArray<Product>(rawProducts))
        setCahLinks(asArray<CAHLink>(rawCahLinks))
        setPlans(asArray<PricingPlan>(rawPlans))
        setStorefronts(asArray<VendorStorefront>(rawStorefronts))
        setSystemSettings(rawSettings)
      } catch (error) {
        console.warn(
          'Vendor Storefront Builder data failed to load. Using empty arrays.',
          error
        )
        setVendors([])
        setProducts([])
        setCahLinks([])
        setPlans([])
        setStorefronts([])
      } finally {
        setIsLoadingData(false)
        console.info('Data load completed', {
          page: 'VendorStorefrontBuilder',
          elapsedMs: Math.round(performance.now() - startMs)
        })
      }
    }
    void loadData()
  }, [])

  const selectedVendor = useMemo(
    () => safeVendors.find(v => v.id === selectedVendorId),
    [selectedVendorId, safeVendors]
  )
  const selectedVendorPlan = useMemo(
    () =>
      selectedVendor
        ? safePlans.find(p => p.id === selectedVendor.planId)
        : undefined,
    [selectedVendor, safePlans]
  )
  const vendorProducts = useMemo(
    () =>
      getBillableProductsForVendor(safeProducts, selectedVendorId).sort(
        (a, b) =>
          (b.productMode === 'branded_product' ? 1 : 0) -
            (a.productMode === 'branded_product' ? 1 : 0) ||
          String(a.name || a.productName || '').localeCompare(
            String(b.name || b.productName || '')
          )
      ),
    [safeProducts, selectedVendorId]
  )
  const selectedBranches = useMemo(
    () =>
      asArray<Branch>(selectedVendor?.branches).filter(b =>
        selectedBranchIds.includes(b.id)
      ) || [],
    [selectedBranchIds, selectedVendor]
  )
  const selectedStaff = useMemo(
    () =>
      asArray<Staff>(selectedVendor?.staff).filter(s =>
        selectedStaffIds.includes(s.id)
      ) || [],
    [selectedStaffIds, selectedVendor]
  )
  const selectedDelivery = useMemo(
    () =>
      asArray<DeliveryStaff>(selectedVendor?.deliveryStaff).filter(d =>
        selectedDeliveryIds.includes(d.id)
      ) || [],
    [selectedDeliveryIds, selectedVendor]
  )
  const selectedCAHLinks = useMemo(
    () => safeCahLinks.filter(link => selectedCAHLinkIds.includes(link.id)),
    [safeCahLinks, selectedCAHLinkIds]
  )

  const selectedProducts = useMemo(
    () =>
      asArray<Product>(vendorProducts).filter(p =>
        selectedProductIds.includes(p.id)
      ),
    [vendorProducts, selectedProductIds]
  )

  const handleExportStorefrontProducts = (selectedOnly = true) => {
    const exportProducts = selectedOnly ? selectedProducts : vendorProducts
    const vendorName = selectedVendor?.tradingName || selectedVendor?.name || 'Vendor'
    const rows = buildVendorProductExportRows({
      products: exportProducts,
      vendorName
    })

    if (!exportVendorProductRows(rows, vendorName, selectedOnly ? 'Selected-Product-List' : 'Product-List')) {
      showAlert('No products available to export.', 'info')
    }
  }
  const selectedImages = useMemo(
    () => selectedProducts.filter(p => !!p.imageUrl),
    [selectedProducts]
  )
  const monthlyDeployments = useMemo(() => {
    if (!selectedVendor) return 0
    const now = new Date()
    return safeStorefronts.filter(
      sf =>
        sf.vendorId === selectedVendor.id &&
        sf.generatedAt.startsWith(now.toISOString().slice(0, 7))
    ).length
  }, [selectedVendor, safeStorefronts])

  const planWarnings = useMemo(() => {
    const warnings: string[] = []
    if (!selectedVendorPlan) return warnings

    if (!selectedVendorPlan.isVendorStorefrontEnabled) {
      warnings.push('Storefront features are not enabled for this plan.')
    }

    if (selectedImages.length > selectedVendorPlan.maxStorefrontImages) {
      warnings.push(
        `Selected images exceed plan maximum (${selectedImages.length}/${selectedVendorPlan.maxStorefrontImages}).`
      )
    }

    if (selectedImages.length > 500) {
      warnings.push(
        `Maximum supported images is 500. Reduce selection or split into multiple storefronts.`
      )
    }

    if (
      monthlyDeployments >= selectedVendorPlan.maxStorefrontDeploymentsPerMonth
    ) {
      warnings.push(
        `Monthly deployment limit reached (${monthlyDeployments}/${selectedVendorPlan.maxStorefrontDeploymentsPerMonth}). Upgrade recommended.`
      )
    }

    return warnings
  }, [selectedImages, selectedVendorPlan, monthlyDeployments])

  const selectedBranchLimit = selectedVendorPlan?.maxBranchesPerVendor ?? 0
  const selectedStaffLimit = selectedVendorPlan?.maxStaffPerVendor ?? 0
  const selectedDeliveryLimit =
    selectedVendorPlan?.maxDeliveryContactsPerVendor ?? 0

  const readinessScore = useMemo(() => {
    let score = 0

    if (selectedVendor) score += 15
    if (
      selectedVendor?.logoAssetUrl ||
      selectedVendor?.logoUrl ||
      selectedVendor?.businessLogoUrl
    )
      score += 10
    if (
      selectedVendor?.bannerAssetUrl ||
      selectedVendor?.bannerUrl ||
      selectedVendor?.businessBannerUrl
    )
      score += 10
    if (selectedProducts.length > 0) score += 20
    if (selectedImages.length > 0) score += 10
    if (selectedVendor?.whatsappNumber || selectedVendor?.whatsapp) score += 10
    if (selectedBranches.length > 0) score += 10
    if (selectedStaff.length > 0) score += 5
    if (selectedDelivery.length > 0) score += 5
    if (selectedCAHLinks.length > 0) score += 5

    return Math.min(100, score)
  }, [
    selectedVendor,
    selectedProducts.length,
    selectedImages.length,
    selectedBranches.length,
    selectedStaff.length,
    selectedDelivery.length,
    selectedCAHLinks.length
  ])

  const generatedStorefront = useMemo(
    () => safeStorefronts.find(sf => sf.id === activeStorefrontId) || null,
    [activeStorefrontId, safeStorefronts]
  )
  const selectedHtml = generatedStorefront?.htmlContent || generatedHtml
  const currentStorefrontId = generatedStorefront?.id || storefrontId
  const hostedStorefrontUrl =
    (generatedStorefront as (VendorStorefront & { hostedUrl?: string }) | null)
      ?.hostedUrl ||
    (generatedStorefront as (VendorStorefront & { publicUrl?: string }) | null)
      ?.publicUrl ||
    ''
  const generatedStorefrontUrl =
    (
      generatedStorefront as
        | (VendorStorefront & { storefrontUrl?: string })
        | null
    )?.storefrontUrl ||
    (generatedStorefront as (VendorStorefront & { url?: string }) | null)
      ?.url ||
    ''
  const vendorStorefrontUrl =
    (selectedVendor as (Vendor & { storefrontUrl?: string }) | null)
      ?.storefrontUrl ||
    (selectedVendor as (Vendor & { storefrontLink?: string }) | null)
      ?.storefrontLink ||
    (selectedVendor as (Vendor & { hostedStorefrontUrl?: string }) | null)
      ?.hostedStorefrontUrl ||
    ''
  const shareableStorefrontUrl =
    hostedStorefrontUrl || generatedStorefrontUrl || vendorStorefrontUrl

  let defaultFilename = 'Vendor_Storefront.html'
  if (selectedVendor && selectedVendor.name) {
    const yyyyMmDd = new Date().toISOString().split('T')[0]
    const safeFileName = `Vendor_${selectedVendor.name}_${
      selectedVendor.sector || 'General'
    }_${yyyyMmDd}`
    defaultFilename = `${safeFileName
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .replace(/_+/g, '_')}.html`
  }
  const selectedFileName = generatedStorefront?.htmlFileName || defaultFilename

  const handleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleSelectMany = (
    ids: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(prev => {
      const missing = ids.filter(id => !prev.includes(id))
      return [...prev, ...missing]
    })
  }

  const getStorefrontRecord = (html: string, specificId?: string) => {
    if (!selectedVendor) return null
    const storefrontId = specificId || `SF-${Date.now().toString().slice(-8)}`
    const now = new Date().toISOString()
    const yyyyMmDd = now.split('T')[0]

    let safeFileName = 'Vendor_Storefront'
    if (selectedVendor.name) {
      safeFileName = `Vendor_${selectedVendor.name}_${
        selectedVendor.sector || 'General'
      }_${yyyyMmDd}`
      safeFileName = safeFileName
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .replace(/_+/g, '_')
    }

    return {
      id: storefrontId,
      storefrontId,
      vendorId: selectedVendor.id,
      vendorSystemCode: selectedVendor.systemCode,
      vendorName: selectedVendor.name,
      title: title || `${selectedVendor.name} Storefront`,
      slogan: slogan || selectedVendor.catalogueSlogan || '',
      selectedProductIds,
      selectedBranchIds,
      selectedStaffIds,
      selectedDeliveryContactIds: selectedDeliveryIds,
      selectedCAHLinkIds,
      generatedBy: 'Backend Staff',
      generatedAt: now,
      deployedAt: undefined,
      expiryDate: expiryDate || undefined,
      status: 'generated' as const,
      estimatedHtmlSize: estimateHtmlSize(html),
      productCount: selectedProducts.length,
      imageCount: selectedImages.length,
      htmlFileName: `${safeFileName}.html`,
      fileName: `${safeFileName}.html`,
      htmlContent: html
    }
  }

  const generateHtml = async () => {
    if (!selectedVendor) {
      showAlert('Select a vendor before creating the storefront.', 'warning')
      return
    }
    if (selectedProducts.length === 0) {
      showAlert('Select at least one active product.', 'warning')
      return
    }

    const violations: string[] = [...planWarnings]
    if (selectedBranches.length > selectedBranchLimit) {
      violations.push(
        `Selected branches exceed plan maximum (${selectedBranches.length}/${selectedBranchLimit}).`
      )
    }
    if (selectedStaff.length > selectedStaffLimit) {
      violations.push(
        `Selected staff exceed plan maximum (${selectedStaff.length}/${selectedStaffLimit}).`
      )
    }
    if (selectedDelivery.length > selectedDeliveryLimit) {
      violations.push(
        `Selected delivery contacts exceed plan maximum (${selectedDelivery.length}/${selectedDeliveryLimit}).`
      )
    }

    const overrideAllowed =
      permissionService.canEdit('pricing') ||
      permissionService.canApprove('pricing')

    await Promise.allSettled([
      masterDataCacheService.refreshPlans(),
      masterDataCacheService.refreshSubscriptions(),
      selectedVendor.id
        ? masterDataCacheService.invalidateVendor(selectedVendor.id)
        : Promise.resolve()
    ])
    if (violations.length > 0 && !overrideAllowed) {
      showAlert(
        `Storefront generation blocked: ${violations.join(' ')}`,
        'warning'
      )
      return
    }

    setIsGenerating(true)
    focusMainContent()

    try {
      let freshVendor = selectedVendor
      let freshPlan = selectedVendorPlan
      let freshDeployments = monthlyDeployments

      const vendorSnap = await getDoc(doc(db, 'vendors', selectedVendor.id))
      if (vendorSnap.exists()) {
        freshVendor = { id: vendorSnap.id, ...vendorSnap.data() } as Vendor
      }

      const subSnap = await getDocs(
        query(
          collection(db, 'subscriptions'),
          where('vendorId', '==', selectedVendor.id)
        )
      )

      let activePlanId = freshVendor.planId
      if (!subSnap.empty) {
        const activeSubs = subSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((s: any) =>
            ['active', 'trial', 'past_due', 'grace_period'].includes(s.status)
          )
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime()
          )

        if (activeSubs.length > 0 && activeSubs[0].planId) {
          activePlanId = activeSubs[0].planId
        }
      }

      if (activePlanId) {
        let planSnap = await getDoc(doc(db, 'pricing_plans', activePlanId))
        if (!planSnap.exists()) {
          planSnap = await getDoc(doc(db, 'pricingPlans', activePlanId))
        }
        if (planSnap.exists()) {
          freshPlan = { id: planSnap.id, ...planSnap.data() } as PricingPlan
        }
      }

      const nowPrefix = new Date().toISOString().slice(0, 7)
      const usageSnap = await getDocs(
        query(
          collection(db, 'vendor_plan_usage_ledger'),
          where('vendorId', '==', selectedVendor.id),
          where('usageType', '==', 'storefront_generated')
        )
      )
      freshDeployments = usageSnap.docs.filter(
        d =>
          d.data().monthKey === nowPrefix ||
          String(d.data().createdAt || '').startsWith(nowPrefix)
      ).length

      const isFeatureAllowed = planAllowsFeature(
        freshPlan,
        'generate_storefront'
      )

      if (!isFeatureAllowed && !overrideAllowed) {
        setIsGenerating(false)
        showAlert(
          `Storefront generation blocked. Current Plan: ${
            freshPlan?.name || 'Unassigned'
          }. Usage: 0/0. Reason: Storefront feature is not enabled on this plan.`,
          'warning'
        )
        return
      }

      const limit = freshPlan?.maxStorefrontDeploymentsPerMonth ?? 0
      const isUnlimited =
        limit === -1 ||
        limit === null ||
        String(limit).toLowerCase() === 'unlimited'

      if (!isUnlimited && freshDeployments >= limit && !overrideAllowed) {
        setIsGenerating(false)
        showAlert(
          `Storefront generation blocked. Current Plan: ${
            freshPlan?.name || 'Unassigned'
          }. Usage: ${freshDeployments}/${limit}. Reason: Monthly deployment limit reached.`,
          'warning'
        )
        return
      }

      const resolveFeedbackNumber = () => {
        const routes = (systemSettings?.feedbackWhatsAppRoutes || [])
          .filter(r => r.isActive)
          .sort((a, b) => b.priority - a.priority)
        let match = routes.find(r => r.sector === freshVendor.sector)
        if (match) return match.whatsappNumber
        match = routes.find(r => r.purpose === 'DEFAULT')
        if (match) return match.whatsappNumber
        return systemSettings?.defaultFeedbackWhatsAppNumber || ''
      }

      const newStorefrontId = `SF-${Date.now().toString().slice(-8)}`
      setStorefrontId(newStorefrontId)

      const html = generateVendorStorefrontHtml(
        freshVendor,
        selectedProducts,
        selectedBranchIds.length ? selectedBranches : [],
        selectedStaff,
        selectedDelivery,
        safeCahLinks,
        title || `${freshVendor.name} Storefront`,
        slogan || freshVendor.catalogueSlogan || '',
        new Date().toISOString(),
        newStorefrontId,
        expiryDate || undefined,
        freshPlan?.isVendorStorefrontWhatsAppButtonEnabled ?? false,
        freshPlan?.isVendorStorefrontDirectCallButtonEnabled ?? false,
        !!freshPlan?.enableStorefrontCart,
        !!freshPlan?.enableWhatsappOrders,
        freshVendor.id,
        resolveFeedbackNumber(),
        systemSettings?.syncEndpointUrl || '',
        (systemSettings as any)?.defaultCAHLink ||
          (systemSettings as any)?.defaultCahLink ||
          (systemSettings as any)?.defaultAccessHubLink ||
          (systemSettings as any)?.commerceAccessHubLink ||
          ''
      )

      setGeneratedHtml(html)
      const storefront = getStorefrontRecord(html, newStorefrontId)
      if (storefront) {
        storefrontService.saveStorefront(sanitizeForFirestore(storefront))
        vendorPlanUsageService.recordUsage(
          sanitizeForFirestore({
            vendorId: freshVendor.id,
            usageType: 'storefront_generated',
            quantity: 1,
            sourceId: storefront.id,
            description: 'Vendor storefront generated'
          })
        )
        const updatedStorefronts = storefrontService.getAllStorefronts()
        setStorefronts(asArray<VendorStorefront>(updatedStorefronts))
        setActiveStorefrontId(storefront.id)
        logAnalyticsEvent(
          sanitizeForFirestore({
            eventType: 'STOREFRONT_GENERATED',
            actorType: 'backend_staff',
            actorName: 'Backend Staff',
            vendorId: freshVendor.id,
            vendorName: freshVendor.name,
            details: {
              storefrontId: storefront.storefrontId,
              productCount: storefront.productCount,
              imageCount: storefront.imageCount,
              estimatedHtmlSize: storefront.estimatedHtmlSize
            }
          })
        )
      }
      setIsGenerating(false)
    } catch (error: any) {
      console.error('Storefront generation error:', error)
      setIsGenerating(false)
      showAlert(
        error.message || 'An error occurred during generation.',
        'error'
      )
    }
  }

  const downloadHtml = (html: string, filename: string) => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
    logAnalyticsEvent({
      eventType: 'STOREFRONT_DOWNLOADED',
      actorType: 'backend_staff',
      actorName: 'Backend Staff',
      vendorId: selectedVendor?.id ?? null,
      vendorName: selectedVendor?.name ?? null,
      details: { filename }
    })
  }

  const copyHtml = async (html: string) => {
    await navigator.clipboard.writeText(html)
    logAnalyticsEvent({
      eventType: 'HTML_COPIED',
      actorType: 'backend_staff',
      actorName: 'Backend Staff',
      vendorId: selectedVendor?.id ?? null,
      vendorName: selectedVendor?.name ?? null,
      details: { target: 'vendor_storefront' }
    })
    showAlert('Storefront HTML copied to clipboard.')
  }

  const handleShareStorefront = async () => {
    if (!shareableStorefrontUrl) {
      showAlert('Generate or deploy the storefront before sharing.', 'warning')
      return
    }

    try {
      if (hostedStorefrontUrl) {
        await navigator.clipboard.writeText(hostedStorefrontUrl)
        showAlert('Storefront link copied.')
        return
      }

      if (navigator.share) {
        await navigator.share({
          title: 'iTred Storefront',
          text: 'View this vendor storefront on iTred.',
          url: shareableStorefrontUrl
        })
        return
      }

      await navigator.clipboard.writeText(shareableStorefrontUrl)
      showAlert('Storefront link copied.')
    } catch (error) {
      showAlert(
        error instanceof Error
          ? error.message
          : 'Storefront link could not be shared.',
        'error'
      )
    }
  }

  const handleShareStorefrontWhatsApp = () => {
    if (!shareableStorefrontUrl) {
      showAlert('Generate or deploy the storefront before sharing.', 'warning')
      return
    }
    const text = encodeURIComponent(
      `View this iTred storefront powered by seiGEN Commerce: ${shareableStorefrontUrl}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const handleDeploy = async (storefront: VendorStorefront) => {
    storefrontService.markAsDeployed(storefront.id)
    const updatedStorefronts = storefrontService.getAllStorefronts()
    setStorefronts(asArray<VendorStorefront>(updatedStorefronts))
    logAnalyticsEvent({
      eventType: 'STOREFRONT_DEPLOYED',
      actorType: 'backend_staff',
      actorName: 'Backend Staff',
      vendorId: storefront.vendorId,
      details: { storefrontId: storefront.storefrontId }
    })
  }

  const handleArchive = async (storefront: VendorStorefront) => {
    storefrontService.archiveStorefront(storefront.id)
    const updatedStorefronts = storefrontService.getAllStorefronts()
    setStorefronts(asArray<VendorStorefront>(updatedStorefronts))
    logAnalyticsEvent({
      eventType: 'STOREFRONT_ARCHIVED',
      actorType: 'backend_staff',
      actorName: 'Backend Staff',
      vendorId: storefront.vendorId,
      details: { storefrontId: storefront.storefrontId }
    })
  }

  useEffect(() => {
    if (selectedVendor) {
      const now = new Date()
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ]
      const dateStr = `${now.getDate()} ${
        monthNames[now.getMonth()]
      } ${now.getFullYear()}`
      setTitle(
        `${selectedVendor.name} | ${
          selectedVendor.sector || 'General'
        } | iTred Storefront | ${dateStr}`
      )
      setSlogan(selectedVendor.catalogueSlogan || 'A complete vendor showcase.')
      setSelectedProductIds(vendorProducts.slice(0, 20).map(p => p.id))
      setSelectedBranchIds(
        selectedVendor.branches?.slice(0, 2).map(b => b.id) || []
      )
      setSelectedStaffIds(
        selectedVendor.staff?.slice(0, 2).map(s => s.id) || []
      )
      setStorefrontId(null)
      setSelectedDeliveryIds(
        selectedVendor.deliveryStaff?.slice(0, 2).map(d => d.id) || []
      )
      setSelectedCAHLinkIds(cahLinks.slice(0, 3).map(l => l.id))
    } else {
      setSelectedProductIds([])
      setSelectedBranchIds([])
      setSelectedStaffIds([])
      setSelectedDeliveryIds([])
      setStorefrontId(null)
      setSelectedCAHLinkIds([])
    }
  }, [selectedVendorId])

  if (isLoadingData) {
    return (
      <div className='pb-20 min-w-0 max-w-full flex items-center justify-center pt-20'>
        <div className='text-center text-stone-400'>
          <Loader2 className='w-8 h-8 animate-spin mx-auto mb-4' />
          <p className='text-xs font-bold uppercase tracking-widest'>
            Loading Storefront Builder...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='pb-20'>
      <PageHeader
        title='Create Storefront'
        subtitle='Create standalone mobile-ready websites for vendors. Plan limits apply.'
        actions={
          <div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end'>
            {selectedVendor && (
              <>
                <SecondaryButton onClick={() => void handleShareStorefront()}>
                  <Share2 className='w-4 h-4 mr-2' /> Share Storefront
                </SecondaryButton>
                <SecondaryButton
                  onClick={handleShareStorefrontWhatsApp}
                  className='border border-green-600 bg-white text-green-700 hover:bg-green-50'
                >
                  <MessageCircle className='w-4 h-4 mr-2' /> Share via WhatsApp
                </SecondaryButton>
              </>
            )}
            {permissionService.canCreate('createStorefront') ? (
              <PrimaryButton
                onClick={generateHtml}
                disabled={
                  !selectedVendor ||
                  selectedProducts.length === 0 ||
                  isGenerating ||
                  !permissionService.canCreate('createStorefront')
                }
                className={`${
                  isGenerating ? 'opacity-60 cursor-not-allowed' : ''
                } ${
                  !permissionService.canCreate('createStorefront')
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                {isGenerating ? (
                  'Generating...'
                ) : (
                  <>
                    <FileCode className='w-4 h-4 mr-2' /> Create Storefront
                  </>
                )}
              </PrimaryButton>
            ) : null}
          </div>
        }
      />

      <div className='space-y-8'>
        {/* Top Control Panel */}
        <div className='bg-white shadow-sm border border-stone-200 rounded-none p-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
            <FormField label='Select Vendor' required>
              <select
                className='form-input w-full'
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
              >
                <option value=''>Choose vendor...</option>
                {safeVendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.systemCode}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label='Storefront Title' required>
              <input
                type='text'
                className='form-input w-full'
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder='Vendor storefront title'
              />
            </FormField>
            <FormField label='Storefront Slogan'>
              <input
                type='text'
                className='form-input w-full'
                value={slogan}
                onChange={e => setSlogan(e.target.value)}
                placeholder='Vendor slogan or call to action'
              />
            </FormField>
            <FormField label='Expiry Date'>
              <input
                type='date'
                className='form-input w-full'
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
            </FormField>
          </div>
        </div>

        {/* Main Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start'>
          {/* Left Column */}
          <div className='space-y-8'>
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-8 items-start'>
              <DataPanel
                title='Select Products'
                subtitle='Pick up to 500 optimized product images for the storefront.'
                className='shadow-sm border border-stone-200 rounded-none bg-white'
              >
                {vendorProducts.length === 0 ? (
                  <EmptyState
                    title='No products found'
                    description='This vendor has no active products to include.'
                  />
                ) : (
                  <div className='space-y-3 p-4'>
                    <div className='flex flex-wrap gap-2 mb-4'>
                      <SecondaryButton
                        size='sm'
                        onClick={() =>
                          setSelectedProductIds(vendorProducts.map(p => p.id))
                        }
                      >
                        Select all
                      </SecondaryButton>
                      <SecondaryButton
                        size='sm'
                        onClick={() => setSelectedProductIds([])}
                      >
                        Clear
                      </SecondaryButton>
                      <SecondaryButton
                        size='sm'
                        disabled={selectedProducts.length === 0}
                        onClick={() => handleExportStorefrontProducts(true)}
                      >
                        <Download className='w-3 h-3 mr-1 inline' /> Export
                        Products to Excel
                      </SecondaryButton>
                      <span className='text-[11px] font-bold uppercase tracking-widest text-stone-500 mt-2'>
                        {selectedProductIds.length} selected
                      </span>
                    </div>
                    <div className='space-y-2 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar'>
                      {vendorProducts.map(product => (
                        <label
                          key={product.id}
                          className='flex items-center justify-between gap-3 p-3 border border-stone-200 rounded-none hover:bg-stone-50 cursor-pointer transition-colors'
                        >
                          <span className='text-sm font-medium'>
                            {product.name}
                            <span className='ml-2 border border-stone-200 px-2 py-0.5 text-[8px] font-black uppercase text-stone-500'>
                              {product.productMode === 'branded_product'
                                ? 'Branded'
                                : 'Linked'}
                            </span>
                          </span>
                          <input
                            type='checkbox'
                            className='accent-brand-orange w-4 h-4'
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => handleSelectProduct(product.id)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </DataPanel>

              <div className='space-y-8'>
                <DataPanel
                  title='Vendor Profile'
                  subtitle='Vendor and plan entitlement summary.'
                  className='shadow-sm border border-stone-200 rounded-none bg-white'
                >
                  <div className='p-4 space-y-4'>
                    {selectedVendor ? (
                      <>
                        <div className='grid grid-cols-2 gap-4'>
                          <div>
                            <p className='text-[9px] uppercase font-bold tracking-widest text-stone-400'>
                              Vendor
                            </p>
                            <p className='font-bold text-sm text-brand-charcoal mt-1'>
                              {selectedVendor.name}
                            </p>
                          </div>
                          <div>
                            <p className='text-[9px] uppercase font-bold tracking-widest text-stone-400'>
                              Plan
                            </p>
                            <p className='font-bold text-sm text-brand-charcoal mt-1'>
                              {selectedVendorPlan?.name || 'Unassigned'}
                            </p>
                          </div>
                        </div>
                        <div className='grid grid-cols-2 gap-4'>
                          <div>
                            <p className='text-[9px] uppercase font-bold tracking-widest text-stone-400'>
                              Product count
                            </p>
                            <p className='font-bold text-sm text-brand-charcoal mt-1'>
                              {selectedProducts.length} /{' '}
                              {selectedVendorPlan?.maxProducts ?? '—'}
                            </p>
                          </div>
                          <div>
                            <p className='text-[9px] uppercase font-bold tracking-widest text-stone-400'>
                              Image count
                            </p>
                            <p className='font-bold text-sm text-brand-charcoal mt-1'>
                              {selectedImages.length} /{' '}
                              {selectedVendorPlan?.maxStorefrontImages ?? '—'}
                            </p>
                          </div>
                        </div>
                        <div className='flex flex-wrap gap-2 pt-4 border-t border-stone-100'>
                          <StatusBadge
                            status={
                              selectedVendor?.subscriptionStatus || 'trial'
                            }
                            variant={
                              selectedVendor?.subscriptionStatus === 'active'
                                ? 'success'
                                : selectedVendor?.subscriptionStatus ===
                                  'overdue'
                                ? 'error'
                                : 'warning'
                            }
                          />
                          <StatusBadge
                            status={
                              selectedVendorPlan?.isVendorStorefrontEnabled
                                ? 'active'
                                : 'inactive'
                            }
                            variant={
                              selectedVendorPlan?.isVendorStorefrontEnabled
                                ? 'success'
                                : 'warning'
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <div className='py-6 text-center'>
                        <p className='text-xs font-bold uppercase tracking-widest text-stone-400'>
                          Select a vendor to view profile.
                        </p>
                      </div>
                    )}
                  </div>
                </DataPanel>
                <DataPanel
                  title='Selected Sections'
                  subtitle='Choose storefront sections to include.'
                  className='shadow-sm border border-stone-200 rounded-none bg-white'
                >
                  <div className='p-4 space-y-5'>
                    <FormField label='Branches'>
                      <div className='flex flex-wrap gap-2'>
                        <SecondaryButton
                          size='sm'
                          onClick={() =>
                            selectedVendor?.branches &&
                            handleSelectMany(
                              asArray<Branch>(selectedVendor.branches).map(
                                b => b.id
                              ),
                              setSelectedBranchIds
                            )
                          }
                        >
                          Select all
                        </SecondaryButton>
                        <SecondaryButton
                          size='sm'
                          onClick={() => setSelectedBranchIds([])}
                        >
                          Clear
                        </SecondaryButton>
                        <span className='text-[10px] font-bold text-stone-400 ml-2 mt-2'>
                          {selectedBranchIds.length} Selected
                        </span>
                      </div>
                    </FormField>
                    <FormField label='Staff'>
                      <div className='flex flex-wrap gap-2'>
                        <SecondaryButton
                          size='sm'
                          onClick={() =>
                            selectedVendor?.staff &&
                            handleSelectMany(
                              asArray<Staff>(selectedVendor.staff).map(
                                s => s.id
                              ),
                              setSelectedStaffIds
                            )
                          }
                        >
                          Select all
                        </SecondaryButton>
                        <SecondaryButton
                          size='sm'
                          onClick={() => setSelectedStaffIds([])}
                        >
                          Clear
                        </SecondaryButton>
                        <span className='text-[10px] font-bold text-stone-400 ml-2 mt-2'>
                          {selectedStaffIds.length} Selected
                        </span>
                      </div>
                    </FormField>
                    <FormField label='Delivery Contacts'>
                      <div className='flex flex-wrap gap-2'>
                        <SecondaryButton
                          size='sm'
                          onClick={() =>
                            selectedVendor?.deliveryStaff &&
                            handleSelectMany(
                              asArray<DeliveryStaff>(
                                selectedVendor.deliveryStaff
                              ).map(d => d.id),
                              setSelectedDeliveryIds
                            )
                          }
                        >
                          Select all
                        </SecondaryButton>
                        <SecondaryButton
                          size='sm'
                          onClick={() => setSelectedDeliveryIds([])}
                        >
                          Clear
                        </SecondaryButton>
                        <span className='text-[10px] font-bold text-stone-400 ml-2 mt-2'>
                          {selectedDeliveryIds.length} Selected
                        </span>
                      </div>
                    </FormField>
                    <FormField label='CAH Footer Links'>
                      <div className='space-y-3'>
                        <div className='flex flex-wrap gap-2'>
                          <SecondaryButton
                            size='sm'
                            onClick={() =>
                              handleSelectMany(
                                safeCahLinks.map(link => link.id),
                                setSelectedCAHLinkIds
                              )
                            }
                          >
                            Select all
                          </SecondaryButton>
                          <SecondaryButton
                            size='sm'
                            onClick={() => setSelectedCAHLinkIds([])}
                          >
                            Clear
                          </SecondaryButton>
                          <span className='text-[10px] font-bold text-stone-400 ml-2 mt-2'>
                            {selectedCAHLinkIds.length} Selected
                          </span>
                        </div>
                        <div className='space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar border-t border-stone-100 pt-3'>
                          {safeCahLinks
                            .filter(link => link.status === 'active')
                            .map(link => (
                              <label
                                key={link.id}
                                className='flex items-center justify-between gap-3 p-3 border border-stone-200 rounded-none cursor-pointer hover:bg-stone-50 transition-colors'
                              >
                                <div className='flex-1'>
                                  <span className='text-sm font-bold block text-brand-charcoal'>
                                    {link.name}
                                  </span>
                                  <span className='text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-0.5 block'>
                                    {link.type} · {link.sector || 'General'}
                                  </span>
                                </div>
                                <input
                                  type='checkbox'
                                  className='accent-brand-orange w-4 h-4'
                                  checked={selectedCAHLinkIds.includes(link.id)}
                                  onChange={() =>
                                    setSelectedCAHLinkIds(prev =>
                                      prev.includes(link.id)
                                        ? prev.filter(id => id !== link.id)
                                        : [...prev, link.id]
                                    )
                                  }
                                />
                              </label>
                            ))}
                        </div>
                      </div>
                    </FormField>
                  </div>
                </DataPanel>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className='space-y-8'>
            <DataPanel
              title='Build Diagnostics'
              subtitle='Limits, warnings and status.'
              className='shadow-sm border border-stone-200 rounded-none bg-white'
            >
              <div className='p-5 space-y-6'>
                <div>
                  <h4 className='text-[10px] uppercase font-bold text-brand-orange tracking-widest border-b border-orange-100 pb-2 mb-3'>
                    Storefront Readiness Score
                  </h4>
                  <div className='flex items-center gap-4'>
                    <div className='text-2xl font-black text-brand-charcoal'>
                      {readinessScore}%
                    </div>
                    <div className='flex-1 h-2 bg-stone-100 w-full overflow-hidden'>
                      <div
                        className={`h-full ${
                          readinessScore === 100
                            ? 'bg-emerald-500'
                            : readinessScore >= 70
                            ? 'bg-brand-orange'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${readinessScore}%` }}
                      />
                    </div>
                  </div>
                  <p className='text-[10px] text-stone-500 mt-2 font-bold uppercase'>
                    {readinessScore === 100
                      ? 'Ready for deployment'
                      : 'Missing key assets or data'}
                  </p>
                </div>
                <div>
                  <h4 className='text-[10px] uppercase font-bold text-brand-orange tracking-widest border-b border-orange-100 pb-2 mb-3'>
                    Storefront Limits
                  </h4>
                  <ul className='space-y-2 text-xs font-medium text-stone-600'>
                    <li className='flex justify-between'>
                      <span className='text-stone-400 font-bold uppercase text-[10px]'>
                        Max images:
                      </span>
                      <span>
                        {selectedVendorPlan?.maxStorefrontImages ?? 'N/A'}
                      </span>
                    </li>
                    <li className='flex justify-between'>
                      <span className='text-stone-400 font-bold uppercase text-[10px]'>
                        Max deployments / month:
                      </span>
                      <span>
                        {selectedVendorPlan?.maxStorefrontDeploymentsPerMonth ??
                          'N/A'}
                      </span>
                    </li>
                    <li className='flex justify-between'>
                      <span className='text-stone-400 font-bold uppercase text-[10px]'>
                        Current month deployments:
                      </span>
                      <span>{monthlyDeployments}</span>
                    </li>
                    <li className='flex justify-between'>
                      <span className='text-stone-400 font-bold uppercase text-[10px]'>
                        Selected images:
                      </span>
                      <span
                        className={
                          selectedImages.length >
                          (selectedVendorPlan?.maxStorefrontImages || 0)
                            ? 'text-red-500 font-bold'
                            : ''
                        }
                      >
                        {selectedImages.length}
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className='text-[10px] uppercase font-bold text-red-500 tracking-widest border-b border-red-100 pb-2 mb-3'>
                    System Warnings
                  </h4>
                  <ul className='space-y-2 text-xs font-medium'>
                    {planWarnings.length === 0 ? (
                      <li className='text-emerald-600 flex items-center gap-2'>
                        <CheckCircle2 size={14} /> No plan warnings detected.
                      </li>
                    ) : (
                      planWarnings.map((warning, idx) => (
                        <li
                          key={idx}
                          className='text-red-500 flex items-start gap-2 leading-relaxed'
                        >
                          <AlertTriangle
                            size={14}
                            className='shrink-0 mt-0.5'
                          />
                          {warning}
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div>
                  <h4 className='text-[10px] uppercase font-bold text-brand-charcoal tracking-widest border-b border-stone-200 pb-2 mb-3'>
                    Quick Notes
                  </h4>
                  <p className='text-xs font-medium text-stone-500 leading-relaxed bg-stone-50 p-3 border border-stone-100'>
                    Storefronts export as a single offline HTML file with
                    embedded CSS, JS, and WebP images. No React, Firebase or
                    internet connectivity is required.
                  </p>
                </div>
              </div>
            </DataPanel>

            <DataPanel
              title='Storefront Preview & Actions'
              subtitle='Generate, review, download or copy the standalone HTML file.'
              className='shadow-sm border border-stone-200 rounded-none bg-white'
            >
              <div className='p-5 space-y-6'>
                <div className='grid grid-cols-2 lg:grid-cols-3 gap-3'>
                  <SecondaryButton
                    onClick={() => {
                      const newWin = window.open('', '_blank')
                      if (newWin && selectedHtml) {
                        newWin.document.open()
                        newWin.document.write(selectedHtml)
                        newWin.document.close()
                      }
                    }}
                    disabled={!selectedHtml}
                  >
                    <Eye className='w-4 h-4 mr-2' /> Preview
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={() => {
                      if (permissionService.canExport('createStorefront')) {
                        if (selectedHtml) {
                          downloadHtml(selectedHtml, selectedFileName)
                        }
                      } else {
                        alert('Permission denied to export storefronts.')
                      }
                    }}
                    disabled={
                      !selectedHtml ||
                      !permissionService.canExport('createStorefront')
                    }
                  >
                    <Download className='w-4 h-4 mr-2' /> Download HTML
                  </PrimaryButton>
                  <SecondaryButton
                    onClick={() => {
                      if (permissionService.canExport('createStorefront')) {
                        if (selectedHtml) copyHtml(selectedHtml)
                      } else {
                        alert('Permission denied to copy storefront HTML.')
                      }
                    }}
                    disabled={
                      !selectedHtml ||
                      !permissionService.canExport('createStorefront')
                    }
                  >
                    <Copy className='w-4 h-4 mr-2' /> Copy HTML
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() =>
                      generatedStorefront && handleDeploy(generatedStorefront)
                    }
                    disabled={
                      !generatedStorefront ||
                      generatedStorefront.status === 'deployed' ||
                      !permissionService.canApprove('createStorefront')
                    }
                  >
                    <CheckCircle2 className='w-4 h-4 mr-2' /> Mark Deployed
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={generateHtml}
                    disabled={
                      !selectedVendor ||
                      selectedProducts.length === 0 ||
                      isGenerating ||
                      !permissionService.canCreate('createStorefront')
                    }
                  >
                    <RefreshCcw className='w-4 h-4 mr-2' /> Regenerate
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() =>
                      generatedStorefront && handleArchive(generatedStorefront)
                    }
                    disabled={
                      !generatedStorefront ||
                      generatedStorefront.status === 'archived' ||
                      !permissionService.canDelete('createStorefront')
                    }
                    className='text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                  >
                    <Archive className='w-4 h-4 mr-2' /> Archive
                  </SecondaryButton>
                </div>

                <div className='pt-4 border-t border-stone-100'>
                  <SecondaryButton
                    onClick={() => {
                      setQuickLogData({
                        activityType: 'STOREFRONT_SHARED',
                        storefrontId: generatedStorefront?.id,
                        vendorId: selectedVendor?.id ?? null,
                        vendorName: selectedVendor?.name ?? null,
                        sector: selectedVendor?.sector ?? null,
                        leadStatus: 'NOT_APPLICABLE',
                        priority: 'MEDIUM'
                      })
                      setIsQuickLogOpen(true)
                    }}
                    disabled={!generatedStorefront}
                    className='w-full'
                  >
                    <MessageSquare className='w-4 h-4 mr-2' /> Log WhatsApp
                    Share
                  </SecondaryButton>
                </div>
                <div className='pt-4 border-t border-stone-100 space-y-3'>
                  <p className='text-[9px] uppercase font-bold tracking-widest text-stone-400'>
                    Metadata Stream
                  </p>
                  <div className='grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-medium text-stone-600'>
                    <span className='truncate'>
                      Vendor: {selectedVendor?.name || 'N/A'}
                    </span>
                    <span className='flex items-center gap-1'>
                      Status:{' '}
                      <StatusBadge
                        status={generatedStorefront?.status || 'draft'}
                        variant={
                          generatedStorefront?.status === 'deployed'
                            ? 'success'
                            : 'neutral'
                        }
                      />
                    </span>
                    <span>
                      Size:{' '}
                      {selectedHtml
                        ? `${(estimateHtmlSize(selectedHtml) / 1024).toFixed(
                            1
                          )} KB`
                        : 'N/A'}
                    </span>
                    <span>Products: {selectedProducts.length}</span>
                    <span>Images: {selectedImages.length}</span>
                  </div>
                </div>
              </div>
            </DataPanel>
          </div>
        </div>

        {/* Bottom Full-Width Panels */}
        <div className='space-y-8'>
          <DataPanel
            title='Generated Storefront History'
            subtitle='Track generated storefront assets and lifecycle state.'
            className='shadow-sm border border-stone-200 rounded-none bg-white'
          >
            <div className='p-0 overflow-x-auto'>
              {safeStorefronts.length === 0 ? (
                <EmptyState
                  title='No storefronts yet'
                  description='Create a storefront to see history records appear here.'
                />
              ) : (
                <table className='w-full text-left text-sm border-collapse'>
                  <thead>
                    <tr className='bg-stone-50 border-b border-stone-200 text-[9px] font-bold uppercase tracking-widest text-stone-400'>
                      <th className='px-6 py-3'>Storefront</th>
                      <th className='px-6 py-3'>Vendor</th>
                      <th className='px-6 py-3'>Products</th>
                      <th className='px-6 py-3'>Images</th>
                      <th className='px-6 py-3'>Status</th>
                      <th className='px-6 py-3'>Generated</th>
                    </tr>
                  </thead>
                  <tbody className='text-sm font-medium text-stone-600 divide-y divide-stone-100'>
                    {safeStorefronts.map(sf => (
                      <tr
                        key={sf.id}
                        className='hover:bg-stone-50 transition-colors'
                      >
                        <td className='px-6 py-4 font-bold text-brand-charcoal'>
                          {sf.title}
                        </td>
                        <td className='px-6 py-4'>{sf.vendorName}</td>
                        <td className='px-6 py-4 font-mono'>
                          {sf.productCount}
                        </td>
                        <td className='px-6 py-4 font-mono'>{sf.imageCount}</td>
                        <td className='px-6 py-4'>
                          <StatusBadge
                            status={sf.status}
                            variant={
                              sf.status === 'deployed'
                                ? 'success'
                                : sf.status === 'archived'
                                ? 'error'
                                : 'warning'
                            }
                          />
                        </td>
                        <td className='px-6 py-4 font-mono'>
                          {new Date(sf.generatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </DataPanel>

          <DataPanel
            title='Storefront HTML Preview'
            subtitle='Review the generated offline HTML content before download.'
            className='shadow-sm border border-stone-200 rounded-none bg-white'
          >
            <div className='p-6 bg-stone-50 border-t border-stone-100'>
              {selectedHtml ? (
                <iframe
                  title='Storefront HTML preview'
                  srcDoc={selectedHtml}
                  className='h-[720px] w-full border border-stone-200 bg-white'
                  sandbox='allow-scripts allow-popups allow-forms allow-same-origin'
                />
              ) : (
                <div className='flex min-h-[240px] items-center justify-center border border-dashed border-stone-200 bg-white p-6 text-center text-xs font-bold uppercase text-stone-400'>
                  No storefront HTML generated yet.
                </div>
              )}
            </div>
          </DataPanel>
        </div>
      </div>

      <WhatsAppActivityQuickLog
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        initialData={quickLogData}
      />
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
    </div>
  )
}
