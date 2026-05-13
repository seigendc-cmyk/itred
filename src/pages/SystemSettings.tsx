/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { PageHeader, DataPanel, PrimaryButton } from "../components/CommonUI.tsx";
import { settingsService } from "../services/settingsService.ts";
import { SystemSettings as SystemSettingsType } from "../types.ts";
import { optimizeImageToWebP } from "../utils/imageOptimizer.ts";
import { Upload, Trash2 } from "lucide-react";

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
                  Default<br />Logo
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2 w-full">
              <p className="text-xs text-stone-500 mb-2">
                This logo will appear in the top right corner of exported global catalogues.
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
                  onClick={() => setSettings((prev) => ({ ...prev, seigenLogoUrl: "" }))}
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
    </div>
  );
};
