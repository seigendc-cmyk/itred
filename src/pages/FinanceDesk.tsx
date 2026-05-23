/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccountType,
  CashBankAccount,
  ChartOfAccount,
  FinanceAsset,
  FinanceAssetCategory,
  FinanceAssetDisposalRecord,
  FinanceAssetMaintenanceRecord,
  FinanceLedgerEntry,
} from "../types.ts";
import { financeLedgerService } from "../services/financeLedgerService.ts";
import { financeService } from "../services/financeService.ts";
import { permissionService } from "../services/permissionService.ts";
import { settingsService } from "../services/settingsService.ts";

type FinanceTab =
  | "overview"
  | "chart-of-accounts"
  | "cash-bank-accounts"
  | "cash-bank-ledger"
  | "asset-register"
  | "setup-status";

const ACCOUNT_TYPES: AccountType[] = [
  "Asset",
  "Liability",
  "Equity",
  "Income",
  "Expense",
  "Cost of Sales",
  "Contra Asset",
  "Contra Income",
];

const DEFAULT_ACCOUNT_SUB_TYPES: Record<AccountType, string[]> = {
  Asset: [
    "Cash and Cash Equivalents",
    "Bank Account",
    "Mobile Money Wallet",
    "Accounts Receivable",
    "Inventory",
    "Prepaid Expenses",
    "Fixed Assets",
    "Vehicles",
    "Buildings",
    "Furniture and Fixtures",
    "Computer Equipment",
    "Connectivity Equipment",
    "Phones and Mobile Devices",
    "Accumulated Depreciation",
    "Other Current Asset",
    "Other Non-Current Asset",
  ],
  Liability: [
    "Accounts Payable",
    "Accrued Expenses",
    "Vendor Credits / Deferred Revenue",
    "RPN Commission Payable",
    "Taxes Payable",
    "Payroll Payable",
    "Loans Payable",
    "Other Current Liability",
    "Other Long-Term Liability",
  ],
  Equity: [
    "Owner Equity",
    "Trust Capital",
    "Retained Earnings",
    "Drawings / Distributions",
    "Capital Contributions",
  ],
  Income: [
    "Subscription Revenue",
    "Onboarding Revenue",
    "Catalogue Overage Revenue",
    "Campaign Revenue",
    "Finance Income",
    "Other Income",
  ],
  Expense: [
    "RPN Onboarding Commission",
    "RPN Recurring Commission",
    "Marketing Expense",
    "Roadshow Expense",
    "Radio Advertising Expense",
    "TV Advertising Expense",
    "Office Administration Expense",
    "Rent Expense",
    "Internet / Connectivity Expense",
    "Repairs and Maintenance",
    "Asset Maintenance Expense",
    "Fuel and Transport",
    "Salaries and Wages",
    "Bank Charges",
    "Software Subscriptions",
    "Professional Fees",
    "Training Expense",
    "Depreciation Expense",
    "Other Expense",
  ],
  "Cost of Sales": [
    "Cost of Goods Sold",
    "Catalogue Production Cost",
    "Delivery Cost",
    "Vendor Support Cost",
    "Inventory Adjustment",
  ],
  "Contra Asset": [
    "Accumulated Depreciation",
    "Allowance for Doubtful Accounts",
    "Inventory Obsolescence Reserve",
  ],
  "Contra Income": [
    "Sales Discounts",
    "Refunds and Allowances",
    "Revenue Reversals",
  ],
};

const CASH_BANK_TYPES: CashBankAccount["accountType"][] = [
  "Cash",
  "Bank",
  "Mobile Money",
  "Card Processor",
  "Other",
];

const CURRENCIES: CashBankAccount["currency"][] = ["USD", "ZiG", "ZAR", "Other"];

const LEDGER_TRANSACTION_TYPES: FinanceLedgerEntry["transactionType"][] = [
  "Opening Balance",
  "Payment",
  "Receipt",
  "Deposit",
  "Transfer",
  "Journal",
];

const ASSET_CATEGORIES: FinanceAssetCategory[] = [
  "Starlink / Connectivity Kit",
  "Router / Network Device",
  "Office Furniture",
  "Office Equipment",
  "Building",
  "Vehicle",
  "RPN Issued Phone",
  "Promotional Kit",
  "Roadshow Equipment",
  "Training Equipment",
  "Data Centre Equipment",
  "Other",
];

const inputClass =
  "w-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-brand-orange";
const labelClass =
  "text-[10px] font-black uppercase tracking-widest text-stone-400";

const normalizeSubtype = (value: string) => value.trim().toLowerCase();

const mergeSubtypeOptions = (...groups: Array<Array<string | undefined>>) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  groups.flat().forEach((item) => {
    const clean = String(item || "").trim();
    if (!clean) return;
    const key = normalizeSubtype(clean);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(clean);
  });

  return merged;
};

