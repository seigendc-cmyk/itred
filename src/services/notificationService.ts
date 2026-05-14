/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ITredNotification, NotificationStatus } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";

const STORAGE_KEY = "itred_notifications";

export const notificationService = {
  getAll: async (): Promise<ITredNotification[]> => {
    const data =
      await getStorageAdapter().getItem<ITredNotification[]>(STORAGE_KEY);
    return data || [];
  },

  getById: async (id: string): Promise<ITredNotification | undefined> => {
    const all = await notificationService.getAll();
    return all.find((n) => n.id === id);
  },

  create: async (notif: ITredNotification): Promise<void> => {
    const all = await notificationService.getAll();
    all.push(notif);
    await getStorageAdapter().setItem(STORAGE_KEY, all);
    window.dispatchEvent(new Event("itred_notifications_updated"));
  },

  updateStatus: async (
    id: string,
    status: NotificationStatus,
  ): Promise<void> => {
    const all = await notificationService.getAll();
    const index = all.findIndex((n) => n.id === id);
    if (index >= 0) {
      all[index].status = status;
      if (status === "resolved")
        all[index].resolvedAt = new Date().toISOString();
      if (status === "read") all[index].readAt = new Date().toISOString();
      await getStorageAdapter().setItem(STORAGE_KEY, all);
      window.dispatchEvent(new Event("itred_notifications_updated"));
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
    notif: Omit<ITredNotification, "id" | "createdAt" | "status">,
  ): Promise<void> => {
    const newNotif: ITredNotification = {
      ...notif,
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "unread",
      createdAt: new Date().toISOString(),
    };
    await notificationService.create(newNotif);
  },

  getUnreadNotifications: async (): Promise<ITredNotification[]> => {
    const all = await notificationService.getAll();
    return all.filter((n) => n.status === "unread");
  },

  markAsRead: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "read");
  },

  markAsResolved: async (id: string): Promise<void> => {
    await notificationService.updateStatus(id, "resolved");
  },

  getNotificationsForStaff: async (
    staffId: string,
  ): Promise<ITredNotification[]> => {
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
