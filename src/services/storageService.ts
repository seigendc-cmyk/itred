/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { asArray } from "../utils/safeData";

// Storage Mode Switcher
export type StorageMode = "local" | "firebase";

export const storageConfig = {
  mode: (import.meta.env.VITE_STORAGE_MODE as StorageMode) || "firebase",
};

// Generic storage interface to keep services clean
export interface StorageAdapter {
  getItem: <T>(key: string) => Promise<T | null> | T | null;
  setItem: <T>(key: string, value: T) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
}

export const localStorageAdapter: StorageAdapter = {
  getItem: <T>(key: string): T | null => {
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
};

const APPEND_ONLY_KEYS = [
  "itred_activity_logs",
  "itred_whatsapp_activity_logs",
  "audit_logs",
  "staff_access_logs",
  "inventory_ledger",
  "pos_events",
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

export const firebaseAdapter: StorageAdapter = {
  getItem: async <T>(key: string): Promise<T | null> => {
    try {
      if (isSingletonKey(key)) {
        const docSnap = await getDoc(doc(db, key, "singleton"));
        if (docSnap.exists()) {
          return docSnap.data() as unknown as T;
        }
        return null;
      }

      const querySnapshot = await getDocs(collection(db, key));

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

      const arrayResult = Array.isArray(results) ? results : [];
      return arrayResult as unknown as T;
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
          const existingDocs = await getDocs(collection(db, key));
          existingDocs.forEach((docSnap) => {
            if (docSnap.id !== "singleton") {
              existingIds.add(docSnap.id);
            }
          });
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
              currentChunk.push({ ref: doc(db, key, id), type: "delete" });
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
          const docRef = doc(db, key, "singleton");
          await setDoc(docRef, cleanedValue);
        } else {
          const docId = resolveDocumentId(cleanedValue, key);
          if (!cleanedValue.createdAt) {
            cleanedValue.createdAt = now;
          }
          cleanedValue.updatedAt = now;
          cleanedValue.id = docId;
          const docRef = doc(db, key, docId);
          await setDoc(docRef, cleanedValue);
        }
      } else {
        console.warn(
          `Value for "${key}" is neither an array nor a plain object. Ignored.`,
        );
      }
    } catch (err) {
      console.error(`Firebase Error: Failed to set data for "${key}"`, err);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (isSingletonKey(key)) {
        await deleteDoc(doc(db, key, "singleton"));
      } else {
        const querySnapshot = await getDocs(collection(db, key));
        const chunks: any[][] = [];
        let currentChunk: any[] = [];

        querySnapshot.forEach((document) => {
          currentChunk.push({ ref: document.ref, type: "delete" });
          if (currentChunk.length >= 400) {
            chunks.push(currentChunk);
            currentChunk = [];
          }
        });

        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach((op) => batch.delete(op.ref));
          await batch.commit();
        }
      }
    } catch (err) {
      console.error(`Firebase Error: Failed to remove data for "${key}"`, err);
    }
  },
};

// Dynamically return the adapter based on environment variable
export const getStorageAdapter = (): StorageAdapter => {
  if (storageConfig.mode === "firebase") return firebaseAdapter;
  return localStorageAdapter;
};
