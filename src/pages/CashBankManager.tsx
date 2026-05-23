/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { ArrowLeftRight, Building2, DollarSign, Plus, Receipt, Save } from "lucide-react";
import { CashBankAccount, CashbookTransaction, ChartOfAccount, VendorInvoice } from "../types.ts";
import { cashBankService } from "../services/cashBankService.ts";
import { financeLedgerService } from "../services/financeLedgerService.ts";
import { financeService } from "../services/financeService.ts";
import { vendorBillingService } from "../services/vendorBillingService.ts";

const today = () => new Date().toISOString().slice(0, 10);
const formatMoney = (value: number, currency = "") =>
  `${currency ? `${currency} ` : ""}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;

const inputClass =
  "w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold uppercase outline-none focus:border-brand-orange";

const blankAccount = (): Partial<CashBankAccount> => ({
  accountName: "",
  accountType: "Bank",
  currency: "USD",
  openingBalance: 0,
  currentBalance: 0,
  status: "active",
  requiresApprovalForPayments: false,
});

const CashBankManager: React.FC = () => {
  const [accounts, setAccounts] = useState<CashBankAccount[]>(() =>
    financeService.getCashBankAccounts(),
  );
  const [coa, setCoa] = useState<ChartOfAccount[]>(() => {
    financeService.seedDefaultChartOfAccounts();
    return financeService.getChartOfAccounts();
  });
  const [transactions, setTransactions] = useState<CashbookTransaction[]>(() =>
    cashBankService.getTransactions(),
  );
  const [invoices, setInvoices] = useState<VendorInvoice[]>(() =>
    vendorBillingService.getInvoices(),
  );
  const [accountForm, setAccountForm] = useState<Partial<CashBankAccount>>(blankAccount());
  const [receiptForm, setReceiptForm] = useState({
    invoiceId: "",
    accountId: "",
    amount: "",
    transactionDate: today(),
    paymentMethod: "bank_transfer",
    reference: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    accountId: "",
    amount: "",
    transactionDate: today(),
    paymentMethod: "manual",
    reference: "",
    description: "",
  });
  const [transferForm, setTransferForm] = useState({
    accountId: "",
    destinationAccountId: "",
    amount: "",
    transactionDate: today(),
    reference: "",
    description: "",
  });
  const [message, setMessage] = useState("");

  const reload = () => {
    setAccounts(financeService.getCashBankAccounts());
    setCoa(financeService.getChartOfAccounts());
    setTransactions(cashBankService.getTransactions());
    setInvoices(vendorBillingService.getInvoices());
  };

  const activeAccounts = accounts.filter((account) => account.status === "active");
  const openInvoices = invoices.filter((invoice) => invoice.balanceDue > 0 && invoice.status !== "cancelled");
  const ledgerEntries = financeLedgerService.getLedgerEntries();

  const totals = useMemo(() => {
    const month = today().slice(0, 7);
    const receiptsThisMonth = transactions
      .filter((item) => item.status === "posted" && item.direction === "in" && item.transactionDate.slice(0, 7) === month)
      .reduce((sum, item) => sum + item.amount, 0);
    const paymentsThisMonth = transactions
      .filter((item) => item.status === "posted" && item.direction === "out" && item.transactionDate.slice(0, 7) === month)
      .reduce((sum, item) => sum + item.amount, 0);
    return {
      activeCount: activeAccounts.length,
      openingBalance: activeAccounts.reduce((sum, account) => sum + account.openingBalance, 0),
      currentBalance: activeAccounts.reduce((sum, account) => sum + account.currentBalance, 0),
      receiptsThisMonth,
      paymentsThisMonth,
    };
  }, [activeAccounts, transactions]);

  const cashBankCoa = coa.filter((account) => account.isCashBankAccount && account.status === "active");

  const saveAccount = () => {
    try {
      const linked = coa.find((account) => account.id === accountForm.accountId);
      if (!linked) throw new Error("Select a linked Chart of Accounts cash/bank account.");
      const existing = accountForm.id ? accounts.find((account) => account.id === accountForm.id) : undefined;
      const openingBalance = Number(accountForm.openingBalance || 0);
      const saved = financeService.saveCashBankAccount({
        ...(existing || ({} as CashBankAccount)),
        id: accountForm.id || "",
        accountId: linked.id,
        accountCode: linked.accountCode,
        accountName: accountForm.accountName || linked.accountName,
        accountType: (accountForm.accountType as CashBankAccount["accountType"]) || "Bank",
        currency: (accountForm.currency as CashBankAccount["currency"]) || "USD",
        bankName: accountForm.bankName || "",
        branchName: accountForm.branchName || "",
        accountNumber: accountForm.accountNumber || "",
        walletNumber: accountForm.walletNumber || "",
        openingBalance,
        currentBalance: accountForm.id ? Number(accountForm.currentBalance || 0) : openingBalance,
        status: (accountForm.status as CashBankAccount["status"]) || "active",
        requiresApprovalForPayments: !!accountForm.requiresApprovalForPayments,
        approvalLimit: accountForm.approvalLimit,
        createdAt: existing?.createdAt || "",
        updatedAt: "",
      });
      setAccountForm(blankAccount());
      setMessage(`Account saved: ${saved.accountName}.`);
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save account.");
    }
  };

  const recordReceipt = () => {
    try {
      const result = cashBankService.recordVendorReceipt({
        invoiceId: receiptForm.invoiceId,
        accountId: receiptForm.accountId,
        amount: Number(receiptForm.amount),
        transactionDate: receiptForm.transactionDate,
        paymentMethod: receiptForm.paymentMethod,
        reference: receiptForm.reference || null,
        notes: receiptForm.notes || null,
      });
      setReceiptForm({ invoiceId: "", accountId: "", amount: "", transactionDate: today(), paymentMethod: "bank_transfer", reference: "", notes: "" });
      setMessage(`Receipt posted: ${result.transaction.transactionNumber}.`);
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to post receipt.");
    }
  };

  const recordPayment = () => {
    try {
      const transaction = cashBankService.recordPayment({
        accountId: paymentForm.accountId,
        amount: Number(paymentForm.amount),
        transactionDate: paymentForm.transactionDate,
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference || null,
        description: paymentForm.description || "General Expense / Manual Payment",
      });
      setPaymentForm({ accountId: "", amount: "", transactionDate: today(), paymentMethod: "manual", reference: "", description: "" });
      setMessage(`Payment posted: ${transaction.transactionNumber}.`);
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to post payment.");
    }
  };

  const recordTransfer = () => {
    try {
      const transaction = cashBankService.recordTransfer({
        accountId: transferForm.accountId,
        destinationAccountId: transferForm.destinationAccountId,
        amount: Number(transferForm.amount),
        transactionDate: transferForm.transactionDate,
        reference: transferForm.reference || null,
        description: transferForm.description,
      });
      setTransferForm({ accountId: "", destinationAccountId: "", amount: "", transactionDate: today(), reference: "", description: "" });
      setMessage(`Transfer posted: ${transaction.transactionNumber}.`);
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to post transfer.");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <section className="bg-white border border-stone-200 p-5 md:p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-brand-orange">
          iTred Console Accounting
        </p>
        <h1 className="text-2xl font-black text-brand-charcoal mt-2">
          Cash & Bank Manager
        </h1>
        <p className="text-sm text-stone-600 mt-3 max-w-4xl">
          Manage console cash, bank, mobile money and processor accounts; post vendor receipts, outflows and transfers.
        </p>
      </section>

      {message && (
        <section className="border-l-4 border-brand-orange bg-orange-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-800">
            {message}
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          ["Active Accounts", totals.activeCount, Building2],
          ["Opening Balances", formatMoney(totals.openingBalance), DollarSign],
          ["Current Balances", formatMoney(totals.currentBalance), DollarSign],
          ["Receipts This Month", formatMoney(totals.receiptsThisMonth), Receipt],
          ["Payments This Month", formatMoney(totals.paymentsThisMonth), ArrowLeftRight],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="bg-white border-2 border-stone-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                {label}
              </p>
              <Icon size={15} className="text-brand-orange" />
            </div>
            <p className="text-2xl font-black text-brand-charcoal mt-3">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 p-4 space-y-3">
          <h2 className="text-sm font-black uppercase text-brand-charcoal">Add / Edit Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select className={inputClass} value={accountForm.accountId || ""} onChange={(event) => setAccountForm((prev) => ({ ...prev, accountId: event.target.value }))}>
              <option value="">Linked COA Account</option>
              {cashBankCoa.map((account) => (
                <option key={account.id} value={account.id}>{account.accountCode} / {account.accountName}</option>
              ))}
            </select>
            <input className={inputClass} value={accountForm.accountName || ""} onChange={(event) => setAccountForm((prev) => ({ ...prev, accountName: event.target.value }))} placeholder="Account name" />
            <select className={inputClass} value={accountForm.accountType || "Bank"} onChange={(event) => setAccountForm((prev) => ({ ...prev, accountType: event.target.value as any }))}>
              {["Cash", "Bank", "Mobile Money", "Card Processor", "Other"].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select className={inputClass} value={accountForm.currency || "USD"} onChange={(event) => setAccountForm((prev) => ({ ...prev, currency: event.target.value as any }))}>
              {["USD", "ZiG", "ZAR", "Other"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
            <input className={inputClass} value={accountForm.bankName || ""} onChange={(event) => setAccountForm((prev) => ({ ...prev, bankName: event.target.value }))} placeholder="Bank / provider" />
            <input className={inputClass} value={accountForm.accountNumber || ""} onChange={(event) => setAccountForm((prev) => ({ ...prev, accountNumber: event.target.value }))} placeholder="Account / wallet number" />
            <input className={inputClass} type="number" value={accountForm.openingBalance ?? 0} onChange={(event) => setAccountForm((prev) => ({ ...prev, openingBalance: Number(event.target.value) }))} placeholder="Opening balance" />
            <input className={inputClass} type="number" value={accountForm.currentBalance ?? 0} onChange={(event) => setAccountForm((prev) => ({ ...prev, currentBalance: Number(event.target.value) }))} placeholder="Current balance" />
          </div>
          <button type="button" onClick={saveAccount} className="btn-primary">
            <Save size={14} className="mr-2 inline" /> Save Account
          </button>
        </div>

        <div className="bg-white border border-stone-200 p-4 space-y-3">
          <h2 className="text-sm font-black uppercase text-brand-charcoal">Record Vendor Receipt</h2>
          <select className={inputClass} value={receiptForm.invoiceId} onChange={(event) => setReceiptForm((prev) => ({ ...prev, invoiceId: event.target.value }))}>
            <option value="">Select vendor invoice</option>
            {openInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} / {invoice.vendorName} / {formatMoney(invoice.balanceDue, invoice.currency)}</option>
            ))}
          </select>
          <select className={inputClass} value={receiptForm.accountId} onChange={(event) => setReceiptForm((prev) => ({ ...prev, accountId: event.target.value }))}>
            <option value="">Receiving account</option>
            {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName} / {formatMoney(account.currentBalance, account.currency)}</option>)}
          </select>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className={inputClass} type="number" value={receiptForm.amount} onChange={(event) => setReceiptForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="Amount" />
            <input className={inputClass} type="date" value={receiptForm.transactionDate} onChange={(event) => setReceiptForm((prev) => ({ ...prev, transactionDate: event.target.value }))} />
            <input className={inputClass} value={receiptForm.paymentMethod} onChange={(event) => setReceiptForm((prev) => ({ ...prev, paymentMethod: event.target.value }))} placeholder="Method" />
            <input className={inputClass} value={receiptForm.reference} onChange={(event) => setReceiptForm((prev) => ({ ...prev, reference: event.target.value }))} placeholder="Reference" />
          </div>
          <input className={inputClass} value={receiptForm.notes} onChange={(event) => setReceiptForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notes" />
          <button type="button" onClick={recordReceipt} className="btn-primary">
            <Receipt size={14} className="mr-2 inline" /> Post Receipt
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 p-4 space-y-3">
          <h2 className="text-sm font-black uppercase text-brand-charcoal">Record Payment / Outflow</h2>
          <select className={inputClass} value={paymentForm.accountId} onChange={(event) => setPaymentForm((prev) => ({ ...prev, accountId: event.target.value }))}>
            <option value="">Paying account</option>
            {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}
          </select>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className={inputClass} type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="Amount" />
            <input className={inputClass} type="date" value={paymentForm.transactionDate} onChange={(event) => setPaymentForm((prev) => ({ ...prev, transactionDate: event.target.value }))} />
            <input className={inputClass} value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentMethod: event.target.value }))} placeholder="Method" />
            <input className={inputClass} value={paymentForm.reference} onChange={(event) => setPaymentForm((prev) => ({ ...prev, reference: event.target.value }))} placeholder="Reference" />
          </div>
          <input className={inputClass} value={paymentForm.description} onChange={(event) => setPaymentForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" />
          <button type="button" onClick={recordPayment} className="btn-secondary">
            <DollarSign size={14} className="mr-2 inline" /> Post Payment
          </button>
        </div>

        <div className="bg-white border border-stone-200 p-4 space-y-3">
          <h2 className="text-sm font-black uppercase text-brand-charcoal">Transfer / Deposit</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select className={inputClass} value={transferForm.accountId} onChange={(event) => setTransferForm((prev) => ({ ...prev, accountId: event.target.value }))}>
              <option value="">Source account</option>
              {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}
            </select>
            <select className={inputClass} value={transferForm.destinationAccountId} onChange={(event) => setTransferForm((prev) => ({ ...prev, destinationAccountId: event.target.value }))}>
              <option value="">Destination account</option>
              {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}
            </select>
            <input className={inputClass} type="number" value={transferForm.amount} onChange={(event) => setTransferForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="Amount" />
            <input className={inputClass} type="date" value={transferForm.transactionDate} onChange={(event) => setTransferForm((prev) => ({ ...prev, transactionDate: event.target.value }))} />
          </div>
          <input className={inputClass} value={transferForm.reference} onChange={(event) => setTransferForm((prev) => ({ ...prev, reference: event.target.value }))} placeholder="Reference" />
          <input className={inputClass} value={transferForm.description} onChange={(event) => setTransferForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" />
          <button type="button" onClick={recordTransfer} className="btn-secondary">
            <ArrowLeftRight size={14} className="mr-2 inline" /> Post Transfer
          </button>
        </div>
      </section>

      <section className="bg-white border border-stone-200">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase text-brand-charcoal">Configured Accounts</h2>
          <button type="button" onClick={() => setAccountForm(blankAccount())} className="btn-secondary text-[10px]">
            <Plus size={13} className="mr-1 inline" /> Add Account
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-widest text-stone-400">
              <tr>
                {["Account", "Type", "Currency", "Bank / Wallet", "Opening", "Current", "Status", "Actions"].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-4 py-3"><div className="font-bold text-brand-charcoal">{account.accountName}</div><div className="text-[10px] text-stone-400 font-mono">{account.accountCode || "Uncoded"}</div></td>
                  <td className="px-4 py-3">{account.accountType}</td>
                  <td className="px-4 py-3">{account.currency}</td>
                  <td className="px-4 py-3">{account.bankName || account.walletNumber || account.accountNumber || "Not specified"}</td>
                  <td className="px-4 py-3 font-mono">{formatMoney(account.openingBalance)}</td>
                  <td className="px-4 py-3 font-mono font-bold">{formatMoney(account.currentBalance)}</td>
                  <td className="px-4 py-3 capitalize">{account.status}</td>
                  <td className="px-4 py-3"><button type="button" className="border border-stone-200 px-2 py-1 text-[9px] font-black uppercase" onClick={() => setAccountForm(account)}>Edit Account</button></td>
                </tr>
              ))}
              {accounts.length === 0 && <tr><td className="px-4 py-8 text-center text-stone-400" colSpan={8}>No cash/bank accounts configured.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HistoryPanel title="Transaction History" rows={transactions} />
        <LedgerPanel entries={ledgerEntries.slice(0, 30)} />
      </section>
    </div>
  );
};

const HistoryPanel: React.FC<{ title: string; rows: CashbookTransaction[] }> = ({ title, rows }) => (
  <div className="bg-white border border-stone-200">
    <div className="p-4 border-b border-stone-200"><h2 className="text-sm font-black uppercase text-brand-charcoal">{title}</h2></div>
    <div className="overflow-x-auto max-h-[420px]">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 text-[9px] font-black uppercase text-stone-400"><tr>{["Date", "Type", "Account", "Amount", "Ref", "Status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row) => <tr key={row.id}><td className="px-3 py-2">{row.transactionDate}</td><td className="px-3 py-2 uppercase">{row.transactionType}</td><td className="px-3 py-2">{row.accountName}</td><td className="px-3 py-2 font-mono">{formatMoney(row.amount, row.currency)}</td><td className="px-3 py-2 font-mono">{row.reference || row.transactionNumber}</td><td className="px-3 py-2 uppercase">{row.status}</td></tr>)}
          {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-stone-400">No transactions posted yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>
);

const LedgerPanel: React.FC<{ entries: ReturnType<typeof financeLedgerService.getLedgerEntries> }> = ({ entries }) => (
  <div className="bg-white border border-stone-200">
    <div className="p-4 border-b border-stone-200"><h2 className="text-sm font-black uppercase text-brand-charcoal">Ledger Entries</h2></div>
    <div className="overflow-x-auto max-h-[420px]">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 text-[9px] font-black uppercase text-stone-400"><tr>{["Date", "Description", "Debit", "Credit", "Status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-stone-100">
          {entries.map((entry) => <tr key={entry.id}><td className="px-3 py-2">{entry.transactionDate}</td><td className="px-3 py-2">{entry.description}</td><td className="px-3 py-2 font-mono">{formatMoney(entry.debit)}</td><td className="px-3 py-2 font-mono">{formatMoney(entry.credit)}</td><td className="px-3 py-2 uppercase">{entry.status}</td></tr>)}
          {entries.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-stone-400">No ledger entries yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>
);

export default CashBankManager;
