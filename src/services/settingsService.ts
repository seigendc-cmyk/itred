/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorageAdapter } from "./storageService.ts";
import { SystemSettings } from "../types.ts";
import { CACHE_TTL, dataCacheService } from "./dataCacheService.ts";
import { readDiagnosticsService } from "./readDiagnosticsService.ts";

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
  rpnOnboardingCommissionAmount: 4.5,
  rpnRecurringCommissionPercent: 5,
  rpnRecurringCommissionAfterMonths: 0,
  rpnSalaryDropAfterMonths: 5,
  rpnPostSalaryRecurringCommissionPercent: 15,
  rpnCommissionCurrency: "USD",
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
    return dataCacheService.getOrFetch("system-settings", CACHE_TTL.SETTINGS, async () => {
    try {
      const data =
        await getStorageAdapter().getItem<SystemSettings>(SETTINGS_KEY);
      readDiagnosticsService.track("settingsService", SETTINGS_KEY, "getSettings", data ? 1 : 0);
      return {
        enableSessionTimeout: true,
        sessionTimeoutMinutes: 30,
        catalogueArchiveRetentionDays: 21,
        catalogueSupportTitle: "Need help with this catalogue?",
        catalogueSupportMessage:
          "Use vendor WhatsApp or call buttons for product questions. Contact seiGEN Commerce support if you cannot find a product, vendor, or working contact route.",
        customBusinessTypes: [],
        customSectors: [],
        customProductCategories: {},
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
        catalogueArchiveRetentionDays: 21,
        catalogueSupportTitle: "Need help with this catalogue?",
        catalogueSupportMessage:
          "Use vendor WhatsApp or call buttons for product questions. Contact seiGEN Commerce support if you cannot find a product, vendor, or working contact route.",
        customBusinessTypes: [],
        customSectors: [],
        customProductCategories: {},
        ...DEFAULT_BI_MARKET_SETTINGS,
        rpnPerformanceSettings: DEFAULT_RPN_PERFORMANCE_SETTINGS,
      };
    }
    });
  },

  saveSettings: async (settings: SystemSettings): Promise<void> => {
    await getStorageAdapter().setItem(SETTINGS_KEY, {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
    dataCacheService.clearCache("system-settings");
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
