/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Product,
  Vendor,
  VendorPlanUsageLedgerEntry,
  VendorPlanUsageSnapshot,
} from "../types.ts";
import { cahService } from "./cahService.ts";
import { productService } from "./productService.ts";
import { storefrontService } from "./storefrontService.ts";
import { vendorService } from "./vendorService.ts";

const LEDGER_KEY = "itred_vendor_plan_usage_ledger";

const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const makeId = () =>
  `VPU-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const readLedger = (): VendorPlanUsageLedgerEntry[] => {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLedger = (entries: VendorPlanUsageLedgerEntry[]) => {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
};

const countThisMonth = (
  entries: VendorPlanUsageLedgerEntry[],
  vendorId: string,
  usageType: VendorPlanUsageLedgerEntry["usageType"],
  key = monthKey(),
) =>
  entries
    .filter(
      (entry) =>
        entry.vendorId === vendorId &&
        entry.usageType === usageType &&
        entry.monthKey === key,
    )
    .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);

export const vendorPlanUsageService = {
  getLedger: (vendorId?: string): VendorPlanUsageLedgerEntry[] => {
    const entries = readLedger();
    return vendorId ? entries.filter((entry) => entry.vendorId === vendorId) : entries;
  },

  recordUsage: (
    entry: Omit<
      VendorPlanUsageLedgerEntry,
      "id" | "usageDate" | "monthKey" | "createdAt"
    > &
      Partial<Pick<VendorPlanUsageLedgerEntry, "id" | "usageDate" | "monthKey" | "createdAt">>,
  ): VendorPlanUsageLedgerEntry => {
    const saved: VendorPlanUsageLedgerEntry = {
      id: entry.id || makeId(),
      vendorId: entry.vendorId,
      usageDate: entry.usageDate || today(),
      monthKey: entry.monthKey || (entry.usageDate || today()).slice(0, 7),
      usageType: entry.usageType,
      quantity: Number(entry.quantity || 1),
      sourceId: entry.sourceId,
      description: entry.description,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    writeLedger([...readLedger(), saved]);
    return saved;
  },

  recordUsageBatch: (
    entries: Array<Parameters<typeof vendorPlanUsageService.recordUsage>[0]>,
  ): VendorPlanUsageLedgerEntry[] => entries.map((entry) => vendorPlanUsageService.recordUsage(entry)),

  getUsageSnapshot: async (vendorId: string): Promise<VendorPlanUsageSnapshot> => {
    const [vendor, products, cahLinks, storefronts] = await Promise.all([
      vendorService.getVendorById(vendorId),
      productService.getProducts(),
      cahService.getLinks(),
      storefrontService.getAllStorefronts(),
    ]);
    const entries = readLedger();
    const key = monthKey();
    const vendorProducts = (Array.isArray(products) ? products : []).filter(
      (product: Product) => product.vendorId === vendorId && product.status !== "hidden",
    );
    const safeVendor = vendor as Vendor | undefined;
    return {
      vendorId,
      monthKey: key,
      productCount: vendorProducts.length,
      branchCount: safeVendor?.branches?.length || 0,
      staffCount: safeVendor?.staff?.length || 0,
      deliveryContactCount: safeVendor?.deliveryStaff?.length || 0,
      catalogueGenerationsThisMonth: countThisMonth(entries, vendorId, "catalogue_generated", key),
      storefrontGenerationsThisMonth:
        countThisMonth(entries, vendorId, "storefront_generated", key) ||
        storefronts.filter(
          (item) => item.vendorId === vendorId && item.generatedAt?.startsWith(key),
        ).length,
      noticesUsedThisMonth: countThisMonth(entries, vendorId, "notice_published", key),
      biReportsGeneratedThisMonth: countThisMonth(entries, vendorId, "bi_report_generated", key),
      cahLinksUsed: cahLinks.filter((link) => link.vendorId === vendorId).length,
      inventorySpotChecksUsedThisMonth: countThisMonth(
        entries,
        vendorId,
        "inventory_spot_check_used",
        key,
      ),
      updatedAt: new Date().toISOString(),
    };
  },
};
