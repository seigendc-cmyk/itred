import {
  CashBankAccount,
  CashbookTransaction,
  ChartOfAccount,
  VendorInvoice,
} from "../types.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";
import { getSession, getSessionStaffId, getSessionStaffName } from "../utils/session.ts";
import { analyticsService } from "./analyticsService.ts";
import { financeLedgerService } from "./financeLedgerService.ts";
import { financeService } from "./financeService.ts";
import { localStorageService } from "./localStorageService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { vendorBillingService } from "./vendorBillingService.ts";

const CASHBOOK_KEY = "cashbookTransactions";

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Amount must be a valid number.");
  return Math.round(parsed * 100) / 100;
};

const readTransactions = (): CashbookTransaction[] =>
  asArray<CashbookTransaction>(localStorageService.get<CashbookTransaction[]>(CASHBOOK_KEY));

const writeTransactions = (rows: CashbookTransaction[]) => {
  localStorageService.set(CASHBOOK_KEY, sanitizeForFirestore(rows) as CashbookTransaction[]);
};

const nextNumber = () =>
  `CB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now()
    .toString()
    .slice(-6)}`;

const currentStaff = () => {
  const session = getSession();
  return {
    staffId: getSessionStaffId(session) || null,
    staffName: getSessionStaffName(session, "SCI Finance"),
  };
};

const audit = (eventType: string, action: string, recordId: string, afterSnapshot: unknown) => {
  const staff = currentStaff();
  try {
    void staffAuditService.logAction({
      eventType: "RECORD_CREATED",
      module: "finance",
      severity: "info",
      action,
      recordType: "cashbook_transaction",
      recordId,
      afterSnapshot,
    });
    void analyticsService.logEvent({
      eventType: eventType as any,
      actorType: "backend_staff",
      actorName: staff.staffName,
      actorId: staff.staffId || undefined,
      result: "success",
      details: { recordId, action },
    });
  } catch (error) {
    console.warn("Cashbook audit failed", error);
  }
};

const findAccount = (accountId: string) => {
  const account = financeService
    .getCashBankAccounts()
    .find((item) => item.id === accountId);
  if (!account) throw new Error("Cash/bank account not found.");
  if (account.status !== "active") throw new Error("Cash/bank account is inactive.");
  return account;
};

const saveAccountBalance = (account: CashBankAccount, currentBalance: number) =>
  financeService.saveCashBankAccount({
    ...account,
    currentBalance: money(currentBalance),
  });

const ensureCoa = (
  accountName: string,
  accountType: ChartOfAccount["accountType"],
  normalBalance: ChartOfAccount["normalBalance"],
): ChartOfAccount => {
  financeService.seedDefaultChartOfAccounts();
  const existing = financeService
    .getChartOfAccounts()
    .find((account) => account.accountName.toLowerCase() === accountName.toLowerCase());
  if (existing) return existing;
  return financeService.saveChartOfAccount({
    id: "",
    accountCode: `${accountType.slice(0, 1).toUpperCase()}-${Date.now().toString().slice(-5)}`,
    accountName,
    accountType,
    normalBalance,
    status: "active",
    createdAt: "",
    updatedAt: "",
  });
};

