/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { settingsService } from "./settingsService.ts";
import { asArray } from "../utils/safeData.ts";

export interface SectorOption {
  id: string;
  label: string;
  normalized: string;
  status: "active";
  categories: string[];
  aliases?: string[];
}

const SECTOR_CACHE_KEY = "itred_cache_sector_index";

const DEFAULT_SECTOR_LABELS = [
  "Motor Spares / Automotive",
  "Grocery",
  "Agriculture",
  "Vehicle Dealer",
  "Property Agent",
  "Leisure & Resort",
  "Hotels",
  "Education",
  "Hardware",
  "Computers & Phones",
  "Plumbing",
  "Professionals",
  "Jobbing Services",
  "Pharmacy",
  "Transport & Logistics",
  "Warehousing",
  "Clothing",
  "Spices",
  "Jewelry",
  "Perfumes",
  "Personal Care",
  "General Dealer",
];

const SECTOR_ALIASES: Record<string, string[]> = {
  "motor-spares-automotive": ["motor", "auto", "automotive", "spares", "car"],
  "computers-phones": ["computer", "computers", "phone", "phones", "mobile"],
  "personal-care": ["beauty", "care", "cosmetics", "personal"],
  perfumes: ["beauty", "fragrance", "scent"],
  pharmacy: ["chemist", "medicine", "medical"],
  "transport-logistics": ["transport", "delivery", "logistics", "fleet"],
  "property-agent": ["property", "estate", "real estate", "agent"],
  "leisure-resort": ["leisure", "resort", "holiday", "tourism"],
  "jobbing-services": ["services", "jobbing", "repair", "maintenance"],
};

export const normalizeSectorName = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const uniqueOptions = (options: SectorOption[]) => {
  const byKey = new Map<string, SectorOption>();
  options.forEach((option) => {
    if (!option.normalized) return;
    const existing = byKey.get(option.normalized);
    byKey.set(option.normalized, {
      ...option,
      categories: Array.from(
        new Set([...(existing?.categories || []), ...(option.categories || [])]),
      ).sort((a, b) => a.localeCompare(b)),
      aliases: Array.from(
        new Set([...(existing?.aliases || []), ...(option.aliases || [])]),
      ),
    });
  });
  return Array.from(byKey.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
};

const toSectorOption = (
  label: string,
  categories: string[] = [],
): SectorOption => {
  const normalized = normalizeSectorName(label);
  return {
    id: normalized,
    label: label.trim(),
    normalized,
    status: "active",
    categories,
    aliases: SECTOR_ALIASES[normalized] || [],
  };
};

export const sectorIndexService = {
  getCachedSectors(): SectorOption[] {
    try {
      const raw = window.localStorage.getItem(SECTOR_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { sectors?: SectorOption[] } | null;
      return Array.isArray(parsed?.sectors) ? parsed.sectors : [];
    } catch {
      return [];
    }
  },

  saveCachedSectors(sectors: SectorOption[]): void {
    try {
      window.localStorage.setItem(
        SECTOR_CACHE_KEY,
        JSON.stringify({
          sectors: uniqueOptions(sectors),
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Sector cache is an optional UI accelerator.
    }
  },

  getDefaultSectors(): SectorOption[] {
    return DEFAULT_SECTOR_LABELS.map((label) => toSectorOption(label));
  },

  getSectorsCacheFirst(): SectorOption[] {
    const cached = sectorIndexService.getCachedSectors();
    return cached.length > 0 ? cached : sectorIndexService.getDefaultSectors();
  },

  async refreshSectorsFromSource(): Promise<SectorOption[]> {
    const settings = await settingsService.getSettings();
    const customSectors = asArray<string>(settings.customSectors);
    const categoryMap = settings.customProductCategories || {};
    const labels = [...DEFAULT_SECTOR_LABELS, ...customSectors];
    const options = labels.map((label) =>
      toSectorOption(label, asArray<string>(categoryMap[label])),
    );
    const next = uniqueOptions(options);
    sectorIndexService.saveCachedSectors(next);
    return next;
  },

  getSectorOptions(): SectorOption[] {
    return sectorIndexService.getSectorsCacheFirst();
  },
};
