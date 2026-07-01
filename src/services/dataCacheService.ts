/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const LOCAL_PREFIX = "itred_data_cache:";

const shouldPersist = (key: string) =>
  key.includes("settings") ||
  key.includes("pricing") ||
  key.includes("plans") ||
  key.includes("roles");

const readLocal = <T>(key: string): CacheEntry<T> | null => {
  try {
    const raw = localStorage.getItem(`${LOCAL_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.timestamp !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeLocal = <T>(key: string, entry: CacheEntry<T>) => {
  if (!shouldPersist(key)) return;
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Cache persistence is optional.
  }
};

export const CACHE_TTL = {
  SETTINGS: 5 * 60 * 1000,
  PRICING_PLANS: 10 * 60 * 1000,
  ROLES: 5 * 60 * 1000,
  STAFF: 2 * 60 * 1000,
  VENDORS: 60 * 1000,
  PRODUCTS: 60 * 1000,
  NOTIFICATIONS: 30 * 1000,
} as const;

export const dataCacheService = {
  getCached<T>(key: string, ttlMs: number): T | null {
    const now = Date.now();
    const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memoryEntry && now - memoryEntry.timestamp <= ttlMs) {
      return memoryEntry.data;
    }

    const localEntry = readLocal<T>(key);
    if (localEntry && now - localEntry.timestamp <= ttlMs) {
      memoryCache.set(key, localEntry);
      return localEntry.data;
    }

    return null;
  },

  setCached<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    memoryCache.set(key, entry);
    writeLocal(key, entry);
  },

  clearCache(key?: string): void {
    if (key) {
      memoryCache.delete(key);
      try {
        localStorage.removeItem(`${LOCAL_PREFIX}${key}`);
      } catch {}
      return;
    }

    memoryCache.clear();
    try {
      Object.keys(localStorage)
        .filter((item) => item.startsWith(LOCAL_PREFIX))
        .forEach((item) => localStorage.removeItem(item));
    } catch {}
  },

  async getOrFetch<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const cached = dataCacheService.getCached<T>(key, ttlMs);
    if (cached !== null) {
      return cached;
    }
    try {
      const fresh = await fetcher();
      dataCacheService.setCached(key, fresh);
      return fresh;
    } catch (e) {
      const stale = readLocal<T>(key);
      if (stale) {
        console.warn(`Fetch failed for ${key}, using stale cache`, e);
        return stale.data;
      }
      throw e;
    }
  },
};
