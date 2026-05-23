/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  Store,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ChevronRight,
  MapPin,
  Users,
  Briefcase,
  Calendar,
  DollarSign,
  Package,
  FileCode,
  FileText,
  Save,
  X,
  PlusCircle,
  Clock,
  User,
  Info,
  Layers,
  Globe,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Printer
} from 'lucide-react'
import {
  TablePanel,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  SearchInput,
  SearchableComboBox,
  ConfirmDialog,
  DataPanel,
  BrandedAlertModal
} from '../components/CommonUI.tsx'
import { vendorService } from '../services/vendorService.ts'
import { masterDataCacheService } from '../services/masterDataCacheService.ts'
import { rpnService } from '../services/rpnService.ts'
import { catalogueService } from '../services/catalogueService.ts'
import { logService } from '../services/logService.ts'
import { analyticsService } from '../services/analyticsService.ts'
import { pricingPlanService } from '../services/pricingPlanService.ts'
import { pdfService } from '../services/pdfService.ts'
import { permissionService } from '../services/permissionService.ts'
import { staffService } from '../services/staffService.ts'
import { staffAuditService } from '../services/staffAuditService.ts'
import { settingsService } from '../services/settingsService.ts'
import { taxonomyService } from '../services/taxonomyService.ts'
import { vendorReadinessService } from '../services/vendorReadinessService.ts'
import { productService } from '../services/productService.ts'
import { vendorBillingService } from '../services/vendorBillingService.ts'
import VendorProductOfferSheet from '../components/VendorProductOfferSheet.tsx'
import {
  Vendor,
  RPN,
  AppRoute,
  VendorStatus,
  SubscriptionStatus,
  FieldDataSource,
  Branch,
  PricingPlan,
  CatalogueGeneration,
  Staff,
  MarketingCampaign,
  IDeliverProvider,
  SystemSettings,
  MasterProduct,
  VendorProductOffer
} from '../types.ts'
import { asArray } from '../utils/safeData.ts'
import { optimizeImageToWebP } from '../utils/imageUtils.ts'
import { findSimilarVendors } from '../utils/duplicateDetection.ts'
import {
  DEFAULT_BUSINESS_TYPES,
  DEFAULT_SECTORS
} from '../utils/classificationOptions.ts'
import { approvalService } from '../services/approvalService.ts'
import { generateEntityId } from '../utils/idGenerator.ts'
import {
  buildVendorProductExportRows,
  exportVendorProductRows
} from '../utils/vendorProductExport.ts'
import { buildSearchText } from '../utils/searchUtils.ts'
import { printVendorInvoice } from '../utils/vendorInvoicePrint.ts'
import { useFormDraft } from '../hooks/useFormDraft.ts'
import { offlineSyncService } from '../services/offlineSyncService.ts'
import {
  clearDraft as clearLocalDraft,
  getDraft,
  hasMeaningfulDraft
} from '../utils/localDraftStorage.ts'
import {
  getSession,
  getSessionRole,
  getSessionStaffId,
  getSessionStaffName,
  hasValidSession
} from '../utils/session.ts'

const SECTORS = DEFAULT_SECTORS
const BUSINESS_TYPES = DEFAULT_BUSINESS_TYPES
const DATA_SOURCES: FieldDataSource[] = [
  'RPN collected',
  'vendor submitted',
  'backend entered',
  'imported'
]
const VENDOR_STATUSES: VendorStatus[] = [
  'lead',
  'active',
  'suspended',
  'dormant',
  'cancelled',
  'pending_review'
]
const WORLD_COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  "Cote d'Ivoire",
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czechia',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe'
]
const DEFAULT_COUNTRY = 'Zimbabwe'

const SearchableCountrySelect: React.FC<{
  value?: string
  onChange: (value: string) => void
  className?: string
}> = ({ value, onChange, className }) => {
  const listId = React.useId()
  return (
    <>
      <input
        list={listId}
        value={value || DEFAULT_COUNTRY}
        onChange={e => onChange(e.target.value)}
        onBlur={e => {
          if (!e.target.value.trim()) onChange(DEFAULT_COUNTRY)
        }}
        className={className}
      />
      <datalist id={listId}>
        {WORLD_COUNTRIES.map(country => (
          <option key={country} value={country} />
        ))}
      </datalist>
    </>
  )
}
const SUB_STATUSES: SubscriptionStatus[] = [
  'trial',
  'active',
  'due',
  'overdue',
  'suspended'
]

