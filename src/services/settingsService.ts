/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorageAdapter } from "./storageService.ts";
import { SystemSettings } from "../types.ts";

const SETTINGS_KEY = "itred_system_settings";

export const settingsService = {
  getSettings: async (): Promise<SystemSettings> => {
    try {
      const data =
        await getStorageAdapter().getItem<SystemSettings>(SETTINGS_KEY);
      return data || {};
    } catch (e) {
      console.warn("Failed to get system settings", e);
      return {};
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
