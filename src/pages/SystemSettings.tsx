/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  PageHeader,
  DataPanel,
  PrimaryButton,
  SecondaryButton,
  FormField,
  BrandedAlertModal,
} from "../components/CommonUI.tsx";
import { settingsService } from "../services/settingsService.ts";
import { SystemSettings as SystemSettingsType } from "../types.ts";
import { optimizeImageToWebP } from "../utils/imageUtils.ts";
import { Upload, Trash2, Plus } from "lucide-react";
import { staffAuditService } from "../services/staffAuditService.ts";
import { permissionService } from "../services/permissionService.ts";

const defaultRpnSettings = {
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

const defaultBiMarketSettings = {
  vendorReadinessTaskThreshold: 70,
  enableReadinessAutoTasks: true,
  readinessTaskCooldownDays: 3,
  averageLeadConversionRatePercent: 12,
  averageOrderValueUsd: 15,
  leadRevenueConfidenceFactor: 0.65,
};

export const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettingsType>({});
  const [isSaving, setIsSaving] = useState(false);
  const [logoStatus, setLogoStatus] = useState("");

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "seiGEN Commerce", message: "", type: "success" });

  const showBrandedAlert = (config: {
    title?: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
  }) => {
    setAlertConfig({ ...config, isOpen: true });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await settingsService.getSettings();
    setSettings(data);
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: "Only image files are allowed.",
        type: "warning",
      });
      return;
    }

    setLogoStatus("Optimizing...");
    try {
      const optimizedBlob = await optimizeImageToWebP(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.86,
      });
      setLogoStatus("Uploading...");
      const url = await settingsService.uploadLogo(optimizedBlob);
      setSettings((prev) => ({ ...prev, seigenLogoUrl: url }));
      setLogoStatus("Uploaded");
      setTimeout(() => setLogoStatus(""), 3000);
    } catch (error) {
      console.error("Logo upload failed", error);
      setLogoStatus("Failed");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsService.saveSettings(settings);
      const settingsToSave = { ...settings };
      if (!settingsToSave.rpnPerformanceSettings) {
        settingsToSave.rpnPerformanceSettings = defaultRpnSettings;
      }

      await settingsService.saveSettings(settingsToSave);
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: "Settings saved successfully.",
        type: "success",
      });

      // Non-blocking staff audit logging
      try {
        void staffAuditService.logAction({
          eventType: "SYSTEM_SETTING_CHANGED",
          module: "settings",
          action: "Updated session timeout settings",
          severity: "critical",
          beforeSnapshot: null,
          afterSnapshot: settingsToSave,
        });
      } catch (auditErr) {
        console.error("Audit log failed", auditErr);
      }
    } catch (e) {
      console.error(e);
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: "Failed to save settings.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <PageHeader
        title="System Settings"
        subtitle="Configure system-wide settings and preferences"
      />

      <DataPanel title="Global Catalogue Logo">
        <div className="p-6">
          <div className="flex gap-4 items-start flex-col sm:flex-row">
            <div className="w-24 h-24 bg-white border-2 border-stone-200 flex items-center justify-center overflow-hidden shrink-0 rounded-full">
              {settings.seigenLogoUrl ? (
                <img
                  src={settings.seigenLogoUrl}
                  className="w-full h-full object-contain"
                  alt="Logo"
                />
              ) : (
                <span className="text-[10px] uppercase font-bold text-stone-300 text-center">
                  Default
                  <br />
                  Logo
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2 w-full">
              <p className="text-xs text-stone-500 mb-2">
                This logo will appear in the top right corner of exported global
                catalogues.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className="inline-flex items-center gap-2 bg-brand-charcoal text-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-brand-orange transition-colors"
              >
                <Upload size={14} /> Upload Logo
              </label>
              {logoStatus && (
                <p className="text-xs font-bold text-brand-orange uppercase ml-2 inline-block">
                  {logoStatus}
                </p>
              )}
              {settings.seigenLogoUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, seigenLogoUrl: "" }))
                  }
                  className="block text-xs text-red-500 hover:text-red-700 uppercase font-bold mt-2 flex items-center gap-1"
                >
                  <Trash2 size={12} /> Remove Logo
                </button>
              )}
            </div>
          </div>
          <div className="mt-6 border-t border-stone-100 pt-6">
            <PrimaryButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </PrimaryButton>
          </div>
        </div>
      </DataPanel>

      <DataPanel title="RPN Performance Thresholds">
        <div className="p-6">
          {!permissionService.canSetRpnThresholds() && (
            <div className="mb-6 p-4 border-l-4 border-red-500 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-widest">
              You do not have permission to change RPN thresholds.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField label="Daily Onboarding Target">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings?.dailyOnboardingThreshold ??
                  defaultRpnSettings.dailyOnboardingThreshold
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      dailyOnboardingTarget: Number(e.target.value),
                      dailyOnboardingThreshold: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Weekly Onboarding Target">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings?.weeklyOnboardingThreshold ??
                  defaultRpnSettings.weeklyOnboardingThreshold
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      weeklyOnboardingTarget: Number(e.target.value),
                      weeklyOnboardingThreshold: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Monthly Onboarding Target">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings?.monthlyOnboardingThreshold ??
                  defaultRpnSettings.monthlyOnboardingThreshold
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      monthlyOnboardingTarget: Number(e.target.value),
                      monthlyOnboardingThreshold: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Minimum Active Vendor Retention %">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings
                    ?.minimumActiveVendorRetentionRate ??
                  defaultRpnSettings.minimumActiveVendorRetentionRate
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      minimumActiveVendorRetentionRate: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Bonus Eligibility Target %">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings
                    ?.bonusEligibilityTargetPercent ??
                  defaultRpnSettings.bonusEligibilityTargetPercent
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      bonusEligibilityTargetPercent: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Underperformance Alert Days">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings?.underperformanceAlertDays ??
                  defaultRpnSettings.underperformanceAlertDays
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      underperformanceAlertDays: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Churn Risk Threshold %">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings?.churnRiskThreshold ??
                  defaultRpnSettings.churnRiskThreshold
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      churnRiskThreshold: Number(e.target.value),
                      churnWarningPercent: Number(e.target.value),
                      churnWarningRate: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Minimum Revenue Contribution Target">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings
                    ?.minimumRevenueContributionTarget ??
                  defaultRpnSettings.minimumRevenueContributionTarget
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      minimumRevenueContributionTarget: Number(e.target.value),
                      minimumRecurringRevenueTarget: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Campaign Attribution Window Days">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings
                    ?.campaignAttributionWindowDays ??
                  defaultRpnSettings.campaignAttributionWindowDays
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      campaignAttributionWindowDays: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Churn Warning %">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings?.churnWarningPercent ??
                  defaultRpnSettings.churnWarningPercent
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      churnWarningPercent: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Minimum Collection Rate %">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings
                    ?.minimumCollectionRatePercent ??
                  defaultRpnSettings.minimumCollectionRatePercent
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      minimumCollectionRatePercent: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Grace Days Before Warning">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings?.graceDaysBeforeWarning ??
                  defaultRpnSettings.graceDaysBeforeWarning
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      graceDaysBeforeWarning: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Subscription Due Warning Days">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings?.subscriptionDueWarningDays ??
                  defaultRpnSettings.subscriptionDueWarningDays
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      subscriptionDueWarningDays: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Subscription Overdue Escalation Days">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings
                    ?.subscriptionOverdueEscalationDays ??
                  defaultRpnSettings.subscriptionOverdueEscalationDays
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      subscriptionOverdueEscalationDays: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Recurring Vendor Retention Target %">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings
                    ?.recurringVendorRetentionTarget ??
                  defaultRpnSettings.recurringVendorRetentionTarget
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      recurringVendorRetentionTarget: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <FormField label="Minimum Recurring Revenue Target">
              <input
                type="number"
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full disabled:bg-stone-100 disabled:text-stone-400"
                value={
                  settings.rpnPerformanceSettings
                    ?.minimumRecurringRevenueTarget ??
                  defaultRpnSettings.minimumRecurringRevenueTarget
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    rpnPerformanceSettings: {
                      ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                      minimumRecurringRevenueTarget: Number(e.target.value),
                    },
                  }))
                }
                disabled={!permissionService.canSetRpnThresholds()}
              />
            </FormField>

            <div className="flex items-center gap-4 pt-5">
              <label
                className={`flex items-center gap-2 text-xs font-bold uppercase ${permissionService.canSetRpnThresholds() ? "text-stone-600 cursor-pointer" : "text-stone-400 cursor-not-allowed"}`}
              >
                <input
                  type="checkbox"
                  checked={
                    settings.rpnPerformanceSettings?.enableThresholdAlerts ??
                    defaultRpnSettings.enableThresholdAlerts
                  }
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      rpnPerformanceSettings: {
                        ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                        enableThresholdAlerts: e.target.checked,
                      },
                    }))
                  }
                  className="accent-brand-orange w-4 h-4"
                  disabled={!permissionService.canSetRpnThresholds()}
                />
                Enable Threshold Alerts
              </label>
            </div>

            <div className="flex items-center gap-4 pt-5 md:col-span-2">
              <label
                className={`flex items-center gap-2 text-xs font-bold uppercase ${permissionService.canSetRpnThresholds() ? "text-stone-600 cursor-pointer" : "text-stone-400 cursor-not-allowed"}`}
              >
                <input
                  type="checkbox"
                  checked={
                    settings.rpnPerformanceSettings
                      ?.requireApprovalForThresholdChange ??
                    defaultRpnSettings.requireApprovalForThresholdChange
                  }
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      rpnPerformanceSettings: {
                        ...(prev.rpnPerformanceSettings || defaultRpnSettings),
                        requireApprovalForThresholdChange: e.target.checked,
                      },
                    }))
                  }
                  className="accent-brand-orange w-4 h-4"
                  disabled={!permissionService.canSetRpnThresholds()}
                />
                Require Approval for Threshold Changes
              </label>
            </div>
          </div>

          {permissionService.canSetRpnThresholds() && (
            <div className="mt-6 border-t border-stone-100 pt-6">
              <PrimaryButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </PrimaryButton>
            </div>
          )}
        </div>
      </DataPanel>

      <DataPanel title="BI Market Automation Settings">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField label="Vendor Readiness Task Threshold">
              <input
                type="number"
                value={
                  settings.vendorReadinessTaskThreshold ??
                  defaultBiMarketSettings.vendorReadinessTaskThreshold
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    vendorReadinessTaskThreshold: Number(e.target.value),
                  }))
                }
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full"
              />
            </FormField>
            <FormField label="Readiness Task Cooldown Days">
              <input
                type="number"
                value={
                  settings.readinessTaskCooldownDays ??
                  defaultBiMarketSettings.readinessTaskCooldownDays
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    readinessTaskCooldownDays: Number(e.target.value),
                  }))
                }
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full"
              />
            </FormField>
            <FormField label="Lead Conversion Rate %">
              <input
                type="number"
                value={
                  settings.averageLeadConversionRatePercent ??
                  defaultBiMarketSettings.averageLeadConversionRatePercent
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    averageLeadConversionRatePercent: Number(e.target.value),
                  }))
                }
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full"
              />
            </FormField>
            <FormField label="Average Order Value USD">
              <input
                type="number"
                value={
                  settings.averageOrderValueUsd ??
                  defaultBiMarketSettings.averageOrderValueUsd
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    averageOrderValueUsd: Number(e.target.value),
                  }))
                }
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full"
              />
            </FormField>
            <FormField label="Lead Revenue Confidence Factor">
              <input
                type="number"
                step="0.01"
                value={
                  settings.leadRevenueConfidenceFactor ??
                  defaultBiMarketSettings.leadRevenueConfidenceFactor
                }
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    leadRevenueConfidenceFactor: Number(e.target.value),
                  }))
                }
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full"
              />
            </FormField>
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-xs font-bold uppercase text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    settings.enableReadinessAutoTasks ??
                    defaultBiMarketSettings.enableReadinessAutoTasks
                  }
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableReadinessAutoTasks: e.target.checked,
                    }))
                  }
                  className="accent-brand-orange w-4 h-4"
                />
                Enable Readiness Auto Tasks
              </label>
            </div>
          </div>
          <div className="mt-6 border-t border-stone-100 pt-6">
            <PrimaryButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </PrimaryButton>
          </div>
        </div>
      </DataPanel>

      <DataPanel title="Security & Session Controls">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Session Timeout (minutes)">
              <input
                type="number"
                value={settings.sessionTimeoutMinutes ?? 30}
                onChange={(e) => {
                  const timeoutMinutes = Math.max(
                    1,
                    Math.min(1440, Number(e.target.value) || 30),
                  );
                  setSettings((prev) => ({
                    ...prev,
                    sessionTimeoutMinutes: timeoutMinutes,
                  }));
                }}
                className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full"
                min="1"
                max="1440"
              />
            </FormField>

            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-xs font-bold uppercase text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableSessionTimeout ?? true}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableSessionTimeout: e.target.checked,
                    }))
                  }
                  className="accent-brand-orange w-4 h-4"
                />
                Enable Session Timeout
              </label>
            </div>
          </div>
          <div className="mt-6 border-t border-stone-100 pt-6">
            <PrimaryButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </PrimaryButton>
          </div>
        </div>
      </DataPanel>

      <DataPanel title="Back-office WhatsApp Feedback Routes">
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-xs font-bold text-stone-500 uppercase mb-2">
              Default Feedback WhatsApp Number
            </label>
            <input
              type="text"
              value={settings.defaultFeedbackWhatsAppNumber || ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  defaultFeedbackWhatsAppNumber: e.target.value,
                }))
              }
              placeholder="e.g. +263772123456"
              className="border-2 border-stone-200 p-2 text-sm outline-none focus:border-brand-orange w-full max-w-md"
            />
          </div>

          <div className="mb-4 flex items-center justify-between border-t border-stone-100 pt-6">
            <h4 className="text-sm font-bold text-brand-charcoal uppercase">
              Configured Routes
            </h4>
            <SecondaryButton
              onClick={() => {
                setSettings((prev) => ({
                  ...prev,
                  feedbackWhatsAppRoutes: [
                    ...(prev.feedbackWhatsAppRoutes || []),
                    {
                      id: Date.now().toString(),
                      deskName: "",
                      whatsappNumber: "",
                      purpose: "DEFAULT",
                      sector: "",
                      category: "",
                      province: "",
                      cityTown: "",
                      isActive: true,
                      priority: 0,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                  ],
                }));
              }}
              size="sm"
            >
              <Plus size={14} className="mr-1" /> Add Route
            </SecondaryButton>
          </div>

          <div className="space-y-4">
            {(settings.feedbackWhatsAppRoutes || []).map((route) => (
              <div
                key={route.id}
                className="border border-stone-200 p-4 bg-stone-50 relative group"
              >
                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      feedbackWhatsAppRoutes:
                        prev.feedbackWhatsAppRoutes?.filter(
                          (r) => r.id !== route.id,
                        ),
                    }))
                  }
                  className="absolute top-4 right-4 text-red-500 hover:bg-red-50 p-1 opacity-50 group-hover:opacity-100 transition-opacity"
                  title="Delete Route"
                >
                  <Trash2 size={16} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-10">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                      Desk Name
                    </label>
                    <input
                      type="text"
                      value={route.deskName}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          feedbackWhatsAppRoutes:
                            prev.feedbackWhatsAppRoutes?.map((r) =>
                              r.id === route.id
                                ? {
                                    ...r,
                                    deskName: e.target.value,
                                    updatedAt: new Date().toISOString(),
                                  }
                                : r,
                            ),
                        }))
                      }
                      className="w-full border border-stone-200 p-2 text-xs outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      type="text"
                      value={route.whatsappNumber}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          feedbackWhatsAppRoutes:
                            prev.feedbackWhatsAppRoutes?.map((r) =>
                              r.id === route.id
                                ? {
                                    ...r,
                                    whatsappNumber: e.target.value,
                                    updatedAt: new Date().toISOString(),
                                  }
                                : r,
                            ),
                        }))
                      }
                      className="w-full border border-stone-200 p-2 text-xs outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                      Purpose
                    </label>
                    <select
                      value={route.purpose}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          feedbackWhatsAppRoutes:
                            prev.feedbackWhatsAppRoutes?.map((r) =>
                              r.id === route.id
                                ? {
                                    ...r,
                                    purpose: e.target.value as any,
                                    updatedAt: new Date().toISOString(),
                                  }
                                : r,
                            ),
                        }))
                      }
                      className="w-full border border-stone-200 p-2 text-xs outline-none focus:border-brand-orange bg-white"
                    >
                      <option value="DEFAULT">DEFAULT</option>
                      <option value="SURVEY_FEEDBACK">SURVEY FEEDBACK</option>
                      <option value="LEAD_FOLLOWUP">LEAD FOLLOWUP</option>
                      <option value="COMPLAINTS">COMPLAINTS</option>
                      <option value="CATALOGUE_IMPACT">CATALOGUE IMPACT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                      Sector (Optional)
                    </label>
                    <input
                      type="text"
                      value={route.sector || ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          feedbackWhatsAppRoutes:
                            prev.feedbackWhatsAppRoutes?.map((r) =>
                              r.id === route.id
                                ? {
                                    ...r,
                                    sector: e.target.value,
                                    updatedAt: new Date().toISOString(),
                                  }
                                : r,
                            ),
                        }))
                      }
                      className="w-full border border-stone-200 p-2 text-xs outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                      Category (Optional)
                    </label>
                    <input
                      type="text"
                      value={route.category || ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          feedbackWhatsAppRoutes:
                            prev.feedbackWhatsAppRoutes?.map((r) =>
                              r.id === route.id
                                ? {
                                    ...r,
                                    category: e.target.value,
                                    updatedAt: new Date().toISOString(),
                                  }
                                : r,
                            ),
                        }))
                      }
                      className="w-full border border-stone-200 p-2 text-xs outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-5 md:col-span-2 lg:col-span-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-600 uppercase cursor-pointer">
                      <input
                        type="checkbox"
                        checked={route.isActive}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            feedbackWhatsAppRoutes:
                              prev.feedbackWhatsAppRoutes?.map((r) =>
                                r.id === route.id
                                  ? {
                                      ...r,
                                      isActive: e.target.checked,
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : r,
                              ),
                          }))
                        }
                        className="accent-brand-orange w-4 h-4"
                      />
                      Active Route
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-600 uppercase">
                      Priority (Higher First)
                      <input
                        type="number"
                        value={route.priority}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            feedbackWhatsAppRoutes:
                              prev.feedbackWhatsAppRoutes?.map((r) =>
                                r.id === route.id
                                  ? {
                                      ...r,
                                      priority: parseInt(e.target.value) || 0,
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : r,
                              ),
                          }))
                        }
                        className="w-16 border border-stone-200 p-1 text-xs outline-none focus:border-brand-orange ml-2"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
            {(settings.feedbackWhatsAppRoutes || []).length === 0 && (
              <div className="text-center p-6 border-2 border-dashed border-stone-200 text-stone-400 text-xs uppercase font-bold tracking-widest">
                No routes configured. Using default number.
              </div>
            )}
          </div>
        </div>
      </DataPanel>
    </div>
  );
};
