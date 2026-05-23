/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import {
  CAHLink,
  PricingPlan,
  Subscription,
  Vendor,
} from "../types.ts";
import { db } from "../lib/firebase.ts";
import { asArray } from "../utils/safeData.ts";

export type CacheEnvelope<T> = {
  version: string;
  storedAt: number;
  expiresAt: number;
  data: T;
};

export interface MasterVendorSummary {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  tradingName?: string;
  sector?: string;
  category?: string;
  city?: string;
  cityTown?: string;
  suburb?: string;
  status?: string;
  planId?: string;
  planName?: string;
  subscriptionStatus?: string;
  updatedAt?: string;
}

export interface MasterVendorCatalogueStats {
  vendorId: string;
  vendorName: string;
  sector: string;
  category: string;
  city: string;
  suburb: string;
  planId: string;
  planName: string;
  productCount: number;
  billableProductCount: number;
  imageCount: number;
  catalogueCountThisPeriod: number;
  branchCount: number;
  staffCount: number;
  noticeCount: number;
  whatsappLinkCount: number;
  activeSubscriptionId: string;
  updatedAt: string;
}

export interface MasterDataCacheState {
  fromCache: boolean;
  refreshing: boolean;
  lastRefreshedAt?: number;
  error?: string;
}

type MasterCacheKey =
  | "vendors"
  | "vendorCatalogueStats"
  | "whatsappLinks"
  | "plans"
  | "subscriptions"
  | "sectors";

const DB_NAME = "itred_master_data_cache";
const STORE_NAME = "cache";
const VERSION = "2026-05-master-data-v1";
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const TINY_META_PREFIX = "itred_master_cache_meta:";
const CACHE_EVENT = "itred-master-data-cache-updated";

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

const normalise = (value?: string | null) => String(value || "").trim().toLowerCase();
const now = () => Date.now();
const cacheKey = (key: string) => key;
const linkFilterKey = (filter?: { sector?: string; category?: string; city?: string }) =>
  [normalise(filter?.sector), normalise(filter?.category), normalise(filter?.city)].join("|");

const openDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const dbRef = request.result;
      if (!dbRef.objectStoreNames.contains(STORE_NAME)) {
        dbRef.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

const readIndexed = async <T>(key: string): Promise<CacheEnvelope<T> | null> => {
  const dbRef = await openDb();
  if (!dbRef) return null;
  return new Promise((resolve) => {
    const tx = dbRef.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as CacheEnvelope<T>) || null);
    req.onerror = () => resolve(null);
  });
};

