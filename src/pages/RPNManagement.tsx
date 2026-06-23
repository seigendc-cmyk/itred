/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Search,
  Filter,
  ChevronRight,
  MapPin,
  Phone,
  MessageSquare,
  Mail,
  Briefcase,
  Calendar,
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Package,
  History,
  TrendingUp,
  Activity,
  PlusCircle,
  LayoutDashboard,
  Save,
  ArrowUpRight,
  UserPlus,
  XCircle,
  Check,
  DollarSign,
  BarChart3,
  Copy,
  FileCode,
  CreditCard,
  Loader2
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
  StatCard,
  FormField,
  ActivityTimeline,
  BrandedAlertModal
} from '../components/CommonUI.tsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { rpnService } from '../services/rpnService.ts'
import { rpnCompensationService } from '../services/rpnCompensationService.ts'
import { vendorService } from '../services/vendorService.ts'
import { staffService } from '../services/staffService.ts'
import { financeService } from '../services/financeService.ts'
import { logService } from '../services/logService.ts'
import { permissionService } from '../services/permissionService.ts'
import { analyticsService } from '../services/analyticsService.ts'
import {
  RPN,
  RPNStatus,
  RPNLevel,
  FieldCollectionRecord,
  CollectionType,
  CollectionStatus,
  DeskType,
  Vendor,
  PipelineStage,
  RPNProspectQuery,
  Staff,
  RPNAppointment,
  RPNFollowUpTask,
  UrgencyLevel,
  PROSPECT_PIPELINE_STAGES,
  PROSPECT_SOURCE_TYPES,
  PROSPECT_PRIORITIES,
  ProspectPriority,
  ProspectActivityLog,
  CashBankAccount,
  RpnCompensationPlan,
  RpnCompensationRun,
  RpnCompensationLedgerEntry,
  RpnCompensationLedgerTransactionType,
  RpnOnboardingLog,
  RpnVendorAssignment
} from '../types.ts'
import { asArray } from '../utils/safeData.ts'
import { staffAuditService } from '../services/staffAuditService.ts'
import { approvalService } from '../services/approvalService.ts'
import { buildSearchText } from '../utils/searchUtils.ts'

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const RPN_LEVELS: RPNLevel[] = ['Junior RPN', 'Leader RPN', 'IMM']
const RPN_STATUSES: RPNStatus[] = ['active', 'suspended', 'inactive']
const COLLECTION_TYPES: CollectionType[] = [
  'vendor profile',
  'itred_products',
  'price update',
  'image update',
  'subscription collection',
  'follow-up'
]
const COLLECTION_STATUSES: CollectionStatus[] = [
  'pending backend entry',
  'entered',
  'rejected',
  'needs clarification'
]

const today = () => new Date().toISOString().split('T')[0]

const isRecoverableStage = (stage: PipelineStage) =>
  ['Not Interested', 'Dormant', 'Rejected'].includes(stage)

const getFollowUpStatus = (date?: string) => {
  if (!date)
    return {
      class: 'border-stone-100 bg-stone-50 text-stone-500',
      label: 'Follow-up: '
    }
  const fTime = new Date(date).setHours(0, 0, 0, 0)
  const tTime = new Date().setHours(0, 0, 0, 0)
  if (fTime < tTime)
    return {
      class: 'border-red-100 bg-red-50 text-red-700',
      label: 'Overdue: '
    }
  if (fTime === tTime)
    return {
      class: 'border-orange-100 bg-orange-50 text-brand-orange',
      label: 'Due Today: '
    }
  return {
    class: 'border-stone-100 bg-stone-50 text-stone-500',
    label: 'Follow-up: '
  }
}

const generateProspectWhatsAppMessage = (
  prospect: RPNProspectQuery
): string => {
  const details = [
    `*SCI / iTred Prospect Assignment*`,
    `-----------------------------------`,
    `*Business Name:* ${prospect.businessName || 'N/A'}`,
    `*Contact Person:* ${prospect.contactPerson || 'N/A'}`,
    `*Phone:* ${prospect.phone || 'N/A'}`,
    `*WhatsApp:* ${prospect.whatsappNumber || prospect.whatsapp || 'N/A'}`,
    ``,
    `*Location:* ${
      [prospect.location, prospect.suburb, prospect.district, prospect.city]
        .filter(Boolean)
        .join(', ') || 'N/A'
    }`,
    `*Sector:* ${prospect.sector || 'N/A'}`,
    `*Category:* ${prospect.category || 'N/A'}`,
    `*Source:* ${prospect.sourceType || prospect.querySource || 'N/A'}`,
    ``,
    `*TASK DETAILS*`,
    `-----------------------------------`,
    `*Task Objective:* ${prospect.taskObjective || 'N/A'}`,
    `*Priority:* ${prospect.priority || prospect.urgency || 'Medium'}`,
    `*Follow-up Date:* ${
      prospect.followUpDate
        ? new Date(prospect.followUpDate).toLocaleDateString()
        : 'N/A'
    }`,
    `*Expected Next Action:* ${prospect.timelineNotes || 'N/A'}`,
    ``,
    `*ASSIGNMENT & STATUS*`,
    `-----------------------------------`,
    `*Pipeline Status:* ${prospect.pipelineStage}`,
    `*Last Activity:* ${prospect.lastActivityNote || 'No recent notes.'}`
  ]
  return details.join('\n')
}

const generateProspectPdfNote = (
  prospect: RPNProspectQuery,
  title: string,
  note?: string
) => {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, 297] })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 5
  let y = 10
  const lineHeight = 4
  const sectionSpacing = 3

  doc.setFont('courier', 'normal')
  doc.setFontSize(8)

  const addText = (
    text: string,
    options: { isBold?: boolean; isCentered?: boolean } = {}
  ) => {
    if (y > 280) {
      doc.addPage()
      y = 10
    }
    doc.setFont('courier', options.isBold ? 'bold' : 'normal')
    const x = options.isCentered ? pageWidth / 2 : margin
    const align = options.isCentered ? 'center' : 'left'
    const splitText = doc.splitTextToSize(text, pageWidth - margin * 2)
    doc.text(splitText, x, y, { align })
    y += splitText.length * lineHeight
  }

  const addLine = () => {
    y += sectionSpacing / 2
    doc.line(margin, y, pageWidth - margin, y)
    y += sectionSpacing
  }

  const addPair = (
    label: string,
    value: string | number | undefined | null
  ) => {
    if (value || value === 0) {
      const formattedLabel = `${label}:`.padEnd(15)
      addText(`${formattedLabel}${value}`)
    }
  }

  const session = JSON.parse(localStorage.getItem('activeStaffSession') || '{}')

  // Header
  addText('SCI / iTred', { isBold: true, isCentered: true })
  addText(title, { isBold: true, isCentered: true })
  y += 2
  addLine()
  addPair('Date', new Date().toLocaleString())
  addPair('By', session.staffName || 'System')
  addPair('Prospect ID', prospect.id)
  addLine()

  // Prospect Details
  addText('PROSPECT DETAILS', { isBold: true })
  addPair('Business', prospect.businessName)
  addPair('Contact', prospect.contactPerson)
  addPair('Phone', prospect.phone)
  addPair('WhatsApp', prospect.whatsappNumber || prospect.whatsapp)
  addPair('Sector', prospect.sector)
  addPair('Category', prospect.category)
  addPair(
    'Location',
    [prospect.location, prospect.suburb, prospect.district]
      .filter(Boolean)
      .join(', ')
  )
  addLine()

  // Assignment
  addText('ASSIGNMENT', { isBold: true })
  addPair('RPN', prospect.assignedRpnName)
  addPair('Staff', prospect.assignedStaffName)
  addPair('Priority', prospect.priority || prospect.urgency)
  addPair('Status', prospect.pipelineStage)
  addLine()

  // Task
  addText('TASK', { isBold: true })
  addPair('Objective', prospect.taskObjective)
  addPair('Next Action', prospect.timelineNotes)
  addPair(
    'Follow-up',
    prospect.followUpDate
      ? new Date(prospect.followUpDate).toLocaleDateString()
      : 'N/A'
  )
  addLine()

  // Footer
  y += 5
  addText('Powered by seiGEN Commerce', { isCentered: true })
  addText('SCI Operating System', { isCentered: true })
  addText('Printed for field follow-up and accountability', {
    isCentered: true
  })

  doc.save(`prospect_note_${prospect.id}_${Date.now()}.pdf`)
}

const DetailRow: React.FC<{ label: string; value: any }> = ({
  label,
  value
}) => (
  <div className='flex flex-col border-b border-stone-100 pb-2 last:border-0 last:pb-0'>
    <span className='text-[9px] font-bold uppercase text-stone-400'>
      {label}
    </span>
    <span className='font-bold text-stone-700'>{value || '-'}</span>
  </div>
)

const CostMetric: React.FC<{
  label: string
  value: any
  isTotal?: boolean
}> = ({ label, value, isTotal }) => (
  <div
    className={`p-3 border border-stone-200 ${
      isTotal ? 'bg-orange-50 border-brand-orange' : 'bg-stone-50'
    }`}
  >
    <span
      className={`text-[9px] font-bold uppercase ${
        isTotal ? 'text-brand-orange' : 'text-stone-400'
      } block mb-1`}
    >
      {label}
    </span>
    <span
      className={`font-mono font-bold ${
        isTotal ? 'text-brand-charcoal text-lg' : 'text-stone-700'
      }`}
    >
      ${Number(value || 0).toFixed(2)}
    </span>
  </div>
)

const inputClass =
  'w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50/50'

function stripUndefinedDeep<T> (obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(stripUndefinedDeep) as unknown as T
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, stripUndefinedDeep(value)])
    ) as T
  }
  return obj
}

