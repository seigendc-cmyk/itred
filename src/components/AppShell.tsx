/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileCode,
  Globe,
  HelpCircle,
  History,
  Key,
  Layers,
  LayoutDashboard,
  LineChart,
  Menu,
  MessageSquare,
  Package,
  Search,
  Settings,
  Shield,
  Store,
  UserCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { AppRoute, ITredNotification } from "../types.ts";
import { motion, AnimatePresence } from "motion/react";
import { permissionService } from "../services/permissionService.ts";
import { notificationService } from "../services/notificationService.ts";

interface AppShellProps {
  children: React.ReactNode;
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  title: string;
  staffName?: string;
  staffRole?: string;
  staffDesk?: string;
  onLogout?: () => void;
}

const MENU_GROUPS: {
  id: string;
  label: string;
  icon: React.ElementType;
  items: {
    id: AppRoute;
    label: string;
    icon: React.ElementType;
    adminOnly?: boolean;
  }[];
}[] = [
  {
    id: "command-centre",
    label: "Command Centre",
    icon: LayoutDashboard,
    items: [
      { id: AppRoute.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
      {
        id: AppRoute.ADMIN_DASHBOARD,
        label: "Admin Dashboard",
        icon: Shield,
        adminOnly: true,
      },
      { id: AppRoute.BI_MARKET, label: "BI Market Analytics", icon: Search },
      { id: AppRoute.ANALYTICS, label: "Performance Metrics", icon: BarChart3 },
    ],
  },
  {
    id: "vendor-operations",
    label: "Vendor Operations",
    icon: Store,
    items: [
      { id: AppRoute.VENDOR_MGMT, label: "Vendor Management", icon: Store },
      { id: AppRoute.PRODUCT_MGMT, label: "Product Management", icon: Package },
      { id: AppRoute.CATALOGUE_GEN, label: "Create Catalogue", icon: FileCode },
      { id: AppRoute.VENDOR_STOREFRONT, label: "Storefronts", icon: Globe },
    ],
  },
  {
    id: "commerce-access-hub",
    label: "Commerce Access Hub",
    icon: Layers,
    items: [
      { id: AppRoute.CAH, label: "Access Hub", icon: Layers },
      {
        id: AppRoute.WHATSAPP_ACTIVITY,
        label: "WhatsApp Activity",
        icon: MessageSquare,
      },
      {
        id: AppRoute.COMMUNITY_BI,
        label: "Community BI",
        icon: LineChart,
      },
      {
        id: AppRoute.WHATSAPP_REPORTS,
        label: "WhatsApp Reports",
        icon: BarChart3,
      },
      { id: AppRoute.SPOT_CHECKS, label: "Spot Checks", icon: ClipboardCheck },
    ],
  },
  {
    id: "rpn-field-network",
    label: "RPN & Field Network",
    icon: Users,
    items: [
      { id: AppRoute.RPN_MGMT, label: "RPN Management", icon: Users },
      {
        id: AppRoute.RPN_PERFORMANCE,
        label: "RPN Performance",
        icon: Activity,
      },
    ],
  },
  {
    id: "finance-subscriptions",
    label: "Finance & Subscriptions",
    icon: Wallet,
    items: [
      { id: AppRoute.PRICING, label: "Pricing", icon: CreditCard },
      { id: AppRoute.SUBSCRIPTIONS, label: "Collections", icon: Wallet },
    ],
  },
  {
    id: "staff-roles-security",
    label: "Staff, Roles & Security",
    icon: Shield,
    items: [
      {
        id: AppRoute.STAFF_MGMT,
        label: "Staff Management",
        icon: UserCheck,
        adminOnly: true,
      },
      {
        id: AppRoute.ROLE_MENU_PERMISSIONS,
        label: "Role & Menu Permissions",
        icon: Key,
        adminOnly: true,
      },
      {
        id: AppRoute.APPROVAL_QUEUE,
        label: "Approval Queue",
        icon: CheckCircle2,
      },
      { id: AppRoute.NOTIFICATIONS, label: "Notifications", icon: Bell },
      { id: AppRoute.STAFF_TASKS, label: "Staff Tasks", icon: ClipboardCheck },
      {
        id: AppRoute.STAFF_ACCESS_LOGS,
        label: "Staff Access Logs",
        icon: History,
        adminOnly: true,
      },
      {
        id: AppRoute.SYSTEM_SETTINGS,
        label: "System Settings",
        icon: Settings,
        adminOnly: true,
      },
    ],
  },
  {
    id: "help-operations-manual",
    label: "Help & Operations Manual",
    icon: HelpCircle,
    items: [{ id: AppRoute.HOW_TO, label: "How To", icon: HelpCircle }],
  },
];

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeRoute,
  onNavigate,
  title,
  staffName,
  staffRole,
  staffDesk,
  onLogout,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ITredNotification[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<
    { id: number; message: string; type: string }[]
  >([]);
  const [sessionIgnored, setSessionIgnored] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadNotifs = async () =>
      setNotifications(await notificationService.getAll());
    loadNotifs();

    const handleUpdate = () => loadNotifs();
    const handleToast = (e: any) => {
      const newToast = {
        id: Date.now(),
        message: e.detail.message,
        type: e.detail.type,
      };
      setToasts((prev) => [...prev, newToast]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== newToast.id)),
        3000,
      );
    };

    window.addEventListener("itred_notifications_updated", handleUpdate);
    window.addEventListener("itred_toast", handleToast);

    return () => {
      window.removeEventListener("itred_notifications_updated", handleUpdate);
      window.removeEventListener("itred_toast", handleToast);
    };
  }, []);

  useEffect(() => {
    const group = MENU_GROUPS.find((g) =>
      g.items.some((i) => i.id === activeRoute),
    );
    if (group) {
      setOpenGroupId(group.id);
    }
  }, [activeRoute]);

  const checkAccess = (route: AppRoute) => {
    const menuKeyMap: Partial<Record<string, MenuKey>> = {
      [AppRoute.VENDOR_MGMT]: "vendorManagement",
      [AppRoute.RPN_MGMT]: "rpnManagement",
      [AppRoute.PRODUCT_MGMT]: "productManagement",
      [AppRoute.CAH]: "accessHub",
      [AppRoute.WHATSAPP_ACTIVITY]: "whatsappActivity",
      [AppRoute.COMMUNITY_BI]: "whatsappActivity",
      [AppRoute.WHATSAPP_REPORTS]: "whatsappActivity",
      [AppRoute.PRICING]: "pricing",
      [AppRoute.SUBSCRIPTIONS]: "subscriptionsCollections",
      [AppRoute.CATALOGUE_GEN]: "createCatalogue",
      [AppRoute.VENDOR_STOREFRONT]: "createStorefront",
      [AppRoute.ANALYTICS]: "analytics",
      [AppRoute.BI_MARKET]: "biMarketAnalytics",
      [AppRoute.ACTIVITY_LOGS]: "activityLogs",
      [AppRoute.SPOT_CHECKS]: "inventorySpotChecks",
      [AppRoute.STAFF_MGMT]: "staffManagement",
      [AppRoute.ADMIN_DASHBOARD]: "adminDashboard",
      [AppRoute.ROLE_MENU_PERMISSIONS]: "roleMenuPermissions",
      [AppRoute.STAFF_ACCESS_LOGS]: "staffAccessLogs",
      [AppRoute.SYSTEM_SETTINGS]: "systemSettings",
      [AppRoute.APPROVAL_QUEUE]: "approvalQueue",
      [AppRoute.NOTIFICATIONS]: "notifications",
      [AppRoute.STAFF_TASKS]: "staffTasks",
      [AppRoute.RPN_PERFORMANCE]: "rpnPerformance",
      [AppRoute.DASHBOARD]: "dashboard",
      [AppRoute.HOW_TO]: "howTo",
    };
    const key = menuKeyMap[route] || (route as any as MenuKey);
    return permissionService.hasMenuAccess(key);
  };

  const handleNavigate = (route: AppRoute) => {
    onNavigate(route);
    setIsMobileMenuOpen(false);
  };

  const openAlertsCount = notifications.filter(
    (n) =>
      n.status === "unread" &&
      (n.priority === "critical" ||
        n.priority === "high" ||
        n.priority === "medium"),
  ).length;

  const criticalAlert = notifications.find(
    (n) =>
      n.status === "unread" &&
      (n.priority === "critical" || n.priority === "high") &&
      !sessionIgnored.has(n.id),
  );

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-brand-charcoal text-white border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-orange flex items-center justify-center font-bold">
            iT
          </div>
          <span className="font-bold uppercase tracking-tighter text-xl">
            iTred
          </span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-brand-charcoal text-white shrink-0">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tighter text-white">
              iTred<span className="text-brand-orange">.</span>
            </h1>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-1 font-semibold">
            Vendor Catalogue Engine
          </p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          {MENU_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => {
              if (item.adminOnly && !permissionService.isSysAdmin())
                return false;
              return checkAccess(item.id);
            });

            if (visibleItems.length === 0) return null;
            const isOpen = openGroupId === group.id;

            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                  className={`w-full flex items-center justify-between px-6 py-3 transition-all text-sm border-l-4 ${
                    isOpen
                      ? "bg-brand-charcoal border-brand-orange text-white font-medium"
                      : "text-gray-400 border-transparent hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <group.icon
                      size={16}
                      className={isOpen ? "text-brand-orange" : "text-gray-400"}
                    />
                    <span className="uppercase tracking-widest text-[11px] font-bold">
                      {group.label}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20"
                    >
                      {visibleItems.map((item) => {
                        const isActive = activeRoute === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id)}
                            className={`w-full flex items-center gap-3 pl-12 pr-6 py-2.5 transition-all text-xs ${
                              isActive
                                ? "text-brand-orange font-bold bg-white/5"
                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <item.icon
                              size={14}
                              className={
                                isActive ? "text-brand-orange" : "text-gray-500"
                              }
                            />
                            {item.label}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className="p-6 text-[10px] text-gray-500 uppercase tracking-tight border-t border-white/5">
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
            className="fixed inset-0 z-50 md:hidden bg-brand-charcoal flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tighter text-white">
                  iTred<span className="text-brand-orange">.</span>
                </h1>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white"
              >
                <X size={24} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-8">
              {MENU_GROUPS.map((group) => {
                const visibleItems = group.items.filter((item) => {
                  if (item.adminOnly && !permissionService.isSysAdmin())
                    return false;
                  return checkAccess(item.id);
                });

                if (visibleItems.length === 0) return null;
                const isOpen = openGroupId === group.id;

                return (
                  <div key={group.id} className="mb-2">
                    <button
                      onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                      className={`w-full flex items-center justify-between px-6 py-4 text-sm font-bold uppercase tracking-widest border-l-4 ${
                        isOpen
                          ? "text-brand-orange border-brand-orange bg-white/5"
                          : "text-white border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <group.icon size={18} />
                        {group.label}
                      </div>
                      {isOpen ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-black/20"
                        >
                          {visibleItems.map((item) => {
                            const isActive = activeRoute === item.id;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleNavigate(item.id)}
                                className={`w-full flex items-center gap-4 pl-14 pr-6 py-3 text-sm tracking-wide ${
                                  isActive
                                    ? "text-brand-orange font-bold"
                                    : "text-gray-300 hover:text-white"
                                }`}
                              >
                                <item.icon size={16} />
                                {item.label}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen relative bg-bg-page overflow-hidden">
        {/* Floating Glassmorphic Top Bar */}
        <header className="absolute top-0 right-0 left-0 h-16 bg-white/70 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-8 z-[40]">
          <h2 className="text-xl font-bold uppercase tracking-tight text-brand-charcoal">
            {title}
          </h2>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500" />
                <span className="text-[10px] uppercase font-bold text-stone-400">
                  System Ready
                </span>
              </div>
            </div>
            <div className="relative group">
              <div
                className="w-8 h-8 bg-gray-100 flex items-center justify-center text-stone-400 group-hover:bg-brand-orange group-hover:text-white transition-colors cursor-pointer"
                onClick={() => setIsDrawerOpen(true)}
              >
                <Bell size={16} />
                {openAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-orange text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {openAlertsCount}
                  </span>
                )}
              </div>
            </div>
            <div className="relative group">
              <div className="w-8 h-8 bg-gray-100 flex items-center justify-center text-stone-400 group-hover:bg-brand-orange group-hover:text-white transition-colors cursor-pointer">
                <Search size={16} />
              </div>

              {/* Search Overlay Placeholder logic would go here if implemented globally */}
            </div>
          </div>
        </header>

        <div
          id="main-scroll-container"
          className="flex-1 overflow-y-auto p-8 pt-24 pb-32 flex flex-col"
        >
          <div className="max-w-[1400px] w-full flex-1 shrink-0">
            {children}
          </div>
        </div>

        <footer className="absolute left-0 right-0 bottom-[5mm] z-30 border-t border-gray-200 bg-white/95 px-8 py-3 flex justify-between items-center text-[9px] uppercase font-bold tracking-widest text-brand-orange">
          <p>© 2026 iTred Operating System</p>
          <p className="md:hidden">seiGEN Commerce</p>
        </footer>
      </main>

      {/* Notification Toast Stream */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-brand-charcoal text-white px-6 py-3 text-xs font-bold uppercase tracking-widest shadow-xl flex items-center gap-3 border-l-4 border-brand-orange animate-in slide-in-from-bottom-5"
          >
            <Check size={14} className="text-brand-orange" />
            {t.message}
          </div>
        ))}
      </div>

      {/* Critical Modal */}
      {criticalAlert && (
        <div className="fixed inset-0 z-[80] bg-brand-charcoal/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md border-t-8 border-brand-orange shadow-2xl p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase text-brand-charcoal leading-tight pr-4">
                  {criticalAlert.title}
                </h3>
                <p className="text-[10px] font-bold text-brand-orange uppercase tracking-widest mt-1">
                  Priority: {criticalAlert.priority}
                </p>
              </div>
            </div>
            <p className="text-sm font-medium text-stone-600 mb-8">
              {criticalAlert.message}
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 p-3 bg-stone-100 text-stone-600 text-[10px] tracking-wider font-bold uppercase hover:bg-stone-200 transition-colors"
                onClick={() =>
                  setSessionIgnored((prev) =>
                    new Set(prev).add(criticalAlert.id),
                  )
                }
              >
                Dismiss For Now
              </button>
              <button
                className="flex-1 p-3 bg-brand-orange text-white text-[10px] tracking-wider font-bold uppercase hover:bg-brand-orange/90 transition-colors"
                onClick={() =>
                  notificationService
                    .markAsRead(criticalAlert.id)
                    .then(async () =>
                      setNotifications(await notificationService.getAll()),
                    )
                }
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Drawer */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-brand-charcoal/20 backdrop-blur-sm"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-stone-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-sm font-black uppercase text-brand-charcoal flex items-center gap-2">
                <Bell size={16} className="text-brand-orange" /> Operational
                Alerts
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-stone-400 hover:text-brand-charcoal transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {notifications.filter(
                (n) => n.status === "unread" || n.status === "read",
              ).length === 0 ? (
                <div className="text-center p-10">
                  <CheckCircle2
                    size={40}
                    className="mx-auto text-stone-200 mb-3"
                  />
                  <p className="text-[10px] font-bold uppercase text-stone-400 tracking-widest">
                    All systems clear.
                  </p>
                </div>
              ) : (
                notifications
                  .filter((n) => n.status === "unread" || n.status === "read")
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  )
                  .map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 bg-white border-l-4 shadow-sm ${n.priority === "critical" || n.priority === "high" ? "border-red-500" : n.priority === "medium" ? "border-brand-orange" : "border-blue-500"}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-[11px] font-bold uppercase text-brand-charcoal leading-tight pr-2">
                          {n.title}
                        </h4>
                        <span className="text-[8px] font-bold text-stone-400 uppercase shrink-0">
                          {new Date(n.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-stone-500 mb-4">
                        {n.message}
                      </p>
                      <div className="flex gap-2">
                        {n.status === "unread" && (
                          <button
                            onClick={() =>
                              notificationService
                                .markAsRead(n.id)
                                .then(async () =>
                                  setNotifications(
                                    await notificationService.getAll(),
                                  ),
                                )
                            }
                            className="text-[9px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 px-3 py-1.5 hover:bg-stone-200 transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() =>
                            notificationService
                              .markAsResolved(n.id)
                              .then(async () =>
                                setNotifications(
                                  await notificationService.getAll(),
                                ),
                              )
                          }
                          className="text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-brand-orange border border-orange-200 px-3 py-1.5 hover:bg-brand-orange hover:text-white transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
