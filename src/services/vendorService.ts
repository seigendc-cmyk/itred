/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vendor } from "../types.ts";
import { asArray } from "../utils/safeData.ts";
import { getStorageAdapter } from "./storageService.ts";
import { analyticsService } from "./analyticsService.ts";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase.ts";
import { notificationService } from "./notificationService.ts";
import { settingsService } from "./settingsService.ts";

const VENDORS_KEY = "itred_vendors";

const dayMs = 24 * 60 * 60 * 1000;
const dateKey = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const assignedRpnId = (vendor: Vendor) =>
  vendor.rpnId ||
  vendor.assignedRPNId ||
  vendor.assignedStaffId ||
  vendor.onboardedByStaffId ||
  "";

export const vendorService = {
  getVendors: async (): Promise<Vendor[]> => {
    try {
      const data = await getStorageAdapter().getItem<Vendor[]>(VENDORS_KEY);
      return asArray<Vendor>(data);
    } catch (error) {
      console.warn("Firebase Error: Failed to get vendors", error);
      return [];
    }
  },

  generateSystemCode: (vendors: Vendor[]): string => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `ITR-VEN-${yearMonth}`;

    const relevantVendors = vendors.filter((v) =>
      v.systemCode?.startsWith(prefix),
    );
    let maxId = 0;

    relevantVendors.forEach((v) => {
      const parts = v.systemCode.split("-");
      const num = parseInt(parts[parts.length - 1]);
      if (!isNaN(num) && num > maxId) maxId = num;
    });

    return `${prefix}-${String(maxId + 1).padStart(4, "0")}`;
  },

  migrateVendors: async (): Promise<void> => {
    const vendors = await vendorService.getVendors();
    let changed = false;

    for (const v of vendors) {
      if (!v.systemCode) {
        v.systemCode = vendorService.generateSystemCode(vendors);
        changed = true;

        await analyticsService.logEvent({
          eventType: "VENDOR_SYSTEM_CODE_GENERATED",
          actorType: "system",
          actorName: "Migration Helper",
          vendorId: v.id,
          vendorName: v.name,
          details: { systemCode: v.systemCode, reason: "migration" },
        });
      }
    }

    if (changed) {
      await vendorService.saveVendors(vendors);
    }
  },

  saveVendors: async (vendors: Vendor[]): Promise<void> => {
    await getStorageAdapter().setItem(VENDORS_KEY, vendors);
  },

  getVendorById: async (id: string): Promise<Vendor | undefined> => {
    const vendors = await vendorService.getVendors();
    return vendors.find((v) => v.id === id);
  },

  updateVendor: async (vendor: Vendor): Promise<void> => {
    console.log("Saving vendor to itred_vendors");
    try {
      const vendors = await vendorService.getVendors();
      const index = vendors.findIndex((v) => v.id === vendor.id);
      const oldVendor = index >= 0 ? vendors[index] : null;

      if (index >= 0) {
        vendors[index] = vendor;

        if (
          oldVendor &&
          oldVendor.assignedRPNId !== vendor.assignedRPNId &&
          vendor.assignedRPNId
        ) {
          await analyticsService.logEvent({
            eventType: "VENDOR_ASSIGNED_TO_RPN",
            actorType: "admin",
            actorName: "System Admin",
            vendorId: vendor.id,
            vendorName: vendor.name,
            details: { rpnId: vendor.assignedRPNId },
          });
        }

        // Check subscription status changes
        if (
          oldVendor &&
          oldVendor.subscriptionStatus !== vendor.subscriptionStatus
        ) {
          if (vendor.subscriptionStatus === "due") {
            await analyticsService.logEvent({
              eventType: "SUBSCRIPTION_DUE",
              actorType: "system",
              actorName: "Subscription Engine",
              vendorId: vendor.id,
              vendorName: vendor.name,
              details: { status: "due" },
            });
          } else if (vendor.subscriptionStatus === "overdue") {
            await analyticsService.logEvent({
              eventType: "SUBSCRIPTION_OVERDUE",
              actorType: "system",
              actorName: "Subscription Engine",
              vendorId: vendor.id,
              vendorName: vendor.name,
              details: { status: "overdue" },
            });
          }
        }
      } else {
        if (!vendor.systemCode) {
          vendor.systemCode = vendorService.generateSystemCode(vendors);
          await analyticsService.logEvent({
            eventType: "VENDOR_SYSTEM_CODE_GENERATED",
            actorType: "admin",
            actorName: "System Admin",
            vendorId: vendor.id,
            vendorName: vendor.name,
            details: {
              systemCode: vendor.systemCode,
              reason: "new_registration",
            },
          });
        }
        vendors.push(vendor);
        await analyticsService.logEvent({
          eventType: "VENDOR_CREATED",
          actorType: "admin",
          actorName: "System Admin",
          vendorId: vendor.id,
          vendorName: vendor.name,
          details: { name: vendor.name, tradingName: vendor.tradingName },
        });
      }
      await vendorService.saveVendors(vendors);
      console.log("Vendor saved successfully");
    } catch (error) {
      console.error("Vendor save failed", error);
      throw error;
    }
  },

  deleteVendor: async (id: string): Promise<void> => {
    const vendors = await vendorService.getVendors();
    const filtered = vendors.filter((v) => v.id !== id);
    await vendorService.saveVendors(filtered);
  },

  uploadVendorLogo: async (vendorId: string, file: Blob): Promise<string> => {
    const storageRef = ref(storage, `vendor-assets/${vendorId}/logo.webp`);
    await uploadBytes(storageRef, file, { contentType: "image/webp" });
    return getDownloadURL(storageRef);
  },

  uploadVendorBanner: async (vendorId: string, file: Blob): Promise<string> => {
    const storageRef = ref(storage, `vendor-assets/${vendorId}/banner.webp`);
    await uploadBytes(storageRef, file, { contentType: "image/webp" });
    return getDownloadURL(storageRef);
  },

  evaluateSubscriptionRpnAlerts: async (): Promise<void> => {
    const [vendors, settings] = await Promise.all([
      vendorService.getVendors(),
      settingsService.getSettings(),
    ]);
    const rpnSettings = settings.rpnPerformanceSettings;
    const subscriptionDueWarningDays =
      rpnSettings?.subscriptionDueWarningDays ?? 3;
    const subscriptionOverdueEscalationDays =
      rpnSettings?.subscriptionOverdueEscalationDays ?? 2;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    await Promise.all(
      vendors
        .filter((vendor) =>
          ["active", "due", "overdue", "trial", "paid"].includes(
            String(vendor.subscriptionStatus || ""),
          ),
        )
        .map(async (vendor) => {
          const dueDateKey = dateKey(vendor.subscriptionDueDate);
          if (!dueDateKey) return;

          const rpnId = assignedRpnId(vendor);
          const dueDate = new Date(dueDateKey);
          const diffDays = Math.ceil(
            (dueDate.getTime() - new Date(todayStr).getTime()) / dayMs,
          );
          const overdueDays = Math.max(0, -diffDays);

          if (
            rpnId &&
            diffDays >= 0 &&
            diffDays <= subscriptionDueWarningDays
          ) {
            await notificationService.createNotification({
              type: "subscription_due",
              priority: diffDays === 0 ? "high" : "medium",
              title: "Vendor Subscription Due Soon",
              message: `${vendor.name} subscription is due on ${dueDateKey}. Follow up before expiry.`,
              recordType: "vendor_subscription",
              recordId: vendor.id,
              assignedToStaffId: rpnId,
              assignedToName: vendor.rpnName,
              targetRole: "Collections Desk",
              dedupeKey: `subscription_due:${vendor.id}:${dueDateKey}`,
            });
          }

          if (overdueDays >= subscriptionOverdueEscalationDays) {
            const overdueStage =
              overdueDays >= subscriptionOverdueEscalationDays + 7
                ? "critical"
                : "manager";
            await notificationService.createNotification({
              type: "subscription_overdue",
              priority: overdueStage === "critical" ? "critical" : "high",
              title: "Assigned Vendor Overdue",
              message: `${vendor.name} is ${overdueDays} days overdue. RPN follow-up required; mark as retention risk.`,
              recordType: "vendor_subscription",
              recordId: vendor.id,
              assignedToStaffId: overdueStage === "critical" ? undefined : rpnId,
              assignedToName: overdueStage === "critical" ? undefined : vendor.rpnName,
              targetRole:
                overdueStage === "critical" ? "Admin" : "RPN Manager",
              dedupeKey: `subscription_overdue:${vendor.id}:${dueDateKey}:${overdueStage}`,
            });
          }
        }),
    );
  },
};