const savePostedTransaction = (input: Omit<CashbookTransaction, "id" | "transactionNumber" | "status" | "postedAt" | "postedByStaffId" | "createdAt" | "updatedAt">) => {
  const staff = currentStaff();
  const now = nowIso();
  const transaction: CashbookTransaction = {
    ...input,
    id: `CBT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    transactionNumber: nextNumber(),
    status: "posted",
    postedAt: now,
    postedByStaffId: staff.staffId,
    createdAt: now,
    updatedAt: now,
  };
  writeTransactions([...readTransactions(), sanitizeForFirestore(transaction) as CashbookTransaction]);
  return transaction;
};

const postLedger = (input: {
  transaction: CashbookTransaction;
  debitAccountId: string;
  creditAccountId: string;
  debitDescription: string;
  creditDescription: string;
}) => {
  const amount = input.transaction.amount;
  const base = {
    transactionNumber: "",
    transactionDate: input.transaction.transactionDate,
    transactionType:
      input.transaction.transactionType === "receipt"
        ? "Receipt"
        : input.transaction.transactionType === "payment"
          ? "Payment"
          : "Transfer",
    amount,
    reference: input.transaction.reference || input.transaction.transactionNumber,
    status: "posted" as const,
    createdAt: "",
    updatedAt: "",
  };
  const debit = financeLedgerService.saveLedgerEntry({
    ...base,
    id: "",
    accountId: input.debitAccountId,
    cashBankAccountId: input.transaction.accountId,
    description: input.debitDescription,
    payerName: input.transaction.vendorName || undefined,
    debit: amount,
    credit: 0,
  });
  const credit = financeLedgerService.saveLedgerEntry({
    ...base,
    id: "",
    accountId: input.creditAccountId,
    cashBankAccountId: input.transaction.accountId,
    description: input.creditDescription,
    payeeName: input.transaction.vendorName || undefined,
    debit: 0,
    credit: amount,
  });
  audit("ledger_entries_created", "Created balanced cashbook ledger entries", input.transaction.id, {
    transaction: input.transaction,
    debit,
    credit,
  });
  return [debit, credit];
};

export const cashBankService = {
  getTransactions: (): CashbookTransaction[] =>
    readTransactions().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  recordVendorReceipt(input: {
    invoiceId: string;
    accountId: string;
    amount: number;
    transactionDate: string;
    paymentMethod?: string | null;
    reference?: string | null;
    notes?: string | null;
  }) {
    const invoice = vendorBillingService
      .getInvoices()
      .find((item) => item.id === input.invoiceId);
    if (!invoice) throw new Error("Vendor invoice not found.");
    const account = findAccount(input.accountId);
    const amount = money(input.amount);
    if (amount <= 0) throw new Error("Receipt amount must be greater than zero.");

    const transaction = savePostedTransaction({
      transactionType: "receipt",
      accountId: account.id,
      accountName: account.accountName,
      destinationAccountId: null,
      destinationAccountName: null,
      vendorId: invoice.vendorId,
      vendorName: invoice.vendorName,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      jobId: null,
      jobNumber: null,
      amount,
      currency: invoice.currency || account.currency,
      paymentMethod: input.paymentMethod || null,
      reference: input.reference || null,
      transactionDate: input.transactionDate || today(),
      description: input.notes || `Receipt from ${invoice.vendorName} for ${invoice.invoiceNumber}`,
      direction: "in",
    });

    saveAccountBalance(account, account.currentBalance + amount);
    const paymentResult = vendorBillingService.recordPayment({
      invoiceId: invoice.id,
      amount,
      paymentMethod: input.paymentMethod || "manual",
      paymentDate: input.transactionDate || today(),
      referenceNumber: input.reference || transaction.transactionNumber,
      notes: input.notes || `Cashbook ${transaction.transactionNumber}`,
    });
    const ar = ensureCoa("Accounts Receivable", "Asset", "Debit");
    postLedger({
      transaction,
      debitAccountId: account.accountId,
      creditAccountId: ar.id,
      debitDescription: `Receipt posted to ${account.accountName}`,
      creditDescription: `Accounts receivable cleared for ${invoice.invoiceNumber}`,
    });
    audit("cashbook_receipt_posted", "Posted vendor receipt", transaction.id, {
      transaction,
      invoice: paymentResult.invoice,
    });
    audit("vendor_invoice_payment_recorded", "Recorded vendor invoice payment", paymentResult.payment.id, paymentResult.payment);
    return { transaction, invoice: paymentResult.invoice, payment: paymentResult.payment };
  },

  recordPayment(input: {
    accountId: string;
    amount: number;
    transactionDate: string;
    paymentMethod?: string | null;
    reference?: string | null;
    description: string;
  }) {
    const account = findAccount(input.accountId);
    const amount = money(input.amount);
    if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
    const transaction = savePostedTransaction({
      transactionType: "payment",
      accountId: account.id,
      accountName: account.accountName,
      destinationAccountId: null,
      destinationAccountName: null,
      vendorId: null,
      vendorName: null,
      invoiceId: null,
      invoiceNumber: null,
      jobId: null,
      jobNumber: null,
      amount,
      currency: account.currency,
      paymentMethod: input.paymentMethod || null,
      reference: input.reference || null,
      transactionDate: input.transactionDate || today(),
      description: input.description || "General Expense / Manual Payment",
      direction: "out",
    });
    saveAccountBalance(account, account.currentBalance - amount);
    const expense = ensureCoa("General Expense / Manual Payment", "Expense", "Debit");
    postLedger({
      transaction,
      debitAccountId: expense.id,
      creditAccountId: account.accountId,
      debitDescription: transaction.description,
      creditDescription: `Payment from ${account.accountName}`,
    });
    audit("cashbook_payment_posted", "Posted cashbook payment", transaction.id, transaction);
    return transaction;
  },

  recordTransfer(input: {
    accountId: string;
    destinationAccountId: string;
    amount: number;
    transactionDate: string;
    reference?: string | null;
    description?: string;
  }) {
    const source = findAccount(input.accountId);
    const destination = findAccount(input.destinationAccountId);
    if (source.id === destination.id) throw new Error("Source and destination accounts must differ.");
    const amount = money(input.amount);
    if (amount <= 0) throw new Error("Transfer amount must be greater than zero.");
    const transaction = savePostedTransaction({
      transactionType: "transfer",
      accountId: source.id,
      accountName: source.accountName,
      destinationAccountId: destination.id,
      destinationAccountName: destination.accountName,
      vendorId: null,
      vendorName: null,
      invoiceId: null,
      invoiceNumber: null,
      jobId: null,
      jobNumber: null,
      amount,
      currency: source.currency,
      paymentMethod: "transfer",
      reference: input.reference || null,
      transactionDate: input.transactionDate || today(),
      description: input.description || `Transfer from ${source.accountName} to ${destination.accountName}`,
      direction: "transfer",
    });
    saveAccountBalance(source, source.currentBalance - amount);
    saveAccountBalance(destination, destination.currentBalance + amount);
    postLedger({
      transaction,
      debitAccountId: destination.accountId,
      creditAccountId: source.accountId,
      debitDescription: `Transfer received by ${destination.accountName}`,
      creditDescription: `Transfer sent from ${source.accountName}`,
    });
    audit("cashbook_transfer_posted", "Posted cashbook transfer", transaction.id, transaction);
    return transaction;
  },

  voidTransaction(id: string) {
    const rows = readTransactions();
    const existing = rows.find((row) => row.id === id);
    if (!existing) return undefined;
    const updated = { ...existing, status: "void" as const, updatedAt: nowIso() };
    writeTransactions(rows.map((row) => (row.id === id ? updated : row)));
    return updated;
  },
};
