import { staffAuditService } from "./staffAuditService.ts";

export type OfflineSyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface OfflineSyncItem {
  id: string;
  module: string;
  operation: string;
  recordId: string;
  payload?: unknown;
  assetPayload?: {
    assetType: string;
    storagePath?: string;
    queuedInIndexedDb?: boolean;
  };
  status: OfflineSyncStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export interface OfflineSyncSummary {
  pendingCount: number;
  failedCount: number;
  lastSyncAt?: string;
  items: OfflineSyncItem[];
}

const STORAGE_KEY = "itred_offline_sync_metadata_queue";
const LAST_SYNC_KEY = "itred_offline_sync_last_sync_at";
const EVENT_NAME = "itred_offline_sync_updated";

const readItems = (): OfflineSyncItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read offline sync queue", error);
    return [];
  }
};

const writeItems = (items: OfflineSyncItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const offlineSyncService = {
  eventName: EVENT_NAME,

  getItems: (): OfflineSyncItem[] => readItems(),

  getSummary: (): OfflineSyncSummary => {
    const items = readItems();
    return {
      pendingCount: items.filter((item) => item.status === "pending").length,
      failedCount: items.filter((item) => item.status === "failed").length,
      lastSyncAt: localStorage.getItem(LAST_SYNC_KEY) || undefined,
      items,
    };
  },

  enqueue: (
    item: Omit<OfflineSyncItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">,
  ): OfflineSyncItem => {
    const now = new Date().toISOString();
    const nextItem: OfflineSyncItem = {
      ...item,
      id: `SYNC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "pending",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    writeItems([nextItem, ...readItems()]);
    void staffAuditService.logAction({
      eventType: "RECORD_CREATED",
      module: "system",
      severity: "warning",
      action: "Offline save queued",
      recordType: "offline_sync_item",
      recordId: nextItem.id,
      afterSnapshot: {
        module: nextItem.module,
        operation: nextItem.operation,
        recordId: nextItem.recordId,
      },
    });
    return nextItem;
  },

  retryPending: async (): Promise<OfflineSyncSummary> => {
    const items = readItems();
    const now = new Date().toISOString();
    const next = items.map((item) => {
      if (item.status !== "pending" && item.status !== "failed") return item;
      return {
        ...item,
        status: navigator.onLine ? "synced" as OfflineSyncStatus : "failed" as OfflineSyncStatus,
        retryCount: item.retryCount + 1,
        updatedAt: now,
        lastError: navigator.onLine
          ? undefined
          : "Internet connection is still offline.",
      };
    });
    writeItems(next);
    if (navigator.onLine) {
      localStorage.setItem(LAST_SYNC_KEY, now);
      void staffAuditService.logAction({
        eventType: "RECORD_UPDATED",
        module: "system",
        severity: "info",
        action: "Offline queue synced",
        recordType: "offline_sync_queue",
        recordId: "offline_sync_queue",
      });
    } else {
      void staffAuditService.logAction({
        eventType: "RECORD_UPDATED",
        module: "system",
        severity: "warning",
        action: "Offline sync retried while still offline",
        recordType: "offline_sync_queue",
        recordId: "offline_sync_queue",
      });
    }
    return offlineSyncService.getSummary();
  },

  clearSynced: () => {
    writeItems(readItems().filter((item) => item.status !== "synced"));
  },
};
