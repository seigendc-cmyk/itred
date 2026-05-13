/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WhatsAppSource } from "../types.ts";

const STORAGE_KEY = "itred_whatsapp_sources";

const removeUndefinedDeep = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(removeUndefinedDeep);
  if (obj !== null && typeof obj === "object") {
    const cleaned: any = {};
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== undefined) cleaned[k] = removeUndefinedDeep(v);
    });
    return cleaned;
  }
  return obj;
};

export const whatsappSourceService = {
  getSources(): WhatsAppSource[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to parse whatsapp sources", e);
      return [];
    }
  },

  saveSource(source: WhatsAppSource): void {
    const sources = this.getSources();
    const existingIndex = sources.findIndex((s) => s.id === source.id);
    const cleanSource = removeUndefinedDeep(source);

    if (existingIndex >= 0) {
      sources[existingIndex] = {
        ...cleanSource,
        updatedAt: new Date().toISOString(),
      };
    } else {
      sources.push(cleanSource);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  },

  updateSource(source: WhatsAppSource): void {
    this.saveSource(source);
  },

  deleteSource(id: string): void {
    const sources = this.getSources();
    const filtered = sources.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  searchSources(query: string): WhatsAppSource[] {
    const sources = this.getSources();
    if (!query || !query.trim()) return sources;

    const terms = query
      .toLowerCase()
      .split(" ")
      .filter((t) => t.length > 0);
    return sources.filter((s) => {
      const text = [
        s.communityName,
        s.sourceName,
        s.sector,
        s.category,
        s.province,
        s.cityTown,
        s.district,
        s.whatsappUrl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return terms.every((term) => text.includes(term));
    });
  },
};
