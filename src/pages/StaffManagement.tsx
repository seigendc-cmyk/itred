﻿﻿/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Users,
  Plus,
  Edit2,
  Lock,
  Unlock,
  UserX,
  Eye,
  EyeOff,
  Shield,
  RotateCcw,
  FileText,
  Download,
  AlertTriangle,
  Archive,
  Trash2,
  Loader2
} from 'lucide-react'
import {
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  SearchInput,
  ConfirmDialog,
  DataPanel,
  FormField,
  BrandedAlertModal
} from '../components/CommonUI.tsx'
import { staffService, ROLE_TEMPLATES } from '../services/staffService.ts'
import { analyticsService } from '../services/analyticsService.ts'
import { permissionService } from '../services/permissionService.ts'
import {
  Staff,
  MenuKey,
  PermissionLevel,
  DeskType,
  ActivityLog,
  MenuPermissions,
  ActionPermissions,
  ActionPermissionKey
} from '../types.ts'
import { asArray, stripUndefinedDeep } from '../utils/safeData.ts'
import { pdfService } from '../services/pdfService.ts'
import { focusMainContent } from '../utils/uiHelpers.ts'

import { staffAuditService } from '../services/staffAuditService.ts'

const DESKS: DeskType[] = [
  'SysAdmin Desk',
  'Backoffice Desk',
  'Product Data Desk',
  'Catalogue Deployment Desk',
  'Collections Desk',
  'RPN Management Desk',
  'CAH Operations Desk',
  'BI & Analytics Desk',
  'Viewer Desk'
]

const MENU_KEYS: MenuKey[] = [
  'dashboard',
  'vendorManagement',
  'addNewVendor',
  'rpnManagement',
  'addNewAgent',
  'productManagement',
  'addNewProduct',
  'productList',
  'accessHub',
  'whatsappActivity',
  'whatsappCommunityBI',
  'cahBooths',
  'pricing',
  'subscriptionsCollections',
  'collectionCalendar',
  'createCatalogue',
  'createStorefront',
  'inventorySpotChecks',
  'analytics',
  'biMarketAnalytics',
  'performanceMetrics',
  'activityLogs',
  'adminDashboard',
  'staffManagement',
  'roleMenuPermissions',
  'staffAccessLogs',
  'systemSettings',
  'howTo',
  'financeDesk',
  'cashBankManager',
  'rpnPaymentsLedger',
  'financeReports'
]

const PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendorManagement', label: 'Vendor Management' },
  { id: 'addNewVendor', label: 'Add New Vendor' },
  { id: 'rpnManagement', label: 'RPN Management' },
  { id: 'addNewAgent', label: 'Add New Agent' },
  { id: 'productManagement', label: 'Product Management' },
  { id: 'addNewProduct', label: 'Add New Product' },
  { id: 'productList', label: 'Product List' },
  { id: 'accessHub', label: 'Access Hub' },
  { id: 'whatsappActivity', label: 'WhatsApp Activity' },
  { id: 'whatsappCommunityBI', label: 'WhatsApp Community BI' },
  { id: 'cahBooths', label: 'CAH Booths' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'subscriptionsCollections', label: 'Subscriptions & Collections' },
  { id: 'collectionCalendar', label: 'Collection Calendar' },
  { id: 'createCatalogue', label: 'Create Catalogue' },
  { id: 'createStorefront', label: 'Create Storefront' },
  { id: 'inventorySpotChecks', label: 'Inventory Spot Checks' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'biMarketAnalytics', label: 'BI Market Analytics' },
  { id: 'performanceMetrics', label: 'Performance Metrics' },
  { id: 'activityLogs', label: 'Activity Logs' },
  { id: 'adminDashboard', label: 'Admin Dashboard' },
  { id: 'staffManagement', label: 'Staff Management' },
  { id: 'roleMenuPermissions', label: 'Role & Menu Permissions' },
  { id: 'staffAccessLogs', label: 'Staff Access Logs' },
  { id: 'systemSettings', label: 'System Settings' },
  { id: 'howTo', label: 'How To & Help' },
  { id: 'approvalQueue', label: 'Approval Queue' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'staffTasks', label: 'Staff Tasks' },
  { id: 'financeDesk', label: 'Finance Desk' },
  { id: 'cashBankManager', label: 'Cash & Bank Manager' },
  { id: 'rpnPaymentsLedger', label: 'RPN Payments Ledger' },
  { id: 'financeReports', label: 'Finance Reports' }
]

const ACTION_GROUPS = [
  {
    name: 'Vendor Operations',
    keys: [
      'vendor.view',
      'vendor.createDraft',
      'vendor.submitApproval',
      'vendor.approve',
      'vendor.publish',
      'vendor.delete'
    ]
  },
  {
    name: 'Product Operations',
    keys: [
      'product.view',
      'product.createDraft',
      'product.submitApproval',
      'product.approve',
      'product.publish',
      'product.changePrice',
      'product.delete'
    ]
  },
  {
    name: 'Catalogue Operations',
    keys: [
      'catalogue.view',
      'catalogue.generate',
      'catalogue.submitApproval',
      'catalogue.approveDeploy',
      'catalogue.download',
      'catalogue.archive'
    ]
  },
  {
    name: 'Commerce Access Hub',
    keys: [
      'cah.view',
      'cah.createLink',
      'cah.submitApproval',
      'cah.approveLink'
    ]
  },
  {
    name: 'WhatsApp Activity',
    keys: ['whatsapp.view', 'whatsapp.logActivity', 'whatsapp.verifyConversion']
  },
  {
    name: 'Plans & Prices',
    keys: [
      'pricing.view',
      'pricing.submitApproval',
      'pricing.approve',
      'subscriptions.view',
      'subscriptions.recordPayment',
      'subscriptions.waive',
      'subscriptions.generateReceipt',
      'subscriptions.postToFinance',
      'subscriptions.generateRpnCommission'
    ]
  },
  {
    name: 'Notifications',
    keys: [
      'notifications.view',
      'notifications.markRead',
      'notifications.resolve',
      'notifications.archive',
      'notifications.viewAll',
      'notifications.viewOwn',
      'notifications.viewTeam'
    ]
  },
  {
    name: 'Approval Queue',
    keys: ['approvalQueue.view', 'approvalQueue.approve']
  },
  {
    name: 'Staff Tasks',
    keys: ['staffTasks.viewOwn', 'staffTasks.assign', 'staffTasks.complete']
  },
  {
    name: 'Staff Messenger',
    keys: [
      'staffChat.view',
      'staffChat.sendDirect',
      'staffChat.sendGroup',
      'staffChat.assignTask',
      'staffChat.monitor',
      'staffChat.deleteMessage'
    ]
  },
  {
    name: 'RPN & Field Network',
    keys: [
      'rpn.viewPerformance',
      'rpn.viewFinancials',
      'rpn.setThresholds',
      'rpn.assignVendor',
      'rpn.reassignVendor',
      'rpn.viewChurn',
      'rpn.viewCommissions',
      'rpn.exportReports'
    ]
  },
  {
    name: 'RPN Pipeline',
    keys: [
      'rpnProspects.view',
      'rpnProspects.create',
      'rpnProspects.edit',
      'rpnProspects.delete',
      'rpnPipeline.moveStage',
      'rpnPipeline.managerOverride',
      'rpnPipeline.convertToVendor',
      'rpnAppointments.edit',
      'rpnFollowups.edit',
      'rpnPipeline.analytics'
    ]
  },
  {
    name: 'Finance Operations',
    keys: [
      'finance.view',
      'finance.settings.manage',
      'finance.coa.manage',
      'finance.cashBankAccounts.manage',
      'finance.ledger.view',
      'finance.transaction.create',
      'finance.ledger.exportPdf',
      'finance.payment.create',
      'finance.payment.approve',
      'finance.payment.post',
      'finance.payment.void',
      'finance.receipt.create',
      'finance.receipt.post',
      'finance.journal.create',
      'finance.journal.approve',
      'finance.journal.post',
      'finance.allowOverdraw',
      'finance.rpnPayments.view',
      'finance.rpnPayments.generate',
      'finance.rpnPayments.approve',
      'finance.rpnPayments.pay',
      'finance.reports.view',
      'finance.reports.print',
      'finance.reports.downloadPdf',
      'finance.reports.exportCsv',
      'finance.reports.approvePrint',
      'finance.reports.viewSensitive',
      'finance.reports.viewRpnPayments',
      'finance.reports.viewAssets',
      'finance.reports.viewLedger',
      'finance.reports.viewAuditTrail'
    ]
  },
  {
    name: 'Staff & Permissions',
    keys: [
      'staff.suspend',
      'staff.reactivate',
      'staff.archive',
      'staff.requestDelete',
      'staff.approveDelete',
      'staff.deletePermanent',
      'staff.editKycDetails',
      'staff.generateStaffCode',
      'staff.repairDuplicateCodes',
      'staff.editPermissions',
      'staff.manage',
      'roles.viewPermissions',
      'roles.editPermissions',
      'roles.createRoleTemplate',
      'roles.deleteRoleTemplate',
      'roles.assignRoleToStaff',
      'roles.auditPermissionChanges',
      'system.settings.edit'
    ]
  }
] as const

const JUNIOR_STAFF_PERMS: ActionPermissions = {
  'vendor.view': true,
  'vendor.createDraft': true,
  'vendor.submitApproval': true,
  'product.view': true,
  'product.createDraft': true,
  'product.submitApproval': true,
  'catalogue.view': true,
  'catalogue.generate': true,
  'catalogue.submitApproval': true,
  'cah.view': true,
  'cah.createLink': true,
  'cah.submitApproval': true,
  'pricing.view': true,
  'pricing.submitApproval': true,
  'subscriptions.view': true,
  'subscriptions.recordPayment': true,
  'whatsapp.view': true,
  'whatsapp.logActivity': true,
  'notifications.view': true,
  'notifications.markRead': true,
  'notifications.viewOwn': true,
  'staffTasks.viewOwn': true,
  'staffTasks.complete': true,
  'staffChat.view': true,
  'staffChat.sendDirect': true
}

const MANAGER_PERMS: ActionPermissions = {
  ...JUNIOR_STAFF_PERMS,
  'vendor.approve': true,
  'product.approve': true,
  'product.changePrice': true,
  'catalogue.approveDeploy': true,
  'cah.approveLink': true,
  'pricing.approve': true,
  'subscriptions.waive': true,
  'subscriptions.generateReceipt': true,
  'subscriptions.postToFinance': true,
  'subscriptions.generateRpnCommission': true,
  'whatsapp.verifyConversion': true,
  'notifications.viewAll': true,
  'notifications.resolve': true,
  'notifications.archive': true,
  'notifications.viewTeam': true,
  'approvalQueue.view': true,
  'approvalQueue.approve': true,
  'staffTasks.assign': true,
  'staffChat.sendGroup': true,
  'staffChat.assignTask': true,
  'staffChat.monitor': true,
  'roles.viewPermissions': true
}

const SUPER_ADMIN_PERMS: ActionPermissions = {
  ...MANAGER_PERMS,
  'vendor.publish': true,
  'vendor.delete': true,
  'product.publish': true,
  'product.delete': true,
  'catalogue.download': true,
  'catalogue.archive': true,
  'roles.viewPermissions': true,
  'roles.editPermissions': true,
  'roles.createRoleTemplate': true,
  'roles.deleteRoleTemplate': true,
  'roles.assignRoleToStaff': true,
  'roles.auditPermissionChanges': true,
  'staff.editPermissions': true,
  'staff.manage': true,
  'system.settings.edit': true,
  'staffChat.deleteMessage': true,
  'finance.view': true,
  'finance.settings.manage': true,
  'finance.coa.manage': true,
  'finance.cashBankAccounts.manage': true,
  'finance.ledger.view': true,
  'finance.transaction.create': true,
  'finance.ledger.exportPdf': true,
  'finance.payment.create': true,
  'finance.payment.approve': true,
  'finance.payment.post': true,
  'finance.payment.void': true,
  'finance.receipt.create': true,
  'finance.receipt.post': true,
  'finance.journal.create': true,
  'finance.journal.approve': true,
  'finance.journal.post': true,
  'finance.allowOverdraw': true,
  'finance.rpnPayments.view': true,
  'finance.rpnPayments.generate': true,
  'finance.rpnPayments.approve': true,
  'finance.rpnPayments.pay': true,
  'finance.reports.view': true,
  'finance.reports.print': true,
  'finance.reports.downloadPdf': true,
  'finance.reports.exportCsv': true,
  'finance.reports.approvePrint': true,
  'finance.reports.viewSensitive': true,
  'finance.reports.viewRpnPayments': true,
  'finance.reports.viewAssets': true,
  'finance.reports.viewLedger': true,
  'finance.reports.viewAuditTrail': true
}

