/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorageAdapter } from "./storageService.ts";
import { SystemSettings } from "../types.ts";

const SETTINGS_KEY = "itred_system_settings";
const DEFAULT_RPN_PERFORMANCE_SETTINGS = {
  dailyOnboardingTarget: 2,
  weeklyOnboardingTarget: 10,
  monthlyOnboardingTarget: 40,
  minimumActiveVendorRetentionRate: 85,
  bonusEligibilityTargetPercent: 100,
  underperformanceAlertDays: 3,
  churnRiskThreshold: 15,
  minimumRevenueContributionTarget: 0,
  campaignAttributionWindowDays: 14,
  dailyOnboardingThreshold: 2,
  weeklyOnboardingThreshold: 10,
  monthlyOnboardingThreshold: 40,
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

const DEFAULT_BI_MARKET_SETTINGS = {
  vendorReadinessTaskThreshold: 70,
  enableReadinessAutoTasks: true,
  readinessTaskCooldownDays: 3,
  averageLeadConversionRatePercent: 12,
  averageOrderValueUsd: 15,
  leadRevenueConfidenceFactor: 0.65,
};

export const settingsService = {
  getSettings: async (): Promise<SystemSettings> => {
    try {
      const data =
        await getStorageAdapter().getItem<SystemSettings>(SETTINGS_KEY);
      return {
        enableSessionTimeout: true,
        sessionTimeoutMinutes: 30,
        ...DEFAULT_BI_MARKET_SETTINGS,
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
        ...DEFAULT_BI_MARKET_SETTINGS,
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
