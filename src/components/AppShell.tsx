/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Activity as ActivityIcon,
  BarChart3,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  FileCode,
  FileText,
  Globe,
  HelpCircle,
  History,
  Key,
  Layers,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Search,
  Settings,
  Shield,
  Share2,
  Store,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X
} from 'lucide-react'
import { AppRoute, ITredNotification, MenuKey } from '../types.ts'
import { motion, AnimatePresence } from 'motion/react'
import { permissionService } from '../services/permissionService.ts'
import { notificationService } from '../services/notificationService.ts'
import {
  offlineSyncService,
  OfflineSyncSummary
} from '../services/offlineSyncService.ts'
import { StaffMessengerWidget } from './StaffMessengerWidget.tsx'
import { masterDataCacheService } from '../services/masterDataCacheService.ts'

interface AppShellProps {
  children: React.ReactNode
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  title: string
  staffName?: string
  staffRole?: string
  staffDesk?: string
  onLogout?: () => void
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const MENU_GROUPS: {
  id: string
  label: string
  icon: React.ElementType
  items: {
    id: AppRoute
    label: string
    icon: React.ElementType
    adminOnly?: boolean
  }[]
}[] = [
  {
    id: 'command-centre',
    label: 'Command Centre',
    icon: LayoutDashboard,
    items: [
      { id: AppRoute.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
      {
        id: AppRoute.ADMIN_DASHBOARD,
        label: 'Admin Dashboard',
        icon: Shield,
        adminOnly: true
      },
      { id: AppRoute.BI_MARKET, label: 'BI Market Analytics', icon: Search },
      { id: AppRoute.ANALYTICS, label: 'Performance Metrics', icon: BarChart3 },
      { id: AppRoute.BI_OVERVIEW, label: 'BI Overview', icon: BarChart3 },
      { id: AppRoute.AI_REPORTS, label: 'AI Reports', icon: Bot },
      { id: AppRoute.PRODUCT_TRENDS, label: 'Product Trends', icon: TrendingUp },
      { id: AppRoute.VENDOR_REPORTS, label: 'Vendor Reports', icon: FileText },
      { id: AppRoute.VIRAL_GROWTH, label: 'Viral Growth', icon: Share2 }
    ]
  },
  {
    id: 'vendor-operations',
    label: 'Vendor Operations',
    icon: Store,
    items: [
      { id: AppRoute.VENDOR_MGMT, label: 'Vendor Management', icon: Store },
      {
        id: AppRoute.POS_VENDOR_ONBOARDING,
        label: 'Vendor POS Onboarding',
        icon: UserCheck
      },
      {
        id: AppRoute.POS_ONBOARDING_REVIEW,
        label: 'POS Onboarding Review',
        icon: ClipboardCheck
      },
      { id: AppRoute.POS_GOVERNANCE, label: 'POS Governance', icon: Database },
      { id: AppRoute.PRODUCT_MGMT, label: 'Product Management', icon: Package },
      { id: AppRoute.CATALOGUE_BUILDER_V2, label: 'Catalogue Builder', icon: FileCode },
      { id: AppRoute.VENDOR_STOREFRONT, label: 'Storefronts', icon: Globe },
      { id: AppRoute.OFFLINE_COMMERCE_SHELL, label: 'Offline Commerce Shell', icon: Download }
    ]
  },
  {
    id: 'commerce-access-hub',
    label: 'Commerce Access Hub',
    icon: Layers,
    items: [
      { id: AppRoute.CAH, label: 'Access Hub', icon: Layers },
      {
        id: AppRoute.WHATSAPP_ACTIVITY,
        label: 'WhatsApp Activity',
        icon: MessageSquare
      },
      {
        id: AppRoute.COMMUNITY_BI,
        label: 'Community BI',
        icon: LineChart
      },
      {
        id: AppRoute.WHATSAPP_REPORTS,
        label: 'WhatsApp Reports',
        icon: BarChart3
      },
      { id: AppRoute.SPOT_CHECKS, label: 'Spot Checks', icon: ClipboardCheck },
      {
        id: AppRoute.VENDOR_INVENTORY_SPOT_CHECKS,
        label: 'Vendor Inventory Spot Checks',
        icon: FileSpreadsheet
      }
    ]
  },
  {
    id: 'rpn-field-network',
    label: 'RPN & Field Network',
    icon: Users,
    items: [
      { id: AppRoute.RPN_MGMT, label: 'RPN Management', icon: Users },
      {
        id: AppRoute.RPN_PERFORMANCE,
        label: 'RPN Performance',
        icon: ActivityIcon
      },
      {
        id: AppRoute.RPN_BI_PERFORMANCE,
        label: 'RPN BI Performance',
        icon: BarChart3
      }
    ]
  },
  {
    id: 'finance-subscriptions',
    label: 'Plans & Prices',
    icon: Wallet,
    items: [
      { id: AppRoute.PRICING, label: 'Pricing', icon: CreditCard },
      { id: AppRoute.POS_PLANS, label: 'POS Plans', icon: CreditCard },
      { id: AppRoute.SUBSCRIPTIONS, label: 'Collections', icon: Wallet }
    ]
  },
  {
    id: 'finance-accounts',
    label: 'Finance & Accounts',
    icon: Wallet,
    items: [
      {
        id: AppRoute.FINANCE_DESK,
        label: 'Finance Desk',
        icon: LayoutDashboard
      },
      {
        id: AppRoute.VENDOR_BILLS,
        label: 'Vendor Bills / Receivables',
        icon: FileText
      },
      {
        id: AppRoute.CASH_BANK_MANAGER,
        label: 'Cash & Bank',
        icon: CreditCard
      },
      {
        id: AppRoute.RPN_PAYMENTS_LEDGER,
        label: 'RPN Payments Ledger',
        icon: Wallet
      },
      {
        id: AppRoute.FINANCE_REPORTS,
        label: 'Finance Reports',
        icon: BarChart3
      }
    ]
  },
  {
    id: 'staff-roles-security',
    label: 'Staff, Roles & Security',
    icon: Shield,
    items: [
      {
        id: AppRoute.STAFF_MGMT,
        label: 'Staff Management',
        icon: UserCheck,
        adminOnly: true
      },
      {
        id: AppRoute.ROLE_MENU_PERMISSIONS,
        label: 'Role & Menu Permissions',
        icon: Key,
        adminOnly: true
      },
      {
        id: AppRoute.APPROVAL_QUEUE,
        label: 'Approval Queue',
        icon: CheckCircle2
      },
      { id: AppRoute.NOTIFICATIONS, label: 'Notifications', icon: Bell },
      { id: AppRoute.STAFF_TASKS, label: 'Staff Tasks', icon: ClipboardCheck },
      {
        id: AppRoute.STAFF_ACCESS_LOGS,
        label: 'Staff Access Logs',
        icon: History,
        adminOnly: true
      },
      {
        id: AppRoute.SYSTEM_SETTINGS,
        label: 'System Settings',
        icon: Settings,
        adminOnly: true
      }
    ]
  },
  {
    id: 'help-operations-manual',
    label: 'Help & Operations Manual',
    icon: HelpCircle,
    items: [{ id: AppRoute.HOW_TO, label: 'How To', icon: HelpCircle }]
  }
]

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeRoute,
  onNavigate,
  title,
  staffName,
  staffRole,
  staffDesk,
  onLogout
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<ITredNotification[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false)
  const [isSyncDropdownOpen, setIsSyncDropdownOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [syncSummary, setSyncSummary] = useState<OfflineSyncSummary>({
    pendingCount: 0,
    failedCount: 0,
    items: []
  })
  const [toasts, setToasts] = useState<
    { id: number; message: string; type: string }[]
  >([])
  const [sessionIgnored, setSessionIgnored] = useState<Set<string>>(new Set())
  const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null)
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installMessage, setInstallMessage] = useState<string | null>(null)

