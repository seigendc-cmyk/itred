/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  PageHeader,
  DataPanel,
  TablePanel,
  PrimaryButton,
  SecondaryButton,
  SearchInput,
  SearchableComboBox,
  StatCard,
  StatusBadge,
  EmptyState
} from '../components/CommonUI.tsx'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Clipboard,
  Download,
  History,
  Map as MapIcon,
  MessageSquare,
  PackageSearch,
  Phone,
  Printer,
  Search,
  ShieldAlert,
  Star,
  UserPlus,
  Users
} from 'lucide-react'
import {
  IntelligenceSource,
  InteractionType,
  Product,
  ResolutionStatus,
  Sentiment,
  Staff,
  UrgencyLevel,
  Vendor,
  MarketTrendReport,
  VendorMarketFeedReport,
  WhatsAppActivityLog,
  WhatsAppIntelligenceLog
} from '../types.ts'
import { whatsappActivityService } from '../services/whatsappActivityService.ts'
import { vendorMarketFeedBIService } from '../services/vendorMarketFeedBIService.ts'
import { marketTrendBIService } from '../services/marketTrendBIService.ts'
import { staffService } from '../services/staffService.ts'
import { vendorService } from '../services/vendorService.ts'
import { productService } from '../services/productService.ts'
import { staffAuditService } from '../services/staffAuditService.ts'
import { permissionService } from '../services/permissionService.ts'
import { notificationService } from '../services/notificationService.ts'
import { taxonomyService } from '../services/taxonomyService.ts'
import { buildSearchText } from '../utils/searchUtils.ts'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

type IntelTab =
  | 'feed'
  | 'customer'
  | 'risks'
  | 'market'
  | 'alerts'
  | 'reputation'
  | 'regional'
  | 'product'
  | 'vendorBI'
  | 'marketBI'

const tabs: Array<{ id: IntelTab; label: string; icon: React.ElementType }> = [
  { id: 'feed', label: 'Activity Feed', icon: History },
  { id: 'customer', label: 'Customer Intelligence', icon: UserPlus },
  { id: 'risks', label: 'Complaints & Risks', icon: ShieldAlert },
  { id: 'market', label: 'Market Analytics', icon: BarChart3 },
  { id: 'alerts', label: 'Live Alerts', icon: Bell },
  { id: 'reputation', label: 'Vendor Reputation', icon: Star },
  { id: 'regional', label: 'Regional BI', icon: MapIcon },
  { id: 'product', label: 'Product Intelligence', icon: PackageSearch },
  { id: 'vendorBI', label: 'Vendor BI Report', icon: Clipboard },
  { id: 'marketBI', label: 'Market BI Reports', icon: BarChart3 }
]

const interactionTypes: InteractionType[] = [
  'Enquiry',
  'Complaint',
  'Compliment',
  'Price Request',
  'Delivery Complaint',
  'Stock Request',
  'Warranty Issue',
  'Fraud Alert',
  'Product Search',
  'Service Request',
  'Market Feedback'
]

const sources: IntelligenceSource[] = [
  'WhatsApp',
  'Call',
  'Walk-in',
  'Catalogue',
  'CAH',
  'Storefront'
]

const urgencyLevels: UrgencyLevel[] = ['Low', 'Medium', 'High', 'Critical']
const statuses: ResolutionStatus[] = [
  'Pending',
  'In Progress',
  'Resolved',
  'Escalated'
]
const sentiments: Sentiment[] = ['Positive', 'Neutral', 'Negative']

const inputClass =
  'w-full border-2 border-stone-200 bg-white p-3 text-xs font-bold uppercase outline-none rounded-none focus:border-brand-orange'

