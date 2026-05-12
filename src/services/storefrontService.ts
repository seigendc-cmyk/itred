/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VendorStorefront } from "../types.ts";
import { localStorageService } from "./localStorageService.ts";

const STOREFRONTS_KEY = "itred_vendor_storefronts";

export const storefrontService = {
  getAllStorefronts: (): VendorStorefront[] => {
    return localStorageService.get<VendorStorefront[]>(STOREFRONTS_KEY) || [];
  },

  getStorefrontById: (id: string): VendorStorefront | undefined => {
    return storefrontService.getAllStorefronts().find((s) => s.id === id);
  },

  saveStorefront: (storefront: VendorStorefront): void => {
    const storefronts = storefrontService.getAllStorefronts();
    const index = storefronts.findIndex((s) => s.id === storefront.id);
    const now = new Date().toISOString();

    if (index >= 0) {
      storefronts[index] = {
        ...storefronts[index],
        ...storefront,
        updatedAt: now,
      };
    } else {
      storefronts.push({ ...storefront, updatedAt: now });
    }

    localStorageService.set(STOREFRONTS_KEY, storefronts);
  },

  deleteStorefront: (id: string): void => {
    const storefronts = storefrontService
      .getAllStorefronts()
      .filter((s) => s.id !== id);
    localStorageService.set(STOREFRONTS_KEY, storefronts);
  },

  markAsDeployed: (id: string): void => {
    const storefronts = storefrontService.getAllStorefronts();
    const index = storefronts.findIndex((s) => s.id === id);
    if (index >= 0) {
      storefronts[index] = {
        ...storefronts[index],
        status: "deployed",
        deployedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorageService.set(STOREFRONTS_KEY, storefronts);
    }
  },

  archiveStorefront: (id: string): void => {
    const storefronts = storefrontService.getAllStorefronts();
    const index = storefronts.findIndex((s) => s.id === id);
    if (index >= 0) {
      storefronts[index] = {
        ...storefronts[index],
        status: "archived",
        updatedAt: new Date().toISOString(),
      };
      localStorageService.set(STOREFRONTS_KEY, storefronts);
    }
  },
};
