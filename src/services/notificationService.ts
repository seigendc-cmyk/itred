/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppNotification, NotificationStatus } from "../types.ts";

const STORAGE_KEY = "itred_notifications";

export const notificationService = {
  getNotifications(): AppNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to parse notifications", e);
      return [];
    }
  },

  addNotification(
    notif: Omit<AppNotification, "id" | "createdAt" | "status">,
  ): void {
    const notifications = this.getNotifications();

    const isDuplicate = notifications.some(
      (n) =>
        n.status === "OPEN" &&
        n.relatedRecordId === notif.relatedRecordId &&
        n.type === notif.type &&
        n.severity === notif.severity &&
        n.title === notif.title,
    );

    if (isDuplicate) return;

    const newNotif: AppNotification = {
      ...notif,
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };

    notifications.push(newNotif);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new Event("itred_notifications_updated"));
  },

  updateStatus(id: string, status: NotificationStatus): void {
    const notifications = this.getNotifications();
    const index = notifications.findIndex((n) => n.id === id);
    if (index >= 0) {
      notifications[index].status = status;
      if (status === "RESOLVED")
        notifications[index].resolvedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
      window.dispatchEvent(new Event("itred_notifications_updated"));
    }
  },

  toast(message: string, type: "success" | "info" = "success") {
    window.dispatchEvent(
      new CustomEvent("itred_toast", { detail: { message, type } }),
    );
  },

  notifySyncError(details: string) {
    this.addNotification({
      type: "SYSTEM",
      severity: "SYSTEM",
      title: "Firebase Sync Warning",
      message: `Data saved locally but not synced to Firebase. ${details}`,
      relatedModule: "Storage Engine",
    });
  },
};
