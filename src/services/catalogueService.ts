import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  limit,
} from "firebase/firestore";
import type { QueryConstraint } from "firebase/firestore";
import {
  CAHLink,
  CatalogueGeneration,
  MasterProduct,
  Vendor,
  VendorProductOffer,
} from "../types";
import { asArray } from "../utils/safeData";
import { getStorageAdapter } from "./storageService";

const db = getFirestore();
const HISTORY_COLLECTION = "catalogueGenerations";
const VENDORS_COLLECTION = "itred_vendors";
const OFFERS_COLLECTION = "itred_vendor_product_offers";
const MASTER_PRODUCTS_COLLECTION = "itred_master_products";
const CAH_LINKS_COLLECTION = "itred_cah_links";
const VENDOR_STATS_COLLECTIONS = [
  "vendorCatalogueStats",
  "itred_vendor_catalogue_stats",
];
const QUERY_TIMEOUT_MS = 12000;
const FIRESTORE_IN_LIMIT = 10;

export interface VendorCatalogueStats {
  vendorId: string;
  vendorName: string;
  sector: string;
  category: string;
  city: string;
  suburb: string;
  plan: string;
  productCount: number;
  imageCount: number;
  catalogueCount: number;
  branchCount: number;
  staffCount: number;
  whatsappLinkCount: number;
  lastUpdatedAt: string;
}

export interface SelectedCataloguePayload {
  vendors: Vendor[];
  products: any[];
  masterProducts: MasterProduct[];
  vendorProductOffers: VendorProductOffer[];
}

export interface CatalogueExpiryMetrics {
  history: LightweightCatalogueHistoryRecord[];
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  checkedAt: string;
}

export type LightweightCatalogueHistoryRecord = Omit<
  CatalogueGeneration,
  "htmlContent"
>;

const getHistory = async (
  recordLimit = 100,
): Promise<LightweightCatalogueHistoryRecord[]> => {
  const q = query(
    collection(db, HISTORY_COLLECTION),
    orderBy("generatedAt", "desc"),
    limit(recordLimit),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d) => d.data() as LightweightCatalogueHistoryRecord,
  );
};

const withTimeout = async <T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = QUERY_TIMEOUT_MS,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            `${label} timed out after ${Math.round(timeoutMs / 1000)}s`,
          ),
        ),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const chunk = <T>(items: T[], size = FIRESTORE_IN_LIMIT): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    chunks.push(items.slice(i, i + size));
  return chunks;
};

const readCollection = async <T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> => {
  const q = constraints.length
    ? query(collection(db, collectionName), ...constraints)
    : query(collection(db, collectionName));
  const snapshot = await withTimeout(getDocs(q), collectionName);
  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as T);
};

const readLocalCollection = async <T>(collectionName: string): Promise<T[]> => {
  try {
    const data = await getStorageAdapter().getItem<T[]>(collectionName);
    return asArray<T>(data);
  } catch {
    return [];
  }
};

const readWhereIn = async <T>(
  collectionName: string,
  field: string,
  ids: string[],
): Promise<T[]> => {
  const cleanIds = Array.from(new Set(ids.filter(Boolean)));
  if (cleanIds.length === 0) return [];
  const groups = chunk(cleanIds);
  const results = await Promise.all(
    groups.map((group) =>
      readCollection<T>(collectionName, [where(field, "in", group)]),
    ),
  );
  return results.flat();
};

const activeCatalogueLink = (link: Partial<CAHLink> | any) => {
  const status = String(link?.status || "active").toLowerCase();
  const url =
    link?.whatsappCommunityLink ||
    link?.whatsappGroupLink ||
    link?.whatsappChannelLink ||
    link?.whatsappUrl ||
    link?.url ||
    link?.link ||
    "";
  return (
    status === "active" &&
    link?.showInCatalogue !== false &&
    String(url).trim().length > 0
  );
};

let activeLinksSessionCache: CAHLink[] | null = null;

