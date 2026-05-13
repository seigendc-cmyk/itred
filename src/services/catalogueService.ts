/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CatalogueGeneration } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { analyticsService } from "./analyticsService.ts";

const CATALOGUE_HISTORY_KEY = "itred_catalogue_history";

function normalizeCatalogueHistory(rawHistory: unknown): CatalogueGeneration[] {
  if (Array.isArray(rawHistory)) {
    return rawHistory as CatalogueGeneration[];
  }

  // Firestore/service adapters may return { items: [...] } or { data: [...] }
  if (
    rawHistory &&
    typeof rawHistory === "object" &&
    Array.isArray((rawHistory as { items?: unknown }).items)
  ) {
    return (rawHistory as { items: CatalogueGeneration[] }).items;
  }

  if (
    rawHistory &&
    typeof rawHistory === "object" &&
    Array.isArray((rawHistory as { data?: unknown }).data)
  ) {
    return (rawHistory as { data: CatalogueGeneration[] }).data;
  }

  return [];
}

async function safeGetHistory(): Promise<CatalogueGeneration[]> {
  try {
    const rawHistory = await Promise.resolve(
      getStorageAdapter().getItem<CatalogueGeneration[]>(CATALOGUE_HISTORY_KEY),
    );

    return normalizeCatalogueHistory(rawHistory);
  } catch (error) {
    console.warn(
      "Catalogue history could not be loaded. Using empty history.",
      error,
    );
    return [];
  }
}

async function safeSetHistory(history: CatalogueGeneration[]): Promise<void> {
  try {
    await Promise.resolve(
      getStorageAdapter().setItem(CATALOGUE_HISTORY_KEY, history),
    );
  } catch (error) {
    console.warn("Catalogue history could not be saved.", error);
    throw error;
  }
}

export const catalogueService = {
  getHistory: async (): Promise<CatalogueGeneration[]> => {
    return safeGetHistory();
  },

  saveCatalogue: async (catalogue: CatalogueGeneration): Promise<void> => {
    const history = await safeGetHistory();

    const index = history.findIndex((h) => h.id === catalogue.id);

    if (index >= 0) {
      history[index] = catalogue;
    } else {
      history.push(catalogue);
    }

    await safeSetHistory(history);
  },

  logGeneration: async (
    gen: Omit<CatalogueGeneration, "id" | "generatedAt" | "status">,
  ): Promise<CatalogueGeneration> => {
    const history = await safeGetHistory();

    const newGen: CatalogueGeneration = {
      ...gen,
      id: `CAT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      status: "generated",
    };

    history.push(newGen);

    await safeSetHistory(history);

    analyticsService.logEvent({
      eventType: "CATALOGUE_GENERATED",
      actorType: "admin",
      actorName: "System Admin",
      details: {
        serialNumber: newGen.serialNumber,
        productCount: gen.productCount,
      },
    });

    return newGen;
  },

  markAsDeployed: async (id: string): Promise<void> => {
    const history = await safeGetHistory();

    const index = history.findIndex((h) => h.id === id);

    if (index >= 0) {
      const now = new Date();
      const expiry = new Date();

      expiry.setDate(now.getDate() + history[index].expiryPeriodDays);

      history[index].status = "deployed";
      history[index].deployedAt = now.toISOString();
      history[index].expiryDate = expiry.toISOString();

      await safeSetHistory(history);

      analyticsService.logEvent({
        eventType: "CATALOGUE_DEPLOYED",
        actorType: "admin",
        actorName: "System Admin",
        catalogueId: id,
        details: {
          serialNumber: history[index].serialNumber,
          expiryDate: history[index].expiryDate,
        },
      });
    }
  },

  archiveCatalogue: async (id: string): Promise<void> => {
    const history = await safeGetHistory();

    const index = history.findIndex((h) => h.id === id);

    if (index >= 0) {
      history[index].status = "archived";
      history[index].archivedAt = new Date().toISOString();

      await safeSetHistory(history);

      analyticsService.logEvent({
        eventType: "CATALOGUE_ARCHIVED",
        actorType: "admin",
        actorName: "System Admin",
        catalogueId: id,
        details: {
          serialNumber: history[index].serialNumber,
        },
      });
    }
  },

  replaceCatalogue: async (oldId: string, newId: string): Promise<void> => {
    const history = await safeGetHistory();

    const oldIndex = history.findIndex((h) => h.id === oldId);

    if (oldIndex >= 0) {
      history[oldIndex].status = "replaced";
      history[oldIndex].replacementCatalogueId = newId;

      await safeSetHistory(history);

      analyticsService.logEvent({
        eventType: "CATALOGUE_REPLACED",
        actorType: "admin",
        actorName: "System Admin",
        catalogueId: oldId,
        details: {
          replacementId: newId,
        },
      });
    }
  },

  deleteCatalogue: async (id: string): Promise<void> => {
    const history = await safeGetHistory();
    const filtered = history.filter((h) => h.id !== id);

    await safeSetHistory(filtered);

    analyticsService.logEvent({
      eventType: "CATALOGUE_DELETED",
      actorType: "admin",
      actorName: "System Admin",
      catalogueId: id,
      details: { action: "purged" },
    });
  },

  updateCatalogue: async (
    id: string,
    patch: Partial<CatalogueGeneration>,
  ): Promise<void> => {
    const history = await safeGetHistory();
    const index = history.findIndex((h) => h.id === id);

    if (index >= 0) {
      history[index] = { ...history[index], ...patch };
      await safeSetHistory(history);
    }
  },

  redeployCatalogue: async (id: string): Promise<void> => {
    const history = await safeGetHistory();
    const index = history.findIndex((h) => h.id === id);

    if (index >= 0) {
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(now.getDate() + history[index].expiryPeriodDays);

      history[index].status = "deployed";
      history[index].deployedAt = now.toISOString();
      history[index].expiryDate = expiry.toISOString();

      await safeSetHistory(history);

      analyticsService.logEvent({
        eventType: "CATALOGUE_REDEPLOYED",
        actorType: "admin",
        actorName: "System Admin",
        catalogueId: id,
      });
    }
  },

  checkExpirations: async (): Promise<CatalogueGeneration[]> => {
    try {
      const rawHistory = await Promise.resolve(
        getStorageAdapter().getItem<CatalogueGeneration[]>(
          CATALOGUE_HISTORY_KEY,
        ),
      );

      const history = normalizeCatalogueHistory(rawHistory);

      let changed = false;
      const now = new Date();

      history.forEach((h) => {
        if (h.status === "deployed" && h.expiryDate) {
          const expiry = new Date(h.expiryDate);

          if (now > expiry) {
            h.status = "expired";
            changed = true;

            analyticsService.logEvent({
              eventType: "CATALOGUE_EXPIRED",
              actorType: "system",
              actorName: "Lifecycle Engine",
              catalogueId: h.id,
              details: {
                serialNumber: h.serialNumber,
              },
            });
          }
        }
      });

      if (changed) {
        await safeSetHistory(history);
      }

      return history;
    } catch (error) {
      console.warn(
        "Catalogue history could not be loaded. Using empty history.",
        error,
      );
      return [];
    }
  },
};