  console.log('AppShell mounted successfully')

  useEffect(() => {
    void masterDataCacheService.bootstrap()
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent)
      setInstallMessage(null)
    }

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null)
      setInstallMessage('iTredVD app installed.')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) {
      setInstallMessage('Use browser menu > Install app or Add to Home screen.')
      window.setTimeout(() => setInstallMessage(null), 5000)
      return
    }

    const promptEvent = deferredInstallPrompt
    setDeferredInstallPrompt(null)
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    setInstallMessage(
      choice.outcome === 'accepted'
        ? 'iTredVD app install started.'
        : 'Install cancelled.'
    )
    window.setTimeout(() => setInstallMessage(null), 5000)
  }

  const loadNotifications = useCallback(async () => {
    try {
      let session: any = {}
      try {
        const sessionStr = localStorage.getItem('activeStaffSession')
        session = sessionStr ? JSON.parse(sessionStr) : {}
      } catch (sessionError) {
        console.error('Failed to parse activeStaffSession', sessionError)
      }

      const staffId = session.staffId || session.id || ''
      const latestNotifications = permissionService.canViewAllNotifications()
        ? await notificationService.getAll()
        : await notificationService.getByStaff(staffId)
      setNotifications(
        Array.isArray(latestNotifications) ? latestNotifications : []
      )
    } catch (error) {
      console.error('Failed to load notifications', error)
      setNotifications([])
    }
  }, [])

  const openAlertsCount = notifications.filter(
    n =>
      n.status === 'unread' &&
      (n.priority === 'critical' ||
        n.priority === 'high' ||
        n.priority === 'medium')
  ).length

  const criticalAlert = notifications.find(
    n =>
      n.status === 'unread' &&
      (n.priority === 'critical' || n.priority === 'high') &&
      !sessionIgnored.has(n.id)
  )

  const latestUnreadNotifications = notifications
    .filter(n => n.status === 'unread')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 8)

  const hasPendingSync = syncSummary.pendingCount + syncSummary.failedCount > 0
  const connectionLabel = hasPendingSync
    ? 'Sync Pending'
    : isOnline
      ? 'Online'
      : 'Offline'
  const connectionDotClass = hasPendingSync
    ? 'bg-brand-orange'
    : isOnline
      ? 'bg-emerald-500'
      : 'bg-amber-500'

  const runNotificationAction = async (
    notificationId: string,
    action: () => Promise<unknown>
  ) => {
    if (processingNotificationId === notificationId) return
    setProcessingNotificationId(notificationId)
    try {
      await action()
      await loadNotifications()
    } finally {
      setProcessingNotificationId(null)
    }
  }

  useEffect(() => {
    void loadNotifications()

    const handleUpdate = () => {
      void loadNotifications()
    }

    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent
      const detail = customEvent.detail || {}
      const newToast = {
        id: Date.now(),
        message: detail.message || 'Notification',
        type: detail.type || 'info'
      }

      setToasts(prev => [...prev, newToast])

      setTimeout(
        () => setToasts(prev => prev.filter(t => t.id !== newToast.id)),
        3000
      )
    }

    window.addEventListener('itred_notifications_updated', handleUpdate)
    window.addEventListener('itred_toast', handleToast)

    return () => {
      window.removeEventListener('itred_notifications_updated', handleUpdate)
      window.removeEventListener('itred_toast', handleToast)
    }
  }, [loadNotifications])

  useEffect(() => {
    const refreshSync = () => setSyncSummary(offlineSyncService.getSummary())
    const handleOnline = () => {
      setIsOnline(true)
      refreshSync()
      void offlineSyncService.retryPending().then(setSyncSummary)
    }
    const handleOffline = () => {
      setIsOnline(false)
      refreshSync()
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const summary = offlineSyncService.getSummary()
      if (summary.pendingCount + summary.failedCount === 0) return
      event.preventDefault()
      event.returnValue = 'You have records waiting to sync.'
      return event.returnValue
    }

    refreshSync()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener(offlineSyncService.eventName, refreshSync)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener(offlineSyncService.eventName, refreshSync)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  useEffect(() => {
    const group = MENU_GROUPS.find(g => g.items.some(i => i.id === activeRoute))
    if (group) {
      setOpenGroupId(group.id)
    }
  }, [activeRoute])

  const checkAccess = (route: AppRoute) => {
    const menuKeyMap: Partial<Record<string, MenuKey>> = {
      [AppRoute.VENDOR_MGMT]: 'vendorManagement',
      [AppRoute.RPN_MGMT]: 'rpnManagement',
      [AppRoute.PRODUCT_MGMT]: 'productManagement',
      [AppRoute.CAH]: 'accessHub',
      [AppRoute.WHATSAPP_ACTIVITY]: 'whatsappActivity',
      [AppRoute.COMMUNITY_BI]: 'whatsappActivity',
      [AppRoute.WHATSAPP_REPORTS]: 'whatsappActivity',
      [AppRoute.PRICING]: 'pricing',
      [AppRoute.POS_PLANS]: 'posPlans',
      [AppRoute.POS_GOVERNANCE]: 'posGovernance',
      [AppRoute.POS_VENDOR_ONBOARDING]: 'posVendorOnboarding',
      [AppRoute.POS_ONBOARDING_REVIEW]: 'posOnboardingReview',
      [AppRoute.SUBSCRIPTIONS]: 'subscriptionsCollections',
      [AppRoute.CATALOGUE_GEN]: 'createCatalogue',
      [AppRoute.CATALOGUE_BUILDER_V2]: 'createCatalogue',
      [AppRoute.VENDOR_STOREFRONT]: 'createStorefront',
      [AppRoute.ANALYTICS]: 'analytics',
      [AppRoute.BI_MARKET]: 'biMarketAnalytics',
      [AppRoute.ACTIVITY_LOGS]: 'activityLogs',
      [AppRoute.SPOT_CHECKS]: 'inventorySpotChecks',
      [AppRoute.VENDOR_INVENTORY_SPOT_CHECKS]: 'inventorySpotChecks',
      [AppRoute.STAFF_MGMT]: 'staffManagement',
      [AppRoute.ADMIN_DASHBOARD]: 'adminDashboard',
      [AppRoute.ROLE_MENU_PERMISSIONS]: 'roleMenuPermissions',
      [AppRoute.STAFF_ACCESS_LOGS]: 'staffAccessLogs',
      [AppRoute.SYSTEM_SETTINGS]: 'systemSettings',
      [AppRoute.APPROVAL_QUEUE]: 'approvalQueue',
      [AppRoute.NOTIFICATIONS]: 'notifications',
      [AppRoute.STAFF_TASKS]: 'staffTasks',
      [AppRoute.RPN_PERFORMANCE]: 'rpnPerformance',
      [AppRoute.FINANCE_DESK]: 'financeDesk',
      [AppRoute.VENDOR_BILLS]: 'financeDesk',
      [AppRoute.CASH_BANK_MANAGER]: 'cashBankManager',
      [AppRoute.RPN_PAYMENTS_LEDGER]: 'rpnPaymentsLedger',
      [AppRoute.FINANCE_REPORTS]: 'financeReports',
      [AppRoute.BI_OVERVIEW]: 'biMarketAnalytics',
      [AppRoute.AI_REPORTS]: 'biMarketAnalytics',
      [AppRoute.PRODUCT_TRENDS]: 'biMarketAnalytics',
      [AppRoute.VENDOR_REPORTS]: 'biMarketAnalytics',
      [AppRoute.VIRAL_GROWTH]: 'biMarketAnalytics',
      [AppRoute.RPN_BI_PERFORMANCE]: 'rpnPerformance',
      [AppRoute.DASHBOARD]: 'dashboard',
      [AppRoute.HOW_TO]: 'howTo'
    }
    const key = menuKeyMap[route] || (route as any as MenuKey)
    return permissionService.hasMenuAccess(key)
  }

  const handleNavigate = (route: AppRoute) => {
    onNavigate(route)
    setIsMobileMenuOpen(false)
  }

  return (
    <div className='min-h-screen bg-white flex flex-col md:flex-row'>
      {/* Mobile Top Bar */}
      <div className='md:hidden flex items-center justify-between p-4 bg-brand-charcoal text-white border-b border-white/10'>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-brand-orange flex items-center justify-center font-bold'>
            iT
          </div>
          <span className='font-bold uppercase tracking-tighter text-xl'>
            iTred
          </span>
        </div>
        <div className='flex items-center gap-2'>
          {onLogout && (
            <button
              type='button'
              onClick={onLogout}
              title='Logout'
              aria-label='Logout'
              className='h-10 w-10 border border-white/10 bg-white/5 text-white flex items-center justify-center hover:bg-brand-orange hover:text-white transition-colors'
            >
              <LogOut size={18} />
            </button>
          )}
          <button
            type='button'
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className='h-10 w-10 flex items-center justify-center'
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar - Desktop */}
      <aside className='hidden md:flex flex-col w-72 min-w-[288px] bg-brand-charcoal text-white shrink-0'>
        <div className='p-6 border-b border-white/5'>
          <div className='flex items-center gap-3'>
            <h1 className='text-2xl font-bold tracking-tighter text-white'>
              iTred<span className='text-brand-orange'>.</span>
            </h1>
          </div>
          <p className='text-[10px] uppercase tracking-widest text-gray-400 mt-1 font-semibold'>
            Vendor Catalogue Engine
          </p>
        </div>

        <nav className='flex-1 py-4 overflow-y-auto custom-scrollbar'>
          {MENU_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => {
              if (item.adminOnly && !permissionService.isSysAdmin())
                return false
              return checkAccess(item.id)
            })

            if (visibleItems.length === 0) return null
            const isOpen = openGroupId === group.id

            return (
              <div key={group.id} className='mb-1'>
                <button
                  onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                  className={`w-full flex items-center justify-between gap-3 px-6 py-3 transition-all text-sm border-l-4 min-w-0 overflow-hidden ${
                    isOpen
                      ? 'bg-brand-charcoal border-brand-orange text-white font-medium'
                      : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className='flex items-center gap-3 min-w-0 overflow-hidden'>
                    <group.icon
                      size={16}
                      className={`flex-shrink-0 ${isOpen ? 'text-brand-orange' : 'text-gray-400'}`}
                    />
                    <span className='uppercase tracking-wide text-[11px] font-bold whitespace-nowrap truncate'>
                      {group.label}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={14} className='flex-shrink-0' />
                  ) : (
                    <ChevronRight size={14} className='flex-shrink-0' />
                  )}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className='overflow-hidden bg-black/20'
                    >
                      {visibleItems.map(item => {
                        const isActive = activeRoute === item.id
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id)}
                            className={`w-full flex items-center gap-3 pl-12 pr-6 py-2.5 transition-all text-xs min-w-0 overflow-hidden ${
                              isActive
                                ? 'text-brand-orange font-bold bg-white/5'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <item.icon
                              size={14}
                              className={`flex-shrink-0 ${
                                isActive ? 'text-brand-orange' : 'text-gray-500'
                              }`}
                            />
                            <span className='min-w-0 whitespace-nowrap truncate'>
                              {item.label}
                            </span>
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </nav>

        <div className='p-6 text-[10px] text-gray-500 uppercase tracking-tight border-t border-white/5'>
          Powered by seiGEN Commerce
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className='fixed inset-y-0 left-0 z-50 md:hidden bg-brand-charcoal flex flex-col w-[86vw] max-w-[320px]'
          >
            <div className='flex items-center justify-between p-4 border-b border-white/5'>
              <div className='flex items-center gap-2'>
                <h1 className='text-xl font-bold tracking-tighter text-white'>
                  iTred<span className='text-brand-orange'>.</span>
                </h1>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className='text-white'
              >
                <X size={24} />
              </button>
            </div>
            <nav className='flex-1 overflow-y-auto py-8'>
              {MENU_GROUPS.map(group => {
                const visibleItems = group.items.filter(item => {
                  if (item.adminOnly && !permissionService.isSysAdmin())
                    return false
                  return checkAccess(item.id)
                })

                if (visibleItems.length === 0) return null
                const isOpen = openGroupId === group.id

                return (
                  <div key={group.id} className='mb-2'>
                    <button
                      onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                      className={`w-full flex items-center justify-between gap-3 px-6 py-4 text-sm font-bold uppercase tracking-wide border-l-4 min-w-0 overflow-hidden ${
                        isOpen
                          ? 'text-brand-orange border-brand-orange bg-white/5'
                          : 'text-white border-transparent'
                      }`}
                    >
                      <div className='flex items-center gap-4 min-w-0 overflow-hidden'>
                        <group.icon size={18} className='flex-shrink-0' />
                        <span className='text-[11px] whitespace-nowrap truncate'>
                          {group.label}
                        </span>
                      </div>
                      {isOpen ? (
                        <ChevronDown size={18} className='flex-shrink-0' />
                      ) : (
                        <ChevronRight size={18} className='flex-shrink-0' />
                      )}
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className='overflow-hidden bg-black/20'
                        >
                          {visibleItems.map(item => {
                            const isActive = activeRoute === item.id
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleNavigate(item.id)}
                                className={`w-full flex items-center gap-4 pl-14 pr-6 py-3 text-sm tracking-wide min-w-0 overflow-hidden ${
                                  isActive
                                    ? 'text-brand-orange font-bold'
                                    : 'text-gray-300 hover:text-white'
                                }`}
                              >
                                <item.icon size={16} className='flex-shrink-0' />
                                <span className='min-w-0 whitespace-nowrap truncate'>
                                  {item.label}
                                </span>
                              </button>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className='flex-1 flex flex-col min-w-0 h-screen relative bg-bg-page overflow-hidden'>
        {/* Floating Glassmorphic Top Bar */}
        <header className='absolute top-0 right-0 left-0 h-16 bg-white/70 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-8 z-[40]'>
          <h2 className='text-xl font-bold uppercase tracking-tight text-brand-charcoal'>
            {title}
          </h2>
          <div className='flex items-center gap-3 sm:gap-4'>
            <div className='hidden sm:flex items-center gap-6'>
              <div className='relative'>
                <button
                  type='button'
                  onClick={() => setIsSyncDropdownOpen(!isSyncDropdownOpen)}
                  className='flex items-center gap-2'
                  title={
                    isOnline
                      ? 'Connection status'
                      : 'You are offline. Some records will save locally and sync later.'
                  }
                >
                  <div className={`w-1.5 h-1.5 ${connectionDotClass}`} />
                  <span className='text-[10px] uppercase font-bold text-stone-400'>
                    {connectionLabel}
                  </span>
                </button>
                {isSyncDropdownOpen && (
                  <div className='absolute top-8 right-0 w-72 bg-white border border-stone-200 shadow-2xl z-[100]'>
                    <div className='p-3 border-b border-stone-100'>
                      <p className='text-[10px] font-black uppercase tracking-widest text-brand-charcoal'>
                        Sync Status
                      </p>
                      {!isOnline && (
                        <p className='mt-2 text-[10px] font-bold leading-relaxed text-amber-700'>
                          You are offline. Some records will save locally and sync later.
                        </p>
                      )}
                    </div>
                    <div className='grid grid-cols-2 gap-2 p-3'>
                      <div className='border border-stone-200 p-2'>
                        <p className='text-[8px] font-black uppercase text-stone-400'>
                          Pending
                        </p>
                        <p className='text-lg font-black text-brand-charcoal'>
                          {syncSummary.pendingCount}
                        </p>
                      </div>
                      <div className='border border-stone-200 p-2'>
                        <p className='text-[8px] font-black uppercase text-stone-400'>
                          Failed
                        </p>
                        <p className='text-lg font-black text-red-600'>
                          {syncSummary.failedCount}
                        </p>
                      </div>
                    </div>
                    <div className='px-3 pb-3 text-[9px] font-bold uppercase text-stone-500'>
                      Last Sync: {syncSummary.lastSyncAt ? new Date(syncSummary.lastSyncAt).toLocaleString() : 'Not yet'}
                    </div>
                    <div className='p-3 border-t border-stone-100'>
                      <button
                        type='button'
                        onClick={() =>
                          void offlineSyncService.retryPending().then(setSyncSummary)
                        }
                        className='w-full bg-brand-charcoal px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-brand-orange'
                      >
                        Retry Sync
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className='relative group'>
              <div
                className='w-8 h-8 bg-gray-100 flex items-center justify-center text-stone-400 group-hover:bg-brand-orange group-hover:text-white transition-colors cursor-pointer'
                onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
              >
                <Bell size={16} />
                {openAlertsCount > 0 && (
                  <span className='absolute -top-1 -right-1 w-4 h-4 bg-brand-orange text-white text-[8px] font-bold rounded-full flex items-center justify-center'>
                    {openAlertsCount}
                  </span>
                )}
              </div>

              {/* Notification Dropdown */}
              {isNotifDropdownOpen && (
                <div className='absolute top-10 right-0 w-80 bg-white shadow-2xl border border-stone-200 z-[100] max-h-96 flex flex-col animate-in slide-in-from-top-2'>
                  <div className='p-3 border-b border-stone-100 bg-stone-50 flex justify-between items-center shrink-0'>
                    <span className='font-bold uppercase tracking-widest text-[10px] text-brand-charcoal'>
                      Notifications
                    </span>
                    <button onClick={() => setIsNotifDropdownOpen(false)}>
                      <X
                        size={14}
                        className='text-stone-400 hover:text-brand-charcoal'
                      />
                    </button>
                  </div>
                  <div className='p-3 border-b border-stone-100 bg-white shrink-0'>
                    <button
                      onClick={() => {
                        setIsNotifDropdownOpen(false)
                        handleNavigate(AppRoute.NOTIFICATIONS)
                      }}
                      className='w-full px-3 py-2 bg-brand-charcoal text-white text-[10px] uppercase font-bold tracking-widest hover:bg-brand-orange transition-colors'
                    >
                      View All Notifications
                    </button>
                  </div>
                  <div className='overflow-y-auto flex-1 custom-scrollbar'>
                    {latestUnreadNotifications.length === 0 ? (
                      <div className='p-6 text-center text-xs text-stone-400 font-bold uppercase tracking-widest'>
                        No active notifications.
                      </div>
                    ) : (
                      latestUnreadNotifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-4 border-b border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer ${
                            n.priority === 'critical'
                              ? 'border-l-4 border-l-red-500'
                              : ''
                          }`}
                        >
                          <div className='font-bold text-[11px] text-brand-charcoal uppercase leading-tight mb-1'>
                            {n.title}
                          </div>
                          <div className='text-[10px] text-stone-500 leading-relaxed'>
                            {n.message}
                          </div>
                          <div className='mt-3 flex gap-2'>
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                void runNotificationAction(n.id, () =>
                                  notificationService.markRead(n.id)
                                )
                              }}
                              disabled={processingNotificationId === n.id}
                              className='px-2 py-1 bg-stone-100 text-[9px] uppercase font-bold text-stone-600 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50'
                            >
                              {processingNotificationId === n.id ? 'Working...' : 'Mark Read'}
                            </button>
                            {permissionService.canResolveNotification() && (
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  void runNotificationAction(n.id, () =>
                                    notificationService.resolve(n.id)
                                  )
                                }}
                                disabled={processingNotificationId === n.id}
                                className='px-2 py-1 bg-emerald-50 border border-emerald-100 text-[9px] uppercase font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50'
                              >
                                {processingNotificationId === n.id ? 'Working...' : 'Resolve'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className='relative group'>
              <div className='w-8 h-8 bg-gray-100 flex items-center justify-center text-stone-400 group-hover:bg-brand-orange group-hover:text-white transition-colors cursor-pointer'>
                <Search size={16} />
              </div>

              {/* Search Overlay Placeholder logic would go here if implemented globally */}
            </div>
            <div className='hidden min-w-0 items-center border-l border-stone-200 pl-3 lg:flex'>
              <div className='min-w-0 text-right'>
                <p className='truncate text-[10px] font-black uppercase tracking-widest text-brand-charcoal'>
                  {staffName || 'Staff'}
                </p>
                <p className='truncate text-[9px] font-bold uppercase text-stone-400'>
                  {staffRole || 'Role'} / {staffDesk || 'Desk'}
                </p>
              </div>
            </div>
            <div className='relative'>
              <button
                type='button'
                onClick={() => void handleInstallApp()}
                title='Install iTredVD App'
                aria-label='Install iTredVD App'
                className='h-8 w-8 shrink-0 border border-stone-200 bg-gray-100 text-brand-charcoal flex items-center justify-center transition-colors hover:border-brand-orange hover:bg-brand-orange hover:text-white'
              >
                <Download size={15} />
              </button>
              {installMessage && (
                <div className='absolute right-0 top-10 z-[100] w-64 border border-stone-200 bg-white p-3 text-[10px] font-bold uppercase leading-relaxed text-brand-charcoal shadow-2xl'>
                  {installMessage}
                </div>
              )}
            </div>
            {onLogout && (
              <button
                type='button'
                onClick={onLogout}
                title='Logout'
                aria-label='Logout'
                className='h-8 w-8 shrink-0 border border-stone-200 bg-gray-100 text-brand-charcoal flex items-center justify-center transition-colors hover:border-brand-orange hover:bg-brand-orange hover:text-white'
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>

        <div
          id='main-scroll-container'
          className='flex-1 overflow-y-auto p-8 pt-24 pb-32 flex flex-col'
        >
          <div className='max-w-[1400px] w-full flex-1 shrink-0'>
            {children}
          </div>
        </div>

        <footer className='absolute left-0 right-0 bottom-[5mm] z-30 border-t border-gray-200 bg-white/95 px-8 py-3 flex justify-between items-center text-[9px] uppercase font-bold tracking-widest text-brand-orange'>
          <p>© 2026 iTred Operating System</p>
          <p className='md:hidden'>seiGEN Commerce</p>
        </footer>
      </main>

      {/* Notification Toast Stream */}
      <div className='fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none'>
        {toasts.map(t => (
          <div
            key={t.id}
            className='bg-brand-charcoal text-white px-6 py-3 text-xs font-bold uppercase tracking-widest shadow-xl flex items-center gap-3 border-l-4 border-brand-orange animate-in slide-in-from-bottom-5'
          >
            <Check size={14} className='text-brand-orange' />
            {t.message}
          </div>
        ))}
      </div>

      {/* Critical Modal */}
      {criticalAlert && (
        <div className='fixed inset-0 z-[80] bg-brand-charcoal/80 backdrop-blur-sm flex items-center justify-center p-4'>
          <div className='bg-white w-full max-w-md border-t-8 border-brand-orange shadow-2xl p-6 animate-in zoom-in-95'>
            <div className='flex items-center gap-4 mb-4'>
              <div className='w-12 h-12 bg-red-50 text-red-600 flex items-center justify-center shrink-0'>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className='text-lg font-black uppercase text-brand-charcoal leading-tight pr-4'>
                  {criticalAlert.title}
                </h3>
                <p className='text-[10px] font-bold text-brand-orange uppercase tracking-widest mt-1'>
                  Priority: {criticalAlert.priority}
                </p>
              </div>
            </div>
            <p className='text-sm font-medium text-stone-600 mb-8'>
              {criticalAlert.message}
            </p>
            <div className='flex gap-3'>
              <button
                className='flex-1 p-3 bg-stone-100 text-stone-600 text-[10px] tracking-wider font-bold uppercase hover:bg-stone-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                disabled={processingNotificationId === criticalAlert.id}
                onClick={() =>
                  setSessionIgnored(prev => new Set(prev).add(criticalAlert.id))
                }
              >
                Dismiss For Now
              </button>
              <button
                className='flex-1 p-3 bg-brand-orange text-white text-[10px] tracking-wider font-bold uppercase hover:bg-brand-orange/90 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                disabled={processingNotificationId === criticalAlert.id}
                onClick={() =>
                  void runNotificationAction(criticalAlert.id, () =>
                    notificationService.markRead(criticalAlert.id)
                  )
                }
              >
                {processingNotificationId === criticalAlert.id ? 'Acknowledging...' : 'Acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Drawer */}
      {isDrawerOpen && (
        <div
          className='fixed inset-0 z-[70] flex justify-end bg-brand-charcoal/20 backdrop-blur-sm'
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className='w-full max-w-sm bg-stone-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right'
            onClick={e => e.stopPropagation()}
          >
            <div className='p-6 border-b border-stone-200 flex justify-between items-center bg-white shrink-0'>
              <h3 className='text-sm font-black uppercase text-brand-charcoal flex items-center gap-2'>
                <Bell size={16} className='text-brand-orange' /> Operational
                Alerts
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className='text-stone-400 hover:text-brand-charcoal transition-colors'
              >
                <X size={20} />
              </button>
            </div>
            <div className='flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar'>
              {notifications.filter(
                n => n.status === 'unread' || n.status === 'read'
              ).length === 0 ? (
                <div className='text-center p-10'>
                  <CheckCircle2
                    size={40}
                    className='mx-auto text-stone-200 mb-3'
                  />
                  <p className='text-[10px] font-bold uppercase text-stone-400 tracking-widest'>
                    All systems clear.
                  </p>
                </div>
              ) : (
                notifications
                  .filter(n => n.status === 'unread' || n.status === 'read')
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )
                  .map(n => (
                    <div
                      key={n.id}
                      className={`p-4 bg-white border-l-4 shadow-sm ${
                        n.priority === 'critical' || n.priority === 'high'
                          ? 'border-red-500'
                          : n.priority === 'medium'
                          ? 'border-brand-orange'
                          : 'border-blue-500'
                      }`}
                    >
                      <div className='flex justify-between items-start mb-2'>
                        <h4 className='text-[11px] font-bold uppercase text-brand-charcoal leading-tight pr-2'>
                          {n.title}
                        </h4>
                        <span className='text-[8px] font-bold text-stone-400 uppercase shrink-0'>
                          {new Date(n.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className='text-[10px] font-medium text-stone-500 mb-4'>
                        {n.message}
                      </p>
                      <div className='flex gap-2'>
                        {n.status === 'unread' && (
                          <button
                            onClick={() =>
                              void runNotificationAction(n.id, () =>
                                notificationService.markAsRead(n.id)
                              )
                            }
                            disabled={processingNotificationId === n.id}
                            className='text-[9px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 px-3 py-1.5 hover:bg-stone-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                          >
                            {processingNotificationId === n.id ? 'Working...' : 'Acknowledge'}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            void runNotificationAction(n.id, () =>
                              notificationService.markAsResolved(n.id)
                            )
                          }
                          disabled={processingNotificationId === n.id}
                          className='text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-brand-orange border border-orange-200 px-3 py-1.5 hover:bg-brand-orange hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {processingNotificationId === n.id ? 'Working...' : 'Resolve'}
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
      <StaffMessengerWidget />
    </div>
  )
}
