/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vendor } from "../types.ts";
import { asArray } from "../utils/safeData.ts";
import { getStorageAdapter } from "./storageService.ts";
import { analyticsService } from "./analyticsService.ts";

const VENDORS_KEY = "itred_vendors";

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
};