const normalizeDateInput = (value: string | undefined | null) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const logProspectActivity = (
  prospect: RPNProspectQuery,
  actionType: string,
  actionLabel: string,
  note?: string,
  oldValue?: string,
  newValue?: string
): RPNProspectQuery => {
  const session = JSON.parse(localStorage.getItem('activeStaffSession') || '{}')
  const newLog: ProspectActivityLog = {
    id: `PA-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    prospectId: prospect.id,
    actionType,
    actionLabel,
    oldValue,
    newValue,
    note,
    createdBy: session.staffName || 'System',
    createdByRole: session.role || 'System',
    createdAt: new Date().toISOString()
  }
  return {
    ...prospect,
    activityHistory: [...(prospect.activityHistory || []), newLog]
  }
}

export const RPNManagement: React.FC = () => {
  // View State
  const [view, setView] = useState<
    | 'list'
    | 'profile'
    | 'form'
    | 'collection_form'
    | 'pipeline'
    | 'prospect_form'
    | 'prospect_detail'
    | 'pipeline_analytics'
    | 'compensation'
  >('list')
  const [selectedRPN, setSelectedRPN] = useState<RPN | null>(null)
  const [selectedProspect, setSelectedProspect] =
    useState<RPNProspectQuery | null>(null)

  // Data State
  const [rpns, setRpns] = useState<RPN[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [collections, setCollections] = useState<FieldCollectionRecord[]>([])
  const [prospects, setProspects] = useState<RPNProspectQuery[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [appointments, setAppointments] = useState<RPNAppointment[]>([])
  const [followUps, setFollowUps] = useState<RPNFollowUpTask[]>([])
  const [compensationPlans, setCompensationPlans] = useState<RpnCompensationPlan[]>([])
  const [compensationRuns, setCompensationRuns] = useState<RpnCompensationRun[]>([])
  const [vendorAssignments, setVendorAssignments] = useState<RpnVendorAssignment[]>([])
  const [onboardingWageLogs, setOnboardingWageLogs] = useState<RpnOnboardingLog[]>([])
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([])

  // Filter State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [rpnFilter, setRpnFilter] = useState('All')
  const [pipelineStageFilter, setPipelineStageFilter] = useState('All')
  const [staffFilter, setStaffFilter] = useState('All')
  const [sourceTypeFilter, setSourceTypeFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [overdueOnlyFilter, setOverdueOnlyFilter] = useState(false)
  const [dueTodayFilter, setDueTodayFilter] = useState(false)
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState('')
  const [analyticsDateTo, setAnalyticsDateTo] = useState('')
  const [compPeriodFrom, setCompPeriodFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  )
  const [compPeriodTo, setCompPeriodTo] = useState(today())
  const [compSelectedRunId, setCompSelectedRunId] = useState('')
  const [compPaymentAccountId, setCompPaymentAccountId] = useState('')
  const [compAssignmentRpnId, setCompAssignmentRpnId] = useState('')
  const [compAssignmentVendorId, setCompAssignmentVendorId] = useState('')
  const [compWageRpnId, setCompWageRpnId] = useState('')
  const [compWageVendorId, setCompWageVendorId] = useState('')
  const [compWageDate, setCompWageDate] = useState(today())
  const [compReportTab, setCompReportTab] = useState<
    | 'dashboard'
    | 'statements'
    | 'payables'
    | 'transactions'
    | 'portfolio'
    | 'churn'
    | 'coa'
    | 'cashbook'
    | 'profitability'
    | 'exceptions'
  >('dashboard')
  const [compReportRpnId, setCompReportRpnId] = useState('')
  const [compReportVendorId, setCompReportVendorId] = useState('')
  const [compReportRunId, setCompReportRunId] = useState('')
  const [compReportStatus, setCompReportStatus] = useState('')
  const [compReportTransactionType, setCompReportTransactionType] =
    useState<RpnCompensationLedgerTransactionType | ''>('')
  const [compReportPaymentStatus, setCompReportPaymentStatus] = useState('')

  // Modal State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [rpnToDelete, setRpnToDelete] = useState<string | null>(null)
  const [isMoveStageModalOpen, setIsMoveStageModalOpen] = useState(false)
  const [moveStageData, setMoveStageData] = useState<{
    prospect: RPNProspectQuery
    nextStage: PipelineStage
  } | null>(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignData, setAssignData] = useState<{
    prospect: RPNProspectQuery
    assignedRpnId: string
    assignedStaffId: string
    taskObjective: string
    followUpDate: string
    timelineNotes: string
    totalEstimatedCost: number
    priority: ProspectPriority
    reason: string
    assignmentRole: string
  } | null>(null)
  const [isMarkFollowUpOpen, setIsMarkFollowUpOpen] = useState(false)
  const [markFollowUpData, setMarkFollowUpData] = useState<{
    prospect: RPNProspectQuery
    notes: string
    nextFollowUpDate: string
  } | null>(null)

  // Form states
  const [rpnFormData, setRpnFormData] = useState<Partial<RPN>>({})
  const [collectionFormData, setCollectionFormData] = useState<
    Partial<FieldCollectionRecord>
  >({})
  const [prospectFormData, setProspectFormData] = useState<
    Partial<RPNProspectQuery>
  >({})
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

  const convertToVendor = (prospect: RPNProspectQuery) => {
    if (prospect.pipelineStage !== 'Ready for Onboarding') {
      alert(
        "Only prospects in 'Ready for Onboarding' stage can be converted directly."
      )
      return
    }

    const prefillData = {
      name: prospect.businessName || prospect.prospectName || '',
      tradingName: prospect.businessName || prospect.prospectName || '',
      ownerFullName: prospect.contactPerson || '',
      mainPhone: prospect.phone || prospect.whatsappNumber || '',
      whatsappNumber:
        prospect.whatsappNumber || prospect.whatsapp || prospect.phone || '',
      sector: prospect.sector || '',
      businessType: prospect.category || '',
      streetAddress: prospect.location || '',
      cityTown: prospect.city || '',
      district: prospect.district || '',
      suburb: prospect.suburb || '',
      assignedRPNId: prospect.assignedRpnId || '',
      rpnName: prospect.assignedRpnName || '',
      assignedStaffId: prospect.assignedStaffId || '',
      assignedStaffName: prospect.assignedStaffName || '',
      prospectId: prospect.id
    }

    localStorage.setItem(
      'itred_vendor_prefill_from_prospect',
      JSON.stringify(prefillData)
    )
    window.location.href = '/vendor-management'
  }

  const handleSendWhatsAppLead = async (
    prospect: RPNProspectQuery,
    target: 'rpn' | 'staff'
  ) => {
    let assigneePhone: string | undefined
    let assigneeName: string | undefined

    if (target === 'rpn') {
      const rpn = safeRpns.find(r => r.id === prospect.assignedRpnId)
      assigneePhone = rpn?.whatsapp || rpn?.phone
      assigneeName = rpn?.name
    } else {
      const staff = staffList.find(s => s.id === prospect.assignedStaffId)
      assigneePhone = staff?.whatsapp || staff?.phone
      assigneeName = staff?.fullName
    }

    if (!assigneePhone) {
      showBrandedAlert({
        title: 'WhatsApp Dispatch Failed',
        message: `No WhatsApp or phone number found for the assigned ${target}.`,
        type: 'error'
      })
      return
    }

    const message = generateProspectWhatsAppMessage(prospect)
    const encodedMessage = encodeURIComponent(message)
    const cleanPhone = assigneePhone.replace(/\D/g, '')
    const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`

    window.open(url, '_blank')

    const updatedProspect = logProspectActivity(
      prospect,
      'WHATSAPP_LEAD_DISPATCHED',
      'Lead Dispatched via WhatsApp',
      `Sent lead to ${assigneeName || 'assignee'} via WhatsApp.`
    )

    rpnService.saveProspect(updatedProspect)
    await loadData() // To refresh the activity timeline if viewed
    if (view === 'prospect_detail' && selectedProspect?.id === prospect.id) {
      setSelectedProspect(updatedProspect)
    }
  }

  const handleCopyWhatsAppLead = async (prospect: RPNProspectQuery) => {
    const message = generateProspectWhatsAppMessage(prospect)
    await navigator.clipboard.writeText(message)
    showBrandedAlert({
      title: 'Message Copied',
      message: 'The WhatsApp lead message has been copied to your clipboard.',
      type: 'success'
    })
  }

  const handleGeneratePdfNote = async (
    prospect: RPNProspectQuery,
    type: 'TASK_NOTE' | 'FOLLOW_UP_REMINDER' | 'ONBOARDING_HANDOFF'
  ) => {
    let title = 'PROSPECT TASK NOTE'
    let note = 'Standard task assignment note.'
    if (type === 'FOLLOW_UP_REMINDER') {
      title = 'FOLLOW-UP REMINDER'
      note = `Please follow up with this prospect on or before ${
        prospect.followUpDate
          ? new Date(prospect.followUpDate).toLocaleDateString()
          : 'the due date'
      }.`
    }
    if (type === 'ONBOARDING_HANDOFF') {
      title = 'ONBOARDING HANDOFF'
      note =
        'This prospect is ready for onboarding. Please complete the vendor creation process.'
    }

    generateProspectPdfNote(prospect, title, note)

    const updatedProspect = logProspectActivity(
      prospect,
      'PDF_TASK_NOTE_GENERATED',
      'PDF Task Note Generated',
      `Generated ${type.replace(/_/g, ' ')}`
    )
    rpnService.saveProspect(updatedProspect)
    await loadData()
    if (view === 'prospect_detail' && selectedProspect?.id === prospect.id) {
      setSelectedProspect(updatedProspect)
    }
    showBrandedAlert({
      title: 'PDF Generated',
      message: `${type.replace(/_/g, ' ')} has been generated and downloaded.`,
      type: 'success'
    })
  }

  const getProspectTimeline = (prospect: RPNProspectQuery) => {
    const items: any[] = []

    if (!prospect.activityHistory || prospect.activityHistory.length === 0) {
      items.push({
        id: 'created',
        timestamp: prospect.createdAt,
        eventType: 'PROSPECT_CREATED',
        details: `Source: ${
          prospect.sourceType || prospect.querySource || 'Unknown'
        }`
      })
    } else {
      prospect.activityHistory.forEach(act => {
        items.push({
          id: act.id,
          timestamp: act.createdAt,
          eventType: act.actionLabel,
          details: `${act.note || ''} ${
            act.oldValue || act.newValue
              ? `[${act.oldValue || 'None'} -> ${act.newValue || 'None'}]`
              : ''
          } - by ${act.createdBy}`
        })
      })
    }

    return items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  const safeVendors = asArray<Vendor>(vendors)
  const safeRpns = asArray<RPN>(rpns)
  const safeCollections = asArray<FieldCollectionRecord>(collections)
  const safeProspects = asArray<RPNProspectQuery>(prospects)
  const safeAppointments = asArray<RPNAppointment>(appointments)
  const safeFollowUps = asArray<RPNFollowUpTask>(followUps)
  const safeCompPlans = asArray<RpnCompensationPlan>(compensationPlans)
  const safeCompRuns = asArray<RpnCompensationRun>(compensationRuns)
  const safeAssignments = asArray<RpnVendorAssignment>(vendorAssignments)
  const safeWageLogs = asArray<RpnOnboardingLog>(onboardingWageLogs)
  const safeCashBankAccounts = asArray<CashBankAccount>(cashBankAccounts)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [search])

  const loadData = async () => {
    setIsLoadingData(true)
    const startMs = performance.now()
    try {
      const rawRpns = rpnService.getAll()
      const rawCollections = rpnService.getCollections()
      const rawProspects = rpnService.getProspects()
      const rawAppointments = rpnService.getAppointments()
      const rawFollowUps = rpnService.getFollowUps()
      const [rawVendors, rawStaff] = await Promise.all([
        vendorService.getVendors(),
        staffService.getAllStaff()
      ])

      setRpns(asArray<RPN>(rawRpns))
      setVendors(asArray<Vendor>(rawVendors))
      setCollections(asArray<FieldCollectionRecord>(rawCollections))
      setProspects(asArray<RPNProspectQuery>(rawProspects))
      setStaffList(asArray<Staff>(rawStaff))
      setAppointments(asArray<RPNAppointment>(rawAppointments))
      setFollowUps(asArray<RPNFollowUpTask>(rawFollowUps))
      setCompensationPlans(rpnCompensationService.getCompensationPlans())
      setCompensationRuns(rpnCompensationService.getCompensationRuns())
      setVendorAssignments(rpnCompensationService.getVendorAssignments())
      setOnboardingWageLogs(rpnCompensationService.getOnboardingLogs())
      setCashBankAccounts(financeService.getActiveCashBankAccounts())
    } catch (error) {
      console.warn(
        'RPN Management data failed to load. Using empty arrays.',
        error
      )
      setRpns([])
      setVendors([])
      setCollections([])
      setProspects([])
      setStaffList([])
      setAppointments([])
      setFollowUps([])
      setCompensationPlans([])
      setCompensationRuns([])
      setVendorAssignments([])
      setOnboardingWageLogs([])
      setCashBankAccounts([])
    } finally {
      setIsLoadingData(false)
      console.info("Data load completed", {
        page: "RPNManagement",
        elapsedMs: Math.round(performance.now() - startMs)
      })
    }
  }

  const filteredRPNs = useMemo(() => {
    const normalizedSearch = debouncedSearch.toLowerCase()
    return safeRpns.filter(
      r =>
        (r.name.toLowerCase().includes(normalizedSearch) ||
          r.id.toLowerCase().includes(normalizedSearch)) &&
        (rpnFilter === 'All' || r.status === rpnFilter)
    )
  }, [rpns, debouncedSearch, rpnFilter])

  const filteredProspects = useMemo(() => {
    const normalizedSearch = debouncedSearch.toLowerCase()
    return safeProspects.filter(p => {
      const matchesSearch = buildSearchText([
        p.prospectName,
        p.businessName,
        p.contactPerson,
        p.phone,
        p.whatsapp,
        p.whatsappNumber,
        p.assignedRpnName,
        p.assignedStaffName,
        p.sector,
        p.category,
        p.suburb,
        p.city,
        p.notes
      ]).includes(normalizedSearch)

      const matchesRpn = rpnFilter === 'All' || p.assignedRpnId === rpnFilter
      const matchesStaff =
        staffFilter === 'All' || p.assignedStaffId === staffFilter
      const matchesSource =
        sourceTypeFilter === 'All' ||
        p.sourceType === sourceTypeFilter ||
        p.querySource === sourceTypeFilter
      const matchesPriority =
        priorityFilter === 'All' ||
        p.priority === priorityFilter ||
        p.urgency === priorityFilter
      const matchesStage =
        pipelineStageFilter === 'All' || p.pipelineStage === pipelineStageFilter

      let matchesOverdue = true
      if (overdueOnlyFilter) {
        const followUp = p.followUpDate || p.nextFollowUpDate
        if (!followUp) {
          matchesOverdue = false
        } else {
          const followUpDate = new Date(followUp)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          followUpDate.setHours(0, 0, 0, 0)
          matchesOverdue =
            followUpDate.getTime() < today.getTime() &&
            !isRecoverableStage(p.pipelineStage) &&
            p.pipelineStage !== 'Onboarded'
        }
      }

      let matchesDueToday = true
      if (dueTodayFilter) {
        const followUp = p.followUpDate || p.nextFollowUpDate
        if (!followUp) {
          matchesDueToday = false
        } else {
          const followUpDate = new Date(followUp)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          followUpDate.setHours(0, 0, 0, 0)
          matchesDueToday =
            followUpDate.getTime() === today.getTime() &&
            !isRecoverableStage(p.pipelineStage) &&
            p.pipelineStage !== 'Onboarded'
        }
      }

      return (
        matchesSearch &&
        matchesRpn &&
        matchesStaff &&
        matchesSource &&
        matchesPriority &&
        matchesStage &&
        matchesOverdue &&
        matchesDueToday
      )
    })
  }, [
    prospects,
    debouncedSearch,
    rpnFilter,
    staffFilter,
    sourceTypeFilter,
    priorityFilter,
    pipelineStageFilter,
    overdueOnlyFilter,
    dueTodayFilter
  ])

  const stats = useMemo(() => {
    const activeVendors = safeVendors.filter(v => v.status === 'active').length
    const pendingCollections = safeCollections.filter(
      c => c.status === 'pending backend entry'
    ).length
    const collectionsThisMonth = safeCollections.length

    // Vendors due this week or overdue
    const now = new Date()
    const vendorsOverdue = safeVendors.filter(v => {
      if (!v.subscriptionDueDate || v.subscriptionStatus === 'active')
        return false
      const due = new Date(v.subscriptionDueDate)
      return due < now
    }).length

    const followUpsPending = safeVendors.filter(v => {
      if (!v.nextFollowUpDate) return false
      return new Date(v.nextFollowUpDate) <= now
    }).length

    return {
      activeVendors,
      pendingCollections,
      collectionsThisMonth,
      vendorsOverdue,
      followUpsPending
    }
  }, [vendors, collections])

  const compensationDashboard = useMemo(() => {
    const periodRuns = safeCompRuns.filter(
      run => run.periodFrom >= compPeriodFrom && run.periodTo <= compPeriodTo
    )
    const latestRun = [...safeCompRuns].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
    const lines = periodRuns.flatMap(run => run.lines || [])
    const totalPayable = periodRuns.reduce((sum, run) => sum + run.totalPayable, 0)
    const wageAmount = periodRuns.reduce((sum, run) => sum + run.wageTotal, 0)
    const recurringCommissionAmount = periodRuns.reduce(
      (sum, run) => sum + run.recurringCommissionTotal,
      0
    )
    const churnBonusAmount = periodRuns.reduce(
      (sum, run) => sum + run.churnBonusTotal,
      0
    )
    const averageChurnRate =
      lines.length > 0
        ? lines.reduce((sum, line) => sum + line.churnRatePercent, 0) /
          lines.length
        : 0
    return {
      latestRun,
      totalPayable,
      wageAmount,
      recurringCommissionAmount,
      churnBonusAmount,
      averageChurnRate,
      abovePortfolioCeiling: lines.filter(line => line.overPortfolioCeiling).length,
      readyForCommissionOnly: lines.filter(line => line.readyForCommissionOnly).length,
      postedButUnpaid: safeCompRuns
        .filter(run => run.status === 'posted')
        .reduce((sum, run) => sum + run.totalPayable, 0)
    }
  }, [safeCompRuns, compPeriodFrom, compPeriodTo])

  const pipelineStats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let total = 0,
      newProspects = 0,
      dueToday = 0,
      overdue = 0,
      readyForOnboarding = 0,
      onboarded = 0,
      dormant = 0,
      lost = 0

    safeProspects.forEach(p => {
      total++
      if (p.pipelineStage === 'New Prospect') newProspects++
      if (p.pipelineStage === 'Ready for Onboarding') readyForOnboarding++
      if (p.pipelineStage === 'Onboarded') onboarded++
      if (p.pipelineStage === 'Dormant') dormant++
      if (
        p.pipelineStage === 'Not Interested' ||
        p.pipelineStage === 'Rejected' ||
        p.pipelineStage === 'Closed / Lost'
      )
        lost++

      const isTerminal =
        isRecoverableStage(p.pipelineStage) ||
        p.pipelineStage === 'Onboarded' ||
        p.pipelineStage === 'Closed / Lost'
      if (!isTerminal && (p.followUpDate || p.nextFollowUpDate)) {
        const fDate = new Date(p.followUpDate || p.nextFollowUpDate!)
        fDate.setHours(0, 0, 0, 0)
        if (fDate.getTime() === today.getTime()) dueToday++
        else if (fDate.getTime() < today.getTime()) overdue++
      }
    })

    return {
      total,
      newProspects,
      dueToday,
      overdue,
      readyForOnboarding,
      onboarded,
      dormant,
      lost
    }
  }, [safeProspects])

  const pipelineCostStats = useMemo(() => {
    let estCost = 0
    let actualCost = 0
    let onboardedActual = 0
    let onboardedCount = 0
    let lostActual = 0

    safeProspects.forEach(p => {
      estCost += Number(
        p.totalEstimatedCost ?? p.totalCost ?? p.estimatedCost ?? 0
      )
      actualCost += Number(p.totalActualCost ?? 0)

      if (p.pipelineStage === 'Onboarded') {
        onboardedActual += Number(p.totalActualCost ?? 0)
        onboardedCount++
      }
      if (
        p.pipelineStage === 'Closed / Lost' ||
        p.pipelineStage === 'Not Interested' ||
        p.pipelineStage === 'Rejected'
      ) {
        lostActual += Number(p.totalActualCost ?? 0)
      }
    })

    const costPerOnboarding =
      onboardedCount > 0 ? onboardedActual / onboardedCount : 0
    return { estCost, actualCost, costPerOnboarding, lostActual }
  }, [safeProspects])

  const pipelineAnalyticsData = useMemo(() => {
    const filtered = safeProspects.filter(p => {
      const date = p.createdAt ? p.createdAt.slice(0, 10) : ''
      if (analyticsDateFrom && date < analyticsDateFrom) return false
      if (analyticsDateTo && date > analyticsDateTo) return false
      if (rpnFilter !== 'All' && p.assignedRpnId !== rpnFilter) return false
      if (staffFilter !== 'All' && p.assignedStaffId !== staffFilter)
        return false
      if (
        sourceTypeFilter !== 'All' &&
        p.sourceType !== sourceTypeFilter &&
        p.querySource !== sourceTypeFilter
      )
        return false
      if (
        pipelineStageFilter !== 'All' &&
        p.pipelineStage !== pipelineStageFilter
      )
        return false
      return true
    })

    let active = 0,
      dueToday = 0,
      overdue = 0,
      ready = 0,
      onboarded = 0,
      lost = 0,
      dormant = 0
    let totalCost = 0
    let onboardedCost = 0

    const byStatus: Record<string, number> = {}
    const bySource: Record<string, number> = {}
    const byRpn: Record<string, number> = {}
    const byStaff: Record<string, number> = {}
    const rpnConversions: Record<string, { total: number; onboarded: number }> =
      {}
    const overdueAssignees: Record<string, number> = {}

    const todayStr = new Date().toISOString().split('T')[0]
    let totalTimeToReady = 0,
      countTimeToReady = 0,
      totalTimeToOnboard = 0,
      countTimeToOnboard = 0

    filtered.forEach(p => {
      byStatus[p.pipelineStage] = (byStatus[p.pipelineStage] || 0) + 1
      if (
        ![
          'Onboarded',
          'Not Interested',
          'Rejected',
          'Closed / Lost',
          'Dormant'
        ].includes(p.pipelineStage)
      )
        active++
      if (p.pipelineStage === 'Ready for Onboarding') ready++
      if (p.pipelineStage === 'Onboarded') onboarded++
      if (
        ['Not Interested', 'Rejected', 'Closed / Lost'].includes(
          p.pipelineStage
        )
      )
        lost++
      if (p.pipelineStage === 'Dormant') dormant++

      const source = p.sourceType || p.querySource || 'Unknown'
      bySource[source] = (bySource[source] || 0) + 1

      const rpnName = p.assignedRpnName || 'Unassigned RPN'
      byRpn[rpnName] = (byRpn[rpnName] || 0) + 1

      const staffName = p.assignedStaffName || 'Unassigned Staff'
      byStaff[staffName] = (byStaff[staffName] || 0) + 1

      if (!rpnConversions[rpnName])
        rpnConversions[rpnName] = { total: 0, onboarded: 0 }
      rpnConversions[rpnName].total++
      if (p.pipelineStage === 'Onboarded') rpnConversions[rpnName].onboarded++

      const cost = Number(
        p.totalActualCost ??
          p.totalEstimatedCost ??
          p.totalCost ??
          p.estimatedCost ??
          0
      )
      totalCost += cost
      if (p.pipelineStage === 'Onboarded') onboardedCost += cost

      if (
        !isRecoverableStage(p.pipelineStage) &&
        p.pipelineStage !== 'Onboarded' &&
        (p.followUpDate || p.nextFollowUpDate)
      ) {
        const fuStr = new Date(p.followUpDate || p.nextFollowUpDate!)
          .toISOString()
          .split('T')[0]
        if (fuStr === todayStr) dueToday++
        else if (fuStr < todayStr) {
          overdue++
          const assignee =
            p.assignedStaffName || p.assignedRpnName || 'Unassigned'
          overdueAssignees[assignee] = (overdueAssignees[assignee] || 0) + 1
        }
      }

      if (p.stageHistory) {
        const createdTime = new Date(p.createdAt).getTime()
        const readyHist = p.stageHistory.find(
          h => h.stage === 'Ready for Onboarding'
        )
        if (readyHist) {
          totalTimeToReady +=
            (new Date(readyHist.enteredAt).getTime() - createdTime) / 86400000
          countTimeToReady++
        }
        const onboardHist = p.stageHistory.find(h => h.stage === 'Onboarded')
        if (onboardHist) {
          totalTimeToOnboard +=
            (new Date(onboardHist.enteredAt).getTime() - createdTime) / 86400000
          countTimeToOnboard++
        }
      }
    })

    return {
      total: filtered.length,
      active,
      dueToday,
      overdue,
      ready,
      onboarded,
      lost,
      dormant,
      totalCost,
      costPerOnboarded: onboarded > 0 ? totalCost / onboarded : 0,
      costPerLost: lost > 0 ? (totalCost - onboardedCost) / lost : 0,
      byStatus,
      bySource,
      byRpn,
      byStaff,
      rpnConversions,
      overdueAssignees,
      avgTimeToReady:
        countTimeToReady > 0 ? totalTimeToReady / countTimeToReady : 0,
      avgTimeToOnboard:
        countTimeToOnboard > 0 ? totalTimeToOnboard / countTimeToOnboard : 0
    }
  }, [
    safeProspects,
    analyticsDateFrom,
    analyticsDateTo,
    rpnFilter,
    staffFilter,
    sourceTypeFilter,
    pipelineStageFilter
  ])

  const handleDeleteRPN = async () => {
    if (rpnToDelete) {
      try {
        const rpn = safeRpns.find(r => r.id === rpnToDelete)
        await rpnService.delete(rpnToDelete)
        analyticsService.logEvent({
          eventType: 'RPN_UPDATED', // Using RPN_UPDATED with action detail
          actorType: 'admin',
          actorName: 'System Admin',
          rpnId: rpnToDelete,
          details: { action: 'purged', name: rpn?.name }
        })
        loadData()
        setIsDeleteDialogOpen(false)
        setRpnToDelete(null)
        alert('Deleted successfully')
      } catch (error: any) {
        console.error(error)
        alert(error.message || 'Delete failed')
      }
    }
  }

  const startNewRPN = () => {
    setRpnFormData({
      id: `RPN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      status: 'active',
      level: 'Junior RPN',
      assignedVendors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    setView('form')
  }

  const requireFinanceControl = () => {
    const allowed =
      permissionService.hasActionPermission('finance.rpnPayments.approve') ||
      permissionService.hasActionPermission('finance.payment.post') ||
      permissionService.canApprove('rpnManagement')
    if (!allowed) alert('Finance/Admin permission is required for this action.')
    return allowed
  }

  const refreshCompensationData = () => {
    setCompensationPlans(rpnCompensationService.getCompensationPlans())
    setCompensationRuns(rpnCompensationService.getCompensationRuns())
    setVendorAssignments(rpnCompensationService.getVendorAssignments())
    setOnboardingWageLogs(rpnCompensationService.getOnboardingLogs())
    setCashBankAccounts(financeService.getActiveCashBankAccounts())
  }

  const handleSaveCompPlan = (plan: RpnCompensationPlan) => {
    rpnCompensationService.updateCompensationPlan(plan.id, plan)
    refreshCompensationData()
  }

  const handleAssignCompVendor = () => {
    if (!compAssignmentRpnId || !compAssignmentVendorId) {
      alert('Select an RPN and vendor first.')
      return
    }
    const vendor = safeVendors.find(v => v.id === compAssignmentVendorId)
    rpnCompensationService.assignVendorToRpn(
      compAssignmentVendorId,
      compAssignmentRpnId,
      'Management portfolio assignment',
      vendor?.name
    )
    refreshCompensationData()
  }

  const handleRecordWageLog = (status: RpnOnboardingLog['status']) => {
    if (!compWageRpnId || !compWageVendorId) {
      alert('Select an RPN and vendor first.')
      return
    }
    const rpn = safeRpns.find(item => item.id === compWageRpnId)
    const vendor = safeVendors.find(item => item.id === compWageVendorId)
    rpnCompensationService.recordOnboardingForWage({
      rpnId: compWageRpnId,
      rpnName: rpn?.name || '',
      vendorId: compWageVendorId,
      vendorName: vendor?.name || '',
      onboardingDate: compWageDate,
      status,
      qualifiesForWage: status === 'approved',
      approvedBy: status === 'approved' ? 'Management' : undefined,
      approvedAt: status === 'approved' ? new Date().toISOString() : undefined
    })
    refreshCompensationData()
  }

  const handleGenerateCompRun = async () => {
    const run = await rpnCompensationService.generateCompensationRun(
      compPeriodFrom,
      compPeriodTo
    )
    setCompSelectedRunId(run.id)
    refreshCompensationData()
  }

  const handleApproveCompRun = () => {
    if (!requireFinanceControl() || !compSelectedRunId) return
    rpnCompensationService.approveCompensationRun(compSelectedRunId)
    refreshCompensationData()
  }

  const handlePostCompRun = () => {
    if (!requireFinanceControl() || !compSelectedRunId) return
    rpnCompensationService.postCompensationRunToCOA(compSelectedRunId)
    refreshCompensationData()
  }

  const handlePayCompRun = () => {
    if (!requireFinanceControl() || !compSelectedRunId || !compPaymentAccountId) {
      alert('Select an approved posted run and payment account.')
      return
    }
    rpnCompensationService.payCompensationRun(compSelectedRunId, compPaymentAccountId)
    refreshCompensationData()
  }

  const handleMoveCommissionOnly = (rpnId: string) => {
    if (!requireFinanceControl()) return
    rpnCompensationService.moveRpnToCommissionOnly(rpnId)
    refreshCompensationData()
  }

  const compensationReportFilters = {
    dateFrom: compPeriodFrom,
    dateTo: compPeriodTo,
    rpnId: compReportRpnId,
    vendorId: compReportVendorId,
    compensationRunId: compReportRunId,
    status: compReportStatus,
    transactionType: compReportTransactionType,
    paymentStatus: compReportPaymentStatus
  }

  const downloadCompensationPdf = (
    title: string,
    headers: string[],
    rows: Array<Array<string | number>>
  ) => {
    const doc = new jsPDF()
    let y = 18
    doc.setFontSize(16)
    doc.text(`SCI / iTred ${title}`, 14, y)
    y += 8
    doc.setFontSize(9)
    doc.text(`Period: ${compPeriodFrom || 'All'} to ${compPeriodTo || 'All'}`, 14, y)
    y += 5
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y)
    y += 7
    ;(doc as any).autoTable({
      startY: y,
      head: [headers],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 107, 0] }
    })
    doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}-${today()}.pdf`)
  }

  const renderReportFilterBar = () => (
    <DataPanel title='Report Filters'>
      <div className='grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-3 p-4'>
        <input type='date' className={inputClass} value={compPeriodFrom} onChange={e => setCompPeriodFrom(e.target.value)} />
        <input type='date' className={inputClass} value={compPeriodTo} onChange={e => setCompPeriodTo(e.target.value)} />
        <select className={inputClass} value={compReportRpnId} onChange={e => setCompReportRpnId(e.target.value)}>
          <option value=''>All RPNs</option>
          {safeRpns.map(rpn => <option key={rpn.id} value={rpn.id}>{rpn.name}</option>)}
        </select>
        <select className={inputClass} value={compReportVendorId} onChange={e => setCompReportVendorId(e.target.value)}>
          <option value=''>All Vendors</option>
          {safeVendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
        </select>
        <select className={inputClass} value={compReportRunId} onChange={e => setCompReportRunId(e.target.value)}>
          <option value=''>All Runs</option>
          {safeCompRuns.map(run => <option key={run.id} value={run.id}>{run.periodFrom} / {run.status}</option>)}
        </select>
        <select className={inputClass} value={compReportStatus} onChange={e => setCompReportStatus(e.target.value)}>
          <option value=''>All Status</option>
          {['draft', 'approved', 'posted', 'paid', 'reversed', 'cancelled'].map(status => <option key={status} value={status}>{status}</option>)}
        </select>
        <select className={inputClass} value={compReportTransactionType} onChange={e => setCompReportTransactionType(e.target.value as RpnCompensationLedgerTransactionType | '')}>
          <option value=''>All Movement Types</option>
          {[
            'onboarding_wage',
            'recurring_commission',
            'churn_bonus',
            'manual_adjustment',
            'wage_reversal',
            'commission_reversal',
            'bonus_reversal',
            'coa_posting',
            'payment'
          ].map(type => <option key={type} value={type}>{type}</option>)}
        </select>
        <select className={inputClass} value={compReportPaymentStatus} onChange={e => setCompReportPaymentStatus(e.target.value)}>
          <option value=''>All Payment Status</option>
          {['posted', 'paid', 'reversed'].map(status => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>
    </DataPanel>
  )

  const renderCompensationReports = () => {
    const statements = rpnCompensationService.generateCompensationStatements(compensationReportFilters)
    const payables = rpnCompensationService.generatePayablesLedgerReport(compensationReportFilters)
    const transactions = rpnCompensationService.getTransactionLedger(compensationReportFilters)
    const portfolio = rpnCompensationService.generatePortfolioRevenueReport(compensationReportFilters)
    const churn = rpnCompensationService.generateChurnRetentionReport(compensationReportFilters)
    const cashbook = rpnCompensationService.generateCashbookPaymentReport(compensationReportFilters)
    const profitability = rpnCompensationService.generateProfitabilityReport(compensationReportFilters)
    const exceptions = rpnCompensationService.generateExceptionReport(compensationReportFilters)
    const coaRows = transactions.filter(row => row.transactionType === 'coa_posting' || row.coaDebitAccountId || row.coaCreditAccountId)

    if (compReportTab === 'statements') {
      const rows = statements.map(row => [row.rpnName, row.wageEarned.toFixed(2), row.recurringCommissionEarned.toFixed(2), row.churnBonusEarned.toFixed(2), row.amountPaid.toFixed(2), row.balanceDue.toFixed(2), row.churnRatePercent.toFixed(1), row.wageStatus])
      return <TablePanel title='Compensation Statements' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN Compensation Statement', ['RPN', 'Wage', 'Commission', 'Bonus', 'Paid', 'Balance', 'Churn %', 'Wage Status'], rows)}>Download PDF</SecondaryButton>} headers={['RPN', 'Wage', 'Commission', 'Bonus', 'Paid', 'Balance', 'Churn %', 'Wage Status']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    if (compReportTab === 'payables') {
      const rows = payables.map(row => [row.rpnName, row.openingBalance.toFixed(2), row.wageEarned.toFixed(2), row.commissionEarned.toFixed(2), row.bonusEarned.toFixed(2), row.reversals.toFixed(2), row.payments.toFixed(2), row.closingBalance.toFixed(2)])
      return <TablePanel title='Payables Ledger' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN Payables Ledger', ['RPN', 'Opening', 'Wage', 'Commission', 'Bonus', 'Reversals', 'Payments', 'Closing'], rows)}>Download PDF</SecondaryButton>} headers={['RPN', 'Opening', 'Wage', 'Commission', 'Bonus', 'Reversals', 'Payments', 'Closing']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    if (compReportTab === 'transactions') {
      const rows = transactions.map(row => [row.transactionDate, row.rpnName || row.rpnId, row.transactionType, row.debitAmount.toFixed(2), row.creditAmount.toFixed(2), row.runningBalance.toFixed(2), row.status, row.description])
      return <TablePanel title='Transaction Ledger' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN Transaction Ledger', ['Date', 'RPN', 'Type', 'Debit', 'Credit', 'Balance', 'Status', 'Description'], rows)}>Download PDF</SecondaryButton>} headers={['Date', 'RPN', 'Type', 'Debit', 'Credit', 'Balance', 'Status', 'Description']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    if (compReportTab === 'portfolio') {
      const rows = portfolio.map(row => [row.rpnName, row.openingPortfolioVendors, row.newVendorsOnboarded, row.returningVendors, row.churnedVendors, row.grossVendorRevenueReceived.toFixed(2), row.totalRpnCost.toFixed(2), row.netRpnContribution.toFixed(2), `${row.portfolioCeilingUsagePercent.toFixed(1)}%`])
      return <TablePanel title='Portfolio Revenue' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN Portfolio Revenue Report', ['RPN', 'Opening', 'New', 'Returning', 'Churned', 'Revenue', 'Cost', 'Net', 'Ceiling'], rows)}>Download PDF</SecondaryButton>} headers={['RPN', 'Opening', 'New', 'Returning', 'Churned', 'Revenue', 'Cost', 'Net', 'Ceiling']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    if (compReportTab === 'churn') {
      const rows = churn.map(row => [row.rpnName, row.openingActiveVendors, row.returningVendors, row.churnedVendors, `${row.churnPercentage.toFixed(1)}%`, `${row.churnThreshold.toFixed(1)}%`, row.bonusQualification ? 'Yes' : 'No', row.bonusAmount.toFixed(2), row.highChurnWarning ? 'High Churn' : 'Normal'])
      return <TablePanel title='Churn & Retention' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN Churn & Retention Report', ['RPN', 'Opening', 'Returning', 'Churned', 'Churn %', 'Threshold', 'Qualified', 'Bonus', 'Warning'], rows)}>Download PDF</SecondaryButton>} headers={['RPN', 'Opening', 'Returning', 'Churned', 'Churn %', 'Threshold', 'Qualified', 'Bonus', 'Warning']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    if (compReportTab === 'coa') {
      const rows = coaRows.map(row => [row.transactionDate, row.compensationRunId || row.sourceId, row.rpnName || row.rpnId, row.transactionType, row.coaDebitAccountId || '-', row.coaCreditAccountId || '-', row.journalEntryId || '-', row.status])
      return <TablePanel title='COA Posting Report' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN COA Posting Report', ['Date', 'Run', 'RPN', 'Type', 'Debit COA', 'Credit COA', 'Journal', 'Status'], rows)}>Download PDF</SecondaryButton>} headers={['Date', 'Run', 'RPN', 'Type', 'Debit COA', 'Credit COA', 'Journal', 'Status']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    if (compReportTab === 'cashbook') {
      const rows = cashbook.map(row => [row.paymentDate, row.rpnName, row.amount.toFixed(2), row.paymentAccount, row.paymentMethod, row.reference, row.cashbookEntryId || '-', row.compensationRunId, row.paidBy || '-', row.status])
      return <TablePanel title='Cashbook Payment Report' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN Cashbook Payment Report', ['Date', 'RPN', 'Amount', 'Account', 'Method', 'Reference', 'Cashbook', 'Run', 'Paid By', 'Status'], rows)}>Download PDF</SecondaryButton>} headers={['Date', 'RPN', 'Amount', 'Account', 'Method', 'Reference', 'Cashbook', 'Run', 'Paid By', 'Status']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    if (compReportTab === 'profitability') {
      const rows = profitability.map(row => [row.rpnName, row.grossRevenueFromAssignedVendors.toFixed(2), row.wageCost.toFixed(2), row.commissionCost.toFixed(2), row.bonusCost.toFixed(2), row.totalRpnCost.toFixed(2), row.netContribution.toFixed(2), `${row.costToRevenuePercentage.toFixed(1)}%`, row.portfolioProductivity.toFixed(2)])
      return <TablePanel title='Profitability Report' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN Profitability Report', ['RPN', 'Revenue', 'Wage', 'Commission', 'Bonus', 'Cost', 'Net', 'Cost %', 'Productivity'], rows)}>Download PDF</SecondaryButton>} headers={['RPN', 'Revenue', 'Wage', 'Commission', 'Bonus', 'Cost', 'Net', 'Cost %', 'Productivity']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    if (compReportTab === 'exceptions') {
      const rows = exceptions.map(row => [row.severity, row.type, row.message, row.rpnId || '-', row.vendorId || '-', row.compensationRunId || '-'])
      return <TablePanel title='Exception Report' actions={<SecondaryButton size='sm' onClick={() => downloadCompensationPdf('RPN Exception Report', ['Severity', 'Type', 'Message', 'RPN', 'Vendor', 'Run'], rows)}>Download PDF</SecondaryButton>} headers={['Severity', 'Type', 'Message', 'RPN', 'Vendor', 'Run']}>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className='px-6 py-4 text-xs font-bold uppercase'>{cell}</td>)}</tr>)}</TablePanel>
    }
    return null
  }

  if (view === 'compensation') {
    const selectedRun =
      safeCompRuns.find(run => run.id === compSelectedRunId) ||
      compensationDashboard.latestRun ||
      safeCompRuns[0]
    const activePlan = safeCompPlans.find(plan => plan.isActive) || safeCompPlans[0]

    return (
      <div className='space-y-6 pb-24'>
        <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-stone-200 bg-stone-50 p-5'>
          <div>
            <h3 className='text-sm font-black uppercase text-brand-charcoal'>
              RPN Compensation
            </h3>
            <p className='text-[10px] font-bold uppercase text-stone-400'>
              Wage, portfolio, recurring commission, churn bonus, COA posting and cashbook payments.
            </p>
          </div>
          <SecondaryButton onClick={() => setView('list')}>
            <ChevronRight size={14} className='rotate-180 mr-2' /> Back
          </SecondaryButton>
        </div>

        <div className='grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4'>
          <StatCard label='Payable This Month' value={`$${compensationDashboard.totalPayable.toFixed(2)}`} icon={DollarSign} />
          <StatCard label='Wage Amount' value={`$${compensationDashboard.wageAmount.toFixed(2)}`} icon={Users} />
          <StatCard label='Recurring Commission' value={`$${compensationDashboard.recurringCommissionAmount.toFixed(2)}`} icon={TrendingUp} />
          <StatCard label='Churn Bonus' value={`$${compensationDashboard.churnBonusAmount.toFixed(2)}`} icon={CheckCircle2} />
          <StatCard label='Avg Churn Rate' value={`${compensationDashboard.averageChurnRate.toFixed(1)}%`} icon={Activity} />
          <StatCard label='Above Ceiling' value={compensationDashboard.abovePortfolioCeiling} icon={AlertCircle} variant={compensationDashboard.abovePortfolioCeiling ? 'warning' : 'neutral'} />
          <StatCard label='Ready Commission Only' value={compensationDashboard.readyForCommissionOnly} icon={ArrowUpRight} variant={compensationDashboard.readyForCommissionOnly ? 'warning' : 'neutral'} />
          <StatCard label='Posted Unpaid' value={`$${compensationDashboard.postedButUnpaid.toFixed(2)}`} icon={CreditCard} variant={compensationDashboard.postedButUnpaid ? 'error' : 'neutral'} />
        </div>

        <div className='sticky top-0 z-20 border-b-4 border-brand-charcoal bg-white overflow-x-auto'>
          <div className='flex'>
            {[
              ['dashboard', 'Compensation Dashboard'],
              ['statements', 'Compensation Statements'],
              ['payables', 'Payables Ledger'],
              ['transactions', 'Transaction Ledger'],
              ['portfolio', 'Portfolio Revenue'],
              ['churn', 'Churn & Retention'],
              ['coa', 'COA Posting Report'],
              ['cashbook', 'Cashbook Payment Report'],
              ['profitability', 'Profitability Report'],
              ['exceptions', 'Exception Report']
            ].map(([id, label]) => (
              <button
                key={id}
                type='button'
                onClick={() => setCompReportTab(id as typeof compReportTab)}
                className={`min-h-[50px] whitespace-nowrap px-4 text-[10px] font-black uppercase ${
                  compReportTab === id
                    ? 'bg-brand-orange text-white'
                    : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {compReportTab !== 'dashboard' && (
          <div className='space-y-6'>
            {renderReportFilterBar()}
            {renderCompensationReports()}
          </div>
        )}

        {compReportTab === 'dashboard' && <DataPanel title='Compensation Plans'>
          <div className='p-4 space-y-4'>
            {activePlan && (
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <FormField label='Plan Name'>
                  <input
                    className={inputClass}
                    value={activePlan.name}
                    onChange={e =>
                      setCompensationPlans(prev =>
                        prev.map(plan =>
                          plan.id === activePlan.id
                            ? { ...plan, name: e.target.value }
                            : plan
                        )
                      )
                    }
                  />
                </FormField>
                <FormField label='Portfolio Ceiling'>
                  <input
                    type='number'
                    className={inputClass}
                    value={activePlan.portfolioCeiling}
                    onChange={e =>
                      setCompensationPlans(prev =>
                        prev.map(plan =>
                          plan.id === activePlan.id
                            ? { ...plan, portfolioCeiling: Number(e.target.value) }
                            : plan
                        )
                      )
                    }
                  />
                </FormField>
                <FormField label='Wage / Vendor'>
                  <input
                    type='number'
                    className={inputClass}
                    value={activePlan.wageRatePerVendor}
                    onChange={e =>
                      setCompensationPlans(prev =>
                        prev.map(plan =>
                          plan.id === activePlan.id
                            ? { ...plan, wageRatePerVendor: Number(e.target.value) }
                            : plan
                        )
                      )
                    }
                  />
                </FormField>
                <FormField label='Commission %'>
                  <input
                    type='number'
                    className={inputClass}
                    value={activePlan.recurringCommissionRate}
                    onChange={e =>
                      setCompensationPlans(prev =>
                        prev.map(plan =>
                          plan.id === activePlan.id
                            ? { ...plan, recurringCommissionRate: Number(e.target.value) }
                            : plan
                        )
                      )
                    }
                  />
                </FormField>
                <FormField label='Max Daily Wage'>
                  <input
                    type='number'
                    className={inputClass}
                    value={activePlan.maxDailyWagePayable}
                    onChange={e =>
                      setCompensationPlans(prev =>
                        prev.map(plan =>
                          plan.id === activePlan.id
                            ? { ...plan, maxDailyWagePayable: Number(e.target.value) }
                            : plan
                        )
                      )
                    }
                  />
                </FormField>
                <FormField label='Churn Threshold %'>
                  <input
                    type='number'
                    className={inputClass}
                    value={activePlan.churnThresholdPercent}
                    onChange={e =>
                      setCompensationPlans(prev =>
                        prev.map(plan =>
                          plan.id === activePlan.id
                            ? { ...plan, churnThresholdPercent: Number(e.target.value) }
                            : plan
                        )
                      )
                    }
                  />
                </FormField>
                <FormField label='Churn Bonus Value'>
                  <input
                    type='number'
                    className={inputClass}
                    value={activePlan.churnBonusValue}
                    onChange={e =>
                      setCompensationPlans(prev =>
                        prev.map(plan =>
                          plan.id === activePlan.id
                            ? { ...plan, churnBonusValue: Number(e.target.value) }
                            : plan
                        )
                      )
                    }
                  />
                </FormField>
                <div className='flex items-end'>
                  <PrimaryButton onClick={() => handleSaveCompPlan(activePlan)}>
                    <Save size={14} className='mr-2' /> Save Plan
                  </PrimaryButton>
                </div>
              </div>
            )}
          </div>
        </DataPanel>}

        {compReportTab === 'dashboard' && <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
          <DataPanel title='Portfolio Assignments'>
            <div className='p-4 space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                <select className={inputClass} value={compAssignmentRpnId} onChange={e => setCompAssignmentRpnId(e.target.value)}>
                  <option value=''>Select RPN</option>
                  {safeRpns.map(rpn => <option key={rpn.id} value={rpn.id}>{rpn.name}</option>)}
                </select>
                <select className={inputClass} value={compAssignmentVendorId} onChange={e => setCompAssignmentVendorId(e.target.value)}>
                  <option value=''>Select Vendor</option>
                  {safeVendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
                <PrimaryButton onClick={handleAssignCompVendor}>Assign Vendor</PrimaryButton>
              </div>
              <div className='max-h-80 overflow-auto border border-stone-200'>
                {safeAssignments.filter(a => a.status === 'active').slice(0, 20).map(assignment => (
                  <div key={assignment.id} className='flex justify-between gap-3 border-b border-stone-100 p-3 text-xs'>
                    <span className='font-black uppercase'>{assignment.vendorName}</span>
                    <span className='font-bold uppercase text-stone-500'>{assignment.rpnName}</span>
                  </div>
                ))}
              </div>
            </div>
          </DataPanel>

          <DataPanel title='Onboarding Wage Logs'>
            <div className='p-4 space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-3'>
                <select className={inputClass} value={compWageRpnId} onChange={e => setCompWageRpnId(e.target.value)}>
                  <option value=''>Select RPN</option>
                  {safeRpns.map(rpn => <option key={rpn.id} value={rpn.id}>{rpn.name}</option>)}
                </select>
                <select className={inputClass} value={compWageVendorId} onChange={e => setCompWageVendorId(e.target.value)}>
                  <option value=''>Select Vendor</option>
                  {safeVendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
                <input type='date' className={inputClass} value={compWageDate} onChange={e => setCompWageDate(e.target.value)} />
                <div className='flex gap-2'>
                  <PrimaryButton size='sm' onClick={() => handleRecordWageLog('approved')}>Approve</PrimaryButton>
                  <SecondaryButton size='sm' onClick={() => handleRecordWageLog('rejected')}>Reject</SecondaryButton>
                </div>
              </div>
              <div className='max-h-80 overflow-auto border border-stone-200'>
                {safeWageLogs.slice(0, 20).map(log => (
                  <div key={log.id} className='grid grid-cols-4 gap-2 border-b border-stone-100 p-3 text-[10px] font-bold uppercase'>
                    <span>{log.onboardingDate}</span>
                    <span>{log.rpnName}</span>
                    <span>{log.vendorName}</span>
                    <StatusBadge status={log.status} variant={log.status === 'approved' ? 'success' : log.status === 'rejected' ? 'error' : 'warning'} />
                  </div>
                ))}
              </div>
            </div>
          </DataPanel>
        </div>}

        {compReportTab === 'dashboard' && <DataPanel title='Monthly Compensation Runs'>
          <div className='p-4 space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-6 gap-3'>
              <input type='date' className={inputClass} value={compPeriodFrom} onChange={e => setCompPeriodFrom(e.target.value)} />
              <input type='date' className={inputClass} value={compPeriodTo} onChange={e => setCompPeriodTo(e.target.value)} />
              <select className={inputClass} value={compSelectedRunId} onChange={e => setCompSelectedRunId(e.target.value)}>
                <option value=''>Latest Run</option>
                {safeCompRuns.map(run => <option key={run.id} value={run.id}>{run.periodFrom} to {run.periodTo} / {run.status}</option>)}
              </select>
              <PrimaryButton onClick={() => void handleGenerateCompRun()}>Generate Draft Run</PrimaryButton>
              <SecondaryButton onClick={handleApproveCompRun}>Approve Run</SecondaryButton>
              <SecondaryButton onClick={handlePostCompRun}>Post to COA</SecondaryButton>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px] gap-3'>
              <select className={inputClass} value={compPaymentAccountId} onChange={e => setCompPaymentAccountId(e.target.value)}>
                <option value=''>Select payment cashbook</option>
                {safeCashBankAccounts.map(account => <option key={account.id} value={account.id}>{account.accountName}</option>)}
              </select>
              <PrimaryButton onClick={handlePayCompRun}>Pay from Cashbook</PrimaryButton>
            </div>
            {selectedRun && (
              <TablePanel
                title={`Run ${selectedRun.status}`}
                headers={['RPN', 'Portfolio', 'Wage', 'Revenue', 'Commission', 'Churn', 'Bonus', 'Total', 'Control']}
              >
                {selectedRun.lines.map(line => (
                  <tr key={line.id} className='hover:bg-stone-50'>
                    <td className='px-6 py-4 text-xs font-black uppercase'>{line.rpnName}</td>
                    <td className='px-6 py-4 font-mono text-xs'>{line.portfolioCount}/{line.portfolioCeiling}</td>
                    <td className='px-6 py-4 font-mono text-xs'>${line.wageAmount.toFixed(2)}</td>
                    <td className='px-6 py-4 font-mono text-xs'>${line.recurringRevenue.toFixed(2)}</td>
                    <td className='px-6 py-4 font-mono text-xs'>${line.recurringCommissionAmount.toFixed(2)}</td>
                    <td className='px-6 py-4 font-mono text-xs'>{line.churnRatePercent.toFixed(1)}%</td>
                    <td className='px-6 py-4 font-mono text-xs'>${line.churnBonusAmount.toFixed(2)}</td>
                    <td className='px-6 py-4 font-mono text-xs font-black text-brand-orange'>${line.totalPayable.toFixed(2)}</td>
                    <td className='px-6 py-4'>
                      <div className='flex flex-col gap-1 items-start'>
                        {line.overPortfolioCeiling && <StatusBadge status='Above Ceiling' variant='warning' />}
                        {line.readyForCommissionOnly && <StatusBadge status='Commission Only Ready' variant='warning' />}
                        {!line.commissionOnly && (
                          <SecondaryButton size='sm' onClick={() => handleMoveCommissionOnly(line.rpnId)}>
                            Move to Commission Only
                          </SecondaryButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </TablePanel>
            )}
          </div>
        </DataPanel>}
      </div>
    )
  }

  const updateNestedField = (
    section:
      | 'personalDetails'
      | 'addressDetails'
      | 'kycDetails'
      | 'kycDocuments',
    field: string,
    value: string
  ) => {
    setRpnFormData(prev => ({
      ...prev,
      [section]: { ...((prev as any)[section] || {}), [field]: value }
    }))
  }

  const saveRPN = async () => {
    if (!rpnFormData.name || !rpnFormData.phone) {
      alert('Identity and contact required for node deployment.')
      return
    }

    const sessionStr = localStorage.getItem('activeStaffSession')
    const session = sessionStr
      ? JSON.parse(sessionStr)
      : { staffId: 'STAFF-ADM', staffName: 'System Admin' }
    const canApprove = permissionService.canApprove('rpnManagement')

    const rpnToSave = stripUndefinedDeep({
      ...rpnFormData,
      updatedAt: new Date().toISOString()
    }) as RPN

    const isNew = !rpns.find(r => r.id === rpnToSave.id)
    const oldRpn = rpns.find(r => r.id === rpnToSave.id)

    if (!canApprove && !isNew) {
      try {
        await approvalService.submitApprovalRequest({
          requestType: 'rpn_agent_update',
          recordType: 'rpn',
          recordId: rpnToSave.id,
          recordName: rpnToSave.name,
          submittedByStaffId: session.staffId,
          submittedByName: session.staffName,
          riskLevel: 'medium',
          beforeSnapshot: oldRpn || null,
          afterSnapshot: rpnToSave
        })
        void staffAuditService.logAction({
          eventType: 'APPROVAL_SUBMITTED',
          module: 'staff',
          action: 'Submitted RPN agent update for approval',
          severity: 'info',
          recordType: 'rpn',
          recordId: rpnToSave.id,
          recordName: rpnToSave.name
        })
        alert('RPN update submitted for manager approval.')
        setView('list')
      } catch (error: any) {
        console.error(error)
        alert(error.message || 'Save failed')
      }
      return
    }

    try {
      await rpnService.update(rpnToSave)
      analyticsService.logEvent({
        eventType: isNew ? 'RPN_CREATED' : 'RPN_UPDATED',
        actorType: 'admin',
        actorName: 'System Admin',
        rpnId: rpnToSave.id,
        details: { name: rpnToSave.name, level: rpnToSave.level }
      })

      if (!isNew) {
        void staffAuditService.logAction({
          eventType: 'RECORD_UPDATED',
          module: 'staff',
          severity: 'high',
          action: 'Updated RPN agent profile',
          recordType: 'rpn_agent',
          recordId: rpnToSave.id,
          recordName: rpnToSave.name
        })
      }

      loadData()
      setView('list')
      alert('Saved successfully')
    } catch (error: any) {
      console.error(error)
      alert(error.message || 'Save failed')
    }
  }

  const startCollectionRecord = (rpnId?: string) => {
    setCollectionFormData({
      id: `COL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      rpnId: rpnId || selectedRPN?.id || '',
      type: 'itred_products',
      status: 'pending backend entry',
      dateCollected: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    setView('collection_form')
  }

  const saveCollection = async () => {
    if (!collectionFormData.rpnId || !collectionFormData.vendorId) {
      alert('Mapping required: RPN and Vendor must be specified.')
      return
    }
    try {
      const collectionToSave = {
        ...collectionFormData,
        updatedAt: new Date().toISOString()
      } as FieldCollectionRecord
      await rpnService.updateCollection(collectionToSave)

      analyticsService.logEvent({
        eventType: 'FIELD_COLLECTION_RECORDED',
        actorType: 'rpn',
        actorName:
          safeRpns.find(r => r.id === collectionToSave.rpnId)?.name ||
          'RPN Agent',
        rpnId: collectionToSave.rpnId,
        vendorId: collectionToSave.vendorId,
        details: {
          type: collectionToSave.type,
          productCount: collectionToSave.productCount,
          imageCount: collectionToSave.imageCount
        }
      })

      loadData()
      if (selectedRPN) setView('profile')
      else setView('list')
      alert('Saved successfully')
    } catch (error: any) {
      console.error(error)
      alert(error.message || 'Save failed')
    }
  }

  const openRPNProfile = (rpn: RPN) => {
    setSelectedRPN(rpn)
    setRpnFilter(rpn.id)
    setView('profile')
  }

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '')
    return `https://wa.me/${cleanPhone}`
  }

  const startMoveStage = (
    prospect: RPNProspectQuery,
    stage?: PipelineStage
  ) => {
    const currentIndex = PROSPECT_PIPELINE_STAGES.indexOf(
      prospect.pipelineStage
    )
    const nextStage =
      stage ||
      (currentIndex >= 0 && currentIndex < PROSPECT_PIPELINE_STAGES.length - 1
        ? PROSPECT_PIPELINE_STAGES[currentIndex + 1]
        : prospect.pipelineStage)
    setMoveStageData({ prospect, nextStage })
    setIsMoveStageModalOpen(true)
  }

  const executeMoveStage = async (
    notes?: string,
    nextFollowUpDate?: string
  ) => {
    if (!moveStageData) return
    const { prospect, nextStage } = moveStageData

    if (prospect.pipelineStage === nextStage) {
      alert('Please select a different stage.')
      return
    }

    if (!notes.trim()) {
      alert('A status change note is required.')
      return
    }

    if (nextStage === 'Follow-up Required' && !nextFollowUpDate) {
      alert('A next follow-up date is required.')
      return
    }

    const session = JSON.parse(
      localStorage.getItem('activeStaffSession') || '{}'
    )
    const now = new Date().toISOString()

    let updatedProspect: RPNProspectQuery = {
      ...prospect,
      pipelineStage: nextStage,
      stageUpdatedAt: now,
      stageUpdatedBy: session.staffName || 'System',
      lastActivityDate: now,
      lastActivityNote: notes,
      updatedAt: now,
      stageHistory: [
        ...(prospect.stageHistory || []),
        {
          stage: nextStage,
          enteredAt: now,
          enteredByStaffId: session.staffId,
          enteredByStaffName: session.staffName,
          notes: notes,
          fromStage: prospect.pipelineStage
        }
      ],
      nextFollowUpDate: nextFollowUpDate || prospect.nextFollowUpDate,
      followUpDate: nextFollowUpDate || prospect.followUpDate
    }

    if (isRecoverableStage(prospect.pipelineStage)) {
      updatedProspect = logProspectActivity(
        updatedProspect,
        'REOPENED',
        'Prospect Reopened',
        'User confirmed reopening this prospect.'
      )
    }

    updatedProspect = logProspectActivity(
      updatedProspect,
      'STATUS_CHANGE',
      `Status Changed: ${nextStage}`,
      notes,
      prospect.pipelineStage,
      nextStage
    )

    rpnService.saveProspect(updatedProspect)

    if (nextFollowUpDate) {
      rpnService.saveFollowUp({
        id: `FU-${Date.now()}`,
        prospectId: prospect.id,
        prospectName:
          prospect.prospectName || prospect.businessName || 'Unnamed Prospect',
        assignedToStaffId:
          prospect.assignedStaffId || prospect.assignedRpnId || '',
        assignedToStaffName:
          prospect.assignedStaffName || prospect.assignedRpnName || '',
        dueDate: nextFollowUpDate,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }

    await staffAuditService.logAction({
      eventType: 'RPN_PIPELINE_UPDATED',
      module: 'rpn',
      severity: 'high',
      action: `Moved prospect ${prospect.id} from ${prospect.pipelineStage} to ${nextStage}`,
      recordId: prospect.id
    })

    setIsMoveStageModalOpen(false)
    setMoveStageData(null)
    loadData()
  }

  const startAssign = (prospect: RPNProspectQuery) => {
    setAssignData({
      prospect,
      assignedRpnId: prospect.assignedRpnId || '',
      assignedStaffId: prospect.assignedStaffId || '',
      taskObjective: prospect.taskObjective || '',
      followUpDate: prospect.followUpDate || prospect.nextFollowUpDate || '',
      timelineNotes: prospect.timelineNotes || '',
      totalEstimatedCost: Number(
        prospect.totalEstimatedCost ||
          prospect.totalCost ||
          prospect.estimatedCost ||
          0
      ),
      priority: prospect.priority || prospect.urgency || 'Medium',
      reason: '',
      assignmentRole: prospect.assignmentRole || 'Owner'
    })
    setIsAssignModalOpen(true)
  }

  const executeAssign = async () => {
    if (!assignData) return
    const {
      prospect,
      assignedRpnId,
      assignedStaffId,
      taskObjective,
      followUpDate,
      timelineNotes,
      totalEstimatedCost,
      priority,
      reason,
      assignmentRole
    } = assignData

    const isReassignment = !!(
      prospect.assignedRpnId || prospect.assignedStaffId
    )

    if (!assignedRpnId && !assignedStaffId) {
      alert('At least one assignee (RPN or Staff) must be selected.')
      return
    }

    if (prospect.assignedRpnId || prospect.assignedStaffId) {
      if (
        (prospect.assignedRpnId !== assignedRpnId ||
          prospect.assignedStaffId !== assignedStaffId) &&
        !reason.trim()
      ) {
        alert('A reason for reassignment is required.')
        return
      }
    }

    if (!taskObjective.trim()) {
      alert('Task Objective is required.')
      return
    }

    if (!followUpDate) {
      alert('Follow-up date is required.')
      return
    }

    const session = JSON.parse(
      localStorage.getItem('activeStaffSession') || '{}'
    )
    const now = new Date().toISOString()
    const rpn = safeRpns.find(r => r.id === assignedRpnId)
    const staff = staffList.find(s => s.id === assignedStaffId)

    let updatedProspect: RPNProspectQuery = {
      ...prospect,
      assignedRpnId,
      assignedRpnName: rpn?.name || '',
      assignedStaffId,
      assignedStaffName: staff?.fullName || '',
      assignmentDate: now,
      assignmentRole,
      taskObjective,
      followUpDate,
      nextFollowUpDate: followUpDate,
      timelineNotes,
      totalEstimatedCost,
      priority,
      updatedAt: now,
      lastActivityDate: now,
      lastActivityNote: `Assigned/Reassigned to ${
        staff?.fullName || 'No Staff'
      } & ${rpn?.name || 'No RPN'}. Reason: ${reason || 'Initial Assignment'}`,
      stageHistory: [
        ...(prospect.stageHistory || []),
        {
          stage: prospect.pipelineStage,
          enteredAt: now,
          enteredByStaffId: session.staffId,
          enteredByStaffName: session.staffName,
          notes: `Assignment Update: ${staff?.fullName || 'No Staff'} & ${
            rpn?.name || 'No RPN'
          }. Role: ${assignmentRole}. Reason: ${reason || 'Initial Assignment'}`
        }
      ]
    }

    updatedProspect = logProspectActivity(
      updatedProspect,
      isReassignment ? 'REASSIGNMENT' : 'ASSIGNMENT',
      isReassignment ? 'Prospect Reassigned' : 'Prospect Assigned',
      `Role: ${assignmentRole}. Reason: ${
        reason || 'Initial Assignment'
      }. Objective: ${taskObjective}`
      // prospect.assignedStaffName || prospect.assignedRpnName || 'Unassigned',
      // staff?.fullName || rpn?.name || 'Unassigned'
    )

    rpnService.saveProspect(updatedProspect)

    await staffAuditService.logAction({
      eventType: 'RECORD_UPDATED',
      module: 'rpn',
      severity: 'high',
      action: `Assigned/Reassigned prospect ${prospect.id}`,
      recordId: prospect.id,
      afterSnapshot: {
        assignedRpnId,
        assignedStaffId,
        assignmentRole,
        reason,
        taskObjective,
        followUpDate,
        totalEstimatedCost
      }
    })

    setIsAssignModalOpen(false)
    setAssignData(null)
    loadData()

    if (view === 'prospect_detail' && selectedProspect?.id === prospect.id) {
      setSelectedProspect(updatedProspect)
    }
  }

  const startMarkFollowUp = (prospect: RPNProspectQuery) => {
    setMarkFollowUpData({
      prospect,
      notes: '',
      nextFollowUpDate: ''
    })
    setIsMarkFollowUpOpen(true)
  }

  const executeMarkFollowUp = async () => {
    if (!markFollowUpData) return
    const { prospect, notes, nextFollowUpDate } = markFollowUpData

    if (!notes.trim()) {
      alert('A note is required to mark follow-up as done.')
      return
    }
    if (!nextFollowUpDate) {
      alert('Please specify the next follow-up date.')
      return
    }

    const session = JSON.parse(
      localStorage.getItem('activeStaffSession') || '{}'
    )
    const now = new Date().toISOString()

    let updatedProspect: RPNProspectQuery = {
      ...prospect,
      lastActivityDate: now,
      lastActivityNote: notes,
      updatedAt: now,
      followUpDate: nextFollowUpDate,
      nextFollowUpDate: nextFollowUpDate,
      timelineNotes: notes,
      stageHistory: [
        ...(prospect.stageHistory || []),
        {
          stage: prospect.pipelineStage,
          enteredAt: now,
          enteredByStaffId: session.staffId,
          enteredByStaffName: session.staffName,
          notes: `Follow-up Done: ${notes}`
        }
      ]
    }

    updatedProspect = logProspectActivity(
      updatedProspect,
      'FOLLOW_UP_COMPLETED',
      'Follow-up Completed',
      notes,
      prospect.followUpDate || prospect.nextFollowUpDate,
      nextFollowUpDate
    )

    rpnService.saveProspect(updatedProspect)

    await staffAuditService.logAction({
      eventType: 'RECORD_UPDATED',
      module: 'rpn',
      severity: 'info',
      action: `Marked follow-up done for prospect ${prospect.id}`,
      recordId: prospect.id,
      afterSnapshot: { notes, nextFollowUpDate }
    })

    setIsMarkFollowUpOpen(false)
    setMarkFollowUpData(null)
    loadData()
    if (view === 'prospect_detail' && selectedProspect?.id === prospect.id) {
      setSelectedProspect(updatedProspect)
    }
  }

  const saveProspect = async () => {
    if (!prospectFormData.businessName && !prospectFormData.prospectName) {
      alert('Business Name is required.')
      return
    }
    if (
      !prospectFormData.phone &&
      !prospectFormData.whatsapp &&
      !prospectFormData.whatsappNumber
    ) {
      alert('A contact number (Phone or WhatsApp) is required.')
      return
    }
    if (!prospectFormData.sourceType && !prospectFormData.querySource) {
      alert('Source Type is required.')
      return
    }
    if (!prospectFormData.taskObjective) {
      alert('Task Objective is required.')
      return
    }
    if (!prospectFormData.followUpDate && !prospectFormData.nextFollowUpDate) {
      alert('Follow-up Date is required.')
      return
    }
    if (
      prospectFormData.pipelineStage !== 'New Prospect' &&
      !prospectFormData.assignedRpnId &&
      !prospectFormData.assignedStaffId
    ) {
      alert(
        'Assigned RPN or Assigned Staff Member is required for active prospects. You can leave it unassigned if the stage is New Prospect.'
      )
      return
    }

    const session = JSON.parse(
      localStorage.getItem('activeStaffSession') || '{}'
    )
    const now = new Date().toISOString()
    const isNew = !prospectFormData.id

    const oldProspect = safeProspects.find(p => p.id === prospectFormData.id)
    let historyEntries = prospectFormData.stageHistory || [
      {
        stage: prospectFormData.pipelineStage || 'New Prospect',
        enteredAt: now,
        enteredByStaffId: session.staffId,
        enteredByStaffName: session.staffName
      }
    ]

    let prospectToSave: RPNProspectQuery = {
      id: prospectFormData.id || `PROSPECT-${Date.now()}`,
      createdAt: prospectFormData.createdAt || now,
      ...prospectFormData,
      updatedAt: now,
      pipelineStage: prospectFormData.pipelineStage || 'New Prospect',
      stageUpdatedAt: prospectFormData.stageUpdatedAt || now,
      stageUpdatedBy:
        prospectFormData.stageUpdatedBy || session.staffName || 'System',
      stageHistory: historyEntries
    } as RPNProspectQuery

    if (isNew) {
      prospectToSave = logProspectActivity(
        prospectToSave,
        'CREATED',
        'Prospect Created',
        prospectFormData.notes ||
          `Source: ${
            prospectFormData.sourceType || prospectFormData.querySource
          }`
      )
    } else {
      prospectToSave = logProspectActivity(
        prospectToSave,
        'UPDATED',
        'Prospect Updated',
        'General details updated'
      )
    }

    if (oldProspect) {
      const oldEst = Number(
        oldProspect.totalEstimatedCost ?? oldProspect.totalCost ?? 0
      )
      const newEst = Number(
        prospectFormData.totalEstimatedCost ?? prospectFormData.totalCost ?? 0
      )
      const oldAct = Number(oldProspect.totalActualCost ?? 0)
      const newAct = Number(prospectFormData.totalActualCost ?? 0)

      if (oldEst !== newEst || oldAct !== newAct) {
        historyEntries.push({
          stage: prospectFormData.pipelineStage || 'New Prospect',
          enteredAt: now,
          enteredByStaffId: session.staffId,
          enteredByStaffName: session.staffName,
          notes: `Cost updated: Est. $${newEst.toFixed(
            2
          )} / Actual $${newAct.toFixed(2)}`
        })
        prospectToSave.stageHistory = historyEntries
        prospectToSave = logProspectActivity(
          prospectToSave,
          'COST_UPDATED',
          'Cost Factors Updated',
          `Est. $${newEst.toFixed(2)} / Actual $${newAct.toFixed(2)}`
        )
      }

      if (!oldProspect.introLetterSent && prospectFormData.introLetterSent) {
        prospectToSave = logProspectActivity(
          prospectToSave,
          'INTRO_SENT',
          'WhatsApp Introduction Sent'
        )
      }
      if (!oldProspect.phoneCallMade && prospectFormData.phoneCallMade) {
        prospectToSave = logProspectActivity(
          prospectToSave,
          'PHONE_CALL',
          'Phone Call Made'
        )
      }
    }

    rpnService.saveProspect(prospectToSave)
    await staffAuditService.logAction({
      eventType: isNew ? 'RECORD_CREATED' : 'RPN_PROSPECT_EDITED',
      module: 'rpn',
      severity: 'info',
      action: `${isNew ? 'Created' : 'Updated'} prospect ${prospectToSave.id}`,
      recordId: prospectToSave.id
    })

    setView('pipeline')
    loadData()
  }

  if (isLoadingData) {
    return (
      <div className="pb-20 min-w-0 max-w-full overflow-x-hidden flex items-center justify-center pt-20">
        <div className="text-center text-stone-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest">Loading RPN Data...</p>
        </div>
      </div>
    )
  }

  // --- Views ---

  if (view === 'form') {
    return (
      <div className='space-y-8 pb-32'>
        <div className='flex items-center justify-between bg-stone-50 p-6 border border-stone-200'>
          <button
            onClick={() => setView('list')}
            className='flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal transition-colors'
          >
            <ChevronRight size={14} className='rotate-180' /> Back to List
          </button>
          <h3 className='text-sm font-bold uppercase tracking-tight text-brand-charcoal'>
            {rpnFormData.createdAt
              ? `Edit RPN Agent: ${rpnFormData.id}`
              : `Add New Agent: ${rpnFormData.id}`}
          </h3>
          {permissionService.canCreateRpnAgent() && (
            <PrimaryButton
              onClick={saveRPN}
              className='flex items-center gap-2'
            >
              {rpnFormData.createdAt ? 'Update Agent' : 'Add Agent'}
            </PrimaryButton>
          )}
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          <div className='lg:col-span-2 space-y-8'>
            <DataPanel title='Agent Identity'>
              <div className='p-6 grid grid-cols-1 md:grid-cols-2 gap-6'>
                <FormField
                  label='Legal Full Name'
                  required
                  className='md:col-span-2'
                >
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400">
                    Legal Full Name
                  </label> */}
                  <input
                    value={rpnFormData.name || ''}
                    onChange={e =>
                      setRpnFormData({ ...rpnFormData, name: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50/50'
                  />
                </FormField>
                <FormField label='Mobile Phone' required>
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400">
                    Mobile Phone
                  </label> */}
                  <input
                    value={rpnFormData.phone || ''}
                    onChange={e =>
                      setRpnFormData({ ...rpnFormData, phone: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold font-mono focus:border-brand-orange outline-none'
                  />
                </FormField>
                <FormField label='WhatsApp Channel'>
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400 text-green-600">
                    WhatsApp Channel
                  </label> */}
                  <input
                    value={rpnFormData.whatsapp || ''}
                    onChange={e =>
                      setRpnFormData({
                        ...rpnFormData,
                        whatsapp: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold font-mono focus:border-brand-orange outline-none'
                  />
                </FormField>
                <FormField
                  label='Email Address (Secured)'
                  className='md:col-span-2'
                >
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400">
                    Email Address (Secured)
                  </label> */}
                  <input
                    value={rpnFormData.email || ''}
                    onChange={e =>
                      setRpnFormData({ ...rpnFormData, email: e.target.value })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-bold focus:border-brand-orange outline-none'
                  />
                </FormField>
              </div>
            </DataPanel>

            <DataPanel title='Service Areas'>
              <div className='p-6 grid grid-cols-1 md:grid-cols-3 gap-6'>
                {['Province', 'CityTown', 'District'].map(field => (
                  <div key={field} className='space-y-1.5'>
                    <label className='text-[10px] uppercase font-bold text-stone-400'>
                      {' '}
                      {/* Use FormField component */}
                      {field.replace('Town', ' / Town')}
                    </label>
                    <input
                      value={(rpnFormData as any)[field] || ''}
                      onChange={e =>
                        setRpnFormData({
                          ...rpnFormData,
                          [field]: e.target.value
                        })
                      }
                      className='w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                    />
                  </div>
                ))}
                <FormField
                  label='Assigned Territory Description'
                  className='md:col-span-3'
                >
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400">
                    Assigned Territory Description
                  </label> */}
                  <textarea
                    value={rpnFormData.territory || ''}
                    onChange={e =>
                      setRpnFormData({
                        ...rpnFormData,
                        territory: e.target.value
                      })
                    }
                    className='w-full border-2 border-stone-200 p-2.5 text-xs font-medium focus:border-brand-orange outline-none h-20 resize-none'
                    placeholder='List suburbs or specific commercial zones...'
                  />
                </FormField>
              </div>
            </DataPanel>
          </div>

          <div className='space-y-8'>
            <div className='col-span-2 mt-8 pt-8 border-t border-stone-200'>
              <h4 className='text-[11px] uppercase font-bold tracking-[0.25em] text-brand-charcoal mb-4'>
                Personal, Address & KYC Details
              </h4>

              {!permissionService.canEditStaffKycDetails() && (
                <div className='p-3 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-bold uppercase tracking-widest text-center'>
                  You do not have permission to edit Personal, Address & KYC
                  Details.
                </div>
              )}

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Sex
                  </label>
                  <select
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.personalDetails?.gender || ''}
                    onChange={e =>
                      updateNestedField(
                        'personalDetails',
                        'gender',
                        e.target.value
                      )
                    }
                    disabled={!permissionService.canEditStaffKycDetails()}
                  >
                    <option value=''>Select Sex...</option>
                    <option value='male'>Male</option>
                    <option value='female'>Female</option>
                  </select>
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Date of Birth
                  </label>
                  <input
                    type='date'
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={normalizeDateInput(
                      rpnFormData.personalDetails?.dateOfBirth
                    )}
                    onChange={e =>
                      updateNestedField(
                        'personalDetails',
                        'dateOfBirth',
                        e.target.value
                      )
                    }
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    National ID Number
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.personalDetails?.nationalId || ''}
                    onChange={e =>
                      updateNestedField(
                        'personalDetails',
                        'nationalId',
                        e.target.value
                      )
                    }
                    placeholder='e.g. 63-123456-A-00'
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Passport Number
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.kycDetails?.idNumber || ''}
                    onChange={e =>
                      updateNestedField(
                        'kycDetails',
                        'idNumber',
                        e.target.value
                      )
                    }
                    placeholder='Optional'
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Highest Education
                  </label>
                  <select
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.personalDetails?.highestEducation || ''}
                    onChange={e =>
                      updateNestedField(
                        'personalDetails',
                        'highestEducation',
                        e.target.value
                      )
                    }
                    disabled={!permissionService.canEditStaffKycDetails()}
                  >
                    <option value=''>Select Education Level...</option>
                    <option value='primary'>Primary</option>
                    <option value='ordinary_level'>Ordinary Level</option>
                    <option value='advanced_level'>Advanced Level</option>
                    <option value='certificate'>Certificate</option>
                    <option value='diploma'>Diploma</option>
                    <option value='degree'>Degree</option>
                    <option value='postgraduate'>Postgraduate</option>
                    <option value='other'>Other</option>
                  </select>
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Occupation / Skills
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.personalDetails?.skills || ''}
                    onChange={e =>
                      updateNestedField(
                        'personalDetails',
                        'skills',
                        e.target.value
                      )
                    }
                    placeholder='Phone use, sales, training, stocktake...'
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5 md:col-span-2'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Residential Address
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.addressDetails?.streetAddress || ''}
                    onChange={e =>
                      updateNestedField(
                        'addressDetails',
                        'streetAddress',
                        e.target.value
                      )
                    }
                    placeholder='House number, street, area'
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Suburb / Village
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.addressDetails?.suburb || ''}
                    onChange={e =>
                      updateNestedField(
                        'addressDetails',
                        'suburb',
                        e.target.value
                      )
                    }
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    District
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.addressDetails?.district || ''}
                    onChange={e =>
                      updateNestedField(
                        'addressDetails',
                        'district',
                        e.target.value
                      )
                    }
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Province
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.addressDetails?.province || ''}
                    onChange={e =>
                      updateNestedField(
                        'addressDetails',
                        'province',
                        e.target.value
                      )
                    }
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Country
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.addressDetails?.country || 'Zimbabwe'}
                    onChange={e =>
                      updateNestedField(
                        'addressDetails',
                        'country',
                        e.target.value
                      )
                    }
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Next of Kin Full Name
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.personalDetails?.nextOfKinName || ''}
                    onChange={e =>
                      updateNestedField(
                        'personalDetails',
                        'nextOfKinName',
                        e.target.value
                      )
                    }
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Next of Kin Phone Number
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.personalDetails?.nextOfKinPhone || ''}
                    onChange={e =>
                      updateNestedField(
                        'personalDetails',
                        'nextOfKinPhone',
                        e.target.value
                      )
                    }
                    placeholder='+263...'
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Next of Kin Relationship
                  </label>
                  <input
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={
                      rpnFormData.personalDetails?.nextOfKinRelationship || ''
                    }
                    onChange={e =>
                      updateNestedField(
                        'personalDetails',
                        'nextOfKinRelationship',
                        e.target.value
                      )
                    }
                    placeholder='Parent, spouse, sibling...'
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Passport Size Image Upload
                  </label>
                  <input
                    type='file'
                    accept='image/*'
                    className='w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange bg-white disabled:bg-stone-50 disabled:text-stone-400'
                    disabled={!permissionService.canEditStaffKycDetails()}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const base64 = await fileToBase64(file)
                      updateNestedField(
                        'kycDocuments',
                        'passportPhotoUrl',
                        base64
                      )
                      updateNestedField(
                        'kycDocuments',
                        'passportPhotoName',
                        file.name
                      )
                      updateNestedField(
                        'kycDocuments',
                        'passportPhotoUpdatedAt',
                        new Date().toISOString()
                      )
                    }}
                  />
                  {rpnFormData.kycDocuments?.passportPhotoUrl && (
                    <div className='mt-2 flex items-center gap-3'>
                      <img
                        src={rpnFormData.kycDocuments.passportPhotoUrl}
                        alt='RPN passport size'
                        className='w-16 h-16 object-cover border border-stone-200'
                      />
                      <span className='text-[9px] font-bold uppercase text-stone-400'>
                        {rpnFormData.kycDocuments?.passportPhotoName ||
                          'Image uploaded'}
                      </span>
                    </div>
                  )}
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Notes / Vetting Comments
                  </label>
                  <textarea
                    rows={3}
                    className='w-full border-2 border-stone-100 p-3 text-xs font-medium outline-none focus:border-brand-orange disabled:bg-stone-50 disabled:text-stone-400'
                    value={rpnFormData.kycDetails?.vettingNotes || ''}
                    onChange={e =>
                      updateNestedField(
                        'kycDetails',
                        'vettingNotes',
                        e.target.value
                      )
                    }
                    placeholder='Interview notes, reference checks, field suitability...'
                    disabled={!permissionService.canEditStaffKycDetails()}
                  />
                </div>
              </div>
            </div>

            <DataPanel title='Agent Tier'>
              <div className='p-6 space-y-6'>
                <div className='space-y-2'>
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Access Level
                  </label>
                  <div className='flex flex-col gap-2'>
                    {' '}
                    {/* Use FormField component */}
                    {RPN_LEVELS.map(l => (
                      <button
                        key={l}
                        onClick={() =>
                          setRpnFormData({ ...rpnFormData, level: l })
                        }
                        className={`w-full p-3 text-left border-2 transition-all ${
                          rpnFormData.level === l
                            ? 'border-brand-charcoal bg-stone-50'
                            : 'border-stone-100 bg-white hover:border-stone-200'
                        }`}
                      >
                        <p className='text-[10px] font-bold uppercase'>{l}</p>
                        <p className='text-[8px] text-stone-400 mt-0.5'>
                          Scale permissions for data ingestion
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className='space-y-2'>
                  {' '}
                  {/* Use FormField component */}
                  <label className='text-[10px] uppercase font-bold text-stone-400'>
                    Operational Status
                  </label>
                  <div className='flex gap-2'>
                    {RPN_STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() =>
                          setRpnFormData({ ...rpnFormData, status: s })
                        }
                        className={`flex-1 py-2 text-[9px] font-bold uppercase border ${
                          rpnFormData.status === s
                            ? 'bg-brand-orange text-white border-brand-orange'
                            : 'bg-white text-stone-400 border-stone-100'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </DataPanel>
            {permissionService.canEdit('rpnManagement') && (
              <DataPanel title='Internal Documentation'>
                <div className='p-6'>
                  <textarea
                    value={rpnFormData.notes || ''}
                    onChange={e =>
                      setRpnFormData({ ...rpnFormData, notes: e.target.value })
                    }
                    className='w-full border-2 border-stone-100 p-2 text-xs font-medium outline-none h-40 bg-stone-50/50'
                    placeholder='Backend notes on reliability and performance...'
                  />
                </div>
              </DataPanel>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (view === 'collection_form') {
    return (
      <div className='space-y-8 pb-32 max-w-4xl mx-auto'>
        <div className='flex items-center justify-between bg-stone-50 p-6 border border-stone-200'>
          <button
            onClick={() => (selectedRPN ? setView('profile') : setView('list'))}
            className='flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal'
          >
            <ChevronRight size={14} className='rotate-180' /> Cancel Entry
          </button>
          <h3 className='text-sm font-bold uppercase tracking-tight text-brand-charcoal'>
            New Field Collection Entry
          </h3>
          {permissionService.canCreate('rpnManagement') && (
            <PrimaryButton onClick={saveCollection}>
              Commit Record
            </PrimaryButton>
          )}
        </div>

        <DataPanel title='Collection Parameterization'>
          <div className='p-8 space-y-8'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
              <div className='space-y-2'>
                <label className='text-[10px] uppercase font-bold text-stone-400'>
                  Target Vendor
                </label>
                <SearchableComboBox
                  value={
                    safeVendors.find(
                      vendor => vendor.id === collectionFormData.vendorId
                    )?.name || ''
                  }
                  options={safeVendors}
                  getOptionLabel={vendor =>
                    [
                      vendor.name,
                      vendor.tradingName,
                      vendor.cityTown,
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
                  placeholder='Search vendor name, location, sector...'
                  emptyMessage='No vendors found.'
                  onSelect={vendor =>
                    setCollectionFormData({
                      ...collectionFormData,
                      vendorId: vendor?.id || ''
                    })
                  }
                />
              </div>
              <div className='space-y-2'>
                <label className='text-[10px] uppercase font-bold text-stone-400'>
                  Assigned RPN Agent
                </label>
                <select
                  value={collectionFormData.rpnId || ''}
                  onChange={e =>
                    setCollectionFormData({
                      ...collectionFormData,
                      rpnId: e.target.value
                    })
                  }
                  className='w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                >
                  <option value=''>Select RPN...</option>
                  {safeRpns
                    .filter(r => r.status === 'active')
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className='space-y-2'>
                <label className='text-[10px] uppercase font-bold text-stone-400'>
                  Operation Type
                </label>
                <select
                  value={collectionFormData.type || 'itred_products'}
                  onChange={e =>
                    setCollectionFormData({
                      ...collectionFormData,
                      type: e.target.value as any
                    })
                  }
                  className='w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none'
                >
                  {COLLECTION_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className='space-y-2'>
                <label className='text-[10px] uppercase font-bold text-stone-400'>
                  Collection Date
                </label>
                <input
                  type='date'
                  value={collectionFormData.dateCollected || ''}
                  onChange={e =>
                    setCollectionFormData({
                      ...collectionFormData,
                      dateCollected: e.target.value
                    })
                  }
                  className='w-full border-2 border-stone-200 p-3 text-xs font-bold font-mono focus:border-brand-orange outline-none'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-stone-100'>
              <div className='space-y-1.5'>
                <label className='text-[10px] uppercase font-bold text-stone-400'>
                  Products Collected
                </label>
                <input
                  type='number'
                  value={collectionFormData.productCount || 0}
                  onChange={e =>
                    setCollectionFormData({
                      ...collectionFormData,
                      productCount: parseInt(e.target.value)
                    })
                  }
                  className='w-full border-2 border-stone-200 p-3 text-xs font-bold font-mono focus:border-brand-orange outline-none'
                />
              </div>
              <div className='space-y-1.5'>
                <label className='text-[10px] uppercase font-bold text-stone-400'>
                  Images Synced
                </label>
                <input
                  type='number'
                  value={collectionFormData.imageCount || 0}
                  onChange={e =>
                    setCollectionFormData({
                      ...collectionFormData,
                      imageCount: parseInt(e.target.value)
                    })
                  }
                  className='w-full border-2 border-stone-200 p-3 text-xs font-bold font-mono focus:border-brand-orange outline-none'
                />
              </div>
              <div className='md:col-span-2 space-y-1.5'>
                <label className='text-[10px] uppercase font-bold text-stone-400'>
                  Status
                </label>
                <div className='flex gap-2'>
                  {COLLECTION_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() =>
                        setCollectionFormData({
                          ...collectionFormData,
                          status: s
                        })
                      }
                      className={`flex-1 py-3 text-[8px] font-bold uppercase border leading-none px-1 h-[46px] ${
                        collectionFormData.status === s
                          ? 'bg-brand-charcoal text-white border-brand-charcoal'
                          : 'bg-white text-stone-400 border-stone-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className='space-y-1.5'>
              <label className='text-[10px] uppercase font-bold text-stone-400'>
                Field Notes / Observations
              </label>
              <textarea
                value={collectionFormData.notes || ''}
                onChange={e =>
                  setCollectionFormData({
                    ...collectionFormData,
                    notes: e.target.value
                  })
                }
                className='w-full border-2 border-stone-200 p-4 text-xs font-medium focus:border-brand-orange outline-none h-32 resize-none'
                placeholder='Describe collection context or issues detected...'
              />
            </div>
          </div>
        </DataPanel>
      </div>
    )
  }

  if (view === 'profile' && selectedRPN) {
    const rpnVendors = safeVendors.filter(
      v => v.assignedRPNId === selectedRPN.id
    )
    const rpnCollections = safeCollections.filter(
      c => c.rpnId === selectedRPN.id
    )

    return (
      <div className='space-y-8 pb-32'>
        {/* Profile Header */}
        <div className='bg-brand-charcoal text-white p-8'>
          <div className='flex flex-col md:flex-row justify-between gap-6'>
            <div className='flex gap-6 items-start'>
              <div className='w-20 h-20 bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white/40 text-2xl'>
                {selectedRPN.name.charAt(0)}
              </div>
              <div>
                <div className='flex items-center gap-3 mb-1'>
                  <h2 className='text-xl font-bold uppercase tracking-tight'>
                    {selectedRPN.name}
                  </h2>
                  <StatusBadge
                    status={selectedRPN.status}
                    variant={
                      selectedRPN.status === 'active' ? 'success' : 'error'
                    }
                  />
                </div>
                <p className='text-[10px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-2'>
                  <Shield size={10} /> {selectedRPN.level} // ID:{' '}
                  {selectedRPN.id}
                </p>
                <div className='flex flex-wrap gap-4 mt-4'>
                  <a
                    href={`tel:${selectedRPN.phone}`}
                    className='flex items-center gap-2 text-[10px] font-bold uppercase transition-colors hover:text-brand-orange'
                  >
                    <Phone size={12} className='text-white/40' />{' '}
                    {selectedRPN.phone}
                  </a>
                  <a
                    href={getWhatsAppLink(selectedRPN.whatsapp)}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-2 text-[10px] font-bold uppercase transition-colors hover:text-green-400'
                  >
                    <MessageSquare size={12} className='text-white/40' />{' '}
                    {selectedRPN.whatsapp}
                  </a>
                </div>
              </div>
            </div>
            <div className='flex gap-2 self-start'>
              <SecondaryButton
                onClick={() => setView('list')}
                className='bg-white/5 border-white/10 text-white hover:bg-white/10'
              >
                Back
              </SecondaryButton>
              {permissionService.canEditRpnAgent() && (
                <PrimaryButton
                  onClick={() => setView('form')}
                  className='bg-brand-orange hover:bg-brand-orange/90 border-0'
                >
                  Edit Agent
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
          {/* Sidebar Stats */}
          <div className='space-y-6'>
            <div className='card bg-stone-50 border-stone-200'>
              <h4 className='text-[10px] uppercase font-bold text-stone-400 mb-4 tracking-widest border-b border-stone-200 pb-2'>
                Deployment Range
              </h4>
              <div className='space-y-3'>
                <div className='flex items-center gap-3'>
                  <MapPin size={14} className='text-brand-orange' />
                  <div>
                    <p className='text-[10px] font-bold uppercase'>
                      {selectedRPN.province}
                    </p>
                    <p className='text-[9px] text-stone-400 uppercase'>
                      {selectedRPN.cityTown}
                    </p>
                  </div>
                </div>
                <div className='p-3 bg-stone-100/50 mt-2'>
                  <p className='text-[9px] uppercase font-bold text-stone-400 mb-1'>
                    Focus Zone
                  </p>
                  <p className='text-[10px] font-medium leading-relaxed'>
                    {selectedRPN.territory}
                  </p>
                </div>
              </div>
            </div>

            <div className='card bg-stone-50 border-stone-200'>
              <h4 className='text-[10px] uppercase font-bold text-stone-400 mb-4 tracking-widest border-b border-stone-200 pb-2'>
                Performance Metrics
              </h4>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <p className='text-[9px] font-bold text-stone-400 uppercase mb-1'>
                    Assigned
                  </p>
                  <p className='text-xl font-bold font-mono'>
                    {rpnVendors.length}
                  </p>
                </div>
                <div>
                  <p className='text-[9px] font-bold text-stone-400 uppercase mb-1'>
                    Collections
                  </p>
                  <p className='text-xl font-bold font-mono'>
                    {rpnCollections.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Areas */}
          <div className='lg:col-span-3 space-y-8'>
            <TablePanel
              title='Assigned Vendors'
              subtitle='Vendors managed by this agent'
              actions={
                <SecondaryButton
                  onClick={() => startCollectionRecord()}
                  size='sm'
                  className='flex items-center gap-2'
                >
                  <Plus size={12} /> Log Field Activity
                </SecondaryButton>
              }
              headers={[
                'Vendor Identity',
                'Status',
                'Last Collection',
                'Next Follow-up',
                'Actions'
              ]}
            >
              {rpnVendors.map(v => (
                <tr key={v.id} className='hover:bg-stone-50'>
                  <td className='px-6 py-4'>
                    <p className='text-xs font-bold uppercase'>{v.name}</p>
                    <p className='text-[9px] font-mono text-stone-400 uppercase'>
                      {v.id}
                    </p>
                  </td>
                  <td className='px-6 py-4'>
                    <StatusBadge
                      status={v.status}
                      variant={v.status === 'active' ? 'success' : 'warning'}
                    />
                  </td>
                  <td className='px-6 py-4 text-[10px] font-mono whitespace-nowrap'>
                    {v.lastCollectionDate
                      ? new Date(v.lastCollectionDate).toLocaleDateString()
                      : 'NO BUFFER'}
                  </td>
                  <td className='px-6 py-4 text-[10px] font-mono text-brand-orange font-bold whitespace-nowrap'>
                    {v.nextFollowUpDate
                      ? new Date(v.nextFollowUpDate).toLocaleDateString()
                      : 'PENDING'}
                  </td>
                  <td className='px-6 py-4 text-right'>
                    <button
                      onClick={() => {
                        const cleanPhone = v.whatsappNumber.replace(/\D/g, '')
                        window.open(`https://wa.me/${cleanPhone}`, '_blank')
                      }}
                      className='p-1.5 text-stone-400 hover:text-green-600 transition-colors'
                      title='Direct WhatsApp Contact'
                    >
                      <MessageSquare size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {rpnVendors.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className='px-6 py-12 text-center text-stone-300 italic text-[10px] uppercase font-bold'
                  >
                    No vendors assigned to this agent.
                  </td>
                </tr>
              )}
            </TablePanel>

            <TablePanel
              title='Field Data Stream'
              subtitle='Historical record of agent collection operations'
              headers={[
                'Operation ID',
                'Type',
                'Target Vendor',
                'Products',
                'Status',
                'Date'
              ]}
            >
              {rpnCollections
                .sort(
                  (a, b) =>
                    new Date(b.dateCollected).getTime() -
                    new Date(a.dateCollected).getTime()
                )
                .map(c => (
                  <tr key={c.id} className='hover:bg-stone-50'>
                    <td className='px-6 py-4 text-[9px] font-mono text-stone-500'>
                      {c.id}
                    </td>
                    <td className='px-6 py-4 text-[10px] font-bold uppercase'>
                      {c.type}
                    </td>
                    <td className='px-6 py-4 text-xs uppercase font-medium'>
                      {safeVendors.find(v => v.id === c.vendorId)?.name ||
                        c.vendorId}
                    </td>
                    <td className='px-6 py-4 text-[10px] font-mono font-bold text-stone-400'>
                      {c.productCount} SKUs
                    </td>
                    <td className='px-6 py-4'>
                      <StatusBadge
                        status={c.status}
                        variant={c.status === 'entered' ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className='px-6 py-4 text-[10px] font-mono whitespace-nowrap'>
                      {new Date(c.dateCollected).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              {rpnCollections.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className='px-6 py-12 text-center text-stone-300 italic text-[10px] uppercase font-bold'
                  >
                    No field activities recorded.
                  </td>
                </tr>
              )}
            </TablePanel>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'pipeline') {
    return (
      <div className='space-y-8 pb-32'>
        <div className='bg-stone-50 border border-stone-200 p-6'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6'>
            <div>
              <h3 className='text-sm font-bold uppercase tracking-tight text-brand-charcoal'>
                RPN Prospect Pipeline
              </h3>
              <p className='text-[10px] text-stone-400 font-mono mt-1 uppercase italic tracking-wider'>
                Industrial Field-Sales CRM
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <SecondaryButton
                onClick={() => setView('list')}
                className='flex items-center gap-2'
              >
                <Users size={14} /> Agent Registry
              </SecondaryButton>
              <SecondaryButton
                onClick={() => setView('pipeline_analytics')}
                className='flex items-center gap-2 bg-stone-100 border-stone-200'
              >
                <BarChart3 size={14} /> Pipeline Analytics
              </SecondaryButton>
              {permissionService.canCreate('rpnManagement') && (
                <PrimaryButton
                  onClick={() => setView('prospect_form')}
                  className='flex items-center gap-2'
                >
                  <PlusCircle size={14} /> New Prospect
                </PrimaryButton>
              )}
            </div>
          </div>

          <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-6 mb-2'>
            <StatCard
              label='Total Prospects'
              value={pipelineStats.total}
              icon={Briefcase}
            />
            <StatCard
              label='New Prospects'
              value={pipelineStats.newProspects}
              icon={PlusCircle}
              variant='info'
            />
            <StatCard
              label='Due Today'
              value={pipelineStats.dueToday}
              icon={Calendar}
              variant={pipelineStats.dueToday > 0 ? 'warning' : 'neutral'}
            />
            <StatCard
              label='Overdue'
              value={pipelineStats.overdue}
              icon={AlertCircle}
              variant={pipelineStats.overdue > 0 ? 'error' : 'neutral'}
            />
            <StatCard
              label='Ready to Onboard'
              value={pipelineStats.readyForOnboarding}
              icon={CheckCircle2}
              variant='success'
            />
            <StatCard
              label='Onboarded'
              value={pipelineStats.onboarded}
              icon={Package}
              variant='success'
            />
            <StatCard
              label='Dormant'
              value={pipelineStats.dormant}
              icon={Clock}
              variant='neutral'
            />
            <StatCard
              label='Lost/Rejected'
              value={pipelineStats.lost}
              icon={XCircle}
              variant='error'
            />
          </div>

          <div className='grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 mb-6'>
            <StatCard
              label='Pipeline Est. Cost'
              value={`$${pipelineCostStats.estCost.toFixed(2)}`}
              icon={DollarSign}
            />
            <StatCard
              label='Pipeline Actual Cost'
              value={`$${pipelineCostStats.actualCost.toFixed(2)}`}
              icon={DollarSign}
            />
            <StatCard
              label='Avg Cost / Onboarding'
              value={`$${pipelineCostStats.costPerOnboarding.toFixed(2)}`}
              icon={DollarSign}
              variant='success'
            />
            <StatCard
              label='Lost Prospect Cost'
              value={`$${pipelineCostStats.lostActual.toFixed(2)}`}
              icon={DollarSign}
              variant='error'
            />
          </div>

          {/* Filters */}
          <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 bg-white p-4 border border-stone-200'>
            <div className='xl:col-span-2'>
              <SearchInput
                placeholder='Search prospect, business, phone...'
                value={search}
                onChange={e => setSearch(e.target.value)}
                className='w-full'
              />
            </div>
            <select
              value={rpnFilter}
              onChange={e => setRpnFilter(e.target.value)}
              className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
            >
              <option value='All'>All RPNs</option>
              {safeRpns.map(rpn => (
                <option key={rpn.id} value={rpn.id}>
                  {rpn.name}
                </option>
              ))}
            </select>
            <select
              value={staffFilter}
              onChange={e => setStaffFilter(e.target.value)}
              className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
            >
              <option value='All'>All Staff</option>
              {staffList
                .filter(s => s.status === 'active')
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
            </select>
            <select
              value={sourceTypeFilter}
              onChange={e => setSourceTypeFilter(e.target.value)}
              className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
            >
              <option value='All'>All Sources</option>
              {PROSPECT_SOURCE_TYPES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
            >
              <option value='All'>All Priorities</option>
              {PROSPECT_PRIORITIES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className='flex items-center gap-2 border-2 border-stone-100 p-2 bg-stone-50/50'>
              <input
                type='checkbox'
                checked={overdueOnlyFilter}
                onChange={e => setOverdueOnlyFilter(e.target.checked)}
                className='accent-brand-orange'
              />
              <span className='text-[10px] font-bold uppercase text-stone-500'>
                Overdue
              </span>
            </div>
            <div className='flex items-center gap-2 border-2 border-stone-100 p-2 bg-stone-50/50'>
              <input
                type='checkbox'
                checked={dueTodayFilter}
                onChange={e => setDueTodayFilter(e.target.checked)}
                className='accent-brand-orange'
              />
              <span className='text-[10px] font-bold uppercase text-stone-500'>
                Due Today
              </span>
            </div>

            <div className='md:col-span-3 lg:col-span-4 xl:col-span-7 md:hidden'>
              <select
                value={pipelineStageFilter}
                onChange={e => setPipelineStageFilter(e.target.value)}
                className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-brand-charcoal text-white'
              >
                <option value='All'>
                  Show All Stages (Scroll Horizontally)
                </option>
                {PROSPECT_PIPELINE_STAGES.map(stage => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Board */}
        <div className='flex gap-4 overflow-x-auto pb-4 px-2 custom-scrollbar items-start'>
          {(pipelineStageFilter === 'All'
            ? PROSPECT_PIPELINE_STAGES
            : [pipelineStageFilter as PipelineStage]
          ).map(stage => {
            const stageProspects = filteredProspects.filter(
              p => p.pipelineStage === stage
            )

            return (
              <div
                key={stage}
                className='w-80 shrink-0 bg-stone-100/50 border border-stone-200 flex flex-col max-h-[75vh]'
              >
                <div className='p-3 border-b border-stone-200 bg-stone-100 flex justify-between items-center sticky top-0'>
                  <h4 className='text-[11px] font-black uppercase text-brand-charcoal'>
                    {stage}
                  </h4>
                  <span className='text-[10px] font-bold bg-white border border-stone-200 px-2 py-0.5 rounded-full text-stone-500'>
                    {stageProspects.length}
                  </span>
                </div>
                <div className='p-2 space-y-3 overflow-y-auto custom-scrollbar flex-1'>
                  {stageProspects.map(prospect => (
                    <div
                      key={prospect.id}
                      className='bg-white p-4 border border-stone-200 shadow-sm hover:border-brand-orange transition-colors'
                    >
                      <div className='flex justify-between items-start mb-3'>
                        <h5 className='text-xs font-black uppercase text-brand-charcoal leading-tight pr-2'>
                          {prospect.businessName || prospect.prospectName}
                        </h5>
                        <StatusBadge
                          status={
                            prospect.priority || prospect.urgency || 'Medium'
                          }
                          variant={
                            (prospect.priority || prospect.urgency) ===
                              'Urgent' ||
                            (prospect.priority || prospect.urgency) ===
                              'Critical'
                              ? 'error'
                              : (prospect.priority || prospect.urgency) ===
                                'High'
                              ? 'warning'
                              : 'neutral'
                          }
                        />
                      </div>

                      <div className='space-y-1.5 mb-4'>
                        <p className='text-[10px] text-stone-600 font-bold flex items-center gap-1.5'>
                          <Phone size={10} className='text-stone-400' />
                          {prospect.contactPerson &&
                            `${prospect.contactPerson} • `}
                          {prospect.phone ||
                            prospect.whatsappNumber ||
                            prospect.whatsapp}
                        </p>
                        <p className='text-[10px] text-stone-500 flex items-center gap-1.5'>
                          <MapPin size={10} className='text-stone-400' />
                          <span className='truncate'>
                            {prospect.sector}
                            {prospect.category
                              ? ` / ${prospect.category}`
                              : ''}{' '}
                            •{' '}
                            {prospect.suburb ||
                              prospect.city ||
                              prospect.location ||
                              'No location'}
                          </span>
                        </p>
                        <div className='grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-stone-50'>
                          <div className='flex flex-col'>
                            <span className='text-[8px] font-bold text-stone-400 uppercase mb-0.5'>
                              RPN
                            </span>
                            <span className='truncate text-[9px] font-bold text-stone-600'>
                              {prospect.assignedRpnName || 'Unassigned'}
                            </span>
                          </div>
                          <div className='flex flex-col'>
                            <span className='text-[8px] font-bold text-stone-400 uppercase mb-0.5'>
                              Staff{' '}
                              {prospect.assignmentRole
                                ? `(${prospect.assignmentRole})`
                                : ''}
                            </span>
                            <span className='truncate text-[9px] font-bold text-stone-600'>
                              {prospect.assignedStaffName || 'Unassigned'}
                            </span>
                          </div>
                        </div>

                        <div className='grid grid-cols-2 gap-2 mt-2'>
                          <p className='text-[9px] text-stone-500 flex flex-col'>
                            <span className='font-bold text-stone-400 uppercase mb-0.5'>
                              Source
                            </span>
                            <span className='truncate'>
                              {prospect.sourceType ||
                                prospect.querySource ||
                                'Unknown'}
                            </span>
                          </p>
                          {prospect.totalCost || prospect.estimatedCost ? (
                            <p className='text-[9px] text-stone-500 flex flex-col'>
                              <span className='font-bold text-stone-400 uppercase mb-0.5'>
                                {prospect.totalActualCost
                                  ? 'Actual Cost'
                                  : 'Est. Cost'}
                              </span>
                              <span className='font-mono font-bold'>
                                $
                                {Number(
                                  prospect.totalActualCost ||
                                    prospect.totalEstimatedCost ||
                                    prospect.totalCost ||
                                    prospect.estimatedCost
                                ).toFixed(2)}
                              </span>
                            </p>
                          ) : (
                            <div />
                          )}
                        </div>

                        {(prospect.followUpDate ||
                          prospect.nextFollowUpDate) && (
                          <div
                            className={`mt-2 p-1.5 border flex items-center gap-1.5 ${
                              getFollowUpStatus(
                                prospect.followUpDate ||
                                  prospect.nextFollowUpDate
                              ).class
                            }`}
                          >
                            <Clock size={10} />
                            <p className={`text-[9px] font-bold uppercase`}>
                              {
                                getFollowUpStatus(
                                  prospect.followUpDate ||
                                    prospect.nextFollowUpDate
                                ).label
                              }
                              {normalizeDateInput(
                                prospect.followUpDate ||
                                  prospect.nextFollowUpDate
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {prospect.lastActivityNote && (
                        <div className='mb-4 p-2.5 bg-stone-50 border border-stone-100 text-[10px] text-stone-600 italic leading-relaxed line-clamp-3 relative'>
                          <MessageSquare
                            size={10}
                            className='absolute top-2.5 left-2.5 text-stone-300'
                          />
                          <span className='pl-4'>
                            {prospect.lastActivityNote}
                          </span>
                        </div>
                      )}

                      <div className='pt-3 border-t border-stone-100 flex flex-wrap justify-between gap-2'>
                        <button
                          onClick={() => {
                            setSelectedProspect(prospect)
                            setView('prospect_detail')
                          }}
                          className='px-3 py-1.5 bg-white border border-stone-200 text-[9px] font-bold uppercase text-stone-600 hover:border-brand-charcoal hover:text-brand-charcoal transition-colors flex items-center gap-1'
                        >
                          <Edit2 size={10} /> Details
                        </button>
                        {!isRecoverableStage(prospect.pipelineStage) &&
                          prospect.pipelineStage !== 'Onboarded' && (
                            <button
                              onClick={() => startMarkFollowUp(prospect)}
                              className='px-3 py-1.5 bg-white border border-stone-200 text-[9px] font-bold uppercase text-stone-600 hover:border-brand-orange hover:text-brand-orange transition-colors flex items-center gap-1'
                            >
                              <Check size={10} /> Done
                            </button>
                          )}
                        <button
                          onClick={() => startMoveStage(prospect)}
                          className='px-3 py-1.5 bg-brand-charcoal text-[9px] font-bold uppercase text-white hover:bg-brand-orange transition-colors flex items-center gap-1'
                        >
                          Status <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {stageProspects.length === 0 && (
                    <div className='p-4 text-center text-stone-400'>
                      <p className='text-[10px] font-bold uppercase tracking-widest italic opacity-50'>
                        Empty Stage
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (view === 'pipeline_analytics') {
    return (
      <div className='space-y-8 pb-32 max-w-[1400px] mx-auto'>
        <div className='flex flex-col md:flex-row md:items-center justify-between bg-stone-50 p-6 border border-stone-200 gap-4'>
          <button
            onClick={() => setView('pipeline')}
            className='flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal'
          >
            <ChevronRight size={14} className='rotate-180' /> Back to Pipeline
          </button>
          <div className='text-center md:text-left flex-1'>
            <h3 className='text-xl font-black uppercase tracking-tight text-brand-charcoal'>
              Prospect Pipeline Analytics
            </h3>
            <p className='text-[9px] font-mono text-stone-400 uppercase mt-0.5'>
              Conversion & Productivity Metrics
            </p>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 bg-white p-4 border border-stone-200'>
          <input
            type='date'
            value={analyticsDateFrom}
            onChange={e => setAnalyticsDateFrom(e.target.value)}
            className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange bg-stone-50/50'
            title='Date From'
          />
          <input
            type='date'
            value={analyticsDateTo}
            onChange={e => setAnalyticsDateTo(e.target.value)}
            className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange bg-stone-50/50'
            title='Date To'
          />
          <select
            value={rpnFilter}
            onChange={e => setRpnFilter(e.target.value)}
            className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
          >
            <option value='All'>All RPNs</option>
            {safeRpns.map(rpn => (
              <option key={rpn.id} value={rpn.id}>
                {rpn.name}
              </option>
            ))}
          </select>
          <select
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
            className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
          >
            <option value='All'>All Staff</option>
            {staffList
              .filter(s => s.status === 'active')
              .map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
          </select>
          <select
            value={sourceTypeFilter}
            onChange={e => setSourceTypeFilter(e.target.value)}
            className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
          >
            <option value='All'>All Sources</option>
            {PROSPECT_SOURCE_TYPES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={pipelineStageFilter}
            onChange={e => setPipelineStageFilter(e.target.value)}
            className='w-full border-2 border-stone-100 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
          >
            <option value='All'>All Stages</option>
            {PROSPECT_PIPELINE_STAGES.map(stage => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3'>
          <StatCard
            label='Total Prospects'
            value={pipelineAnalyticsData.total}
            icon={Briefcase}
          />
          <StatCard
            label='Active Prospects'
            value={pipelineAnalyticsData.active}
            icon={Activity}
            variant='info'
          />
          <StatCard
            label='Due Today'
            value={pipelineAnalyticsData.dueToday}
            icon={Calendar}
            variant={pipelineAnalyticsData.dueToday > 0 ? 'warning' : 'neutral'}
          />
          <StatCard
            label='Overdue'
            value={pipelineAnalyticsData.overdue}
            icon={AlertCircle}
            variant={pipelineAnalyticsData.overdue > 0 ? 'error' : 'neutral'}
          />
          <StatCard
            label='Ready to Onboard'
            value={pipelineAnalyticsData.ready}
            icon={CheckCircle2}
            variant='success'
          />
          <StatCard
            label='Onboarded'
            value={pipelineAnalyticsData.onboarded}
            icon={Package}
            variant='success'
          />
          <StatCard
            label='Lost / Rejected'
            value={pipelineAnalyticsData.lost}
            icon={XCircle}
            variant='error'
          />
          <StatCard
            label='Dormant'
            value={pipelineAnalyticsData.dormant}
            icon={Clock}
            variant='neutral'
          />
          <StatCard
            label='Total Est. Cost'
            value={`$${pipelineAnalyticsData.totalCost.toFixed(2)}`}
            icon={DollarSign}
          />
          <StatCard
            label='Cost / Onboarded'
            value={`$${pipelineAnalyticsData.costPerOnboarded.toFixed(2)}`}
            icon={DollarSign}
            variant='success'
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          <StatCard
            label='Avg Days to Ready'
            value={`${pipelineAnalyticsData.avgTimeToReady.toFixed(1)}`}
            icon={Clock}
          />
          <StatCard
            label='Avg Days to Onboard'
            value={`${pipelineAnalyticsData.avgTimeToOnboard.toFixed(1)}`}
            icon={Clock}
          />
          <StatCard
            label='Cost / Lost Prospect'
            value={`$${pipelineAnalyticsData.costPerLost.toFixed(2)}`}
            icon={DollarSign}
            variant='error'
          />
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          <TablePanel
            title='Prospects by Status'
            headers={['Stage', 'Count', '%']}
          >
            {Object.entries(pipelineAnalyticsData.byStatus).map(
              ([status, count]) => (
                <tr key={status} className='hover:bg-stone-50'>
                  <td className='px-4 py-3 text-xs font-bold uppercase'>
                    {status}
                  </td>
                  <td className='px-4 py-3 font-mono'>{count}</td>
                  <td className='px-4 py-3 font-mono text-stone-500'>
                    {((count / pipelineAnalyticsData.total) * 100 || 0).toFixed(
                      1
                    )}
                    %
                  </td>
                </tr>
              )
            )}
            {Object.keys(pipelineAnalyticsData.byStatus).length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className='px-4 py-8 text-center text-xs text-stone-400'
                >
                  No data available.
                </td>
              </tr>
            )}
          </TablePanel>

          <TablePanel
            title='Prospects by Source'
            headers={['Source', 'Count', '%']}
          >
            {Object.entries(pipelineAnalyticsData.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => (
                <tr key={source} className='hover:bg-stone-50'>
                  <td className='px-4 py-3 text-xs font-bold uppercase'>
                    {source}
                  </td>
                  <td className='px-4 py-3 font-mono'>{count}</td>
                  <td className='px-4 py-3 font-mono text-stone-500'>
                    {((count / pipelineAnalyticsData.total) * 100 || 0).toFixed(
                      1
                    )}
                    %
                  </td>
                </tr>
              ))}
            {Object.keys(pipelineAnalyticsData.bySource).length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className='px-4 py-8 text-center text-xs text-stone-400'
                >
                  No data available.
                </td>
              </tr>
            )}
          </TablePanel>

          <TablePanel
            title='Conversion by RPN'
            headers={['RPN', 'Assigned', 'Onboarded', 'Conv %']}
          >
            {Object.entries(pipelineAnalyticsData.rpnConversions)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([rpn, data]) => (
                <tr key={rpn} className='hover:bg-stone-50'>
                  <td className='px-4 py-3 text-xs font-bold uppercase'>
                    {rpn}
                  </td>
                  <td className='px-4 py-3 font-mono'>{data.total}</td>
                  <td className='px-4 py-3 font-mono text-emerald-600 font-bold'>
                    {data.onboarded}
                  </td>
                  <td className='px-4 py-3 font-mono text-stone-500'>
                    {((data.onboarded / data.total) * 100 || 0).toFixed(1)}%
                  </td>
                </tr>
              ))}
            {Object.keys(pipelineAnalyticsData.rpnConversions).length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className='px-4 py-8 text-center text-xs text-stone-400'
                >
                  No data available.
                </td>
              </tr>
            )}
          </TablePanel>

          <TablePanel
            title='Overdue Follow-ups by Assignee'
            headers={['Assignee', 'Overdue Count']}
          >
            {Object.entries(pipelineAnalyticsData.overdueAssignees)
              .sort((a, b) => b[1] - a[1])
              .map(([assignee, count]) => (
                <tr key={assignee} className='hover:bg-red-50/30'>
                  <td className='px-4 py-3 text-xs font-bold uppercase'>
                    {assignee}
                  </td>
                  <td className='px-4 py-3 font-mono text-red-600 font-bold'>
                    {count}
                  </td>
                </tr>
              ))}
            {Object.keys(pipelineAnalyticsData.overdueAssignees).length ===
              0 && (
              <tr>
                <td
                  colSpan={2}
                  className='px-4 py-8 text-center text-xs text-stone-400 uppercase tracking-widest font-bold'
                >
                  No overdue follow-ups.
                </td>
              </tr>
            )}
          </TablePanel>

          <TablePanel
            title='Prospects by Staff Member'
            headers={['Staff Member', 'Assigned']}
          >
            {Object.entries(pipelineAnalyticsData.byStaff)
              .sort((a, b) => b[1] - a[1])
              .map(([staff, count]) => (
                <tr key={staff} className='hover:bg-stone-50'>
                  <td className='px-4 py-3 text-xs font-bold uppercase'>
                    {staff}
                  </td>
                  <td className='px-4 py-3 font-mono'>{count}</td>
                </tr>
              ))}
            {Object.keys(pipelineAnalyticsData.byStaff).length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className='px-4 py-8 text-center text-xs text-stone-400'
                >
                  No data available.
                </td>
              </tr>
            )}
          </TablePanel>
        </div>
      </div>
    )
  }

  if (view === 'prospect_detail' && selectedProspect) {
    return (
      <div className='space-y-8 pb-32 max-w-5xl mx-auto'>
        <div className='flex flex-col md:flex-row md:items-center justify-between bg-stone-50 p-6 border border-stone-200 gap-4'>
          <button
            onClick={() => setView('pipeline')}
            className='flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal'
          >
            <ChevronRight size={14} className='rotate-180' /> Back to Pipeline
          </button>
          <div className='text-center md:text-left flex-1'>
            <h3 className='text-xl font-black uppercase tracking-tight text-brand-charcoal'>
              {selectedProspect.businessName || selectedProspect.prospectName}
            </h3>
            <div className='flex items-center gap-2 mt-1 justify-center md:justify-start'>
              <span className='text-[10px] font-bold text-stone-400 uppercase'>
                Current Stage:
              </span>
              <StatusBadge status={selectedProspect.pipelineStage} />
            </div>
          </div>
          <div className='flex flex-wrap justify-center md:justify-end gap-2'>
            <SecondaryButton
              onClick={() => {
                setProspectFormData(selectedProspect)
                setView('prospect_form')
              }}
              className='flex items-center gap-2'
            >
              <Edit2 size={14} /> Edit Prospect
            </SecondaryButton>
            <PrimaryButton
              onClick={() => startAssign(selectedProspect)}
              className='flex items-center gap-2 bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700'
            >
              <UserPlus size={14} /> Assign
            </PrimaryButton>
            <PrimaryButton
              onClick={() => handleSendWhatsAppLead(selectedProspect, 'rpn')}
              disabled={!selectedProspect.assignedRpnId}
              className='flex items-center gap-2'
            >
              <MessageSquare size={14} /> Send to RPN
            </PrimaryButton>
            <PrimaryButton
              onClick={() => handleSendWhatsAppLead(selectedProspect, 'staff')}
              disabled={!selectedProspect.assignedStaffId}
              className='flex items-center gap-2'
            >
              <MessageSquare size={14} /> Send to Staff
            </PrimaryButton>
            <SecondaryButton
              onClick={() => handleCopyWhatsAppLead(selectedProspect)}
              className='flex items-center gap-2'
            >
              <Copy size={14} /> Copy Message
            </SecondaryButton>
            <SecondaryButton
              onClick={() =>
                handleGeneratePdfNote(selectedProspect, 'TASK_NOTE')
              }
              className='flex items-center gap-2'
            >
              <FileCode size={14} /> Task Note
            </SecondaryButton>
            <SecondaryButton
              onClick={() =>
                handleGeneratePdfNote(selectedProspect, 'FOLLOW_UP_REMINDER')
              }
              className='flex items-center gap-2'
            >
              <FileCode size={14} /> Follow-up Note
            </SecondaryButton>
            <SecondaryButton
              onClick={() =>
                handleGeneratePdfNote(selectedProspect, 'ONBOARDING_HANDOFF')
              }
              className='flex items-center gap-2'
            >
              <FileCode size={14} /> Handoff Note
            </SecondaryButton>
            {selectedProspect.pipelineStage !== 'Onboarded' &&
              !isRecoverableStage(selectedProspect.pipelineStage) && (
                <PrimaryButton
                  onClick={() => startMarkFollowUp(selectedProspect)}
                  className='flex items-center gap-2 bg-white text-stone-600 border-stone-200 hover:border-brand-orange hover:text-brand-orange'
                >
                  <Check size={14} /> Mark Follow-up Done
                </PrimaryButton>
              )}
            <PrimaryButton
              onClick={() => startMoveStage(selectedProspect, undefined)}
              className='flex items-center gap-2'
            >
              <ArrowRight size={14} /> Change Status
            </PrimaryButton>
            {selectedProspect.pipelineStage !== 'Onboarded' && (
              <PrimaryButton
                onClick={() => convertToVendor(selectedProspect)}
                className='flex items-center gap-2 bg-emerald-600 border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700'
              >
                <CheckCircle2 size={14} /> Convert to Vendor
              </PrimaryButton>
            )}
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <div className='lg:col-span-2 space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <DataPanel title='Business Profile'>
                <div className='p-5 space-y-3 text-xs'>
                  <DetailRow
                    label='Business Name'
                    value={
                      selectedProspect.businessName ||
                      selectedProspect.prospectName
                    }
                  />
                  <DetailRow
                    label='Contact Person'
                    value={selectedProspect.contactPerson}
                  />
                  <DetailRow label='Phone' value={selectedProspect.phone} />
                  <DetailRow
                    label='WhatsApp'
                    value={
                      selectedProspect.whatsappNumber ||
                      selectedProspect.whatsapp
                    }
                  />
                  <DetailRow label='Sector' value={selectedProspect.sector} />
                  <DetailRow
                    label='Category'
                    value={selectedProspect.category}
                  />
                  <DetailRow
                    label='Location'
                    value={selectedProspect.location}
                  />
                  <DetailRow
                    label='District'
                    value={selectedProspect.district}
                  />
                  <DetailRow label='Suburb' value={selectedProspect.suburb} />
                </div>
              </DataPanel>

              <DataPanel title='Source Details'>
                <div className='p-5 space-y-3 text-xs'>
                  <DetailRow
                    label='Source Type'
                    value={
                      selectedProspect.sourceType ||
                      selectedProspect.querySource
                    }
                  />
                  <DetailRow
                    label='Source Name'
                    value={
                      selectedProspect.sourceName ||
                      selectedProspect.referredBy ||
                      selectedProspect.campaignName
                    }
                  />
                  <DetailRow
                    label='First Contact'
                    value={
                      selectedProspect.createdAt
                        ? normalizeDateInput(selectedProspect.createdAt)
                        : ''
                    }
                  />
                  <DetailRow
                    label='Phone Call Made?'
                    value={selectedProspect.phoneCallMade ? 'Yes' : 'No'}
                  />
                  <DetailRow
                    label='WhatsApp Intro?'
                    value={selectedProspect.introLetterSent ? 'Yes' : 'No'}
                  />
                </div>
              </DataPanel>

              <DataPanel title='Assignment'>
                <div className='p-5 space-y-3 text-xs'>
                  <DetailRow
                    label='Assigned RPN'
                    value={selectedProspect.assignedRpnName}
                  />
                  <DetailRow
                    label='Assigned Staff'
                    value={selectedProspect.assignedStaffName}
                  />
                  <DetailRow
                    label='Role / Responsibility'
                    value={selectedProspect.assignmentRole || 'Owner'}
                  />
                  <DetailRow
                    label='Assignment Date'
                    value={
                      selectedProspect.assignmentDate
                        ? normalizeDateInput(selectedProspect.assignmentDate)
                        : ''
                    }
                  />
                  <DetailRow
                    label='Priority'
                    value={
                      selectedProspect.priority || selectedProspect.urgency
                    }
                  />
                </div>
              </DataPanel>

              <DataPanel title='Task & Timeline'>
                <div className='p-5 space-y-3 text-xs'>
                  <DetailRow
                    label='Task Objective'
                    value={selectedProspect.taskObjective}
                  />
                  <DetailRow
                    label='Follow-up Date'
                    value={
                      selectedProspect.followUpDate ||
                      selectedProspect.nextFollowUpDate
                        ? normalizeDateInput(
                            selectedProspect.followUpDate ||
                              selectedProspect.nextFollowUpDate
                          )
                        : ''
                    }
                  />
                  <DetailRow
                    label='Timeline Notes'
                    value={selectedProspect.timelineNotes}
                  />
                </div>
              </DataPanel>

              <DataPanel title='Operational Costs' className='md:col-span-2'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-stone-100 pb-4'>
                  <div className='p-5 space-y-4'>
                    <h4 className='text-[10px] font-bold uppercase text-stone-500'>
                      Estimated Costs
                    </h4>
                    <div className='grid grid-cols-2 gap-4'>
                      <CostMetric
                        label='Transport'
                        value={
                          selectedProspect.estimatedTransportCost ??
                          selectedProspect.transportCost
                        }
                      />
                      <CostMetric
                        label='Airtime'
                        value={
                          selectedProspect.estimatedAirtimeCost ??
                          selectedProspect.airtimeCost
                        }
                      />
                      <CostMetric
                        label='Other'
                        value={
                          selectedProspect.estimatedOtherCost ??
                          selectedProspect.otherCost
                        }
                      />
                      <CostMetric
                        label='Total Est.'
                        value={
                          selectedProspect.totalEstimatedCost ??
                          selectedProspect.totalCost ??
                          selectedProspect.estimatedCost
                        }
                        isTotal
                      />
                    </div>
                  </div>
                  <div className='p-5 space-y-4 border-l border-stone-100'>
                    <h4 className='text-[10px] font-bold uppercase text-stone-500'>
                      Actual Costs
                    </h4>
                    <div className='grid grid-cols-2 gap-4'>
                      <CostMetric
                        label='Transport'
                        value={selectedProspect.actualTransportCost}
                      />
                      <CostMetric
                        label='Airtime'
                        value={selectedProspect.actualAirtimeCost}
                      />
                      <CostMetric
                        label='Other'
                        value={selectedProspect.actualOtherCost}
                      />
                      <CostMetric
                        label='Total Actual'
                        value={selectedProspect.totalActualCost}
                        isTotal
                      />
                    </div>
                  </div>
                </div>
                {(selectedProspect.costNotes ||
                  selectedProspect.costFactors) && (
                  <div className='px-5 pb-5 pt-2 text-xs'>
                    <span className='font-bold uppercase text-stone-400 mr-2'>
                      Cost Notes:
                    </span>
                    <span className='text-stone-700'>
                      {selectedProspect.costNotes ||
                        selectedProspect.costFactors}
                    </span>
                  </div>
                )}
              </DataPanel>
            </div>
          </div>

          <div className='space-y-6'>
            <DataPanel title='Pipeline Status'>
              <div className='p-5 space-y-4'>
                <div>
                  <p className='text-[10px] font-bold uppercase text-stone-400'>
                    Current Status
                  </p>
                  <p className='text-sm font-black text-brand-charcoal uppercase mt-1'>
                    {selectedProspect.pipelineStage}
                  </p>
                </div>
                <div>
                  <p className='text-[10px] font-bold uppercase text-stone-400'>
                    Last Activity Date
                  </p>
                  <p className='text-xs font-bold text-stone-700 mt-1'>
                    {selectedProspect.lastActivityDate
                      ? new Date(
                          selectedProspect.lastActivityDate
                        ).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className='text-[10px] font-bold uppercase text-stone-400'>
                    Last Activity Note
                  </p>
                  <p className='text-xs font-medium text-stone-600 mt-1 italic'>
                    {selectedProspect.lastActivityNote ||
                      selectedProspect.notes ||
                      'No recent notes.'}
                  </p>
                </div>
                <PrimaryButton
                  onClick={() => startMoveStage(selectedProspect)}
                  className='w-full text-xs'
                >
                  Change Status
                </PrimaryButton>
              </div>
            </DataPanel>

            <DataPanel
              title='Activity History'
              className='max-h-[600px] overflow-y-auto custom-scrollbar'
            >
              <div className='p-5'>
                <ActivityTimeline
                  items={getProspectTimeline(selectedProspect)}
                />
              </div>
            </DataPanel>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'prospect_form') {
    const handleEstimatedCostChange = (
      field: keyof RPNProspectQuery,
      value: string
    ) => {
      const numValue = parseFloat(value) || 0
      const current = { ...prospectFormData, [field]: numValue }
      const total =
        (Number(current.estimatedTransportCost) ||
          Number(current.transportCost) ||
          0) +
        (Number(current.estimatedAirtimeCost) ||
          Number(current.airtimeCost) ||
          0) +
        (Number(current.estimatedOtherCost) || Number(current.otherCost) || 0)
      setProspectFormData({ ...current, totalEstimatedCost: total })
    }

    const handleActualCostChange = (
      field: keyof RPNProspectQuery,
      value: string
    ) => {
      const numValue = parseFloat(value) || 0
      const current = { ...prospectFormData, [field]: numValue }
      const total =
        (Number(current.actualTransportCost) || 0) +
        (Number(current.actualAirtimeCost) || 0) +
        (Number(current.actualOtherCost) || 0)
      setProspectFormData({ ...current, totalActualCost: total })
    }

    return (
      <div className='space-y-8 pb-32 max-w-4xl mx-auto'>
        <div className='flex flex-col md:flex-row md:items-center justify-between bg-stone-50 p-6 border border-stone-200 gap-4'>
          <button
            onClick={() => setView('pipeline')}
            className='flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal'
          >
            <ChevronRight size={14} className='rotate-180' /> Back to Pipeline
          </button>
          <div className='text-center md:text-left'>
            <h3 className='text-sm font-bold uppercase tracking-tight text-brand-charcoal'>
              {prospectFormData.id
                ? 'Edit Prospect'
                : 'New Prospect Initiation'}
            </h3>
            <p className='text-[9px] font-mono text-stone-400 uppercase mt-0.5'>
              Field & Marketing Pipeline
            </p>
          </div>
          <PrimaryButton
            onClick={saveProspect}
            className='flex items-center gap-2'
          >
            <Save size={14} /> Save Prospect
          </PrimaryButton>
        </div>

        <div className='grid grid-cols-1 gap-8'>
          <DataPanel title='Section 1: Prospect Identity'>
            <div className='p-6 grid grid-cols-1 md:grid-cols-3 gap-6'>
              <FormField label='Business Name *' className='md:col-span-2'>
                <input
                  value={
                    prospectFormData.businessName ||
                    prospectFormData.prospectName ||
                    ''
                  }
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      businessName: e.target.value,
                      prospectName: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='Legal or trading name'
                />
              </FormField>
              <FormField label='Contact Person'>
                <input
                  value={prospectFormData.contactPerson || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      contactPerson: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='Full name'
                />
              </FormField>
              <FormField label='Phone Number *'>
                <input
                  value={prospectFormData.phone || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      phone: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='e.g. +263...'
                />
              </FormField>
              <FormField label='WhatsApp Number'>
                <input
                  value={
                    prospectFormData.whatsappNumber ||
                    prospectFormData.whatsapp ||
                    ''
                  }
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      whatsappNumber: e.target.value,
                      whatsapp: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='e.g. +263...'
                />
              </FormField>
              <FormField label='Sector'>
                <input
                  value={prospectFormData.sector || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      sector: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='e.g. Hardware, Auto Spares'
                />
              </FormField>
              <FormField label='Category'>
                <input
                  value={prospectFormData.category || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      category: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='Sub-sector'
                />
              </FormField>
              <FormField
                label='Location / Physical Address'
                className='md:col-span-2'
              >
                <input
                  value={prospectFormData.location || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      location: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='Street address or area'
                />
              </FormField>
              <FormField label='Suburb'>
                <input
                  value={prospectFormData.suburb || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      suburb: e.target.value
                    })
                  }
                  className={inputClass}
                />
              </FormField>
              <FormField label='District / City'>
                <input
                  value={
                    prospectFormData.district || prospectFormData.city || ''
                  }
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      district: e.target.value,
                      city: e.target.value
                    })
                  }
                  className={inputClass}
                />
              </FormField>
            </div>
          </DataPanel>

          <DataPanel title='Section 2: Prospect Source'>
            <div className='p-6 grid grid-cols-1 md:grid-cols-3 gap-6'>
              <FormField label='Source Type *'>
                <select
                  value={
                    prospectFormData.sourceType ||
                    prospectFormData.querySource ||
                    ''
                  }
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      sourceType: e.target.value,
                      querySource: e.target.value
                    })
                  }
                  className={inputClass}
                >
                  <option value=''>Select Source...</option>
                  {PROSPECT_SOURCE_TYPES.map(source => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label='Source / Campaign / Referral Name'
                className='md:col-span-2'
              >
                <input
                  value={
                    prospectFormData.sourceName ||
                    prospectFormData.referredBy ||
                    prospectFormData.campaignName ||
                    ''
                  }
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      sourceName: e.target.value,
                      referredBy: e.target.value,
                      campaignName: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='Who referred them or which campaign?'
                />
              </FormField>
              <FormField label='First Contact Date'>
                <input
                  type='date'
                  value={normalizeDateInput(
                    prospectFormData.createdAt || new Date().toISOString()
                  )}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      createdAt: new Date(e.target.value).toISOString()
                    })
                  }
                  className={inputClass}
                />
              </FormField>
              <div className='flex items-center gap-6 mt-6 md:col-span-2'>
                <label className='flex items-center gap-2 text-xs font-bold uppercase text-stone-600 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={!!prospectFormData.introLetterSent}
                    onChange={e =>
                      setProspectFormData({
                        ...prospectFormData,
                        introLetterSent: e.target.checked
                      })
                    }
                    className='w-4 h-4 accent-brand-orange'
                  />
                  Introduction Letter Sent?
                </label>
                <label className='flex items-center gap-2 text-xs font-bold uppercase text-stone-600 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={!!prospectFormData.phoneCallMade}
                    onChange={e =>
                      setProspectFormData({
                        ...prospectFormData,
                        phoneCallMade: e.target.checked
                      })
                    }
                    className='w-4 h-4 accent-brand-orange'
                  />
                  Phone Call Made?
                </label>
              </div>
            </div>
          </DataPanel>

          <DataPanel title='Section 3: Assignment'>
            <div className='p-6 grid grid-cols-1 md:grid-cols-2 gap-6'>
              <FormField label='Assigned RPN *'>
                <select
                  value={prospectFormData.assignedRpnId || ''}
                  onChange={e => {
                    const rpn = safeRpns.find(r => r.id === e.target.value)
                    setProspectFormData({
                      ...prospectFormData,
                      assignedRpnId: rpn?.id,
                      assignedRpnName: rpn?.name
                    })
                  }}
                  className={inputClass}
                >
                  <option value=''>Unassigned</option>
                  {safeRpns
                    .filter(r => r.status === 'active')
                    .map(rpn => (
                      <option key={rpn.id} value={rpn.id}>
                        {rpn.name}
                      </option>
                    ))}
                </select>
              </FormField>
              <FormField label='Assigned Staff Member *'>
                <SearchableComboBox
                  value={prospectFormData.assignedStaffName || ''}
                  options={staffList.filter(s => s.status === 'active')}
                  getOptionLabel={staff => staff.fullName}
                  getOptionValue={staff => staff.id}
                  getOptionSearchText={staff =>
                    buildSearchText([
                      staff.fullName,
                      staff.staffCode,
                      staff.email,
                      staff.role
                    ])
                  }
                  placeholder='Search active staff...'
                  onSelect={staff => {
                    setProspectFormData({
                      ...prospectFormData,
                      assignedStaffId: staff?.id,
                      assignedStaffName: staff?.fullName
                    })
                  }}
                />
              </FormField>
              <FormField label='Assignment Date'>
                <input
                  type='date'
                  value={normalizeDateInput(prospectFormData.assignmentDate)}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      assignmentDate: new Date(e.target.value).toISOString()
                    })
                  }
                  className={inputClass}
                />
              </FormField>
              <FormField label='Assignment Role'>
                <select
                  value={prospectFormData.assignmentRole || 'Owner'}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      assignmentRole: e.target.value
                    })
                  }
                  className={inputClass}
                >
                  <option value='Owner'>Owner</option>
                  <option value='Support'>Support</option>
                  <option value='Observer'>Observer</option>
                </select>
              </FormField>
              <FormField label='Priority'>
                <select
                  value={
                    prospectFormData.priority ||
                    prospectFormData.urgency ||
                    'Medium'
                  }
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      priority: e.target.value as ProspectPriority,
                      urgency: e.target.value as UrgencyLevel
                    })
                  }
                  className={inputClass}
                >
                  {PROSPECT_PRIORITIES.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </DataPanel>

          <DataPanel title='Section 4: Task Objective & Timeline'>
            <div className='p-6 grid grid-cols-1 md:grid-cols-2 gap-6'>
              <FormField label='Task Objective *' className='md:col-span-2'>
                <input
                  value={prospectFormData.taskObjective || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      taskObjective: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='e.g. Onboard to Standard Plan, Collect product samples...'
                />
              </FormField>
              <FormField label='Follow-up Date *'>
                <input
                  type='date'
                  value={normalizeDateInput(
                    prospectFormData.followUpDate ||
                      prospectFormData.nextFollowUpDate
                  )}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      followUpDate: e.target.value,
                      nextFollowUpDate: e.target.value
                    })
                  }
                  className={inputClass}
                />
              </FormField>
              <FormField label='Timeline Notes / Expected Next Action'>
                <input
                  value={prospectFormData.timelineNotes || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      timelineNotes: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='e.g. Call back on Wednesday afternoon'
                />
              </FormField>
            </div>
          </DataPanel>

          <DataPanel title='Section 5: Operational Costs (Estimated & Actual)'>
            <div className='p-6 grid grid-cols-1 md:grid-cols-2 gap-8'>
              {/* Estimated Costs */}
              <div className='space-y-6'>
                <h4 className='text-[10px] font-bold uppercase text-stone-400 border-b border-stone-200 pb-2'>
                  Estimated Costs
                </h4>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
                  <FormField label='Est. Transport'>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={
                        prospectFormData.estimatedTransportCost ??
                        prospectFormData.transportCost ??
                        ''
                      }
                      onChange={e =>
                        handleEstimatedCostChange(
                          'estimatedTransportCost',
                          e.target.value
                        )
                      }
                      className={inputClass}
                      placeholder='0.00'
                    />
                  </FormField>
                  <FormField label='Est. Airtime'>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={
                        prospectFormData.estimatedAirtimeCost ??
                        prospectFormData.airtimeCost ??
                        ''
                      }
                      onChange={e =>
                        handleEstimatedCostChange(
                          'estimatedAirtimeCost',
                          e.target.value
                        )
                      }
                      className={inputClass}
                      placeholder='0.00'
                    />
                  </FormField>
                  <FormField label='Est. Other'>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={
                        prospectFormData.estimatedOtherCost ??
                        prospectFormData.otherCost ??
                        ''
                      }
                      onChange={e =>
                        handleEstimatedCostChange(
                          'estimatedOtherCost',
                          e.target.value
                        )
                      }
                      className={inputClass}
                      placeholder='0.00'
                    />
                  </FormField>
                  <FormField label='Total Est. Cost'>
                    <div className='w-full border-2 border-stone-200 bg-stone-100 p-2.5 text-xs font-bold font-mono text-brand-orange text-right'>
                      ${' '}
                      {(
                        Number(
                          prospectFormData.totalEstimatedCost ??
                            prospectFormData.totalCost
                        ) || 0
                      ).toFixed(2)}
                    </div>
                  </FormField>
                </div>
              </div>

              {/* Actual Costs */}
              <div className='space-y-6'>
                <h4 className='text-[10px] font-bold uppercase text-stone-400 border-b border-stone-200 pb-2'>
                  Actual Costs
                </h4>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
                  <FormField label='Actual Transport'>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={prospectFormData.actualTransportCost ?? ''}
                      onChange={e =>
                        handleActualCostChange(
                          'actualTransportCost',
                          e.target.value
                        )
                      }
                      className={inputClass}
                      placeholder='0.00'
                    />
                  </FormField>
                  <FormField label='Actual Airtime'>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={prospectFormData.actualAirtimeCost ?? ''}
                      onChange={e =>
                        handleActualCostChange(
                          'actualAirtimeCost',
                          e.target.value
                        )
                      }
                      className={inputClass}
                      placeholder='0.00'
                    />
                  </FormField>
                  <FormField label='Actual Other'>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={prospectFormData.actualOtherCost ?? ''}
                      onChange={e =>
                        handleActualCostChange(
                          'actualOtherCost',
                          e.target.value
                        )
                      }
                      className={inputClass}
                      placeholder='0.00'
                    />
                  </FormField>
                  <FormField label='Total Actual Cost'>
                    <div className='w-full border-2 border-stone-200 bg-stone-100 p-2.5 text-xs font-bold font-mono text-brand-orange text-right'>
                      ${' '}
                      {(Number(prospectFormData.totalActualCost) || 0).toFixed(
                        2
                      )}
                    </div>
                  </FormField>
                </div>
              </div>

              <FormField label='Cost Notes' className='md:col-span-4'>
                <input
                  value={
                    prospectFormData.costNotes ??
                    prospectFormData.costFactors ??
                    ''
                  }
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      costNotes: e.target.value
                    })
                  }
                  className={inputClass}
                  placeholder='Details about the cost factors...'
                />
              </FormField>
            </div>
          </DataPanel>

          <DataPanel title='Section 6: Pipeline Status'>
            <div className='p-6 grid grid-cols-1 md:grid-cols-2 gap-6'>
              <FormField label='Current Pipeline Stage'>
                <select
                  value={prospectFormData.pipelineStage || 'New Prospect'}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      pipelineStage: e.target.value as PipelineStage
                    })
                  }
                  className={inputClass}
                >
                  <option value='New Prospect'>New Prospect</option>
                  <option value='Contacted'>Contacted</option>
                  <option value='Introduction Sent'>Introduction Sent</option>
                  <option value='Interested'>Interested</option>
                  <option value='Follow-up Required'>Follow-up Required</option>
                  {/* include other stages if editing */}
                  {prospectFormData.id &&
                    PROSPECT_PIPELINE_STAGES.filter(
                      s =>
                        ![
                          'New Prospect',
                          'Contacted',
                          'Introduction Sent',
                          'Interested',
                          'Follow-up Required'
                        ].includes(s)
                    ).map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </select>
              </FormField>
              <FormField label='General Notes'>
                <textarea
                  value={prospectFormData.notes || ''}
                  onChange={e =>
                    setProspectFormData({
                      ...prospectFormData,
                      notes: e.target.value
                    })
                  }
                  className={`${inputClass} h-12`}
                  placeholder='Any additional information...'
                />
              </FormField>
            </div>
          </DataPanel>
        </div>
      </div>
    )
  }

  if (isMoveStageModalOpen && moveStageData) {
    let notes = ''
    let nextFollowUpDate = ''
    return (
      <ConfirmDialog
        isOpen={isMoveStageModalOpen}
        title={`Move Prospect to: ${moveStageData.nextStage}`}
        message={`Move ${
          moveStageData.prospect.businessName ||
          moveStageData.prospect.prospectName
        } from ${moveStageData.prospect.pipelineStage} to ${
          moveStageData.nextStage
        }?`}
        onConfirm={async () => await executeMoveStage(notes, nextFollowUpDate)}
        onCancel={() => setIsMoveStageModalOpen(false)}
      >
        <div className='space-y-4 mt-4'>
          <FormField label='Notes'>
            <textarea
              onChange={e => (notes = e.target.value)}
              className='w-full border-2 border-stone-200 p-2 text-xs'
            />
          </FormField>
          <FormField label='Next Follow-up Date'>
            <input
              type='date'
              onChange={e => (nextFollowUpDate = e.target.value)}
              className='w-full border-2 border-stone-200 p-2 text-xs'
            />
          </FormField>
        </div>
      </ConfirmDialog>
    )
  }

  if (isAssignModalOpen && assignData) {
    const isReassignment = !!(
      assignData.prospect.assignedRpnId || assignData.prospect.assignedStaffId
    )

    return (
      <ConfirmDialog
        isOpen={isAssignModalOpen}
        title={isReassignment ? 'Reassign Prospect' : 'Assign Prospect'}
        message={`Assigning: ${
          assignData.prospect.businessName || assignData.prospect.prospectName
        }`}
        onConfirm={executeAssign}
        onCancel={() => {
          setIsAssignModalOpen(false)
          setAssignData(null)
        }}
        confirmLabel='Confirm Assignment'
      >
        <div className='space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField label='Assigned RPN'>
              <select
                value={assignData.assignedRpnId}
                onChange={e =>
                  setAssignData({
                    ...assignData,
                    assignedRpnId: e.target.value
                  })
                }
                className={inputClass}
              >
                <option value=''>Unassigned</option>
                {safeRpns
                  .filter(r => r.status === 'active')
                  .map(rpn => (
                    <option key={rpn.id} value={rpn.id}>
                      {rpn.name}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label='Assigned Staff Member'>
              <select
                value={assignData.assignedStaffId}
                onChange={e =>
                  setAssignData({
                    ...assignData,
                    assignedStaffId: e.target.value
                  })
                }
                className={inputClass}
              >
                <option value=''>Unassigned</option>
                {staffList
                  .filter(s => s.status === 'active')
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
              </select>
            </FormField>
          </div>

          <FormField label='Assignment Role'>
            <select
              value={assignData.assignmentRole}
              onChange={e =>
                setAssignData({ ...assignData, assignmentRole: e.target.value })
              }
              className={inputClass}
            >
              <option value='Owner'>Owner</option>
              <option value='Support'>Support</option>
              <option value='Observer'>Observer</option>
            </select>
          </FormField>

          {isReassignment && (
            <FormField label='Reason for Reassignment *'>
              <input
                value={assignData.reason}
                onChange={e =>
                  setAssignData({ ...assignData, reason: e.target.value })
                }
                className={inputClass}
                placeholder='e.g. Current owner unavailable...'
              />
            </FormField>
          )}

          <FormField label='Task Objective *'>
            <input
              value={assignData.taskObjective}
              onChange={e =>
                setAssignData({ ...assignData, taskObjective: e.target.value })
              }
              className={inputClass}
            />
          </FormField>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField label='Follow-up Date *'>
              <input
                type='date'
                value={normalizeDateInput(assignData.followUpDate)}
                onChange={e =>
                  setAssignData({ ...assignData, followUpDate: e.target.value })
                }
                className={inputClass}
              />
            </FormField>
            <FormField label='Priority'>
              <select
                value={assignData.priority}
                onChange={e =>
                  setAssignData({
                    ...assignData,
                    priority: e.target.value as ProspectPriority
                  })
                }
                className={inputClass}
              >
                {PROSPECT_PRIORITIES.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField label='Timeline Notes / Next Action'>
              <input
                value={assignData.timelineNotes}
                onChange={e =>
                  setAssignData({
                    ...assignData,
                    timelineNotes: e.target.value
                  })
                }
                className={inputClass}
              />
            </FormField>
            <FormField label='Total Cost Estimate'>
              <input
                type='number'
                min='0'
                step='0.01'
                value={assignData.totalEstimatedCost}
                onChange={e =>
                  setAssignData({
                    ...assignData,
                    totalEstimatedCost: Number(e.target.value) || 0
                  })
                }
                className={inputClass}
              />
            </FormField>
          </div>
        </div>
      </ConfirmDialog>
    )
  }

  if (isMarkFollowUpOpen && markFollowUpData) {
    return (
      <ConfirmDialog
        isOpen={isMarkFollowUpOpen}
        title={`Mark Follow-up Done`}
        message={`Complete follow-up for ${
          markFollowUpData.prospect.businessName ||
          markFollowUpData.prospect.prospectName
        }`}
        onConfirm={executeMarkFollowUp}
        onCancel={() => {
          setIsMarkFollowUpOpen(false)
          setMarkFollowUpData(null)
        }}
        confirmLabel='Save & Next'
      >
        <div className='space-y-4 mt-4'>
          <FormField label='Follow-up Notes / Outcome *'>
            <textarea
              value={markFollowUpData.notes}
              onChange={e =>
                setMarkFollowUpData({
                  ...markFollowUpData,
                  notes: e.target.value
                })
              }
              className={`${inputClass} h-24`}
              placeholder='What happened? Discussed terms? Sent samples?'
            />
          </FormField>
          <FormField label='Next Follow-up Date *'>
            <input
              type='date'
              value={markFollowUpData.nextFollowUpDate}
              onChange={e =>
                setMarkFollowUpData({
                  ...markFollowUpData,
                  nextFollowUpDate: e.target.value
                })
              }
              className={inputClass}
            />
          </FormField>
        </div>
      </ConfirmDialog>
    )
  }

  return (
    <div className='space-y-8 pb-32'>
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
      {/* Registry Controls */}
      <div className='bg-stone-50 border border-stone-200 p-6'>
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6'>
          <div>
            <h3 className='text-sm font-bold uppercase tracking-tight text-brand-charcoal'>
              RPN Management
            </h3>
            <p className='text-[10px] text-stone-400 font-mono mt-1 uppercase italic tracking-wider'>
              Agent Management // Directory V2.0
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <SecondaryButton
              onClick={() => setView('list')}
              className='flex items-center gap-2'
            >
              <LayoutDashboard size={14} /> Network Overview
            </SecondaryButton>
            <SecondaryButton
              onClick={() => setView('pipeline')}
              className='flex items-center gap-2'
            >
              <Briefcase size={14} /> Prospect Pipeline
            </SecondaryButton>
            <SecondaryButton
              onClick={() => setView('compensation')}
              className='flex items-center gap-2'
            >
              <DollarSign size={14} /> RPN Compensation
            </SecondaryButton>
            {permissionService.canCreateRpnAgent() && (
              <PrimaryButton
                onClick={startNewRPN}
                className='flex items-center gap-2'
              >
                <PlusCircle size={14} /> Add New Agent
              </PrimaryButton>
            )}
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white border border-stone-200'>
          <SearchInput
            placeholder='Search Agent Name...'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            value={rpnFilter}
            onChange={e => setRpnFilter(e.target.value)}
            className='w-full border-2 border-stone-50 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50'
          >
            <option value='All'>All Statuses</option>
            {RPN_STATUSES.map(s => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <div className='hidden md:flex flex-col justify-center px-4 border-l border-stone-100'>
            <p className='text-[9px] font-bold text-stone-400 uppercase'>
              Assigned Vendors
            </p>
            <p className='text-sm font-bold font-mono'>{safeVendors.length}</p>
          </div>
          <div className='hidden md:flex flex-col justify-center px-4 border-l border-stone-100'>
            <p className='text-[9px] font-bold text-stone-400 uppercase'>
              Pending Entries
            </p>
            <p className='text-sm font-bold font-mono text-brand-orange'>
              {stats.pendingCollections}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        <StatCard
          label='Active Vendors'
          value={stats.activeVendors.toString()}
          icon={Activity}
        />
        <StatCard
          label='Subscription Overdue'
          value={stats.vendorsOverdue.toString()}
          icon={Clock}
          variant='warning'
        />
        <StatCard
          label='Pending Follow-ups'
          value={stats.followUpsPending.toString()}
          icon={AlertCircle}
        />
        <div className='card bg-brand-charcoal text-white flex flex-col justify-center'>
          <p className='text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1'>
            System Reliability
          </p>
          <p className='text-2xl font-bold font-mono'>98.4%</p>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        <div className='lg:col-span-2'>
          <TablePanel
            title='Agent Registry'
            headers={[
              'Agent Identity',
              'Deployment Zone',
              'Contact',
              'Impact',
              'Actions'
            ]}
          >
            {filteredRPNs.map(rpn => (
              <tr
                key={rpn.id}
                className='group hover:bg-stone-50 transition-colors'
              >
                <td className='px-6 py-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-9 h-9 bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-stone-400 group-hover:bg-brand-charcoal group-hover:text-white transition-colors'>
                      {rpn.name.charAt(0)}
                    </div>
                    <div>
                      <p className='text-xs font-bold uppercase text-brand-charcoal'>
                        {rpn.name}
                      </p>
                      <p className='text-[9px] font-mono text-stone-400 flex items-center gap-1 uppercase'>
                        {rpn.id} <span className='opacity-50'>|</span>{' '}
                        {rpn.level}
                      </p>
                    </div>
                  </div>
                </td>
                <td className='px-6 py-4'>
                  <p className='text-xs font-bold text-stone-500 uppercase'>
                    {rpn.province}
                  </p>
                  <p className='text-[9px] text-stone-400 uppercase mt-0.5'>
                    {rpn.district}
                  </p>
                </td>
                <td className='px-6 py-4'>
                  <div className='flex gap-2'>
                    <a
                      href={getWhatsAppLink(rpn.whatsapp)}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='p-1.5 text-stone-400 hover:text-green-600 transition-colors'
                    >
                      <MessageSquare size={14} />
                    </a>
                    <a
                      href={`mailto:${rpn.email}`}
                      className='p-1.5 text-stone-400 hover:text-blue-500 transition-colors'
                    >
                      <Mail size={14} />
                    </a>
                  </div>
                </td>
                <td className='px-6 py-4'>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs font-mono font-bold'>
                      {
                        safeVendors.filter(v => v.assignedRPNId === rpn.id)
                          .length
                      }
                    </span>
                    <div className='h-1 w-16 bg-stone-100 rounded-full overflow-hidden'>
                      <div
                        className='h-full bg-brand-orange'
                        style={{
                          width: `${Math.min(
                            100,
                            (safeVendors.filter(v => v.assignedRPNId === rpn.id)
                              .length /
                              20) *
                              100
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className='px-6 py-4 text-right'>
                  <div className='flex justify-end gap-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={() => {
                        if (permissionService.canEditRpnAgent()) {
                          setRpnFormData({ ...rpn })
                          setView('form')
                        } else {
                          alert(
                            'You do not have permission to edit RPN agents.'
                          )
                          void staffAuditService.logAction({
                            eventType: 'ACCESS_DENIED',
                            module: 'staff',
                            severity: 'high',
                            action:
                              'Attempted to edit RPN agent without permission'
                          })
                        }
                      }}
                      disabled={!permissionService.canEditRpnAgent()}
                      className={`p-1.5 border border-stone-200 transition-all bg-white ${
                        permissionService.canEditRpnAgent()
                          ? 'text-stone-400 hover:text-brand-orange'
                          : 'text-stone-200 cursor-not-allowed'
                      }`}
                      title={
                        permissionService.canEditRpnAgent()
                          ? 'Edit Agent'
                          : 'No permission to edit agent'
                      }
                    >
                      <Edit2 size={12} />
                    </button>
                    {permissionService.canViewRpnAgents() && (
                      <button
                        onClick={() => openRPNProfile(rpn)}
                        className='p-1.5 border border-stone-200 text-stone-400 hover:text-brand-charcoal transition-all bg-white'
                        title='View Profile'
                      >
                        <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredRPNs.length === 0 && (
              <tr>
                <td colSpan={5} className='px-6 py-20'>
                  <EmptyState
                    title='No Agents Found'
                    description='No agents matching the search were found.'
                    icon={Shield}
                    action={
                      <SecondaryButton onClick={() => setSearch('')}>
                        Clear Filters
                      </SecondaryButton>
                    }
                  />
                </td>
              </tr>
            )}
          </TablePanel>
        </div>

        <div className='space-y-8'>
          <DataPanel
            title='Critical Interaction Queue'
            actions={<History size={14} className='text-stone-300' />}
          >
            <div className='p-4 space-y-3'>
              {safeVendors
                .filter(v => v.nextFollowUpDate && v.status === 'active')
                .sort(
                  (a, b) =>
                    new Date(a.nextFollowUpDate!).getTime() -
                    new Date(b.nextFollowUpDate!).getTime()
                )
                .slice(0, 5)
                .map(v => {
                  const rpn = safeRpns.find(r => r.id === v.assignedRPNId)
                  return (
                    <div
                      key={v.id}
                      className='p-3 border-l-2 border-brand-orange bg-stone-50 group hover:bg-stone-100 transition-colors'
                    >
                      <div className='flex justify-between items-start mb-1'>
                        <p className='text-[10px] font-bold uppercase text-brand-charcoal'>
                          {v.name}
                        </p>
                        <span className='text-[9px] font-mono text-brand-orange font-bold'>
                          DUE:{' '}
                          {new Date(v.nextFollowUpDate!).toLocaleDateString()}
                        </span>
                      </div>
                      <p className='text-[9px] text-stone-400 uppercase italic'>
                        Agent: {rpn?.name || 'UNASSIGNED'}
                      </p>
                      <div className='flex justify-end gap-2 mt-2 pt-2 border-t border-stone-100 opacity-60 group-hover:opacity-100 transition-opacity'>
                        <button
                          onClick={() =>
                            window.open(
                              getWhatsAppLink(v.whatsappNumber),
                              '_blank'
                            )
                          }
                          className='text-[8px] font-bold uppercase text-green-600 flex items-center gap-1 hover:underline'
                        >
                          <MessageSquare size={10} /> Contact Vendor
                        </button>
                      </div>
                    </div>
                  )
                })}
              {safeVendors.filter(v => v.nextFollowUpDate).length === 0 && (
                <div className='p-12 text-center text-stone-300'>
                  <Clock size={24} className='mx-auto mb-2 opacity-30' />
                  <p className='text-[9px] font-bold uppercase tracking-widest italic'>
                    No pending follow-ups
                  </p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel
            title='Overdue Subscription Queue'
            actions={<AlertCircle size={14} className='text-red-400' />}
          >
            <div className='p-4 space-y-3'>
              {safeVendors
                .filter(
                  v =>
                    v.subscriptionStatus === 'overdue' ||
                    v.subscriptionStatus === 'due'
                )
                .sort(
                  (a, b) =>
                    new Date(a.subscriptionDueDate!).getTime() -
                    new Date(b.subscriptionDueDate!).getTime()
                )
                .slice(0, 5)
                .map(v => (
                  <div
                    key={v.id}
                    className='p-3 border-l-2 border-red-500 bg-red-50 group hover:bg-red-100 transition-colors'
                  >
                    <div className='flex justify-between items-start mb-1'>
                      <p className='text-[10px] font-bold uppercase text-red-900'>
                        {v.name}
                      </p>
                      <span className='text-[9px] font-mono text-red-600 font-bold'>
                        DUE:{' '}
                        {new Date(v.subscriptionDueDate!).toLocaleDateString()}
                      </span>
                    </div>
                    <p className='text-[9px] text-red-400 uppercase italic font-mono'>
                      {v.id}
                    </p>
                    <div className='flex justify-end gap-2 mt-2 pt-2 border-t border-red-100 opacity-60 group-hover:opacity-100 transition-opacity'>
                      <button
                        onClick={() =>
                          window.open(
                            getWhatsAppLink(v.whatsappNumber),
                            '_blank'
                          )
                        }
                        className='text-[8px] font-bold uppercase text-green-700 flex items-center gap-1 hover:underline'
                      >
                        <MessageSquare size={10} /> Urgency Contact
                      </button>
                    </div>
                  </div>
                ))}
              {safeVendors.filter(
                v =>
                  v.subscriptionStatus === 'overdue' ||
                  v.subscriptionStatus === 'due'
              ).length === 0 && (
                <div className='p-12 text-center text-stone-300'>
                  <CheckCircle2 size={24} className='mx-auto mb-2 opacity-30' />
                  <p className='text-[9px] font-bold uppercase tracking-widest italic'>
                    All nodes synchronized
                  </p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel title='Live Field Protocol Log'>
            <div className='p-4 space-y-4'>
              {safeCollections.slice(0, 4).map(c => (
                <div key={c.id} className='flex gap-4'>
                  <div className='w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0'>
                    <Activity size={12} className='text-stone-400' />
                  </div>
                  <div>
                    <p className='text-[10px] font-bold uppercase leading-tight'>
                      {safeVendors.find(v => v.id === c.vendorId)?.name ||
                        'UNKNOWN'}
                    </p>
                    <p className='text-[9px] text-stone-500 font-mono mt-0.5'>
                      {c.type.toUpperCase()} recorded by{' '}
                      {safeRpns.find(r => r.id === c.rpnId)?.name}
                    </p>
                    <p className='text-[8px] text-stone-300 mt-1 uppercase font-bold'>
                      {new Date(c.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {safeCollections.length === 0 && (
                <div className='p-12 text-center text-stone-300 italic text-[10px] uppercase font-bold'>
                  Node stream silent.
                </div>
              )}
            </div>
          </DataPanel>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title='Delete Agent?'
        message='Deletion is permanent. All assignments will be removed and activity history archived.'
        variant='danger'
        confirmLabel='Delete Agent'
        onConfirm={handleDeleteRPN}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  )
}