const getActiveCahLinks = async (
  filters: {
    sector?: string;
    category?: string;
    city?: string;
  } = {},
): Promise<CAHLink[]> => {
  if (!activeLinksSessionCache) {
    try {
      activeLinksSessionCache = await readCollection<CAHLink>(
        CAH_LINKS_COLLECTION,
        [where("status", "==", "active")],
      );
    } catch (error) {
      console.warn("Active CAH link query failed, using local cache.", error);
      activeLinksSessionCache =
        await readLocalCollection<CAHLink>(CAH_LINKS_COLLECTION);
    }
    activeLinksSessionCache =
      activeLinksSessionCache.filter(activeCatalogueLink);
  }

  const sector = String(filters.sector || "")
    .trim()
    .toLowerCase();
  const category = String(filters.category || "")
    .trim()
    .toLowerCase();
  const city = String(filters.city || "")
    .trim()
    .toLowerCase();

  return activeLinksSessionCache.filter((link) => {
    const linkSector = String(link.sector || "")
      .trim()
      .toLowerCase();
    const linkCategory = String(link.category || "")
      .trim()
      .toLowerCase();
    const linkCity = String((link as any).cityTown || (link as any).city || "")
      .trim()
      .toLowerCase();
    if (
      sector &&
      linkSector &&
      linkSector !== sector &&
      linkSector !== "all sectors"
    )
      return false;
    if (
      category &&
      linkCategory &&
      linkCategory !== category &&
      linkCategory !== "all categories"
    )
      return false;
    if (city && linkCity && linkCity !== city) return false;
    return true;
  });
};

const getVendorCatalogueStats = async (
  filters: {
    sector?: string;
    category?: string;
    city?: string;
  } = {},
): Promise<VendorCatalogueStats[]> => {
  for (const statsCollection of VENDOR_STATS_COLLECTIONS) {
    try {
      const precomputed =
        await readCollection<VendorCatalogueStats>(statsCollection);
      const filtered = precomputed.filter((stat: any) => {
        if (filters.sector?.trim() && stat.sector !== filters.sector.trim())
          return false;
        if (
          filters.category?.trim() &&
          stat.category !== filters.category.trim()
        )
          return false;
        if (filters.city?.trim() && stat.city !== filters.city.trim())
          return false;
        return true;
      });
      if (filtered.length > 0) return filtered;
    } catch {
      // Precomputed stats are optional; fall through to derived lightweight stats.
    }
  }

  const constraints: QueryConstraint[] = [];
  if (filters.sector?.trim())
    constraints.push(where("sector", "==", filters.sector.trim()));
  if (filters.category?.trim())
    constraints.push(where("category", "==", filters.category.trim()));
  if (filters.city?.trim())
    constraints.push(where("cityTown", "==", filters.city.trim()));

  let vendors: Vendor[] = [];
  try {
    vendors = await readCollection<Vendor>(VENDORS_COLLECTION, constraints);
  } catch (error) {
    console.warn("Vendor summary query failed, using local cache.", error);
    vendors = await readLocalCollection<Vendor>(VENDORS_COLLECTION);
  }

  const activeVendors = vendors.filter(
    (vendor) => String(vendor.status || "active").toLowerCase() === "active",
  );
  const vendorIds = activeVendors.map((vendor) => vendor.id).filter(Boolean);

  const [offers, history, links] = await Promise.all([
    readWhereIn<VendorProductOffer>(
      OFFERS_COLLECTION,
      "vendorId",
      vendorIds,
    ).catch(() => []),
    getHistory(300).catch(() => []),
    getActiveCahLinks(filters).catch(() => []),
  ]);

  const offerStats = new Map<
    string,
    { productCount: number; imageCount: number; lastUpdatedAt: string }
  >();
  offers.forEach((offer: any) => {
    const stat = offerStats.get(offer.vendorId) || {
      productCount: 0,
      imageCount: 0,
      lastUpdatedAt: "",
    };
    if (offer.active !== false && offer.publishToCatalogue !== false) {
      stat.productCount += 1;
      if (offer.vendorProductImage || offer.imageUrl || offer.imageThumbUrl)
        stat.imageCount += 1;
    }
    const updatedAt = String(offer.updatedAt || offer.createdAt || "");
    if (updatedAt > stat.lastUpdatedAt) stat.lastUpdatedAt = updatedAt;
    offerStats.set(offer.vendorId, stat);
  });

  return activeVendors.map((vendor) => {
    const stats = offerStats.get(vendor.id) || {
      productCount: Number((vendor as any).productCount || 0),
      imageCount: Number((vendor as any).imageCount || 0),
      lastUpdatedAt: "",
    };
    return {
      vendorId: vendor.id,
      vendorName: vendor.tradingName || vendor.name || "Vendor",
      sector: vendor.sector || "",
      category: (vendor as any).category || vendor.businessType || "",
      city: vendor.cityTown || (vendor as any).city || "",
      suburb: vendor.suburb || "",
      plan: vendor.planId || (vendor as any).plan || "",
      productCount: stats.productCount,
      imageCount: stats.imageCount,
      catalogueCount: history.filter((item: any) =>
        (item.vendorIds || []).includes(vendor.id),
      ).length,
      branchCount: Number(
        (vendor as any).branchCount ?? vendor.branches?.length ?? 0,
      ),
      staffCount: Number(
        (vendor as any).staffCount ?? vendor.staff?.length ?? 0,
      ),
      whatsappLinkCount: links.filter((link) => {
        const sectorMatch =
          !link.sector || !vendor.sector || link.sector === vendor.sector;
        const cityMatch =
          !(link as any).cityTown ||
          !vendor.cityTown ||
          (link as any).cityTown === vendor.cityTown;
        return sectorMatch && cityMatch;
      }).length,
      lastUpdatedAt:
        stats.lastUpdatedAt || vendor.updatedAt || vendor.createdAt || "",
    };
  });
};

