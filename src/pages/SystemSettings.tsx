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
} from "../components/CommonUI.tsx";
import { settingsService } from "../services/settingsService.ts";
import { SystemSettings as SystemSettingsType } from "../types.ts";
import { optimizeImageToWebP } from "../utils/imageOptimizer.ts";
import { Upload, Trash2, Plus } from "lucide-react";
import { staffAuditService } from "../services/staffAuditService.ts";

export const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettingsType>({});
  const [isSaving, setIsSaving] = useState(false);
  const [logoStatus, setLogoStatus] = useState("");

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
      alert("Only image files are allowed.");
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
      alert("Settings saved successfully.");

      // Non-blocking staff audit logging
      try {
        void staffAuditService.logAction({
          eventType: "SYSTEM_SETTING_CHANGED",
          module: "settings",
          action: "Updated system settings",
          severity: "critical",
          afterSnapshot: settings,
        });
      } catch (auditErr) {
        console.error("Audit log failed", auditErr);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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
