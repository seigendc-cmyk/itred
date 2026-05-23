/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  PageHeader,
  DataPanel,
  TablePanel,
  ConfirmDialog,
  FormSection,
  FormField,
  BrandedAlertModal,
  PrimaryButton,
  SecondaryButton
} from '../components/CommonUI.tsx'
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Users,
  ChevronRight,
  DollarSign,
  UserPlus,
  Loader2,
  Activity,
  TrendingUp,
  Download,
  BarChart3
} from 'lucide-react'
import { writeBatch, doc, collection } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { pricingPlanService } from '../services/pricingPlanService.ts'
import { vendorService } from '../services/vendorService.ts'
import { productService } from '../services/productService.ts'
import { permissionService } from '../services/permissionService.ts'
import { analyticsService } from '../services/analyticsService.ts'
import { planEntitlementService } from '../services/planEntitlementService.ts'
import { subscriptionBillingService } from '../services/subscriptionBillingService.ts'
import { subscriptionService } from '../services/subscriptionService.ts'
import { vendorPlanUsageService } from '../services/vendorPlanUsageService.ts'
import { PricingPlan, Vendor, Product } from '../types.ts'
import { asArray } from '../utils/safeData.ts'
import { staffAuditService } from '../services/staffAuditService.ts'
import { sanitizeForFirestore } from '../utils/firestoreSanitize.ts'
import { getBillableProductsForVendor } from '../utils/planQuotaUtils.ts'
import { calculatePlanAssignmentDates } from '../utils/planDateUtils.ts'
import { masterDataCacheService } from '../services/masterDataCacheService.ts'
import {
  calculateUsage,
  checkLimits,
  canAssignPlan,
  calculateOverage,
  calculateUpgradePressure,
  canUseFeature,
  canGenerateCatalogue,
  calculateBrandedProductUsage,
  getEffectiveBrandedProductLimit
} from '../services/entitlementEngine.ts'
import { StatCard } from '../components/ui/StatCard.tsx'

