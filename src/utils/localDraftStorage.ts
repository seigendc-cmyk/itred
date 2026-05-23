/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LocalDraftEnvelope<T> {
  value: T;
  updatedAt: string;
  source: "local_draft";
}

export const getDraft = <T,>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as
      | LocalDraftEnvelope<T>
      | { data?: T; updatedAt?: string }
      | null;
    if (!parsed) return null;
    if ("value" in parsed) return parsed.value;
    if ("data" in parsed) return parsed.data || null;
    return null;
  } catch {
    return null;
  }
};

export const getDraftUpdatedAt = (key: string): string | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { updatedAt?: string } | null;
    return parsed?.updatedAt || null;
  } catch {
    return null;
  }
};

export const saveDraft = <T,>(key: string, value: T): void => {
  const draft: LocalDraftEnvelope<T> = {
    value,
    updatedAt: new Date().toISOString(),
    source: "local_draft",
  };
  window.localStorage.setItem(key, JSON.stringify(draft));
};

export const clearDraft = (key: string): void => {
  window.localStorage.removeItem(key);
};

export const hasMeaningfulDraft = (value: any): boolean => {
  if (!value) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.values(value).some((item) => {
      if (typeof item === "string") return item.trim().length > 0;
      if (Array.isArray(item)) return item.length > 0;
      if (item && typeof item === "object") return Object.keys(item).length > 0;
      return item !== null && item !== undefined && item !== false;
    });
  }
  return true;
};