export const VendorManagement: React.FC = () => {
  // Navigation & View State
  const [view, setView] = useState<'list' | 'form'>('list')
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)

  // Data State
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [rpns, setRpns] = useState<RPN[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([])
  const [vendorProductOffers, setVendorProductOffers] = useState<
    VendorProductOffer[]
  >([])
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({})
  const [sharedSectors, setSharedSectors] = useState<string[]>([])
  const [newBusinessType, setNewBusinessType] = useState('')
  const [newSector, setNewSector] = useState('')
  const [providerUploadStatus, setProviderUploadStatus] = useState<
    Record<string, string>
  >({})

  // Lists stats (counts)
  const [productCounts, setProductCounts] = useState<Record<string, number>>({})
  const [catalogueCounts, setCatalogueCounts] = useState<
    Record<string, number>
  >({})

  // Filter State
  const [search, setSearch] = useState('')
  const [filterSector, setFilterSector] = useState('All')
  const [filterRPN, setFilterRPN] = useState('All')
  const [filterSubStatus, setFilterSubStatus] = useState('All')
  const [filterVendorStatus, setFilterVendorStatus] = useState('All')

  // Deletion State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState<Partial<Vendor>>({
    branches: [],
    staff: [],
    deliveryStaff: [],
    deliveryProviders: []
  })
  const [isManagerOverride, setIsManagerOverride] = useState(false)

  // Asset Upload State
  const [logoStatus, setLogoStatus] = useState<string>('')
  const [bannerStatus, setBannerStatus] = useState<string>('')
  const [showManualUrls, setShowManualUrls] = useState<boolean>(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [hasCheckedDraftRecovery, setHasCheckedDraftRecovery] = useState(false)
  const [draftDecisionMade, setDraftDecisionMade] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)

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

  const vendorDraft = useFormDraft<Partial<Vendor>>({
    draftKey: `vendor:${formData.id || selectedVendor?.id || 'new'}`,
    formData,
    setFormData,
    enabled: view === 'form',
    saveDelayMs: 900
  })

  useEffect(() => {
    if (view !== 'form') {
      setHasCheckedDraftRecovery(false)
      setDraftDecisionMade(false)
      setShowDraftPrompt(false)
      return
    }

    if (hasCheckedDraftRecovery || draftDecisionMade) return

    const draftKey = `itred_form_draft:vendor:${
      formData.id || selectedVendor?.id || 'new'
    }`
    const draft = getDraft<Partial<Vendor>>(draftKey)

    if (draft) {
      const hasUsefulVendorDraft =
        !!draft.name ||
        !!draft.tradingName ||
        !!draft.sector ||
        !!draft.businessType ||
        !!draft.mainPhone ||
        (draft.branches && draft.branches.length > 0) ||
        hasMeaningfulDraft(draft)

      if (hasUsefulVendorDraft) {
        setShowDraftPrompt(true)
      } else {
        clearLocalDraft(draftKey)
      }
    }
    setHasCheckedDraftRecovery(true)
  }, [view, hasCheckedDraftRecovery, draftDecisionMade])

  const requireActiveSession = () => {
    const session = getSession()
    if (!hasValidSession(session)) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message:
          'Session expired. Please login again before saving operational changes.',
        type: 'warning'
      })
      return null
    }
    return session
  }

  useEffect(() => {
    vendorService.migrateVendors()
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoadingData(true)
    const startMs = performance.now()
    try {
    masterDataCacheService.getVendors().then(cachedVendors => {
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
    })
    const v = asArray<Vendor>(await Promise.resolve(vendorService.getVendors()))
    const r = asArray<RPN>(await Promise.resolve(rpnService.getAll()))
    const c = asArray<CatalogueGeneration>(
      await Promise.resolve(catalogueService.getHistory())
    )
    const pl = asArray<PricingPlan>(
      await Promise.resolve(pricingPlanService.getPlans())
    )
    const mp = asArray<MasterProduct>(
      await Promise.resolve(productService.getMasterProducts())
    )
    const vo = asArray<VendorProductOffer>(
      await Promise.resolve(productService.getVendorProductOffers())
    )
    const st = asArray<Staff>(await Promise.resolve(staffService.getAllStaff()))
    const cm = asArray<MarketingCampaign>(
      await Promise.resolve(rpnService.getCampaigns())
    )
    const settings = await settingsService.getSettings()

    setVendors(v)
    setRpns(r)
    setPlans(pl)
    setMasterProducts(mp)
    setVendorProductOffers(vo)
    setStaffList(st)
    setCampaigns(cm)
    setSystemSettings(settings)
    setSharedSectors(await taxonomyService.getSectors())

    // Calculate counts
    const pCounts: Record<string, number> = {}
    vo.forEach(offer => {
      if (!offer.vendorId) return
      pCounts[offer.vendorId] = (pCounts[offer.vendorId] || 0) + 1
    })
    setProductCounts(pCounts)

    const cCounts: Record<string, number> = {}
    c.forEach(gen => {
      ;(gen.vendorIds || []).forEach(vid => {
        cCounts[vid] = (cCounts[vid] || 0) + 1
      })
    })
    setCatalogueCounts(cCounts)
    } catch (error) {
      console.warn("Error loading vendor management data", error)
    } finally {
      setIsLoadingData(false)
      console.info("Data load completed", { page: "VendorManagement", elapsedMs: Math.round(performance.now() - startMs) })
    }
  }

  const filteredStaffRPNs = useMemo(() => {
    return staffList.filter(s => {
      const role = (s.role || '').toLowerCase()
      return (
        role.includes('rpn') ||
        role.includes('agent') ||
        role.includes('field') ||
        role.includes('sales')
      )
    })
  }, [staffList])

  const sectorOptions = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...sharedSectors,
          ...vendors.map(vendor => vendor.sector),
          formData.sector
        ]
          .map(value => (value || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [formData.sector, sharedSectors, vendors])

  const businessTypeOptions = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...BUSINESS_TYPES,
          ...asArray<string>(systemSettings.customBusinessTypes),
          ...vendors.map(vendor => vendor.businessType),
          formData.businessType
        ]
          .map(value => (value || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [formData.businessType, systemSettings.customBusinessTypes, vendors])

  const activeStaff = useMemo(
    () =>
      staffList
        .filter(
          staff =>
            (staff.status || '').toLowerCase() === 'active' && !staff.isLocked
        )
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')),
    [staffList]
  )

  const searchableStaff = activeStaff

  const currentAssignedStaff = useMemo(() => {
    const id = formData.assignedStaffId || formData.assignedMemberId
    if (!id) return null
    return staffList.find(staff => staff.id === id) || null
  }, [formData.assignedMemberId, formData.assignedStaffId, staffList])

  const currentAssignedStaffIsInactive =
    !!currentAssignedStaff &&
    ((currentAssignedStaff.status || '').toLowerCase() !== 'active' ||
      !!currentAssignedStaff.isLocked)

  const activeVendorId = String(selectedVendor?.id || '')
  const activeVendorName =
    formData.tradingName || formData.name || selectedVendor?.tradingName || selectedVendor?.name || 'Vendor'
  const activeVendorPlan = useMemo(
    () =>
      plans.find(
        plan => plan.id === (selectedVendor?.planId || formData.planId || '')
      ),
    [formData.planId, plans, selectedVendor?.planId]
  )
  const activeVendorProductOffers = useMemo(
    () =>
      vendorProductOffers.filter(
        offer => offer.vendorId === activeVendorId
      ),
    [activeVendorId, vendorProductOffers]
  )

  const refreshVendorProductOffers = async () => {
    const offers = asArray<VendorProductOffer>(
      await Promise.resolve(productService.getVendorProductOffers())
    )
    setVendorProductOffers(offers)
    const pCounts: Record<string, number> = {}
    offers.forEach(offer => {
      if (!offer.vendorId) return
      pCounts[offer.vendorId] = (pCounts[offer.vendorId] || 0) + 1
    })
    setProductCounts(pCounts)
  }

  const handleVendorProductSheetSaved = async (
    savedOffers: VendorProductOffer[]
  ) => {
    if (savedOffers.length > 0) {
      const savedById = new Map(savedOffers.map(offer => [offer.id, offer]))
      setVendorProductOffers(current => {
        const retained = current.filter(offer => !savedById.has(offer.id))
        return [...retained, ...savedOffers]
      })
    }
    await refreshVendorProductOffers()
  }

  const handleExportActiveVendorInventory = () => {
    if (!activeVendorId) {
      showBrandedAlert({
        message: 'Save or select a vendor before exporting inventory.',
        type: 'warning'
      })
      return
    }
    const rows = buildVendorProductExportRows({
      offers: activeVendorProductOffers,
      masterProducts,
      vendorName: activeVendorName,
      getBranchName: branchId =>
        (formData.branches || []).find(branch => branch.id === branchId)
          ?.name || ''
    })
    if (!exportVendorProductRows(rows, activeVendorName)) {
      showBrandedAlert({
        message: 'No linked or branded vendor products are available to export.',
        type: 'info'
      })
    }
  }

  const addCustomBusinessType = async () => {
    const value = newBusinessType.trim()
    if (!value) return
    if (
      businessTypeOptions.some(
        item => item.toLowerCase() === value.toLowerCase()
      )
    ) {
      showBrandedAlert({
        message: 'Business type already exists.',
        type: 'warning'
      })
      return
    }
    const nextSettings = {
      ...systemSettings,
      customBusinessTypes: [
        ...asArray<string>(systemSettings.customBusinessTypes),
        value
      ]
    }
    await settingsService.saveSettings(nextSettings)
    setSystemSettings(nextSettings)
    setFormData(prev => ({ ...prev, businessType: value }))
    setNewBusinessType('')
    void staffAuditService.logAction({
      eventType: 'RECORD_CREATED',
      module: 'settings',
      severity: 'info',
      action: `Custom business type added: ${value}`,
      recordType: 'business_type',
      recordId: value
    })
  }

  const addCustomSector = async () => {
    const value = newSector.trim()
    if (!value) return
    if (
      sectorOptions.some(item => item.toLowerCase() === value.toLowerCase())
    ) {
      showBrandedAlert({ message: 'Sector already exists.', type: 'warning' })
      return
    }
    const sectors = await taxonomyService.addSector(value)
    const nextSettings = await settingsService.getSettings()
    setSharedSectors(sectors)
    setSystemSettings(nextSettings)
    setFormData(prev => ({ ...prev, sector: value }))
    setNewSector('')
    void staffAuditService.logAction({
      eventType: 'RECORD_CREATED',
      module: 'settings',
      severity: 'info',
      action: `Custom sector added: ${value}`,
      recordType: 'sector',
      recordId: value
    })
  }

  const filtered = vendors.filter(v => {
    const matchesSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.systemCode &&
        v.systemCode.toLowerCase().includes(search.toLowerCase())) ||
      v.id.toLowerCase().includes(search.toLowerCase())
    const matchesSector = filterSector === 'All' || v.sector === filterSector
    const matchesRPN = filterRPN === 'All' || v.assignedRPNId === filterRPN
    const matchesSub =
      filterSubStatus === 'All' || v.subscriptionStatus === filterSubStatus
    const matchesStatus =
      filterVendorStatus === 'All' || v.status === filterVendorStatus

    return (
      matchesSearch &&
      matchesSector &&
      matchesRPN &&
      matchesSub &&
      matchesStatus
    )
  })

  const handleDelete = () => {
    if (vendorToDelete) {
      const session = requireActiveSession()
      if (!session) return
      try {
        vendorService.deleteVendor(vendorToDelete)
        analyticsService.logEvent({
          eventType: 'VENDOR_DELETED',
          actorType: getSessionRole(session),
          actorName: getSessionStaffName(session),
          vendorId: vendorToDelete,
          details: { action: 'purged' }
        })
        loadData()
        setIsDeleteDialogOpen(false)
        setVendorToDelete(null)
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: 'Deleted successfully.',
          type: 'success'
        })

        // Non-blocking staff audit logging
        try {
          const vendor = vendors.find(v => v.id === vendorToDelete)
          void staffAuditService.logDelete(
            'vendor',
            'vendor',
            vendorToDelete,
            vendor?.name || 'Unknown',
            vendor
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
  }

  const downloadOnboardingForm = () => {
    pdfService.generateOnboardingForm(vendors, rpns, plans)
  }

  const previewOnboardingForm = () => {
    pdfService.previewOnboardingForm(vendors, rpns, plans)
  }

  const startNewVendor = () => {
    const now = new Date().toISOString()
    const rawProspectPrefill = localStorage.getItem(
      'itred_vendor_prefill_from_prospect'
    )
    const prospectPrefill = rawProspectPrefill
      ? JSON.parse(rawProspectPrefill)
      : {}
    if (rawProspectPrefill) {
      localStorage.removeItem('itred_vendor_prefill_from_prospect')
    }
    setLogoStatus('')
    setBannerStatus('')
    setShowManualUrls(false)
    setIsManagerOverride(false)
    setFormError('')
    setFormSuccess('')
    setHasCheckedDraftRecovery(false)
    setDraftDecisionMade(false)
    setFormData({
      id: generateEntityId('VEND'),
      status: 'lead',
      subscriptionStatus: 'trial',
      planId: 'standard',
      dataSource: 'backend entered',
      branches: [],
      staff: [],
      deliveryStaff: [],
      deliveryProviders: [],
      createdAt: now,
      updatedAt: now,
      createdBy: '',
      displayName: '', // Initialize displayName
      updatedBy: '',
      country: DEFAULT_COUNTRY,
      ...prospectPrefill
    })
    setSelectedVendor(null)
    setView('form')
  }

  useEffect(() => {
    if (localStorage.getItem('itred_vendor_prefill_from_prospect')) {
      startNewVendor()
    }
  }, [])

  const startEditVendor = (vendor: Vendor) => {
    setLogoStatus('')
    setBannerStatus('')
    setShowManualUrls(false)
    setIsManagerOverride(false)
    setFormError('')
    setFormSuccess('')
    setHasCheckedDraftRecovery(false)
    setDraftDecisionMade(false)
    setFormData({ ...vendor })
    setFormData(prev => ({
      ...prev,
      branches: vendor.branches || [],
      staff: vendor.staff || [],
      deliveryStaff: vendor.deliveryStaff || [],
      deliveryProviders: vendor.deliveryProviders || []
    }))
    setSelectedVendor(vendor)
    setView('form')
  }

  const saveVendor = async () => {
    setFormError('')
    setFormSuccess('')

    const session = requireActiveSession()
    if (!session) return
    const staffId = getSessionStaffId(session)
    const staffName = getSessionStaffName(session)

    if (!formData.name || !formData.sector) {
      setFormError('Name and Sector are required for terminal deployment.')
      return
    }
    if (formData.assignedStaffId) {
      const selectedAssignment = activeStaff.find(
        staff => staff.id === formData.assignedStaffId
      )
      if (!selectedAssignment) {
        setFormError(
          'Assigned Staff Member must be active and unlocked. Please reassign to an active staff member.'
        )
        return
      }
    }
    const providerWarnings = (formData.deliveryProviders || []).flatMap(
      provider =>
        providerReadinessWarnings(provider).map(
          warning =>
            `${provider.providerName || 'iDeliver provider'}: ${warning}`
        )
    )
    if (providerWarnings.length > 0) {
      setFormError(
        `iDeliver readiness: ${providerWarnings.slice(0, 3).join('; ')}`
      )
      if (
        (formData.deliveryProviders || []).some(
          provider => provider.status === 'verified'
        )
      ) {
        return
      }
    }

    const canApprove = permissionService.canApprove('vendor')
    const isNew = !selectedVendor
    const needsApproval = !canApprove

    setIsSaving(true)
    const oldVendor = vendors.find(
      v => v.id === (selectedVendor?.id || formData.id)
    )
    try {
      const now = new Date().toISOString()
      const vendorToSave = {
        ...selectedVendor, // Preserve existing fields if not in formData
        ...formData,
        country: formData.country || DEFAULT_COUNTRY,
        updatedAt: now,
        updatedBy: staffId,
        updatedByName: staffName,
        createdBy: formData.createdBy || staffId,
        createdByName: (formData as any).createdByName || staffName
      } as Vendor

      if (needsApproval) {
        vendorToSave.status = 'pending_review'
      }

      await vendorService.updateVendor(vendorToSave)

      if (needsApproval) {
        await approvalService.submitApprovalRequest({
          requestType: isNew ? 'vendor_create' : 'vendor_update',
          recordType: 'vendor',
          recordId: vendorToSave.id,
          recordName: vendorToSave.name,
          submittedByStaffId: staffId,
          submittedByName: staffName,
          riskLevel: 'medium',
          beforeSnapshot: oldVendor || null,
          afterSnapshot: vendorToSave
        })

        void staffAuditService.logAction({
          eventType: 'APPROVAL_SUBMITTED',
          module: 'vendor',
          action: `Submitted vendor ${
            isNew ? 'creation' : 'update'
          } for approval`,
          severity: 'info',
          recordType: 'vendor',
          recordId: vendorToSave.id,
          recordName: vendorToSave.name
        })

        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: 'Vendor submitted for approval.',
          type: 'info'
        })
      } else {
        analyticsService.logEvent({
          eventType: isNew ? 'VENDOR_CREATED' : 'VENDOR_UPDATED',
          actorType: getSessionRole(session),
          actorName: staffName,
          vendorId: vendorToSave.id,
          vendorName: vendorToSave.name,
          details: { action: isNew ? 'creation' : 'update' }
        })

        try {
          if (oldVendor) {
            await staffAuditService.logUpdate(
              'vendor',
              'vendor',
              vendorToSave.id,
              vendorToSave.name,
              oldVendor,
              vendorToSave
            )
            if (oldVendor.status !== vendorToSave.status) {
              await staffAuditService.logAction({
                eventType: 'RECORD_UPDATED',
                module: 'vendor',
                action: `Vendor status changed from ${oldVendor.status} to ${vendorToSave.status}`,
                severity: 'warning',
                recordType: 'vendor',
                recordId: vendorToSave.id,
                recordName: vendorToSave.name
              })
            }
          } else {
            await staffAuditService.logCreate(
              'vendor',
              'vendor',
              vendorToSave.id,
              vendorToSave.name,
              vendorToSave
            )
          }
          if (
            oldVendor &&
            (oldVendor.rpnId !== vendorToSave.rpnId ||
              oldVendor.assignedRPNId !== vendorToSave.assignedRPNId)
          ) {
            await staffAuditService.logAction({
              eventType: 'RECORD_UPDATED',
              module: 'vendor',
              action: 'Assigned/Reassigned vendor to RPN',
              severity: 'high',
              recordType: 'vendor',
              recordId: vendorToSave.id,
              recordName: vendorToSave.name
            })
          }
          if (
            oldVendor &&
            oldVendor.assignedStaffId !== vendorToSave.assignedStaffId
          ) {
            await staffAuditService.logAction({
              eventType: 'RECORD_UPDATED',
              module: 'vendor',
              action: 'Personnel assignment changed',
              severity: 'info',
              recordType: 'vendor_assignment',
              recordId: vendorToSave.id,
              recordName: vendorToSave.name,
              afterSnapshot: {
                assignedStaffId: vendorToSave.assignedStaffId,
                assignedStaffName: vendorToSave.assignedStaffName,
                assignedMemberStaffCode: vendorToSave.assignedMemberStaffCode,
                assignedMemberRole: vendorToSave.assignedMemberRole,
                assignedMemberDesk: vendorToSave.assignedMemberDesk
              }
            })
          }
          if (
            vendorToSave.campaignCode &&
            (!oldVendor || oldVendor.campaignCode !== vendorToSave.campaignCode)
          ) {
            await staffAuditService.logAction({
              eventType: 'RECORD_UPDATED',
              module: 'analytics',
              action: `Attributed vendor to campaign ${vendorToSave.campaignCode}`,
              severity: 'info',
              recordType: 'vendor_campaign_attribution',
              recordId: vendorToSave.id,
              recordName: vendorToSave.name,
              afterSnapshot: {
                campaignCode: vendorToSave.campaignCode,
                campaignSource: vendorToSave.campaignSource,
                heardAboutUsVia: vendorToSave.heardAboutUsVia
              }
            })
          }
        } catch (auditErr) {
          console.error('Audit log failed', auditErr)
        }

        try {
          const readinessSettings = await settingsService.getSettings()
          await vendorReadinessService.ensureReadinessTask(
            vendorToSave,
            [],
            readinessSettings,
            'Vendor was saved. Product upload is handled separately through Excel and product workflows.'
          )
        } catch (readinessErr) {
          console.warn('Vendor readiness automation failed', readinessErr)
        }
      }

      if ((vendorToSave as any).prospectId) {
        const prospectId = (vendorToSave as any).prospectId
        const prospects = rpnService.getProspects()
        const prospect = prospects.find(p => p.id === prospectId)

        if (prospect && prospect.pipelineStage !== 'Onboarded') {
          const updatedProspect: any = {
            ...prospect,
            pipelineStage: 'Onboarded',
            status: 'Converted',
            conversionDate: now,
            stageUpdatedAt: now,
            stageUpdatedBy: staffName,
            lastActivityDate: now,
            lastActivityNote: `Converted to Vendor ${
              vendorToSave.systemCode || vendorToSave.name
            }`,
            updatedAt: now,
            stageHistory: [
              ...(prospect.stageHistory || []),
              {
                stage: 'Onboarded',
                enteredAt: now,
                enteredByStaffId: staffId,
                enteredByStaffName: staffName,
                notes: `Converted to Vendor ${
                  vendorToSave.systemCode || vendorToSave.name
                }`,
                fromStage: prospect.pipelineStage
              }
            ],
            activityHistory: [
              ...(prospect.activityHistory || []),
              {
                id: `PA-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 5)}`,
                prospectId: prospect.id,
                actionType: 'CONVERTED',
                actionLabel: 'Converted to Vendor',
                note: `Vendor System Code: ${
                  vendorToSave.systemCode || vendorToSave.name
                }`,
                createdBy: staffName,
                createdByRole: getSessionRole(session),
                createdAt: now
              }
            ]
          }
          rpnService.saveProspect(updatedProspect)

          void staffAuditService.logAction({
            eventType: 'RPN_PIPELINE_UPDATED',
            module: 'rpn',
            severity: 'high',
            action: `Converted prospect ${prospect.id} to Vendor`,
            recordId: prospect.id,
            afterSnapshot: { newStage: 'Onboarded', vendorId: vendorToSave.id }
          })
        }
      }

      await loadData()
      vendorDraft.clearDraft()
      setHasCheckedDraftRecovery(false)
      setDraftDecisionMade(false)
      if (!needsApproval) {
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: navigator.onLine
            ? 'Vendor saved successfully. Products can be uploaded later using Excel.'
            : 'Saved to this device. It will sync when internet returns. Products can be uploaded later using Excel.',
          type: 'success'
        })
      }
      if (!navigator.onLine) {
        offlineSyncService.enqueue({
          module: 'vendor',
          operation: isNew ? 'create_vendor' : 'update_vendor',
          recordId: vendorToSave.id,
          payload: { name: vendorToSave.name }
        })
      }
      setView('list')
    } catch (error) {
      console.error('Save vendor error:', error)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: error instanceof Error ? error.message : 'Save failed',
        type: 'error'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleBranchAdd = () => {
    const newBranch: Branch = {
      id: generateEntityId('BR'),
      name: 'New Branch Location',
      phone: '',
      whatsapp: '', // Default to empty string
      country: formData.country || DEFAULT_COUNTRY,
      province: formData.province || '',
      cityTown: formData.cityTown || '',
      district: '',
      suburb: '',
      streetAddress: '',
      address: '',
      landmark: '',
      managerName: '',
      openingHours: '08:00 - 17:00',
      isDefault: formData.branches?.length === 0,
      status: 'active'
    }
    setFormData({
      ...formData,
      branches: [...(formData.branches || []), newBranch]
    })
  }

  const handleBranchUpdate = (branchId: string, updates: Partial<Branch>) => {
    const updatedBranches = (formData.branches || []).map(b =>
      b.id === branchId ? { ...b, ...updates } : b
    )
    setFormData({ ...formData, branches: updatedBranches })
  }

  const handleBranchDelete = (branchId: string) => {
    setFormData({
      ...formData,
      branches: (formData.branches || []).filter(b => b.id !== branchId)
    })
  }

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Only image files are allowed.',
        type: 'warning'
      })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'File exceeds 8MB limit.',
        type: 'warning'
      })
      return
    }

    setLogoStatus('Optimizing...')
    try {
      const optimizedBlob = await optimizeImageToWebP(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.86
      })
      if (optimizedBlob.size > 200 * 1024) {
        console.warn(
          `Optimized logo is still quite large: ${(
            optimizedBlob.size / 1024
          ).toFixed(1)}KB`
        )
      }
      setLogoStatus('Uploading...')
      const vendorId = formData.id || generateEntityId('VEND')
      if (!formData.id) setFormData(prev => ({ ...prev, id: vendorId }))
      const url = await vendorService.uploadVendorLogo(vendorId, optimizedBlob)
      setFormData(prev => ({ ...prev, logoAssetUrl: url }))
      setLogoStatus('Uploaded')
      setTimeout(() => setLogoStatus(''), 3000)

      try {
        void staffAuditService.logAction({
          eventType: 'RECORD_UPDATED',
          module: 'vendor',
          severity: 'high',
          action: 'Updated vendor identity assets',
          recordType: 'vendor',
          recordId: vendorId,
          recordName: formData.name
        })
      } catch (e) {}
    } catch (error) {
      console.error('Logo upload failed', error)
      setLogoStatus('Failed')
    }
  }

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Only image files are allowed.',
        type: 'warning'
      })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'File exceeds 8MB limit.',
        type: 'warning'
      })
      return
    }

    setBannerStatus('Optimizing...')
    try {
      const optimizedBlob = await optimizeImageToWebP(file, {
        maxWidth: 1600,
        maxHeight: 700,
        quality: 0.86
      })
      if (optimizedBlob.size > 500 * 1024) {
        console.warn(
          `Optimized banner is still quite large: ${(
            optimizedBlob.size / 1024
          ).toFixed(1)}KB`
        )
      }
      setBannerStatus('Uploading...')
      const vendorId = formData.id || generateEntityId('VEND')
      if (!formData.id) setFormData(prev => ({ ...prev, id: vendorId }))
      const url = await vendorService.uploadVendorBanner(
        vendorId,
        optimizedBlob
      )
      setFormData(prev => ({ ...prev, bannerAssetUrl: url }))
      setBannerStatus('Uploaded')
      setTimeout(() => setBannerStatus(''), 3000)

      try {
        void staffAuditService.logAction({
          eventType: 'RECORD_UPDATED',
          module: 'vendor',
          severity: 'high',
          action: 'Updated vendor identity assets',
          recordType: 'vendor',
          recordId: vendorId,
          recordName: formData.name
        })
      } catch (e) {}
    } catch (error) {
      console.error('Banner upload failed', error)
      setBannerStatus('Failed')
    }
  }

  const providerReadinessWarnings = (provider: Partial<IDeliverProvider>) => {
    const warnings: string[] = []
    if (!provider.providerName?.trim()) warnings.push('Provider name required')
    if (!provider.phoneNumber?.trim() && !provider.whatsappNumber?.trim()) {
      warnings.push('Phone or WhatsApp required')
    }
    if (!provider.driverLicenseNumber?.trim())
      warnings.push('Driver license required')
    if (provider.vehicleType && !provider.vehicleNumber?.trim()) {
      warnings.push('Vehicle number required')
    }
    if (!provider.nationalIdNumber?.trim())
      warnings.push('National ID required')
    if (!provider.policeClearanceCertificateUrl?.trim()) {
      warnings.push('Police clearance recommended before verification')
    }
    return warnings
  }

  const addDeliveryProvider = () => {
    const now = new Date().toISOString()
    const vendorId = formData.id || generateEntityId('VEND')
    if (!formData.id) setFormData(prev => ({ ...prev, id: vendorId }))
    const provider: IDeliverProvider = {
      id: generateEntityId('IDEL'),
      vendorId,
      providerName: '',
      phoneNumber: '',
      whatsappNumber: '',
      driverLicenseNumber: '',
      vehicleNumber: '',
      vehicleType: '',
      policeClearanceCertificateUrl: '',
      nationalIdNumber: '',
      address: '',
      country: formData.country || DEFAULT_COUNTRY,
      province: formData.province || '',
      cityTown: formData.cityTown || '',
      district: formData.district || '',
      suburb: formData.suburb || '',
      status: 'pending',
      notes: '',
      createdAt: now,
      updatedAt: now
    }
    setFormData(prev => ({
      ...prev,
      id: vendorId,
      deliveryProviders: [...(prev.deliveryProviders || []), provider]
    }))
    void staffAuditService.logAction({
      eventType: 'RECORD_CREATED',
      module: 'vendor',
      severity: 'info',
      action: 'iDeliver provider added',
      recordType: 'ideliver_provider',
      recordId: provider.id,
      recordName: provider.providerName || 'Pending provider'
    })
  }

  const updateDeliveryProvider = (
    providerId: string,
    patch: Partial<IDeliverProvider>
  ) => {
    setFormData(prev => ({
      ...prev,
      deliveryProviders: (prev.deliveryProviders || []).map(provider =>
        provider.id === providerId
          ? { ...provider, ...patch, updatedAt: new Date().toISOString() }
          : provider
      )
    }))
    if (patch.status) {
      void staffAuditService.logAction({
        eventType: 'RECORD_UPDATED',
        module: 'vendor',
        severity: patch.status === 'suspended' ? 'high' : 'info',
        action: `iDeliver provider ${patch.status}`,
        recordType: 'ideliver_provider',
        recordId: providerId
      })
    }
  }

  const removeDeliveryProvider = (providerId: string) => {
    setFormData(prev => ({
      ...prev,
      deliveryProviders: (prev.deliveryProviders || []).filter(
        provider => provider.id !== providerId
      )
    }))
  }

  const handlePoliceClearanceUpload = async (
    providerId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    const allowed =
      file.type.startsWith('image/') || file.type === 'application/pdf'
    if (!allowed) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Police clearance must be a PDF or image file.',
        type: 'warning'
      })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'File exceeds 8MB limit.',
        type: 'warning'
      })
      return
    }
    const vendorId = formData.id || generateEntityId('VEND')
    setProviderUploadStatus(prev => ({ ...prev, [providerId]: 'Uploading...' }))
    try {
      const url = await vendorService.uploadDeliveryProviderDocument(
        vendorId,
        providerId,
        file,
        file.name
      )
      if (!formData.id) setFormData(prev => ({ ...prev, id: vendorId }))
      updateDeliveryProvider(providerId, {
        vendorId,
        policeClearanceCertificateUrl: url
      })
      setProviderUploadStatus(prev => ({ ...prev, [providerId]: 'Uploaded' }))
      void staffAuditService.logAction({
        eventType: 'RECORD_UPDATED',
        module: 'vendor',
        severity: 'info',
        action: 'Police clearance uploaded',
        recordType: 'ideliver_provider',
        recordId: providerId
      })
    } catch (error) {
      console.error('Police clearance upload failed', error)
      setProviderUploadStatus(prev => ({ ...prev, [providerId]: 'Failed' }))
    }
  }

  const duplicates = useMemo(() => {
    if (
      view !== 'form' ||
      (!formData.name &&
        !formData.tradingName &&
        !formData.catalogueDisplayName)
    )
      return []
    // Filter out the current vendor we are editing
    const otherVendors = vendors.filter(v => v.id !== formData.id)
    return findSimilarVendors(formData, otherVendors)
  }, [
    formData.name,
    formData.tradingName,
    formData.catalogueDisplayName,
    vendors,
    view,
    formData.id
  ])

  const hasCriticalDuplicate = duplicates.some(
    d => d.similarity.level === 'exact' || d.similarity.level === 'high'
  )
  const canManagerOverride = permissionService.canApprove('vendor')
  const isSaveBlocked = hasCriticalDuplicate && !isManagerOverride

  const handleOverrideRequest = async () => {
    const session = requireActiveSession()
    if (!session) return
    try {
      await approvalService.submitApprovalRequest({
        requestType: 'Duplicate Vendor Override',
        recordType: 'vendor',
        recordId: formData.id || 'new',
        submittedByStaffId: getSessionStaffId(session),
        submittedByName: getSessionStaffName(session),
        riskLevel: 'medium',
        beforeSnapshot: null,
        afterSnapshot: formData
      })
      setFormSuccess(
        'Override approval submitted to managers. You will be notified when reviewed.'
      )
      setTimeout(() => setView('list'), 2000)
    } catch (e) {
      console.error(e)
      setFormError('Failed to submit approval request.')
    }
  }

  const getActiveVendorName = () =>
    selectedVendor?.tradingName ||
    selectedVendor?.name ||
    formData.tradingName ||
    formData.name ||
    'Vendor'

  const handleDownloadProductTemplate = () => {
    const rows = [
      {
        SKU: '',
        'Product Name': '',
        'Opening QTY': 0,
        'Vendor Receipts': 0,
        'Vendor Sales': 0,
        'Current Product QTY': 0,
        Notes: '',
        'Vendor Name': getActiveVendorName(),
        'Product Mode': 'linked_product',
        'Master Product ID': '',
        'Vendor Product/Offer ID': '',
        Branch: '',
        'Selling Price': 0,
        'Buying Price': 0,
        'Publish To Catalogue': 'Yes',
        Status: 'active',
        'Last Updated': '',
        Description: '',
        'Image URL': ''
      }
    ] as any

    exportVendorProductRows(rows, getActiveVendorName(), 'Vendor-Inventory-Template')
  }

  const handleExportVendorProductsPlaceholder = () => {
    showBrandedAlert({
      title: 'seiGEN Commerce',
      message:
        'No product rows are loaded in Vendor Onboarding. Use Product Management, Storefront Builder, or Vendor Product Sheet workflows to export existing products.',
      type: 'info'
    })
  }

  const handleImportProductsPlaceholder = () => {
    showBrandedAlert({
      title: 'seiGEN Commerce',
      message: 'Import Product Excel: Coming Soon',
      type: 'info'
    })
  }

  const handleGenerateVendorBill = () => {
    if (!selectedVendor) {
      showBrandedAlert({
        message: 'Save or select a vendor before generating a bill.',
        type: 'warning'
      })
      return
    }
    const result = vendorBillingService.generateInvoice({
      vendor: selectedVendor,
      plan: activeVendorPlan,
      dueDate: selectedVendor.subscriptionDueDate,
      includeCompletedJobs: true,
      notes: 'Generated from Vendor Management.'
    })
    showBrandedAlert({
      message: `Generated vendor bill ${result.invoice.invoiceNumber}.`,
      type: 'success'
    })
  }

  const handlePrintLatestVendorBill = () => {
    if (!selectedVendor) return
    const invoice = vendorBillingService
      .getInvoices()
      .filter(item => item.vendorId === selectedVendor.id)
      .sort(
        (a, b) =>
          Number(b.balanceDue > 0) - Number(a.balanceDue > 0) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]
    if (!invoice) {
      showBrandedAlert({
        message: 'No vendor bill exists yet. Generate a bill first.',
        type: 'info'
      })
      return
    }
    printVendorInvoice(invoice, selectedVendor)
  }

  const handleAddVendorJob = () => {
    if (!selectedVendor) {
      showBrandedAlert({
        message: 'Save or select a vendor before adding a job.',
        type: 'warning'
      })
      return
    }
    const description = window.prompt(
      'Vendor job description',
      'Manual charge'
    )
    if (!description) return
    const amountText = window.prompt('Unit price / charge amount', '0')
    const amount = Number(amountText || 0)
    vendorBillingService.saveJob({
      vendorId: selectedVendor.id,
      vendorName: activeVendorName,
      jobType: 'manual_charge',
      description,
      requestedBy: getSessionStaffName(getSession(), 'SCI Staff'),
      status: 'completed',
      jobDate: new Date().toISOString().slice(0, 10),
      quantity: 1,
      unitPrice: Number.isFinite(amount) ? amount : 0,
      taxable: false,
      taxRate: 0
    })
    showBrandedAlert({
      message: 'Vendor job saved. It can be attached to the next bill.',
      type: 'success'
    })
  }

  if (isLoadingData) {
    return (
      <div className="pb-20 min-w-0 max-w-full overflow-x-hidden flex items-center justify-center pt-20">
        <div className="text-center text-stone-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest">Loading Records...</p>
        </div>
      </div>
    )
  }

  if (view === 'form') {
    const currentStaff = currentAssignedStaff
    const vendorLogo =
      formData.logoAssetUrl ||
      formData.logoUrl ||
      formData.businessLogoUrl ||
      ''
    const vendorBanner =
      formData.bannerAssetUrl ||
      formData.bannerUrl ||
      formData.businessBannerUrl ||
      ''
    const productInventoryPanel = (
      <DataPanel
        title='Vendor Product & Inventory Sheet'
        subtitle='Link master products, create branded vendor products, and reconcile inventory.'
        className='border-t-4 border-t-brand-orange'
      >
        <div className='p-6 space-y-5 min-w-0'>
          <div className='border border-stone-200 bg-stone-50 p-4 min-w-0'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
              <div className='min-w-0'>
                <p className='text-xs font-bold uppercase text-brand-charcoal'>
                  Product & Inventory Sheet
                </p>
                <p className='mt-2 text-[10px] font-bold uppercase text-stone-500'>
                  Link from Master Product Library / Create Branded Vendor
                  Product / Export Vendor Inventory Excel / Import Vendor
                  Inventory Excel/CSV.
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <span className='border border-stone-200 bg-white px-2 py-1 text-[9px] font-black uppercase text-stone-600'>
                    Linked master products: searchable library
                  </span>
                  <span className='border border-stone-200 bg-white px-2 py-1 text-[9px] font-black uppercase text-stone-600'>
                    Branded vendor products: vendor owned
                  </span>
                  <span className='border border-stone-200 bg-white px-2 py-1 text-[9px] font-black uppercase text-stone-600'>
                    Offers loaded: {activeVendorProductOffers.length}
                  </span>
                </div>
              </div>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[420px]'>
                <PrimaryButton
                  onClick={() => setIsProductSheetOpen(true)}
                  disabled={!activeVendorId}
                >
                  <Package size={14} className='mr-2 inline' /> Open Product &
                  Inventory Sheet
                </PrimaryButton>
                <SecondaryButton
                  onClick={handleExportActiveVendorInventory}
                  disabled={
                    !activeVendorId || activeVendorProductOffers.length === 0
                  }
                >
                  <Download size={14} className='mr-2 inline' /> Export Vendor
                  Inventory Excel
                </SecondaryButton>
                <SecondaryButton onClick={handleDownloadProductTemplate}>
                  <Download size={14} className='mr-2 inline' /> Download
                  Inventory Template
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => setIsProductSheetOpen(true)}
                  disabled={!activeVendorId}
                >
                  <Upload size={14} className='mr-2 inline' /> Import Vendor
                  Inventory Excel/CSV
                </SecondaryButton>
              </div>
            </div>
            <div className='mt-4 grid grid-cols-1 gap-2 text-[9px] font-bold uppercase text-stone-500 sm:grid-cols-2 lg:grid-cols-4'>
              <div className='border border-stone-200 bg-white p-2'>
                Opening QTY
              </div>
              <div className='border border-stone-200 bg-white p-2'>
                Vendor Receipts
              </div>
              <div className='border border-stone-200 bg-white p-2'>
                Vendor Sales
              </div>
              <div className='border border-stone-200 bg-white p-2'>
                Current Product QTY + Notes
              </div>
            </div>
          </div>
        </div>
      </DataPanel>
    )
    const billingPanel = selectedVendor ? (
      <DataPanel
        title='Vendor Billing & Service Jobs'
        subtitle='Generate bills, print vendor invoices, review receivables and log chargeable service jobs.'
        className='border-t-4 border-t-brand-orange'
      >
        <div className='p-6 space-y-4'>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'>
            <PrimaryButton onClick={handleGenerateVendorBill}>
              <FileText size={14} className='mr-2 inline' /> Generate Bill
            </PrimaryButton>
            <SecondaryButton onClick={handlePrintLatestVendorBill}>
              <Printer size={14} className='mr-2 inline' /> Print Vendor Bill
            </SecondaryButton>
            <SecondaryButton
              onClick={() => window.location.assign('/finance/vendor-bills')}
            >
              <DollarSign size={14} className='mr-2 inline' /> View Billing
              History
            </SecondaryButton>
            <SecondaryButton
              onClick={() => window.location.assign('/finance/vendor-bills')}
            >
              <DollarSign size={14} className='mr-2 inline' /> Record Payment
            </SecondaryButton>
            <SecondaryButton onClick={handleAddVendorJob}>
              <Briefcase size={14} className='mr-2 inline' /> Add Vendor Job
            </SecondaryButton>
          </div>
          <div className='grid grid-cols-1 gap-2 text-[9px] font-bold uppercase text-stone-500 sm:grid-cols-4'>
            <div className='border border-stone-200 bg-white p-2'>
              Plan: {activeVendorPlan?.name || 'No active plan'}
            </div>
            <div className='border border-stone-200 bg-white p-2'>
              Subscription: {selectedVendor.subscriptionStatus || 'unknown'}
            </div>
            <div className='border border-stone-200 bg-white p-2'>
              Due Date: {selectedVendor.subscriptionDueDate || 'not set'}
            </div>
            <div className='border border-stone-200 bg-white p-2'>
              Billing Route: /finance/vendor-bills
            </div>
          </div>
        </div>
      </DataPanel>
    ) : null
    return (
      <div className='space-y-8 pb-32 min-w-0 max-w-full overflow-x-hidden'>
        <BrandedAlertModal
          {...alertConfig}
          onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        />
        <VendorProductOfferSheet
          open={isProductSheetOpen}
          onClose={() => setIsProductSheetOpen(false)}
          vendorId={activeVendorId}
          vendorName={activeVendorName}
          lockVendor
          masterProducts={masterProducts}
          plans={plans}
          vendors={vendors}
          existingOffers={vendorProductOffers}
          onSaved={handleVendorProductSheetSaved}
        />

        <div className='flex flex-col gap-4 bg-stone-50 p-6 border border-stone-200 min-w-0 sm:flex-row sm:items-center sm:justify-between'>
          <button
            onClick={() => setView('list')}
            className='flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal transition-colors'
          >
            <ChevronRight size={14} className='rotate-180' /> Back to Registry
          </button>
          <div className='text-center'>
            <h3 className='text-sm font-bold uppercase tracking-tight text-brand-charcoal'>
              {selectedVendor
                ? `Edit Vendor: ${formData.id}`
                : 'Add New Vendor'}
            </h3>
            <p className='text-[9px] font-mono text-stone-400 uppercase mt-0.5'>
              Backend Management
            </p>
          </div>
          {permissionService.canEdit('vendorManagement') && (
            <PrimaryButton
              onClick={saveVendor}
              disabled={isSaving || isSaveBlocked}
              className={`flex items-center gap-2 ${
                !permissionService.canEdit('vendorManagement') ||
                isSaving ||
                isSaveBlocked
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              <Save size={14} />{' '}
              {isSaving
                ? 'Saving...'
                : navigator.onLine
                ? 'Save Changes'
                : 'Save Locally'}
            </PrimaryButton>
          )}
        </div>

        {showDraftPrompt && (
          <div className='fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4'>
            <div className='w-full max-w-md border-2 border-brand-orange bg-white p-5 shadow-2xl'>
              <h3 className='text-sm font-black uppercase text-brand-charcoal'>
                Unsaved draft found
              </h3>
              <p className='mt-2 text-xs font-bold text-stone-600'>
                Resume or discard the vendor form draft saved on this device?
              </p>
              <div className='mt-5 flex gap-3'>
                <PrimaryButton
                  type="button"
                  className='flex-1'
                  onClick={() => {
                    vendorDraft.restoreDraft()
                    setDraftDecisionMade(true)
                    setShowDraftPrompt(false)
                  }}
                >
                  Resume
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  className='flex-1'
                  onClick={() => {
                    vendorDraft.discardDraft()
                    setDraftDecisionMade(true)
                    setShowDraftPrompt(false)
                  }}
                >
                  Discard
                </SecondaryButton>
              </div>
            </div>
          </div>
        )}

        {selectedVendor && productInventoryPanel}
        {billingPanel}

        <div className='grid grid-cols-1 gap-8 min-w-0 xl:[grid-template-columns:minmax(0,2fr)_minmax(0,1fr)]'>
          <div className='min-w-0 space-y-8'>
            {formError && (
              <div className='p-4 border-l-4 border-red-500 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-widest flex items-center gap-2'>
                <AlertTriangle size={16} /> {formError}
              </div>
            )}
            {formSuccess && (
              <div className='p-4 border-l-4 border-emerald-500 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-widest flex items-center gap-2'>
                <CheckCircle2 size={16} /> {formSuccess}
              </div>
            )}

            {/* Duplicate Intelligence */}
            {duplicates.length > 0 && (
              <DataPanel
                title='Duplicate Intelligence'
                className='border-t-4 border-t-red-500 shadow-sm bg-red-50/30'
              >
                <div className='p-6 space-y-4'>
                  <div className='flex gap-3 text-red-600'>
                    <AlertTriangle size={20} className='shrink-0' />
                    <div>
                      <h4 className='text-sm font-bold uppercase'>
                        Potential Duplicates Detected
                      </h4>
                      <p className='text-xs text-stone-600 mt-1'>
                        The following registry records share strong naming
                        similarities with your input.
                      </p>
                    </div>
                  </div>
                  <div className='space-y-3 mt-4'>
                    {duplicates.map((dup, idx) => (
                      <div
                        key={idx}
                        className='p-4 border border-red-200 bg-white flex flex-col md:flex-row gap-4 justify-between md:items-center'
                      >
                        <div>
                          <p className='text-xs font-bold uppercase text-brand-charcoal'>
                            {dup.record.name}{' '}
                            <span className='text-[10px] text-stone-400 font-mono'>
                              [{dup.record.systemCode}]
                            </span>
                          </p>
                          <p
                            className={`text-[10px] font-bold mt-1 uppercase ${
                              dup.similarity.level === 'exact' ||
                              dup.similarity.level === 'high'
                                ? 'text-red-500'
                                : 'text-stone-500'
                            }`}
                          >
                            Match: {dup.similarity.score}% -{' '}
                            {dup.similarity.level} ({dup.similarity.reason})
                          </p>
                        </div>
                        <div className='flex flex-wrap gap-2 shrink-0'>
                          <SecondaryButton
                            size='sm'
                            onClick={() => startEditVendor(dup.record)}
                          >
                            Use Existing Vendor
                          </SecondaryButton>
                          <SecondaryButton
                            size='sm'
                            onClick={() => startEditVendor(dup.record)}
                          >
                            Create Branch Instead
                          </SecondaryButton>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasCriticalDuplicate && !isManagerOverride && (
                    <div className='flex gap-3 mt-6 pt-4 border-t border-red-200'>
                      {!canManagerOverride ? (
                        <PrimaryButton
                          size='sm'
                          onClick={handleOverrideRequest}
                        >
                          Submit Override Approval
                        </PrimaryButton>
                      ) : (
                        <PrimaryButton
                          size='sm'
                          onClick={() => setIsManagerOverride(true)}
                        >
                          Continue Anyway (Manager Override)
                        </PrimaryButton>
                      )}
                    </div>
                  )}
                </div>
              </DataPanel>
            )}

            {/* Basic Identity */}
            <DataPanel title='General Information'>
              <div className='p-6 grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(320px,1fr))] gap-6 min-w-0'>
                <div className='space-y-1.5 md:col-span-2'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Legal Business Name
                  </label>
                  <input
                    value={formData.name || ''}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50/50'
                    placeholder='IDENTIFY BUSINESS ENTITY'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Trading Name / Alias
                  </label>
                  <input
                    value={formData.tradingName || ''}
                    onChange={e =>
                      setFormData({ ...formData, tradingName: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Sector Classification
                  </label>
                  <SearchableComboBox
                    value={formData.sector || ''}
                    options={sectorOptions}
                    getOptionLabel={sector => sector}
                    getOptionValue={sector => sector}
                    getOptionSearchText={sector => sector}
                    onSelect={sector =>
                      setFormData({ ...formData, sector: sector || '' })
                    }
                    placeholder='Search or select sector...'
                    allowAddNew
                    onAddNew={sector => {
                      setNewSector(sector)
                      void taxonomyService.addSector(sector).then(sectors => {
                        setSharedSectors(sectors)
                        setFormData(prev => ({ ...prev, sector }))
                      })
                    }}
                  />
                  <div className='flex gap-2'>
                    <input
                      value={newSector}
                      onChange={e => setNewSector(e.target.value)}
                      className='min-w-0 flex-1 border border-stone-200 p-2 text-[10px] uppercase outline-none focus:border-brand-orange'
                      placeholder='+ Add New Sector'
                    />
                    <button
                      type='button'
                      onClick={() => void addCustomSector()}
                      className='border border-brand-orange px-3 text-[10px] font-bold uppercase text-brand-orange'
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Principal Owner
                  </label>
                  <input
                    value={formData.ownerFullName || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        ownerFullName: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Business Type
                  </label>
                  <input
                    list='vendor-business-type-options'
                    value={formData.businessType || ''}
                    onChange={e =>
                      setFormData({ ...formData, businessType: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-white'
                    placeholder='Search or select type...'
                  />
                  <datalist id='vendor-business-type-options'>
                    {businessTypeOptions.map(type => (
                      <option key={type} value={type} />
                    ))}
                  </datalist>
                  <div className='flex gap-2'>
                    <input
                      value={newBusinessType}
                      onChange={e => setNewBusinessType(e.target.value)}
                      className='min-w-0 flex-1 border border-stone-200 p-2 text-[10px] uppercase outline-none focus:border-brand-orange'
                      placeholder='+ Add New Business Type'
                    />
                    <button
                      type='button'
                      onClick={() => void addCustomBusinessType()}
                      className='border border-brand-orange px-3 text-[10px] font-bold uppercase text-brand-orange'
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Main Phone (Primary)
                  </label>
                  <input
                    value={formData.mainPhone || ''}
                    onChange={e =>
                      setFormData({ ...formData, mainPhone: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold font-mono focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    WhatsApp (Automated Orders)
                  </label>
                  <input
                    value={formData.whatsappNumber || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        whatsappNumber: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold font-mono focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Business Email Address
                  </label>
                  <input
                    value={formData.email || ''}
                    onChange={e =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='space-y-1.5 md:col-span-2'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Business Summary / Capability
                  </label>
                  <textarea
                    value={formData.businessDescription || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        businessDescription: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-medium focus:border-brand-orange outline-none h-20 resize-none'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    WhatsApp Group Link
                  </label>
                  <input
                    value={formData.whatsappGroupLink || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        whatsappGroupLink: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs focus:border-brand-orange outline-none font-mono'
                    placeholder='https://chat.whatsapp.com/...'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    WhatsApp Channel Link
                  </label>
                  <input
                    value={formData.whatsappChannelLink || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        whatsappChannelLink: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs focus:border-brand-orange outline-none font-mono'
                    placeholder='https://whatsapp.com/channel/...'
                  />
                </div>
              </div>
            </DataPanel>

            <DataPanel
              title='iDeliver / Verified Delivery Provider'
              subtitle='Register delivery providers connected to this vendor profile.'
              actions={
                <SecondaryButton onClick={addDeliveryProvider} size='sm'>
                  <PlusCircle size={14} className='mr-2' /> Add Provider
                </SecondaryButton>
              }
            >
              <div className='p-6 space-y-4 min-w-0'>
                {(formData.deliveryProviders || []).length === 0 ? (
                  <div className='border border-dashed border-stone-200 p-6 text-center'>
                    <p className='text-xs font-bold uppercase text-stone-400'>
                      No iDeliver providers registered.
                    </p>
                  </div>
                ) : (
                  (formData.deliveryProviders || []).map(provider => {
                    const warnings = providerReadinessWarnings(provider)
                    return (
                      <div
                        key={provider.id}
                        className='border border-stone-200 bg-white p-4 space-y-4 min-w-0'
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <p className='text-xs font-bold uppercase text-brand-charcoal'>
                              {provider.providerName || 'New Delivery Provider'}
                            </p>
                            <p className='text-[10px] uppercase text-stone-400'>
                              {warnings.length
                                ? `${warnings.length} readiness warning(s)`
                                : 'Ready for verification'}
                            </p>
                          </div>
                          <button
                            type='button'
                            onClick={() => removeDeliveryProvider(provider.id)}
                            className='text-red-500 hover:bg-red-50 p-2'
                            title='Remove provider'
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {warnings.length > 0 && (
                          <div className='border border-orange-100 bg-orange-50 p-3 text-[10px] font-bold uppercase text-brand-orange'>
                            {warnings.join(' / ')}
                          </div>
                        )}

                        <div className='grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] gap-4'>
                          {[
                            ['providerName', 'Provider Name *'],
                            ['phoneNumber', 'Phone Number *'],
                            ['whatsappNumber', 'WhatsApp Number'],
                            ['driverLicenseNumber', 'Driver License *'],
                            ['vehicleNumber', 'Vehicle Number'],
                            ['vehicleType', 'Vehicle Type'],
                            ['nationalIdNumber', 'National ID *'],
                            ['address', 'Address'],
                            ['country', 'Country'],
                            ['province', 'Province'],
                            ['cityTown', 'City / Town'],
                            ['district', 'District'],
                            ['suburb', 'Suburb']
                          ].map(([field, label]) => (
                            <label key={field} className='space-y-1.5'>
                              <span className='text-[10px] uppercase font-bold text-stone-400'>
                                {label}
                              </span>
                              <input
                                value={String((provider as any)[field] || '')}
                                onChange={e =>
                                  updateDeliveryProvider(provider.id, {
                                    [field]: e.target.value
                                  } as Partial<IDeliverProvider>)
                                }
                                className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                              />
                            </label>
                          ))}
                          <label className='space-y-1.5'>
                            <span className='text-[10px] uppercase font-bold text-stone-400'>
                              Status
                            </span>
                            <select
                              value={provider.status}
                              onChange={e =>
                                updateDeliveryProvider(provider.id, {
                                  status: e.target
                                    .value as IDeliverProvider['status']
                                })
                              }
                              className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-white'
                            >
                              <option value='pending'>Pending</option>
                              <option value='verified'>Verified</option>
                              <option value='suspended'>Suspended</option>
                            </select>
                          </label>
                          <label className='space-y-1.5 md:col-span-2'>
                            <span className='text-[10px] uppercase font-bold text-stone-400'>
                              Notes
                            </span>
                            <textarea
                              value={provider.notes || ''}
                              onChange={e =>
                                updateDeliveryProvider(provider.id, {
                                  notes: e.target.value
                                })
                              }
                              className='w-full border-2 border-stone-200 p-2.5 text-xs font-medium focus:border-brand-orange outline-none h-20 resize-none'
                            />
                          </label>
                        </div>

                        <div className='border border-stone-200 bg-stone-50 p-4'>
                          <div className='flex flex-col md:flex-row md:items-center justify-between gap-3'>
                            <div>
                              <p className='text-[10px] font-bold uppercase text-stone-500'>
                                Police Clearance Certificate Copy
                              </p>
                              {provider.policeClearanceCertificateUrl ? (
                                <a
                                  href={provider.policeClearanceCertificateUrl}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-[10px] font-bold uppercase text-brand-orange underline'
                                >
                                  View uploaded document
                                </a>
                              ) : (
                                <p className='text-[10px] text-stone-400'>
                                  PDF or image. Recommended before verification.
                                </p>
                              )}
                            </div>
                            <label className='inline-flex cursor-pointer items-center gap-2 border border-brand-orange px-3 py-2 text-[10px] font-bold uppercase text-brand-orange'>
                              <Upload size={12} /> Upload
                              <input
                                type='file'
                                accept='application/pdf,image/*'
                                className='hidden'
                                onChange={event =>
                                  void handlePoliceClearanceUpload(
                                    provider.id,
                                    event
                                  )
                                }
                              />
                            </label>
                          </div>
                          {providerUploadStatus[provider.id] && (
                            <p className='mt-2 text-[10px] uppercase text-stone-500'>
                              {providerUploadStatus[provider.id]}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </DataPanel>

            {/* Identity Assets */}
            <DataPanel title='Identity Assets'>
              <div className='p-6 space-y-6 min-w-0'>
                <div className='grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] gap-6 min-w-0'>
                  {/* Logo Upload */}
                  <div className='border-2 border-stone-100 p-4 bg-stone-50/30 min-w-0'>
                    <h4 className='text-[10px] uppercase font-bold text-stone-400 mb-3 flex items-center gap-1.5'>
                      <ImageIcon size={12} /> Vendor Logo
                    </h4>
                    <div className='flex gap-4 items-start'>
                      <div className='w-20 h-20 bg-white border-2 border-stone-200 flex items-center justify-center overflow-hidden shrink-0'>
                        {vendorLogo ? (
                          <img
                            src={vendorLogo}
                            className='w-full h-full object-contain'
                            alt='Logo'
                            onError={e => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <span className='text-[8px] uppercase font-bold text-stone-300 text-center'>
                            No Logo
                            <br />
                            Uploaded
                          </span>
                        )}
                      </div>
                      <div className='flex-1 min-w-0 space-y-2'>
                        <input
                          type='file'
                          accept='image/*'
                          onChange={handleLogoSelect}
                          className='hidden'
                          id='logo-upload'
                        />
                        <label
                          htmlFor='logo-upload'
                          className='inline-flex items-center gap-2 bg-brand-charcoal text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest cursor-pointer hover:bg-brand-orange transition-colors'
                        >
                          <Upload size={10} /> Select Logo
                        </label>
                        {logoStatus && (
                          <p className='text-[9px] font-bold text-brand-orange uppercase'>
                            {logoStatus}
                          </p>
                        )}
                        {vendorLogo && (
                          <button
                            type='button'
                            onClick={() =>
                              setFormData(prev => ({
                                ...prev,
                                logoUrl: '',
                                logoAssetUrl: '',
                                businessLogoUrl: ''
                              }))
                            }
                            className='block text-[9px] text-red-500 hover:text-red-700 uppercase font-bold mt-2'
                          >
                            Remove Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Banner Upload */}
                  <div className='border-2 border-stone-100 p-4 bg-stone-50/30 min-w-0'>
                    <h4 className='text-[10px] uppercase font-bold text-stone-400 mb-3 flex items-center gap-1.5'>
                      <ImageIcon size={12} /> Vendor Banner
                    </h4>
                    <div className='flex gap-4 items-start flex-col sm:flex-row'>
                      <div className='w-full sm:w-32 h-16 bg-white border-2 border-stone-200 flex items-center justify-center overflow-hidden shrink-0'>
                        {vendorBanner ? (
                          <img
                            src={vendorBanner}
                            className='w-full h-full object-cover'
                            alt='Banner'
                            onError={e => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <span className='text-[8px] uppercase font-bold text-stone-300 text-center'>
                            No Banner
                            <br />
                            Uploaded
                          </span>
                        )}
                      </div>
                      <div className='flex-1 min-w-0 space-y-2 w-full'>
                        <input
                          type='file'
                          accept='image/*'
                          onChange={handleBannerSelect}
                          className='hidden'
                          id='banner-upload'
                        />
                        <label
                          htmlFor='banner-upload'
                          className='inline-flex items-center gap-2 bg-brand-charcoal text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest cursor-pointer hover:bg-brand-orange transition-colors'
                        >
                          <Upload size={10} /> Select Banner
                        </label>
                        {bannerStatus && (
                          <p className='text-[9px] font-bold text-brand-orange uppercase'>
                            {bannerStatus}
                          </p>
                        )}
                        {vendorBanner && (
                          <button
                            type='button'
                            onClick={() =>
                              setFormData(prev => ({
                                ...prev,
                                bannerUrl: '',
                                bannerAssetUrl: '',
                                businessBannerUrl: ''
                              }))
                            }
                            className='block text-[9px] text-red-500 hover:text-red-700 uppercase font-bold mt-2'
                          >
                            Remove Banner
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='pt-4 border-t border-stone-100'>
                  <button
                    type='button'
                    onClick={() => setShowManualUrls(!showManualUrls)}
                    className='text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal transition-colors flex items-center gap-1'
                  >
                    {showManualUrls ? 'Hide' : 'Show'} Advanced: Paste URL
                    Manually
                  </button>
                  {showManualUrls && (
                    <div className='grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] gap-4 mt-4 p-4 bg-stone-50 border border-stone-200 min-w-0'>
                      <div className='space-y-1.5'>
                        <label className='text-[10px] uppercase font-bold text-stone-400'>
                          Logo Asset URL
                        </label>
                        <input
                          value={formData.logoUrl || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              logoUrl: e.target.value
                            })
                          }
                          className='w-full border-2 border-stone-200 p-2.5 text-xs font-mono focus:border-brand-orange outline-none'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[10px] uppercase font-bold text-stone-400'>
                          Banner Asset URL
                        </label>
                        <input
                          value={formData.bannerUrl || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              bannerUrl: e.target.value
                            })
                          }
                          className='w-full border-2 border-stone-200 p-2.5 text-xs font-mono focus:border-brand-orange outline-none'
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DataPanel>

            {/* Geographic Mapping */}
            <DataPanel title='Locations'>
              <div className='p-6 grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-6 font-mono min-w-0'>
                <div className='md:col-span-1 space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400 font-sans'>
                    Country
                  </label>
                  <SearchableCountrySelect
                    value={formData.country || DEFAULT_COUNTRY}
                    onChange={country => setFormData({ ...formData, country })}
                    className='w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50'
                  />
                </div>
                <div className='md:col-span-1 space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400 font-sans'>
                    Province
                  </label>
                  <input
                    value={formData.province || ''}
                    onChange={e =>
                      setFormData({ ...formData, province: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='md:col-span-1 space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400 font-sans'>
                    City / Town
                  </label>
                  <input
                    value={formData.cityTown || ''}
                    onChange={e =>
                      setFormData({ ...formData, cityTown: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='md:col-span-1 space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400 font-sans'>
                    District
                  </label>
                  <input
                    value={formData.district || ''}
                    onChange={e =>
                      setFormData({ ...formData, district: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='md:col-span-1 space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400 font-sans'>
                    Suburb
                  </label>
                  <input
                    value={formData.suburb || ''}
                    onChange={e =>
                      setFormData({ ...formData, suburb: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='md:col-span-3 space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400 font-sans'>
                    GPS / Location Notes
                  </label>
                  <input
                    value={formData.gpsNotes || ''}
                    onChange={e =>
                      setFormData({ ...formData, gpsNotes: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  />
                </div>
                <div className='md:col-span-4 space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400 font-sans'>
                    Full Physical Address Specification
                  </label>
                  <input
                    value={formData.streetAddress || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        streetAddress: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none font-sans'
                  />
                </div>
              </div>
            </DataPanel>

            {/* Branch Management */}
            <DataPanel
              title='Branches'
              actions={
                <button
                  onClick={handleBranchAdd}
                  className='bg-brand-charcoal text-white px-3 py-1 text-[9px] font-bold uppercase flex items-center gap-1.5 transition-opacity hover:opacity-90'
                >
                  <Plus size={10} /> Add Branch
                </button>
              }
            >
              <div className='p-0 border-t border-stone-100 divide-y divide-stone-100'>
                {(formData.branches || []).map((branch, index) => (
                  <div key={branch.id} className='p-6 space-y-4 bg-stone-50/30'>
                    <div className='grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-4 min-w-0'>
                      <div className='space-y-1.5 md:col-span-2'>
                        <label className='text-[9px] uppercase font-bold text-stone-400'>
                          Branch Identity
                        </label>
                        <input
                          value={branch.name}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              name: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none focus:border-brand-orange'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400'>
                          Branch Status
                        </label>
                        <select
                          value={branch.status}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              status: e.target.value as any
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none'
                        >
                          <option value='active'>ACTIVE</option>
                          <option value='suspended'>SUSPENDED</option>
                        </select>
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400'>
                          Primary Branch
                        </label>
                        <button
                          onClick={() =>
                            handleBranchUpdate(branch.id, {
                              isDefault: !branch.isDefault
                            })
                          }
                          className={`w-full px-3 py-1.5 text-[9px] font-bold uppercase border h-[34px] ${
                            branch.isDefault
                              ? 'bg-brand-charcoal text-white border-brand-charcoal'
                              : 'bg-white text-stone-400 border-stone-200'
                          }`}
                        >
                          {branch.isDefault
                            ? 'SYSTEM DEFAULT'
                            : 'SET AS DEFAULT'}
                        </button>
                      </div>
                    </div>

                    <div className='grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-4'>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400 font-mono italic'>
                          Country
                        </label>
                        <SearchableCountrySelect
                          value={
                            branch.country ||
                            formData.country ||
                            DEFAULT_COUNTRY
                          }
                          onChange={country =>
                            handleBranchUpdate(branch.id, { country })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400 font-mono italic'>
                          Province
                        </label>
                        <input
                          value={branch.province}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              province: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400 font-mono italic'>
                          City / Town
                        </label>
                        <input
                          value={branch.cityTown}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              cityTown: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400 font-mono italic'>
                          District
                        </label>
                        <input
                          value={branch.district}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              district: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400 font-mono italic'>
                          Suburb
                        </label>
                        <input
                          value={branch.suburb}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              suburb: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono'
                        />
                      </div>
                    </div>

                    <div className='grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-4 min-w-0'>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400'>
                          Branch Manager
                        </label>
                        <input
                          value={branch.managerName}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              managerName: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400'>
                          Opening Hours
                        </label>
                        <input
                          value={branch.openingHours}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              openingHours: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none'
                          placeholder='e.g. 08:00 - 17:00'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400 font-mono italic'>
                          Phone
                        </label>
                        <input
                          value={branch.phone}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              phone: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold outline-none font-mono'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400 font-mono italic text-green-600'>
                          WhatsApp
                        </label>
                        <input
                          value={branch.whatsapp}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              whatsapp: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold outline-none font-mono'
                        />
                      </div>
                    </div>

                    <div className='grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-4'>
                      <div className='md:col-span-2 space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400'>
                          Physical Address
                        </label>
                        <input
                          value={branch.streetAddress || branch.address}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              address: e.target.value,
                              streetAddress: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none'
                        />
                      </div>
                      <div className='space-y-1.5'>
                        <label className='text-[9px] uppercase font-bold text-stone-400'>
                          Landmark
                        </label>
                        <input
                          value={branch.landmark || ''}
                          onChange={e =>
                            handleBranchUpdate(branch.id, {
                              landmark: e.target.value
                            })
                          }
                          className='w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none'
                        />
                      </div>
                      <div className='space-y-1.5 flex justify-end items-end pb-1.5'>
                        <button
                          onClick={() => handleBranchDelete(branch.id)}
                          className='text-[9px] font-bold uppercase text-red-400 hover:text-red-700 transition-colors flex items-center gap-1'
                        >
                          <Trash2 size={10} /> Delete Branch
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {(formData.branches || []).length === 0 && (
                  <div className='p-12 text-center text-stone-300'>
                    <Store size={32} className='mx-auto mb-4 opacity-20' />
                    <p className='text-[10px] font-bold uppercase italic tracking-widest'>
                      No branches configured.
                    </p>
                  </div>
                )}
              </div>
            </DataPanel>
          </div>

          <div className='min-w-0 space-y-8'>
            {/* Lifecycle and Sub */}
            <DataPanel title='Subscription & Status'>
              <div className='p-6 space-y-6 min-w-0'>
                <div className='space-y-3'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Entity Status
                  </label>
                  <div className='flex flex-wrap gap-2'>
                    {VENDOR_STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => setFormData({ ...formData, status: s })}
                        className={`px-2 py-1 text-[9px] font-bold uppercase border transition-all ${
                          formData.status === s
                            ? 'bg-brand-orange text-white border-brand-orange shadow-sm'
                            : 'bg-white text-stone-400 border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className='space-y-3 pt-6 border-t border-stone-100'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Subscription Matrix
                  </label>
                  <select
                    value={formData.planId || 'starter'}
                    onChange={e =>
                      setFormData({ ...formData, planId: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50 font-mono'
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name.toUpperCase()} TIER
                      </option>
                    ))}
                  </select>
                  <div className='flex flex-wrap gap-2 pt-2'>
                    {SUB_STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() =>
                          setFormData({ ...formData, subscriptionStatus: s })
                        }
                        className={`px-2 py-1 text-[9px] font-bold uppercase border transition-all ${
                          formData.subscriptionStatus === s
                            ? 'bg-brand-charcoal text-white border-brand-charcoal'
                            : 'bg-white text-stone-400 border-stone-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] gap-4 pt-6 border-t border-stone-100 font-mono min-w-0'>
                  <div className='space-y-1.5'>
                    <label className='text-[9px] uppercase font-bold text-stone-400 font-sans'>
                      Start Date
                    </label>
                    <input
                      type='date'
                      value={
                        formData.subscriptionStartDate?.split('T')[0] || ''
                      }
                      onChange={e =>
                        setFormData({
                          ...formData,
                          subscriptionStartDate: new Date(
                            e.target.value
                          ).toISOString()
                        })
                      }
                      className='w-full border border-stone-300 p-1.5 text-[10px] font-bold outline-none'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <label className='text-[9px] uppercase font-bold text-stone-400 font-sans'>
                      Renewal Cycle
                    </label>
                    <input
                      type='date'
                      value={formData.subscriptionDueDate?.split('T')[0] || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          subscriptionDueDate: new Date(
                            e.target.value
                          ).toISOString()
                        })
                      }
                      className='w-full border border-stone-300 p-1.5 text-[10px] font-bold outline-none'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <label className='text-[9px] uppercase font-bold text-stone-400 font-sans'>
                      Last Collection
                    </label>
                    <input
                      type='date'
                      value={formData.lastCollectionDate?.split('T')[0] || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          lastCollectionDate: new Date(
                            e.target.value
                          ).toISOString()
                        })
                      }
                      className='w-full border border-stone-300 p-1.5 text-[10px] font-bold outline-none'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <label className='text-[9px] uppercase font-bold text-stone-400 font-sans'>
                      Next Follow-up
                    </label>
                    <input
                      type='date'
                      value={formData.nextFollowUpDate?.split('T')[0] || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          nextFollowUpDate: new Date(
                            e.target.value
                          ).toISOString()
                        })
                      }
                      className='w-full border border-stone-300 p-1.5 text-[10px] font-bold outline-none'
                    />
                  </div>
                </div>

                <div className='space-y-1.5 pt-4'>
                  <label className='text-[9px] uppercase font-bold text-stone-400'>
                    Internal Collection Notes
                  </label>
                  <textarea
                    value={formData.collectionNotes || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        collectionNotes: e.target.value
                      })
                    }
                    className='w-full border border-stone-300 p-2 text-[10px] font-medium outline-none h-16 resize-none focus:border-brand-orange'
                  />
                </div>
              </div>
            </DataPanel>

            {/* Assignments */}
            <DataPanel title='Personnel Assignments'>
              <div className='p-6 space-y-6 min-w-0'>
                <div className='space-y-2'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Assigned RPN Agent
                  </label>
                  <select
                    value={formData.assignedRPNId || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        assignedRPNId: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50'
                  >
                    <option value=''>Unassigned</option>
                    {rpns.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} [{r.id}]
                      </option>
                    ))}
                  </select>
                  {formData.assignedRPNId &&
                    rpns.find(r => r.id === formData.assignedRPNId) && (
                      <div className='p-3 bg-stone-100 border border-stone-200 flex flex-col gap-1'>
                        <div className='flex items-center gap-2 text-[10px] font-bold uppercase text-stone-500'>
                          <Info size={10} className='text-brand-orange' /> RPN
                          Contact Info
                        </div>
                        <p className='text-[11px] font-bold text-stone-700'>
                          {
                            rpns.find(r => r.id === formData.assignedRPNId)
                              ?.name
                          }
                        </p>
                        <p className='text-[10px] font-mono text-stone-500'>
                          {
                            rpns.find(r => r.id === formData.assignedRPNId)
                              ?.phone
                          }
                        </p>
                      </div>
                    )}
                </div>
                <div className='space-y-2'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Assigned Staff Member
                  </label>
                  <SearchableComboBox
                    value={
                      currentStaff?.fullName ||
                      formData.assignedMemberName ||
                      ''
                    }
                    options={searchableStaff}
                    getOptionLabel={staff =>
                      [
                        staff.fullName || staff.displayName,
                        staff.role,
                        staff.desk,
                        staff.staffCode,
                        staff.email
                      ]
                        .filter(Boolean)
                        .join(' / ')
                    }
                    getOptionValue={staff => staff.id}
                    getOptionSearchText={staff =>
                      buildSearchText([
                        staff.fullName,
                        staff.displayName,
                        staff.email,
                        staff.staffCode,
                        staff.role,
                        staff.desk
                      ])
                    }
                    placeholder='Search active staff...'
                    emptyMessage='No active staff members available.'
                    onSelect={staff => {
                      setFormData({
                        ...formData,
                        assignedStaffId: staff?.id || '',
                        assignedStaffName: staff?.fullName || '',
                        assignedMemberId: staff?.id || '',
                        assignedMemberName: staff?.fullName || '',
                        assignedMemberStaffCode: staff?.staffCode || '',
                        assignedMemberRole: staff?.role || '',
                        assignedMemberDesk: staff?.desk || ''
                      })
                    }}
                  />
                  {searchableStaff.length === 0 && (
                    <p className='text-[10px] font-bold uppercase text-brand-orange'>
                      No active staff members available.
                    </p>
                  )}
                  {currentAssignedStaffIsInactive && currentStaff && (
                    <div className='border border-orange-200 bg-orange-50 p-3 text-[10px] font-bold uppercase text-brand-orange'>
                      Previously assigned staff is no longer active. Please
                      reassign to an active staff member.
                      <div className='mt-1 text-stone-600'>
                        {currentStaff.fullName} / {currentStaff.role} /{' '}
                        {currentStaff.desk} / {currentStaff.staffCode}
                      </div>
                    </div>
                  )}
                  {!currentAssignedStaffIsInactive && currentStaff && (
                    <p className='text-[10px] text-stone-500'>
                      {currentStaff.fullName} / {currentStaff.role} /{' '}
                      {currentStaff.desk} / {currentStaff.staffCode}
                    </p>
                  )}
                </div>
                <div className='space-y-2'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Source
                  </label>
                  <select
                    value={formData.dataSource || 'backend entered'}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        dataSource: e.target.value as any
                      })
                    }
                    className='w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  >
                    {DATA_SOURCES.map(d => (
                      <option key={d} value={d}>
                        {d.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='pt-6 border-t border-stone-100 space-y-4'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Campaign Attribution
                  </label>
                  <select
                    value={formData.campaignCode || ''}
                    onChange={e => {
                      const campaign = campaigns.find(
                        item => item.campaignCode === e.target.value
                      )
                      setFormData({
                        ...formData,
                        campaignCode: e.target.value,
                        campaignSource: campaign?.campaignName || ''
                      })
                    }}
                    className='w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50'
                  >
                    <option value=''>No campaign attribution</option>
                    {campaigns.map(campaign => (
                      <option key={campaign.id} value={campaign.campaignCode}>
                        {campaign.campaignName} [{campaign.campaignCode}]
                      </option>
                    ))}
                  </select>
                  <input
                    value={formData.campaignSource || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        campaignSource: e.target.value
                      })
                    }
                    placeholder='Campaign source / free text'
                    className='w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                  />
                  <select
                    value={formData.heardAboutUsVia || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        heardAboutUsVia: e.target.value as any
                      })
                    }
                    className='w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-white'
                  >
                    <option value=''>Heard about us via...</option>
                    {[
                      'Radio',
                      'TV',
                      'Roadshow',
                      'WhatsApp',
                      'Referral',
                      'CAH',
                      'Walk-in',
                      'Other'
                    ].map(source => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </DataPanel>

            <DataPanel title='System Information'>
              <div className='p-6 space-y-2 font-mono min-w-0'>
                <div className='flex justify-between text-[9px] uppercase font-bold'>
                  <span className='text-stone-400'>System Code:</span>
                  <span className='text-stone-600 tracking-wider break-all text-right'>
                    {formData.systemCode || 'PENDING ASSIGNMENT'}
                  </span>
                </div>
                <div className='flex justify-between text-[9px] uppercase font-bold'>
                  <span className='text-stone-400'>ID Specification:</span>
                  <span className='text-stone-600 break-all text-right'>
                    {formData.id}
                  </span>
                </div>
                <div className='flex justify-between text-[9px] uppercase font-bold'>
                  <span className='text-stone-400'>Created At:</span>
                  <span className='text-stone-600'>
                    {new Date(formData.createdAt || '').toLocaleString()}
                  </span>
                </div>
                <div className='flex justify-between text-[9px] uppercase font-bold border-t border-stone-100 pt-2 mt-2'>
                  <span className='text-stone-400'>Origin Staff:</span>
                  <span className='text-stone-600 break-all text-right'>
                    {formData.createdBy}
                  </span>
                </div>
              </div>
            </DataPanel>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-8 pb-20 min-w-0 max-w-full overflow-x-hidden'>
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      {/* Console Controls */}
      <div className='bg-stone-50 border border-stone-200 p-6'>
        <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6'>
          <div>
            <h3 className='text-sm font-bold uppercase tracking-tight text-brand-charcoal'>
              Vendor Management
            </h3>
            <p className='text-[10px] text-stone-400 font-mono mt-1 uppercase italic'>
              Backend System // Vendor Management
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            {permissionService.canCreate('addNewVendor') && (
              <PrimaryButton // Check both addNewVendor and general vendorManagement create
                onClick={startNewVendor}
                className='flex items-center gap-2'
              >
                <Plus size={14} /> Add New Vendor
              </PrimaryButton>
            )}
            <SecondaryButton
              onClick={downloadOnboardingForm}
              className='flex items-center gap-2'
            >
              <FileCode size={14} /> Download Onboarding Form
            </SecondaryButton>
            <SecondaryButton
              onClick={previewOnboardingForm}
              className='flex items-center gap-2'
            >
              <Info size={14} /> Preview Onboarding Form
            </SecondaryButton>
          </div>
        </div>

        {/* Advanced Filter Row */}
        <div className='grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-4 pt-6 border-t border-stone-200'>
          <SearchInput
            placeholder='Search Vendor...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='lg:col-span-1 shadow-sm'
          />
          <SearchableComboBox
            value={filterSector === 'All' ? '' : filterSector}
            options={sectorOptions}
            getOptionLabel={sector => sector}
            getOptionValue={sector => sector}
            getOptionSearchText={sector => sector}
            placeholder='All Sectors'
            onSelect={sector => setFilterSector(sector || 'All')}
          />
          <select
            value={filterRPN}
            onChange={e => setFilterRPN(e.target.value)}
            className='w-full bg-white border border-stone-200 px-6 py-1.5 text-[10px] font-bold uppercase focus:outline-none'
          >
            <option value='All'>All RPN Agents</option>
            {rpns.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} [{r.id}]
              </option>
            ))}
          </select>
          <select
            value={filterSubStatus}
            onChange={e => setFilterSubStatus(e.target.value)}
            className='w-full bg-white border border-stone-200 px-6 py-1.5 text-[10px] font-bold uppercase focus:outline-none'
          >
            <option value='All'>Sub Status</option>
            {SUB_STATUSES.map(s => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={filterVendorStatus}
            onChange={e => setFilterVendorStatus(e.target.value)}
            className='w-full bg-white border border-stone-200 px-6 py-1.5 text-[10px] font-bold uppercase focus:outline-none'
          >
            <option value='All'>Lifecycle</option>
            {VENDOR_STATUSES.map(s => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataPanel
        title='Vendors'
        subtitle={`${filtered.length} active records found`}
        headers={[
          'System Code',
          'Vendor Details',
          'Location / RPN',
          'Plan / Status',
          'Due Date',
          'Operations'
        ]}
      >
        {filtered.map(vendor => {
          const rpn = rpns.find(r => r.id === vendor.assignedRPNId)
          const vendorLogo =
            vendor.logoAssetUrl ||
            vendor.logoUrl ||
            vendor.businessLogoUrl ||
            ''
          return (
            <tr
              key={vendor.id}
              className='group hover:bg-stone-50 transition-colors'
            >
              <div className='p-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <div className='flex items-center gap-4'>
                  <div className='w-10 h-10 border border-stone-200 bg-orange-50/50 flex items-center justify-center p-1'>
                    {vendorLogo ? (
                      <img
                        src={vendorLogo}
                        className='w-full h-full object-cover grayscale opacity-80'
                        alt=''
                        onError={e => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <Store size={20} className='text-brand-charcoal' />
                    )}
                  </div>
                  <div className='flex-1'>
                    <p className='text-[10px] font-black uppercase text-brand-charcoal'>
                      {vendor.name}
                    </p>
                    <p className='text-[8px] font-mono text-stone-500 mt-0.5'>
                      {vendor.systemCode || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className='flex-1 min-w-0'>
                  <p className='text-[9px] font-bold uppercase text-stone-500'>
                    Contact
                  </p>
                  <p className='text-xs text-brand-charcoal break-words'>
                    {vendor.email}
                  </p>
                  <p className='text-xs text-brand-charcoal break-words'>
                    {vendor.mainPhone}
                  </p>
                  <p className='text-xs text-brand-charcoal break-words'>
                    {vendor.whatsappNumber}
                  </p>
                </div>

                <div className='flex-1 min-w-0'>
                  <p className='text-[9px] font-bold uppercase text-stone-500'>
                    Address
                  </p>
                  <p className='text-xs text-brand-charcoal break-words'>
                    {vendor.streetAddress}
                  </p>
                  <p className='text-xs text-brand-charcoal break-words'>
                    {vendor.cityTown}, {vendor.province}
                  </p>
                </div>

                <div className='flex-1 min-w-0'>
                  <p className='text-[9px] font-bold uppercase text-stone-500'>
                    Plan / Status
                  </p>
                  <p className='text-xs font-bold uppercase text-brand-charcoal'>
                    {plans.find(p => p.id === vendor.planId)?.name ||
                      vendor.planId}
                  </p>
                  <StatusBadge
                    status={vendor.subscriptionStatus}
                    variant={
                      vendor.subscriptionStatus === 'active'
                        ? 'success'
                        : 'warning'
                    }
                  />
                  <StatusBadge
                    status={vendor.status}
                    variant={vendor.status === 'active' ? 'success' : 'neutral'}
                    className='mt-1'
                  />
                </div>

                <div className='flex-1 min-w-0'>
                  <p className='text-[9px] font-bold uppercase text-stone-500'>
                    Due Date
                  </p>
                  <p className='text-xs font-bold text-brand-charcoal'>
                    {vendor.subscriptionDueDate
                      ? new Date(
                          vendor.subscriptionDueDate
                        ).toLocaleDateString()
                      : 'N/A'}
                  </p>
                  <p className='text-[9px] font-bold uppercase text-stone-500 mt-1'>
                    RPN
                  </p>
                  <p className='text-xs text-brand-charcoal'>
                    {rpn?.name || 'Unassigned'}
                  </p>
                </div>

                <div className='flex-shrink-0 flex gap-2'>
                  {permissionService.canEdit('vendorManagement') && (
                    <button
                      onClick={() => startEditVendor(vendor)}
                      className='p-2 border border-stone-200 text-stone-400 hover:border-brand-charcoal hover:text-brand-charcoal transition-all bg-white'
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                  {permissionService.canDelete('vendorManagement') && (
                    <button
                      onClick={() => {
                        setVendorToDelete(vendor.id)
                        setIsDeleteDialogOpen(true)
                      }}
                      className='p-2 border border-stone-200 text-stone-400 hover:border-red-600 hover:text-red-600 transition-all bg-white'
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </tr>
          )
        })}
        {filtered.length === 0 && (
          <div className='p-6'>
            <EmptyState
              title='No Vendors Found'
              description='No vendors match the current filters. Clear filters to see more.'
              icon={Layers}
              action={
                <SecondaryButton
                  onClick={() => {
                    setSearch('')
                    setFilterSector('All')
                    setFilterRPN('All')
                    setFilterSubStatus('All')
                    setFilterVendorStatus('All')
                  }}
                >
                  Clear Filters
                </SecondaryButton>
              }
            />
          </div>
        )}
      </DataPanel>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title='Confirm Vendor Deletion'
        message='Deleting this vendor will result in immediate loss of all branch data and product mappings.'
        confirmLabel='Delete Vendor'
        variant='danger'
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  )
}