const AccountSubTypeCombo: React.FC<{
  value: string;
  accountType: AccountType;
  options: string[];
  standardOptions: string[];
  canAddCustom: boolean;
  onChange: (value: string) => void;
  onAddCustom: (value: string) => Promise<boolean>;
}> = ({
  value,
  accountType,
  options,
  standardOptions,
  canAddCustom,
  onChange,
  onAddCustom,
}) => {
  const [query, setQuery] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [message, setMessage] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return options;
    return options.filter((option) => option.toLowerCase().includes(search));
  }, [options, query]);

  const belongsToStandardList =
    !value ||
    standardOptions.some((option) => normalizeSubtype(option) === normalizeSubtype(value));

  const addCustomSubtype = async () => {
    const clean = addValue.trim();
    if (!clean) {
      setMessage("Enter a subtype name.");
      return;
    }

    const saved = await onAddCustom(clean);
    if (saved) {
      onChange(clean);
      setQuery(clean);
      setAddValue("");
      setIsAdding(false);
      setMessage("Custom subtype added.");
    }
  };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      <input
        value={query}
        placeholder="Select account sub type..."
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange(event.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
          setMessage("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((current) =>
              Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && isOpen) {
            event.preventDefault();
            const selected = filteredOptions[highlightedIndex];
            if (selected) {
              onChange(selected);
              setQuery(selected);
              setIsOpen(false);
            }
          } else if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        className={inputClass}
        role="combobox"
        aria-expanded={isOpen}
        aria-label="Account Sub Type"
      />
      {isOpen && (
        <div className="absolute z-30 max-h-64 w-full overflow-y-auto border border-stone-200 bg-white shadow-xl">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-[10px] font-bold uppercase text-stone-400">
              No matching subtypes.
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  setQuery(option);
                  setIsOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-xs font-semibold ${
                  index === highlightedIndex
                    ? "bg-orange-50 text-brand-orange"
                    : "text-brand-charcoal hover:bg-stone-50"
                }`}
              >
                {option}
              </button>
            ))
          )}
        </div>
      )}

      {value && !belongsToStandardList && (
        <p className="border-l-2 border-brand-orange bg-orange-50 px-3 py-2 text-[10px] font-bold uppercase text-brand-orange">
          This subtype does not normally belong to the selected account type.
        </p>
      )}

      {canAddCustom ? (
        <div className="space-y-2">
          {!isAdding ? (
            <button
              type="button"
              onClick={() => {
                setIsAdding(true);
                setAddValue(query.trim());
                setMessage("");
              }}
              className="text-[10px] font-black uppercase tracking-widest text-brand-orange hover:text-brand-charcoal"
            >
              + Add New Sub Type
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                value={addValue}
                onChange={(event) => {
                  setAddValue(event.target.value);
                  setMessage("");
                }}
                placeholder={`New ${accountType} subtype`}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => void addCustomSubtype()}
                className="border border-brand-orange bg-brand-orange px-3 py-2 text-[10px] font-black uppercase text-white"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setAddValue("");
                  setMessage("");
                }}
                className="border border-stone-200 px-3 py-2 text-[10px] font-black uppercase text-stone-500"
              >
                Cancel
              </button>
            </div>
          )}
          {message && (
            <p className="text-[10px] font-bold uppercase text-stone-500">
              {message}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[10px] font-bold uppercase text-stone-400">
          Custom subtypes require Finance COA management permission.
        </p>
      )}
    </div>
  );
};

const createBlankCoa = (): ChartOfAccount => ({
  id: "",
  accountCode: "",
  accountName: "",
  accountType: "Asset",
  normalBalance: "Debit",
  accountSubType: "",
  description: "",
  isCashBankAccount: false,
  isSystemAccount: false,
  status: "active",
  createdAt: "",
  updatedAt: "",
});

const createBlankCashBank = (
  cashBankCoa: ChartOfAccount[],
): CashBankAccount => {
  const firstAccount = cashBankCoa[0];
  return {
    id: "",
    accountId: firstAccount?.id || "",
    accountCode: firstAccount?.accountCode || "",
    accountName: firstAccount?.accountName || "",
    accountType: "Bank",
    currency: "USD",
    bankName: "",
    branchName: "",
    accountNumber: "",
    walletNumber: "",
    openingBalance: 0,
    currentBalance: 0,
    status: "active",
    requiresApprovalForPayments: false,
    approvalLimit: undefined,
    createdAt: "",
    updatedAt: "",
  };
};

const createBlankLedgerEntry = (
  cashBankAccounts: CashBankAccount[],
): FinanceLedgerEntry => {
  const firstAccount =
    cashBankAccounts.find((account) => account.status === "active") ||
    cashBankAccounts[0];
  return {
    id: "",
    transactionNumber: "",
    transactionDate: new Date().toISOString().slice(0, 10),
    transactionType: "Deposit",
    accountId: firstAccount?.accountId || "",
    cashBankAccountId: firstAccount?.id,
    description: "",
    debit: 0,
    credit: 0,
    amount: 0,
    reference: "",
    status: "draft",
    createdAt: "",
    updatedAt: "",
  };
};

const createBlankAsset = (accounts: ChartOfAccount[]): FinanceAsset => {
  const assetAccount =
    accounts.find((account) => account.accountType === "Asset") || accounts[0];
  const expenseAccount =
    accounts.find((account) => account.accountType === "Expense") || accounts[0];
  const disposalAccount =
    accounts.find(
      (account) =>
        account.accountType === "Income" || account.accountType === "Expense",
    ) || accounts[0];

  return {
    id: "",
    assetCode: "",
    assetName: "",
    category: "Starlink / Connectivity Kit",
    brand: "",
    model: "",
    serialNumber: "",
    location: "",
    assignedTo: "",
    acquisitionDate: new Date().toISOString().slice(0, 10),
    purchaseCost: 0,
    currentValue: 0,
    assetAccountId: assetAccount?.id || "",
    cashBankAccountId: "",
    maintenanceExpenseAccountId: expenseAccount?.id || "",
    disposalAccountId: disposalAccount?.id || "",
    supplierName: "",
    warrantyExpiryDate: "",
    notes: "",
    status: "active",
    createdAt: "",
    updatedAt: "",
  };
};

const createBlankMaintenanceRecord = (
  assets: FinanceAsset[],
  accounts: ChartOfAccount[],
): FinanceAssetMaintenanceRecord => {
  const asset = assets[0];
  const expenseAccount =
    accounts.find((account) => account.accountType === "Expense") || accounts[0];
  return {
    id: "",
    assetId: asset?.id || "",
    maintenanceDate: new Date().toISOString().slice(0, 10),
    maintenanceType: "Service",
    provider: "",
    cost: 0,
    expenseAccountId: expenseAccount?.id || "",
    notes: "",
    nextMaintenanceDate: "",
    status: "scheduled",
    createdAt: "",
    updatedAt: "",
  };
};

const createBlankDisposalRecord = (
  assets: FinanceAsset[],
  accounts: ChartOfAccount[],
): FinanceAssetDisposalRecord => {
  const asset = assets.find((item) => item.status !== "disposed") || assets[0];
  const disposalAccount =
    accounts.find(
      (account) =>
        account.accountType === "Income" || account.accountType === "Expense",
    ) || accounts[0];
  return {
    id: "",
    assetId: asset?.id || "",
    disposalDate: new Date().toISOString().slice(0, 10),
    disposalMethod: "Sold",
    proceeds: 0,
    disposalAccountId: disposalAccount?.id || "",
    notes: "",
    createdAt: "",
    updatedAt: "",
  };
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const FinanceDesk: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>(() =>
    financeService.getChartOfAccounts(),
  );
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>(
    () => financeService.getCashBankAccounts(),
  );
  const [ledgerEntries, setLedgerEntries] = useState<FinanceLedgerEntry[]>(() =>
    financeLedgerService.getLedgerEntries(),
  );
  const [assets, setAssets] = useState<FinanceAsset[]>(() =>
    financeService.getAssets(),
  );
  const [maintenanceRecords, setMaintenanceRecords] = useState<
    FinanceAssetMaintenanceRecord[]
  >(() => financeService.getAssetMaintenanceRecords());
  const [disposalRecords, setDisposalRecords] = useState<
    FinanceAssetDisposalRecord[]
  >(() => financeService.getAssetDisposalRecords());
  const [coaForm, setCoaForm] = useState<ChartOfAccount>(() =>
    createBlankCoa(),
  );
  const [customSubTypes, setCustomSubTypes] = useState<
    Partial<Record<AccountType, string[]>>
  >({});
  const [cashBankForm, setCashBankForm] = useState<CashBankAccount>(() =>
    createBlankCashBank(
      financeService
        .getChartOfAccounts()
        .filter(
          (account) =>
            account.status === "active" && account.isCashBankAccount === true,
        ),
    ),
  );
  const [coaSearch, setCoaSearch] = useState("");
  const [cashBankSearch, setCashBankSearch] = useState("");
  const [linkedCoaSearch, setLinkedCoaSearch] = useState("");
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  const [ledgerForm, setLedgerForm] = useState<FinanceLedgerEntry>(() =>
    createBlankLedgerEntry(financeService.getCashBankAccounts()),
  );
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<
    FinanceAssetCategory | "all"
  >("all");
  const [assetForm, setAssetForm] = useState<FinanceAsset>(() =>
    createBlankAsset(financeService.getChartOfAccounts()),
  );
  const [maintenanceForm, setMaintenanceForm] =
    useState<FinanceAssetMaintenanceRecord>(() =>
      createBlankMaintenanceRecord(
        financeService.getAssets(),
        financeService.getChartOfAccounts(),
      ),
    );
  const [disposalForm, setDisposalForm] = useState<FinanceAssetDisposalRecord>(
    () =>
      createBlankDisposalRecord(
        financeService.getAssets(),
        financeService.getChartOfAccounts(),
      ),
  );
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"success" | "error">("success");

  const canManageCoa = permissionService.canManageChartOfAccounts();

  useEffect(() => {
    let isMounted = true;

    void settingsService.getSettings().then((settings) => {
      if (!isMounted) return;
      setCustomSubTypes(settings.financeCustomSubTypes || {});
    });

    return () => {
      isMounted = false;
    };
  }, []);
  const canManageCashBank = permissionService.canManageCashBankAccounts();
  const canViewLedger = permissionService.canViewFinanceLedger();
  const canCreateLedgerEntry = permissionService.canCreateFinanceTransaction();

  const cashBankCoa = useMemo(
    () =>
      chartOfAccounts.filter(
        (account) =>
          account.status === "active" && account.isCashBankAccount === true,
      ),
    [chartOfAccounts],
  );

  const filteredCoa = useMemo(() => {
    const query = coaSearch.trim().toLowerCase();
    if (!query) return chartOfAccounts;
    return chartOfAccounts.filter(
      (account) =>
        account.accountCode.toLowerCase().includes(query) ||
        account.accountName.toLowerCase().includes(query) ||
        account.accountType.toLowerCase().includes(query),
    );
  }, [chartOfAccounts, coaSearch]);

  const accountSubTypeOptions = useMemo(() => {
    const accountType = coaForm.accountType;
    const legacyForType = chartOfAccounts
      .filter((account) => account.accountType === accountType)
      .map((account) => account.accountSubType);

    return mergeSubtypeOptions(
      DEFAULT_ACCOUNT_SUB_TYPES[accountType],
      customSubTypes[accountType] || [],
      legacyForType,
      [coaForm.accountSubType],
    );
  }, [
    chartOfAccounts,
    coaForm.accountSubType,
    coaForm.accountType,
    customSubTypes,
  ]);

  const standardSubTypeOptions = useMemo(
    () =>
      mergeSubtypeOptions(
        DEFAULT_ACCOUNT_SUB_TYPES[coaForm.accountType],
        customSubTypes[coaForm.accountType] || [],
      ),
    [coaForm.accountType, customSubTypes],
  );

  const filteredCashBank = useMemo(() => {
    const query = cashBankSearch.trim().toLowerCase();
    if (!query) return cashBankAccounts;
    return cashBankAccounts.filter(
      (account) =>
        account.accountName.toLowerCase().includes(query) ||
        (account.accountCode || "").toLowerCase().includes(query) ||
        account.accountType.toLowerCase().includes(query) ||
        account.currency.toLowerCase().includes(query),
    );
  }, [cashBankAccounts, cashBankSearch]);

  const displayedLedgerEntries = useMemo(() => {
    const baseEntries = selectedLedgerAccountId
      ? financeLedgerService.calculateRunningBalance(selectedLedgerAccountId)
      : ledgerEntries;
    return baseEntries.filter((entry) => {
      const entryDate = entry.transactionDate.slice(0, 10);
      return (
        (!ledgerDateFrom || entryDate >= ledgerDateFrom) &&
        (!ledgerDateTo || entryDate <= ledgerDateTo)
      );
    });
  }, [ledgerDateFrom, ledgerDateTo, ledgerEntries, selectedLedgerAccountId]);

  const activeCoaAccounts = useMemo(
    () => chartOfAccounts.filter((account) => account.status === "active"),
    [chartOfAccounts],
  );

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesCategory =
        assetCategoryFilter === "all" || asset.category === assetCategoryFilter;
      const matchesQuery =
        !query ||
        asset.assetCode.toLowerCase().includes(query) ||
        asset.assetName.toLowerCase().includes(query) ||
        asset.category.toLowerCase().includes(query) ||
        (asset.assignedTo || "").toLowerCase().includes(query) ||
        (asset.location || "").toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [assetCategoryFilter, assetSearch, assets]);

  const totals = useMemo(() => {
    const activeCashBank = cashBankAccounts.filter(
      (account) => account.status === "active",
    );
    return {
      totalCoa: chartOfAccounts.length,
      activeCashBank: activeCashBank.length,
      openingBalances: activeCashBank.reduce(
        (sum, account) => sum + account.openingBalance,
        0,
      ),
      currentBalances: activeCashBank.reduce(
        (sum, account) => sum + account.currentBalance,
        0,
      ),
      inactiveAccounts:
        chartOfAccounts.filter((account) => account.status === "inactive")
          .length +
        cashBankAccounts.filter((account) => account.status === "inactive")
          .length,
    };
  }, [cashBankAccounts, chartOfAccounts]);

  const refreshFinanceData = () => {
    const nextCoa = financeService.getChartOfAccounts();
    const nextCashBank = financeService.getCashBankAccounts();
    const nextLedger = financeLedgerService.getLedgerEntries();
    const nextAssets = financeService.getAssets();
    const nextMaintenance = financeService.getAssetMaintenanceRecords();
    const nextDisposals = financeService.getAssetDisposalRecords();
    setChartOfAccounts(nextCoa);
    setCashBankAccounts(nextCashBank);
    setLedgerEntries(nextLedger);
    setAssets(nextAssets);
    setMaintenanceRecords(nextMaintenance);
    setDisposalRecords(nextDisposals);
    return nextCoa;
  };

  const showAlert = (message: string, type: "success" | "error") => {
    setAlertMessage(message);
    setAlertType(type);
  };

  const handleSeedDefaultCoa = () => {
    try {
      const nextCoa = financeService.seedDefaultChartOfAccounts();
      setChartOfAccounts(nextCoa);
      setCashBankForm(createBlankCashBank(nextCoa.filter((a) => a.isCashBankAccount)));
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to seed COA.", "error");
    }
  };

  const handleSaveCoa = () => {
    try {
      financeService.saveChartOfAccount(coaForm);
      const nextCoa = refreshFinanceData();
      setCoaForm(createBlankCoa());
      setCashBankForm((prev) =>
        prev.accountId
          ? prev
          : createBlankCashBank(nextCoa.filter((a) => a.isCashBankAccount)),
      );
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Failed to save account.",
        "error",
      );
    }
  };

  const handleAddCustomSubType = async (value: string) => {
    if (!canManageCoa) {
      showAlert("Only Finance COA managers can add custom subtypes.", "error");
      return false;
    }

    const clean = value.trim();
    if (!clean) {
      showAlert("Subtype name is required.", "error");
      return false;
    }

    const accountType = coaForm.accountType;
    const existing = mergeSubtypeOptions(
      DEFAULT_ACCOUNT_SUB_TYPES[accountType],
      customSubTypes[accountType] || [],
      chartOfAccounts
        .filter((account) => account.accountType === accountType)
        .map((account) => account.accountSubType),
    );

    if (
      existing.some(
        (option) => normalizeSubtype(option) === normalizeSubtype(clean),
      )
    ) {
      showAlert("Subtype already exists.", "error");
      return false;
    }

    try {
      const settings = await settingsService.getSettings();
      const nextCustomSubTypes = {
        ...(settings.financeCustomSubTypes || {}),
        [accountType]: mergeSubtypeOptions(
          settings.financeCustomSubTypes?.[accountType] || [],
          [clean],
        ),
      };

      await settingsService.saveSettings({
        ...settings,
        financeCustomSubTypes: nextCustomSubTypes,
      });

      setCustomSubTypes(nextCustomSubTypes);
      showAlert("Custom subtype added.", "success");
      return true;
    } catch (error) {
      showAlert(
        error instanceof Error
          ? error.message
          : "Failed to save custom subtype.",
        "error",
      );
      return false;
    }
  };

  const handleDeactivateCoa = (account: ChartOfAccount) => {
    try {
      financeService.deleteOrDeactivateAccount(account.id);
      refreshFinanceData();
      if (coaForm.id === account.id) setCoaForm(createBlankCoa());
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Failed to deactivate account.",
        "error",
      );
    }
  };

  const handleSaveCashBank = () => {
    try {
      financeService.saveCashBankAccount(cashBankForm);
      refreshFinanceData();
      setCashBankForm(createBlankCashBank(cashBankCoa));
      setLedgerForm(createBlankLedgerEntry(financeService.getCashBankAccounts()));
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error
          ? error.message
          : "Failed to save cash/bank account.",
        "error",
      );
    }
  };

  const handleDeactivateCashBank = (account: CashBankAccount) => {
    try {
      financeService.deleteOrDeactivateCashBankAccount(account.id);
      refreshFinanceData();
      if (cashBankForm.id === account.id) {
        setCashBankForm(createBlankCashBank(cashBankCoa));
      }
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error
          ? error.message
          : "Failed to deactivate cash/bank account.",
        "error",
      );
    }
  };

  const handleCashBankCoaChange = (accountId: string) => {
    const linked = cashBankCoa.find((account) => account.id === accountId);
    setCashBankForm((prev) => ({
      ...prev,
      accountId,
      accountCode: linked?.accountCode,
      accountName: prev.accountName || linked?.accountName || "",
    }));
  };

  const handleLedgerCashBankChange = (cashBankAccountId: string) => {
    const linked = cashBankAccounts.find(
      (account) => account.id === cashBankAccountId,
    );
    setLedgerForm((prev) => ({
      ...prev,
      cashBankAccountId,
      accountId: linked?.accountId || "",
    }));
  };

  const handleSaveLedgerEntry = () => {
    try {
      financeLedgerService.saveLedgerEntry(ledgerForm);
      refreshFinanceData();
      setLedgerForm(createBlankLedgerEntry(financeService.getCashBankAccounts()));
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error
          ? error.message
          : "Failed to save ledger entry.",
        "error",
      );
    }
  };

  const handleVoidLedgerEntry = (entry: FinanceLedgerEntry) => {
    try {
      financeLedgerService.voidLedgerEntry(entry.id);
      refreshFinanceData();
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error
          ? error.message
          : "Failed to void ledger entry.",
        "error",
      );
    }
  };

  const handleSaveAsset = () => {
    try {
      financeService.saveAsset(assetForm);
      const nextCoa = refreshFinanceData();
      setAssetForm(createBlankAsset(nextCoa));
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Failed to save asset.",
        "error",
      );
    }
  };

  const handleDeactivateAsset = (asset: FinanceAsset) => {
    try {
      financeService.deactivateAsset(asset.id);
      refreshFinanceData();
      if (assetForm.id === asset.id) {
        setAssetForm(createBlankAsset(chartOfAccounts));
      }
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Failed to deactivate asset.",
        "error",
      );
    }
  };

  const handleSaveMaintenance = () => {
    try {
      financeService.saveAssetMaintenanceRecord(maintenanceForm);
      refreshFinanceData();
      setMaintenanceForm(createBlankMaintenanceRecord(assets, chartOfAccounts));
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error
          ? error.message
          : "Failed to save maintenance record.",
        "error",
      );
    }
  };

  const handleSaveDisposal = () => {
    try {
      financeService.saveAssetDisposalRecord(disposalForm);
      refreshFinanceData();
      setDisposalForm(createBlankDisposalRecord(assets, chartOfAccounts));
      showAlert("Saved successfully", "success");
    } catch (error) {
      showAlert(
        error instanceof Error
          ? error.message
          : "Failed to save disposal record.",
        "error",
      );
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <section className="bg-white border border-stone-200 p-5 md:p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-brand-orange">
          SCI / iTred Finance
        </p>
        <h1 className="text-2xl font-black text-brand-charcoal mt-2">
          Finance Desk
        </h1>
        <p className="text-sm text-stone-600 mt-3 max-w-4xl">
          Phase 1 establishes the Chart of Accounts and operating cash/bank
          accounts used by later finance modules.
        </p>
      </section>

      {alertMessage && (
        <div
          className={`border-l-4 p-4 text-xs font-bold uppercase tracking-wide ${
            alertType === "success"
              ? "bg-green-50 border-green-600 text-green-800"
              : "bg-red-50 border-red-600 text-red-800"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <span>{alertMessage}</span>
            <button
              type="button"
              className="text-[10px] font-black"
              onClick={() => setAlertMessage("")}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <nav className="grid grid-cols-2 lg:grid-cols-6 border border-stone-200 bg-white">
        {[
          ["overview", "Overview"],
          ["chart-of-accounts", "Chart of Accounts"],
          ["cash-bank-accounts", "Cash/Bank Accounts"],
          ["cash-bank-ledger", "Cash/Bank Ledger"],
          ["asset-register", "Asset Register"],
          ["setup-status", "Finance Setup Status"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as FinanceTab)}
            className={`px-3 py-3 text-[10px] font-black uppercase tracking-widest border-b lg:border-b-0 lg:border-r last:border-r-0 border-stone-200 ${
              activeTab === id
                ? "bg-brand-charcoal text-white"
                : "bg-white text-stone-500 hover:text-brand-orange"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {[
            ["Total COA Accounts", totals.totalCoa],
            ["Active Cash/Bank Accounts", totals.activeCashBank],
            ["Total Opening Balances", formatMoney(totals.openingBalances)],
            ["Total Current Balances", formatMoney(totals.currentBalances)],
            ["Inactive Accounts", totals.inactiveAccounts],
          ].map(([label, value]) => (
            <div
              key={label}
              className="bg-white border-2 border-stone-200 p-4 min-h-[120px]"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                {label}
              </p>
              <p className="text-2xl font-black text-brand-charcoal mt-4">
                {value}
              </p>
            </div>
          ))}
        </section>
      )}

      {activeTab === "chart-of-accounts" && (
        <section className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
          <div className="bg-white border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black uppercase text-brand-charcoal">
                  Chart of Accounts
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Core accounts for SCI / iTred finance setup.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={coaSearch}
                  onChange={(event) => setCoaSearch(event.target.value)}
                  className={inputClass}
                  placeholder="Search accounts"
                />
                <button
                  type="button"
                  disabled={!canManageCoa}
                  onClick={handleSeedDefaultCoa}
                  className="bg-brand-orange px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                >
                  Seed Default COA
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-widest text-stone-400">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Cash/Bank</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredCoa.map((account) => (
                    <tr key={account.id}>
                      <td className="px-4 py-3 font-mono font-bold">
                        {account.accountCode}
                      </td>
                      <td className="px-4 py-3 font-bold text-brand-charcoal">
                        {account.accountName}
                      </td>
                      <td className="px-4 py-3">{account.accountType}</td>
                      <td className="px-4 py-3">{account.normalBalance}</td>
                      <td className="px-4 py-3">
                        {account.isCashBankAccount ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {account.status}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCoaForm(account)}
                            className="border border-stone-200 px-3 py-1 text-[10px] font-black uppercase"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={!canManageCoa || account.status === "inactive"}
                            onClick={() => handleDeactivateCoa(account)}
                            className="border border-red-200 px-3 py-1 text-[10px] font-black uppercase text-red-700 disabled:opacity-40"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCoa.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-stone-400" colSpan={7}>
                        No accounts configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase text-brand-charcoal">
                {coaForm.id ? "Edit Account" : "Add Account"}
              </h2>
              <button
                type="button"
                onClick={() => setCoaForm(createBlankCoa())}
                className="border border-stone-200 px-3 py-1 text-[10px] font-black uppercase"
              >
                Add Account
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={labelClass}>Account Code</span>
                <input
                  value={coaForm.accountCode}
                  onChange={(event) =>
                    setCoaForm((prev) => ({
                      ...prev,
                      accountCode: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Account Name</span>
                <input
                  value={coaForm.accountName}
                  onChange={(event) =>
                    setCoaForm((prev) => ({
                      ...prev,
                      accountName: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Account Type</span>
                <select
                  value={coaForm.accountType}
                  onChange={(event) =>
                    setCoaForm((prev) => ({
                      ...prev,
                      accountType: event.target.value as AccountType,
                    }))
                  }
                  className={inputClass}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Normal Balance</span>
                <select
                  value={coaForm.normalBalance}
                  onChange={(event) =>
                    setCoaForm((prev) => ({
                      ...prev,
                      normalBalance: event.target.value as "Debit" | "Credit",
                    }))
                  }
                  className={inputClass}
                >
                  <option value="Debit">Debit</option>
                  <option value="Credit">Credit</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Account Sub Type</span>
                <AccountSubTypeCombo
                  value={coaForm.accountSubType || ""}
                  accountType={coaForm.accountType}
                  options={accountSubTypeOptions}
                  standardOptions={standardSubTypeOptions}
                  canAddCustom={canManageCoa}
                  onChange={(value) =>
                    setCoaForm((prev) => ({
                      ...prev,
                      accountSubType: value,
                    }))
                  }
                  onAddCustom={handleAddCustomSubType}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Status</span>
                <select
                  value={coaForm.status}
                  onChange={(event) =>
                    setCoaForm((prev) => ({
                      ...prev,
                      status: event.target.value as "active" | "inactive",
                    }))
                  }
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <label className="space-y-1 block">
              <span className={labelClass}>Description</span>
              <textarea
                value={coaForm.description || ""}
                onChange={(event) =>
                  setCoaForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                className={`${inputClass} min-h-[84px]`}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-stone-700">
              <input
                type="checkbox"
                checked={!!coaForm.isCashBankAccount}
                onChange={(event) =>
                  setCoaForm((prev) => ({
                    ...prev,
                    isCashBankAccount: event.target.checked,
                  }))
                }
              />
              Cash/Bank controlled account
            </label>
            <button
              type="button"
              disabled={!canManageCoa}
              onClick={handleSaveCoa}
              className="w-full bg-brand-charcoal px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
            >
              Save Account
            </button>
          </div>
        </section>
      )}

      {activeTab === "cash-bank-accounts" && (
        <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
          <div className="bg-white border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black uppercase text-brand-charcoal">
                  Cash/Bank Accounts
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Operating accounts linked to cash/bank COA accounts.
                </p>
              </div>
              <input
                value={cashBankSearch}
                onChange={(event) => setCashBankSearch(event.target.value)}
                className={`${inputClass} md:max-w-xs`}
                placeholder="Search cash/bank accounts"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-widest text-stone-400">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3">Opening</th>
                    <th className="px-4 py-3">Current</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredCashBank.map((account) => (
                    <tr key={account.id}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-brand-charcoal">
                          {account.accountName}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          {account.accountCode || "Uncoded"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{account.accountType}</td>
                      <td className="px-4 py-3">{account.currency}</td>
                      <td className="px-4 py-3 font-mono">
                        {formatMoney(account.openingBalance)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        {formatMoney(account.currentBalance)}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {account.status}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCashBankForm(account)}
                            className="border border-stone-200 px-3 py-1 text-[10px] font-black uppercase"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={
                              !canManageCashBank ||
                              account.status === "inactive"
                            }
                            onClick={() => handleDeactivateCashBank(account)}
                            className="border border-red-200 px-3 py-1 text-[10px] font-black uppercase text-red-700 disabled:opacity-40"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCashBank.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-stone-400" colSpan={7}>
                        No cash/bank accounts configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase text-brand-charcoal">
                {cashBankForm.id ? "Edit Cash/Bank" : "Add Cash/Bank"}
              </h2>
              <button
                type="button"
                onClick={() => setCashBankForm(createBlankCashBank(cashBankCoa))}
                className="border border-stone-200 px-3 py-1 text-[10px] font-black uppercase"
              >
                Add Account
              </button>
            </div>
            {cashBankCoa.length === 0 && (
              <div className="border-l-4 border-brand-orange bg-orange-50 p-3 text-xs font-semibold text-orange-800">
                Create or seed an active COA account marked as Cash/Bank before
                adding cash/bank accounts.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1 md:col-span-2">
                <span className={labelClass}>Linked COA Account</span>
                <input
                  value={linkedCoaSearch}
                  onChange={(event) => setLinkedCoaSearch(event.target.value)}
                  className={`${inputClass} mb-2`}
                  placeholder="Search available COA accounts"
                />
                <select
                  value={cashBankForm.accountId}
                  onChange={(event) => handleCashBankCoaChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select linked COA account</option>
                  {cashBankCoa
                    .filter((account) => {
                      const query = linkedCoaSearch.trim().toLowerCase();
                      return (
                        !query ||
                        account.accountCode.toLowerCase().includes(query) ||
                        account.accountName.toLowerCase().includes(query)
                      );
                    })
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountCode} - {account.accountName}
                      </option>
                    ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Account Name</span>
                <input
                  value={cashBankForm.accountName}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      accountName: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Account Type</span>
                <select
                  value={cashBankForm.accountType}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      accountType: event.target
                        .value as CashBankAccount["accountType"],
                    }))
                  }
                  className={inputClass}
                >
                  {CASH_BANK_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Currency</span>
                <select
                  value={cashBankForm.currency}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      currency: event.target.value as CashBankAccount["currency"],
                    }))
                  }
                  className={inputClass}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Status</span>
                <select
                  value={cashBankForm.status}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      status: event.target.value as "active" | "inactive",
                    }))
                  }
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Bank Name</span>
                <input
                  value={cashBankForm.bankName || ""}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      bankName: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Branch Name</span>
                <input
                  value={cashBankForm.branchName || ""}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      branchName: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Account Number</span>
                <input
                  value={cashBankForm.accountNumber || ""}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      accountNumber: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Wallet Number</span>
                <input
                  value={cashBankForm.walletNumber || ""}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      walletNumber: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Opening Balance</span>
                <input
                  type="number"
                  value={cashBankForm.openingBalance}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      openingBalance: Number(event.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Current Balance</span>
                <input
                  type="number"
                  value={cashBankForm.currentBalance}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      currentBalance: Number(event.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Approval Limit</span>
                <input
                  type="number"
                  value={cashBankForm.approvalLimit ?? ""}
                  onChange={(event) =>
                    setCashBankForm((prev) => ({
                      ...prev,
                      approvalLimit:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-stone-700">
              <input
                type="checkbox"
                checked={cashBankForm.requiresApprovalForPayments}
                onChange={(event) =>
                  setCashBankForm((prev) => ({
                    ...prev,
                    requiresApprovalForPayments: event.target.checked,
                  }))
                }
              />
              Requires approval for payments
            </label>
            <button
              type="button"
              disabled={!canManageCashBank || cashBankCoa.length === 0}
              onClick={handleSaveCashBank}
              className="w-full bg-brand-charcoal px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
            >
              Save Cash/Bank Account
            </button>
          </div>
        </section>
      )}

      {activeTab === "cash-bank-ledger" && (
        <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
          <div className="bg-white border border-stone-200">
            <div className="p-4 border-b border-stone-200 space-y-4">
              <div>
                <h2 className="text-sm font-black uppercase text-brand-charcoal">
                  Cash/Bank Ledger
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Basic ledger foundation filtered by Chart of Accounts account.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className={labelClass}>Ledger Account</span>
                  <select
                    value={selectedLedgerAccountId}
                    onChange={(event) =>
                      setSelectedLedgerAccountId(event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">All accounts</option>
                    {cashBankAccounts.map((account) => (
                      <option key={account.id} value={account.accountId}>
                        {account.accountCode} - {account.accountName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Date From</span>
                  <input
                    type="date"
                    value={ledgerDateFrom}
                    onChange={(event) => setLedgerDateFrom(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Date To</span>
                  <input
                    type="date"
                    value={ledgerDateTo}
                    onChange={(event) => setLedgerDateTo(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
            {!canViewLedger ? (
              <div className="p-8 text-center text-xs font-bold uppercase tracking-wide text-stone-400">
                Ledger access is restricted.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-widest text-stone-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Transaction</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Payee/Payer</th>
                      <th className="px-4 py-3">Debit</th>
                      <th className="px-4 py-3">Credit</th>
                      <th className="px-4 py-3">Running Balance</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {displayedLedgerEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 font-mono">
                          {entry.transactionDate.slice(0, 10)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-brand-charcoal">
                            {entry.transactionNumber}
                          </div>
                          <div className="text-[10px] text-stone-400">
                            {entry.transactionType}
                          </div>
                        </td>
                        <td className="px-4 py-3">{entry.description}</td>
                        <td className="px-4 py-3">
                          {entry.payeeName || entry.payerName || "Not specified"}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {formatMoney(entry.debit)}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {formatMoney(entry.credit)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          {entry.runningBalance === undefined
                            ? "-"
                            : formatMoney(entry.runningBalance)}
                        </td>
                        <td className="px-4 py-3 capitalize">{entry.status}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={entry.status === "void"}
                            onClick={() => handleVoidLedgerEntry(entry)}
                            className="border border-red-200 px-3 py-1 text-[10px] font-black uppercase text-red-700 disabled:opacity-40"
                          >
                            Void
                          </button>
                        </td>
                      </tr>
                    ))}
                    {displayedLedgerEntries.length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-center text-stone-400" colSpan={9}>
                          No ledger entries found for the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-stone-200 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase text-brand-charcoal">
                Manual Ledger Entry
              </h2>
              <button
                type="button"
                onClick={() =>
                  setLedgerForm(createBlankLedgerEntry(cashBankAccounts))
                }
                className="border border-stone-200 px-3 py-1 text-[10px] font-black uppercase"
              >
                Add Manual Ledger Entry
              </button>
            </div>
            <div className="border-l-4 border-brand-orange bg-orange-50 p-3 text-xs font-semibold text-orange-800">
              This is a simple cash/bank ledger only. Check writer, receipts,
              journals, RPN payments, PDF exports and approvals are not enabled.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={labelClass}>Date</span>
                <input
                  type="date"
                  value={ledgerForm.transactionDate}
                  onChange={(event) =>
                    setLedgerForm((prev) => ({
                      ...prev,
                      transactionDate: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Status</span>
                <select
                  value={ledgerForm.status}
                  onChange={(event) =>
                    setLedgerForm((prev) => ({
                      ...prev,
                      status: event.target.value as FinanceLedgerEntry["status"],
                    }))
                  }
                  className={inputClass}
                >
                  <option value="draft">Draft</option>
                  <option value="posted">Posted</option>
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className={labelClass}>Account</span>
                <select
                  value={ledgerForm.cashBankAccountId || ""}
                  onChange={(event) =>
                    handleLedgerCashBankChange(event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select cash/bank account</option>
                  {cashBankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountCode} - {account.accountName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Transaction Type</span>
                <select
                  value={ledgerForm.transactionType}
                  onChange={(event) =>
                    setLedgerForm((prev) => ({
                      ...prev,
                      transactionType: event.target
                        .value as FinanceLedgerEntry["transactionType"],
                    }))
                  }
                  className={inputClass}
                >
                  {LEDGER_TRANSACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Reference</span>
                <input
                  value={ledgerForm.reference || ""}
                  onChange={(event) =>
                    setLedgerForm((prev) => ({
                      ...prev,
                      reference: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className={labelClass}>Description</span>
                <input
                  value={ledgerForm.description}
                  onChange={(event) =>
                    setLedgerForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Debit</span>
                <input
                  type="number"
                  value={ledgerForm.debit}
                  onChange={(event) =>
                    setLedgerForm((prev) => ({
                      ...prev,
                      debit: Number(event.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Credit</span>
                <input
                  type="number"
                  value={ledgerForm.credit}
                  onChange={(event) =>
                    setLedgerForm((prev) => ({
                      ...prev,
                      credit: Number(event.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!canCreateLedgerEntry || cashBankAccounts.length === 0}
              onClick={handleSaveLedgerEntry}
              className="w-full bg-brand-charcoal px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
            >
              Save Ledger Entry
            </button>
          </div>
        </section>
      )}

      {activeTab === "asset-register" && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              ["Total Assets", assets.length],
              [
                "Active / Assigned",
                assets.filter(
                  (asset) =>
                    asset.status === "active" || asset.status === "assigned",
                ).length,
              ],
              [
                "Purchase Cost",
                formatMoney(
                  assets.reduce((sum, asset) => sum + asset.purchaseCost, 0),
                ),
              ],
              [
                "Maintenance Spend",
                formatMoney(
                  maintenanceRecords.reduce(
                    (sum, record) => sum + record.cost,
                    0,
                  ),
                ),
              ],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border-2 border-stone-200 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  {label}
                </p>
                <p className="text-2xl font-black text-brand-charcoal mt-3">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
            <div className="bg-white border border-stone-200">
              <div className="p-4 border-b border-stone-200 space-y-4">
                <div>
                  <h2 className="text-sm font-black uppercase text-brand-charcoal">
                    Asset Register
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    Connectivity kits, network devices, furniture, equipment,
                    buildings, vehicles, RPN phones and campaign kits.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    className={inputClass}
                    placeholder="Search asset, assignee or location"
                  />
                  <select
                    value={assetCategoryFilter}
                    onChange={(event) =>
                      setAssetCategoryFilter(
                        event.target.value as FinanceAssetCategory | "all",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="all">All categories</option>
                    {ASSET_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-widest text-stone-400">
                    <tr>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Assigned / Location</th>
                      <th className="px-4 py-3">Cost</th>
                      <th className="px-4 py-3">Current Value</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-brand-charcoal">
                            {asset.assetCode} - {asset.assetName}
                          </div>
                          <div className="text-[10px] text-stone-400">
                            {[asset.brand, asset.model, asset.serialNumber]
                              .filter(Boolean)
                              .join(" / ") || "No device details"}
                          </div>
                        </td>
                        <td className="px-4 py-3">{asset.category}</td>
                        <td className="px-4 py-3">
                          {asset.assignedTo || asset.location || "Unassigned"}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {formatMoney(asset.purchaseCost)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          {formatMoney(asset.currentValue)}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {asset.status.replace("-", " ")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setAssetForm(asset)}
                              className="border border-stone-200 px-3 py-1 text-[10px] font-black uppercase"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={asset.status === "inactive"}
                              onClick={() => handleDeactivateAsset(asset)}
                              className="border border-red-200 px-3 py-1 text-[10px] font-black uppercase text-red-700 disabled:opacity-40"
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAssets.length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-center text-stone-400" colSpan={7}>
                          No assets configured.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase text-brand-charcoal">
                  {assetForm.id ? "Edit Asset" : "Add Asset"}
                </h2>
                <button
                  type="button"
                  onClick={() => setAssetForm(createBlankAsset(chartOfAccounts))}
                  className="border border-stone-200 px-3 py-1 text-[10px] font-black uppercase"
                >
                  Add Asset
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className={labelClass}>Asset Code</span>
                  <input
                    value={assetForm.assetCode}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        assetCode: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Asset Name</span>
                  <input
                    value={assetForm.assetName}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        assetName: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className={labelClass}>Category</span>
                  <select
                    value={assetForm.category}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        category: event.target.value as FinanceAssetCategory,
                      }))
                    }
                    className={inputClass}
                  >
                    {ASSET_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                {[
                  ["Brand", "brand"],
                  ["Model", "model"],
                  ["Serial Number", "serialNumber"],
                  ["Location", "location"],
                  ["Assigned To", "assignedTo"],
                  ["Supplier", "supplierName"],
                ].map(([label, key]) => (
                  <label key={key} className="space-y-1">
                    <span className={labelClass}>{label}</span>
                    <input
                      value={String(assetForm[key as keyof FinanceAsset] || "")}
                      onChange={(event) =>
                        setAssetForm((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>
                ))}
                <label className="space-y-1">
                  <span className={labelClass}>Acquisition Date</span>
                  <input
                    type="date"
                    value={assetForm.acquisitionDate}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        acquisitionDate: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Warranty Expiry</span>
                  <input
                    type="date"
                    value={assetForm.warrantyExpiryDate || ""}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        warrantyExpiryDate: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Purchase Cost</span>
                  <input
                    type="number"
                    value={assetForm.purchaseCost}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        purchaseCost: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Current Value</span>
                  <input
                    type="number"
                    value={assetForm.currentValue}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        currentValue: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Asset COA</span>
                  <select
                    value={assetForm.assetAccountId}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        assetAccountId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select COA</option>
                    {activeCoaAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountCode} - {account.accountName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Maintenance Expense COA</span>
                  <select
                    value={assetForm.maintenanceExpenseAccountId}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        maintenanceExpenseAccountId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select COA</option>
                    {activeCoaAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountCode} - {account.accountName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Disposal COA</span>
                  <select
                    value={assetForm.disposalAccountId || ""}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        disposalAccountId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select COA</option>
                    {activeCoaAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountCode} - {account.accountName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Status</span>
                  <select
                    value={assetForm.status}
                    onChange={(event) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        status: event.target.value as FinanceAsset["status"],
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="active">Active</option>
                    <option value="assigned">Assigned</option>
                    <option value="in-maintenance">In Maintenance</option>
                    <option value="disposed">Disposed</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              <label className="space-y-1 block">
                <span className={labelClass}>Notes</span>
                <textarea
                  value={assetForm.notes || ""}
                  onChange={(event) =>
                    setAssetForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  className={`${inputClass} min-h-[72px]`}
                />
              </label>
              <button
                type="button"
                onClick={handleSaveAsset}
                className="w-full bg-brand-charcoal px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
              >
                Save Asset
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 p-4 space-y-4">
              <h2 className="text-sm font-black uppercase text-brand-charcoal">
                Maintenance Tracking
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1 md:col-span-2">
                  <span className={labelClass}>Asset</span>
                  <select
                    value={maintenanceForm.assetId}
                    onChange={(event) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        assetId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select asset</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.assetCode} - {asset.assetName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Date</span>
                  <input
                    type="date"
                    value={maintenanceForm.maintenanceDate}
                    onChange={(event) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        maintenanceDate: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Type</span>
                  <select
                    value={maintenanceForm.maintenanceType}
                    onChange={(event) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        maintenanceType:
                          event.target
                            .value as FinanceAssetMaintenanceRecord["maintenanceType"],
                      }))
                    }
                    className={inputClass}
                  >
                    {["Inspection", "Repair", "Service", "Replacement", "Upgrade", "Other"].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Provider</span>
                  <input
                    value={maintenanceForm.provider || ""}
                    onChange={(event) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        provider: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Cost</span>
                  <input
                    type="number"
                    value={maintenanceForm.cost}
                    onChange={(event) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        cost: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className={labelClass}>Expense COA</span>
                  <select
                    value={maintenanceForm.expenseAccountId}
                    onChange={(event) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        expenseAccountId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select COA</option>
                    {activeCoaAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountCode} - {account.accountName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={handleSaveMaintenance}
                className="w-full bg-brand-charcoal px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
              >
                Save Maintenance
              </button>
              <div className="max-h-56 overflow-auto divide-y divide-stone-100 border border-stone-100">
                {maintenanceRecords.slice(0, 8).map((record) => {
                  const asset = assets.find((item) => item.id === record.assetId);
                  return (
                    <div key={record.id} className="p-3 text-xs">
                      <div className="font-bold text-brand-charcoal">
                        {asset?.assetName || "Unknown asset"} - {record.maintenanceType}
                      </div>
                      <div className="text-stone-500 mt-1">
                        {record.maintenanceDate} / {formatMoney(record.cost)} / {record.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4 space-y-4">
              <h2 className="text-sm font-black uppercase text-brand-charcoal">
                Disposal Tracking
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1 md:col-span-2">
                  <span className={labelClass}>Asset</span>
                  <select
                    value={disposalForm.assetId}
                    onChange={(event) =>
                      setDisposalForm((prev) => ({
                        ...prev,
                        assetId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select asset</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.assetCode} - {asset.assetName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Date</span>
                  <input
                    type="date"
                    value={disposalForm.disposalDate}
                    onChange={(event) =>
                      setDisposalForm((prev) => ({
                        ...prev,
                        disposalDate: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Method</span>
                  <select
                    value={disposalForm.disposalMethod}
                    onChange={(event) =>
                      setDisposalForm((prev) => ({
                        ...prev,
                        disposalMethod:
                          event.target
                            .value as FinanceAssetDisposalRecord["disposalMethod"],
                      }))
                    }
                    className={inputClass}
                  >
                    {["Sold", "Scrapped", "Donated", "Lost", "Stolen", "Other"].map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Proceeds</span>
                  <input
                    type="number"
                    value={disposalForm.proceeds}
                    onChange={(event) =>
                      setDisposalForm((prev) => ({
                        ...prev,
                        proceeds: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={labelClass}>Disposal COA</span>
                  <select
                    value={disposalForm.disposalAccountId}
                    onChange={(event) =>
                      setDisposalForm((prev) => ({
                        ...prev,
                        disposalAccountId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select COA</option>
                    {activeCoaAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountCode} - {account.accountName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={handleSaveDisposal}
                className="w-full bg-brand-charcoal px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
              >
                Save Disposal
              </button>
              <div className="max-h-56 overflow-auto divide-y divide-stone-100 border border-stone-100">
                {disposalRecords.slice(0, 8).map((record) => {
                  const asset = assets.find((item) => item.id === record.assetId);
                  return (
                    <div key={record.id} className="p-3 text-xs">
                      <div className="font-bold text-brand-charcoal">
                        {asset?.assetName || "Unknown asset"} - {record.disposalMethod}
                      </div>
                      <div className="text-stone-500 mt-1">
                        {record.disposalDate} / {formatMoney(record.proceeds)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </section>
      )}

      {activeTab === "setup-status" && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-stone-200 p-5">
            <h2 className="text-sm font-black uppercase text-brand-charcoal">
              Chart of Accounts
            </h2>
            <p className="text-xs text-stone-500 mt-2">
              {chartOfAccounts.length > 0
                ? "Configured and ready for account mapping."
                : "Not configured. Seed or add accounts to continue."}
            </p>
          </div>
          <div className="bg-white border-2 border-stone-200 p-5">
            <h2 className="text-sm font-black uppercase text-brand-charcoal">
              Cash/Bank Accounts
            </h2>
            <p className="text-xs text-stone-500 mt-2">
              {cashBankAccounts.length > 0
                ? "Operating accounts are configured."
                : "No operating accounts configured yet."}
            </p>
          </div>
          <div className="bg-white border-2 border-brand-orange p-5">
            <h2 className="text-sm font-black uppercase text-brand-charcoal">
              Console Cashbook Active
            </h2>
            <p className="text-xs text-stone-500 mt-2">
              Use Cash & Bank Manager for iTred Console receipts, payments,
              transfers and ledger posting.
            </p>
          </div>
        </section>
      )}
    </div>
  );
};

export default FinanceDesk;
