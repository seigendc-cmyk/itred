/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CashBankAccount,
  ChartOfAccount,
  FinanceAsset,
  FinanceAssetDisposalRecord,
  FinanceAssetMaintenanceRecord,
} from "../types.ts";
import { financeLedgerService } from "./financeLedgerService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { generateFinanceTransactionId } from "../utils/idGenerator.ts";

const COA_KEY = "itred_chart_of_accounts";
const CASH_BANK_KEY = "itred_cash_bank_accounts";
const ASSETS_KEY = "itred_finance_assets";
const ASSET_MAINTENANCE_KEY = "itred_finance_asset_maintenance";
const ASSET_DISPOSAL_KEY = "itred_finance_asset_disposals";

const readList = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Failed to read finance storage key ${key}`, error);
    return [];
  }
};

const writeList = <T>(key: string, value: T[]) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const makeId = (prefix: string) =>
  prefix === "FIN" ? generateFinanceTransactionId() : generateFinanceTransactionId().replace("FIN", prefix);

const normalizeMoney = (value: unknown, fieldName: string): number => {
  const numberValue =
    typeof value === "number" ? value : Number(String(value || "0"));
  if (!Number.isFinite(numberValue) || Number.isNaN(numberValue)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return numberValue;
};

const auditFinanceAction = (
  action: string,
  recordType: string,
  recordId: string,
  recordName: string,
  beforeSnapshot: unknown,
  afterSnapshot: unknown,
) => {
  try {
    const eventType = beforeSnapshot ? "RECORD_UPDATED" : "RECORD_CREATED";
    void staffAuditService
      .logAction({
        eventType,
        severity: "info",
        module: "finance",
        action,
        recordType,
        recordId,
        recordName,
        beforeSnapshot,
        afterSnapshot,
      })
      .catch((error) => {
        console.warn("Finance audit log failed", error);
      });
  } catch (error) {
    console.warn("Finance audit log failed", error);
  }
};

const auditDeactivate = (
  action: string,
  recordType: string,
  recordId: string,
  recordName: string,
  beforeSnapshot: unknown,
  afterSnapshot?: unknown,
) => {
  try {
    void staffAuditService
      .logAction({
        eventType: "RECORD_UPDATED",
        severity: "warning",
        module: "finance",
        action,
        recordType,
        recordId,
        recordName,
        beforeSnapshot,
        afterSnapshot,
      })
      .catch((error) => {
        console.warn("Finance audit log failed", error);
      });
  } catch (error) {
    console.warn("Finance audit log failed", error);
  }
};

const DEFAULT_CHART_OF_ACCOUNTS: Array<
  Pick<
    ChartOfAccount,
    | "accountCode"
    | "accountName"
    | "accountType"
    | "normalBalance"
    | "isCashBankAccount"
  >
> = [
  {
    accountCode: "1000",
    accountName: "Cash on Hand",
    accountType: "Asset",
    normalBalance: "Debit",
    isCashBankAccount: true,
  },
  {
    accountCode: "1010",
    accountName: "Main Bank Account",
    accountType: "Asset",
    normalBalance: "Debit",
    isCashBankAccount: true,
  },
  {
    accountCode: "1020",
    accountName: "Mobile Money Wallet",
    accountType: "Asset",
    normalBalance: "Debit",
    isCashBankAccount: true,
  },
  {
    accountCode: "1100",
    accountName: "Accounts Receivable",
    accountType: "Asset",
    normalBalance: "Debit",
  },
  {
    accountCode: "1200",
    accountName: "Vendor Credit Wallet",
    accountType: "Asset",
    normalBalance: "Debit",
  },
  {
    accountCode: "2000",
    accountName: "Accounts Payable",
    accountType: "Liability",
    normalBalance: "Credit",
  },
  {
    accountCode: "2010",
    accountName: "RPN Commission Payable",
    accountType: "Liability",
    normalBalance: "Credit",
  },
  {
    accountCode: "2020",
    accountName: "Deferred Vendor Credits",
    accountType: "Liability",
    normalBalance: "Credit",
  },
  {
    accountCode: "3000",
    accountName: "Owner Equity / Trust Capital",
    accountType: "Equity",
    normalBalance: "Credit",
  },
  {
    accountCode: "4000",
    accountName: "Subscription Revenue",
    accountType: "Income",
    normalBalance: "Credit",
  },
  {
    accountCode: "4010",
    accountName: "Onboarding Revenue",
    accountType: "Income",
    normalBalance: "Credit",
  },
  {
    accountCode: "4020",
    accountName: "Catalogue Overage Revenue",
    accountType: "Income",
    normalBalance: "Credit",
  },
  {
    accountCode: "5000",
    accountName: "RPN Onboarding Commission",
    accountType: "Expense",
    normalBalance: "Debit",
  },
  {
    accountCode: "5010",
    accountName: "RPN Recurring Commission",
    accountType: "Expense",
    normalBalance: "Debit",
  },
  {
    accountCode: "5020",
    accountName: "Marketing Expense",
    accountType: "Expense",
    normalBalance: "Debit",
  },
  {
    accountCode: "5030",
    accountName: "Roadshow Expense",
    accountType: "Expense",
    normalBalance: "Debit",
  },
  {
    accountCode: "5040",
    accountName: "Radio Advertising Expense",
    accountType: "Expense",
    normalBalance: "Debit",
  },
  {
    accountCode: "5050",
    accountName: "TV Advertising Expense",
    accountType: "Expense",
    normalBalance: "Debit",
  },
  {
    accountCode: "5060",
    accountName: "Office Administration Expense",
    accountType: "Expense",
    normalBalance: "Debit",
  },
];

export const financeService = {
  getChartOfAccounts: (): ChartOfAccount[] => {
    return readList<ChartOfAccount>(COA_KEY).sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode),
    );
  },

  saveChartOfAccount: (account: ChartOfAccount): ChartOfAccount => {
    const accounts = financeService.getChartOfAccounts();
    const now = new Date().toISOString();
    const cleanCode = account.accountCode.trim();
    const cleanName = account.accountName.trim();

    if (!cleanCode) throw new Error("Account code is required.");
    if (!cleanName) throw new Error("Account name is required.");

    const duplicate = accounts.find(
      (item) => item.accountCode === cleanCode && item.id !== account.id,
    );
    if (duplicate) {
      throw new Error(`Account code ${cleanCode} already exists.`);
    }

    const existing = accounts.find((item) => item.id === account.id);
    const saved: ChartOfAccount = {
      ...account,
      id: account.id || makeId("COA"),
      accountCode: cleanCode,
      accountName: cleanName,
      accountSubType: account.accountSubType?.trim() || undefined,
      description: account.description?.trim() || undefined,
      isCashBankAccount: !!account.isCashBankAccount,
      isSystemAccount: !!account.isSystemAccount,
      status: account.status || "active",
      createdAt: existing?.createdAt || account.createdAt || now,
      updatedAt: now,
    };

    const nextAccounts = existing
      ? accounts.map((item) => (item.id === saved.id ? saved : item))
      : [...accounts, saved];

    writeList(COA_KEY, nextAccounts);
    auditFinanceAction(
      existing
        ? `Updated chart of account ${saved.accountCode}`
        : `Created chart of account ${saved.accountCode}`,
      "ChartOfAccount",
      saved.id,
      saved.accountName,
      existing,
      saved,
    );
    return saved;
  },

  deleteOrDeactivateAccount: (id: string): void => {
    const accounts = financeService.getChartOfAccounts();
    const existing = accounts.find((item) => item.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const updated: ChartOfAccount = {
      ...existing,
      status: "inactive",
      updatedAt: now,
    };
    writeList(
      COA_KEY,
      accounts.map((item) => (item.id === id ? updated : item)),
    );
    auditDeactivate(
      `Deactivated chart of account ${existing.accountCode}`,
      "ChartOfAccount",
      existing.id,
      existing.accountName,
      existing,
      updated,
    );
  },

  seedDefaultChartOfAccounts: (): ChartOfAccount[] => {
    const existing = financeService.getChartOfAccounts();
    const now = new Date().toISOString();
    const existingCodes = new Set(existing.map((item) => item.accountCode));
    const seededAccounts: ChartOfAccount[] = DEFAULT_CHART_OF_ACCOUNTS.filter(
      (item) => !existingCodes.has(item.accountCode),
    ).map((item) => ({
      id: makeId(`COA-${item.accountCode}`),
      ...item,
      isCashBankAccount: !!item.isCashBankAccount,
      isSystemAccount: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }));

    if (seededAccounts.length === 0) return existing;

    const nextAccounts = [...existing, ...seededAccounts];
    writeList(COA_KEY, nextAccounts);
    auditFinanceAction(
      `Seeded ${seededAccounts.length} default chart of accounts`,
      "ChartOfAccount",
      "default-coa-seed",
      "Default Chart of Accounts",
      null,
      seededAccounts,
    );
    return financeService.getChartOfAccounts();
  },

  getCashBankAccounts: (): CashBankAccount[] => {
    return readList<CashBankAccount>(CASH_BANK_KEY).sort((a, b) =>
      a.accountName.localeCompare(b.accountName),
    );
  },

  getActiveCashBankAccounts: (): CashBankAccount[] => {
    return financeService
      .getCashBankAccounts()
      .filter((account) => account.status === "active");
  },

  saveCashBankAccount: (account: CashBankAccount): CashBankAccount => {
    const cashBankAccounts = financeService.getCashBankAccounts();
    const chartOfAccounts = financeService.getChartOfAccounts();
    const now = new Date().toISOString();
    const linkedAccount = chartOfAccounts.find(
      (item) =>
        item.id === account.accountId &&
        item.status === "active" &&
        item.isCashBankAccount === true,
    );

    if (!linkedAccount) {
      throw new Error(
        "Cash/Bank account must link to an active cash/bank Chart of Accounts account.",
      );
    }

    const openingBalance = normalizeMoney(
      account.openingBalance,
      "Opening balance",
    );
    const currentBalance = normalizeMoney(
      account.currentBalance,
      "Current balance",
    );
    const approvalLimit =
      account.approvalLimit === undefined || account.approvalLimit === null
        ? undefined
        : normalizeMoney(account.approvalLimit, "Approval limit");

    const existing = cashBankAccounts.find((item) => item.id === account.id);
    const saved: CashBankAccount = {
      ...account,
      id: account.id || makeId("CASHBANK"),
      accountId: linkedAccount.id,
      accountCode: linkedAccount.accountCode,
      accountName: account.accountName.trim() || linkedAccount.accountName,
      openingBalance,
      currentBalance,
      approvalLimit,
      requiresApprovalForPayments: !!account.requiresApprovalForPayments,
      status: account.status || "active",
      createdAt: existing?.createdAt || account.createdAt || now,
      updatedAt: now,
    };

    const nextAccounts = existing
      ? cashBankAccounts.map((item) => (item.id === saved.id ? saved : item))
      : [...cashBankAccounts, saved];

    writeList(CASH_BANK_KEY, nextAccounts);
    auditFinanceAction(
      existing
        ? `Updated cash/bank account ${saved.accountName}`
        : `Created cash/bank account ${saved.accountName}`,
      "CashBankAccount",
      saved.id,
      saved.accountName,
      existing,
      saved,
    );
    if (!existing && saved.openingBalance > 0) {
      financeLedgerService.postOpeningBalanceForCashBankAccount(saved);
    }
    return saved;
  },

  deleteOrDeactivateCashBankAccount: (id: string): void => {
    const accounts = financeService.getCashBankAccounts();
    const existing = accounts.find((item) => item.id === id);
    if (!existing) return;

    const updated: CashBankAccount = {
      ...existing,
      status: "inactive",
      updatedAt: new Date().toISOString(),
    };
    writeList(
      CASH_BANK_KEY,
      accounts.map((item) => (item.id === id ? updated : item)),
    );
    auditDeactivate(
      `Deactivated cash/bank account ${existing.accountName}`,
      "CashBankAccount",
      existing.id,
      existing.accountName,
      existing,
      updated,
    );
  },

  getAssets: (): FinanceAsset[] => {
    return readList<FinanceAsset>(ASSETS_KEY).sort((a, b) =>
      a.assetCode.localeCompare(b.assetCode),
    );
  },

  getRecentAssets: (limit = 100): FinanceAsset[] => {
    return financeService
      .getAssets()
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, limit);
  },

  getAssetsByDateRange: (from: string, to: string): FinanceAsset[] => {
    return financeService.getAssets().filter((asset) => {
      const date = (asset.updatedAt || asset.createdAt || "").slice(0, 10);
      return (!from || date >= from) && (!to || date <= to);
    });
  },

  saveAsset: (asset: FinanceAsset): FinanceAsset => {
    const assets = financeService.getAssets();
    const chartOfAccounts = financeService.getChartOfAccounts();
    const now = new Date().toISOString();
    const cleanCode = asset.assetCode.trim();
    const cleanName = asset.assetName.trim();
    const purchaseCost = normalizeMoney(asset.purchaseCost, "Purchase cost");
    const currentValue = normalizeMoney(asset.currentValue, "Current value");

    if (!cleanCode) throw new Error("Asset code is required.");
    if (!cleanName) throw new Error("Asset name is required.");
    if (!asset.assetAccountId) throw new Error("Asset COA account is required.");
    if (!asset.maintenanceExpenseAccountId) {
      throw new Error("Maintenance expense COA account is required.");
    }

    const duplicate = assets.find(
      (item) => item.assetCode === cleanCode && item.id !== asset.id,
    );
    if (duplicate) throw new Error(`Asset code ${cleanCode} already exists.`);

    const assetAccount = chartOfAccounts.find(
      (account) => account.id === asset.assetAccountId && account.status === "active",
    );
    const maintenanceAccount = chartOfAccounts.find(
      (account) =>
        account.id === asset.maintenanceExpenseAccountId &&
        account.status === "active",
    );
    const disposalAccount = asset.disposalAccountId
      ? chartOfAccounts.find(
          (account) =>
            account.id === asset.disposalAccountId &&
            account.status === "active",
        )
      : undefined;

    if (!assetAccount) throw new Error("Selected asset COA account is inactive or missing.");
    if (!maintenanceAccount) {
      throw new Error("Selected maintenance expense COA account is inactive or missing.");
    }
    if (asset.disposalAccountId && !disposalAccount) {
      throw new Error("Selected disposal COA account is inactive or missing.");
    }

    const existing = assets.find((item) => item.id === asset.id);
    const saved: FinanceAsset = {
      ...asset,
      id: asset.id || makeId("ASSET"),
      assetCode: cleanCode,
      assetName: cleanName,
      brand: asset.brand?.trim() || undefined,
      model: asset.model?.trim() || undefined,
      serialNumber: asset.serialNumber?.trim() || undefined,
      location: asset.location?.trim() || undefined,
      assignedTo: asset.assignedTo?.trim() || undefined,
      supplierName: asset.supplierName?.trim() || undefined,
      notes: asset.notes?.trim() || undefined,
      purchaseCost,
      currentValue,
      status: asset.status || "active",
      createdAt: existing?.createdAt || asset.createdAt || now,
      updatedAt: now,
    };

    const nextAssets = existing
      ? assets.map((item) => (item.id === saved.id ? saved : item))
      : [...assets, saved];
    writeList(ASSETS_KEY, nextAssets);
    auditFinanceAction(
      existing
        ? `Updated asset ${saved.assetCode}`
        : `Created asset ${saved.assetCode}`,
      "FinanceAsset",
      saved.id,
      saved.assetName,
      existing,
      saved,
    );
    return saved;
  },

  deactivateAsset: (id: string): void => {
    const assets = financeService.getAssets();
    const existing = assets.find((item) => item.id === id);
    if (!existing) return;

    const updated: FinanceAsset = {
      ...existing,
      status: "inactive",
      updatedAt: new Date().toISOString(),
    };
    writeList(
      ASSETS_KEY,
      assets.map((item) => (item.id === id ? updated : item)),
    );
    auditDeactivate(
      `Deactivated asset ${existing.assetCode}`,
      "FinanceAsset",
      existing.id,
      existing.assetName,
      existing,
      updated,
    );
  },

  getAssetMaintenanceRecords: (): FinanceAssetMaintenanceRecord[] => {
    return readList<FinanceAssetMaintenanceRecord>(ASSET_MAINTENANCE_KEY).sort(
      (a, b) =>
        new Date(b.maintenanceDate).getTime() -
        new Date(a.maintenanceDate).getTime(),
    );
  },

  saveAssetMaintenanceRecord: (
    record: FinanceAssetMaintenanceRecord,
  ): FinanceAssetMaintenanceRecord => {
    const records = financeService.getAssetMaintenanceRecords();
    const assets = financeService.getAssets();
    const chartOfAccounts = financeService.getChartOfAccounts();
    const now = new Date().toISOString();
    const cost = normalizeMoney(record.cost, "Maintenance cost");

    if (!record.assetId) throw new Error("Asset is required.");
    if (!record.maintenanceDate) throw new Error("Maintenance date is required.");
    if (!record.expenseAccountId) {
      throw new Error("Maintenance expense COA account is required.");
    }
    if (!assets.find((asset) => asset.id === record.assetId)) {
      throw new Error("Selected asset is missing.");
    }
    if (
      !chartOfAccounts.find(
        (account) =>
          account.id === record.expenseAccountId && account.status === "active",
      )
    ) {
      throw new Error("Selected expense COA account is inactive or missing.");
    }

    const existing = records.find((item) => item.id === record.id);
    const saved: FinanceAssetMaintenanceRecord = {
      ...record,
      id: record.id || makeId("MAINT"),
      provider: record.provider?.trim() || undefined,
      notes: record.notes?.trim() || undefined,
      cost,
      status: record.status || "scheduled",
      createdAt: existing?.createdAt || record.createdAt || now,
      updatedAt: now,
    };
    const nextRecords = existing
      ? records.map((item) => (item.id === saved.id ? saved : item))
      : [...records, saved];
    writeList(ASSET_MAINTENANCE_KEY, nextRecords);
    auditFinanceAction(
      existing
        ? `Updated asset maintenance ${saved.id}`
        : `Created asset maintenance ${saved.id}`,
      "FinanceAssetMaintenanceRecord",
      saved.id,
      saved.assetId,
      existing,
      saved,
    );
    return saved;
  },

  getAssetDisposalRecords: (): FinanceAssetDisposalRecord[] => {
    return readList<FinanceAssetDisposalRecord>(ASSET_DISPOSAL_KEY).sort(
      (a, b) =>
        new Date(b.disposalDate).getTime() - new Date(a.disposalDate).getTime(),
    );
  },

  saveAssetDisposalRecord: (
    record: FinanceAssetDisposalRecord,
  ): FinanceAssetDisposalRecord => {
    const records = financeService.getAssetDisposalRecords();
    const assets = financeService.getAssets();
    const chartOfAccounts = financeService.getChartOfAccounts();
    const now = new Date().toISOString();
    const proceeds = normalizeMoney(record.proceeds, "Disposal proceeds");

    if (!record.assetId) throw new Error("Asset is required.");
    if (!record.disposalDate) throw new Error("Disposal date is required.");
    if (!record.disposalAccountId) throw new Error("Disposal COA account is required.");
    if (!assets.find((asset) => asset.id === record.assetId)) {
      throw new Error("Selected asset is missing.");
    }
    if (
      !chartOfAccounts.find(
        (account) =>
          account.id === record.disposalAccountId && account.status === "active",
      )
    ) {
      throw new Error("Selected disposal COA account is inactive or missing.");
    }

    const existing = records.find((item) => item.id === record.id);
    const saved: FinanceAssetDisposalRecord = {
      ...record,
      id: record.id || makeId("DISP"),
      proceeds,
      notes: record.notes?.trim() || undefined,
      createdAt: existing?.createdAt || record.createdAt || now,
      updatedAt: now,
    };
    const nextRecords = existing
      ? records.map((item) => (item.id === saved.id ? saved : item))
      : [...records, saved];
    const nextAssets = assets.map((asset) =>
      asset.id === saved.assetId
        ? { ...asset, status: "disposed" as const, updatedAt: now }
        : asset,
    );

    writeList(ASSET_DISPOSAL_KEY, nextRecords);
    writeList(ASSETS_KEY, nextAssets);
    auditFinanceAction(
      existing
        ? `Updated asset disposal ${saved.id}`
        : `Created asset disposal ${saved.id}`,
      "FinanceAssetDisposalRecord",
      saved.id,
      saved.assetId,
      existing,
      saved,
    );
    return saved;
  },
};
