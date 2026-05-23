/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CashBankAccount, FinanceLedgerEntry } from "../types.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { generateLedgerEntryId } from "../utils/idGenerator.ts";
import { getSession as getActiveSession } from "../utils/session.ts";

const LEDGER_KEY = "itred_finance_ledger_entries";

const readEntries = (): FinanceLedgerEntry[] => {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read finance ledger entries", error);
    return [];
  }
};

const writeEntries = (entries: FinanceLedgerEntry[]) => {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
};

const makeId = () => generateLedgerEntryId();

const makeTransactionNumber = () => {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `FIN-${stamp}-${Date.now().toString().slice(-6)}`;
};

const normalizeMoney = (value: unknown, fieldName: string): number => {
  const numberValue =
    typeof value === "number" ? value : Number(String(value || "0"));
  if (!Number.isFinite(numberValue) || Number.isNaN(numberValue)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return numberValue;
};

const getSession = () => {
  return getActiveSession() || {};
};

const auditLedger = (
  action: string,
  beforeSnapshot: unknown,
  afterSnapshot: FinanceLedgerEntry | undefined,
  severity: "info" | "warning" = "info",
) => {
  try {
    void staffAuditService
      .logAction({
        eventType: beforeSnapshot ? "RECORD_UPDATED" : "RECORD_CREATED",
        severity,
        module: "finance",
        action,
        recordType: "FinanceLedgerEntry",
        recordId: afterSnapshot?.id,
        recordName: afterSnapshot?.transactionNumber,
        beforeSnapshot,
        afterSnapshot,
      })
      .catch((error) => {
        console.warn("Finance ledger audit log failed", error);
      });
  } catch (error) {
    console.warn("Finance ledger audit log failed", error);
  }
};

const sortEntries = (entries: FinanceLedgerEntry[]) =>
  [...entries].sort((a, b) => {
    const dateCompare =
      new Date(a.transactionDate).getTime() -
      new Date(b.transactionDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

export const financeLedgerService = {
  getLedgerEntries: (): FinanceLedgerEntry[] => {
    return sortEntries(readEntries());
  },

  getLedgerEntriesByAccount: (accountId: string): FinanceLedgerEntry[] => {
    return financeLedgerService
      .calculateRunningBalance(accountId)
      .filter((entry) => entry.accountId === accountId);
  },

  saveLedgerEntry: (entry: FinanceLedgerEntry): FinanceLedgerEntry => {
    const entries = financeLedgerService.getLedgerEntries();
    const existing = entries.find((item) => item.id === entry.id);
    const now = new Date().toISOString();
    const debit = normalizeMoney(entry.debit, "Debit");
    const credit = normalizeMoney(entry.credit, "Credit");

    if (!entry.accountId) throw new Error("Ledger account is required.");
    if (!entry.transactionDate) throw new Error("Transaction date is required.");
    if (!entry.description.trim()) {
      throw new Error("Description is required.");
    }
    if (debit === 0 && credit === 0) {
      throw new Error("Debit and credit cannot both be zero.");
    }

    const session = getSession();
    const saved: FinanceLedgerEntry = {
      ...entry,
      id: entry.id || makeId(),
      transactionNumber:
        entry.transactionNumber?.trim() || makeTransactionNumber(),
      description: entry.description.trim(),
      debit,
      credit,
      amount: Math.abs(debit - credit),
      reference: entry.reference?.trim() || undefined,
      payeeName: entry.payeeName?.trim() || undefined,
      payerName: entry.payerName?.trim() || undefined,
      status: entry.status || "draft",
      createdByStaffId:
        existing?.createdByStaffId ||
        entry.createdByStaffId ||
        session.staffId ||
        session.id,
      createdByStaffName:
        existing?.createdByStaffName ||
        entry.createdByStaffName ||
        session.staffName ||
        session.displayName,
      createdAt: existing?.createdAt || entry.createdAt || now,
      updatedAt: now,
    };

    const nextEntries = existing
      ? entries.map((item) => (item.id === saved.id ? saved : item))
      : [...entries, saved];

    writeEntries(nextEntries);
    auditLedger(
      existing
        ? `Updated ledger entry ${saved.transactionNumber}`
        : `Created ledger entry ${saved.transactionNumber}`,
      existing,
      saved,
    );
    return saved;
  },

  postOpeningBalanceForCashBankAccount: (account: CashBankAccount): void => {
    const openingBalance = normalizeMoney(
      account.openingBalance,
      "Opening balance",
    );
    if (openingBalance <= 0) return;

    const entries = financeLedgerService.getLedgerEntries();
    const existingOpening = entries.find(
      (entry) =>
        entry.transactionType === "Opening Balance" &&
        entry.cashBankAccountId === account.id,
    );
    if (existingOpening) return;

    financeLedgerService.saveLedgerEntry({
      id: "",
      transactionNumber: "",
      transactionDate: account.createdAt || new Date().toISOString().slice(0, 10),
      transactionType: "Opening Balance",
      accountId: account.accountId,
      cashBankAccountId: account.id,
      description: `Opening balance for ${account.accountName}`,
      debit: openingBalance,
      credit: 0,
      amount: openingBalance,
      reference: "OPENING-BALANCE",
      status: "posted",
      createdAt: "",
      updatedAt: "",
    });
  },

  calculateRunningBalance: (accountId: string): FinanceLedgerEntry[] => {
    let runningBalance = 0;
    return sortEntries(
      readEntries().filter((entry) => entry.accountId === accountId),
    ).map((entry) => {
      if (entry.status !== "void") {
        runningBalance += entry.debit - entry.credit;
      }
      return {
        ...entry,
        runningBalance,
      };
    });
  },

  voidLedgerEntry: (id: string): void => {
    const entries = financeLedgerService.getLedgerEntries();
    const existing = entries.find((entry) => entry.id === id);
    if (!existing) return;

    const updated: FinanceLedgerEntry = {
      ...existing,
      status: "void",
      updatedAt: new Date().toISOString(),
    };

    writeEntries(entries.map((entry) => (entry.id === id ? updated : entry)));
    auditLedger(
      `Voided ledger entry ${existing.transactionNumber}`,
      existing,
      updated,
      "warning",
    );
  },
};
