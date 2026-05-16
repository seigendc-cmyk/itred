/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ITredNotification, NotificationStatus } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { staffAuditService } from "./staffAuditService.ts";

const STORAGE_KEY = "itred_notifications";

const safeNotifications = (
  value: ITredNotification[] | null | undefined,
): ITredNotification[] => (Array.isArray(value) ? value : []);

const severityFromPriority = (
  priority: ITredNotification["priority"],
): "info" | "warning" | "high" | "critical" => {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  if (priority === "medium") return "warning";
  return "info";
};

const actionForStatus = (status: NotificationStatus) => {
  if (status === "read") return "Marked notification read";
  if (status === "unread") return "Marked notification unread";
  if (status === "resolved") return "Marked notification resolved";
  if (status === "archived" || status === "dismissed")
    return "Marked notification archived";
  return "Updated notification";
};

export const notificationService = {
  getAll: async (): Promise<ITredNotification[]> => {
    try {
      const data =
        await getStorageAdapter().getItem<ITredNotification[]>(STORAGE_KEY);
      return safeNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications", error);
      return [];
    }
  },

  getById: async (id: string): Promise<ITredNotification | undefined> => {
    const all = await notificationService.getAll();
    return all.find((n) => n.id === id);
  },

  create: async (notif: ITredNotification): Promise<void> => {
    const all = await notificationService.getAll();
    await getStorageAdapter().setItem(STORAGE_KEY, [
      ...all.filter((n) => n.id !== notif.id),
      notif,
    ]);
    window.dispatchEvent(new Event("itred_notifications_updated"));
  },

  updateStatus: async (
    id: string,
    status: NotificationStatus,
  ): Promise<void> => {
    const all = await notificationService.getAll();
    const index = all.findIndex((n) => n.id === id);
    if (index >= 0) {
      const before = all[index];
      const now = new Date().toISOString();
      all[index] = {
        ...before,
        status,
        updatedAt: now,
        readAt: status === "read" ? now : before.readAt,
        resolvedAt: status === "resolved" ? now : before.resolvedAt,
        archivedAt:
          status === "archived" || status === "dismissed"
            ? now
            : before.archivedAt,
      };
      await getStorageAdapter().setItem(STORAGE_KEY, all);
      window.dispatchEvent(new Event("itred_notifications_updated"));

      void staffAuditService.logAction({
        eventType: "NOTIFICATION_UPDATED",
        module: "notifications",
        severity: severityFromPriority(before.priority),
        action: actionForStatus(status),
        recordType: before.recordType,
        recordId: before.recordId,
        recordName: before.title,
        beforeSnapshot: before,
        afterSnapshot: all[index],
      });
    }
  },

  delete: async (id: string): Promise<void> => {
    const all = await notificationService.getAll();
    await getStorageAdapter().setItem(
      STORAGE_KEY,
      all.filter((n) => n.id !== id),
    );
    window.dispatchEvent(new Event("itred_notifications_updated"));
  },

  createNotification: async (
    notif: Omit<ITredNotification, "id" | "createdAt" | "updatedAt" | "status">,
  ): Promise<void> => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const dedupeKey =
        notif.dedupeKey ||
        `${notif.type}:${notif.recordType}:${notif.recordId}:${today}`;

      const all = await notificationService.getAll();
      const exists = all.some(
        (n) =>
          n.dedupeKey === dedupeKey &&
          n.createdAt?.startsWith(today) &&
          n.status !== "archived" &&
          n.status !== "dismissed",
      );

      if (exists) return; // Deduplicate identical alerts for today

      const now = new Date().toISOString();
      const newNotif: ITredNotification = {
        ...notif,
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: "unread",
        dedupeKey,
        createdAt: now,
        updatedAt: now,
      };
      await notificationService.create(newNotif);
    } catch (error) {
      console.error("Failed to safely create notification:", error);
    }
  },

  getUnreadNotifications: async (): Promise<ITredNotification[]> => {
    const all = await notificationService.getAll();
    return all.filter((n) => n.status === "unread");
  },

  markAsRead: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "read");
  },

  markRead: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "read");
  },

  markUnread: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "unread");
  },

  markAsResolved: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "resolved");
  },

  resolve: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "resolved");
  },

  archive: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "archived");
  },

  dismissNotification: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "archived");
  },

  getNotificationsForStaff: async (
    staffId: string,
  ): Promise<ITredNotification[]> => {
    const all = await notificationService.getAll();
    return all.filter((n) => n.assignedToStaffId === staffId);
  },

  getByStaff: async (staffId: string): Promise<ITredNotification[]> => {
    const all = await notificationService.getAll();
    return all.filter((n) => n.assignedToStaffId === staffId);
  },

  toast(message: string, type: "success" | "info" = "success") {
    window.dispatchEvent(
      new CustomEvent("itred_toast", { detail: { message, type } }),
    );
  },

  notifySyncError: async (details: string) => {
    await notificationService.createNotification({
      type: "system_alert",
      priority: "high",
      title: "Firebase Sync Warning",
      message: `Data saved locally but not synced to Firebase. ${details}`,
      recordType: "Storage Engine",
      recordId: "sync_error",
    });
  },
};