const writeIndexed = async <T>(key: string, envelope: CacheEnvelope<T>) => {
  const dbRef = await openDb();
  if (!dbRef) return;
  await new Promise<void>((resolve) => {
    const tx = dbRef.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(envelope, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

const deleteIndexed = async (key: string) => {
  const dbRef = await openDb();
  if (!dbRef) return;
  await new Promise<void>((resolve) => {
    const tx = dbRef.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

const setTinyMeta = (key: string, envelope: CacheEnvelope<unknown>) => {
  try {
    localStorage.setItem(
      `${TINY_META_PREFIX}${key}`,
      JSON.stringify({ storedAt: envelope.storedAt, expiresAt: envelope.expiresAt }),
    );
  } catch {
    // Tiny metadata is optional.
  }
};

const publish = (state: MasterDataCacheState) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CACHE_EVENT, { detail: state }));
};

const makeEnvelope = <T>(data: T, ttlMs = DEFAULT_TTL_MS): CacheEnvelope<T> => ({
  version: VERSION,
  storedAt: now(),
  expiresAt: now() + ttlMs,
  data,
});

const readCache = async <T>(key: string): Promise<CacheEnvelope<T> | null> => {
  const cached = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (cached) return cached;

  const indexed = await readIndexed<T>(key);
  if (indexed) memoryCache.set(key, indexed);
  return indexed;
};

const writeCache = async <T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS) => {
  const envelope = makeEnvelope(data, ttlMs);
  memoryCache.set(key, envelope);
  setTinyMeta(key, envelope);
  await writeIndexed(key, envelope);
  publish({ fromCache: false, refreshing: false, lastRefreshedAt: envelope.storedAt });
  return data;
};

const getFreshOrStale = async <T>(key: string): Promise<T[]> => {
  const envelope = await readCache<T[]>(key);
  return asArray<T>(envelope?.data);
};

const mapVendorSummary = (row: any): MasterVendorSummary => ({
  id: String(row.id || row.vendorId || ""),
  vendorId: String(row.vendorId || row.id || ""),
  vendorName: String(row.vendorName || row.name || row.tradingName || "Unnamed Vendor"),
  name: String(row.name || row.vendorName || row.tradingName || "Unnamed Vendor"),
  tradingName: row.tradingName,
  sector: row.sector,
  category: row.category || row.businessType,
  city: row.city || row.cityTown,
  cityTown: row.cityTown || row.city,
  suburb: row.suburb,
  status: row.status,
  planId: row.planId,
  planName: row.planName || row.plan,
  subscriptionStatus: row.subscriptionStatus,
  updatedAt: row.updatedAt,
});

const fetchVendors = async (): Promise<MasterVendorSummary[]> => {
  const snap = await getDocs(query(collection(db, "itred_vendors"), limit(2000)));
  return snap.docs.map((docSnap) => mapVendorSummary({ id: docSnap.id, ...docSnap.data() }));
};

const fetchVendorCatalogueStats = async (): Promise<MasterVendorCatalogueStats[]> => {
  const snap = await getDocs(query(collection(db, "vendorCatalogueStats"), limit(3000)));
  return snap.docs.map((docSnap) => {
    const row = docSnap.data() as any;
    return {
      vendorId: String(row.vendorId || docSnap.id),
      vendorName: String(row.vendorName || row.name || "Unnamed Vendor"),
      sector: String(row.sector || ""),
      category: String(row.category || ""),
      city: String(row.city || row.cityTown || ""),
      suburb: String(row.suburb || ""),
      planId: String(row.planId || ""),
      planName: String(row.planName || row.plan || ""),
      productCount: Number(row.productCount || 0),
      billableProductCount: Number(row.billableProductCount || row.productCount || 0),
      imageCount: Number(row.imageCount || 0),
      catalogueCountThisPeriod: Number(row.catalogueCountThisPeriod || row.catalogueCount || 0),
      branchCount: Number(row.branchCount || 0),
      staffCount: Number(row.staffCount || 0),
      noticeCount: Number(row.noticeCount || 0),
      whatsappLinkCount: Number(row.whatsappLinkCount || 0),
      activeSubscriptionId: String(row.activeSubscriptionId || ""),
      updatedAt: String(row.updatedAt || row.lastUpdatedAt || ""),
    };
  });
};

const fetchWhatsappLinks = async (
  filter?: { sector?: string; category?: string; city?: string },
): Promise<CAHLink[]> => {
  const constraints = [where("status", "==", "active")];
  if (filter?.sector) constraints.push(where("sector", "==", normalise(filter.sector)));
  if (filter?.category) constraints.push(where("category", "==", normalise(filter.category)));
  if (filter?.city) constraints.push(where("cityTown", "==", normalise(filter.city)));

  const snap = await getDocs(query(collection(db, "itred_cah_links"), ...constraints, limit(1000)));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as CAHLink);
};

const fetchPlans = async (): Promise<PricingPlan[]> => {
  const snap = await getDocs(query(collection(db, "pricingPlans"), limit(500)));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PricingPlan);
};

const fetchSubscriptions = async (): Promise<Subscription[]> => {
  const snap = await getDocs(
    query(collection(db, "itred_subscriptions"), where("status", "==", "active"), limit(3000)),
  );
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Subscription);
};

const fetchSectors = async (): Promise<Array<{ sector: string; category?: string }>> => {
  const stats = await fetchVendorCatalogueStats();
  const unique = new Map<string, { sector: string; category?: string }>();
  stats.forEach((row) => {
    const key = `${row.sector}|${row.category}`;
    if (row.sector && !unique.has(key)) unique.set(key, { sector: row.sector, category: row.category });
  });
  return Array.from(unique.values());
};

