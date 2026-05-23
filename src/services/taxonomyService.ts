/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { settingsService } from "./settingsService.ts";
import { vendorService } from "./vendorService.ts";
import { productService } from "./productService.ts";
import { DEFAULT_SECTORS } from "../utils/classificationOptions.ts";
import { asArray } from "../utils/safeData.ts";
import { MasterProduct, Vendor } from "../types.ts";

const normalize = (value: string) => value.trim();

const uniqueSorted = (values: Array<string | undefined | null>) =>
  Array.from(
    new Set(values.map((value) => normalize(value || "")).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

export const taxonomyService = {
  getSectors: async (): Promise<string[]> => {
    const [settings, vendors, products] = await Promise.all([
      settingsService.getSettings(),
      Promise.resolve(vendorService.getVendors()).catch(() => []),
      productService.getMasterProducts().catch(() => []),
    ]);

    return uniqueSorted([
      ...DEFAULT_SECTORS,
      ...asArray<string>(settings.customSectors),
      ...asArray<Vendor>(vendors).map((vendor) => vendor.sector),
      ...asArray<MasterProduct>(products).map((product) => product.sector),
    ]);
  },

  addSector: async (sector: string): Promise<string[]> => {
    const value = normalize(sector);
    if (!value) return taxonomyService.getSectors();

    const settings = await settingsService.getSettings();
    const current = asArray<string>(settings.customSectors);
    const exists = current.some(
      (item) => item.trim().toLowerCase() === value.toLowerCase(),
    );
    const next = exists ? current : [...current, value];
    await settingsService.saveSettings({ ...settings, customSectors: next });
    return taxonomyService.getSectors();
  },

  getCategoriesBySector: async (sector: string): Promise<string[]> => {
    const selectedSector = normalize(sector);
    const [settings, products] = await Promise.all([
      settingsService.getSettings(),
      productService.getMasterProducts().catch(() => []),
    ]);

    return uniqueSorted([
      ...asArray<MasterProduct>(products)
        .filter((product) => !selectedSector || product.sector === selectedSector)
        .map((product) => product.category),
      ...asArray<string>(settings.customProductCategories?.[selectedSector]),
    ]);
  },

  addCategory: async (sector: string, category: string): Promise<string[]> => {
    const selectedSector = normalize(sector);
    const value = normalize(category);
    if (!selectedSector || !value) return taxonomyService.getCategoriesBySector(selectedSector);

    const settings = await settingsService.getSettings();
    const current = asArray<string>(
      settings.customProductCategories?.[selectedSector],
    );
    const exists = current.some(
      (item) => item.trim().toLowerCase() === value.toLowerCase(),
    );
    const customProductCategories = {
      ...(settings.customProductCategories || {}),
      [selectedSector]: exists ? current : [...current, value],
    };

    await settingsService.saveSettings({
      ...settings,
      customProductCategories,
    });
    return taxonomyService.getCategoriesBySector(selectedSector);
  },
};
