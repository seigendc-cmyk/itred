/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  Loader2,
  MailOpen,
  Search,
  X,
} from "lucide-react";
import { BrandedAlertModal, PageHeader } from "../components/CommonUI.tsx";
import { notificationService } from "../services/notificationService.ts";
import { permissionService } from "../services/permissionService.ts";
import { staffService } from "../services/staffService.ts";
import { staffAuditService } from "../services/staffAuditService.ts";
import {
  ITredNotification,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
  Staff,
} from "../types.ts";

type Filters = {
  status: "all" | NotificationStatus;
  priority: "all" | NotificationPriority;
  type: "all" | NotificationType;
  assignedToStaffId: "all" | "me" | string;
  search: string;
};

const safeArray = <T,>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

const getSession = () => {
  try {
    const session = localStorage.getItem("activeStaffSession");
    return session ? JSON.parse(session) : {};
  } catch (error) {
    console.error("Failed to parse activeStaffSession", error);
    return {};
  }
};

const statusOptions: Filters["status"][] = [
  "all",
  "unread",
  "read",
  "resolved",
  "archived",
];
const priorityOptions: Filters["priority"][] = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
];

const priorityClass = (priority: NotificationPriority) => {
  if (priority === "critical") return "bg-red-700 text-white";
  if (priority === "high") return "bg-orange-600 text-white";
  if (priority === "medium") return "bg-brand-orange text-white";
  return "bg-stone-200 text-stone-700";
};