const getSelectedCataloguePayload = async (
  vendorIds: string[],
): Promise<SelectedCataloguePayload> => {
  const ids = Array.from(new Set(vendorIds.filter(Boolean)));
  if (ids.length === 0) {
    return {
      vendors: [],
      products: [],
      masterProducts: [],
      vendorProductOffers: [],
    };
  }

  let vendors: Vendor[] = [];
  let offers: VendorProductOffer[] = [];
  try {
    [vendors, offers] = await Promise.all([
      readWhereIn<Vendor>(VENDORS_COLLECTION, "id", ids),
      readWhereIn<VendorProductOffer>(OFFERS_COLLECTION, "vendorId", ids),
    ]);
  } catch (error) {
    console.warn(
      "Selected catalogue payload query failed, using local cache.",
      error,
    );
    const [allVendors, allOffers] = await Promise.all([
      readLocalCollection<Vendor>(VENDORS_COLLECTION),
      readLocalCollection<VendorProductOffer>(OFFERS_COLLECTION),
    ]);
    const selected = new Set(ids);
    vendors = allVendors.filter((vendor) => selected.has(vendor.id));
    offers = allOffers.filter((offer) => selected.has(offer.vendorId));
  }

  const masterIds = Array.from(
    new Set(offers.map((offer) => offer.productId).filter(Boolean)),
  );
  let masterProducts: MasterProduct[] = [];
  try {
    masterProducts = await readWhereIn<MasterProduct>(
      MASTER_PRODUCTS_COLLECTION,
      "id",
      masterIds,
    );
  } catch (error) {
    const allMasters = await readLocalCollection<MasterProduct>(
      MASTER_PRODUCTS_COLLECTION,
    );
    const selectedMasterIds = new Set(masterIds);
    masterProducts = allMasters.filter((master) =>
      selectedMasterIds.has(master.id),
    );
  }

  return {
    vendors,
    products: [],
    masterProducts,
    vendorProductOffers: offers,
  };
};

const saveLightweightHistoryRecord = async (
  record: LightweightCatalogueHistoryRecord,
): Promise<void> => {
  const { htmlContent, ...lightweightRecord } = record as any;
  const docRef = doc(db, HISTORY_COLLECTION, record.id);
  await setDoc(docRef, lightweightRecord, { merge: true });
};

