/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorageAdapter } from "./storageService.ts";
import { SystemSettings } from "../types.ts";

const SETTINGS_KEY = "itred_system_settings";
const DEFAULT_RPN_PERFORMANCE_SETTINGS = {
  dailyOnboardingThreshold: 4,
  weeklyOnboardingThreshold: 20,
  monthlyOnboardingThreshold: 80,
  churnWarningPercent: 15,
  churnWarningRate: 15,
  recurringVendorRetentionTarget: 85,
  minimumRecurringRevenueTarget: 0,
  overdueVendorFollowUpDays: 2,
  inactiveAssignedVendorDays: 14,
  minimumCollectionRatePercent: 70,
  graceDaysBeforeWarning: 3,
  subscriptionDueWarningDays: 3,
  subscriptionOverdueEscalationDays: 2,
  enableThresholdAlerts: true,
  requireApprovalForThresholdChange: false,
  updatedAt: new Date().toISOString(),
};

export const settingsService = {
  getSettings: async (): Promise<SystemSettings> => {
    try {
      const data =
        await getStorageAdapter().getItem<SystemSettings>(SETTINGS_KEY);
      return {
        enableSessionTimeout: true,
        sessionTimeoutMinutes: 30,
        ...(data || {}),
        rpnPerformanceSettings: {
          ...DEFAULT_RPN_PERFORMANCE_SETTINGS,
          ...((data || {}).rpnPerformanceSettings || {}),
        },
      };
    } catch (e) {
      console.warn("Failed to get system settings", e);
      return {
        enableSessionTimeout: true,
        sessionTimeoutMinutes: 30,
        rpnPerformanceSettings: DEFAULT_RPN_PERFORMANCE_SETTINGS,
      };
    }
  },

  saveSettings: async (settings: SystemSettings): Promise<void> => {
    await getStorageAdapter().setItem(SETTINGS_KEY, {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  },

  uploadLogo: async (blob: Blob): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(
      storage,
      "system-assets/seigen-commerce/catalogue-logo.webp",
    );
    await uploadBytes(storageRef, blob, { contentType: "image/webp" });
    return await getDownloadURL(storageRef);
  },
};
