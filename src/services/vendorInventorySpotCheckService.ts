import {
  VendorInventoryAdjustmentLog,
  VendorInventorySpotCheck,
  VendorInventorySpotCheckLine,
} from "../types.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";
import { localStorageService } from "./localStorageService.ts";

const SPOT_CHECKS_KEY = "vendorInventorySpotChecks";
const SPOT_CHECK_LINES_KEY = "vendorInventorySpotCheckLines";
const ADJUSTMENT_LOGS_KEY = "vendorInventoryAdjustmentLogs";

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const getAll = <T>(key: string): T[] => asArray<T>(localStorageService.get<T[]>(key));

const setAll = <T>(key: string, rows: T[]) => {
  localStorageService.set(key, sanitizeForFirestore(rows) as T[]);
};

const upsert = <T extends { id: string }>(rows: T[], row: T) => {
  const index = rows.findIndex((item) => item.id === row.id);
  if (index >= 0) rows[index] = row;
  else rows.push(row);
  return rows;
};

export const vendorInventorySpotCheckService = {
  getSpotChecks: (): VendorInventorySpotCheck[] =>
    getAll<VendorInventorySpotCheck>(SPOT_CHECKS_KEY),

  getLines: (spotCheckId?: string): VendorInventorySpotCheckLine[] => {
    const lines = getAll<VendorInventorySpotCheckLine>(SPOT_CHECK_LINES_KEY);
    return spotCheckId
      ? lines.filter((line) => line.spotCheckId === spotCheckId)
      : lines;
  },

  getAdjustmentLogs: (): VendorInventoryAdjustmentLog[] =>
    getAll<VendorInventoryAdjustmentLog>(ADJUSTMENT_LOGS_KEY),

  saveSpotCheck: (spotCheck: VendorInventorySpotCheck): void => {
    const rows = vendorInventorySpotCheckService.getSpotChecks();
    setAll(SPOT_CHECKS_KEY, upsert(rows, spotCheck));
  },

  saveLines: (spotCheckId: string, nextLines: VendorInventorySpotCheckLine[]): void => {
    const current = vendorInventorySpotCheckService
      .getLines()
      .filter((line) => line.spotCheckId !== spotCheckId);
    setAll(SPOT_CHECK_LINES_KEY, [...current, ...nextLines]);
  },

  saveSpotCheckWithLines: (
    spotCheck: VendorInventorySpotCheck,
    lines: VendorInventorySpotCheckLine[],
  ): void => {
    vendorInventorySpotCheckService.saveSpotCheck(spotCheck);
    vendorInventorySpotCheckService.saveLines(spotCheck.id, lines);
  },

  addAdjustmentLogs: (logs: VendorInventoryAdjustmentLog[]): void => {
    if (!logs.length) return;
    const rows = vendorInventorySpotCheckService.getAdjustmentLogs();
    setAll(ADJUSTMENT_LOGS_KEY, [...rows, ...logs]);
  },
};
