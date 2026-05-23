/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vendor, Product, ActivityLog } from "../types.ts";
import { vendorService } from "../services/vendorService.ts";
import { productService } from "../services/productService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { localStorageService } from "../services/localStorageService.ts";

export type WhatsAppAccessLink = {
  id: string;
  displayName: string;
  sector: string;
  category?: string;
  linkType:
    | "WhatsApp Community"
    | "WhatsApp Group"
    | "WhatsApp Channel"
    | "Customer Support";
  url: string;
  description?: string;
  status: "active" | "inactive" | "archived";
  memberCount?: number;
  followerCount?: number;
  lastUpdatedAt: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};

const PLAN_KEY = "itred_active_plan";
const WA_LINKS_KEY = "itred_whatsapp_access_links";

export const storage = {
  // Plan helpers (keeping simple for now)
  savePlan: (planId: string) => {
    localStorageService.set(PLAN_KEY, planId);
  },

  getPlanId: (): string => {
    return localStorageService.get<string>(PLAN_KEY) || "starter";
  },

  // Analytics helpers (delegating to analyticsService)
  logEvent: (event: Omit<ActivityLog, "id" | "timestamp">) => {
    analyticsService.logEvent(event);
  },

  getEvents: (): ActivityLog[] => {
    return [] as ActivityLog[];
  },

  // Vendor helpers (delegating to vendorService)
  saveVendors: (vendors: Vendor[]) => {
    vendorService.saveVendors(vendors);
  },

  getVendors: (): Vendor[] => {
    const vendors = (vendorService.getVendors as any)();
    return Array.isArray(vendors) ? vendors : [];
  },

  updateVendor: (vendor: Vendor) => {
    vendorService.updateVendor(vendor);
  },

  // Product helpers (delegating to productService)
  saveProducts: (products: Product[]) => {
    products.forEach((product) => productService.saveProduct(product));
  },

  getProducts: (): Product[] => {
    const products = (productService.getProducts as any)();
    return Array.isArray(products) ? products : [];
  },

  saveProduct: (product: Product) => {
    productService.saveProduct(product);
  },

  deleteProduct: (id: string) => {
    productService.deleteProduct(id);
  },

  // WhatsApp Access Link helpers
  getWhatsAppAccessLinks: (): WhatsAppAccessLink[] => {
    return localStorageService.get<WhatsAppAccessLink[]>(WA_LINKS_KEY) || [];
  },

  saveWhatsAppAccessLinks: (links: WhatsAppAccessLink[]) => {
    localStorageService.set(WA_LINKS_KEY, links);
  },

  addWhatsAppAccessLink: (link: WhatsAppAccessLink) => {
    const links = storage.getWhatsAppAccessLinks();
    storage.saveWhatsAppAccessLinks([...links, link]);
  },

  updateWhatsAppAccessLink: (link: WhatsAppAccessLink) => {
    const links = storage.getWhatsAppAccessLinks();
    storage.saveWhatsAppAccessLinks(
      links.map((l) => (l.id === link.id ? link : l)),
    );
  },

  archiveWhatsAppAccessLink: (id: string) => {
    const links = storage.getWhatsAppAccessLinks();
    storage.saveWhatsAppAccessLinks(
      links.map((l) =>
        l.id === id
          ? { ...l, status: "archived", updatedAt: new Date().toISOString() }
          : l,
      ),
    );
  },

  deleteWhatsAppAccessLink: (id: string) => {
    const links = storage.getWhatsAppAccessLinks();
    storage.saveWhatsAppAccessLinks(links.filter((l) => l.id !== id));
  },
};