export const masterDataCacheService = {
  eventName: CACHE_EVENT,
  normalizeFilterValue: normalise,

  async bootstrap(): Promise<MasterDataCacheState> {
    const hasVendors = (await readCache<MasterVendorSummary[]>(cacheKey("vendors"))) !== null;
    publish({ fromCache: hasVendors, refreshing: true });

    void masterDataCacheService.refreshAll().catch((error) => {
      console.warn("Master data cache bootstrap refresh failed", error);
      publish({ fromCache: hasVendors, refreshing: false, error: String(error) });
    });

    return { fromCache: hasVendors, refreshing: true };
  },

  async getVendors(): Promise<MasterVendorSummary[]> {
    const cached = await getFreshOrStale<MasterVendorSummary>(cacheKey("vendors"));
    if (cached.length > 0) return cached;
    return masterDataCacheService.refreshVendors();
  },

  async getVendorCatalogueStats(): Promise<MasterVendorCatalogueStats[]> {
    const cached = await getFreshOrStale<MasterVendorCatalogueStats>(cacheKey("vendorCatalogueStats"));
    if (cached.length > 0) return cached;
    return masterDataCacheService.refreshVendorCatalogueStats();
  },

  async getWhatsappLinks(filter?: { sector?: string; category?: string; city?: string }): Promise<CAHLink[]> {
    const filteredKey = `whatsappLinks:${linkFilterKey(filter)}`;
    const cachedFiltered = await getFreshOrStale<CAHLink>(filteredKey);
    if (cachedFiltered.length > 0) return cachedFiltered;

    const allCached = await getFreshOrStale<CAHLink>(cacheKey("whatsappLinks"));
    const nSector = normalise(filter?.sector);
    const nCategory = normalise(filter?.category);
    const nCity = normalise(filter?.city);
    const filtered = allCached.filter((link: any) => {
      if (nSector && normalise(link.sector) !== nSector) return false;
      if (nCategory && normalise(link.category) !== nCategory) return false;
      if (nCity && normalise(link.cityTown || link.city) !== nCity) return false;
      return true;
    });
    if (filtered.length > 0) return filtered;

    return masterDataCacheService.refreshWhatsappLinks(filter);
  },

  async getPlans(): Promise<PricingPlan[]> {
    const cached = await getFreshOrStale<PricingPlan>(cacheKey("plans"));
    if (cached.length > 0) return cached;
    return masterDataCacheService.refreshPlans();
  },

  async getSubscriptions(): Promise<Subscription[]> {
    const cached = await getFreshOrStale<Subscription>(cacheKey("subscriptions"));
    if (cached.length > 0) return cached;
    return masterDataCacheService.refreshSubscriptions();
  },

  async refreshVendors() {
    return writeCache(cacheKey("vendors"), await fetchVendors());
  },

  async refreshVendorCatalogueStats() {
    return writeCache(cacheKey("vendorCatalogueStats"), await fetchVendorCatalogueStats());
  },

  async refreshWhatsappLinks(filter?: { sector?: string; category?: string; city?: string }) {
    const links = await fetchWhatsappLinks(filter);
    await writeCache(`whatsappLinks:${linkFilterKey(filter)}`, links, DEFAULT_TTL_MS);
    if (!filter?.sector && !filter?.category && !filter?.city) {
      await writeCache(cacheKey("whatsappLinks"), links, DEFAULT_TTL_MS);
    }
    return links;
  },

  async refreshPlans() {
    return writeCache(cacheKey("plans"), await fetchPlans(), 30 * 60 * 1000);
  },

  async refreshSubscriptions() {
    return writeCache(cacheKey("subscriptions"), await fetchSubscriptions(), 5 * 60 * 1000);
  },

  async refreshSectors() {
    return writeCache(cacheKey("sectors"), await fetchSectors(), 30 * 60 * 1000);
  },

  async refreshAll(): Promise<void> {
    publish({ fromCache: true, refreshing: true });
    await Promise.allSettled([
      masterDataCacheService.refreshVendors(),
      masterDataCacheService.refreshVendorCatalogueStats(),
      masterDataCacheService.refreshWhatsappLinks(),
      masterDataCacheService.refreshPlans(),
      masterDataCacheService.refreshSubscriptions(),
      masterDataCacheService.refreshSectors(),
    ]);
    publish({ fromCache: false, refreshing: false, lastRefreshedAt: now() });
  },

  async invalidate(key: MasterCacheKey | string): Promise<void> {
    memoryCache.delete(key);
    await deleteIndexed(key);
    try {
      localStorage.removeItem(`${TINY_META_PREFIX}${key}`);
    } catch {}
    publish({ fromCache: false, refreshing: false });
  },

  async invalidateVendor(vendorId: string): Promise<void> {
    await Promise.all([
      masterDataCacheService.invalidate("vendors"),
      masterDataCacheService.invalidate("vendorCatalogueStats"),
      masterDataCacheService.invalidate(`vendor:${vendorId}`),
      masterDataCacheService.invalidate("subscriptions"),
      masterDataCacheService.invalidate(`entitlement:${vendorId}`),
    ]);
  },

  async invalidateWhatsappLinks(): Promise<void> {
    memoryCache.forEach((_, key) => {
      if (key.startsWith("whatsappLinks")) memoryCache.delete(key);
    });
    await masterDataCacheService.invalidate("whatsappLinks");
  },
};
