/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from "../lib/firebase";
import {
  collection,
  documentId,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  limit,
  orderBy,
  query,
  startAfter,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { firebaseHealthService } from "./firebaseHealthService.ts";

// Storage Mode Switcher
export type StorageMode = "local" | "firebase";
export type ReadMode = "once" | "live";

export const storageConfig = {
  mode: (import.meta.env.VITE_STORAGE_MODE as StorageMode) || "firebase",
};

// Generic storage interface to keep services clean
export interface StorageAdapter {
  getItem: <T>(key: string, mode?: ReadMode) => Promise<T | null> | T | null;
  setItem: <T>(key: string, value: T) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
  batchSetItems?: <T>(collectionName: string, records: T[]) => Promise<void>;
  batchUpdateItems?: <T>(
    collectionName: string,
    records: Partial<T>[],
  ) => Promise<void>;
  batchDeleteRecords?: (collectionName: string, ids: string[]) => Promise<void>;
  subscribeCollection?: <T>(
    collectionName: string,
    callback: (data: T) => void,
  ) => () => void;
}

export const localStorageAdapter: StorageAdapter = {
  getItem: <T>(key: string, mode: ReadMode = "once"): T | null => {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      console.error(`Storage Error: Failed to parse key "${key}"`, err);
      return null;
    }
  },

  setItem: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Storage Error: Failed to set key "${key}"`, err);
    }
  },

  removeItem: (key: string): void => {
    localStorage.removeItem(key);
  },

  batchSetItems: async <T>(
    collectionName: string,
    records: T[],
  ): Promise<void> => {
    const existing =
      (await Promise.resolve(localStorageAdapter.getItem<any[]>(collectionName))) ||
      [];
    const next = [...existing];

    records.forEach((record: any) => {
      const idx = next.findIndex((r) => r.id === record.id);
      if (idx >= 0) next[idx] = record;
      else next.push(record);
    });

    localStorageAdapter.setItem(collectionName, next);
  },

  batchUpdateItems: async <T>(
    collectionName: string,
    records: Partial<T>[],
  ): Promise<void> => {
    const existing =
      (await Promise.resolve(localStorageAdapter.getItem<any[]>(collectionName))) ||
      [];

    records.forEach((record: any) => {
      const idx = existing.findIndex((r) => r.id === record.id);
      if (idx >= 0) existing[idx] = { ...existing[idx], ...record };
    });

    localStorageAdapter.setItem(collectionName, existing);
  },

  batchDeleteRecords: async (
    collectionName: string,
    ids: string[],
  ): Promise<void> => {
    const existing =
      (await Promise.resolve(localStorageAdapter.getItem<any[]>(collectionName))) ||
      [];

    localStorageAdapter.setItem(
      collectionName,
      existing.filter((r) => !ids.includes(r.id)),
    );
  },

  subscribeCollection: <T>(
    collectionName: string,
    callback: (data: T) => void,
  ) => {
    return () => {};
  },
};

const APPEND_ONLY_KEYS = [
  "itred_activity_logs",
  "itred_whatsapp_activity_logs",
  "audit_logs",
  "staff_access_logs",
  "inventory_ledger",
  "pos_events",
  "itred_staff_audit_logs",
];

const SINGLETON_KEYS = [
  "itred_system_settings",
  "itred_role_templates",
  "app_settings",
  "storage_config",
];

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

export function isSingletonKey(key: string): boolean {
  return SINGLETON_KEYS.includes(key);
}

export function isAppendOnlyCollectionKey(key: string): boolean {
  return APPEND_ONLY_KEYS.includes(key);
}

export function isListCollectionKey(key: string): boolean {
  return !isSingletonKey(key);
}

export function removeUndefinedDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item));
  }

  if (value instanceof Date) {
    return value;
  }

  if (isPlainObject(value)) {
    const cleaned: Record<string, any> = {};

    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) {
        cleaned[k] = removeUndefinedDeep(v);
      }
    });

    return cleaned;
  }

  return value;
}

export function resolveDocumentId(item: any, collectionKey: string): string {
  if (item.id) return item.id;
  if (item.uid) return item.uid;
  if (item.staffId) return item.staffId;
  if (item.vendorId) return item.vendorId;
  if (item.productId) return item.productId;
  if (item.planId) return item.planId;
  if (item.catalogueId) return item.catalogueId;
  if (item.storefrontId) return item.storefrontId;
  if (item.logId) return item.logId;
  if (item.activityId) return item.activityId;
  if (item.code) return item.code;

  return doc(collection(db, collectionKey)).id;
}

const activeListeners = new Map<string, Unsubscribe>();
const DEFAULT_COLLECTION_READ_LIMIT = 500;
const FIRESTORE_PAGE_SIZE = 400;

const collectionPageQuery = (
  key: string,
  pageSize = FIRESTORE_PAGE_SIZE,
  lastDocument?: any,
) =>
  lastDocument
    ? query(
        collection(db, key),
        orderBy(documentId()),
        startAfter(lastDocument),
        limit(pageSize),
      )
    : query(collection(db, key), orderBy(documentId()), limit(pageSize));

const readCollectionDocIdsPaged = async (key: string): Promise<Set<string>> => {
  const ids = new Set<string>();
  let lastDocument: any = null;

  while (true) {
    const snapshot = await getDocs(
      collectionPageQuery(key, FIRESTORE_PAGE_SIZE, lastDocument),
    );

    snapshot.forEach((docSnap) => {
      if (docSnap.id !== "singleton") ids.add(docSnap.id);
    });

    if (snapshot.size < FIRESTORE_PAGE_SIZE) break;

    lastDocument = snapshot.docs[snapshot.docs.length - 1];
  }

  return ids;
};

const readCollectionOnce = async <T>(collectionName: string): Promise<T> => {
  const snapshot = await getDocs(
    query(
      collection(db, collectionName),
      orderBy(documentId()),
      limit(DEFAULT_COLLECTION_READ_LIMIT),
    ),
  );

  const results: any[] = [];

  snapshot.forEach((docSnap) => {
    if (docSnap.id !== "singleton") {
      const data = docSnap.data();

      results.push({
        id: data.id || docSnap.id,
        ...data,
      });
    }
  });

  return results as unknown as T;
};

export const firebaseAdapter: StorageAdapter = {
  getItem: async <T>(
    key: string,
    mode: ReadMode = "once",
  ): Promise<T | null> => {
    try {
      if (isSingletonKey(key)) {
        const docSnap = await getDoc(doc(db, key, "singleton"));

        if (docSnap.exists()) {
          return docSnap.data() as unknown as T;
        }

        return null;
      }

      const querySnapshot = await getDocs(
        query(
          collection(db, key),
          orderBy(documentId()),
          limit(DEFAULT_COLLECTION_READ_LIMIT),
        ),
      );

      if (querySnapshot.empty) {
        return [] as unknown as T;
      }

      const results: any[] = [];

      querySnapshot.forEach((docSnap) => {
        if (docSnap.id === "singleton") {
          const data = docSnap.data();
          const keys = Object.keys(data);
          const isArrayLike =
            keys.length > 0 && keys.every((k) => !isNaN(Number(k)));

          if (isArrayLike) {
            Object.values(data).forEach((v) => {
              if (v && typeof v === "object") results.push(v);
            });
          }
        } else {
          const docData = docSnap.data();

          results.push({
            id: docData.id || docSnap.id,
            ...docData,
          });
        }
      });

      return results as unknown as T;
    } catch (err) {
      console.warn(`Firebase Error: Failed to get collection "${key}"`, err);
      return isSingletonKey(key) ? null : ([] as unknown as T);
    }
  },

  setItem: async <T>(key: string, value: T): Promise<void> => {
    try {
      if (value === null || value === undefined) {
        console.warn(
          `Attempted to save null or undefined to "${key}". Ignored.`,
        );
        return;
      }

      const now = new Date().toISOString();

      if (Array.isArray(value)) {
        if (isSingletonKey(key)) {
          console.warn(
            `Attempted to save an array to singleton key "${key}". Ignored.`,
          );
          return;
        }

        const isAppendOnly = isAppendOnlyCollectionKey(key);
        const existingIds = new Set<string>();

        if (!isAppendOnly) {
          const pagedExistingIds = await readCollectionDocIdsPaged(key);
          pagedExistingIds.forEach((id) => existingIds.add(id));
        }

        const incomingIds = new Set<string>();
        const chunks: any[][] = [];
        let currentChunk: any[] = [];

        value.forEach((item) => {
          if (isPlainObject(item)) {
            const cleanedItem = removeUndefinedDeep(item) as Record<
              string,
              any
            >;

            const docId = resolveDocumentId(cleanedItem, key);
            incomingIds.add(docId);

            if (!cleanedItem.createdAt) {
              cleanedItem.createdAt = now;
            }

            cleanedItem.updatedAt = now;
            cleanedItem.id = docId;

            const docRef = doc(db, key, docId);

            currentChunk.push({
              ref: docRef,
              data: cleanedItem,
              type: "set",
            });

            if (currentChunk.length >= 400) {
              chunks.push(currentChunk);
              currentChunk = [];
            }
          }
        });

        if (!isAppendOnly) {
          existingIds.forEach((id) => {
            if (!incomingIds.has(id)) {
              currentChunk.push({
                ref: doc(db, key, id),
                type: "delete",
              });

              if (currentChunk.length >= 400) {
                chunks.push(currentChunk);
                currentChunk = [];
              }
            }
          });
        }

        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);

          chunk.forEach((op) => {
            if (op.type === "set") {
              batch.set(op.ref, op.data);
            } else if (op.type === "delete") {
              batch.delete(op.ref);
            }
          });

          await batch.commit();
        }
      } else if (isPlainObject(value)) {
        const cleanedValue = removeUndefinedDeep(value) as Record<string, any>;

        if (isSingletonKey(key)) {
          await setDoc(doc(db, key, "singleton"), cleanedValue);
        } else {
          const docId = resolveDocumentId(cleanedValue, key);

          if (!cleanedValue.createdAt) {
            cleanedValue.createdAt = now;
          }

          cleanedValue.updatedAt = now;
          cleanedValue.id = docId;

          await setDoc(doc(db, key, docId), cleanedValue);
        }
      } else {
        console.warn(
          `Value for "${key}" is neither an array nor a plain object. Ignored.`,
        );
      }
    } catch (err) {
      console.error(`Firebase Error: Failed to set data for "${key}"`, err);
      throw err;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (isSingletonKey(key)) {
        await deleteDoc(doc(db, key, "singleton"));
      } else {
        let lastDocument: any = null;

        while (true) {
          const querySnapshot = await getDocs(
            collectionPageQuery(key, FIRESTORE_PAGE_SIZE, lastDocument),
          );

          if (querySnapshot.empty) break;

          const batch = writeBatch(db);

          querySnapshot.forEach((document) => {
            batch.delete(document.ref);
          });

          await batch.commit();

          if (querySnapshot.size < FIRESTORE_PAGE_SIZE) break;

          lastDocument = querySnapshot.docs[querySnapshot.docs.length - 1];
        }
      }
    } catch (err) {
      console.error(`Firebase Error: Failed to remove data for "${key}"`, err);
    }
  },

  batchSetItems: async <T>(
    collectionName: string,
    records: T[],
  ): Promise<void> => {
    const chunks: T[][] = [];
    let currentChunk: T[] = [];

    for (const record of records) {
      currentChunk.push(record);

      if (currentChunk.length >= 400) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) chunks.push(currentChunk);

    for (const chunk of chunks) {
      const batch = writeBatch(db);

      chunk.forEach((item: any) => {
        const cleanedItem = removeUndefinedDeep(item);
        const docId = resolveDocumentId(cleanedItem, collectionName);

        batch.set(
          doc(db, collectionName, docId),
          {
            ...cleanedItem,
            id: docId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      });

      await batch.commit();
    }
  },

  batchUpdateItems: async <T>(
    collectionName: string,
    records: Partial<T>[],
  ): Promise<void> => {
    const chunks: Partial<T>[][] = [];
    let currentChunk: Partial<T>[] = [];

    for (const record of records) {
      currentChunk.push(record);

      if (currentChunk.length >= 400) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) chunks.push(currentChunk);

    for (const chunk of chunks) {
      const batch = writeBatch(db);

      chunk.forEach((item: any) => {
        const cleanedItem = removeUndefinedDeep(item);
        const docId = resolveDocumentId(cleanedItem, collectionName);

        batch.update(doc(db, collectionName, docId), {
          ...cleanedItem,
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();
    }
  },

  batchDeleteRecords: async (
    collectionName: string,
    ids: string[],
  ): Promise<void> => {
    const chunks: string[][] = [];
    let currentChunk: string[] = [];

    for (const id of ids) {
      currentChunk.push(id);

      if (currentChunk.length >= 400) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) chunks.push(currentChunk);

    for (const chunk of chunks) {
      const batch = writeBatch(db);

      chunk.forEach((id) => {
        batch.delete(doc(db, collectionName, id));
      });

      await batch.commit();
    }
  },

  subscribeCollection: <T>(
    collectionName: string,
    callback: (data: T) => void,
  ) => {
    console.warn(`[Firestore Listener Warning] subscribeCollection was called for ${collectionName}!`);
    const existingListener = activeListeners.get(collectionName);

    if (existingListener) {
      console.info(
        `[Firestore Listener] Replacing existing listener for ${collectionName}`,
      );

      existingListener();
      activeListeners.delete(collectionName);
    }

    const readOnceFallback = async () => {
      try {
        console.warn(
          `[Firestore Listener] Falling back to getDocs() for ${collectionName}`,
        );

        const results = await readCollectionOnce<T>(collectionName);
        callback(results);
      } catch (fallbackError) {
        console.error(
          `[Firestore Listener] getDocs() fallback failed for ${collectionName}`,
          fallbackError,
        );

        firebaseHealthService.reportError(
          fallbackError,
          `subscribeCollectionFallback:${collectionName}`,
        );
      }
    };

    let unsub: Unsubscribe = () => {};

    try {
      unsub = onSnapshot(
        collection(db, collectionName),
        {
          next: (snapshot) => {
            const results: any[] = [];

            snapshot.forEach((docSnap) => {
              if (docSnap.id !== "singleton") {
                const data = docSnap.data();

                results.push({
                  id: data.id || docSnap.id,
                  ...data,
                });
              }
            });

            console.info(
              `[Firestore Listener] Loaded ${results.length} records from ${collectionName}`,
            );

            callback(results as unknown as T);
          },

          error: (error) => {
            console.error(
              `[Firestore Listener] Listen failed for ${collectionName}`,
              error,
            );

            firebaseHealthService.reportError(
              error,
              `subscribeCollection:${collectionName}`,
            );

            activeListeners.delete(collectionName);
            readOnceFallback();
          },
        },
      );

      activeListeners.set(collectionName, unsub);
    } catch (error) {
      console.error(
        `[Firestore Listener] Could not start listener for ${collectionName}`,
        error,
      );

      firebaseHealthService.reportError(
        error,
        `subscribeCollectionStart:${collectionName}`,
      );

      readOnceFallback();
    }

    return () => {
      try {
        unsub();
      } finally {
        activeListeners.delete(collectionName);

        console.info(
          `[Firestore Listener] Unsubscribed from ${collectionName}`,
        );
      }
    };
  },
};

// Dynamically return the adapter based on environment variable
export const getStorageAdapter = (): StorageAdapter => {
  if (storageConfig.mode === "firebase") return firebaseAdapter;
  return localStorageAdapter;
};