const today = () => new Date().toISOString().split('T')[0]
const asList = (value: Record<string, number>, limit = 8) =>
  Object.entries(value || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

const isComplaint = (type?: InteractionType) =>
  type === 'Complaint' ||
  type === 'Delivery Complaint' ||
  type === 'Warranty Issue' ||
  type === 'Fraud Alert'

const badgeVariant = (value?: string) => {
  if (value === 'Critical' || value === 'Escalated' || value === 'Negative')
    return 'error' as const
  if (value === 'High' || value === 'Pending' || value === 'In Progress')
    return 'warning' as const
  if (value === 'Resolved' || value === 'Positive' || value === 'Low')
    return 'success' as const
  return 'neutral' as const
}

export const WhatsAppActivityLogs: React.FC = () => {
  const [activityLogs, setActivityLogs] = useState<WhatsAppActivityLog[]>([])
  const [intelLogs, setIntelLogs] = useState<WhatsAppIntelligenceLog[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [sharedSectors, setSharedSectors] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<IntelTab>('customer')
  const [search, setSearch] = useState('')
  const [showPopupFeed, setShowPopupFeed] = useState(true)
  const [formData, setFormData] = useState<Partial<WhatsAppIntelligenceLog>>({
    source: 'WhatsApp',
    interactionType: 'Enquiry',
    urgencyLevel: 'Medium',
    resolutionStatus: 'Pending',
    sentiment: 'Neutral',
    followUpRequired: false,
    actionRequired: false,
    tags: []
  })

  // PDF Reporting State
  const [pdfConfigOpen, setPdfConfigOpen] = useState(false)
  const [pdfDateFrom, setPdfDateFrom] = useState('')
  const [pdfDateTo, setPdfDateTo] = useState('')
  const [pdfChannel, setPdfChannel] = useState<IntelligenceSource | 'All'>(
    'All'
  )
  const [pdfStatus, setPdfStatus] = useState<ResolutionStatus | 'All'>('All')
  const [pdfIncludeBi, setPdfIncludeBi] = useState(true)
  const [pdfIncludePhones, setPdfIncludePhones] = useState(false)
  const [vendorBISelectedVendorId, setVendorBISelectedVendorId] = useState('')
  const [vendorBIDateFrom, setVendorBIDateFrom] = useState('')
  const [vendorBIDateTo, setVendorBIDateTo] = useState('')
  const [vendorBISector, setVendorBISector] = useState('')
  const [vendorBIBranch, setVendorBIBranch] = useState('')
  const [marketBIDateFrom, setMarketBIDateFrom] = useState('')
  const [marketBIDateTo, setMarketBIDateTo] = useState('')
  const [marketBIVendorId, setMarketBIVendorId] = useState('')
  const [marketBIProductId, setMarketBIProductId] = useState('')
  const [marketBISector, setMarketBISector] = useState('')
  const [marketBICategory, setMarketBICategory] = useState('')
  const [marketBISuburb, setMarketBISuburb] = useState('')
  const [marketBICity, setMarketBICity] = useState('')
  const [marketBIProvince, setMarketBIProvince] = useState('')
  const [marketBICountry, setMarketBICountry] = useState('')
  const [marketBIInteractionType, setMarketBIInteractionType] = useState('')
  const [marketBISource, setMarketBISource] = useState('')
  const [marketBIBuyingIntent, setMarketBIBuyingIntent] = useState('')
  const [marketBIStatus, setMarketBIStatus] = useState('')

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('activeStaffSession') || '{}')
    } catch {
      return {}
    }
  }, [])

  const canCreate = permissionService.hasActionPermission(
    'whatsapp.logs.create'
  )
  const canViewAnalytics =
    permissionService.hasActionPermission('whatsapp.analytics.view') ||
    permissionService.canView('whatsappActivity')
  const canViewReputation = permissionService.canViewVendorReputation()

  const loadData = async () => {
    setActivityLogs(whatsappActivityService.getLogs())
    setIntelLogs(whatsappActivityService.getIntelligenceLogs())
    setStaffList(staffService.getAllStaff())
    const [nextVendors, nextProducts, nextSectors] = await Promise.all([
      vendorService.getVendors(),
      productService.getProducts(),
      taxonomyService.getSectors()
    ])
    setVendors(nextVendors)
    setProducts(nextProducts)
    setSharedSectors(nextSectors)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const commerceBI = useMemo(
    () => whatsappActivityService.calculateCommerceBI(intelLogs),
    [intelLogs]
  )
  const activeStaff = useMemo(
    () =>
      staffList.filter(
        staff =>
          (staff.status || '').toLowerCase() === 'active' &&
          staff.isLocked !== true
      ),
    [staffList]
  )
  const assignedStaff = useMemo(
    () =>
      staffList.find(staff => staff.id === formData.assignedToStaffId) || null,
    [formData.assignedToStaffId, staffList]
  )
  const assignedStaffInactive =
    !!assignedStaff &&
    ((assignedStaff.status || '').toLowerCase() !== 'active' ||
      assignedStaff.isLocked === true)

  const filteredIntelLogs = useMemo(() => {
    const terms = search.toLowerCase().split(' ').filter(Boolean)
    return intelLogs
      .filter(log => {
        const text = [
          log.customerPhone,
          log.customerName,
          log.vendorName,
          log.productName,
          log.category,
          log.sector,
          log.region,
          log.province,
          log.city,
          log.interactionType,
          log.customerMessage,
          log.internalNotes,
          ...(log.tags || [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return terms.every(term => text.includes(term))
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
  }, [intelLogs, search])

  const customerTimeline = useMemo(() => {
    if (!formData.customerPhone) return []
    return intelLogs
      .filter(log => log.customerPhone === formData.customerPhone)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
  }, [formData.customerPhone, intelLogs])

  const legacyFeed = useMemo(() => {
    const terms = search.toLowerCase().split(' ').filter(Boolean)
    return activityLogs
      .filter(log => {
        const text = [
          log.activityType,
          log.sourceName,
          log.vendorName,
          log.productName,
          log.customerNeed,
          log.cityTown,
          log.province,
          log.notes
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return terms.every(term => text.includes(term))
      })
      .sort(
        (a, b) =>
          new Date(b.activityDate).getTime() -
          new Date(a.activityDate).getTime()
      )
  }, [activityLogs, search])

  const pdfFilteredIntelLogs = useMemo(() => {
    return filteredIntelLogs.filter(log => {
      const logDate = log.createdAt.split('T')[0]
      if (pdfDateFrom && logDate < pdfDateFrom) return false
      if (pdfDateTo && logDate > pdfDateTo) return false
      if (pdfChannel !== 'All' && log.source !== pdfChannel) return false
      if (pdfStatus !== 'All' && log.resolutionStatus !== pdfStatus)
        return false
      return true
    })
  }, [filteredIntelLogs, pdfDateFrom, pdfDateTo, pdfChannel, pdfStatus])

  const pdfReportBI = useMemo(
    () => whatsappActivityService.calculateCommerceBI(pdfFilteredIntelLogs),
    [pdfFilteredIntelLogs]
  )

  const vendorBISelectedVendor = useMemo(
    () => vendors.find(vendor => vendor.id === vendorBISelectedVendorId) || null,
    [vendorBISelectedVendorId, vendors]
  )

  const vendorBIBranchOptions = useMemo(() => {
    const branches = new Set<string>()
    if (vendorBISelectedVendor) {
      ;(vendorBISelectedVendor.branches || []).forEach(branch => {
        if (branch.name) branches.add(branch.name)
      })
    }
    products
      .filter(
        product =>
          !vendorBISelectedVendorId || product.vendorId === vendorBISelectedVendorId
      )
      .forEach(product => {
        if (product.branchName) branches.add(product.branchName)
      })
    return Array.from(branches).sort()
  }, [products, vendorBISelectedVendor, vendorBISelectedVendorId])

  const vendorMarketFeedReport = useMemo(
    () =>
      vendorMarketFeedBIService.generateReport(activityLogs, intelLogs, {
        vendorId: vendorBISelectedVendorId,
        vendorName:
          vendorBISelectedVendor?.tradingName || vendorBISelectedVendor?.name,
        dateFrom: vendorBIDateFrom,
        dateTo: vendorBIDateTo,
        sector: vendorBISector,
        branch: vendorBIBranch
      }),
    [
      activityLogs,
      intelLogs,
      vendorBISelectedVendorId,
      vendorBISelectedVendor,
      vendorBIDateFrom,
      vendorBIDateTo,
      vendorBISector,
      vendorBIBranch
    ]
  )

  const marketTrendLogs = useMemo<WhatsAppActivityLog[]>(
    () => [
      ...activityLogs,
      ...intelLogs.map(log => ({
        id: log.id,
        activityDate: log.createdAt.split('T')[0],
        activityType:
          log.interactionType === 'Price Request'
            ? 'PRODUCT_ENQUIRY'
            : log.interactionType === 'Stock Request'
            ? 'DEMAND_SIGNAL'
            : log.interactionType === 'Complaint' ||
              log.interactionType === 'Delivery Complaint' ||
              log.interactionType === 'Warranty Issue' ||
              log.interactionType === 'Fraud Alert'
            ? 'COMPLAINT_RECEIVED'
            : 'CUSTOMER_REQUEST',
        sourceType: log.source === 'WhatsApp' ? 'DIRECT_WHATSAPP' : 'OTHER',
        sourceName: log.source,
        sector: log.sector,
        category: log.category,
        province: log.province,
        cityTown: log.city,
        district: log.region,
        vendorId: log.vendorId,
        vendorName: log.vendorName,
        productName: log.productName,
        customerNeed: log.customerMessage,
        leadStatus:
          log.resolutionStatus === 'Resolved'
            ? 'CONVERTED'
            : log.resolutionStatus === 'Escalated'
            ? 'LOST'
            : log.followUpRequired
            ? 'FOLLOW_UP_REQUIRED'
            : 'NEW',
        priority:
          log.urgencyLevel === 'Critical'
            ? 'CRITICAL'
            : log.urgencyLevel === 'High'
            ? 'HIGH'
            : log.urgencyLevel === 'Low'
            ? 'LOW'
            : 'MEDIUM',
        responseStatus:
          log.resolutionStatus === 'Resolved'
            ? 'RESPONDED'
            : log.resolutionStatus === 'Escalated'
            ? 'ESCALATED'
            : 'PENDING',
        loggedBy: log.loggedByStaffName,
        notes: log.internalNotes,
        followUpRequired: log.followUpRequired,
        followUpDate: log.followUpDate,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
        capturedByStaffId: log.loggedByStaffId,
        capturedByStaffName: log.loggedByStaffName,
        ...( {
          productId: log.productId,
          customerPhone: log.customerPhone,
          customerName: log.customerName,
          buyingIntent: log.interactionType,
          status: log.resolutionStatus,
          country: ''
        } as Record<string, unknown>)
      })) as WhatsAppActivityLog[]
    ],
    [activityLogs, intelLogs]
  )

  const marketSelectedVendor = useMemo(
    () => vendors.find(vendor => vendor.id === marketBIVendorId) || null,
    [marketBIVendorId, vendors]
  )

  const marketSelectedProduct = useMemo(
    () => products.find(product => product.id === marketBIProductId) || null,
    [marketBIProductId, products]
  )

  const marketTrendReport = useMemo(
    () =>
      marketTrendBIService.generateMarketTrendReport(marketTrendLogs, {
        dateFrom: marketBIDateFrom,
        dateTo: marketBIDateTo,
        vendorId: marketBIVendorId,
        productId: marketBIProductId,
        sector: marketBISector,
        category: marketBICategory,
        suburb: marketBISuburb,
        city: marketBICity,
        province: marketBIProvince,
        country: marketBICountry,
        interactionType: marketBIInteractionType,
        source: marketBISource,
        buyingIntent: marketBIBuyingIntent,
        status: marketBIStatus
      }),
    [
      marketTrendLogs,
      marketBIDateFrom,
      marketBIDateTo,
      marketBIVendorId,
      marketBIProductId,
      marketBISector,
      marketBICategory,
      marketBISuburb,
      marketBICity,
      marketBIProvince,
      marketBICountry,
      marketBIInteractionType,
      marketBISource,
      marketBIBuyingIntent,
      marketBIStatus
    ]
  )

  const marketFilterOptions = useMemo(() => {
    const setFrom = (values: Array<string | undefined>) =>
      Array.from(new Set(values.filter(Boolean) as string[])).sort()
    return {
      categories: setFrom(marketTrendLogs.map(log => log.category)),
      suburbs: setFrom(marketTrendLogs.map(log => (log as any).suburb)),
      cities: setFrom(marketTrendLogs.map(log => log.cityTown)),
      provinces: setFrom(marketTrendLogs.map(log => log.province)),
      countries: setFrom(marketTrendLogs.map(log => (log as any).country)),
      interactionTypes: setFrom(marketTrendLogs.map(log => log.activityType)),
      sources: setFrom(marketTrendLogs.map(log => log.sourceName || log.sourceType)),
      buyingIntents: setFrom(
        marketTrendLogs.map(log => (log as any).buyingIntent || log.leadStatus)
      ),
      statuses: setFrom(
        marketTrendLogs.map(log => (log as any).status || log.responseStatus)
      )
    }
  }, [marketTrendLogs])

  const handlePullCustomer = () => {
    if (!formData.customerPhone) {
      alert('Enter a customer phone number first.')
      return
    }
    const latest = customerTimeline[0]
    if (!latest) {
      alert('No existing customer intelligence records found.')
      return
    }
    setFormData(prev => ({
      ...prev,
      customerName: latest.customerName,
      region: latest.region,
      province: latest.province,
      city: latest.city,
      vendorName: latest.vendorName,
      productName: latest.productName
    }))
  }

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId)
    setFormData(prev => ({
      ...prev,
      vendorId,
      vendorName: vendor?.tradingName || vendor?.name || prev.vendorName,
      sector: vendor?.sector || prev.sector,
      province: vendor?.province || prev.province,
      city: vendor?.cityTown || prev.city,
      region: vendor?.suburb || prev.region
    }))
  }

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId)
    setFormData(prev => ({
      ...prev,
      productId,
      productName: product?.name || prev.productName,
      category: product?.category || prev.category,
      sector: product?.sector || prev.sector,
      vendorId: product?.vendorId || prev.vendorId,
      vendorName: product?.vendorName || prev.vendorName
    }))
  }

  const handleAssignStaff = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId)
    setFormData(prev => ({
      ...prev,
      assignedToStaffId: staff?.id || '',
      assignedToStaffName: staff?.displayName || staff?.fullName || ''
    }))
  }

  const resetForm = () => {
    setFormData({
      source: 'WhatsApp',
      interactionType: 'Enquiry',
      urgencyLevel: 'Medium',
      resolutionStatus: 'Pending',
      sentiment: 'Neutral',
      followUpRequired: false,
      actionRequired: false,
      tags: []
    })
  }

  const handleSaveIntel = async () => {
    if (!canCreate) {
      alert('You do not have permission to create WhatsApp logs.')
      return
    }
    if (!formData.customerPhone || !formData.interactionType) {
      alert('Customer Phone and Interaction Type are required.')
      return
    }

    const now = new Date().toISOString()
    const record: WhatsAppIntelligenceLog = {
      id: formData.id || `INTEL-${Date.now()}`,
      createdAt: formData.createdAt || now,
      updatedAt: now,
      loggedByStaffId: session.staffId || 'unknown',
      loggedByStaffName:
        session.staffName || session.displayName || 'Unknown Staff',
      customerName: formData.customerName || '',
      customerPhone: formData.customerPhone,
      vendorId: formData.vendorId || '',
      vendorName: formData.vendorName || '',
      productId: formData.productId || '',
      productName: formData.productName || '',
      category: formData.category || '',
      sector: formData.sector || '',
      region: formData.region || '',
      province: formData.province || '',
      city: formData.city || '',
      source: (formData.source as IntelligenceSource) || 'WhatsApp',
      interactionType: formData.interactionType as InteractionType,
      customerMessage: formData.customerMessage || '',
      internalNotes: formData.internalNotes || '',
      actionRequired: !!formData.actionRequired,
      urgencyLevel: (formData.urgencyLevel as UrgencyLevel) || 'Medium',
      resolutionStatus:
        (formData.resolutionStatus as ResolutionStatus) || 'Pending',
      assignedToStaffId: formData.assignedToStaffId || '',
      assignedToStaffName: formData.assignedToStaffName || '',
      followUpRequired: !!formData.followUpRequired,
      followUpDate: formData.followUpDate || '',
      tags: formData.tags || [],
      sentiment: (formData.sentiment as Sentiment) || 'Neutral'
    }

    whatsappActivityService.saveIntelligenceLog(record)
    await staffAuditService.logAction({
      eventType: formData.id
        ? 'RECORD_UPDATED'
        : 'WHATSAPP_INTELLIGENCE_LOGGED',
      module: 'whatsapp',
      severity:
        record.urgencyLevel === 'Critical' ||
        record.interactionType === 'Fraud Alert'
          ? 'critical'
          : isComplaint(record.interactionType)
          ? 'high'
          : 'info',
      action: `${
        formData.id ? 'Updated' : 'Created'
      } customer intelligence record ${record.id}`,
      recordType: 'whatsapp_intelligence',
      recordId: record.id,
      afterSnapshot: record
    })
    if (record.followUpRequired) {
      await staffAuditService.logAction({
        eventType: 'FOLLOWUP_ASSIGNED',
        module: 'whatsapp',
        severity: 'info',
        action: `Assigned follow-up for ${record.customerPhone}`,
        recordType: 'whatsapp_intelligence',
        recordId: record.id
      })
    }
    await loadData()
    resetForm()
    setActiveTab('feed')
    notificationService.toast('Customer intelligence saved.', 'success')
  }

  const handleResolve = async (log: WhatsAppIntelligenceLog) => {
    const updated = {
      ...log,
      resolutionStatus: 'Resolved' as ResolutionStatus,
      followUpRequired: false,
      updatedAt: new Date().toISOString()
    }
    whatsappActivityService.saveIntelligenceLog(updated)
    await staffAuditService.logAction({
      eventType: 'COMPLAINT_RESOLVED',
      module: 'whatsapp',
      severity: 'info',
      action: `Resolved intelligence issue ${log.id}`,
      recordType: 'whatsapp_intelligence',
      recordId: log.id,
      beforeSnapshot: log,
      afterSnapshot: updated
    })
    await loadData()
  }

  const handleEscalate = async (log: WhatsAppIntelligenceLog) => {
    const updated = {
      ...log,
      resolutionStatus: 'Escalated' as ResolutionStatus,
      urgencyLevel: 'Critical' as UrgencyLevel,
      flaggedRisk: true,
      updatedAt: new Date().toISOString()
    }
    whatsappActivityService.saveIntelligenceLog(updated)
    await staffAuditService.logAction({
      eventType: 'ISSUE_ESCALATED',
      module: 'whatsapp',
      severity: 'critical',
      action: `Escalated intelligence issue ${log.id}`,
      recordType: 'whatsapp_intelligence',
      recordId: log.id,
      beforeSnapshot: log,
      afterSnapshot: updated
    })
    await notificationService.createNotification({
      type: 'system_alert',
      priority: 'critical',
      title: 'WhatsApp Issue Escalated',
      message: `${log.interactionType} for ${
        log.vendorName || log.customerPhone
      } was escalated.`,
      recordType: 'whatsapp_intelligence',
      recordId: log.id,
      dedupeKey: `intel-escalated:${log.id}:${today()}`
    })
    await loadData()
  }

  const exportCsv = () => {
    const headers = [
      'createdAt',
      'customerPhone',
      'customerName',
      'vendorName',
      'productName',
      'category',
      'sector',
      'region',
      'province',
      'city',
      'source',
      'interactionType',
      'urgencyLevel',
      'resolutionStatus',
      'sentiment',
      'assignedToStaffName',
      'followUpDate',
      'tags',
      'customerMessage'
    ]
    const csv = [
      headers.join(','),
      ...filteredIntelLogs.map(log =>
        headers
          .map(key => {
            const value =
              key === 'tags' ? log.tags?.join('|') : (log as any)[key]
            return `"${String(value || '').replace(/"/g, '""')}"`
          })
          .join(',')
      )
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `whatsapp-intelligence-${today()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    void staffAuditService.logAction({
      eventType: 'EXPORT_DOWNLOADED',
      module: 'whatsapp',
      severity: 'info',
      action: 'Exported WhatsApp intelligence CSV',
      recordType: 'whatsapp_intelligence',
      recordId: 'csv-export'
    })
  }

  const maskPhone = (phone?: string, showFull = false) => {
    if (!phone) return '-'
    if (showFull) return phone
    if (phone.length > 7) {
      return (
        phone.substring(0, phone.length - 7) +
        ' *** ' +
        phone.substring(phone.length - 4)
      )
    }
    return '***'
  }

  const downloadPdf = () => {
    const doc = new jsPDF()
    const vendorName = pdfFilteredIntelLogs[0]?.vendorName || 'All Vendors'
    const sectorName = pdfFilteredIntelLogs[0]?.sector || 'All Sectors'

    let y = 20
    const addHeader = (title: string) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      doc.setFontSize(12)
      doc.setTextColor(255, 107, 0)
      doc.text(title, 14, y)
      doc.setDrawColor(255, 107, 0)
      doc.line(14, y + 2, 196, y + 2)
      y += 10
      doc.setTextColor(46, 46, 46)
    }

    // 1. Cover
    doc.setFontSize(16)
    doc.text('Vendor WhatsApp Activity Report', 14, y)
    y += 10
    doc.setFontSize(10)
    doc.text(`Vendor: ${vendorName}`, 14, y)
    y += 6
    doc.text(`Sector: ${sectorName}`, 14, y)
    y += 6
    doc.text(
      `Reporting period: ${pdfDateFrom || 'All time'} to ${
        pdfDateTo || 'All time'
      }`,
      14,
      y
    )
    y += 6
    doc.text(`Generated date: ${new Date().toLocaleString()}`, 14, y)
    y += 6
    doc.text(`Generated by seiGEN Commerce / iTred`, 14, y)
    y += 10

    if (pdfFilteredIntelLogs.length === 0) {
      doc.text('No WhatsApp activity records found for this period.', 14, y)
      y += 6
      doc.text(
        'BI Recommendation: Share your catalogue more frequently and engage on Access Hub.',
        14,
        y
      )
    } else {
      // 2. Exec Summary
      if (pdfIncludeBi) {
        addHeader('Executive Summary')
        doc.text(`Total interactions: ${pdfReportBI.totalInteractions}`, 14, y)
        y += 6
        doc.text(`Complaints today: ${pdfReportBI.complaintsToday}`, 14, y)
        y += 6
        doc.text(`Compliments today: ${pdfReportBI.complimentsToday}`, 14, y)
        y += 6
        doc.text(
          `Unresolved complaints: ${pdfReportBI.unresolvedComplaints}`,
          14,
          y
        )
        y += 6
        doc.text(`Follow-ups overdue: ${pdfReportBI.followUpsOverdue}`, 14, y)
        y += 6
        doc.text(`Return rate: ${pdfReportBI.returnInteractionRate}%`, 14, y)
        y += 10
      }

      // 3. Customer Feed
      addHeader('Customer WhatsApp Feed')
      const feedData = pdfFilteredIntelLogs.map(log => [
        new Date(log.createdAt).toLocaleDateString(),
        log.customerName || 'Customer',
        maskPhone(log.customerPhone, pdfIncludePhones),
        log.productName || '-',
        log.source,
        log.city || log.region || '-',
        log.customerMessage
          ? log.customerMessage.substring(0, 30) + '...'
          : '-',
        log.resolutionStatus,
        log.assignedToStaffName || '-'
      ])
      ;(doc as any).autoTable({
        startY: y,
        head: [
          [
            'Date',
            'Customer',
            'Phone',
            'Product',
            'Channel',
            'Location',
            'Message',
            'Status',
            'Staff'
          ]
        ],
        body: feedData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [255, 107, 0] }
      })
      y = (doc as any).lastAutoTable.finalY + 15

      if (pdfIncludeBi) {
        const topProducts = Object.entries(pdfReportBI.productDemand)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(e => `${e[0]}`)
          .join(', ')
        const unavailable = Object.entries(pdfReportBI.unavailableProducts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(e => `${e[0]}`)
          .join(', ')
        const complaintHeavy = Object.entries(pdfReportBI.productComplaints)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(e => `${e[0]}`)
          .join(', ')
        const topLocations = Object.entries(pdfReportBI.regionDemand)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(e => `${e[0]}`)
          .join(', ')

        // 4, 5, 6, 7, 8. Market & Intelligence
        addHeader('Market & Customer Intelligence')
        doc.text(`Most requested products: ${topProducts || 'None'}`, 14, y)
        y += 6
        doc.text(
          `Unavailable / stock requests: ${unavailable || 'None'}`,
          14,
          y
        )
        y += 6
        doc.text(`Complaint-heavy products: ${complaintHeavy || 'None'}`, 14, y)
        y += 6
        doc.text(`Locations with high demand: ${topLocations || 'None'}`, 14, y)
        y += 6
        doc.text(
          `Unresolved complaints: ${pdfReportBI.unresolvedComplaints}`,
          14,
          y
        )
        y += 6
        doc.text(`Fraud alerts: ${pdfReportBI.fraudAlerts}`, 14, y)
        y += 10

        // 9. BI Recommendations
        addHeader('BI Recommendations')
        doc.text(
          'BI Recommendation: Update stock availability for products receiving repeated enquiries.',
          14,
          y
        )
        y += 6
        if (pdfReportBI.unresolvedComplaints > 0) {
          doc.text(
            `BI Recommendation: Follow up ${pdfReportBI.unresolvedComplaints} unresolved customer complaints within 24 hours.`,
            14,
            y
          )
          y += 6
        }
        if (unavailable.length > 0) {
          doc.text(
            `BI Recommendation: Address stock gap for products: ${unavailable}.`,
            14,
            y
          )
          y += 6
        }
      }
    }

    // 10. Footer
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        'Powered by seiGEN Commerce - iTred Vendor Catalogue Engine',
        14,
        285
      )
      doc.text(
        'This report is generated from structured WhatsApp Activity records captured through commerce workflows.',
        14,
        289
      )
      doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' })
    }
    doc.save(
      `whatsapp-activity-report-${vendorName.replace(/\s+/g, '-')}-${
        pdfDateFrom || 'start'
      }-${pdfDateTo || 'end'}.pdf`
    )
  }

  const handleSendWhatsAppSummary = () => {
    const vendorName = pdfFilteredIntelLogs[0]?.vendorName || 'All Vendors'
    const summary = `WhatsApp Activity Report for ${vendorName}\nPeriod: ${
      pdfDateFrom || 'All time'
    } to ${pdfDateTo || 'All time'}\nTotal interactions: ${
      pdfReportBI.totalInteractions
    }\nNew leads: ${
      pdfFilteredIntelLogs.filter(l => l.resolutionStatus === 'Pending').length
    }\nUnresolved complaints: ${
      pdfReportBI.unresolvedComplaints
    }\nTop product: ${
      Object.keys(pdfReportBI.productDemand)[0] || 'N/A'
    }\nTop region: ${
      Object.keys(pdfReportBI.regionDemand)[0] || 'N/A'
    }\nGenerated by seiGEN Commerce.`
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank')
    setPdfConfigOpen(false)
  }

  const copyVendorBIWhatsAppSummary = async () => {
    await navigator.clipboard.writeText(vendorMarketFeedReport.whatsappSummary)
    notificationService.toast('Vendor BI WhatsApp summary copied.', 'success')
  }

  const sendVendorBIWhatsAppSummary = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        vendorMarketFeedReport.whatsappSummary
      )}`,
      '_blank'
    )
  }

  const printVendorBIReport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const reportHtml =
      document.getElementById('vendor-market-feed-report')?.innerHTML || ''
    printWindow.document.write(`
      <html>
        <head>
          <title>Vendor Market Feed BI Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #2e2e2e; padding: 24px; }
            * { box-sizing: border-box; border-radius: 0 !important; }
            .no-print { display: none !important; }
            h3, p { margin-top: 0; }
            .grid { display: block; }
            .card, [class*="border"] { border: 1px solid #ddd; margin-bottom: 12px; padding: 12px; }
          </style>
        </head>
        <body>${reportHtml}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const downloadVendorBIPdf = () => {
    const report = vendorMarketFeedReport
    const doc = new jsPDF()
    let y = 18
    const line = (text: string, size = 9) => {
      if (y > 275) {
        doc.addPage()
        y = 18
      }
      doc.setFontSize(size)
      doc.text(doc.splitTextToSize(text, 180), 14, y)
      y += Math.max(6, doc.splitTextToSize(text, 180).length * 5)
    }
    const section = (title: string) => {
      y += 4
      doc.setFontSize(12)
      doc.setTextColor(255, 107, 0)
      doc.text(title, 14, y)
      doc.setDrawColor(255, 107, 0)
      doc.line(14, y + 2, 196, y + 2)
      doc.setTextColor(46, 46, 46)
      y += 9
    }

    doc.setFontSize(16)
    doc.text('Vendor Market Feed BI Report', 14, y)
    y += 9
    line(`Vendor: ${report.vendorName}`)
    line(`Period: ${report.dateFrom || 'All time'} to ${report.dateTo || 'All time'}`)
    line(`Sector: ${report.sector || 'All sectors'} / Branch: ${report.branch || 'All branches'}`)
    section('Executive Summary')
    line(report.executiveSummary)
    section('Activity Overview')
    ;(doc as any).autoTable({
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Total interactions', report.totalInteractions],
        ['Unique customers', report.uniqueCustomers],
        ['Product enquiries', report.productEnquiries],
        ['Price enquiries', report.priceEnquiries],
        ['Stock enquiries', report.stockAvailabilityEnquiries],
        ['Confirmed orders', report.confirmedOrders],
        ['Converted leads', report.convertedLeads],
        ['Lost leads', report.lostLeads],
        ['Pending follow-ups', report.pendingFollowUps],
        ['Complaints', report.complaints],
        ['Unresolved issues', report.unresolvedIssues],
        ['Average response time', `${report.averageResponseTimeMinutes} min`],
        ['BI score', `${report.score.value}/100 (${report.score.grade})`]
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 107, 0] }
    })
    y = (doc as any).lastAutoTable.finalY + 12
    section('Demand and Risk Signals')
    ;[
      ...report.demandSignals,
      ...report.riskWarnings,
      ...report.customerHandlingWeaknesses,
      ...report.keyObservations
    ].forEach(insight => line(`${insight.title}: ${insight.message}`))
    section('Recommended Remedial Actions')
    report.remedialRecommendations.forEach(rec =>
      line(`${rec.priority.toUpperCase()}: ${rec.action} Reason: ${rec.reason}`)
    )
    section('WhatsApp Summary')
    line(report.whatsappSummary)
    doc.save(
      `vendor-market-feed-${report.vendorName.replace(/\s+/g, '-')}-${today()}.pdf`
    )
  }

  const copyMarketBIWhatsAppSummary = async () => {
    await navigator.clipboard.writeText(marketTrendReport.whatsappSummary)
    notificationService.toast('Market BI WhatsApp summary copied.', 'success')
  }

  const downloadMarketBIPdf = () => {
    const report = marketTrendReport
    const doc = new jsPDF()
    let y = 18
    const addLine = (text: string, size = 9) => {
      if (y > 275) {
        doc.addPage()
        y = 18
      }
      const lines = doc.splitTextToSize(text, 180)
      doc.setFontSize(size)
      doc.text(lines, 14, y)
      y += Math.max(6, lines.length * 5)
    }
    const section = (title: string) => {
      y += 4
      doc.setFontSize(12)
      doc.setTextColor(255, 107, 0)
      doc.text(title, 14, y)
      doc.setDrawColor(255, 107, 0)
      doc.line(14, y + 2, 196, y + 2)
      doc.setTextColor(46, 46, 46)
      y += 9
    }
    const selectedFilters = Object.entries(report.filters)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' / ')

    doc.setFontSize(16)
    doc.text('SCI / seiGEN Commerce Market Behaviour & Trend BI Report', 14, y)
    y += 9
    addLine(`Report type: Market BI Reports`)
    addLine(`Period: ${report.periodLabel}`)
    addLine(`Generated: ${new Date(report.generatedAt).toLocaleString()}`)
    addLine(`Selected filters: ${selectedFilters || 'None'}`)
    section('Executive Summary')
    addLine(report.executiveSummary)
    section('Trending Products')
    ;(doc as any).autoTable({
      startY: y,
      head: [['Product', 'Score', 'Interactions', 'Converted', 'Lost', 'Complaints']],
      body: report.trendingProducts.slice(0, 12).map(product => [
        product.productName,
        product.trendScore,
        product.totalInteractions,
        product.convertedLeads,
        product.lostLeads,
        product.complaints
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 107, 0] }
    })
    y = ((doc as any).lastAutoTable?.finalY || y) + 10
    section('Location Trends')
    ;(doc as any).autoTable({
      startY: y,
      head: [['Level', 'Location', 'Interactions', 'Conversion', 'Behaviour']],
      body: report.locationTrends.slice(0, 12).map(location => [
        location.level,
        location.name,
        location.totalInteractions,
        `${location.conversionRate}%`,
        location.dominantMarketBehaviour
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 107, 0] }
    })
    y = ((doc as any).lastAutoTable?.finalY || y) + 10
    section('Vendor Performance')
    ;(doc as any).autoTable({
      startY: y,
      head: [['Vendor', 'Score', 'Interactions', 'Customers', 'Lost', 'Complaints']],
      body: report.vendorPerformance.slice(0, 10).map(vendor => [
        vendor.vendorName,
        vendor.marketFeedScore,
        vendor.totalInteractions,
        vendor.uniqueCustomers,
        vendor.lostLeads,
        vendor.complaints
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 107, 0] }
    })
    y = ((doc as any).lastAutoTable?.finalY || y) + 10
    section('Customer Behaviour')
    report.customerBehaviour.behaviourMix.forEach(item =>
      addLine(`${item.behaviour}: ${item.count}`)
    )
    section('Complaints and Risk Signals')
    report.riskSignals.forEach(signal =>
      addLine(`${signal.severity.toUpperCase()} - ${signal.title}: ${signal.message}`)
    )
    section('Recommendations')
    report.recommendations.forEach(rec =>
      addLine(`${rec.priority.toUpperCase()}: ${rec.action} Reason: ${rec.reason}`)
    )
    doc.save(`sci-market-bi-report-${today()}.pdf`)
  }

  const renderRankList = (
    title: string,
    data: Record<string, number>,
    empty = 'No signals yet.'
  ) => (
    <DataPanel title={title} className='border-t-4 border-t-brand-orange'>
      <div className='p-4 space-y-3'>
        {asList(data).map(([name, count], index) => (
          <div
            key={name}
            className='flex items-center justify-between border border-stone-200 p-3'
          >
            <div className='min-w-0'>
              <p className='text-xs font-black uppercase text-brand-charcoal truncate'>
                {index + 1}. {name}
              </p>
              <p className='text-[10px] font-bold uppercase text-stone-400'>
                Commerce signal count
              </p>
            </div>
            <span className='font-mono text-xl font-black text-brand-orange'>
              {count}
            </span>
          </div>
        ))}
        {asList(data).length === 0 && (
          <p className='p-6 text-center text-xs font-bold uppercase text-stone-400'>
            {empty}
          </p>
        )}
      </div>
    </DataPanel>
  )

  const renderInsightList = (
    title: string,
    insights: VendorMarketFeedReport['keyObservations'],
    empty: string
  ) => (
    <DataPanel title={title} className='border-t-4 border-t-brand-orange'>
      <div className='p-4 space-y-3'>
        {insights.map(insight => (
          <div key={insight.id} className='border border-stone-200 p-3'>
            <div className='flex items-start justify-between gap-3'>
              <p className='text-xs font-black uppercase text-brand-charcoal'>
                {insight.title}
              </p>
              <StatusBadge
                status={insight.severity}
                variant={
                  insight.severity === 'critical' ||
                  insight.severity === 'high'
                    ? 'error'
                    : insight.severity === 'warning'
                    ? 'warning'
                    : 'neutral'
                }
              />
            </div>
            <p className='mt-2 text-xs font-semibold text-stone-600'>
              {insight.message}
            </p>
          </div>
        ))}
        {insights.length === 0 && (
          <p className='p-6 text-center text-xs font-bold uppercase text-stone-400'>
            {empty}
          </p>
        )}
      </div>
    </DataPanel>
  )

  const renderVendorBIReport = () => {
    const report = vendorMarketFeedReport
    const metricCards = [
      ['Total interactions', report.totalInteractions, MessageSquare],
      ['Unique customers', report.uniqueCustomers, Users],
      ['Product enquiries', report.productEnquiries, Search],
      ['Price enquiries', report.priceEnquiries, Download],
      ['Stock enquiries', report.stockAvailabilityEnquiries, PackageSearch],
      ['Confirmed orders', report.confirmedOrders, CheckCircle2],
      ['Converted leads', report.convertedLeads, Star],
      ['Lost leads', report.lostLeads, AlertTriangle],
      ['Pending follow-ups', report.pendingFollowUps, Bell],
      ['Complaints', report.complaints, ShieldAlert],
      ['Delivery complaints', report.deliveryComplaints, Phone],
      ['Warranty issues', report.warrantyIssues, AlertTriangle],
      ['Fraud alerts', report.fraudAlerts, ShieldAlert],
      ['Avg response min', report.averageResponseTimeMinutes, History],
      ['Repeat customers', report.repeatCustomerCount, Users],
      ['Unresolved issues', report.unresolvedIssues, AlertTriangle]
    ] as const

    return (
      <div className='space-y-6'>
        <DataPanel
          title='Vendor BI Report Filters'
          subtitle='Compile WhatsApp market activity by vendor, date range, sector and branch.'
          className='border-t-4 border-t-brand-orange'
        >
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 p-4'>
            <SearchableComboBox
              label='Vendor'
              value={
                vendorBISelectedVendor?.tradingName ||
                vendorBISelectedVendor?.name ||
                ''
              }
              options={vendors}
              getOptionLabel={vendor =>
                [vendor.tradingName || vendor.name, vendor.sector, vendor.cityTown]
                  .filter(Boolean)
                  .join(' / ')
              }
              getOptionValue={vendor => vendor.id}
              getOptionSearchText={vendor =>
                buildSearchText([
                  vendor.name,
                  vendor.tradingName,
                  vendor.systemCode,
                  vendor.sector,
                  vendor.cityTown,
                  vendor.province
                ])
              }
              placeholder='Select vendor...'
              emptyMessage='No vendors found.'
              onSelect={vendor => {
                setVendorBISelectedVendorId(vendor?.id || '')
                setVendorBISector(vendor?.sector || '')
                setVendorBIBranch('')
              }}
            />
            <label className='space-y-2'>
              <span className='text-[10px] font-black uppercase text-stone-400'>
                Date From
              </span>
              <input
                type='date'
                className={inputClass}
                value={vendorBIDateFrom}
                onChange={e => setVendorBIDateFrom(e.target.value)}
              />
            </label>
            <label className='space-y-2'>
              <span className='text-[10px] font-black uppercase text-stone-400'>
                Date To
              </span>
              <input
                type='date'
                className={inputClass}
                value={vendorBIDateTo}
                onChange={e => setVendorBIDateTo(e.target.value)}
              />
            </label>
            <label className='space-y-2'>
              <span className='text-[10px] font-black uppercase text-stone-400'>
                Sector
              </span>
              <select
                className={inputClass}
                value={vendorBISector}
                onChange={e => setVendorBISector(e.target.value)}
              >
                <option value=''>All Sectors</option>
                {sharedSectors.map(sector => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </label>
            <label className='space-y-2'>
              <span className='text-[10px] font-black uppercase text-stone-400'>
                Branch
              </span>
              <select
                className={inputClass}
                value={vendorBIBranch}
                onChange={e => setVendorBIBranch(e.target.value)}
              >
                <option value=''>All Branches</option>
                {vendorBIBranchOptions.map(branch => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </DataPanel>

        <div id='vendor-market-feed-report' className='space-y-6'>
          <DataPanel
            title='Executive Summary'
            subtitle={`${report.vendorName} / ${
              report.dateFrom || 'All time'
            } to ${report.dateTo || 'All time'}`}
            actions={
              <div className='no-print flex flex-wrap gap-2'>
                <SecondaryButton size='sm' onClick={printVendorBIReport}>
                  <Printer size={12} className='mr-1' /> Print
                </SecondaryButton>
                <SecondaryButton size='sm' onClick={downloadVendorBIPdf}>
                  <Download size={12} className='mr-1' /> PDF
                </SecondaryButton>
                <SecondaryButton size='sm' onClick={copyVendorBIWhatsAppSummary}>
                  <Clipboard size={12} className='mr-1' /> Copy
                </SecondaryButton>
                <PrimaryButton size='sm' onClick={sendVendorBIWhatsAppSummary}>
                  <MessageSquare size={12} className='mr-1' /> WhatsApp
                </PrimaryButton>
              </div>
            }
            className='border-t-4 border-t-brand-orange'
          >
            <div className='p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-5'>
              <div>
                <p className='text-sm font-bold text-brand-charcoal'>
                  {report.executiveSummary}
                </p>
                <p className='mt-3 border-l-4 border-brand-orange pl-3 text-xs font-semibold text-stone-600'>
                  {report.score.summary}
                </p>
              </div>
              <div className='border-2 border-brand-charcoal p-4 text-center'>
                <p className='text-[10px] font-black uppercase text-stone-400'>
                  Vendor Market Feed Score
                </p>
                <p className='mt-2 font-mono text-4xl font-black text-brand-orange'>
                  {report.score.value}
                </p>
                <p className='text-xs font-black uppercase text-brand-charcoal'>
                  Grade {report.score.grade}
                </p>
              </div>
            </div>
          </DataPanel>

          <div className='grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4'>
            {metricCards.map(([label, value, Icon]) => (
              <StatCard
                key={label}
                label={label}
                value={value}
                icon={Icon}
                variant={
                  label.includes('Fraud') ||
                  label.includes('Lost') ||
                  label.includes('Unresolved')
                    ? Number(value) > 0
                      ? 'error'
                      : 'neutral'
                    : 'neutral'
                }
              />
            ))}
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <DataPanel title='Top Product Demand'>
              <div className='p-4 space-y-3'>
                {report.topRequestedProducts.map(item => (
                  <div
                    key={item.name}
                    className='flex items-center justify-between border border-stone-200 p-3'
                  >
                    <span className='truncate text-xs font-black uppercase text-brand-charcoal'>
                      {item.name}
                    </span>
                    <span className='font-mono text-lg font-black text-brand-orange'>
                      {item.count}
                    </span>
                  </div>
                ))}
                {report.topRequestedProducts.length === 0 && (
                  <p className='p-6 text-center text-xs font-bold uppercase text-stone-400'>
                    No product demand captured.
                  </p>
                )}
              </div>
            </DataPanel>
            <DataPanel title='Top Requested Categories'>
              <div className='p-4 space-y-3'>
                {report.topRequestedCategories.map(item => (
                  <div
                    key={item.name}
                    className='flex items-center justify-between border border-stone-200 p-3'
                  >
                    <span className='truncate text-xs font-black uppercase text-brand-charcoal'>
                      {item.name}
                    </span>
                    <span className='font-mono text-lg font-black text-brand-orange'>
                      {item.count}
                    </span>
                  </div>
                ))}
                {report.topRequestedCategories.length === 0 && (
                  <p className='p-6 text-center text-xs font-bold uppercase text-stone-400'>
                    No category demand captured.
                  </p>
                )}
              </div>
            </DataPanel>
            <DataPanel title='Top Customer Locations'>
              <div className='p-4 space-y-3'>
                {report.topCustomerLocations.map(item => (
                  <div
                    key={item.name}
                    className='flex items-center justify-between border border-stone-200 p-3'
                  >
                    <span className='truncate text-xs font-black uppercase text-brand-charcoal'>
                      {item.name}
                    </span>
                    <span className='font-mono text-lg font-black text-brand-orange'>
                      {item.count}
                    </span>
                  </div>
                ))}
                {report.topCustomerLocations.length === 0 && (
                  <p className='p-6 text-center text-xs font-bold uppercase text-stone-400'>
                    No location signal captured.
                  </p>
                )}
              </div>
            </DataPanel>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {renderInsightList(
              'Demand Signals',
              report.demandSignals,
              'No major demand threshold crossed.'
            )}
            {renderInsightList(
              'Customer Handling Performance',
              report.customerHandlingWeaknesses,
              'No response or follow-up weakness detected.'
            )}
            {renderInsightList(
              'Complaints and Risk Signals',
              report.riskWarnings,
              'No active complaint risk threshold crossed.'
            )}
            {renderInsightList(
              'Lost Opportunities',
              report.keyObservations,
              'No lost opportunity threshold crossed.'
            )}
          </div>

          <DataPanel
            title='BI Score'
            subtitle='Rule-based score weighted by demand, conversion, handling and risk.'
          >
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 p-4'>
              {[
                ['Demand', report.score.demandScore],
                ['Conversion', report.score.conversionScore],
                ['Handling', report.score.handlingScore],
                ['Risk Control', report.score.riskScore]
              ].map(([label, value]) => (
                <div key={label} className='border border-stone-200 p-4'>
                  <p className='text-[10px] font-black uppercase text-stone-400'>
                    {label}
                  </p>
                  <p className='mt-2 font-mono text-2xl font-black text-brand-charcoal'>
                    {value}/100
                  </p>
                </div>
              ))}
            </div>
          </DataPanel>

          <DataPanel title='Recommended Remedial Actions'>
            <div className='p-4 space-y-3'>
              {report.remedialRecommendations.map(rec => (
                <div key={rec.id} className='border-2 border-stone-200 p-4'>
                  <div className='flex items-start justify-between gap-3'>
                    <p className='text-sm font-black uppercase text-brand-charcoal'>
                      {rec.action}
                    </p>
                    <StatusBadge
                      status={rec.priority}
                      variant={
                        rec.priority === 'critical' || rec.priority === 'high'
                          ? 'error'
                          : rec.priority === 'medium'
                          ? 'warning'
                          : 'neutral'
                      }
                    />
                  </div>
                  <p className='mt-2 text-xs font-semibold text-stone-600'>
                    {rec.reason}
                  </p>
                  {rec.owner && (
                    <p className='mt-2 text-[10px] font-black uppercase text-stone-400'>
                      Owner: {rec.owner}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </DataPanel>

          <DataPanel title='WhatsApp Summary'>
            <div className='p-4'>
              <p className='border border-stone-200 bg-stone-50 p-4 text-sm font-bold text-brand-charcoal'>
                {report.whatsappSummary}
              </p>
            </div>
          </DataPanel>
        </div>
      </div>
    )
  }

  const renderSelectFilter = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: string[],
    allLabel: string
  ) => (
    <label className='space-y-2'>
      <span className='text-[10px] font-black uppercase text-stone-400'>
        {label}
      </span>
      <select
        className={inputClass}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value=''>{allLabel}</option>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )

  const renderMarketBIReports = () => {
    const report: MarketTrendReport = marketTrendReport
    const selectedFilters = Object.values(report.filters).filter(Boolean).length

    return (
      <div className='space-y-6'>
        <DataPanel
          title='Market BI Report Filters'
          subtitle='Analyse products, locations, customers, vendors, lost opportunities and risk signals.'
          className='border-t-4 border-t-brand-orange'
        >
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4'>
            <label className='space-y-2'>
              <span className='text-[10px] font-black uppercase text-stone-400'>
                Date From
              </span>
              <input
                type='date'
                className={inputClass}
                value={marketBIDateFrom}
                onChange={e => setMarketBIDateFrom(e.target.value)}
              />
            </label>
            <label className='space-y-2'>
              <span className='text-[10px] font-black uppercase text-stone-400'>
                Date To
              </span>
              <input
                type='date'
                className={inputClass}
                value={marketBIDateTo}
                onChange={e => setMarketBIDateTo(e.target.value)}
              />
            </label>
            <SearchableComboBox
              label='Vendor'
              value={marketSelectedVendor?.tradingName || marketSelectedVendor?.name || ''}
              options={vendors}
              getOptionLabel={vendor =>
                [vendor.tradingName || vendor.name, vendor.sector, vendor.cityTown]
                  .filter(Boolean)
                  .join(' / ')
              }
              getOptionValue={vendor => vendor.id}
              getOptionSearchText={vendor =>
                buildSearchText([
                  vendor.name,
                  vendor.tradingName,
                  vendor.systemCode,
                  vendor.sector,
                  vendor.cityTown,
                  vendor.province
                ])
              }
              placeholder='All vendors...'
              emptyMessage='No vendors found.'
              onSelect={vendor => {
                setMarketBIVendorId(vendor?.id || '')
                setMarketBISector(vendor?.sector || marketBISector)
              }}
            />
            <SearchableComboBox
              label='Product'
              value={marketSelectedProduct?.name || ''}
              options={products}
              getOptionLabel={product =>
                [product.name, product.vendorName, product.category, product.sector]
                  .filter(Boolean)
                  .join(' / ')
              }
              getOptionValue={product => product.id}
              getOptionSearchText={product =>
                buildSearchText([
                  product.name,
                  product.productName,
                  product.vendorName,
                  product.category,
                  product.sector,
                  product.sku,
                  product.productCode
                ])
              }
              placeholder='All products...'
              emptyMessage='No products found.'
              onSelect={product => {
                setMarketBIProductId(product?.id || '')
                setMarketBICategory(product?.category || marketBICategory)
                setMarketBISector(product?.sector || marketBISector)
              }}
            />
            {renderSelectFilter(
              'Sector',
              marketBISector,
              setMarketBISector,
              sharedSectors,
              'All sectors'
            )}
            {renderSelectFilter(
              'Category',
              marketBICategory,
              setMarketBICategory,
              marketFilterOptions.categories,
              'All categories'
            )}
            {renderSelectFilter(
              'Suburb',
              marketBISuburb,
              setMarketBISuburb,
              marketFilterOptions.suburbs,
              'All suburbs'
            )}
            {renderSelectFilter(
              'City',
              marketBICity,
              setMarketBICity,
              marketFilterOptions.cities,
              'All cities'
            )}
            {renderSelectFilter(
              'Province',
              marketBIProvince,
              setMarketBIProvince,
              marketFilterOptions.provinces,
              'All provinces'
            )}
            {renderSelectFilter(
              'Country',
              marketBICountry,
              setMarketBICountry,
              marketFilterOptions.countries,
              'All countries'
            )}
            {renderSelectFilter(
              'Interaction Type',
              marketBIInteractionType,
              setMarketBIInteractionType,
              marketFilterOptions.interactionTypes,
              'All types'
            )}
            {renderSelectFilter(
              'Source',
              marketBISource,
              setMarketBISource,
              marketFilterOptions.sources,
              'All sources'
            )}
            {renderSelectFilter(
              'Buying Intent',
              marketBIBuyingIntent,
              setMarketBIBuyingIntent,
              marketFilterOptions.buyingIntents,
              'All intent'
            )}
            {renderSelectFilter(
              'Status',
              marketBIStatus,
              setMarketBIStatus,
              marketFilterOptions.statuses,
              'All status'
            )}
          </div>
        </DataPanel>

        <DataPanel
          title='Executive Summary'
          subtitle={`${report.periodLabel} / ${selectedFilters} active filters`}
          actions={
            <div className='flex flex-wrap gap-2'>
              <SecondaryButton size='sm' onClick={downloadMarketBIPdf}>
                <Download size={12} className='mr-1' /> Download PDF
              </SecondaryButton>
              <PrimaryButton size='sm' onClick={copyMarketBIWhatsAppSummary}>
                <Clipboard size={12} className='mr-1' /> Copy WhatsApp Summary
              </PrimaryButton>
            </div>
          }
          className='border-t-4 border-t-brand-orange'
        >
          <div className='p-5'>
            <p className='text-sm font-bold text-brand-charcoal'>
              {report.executiveSummary}
            </p>
            <p className='mt-4 border border-stone-200 bg-stone-50 p-4 text-xs font-bold text-stone-600'>
              {report.whatsappSummary}
            </p>
          </div>
        </DataPanel>

        <div className='grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4'>
          <StatCard label='Interactions' value={report.totalInteractions} icon={MessageSquare} />
          <StatCard label='Customers' value={report.uniqueCustomers} icon={Users} />
          <StatCard label='Buying Intent' value={report.confirmedBuyingIntent} icon={CheckCircle2} />
          <StatCard label='Converted' value={report.convertedLeads} icon={Star} variant='success' />
          <StatCard label='Lost Leads' value={report.lostLeads} icon={AlertTriangle} variant={report.lostLeads ? 'error' : 'neutral'} />
          <StatCard label='Complaints' value={report.complaints} icon={ShieldAlert} variant={report.complaints ? 'warning' : 'neutral'} />
          <StatCard label='Follow-ups' value={report.pendingFollowUps} icon={Bell} variant={report.pendingFollowUps ? 'warning' : 'neutral'} />
        </div>

        <TablePanel
          title='Trending Products'
          subtitle='Rule-based trend score from enquiries, price checks, stock queries, clicks, repeat interest, conversions, lost leads and complaints.'
          headers={[
            'Product',
            'Score',
            'Signals',
            'Price',
            'Stock',
            'Repeat',
            'Converted',
            'Lost',
            'Complaints',
            'Top Locations'
          ]}
        >
          {report.trendingProducts.slice(0, 20).map(product => (
            <tr key={`${product.productId}-${product.productName}`} className='hover:bg-orange-50/30'>
              <td className='px-6 py-4'>
                <p className='text-xs font-black uppercase text-brand-charcoal'>{product.productName}</p>
                <p className='text-[10px] font-bold uppercase text-stone-400'>{product.vendorName || product.category || '-'}</p>
              </td>
              <td className='px-6 py-4 font-mono text-lg font-black text-brand-orange'>{product.trendScore}</td>
              <td className='px-6 py-4 font-mono text-xs'>{product.totalInteractions}</td>
              <td className='px-6 py-4 font-mono text-xs'>{product.priceEnquiries}</td>
              <td className='px-6 py-4 font-mono text-xs'>{product.stockQueries}</td>
              <td className='px-6 py-4 font-mono text-xs'>{product.repeatCustomerInterest}</td>
              <td className='px-6 py-4 font-mono text-xs'>{product.convertedLeads}</td>
              <td className='px-6 py-4 font-mono text-xs'>{product.lostLeads}</td>
              <td className='px-6 py-4 font-mono text-xs'>{product.complaints}</td>
              <td className='px-6 py-4 text-[10px] font-bold uppercase text-stone-500'>
                {product.topLocations.map(location => location.name).join(', ') || '-'}
              </td>
            </tr>
          ))}
        </TablePanel>

        <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
          <TablePanel
            title='Where Products Are Trending'
            headers={['Level', 'Location', 'Interactions', 'Top Products', 'Conversion', 'Behaviour']}
          >
            {report.locationTrends.slice(0, 18).map(location => (
              <tr key={`${location.level}-${location.name}`} className='hover:bg-stone-50'>
                <td className='px-6 py-4'><StatusBadge status={location.level} /></td>
                <td className='px-6 py-4 text-xs font-black uppercase'>{location.name}</td>
                <td className='px-6 py-4 font-mono text-xs'>{location.totalInteractions}</td>
                <td className='px-6 py-4 text-[10px] font-bold uppercase text-stone-500'>
                  {location.topProducts.map(product => product.name).join(', ') || '-'}
                </td>
                <td className='px-6 py-4 font-mono text-xs'>{location.conversionRate}%</td>
                <td className='px-6 py-4 text-xs font-bold'>{location.dominantMarketBehaviour}</td>
              </tr>
            ))}
          </TablePanel>

          <DataPanel title='Customer Buying Behaviour'>
            <div className='grid grid-cols-2 md:grid-cols-3 gap-3 p-4'>
              {report.customerBehaviour.behaviourMix.map(item => (
                <div key={item.behaviour} className='border border-stone-200 p-4'>
                  <p className='text-[10px] font-black uppercase text-stone-400'>{item.behaviour}</p>
                  <p className='mt-2 font-mono text-2xl font-black text-brand-charcoal'>{item.count}</p>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

        <TablePanel
          title='Vendor Performance'
          headers={[
            'Vendor',
            'Score',
            'Interactions',
            'Customers',
            'Top Products',
            'Converted',
            'Lost',
            'Follow-ups',
            'Complaints'
          ]}
        >
          {report.vendorPerformance.slice(0, 20).map(vendor => (
            <tr key={vendor.vendorId} className='hover:bg-stone-50'>
              <td className='px-6 py-4 text-xs font-black uppercase'>{vendor.vendorName}</td>
              <td className='px-6 py-4 font-mono text-lg font-black text-brand-orange'>{vendor.marketFeedScore}</td>
              <td className='px-6 py-4 font-mono text-xs'>{vendor.totalInteractions}</td>
              <td className='px-6 py-4 font-mono text-xs'>{vendor.uniqueCustomers}</td>
              <td className='px-6 py-4 text-[10px] font-bold uppercase text-stone-500'>{vendor.topRequestedProducts.map(product => product.name).join(', ') || '-'}</td>
              <td className='px-6 py-4 font-mono text-xs'>{vendor.convertedLeads}</td>
              <td className='px-6 py-4 font-mono text-xs'>{vendor.lostLeads}</td>
              <td className='px-6 py-4 font-mono text-xs'>{vendor.pendingFollowUps}</td>
              <td className='px-6 py-4 font-mono text-xs'>{vendor.complaints}</td>
            </tr>
          ))}
        </TablePanel>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          <DataPanel title='Complaints and Risk Signals'>
            <div className='p-4 space-y-3'>
              {report.riskSignals.map(signal => (
                <div key={signal.id} className='border-2 border-stone-200 p-4'>
                  <div className='flex items-start justify-between gap-3'>
                    <p className='text-sm font-black uppercase text-brand-charcoal'>{signal.title}</p>
                    <StatusBadge status={signal.severity} variant={signal.severity === 'critical' || signal.severity === 'high' ? 'error' : 'warning'} />
                  </div>
                  <p className='mt-2 text-xs font-semibold text-stone-600'>{signal.message}</p>
                </div>
              ))}
              {report.riskSignals.length === 0 && (
                <p className='p-6 text-center text-xs font-bold uppercase text-stone-400'>No risk thresholds crossed.</p>
              )}
            </div>
          </DataPanel>

          <DataPanel title='Recommended Remedial Actions'>
            <div className='p-4 space-y-3'>
              {report.recommendations.map(rec => (
                <div key={rec.id} className='border-2 border-stone-200 p-4'>
                  <div className='flex items-start justify-between gap-3'>
                    <p className='text-sm font-black uppercase text-brand-charcoal'>{rec.action}</p>
                    <StatusBadge status={rec.priority} variant={rec.priority === 'critical' || rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'neutral'} />
                  </div>
                  <p className='mt-2 text-xs font-semibold text-stone-600'>{rec.reason}</p>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>
      </div>
    )
  }

  const renderCustomerForm = () => (
    <div className='grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] gap-6'>
      <DataPanel
        title='Customer Intelligence Intake'
        subtitle='Structured market intelligence capture with audit, alerts and follow-up routing.'
        className='border-t-4 border-t-brand-orange'
      >
        <div className='p-5 space-y-5'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4 bg-stone-50 border border-stone-200 p-4'>
            <div>
              <p className='text-[10px] font-bold uppercase text-stone-400'>
                Auto Date / Time
              </p>
              <p className='text-xs font-black text-brand-charcoal'>
                {new Date().toLocaleString()}
              </p>
            </div>
            <div>
              <p className='text-[10px] font-bold uppercase text-stone-400'>
                Logged By
              </p>
              <p className='text-xs font-black text-brand-charcoal'>
                {session.staffName || session.displayName || 'Unknown Staff'}
              </p>
            </div>
            <div>
              <label className='text-[10px] font-bold uppercase text-stone-400'>
                Source
              </label>
              <select
                className={inputClass}
                value={formData.source || 'WhatsApp'}
                onChange={e =>
                  setFormData({
                    ...formData,
                    source: e.target.value as IntelligenceSource
                  })
                }
              >
                {sources.map(source => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
            <div className='flex items-end'>
              <SecondaryButton className='w-full' onClick={handlePullCustomer}>
                <Search size={13} className='mr-2' /> Pull Existing Customer
              </SecondaryButton>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <label className='space-y-2'>
              <span className='text-[10px] font-bold uppercase text-stone-400'>
                Customer Phone *
              </span>
              <input
                className={inputClass}
                value={formData.customerPhone || ''}
                onChange={e =>
                  setFormData({ ...formData, customerPhone: e.target.value })
                }
                placeholder='+263...'
              />
            </label>
            <label className='space-y-2'>
              <span className='text-[10px] font-bold uppercase text-stone-400'>
                Customer Name
              </span>
              <input
                className={inputClass}
                value={formData.customerName || ''}
                onChange={e =>
                  setFormData({ ...formData, customerName: e.target.value })
                }
              />
            </label>
            <label className='space-y-2'>
              <SearchableComboBox
                label='Vendor'
                value={formData.vendorName || ''}
                options={vendors}
                getOptionLabel={vendor =>
                  [
                    vendor.tradingName || vendor.name,
                    vendor.cityTown,
                    vendor.sector,
                    vendor.id
                  ]
                    .filter(Boolean)
                    .join(' / ')
                }
                getOptionValue={vendor => vendor.id}
                getOptionSearchText={vendor =>
                  buildSearchText([
                    vendor.name,
                    vendor.tradingName,
                    vendor.phone,
                    vendor.suburb,
                    vendor.cityTown,
                    vendor.district,
                    vendor.province,
                    vendor.sector,
                    vendor.systemCode,
                    vendor.id
                  ])
                }
                placeholder='Search vendor...'
                emptyMessage='No vendors found.'
                onSelect={vendor => handleVendorChange(vendor?.id || '')}
              />
              <input
                className={inputClass}
                value={formData.vendorName || ''}
                onChange={e =>
                  setFormData({ ...formData, vendorName: e.target.value })
                }
                placeholder='Vendor name'
              />
            </label>
            <label className='space-y-2'>
              <SearchableComboBox
                label='Product'
                value={formData.productName || ''}
                options={products}
                getOptionLabel={product =>
                  [
                    product.name || product.productName,
                    product.brand,
                    product.vendorName,
                    product.sku || product.barcode || product.productCode
                  ]
                    .filter(Boolean)
                    .join(' / ')
                }
                getOptionValue={product => product.id}
                getOptionSearchText={product =>
                  buildSearchText([
                    product.name,
                    product.productName,
                    product.brand,
                    product.sku,
                    product.barcode,
                    product.productCode,
                    product.category,
                    product.sector,
                    product.vendorName
                  ])
                }
                placeholder='Search product...'
                emptyMessage='No products found.'
                onSelect={product => handleProductChange(product?.id || '')}
              />
              <input
                className={inputClass}
                value={formData.productName || ''}
                onChange={e =>
                  setFormData({ ...formData, productName: e.target.value })
                }
                placeholder='Product name'
              />
            </label>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <SearchableComboBox
              label='sector'
              value={formData.sector || ''}
              options={sharedSectors}
              getOptionLabel={sector => sector}
              getOptionValue={sector => sector}
              getOptionSearchText={sector => sector}
              placeholder='Search or select sector...'
              allowAddNew
              onAddNew={sector =>
                void taxonomyService.addSector(sector).then(sectors => {
                  setSharedSectors(sectors)
                  setFormData({ ...formData, sector })
                })
              }
              onSelect={sector =>
                setFormData({ ...formData, sector: sector || '' })
              }
            />
            {(['category', 'province', 'city'] as const).map(field => (
              <label key={field} className='space-y-2'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  {field}
                </span>
                <input
                  className={inputClass}
                  value={(formData[field] as string) || ''}
                  onChange={e =>
                    setFormData({ ...formData, [field]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className='space-y-2 md:col-span-2'>
              <span className='text-[10px] font-bold uppercase text-stone-400'>
                Region / Suburb
              </span>
              <input
                className={inputClass}
                value={formData.region || ''}
                onChange={e =>
                  setFormData({ ...formData, region: e.target.value })
                }
              />
            </label>
            <label className='space-y-2 md:col-span-2'>
              <span className='text-[10px] font-bold uppercase text-stone-400'>
                Interaction Type *
              </span>
              <select
                className={inputClass}
                value={formData.interactionType || 'Enquiry'}
                onChange={e =>
                  setFormData({
                    ...formData,
                    interactionType: e.target.value as InteractionType
                  })
                }
              >
                {interactionTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className='space-y-2 block'>
            <span className='text-[10px] font-bold uppercase text-stone-400'>
              Query / Complaint / Compliment
            </span>
            <textarea
              className={`${inputClass} min-h-[120px] normal-case`}
              value={formData.customerMessage || ''}
              onChange={e =>
                setFormData({ ...formData, customerMessage: e.target.value })
              }
            />
          </label>

          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <label className='flex items-center gap-3 border border-stone-200 p-3'>
              <input
                type='checkbox'
                className='h-5 w-5 accent-brand-orange'
                checked={!!formData.actionRequired}
                onChange={e =>
                  setFormData({ ...formData, actionRequired: e.target.checked })
                }
              />
              <span className='text-xs font-black uppercase'>
                Action Required
              </span>
            </label>
            <label className='flex items-center gap-3 border border-stone-200 p-3'>
              <input
                type='checkbox'
                className='h-5 w-5 accent-brand-orange'
                checked={!!formData.followUpRequired}
                onChange={e =>
                  setFormData({
                    ...formData,
                    followUpRequired: e.target.checked
                  })
                }
              />
              <span className='text-xs font-black uppercase'>
                Follow-up Required
              </span>
            </label>
            <label className='space-y-2'>
              <span className='text-[10px] font-bold uppercase text-stone-400'>
                Urgency
              </span>
              <select
                className={inputClass}
                value={formData.urgencyLevel || 'Medium'}
                onChange={e =>
                  setFormData({
                    ...formData,
                    urgencyLevel: e.target.value as UrgencyLevel
                  })
                }
              >
                {urgencyLevels.map(level => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label className='space-y-2'>
              <span className='text-[10px] font-bold uppercase text-stone-400'>
                Sentiment
              </span>
              <select
                className={inputClass}
                value={formData.sentiment || 'Neutral'}
                onChange={e =>
                  setFormData({
                    ...formData,
                    sentiment: e.target.value as Sentiment
                  })
                }
              >
                {sentiments.map(sentiment => (
                  <option key={sentiment} value={sentiment}>
                    {sentiment}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='space-y-2'>
              {assignedStaffInactive && (
                <div className='border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800'>
                  Previously assigned staff is no longer active. Please reassign
                  to an active staff member.
                </div>
              )}
              <SearchableComboBox
                label='Assigned Staff'
                value={formData.assignedToStaffName || ''}
                options={activeStaff}
                getOptionLabel={staff =>
                  [
                    staff.displayName || staff.fullName,
                    staff.role,
                    staff.desk,
                    staff.staffCode
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
                onSelect={staff => handleAssignStaff(staff?.id || '')}
              />
            </div>
            <label className='space-y-2'>
              <span className='text-[10px] font-bold uppercase text-stone-400'>
                Follow-up Date
              </span>
              <input
                type='date'
                className={inputClass}
                value={formData.followUpDate || ''}
                onChange={e =>
                  setFormData({ ...formData, followUpDate: e.target.value })
                }
              />
            </label>
            <label className='space-y-2'>
              <span className='text-[10px] font-bold uppercase text-stone-400'>
                Resolution Status
              </span>
              <select
                className={inputClass}
                value={formData.resolutionStatus || 'Pending'}
                onChange={e =>
                  setFormData({
                    ...formData,
                    resolutionStatus: e.target.value as ResolutionStatus
                  })
                }
              >
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className='space-y-2 block'>
            <span className='text-[10px] font-bold uppercase text-stone-400'>
              Tags
            </span>
            <input
              className={inputClass}
              value={(formData.tags || []).join(', ')}
              onChange={e =>
                setFormData({
                  ...formData,
                  tags: e.target.value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(Boolean)
                })
              }
              placeholder='delivery, stock, pricing'
            />
          </label>

          <label className='space-y-2 block'>
            <span className='text-[10px] font-bold uppercase text-stone-400'>
              Internal Notes
            </span>
            <textarea
              className={`${inputClass} min-h-[90px] normal-case`}
              value={formData.internalNotes || ''}
              onChange={e =>
                setFormData({ ...formData, internalNotes: e.target.value })
              }
            />
          </label>

          <div className='flex flex-col sm:flex-row gap-3 border-t border-stone-200 pt-5'>
            <SecondaryButton className='sm:w-40' onClick={resetForm}>
              Clear
            </SecondaryButton>
            <PrimaryButton className='flex-1' onClick={handleSaveIntel}>
              <CheckCircle2 size={15} className='mr-2' /> Save Intelligence
              Record
            </PrimaryButton>
          </div>
        </div>
      </DataPanel>

      <DataPanel
        title='Customer Timeline'
        subtitle='Previous interactions pulled by phone number.'
      >
        <div className='p-4 space-y-3'>
          {customerTimeline.map(log => (
            <div
              key={log.id}
              className='border-l-4 border-brand-orange bg-stone-50 p-4'
            >
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-xs font-black uppercase text-brand-charcoal'>
                    {log.interactionType}
                  </p>
                  <p className='text-[10px] font-bold text-stone-400'>
                    {new Date(log.createdAt).toLocaleString()} by{' '}
                    {log.loggedByStaffName}
                  </p>
                </div>
                <StatusBadge
                  status={log.resolutionStatus}
                  variant={badgeVariant(log.resolutionStatus)}
                />
              </div>
              <p className='mt-3 text-xs font-semibold text-stone-700'>
                {log.customerMessage ||
                  log.internalNotes ||
                  'No message captured.'}
              </p>
              <p className='mt-2 text-[10px] font-bold uppercase text-stone-400'>
                {log.vendorName || 'No vendor'} /{' '}
                {log.productName || 'No product'}
              </p>
            </div>
          ))}
          {customerTimeline.length === 0 && (
            <EmptyState
              icon={Phone}
              title='No Customer History'
              description='Enter a phone number and pull an existing customer to view the timeline.'
            />
          )}
        </div>
      </DataPanel>
    </div>
  )

  return (
    <div className='pb-20 space-y-6'>
      <PageHeader
        title='WhatsApp Activity'
        subtitle='Commerce intelligence operations layer for SCI / iTred.'
        actions={
          <div className='flex gap-2'>
            <SecondaryButton onClick={() => setPdfConfigOpen(true)}>
              <Download size={14} className='mr-2' /> Generate PDF Report
            </SecondaryButton>
            <SecondaryButton onClick={exportCsv}>
              <Download size={14} className='mr-2' /> Export
            </SecondaryButton>
            <PrimaryButton onClick={() => setActiveTab('customer')}>
              <UserPlus size={14} className='mr-2' /> Customer Intelligence
            </PrimaryButton>
          </div>
        }
      />

      <div className='sticky top-0 z-20 border-b-4 border-brand-charcoal bg-white'>
        <div className='flex overflow-x-auto'>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-[54px] items-center gap-2 whitespace-nowrap px-4 text-[10px] font-black uppercase tracking-tight transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-orange text-white'
                  : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4'>
        <StatCard
          label='Total Interactions'
          value={commerceBI.totalInteractions}
          icon={MessageSquare}
        />
        <StatCard
          label='Complaints Today'
          value={commerceBI.complaintsToday}
          icon={AlertTriangle}
          variant={commerceBI.complaintsToday > 0 ? 'error' : 'neutral'}
        />
        <StatCard
          label='Compliments Today'
          value={commerceBI.complimentsToday}
          icon={Star}
          variant='success'
        />
        <StatCard
          label='Unresolved Complaints'
          value={commerceBI.unresolvedComplaints}
          icon={ShieldAlert}
          variant={commerceBI.unresolvedComplaints > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label='Follow-ups Overdue'
          value={commerceBI.followUpsOverdue}
          icon={Bell}
          variant={commerceBI.followUpsOverdue > 0 ? 'error' : 'neutral'}
        />
        <StatCard
          label='Return Rate'
          value={`${commerceBI.returnInteractionRate}%`}
          icon={Users}
        />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4'>
        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='Advanced search: customer, vendor, product, region, tags...'
          className='w-full'
        />
        <div className='flex gap-2'>
          <StatusBadge
            status={`Avg Resolution ${commerceBI.averageResolutionDays}d`}
          />
          <StatusBadge
            status={`${commerceBI.fraudAlerts} Fraud Alerts`}
            variant={commerceBI.fraudAlerts > 0 ? 'error' : 'neutral'}
          />
        </div>
      </div>

      {showPopupFeed && commerceBI.alerts.length > 0 && (
        <div className='fixed bottom-6 right-6 z-40 w-[min(380px,calc(100vw-2rem))] space-y-3'>
          {commerceBI.alerts.slice(0, 2).map(alert => (
            <div
              key={alert.id}
              className='border-2 border-brand-charcoal bg-white p-4 shadow-2xl'
            >
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-xs font-black uppercase text-brand-charcoal'>
                    SCI Intelligence Feed
                  </p>
                  <p className='mt-1 text-sm font-bold text-brand-orange'>
                    {alert.title}
                  </p>
                </div>
                <button
                  className='text-[10px] font-black uppercase text-stone-400'
                  onClick={() => setShowPopupFeed(false)}
                >
                  Dismiss
                </button>
              </div>
              <p className='mt-2 text-xs font-semibold text-stone-600'>
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'customer' && renderCustomerForm()}

      {activeTab === 'vendorBI' && canViewAnalytics && renderVendorBIReport()}

      {activeTab === 'marketBI' && canViewAnalytics && renderMarketBIReports()}

      {activeTab === 'feed' && (
        <TablePanel
          title='Activity Feed'
          subtitle='Unified view of legacy WhatsApp logs and new customer intelligence records.'
          headers={[
            'Date',
            'Type',
            'Customer / Source',
            'Vendor',
            'Product / Need',
            'Status',
            'Staff'
          ]}
        >
          {filteredIntelLogs.map(log => (
            <tr key={log.id} className='hover:bg-orange-50/30'>
              <td className='px-6 py-4 text-[10px] font-bold text-stone-400'>
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className='px-6 py-4'>
                <StatusBadge
                  status={log.interactionType}
                  variant={
                    isComplaint(log.interactionType) ? 'warning' : 'neutral'
                  }
                />
              </td>
              <td className='px-6 py-4'>
                <p className='text-xs font-black uppercase text-brand-charcoal'>
                  {log.customerName || log.customerPhone}
                </p>
                <p className='text-[10px] font-bold text-stone-400'>
                  {log.source}
                </p>
              </td>
              <td className='px-6 py-4 text-xs font-bold uppercase'>
                {log.vendorName || '-'}
              </td>
              <td className='px-6 py-4 text-xs font-semibold text-stone-600'>
                {log.productName || log.customerMessage || '-'}
              </td>
              <td className='px-6 py-4'>
                <div className='flex flex-col items-start gap-1'>
                  <StatusBadge
                    status={log.resolutionStatus}
                    variant={badgeVariant(log.resolutionStatus)}
                  />
                  {log.duplicatePatternDetected && (
                    <StatusBadge status='Duplicate Pattern' variant='warning' />
                  )}
                </div>
              </td>
              <td className='px-6 py-4 text-[10px] font-bold uppercase text-stone-500'>
                {log.loggedByStaffName}
              </td>
            </tr>
          ))}
          {legacyFeed.map(log => (
            <tr key={log.id} className='hover:bg-stone-50'>
              <td className='px-6 py-4 text-[10px] font-bold text-stone-400'>
                {log.activityDate}
              </td>
              <td className='px-6 py-4'>
                <StatusBadge status={log.activityType} />
              </td>
              <td className='px-6 py-4 text-xs font-bold uppercase'>
                {log.sourceName}
              </td>
              <td className='px-6 py-4 text-xs font-bold uppercase'>
                {log.vendorName || '-'}
              </td>
              <td className='px-6 py-4 text-xs font-semibold text-stone-600'>
                {log.productName || log.customerNeed || '-'}
              </td>
              <td className='px-6 py-4'>
                <StatusBadge status={log.leadStatus} />
              </td>
              <td className='px-6 py-4 text-[10px] font-bold uppercase text-stone-500'>
                {log.capturedByStaffName || log.loggedBy}
              </td>
            </tr>
          ))}
        </TablePanel>
      )}

      {activeTab === 'risks' && (
        <TablePanel
          title='Complaints & Risks'
          subtitle='Unresolved complaints, fraud alerts, duplicate patterns and escalation controls.'
          headers={[
            'Customer',
            'Risk Type',
            'Vendor',
            'Product',
            'Urgency',
            'Status',
            'Assigned',
            'Action'
          ]}
        >
          {filteredIntelLogs
            .filter(
              log =>
                isComplaint(log.interactionType) ||
                log.flaggedRisk ||
                log.sentiment === 'Negative' ||
                log.duplicatePatternDetected
            )
            .map(log => (
              <tr key={log.id} className='hover:bg-red-50/30'>
                <td className='px-6 py-4'>
                  <p className='text-xs font-black uppercase'>
                    {log.customerName || log.customerPhone}
                  </p>
                  <p className='text-[10px] font-bold text-stone-400'>
                    {log.customerPhone}
                  </p>
                </td>
                <td className='px-6 py-4'>
                  <StatusBadge
                    status={log.interactionType}
                    variant={
                      log.interactionType === 'Fraud Alert'
                        ? 'error'
                        : 'warning'
                    }
                  />
                </td>
                <td className='px-6 py-4 text-xs font-bold uppercase'>
                  {log.vendorName || '-'}
                </td>
                <td className='px-6 py-4 text-xs font-semibold'>
                  {log.productName || '-'}
                </td>
                <td className='px-6 py-4'>
                  <StatusBadge
                    status={log.urgencyLevel}
                    variant={badgeVariant(log.urgencyLevel)}
                  />
                </td>
                <td className='px-6 py-4'>
                  <StatusBadge
                    status={log.resolutionStatus}
                    variant={badgeVariant(log.resolutionStatus)}
                  />
                </td>
                <td className='px-6 py-4 text-[10px] font-bold uppercase'>
                  {log.assignedToStaffName || 'Unassigned'}
                </td>
                <td className='px-6 py-4'>
                  <div className='flex gap-2'>
                    <SecondaryButton
                      size='sm'
                      onClick={() => handleEscalate(log)}
                    >
                      Escalate
                    </SecondaryButton>
                    <PrimaryButton size='sm' onClick={() => handleResolve(log)}>
                      Resolve
                    </PrimaryButton>
                  </div>
                </td>
              </tr>
            ))}
        </TablePanel>
      )}

      {activeTab === 'market' && canViewAnalytics && (
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {renderRankList('Most Requested Products', commerceBI.productDemand)}
          {renderRankList(
            'Most Complained Vendors',
            commerceBI.vendorComplaints
          )}
          {renderRankList('Most Active Staff', commerceBI.staffActivity)}
          {renderRankList('Sector Activity', commerceBI.sectorActivity)}
          {renderRankList(
            'Category Sentiment Pressure',
            commerceBI.categoryActivity
          )}
          {renderRankList(
            'Repeat Complaint Keywords',
            commerceBI.complaintKeywords
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <DataPanel
          title='Live Alerts'
          subtitle='Market signal detection from customer demand, vendor risk and regional patterns.'
          className='border-t-4 border-t-brand-orange'
        >
          <div className='p-4 grid grid-cols-1 lg:grid-cols-2 gap-4'>
            {commerceBI.alerts.map(alert => (
              <div key={alert.id} className='border-2 border-stone-200 p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <p className='text-[10px] font-black uppercase text-brand-orange'>
                      {alert.category}
                    </p>
                    <p className='text-sm font-black uppercase text-brand-charcoal'>
                      {alert.title}
                    </p>
                  </div>
                  <StatusBadge
                    status={alert.severity}
                    variant={
                      alert.severity === 'critical' ? 'error' : 'warning'
                    }
                  />
                </div>
                <p className='mt-3 text-xs font-semibold text-stone-600'>
                  {alert.message}
                </p>
              </div>
            ))}
            {commerceBI.alerts.length === 0 && (
              <EmptyState
                icon={Bell}
                title='No Active BI Alerts'
                description='New alerts will appear when product demand, complaint volume or regional patterns cross thresholds.'
              />
            )}
          </div>
        </DataPanel>
      )}

      {activeTab === 'reputation' && canViewReputation && (
        <TablePanel
          title='Vendor Reputation Engine'
          subtitle='Score blends complaint rate, compliments, delivery issues, unresolved cases and sentiment.'
          headers={[
            'Vendor',
            'Score',
            'Trend',
            'Risk',
            'Complaints',
            'Compliments',
            'Delivery',
            'Response Quality'
          ]}
        >
          {Object.entries(commerceBI.vendorReputation)
            .sort((a, b) => a[1].score - b[1].score)
            .map(([vendor, score]) => (
              <tr key={vendor} className='hover:bg-stone-50'>
                <td className='px-6 py-4 text-xs font-black uppercase'>
                  {vendor}
                </td>
                <td className='px-6 py-4 font-mono text-xl font-black text-brand-orange'>
                  {score.score}/100
                </td>
                <td className='px-6 py-4'>
                  <StatusBadge status={score.trend} />
                </td>
                <td className='px-6 py-4'>
                  <StatusBadge
                    status={score.riskLevel}
                    variant={
                      score.riskLevel === 'Critical' ||
                      score.riskLevel === 'High'
                        ? 'error'
                        : score.riskLevel === 'Medium'
                        ? 'warning'
                        : 'success'
                    }
                  />
                </td>
                <td className='px-6 py-4 font-mono text-xs'>
                  {score.complaints}
                </td>
                <td className='px-6 py-4 font-mono text-xs'>
                  {score.compliments}
                </td>
                <td className='px-6 py-4 font-mono text-xs'>
                  {score.deliveryIssues}
                </td>
                <td className='px-6 py-4 font-mono text-xs'>
                  {score.responseQuality}/100
                </td>
              </tr>
            ))}
        </TablePanel>
      )}

      {activeTab === 'regional' && (
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {renderRankList('Demand by Province', commerceBI.provinceDemand)}
          {renderRankList('Demand by City / Region', commerceBI.regionDemand)}
          {renderRankList(
            'Regional Enquiry Ranking',
            commerceBI.regionalEnquiryRank
          )}
          <DataPanel title='Product Demand Heatmap' className='lg:col-span-3'>
            <div className='p-4 overflow-x-auto'>
              {Object.entries(commerceBI.productDemandHeatmap).map(
                ([region, products]) => (
                  <div
                    key={region}
                    className='mb-4 border border-stone-200 p-3'
                  >
                    <p className='mb-3 text-xs font-black uppercase text-brand-charcoal'>
                      {region}
                    </p>
                    <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2'>
                      {asList(products, 12).map(([product, count]) => (
                        <div
                          key={product}
                          className='bg-orange-50 border border-orange-100 p-3'
                        >
                          <p className='truncate text-[10px] font-black uppercase text-brand-charcoal'>
                            {product}
                          </p>
                          <p className='font-mono text-lg font-black text-brand-orange'>
                            {count}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === 'product' && (
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {renderRankList(
            'Most Searched / Requested Products',
            commerceBI.productDemand
          )}
          {renderRankList(
            'Unavailable / Stock Request Products',
            commerceBI.unavailableProducts
          )}
          {renderRankList(
            'Complaint-heavy Products',
            commerceBI.productComplaints
          )}
          <TablePanel
            title='Fast-moving Demand Trends'
            subtitle='Product signals weighted by total demand and regional spread.'
            className='lg:col-span-3'
            headers={[
              'Product',
              'Demand',
              'Complaint Load',
              'Stock Requests',
              'BI Signal'
            ]}
          >
            {asList(commerceBI.productDemand, 20).map(([product, demand]) => {
              const complaints = commerceBI.productComplaints[product] || 0
              const stockRequests = commerceBI.unavailableProducts[product] || 0
              const score = demand * 4 + stockRequests * 5 - complaints * 2
              return (
                <tr key={product} className='hover:bg-stone-50'>
                  <td className='px-6 py-4 text-xs font-black uppercase'>
                    {product}
                  </td>
                  <td className='px-6 py-4 font-mono text-xs'>{demand}</td>
                  <td className='px-6 py-4 font-mono text-xs'>{complaints}</td>
                  <td className='px-6 py-4 font-mono text-xs'>
                    {stockRequests}
                  </td>
                  <td className='px-6 py-4'>
                    <StatusBadge
                      status={score >= 20 ? 'High Demand' : 'Watch'}
                      variant={score >= 20 ? 'warning' : 'neutral'}
                    />
                  </td>
                </tr>
              )
            })}
          </TablePanel>
        </div>
      )}

      {!canViewAnalytics &&
        (activeTab === 'market' ||
          activeTab === 'vendorBI' ||
          activeTab === 'marketBI') && (
        <EmptyState
          icon={ShieldAlert}
          title='Analytics Permission Required'
          description='This staff profile does not have whatsapp.analytics.view access.'
        />
      )}

      {pdfConfigOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div className='bg-white border-2 border-brand-charcoal p-6 max-w-2xl w-full shadow-2xl'>
            <h3 className='text-lg font-black uppercase text-brand-charcoal mb-4 border-b border-stone-200 pb-2'>
              Generate PDF Report
            </h3>
            <div className='grid grid-cols-2 gap-4 mb-4'>
              <label className='space-y-1'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Date From
                </span>
                <input
                  type='date'
                  className={inputClass}
                  value={pdfDateFrom}
                  onChange={e => setPdfDateFrom(e.target.value)}
                />
              </label>
              <label className='space-y-1'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Date To
                </span>
                <input
                  type='date'
                  className={inputClass}
                  value={pdfDateTo}
                  onChange={e => setPdfDateTo(e.target.value)}
                />
              </label>
              <label className='space-y-1'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Channel Filter
                </span>
                <select
                  className={inputClass}
                  value={pdfChannel}
                  onChange={e => setPdfChannel(e.target.value as any)}
                >
                  <option value='All'>All Channels</option>
                  {sources.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className='space-y-1'>
                <span className='text-[10px] font-bold uppercase text-stone-400'>
                  Status Filter
                </span>
                <select
                  className={inputClass}
                  value={pdfStatus}
                  onChange={e => setPdfStatus(e.target.value as any)}
                >
                  <option value='All'>All Statuses</option>
                  {statuses.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className='space-y-2 mb-6 border-t border-stone-200 pt-4'>
              <label className='flex items-center gap-3'>
                <input
                  type='checkbox'
                  className='accent-brand-orange w-4 h-4'
                  checked={pdfIncludeBi}
                  onChange={e => setPdfIncludeBi(e.target.checked)}
                />
                <span className='text-xs font-bold'>
                  Include BI Summary & Recommendations
                </span>
              </label>
              <label className='flex items-center gap-3'>
                <input
                  type='checkbox'
                  className='accent-brand-orange w-4 h-4'
                  checked={pdfIncludePhones}
                  onChange={e => setPdfIncludePhones(e.target.checked)}
                />
                <span className='text-xs font-bold text-red-600'>
                  Include Full Customer Phone Numbers (Privacy Risk)
                </span>
              </label>
            </div>
            <div className='flex gap-2 justify-end'>
              <SecondaryButton onClick={() => setPdfConfigOpen(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={handleSendWhatsAppSummary}>
                <MessageSquare size={14} className='mr-2' /> Send WhatsApp
                Summary
              </PrimaryButton>
              <PrimaryButton onClick={downloadPdf}>
                <Download size={14} className='mr-2' /> Download PDF
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