const updateHistoryStatus = async (
  id: string,
  status: CatalogueGeneration["status"],
  extraData: Record<string, any> = {},
): Promise<void> => {
  const docRef = doc(db, HISTORY_COLLECTION, id);
  await updateDoc(docRef, {
    status,
    ...extraData,
    updatedAt: new Date().toISOString(),
  });
};

const deleteHistoryRecord = async (id: string): Promise<void> => {
  const docRef = doc(db, HISTORY_COLLECTION, id);
  await deleteDoc(docRef);
};

const cleanupOldHistory = async (
  retentionDays: number,
): Promise<{
  history: LightweightCatalogueHistoryRecord[];
  deletedCount: number;
}> => {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - retentionDays);

  const q = query(
    collection(db, HISTORY_COLLECTION),
    where("status", "==", "archived"),
  );

  const snapshot = await getDocs(q);
  const toDelete = snapshot.docs.filter((docToDelete) => {
    const generatedAt = docToDelete.data().generatedAt;
    const generatedAtDate =
      generatedAt && typeof generatedAt.toDate === "function"
        ? generatedAt.toDate()
        : new Date(generatedAt);

    return (
      !Number.isNaN(generatedAtDate.getTime()) &&
      generatedAtDate < retentionDate
    );
  });

  if (toDelete.length > 0) {
    const batch = writeBatch(db);
    toDelete.forEach((docToDelete) => batch.delete(docToDelete.ref));
    await batch.commit();
  }

  return { history: [], deletedCount: toDelete.length };
};

const checkExpirations = async (): Promise<CatalogueExpiryMetrics> => {
  const history = await getHistory();
  const today = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);

  const expired = history.filter((record: any) => {
    if (record.status === "expired") return true;
    if (!record.expiryDate) return false;
    const expiryDate = new Date(record.expiryDate);
    return !Number.isNaN(expiryDate.getTime()) && expiryDate < today;
  }).length;

  const expiringSoon = history.filter((record: any) => {
    if (!record.expiryDate) return false;
    const expiryDate = new Date(record.expiryDate);
    return (
      !Number.isNaN(expiryDate.getTime()) &&
      expiryDate >= today &&
      expiryDate <= soon
    );
  }).length;

  return {
    history,
    total: history.length,
    active: history.filter((record: any) =>
      ["generated", "deployed", "active"].includes(String(record.status || "")),
    ).length,
    expiringSoon,
    expired,
    checkedAt: new Date().toISOString(),
  };
};

export const catalogueService = {
  getHistory,
  getVendorCatalogueStats,
  getSelectedCataloguePayload,
  getActiveCahLinks,
  clearActiveCahLinksCache: () => {
    activeLinksSessionCache = null;
  },
  saveLightweightHistoryRecord,
  updateHistoryStatus,
  deleteHistoryRecord,
  cleanupOldHistory,
  cleanupOldCatalogueArchives: async (retentionDays = 21) => {
    const result = await cleanupOldHistory(retentionDays);
    return { ...result, retentionDays };
  },
  checkExpirations,
  markAsDeployed: async (id: string) =>
    updateHistoryStatus(id, "deployed", {
      deployedAt: new Date().toISOString(),
    }),
  archiveCatalogue: async (id: string) =>
    updateHistoryStatus(id, "archived", {
      archivedAt: new Date().toISOString(),
    }),
  redeployCatalogue: async (id: string) =>
    updateHistoryStatus(id, "deployed", {
      deployedAt: new Date().toISOString(),
    }),
  deleteCatalogue: deleteHistoryRecord,
  updateCatalogue: async (id: string, patch: Partial<CatalogueGeneration>) => {
    const docRef = doc(db, HISTORY_COLLECTION, id);
    await setDoc(
      docRef,
      { ...patch, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  },
  saveCatalogue: saveLightweightHistoryRecord,
};