export const StaffManagement: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([])
  const [activeTab, setActiveTab] = useState<
    'directory' | 'roles' | 'logs' | 'settings'
  >('directory')

  const location = useLocation()

  const [view, setView] = useState<
    'list' | 'form' | 'permissions' | 'roleEdit'
  >('list')

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deskFilter, setDeskFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [actionStateFilter, setActionStateFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState('all')
  const [logSearch, setLogSearch] = useState('')
  const [filterStaff, setFilterStaff] = useState('all')
  const [filterEventType, setFilterEventType] = useState('all')
  const [filterResult, setFilterResult] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [formData, setFormData] = useState<Partial<Staff>>({})
  const [showPasscode, setShowPasscode] = useState(false)
  const [tempPasscode, setTempPasscode] = useState('')
  const [confirmTempPasscode, setConfirmTempPasscode] = useState('')
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false)
  const [isApplyRoleModalOpen, setIsApplyRoleModalOpen] = useState(false)
  const [applyRoleConfig, setApplyRoleConfig] = useState<{
    role: string
  } | null>(null)
  const [localRoleTemplates, setLocalRoleTemplates] = useState<
    Record<
      string,
      {
        menuPermissions: MenuPermissions
        actionPermissions?: ActionPermissions
      }
    >
  >(() => {
    const base: Record<string, any> = { ...ROLE_TEMPLATES }
    Object.keys(base).forEach(k => {
      if (!base[k].menuPermissions) {
        base[k] = { menuPermissions: base[k], actionPermissions: {} }
      }
    })
    base['Junior Staff'] = {
      menuPermissions: { dashboard: 'view' },
      actionPermissions: JUNIOR_STAFF_PERMS
    }
    base['Manager'] = {
      menuPermissions: {
        dashboard: 'full',
        vendorManagement: 'approve',
        productManagement: 'approve',
        createCatalogue: 'approve'
      },
      actionPermissions: MANAGER_PERMS
    }
    base['Super Admin'] = {
      menuPermissions: {
        dashboard: 'full',
        financeDesk: 'full',
        cashBankManager: 'full',
        rpnPaymentsLedger: 'full',
        financeReports: 'full'
      },
      actionPermissions: SUPER_ADMIN_PERMS
    }
    return base
  })
  const [editedRoleName, setEditedRoleName] = useState('')
  const [passcodeModalConfig, setPasscodeModalConfig] = useState<{
    staff: Staff
    isOverride: boolean
  } | null>(null)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    message: string
    action: () => void
    variant: 'danger' | 'warning' | 'success'
  } | null>(null)

  const [duplicateScanResult, setDuplicateScanResult] = useState<
    { staffCode: string; records: Staff[] }[]
  >([])
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false)
  const [isRepairingDuplicates, setIsRepairingDuplicates] = useState(false)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
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

  const canRepairDuplicates =
    permissionService.isSysAdmin() ||
    JSON.parse(localStorage.getItem('activeStaffSession') || '{}')
      .actionPermissions?.['staff.repairDuplicateCodes'] ||
    JSON.parse(localStorage.getItem('activeStaffSession') || '{}').role ===
      'Super Admin'

  const closeAllModals = useCallback(() => {
    setIsConfirmOpen(false)
    setIsPasscodeModalOpen(false)
    setIsApplyRoleModalOpen(false)
    setConfirmConfig(null)
    setIsDeleteModalOpen(false)
    setStaffToDelete(null)
    setDeleteReason('')
    setPasscodeModalConfig(null)
    setApplyRoleConfig(null)
    setTempPasscode('')
    setConfirmTempPasscode('')
    setFormError('')
    setFormSuccess('')
  }, [])

  const loadStaff = async () => {
    setIsLoadingData(true)
    const startMs = performance.now()
    try {
      const serviceWithFirebase = staffService as typeof staffService & {
        loadStaffFromFirebase?: () => Promise<Staff[]>
      }

      const staff =
        typeof serviceWithFirebase.loadStaffFromFirebase === 'function'
          ? await serviceWithFirebase.loadStaffFromFirebase()
          : staffService.getAllStaff()

      setStaffList(asArray<Staff>(staff))
    } catch (error) {
      console.error(
        'Failed to load staff from Firebase. Falling back local.',
        error
      )
      setStaffList(asArray<Staff>(staffService.getAllStaff()))
    } finally {
      setIsLoadingData(false)
      console.info('Data load completed', {
        page: 'StaffManagement',
        elapsedMs: Math.round(performance.now() - startMs)
      })
    }
  }

  const loadLogs = async () => {
    setAllLogs(
      asArray<ActivityLog>(await Promise.resolve(analyticsService.getEvents()))
    )
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllModals()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeAllModals])

  useEffect(() => {
    if (location.pathname === '/role-menu-permissions') {
      setActiveTab('roles')
    } else if (location.pathname === '/staff-access-logs') {
      setActiveTab('logs')
    } else if (location.pathname === '/system-settings') {
      setActiveTab('settings')
    } else {
      setActiveTab('directory')
    }
  }, [location.pathname])

  useEffect(() => {
    loadStaff()
    loadLogs()
  }, [])

  const staffRegistryRows = useMemo(
    () => asArray<Staff>(staffList),
    [staffList]
  )

  const staffStatusOptions = useMemo(() => {
    const requested = [
      'active',
      'suspended',
      'locked',
      'inactive',
      'archived',
      'pending_invite'
    ]
    const existing = staffRegistryRows.map(staff =>
      String(staff.status || '').toLowerCase()
    )
    return Array.from(new Set([...requested, ...existing])).filter(Boolean)
  }, [staffRegistryRows])

  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set(staffRegistryRows.map(staff => staff.role).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [staffRegistryRows]
  )

  const branchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          staffRegistryRows.map(staff => staff.assignedBranchId).filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [staffRegistryRows]
  )

  const isRecentlyUpdated = (staff: Staff) => {
    const updatedAt = staff.updatedAt || staff.createdAt
    if (!updatedAt) return false
    const updatedTime = new Date(updatedAt).getTime()
    return (
      Number.isFinite(updatedTime) &&
      Date.now() - updatedTime <= 1000 * 60 * 60 * 24 * 14
    )
  }

  const getOperationalStates = (staff: Staff) => {
    const status = String(staff.status || '').toLowerCase()
    return {
      canLogin: status === 'active' && !staff.isLocked,
      suspended: status === 'suspended',
      requiresPasswordReset:
        status === 'passcode_reset_required' || !!staff.mustChangePasscode,
      inactive:
        status === 'inactive' ||
        status === 'archived' ||
        status === 'archived_deleted' ||
        status === 'deleted' ||
        status === 'pending_delete',
      invitationPending: status === 'pending_invite' || status === 'invited',
      approvalPending: status === 'pending_approval' || status === 'pending'
    }
  }

  const staffFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: staffRegistryRows.length,
      active_staff: 0,
      locked_accounts: 0,
      pending_invites: 0,
      recently_updated: 0
    }

    staffRegistryRows.forEach(staff => {
      const status = String(staff.status || '').toLowerCase()
      counts[status] = (counts[status] || 0) + 1
      if (status === 'active') counts.active_staff += 1
      if (staff.isLocked || status === 'locked') counts.locked_accounts += 1
      if (status === 'pending_invite' || status === 'invited')
        counts.pending_invites += 1
      if (isRecentlyUpdated(staff)) counts.recently_updated += 1
    })

    return counts
  }, [staffRegistryRows])

  const filteredStaff = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return staffRegistryRows.filter(staff => {
      const status = String(staff.status || '').toLowerCase()
      const searchable = [
        staff.fullName,
        staff.displayName,
        staff.email,
        staff.staffCode,
        staff.phone,
        staff.whatsapp
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const states = getOperationalStates(staff)

      const matchesSearch =
        normalizedSearch === '' || searchable.includes(normalizedSearch)
      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter ||
        (statusFilter === 'locked' && (staff.isLocked || status === 'locked'))
      const matchesDesk = deskFilter === 'all' || staff.desk === deskFilter
      const matchesRole = roleFilter === 'all' || staff.role === roleFilter
      const matchesBranch =
        branchFilter === 'all' || staff.assignedBranchId === branchFilter
      const matchesActionState =
        actionStateFilter === 'all' ||
        (actionStateFilter === 'can_login' && states.canLogin) ||
        (actionStateFilter === 'suspended' && states.suspended) ||
        (actionStateFilter === 'requires_password_reset' &&
          states.requiresPasswordReset) ||
        (actionStateFilter === 'inactive' && states.inactive) ||
        (actionStateFilter === 'invitation_pending' &&
          states.invitationPending) ||
        (actionStateFilter === 'approval_pending' && states.approvalPending)
      const matchesQuick =
        quickFilter === 'all' ||
        (quickFilter === 'active_staff' && status === 'active') ||
        (quickFilter === 'locked_accounts' &&
          (staff.isLocked || status === 'locked')) ||
        (quickFilter === 'pending_invites' &&
          (status === 'pending_invite' || status === 'invited')) ||
        (quickFilter === 'recently_updated' && isRecentlyUpdated(staff))

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDesk &&
        matchesRole &&
        matchesBranch &&
        matchesActionState &&
        matchesQuick
      )
    })
  }, [
    actionStateFilter,
    branchFilter,
    deskFilter,
    quickFilter,
    roleFilter,
    search,
    staffRegistryRows,
    statusFilter
  ])

  const staffLogs = useMemo(() => {
    const safeAllLogs = asArray<ActivityLog>(allLogs)

    return safeAllLogs
      .filter(log => {
        const isStaffEvent =
          log.eventType?.startsWith('STAFF_') ||
          log.eventType === 'ACCESS_DENIED'

        if (!isStaffEvent) return false

        const staffId = log.actorId || log.details?.staffId
        const matchesStaff = filterStaff === 'all' || staffId === filterStaff
        const matchesEvent =
          filterEventType === 'all' || log.eventType === filterEventType
        const matchesResult =
          filterResult === 'all' || log.result === filterResult

        const searchBlob = `${log.actorName} ${log.eventType} ${JSON.stringify(
          log.details
        )}`.toLowerCase()

        const matchesSearch =
          logSearch === '' || searchBlob.includes(logSearch.toLowerCase())

        const logDate = log.timestamp?.split('T')[0] || ''
        const matchesDateFrom = !dateFrom || logDate >= dateFrom
        const matchesDateTo = !dateTo || logDate <= dateTo

        return (
          matchesStaff &&
          matchesEvent &&
          matchesResult &&
          matchesSearch &&
          matchesDateFrom &&
          matchesDateTo
        )
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
  }, [
    allLogs,
    filterStaff,
    filterEventType,
    filterResult,
    logSearch,
    dateFrom,
    dateTo
  ])

  const duplicates = useMemo(() => {
    if (!formData.staffCode && !formData.email) return []

    const isSameStaff = (
      s: Staff,
      targetId?: string,
      targetDocId?: string,
      targetCode?: string,
      targetEmail?: string
    ) => {
      if (!targetId) return false
      if (s.id === targetId) return true
      const sDocId = (s as any).docId
      if (sDocId && sDocId === targetId) return true
      if (s.firestoreDocId && s.firestoreDocId === targetId) return true
      if (targetDocId && s.id === targetDocId) return true
      if (
        s.email &&
        targetEmail &&
        s.email.toLowerCase() === targetEmail.toLowerCase() &&
        s.staffCode === targetCode
      )
        return true
      return false
    }

    return staffList.filter(s => {
      // Do not flag the currently edited staff member as a duplicate of themselves
      if (
        selectedStaff &&
        isSameStaff(
          s,
          selectedStaff.id,
          selectedStaff.firestoreDocId,
          selectedStaff.staffCode,
          selectedStaff.email
        )
      )
        return false
      if (
        !selectedStaff &&
        isSameStaff(
          s,
          formData.id,
          formData.firestoreDocId,
          formData.staffCode,
          formData.email
        )
      )
        return false

      const sameCode =
        !!formData.staffCode && s.staffCode === formData.staffCode
      const sameEmail =
        !!formData.email &&
        !!s.email &&
        s.email.toLowerCase() === formData.email.toLowerCase() &&
        s.status === 'active'
      return sameCode || sameEmail
    })
  }, [
    formData.staffCode,
    formData.email,
    formData.id,
    formData.firestoreDocId,
    selectedStaff,
    staffList
  ])

  const hasDuplicateCode = duplicates.some(
    s => s.staffCode === formData.staffCode
  )

  const handleScanDuplicates = async () => {
    setIsScanningDuplicates(true)
    try {
      const dups = await staffService.findDuplicateStaffCodes()
      setDuplicateScanResult(dups)
      if (dups.length === 0) {
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: 'No duplicate staff codes found.',
          type: 'info'
        })
      }
    } catch (e) {
      console.error(e)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Failed to scan duplicates.',
        type: 'error'
      })
    } finally {
      setIsScanningDuplicates(false)
    }
  }

  const handleRepairDuplicates = async () => {
    if (
      !confirm(
        'Are you sure you want to repair duplicate staff codes? Original records will be kept and duplicates will be renumbered.'
      )
    ) {
      return
    }

    setIsRepairingDuplicates(true)
    try {
      const { totalRepaired } = await staffService.repairDuplicateStaffCodes()

      void staffAuditService.logAction({
        eventType: 'RECORD_UPDATED',
        module: 'staff',
        severity: 'critical',
        action: 'Repaired duplicate staff codes'
      })

      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: `Repaired ${totalRepaired} duplicate staff records.`,
        type: 'success'
      })
      setDuplicateScanResult([])
      void loadStaff()
    } catch (e: any) {
      console.error(e)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: e.message || 'Failed to repair duplicates.',
        type: 'error'
      })
    } finally {
      setIsRepairingDuplicates(false)
    }
  }

  const handleAddStaff = async () => {
    let staffCode = ''
    try {
      staffCode = await staffService.generateUniqueStaffCodeFromFirebase()
    } catch (e) {
      staffCode = staffService.generateStaffCode()
    }

    setFormData({
      id: staffCode,
      staffCode,
      fullName: '',
      displayName: '',
      status: 'active',
      role: 'Backoffice Operator',
      desk: 'Backoffice Desk',
      menuPermissions:
        localRoleTemplates['Backoffice Operator']?.menuPermissions || {},
      actionPermissions:
        localRoleTemplates['Backoffice Operator']?.actionPermissions || {},
      mustChangePasscode: true,
      passcode: '',
      failedAttemptCount: 0,
      isLocked: false,
      personalDetails: {},
      addressDetails: {},
      kycDetails: { kycStatus: 'not_started' },
      kycDocuments: {},
      createdAt: new Date().toISOString(),
      createdBy: 'SysAdmin'
    })

    setTempPasscode('')
    setConfirmTempPasscode('')
    setSelectedStaff(null)
    setFormError('')
    setFormSuccess('')
    setView('form')
    focusMainContent()
  }

  const saveStaff = async () => {
    setFormError('')
    setFormSuccess('')

    if (
      !formData.fullName ||
      !formData.displayName ||
      !formData.role ||
      !formData.desk
    ) {
      setFormError(
        'Please fill in all required fields: Full Name, Display Name, Role, and Desk.'
      )
      return
    }

    if (
      formData.personalDetails?.nationalId &&
      formData.personalDetails.nationalId.trim().length > 0 &&
      formData.personalDetails.nationalId.trim().length < 5
    ) {
      setFormError('National ID must be at least 5 characters.')
      return
    }

    if (!selectedStaff && (!tempPasscode || tempPasscode.length !== 6)) {
      setFormError('Please set a 6-digit passcode for new staff members.')
      return
    }

    if (!selectedStaff && tempPasscode !== formData.passcode) {
      setFormError('Passcode confirmation does not match.')
      return
    }

    if (selectedStaff && formData.passcode && formData.passcode.length !== 6) {
      setFormError('Passcode must be 6 digits.')
      return
    }

    const defaultPermissions =
      localRoleTemplates[formData.role as string]?.menuPermissions ||
      localRoleTemplates['Viewer']?.menuPermissions ||
      {}
    const defaultActions =
      localRoleTemplates[formData.role as string]?.actionPermissions || {}

    const now = new Date().toISOString()

    let finalStaffCode = selectedStaff
      ? formData.staffCode || selectedStaff.staffCode
      : formData.staffCode

    if (!selectedStaff && !finalStaffCode) {
      try {
        finalStaffCode =
          await staffService.generateUniqueStaffCodeFromFirebase()
      } catch (e) {
        finalStaffCode = staffService.generateStaffCode()
      }
    }

    const staffId = selectedStaff
      ? selectedStaff.id
      : formData.id || finalStaffCode || `STF-${Date.now()}`

    const staffToSave: Staff = stripUndefinedDeep({
      ...(formData as Staff),
      id: staffId,
      staffCode: finalStaffCode as string,
      menuPermissions: !selectedStaff
        ? defaultPermissions
        : formData.menuPermissions || defaultPermissions,
      actionPermissions: !selectedStaff
        ? defaultActions
        : formData.actionPermissions || defaultActions,
      failedAttemptCount: !selectedStaff
        ? 0
        : formData.failedAttemptCount || selectedStaff.failedAttemptCount || 0,
      isLocked: !selectedStaff
        ? false
        : formData.isLocked || selectedStaff.isLocked || false,
      passcode: selectedStaff
        ? formData.passcode || selectedStaff.passcode
        : tempPasscode,
      updatedAt: now,
      createdAt: formData.createdAt || selectedStaff?.createdAt || now,
      updatedBy: 'SysAdmin'
    })

    try {
      await staffService.saveStaff(staffToSave)

      analyticsService.logEvent({
        eventType: selectedStaff ? 'STAFF_UPDATED' : 'STAFF_CREATED',
        actorType: 'admin',
        actorName: 'SysAdmin',
        actorId: staffToSave.id,
        result: 'updated',
        details: {
          staffId: staffToSave.id,
          staffCode: staffToSave.staffCode,
          fullName: staffToSave.fullName,
          role: staffToSave.role,
          desk: staffToSave.desk
        }
      })

      if (selectedStaff) {
        const oldStaff = selectedStaff
        const oldKycStatus = oldStaff.kycDetails?.kycStatus
        const newKycStatus = staffToSave.kycDetails?.kycStatus

        if (oldKycStatus !== newKycStatus) {
          void staffAuditService.logAction({
            eventType: 'RECORD_UPDATED',
            module: 'staff',
            severity: 'critical',
            action: 'Updated staff KYC status',
            recordType: 'staff',
            recordId: staffToSave.id,
            recordName: staffToSave.displayName || staffToSave.fullName,
            beforeSnapshot: oldStaff,
            afterSnapshot: staffToSave
          })
        }

        const pChanged =
          JSON.stringify(oldStaff.personalDetails || {}) !==
          JSON.stringify(staffToSave.personalDetails || {})
        const aChanged =
          JSON.stringify(oldStaff.addressDetails || {}) !==
          JSON.stringify(staffToSave.addressDetails || {})
        const kChanged =
          JSON.stringify(oldStaff.kycDetails || {}) !==
          JSON.stringify(staffToSave.kycDetails || {})
        const dChanged =
          JSON.stringify(oldStaff.kycDocuments || {}) !==
          JSON.stringify(staffToSave.kycDocuments || {})

        if (pChanged || aChanged || kChanged || dChanged) {
          void staffAuditService.logAction({
            eventType: 'RECORD_UPDATED',
            module: 'staff',
            severity: 'high',
            action: 'Updated staff Personal, Address & KYC Details',
            recordType: 'staff',
            recordId: staffToSave.id,
            recordName: staffToSave.displayName || staffToSave.fullName,
            beforeSnapshot: oldStaff,
            afterSnapshot: staffToSave
          })
        }
      }

      setStaffList(asArray<Staff>(staffService.getAllStaff()))
      await loadStaff()
      await loadLogs()

      window.setTimeout(() => {
        void loadStaff()
      }, 800)

      setTempPasscode('')
      setConfirmTempPasscode('')
      setSelectedStaff(null)
      setFormData({})
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Staff saved successfully.',
        type: 'success'
      })
      setView('list')
      focusMainContent()
    } catch (error: any) {
      console.error('Failed to save staff', error)
      if (
        error.message &&
        error.message.includes('already exists on another staff record')
      ) {
        void staffAuditService.logAction({
          eventType: 'ACCESS_DENIED',
          module: 'staff',
          severity: 'high',
          action: 'Blocked duplicate staff code save'
        })
        setFormError(error.message)
      } else if (error.message && error.message.includes('Duplicate')) {
        void staffAuditService.logAction({
          eventType: 'ACCESS_DENIED',
          module: 'staff',
          severity: 'high',
          action: 'Blocked duplicate staff code/email save'
        })
        setFormError(error.message)
      }

      showBrandedAlert({
        title: 'seiGEN Commerce',
        message:
          error instanceof Error ? error.message : 'Failed to save staff.',
        type: 'error'
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const triggerAction = (staff: Staff, type: string) => {
    const activeSessionStr = localStorage.getItem('activeStaffSession')
    const activeSession = activeSessionStr ? JSON.parse(activeSessionStr) : null

    if (type === 'suspend' || type === 'archive') {
      if (activeSession && activeSession.staffId === staff.id) {
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: 'You cannot suspend or archive your own active session.',
          type: 'warning'
        })
        return
      }
      if (staffService.isLastActiveSysAdmin(staff.id)) {
        showBrandedAlert({
          title: 'seiGEN Commerce',
          message: 'At least one active SysAdmin must remain in the system.',
          type: 'warning'
        })
        return
      }
    }

    const configs: Record<string, any> = {
      suspend: {
        title: 'Suspend Staff?',
        variant: 'danger',
        status: 'suspended',
        eventType: 'STAFF_SUSPENDED'
      },
      reactivate: {
        title: 'Reactivate Staff?',
        variant: 'success',
        status: 'active',
        eventType: 'STAFF_REACTIVATED'
      },
      archive: {
        title: 'Archive Staff?',
        variant: 'danger',
        status: 'archived',
        eventType: 'STAFF_ARCHIVED'
      },
      lock: {
        title: 'Lock Profile?',
        variant: 'danger',
        status: 'locked',
        isLocked: true,
        eventType: 'STAFF_LOCKED'
      },
      unlock: {
        title: 'Unlock Profile?',
        variant: 'success',
        status: 'active',
        isLocked: false,
        failedAttemptCount: 0,
        eventType: 'STAFF_UNLOCKED'
      },
      resetPasscode: {
        title: 'Reset Passcode?',
        variant: 'warning',
        status: 'passcode_reset_required',
        mustChangePasscode: true,
        isLocked: false,
        failedAttemptCount: 0,
        eventType: 'STAFF_PASSCODE_RESET'
      },
      overridePasscode: {
        title: 'Override Passcode?',
        variant: 'danger',
        status: 'active',
        mustChangePasscode: false,
        isLocked: false,
        failedAttemptCount: 0,
        eventType: 'STAFF_PASSCODE_OVERRIDDEN'
      }
    }

    const cfg = configs[type]

    setConfirmConfig({
      title: cfg.title,
      message: `Confirm change for ${staff.displayName}.`,
      variant: cfg.variant,
      action: async () => {
        try {
          await staffService.saveStaff({
            ...staff,
            status: cfg.status || staff.status,
            isLocked:
              cfg.isLocked !== undefined ? cfg.isLocked : staff.isLocked,
            failedAttemptCount:
              cfg.failedAttemptCount !== undefined
                ? cfg.failedAttemptCount
                : staff.failedAttemptCount,
            mustChangePasscode:
              cfg.mustChangePasscode !== undefined
                ? cfg.mustChangePasscode
                : staff.mustChangePasscode,
            updatedAt: new Date().toISOString(),
            updatedBy: 'SysAdmin'
          })

          analyticsService.logEvent({
            eventType: cfg.eventType || `STAFF_${type.toUpperCase()}`,
            actorType: 'admin',
            actorName: 'SysAdmin',
            actorId: staff.id,
            result: 'updated',
            details: {
              staffId: staff.id,
              staffCode: staff.staffCode,
              action: type
            }
          })

          setStaffList(asArray<Staff>(staffService.getAllStaff()))

          window.setTimeout(() => {
            void loadStaff()
            void loadLogs()
          }, 800)

          showBrandedAlert({
            title: 'seiGEN Commerce',
            message: 'Staff saved successfully.',
            type: 'success'
          })
        } catch (error: any) {
          console.error(error)
          showBrandedAlert({
            title: 'seiGEN Commerce',
            message: error.message || 'Failed to save staff.',
            type: 'error'
          })
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    })

    setIsConfirmOpen(true)
  }

  const handlePasscodeAction = async (
    staff: Staff,
    newPasscode: string,
    isOverride: boolean
  ) => {
    if (newPasscode.length !== 6 || !/^\d{6}$/.test(newPasscode)) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Passcode must be exactly 6 digits.',
        type: 'warning'
      })
      return
    }

    try {
      await staffService.saveStaff({
        ...staff,
        passcode: newPasscode,
        mustChangePasscode: !isOverride,
        status: isOverride ? 'active' : 'passcode_reset_required',
        failedAttemptCount: 0,
        isLocked: false,
        updatedAt: new Date().toISOString(),
        updatedBy: 'SysAdmin'
      })

      analyticsService.logEvent({
        eventType: isOverride
          ? 'STAFF_PASSCODE_OVERRIDDEN'
          : 'STAFF_PASSCODE_RESET',
        actorType: 'admin',
        actorName: 'SysAdmin',
        actorId: staff.id,
        result: 'updated',
        details: {
          staffId: staff.id,
          staffCode: staff.staffCode
        }
      })

      setStaffList(asArray<Staff>(staffService.getAllStaff()))

      window.setTimeout(() => {
        void loadStaff()
        void loadLogs()
      }, 800)

      setTempPasscode('')
      setConfirmTempPasscode('')
      setIsPasscodeModalOpen(false)

      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'Staff saved successfully.',
        type: 'success'
      })
    } catch (error: any) {
      console.error(error)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: error.message || 'Failed to save staff.',
        type: 'error'
      })
    }
  }

  const openStaffLogs = (staff: Staff) => {
    setFilterStaff(staff.id)
    setActiveTab('logs')
    setView('list')
    focusMainContent()
  }

  const requestOrDeleteStaff = async () => {
    if (!staffToDelete) return
    if (!deleteReason.trim()) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'A delete/archive reason is required.',
        type: 'warning'
      })
      return
    }
    if (staffService.isLastActiveSysAdmin(staffToDelete.id)) {
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: 'At least one active SysAdmin must remain in the system.',
        type: 'warning'
      })
      return
    }

    try {
      const reason = deleteReason.trim()
      if (permissionService.isSysAdmin()) {
        staffService.deleteStaff(staffToDelete.id)
        await staffAuditService.logAction({
          eventType: 'RECORD_DELETED',
          module: 'staff',
          severity: 'high',
          action: 'Permanently deleted staff record',
          recordType: 'staff',
          recordId: staffToDelete.id,
          recordName: staffToDelete.displayName || staffToDelete.fullName,
          beforeSnapshot: staffToDelete,
          afterSnapshot: { reason }
        })
        analyticsService.logEvent({
          eventType: 'STAFF_DELETED' as any,
          actorType: 'admin',
          actorName: 'SysAdmin',
          result: 'deleted',
          details: {
            staffId: staffToDelete.id,
            staffCode: staffToDelete.staffCode,
            reason
          }
        })
      } else {
        await staffService.saveStaff({
          ...staffToDelete,
          status: 'archived',
          deleteRequestedAt: new Date().toISOString(),
          deleteRequestReason: reason,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Delete request'
        } as Staff)
        analyticsService.logEvent({
          eventType: 'STAFF_DELETE_REQUESTED' as any,
          actorType: 'admin',
          actorName: 'Staff Management',
          result: 'submitted',
          details: {
            staffId: staffToDelete.id,
            staffCode: staffToDelete.staffCode,
            reason
          }
        })
      }

      setStaffToDelete(null)
      setDeleteReason('')
      setIsDeleteModalOpen(false)
      setStaffList(asArray<Staff>(staffService.getAllStaff()))
      window.setTimeout(() => {
        void loadStaff()
        void loadLogs()
      }, 800)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: permissionService.isSysAdmin()
          ? 'Staff record deleted.'
          : 'Delete request captured and staff archived pending review.',
        type: 'success'
      })
    } catch (error: any) {
      console.error(error)
      showBrandedAlert({
        title: 'seiGEN Commerce',
        message: error.message || 'Failed to process staff delete request.',
        type: 'error'
      })
    }
  }

  const exportLogsJSON = () => {
    const data = JSON.stringify(staffLogs, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `staff_access_logs_${new Date().toISOString()}.json`
    a.click()

    URL.revokeObjectURL(url)
  }

  const exportLogsPDF = () => {
    pdfService.generateStaffAccessReport({
      logs: staffLogs,
      staffList,
      dateFrom,
      dateTo,
      filters: {
        staff:
          filterStaff !== 'all'
            ? staffList.find(s => s.id === filterStaff)?.fullName || 'Selected'
            : 'All',
        eventType: filterEventType !== 'all' ? filterEventType : 'All',
        result: filterResult !== 'all' ? filterResult : 'All'
      }
    })
  }

  const handlePermissionChange = (menuKey: MenuKey, level: PermissionLevel) => {
    setFormData(prev => ({
      ...prev,
      menuPermissions: {
        ...prev?.menuPermissions,
        [menuKey]: level
      }
    }))
  }

  const handleActionPermissionChange = (
    key: ActionPermissionKey,
    level: boolean
  ) => {
    setFormData(prev => ({
      ...prev,
      actionPermissions: {
        ...prev?.actionPermissions,
        [key]: level
      }
    }))
  }

  const currentStaffForPermissions = permissionService.getCurrentStaff()
  const selectedRoleName = (selectedStaff?.role || editedRoleName || '').trim()
  const canEditSelectedRole =
    !selectedRoleName ||
    permissionService.canEditRolePermissions(
      currentStaffForPermissions,
      selectedRoleName
    )
  const canEditSelectedStaffPermissions =
    !!selectedStaff &&
    permissionService.canEditStaffPermissions(
      currentStaffForPermissions,
      selectedStaff
    )
  const isSysAdminEditingOwnAccount =
    !!selectedStaff &&
    (selectedStaff.id === currentStaffForPermissions?.id ||
      selectedStaff.staffCode === currentStaffForPermissions?.staffCode) &&
    (selectedStaff.role === 'SysAdmin' ||
      selectedStaff.role === 'Super Admin' ||
      selectedStaff.role === 'SuperAdmin')

  if (isLoadingData) {
    return (
      <div className='pb-20 min-w-0 max-w-full flex items-center justify-center pt-20'>
        <div className='text-center text-stone-400'>
          <Loader2 className='w-8 h-8 animate-spin mx-auto mb-4' />
          <p className='text-xs font-bold uppercase tracking-widest'>
            Loading Staff Directory...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-8 pb-20'>
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <div
        className='flex bg-stone-100 p-1 rounded-none w-fit'
        id='staff-management-header'
        tabIndex={-1}
      >
        {['directory', 'roles', 'logs', 'settings'].map(tab => {
          if (
            tab === 'roles' &&
            !permissionService.hasMenuAccess('roleMenuPermissions')
          )
            return null
          if (
            tab === 'logs' &&
            !permissionService.hasMenuAccess('staffAccessLogs')
          )
            return null
          if (
            tab === 'settings' &&
            !permissionService.hasMenuAccess('systemSettings')
          )
            return null
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab as any)
                setView('list')
              }}
              className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest ${
                activeTab === tab
                  ? 'bg-white text-brand-orange shadow-sm'
                  : 'text-stone-400'
              }`}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {activeTab === 'roles' &&
        permissionService.canViewRolePermissions() &&
        view === 'list' && (
          <div className='space-y-6'>
            {!permissionService.canEditRolePermissions() && (
              <div className='p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm'>
                You can view role permissions, but you do not have authority to
                edit them.
              </div>
            )}
            <DataPanel
              title='Role Templates'
              actions={
                permissionService.canCreateRoleTemplate() && (
                  <PrimaryButton
                    onClick={() => {
                      setEditedRoleName('New Custom Role')
                      setFormData({ menuPermissions: {} })
                      setSelectedStaff({ role: 'New Custom Role' } as any)
                      setView('roleEdit')
                      focusMainContent()
                    }}
                    className='text-xs px-3 py-1 flex items-center gap-1'
                  >
                    <Plus size={14} /> New Template
                  </PrimaryButton>
                )
              }
            >
              <div className='space-y-4'>
                {Object.keys(localRoleTemplates).map(role => {
                  const canEditRole = permissionService.canEditRolePermissions(
                    currentStaffForPermissions,
                    role
                  )
                  return (
                    <div
                      key={role}
                      className='border border-stone-200 rounded-none p-4'
                    >
                      <div className='flex justify-between items-start mb-4'>
                        <div>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='font-semibold text-stone-800'>
                              {role}
                            </h3>
                            <span
                              className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                                canEditRole
                                  ? 'border-orange-200 bg-orange-50 text-brand-orange'
                                  : 'border-stone-200 bg-stone-50 text-stone-500'
                              }`}
                            >
                              {canEditRole
                                ? permissionService.canEditRolePermissions(
                                    currentStaffForPermissions,
                                    'Admin'
                                  ) && role !== 'SysAdmin'
                                  ? 'Editable by SysAdmin'
                                  : 'Editable'
                                : 'Read only'}
                            </span>
                          </div>
                          <p className='text-sm text-stone-600'>
                            {role === 'SysAdmin' || role === 'Admin'
                              ? 'Full system access'
                              : role === 'Backoffice Operator'
                              ? 'General operational tasks'
                              : role === 'Product Data Clerk'
                              ? 'Product data management'
                              : role === 'Catalogue Officer'
                              ? 'Catalogue creation and deployment'
                              : role === 'Collections Officer'
                              ? 'Subscription and collections management'
                              : role === 'RPN Manager'
                              ? 'RPN network management'
                              : role === 'CAH Officer'
                              ? 'Commerce Access Hub operations'
                              : role === 'BI Analyst'
                              ? 'Business intelligence and analytics'
                              : 'Read-only access'}
                          </p>
                        </div>

                        <div className='flex gap-2'>
                          {permissionService.canAssignRoleToStaff() && (
                            <PrimaryButton
                              onClick={() => {
                                setApplyRoleConfig({ role })
                                setIsApplyRoleModalOpen(true)
                              }}
                              className='text-xs px-3 py-1'
                            >
                              Apply to Staff
                            </PrimaryButton>
                          )}

                          <SecondaryButton
                            onClick={() => {
                              setFormData({
                                menuPermissions: {
                                  ...localRoleTemplates[role].menuPermissions
                                },
                                actionPermissions: {
                                  ...localRoleTemplates[role].actionPermissions
                                }
                              })
                              setSelectedStaff({ role } as any)
                              setEditedRoleName(role)
                              setView('roleEdit')
                              focusMainContent()
                            }}
                            className='text-xs px-3 py-1'
                          >
                            {canEditRole
                              ? 'Edit Permissions'
                              : 'View Permissions'}
                          </SecondaryButton>
                        </div>
                      </div>
                      <div className='grid grid-cols-2 md:grid-cols-4 gap-2 text-xs'>
                        {Object.entries(
                          localRoleTemplates[role].menuPermissions || {}
                        ).map(([key, level]) => (
                          <div key={key} className='flex justify-between'>
                            <span className='text-stone-600'>
                              {PERMISSIONS.find(p => p.id === key)?.label ||
                                key}
                              :
                            </span>
                            <span
                              className={`font-medium ${
                                level === 'full'
                                  ? 'text-green-600'
                                  : level === 'hidden'
                                  ? 'text-red-600'
                                  : 'text-blue-600'
                              }`}
                            >
                              {level}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </DataPanel>
          </div>
        )}

      {activeTab === 'roles' &&
        permissionService.canViewRolePermissions() &&
        view === 'roleEdit' &&
        selectedStaff?.role && (
          <div className='space-y-8'>
            <div className='flex justify-between items-center bg-stone-900 text-white p-6'>
              <h3 className='text-sm font-bold uppercase tracking-widest'>
                {canEditSelectedRole
                  ? 'Edit Role Template'
                  : 'View Role Template'}{' '}
                - {editedRoleName || selectedStaff.role}
              </h3>

              <div className='flex gap-3'>
                <SecondaryButton className='text-white border-white/20'>
                  Cancel
                </SecondaryButton>

                {canEditSelectedRole && (
                  <>
                    <SecondaryButton
                      onClick={() => {
                        const resetPerms =
                          ROLE_TEMPLATES[selectedStaff.role as string] || {}
                        setFormData(prev => ({
                          ...prev,
                          menuPermissions: { ...resetPerms.menuPermissions },
                          actionPermissions: {
                            ...resetPerms.actionPermissions
                          }
                        }))
                      }}
                      className='text-stone-300 border-stone-600 hover:text-white'
                    >
                      Reset to Default
                    </SecondaryButton>

                    <PrimaryButton
                      onClick={() => {
                        if (!canEditSelectedRole) {
                          showBrandedAlert({
                            title: 'seiGEN Commerce',
                            message:
                              'You do not have permission to edit role permissions.',
                            type: 'error'
                          })
                          return
                        }
                        const updatedRole = selectedStaff.role as string
                        const newRole = editedRoleName.trim() || updatedRole
                        if (
                          !window.confirm(
                            'You are about to change permissions for this role. This may affect staff access.'
                          )
                        ) {
                          return
                        }

                        const beforeTemplate =
                          localRoleTemplates[updatedRole] || {}
                        const grantablePermissions =
                          permissionService.filterGrantablePermissions(
                            currentStaffForPermissions,
                            formData.menuPermissions as MenuPermissions,
                            formData.actionPermissions || {}
                          )
                        const protectedPermissions =
                          permissionService.protectCriticalPermissions(
                            newRole,
                            grantablePermissions.menuPermissions,
                            grantablePermissions.actionPermissions
                          )
                        const newTemplates = {
                          ...localRoleTemplates
                        }
                        if (updatedRole !== newRole) {
                          newTemplates[newRole] = {
                            menuPermissions:
                              protectedPermissions.menuPermissions,
                            actionPermissions:
                              protectedPermissions.actionPermissions
                          }
                          delete newTemplates[updatedRole]
                        } else {
                          newTemplates[updatedRole] = {
                            menuPermissions:
                              protectedPermissions.menuPermissions,
                            actionPermissions:
                              protectedPermissions.actionPermissions
                          }
                        }

                        staffService.saveRoleTemplates(newTemplates)
                        setLocalRoleTemplates(newTemplates)

                        analyticsService.logEvent({
                          eventType: 'ROLE_TEMPLATE_UPDATED',
                          actorType: 'admin',
                          actorName: 'SysAdmin',
                          result: 'updated',
                          details: { role: updatedRole }
                        })

                        // Non-blocking staff audit logging
                        try {
                          void staffAuditService.logAction({
                            eventType: 'PERMISSION_CHANGED',
                            module: 'roles',
                            action: 'Updated role permissions',
                            severity: 'critical',
                            recordType: 'role_template',
                            recordName: newRole,
                            recordId: newRole,
                            staffId:
                              currentStaffForPermissions?.id ||
                              currentStaffForPermissions?.staffCode,
                            staffName:
                              currentStaffForPermissions?.displayName ||
                              currentStaffForPermissions?.fullName ||
                              currentStaffForPermissions?.staffName,
                            beforeSnapshot: {
                              actorStaffId:
                                currentStaffForPermissions?.id ||
                                currentStaffForPermissions?.staffCode,
                              actorName:
                                currentStaffForPermissions?.displayName ||
                                currentStaffForPermissions?.fullName ||
                                currentStaffForPermissions?.staffName,
                              targetRole: newRole,
                              ...beforeTemplate
                            },
                            afterSnapshot: {
                              actorStaffId:
                                currentStaffForPermissions?.id ||
                                currentStaffForPermissions?.staffCode,
                              actorName:
                                currentStaffForPermissions?.displayName ||
                                currentStaffForPermissions?.fullName ||
                                currentStaffForPermissions?.staffName,
                              targetRole: newRole,
                              changedMenuPermissions:
                                permissionService.getChangedPermissionKeys(
                                  (beforeTemplate as any).menuPermissions || {},
                                  protectedPermissions.menuPermissions
                                ),
                              changedActionPermissions:
                                permissionService.getChangedPermissionKeys(
                                  (beforeTemplate as any).actionPermissions || {},
                                  protectedPermissions.actionPermissions
                                ),
                              ...newTemplates[newRole]
                            }
                          })
                        } catch (auditErr) {
                          console.error('Audit log failed', auditErr)
                        }

                        setView('list')
                        focusMainContent()
                      }}
                    >
                      Save Role Permissions
                    </PrimaryButton>
                  </>
                )}
              </div>
            </div>

            {!canEditSelectedRole && (
              <div className='p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm mt-4 mx-6'>
                You do not have permission to edit this role.
              </div>
            )}

            <DataPanel title='Template Identity'>
              <div className='p-6'>
                <FormField label='Role / Template Name'>
                  <input
                    type='text'
                    value={editedRoleName}
                    onChange={e => setEditedRoleName(e.target.value)}
                    className='form-input max-w-md'
                    disabled={
                      !canEditSelectedRole ||
                      selectedStaff?.role === 'SysAdmin' ||
                      selectedStaff?.role === 'Super Admin' ||
                      selectedStaff?.role === 'SuperAdmin'
                    }
                  />
                </FormField>
                {(selectedStaff?.role === 'SysAdmin' ||
                  selectedStaff?.role === 'Super Admin' ||
                  selectedStaff?.role === 'SuperAdmin') && (
                  <p className='text-xs text-stone-400 mt-2 italic'>
                    System roles cannot be renamed.
                  </p>
                )}
              </div>
            </DataPanel>

            <DataPanel title='Role Template Permissions'>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {MENU_KEYS.map(key => (
                  <div
                    key={key}
                    className='flex items-center justify-between p-3 border border-stone-200 rounded-none'
                  >
                    <span className='text-sm font-medium'>
                      {PERMISSIONS.find(p => p.id === key)?.label || key}
                    </span>

                    <select
                      value={formData.menuPermissions?.[key] || 'hidden'}
                      onChange={e =>
                        handlePermissionChange(
                          key,
                          e.target.value as PermissionLevel
                        )
                      }
                      disabled={
                        !canEditSelectedRole ||
                        selectedStaff?.role === 'SysAdmin' ||
                        selectedStaff?.role === 'Super Admin' ||
                        selectedStaff?.role === 'SuperAdmin'
                      }
                      className='text-xs border border-stone-200 rounded-none px-2 py-1'
                    >
                      <option value='hidden'>Hidden</option>
                      <option value='view'>View</option>
                      <option value='create'>Create</option>
                      <option value='submit'>Submit</option>
                      <option value='edit'>Edit</option>
                      <option value='approve'>Approve</option>
                      <option value='delete'>Delete</option>
                      <option value='export'>Export</option>
                      <option value='full'>Full</option>
                    </select>
                  </div>
                ))}
              </div>
            </DataPanel>

            <DataPanel title='Action Permissions & Approval Rights'>
              <div className='p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                {ACTION_GROUPS.map(group => (
                  <div key={group.name} className='space-y-3'>
                    <h4 className='text-xs font-bold uppercase text-brand-orange border-b border-stone-100 pb-2'>
                      {group.name}
                    </h4>
                    {group.keys.map(key => (
                      <label
                        key={key}
                        className='flex items-center gap-2 text-xs text-stone-600 cursor-pointer'
                      >
                        <input
                          type='checkbox'
                          className='accent-brand-orange'
                          checked={
                            !!formData.actionPermissions?.[
                              key as ActionPermissionKey
                            ]
                          }
                          onChange={e =>
                            handleActionPermissionChange(
                              key as ActionPermissionKey,
                              e.target.checked
                            )
                          }
                          disabled={
                            !canEditSelectedRole ||
                            selectedStaff?.role === 'SysAdmin' ||
                            selectedStaff?.role === 'Super Admin' ||
                            selectedStaff?.role === 'SuperAdmin'
                          }
                        />
                        {key.split('.')[1]}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
        )}

      {activeTab === 'directory' &&
        (view === 'list' || permissionService.isSysAdmin()) && (
          <div className='space-y-6'>
            {formSuccess && view === 'list' && (
              <div className='p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-none text-sm font-medium'>
                {formSuccess}
              </div>
            )}
            {formError && view === 'list' && (
              <div className='p-3 bg-red-50 text-red-700 border border-red-200 rounded-none text-sm font-medium'>
                {formError}
              </div>
            )}
            <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
              <SearchInput
                placeholder='Search name, email, staff code or phone...'
                value={search}
                onChange={e => setSearch(e.target.value)}
                className='w-full lg:w-96'
              />

              {permissionService.canEdit('staffManagement') && (
                <PrimaryButton onClick={handleAddStaff}>
                  <Plus size={16} className='mr-2' />
                  Add Staff
                </PrimaryButton>
              )}
            </div>

            <DataPanel title='Registry Filters'>
              <div className='space-y-4 p-4'>
                <div className='grid grid-cols-1 gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]'>
                  <select
                    value={statusFilter}
                    onChange={event => setStatusFilter(event.target.value)}
                    className='w-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange'
                  >
                    <option value='all'>
                      All statuses ({staffFilterCounts.all})
                    </option>
                    {staffStatusOptions.map(status => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, ' ')} (
                        {staffFilterCounts[status] || 0})
                      </option>
                    ))}
                  </select>
                  <select
                    value={actionStateFilter}
                    onChange={event => setActionStateFilter(event.target.value)}
                    className='w-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange'
                  >
                    <option value='all'>All action states</option>
                    <option value='can_login'>Can login</option>
                    <option value='suspended'>Suspended</option>
                    <option value='requires_password_reset'>
                      Requires password reset
                    </option>
                    <option value='inactive'>Inactive</option>
                    <option value='invitation_pending'>
                      Invitation pending
                    </option>
                    <option value='approval_pending'>Approval pending</option>
                  </select>
                  <select
                    value={deskFilter}
                    onChange={event => setDeskFilter(event.target.value)}
                    className='w-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange'
                  >
                    <option value='all'>All desks</option>
                    {DESKS.map(desk => (
                      <option key={desk} value={desk}>
                        {desk}
                      </option>
                    ))}
                  </select>
                  <select
                    value={roleFilter}
                    onChange={event => setRoleFilter(event.target.value)}
                    className='w-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange'
                  >
                    <option value='all'>All roles</option>
                    {roleOptions.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  {branchOptions.length > 0 && (
                    <select
                      value={branchFilter}
                      onChange={event => setBranchFilter(event.target.value)}
                      className='w-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange'
                    >
                      <option value='all'>All branches</option>
                      {branchOptions.map(branchId => (
                        <option key={branchId} value={branchId}>
                          {branchId}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className='flex flex-wrap gap-2'>
                  {[
                    [
                      'active_staff',
                      'Active Staff',
                      staffFilterCounts.active_staff
                    ],
                    [
                      'locked_accounts',
                      'Locked Accounts',
                      staffFilterCounts.locked_accounts
                    ],
                    [
                      'pending_invites',
                      'Pending Invites',
                      staffFilterCounts.pending_invites
                    ],
                    [
                      'recently_updated',
                      'Recently Updated',
                      staffFilterCounts.recently_updated
                    ]
                  ].map(([key, label, count]) => (
                    <button
                      key={key}
                      type='button'
                      onClick={() =>
                        setQuickFilter(current =>
                          current === key ? 'all' : String(key)
                        )
                      }
                      className={`border px-3 py-1.5 text-[10px] font-black uppercase ${
                        quickFilter === key
                          ? 'border-brand-orange bg-orange-50 text-brand-orange'
                          : 'border-stone-200 bg-white text-stone-500 hover:border-stone-400'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                  {(statusFilter !== 'all' ||
                    actionStateFilter !== 'all' ||
                    deskFilter !== 'all' ||
                    roleFilter !== 'all' ||
                    branchFilter !== 'all' ||
                    quickFilter !== 'all' ||
                    search) && (
                    <button
                      type='button'
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('all')
                        setActionStateFilter('all')
                        setDeskFilter('all')
                        setRoleFilter('all')
                        setBranchFilter('all')
                        setQuickFilter('all')
                      }}
                      className='border border-stone-200 bg-stone-50 px-3 py-1.5 text-[10px] font-black uppercase text-stone-500 hover:text-brand-charcoal'
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </DataPanel>

            {canRepairDuplicates && (
              <DataPanel title='Staff Code Integrity'>
                <div className='p-6'>
                  <div className='flex justify-between items-center mb-4'>
                    <div>
                      <p className='text-sm font-bold text-brand-charcoal'>
                        Duplicate Staff Codes
                      </p>
                      <p className='text-xs text-stone-500'>
                        Detect and repair identical staff numbers across
                        different records.
                      </p>
                    </div>
                    <div className='flex gap-2'>
                      <SecondaryButton
                        onClick={handleScanDuplicates}
                        disabled={isScanningDuplicates}
                      >
                        {isScanningDuplicates
                          ? 'Scanning...'
                          : 'Scan Duplicates'}
                      </SecondaryButton>
                      {duplicateScanResult.length > 0 && (
                        <PrimaryButton
                          onClick={handleRepairDuplicates}
                          disabled={isRepairingDuplicates}
                        >
                          {isRepairingDuplicates
                            ? 'Repairing...'
                            : 'Repair Duplicate Staff Codes'}
                        </PrimaryButton>
                      )}
                    </div>
                  </div>
                  {duplicateScanResult.length > 0 && (
                    <div className='space-y-4 mt-6'>
                      <p className='text-xs font-bold text-red-600'>
                        Found {duplicateScanResult.length} duplicate code(s).
                      </p>
                      {duplicateScanResult.map(dup => (
                        <div
                          key={dup.staffCode}
                          className='border border-red-200 bg-red-50 p-4 text-xs'
                        >
                          <p className='font-bold text-red-700 mb-2'>
                            Code: {dup.staffCode} ({dup.records.length} records)
                          </p>
                          <ul className='list-disc pl-5 space-y-1'>
                            {dup.records.map(r => (
                              <li key={r.id}>
                                {r.fullName} ({r.email || 'No email'}) - Status:{' '}
                                {r.status} (Updated:{' '}
                                {new Date(
                                  r.updatedAt || r.createdAt || 0
                                ).toLocaleDateString()}
                                )
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DataPanel>
            )}

            <DataPanel title='Staff Registry'>
              {permissionService.isSysAdmin() && (
                <div className='p-2 mb-4 bg-stone-100 border border-stone-200 text-[10px] font-mono text-stone-500'>
                  [Firebase Diagnostic] Target Collection: itred_console_staff |
                  Loaded Count: {staffList.length} | loadStaffFromFirebase
                  Exists:{' '}
                  {typeof (staffService as any).loadStaffFromFirebase ===
                  'function'
                    ? 'Yes'
                    : 'No'}
                </div>
              )}
              {filteredStaff.length === 0 ? (
                <EmptyState
                  title='No Staff Records'
                  description='No staff records found. Click Add Staff to create a staff profile.'
                  icon={Users}
                />
              ) : (
                <>
                  <div className='hidden overflow-x-auto md:block'>
                    <table className='w-full table-fixed'>
                      <thead>
                        <tr className='border-b border-stone-200'>
                          <th className='text-left py-3 px-6 font-semibold text-stone-700'>
                            ID / Code
                          </th>
                          <th className='text-left py-3 px-6 font-semibold text-stone-700'>
                            Identity
                          </th>
                          <th className='text-left py-3 px-6 font-semibold text-stone-700'>
                            Role
                          </th>
                          <th className='text-left py-3 px-6 font-semibold text-stone-700'>
                            Desk
                          </th>
                          <th className='text-left py-3 px-6 font-semibold text-stone-700'>
                            Status
                          </th>
                          <th className='text-right py-3 px-6 font-semibold text-stone-700'>
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredStaff.map(staff => (
                          <tr
                            key={staff.id}
                            className='border-b border-stone-200 hover:bg-stone-50'
                          >
                            <td className='px-6 py-4 font-mono text-sm break-all'>
                              {staff.staffCode}
                            </td>

                            <td className='px-6 py-4'>
                              <div className='min-w-0'>
                                <p className='font-medium break-words'>
                                  {staff.displayName}
                                </p>
                                <p className='text-sm text-stone-600 break-words'>
                                  {staff.fullName}
                                </p>
                                {staff.email && (
                                  <p className='text-xs text-stone-400 break-all'>
                                    {staff.email}
                                  </p>
                                )}
                              </div>
                            </td>

                            <td className='px-6 py-4 break-words'>
                              {staff.role}
                            </td>
                            <td className='px-6 py-4 break-words'>
                              {staff.desk}
                            </td>

                            <td className='px-6 py-4'>
                              <StatusBadge
                                status={staff.status}
                                variant={
                                  staff.status === 'active'
                                    ? 'success'
                                    : staff.status === 'suspended'
                                    ? 'warning'
                                    : 'error'
                                }
                              />
                            </td>

                            <td className='px-6 py-4 text-right'>
                              <div className='flex justify-end gap-2'>
                                {permissionService.canEdit(
                                  'staffManagement'
                                ) && (
                                  <button
                                    onClick={() => {
                                      setFormData(staff)
                                      setSelectedStaff(staff)
                                      setView('form')
                                      focusMainContent()
                                    }}
                                    className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100'
                                    title='Edit Staff'
                                    aria-label={`Edit staff ${staff.displayName || staff.fullName}`}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}

                                {permissionService.canEdit(
                                  'staffManagement'
                                ) && (
                                  <button
                                    onClick={() =>
                                      triggerAction(
                                        staff,
                                        staff.isLocked ? 'unlock' : 'lock'
                                      )
                                    }
                                    className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100'
                                    title={
                                      staff.isLocked
                                        ? 'Unlock Staff'
                                        : 'Lock Staff'
                                    }
                                    aria-label={`${staff.isLocked ? 'Unlock' : 'Lock'} staff ${staff.displayName || staff.fullName}`}
                                  >
                                    {staff.isLocked ? (
                                      <Unlock size={12} />
                                    ) : (
                                      <Lock size={12} />
                                    )}
                                  </button>
                                )}

                                {permissionService.canEdit(
                                  'staffManagement'
                                ) && (
                                  <button
                                    onClick={() => {
                                      setPasscodeModalConfig({
                                        staff,
                                        isOverride: false
                                      })
                                      setTempPasscode('')
                                      setConfirmTempPasscode('')
                                      setIsPasscodeModalOpen(true)
                                    }}
                                    className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100'
                                    title='Reset Passcode (Force Change)'
                                    aria-label={`Reset passcode for ${staff.displayName || staff.fullName}`}
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                )}

                                {permissionService.isSysAdmin() && (
                                  <button
                                    onClick={() => {
                                      setPasscodeModalConfig({
                                        staff,
                                        isOverride: true
                                      })
                                      setTempPasscode('')
                                      setConfirmTempPasscode('')
                                      setIsPasscodeModalOpen(true)
                                    }}
                                    className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100'
                                    title='Override Passcode'
                                    aria-label={`Override passcode for ${staff.displayName || staff.fullName}`}
                                  >
                                    <Shield size={12} />
                                  </button>
                                )}

                                {permissionService.hasActionPermission(
                                  'staff.suspend' as any
                                ) &&
                                  staff.status === 'active' && (
                                    <button
                                      onClick={() =>
                                        triggerAction(staff, 'suspend')
                                      }
                                      className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100 text-stone-400 hover:text-orange-500'
                                      title='Suspend Staff'
                                      aria-label={`Suspend staff ${staff.displayName || staff.fullName}`}
                                    >
                                      <UserX size={12} />
                                    </button>
                                  )}

                                {permissionService.hasActionPermission(
                                  'staff.reactivate' as any
                                ) &&
                                  staff.status === 'suspended' && (
                                    <button
                                      onClick={() =>
                                        triggerAction(staff, 'reactivate')
                                      }
                                      className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100 text-stone-400 hover:text-green-500'
                                      title='Reactivate Staff'
                                      aria-label={`Reactivate staff ${staff.displayName || staff.fullName}`}
                                    >
                                      <UserX size={12} />
                                    </button>
                                  )}

                                {permissionService.hasActionPermission(
                                  'staff.archive' as any
                                ) && (
                                  <button
                                    onClick={() =>
                                      triggerAction(staff, 'archive')
                                    }
                                    className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100 text-stone-400 hover:text-brand-orange'
                                    title='Archive Staff'
                                    aria-label={`Archive staff ${staff.displayName || staff.fullName}`}
                                  >
                                    <Archive size={12} />
                                  </button>
                                )}

                                {(permissionService.hasActionPermission(
                                  'staff.requestDelete' as any
                                ) ||
                                  permissionService.isSysAdmin()) && (
                                  <button
                                    onClick={() => {
                                      setStaffToDelete(staff)
                                      setDeleteReason('')
                                      setIsDeleteModalOpen(true)
                                    }}
                                    className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100 text-stone-400 hover:text-red-500'
                                    title='Request Permanent Delete'
                                    aria-label={`Request permanent delete for ${staff.displayName || staff.fullName}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}

                                {permissionService.canEdit(
                                  'staffManagement'
                                ) && (
                                  <button
                                    onClick={() => {
                                      setFormData(staff)
                                      setSelectedStaff(staff)
                                      setView('permissions')
                                      focusMainContent()
                                    }}
                                    className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100'
                                    title='Edit Permissions'
                                    aria-label={`Edit permissions for ${staff.displayName || staff.fullName}`}
                                  >
                                    <Shield size={12} />
                                  </button>
                                )}
                                {permissionService.hasMenuAccess('staffAccessLogs') && (
                                  <button
                                    onClick={() => openStaffLogs(staff)}
                                    className='p-1.5 border border-stone-200 rounded-none hover:bg-stone-100'
                                    title='View Staff Logs'
                                    aria-label={`View logs for ${staff.displayName || staff.fullName}`}
                                  >
                                    <FileText size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className='space-y-3 p-4 md:hidden'>
                    {filteredStaff.map(staff => (
                      <div
                        key={staff.id}
                        className='border border-stone-200 bg-white p-4 text-xs'
                      >
                        <div className='mb-3 flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='font-black uppercase text-brand-charcoal break-words'>
                              {staff.displayName || staff.fullName}
                            </p>
                            <p className='mt-1 font-mono text-[10px] text-stone-500 break-all'>
                              {staff.staffCode}
                            </p>
                          </div>
                          <StatusBadge
                            status={staff.status}
                            variant={
                              staff.status === 'active'
                                ? 'success'
                                : staff.status === 'suspended'
                                ? 'warning'
                                : 'error'
                            }
                          />
                        </div>
                        <div className='grid grid-cols-1 gap-2 border-t border-stone-100 pt-3 text-[11px]'>
                          <p className='break-words'>
                            <span className='font-bold uppercase text-stone-400'>
                              Name:{' '}
                            </span>
                            {staff.fullName}
                          </p>
                          {staff.email && (
                            <p className='break-all'>
                              <span className='font-bold uppercase text-stone-400'>
                                Email:{' '}
                              </span>
                              {staff.email}
                            </p>
                          )}
                          {staff.phone && (
                            <p className='break-all'>
                              <span className='font-bold uppercase text-stone-400'>
                                Phone:{' '}
                              </span>
                              {staff.phone}
                            </p>
                          )}
                          <p className='break-words'>
                            <span className='font-bold uppercase text-stone-400'>
                              Role:{' '}
                            </span>
                            {staff.role}
                          </p>
                          <p className='break-words'>
                            <span className='font-bold uppercase text-stone-400'>
                              Desk:{' '}
                            </span>
                            {staff.desk}
                          </p>
                          {staff.assignedBranchId && (
                            <p className='break-all'>
                              <span className='font-bold uppercase text-stone-400'>
                                Branch:{' '}
                              </span>
                              {staff.assignedBranchId}
                            </p>
                          )}
                        </div>
                        <div className='mt-3 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-3'>
                          {permissionService.canEdit('staffManagement') && (
                            <button
                              onClick={() => {
                                setFormData(staff)
                                setSelectedStaff(staff)
                                setView('form')
                                focusMainContent()
                              }}
                              className='border border-stone-200 p-2'
                              title='Edit Staff'
                              aria-label={`Edit staff ${staff.displayName || staff.fullName}`}
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                          {permissionService.canEdit('staffManagement') && (
                            <button
                              onClick={() =>
                                triggerAction(
                                  staff,
                                  staff.isLocked ? 'unlock' : 'lock'
                                )
                              }
                              className='border border-stone-200 p-2'
                              title={
                                staff.isLocked ? 'Unlock Staff' : 'Lock Staff'
                              }
                              aria-label={`${staff.isLocked ? 'Unlock' : 'Lock'} staff ${staff.displayName || staff.fullName}`}
                            >
                              {staff.isLocked ? (
                                <Unlock size={12} />
                              ) : (
                                <Lock size={12} />
                              )}
                            </button>
                          )}
                          {permissionService.canEdit('staffManagement') && (
                            <button
                              onClick={() => {
                                setPasscodeModalConfig({
                                  staff,
                                  isOverride: false
                                })
                                setTempPasscode('')
                                setConfirmTempPasscode('')
                                setIsPasscodeModalOpen(true)
                              }}
                              className='border border-stone-200 p-2'
                              title='Reset Passcode'
                              aria-label={`Reset passcode for ${staff.displayName || staff.fullName}`}
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}
                          {permissionService.isSysAdmin() && (
                            <button
                              onClick={() => {
                                setPasscodeModalConfig({
                                  staff,
                                  isOverride: true
                                })
                                setTempPasscode('')
                                setConfirmTempPasscode('')
                                setIsPasscodeModalOpen(true)
                              }}
                              className='border border-stone-200 p-2'
                              title='Override Passcode'
                              aria-label={`Override passcode for ${staff.displayName || staff.fullName}`}
                            >
                              <Shield size={12} />
                            </button>
                          )}
                          {permissionService.hasActionPermission(
                            'staff.suspend' as any
                          ) &&
                            staff.status === 'active' && (
                              <button
                                onClick={() => triggerAction(staff, 'suspend')}
                                className='border border-stone-200 p-2 text-stone-500'
                                title='Suspend Staff'
                                aria-label={`Suspend staff ${staff.displayName || staff.fullName}`}
                              >
                                <UserX size={12} />
                              </button>
                            )}
                          {permissionService.hasActionPermission(
                            'staff.reactivate' as any
                          ) &&
                            staff.status === 'suspended' && (
                              <button
                                onClick={() => triggerAction(staff, 'reactivate')}
                                className='border border-stone-200 p-2 text-green-600'
                                title='Reactivate Staff'
                                aria-label={`Reactivate staff ${staff.displayName || staff.fullName}`}
                              >
                                <UserX size={12} />
                              </button>
                            )}
                          {permissionService.hasActionPermission(
                            'staff.archive' as any
                          ) && (
                            <button
                              onClick={() => triggerAction(staff, 'archive')}
                              className='border border-stone-200 p-2 text-brand-orange'
                              title='Archive Staff'
                              aria-label={`Archive staff ${staff.displayName || staff.fullName}`}
                            >
                              <Archive size={12} />
                            </button>
                          )}
                          {(permissionService.hasActionPermission(
                            'staff.requestDelete' as any
                          ) ||
                            permissionService.isSysAdmin()) && (
                            <button
                              onClick={() => {
                                setStaffToDelete(staff)
                                setDeleteReason('')
                                setIsDeleteModalOpen(true)
                              }}
                              className='border border-stone-200 p-2 text-red-600'
                              title='Request Permanent Delete'
                              aria-label={`Request permanent delete for ${staff.displayName || staff.fullName}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          {permissionService.canEdit('staffManagement') && (
                            <button
                              onClick={() => {
                                setFormData(staff)
                                setSelectedStaff(staff)
                                setView('permissions')
                                focusMainContent()
                              }}
                              className='border border-stone-200 p-2'
                              title='Edit Permissions'
                              aria-label={`Edit permissions for ${staff.displayName || staff.fullName}`}
                            >
                              <Shield size={12} />
                            </button>
                          )}
                          {permissionService.hasMenuAccess('staffAccessLogs') && (
                            <button
                              onClick={() => openStaffLogs(staff)}
                              className='border border-stone-200 p-2'
                              title='View Staff Logs'
                              aria-label={`View logs for ${staff.displayName || staff.fullName}`}
                            >
                              <FileText size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </DataPanel>
          </div>
        )}

      {activeTab === 'logs' && (
        <div className='space-y-6'>
          <div className='flex flex-wrap gap-4 items-center justify-between'>
            <div className='flex gap-4'>
              <SearchInput
                placeholder='Search logs...'
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                className='w-64'
              />

              <select
                value={filterStaff}
                onChange={e => setFilterStaff(e.target.value)}
                className='form-input w-48'
              >
                <option value='all'>All Staff</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>

              <select
                value={filterEventType}
                onChange={e => setFilterEventType(e.target.value)}
                className='form-input w-48'
              >
                <option value='all'>All Events</option>
                <option value='STAFF_LOGIN_SUCCESS'>Login Success</option>
                <option value='STAFF_LOGIN_FAILED'>Login Failed</option>
                <option value='STAFF_CREATED'>Staff Created</option>
                <option value='STAFF_UPDATED'>Staff Updated</option>
                <option value='STAFF_SUSPENDED'>Staff Suspended</option>
                <option value='STAFF_REACTIVATED'>Staff Reactivated</option>
                <option value='STAFF_LOCKED'>Staff Locked</option>
                <option value='STAFF_UNLOCKED'>Staff Unlocked</option>
                <option value='STAFF_PASSCODE_RESET'>Passcode Reset</option>
                <option value='STAFF_PASSCODE_OVERRIDDEN'>
                  Passcode Override
                </option>
                <option value='STAFF_PERMISSIONS_UPDATED'>
                  Permissions Updated
                </option>
                <option value='STAFF_ROLE_CHANGED'>Role Changed</option>
                <option value='ACCESS_DENIED'>Access Denied</option>
              </select>

              <select
                value={filterResult}
                onChange={e => setFilterResult(e.target.value)}
                className='form-input w-32'
              >
                <option value='all'>All Results</option>
                <option value='success'>Success</option>
                <option value='failed'>Failed</option>
                <option value='updated'>Updated</option>
              </select>
            </div>

            <div className='flex gap-2'>
              <PrimaryButton onClick={exportLogsJSON} className='text-xs'>
                <Download size={14} className='mr-2' /> Export JSON
              </PrimaryButton>

              <PrimaryButton onClick={exportLogsPDF} className='text-xs'>
                <FileText size={14} className='mr-2' /> Export PDF
              </PrimaryButton>

              <SecondaryButton
                onClick={() => {
                  if (confirm('Clear all demo logs? This cannot be undone.')) {
                    analyticsService.clearLogs()
                    loadLogs()
                  }
                }}
                className='text-xs text-red-600'
              >
                Clear Logs
              </SecondaryButton>
            </div>
          </div>

          <DataPanel title={`Staff Access Logs (${staffLogs.length})`}>
            <div className='space-y-2 max-h-96 overflow-y-auto'>
              {staffLogs.slice(0, 100).map((log, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between p-3 bg-stone-50 rounded-none border'
                >
                  <div className='flex-1'>
                    <div className='flex items-center gap-3'>
                      <span className='text-xs font-mono text-stone-500'>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>

                      <span
                        className={`text-xs px-2 py-1 rounded-none ${
                          log.result === 'success'
                            ? 'bg-green-100 text-green-800'
                            : log.result === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {log.result}
                      </span>

                      <span className='text-xs font-medium text-stone-700'>
                        {log.eventType?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className='text-xs text-stone-600 mt-1'>
                      {log.actorName} â€¢{' '}
                      {log.details ? JSON.stringify(log.details) : ''}
                    </div>
                  </div>
                </div>
              ))}

              {staffLogs.length === 0 && (
                <div className='text-center py-8 text-stone-500'>
                  No staff access logs found.
                </div>
              )}
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === 'directory' && view === 'form' && (
        <div className='space-y-8'>
          <div className='flex justify-between items-center bg-stone-900 text-white p-6'>
            <h3 className='text-sm font-bold uppercase tracking-widest'>
              {selectedStaff ? 'Modify Staff Node' : 'Initialize Staff Node'}
            </h3>

            <div className='flex gap-3'>
              <SecondaryButton
                onClick={() => {
                  setView('list')
                  setSelectedStaff(null)
                  setFormData({})
                  setFormError('')
                }}
                className='text-white border-white/20'
              >
                Discard
              </SecondaryButton>

              <PrimaryButton
                onClick={saveStaff}
                disabled={duplicates.length > 0}
              >
                Save Profile
              </PrimaryButton>
            </div>
          </div>

          <DataPanel title='Staff Profile'>
            {formError && (
              <div className='mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-none text-sm'>
                {formError}
              </div>
            )}

            {duplicates.length > 0 && (
              <div className='mb-4 p-4 border-t-4 border-t-red-500 bg-red-50/30 text-red-700'>
                <div className='flex gap-3 text-red-600'>
                  <AlertTriangle size={20} className='shrink-0' />
                  <div>
                    <h4 className='text-sm font-bold uppercase'>
                      Possible duplicate staff record found
                    </h4>
                    <p className='text-xs text-stone-600 mt-1'>
                      Another record shares the same staff code or email.
                    </p>
                    {hasDuplicateCode &&
                      (permissionService.isSysAdmin() ||
                        JSON.parse(
                          localStorage.getItem('activeStaffSession') || '{}'
                        ).actionPermissions?.['staff.generateStaffCode'] ||
                        JSON.parse(
                          localStorage.getItem('activeStaffSession') || '{}'
                        ).role === 'Super Admin') && (
                        <PrimaryButton
                          className='mt-3 text-xs px-3 py-1'
                          onClick={async () => {
                            let newCode = ''
                            try {
                              newCode =
                                await staffService.generateUniqueStaffCodeFromFirebase()
                            } catch (e) {
                              newCode = staffService.generateStaffCode()
                            }
                            setFormData(prev => ({
                              ...prev,
                              staffCode: newCode
                            }))
                            showBrandedAlert({
                              title: 'seiGEN Commerce',
                              message: 'New staff code generated.',
                              type: 'success'
                            })
                          }}
                        >
                          Generate New Staff Code
                        </PrimaryButton>
                      )}
                  </div>
                </div>
              </div>
            )}

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <FormField label='Staff Code'>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={formData.staffCode || ''}
                    disabled
                    className='form-input bg-stone-100 text-stone-500 cursor-not-allowed flex-1'
                  />
                  {(permissionService.isSysAdmin() ||
                    JSON.parse(
                      localStorage.getItem('activeStaffSession') || '{}'
                    ).actionPermissions?.['staff.generateStaffCode'] ||
                    JSON.parse(
                      localStorage.getItem('activeStaffSession') || '{}'
                    ).role === 'Super Admin') && (
                    <SecondaryButton
                      type='button'
                      onClick={async () => {
                        let newCode = ''
                        try {
                          newCode =
                            await staffService.generateUniqueStaffCodeFromFirebase()
                        } catch (e) {
                          newCode = staffService.generateStaffCode()
                        }
                        setFormData(prev => ({
                          ...prev,
                          staffCode: newCode
                        }))
                        showBrandedAlert({
                          title: 'seiGEN Commerce',
                          message: 'New staff code generated.',
                          type: 'success'
                        })
                      }}
                      className='whitespace-nowrap px-3 py-2 text-xs'
                    >
                      Generate New Staff Code
                    </SecondaryButton>
                  )}
                </div>
              </FormField>

              <FormField label='Full Name *' required>
                <input
                  type='text'
                  value={formData.fullName || ''}
                  onChange={e =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className='form-input'
                  required
                />
              </FormField>

              <FormField label='Display Name *' required>
                <input
                  type='text'
                  value={formData.displayName || ''}
                  onChange={e =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  className='form-input'
                  required
                />
              </FormField>

              <FormField label='Role *' required>
                <select
                  value={formData.role || ''}
                  onChange={e => {
                    const role = e.target.value

                    setFormData({
                      ...formData,
                      role,
                      desk:
                        (staffService as any).ROLE_TO_DESK_MAP?.[role] || '',
                      menuPermissions:
                        localRoleTemplates[role]?.menuPermissions || {},
                      actionPermissions:
                        localRoleTemplates[role]?.actionPermissions || {}
                    })
                  }}
                  className='form-input'
                  required
                >
                  <option value=''>Select Role</option>
                  {Object.keys(localRoleTemplates).map(role => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label='Desk *' required>
                <select
                  value={formData.desk || ''}
                  onChange={e =>
                    setFormData({ ...formData, desk: e.target.value })
                  }
                  className='form-input'
                  required
                >
                  <option value=''>Select Desk</option>
                  {DESKS.map(desk => (
                    <option key={desk} value={desk}>
                      {desk}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label='Email'>
                <input
                  type='email'
                  value={formData.email || ''}
                  onChange={e =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className='form-input'
                />
              </FormField>

              <FormField label='Phone'>
                <input
                  type='tel'
                  value={formData.phone || ''}
                  onChange={e =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className='form-input'
                />
              </FormField>

              <FormField label='WhatsApp'>
                <input
                  type='tel'
                  value={formData.whatsapp || ''}
                  onChange={e =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                  className='form-input'
                />
              </FormField>

              <FormField label='Allowed Google Email'>
                <input
                  type='email'
                  value={formData.googleEmailAllowed || ''}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      googleEmailAllowed: e.target.value
                    })
                  }
                  className='form-input'
                />
              </FormField>

              <FormField label='Status'>
                <select
                  value={formData.status || 'active'}
                  onChange={e =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className='form-input'
                >
                  <option value='active'>Active</option>
                  <option value='inactive'>Inactive</option>
                  <option value='suspended'>Suspended</option>
                </select>
              </FormField>

              <FormField label='6-digit Passcode *' required>
                <div className='relative'>
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    value={
                      selectedStaff ? formData.passcode || '' : tempPasscode
                    }
                    onChange={e => {
                      const value = e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 6)

                      if (selectedStaff) {
                        setFormData({ ...formData, passcode: value })
                      } else {
                        setTempPasscode(value)
                      }
                    }}
                    className='form-input pr-10'
                    placeholder='123456'
                    maxLength={6}
                    required
                  />

                  <button
                    type='button'
                    onClick={() => setShowPasscode(!showPasscode)}
                    className='absolute right-3 top-1/2 transform -translate-y-1/2'
                  >
                    {showPasscode ? (
                      <EyeOff size={16} className='text-stone-400' />
                    ) : (
                      <Eye size={16} className='text-stone-400' />
                    )}
                  </button>
                </div>
              </FormField>

              {!selectedStaff && (
                <FormField label='Confirm 6-digit Passcode *' required>
                  <input
                    type='password'
                    value={formData.passcode || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        passcode: e.target.value.replace(/\D/g, '').slice(0, 6)
                      })
                    }
                    className='form-input'
                    placeholder='123456'
                    maxLength={6}
                    required
                  />
                </FormField>
              )}

              <div className='flex items-center gap-4 md:col-span-2'>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={formData.mustChangePasscode || false}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        mustChangePasscode: e.target.checked
                      })
                    }
                  />
                  <span className='text-sm'>
                    Must change passcode on next login
                  </span>
                </label>
              </div>
            </div>
          </DataPanel>

          <DataPanel title='Personal Details'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6'>
              <FormField label='National ID'>
                <input
                  type='text'
                  value={formData.personalDetails?.nationalId || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        nationalId: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                  placeholder='At least 5 chars'
                />
              </FormField>
              <FormField label='Date of Birth'>
                <input
                  type='date'
                  value={formData.personalDetails?.dateOfBirth || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        dateOfBirth: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <FormField label='Gender'>
                <select
                  value={formData.personalDetails?.gender || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        gender: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                >
                  <option value=''>Select Gender</option>
                  <option value='male'>Male</option>
                  <option value='female'>Female</option>
                  <option value='other'>Other</option>
                </select>
              </FormField>
              <FormField label='Marital Status'>
                <select
                  value={formData.personalDetails?.maritalStatus || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        maritalStatus: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                >
                  <option value=''>Select Status</option>
                  <option value='single'>Single</option>
                  <option value='married'>Married</option>
                  <option value='divorced'>Divorced</option>
                  <option value='widowed'>Widowed</option>
                </select>
              </FormField>
              <FormField label='Next of Kin Name'>
                <input
                  type='text'
                  value={formData.personalDetails?.nextOfKinName || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        nextOfKinName: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <FormField label='Next of Kin Phone'>
                <input
                  type='tel'
                  value={formData.personalDetails?.nextOfKinPhone || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        nextOfKinPhone: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                  placeholder='+263...'
                />
              </FormField>
            </div>
          </DataPanel>

          <DataPanel title='Address Details'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6'>
              <FormField label='Country'>
                <input
                  type='text'
                  value={formData.addressDetails?.country || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        country: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <FormField label='Province'>
                <input
                  type='text'
                  value={formData.addressDetails?.province || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        province: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <FormField label='City / Town'>
                <input
                  type='text'
                  value={formData.addressDetails?.cityTown || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        cityTown: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <FormField label='District'>
                <input
                  type='text'
                  value={formData.addressDetails?.district || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        district: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <FormField label='Suburb'>
                <input
                  type='text'
                  value={formData.addressDetails?.suburb || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        suburb: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <FormField label='Street Address'>
                <input
                  type='text'
                  value={formData.addressDetails?.streetAddress || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        streetAddress: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <div className='md:col-span-2 lg:col-span-3'>
                <FormField label='GPS Notes'>
                  <textarea
                    value={formData.addressDetails?.gpsNotes || ''}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        addressDetails: {
                          ...(prev.addressDetails || {}),
                          gpsNotes: e.target.value
                        }
                      }))
                    }
                    className='form-input min-h-[80px]'
                    placeholder='Directions or landmarks...'
                  />
                </FormField>
              </div>
            </div>
          </DataPanel>

          <DataPanel title='KYC Details'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6 p-6'>
              <FormField label='ID Type'>
                <select
                  value={formData.kycDetails?.idType || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      kycDetails: {
                        ...(prev.kycDetails || {}),
                        idType: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                >
                  <option value=''>Select ID Type</option>
                  <option value='National ID'>National ID</option>
                  <option value='Passport'>Passport</option>
                  <option value="Driver's License">Driver's License</option>
                </select>
              </FormField>
              <FormField label='ID Number'>
                <input
                  type='text'
                  value={formData.kycDetails?.idNumber || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      kycDetails: {
                        ...(prev.kycDetails || {}),
                        idNumber: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                />
              </FormField>
              <FormField label='KYC Status'>
                <select
                  value={formData.kycDetails?.kycStatus || 'not_started'}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      kycDetails: {
                        ...(prev.kycDetails || {}),
                        kycStatus: e.target.value as any
                      }
                    }))
                  }
                  className='form-input font-bold'
                >
                  <option value='not_started'>Not Started</option>
                  <option value='pending'>Pending Verification</option>
                  <option value='verified'>Verified</option>
                  <option value='rejected'>Rejected</option>
                </select>
              </FormField>
              <div className='md:col-span-2'>
                <FormField label='KYC Notes'>
                  <textarea
                    value={formData.kycDetails?.notes || ''}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        kycDetails: {
                          ...(prev.kycDetails || {}),
                          notes: e.target.value
                        }
                      }))
                    }
                    className='form-input min-h-[80px]'
                  />
                </FormField>
              </div>
            </div>
          </DataPanel>

          <DataPanel title='KYC Documents'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 p-6'>
              <FormField label='ID Document URL'>
                <input
                  type='text'
                  value={formData.kycDocuments?.idDocumentUrl || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      kycDocuments: {
                        ...(prev.kycDocuments || {}),
                        idDocumentUrl: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                  placeholder='Link to ID scan'
                />
              </FormField>
              <FormField label='Proof of Residence URL'>
                <input
                  type='text'
                  value={formData.kycDocuments?.proofOfResidenceUrl || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      kycDocuments: {
                        ...(prev.kycDocuments || {}),
                        proofOfResidenceUrl: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                  placeholder='Link to utility bill'
                />
              </FormField>
              <FormField label='Staff Photo URL'>
                <input
                  type='text'
                  value={formData.kycDocuments?.photoUrl || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      kycDocuments: {
                        ...(prev.kycDocuments || {}),
                        photoUrl: e.target.value
                      }
                    }))
                  }
                  className='form-input'
                  placeholder='Link to portrait'
                />
              </FormField>
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === 'directory' && view === 'permissions' && (
        <div className='space-y-8'>
          <div className='flex justify-between items-center bg-stone-900 text-white p-6'>
            <h3 className='text-sm font-bold uppercase tracking-widest'>
              {canEditSelectedStaffPermissions
                ? 'Edit Staff Permissions'
                : 'View Staff Permissions'}{' '}
              - {selectedStaff?.displayName}
            </h3>

            <div className='flex gap-3'>
              <SecondaryButton
                onClick={() => setView('list')}
                className='text-white border-white/20'
              >
                Cancel
              </SecondaryButton>

              {canEditSelectedStaffPermissions && (
                <PrimaryButton
                  onClick={async () => {
                    if (!canEditSelectedStaffPermissions) {
                      showBrandedAlert({
                        title: 'seiGEN Commerce',
                        message:
                          'You do not have permission to edit role permissions.',
                        type: 'error'
                      })
                      return
                    }
                    if (selectedStaff) {
                      if (
                        !window.confirm(
                          'You are about to change permissions for this role. This may affect staff access.'
                        )
                      ) {
                        return
                      }
                      try {
                        const grantablePermissions =
                          permissionService.filterGrantablePermissions(
                            currentStaffForPermissions,
                            formData.menuPermissions || {},
                            formData.actionPermissions || {}
                          )
                        const protectedPermissions = isSysAdminEditingOwnAccount
                          ? permissionService.protectCriticalPermissions(
                              selectedStaff.role,
                              grantablePermissions.menuPermissions,
                              grantablePermissions.actionPermissions
                            )
                          : grantablePermissions
                        await staffService.saveStaff({
                          ...selectedStaff,
                          menuPermissions: protectedPermissions.menuPermissions,
                          actionPermissions:
                            protectedPermissions.actionPermissions,
                          updatedAt: new Date().toISOString(),
                          updatedBy:
                            currentStaffForPermissions?.displayName ||
                            currentStaffForPermissions?.fullName ||
                            'SysAdmin'
                        })

                        analyticsService.logEvent({
                          eventType: 'STAFF_PERMISSIONS_UPDATED',
                          actorType: 'admin',
                          actorName: 'SysAdmin',
                          actorId: selectedStaff.id,
                          result: 'updated',
                          details: { staffId: selectedStaff.id }
                        })

                        // Non-blocking staff audit logging
                        try {
                          void staffAuditService.logAction({
                            eventType: 'PERMISSION_CHANGED',
                            module: 'staff',
                            action: 'Updated role/menu/action permissions',
                            severity: 'critical',
                            recordType: 'staff',
                            recordId: selectedStaff.id,
                            recordName: selectedStaff.displayName,
                            beforeSnapshot: {
                              actorStaffId:
                                currentStaffForPermissions?.id ||
                                currentStaffForPermissions?.staffCode,
                              actorName:
                                currentStaffForPermissions?.displayName ||
                                currentStaffForPermissions?.fullName ||
                                currentStaffForPermissions?.staffName,
                              targetRole: selectedStaff.role,
                              menuPermissions: selectedStaff.menuPermissions,
                              actionPermissions: selectedStaff.actionPermissions
                            },
                            afterSnapshot: {
                              actorStaffId:
                                currentStaffForPermissions?.id ||
                                currentStaffForPermissions?.staffCode,
                              actorName:
                                currentStaffForPermissions?.displayName ||
                                currentStaffForPermissions?.fullName ||
                                currentStaffForPermissions?.staffName,
                              targetRole: selectedStaff.role,
                              changedMenuPermissions:
                                permissionService.getChangedPermissionKeys(
                                  selectedStaff.menuPermissions || {},
                                  protectedPermissions.menuPermissions
                                ),
                              changedActionPermissions:
                                permissionService.getChangedPermissionKeys(
                                  selectedStaff.actionPermissions || {},
                                  protectedPermissions.actionPermissions
                                ),
                              menuPermissions:
                                protectedPermissions.menuPermissions,
                              actionPermissions:
                                protectedPermissions.actionPermissions
                            }
                          })
                        } catch (auditErr) {
                          console.error('Audit log failed', auditErr)
                        }

                        window.setTimeout(() => {
                          void loadStaff()
                          void loadLogs()
                        }, 800)

                        setView('list')
                        focusMainContent()
                        showBrandedAlert({
                          title: 'seiGEN Commerce',
                          message: 'Staff saved successfully.',
                          type: 'success'
                        })
                      } catch (error: any) {
                        console.error(error)
                        showBrandedAlert({
                          title: 'seiGEN Commerce',
                          message: error.message || 'Failed to save staff.',
                          type: 'error'
                        })
                      }
                    }
                  }}
                >
                  Save Permissions
                </PrimaryButton>
              )}
            </div>
          </div>

          {!canEditSelectedStaffPermissions && (
            <div className='p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm mt-4 mx-6'>
              You can view staff permissions, but you do not have authority to
              edit them.
            </div>
          )}

          <DataPanel title='Menu Permissions'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {MENU_KEYS.map(key => (
                <div
                  key={key}
                  className='flex items-center justify-between p-3 border border-stone-200 rounded-none'
                >
                  <span className='text-sm font-medium'>
                    {PERMISSIONS.find(p => p.id === key)?.label || key}
                  </span>

                  <select
                    value={formData.menuPermissions?.[key] || 'hidden'}
                    onChange={e =>
                      handlePermissionChange(
                        key,
                        e.target.value as PermissionLevel
                      )
                    }
                    disabled={!canEditSelectedStaffPermissions}
                    className='text-xs border border-stone-200 rounded-none px-2 py-1'
                  >
                    <option value='hidden'>Hidden</option>
                    <option value='view'>View</option>
                    <option value='create'>Create</option>
                    <option value='submit'>Submit</option>
                    <option value='edit'>Edit</option>
                    <option value='approve'>Approve</option>
                    <option value='delete'>Delete</option>
                    <option value='export'>Export</option>
                    <option value='full'>Full</option>
                  </select>
                </div>
              ))}
            </div>
          </DataPanel>
          <DataPanel title='Action Permissions & Approval Rights'>
            <div className='p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {ACTION_GROUPS.map(group => (
                <div key={group.name} className='space-y-3'>
                  <h4 className='text-xs font-bold uppercase text-brand-orange border-b border-stone-100 pb-2'>
                    {group.name}
                  </h4>
                  {group.keys.map(key => (
                    <label
                      key={key}
                      className='flex items-center gap-2 text-xs text-stone-600 cursor-pointer'
                    >
                      <input
                        type='checkbox'
                        className='accent-brand-orange'
                        checked={
                          !!formData.actionPermissions?.[
                            key as ActionPermissionKey
                          ]
                        }
                        onChange={e =>
                          handleActionPermissionChange(
                            key as ActionPermissionKey,
                            e.target.checked
                          )
                        }
                        disabled={!canEditSelectedStaffPermissions}
                      />
                      {key.split('.')[1]}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className='space-y-6'>
          <DataPanel title='Security Settings'>
            <div className='p-6'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <FormField label='Failed Login Limit'>
                  <input
                    type='number'
                    defaultValue={5}
                    className='form-input'
                    min='1'
                    max='10'
                  />
                </FormField>

                <FormField label='Passcode Length'>
                  <input
                    type='number'
                    defaultValue={6}
                    className='form-input'
                    disabled
                  />
                </FormField>

                <FormField label='Session Timeout (minutes)'>
                  <input
                    type='number'
                    defaultValue={480}
                    className='form-input'
                    min='60'
                    max='1440'
                  />
                </FormField>

                <FormField label='Default Role for New Staff'>
                  <select className='form-input'>
                    {Object.keys(localRoleTemplates).map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label='Default Desk for New Staff'>
                  <select className='form-input'>
                    <option value='Backoffice Desk'>Backoffice Desk</option>
                    <option value='Product Data Desk'>Product Data Desk</option>
                    <option value='Catalogue Deployment Desk'>
                      Catalogue Deployment Desk
                    </option>
                    <option value='Collections Desk'>Collections Desk</option>
                    <option value='RPN Management Desk'>
                      RPN Management Desk
                    </option>
                    <option value='CAH Operations Desk'>
                      CAH Operations Desk
                    </option>
                    <option value='BI & Analytics Desk'>
                      BI & Analytics Desk
                    </option>
                    <option value='Viewer Desk'>Viewer Desk</option>
                  </select>
                </FormField>

                <div className='flex items-center gap-4'>
                  <label className='flex items-center gap-2'>
                    <input type='checkbox' defaultChecked />
                    <span className='text-sm'>Require numbers only</span>
                  </label>
                </div>

                <div className='flex items-center gap-4'>
                  <label className='flex items-center gap-2'>
                    <input type='checkbox' defaultChecked />
                    <span className='text-sm'>
                      Require passcode change after reset
                    </span>
                  </label>
                </div>

                <div className='flex items-center gap-4'>
                  <label className='flex items-center gap-2'>
                    <input type='checkbox' />
                    <span className='text-sm'>
                      Allow first SysAdmin setup mode
                    </span>
                  </label>
                </div>

                <div className='flex items-center gap-4'>
                  <label className='flex items-center gap-2'>
                    <input type='checkbox' />
                    <span className='text-sm'>Privacy mode for reports</span>
                  </label>
                </div>

                <div className='flex items-center gap-4'>
                  <label className='flex items-center gap-2'>
                    <input type='checkbox' />
                    <span className='text-sm'>
                      Show phone numbers in admin-only views
                    </span>
                  </label>
                </div>
              </div>

              <div className='flex gap-4 mt-8'>
                <PrimaryButton
                  disabled
                  title='Security settings save is not enabled yet'
                  aria-label='Security settings save is disabled'
                >
                  Save Settings
                </PrimaryButton>
                <SecondaryButton
                  disabled
                  title='Security settings reset is not enabled yet'
                  aria-label='Security settings reset is disabled'
                >
                  Reset to Defaults
                </SecondaryButton>
              </div>
            </div>
          </DataPanel>
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        variant={confirmConfig?.variant}
        onConfirm={() => {
          confirmConfig?.action()
          setIsConfirmOpen(false)
        }}
        onCancel={closeAllModals}
      />

      <ConfirmDialog
        isOpen={isPasscodeModalOpen}
        title={
          passcodeModalConfig?.isOverride
            ? 'Override Passcode'
            : 'Reset Passcode (Force Change)'
        }
        message={`Enter new 6-digit passcode for ${passcodeModalConfig?.staff.displayName}:`}
        variant='warning'
        onConfirm={() => {
          if (tempPasscode !== confirmTempPasscode) {
            showBrandedAlert({
              title: 'seiGEN Commerce',
              message: 'Passcodes do not match.',
              type: 'error'
            })
            return
          }

          if (passcodeModalConfig) {
            handlePasscodeAction(
              passcodeModalConfig.staff,
              tempPasscode,
              passcodeModalConfig.isOverride
            )
          }
        }}
        onCancel={closeAllModals}
      >
        <div className='mt-4 space-y-4'>
          <input
            type='password'
            value={tempPasscode}
            onChange={e =>
              setTempPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder='New 6-digit Passcode'
            className='form-input w-full'
            maxLength={6}
            required
            autoFocus
          />

          <input
            type='password'
            value={confirmTempPasscode}
            onChange={e =>
              setConfirmTempPasscode(
                e.target.value.replace(/\D/g, '').slice(0, 6)
              )
            }
            placeholder='Confirm 6-digit Passcode'
            className='form-input w-full'
            maxLength={6}
            required
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        title={
          permissionService.isSysAdmin()
            ? 'Permanently Delete Staff?'
            : 'Request Staff Delete?'
        }
        message={
          staffToDelete
            ? `${permissionService.isSysAdmin() ? 'This permanently removes' : 'This archives and records a delete request for'} ${staffToDelete.displayName || staffToDelete.fullName}. Enter a reason to continue.`
            : ''
        }
        variant='danger'
        onConfirm={() => {
          void requestOrDeleteStaff()
        }}
        onCancel={closeAllModals}
      >
        <div className='mt-4 space-y-3'>
          <textarea
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            className='form-input min-h-[96px] w-full'
            placeholder='Reason for delete/archive request'
            aria-label='Reason for delete or archive request'
            required
          />
          {!permissionService.isSysAdmin() && (
            <p className='text-xs font-bold uppercase text-stone-500'>
              Non-SysAdmin delete actions are captured as archive/delete
              requests for audit review.
            </p>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={isApplyRoleModalOpen}
        title={`Apply Template: ${applyRoleConfig?.role}`}
        message={`This will update the permissions of all staff members currently assigned to the "${applyRoleConfig?.role}" role. Existing individual overrides will be replaced.`}
        variant='warning'
        onConfirm={async () => {
          if (applyRoleConfig) {
            const staffToUpdate = staffList.filter(
              s => s.role === applyRoleConfig.role
            )
            if (staffToUpdate.length > 0) {
              try {
                for (const staff of staffToUpdate) {
                  await staffService.saveStaff({
                    ...staff,
                    menuPermissions:
                      localRoleTemplates[applyRoleConfig.role]
                        ?.menuPermissions || {},
                    actionPermissions:
                      localRoleTemplates[applyRoleConfig.role]
                        ?.actionPermissions || {},
                    updatedAt: new Date().toISOString(),
                    updatedBy: 'SysAdmin'
                  })
                }

                analyticsService.logEvent({
                  eventType: 'STAFF_PERMISSIONS_UPDATED',
                  actorType: 'admin',
                  actorName: 'SysAdmin',
                  result: 'updated',
                  details: {
                    appliedRoleTemplate: applyRoleConfig.role,
                    affectedCount: staffToUpdate.length
                  }
                })

                setStaffList(asArray<Staff>(staffService.getAllStaff()))

                window.setTimeout(() => {
                  void loadStaff()
                  void loadLogs()
                }, 800)

                setIsApplyRoleModalOpen(false)
                setFormSuccess(
                  `Template applied to ${staffToUpdate.length} staff members.`
                )
                setTimeout(() => setFormSuccess(''), 3000)
              } catch (error: any) {
                console.error(error)
                showBrandedAlert({
                  title: 'seiGEN Commerce',
                  message: error.message || 'Failed to save staff.',
                  type: 'error'
                })
              }
            } else {
              showBrandedAlert({
                title: 'seiGEN Commerce',
                message: 'No staff found with this role.',
                type: 'warning'
              })
            }
          }
        }}
        onCancel={closeAllModals}
      >
        <div className='mt-4 p-3 bg-orange-50 border border-brand-orange text-brand-orange text-xs font-bold uppercase tracking-wide'>
          Affected Staff:{' '}
          {staffList.filter(s => s.role === applyRoleConfig?.role).length}
        </div>
      </ConfirmDialog>
    </div>
  )
}