const statusClass = (status: NotificationStatus) => {
  if (status === "unread") return "bg-brand-charcoal text-white";
  if (status === "resolved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "archived" || status === "dismissed")
    return "bg-stone-100 text-stone-500 border-stone-200";
  return "bg-white text-stone-700 border-stone-300";
};

const relatedRoute = (notification: ITredNotification): string | null => {
  if (notification.recordType === "approval_request") return "/approval-queue";
  if (notification.recordType === "staff_task") return "/staff-tasks";
  if (notification.recordType === "vendor") return "/vendor-management";
  if (notification.recordType === "product") return "/product-management";
  if (notification.recordType === "catalogue") return "/catalogue-generator";
  if (notification.recordType === "rpn") return "/rpn-management";
  return null;
};

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<ITredNotification[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<ITredNotification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);
  const suppressNextNotificationEvent = useRef(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "seiGEN Commerce", message: "", type: "info" });
  const [filters, setFilters] = useState<Filters>({
    status: "all",
    priority: "all",
    type: "all",
    assignedToStaffId: "all",
    search: "",
  });

  const navigate = useNavigate();
  const session = getSession();
  const currentStaffId = session.staffId || session.id || "";
  const canViewAll = permissionService.canViewAllNotifications();
  const canMarkRead = permissionService.canMarkNotificationRead();
  const canResolve = permissionService.canResolveNotification();
  const canArchive = permissionService.canArchiveNotification();

  const showBrandedAlert = (config: {
    title?: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
  }) => setAlertConfig({ title: "seiGEN Commerce", ...config, isOpen: true });

  const loadData = async (nextPage = 0, append = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const [rows, remoteStaff] = await Promise.all([
        notificationService.getPage(nextPage, 50),
        Promise.resolve(staffService.getAllStaff()),
      ]);
      const sortedRows = safeArray(rows.items).sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
      setNotifications((current) =>
        append ? [...current, ...sortedRows] : sortedRows,
      );
      setHasMore(rows.hasMore);
      setPage(nextPage);
      const fallbackStaff = safeArray(staffService.getAllStaff());
      setStaff(safeArray(remoteStaff).length > 0 ? safeArray(remoteStaff) : fallbackStaff);
    } catch (loadError) {
      console.error("Failed to load notifications", loadError);
      setError("Notifications could not be loaded. Check Firebase connectivity and try again.");
      setNotifications([]);
      setStaff(safeArray(staffService.getAllStaff()));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    const onUpdate = () => {
      if (suppressNextNotificationEvent.current) {
        suppressNextNotificationEvent.current = false;
        return;
      }
      void loadData();
    };
    window.addEventListener("itred_notifications_updated", onUpdate);
    return () => window.removeEventListener("itred_notifications_updated", onUpdate);
  }, []);

  const visibleNotifications = useMemo(() => {
    const rows = safeArray(notifications);
    if (canViewAll) return rows;
    return rows.filter((item) => item.assignedToStaffId === currentStaffId);
  }, [notifications, canViewAll, currentStaffId]);

  const notificationTypes = useMemo(() => {
    const types = new Set<NotificationType>();
    visibleNotifications.forEach((item) => types.add(item.type));
    return Array.from(types).sort();
  }, [visibleNotifications]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return visibleNotifications.filter((item) => {
      const statusMatch =
        filters.status === "all" || item.status === filters.status;
      const priorityMatch =
        filters.priority === "all" || item.priority === filters.priority;
      const typeMatch = filters.type === "all" || item.type === filters.type;
      const assignedMatch =
        filters.assignedToStaffId === "all" ||
        (filters.assignedToStaffId === "me"
          ? item.assignedToStaffId === currentStaffId
          : item.assignedToStaffId === filters.assignedToStaffId);
      const searchMatch =
        !query ||
        [item.title, item.message, item.recordType, item.recordId, item.assignedToName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      return statusMatch && priorityMatch && typeMatch && assignedMatch && searchMatch;
    });
  }, [visibleNotifications, filters, currentStaffId]);

  const stats = {
    unread: visibleNotifications.filter((item) => item.status === "unread").length,
    critical: visibleNotifications.filter(
      (item) => item.priority === "critical" && item.status !== "archived",
    ).length,
    assignedToMe: visibleNotifications.filter(
      (item) => item.assignedToStaffId === currentStaffId,
    ).length,
    resolved: visibleNotifications.filter((item) => item.status === "resolved").length,
  };

  const handleStatus = async (
    notification: ITredNotification,
    status: NotificationStatus,
  ) => {
    if (isSaving || processingNotificationId === notification.id) return;
    const isOwn = notification.assignedToStaffId === currentStaffId;
    const denied = (message: string) => {
      setActionError(message);
      showBrandedAlert({ message, type: "warning" });
    };
    if (!canViewAll && !isOwn) {
      denied("You do not have permission to manage another staff member's notifications.");
      return;
    }
    if ((status === "read" || status === "unread") && !canMarkRead) {
      denied("You do not have permission to acknowledge notifications.");
      return;
    }
    if (status === "resolved" && !canResolve) {
      denied("You do not have permission to resolve notifications.");
      return;
    }
    if (status === "archived" && !canArchive) {
      denied("You do not have permission to archive notifications.");
      return;
    }

    setIsSaving(true);
    setProcessingNotificationId(notification.id);
    setError(null);
    setActionError(null);
    try {
      suppressNextNotificationEvent.current = true;
      if (status === "read") await notificationService.markRead(notification.id);
      else if (status === "unread") await notificationService.markUnread(notification.id);
      else if (status === "resolved") await notificationService.resolve(notification.id);
      else if (status === "archived") await notificationService.archive(notification.id);

      const now = new Date().toISOString();
      const updatedNotification = { ...notification, status, updatedAt: now };
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, status, updatedAt: now } : item,
        ),
      );
      setSelected((prev) =>
        prev?.id === notification.id ? { ...prev, status, updatedAt: now } : prev,
      );
      void staffAuditService.logAction({
        eventType: "RECORD_UPDATED",
        module: "notifications",
        severity: status === "archived" ? "warning" : "info",
        action:
          status === "read"
            ? "Acknowledged notification"
            : status === "resolved"
              ? "Resolved notification"
              : status === "archived"
                ? "Archived notification"
                : "Updated notification status",
        recordType: "notification",
        recordId: notification.id,
        recordName: notification.title,
        beforeSnapshot: notification,
        afterSnapshot: updatedNotification,
      });
      const message =
        status === "read"
          ? "Notification acknowledged."
          : status === "resolved"
            ? "Notification resolved."
            : status === "archived"
              ? "Notification archived."
              : "Notification updated.";
      notificationService.toast(message);
      showBrandedAlert({ message, type: "success" });
    } catch (saveError) {
      console.error("Failed to update notification", saveError);
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to process notification.";
      setError(message);
      setActionError(message);
      showBrandedAlert({
        title: "seiGEN Commerce",
        message,
        type: "error",
      });
    } finally {
      setIsSaving(false);
      setProcessingNotificationId(null);
    }
  };

  const openRelated = (notification: ITredNotification) => {
    const route = relatedRoute(notification);
    if (route) navigate(route);
  };

  return (
    <div className="space-y-6 pb-20">
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
      />
      <PageHeader
        title="Notifications"
        subtitle="System alerts, approval alerts, staff task alerts, and operational follow-ups."
      />

      {error && (
        <div className="border-l-4 border-red-600 bg-red-50 p-4 text-sm font-bold text-red-700 flex items-center gap-3">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Unread", stats.unread, Bell, "border-brand-charcoal"],
          ["Critical", stats.critical, AlertTriangle, "border-red-600"],
          ["Assigned To Me", stats.assignedToMe, Eye, "border-brand-orange"],
          ["Resolved", stats.resolved, CheckCircle2, "border-emerald-600"],
        ].map(([label, value, Icon, border]) => (
          <div key={String(label)} className={`bg-white border-2 ${border} p-4`}>
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-black tracking-widest text-stone-400">
                {String(label)}
              </span>
              {React.createElement(Icon as typeof Bell, {
                size: 18,
                className: "text-brand-orange",
              })}
            </div>
            <p className="mt-2 text-3xl font-black font-mono text-brand-charcoal">
              {String(value)}
            </p>
          </div>
        ))}
      </div>

      <section className="bg-white border-2 border-brand-charcoal">
        <div className="p-4 border-b border-stone-200 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-stone-400">Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as Filters["status"],
                }))
              }
              className="w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-stone-400">Priority</span>
            <select
              value={filters.priority}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  priority: event.target.value as Filters["priority"],
                }))
              }
              className="w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-stone-400">Type</span>
            <select
              value={filters.type}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  type: event.target.value as Filters["type"],
                }))
              }
              className="w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
            >
              <option value="all">all</option>
              {notificationTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-stone-400">Assigned To</span>
            <select
              value={filters.assignedToStaffId}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  assignedToStaffId: event.target.value,
                }))
              }
              className="w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
            >
              <option value="all">all</option>
              <option value="me">me</option>
              {safeArray(staff).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName || member.fullName || member.staffCode}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-stone-400">Search</span>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
                className="w-full border border-stone-200 pl-9 pr-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
              />
            </div>
          </label>
        </div>

        {isLoading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest text-stone-400">
            <Loader2 size={18} className="animate-spin text-brand-orange" /> Loading notifications
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[9px] uppercase tracking-widest text-stone-400">
                  <th className="px-5 py-3">Notification</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assigned</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((notification) => {
                  const route = relatedRoute(notification);
                  const isProcessing = processingNotificationId === notification.id;
                  return (
                    <tr
                      key={notification.id}
                      className={`hover:bg-stone-50 transition-colors ${
                        notification.status === "unread"
                          ? "bg-orange-50/30"
                          : notification.status === "resolved"
                            ? "bg-emerald-50/20"
                            : notification.status === "archived" ||
                                notification.status === "dismissed"
                              ? "opacity-60"
                              : ""
                      }`}
                    >
                      <td className="px-5 py-4 min-w-[280px]">
                        <button
                          onClick={() => setSelected(notification)}
                          className="text-left"
                        >
                          <p className="text-xs font-black uppercase text-brand-charcoal">
                            {notification.title}
                          </p>
                          <p className="text-[10px] text-stone-500 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[9px] font-mono text-stone-400 mt-2">
                            {notification.type} / {notification.recordType}:{notification.recordId}
                          </p>
                          <p className="text-[9px] font-mono text-stone-400 mt-1">
                            Last updated: {notification.updatedAt ? new Date(notification.updatedAt).toLocaleString() : "None"}
                          </p>
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${priorityClass(notification.priority)}`}>
                          {notification.priority}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 border text-[9px] font-black uppercase tracking-widest ${statusClass(notification.status)}`}>
                          {notification.status === "dismissed" ? "archived" : notification.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[10px] font-bold uppercase text-stone-500">
                        {notification.assignedToName || notification.assignedToStaffId || "Unassigned"}
                      </td>
                      <td className="px-5 py-4 text-[10px] font-mono text-stone-500">
                        {notification.createdAt
                          ? new Date(notification.createdAt).toLocaleString()
                          : "Unknown"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => setSelected(notification)}
                            className="px-2 py-1 bg-stone-100 text-[9px] uppercase font-bold text-stone-600"
                          >
                            View
                          </button>
                          {notification.status !== "read" && (
                            <button
                              onClick={() => void handleStatus(notification, "read")}
                              disabled={isSaving || isProcessing}
                              className="px-2 py-1 bg-brand-charcoal text-white text-[9px] uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? "Acknowledging..." : "Acknowledge"}
                            </button>
                          )}
                          {notification.status === "read" && (
                            <button
                              onClick={() => void handleStatus(notification, "unread")}
                              disabled={isSaving || isProcessing}
                              className="px-2 py-1 bg-stone-200 text-stone-700 text-[9px] uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? "Updating..." : "Unread"}
                            </button>
                          )}
                          {notification.status !== "resolved" && (
                            <button
                              onClick={() => void handleStatus(notification, "resolved")}
                              disabled={isSaving || isProcessing}
                              className="px-2 py-1 bg-emerald-700 text-white text-[9px] uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? "Resolving..." : "Resolve"}
                            </button>
                          )}
                          {notification.status !== "archived" && (
                            <button
                              onClick={() => void handleStatus(notification, "archived")}
                              disabled={isSaving || isProcessing}
                              className="px-2 py-1 bg-red-700 text-white text-[9px] uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? "Archiving..." : "Archive"}
                            </button>
                          )}
                          {route && (
                            <button
                              onClick={() => openRelated(notification)}
                              className="px-2 py-1 bg-orange-50 text-brand-orange border border-orange-200 text-[9px] uppercase font-bold"
                            >
                              Open
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-xs font-bold uppercase tracking-widest text-stone-400">
                      No notifications match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {hasMore && !isLoading && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadData(page + 1, true)}
            className="border-2 border-brand-orange px-5 py-3 text-xs font-black uppercase text-brand-orange"
          >
            Load More Notifications
          </button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-brand-charcoal/40 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl border-l-4 border-brand-orange flex flex-col">
            <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
                  {selected.type}
                </p>
                <h2 className="text-lg font-black uppercase text-brand-charcoal mt-1">
                  {selected.title}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 text-stone-400 hover:text-brand-charcoal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {actionError && (
                <div className="border-l-4 border-red-600 bg-red-50 p-3 text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertTriangle size={14} /> {actionError}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${priorityClass(selected.priority)}`}>
                  {selected.priority}
                </span>
                <span className={`px-2 py-1 border text-[9px] font-black uppercase tracking-widest ${statusClass(selected.status)}`}>
                  {selected.status === "dismissed" ? "archived" : selected.status}
                </span>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed">
                {selected.message}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] uppercase font-bold text-stone-500">
                <p className="bg-stone-50 border border-stone-100 p-3">
                  Record: <span className="text-brand-charcoal">{selected.recordType}:{selected.recordId}</span>
                </p>
                <p className="bg-stone-50 border border-stone-100 p-3">
                  Assigned: <span className="text-brand-charcoal">{selected.assignedToName || selected.assignedToStaffId || "Unassigned"}</span>
                </p>
                <p className="bg-stone-50 border border-stone-100 p-3">
                  Created: <span className="text-brand-charcoal">{new Date(selected.createdAt).toLocaleString()}</span>
                </p>
                <p className="bg-stone-50 border border-stone-100 p-3">
                  Updated: <span className="text-brand-charcoal">{selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "None"}</span>
                </p>
              </div>
              {selected.dedupeKey && (
                <p className="bg-orange-50 border border-orange-100 p-3 text-[10px] font-mono text-stone-600 break-all">
                  {selected.dedupeKey}
                </p>
              )}
            </div>
            <div className="p-5 border-t border-stone-200 bg-white flex flex-wrap gap-2">
              {selected.status !== "read" && (
                <button
                  onClick={() => void handleStatus(selected, "read")}
                  disabled={isSaving || processingNotificationId === selected.id}
                  className="px-3 py-2 bg-brand-charcoal text-white text-[10px] uppercase font-black tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MailOpen size={14} /> {processingNotificationId === selected.id ? "Acknowledging..." : "Acknowledge"}
                </button>
              )}
              {selected.status === "read" && (
                <button
                  onClick={() => void handleStatus(selected, "unread")}
                  disabled={isSaving || processingNotificationId === selected.id}
                  className="px-3 py-2 bg-stone-200 text-stone-700 text-[10px] uppercase font-black tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bell size={14} /> {processingNotificationId === selected.id ? "Updating..." : "Mark Unread"}
                </button>
              )}
              {selected.status !== "resolved" && (
                <button
                  onClick={() => void handleStatus(selected, "resolved")}
                  disabled={isSaving || processingNotificationId === selected.id}
                  className="px-3 py-2 bg-emerald-700 text-white text-[10px] uppercase font-black tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={14} /> {processingNotificationId === selected.id ? "Resolving..." : "Resolve"}
                </button>
              )}
              {selected.status !== "archived" && (
                <button
                  onClick={() => void handleStatus(selected, "archived")}
                  disabled={isSaving || processingNotificationId === selected.id}
                  className="px-3 py-2 bg-red-700 text-white text-[10px] uppercase font-black tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Archive size={14} /> {processingNotificationId === selected.id ? "Archiving..." : "Archive"}
                </button>
              )}
              {relatedRoute(selected) && (
                <button
                  onClick={() => openRelated(selected)}
                  className="px-3 py-2 bg-orange-50 text-brand-orange border border-orange-200 text-[10px] uppercase font-black tracking-widest flex items-center gap-2"
                >
                  <ExternalLink size={14} /> Open Related
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