export const PricingPlans: React.FC = () => {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Partial<PricingPlan> | null>(
    null
  )

  const [viewMode, setViewMode] = useState<
    | 'cards'
    | 'comparison'
    | 'itred_vendors'
    | 'enforcement'
    | 'diagnostics'
    | 'health'
  >('cards')

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [vendorToAssign, setVendorToAssign] = useState<Vendor | null>(null)
  const [targetPlanId, setTargetPlanId] = useState<string>('')
  const [planDeleteId, setPlanDeleteId] = useState<string | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  const [newFeature, setNewFeature] = useState('')

  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)

  // Bulk Migration State
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false)
  const [migrationSourcePlanId, setMigrationSourcePlanId] = useState('')
  const [migrationTargetPlanId, setMigrationTargetPlanId] = useState('')
  const [migrationReason, setMigrationReason] = useState('')
  const [allowMigrationOverride, setAllowMigrationOverride] = useState(false)
  const [migrationOverrideReason, setMigrationOverrideReason] = useState('')
  const [migrationPreview, setMigrationPreview] = useState<any[]>([])
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<any>(null)

  // Diagnostics State
  const [diagVendorId, setDiagVendorId] = useState('')
  const [diagPlanId, setDiagPlanId] = useState('')
  const [diagFeatureKey, setDiagFeatureKey] = useState('enableIDeliver')
  const [diagResults, setDiagResults] = useState<any>(null)
  const [showRawJson, setShowRawJson] = useState(false)

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean
    title?: string
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: 'seiGEN Commerce', message: '', type: 'success' })

  const showBrandedAlert = (config: {
    title?: string
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
  }) => {
    setAlertConfig({ ...config, isOpen: true })
  }

  const safePlans = asArray<PricingPlan>(plans)
  const safeVendors = asArray<Vendor>(vendors)
  const safeProducts = asArray<Product>(products)

  const underlineInputClass =
    'w-full bg-stone-50 border-0 border-b-2 border-stone-300 focus:border-brand-orange focus:ring-0 outline-none rounded-none px-4 py-3 text-sm font-bold text-brand-charcoal transition-colors'

  const loadData = async () => {
    setIsLoadingData(true)
    const startMs = performance.now()
    try {
      const [rawPlans, rawVendors, rawProducts] = await Promise.all([
        pricingPlanService.getPlans(),
        vendorService.getVendors(),
        productService.getProducts()
      ])

      setPlans(asArray<PricingPlan>(rawPlans))
      setVendors(asArray<Vendor>(rawVendors))
      setProducts(asArray<Product>(rawProducts))
    } catch (error) {
      console.warn(
        'Pricing Plans data failed to load. Using empty arrays.',
        error
      )
      setPlans([])
      setVendors([])
      setProducts([])
    } finally {
      setIsLoadingData(false)
      console.info('Data load completed', {
        page: 'PricingPlans',
        elapsedMs: Math.round(performance.now() - startMs)
      })
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const vendorsByPlan = useMemo(() => {
    const map: Record<string, Vendor[]> = {}

    safeVendors.forEach(vendor => {
      const planId = vendor.planId || 'unassigned'

      if (!map[planId]) {
        map[planId] = []
      }

      map[planId].push(vendor)
    })

    return map
  }, [safeVendors])

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingPlan?.name) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Plan name is required.',
        type: 'error'
      })
      return
    }

    setIsSavingPlan(true)

    try {
      const oldPlan = safePlans.find(p => p.id === editingPlan.id)
      const planToSave = sanitizeForFirestore({
        ...editingPlan,
        id: editingPlan.id || `plan-${Date.now()}`,
        status: editingPlan.status || 'active',
        monthlyPrice: Number(editingPlan.monthlyPrice) || 0,
        currency: editingPlan.currency || 'USD',
        maxProducts: Number(editingPlan.maxProducts) || 0,
        enableBrandedProducts: !!editingPlan.enableBrandedProducts,
        brandedProductsIncluded:
          String(editingPlan.brandedProductsIncluded).toLowerCase() ===
          'unlimited'
            ? 'unlimited'
            : Number(editingPlan.brandedProductsIncluded) || 0,
        brandedProductAddOnEnabled:
          editingPlan.brandedProductAddOnEnabled !== false,
        brandedProductAddOnPrice:
          Number(editingPlan.brandedProductAddOnPrice) || 0,
        brandedProductAddOnQuantity:
          Number(editingPlan.brandedProductAddOnQuantity) || 0,
        maxBrandedProducts:
          String(editingPlan.maxBrandedProducts).toLowerCase() === 'unlimited'
            ? 'unlimited'
            : Number(editingPlan.maxBrandedProducts) || 0,
        maxVendorsPerCatalogue: Number(editingPlan.maxVendorsPerCatalogue) || 1,
        maxImagesPerCatalogue: Number(editingPlan.maxImagesPerCatalogue) || 0,
        maxImagesPerProduct: Number(editingPlan.maxImagesPerProduct) || 1,
        maxImagesPerListing: Number(editingPlan.maxImagesPerListing) || 1,
        deploymentFrequency: editingPlan.deploymentFrequency || 'monthly',
        maxDeploymentsPerMonth: Number(editingPlan.maxDeploymentsPerMonth) || 0,
        maxCahLinks: Number(editingPlan.maxCahLinks) || 0,
        maxBranchesPerVendor: Number(editingPlan.maxBranchesPerVendor) || 1,
        maxStaffPerVendor: Number(editingPlan.maxStaffPerVendor) || 1,
        maxDeliveryContactsPerVendor:
          Number(editingPlan.maxDeliveryContactsPerVendor) || 1,
        maxNoticesPerMonth: Number(editingPlan.maxNoticesPerMonth) || 0,
        enableIDeliver: editingPlan.enableIDeliver !== false,
        maxDeliveryProviders:
          Number(editingPlan.maxDeliveryProviders) ||
          Number(editingPlan.maxDeliveryContactsPerVendor) ||
          1,
        allowVerifiedDeliveryProvider:
          editingPlan.allowVerifiedDeliveryProvider !== false,
        isWhatsAppProductButtonEnabled:
          !!editingPlan.isWhatsAppProductButtonEnabled,
        isDirectCallProductButtonEnabled:
          !!editingPlan.isDirectCallProductButtonEnabled,
        isVendorWhatsAppGroupLinkEnabled:
          !!editingPlan.isVendorWhatsAppGroupLinkEnabled,
        isVendorWhatsAppChannelLinkEnabled:
          !!editingPlan.isVendorWhatsAppChannelLinkEnabled,
        isInventorySpotCheckIncluded:
          !!editingPlan.isInventorySpotCheckIncluded,
        inventorySpotChecksPerMonth:
          Number(editingPlan.inventorySpotChecksPerMonth) || 0,
        biAnalyticsLevel: editingPlan.biAnalyticsLevel || 'none',
        rpnSupportLevel: editingPlan.rpnSupportLevel || 'none',
        isCollectionReminderEnabled: !!editingPlan.isCollectionReminderEnabled,
        isHostedCatalogueSupportEnabled:
          !!editingPlan.isHostedCatalogueSupportEnabled,
        isVendorStorefrontBuilderEnabled:
          !!editingPlan.isVendorStorefrontBuilderEnabled,
        enableStorefrontCart: !!editingPlan.enableStorefrontCart,
        enableWhatsappOrders: !!editingPlan.enableWhatsappOrders,
        maxStorefrontImages: Number(editingPlan.maxStorefrontImages) || 0,
        maxStorefrontDeploymentsPerMonth:
          Number(editingPlan.maxStorefrontDeploymentsPerMonth) || 0,
        features: Array.from(
          new Set([
            ...asArray<string>(editingPlan.features),
            'iDeliver / Verified Delivery Provider'
          ])
        ),
        createdBy: editingPlan.createdBy || 'Admin',
        updatedBy: 'Admin',
        createdAt: editingPlan.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }) as PricingPlan

      await pricingPlanService.savePlan(planToSave)

      analyticsService.logEvent({
        eventType: editingPlan.id ? 'PLAN_UPDATED' : 'PLAN_CREATED',
        actorType: 'admin',
        actorName: 'System Admin',
        details: {
          planId: planToSave.id,
          name: planToSave.name,
          price: planToSave.monthlyPrice
        }
      })

      // Non-blocking staff audit logging
      try {
        if (oldPlan) {
          void staffAuditService.logUpdate(
            'pricing',
            'pricing_plan',
            planToSave.id,
            planToSave.name,
            oldPlan,
            planToSave
          )
          if (oldPlan.monthlyPrice !== planToSave.monthlyPrice) {
            void staffAuditService.logAction(
              sanitizeForFirestore({
                eventType: 'PRICE_CHANGED',
                module: 'pricing',
                action: `Plan price changed for ${planToSave.name}`,
                severity: 'critical',
                recordType: 'pricing_plan',
                recordId: planToSave.id,
                recordName: planToSave.name,
                beforeSnapshot: null,
                afterSnapshot: null,
                reason: null,
                notes: null,
                generatedBy: null,
                overrideReason: null
              })
            )
          }
        } else {
          void staffAuditService.logCreate(
            'pricing',
            'pricing_plan',
            planToSave.id,
            planToSave.name,
            planToSave
          )
        }
      } catch (auditErr) {
        console.error('Audit log failed', auditErr)
      }

      await loadData()
      setIsFormOpen(false)
      setEditingPlan(null)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Pricing plan saved successfully.',
        type: 'success'
      })
    } catch (error: any) {
      console.error('Pricing plan save failed', error)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message:
          error.message ||
          'Pricing plan was not saved. Check Firebase permissions or network.',
        type: 'error'
      })
    } finally {
      setIsSavingPlan(false)
    }
  }

  const handleDeletePlan = async (id: string) => {
    if ((vendorsByPlan[id] || []).length > 0) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message:
          'Cannot delete plan with active subscribers. Reassign vendors first.',
        type: 'error'
      })
      return
    }

    try {
      const plan = safePlans.find(p => p.id === id)

      await pricingPlanService.deletePlan(id)

      analyticsService.logEvent({
        eventType: 'PLAN_UPDATED',
        actorType: 'admin',
        actorName: 'System Admin',
        details: {
          action: 'deleted',
          planId: id,
          name: plan?.name
        }
      })

      await loadData()
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Deleted successfully.',
        type: 'success'
      })

      // Non-blocking staff audit logging
      try {
        void staffAuditService.logDelete(
          'pricing',
          'pricing_plan',
          id,
          plan?.name || 'Unknown'
        )
      } catch (e) {
        console.error('Audit log failed', e)
      }
    } catch (error: any) {
      console.error(error)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: error.message || 'Delete failed',
        type: 'error'
      })
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      const plan = safePlans.find(p => p.id === id)

      await pricingPlanService.updateStatus(id, newStatus as any)

      analyticsService.logEvent({
        eventType: 'PLAN_UPDATED',
        actorType: 'admin',
        actorName: 'System Admin',
        details: {
          planId: id,
          name: plan?.name,
          status: newStatus
        }
      })

      await loadData()
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Saved successfully.',
        type: 'success'
      })

      // Non-blocking staff audit logging
      try {
        void staffAuditService.logAction(
          sanitizeForFirestore({
            eventType: 'RECORD_UPDATED',
            module: 'pricing',
            action: `Plan status changed to ${newStatus} for ${plan?.name}`,
            severity: 'critical',
            recordType: 'pricing_plan',
            recordId: id,
            recordName: plan?.name,
            beforeSnapshot: null,
            afterSnapshot: null,
            reason: null,
            notes: null,
            generatedBy: null,
            overrideReason: null
          })
        )
      } catch (e) {
        console.error('Audit log failed', e)
      }
    } catch (error: any) {
      console.error(error)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: error.message || 'Save failed',
        type: 'error'
      })
    }
  }

  const handleAssignPlan = async () => {
    if (!vendorToAssign || !targetPlanId) return

    try {
      const targetPlan = safePlans.find(plan => plan.id === targetPlanId)
      if (!targetPlan) throw new Error('Target pricing plan not found.')

      const usage = getUsage(vendorToAssign.id)
      const adminCanOverride =
        permissionService.canEdit('pricing') ||
        permissionService.canApprove('pricing')

      const entitlementResult = canAssignPlan({
        vendorId: vendorToAssign.id,
        targetPlan,
        usage,
        allowOverride: adminCanOverride
      })

      if (!entitlementResult.allowed) {
        showBrandedAlert({
          title: 'Downgrade Blocked',
          message: `This vendor exceeds the target plan: ${entitlementResult.reasons
            .map((r: any) => r.message)
            .join('; ')}.`,
          type: 'warning'
        })
        return
      }

      let overrideUsed = false
      if (entitlementResult.reasons.length > 0) {
        if (!overrideReason.trim()) {
          showBrandedAlert({
            title: 'Override Reason Required',
            message:
              'An override reason is required when downgrading a vendor with active violations.',
            type: 'warning'
          })
          return
        }
        overrideUsed = true
      }

      const issuesMsg = entitlementResult.reasons.map((r: any) => r.message)

      const planDates = calculatePlanAssignmentDates({
        trialDays: targetPlan.trialDays,
        billingCycle: 'monthly'
      })

      const subscription = await subscriptionBillingService.assignPlanToVendor(
        vendorToAssign.id,
        targetPlanId,
        sanitizeForFirestore({
          overrideReason: overrideUsed ? overrideReason.trim() : null,
          beforeSnapshot: null,
          afterSnapshot: null,
          reason: null,
          notes: null,
          generatedBy: null,
          assignedAt: planDates.assignedAtIso,
          trialStartAt: planDates.trialStartAtIso,
          trialEndsAt: planDates.trialEndsAtIso,
          billingStartsAt: planDates.billingStartsAtIso,
          nextDueAt: planDates.nextDueAtIso,
          timezone: planDates.timezone,
          billingCycle: planDates.billingCycle,
          trialDays: planDates.trialDays
        })
      )

      await planEntitlementService.getVendorEntitlementSnapshot(
        vendorToAssign.id
      )
      if (typeof (planEntitlementService as any).clearCache === 'function') {
        ;(planEntitlementService as any).clearCache(vendorToAssign.id)
      }
      if (
        typeof (planEntitlementService as any).clearVendorCache === 'function'
      ) {
        ;(planEntitlementService as any).clearVendorCache(vendorToAssign.id)
      }
      if (
        typeof (subscriptionBillingService as any).clearCache === 'function'
      ) {
        ;(subscriptionBillingService as any).clearCache(vendorToAssign.id)
      }
      void masterDataCacheService.invalidateVendor(vendorToAssign.id)
      void masterDataCacheService.invalidate('subscriptions')

      analyticsService.logEvent({
        eventType: 'PLAN_ASSIGNED_TO_VENDOR',
        actorType: 'admin',
        actorName: 'System Admin',
        vendorId: vendorToAssign.id,
        vendorName: vendorToAssign.name,
        details: {
          planId: targetPlanId,
          subscriptionId: subscription.id,
          dueDate: subscription.dueDate,
          overrideIssues: issuesMsg
        }
      })

      try {
        void staffAuditService.logAction(
          sanitizeForFirestore({
            eventType: 'SUBSCRIPTION_CHANGED',
            module: 'pricing',
            action: `Assigned plan ${targetPlan.name} to ${vendorToAssign.name}`,
            severity: 'high',
            recordType: 'subscription',
            recordId: subscription.id || vendorToAssign.id,
            recordName: vendorToAssign.name,
            beforeSnapshot: null,
            afterSnapshot: {
              previousPlanId: vendorToAssign.planId || null,
              newPlanId: targetPlan.id,
              assignedAt: planDates.assignedAtIso,
              nextDueAt: planDates.nextDueAtIso,
              trialEndsAt: planDates.trialEndsAtIso,
              timezone: planDates.timezone
            },
            reason: null,
            notes: null,
            generatedBy: null,
            overrideReason: null
          })
        )
      } catch (e) {
        console.error('Audit log failed', e)
      }

      await loadData()
      setIsAssignModalOpen(false)
      setVendorToAssign(null)
      setTargetPlanId('')
      setOverrideReason('')
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Saved successfully.',
        type: 'success'
      })
    } catch (error: any) {
      console.error(error)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: error.message || 'Save failed',
        type: 'error'
      })
    }
  }

  const getUsage = (vendorId: string) => {
    const allVendorProducts = safeProducts.filter(p => p.vendorId === vendorId)
    const vendor = safeVendors.find(v => v.id === vendorId)
    const branches = asArray((vendor as any)?.branches).length
    const staff = asArray((vendor as any)?.staff).length
    const deliveryContacts = asArray((vendor as any)?.deliveryStaff).length
    const ledger = vendorPlanUsageService.getLedger(vendorId)
    const monthKey = new Date().toISOString().slice(0, 7)
    const countMonth = (usageType: string) =>
      ledger
        .filter(
          entry => entry.usageType === usageType && entry.monthKey === monthKey
        )
        .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)

    const baseUsage = calculateUsage({
      vendorId,
      products: allVendorProducts,
      branches: Array(branches).fill({}),
      staff: Array(staff).fill({}),
      deliveryServices: Array(deliveryContacts).fill({}),
      catalogues: Array(countMonth('catalogue_generated')).fill({}),
      notices: Array(countMonth('notice_published')).fill({}),
      images: allVendorProducts.filter(p => p.imageUrl)
    })

    return {
      ...baseUsage,
      storefrontGenerations: countMonth('storefront_generated')
    }
  }

  const runDiagnostics = () => {
    if (!diagVendorId) {
      showBrandedAlert({
        title: 'Diagnostics',
        message: 'Please select a vendor first.',
        type: 'warning'
      })
      return
    }

    const vendor = safeVendors.find(v => v.id === diagVendorId)
    const targetPlanIdToUse = diagPlanId || vendor?.planId
    const targetPlan = safePlans.find(p => p.id === targetPlanIdToUse)

    const usage = getUsage(diagVendorId)

    const limitsCheck = targetPlan
      ? checkLimits({ vendorId: diagVendorId, plan: targetPlan, usage })
      : null
    const assignCheck = targetPlan
      ? canAssignPlan({
          vendorId: diagVendorId,
          targetPlan,
          usage,
          allowOverride: false
        })
      : null
    const overage = targetPlan
      ? calculateOverage({ usage, plan: targetPlan })
      : null
    const pressure = targetPlan
      ? calculateUpgradePressure({
          usage,
          plan: targetPlan,
          overage: overage || undefined,
          availablePlans: safePlans
        })
      : null
    const featureAccess = targetPlan
      ? canUseFeature({ plan: targetPlan, featureKey: diagFeatureKey })
      : null
    const catalogueGenerationCheck = targetPlan
      ? canGenerateCatalogue({
          vendorId: diagVendorId,
          plan: targetPlan,
          selectedProductCount: usage.products,
          selectedImageCount: usage.images,
          cataloguesThisPeriod: usage.catalogueGenerations,
          allowOverage: true,
          walletBalance: Number(
            (vendor as any)?.creditBalance ||
              (vendor as any)?.walletBalance ||
              0
          )
        })
      : null

    setDiagResults({
      timestamp: new Date().toISOString(),
      vendorId: diagVendorId,
      vendorName: vendor?.name,
      targetPlanId: targetPlan?.id,
      targetPlanName: targetPlan?.name,
      usage,
      limitsCheck,
      assignCheck,
      overage,
      pressure,
      featureAccess,
      catalogueGenerationCheck
    })
  }

  // --- Plan Health Dashboard Logic ---
  const [healthFilters, setHealthFilters] = useState({
    plan: '',
    sector: '',
    city: '',
    pressure: ''
  })

  const planHealthDataRaw = useMemo(() => {
    return safeVendors
      .filter(v => v.status === 'active')
      .map(vendor => {
        const plan = safePlans.find(p => p.id === vendor.planId) || safePlans[0]
        const usage = getUsage(vendor.id)
        const overage = plan
          ? calculateOverage({ usage, plan })
          : {
              productsOver: 0,
              imagesOver: 0,
              cataloguesOver: 0,
              estimatedCharge: 0,
              currency: 'USD',
              requiresWallet: false,
              overageNotes: [] as string[]
            }
        const pressure = plan
          ? calculateUpgradePressure({
              usage,
              plan,
              overage,
              availablePlans: safePlans
            })
          : { score: 0, label: 'Healthy', reasons: [] as string[] }

        return { vendor, plan, usage, overage, pressure }
      })
  }, [safeVendors, safePlans, safeProducts]) // getUsage is omitted from deps intentionally

  const filteredHealthData = useMemo(() => {
    return planHealthDataRaw.filter(d => {
      if (healthFilters.plan && d.plan?.id !== healthFilters.plan) return false
      if (healthFilters.sector && d.vendor.sector !== healthFilters.sector)
        return false
      if (healthFilters.city && d.vendor.cityTown !== healthFilters.city)
        return false
      if (healthFilters.pressure && d.pressure.label !== healthFilters.pressure)
        return false
      return true
    })
  }, [planHealthDataRaw, healthFilters])

  const healthSummary = useMemo(() => {
    let nearLimit = 0,
      usingOverage = 0,
      upgradeRec = 0,
      blocked = 0,
      churnRisk = 0
    let prodUtilSum = 0,
      catUtilSum = 0,
      overageRev = 0

    filteredHealthData.forEach(d => {
      if (d.pressure.label === 'Near Limit') nearLimit++
      if (d.pressure.label === 'Using Overage') usingOverage++
      if (d.pressure.label === 'Upgrade Recommended') upgradeRec++
      if (d.pressure.label === 'Blocked Without Override') blocked++
      if (d.vendor.churnStatus === 'at_risk') churnRisk++

      const prodLimit = Number(d.plan?.maxProducts || 1)
      prodUtilSum += (d.usage.products / prodLimit) * 100

      const catLimit = Number(d.plan?.maxDeploymentsPerMonth || 1)
      catUtilSum += (d.usage.cataloguesThisPeriod / catLimit) * 100

      overageRev += d.overage.estimatedCharge
    })

    const count = filteredHealthData.length || 1
    return {
      total: filteredHealthData.length,
      nearLimit,
      usingOverage,
      upgradeRec,
      blocked,
      churnRisk,
      avgProdUtil: prodUtilSum / count,
      avgCatUtil: catUtilSum / count,
      overageRev
    }
  }, [filteredHealthData])

  const healthPlanRows = useMemo(() => {
    return safePlans
      .map(plan => {
        const planData = filteredHealthData.filter(d => d.plan?.id === plan.id)
        const activeCount = planData.length
        if (activeCount === 0) return null

        let prodUtil = 0,
          catUtil = 0,
          imgUtil = 0,
          near = 0,
          overage = 0,
          upgrade = 0,
          blocked = 0,
          churn = 0
        let rev = activeCount * Number(plan.monthlyPrice || 0)

        planData.forEach(d => {
          prodUtil +=
            (d.usage.products / (Number(d.plan.maxProducts) || 1)) * 100
          catUtil +=
            (d.usage.cataloguesThisPeriod /
              (Number(d.plan.maxDeploymentsPerMonth) || 1)) *
            100
          imgUtil +=
            (d.usage.imagesThisCatalogue /
              (Number(d.plan.maxImagesPerCatalogue) || 1)) *
            100

          if (d.pressure.label === 'Near Limit') near++
          if (d.pressure.label === 'Using Overage') overage++
          if (d.pressure.label === 'Upgrade Recommended') upgrade++
          if (d.pressure.label === 'Blocked Without Override') blocked++
          if (d.vendor.churnStatus === 'at_risk') churn++
          rev += d.overage.estimatedCharge
        })

        return {
          planName: plan.name,
          activeVendors: activeCount,
          avgProdUtil: prodUtil / activeCount,
          avgCatUtil: catUtil / activeCount,
          avgImgUtil: imgUtil / activeCount,
          nearLimit: near,
          usingOverage: overage,
          upgradeRec: upgrade,
          blocked: blocked,
          monthlyRev: rev,
          churnRisk: churn
        }
      })
      .filter(Boolean) as any[]
  }, [safePlans, filteredHealthData])

  const healthSectors = useMemo(() => {
    return Array.from(
      new Set(planHealthDataRaw.map(d => d.vendor.sector).filter(Boolean))
    ).sort()
  }, [planHealthDataRaw])

  const healthCities = useMemo(() => {
    return Array.from(
      new Set(planHealthDataRaw.map(d => d.vendor.cityTown).filter(Boolean))
    ).sort()
  }, [planHealthDataRaw])

  const handleExportHealthCsv = () => {
    const headers = [
      'Plan Name',
      'Active Vendors',
      'Avg Product Usage %',
      'Avg Catalogue Usage %',
      'Avg Image Usage %',
      'Vendors Near Limit',
      'Vendors Using Overage',
      'Upgrade Recommended',
      'Blocked',
      'Monthly Revenue Estimate',
      'Churn Risk'
    ]
    const csvRows = healthPlanRows.map(row => [
      row.planName,
      row.activeVendors,
      row.avgProdUtil.toFixed(1) + '%',
      row.avgCatUtil.toFixed(1) + '%',
      row.avgImgUtil.toFixed(1) + '%',
      row.nearLimit,
      row.usingOverage,
      row.upgradeRec,
      row.blocked,
      row.monthlyRev.toFixed(2),
      row.churnRisk
    ])
    const csvContent = [headers, ...csvRows].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `plan_health_report_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const currentAssignmentPlan = vendorToAssign?.planId
    ? safePlans.find(plan => plan.id === vendorToAssign.planId)
    : undefined
  const targetAssignmentPlan = targetPlanId
    ? safePlans.find(plan => plan.id === targetPlanId)
    : undefined
  const assignmentUsage = vendorToAssign ? getUsage(vendorToAssign.id) : null
  const assignmentIssues =
    vendorToAssign && targetAssignmentPlan && assignmentUsage
      ? canAssignPlan({
          vendorId: vendorToAssign.id,
          targetPlan: targetAssignmentPlan,
          usage: assignmentUsage,
          allowOverride:
            permissionService.canEdit('pricing') ||
            permissionService.canApprove('pricing')
        })
      : { allowed: true, severity: 'ok', reasons: [] as any[] }
  const planDates = targetAssignmentPlan
    ? calculatePlanAssignmentDates({
        trialDays: targetAssignmentPlan.trialDays,
        billingCycle: 'monthly'
      })
    : null
  const assignmentDueDate = planDates
    ? planDates.billingStartsAtIso.slice(0, 10)
    : ''
  const planHealth = safeVendors.map(vendor => {
    const plan = vendor.planId
      ? safePlans.find(item => item.id === vendor.planId)
      : undefined
    const usage = getUsage(vendor.id)
    const limitsResult = plan
      ? checkLimits({ vendorId: vendor.id, plan, usage })
      : {
          allowed: false,
          reasons: [{ message: 'No active pricing plan' }] as any
        }
    return {
      vendor,
      plan,
      usage,
      issues: limitsResult.reasons.map((r: any) => r.message)
    }
  })
  const planUsageRows = safePlans.map(plan => {
    const planVendors = vendorsByPlan[plan.id] || []
    return {
      plan,
      vendorCount: planVendors.length,
      monthlyRevenue: planVendors.length * Number(plan.monthlyPrice || 0),
      violations: planVendors.reduce(
        (sum, vendor) =>
          sum +
          (checkLimits({
            vendorId: vendor.id,
            plan,
            usage: getUsage(vendor.id)
          }).allowed
            ? 0
            : 1),
        0
      )
    }
  })

  const handleOpenMigration = (planId: string) => {
    setMigrationSourcePlanId(planId)
    setMigrationTargetPlanId('')
    setMigrationReason('')
    setAllowMigrationOverride(false)
    setMigrationOverrideReason('')
    setMigrationPreview([])
    setMigrationResult(null)
    setIsMigrationModalOpen(true)
  }

  useEffect(() => {
    if (
      !isMigrationModalOpen ||
      !migrationSourcePlanId ||
      !migrationTargetPlanId
    ) {
      setMigrationPreview([])
      return
    }

    const targetPlan = safePlans.find(p => p.id === migrationTargetPlanId)
    const sourcePlan = safePlans.find(p => p.id === migrationSourcePlanId)
    if (!targetPlan || !sourcePlan) return

    const sourceVendors = safeVendors.filter(
      v => v.planId === migrationSourcePlanId
    )
    const preview = sourceVendors.map(vendor => {
      const usage = getUsage(vendor.id)
      const entitlement = canAssignPlan({
        vendorId: vendor.id,
        targetPlan,
        usage,
        allowOverride: allowMigrationOverride
      })

      let status = 'Safe'
      let willMigrate = true

      if (!entitlement.allowed) {
        status = 'Blocked'
        willMigrate = false
      } else if (entitlement.allowed && entitlement.severity === 'warning') {
        status = 'Override Needed'
        willMigrate = true
      }

      return {
        vendor,
        usage,
        entitlement,
        status,
        willMigrate
      }
    })

    setMigrationPreview(preview)
  }, [
    migrationSourcePlanId,
    migrationTargetPlanId,
    allowMigrationOverride,
    safeVendors,
    safePlans
  ])

  const executeBulkMigration = async () => {
    if (!migrationTargetPlanId || !migrationReason.trim()) {
      showBrandedAlert({
        title: 'Validation',
        message: 'Target plan and migration reason are required.',
        type: 'warning'
      })
      return
    }

    const blockedCount = migrationPreview.filter(
      p => p.status === 'Blocked'
    ).length
    if (
      allowMigrationOverride &&
      !migrationOverrideReason.trim() &&
      migrationPreview.some(p => p.status === 'Override Needed')
    ) {
      showBrandedAlert({
        title: 'Validation',
        message: 'Override reason is required when bypassing plan limits.',
        type: 'warning'
      })
      return
    }

    setIsMigrating(true)
    const sessionStr = localStorage.getItem('activeStaffSession')
    const session = sessionStr ? JSON.parse(sessionStr) : {}
    const staffId = session.staffId || 'Admin'
    const staffName = session.staffName || 'System Admin'

    try {
      const targetPlan = safePlans.find(p => p.id === migrationTargetPlanId)
      const sourcePlan = safePlans.find(p => p.id === migrationSourcePlanId)
      const planDates = calculatePlanAssignmentDates({
        trialDays: targetPlan?.trialDays,
        billingCycle: 'monthly'
      })

      const vendorsToMigrate = migrationPreview.filter(p => p.willMigrate)
      const jobId = `MIG-${Date.now()}`
      const jobRef = doc(collection(db, 'planMigrationJobs'), jobId)

      let successCount = 0
      let failedCount = 0

      const BATCH_LIMIT = 150
      const chunks = []
      for (let i = 0; i < vendorsToMigrate.length; i += BATCH_LIMIT) {
        chunks.push(vendorsToMigrate.slice(i, i + BATCH_LIMIT))
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db)

        for (const item of chunk) {
          try {
            const vendorRef = doc(db, 'vendors', item.vendor.id)
            batch.update(
              vendorRef,
              sanitizeForFirestore({
                planId: migrationTargetPlanId,
                updatedAt: new Date().toISOString(),
                updatedBy: staffId
              })
            )

            const logRef = doc(
              collection(db, 'planMigrationJobs', jobId, 'migratedVendors'),
              item.vendor.id
            )
            batch.set(
              logRef,
              sanitizeForFirestore({
                vendorId: item.vendor.id,
                vendorName: item.vendor.name,
                previousPlanId: migrationSourcePlanId,
                newPlanId: migrationTargetPlanId,
                migratedBy: staffId,
                migratedAt: new Date().toISOString(),
                migrationBatchId: jobId,
                reason: migrationReason.trim(),
                overrideUsed: item.status === 'Override Needed',
                overrideReason:
                  item.status === 'Override Needed'
                    ? migrationOverrideReason.trim()
                    : null,
                entitlementResult: item.entitlement,
                newNextDueAt: planDates.nextDueAtIso
              })
            )

            successCount++
          } catch (err) {
            failedCount++
          }
        }

        await batch.commit()
      }

      const jobBatch = writeBatch(db)
      jobBatch.set(
        jobRef,
        sanitizeForFirestore({
          migrationBatchId: jobId,
          sourcePlanId: migrationSourcePlanId,
          sourcePlanName: sourcePlan?.name || '',
          targetPlanId: migrationTargetPlanId,
          targetPlanName: targetPlan?.name || '',
          totalVendors: migrationPreview.length,
          safeVendorCount: migrationPreview.filter(p => p.status === 'Safe')
            .length,
          blockedVendorCount: blockedCount,
          overrideVendorCount: migrationPreview.filter(
            p => p.status === 'Override Needed'
          ).length,
          status: failedCount > 0 ? 'Partial Success' : 'Completed',
          reason: migrationReason.trim(),
          overrideUsed: allowMigrationOverride,
          overrideReason: allowMigrationOverride
            ? migrationOverrideReason.trim()
            : null,
          startedBy: staffId,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          failedCount,
          successCount
        })
      )
      await jobBatch.commit()

      analyticsService.logEvent({
        eventType: 'SYSTEM_SETTING_CHANGED',
        actorType: 'admin',
        actorName: staffName,
        details: { action: 'bulk_migration', jobId, successCount, failedCount }
      })

      setMigrationResult({
        successCount,
        failedCount,
        total: vendorsToMigrate.length,
        jobId
      })
      await loadData()
    } catch (error: any) {
      console.error('Migration failed:', error)
      showBrandedAlert({
        title: 'Migration Failed',
        message: error.message,
        type: 'error'
      })
    } finally {
      setIsMigrating(false)
    }
  }

  const handleAddFeature = () => {
    if (!newFeature.trim()) return

    setEditingPlan(prev => ({
      ...prev,
      features: [...asArray<string>(prev?.features), newFeature.trim()]
    }))

    setNewFeature('')
  }

  const removeFeature = (idx: number) => {
    setEditingPlan(prev => ({
      ...prev,
      features: asArray<string>(prev?.features).filter((_, i) => i !== idx)
    }))
  }

  return (
    <div className='pb-20' id='pricing-header' tabIndex={-1}>
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
      <div className='flex justify-between items-center mb-8'>
        <PageHeader
          title='Pricing'
          subtitle='Manage vendor tiers and resource limits.'
        />

        {permissionService.canEdit('pricing') && (
          <div className='flex gap-4'>
            <div className='flex bg-stone-100 p-1 rounded'>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'cards' ? 'bg-white shadow-sm' : 'text-stone-400'
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('comparison')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'comparison'
                    ? 'bg-white shadow-sm'
                    : 'text-stone-400'
                }`}
              >
                Plan Matrix
              </button>
              <button
                onClick={() => setViewMode('itred_vendors')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'itred_vendors'
                    ? 'bg-white shadow-sm'
                    : 'text-stone-400'
                }`}
              >
                Vendors
              </button>
              <button
                onClick={() => setViewMode('enforcement')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'enforcement'
                    ? 'bg-white shadow-sm'
                    : 'text-stone-400'
                }`}
              >
                Plan Enforcement
              </button>
              <button
                onClick={() => setViewMode('diagnostics')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'diagnostics'
                    ? 'bg-white shadow-sm'
                    : 'text-stone-400'
                }`}
              >
                Diagnostics
              </button>
              <button
                onClick={() => setViewMode('health')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'health'
                    ? 'bg-white shadow-sm'
                    : 'text-stone-400'
                }`}
              >
                Plan Health
              </button>
            </div>

            <button
              onClick={() => {
                setEditingPlan({})
                setIsFormOpen(true)
              }}
              className='btn btn-primary flex items-center gap-2'
            >
              <Plus size={16} /> New Plan
            </button>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className='fixed inset-0 bg-brand-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
          <div className='bg-white w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl border-4 border-brand-charcoal'>
            <div className='p-8 border-b border-stone-100 flex justify-between items-center sticky top-0 bg-white z-10'>
              <h2 className='text-sm uppercase font-bold tracking-[0.4em]'>
                {editingPlan?.id
                  ? 'Edit Plan Definition'
                  : 'Draft New Pricing Tier'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className='text-stone-400 hover:text-brand-charcoal'
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className='p-10 space-y-12'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-12'>
                <FormSection title='General Information'>
                  <FormField label='Plan Name' required>
                    <input
                      type='text'
                      value={editingPlan?.name || ''}
                      onChange={e =>
                        setEditingPlan({ ...editingPlan, name: e.target.value })
                      }
                      className={underlineInputClass}
                      placeholder='e.g. Enterprise Plus'
                    />
                  </FormField>

                  <div className='grid grid-cols-2 gap-6'>
                    <FormField label='Price'>
                      <div className='relative'>
                        <DollarSign
                          size={14}
                          className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400'
                        />
                        <input
                          type='number'
                          value={editingPlan?.monthlyPrice ?? ''}
                          onChange={e =>
                            setEditingPlan({
                              ...editingPlan,
                              monthlyPrice: Number(e.target.value)
                            })
                          }
                          className={`${underlineInputClass} pl-10`}
                        />
                      </div>
                    </FormField>

                    <FormField label='Currency'>
                      <select
                        value={editingPlan?.currency || 'USD'}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            currency: e.target.value
                          })
                        }
                        className={underlineInputClass}
                      >
                        <option value='USD'>USD</option>
                        <option value='ZAR'>ZAR</option>
                        <option value='EUR'>EUR</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label='Trial Period (Days)'>
                    <input
                      type='number'
                      value={editingPlan?.trialDays ?? 0}
                      onChange={e =>
                        setEditingPlan({
                          ...editingPlan,
                          trialDays: Number(e.target.value)
                        })
                      }
                      className={underlineInputClass}
                    />
                  </FormField>
                </FormSection>

                <FormSection title='Storefront Features'>
                  <div className='grid grid-cols-2 gap-6'>
                    <FormField label='Max Products'>
                      <input
                        type='number'
                        value={editingPlan?.maxProducts ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxProducts: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Max Images / Cat'>
                      <input
                        type='number'
                        value={editingPlan?.maxImagesPerCatalogue ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxImagesPerCatalogue: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Max Images / Product'>
                      <input
                        type='number'
                        value={editingPlan?.maxImagesPerProduct ?? 1}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxImagesPerProduct: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Max Images / Listing'>
                      <input
                        type='number'
                        value={editingPlan?.maxImagesPerListing ?? 1}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxImagesPerListing: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Branded Included'>
                      <input
                        value={editingPlan?.brandedProductsIncluded ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            brandedProductsIncluded:
                              e.target.value.toLowerCase() === 'unlimited'
                                ? 'unlimited'
                                : Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                        placeholder='0 or unlimited'
                      />
                    </FormField>

                    <FormField label='Max Branded'>
                      <input
                        value={editingPlan?.maxBrandedProducts ?? 'unlimited'}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxBrandedProducts:
                              e.target.value.toLowerCase() === 'unlimited'
                                ? 'unlimited'
                                : Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                        placeholder='unlimited'
                      />
                    </FormField>

                    <FormField label='Vendors / Cat'>
                      <input
                        type='number'
                        value={editingPlan?.maxVendorsPerCatalogue ?? 1}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxVendorsPerCatalogue: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Storefront Images'>
                      <input
                        type='number'
                        value={editingPlan?.maxStorefrontImages ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxStorefrontImages: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Gens / Month'>
                      <input
                        type='number'
                        value={editingPlan?.maxDeploymentsPerMonth ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxDeploymentsPerMonth: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Expiry Period (Days)'>
                      <input
                        type='number'
                        value={editingPlan?.storefrontExpiryPeriodDays ?? ''}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            storefrontExpiryPeriodDays: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                  </div>

                  <div className='mt-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
                    <FeatureToggle
                      label='Enable Branded Products'
                      active={!!editingPlan?.enableBrandedProducts}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          enableBrandedProducts:
                            !editingPlan?.enableBrandedProducts
                        })
                      }
                    />
                    <FeatureToggle
                      label='Allow Branded Add-on'
                      active={editingPlan?.brandedProductAddOnEnabled !== false}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          brandedProductAddOnEnabled:
                            editingPlan?.brandedProductAddOnEnabled === false
                        })
                      }
                    />
                    <FormField label='Add-on Quantity'>
                      <input
                        type='number'
                        value={editingPlan?.brandedProductAddOnQuantity ?? 50}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            brandedProductAddOnQuantity: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                    <FormField label='Add-on Monthly Price'>
                      <input
                        type='number'
                        value={editingPlan?.brandedProductAddOnPrice ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            brandedProductAddOnPrice: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                  </div>
                </FormSection>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-12'>
                <FormSection title='Staff & Branches'>
                  <div className='grid grid-cols-3 gap-6'>
                    <FormField label='Branches'>
                      <input
                        type='number'
                        value={editingPlan?.maxBranchesPerVendor ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxBranchesPerVendor: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Staff'>
                      <input
                        type='number'
                        value={editingPlan?.maxStaffPerVendor ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxStaffPerVendor: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label='Drivers'>
                      <input
                        type='number'
                        value={editingPlan?.maxDeliveryContactsPerVendor ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxDeliveryContactsPerVendor: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                  </div>

                  <FormField label='Max CAH Links'>
                    <input
                      type='number'
                      value={editingPlan?.maxCahLinks ?? 0}
                      onChange={e =>
                        setEditingPlan({
                          ...editingPlan,
                          maxCahLinks: Number(e.target.value)
                        })
                      }
                      className={underlineInputClass}
                    />
                  </FormField>

                  <FormField label='Notices / Month'>
                    <input
                      type='number'
                      value={editingPlan?.maxNoticesPerMonth ?? 0}
                      onChange={e =>
                        setEditingPlan({
                          ...editingPlan,
                          maxNoticesPerMonth: Number(e.target.value)
                        })
                      }
                      className={underlineInputClass}
                    />
                  </FormField>
                </FormSection>

                <FormSection title='iDeliver'>
                  <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                    <FeatureToggle
                      label='iDeliver Enabled'
                      active={editingPlan?.enableIDeliver !== false}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          enableIDeliver: editingPlan?.enableIDeliver === false
                        })
                      }
                    />
                    <FeatureToggle
                      label='Verified Provider'
                      active={
                        editingPlan?.allowVerifiedDeliveryProvider !== false
                      }
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          allowVerifiedDeliveryProvider:
                            editingPlan?.allowVerifiedDeliveryProvider === false
                        })
                      }
                    />
                    <FormField label='Max Delivery Providers'>
                      <input
                        type='number'
                        min={0}
                        value={editingPlan?.maxDeliveryProviders ?? 1}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxDeliveryProviders: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title='Update Frequency'>
                  <div className='grid grid-cols-2 gap-6'>
                    <FormField label='Frequency'>
                      <select
                        value={editingPlan?.deploymentFrequency || 'monthly'}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            deploymentFrequency: e.target.value as any
                          })
                        }
                        className={underlineInputClass}
                      >
                        <option value='weekly'>Weekly</option>
                        <option value='bi-weekly'>Bi-Weekly</option>
                        <option value='monthly'>Monthly</option>
                        <option value='custom'>Custom</option>
                      </select>
                    </FormField>

                    <FormField label='Max Deployments / Mo'>
                      <input
                        type='number'
                        value={editingPlan?.maxDeploymentsPerMonth ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            maxDeploymentsPerMonth: Number(e.target.value)
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title='Support & Analytics'>
                  <div className='grid grid-cols-2 gap-6'>
                    <FormField label='BI Analytics Level'>
                      <select
                        value={editingPlan?.biAnalyticsLevel || 'none'}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            biAnalyticsLevel: e.target.value as any
                          })
                        }
                        className={underlineInputClass}
                      >
                        <option value='none'>None</option>
                        <option value='basic'>Basic</option>
                        <option value='standard'>Standard</option>
                        <option value='advanced'>Advanced</option>
                      </select>
                    </FormField>

                    <FormField label='RPN Support Level'>
                      <select
                        value={editingPlan?.rpnSupportLevel || 'none'}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            rpnSupportLevel: e.target.value as any
                          })
                        }
                        className={underlineInputClass}
                      >
                        <option value='none'>None</option>
                        <option value='basic'>Basic</option>
                        <option value='standard'>Standard</option>
                        <option value='priority'>Priority</option>
                      </select>
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title='Inventory Control'>
                  <div className='grid grid-cols-2 gap-6'>
                    <FeatureToggle
                      label='Spot Checks Included'
                      active={!!editingPlan?.isInventorySpotCheckIncluded}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isInventorySpotCheckIncluded:
                            !editingPlan?.isInventorySpotCheckIncluded
                        })
                      }
                    />

                    <FormField label='Checks / Month'>
                      <input
                        type='number'
                        disabled={!editingPlan?.isInventorySpotCheckIncluded}
                        value={editingPlan?.inventorySpotChecksPerMonth ?? 0}
                        onChange={e =>
                          setEditingPlan({
                            ...editingPlan,
                            inventorySpotChecksPerMonth: Number(e.target.value)
                          })
                        }
                        className={`${underlineInputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                      />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title='Storefront Customization'>
                  <div className='grid grid-cols-2 gap-6'>
                    <FeatureToggle
                      label='WhatsApp Product Button'
                      active={!!editingPlan?.isWhatsAppProductButtonEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isWhatsAppProductButtonEnabled:
                            !editingPlan?.isWhatsAppProductButtonEnabled
                        })
                      }
                    />

                    <FeatureToggle
                      label='Direct Call Button'
                      active={!!editingPlan?.isDirectCallProductButtonEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isDirectCallProductButtonEnabled:
                            !editingPlan?.isDirectCallProductButtonEnabled
                        })
                      }
                    />

                    <FeatureToggle
                      label='WA Group Links'
                      active={!!editingPlan?.isVendorWhatsAppGroupLinkEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorWhatsAppGroupLinkEnabled:
                            !editingPlan?.isVendorWhatsAppGroupLinkEnabled
                        })
                      }
                    />

                    <FeatureToggle
                      label='WA Channel Links'
                      active={!!editingPlan?.isVendorWhatsAppChannelLinkEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorWhatsAppChannelLinkEnabled:
                            !editingPlan?.isVendorWhatsAppChannelLinkEnabled
                        })
                      }
                    />

                    <FeatureToggle
                      label='Vendor Storefront Builder'
                      active={!!editingPlan?.isVendorStorefrontBuilderEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorStorefrontBuilderEnabled:
                            !editingPlan?.isVendorStorefrontBuilderEnabled
                        })
                      }
                    />

                    <FeatureToggle
                      label='Banner/Logo Supported'
                      active={!!editingPlan?.isVendorStorefrontBannerSupported}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorStorefrontBannerSupported:
                            !editingPlan?.isVendorStorefrontBannerSupported
                        })
                      }
                    />

                    <FeatureToggle
                      label='Product Search Enabled'
                      active={!!editingPlan?.isVendorStorefrontSearchSupported}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorStorefrontSearchSupported:
                            !editingPlan?.isVendorStorefrontSearchSupported
                        })
                      }
                    />

                    <FeatureToggle
                      label='Access Hub Links'
                      active={
                        !!editingPlan?.isVendorStorefrontCahLinksSupported
                      }
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorStorefrontCahLinksSupported:
                            !editingPlan?.isVendorStorefrontCahLinksSupported
                        })
                      }
                    />

                    <FeatureToggle
                      label='Storefront Cart'
                      active={!!editingPlan?.enableStorefrontCart}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          enableStorefrontCart:
                            !editingPlan?.enableStorefrontCart
                        })
                      }
                    />

                    <FeatureToggle
                      label='WhatsApp Orders'
                      active={!!editingPlan?.enableWhatsappOrders}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          enableWhatsappOrders:
                            !editingPlan?.enableWhatsappOrders
                        })
                      }
                    />
                  </div>
                </FormSection>

                <FormSection title='Backend Ops'>
                  <div className='grid grid-cols-2 gap-6'>
                    <FeatureToggle
                      label='Collection Reminders'
                      active={!!editingPlan?.isCollectionReminderEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isCollectionReminderEnabled:
                            !editingPlan?.isCollectionReminderEnabled
                        })
                      }
                    />

                    <FeatureToggle
                      label='Hosted Support'
                      active={!!editingPlan?.isHostedCatalogueSupportEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isHostedCatalogueSupportEnabled:
                            !editingPlan?.isHostedCatalogueSupportEnabled
                        })
                      }
                    />
                  </div>
                </FormSection>
              </div>

              <FormSection title='Custom Marketing Features'>
                <div className='space-y-4'>
                  <div className='flex gap-2'>
                    <input
                      type='text'
                      value={newFeature}
                      onChange={e => setNewFeature(e.target.value)}
                      className={`${underlineInputClass} flex-1`}
                      placeholder='Add custom feature...'
                    />
                    <button
                      type='button'
                      onClick={handleAddFeature}
                      className='bg-brand-charcoal text-white px-6 py-3 text-xs font-bold uppercase transition-colors hover:bg-brand-orange'
                    >
                      Add
                    </button>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                    {asArray<string>(editingPlan?.features).map(
                      (feature, i) => (
                        <div
                          key={`${feature}-${i}`}
                          className='flex items-center justify-between p-3 border border-stone-100 bg-stone-50'
                        >
                          <span className='text-[10px] font-bold uppercase'>
                            {feature}
                          </span>
                          <button
                            type='button'
                            onClick={() => removeFeature(i)}
                            className='text-red-400 hover:text-red-600'
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </FormSection>

              <div className='pt-10 flex gap-4'>
                <button
                  type='submit'
                  className='flex-1 btn btn-primary py-5 text-sm'
                  disabled={isSavingPlan}
                >
                  {isSavingPlan ? 'Saving...' : 'Save Pricing Plan'}
                </button>
                <button
                  type='button'
                  onClick={() => setIsFormOpen(false)}
                  className='px-10 py-5 text-xs font-bold uppercase tracking-widest bg-stone-100 hover:bg-stone-200 transition-all'
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'cards' && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
          {safePlans.map(plan => (
            <div
              key={plan.id}
              className={`flex flex-col border-2 ${
                plan.status === 'active'
                  ? 'border-brand-charcoal bg-white'
                  : 'border-stone-200 opacity-60 bg-stone-50'
              }`}
            >
              <div className='p-8 border-b border-stone-100 relative'>
                <div className='absolute top-4 right-4 flex gap-2'>
                  <button
                    onClick={() => {
                      if (permissionService.canEdit('pricing')) {
                        setEditingPlan(plan)
                        setIsFormOpen(true)
                      } else {
                        showBrandedAlert({
                          title: 'seiGEN Commerce',
                          message: 'Permission denied to edit pricing plans.',
                          type: 'error'
                        })
                      }
                    }}
                    className={`p-2 text-stone-400 hover:text-brand-orange transition-all ${
                      !permissionService.canEdit('pricing')
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    onClick={() => {
                      if (permissionService.canDelete('pricing')) {
                        setPlanDeleteId(plan.id)
                      } else {
                        showBrandedAlert({
                          title: 'seiGEN Commerce',
                          message: 'Permission denied to delete pricing plans.',
                          type: 'error'
                        })
                      }
                    }}
                    className={`p-2 text-stone-400 hover:text-red-500 transition-all ${
                      !permissionService.canDelete('pricing')
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <h3 className='text-sm uppercase font-bold tracking-[0.4em] mb-4'>
                  {plan.name}
                </h3>

                <div className='flex items-baseline gap-1'>
                  <span className='text-2xl font-bold tracking-tight'>
                    {plan.currency} {plan.monthlyPrice}
                  </span>
                  <span className='text-[10px] font-bold uppercase text-stone-400'>
                    / Monthly
                  </span>
                </div>
              </div>

              <div className='p-8 space-y-6 flex-1'>
                <div className='grid grid-cols-2 gap-4'>
                  <MiniLimit label='Products' value={plan.maxProducts} />
                  <MiniLimit label='CAH Links' value={plan.maxCahLinks} />
                  <MiniLimit
                    label='Branches'
                    value={plan.maxBranchesPerVendor}
                  />
                  <MiniLimit label='Staff' value={plan.maxStaffPerVendor} />
                </div>

                <div className='space-y-4'>
                  <FeatureItem
                    label='Direct Call'
                    active={!!plan.isDirectCallProductButtonEnabled}
                  />
                  <FeatureItem
                    label='WhatsApp Order'
                    active={!!plan.isWhatsAppProductButtonEnabled}
                  />
                  <FeatureItem
                    label='Social Links'
                    active={
                      !!plan.isVendorWhatsAppGroupLinkEnabled ||
                      !!plan.isVendorWhatsAppChannelLinkEnabled
                    }
                  />
                  <FeatureItem
                    label='Hosted Support'
                    active={!!plan.isHostedCatalogueSupportEnabled}
                  />
                  <FeatureItem
                    label={`Branded Products ${
                      plan.brandedProductsIncluded
                        ? `(${plan.brandedProductsIncluded})`
                        : ''
                    }`}
                    active={!!plan.enableBrandedProducts}
                  />
                  <FeatureItem
                    label={`Branded Add-on ${
                      plan.brandedProductAddOnPrice
                        ? `${plan.currency || 'USD'} ${
                            plan.brandedProductAddOnPrice
                          }/${plan.brandedProductAddOnQuantity || 0}`
                        : ''
                    }`}
                    active={plan.brandedProductAddOnEnabled !== false}
                  />
                  <FeatureItem
                    label={`iDeliver${
                      plan.maxDeliveryProviders
                        ? ` (${plan.maxDeliveryProviders})`
                        : ''
                    }`}
                    active={plan.enableIDeliver !== false}
                  />
                  <FeatureItem
                    label='Verified Delivery Provider'
                    active={plan.allowVerifiedDeliveryProvider !== false}
                  />
                </div>

                <div className='mt-6 pt-6 border-t border-stone-100'>
                  <p className='text-[9px] font-bold uppercase text-stone-400 mb-2'>
                    Live Subscribers
                  </p>
                  <div className='flex items-center gap-2'>
                    <Users size={14} className='text-brand-orange' />
                    <span className='text-xs font-bold leading-none'>
                      {(vendorsByPlan[plan.id] || []).length} Vendors Assigned
                    </span>
                  </div>
                </div>
              </div>

              <div className='p-4 bg-stone-50 border-t border-stone-100'>
                <button
                  onClick={() => {
                    if (permissionService.canEdit('pricing')) {
                      void handleToggleStatus(plan.id, plan.status)
                    } else {
                      showBrandedAlert({
                        title: 'seiGEN Commerce',
                        message: 'Permission denied to change plan status.',
                        type: 'error'
                      })
                    }
                  }}
                  className={`w-full py-3 text-[9px] font-bold uppercase tracking-widest border border-stone-200 hover:bg-white transition-all ${
                    !permissionService.canEdit('pricing')
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {plan.status === 'active' ? 'Suspend Plan' : 'Activate Plan'}
                </button>
                {permissionService.canEdit('pricing') && (
                  <button
                    onClick={() => handleOpenMigration(plan.id)}
                    className='mt-2 w-full py-3 text-[9px] font-bold uppercase tracking-widest border border-stone-200 hover:bg-brand-charcoal hover:text-white transition-all text-stone-600'
                  >
                    Migrate Subscribers
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              if (permissionService.canCreate('pricing')) {
                setEditingPlan({
                  enableIDeliver: true,
                  enableBrandedProducts: false,
                  brandedProductsIncluded: 0,
                  brandedProductAddOnEnabled: true,
                  brandedProductAddOnPrice: 5,
                  brandedProductAddOnQuantity: 50,
                  maxBrandedProducts: 'unlimited',
                  maxDeliveryProviders: 1,
                  allowVerifiedDeliveryProvider: true,
                  features: ['iDeliver / Verified Delivery Provider']
                })
                setIsFormOpen(true)
              } else {
                showBrandedAlert({
                  title: 'seiGEN Commerce',
                  message: 'Permission denied to create pricing plans.',
                  type: 'error'
                })
              }
            }}
            className={`flex flex-col items-center justify-center p-12 border-2 border-dashed border-stone-200 hover:border-brand-orange hover:bg-orange-50 transition-all text-stone-400 hover:text-brand-orange group ${
              !permissionService.canCreate('pricing')
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            disabled={!permissionService.canCreate('pricing')}
          >
            <Plus
              size={48}
              className='mb-4 stroke-1 group-hover:scale-110 transition-transform'
            />
            <span className='text-xs uppercase font-bold tracking-[0.2em]'>
              Add Pricing Tier
            </span>
          </button>
        </div>
      )}

      {viewMode === 'comparison' && (
        <TablePanel
          title='Plan Matrix'
          subtitle='Direct comparison of all operational limits across tiers.'
          headers={['Feature / Metric', ...safePlans.map(p => p.name)]}
        >
          <ComparisonRow
            label='Monthly Price'
            field='monthlyPrice'
            prefix='$'
            plans={safePlans}
          />
          <ComparisonRow
            label='Max Products'
            field='maxProducts'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='Branded Products Enabled'
            field='enableBrandedProducts'
            plans={safePlans}
          />
          <ComparisonRow
            label='Included Branded Products'
            field='brandedProductsIncluded'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='Branded Add-on Available'
            field='brandedProductAddOnEnabled'
            plans={safePlans}
          />
          <ComparisonRow
            label='Branded Add-on Price'
            field='brandedProductAddOnPrice'
            prefix='$'
            plans={safePlans}
          />
          <ComparisonRow
            label='Branded Add-on Quantity'
            field='brandedProductAddOnQuantity'
            plans={safePlans}
          />
          <ComparisonRow
            label='Max Images / Cat'
            field='maxImagesPerCatalogue'
            plans={safePlans}
          />
          <ComparisonRow
            label='Max Images / Product'
            field='maxImagesPerProduct'
            plans={safePlans}
          />
          <ComparisonRow
            label='Max Images / Listing'
            field='maxImagesPerListing'
            plans={safePlans}
          />
          <ComparisonRow
            label='Freq Type'
            field='deploymentFrequency'
            plans={safePlans}
          />
          <ComparisonRow
            label='Dplys / Month'
            field='maxDeploymentsPerMonth'
            plans={safePlans}
          />
          <ComparisonRow
            label='CAH Links'
            field='maxCahLinks'
            plans={safePlans}
          />
          <ComparisonRow
            label='Max Branches'
            field='maxBranchesPerVendor'
            plans={safePlans}
          />
          <ComparisonRow
            label='Max Staff'
            field='maxStaffPerVendor'
            plans={safePlans}
          />
          <ComparisonRow
            label='Max Drivers'
            field='maxDeliveryContactsPerVendor'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='iDeliver'
            field='enableIDeliver'
            plans={safePlans}
          />
          <ComparisonRow
            label='Max Delivery Providers'
            field='maxDeliveryProviders'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='Verified Delivery'
            field='allowVerifiedDeliveryProvider'
            plans={safePlans}
          />
          <ComparisonRow
            label='BI Level'
            field='biAnalyticsLevel'
            plans={safePlans}
          />
          <ComparisonRow
            label='RPN Support'
            field='rpnSupportLevel'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='WhatsApp Button'
            field='isWhatsAppProductButtonEnabled'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='Direct Call'
            field='isDirectCallProductButtonEnabled'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='WA Join Links'
            field='isVendorWhatsAppGroupLinkEnabled'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='Inventory Check'
            field='isInventorySpotCheckIncluded'
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label='Hosted Support'
            field='isHostedCatalogueSupportEnabled'
            plans={safePlans}
          />
          <ComparisonRow
            label='Trial Period'
            field='trialDays'
            suffix=' Days'
            plans={safePlans}
          />
        </TablePanel>
      )}

      {viewMode === 'itred_vendors' && (
        <div className='space-y-10'>
          {safePlans.map(plan => (
            <DataPanel
              key={plan.id}
              title={`${plan.name} Subscribers`}
              subtitle={`${
                (vendorsByPlan[plan.id] || []).length
              } vendors currently on this plan`}
            >
              {(vendorsByPlan[plan.id] || []).length > 0 ? (
                <div className='p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                  {(vendorsByPlan[plan.id] || []).map(vendor => {
                    const usage = getUsage(vendor.id)
                    const limitsResult = checkLimits({
                      vendorId: vendor.id,
                      plan,
                      usage
                    })
                    const overage = calculateOverage({ usage, plan })
                    const subscription =
                      subscriptionService.getSubscriptionByVendor(vendor.id)
                    const brandedUsed = calculateBrandedProductUsage(
                      vendor.id,
                      safeProducts
                    )
                    const brandedLimit = getEffectiveBrandedProductLimit(
                      plan,
                      subscription
                    )
                    const brandedAddOnActive = asArray<any>(
                      subscription?.addOns
                    ).some(
                      addOn =>
                        addOn.addOnKey === 'branded_products' &&
                        addOn.enabled !== false &&
                        String(addOn.status || 'active').toLowerCase() ===
                          'active'
                    )
                    const pressure = calculateUpgradePressure({
                      usage,
                      plan,
                      overage,
                      availablePlans: safePlans
                    })

                    const creditBalance = Number(
                      (vendor as any).creditBalance ||
                        (vendor as any).walletBalance ||
                        (vendor as any).prepaidAllowance ||
                        (vendor as any).catalogueCreditBalance ||
                        0
                    )

                    return (
                      <div
                        key={vendor.id}
                        className={`p-6 border-2 flex flex-col gap-4 relative group transition-all ${
                          !limitsResult.allowed
                            ? 'border-red-100 bg-red-50/10'
                            : 'border-stone-100 bg-white hover:border-brand-orange'
                        }`}
                      >
                        {!limitsResult.allowed && (
                          <div
                            className='absolute top-2 right-2 text-red-500'
                            title='Plan limits exceeded'
                          >
                            <AlertTriangle size={16} />
                          </div>
                        )}

                        <div className='flex justify-between items-start'>
                          <div>
                            <p className='text-xs font-bold uppercase text-brand-charcoal'>
                              {vendor.name}
                            </p>
                            <p className='text-[9px] text-stone-400 uppercase tracking-wider'>
                              {vendor.tradingName}
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              setVendorToAssign(vendor)
                              setTargetPlanId(vendor.planId || '')
                              setOverrideReason('')
                              setIsAssignModalOpen(true)
                            }}
                            className='p-2 bg-stone-100 text-stone-400 hover:bg-brand-charcoal hover:text-white transition-all rounded shadow-sm'
                            title='Reassign Plan'
                          >
                            <UserPlus size={14} />
                          </button>
                        </div>

                        {/* Resource Usage section */}
                        <div className='space-y-1 mt-2 text-[9px] font-bold uppercase text-stone-600'>
                          <p>
                            Current Plan:{' '}
                            <span className='text-brand-charcoal'>
                              {plan.name}
                            </span>
                          </p>
                          <div className='grid grid-cols-2 gap-2 pt-2 pb-1'>
                            <div>
                              Products: {usage.products}/
                              {plan.maxProducts || '∞'}
                            </div>
                            <div>
                              Images: {usage.imagesThisCatalogue}/
                              {plan.maxImagesPerCatalogue || '∞'}
                            </div>
                            <div>
                              Exports: {usage.cataloguesThisPeriod}/
                              {plan.maxDeploymentsPerMonth || '∞'}
                            </div>
                            <div>
                              Branded: {brandedUsed}/
                              {brandedLimit === 'unlimited'
                                ? '∞'
                                : brandedLimit}
                            </div>
                            <div>
                              Wallet: {plan.currency || 'USD'}{' '}
                              {creditBalance.toFixed(2)}
                            </div>
                          </div>
                          {overage.estimatedCharge > 0 && (
                            <p className='text-amber-700'>
                              Overage this period: {overage.currency}{' '}
                              {overage.estimatedCharge.toFixed(2)}
                            </p>
                          )}
                          <p
                            className={
                              brandedAddOnActive
                                ? 'text-emerald-700'
                                : plan.brandedProductAddOnEnabled !== false
                                ? 'text-amber-700'
                                : 'text-stone-400'
                            }
                          >
                            Branded add-on:{' '}
                            {brandedAddOnActive
                              ? 'active'
                              : plan.brandedProductAddOnEnabled !== false
                              ? `available (${plan.currency || 'USD'} ${
                                  plan.brandedProductAddOnPrice || 0
                                } / ${plan.brandedProductAddOnQuantity || 0})`
                              : 'not available'}
                          </p>
                        </div>

                        <div className='text-[8px] text-stone-400'>
                          Billable active footprint only. <br />
                          Archived, hidden, discontinued and deleted products
                          are not counted.
                        </div>

                        {/* Upgrade Pressure section */}
                        <div
                          className={`p-2 border ${
                            pressure.score >= 80
                              ? 'border-red-200 bg-red-50 text-red-800'
                              : pressure.score >= 40
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          <div className='flex justify-between items-center text-[9px] font-black uppercase'>
                            <span>Pressure Score: {pressure.score}/100</span>
                            <span>{pressure.label}</span>
                          </div>
                          {pressure.recommendedPlanName && (
                            <p className='text-[8px] font-bold mt-1 text-stone-600'>
                              Suggested Upgrade: {pressure.recommendedPlanName}
                            </p>
                          )}
                        </div>

                        <div className='grid grid-cols-2 gap-2 mt-2'>
                          {limitsResult.reasons.map(
                            (issue: any, idx: number) => (
                              <div
                                key={`${issue.key}-${idx}`}
                                className='flex items-center gap-1.5 text-[9px] font-bold uppercase text-red-500 bg-red-50 px-2 py-1 rounded'
                              >
                                <AlertTriangle size={10} /> {issue.message}
                              </div>
                            )
                          )}

                          {limitsResult.reasons.length === 0 && (
                            <div className='col-span-2 flex items-center gap-1.5 text-[9px] font-bold uppercase text-emerald-500 bg-emerald-50 px-2 py-1 rounded'>
                              <Check size={10} /> Limits Verified
                            </div>
                          )}
                        </div>

                        <div className='pt-4 border-t border-stone-100 flex justify-between items-center'>
                          <p className='text-[9px] font-bold text-stone-400 uppercase'>
                            Usage Score
                          </p>
                          <ChevronRight
                            size={14}
                            className='text-stone-300 group-hover:text-brand-orange transition-all'
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className='p-12 text-center italic text-stone-400 text-xs py-20 font-bold uppercase tracking-widest'>
                  No active subscribers for Tier: {plan.name}
                </div>
              )}
            </DataPanel>
          ))}
        </div>
      )}

      {viewMode === 'enforcement' && (
        <div className='space-y-8'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <DataPanel
              title='No Plan'
              subtitle='Vendors without a pricing plan'
            >
              <div className='p-6 text-3xl font-black text-brand-charcoal'>
                {planHealth.filter(row => !row.plan).length}
              </div>
            </DataPanel>
            <DataPanel
              title='Over Limit'
              subtitle='Current resource violations'
            >
              <div className='p-6 text-3xl font-black text-red-600'>
                {
                  planHealth.filter(row => row.plan && row.issues.length > 0)
                    .length
                }
              </div>
            </DataPanel>
            <DataPanel
              title='Inactive Plans'
              subtitle='Assigned to inactive tiers'
            >
              <div className='p-6 text-3xl font-black text-amber-600'>
                {planHealth.filter(row => row.plan?.status !== 'active').length}
              </div>
            </DataPanel>
            <DataPanel
              title='Monthly Revenue'
              subtitle='Projected subscription base'
            >
              <div className='p-6 text-3xl font-black text-emerald-700'>
                USD{' '}
                {planUsageRows
                  .reduce((sum, row) => sum + row.monthlyRevenue, 0)
                  .toFixed(0)}
              </div>
            </DataPanel>
          </div>

          <DataPanel
            title='Plan Enforcement'
            subtitle='Vendors exceeding current plan, missing plans, inactive plans and downgrade risk.'
          >
            <div className='overflow-x-auto'>
              <table className='min-w-full text-left'>
                <thead className='bg-stone-100 text-[10px] uppercase tracking-widest text-stone-500'>
                  <tr>
                    <th className='p-3'>Vendor</th>
                    <th className='p-3'>Plan</th>
                    <th className='p-3'>Usage</th>
                    <th className='p-3'>Status</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-stone-100'>
                  {planHealth.map(({ vendor, plan, usage, issues }) => (
                    <tr key={vendor.id} className='text-xs'>
                      <td className='p-3 font-bold uppercase'>{vendor.name}</td>
                      <td className='p-3'>{plan?.name || 'No plan'}</td>
                      <td className='p-3 text-[10px] uppercase text-stone-500'>
                        Products {usage.products} | Branches {usage.branches} |
                        Staff {usage.staff} | Storefronts{' '}
                        {usage.storefrontGenerations}
                        <div className='text-[8px] normal-case text-stone-400 mt-0.5 leading-tight'>
                          Billable active footprint only.{' '}
                          {usage.nonBillableProducts > 0
                            ? `${usage.nonBillableProducts} archived/hidden products not counted.`
                            : ''}
                        </div>
                      </td>
                      <td className='p-3'>
                        {issues.length > 0 ? (
                          <span className='text-red-600 font-bold'>
                            {issues.join('; ')}
                          </span>
                        ) : (
                          <span className='text-emerald-700 font-bold'>
                            Allowed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataPanel>

          <DataPanel
            title='Usage By Plan'
            subtitle='Revenue, usage pressure and violations by tier.'
          >
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 p-6'>
              {planUsageRows.map(row => (
                <div
                  key={row.plan.id}
                  className='border-2 border-stone-200 p-4'
                >
                  <p className='text-xs font-black uppercase text-brand-charcoal'>
                    {row.plan.name}
                  </p>
                  <div className='mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase'>
                    <div>
                      <p className='text-stone-400 font-bold'>Vendors</p>
                      <p className='font-black'>{row.vendorCount}</p>
                    </div>
                    <div>
                      <p className='text-stone-400 font-bold'>Revenue</p>
                      <p className='font-black'>USD {row.monthlyRevenue}</p>
                    </div>
                    <div>
                      <p className='text-stone-400 font-bold'>Risks</p>
                      <p className='font-black text-red-600'>
                        {row.violations}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>

          <DataPanel
            title='Entitlement Test Helpers'
            subtitle='Built-in checks for core plan rules.'
          >
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3 p-6 text-xs font-bold uppercase'>
              {[
                [
                  'Starter product ceiling',
                  safePlans.find(p => p.id === 'starter')?.maxProducts === 50
                ],
                [
                  'Growth product ceiling',
                  safePlans.find(p => p.id === 'growth')?.maxProducts === 300
                ],
                [
                  'Starter cannot use Pro BI',
                  safePlans.find(p => p.id === 'starter')?.biAnalyticsLevel !==
                    'advanced'
                ],
                [
                  'Plan assignment creates subscriptions',
                  typeof subscriptionBillingService.assignPlanToVendor ===
                    'function'
                ],
                [
                  'Usage ledger enabled',
                  typeof vendorPlanUsageService.recordUsage === 'function'
                ],
                [
                  'Storefront gate available',
                  typeof planEntitlementService.canGenerateStorefront ===
                    'function'
                ]
              ].map(([label, passed]) => (
                <div
                  key={String(label)}
                  className={`border-2 p-3 ${
                    passed
                      ? 'border-emerald-200 text-emerald-700'
                      : 'border-red-200 text-red-600'
                  }`}
                >
                  {passed ? 'PASS' : 'FAIL'} - {label}
                </div>
              ))}
            </div>
          </DataPanel>
        </div>
      )}

      {viewMode === 'diagnostics' && (
        <div className='space-y-6'>
          <DataPanel
            title='Entitlement Diagnostics Parameters'
            subtitle='Test the entitlement engine against real vendor and plan data without modifying records.'
          >
            <div className='p-6 grid grid-cols-1 md:grid-cols-3 gap-6'>
              <FormField label='Select Vendor'>
                <select
                  className={underlineInputClass}
                  value={diagVendorId}
                  onChange={e => setDiagVendorId(e.target.value)}
                >
                  <option value=''>Select Vendor...</option>
                  {safeVendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label='Select Target Plan'>
                <select
                  className={underlineInputClass}
                  value={diagPlanId}
                  onChange={e => setDiagPlanId(e.target.value)}
                >
                  <option value=''>Current Vendor Plan</option>
                  {safePlans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label='Select Feature Key'>
                <select
                  className={underlineInputClass}
                  value={diagFeatureKey}
                  onChange={e => setDiagFeatureKey(e.target.value)}
                >
                  <option value='enableIDeliver'>enableIDeliver</option>
                  <option value='enableStorefront'>enableStorefront</option>
                  <option value='enableBI'>enableBI</option>
                  <option value='enableAdvancedBI'>enableAdvancedBI</option>
                  <option value='enableAiReports'>enableAiReports</option>
                  <option value='enableNotices'>enableNotices</option>
                  <option value='enableBranches'>enableBranches</option>
                  <option value='enableStaff'>enableStaff</option>
                </select>
              </FormField>
            </div>
            <div className='p-4 bg-stone-50 border-t border-stone-100 flex flex-wrap gap-3'>
              <PrimaryButton onClick={runDiagnostics} className='mr-2'>
                Run Full Diagnostics
              </PrimaryButton>
              <SecondaryButton onClick={runDiagnostics}>
                Run Usage Check
              </SecondaryButton>
              <SecondaryButton onClick={runDiagnostics}>
                Test Plan Assignment
              </SecondaryButton>
              <SecondaryButton onClick={runDiagnostics}>
                Test Feature Access
              </SecondaryButton>
              <SecondaryButton onClick={runDiagnostics}>
                Test Catalogue Generation
              </SecondaryButton>
            </div>
          </DataPanel>

          {diagResults && (
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <DataPanel title='Vendor Usage'>
                <div className='p-4 space-y-2 text-xs font-mono text-stone-600'>
                  {Object.entries(diagResults.usage || {}).map(([k, v]) => (
                    <div
                      key={k}
                      className='flex justify-between border-b border-stone-100 pb-1'
                    >
                      <span className='capitalize'>
                        {k.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className='font-bold text-brand-charcoal'>
                        {String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </DataPanel>

              <DataPanel title='Target Plan Assignment & Limits'>
                <div className='p-4 space-y-4'>
                  <div className='flex items-center gap-3'>
                    <span className='text-[10px] font-bold uppercase text-stone-500'>
                      Target Plan:
                    </span>
                    <span className='text-xs font-black uppercase text-brand-charcoal'>
                      {diagResults.targetPlanName || 'None'}
                    </span>
                  </div>

                  <div className='border border-stone-200 p-3'>
                    <p className='text-[10px] font-bold uppercase text-stone-500 mb-2'>
                      Assignment Allowed?
                    </p>
                    <StatusBadge
                      status={
                        diagResults.assignCheck?.allowed ? 'Allowed' : 'Blocked'
                      }
                      variant={
                        diagResults.assignCheck?.allowed ? 'success' : 'error'
                      }
                    />
                    {!diagResults.assignCheck?.allowed && (
                      <ul className='mt-2 space-y-1 text-xs text-red-600'>
                        {(diagResults.assignCheck?.reasons || []).map(
                          (r: any, i: number) => (
                            <li key={i}>• {r.message}</li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </DataPanel>

              <DataPanel title='Overage & Upgrade Pressure'>
                <div className='p-4 space-y-4'>
                  {diagResults.overage && (
                    <div className='border border-stone-200 p-3 bg-stone-50'>
                      <p className='text-[10px] font-bold uppercase text-stone-500 mb-2'>
                        Overage Estimate
                      </p>
                      <p className='text-xl font-black text-brand-charcoal'>
                        {diagResults.overage.currency}{' '}
                        {diagResults.overage.estimatedCharge.toFixed(2)}
                      </p>
                      <ul className='mt-2 space-y-1 text-xs text-stone-600'>
                        {diagResults.overage.overageNotes.map(
                          (n: string, i: number) => (
                            <li key={i}>• {n}</li>
                          )
                        )}
                        {diagResults.overage.overageNotes.length === 0 && (
                          <li>No overage charges applicable.</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {diagResults.pressure && (
                    <div className='border border-stone-200 p-3 bg-white'>
                      <p className='text-[10px] font-bold uppercase text-stone-500 mb-2'>
                        Upgrade Pressure
                      </p>
                      <div className='flex items-center gap-3'>
                        <span className='text-lg font-black text-brand-charcoal'>
                          {diagResults.pressure.score}/100
                        </span>
                        <StatusBadge
                          status={diagResults.pressure.label}
                          variant={
                            diagResults.pressure.score >= 80
                              ? 'error'
                              : diagResults.pressure.score >= 40
                              ? 'warning'
                              : 'success'
                          }
                        />
                      </div>
                      {diagResults.pressure.recommendedPlanName && (
                        <p className='mt-2 text-xs font-bold text-brand-orange'>
                          Suggested Upgrade:{' '}
                          {diagResults.pressure.recommendedPlanName}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </DataPanel>

              <DataPanel title='Feature Access & Catalogue Test'>
                <div className='p-4 space-y-4'>
                  <div className='border border-stone-200 p-3'>
                    <p className='text-[10px] font-bold uppercase text-stone-500 mb-2'>
                      Feature: {diagFeatureKey}
                    </p>
                    {diagResults.featureAccess ? (
                      <div className='flex items-center gap-3'>
                        <StatusBadge
                          status={
                            diagResults.featureAccess.allowed
                              ? 'Enabled'
                              : 'Disabled'
                          }
                          variant={
                            diagResults.featureAccess.allowed
                              ? 'success'
                              : 'warning'
                          }
                        />
                        <span className='text-xs text-stone-600'>
                          {diagResults.featureAccess.reason}
                        </span>
                      </div>
                    ) : (
                      <p className='text-xs text-stone-400'>N/A</p>
                    )}
                  </div>

                  <div className='border border-stone-200 p-3'>
                    <p className='text-[10px] font-bold uppercase text-stone-500 mb-2'>
                      Catalogue Generation Check
                    </p>
                    {diagResults.catalogueGenerationCheck ? (
                      <div>
                        <StatusBadge
                          status={
                            diagResults.catalogueGenerationCheck.allowed
                              ? 'Allowed'
                              : 'Blocked'
                          }
                          variant={
                            diagResults.catalogueGenerationCheck.allowed
                              ? 'success'
                              : 'error'
                          }
                        />
                        <p className='mt-2 text-xs font-bold text-stone-500'>
                          Severity:{' '}
                          {diagResults.catalogueGenerationCheck.severity}
                        </p>
                        {!diagResults.catalogueGenerationCheck.allowed && (
                          <ul className='mt-2 space-y-1 text-xs text-red-600'>
                            {diagResults.catalogueGenerationCheck.reasons.map(
                              (r: any, i: number) => (
                                <li key={i}>• {r.message}</li>
                              )
                            )}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <p className='text-xs text-stone-400'>N/A</p>
                    )}
                  </div>
                </div>
              </DataPanel>

              <div className='lg:col-span-2'>
                <DataPanel title='Raw JSON Debug Panel'>
                  <div className='p-4 bg-stone-900 text-stone-300 rounded-none'>
                    <div className='flex justify-between items-center mb-4'>
                      <span className='text-[10px] font-bold uppercase tracking-widest text-brand-orange'>
                        Entitlement Engine Output
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(diagResults, null, 2)
                          )
                          alert('Copied to clipboard')
                        }}
                        className='px-3 py-1 bg-stone-800 hover:bg-stone-700 text-white text-[10px] font-bold uppercase transition-colors'
                      >
                        Copy JSON
                      </button>
                    </div>
                    <button
                      onClick={() => setShowRawJson(!showRawJson)}
                      className='mb-2 text-[10px] font-bold uppercase text-stone-400 hover:text-white transition-colors'
                    >
                      {showRawJson ? 'Hide Output' : 'Show Full JSON Output'}
                    </button>
                    {showRawJson && (
                      <pre className='text-[10px] overflow-x-auto custom-scrollbar bg-stone-950 p-4 border border-stone-800'>
                        {JSON.stringify(diagResults, null, 2)}
                      </pre>
                    )}
                  </div>
                </DataPanel>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'health' && (
        <div className='space-y-8'>
          <DataPanel
            title='Plan Health Filters'
            subtitle='Filter commercial intelligence by tier, region and usage pressure.'
          >
            <div className='p-4 grid grid-cols-1 md:grid-cols-4 gap-4'>
              <select
                className={underlineInputClass}
                value={healthFilters.plan}
                onChange={e =>
                  setHealthFilters({ ...healthFilters, plan: e.target.value })
                }
              >
                <option value=''>All Plans</option>
                {safePlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                className={underlineInputClass}
                value={healthFilters.sector}
                onChange={e =>
                  setHealthFilters({ ...healthFilters, sector: e.target.value })
                }
              >
                <option value=''>All Sectors</option>
                {healthSectors.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className={underlineInputClass}
                value={healthFilters.city}
                onChange={e =>
                  setHealthFilters({ ...healthFilters, city: e.target.value })
                }
              >
                <option value=''>All Cities</option>
                {healthCities.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className={underlineInputClass}
                value={healthFilters.pressure}
                onChange={e =>
                  setHealthFilters({
                    ...healthFilters,
                    pressure: e.target.value
                  })
                }
              >
                <option value=''>All Pressure States</option>
                <option value='Healthy'>Healthy</option>
                <option value='Near Limit'>Near Limit</option>
                <option value='Using Overage'>Using Overage</option>
                <option value='Upgrade Recommended'>Upgrade Recommended</option>
                <option value='Blocked Without Override'>
                  Blocked Without Override
                </option>
              </select>
            </div>
          </DataPanel>

          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4'>
            <StatCard
              label='Active Subscribers'
              value={healthSummary.total}
              icon={Users}
            />
            <StatCard
              label='Near Limit'
              value={healthSummary.nearLimit}
              icon={Activity}
              variant={healthSummary.nearLimit > 0 ? 'warning' : 'neutral'}
            />
            <StatCard
              label='Using Overage'
              value={healthSummary.usingOverage}
              icon={TrendingUp}
              variant={healthSummary.usingOverage > 0 ? 'warning' : 'neutral'}
            />
            <StatCard
              label='Upgrade Recommended'
              value={healthSummary.upgradeRec}
              icon={BarChart3}
              variant={healthSummary.upgradeRec > 0 ? 'success' : 'neutral'}
            />
            <StatCard
              label='Blocked / Hard Capped'
              value={healthSummary.blocked}
              icon={AlertTriangle}
              variant={healthSummary.blocked > 0 ? 'error' : 'neutral'}
            />
            <StatCard
              label='Avg Product Util'
              value={`${healthSummary.avgProdUtil.toFixed(1)}%`}
              icon={Activity}
            />
            <StatCard
              label='Avg Catalogue Util'
              value={`${healthSummary.avgCatUtil.toFixed(1)}%`}
              icon={Activity}
            />
            <StatCard
              label='Est. Overage Revenue'
              value={`$${healthSummary.overageRev.toFixed(2)}`}
              icon={DollarSign}
              variant='success'
            />
            <StatCard
              label='Churn Risk Detected'
              value={healthSummary.churnRisk}
              icon={AlertTriangle}
              variant={healthSummary.churnRisk > 0 ? 'error' : 'neutral'}
            />
          </div>

          <TablePanel
            title='Plan Health & Utilization Matrix'
            subtitle='Aggregated resource pressure and upgrade intelligence per pricing tier.'
            headers={[
              'Plan Name',
              'Active Vendors',
              'Avg Prod Usage',
              'Avg Cat Usage',
              'Avg Img Usage',
              'Near Limit',
              'Using Overage',
              'Upgrade Rec',
              'Blocked',
              'Est. Revenue',
              'Churn Risk'
            ]}
            actions={
              <button
                onClick={handleExportHealthCsv}
                className='flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-brand-orange transition-colors'
              >
                <Download size={14} /> Export CSV
              </button>
            }
          >
            {healthPlanRows.map(row => (
              <tr key={row.planName} className='hover:bg-stone-50'>
                <td className='px-6 py-4 font-black uppercase text-xs'>
                  {row.planName}
                </td>
                <td className='px-6 py-4 font-mono text-xs'>
                  {row.activeVendors}
                </td>
                <td className='px-6 py-4 font-mono text-xs'>
                  {row.avgProdUtil.toFixed(1)}%
                </td>
                <td className='px-6 py-4 font-mono text-xs'>
                  {row.avgCatUtil.toFixed(1)}%
                </td>
                <td className='px-6 py-4 font-mono text-xs'>
                  {row.avgImgUtil.toFixed(1)}%
                </td>
                <td className='px-6 py-4 font-mono text-xs text-amber-600 font-bold'>
                  {row.nearLimit}
                </td>
                <td className='px-6 py-4 font-mono text-xs text-brand-orange font-bold'>
                  {row.usingOverage}
                </td>
                <td className='px-6 py-4 font-mono text-xs text-emerald-600 font-bold'>
                  {row.upgradeRec}
                </td>
                <td className='px-6 py-4 font-mono text-xs text-red-600 font-bold'>
                  {row.blocked}
                </td>
                <td className='px-6 py-4 font-mono text-xs font-bold'>
                  ${row.monthlyRev.toFixed(2)}
                </td>
                <td className='px-6 py-4 font-mono text-xs text-red-600 font-bold'>
                  {row.churnRisk > 0 ? row.churnRisk : '-'}
                </td>
              </tr>
            ))}
            {healthPlanRows.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className='px-6 py-8 text-center text-[10px] font-bold uppercase text-stone-400'
                >
                  No data matching selected filters.
                </td>
              </tr>
            )}
          </TablePanel>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!planDeleteId}
        title='seiGEN Commerce'
        message='Delete this pricing plan? This action cannot be undone.'
        confirmLabel='Delete Plan'
        cancelLabel='Cancel'
        variant='danger'
        onConfirm={() => {
          if (planDeleteId) void handleDeletePlan(planDeleteId)
          setPlanDeleteId(null)
        }}
        onCancel={() => setPlanDeleteId(null)}
      />

      <ConfirmDialog
        isOpen={isAssignModalOpen}
        title='Reassign Vendor Plan'
        message={`Move ${
          vendorToAssign?.name || 'this vendor'
        } to a different pricing tier. This affects their resource boundaries.`}
        confirmLabel={
          assignmentIssues.length > 0
            ? 'Override And Assign Plan'
            : 'Assign Plan'
        }
        onConfirm={handleAssignPlan}
        onCancel={() => {
          setIsAssignModalOpen(false)
          setVendorToAssign(null)
          setTargetPlanId('')
          setOverrideReason('')
        }}
      >
        <div className='mt-4'>
          <label className='text-[10px] font-bold uppercase text-stone-400 block mb-2'>
            Target Pricing Plan
          </label>
          <select
            className={underlineInputClass}
            value={targetPlanId}
            onChange={e => setTargetPlanId(e.target.value)}
          >
            <option value=''>Select Plan...</option>
            {safePlans.map(plan => (
              <option key={plan.id} value={plan.id}>
                {plan.name.toUpperCase()} - {plan.currency} {plan.monthlyPrice}
                /mo
              </option>
            ))}
          </select>
        </div>

        {vendorToAssign && targetAssignmentPlan && assignmentUsage && (
          <div className='mt-5 border-2 border-stone-200 p-4 space-y-4'>
            <div className='grid grid-cols-2 gap-3 text-[10px] uppercase font-bold'>
              <div>
                <p className='text-stone-400'>Current Plan</p>
                <p className='text-brand-charcoal'>
                  {currentAssignmentPlan?.name || 'Unassigned'} -{' '}
                  {currentAssignmentPlan?.currency ||
                    targetAssignmentPlan.currency}{' '}
                  {currentAssignmentPlan?.monthlyPrice ?? 0}
                </p>
              </div>
              <div>
                <p className='text-stone-400'>Target Plan</p>
                <p className='text-brand-charcoal'>
                  {targetAssignmentPlan.name} - {targetAssignmentPlan.currency}{' '}
                  {targetAssignmentPlan.monthlyPrice}
                </p>
              </div>
              <div>
                <p className='text-stone-400'>Price Difference</p>
                <p
                  className={
                    targetAssignmentPlan.monthlyPrice -
                      (currentAssignmentPlan?.monthlyPrice || 0) <
                    0
                      ? 'text-red-600'
                      : 'text-emerald-700'
                  }
                >
                  {targetAssignmentPlan.currency}{' '}
                  {(
                    targetAssignmentPlan.monthlyPrice -
                    (currentAssignmentPlan?.monthlyPrice || 0)
                  ).toFixed(2)}
                </p>
              </div>
              <div>
                <p className='text-stone-400'>New Due Date</p>
                <p>{assignmentDueDate}</p>
              </div>
            </div>

            <div className='grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px] uppercase font-bold'>
              <div className='bg-stone-50 p-2 flex flex-col justify-center'>
                <span>
                  Products {assignmentUsage.products}/
                  {targetAssignmentPlan.maxProducts}
                </span>
                <span className='text-[7px] text-stone-400 normal-case mt-0.5 leading-tight'>
                  Billable active footprint only
                </span>
                {assignmentUsage.nonBillableProducts > 0 && (
                  <span className='text-[7px] text-stone-400 normal-case leading-tight'>
                    {assignmentUsage.nonBillableProducts} archived/hidden
                    products not counted
                  </span>
                )}
              </div>
              <div className='bg-stone-50 p-2'>
                Branches {assignmentUsage.branches}/
                {targetAssignmentPlan.maxBranchesPerVendor}
              </div>
              <div className='bg-stone-50 p-2'>
                Staff {assignmentUsage.staff}/
                {targetAssignmentPlan.maxStaffPerVendor}
              </div>
              <div className='bg-stone-50 p-2'>
                Delivery {assignmentUsage.deliveryContacts}/
                {targetAssignmentPlan.maxDeliveryContactsPerVendor}
              </div>
              <div className='bg-stone-50 p-2'>
                Storefronts {assignmentUsage.storefrontGenerations}/
                {targetAssignmentPlan.maxStorefrontDeploymentsPerMonth}
              </div>
              <div className='bg-stone-50 p-2'>
                Notices {assignmentUsage.notices}/
                {targetAssignmentPlan.maxNoticesPerMonth || 0}
              </div>
              <div className='bg-stone-50 p-2'>
                BI {targetAssignmentPlan.biAnalyticsLevel}
              </div>
              <div className='bg-stone-50 p-2'>
                Trial {targetAssignmentPlan.trialDays} days
              </div>
            </div>

            {assignmentIssues.reasons.length > 0 && (
              <div className='border-2 border-red-200 bg-red-50 p-3 text-[10px] font-bold uppercase text-red-700'>
                <p>
                  Downgrade risk:{' '}
                  {assignmentIssues.reasons
                    .map((r: any) => r.message)
                    .join('; ')}
                  . Admin override is required and will be logged on the
                  subscription.
                </p>
                {(permissionService.canEdit('pricing') ||
                  permissionService.canApprove('pricing')) && (
                  <textarea
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder='Enter override reason for audit log...'
                    className='w-full mt-2 p-2 border border-red-300 outline-none focus:border-red-500 text-stone-800'
                    rows={2}
                    required
                  />
                )}
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>

      {isMigrationModalOpen && (
        <div className='fixed inset-0 bg-brand-charcoal/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
          <div className='bg-white w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border-t-4 border-brand-orange'>
            <div className='p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50'>
              <div>
                <h2 className='text-sm uppercase font-black tracking-widest text-brand-charcoal'>
                  Bulk Plan Migration
                </h2>
                <p className='text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-1'>
                  Safely transition active subscribers to new tiers
                </p>
              </div>
              <button
                onClick={() => setIsMigrationModalOpen(false)}
                className='p-2 text-stone-400 hover:text-brand-charcoal transition-colors bg-white border border-stone-200'
              >
                <X size={16} />
              </button>
            </div>

            {migrationResult ? (
              <div className='p-12 flex flex-col items-center justify-center text-center flex-1'>
                <Check className='w-16 h-16 text-emerald-500 mb-4' />
                <h3 className='text-xl font-black uppercase text-brand-charcoal'>
                  Migration Completed
                </h3>
                <p className='text-sm text-stone-600 font-medium mt-2'>
                  Job ID:{' '}
                  <span className='font-mono'>{migrationResult.jobId}</span>
                </p>
                <div className='flex gap-4 mt-6'>
                  <div className='bg-stone-50 border border-stone-200 p-4 min-w-[120px]'>
                    <p className='text-[10px] font-black uppercase tracking-widest text-stone-400'>
                      Successfully Migrated
                    </p>
                    <p className='text-2xl font-black text-emerald-600 mt-2'>
                      {migrationResult.successCount}
                    </p>
                  </div>
                  <div className='bg-stone-50 border border-stone-200 p-4 min-w-[120px]'>
                    <p className='text-[10px] font-black uppercase tracking-widest text-stone-400'>
                      Failed / Blocked
                    </p>
                    <p className='text-2xl font-black text-red-600 mt-2'>
                      {migrationResult.failedCount +
                        (migrationPreview.length - migrationResult.total)}
                    </p>
                  </div>
                </div>
                <PrimaryButton
                  className='mt-8'
                  onClick={() => setIsMigrationModalOpen(false)}
                >
                  Close Window
                </PrimaryButton>
              </div>
            ) : (
              <div className='flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6'>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                  <FormField label='Source Plan' required>
                    <select
                      className={underlineInputClass}
                      value={migrationSourcePlanId}
                      onChange={e => setMigrationSourcePlanId(e.target.value)}
                    >
                      <option value=''>Select source...</option>
                      {safePlans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label='Target Plan' required>
                    <select
                      className={underlineInputClass}
                      value={migrationTargetPlanId}
                      onChange={e => setMigrationTargetPlanId(e.target.value)}
                    >
                      <option value=''>Select target...</option>
                      {safePlans
                        .filter(
                          p =>
                            p.status === 'active' &&
                            p.id !== migrationSourcePlanId
                        )
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </FormField>
                  <div className='lg:col-span-2'>
                    <FormField label='Migration Reason' required>
                      <input
                        className={underlineInputClass}
                        value={migrationReason}
                        onChange={e => setMigrationReason(e.target.value)}
                        placeholder='e.g. Starter tier deprecation'
                      />
                    </FormField>
                  </div>
                </div>

                <div className='p-4 bg-stone-50 border border-stone-200 space-y-4'>
                  <label className='flex items-center gap-3 cursor-pointer'>
                    <input
                      type='checkbox'
                      className='accent-brand-orange w-4 h-4'
                      checked={allowMigrationOverride}
                      onChange={e =>
                        setAllowMigrationOverride(e.target.checked)
                      }
                    />
                    <span className='text-xs font-black uppercase text-brand-charcoal tracking-widest'>
                      Allow Admin Override for Blocked Vendors
                    </span>
                  </label>
                  {allowMigrationOverride && (
                    <FormField label='Override Reason (Required if overrides used)'>
                      <input
                        className={underlineInputClass}
                        value={migrationOverrideReason}
                        onChange={e =>
                          setMigrationOverrideReason(e.target.value)
                        }
                        placeholder='Admin/Finance approved bypass...'
                      />
                    </FormField>
                  )}
                </div>

                {migrationPreview.length > 0 && (
                  <TablePanel
                    title='Migration Entitlement Preview'
                    subtitle={`${
                      migrationPreview.filter(p => p.willMigrate).length
                    } of ${
                      migrationPreview.length
                    } vendors are cleared to migrate.`}
                    headers={[
                      'Vendor',
                      'Products Used / Limit',
                      'Images Used / Limit',
                      'Exports Used / Limit',
                      'Status',
                      'Reason'
                    ]}
                  >
                    {migrationPreview.map((row, idx) => {
                      const targetPlan = safePlans.find(
                        p => p.id === migrationTargetPlanId
                      )
                      return (
                        <tr
                          key={idx}
                          className={`text-xs ${
                            !row.willMigrate
                              ? 'opacity-60 bg-red-50/20'
                              : 'hover:bg-stone-50'
                          }`}
                        >
                          <td className='px-6 py-4 font-bold uppercase'>
                            {row.vendor.name}
                          </td>
                          <td className='px-6 py-4 font-mono'>
                            {row.usage.products} /{' '}
                            {targetPlan?.maxProducts || '∞'}
                          </td>
                          <td className='px-6 py-4 font-mono'>
                            {row.usage.imagesThisCatalogue} /{' '}
                            {targetPlan?.maxImagesPerCatalogue || '∞'}
                          </td>
                          <td className='px-6 py-4 font-mono'>
                            {row.usage.cataloguesThisPeriod} /{' '}
                            {targetPlan?.maxDeploymentsPerMonth || '∞'}
                          </td>
                          <td className='px-6 py-4'>
                            <span
                              className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                                row.status === 'Safe'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : row.status === 'Blocked'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-orange-100 text-brand-orange'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className='px-6 py-4 text-[10px] uppercase text-stone-500 font-bold'>
                            {row.entitlement.reasons.length > 0
                              ? row.entitlement.reasons
                                  .map((r: any) => r.message)
                                  .join('; ')
                              : 'Limits Verified'}
                          </td>
                        </tr>
                      )
                    })}
                  </TablePanel>
                )}

                {migrationSourcePlanId &&
                  migrationTargetPlanId &&
                  migrationPreview.length === 0 && (
                    <div className='p-8 text-center border-2 border-dashed border-stone-200 text-xs font-bold uppercase tracking-widest text-stone-400'>
                      No vendors found on the selected source plan.
                    </div>
                  )}
              </div>
            )}

            {!migrationResult && (
              <div className='p-6 border-t border-stone-100 bg-white flex justify-end gap-3 shrink-0'>
                <SecondaryButton onClick={() => setIsMigrationModalOpen(false)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  onClick={executeBulkMigration}
                  disabled={
                    isMigrating ||
                    !migrationTargetPlanId ||
                    migrationPreview.filter(p => p.willMigrate).length === 0
                  }
                >
                  {isMigrating ? (
                    <>
                      <Loader2 size={14} className='mr-2 animate-spin' />{' '}
                      Migrating...
                    </>
                  ) : (
                    `Migrate ${
                      migrationPreview.filter(p => p.willMigrate).length
                    } Subscribers`
                  )}
                </PrimaryButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const FeatureToggle: React.FC<{
  label: string
  active: boolean
  onClick: () => void
}> = ({ label, active, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className={`p-4 border-2 text-left transition-all ${
      active
        ? 'border-brand-orange bg-orange-50/30'
        : 'border-stone-100 hover:border-stone-200 bg-white'
    }`}
  >
    <div className='flex justify-between items-center mb-2'>
      <p className='text-[9px] font-bold uppercase tracking-widest'>{label}</p>
      <div
        className={`w-3 h-3 rounded-full ${
          active ? 'bg-brand-orange' : 'bg-stone-200'
        }`}
      />
    </div>
    <p
      className={`text-[8px] font-bold uppercase ${
        active ? 'text-brand-orange' : 'text-stone-400'
      }`}
    >
      {active ? 'Module Enabled' : 'Module Disabled'}
    </p>
  </button>
)

const MiniLimit: React.FC<{ label: string; value: number }> = ({
  label,
  value
}) => (
  <div className='p-2 border border-stone-100 bg-stone-50'>
    <p className='text-[8px] font-bold text-stone-400 uppercase mb-0.5'>
      {label}
    </p>
    <p className='text-sm font-bold tracking-tight'>
      {value === Infinity ? '∞' : value}
    </p>
  </div>
)

const FeatureItem: React.FC<{ label: string; active: boolean }> = ({
  label,
  active
}) => (
  <div className='flex items-center gap-2'>
    <div
      className={`w-4 h-4 flex items-center justify-center border ${
        active
          ? 'border-brand-orange bg-brand-orange text-white'
          : 'border-stone-200 text-stone-200'
      }`}
    >
      {active ? <Check size={10} /> : <X size={10} />}
    </div>
    <span
      className={`text-[10px] font-bold uppercase tracking-wider ${
        active ? 'text-brand-charcoal' : 'text-stone-300'
      }`}
    >
      {label}
    </span>
  </div>
)

const ComparisonRow: React.FC<{
  label: string
  field: keyof PricingPlan
  prefix?: string
  suffix?: string
  plans: PricingPlan[]
}> = ({ label, field, prefix = '', suffix = '', plans }) => (
  <tr className='hover:bg-stone-50'>
    <td className='px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-50/50'>
      {label}
    </td>
    {asArray<PricingPlan>(plans).map(plan => (
      <td
        key={plan.id}
        className='px-6 py-4 text-center text-xs font-bold font-mono'
      >
        {prefix}
        {plan[field] === Infinity ? 'Unlimited' : String(plan[field] ?? '')}
        {suffix}
      </td>
    ))}
  </tr>
)

const ComparisonBooleanRow: React.FC<{
  label: string
  field: keyof PricingPlan
  plans: PricingPlan[]
}> = ({ label, field, plans }) => (
  <tr className='hover:bg-stone-50'>
    <td className='px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-50/50'>
      {label}
    </td>
    {asArray<PricingPlan>(plans).map(plan => (
      <td key={plan.id} className='px-6 py-4 text-center'>
        <div className='flex justify-center'>
          {plan[field] ? (
            <div className='w-5 h-5 bg-green-50 text-green-600 rounded flex items-center justify-center'>
              <Check size={14} />
            </div>
          ) : (
            <div className='w-5 h-5 bg-stone-50 text-stone-300 rounded flex items-center justify-center'>
              <X size={14} />
            </div>
          )}
        </div>
      </td>
    ))}
  </tr>
)

export default PricingPlans
