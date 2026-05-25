/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { ArrowLeftRight, Building2, CreditCard, DollarSign, Plus, Receipt, Save, X } from "lucide-react";
import { CashBankAccount, CashbookTransaction, ChartOfAccount, RPN, Staff, Vendor, VendorInvoice } from "../types.ts";
import { cashBankService } from "../services/cashBankService.ts";
import { financeLedgerService } from "../services/financeLedgerService.ts";
import { financeService } from "../services/financeService.ts";
import { rpnService } from "../services/rpnService.ts";
import { staffService } from "../services/staffService.ts";
import { vendorBillingService } from "../services/vendorBillingService.ts";
import { vendorService } from "../services/vendorService.ts";

const today = () => new Date().toISOString().slice(0, 10);
const formatMoney = (value: number, currency = "") =>
  `${currency ? `${currency} ` : ""}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;

const inputClass =
  "w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold uppercase outline-none focus:border-brand-orange";
const labelClass = "text-[9px] font-black uppercase tracking-widest text-stone-500";
const modalFieldClass = "space-y-1";

type CashBankModal = "receipt" | "payment" | "transfer" | null;

const documentNumber = (
  prefix: string,
  transactions: CashbookTransaction[],
  transactionType: CashbookTransaction["transactionType"],
) => {
  const dateKey = today().replace(/-/g, "");
  const next = transactions.filter((item) => item.transactionType === transactionType).length + 1;
  return `${prefix}-${dateKey}-${String(next).padStart(4, "0")}`;
};

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
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [staff, setStaff] = useState<Staff[]>(() => staffService.getAllStaff());
  const [rpns, setRpns] = useState<RPN[]>(() => rpnService.getAll());
  const [activeModal, setActiveModal] = useState<CashBankModal>(null);
  const [accountForm, setAccountForm] = useState<Partial<CashBankAccount>>(blankAccount());
  const [receiptForm, setReceiptForm] = useState({
    receiptNumber: "",
    invoiceId: "",
    vendorId: "",
    vendorName: "",
    accountId: "",
    amount: "",
    currency: "USD",
    transactionDate: today(),
    receiptCategory: "vendor_invoice",
    paymentMethod: "bank_transfer",
    reference: "",
    receivedByStaffId: "",
    assignedRpnId: "",
    status: "posted",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    paymentNumber: "",
    accountId: "",
    amount: "",
    currency: "USD",
    transactionDate: today(),
    paymentMethod: "manual",
    reference: "",
    paidByStaffId: "",
    status: "posted",
    description: "",
  });
  const [transferForm, setTransferForm] = useState({
    transferNumber: "",
    accountId: "",
    destinationAccountId: "",
    amount: "",
    currency: "USD",
    transactionDate: today(),
    reference: "",
    preparedByStaffId: "",
    status: "posted",
    description: "",
  });
  const [message, setMessage] = useState("");

  const reload = () => {
    setAccounts(financeService.getCashBankAccounts());
    setCoa(financeService.getChartOfAccounts());
    setTransactions(cashBankService.getTransactions());
    setInvoices(vendorBillingService.getInvoices());
    void vendorService.getVendors().then((rows) => setVendors(Array.isArray(rows) ? rows : []));
    setStaff(staffService.getAllStaff());
    setRpns(rpnService.getAll());
  };

  const activeAccounts = accounts.filter((account) => account.status === "active");
  const openInvoices = invoices.filter((invoice) => invoice.balanceDue > 0 && invoice.status !== "cancelled" && invoice.status !== "void");
  const ledgerEntries = financeLedgerService.getLedgerEntries();
  const vendorById = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const staffName = (staffId: string) => {
    const member = staff.find((item) => item.id === staffId);
    return member?.fullName || member?.displayName || member?.staffName || "";
  };
  const rpnName = (rpnId: string) => rpns.find((item) => item.id === rpnId)?.name || "";

  React.useEffect(() => {
    void vendorService.getVendors().then((rows) => setVendors(Array.isArray(rows) ? rows : []));
  }, []);

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

  const resetReceiptForm = () => setReceiptForm({
    receiptNumber: documentNumber("RCPT", transactions, "receipt"),
    invoiceId: "",
    vendorId: "",
    vendorName: "",
    accountId: "",
    amount: "",
    currency: "USD",
    transactionDate: today(),
    receiptCategory: "vendor_invoice",
    paymentMethod: "bank_transfer",
    reference: "",
    receivedByStaffId: "",
    assignedRpnId: "",
    status: "posted",
    notes: "",
  });

  const resetPaymentForm = () => setPaymentForm({
    paymentNumber: documentNumber("PAY", transactions, "payment"),
    accountId: "",
    amount: "",
    currency: "USD",
    transactionDate: today(),
    paymentMethod: "manual",
    reference: "",
    paidByStaffId: "",
    status: "posted",
    description: "",
  });

  const resetTransferForm = () => setTransferForm({
    transferNumber: documentNumber("TRF", transactions, "transfer"),
    accountId: "",
    destinationAccountId: "",
    amount: "",
    currency: "USD",
    transactionDate: today(),
    reference: "",
    preparedByStaffId: "",
    status: "posted",
    description: "",
  });

  const openModal = (modal: Exclude<CashBankModal, null>) => {
    if (modal === "receipt") resetReceiptForm();
    if (modal === "payment") resetPaymentForm();
    if (modal === "transfer") resetTransferForm();
    setActiveModal(modal);
  };

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
      if (receiptForm.status !== "posted") throw new Error("Draft receipt capture is not enabled yet. Set status to posted to continue.");
      if (!receiptForm.invoiceId) throw new Error("Select an invoice/bill reference before posting the receipt.");
      const receiptNotes = [
        receiptForm.notes || null,
        `Receipt document: ${receiptForm.receiptNumber}`,
        receiptForm.receiptCategory ? `Category: ${receiptForm.receiptCategory.replace(/_/g, " ")}` : null,
        receiptForm.vendorName ? `Vendor/name: ${receiptForm.vendorName}` : null,
        receiptForm.receivedByStaffId ? `Received by: ${staffName(receiptForm.receivedByStaffId)}` : null,
        receiptForm.assignedRpnId ? `Assigned RPN: ${rpnName(receiptForm.assignedRpnId)}` : null,
      ].filter(Boolean).join(" / ");
      const result = cashBankService.recordVendorReceipt({
        invoiceId: receiptForm.invoiceId,
        accountId: receiptForm.accountId,
        amount: Number(receiptForm.amount),
        transactionDate: receiptForm.transactionDate,
        paymentMethod: receiptForm.paymentMethod,
        reference: receiptForm.reference || receiptForm.receiptNumber,
        notes: receiptNotes,
      });
      resetReceiptForm();
      setActiveModal(null);
      setMessage(`Receipt posted: ${result.transaction.transactionNumber}.`);
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to post receipt.");
    }
  };

  const recordPayment = () => {
    try {
      if (paymentForm.status !== "posted") throw new Error("Draft payment capture is not enabled yet. Set status to posted to continue.");
      const description = [
        paymentForm.description || "General Expense / Manual Payment",
        `Payment document: ${paymentForm.paymentNumber}`,
        paymentForm.paidByStaffId ? `Paid by: ${staffName(paymentForm.paidByStaffId)}` : null,
      ].filter(Boolean).join(" / ");
      const transaction = cashBankService.recordPayment({
        accountId: paymentForm.accountId,
        amount: Number(paymentForm.amount),
        transactionDate: paymentForm.transactionDate,
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference || paymentForm.paymentNumber,
        description,
      });
      resetPaymentForm();
      setActiveModal(null);
      setMessage(`Payment posted: ${transaction.transactionNumber}.`);
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to post payment.");
    }
  };

  const recordTransfer = () => {
    try {
      if (transferForm.status !== "posted") throw new Error("Draft transfer capture is not enabled yet. Set status to posted to continue.");
      const description = [
        transferForm.description || "Cash/bank transfer",
        `Transfer document: ${transferForm.transferNumber}`,
        transferForm.preparedByStaffId ? `Prepared by: ${staffName(transferForm.preparedByStaffId)}` : null,
      ].filter(Boolean).join(" / ");
      const transaction = cashBankService.recordTransfer({
        accountId: transferForm.accountId,
        destinationAccountId: transferForm.destinationAccountId,
        amount: Number(transferForm.amount),
        transactionDate: transferForm.transactionDate,
        reference: transferForm.reference || transferForm.transferNumber,
        description,
      });
      resetTransferForm();
      setActiveModal(null);
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

      <section className="bg-brand-charcoal border border-stone-800 p-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
              Cashbook actions
            </p>
            <p className="text-xs font-bold uppercase text-stone-300">
              Modal finance documents
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => openModal("receipt")}
              className="flex items-center justify-center gap-2 border border-brand-orange bg-brand-orange px-4 py-2 text-[10px] font-black uppercase text-white transition hover:bg-orange-600"
            >
              <Receipt size={14} /> Record vendor receipt
            </button>
            <button
              type="button"
              onClick={() => openModal("payment")}
              className="flex items-center justify-center gap-2 border border-stone-600 bg-stone-900 px-4 py-2 text-[10px] font-black uppercase text-white transition hover:border-brand-orange"
            >
              <CreditCard size={14} /> Record payment / outflow
            </button>
            <button
              type="button"
              onClick={() => openModal("transfer")}
              className="flex items-center justify-center gap-2 border border-stone-600 bg-stone-900 px-4 py-2 text-[10px] font-black uppercase text-white transition hover:border-brand-orange"
            >
              <ArrowLeftRight size={14} /> Transfer / deposit
            </button>
          </div>
        </div>
      </section>

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

      <section className="grid grid-cols-1 gap-6">
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

      {activeModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-brand-charcoal/70 p-3 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden border border-stone-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b-4 border-brand-orange bg-brand-charcoal px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
                  Cash & Bank Manager
                </p>
                <h2 className="text-lg font-black uppercase">
                  {activeModal === "receipt"
                    ? "Record vendor receipt"
                    : activeModal === "payment"
                      ? "Record payment / outflow"
                      : "Transfer / deposit"}
                </h2>
              </div>
              <button type="button" onClick={() => setActiveModal(null)} className="border border-white/20 p-2 text-white">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 md:p-5">
              {activeModal === "receipt" && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <Field label="Receipt number">
                    <input className={inputClass} value={receiptForm.receiptNumber} readOnly />
                  </Field>
                  <Field label="Receipt date">
                    <input className={inputClass} type="date" value={receiptForm.transactionDate} onChange={(event) => setReceiptForm((prev) => ({ ...prev, transactionDate: event.target.value }))} />
                  </Field>
                  <Field label="Status">
                    <select className={inputClass} value={receiptForm.status} onChange={(event) => setReceiptForm((prev) => ({ ...prev, status: event.target.value }))}>
                      <option value="posted">Posted</option>
                      <option value="draft">Draft reference</option>
                    </select>
                  </Field>
                  <Field label="Currency">
                    <input className={inputClass} value={receiptForm.currency} onChange={(event) => setReceiptForm((prev) => ({ ...prev, currency: event.target.value }))} />
                  </Field>
                  <Field label="Vendor select">
                    <select
                      className={inputClass}
                      value={receiptForm.vendorId}
                      onChange={(event) => {
                        const vendor = vendorById.get(event.target.value);
                        setReceiptForm((prev) => ({
                          ...prev,
                          vendorId: event.target.value,
                          vendorName: vendor?.tradingName || vendor?.name || prev.vendorName,
                          assignedRpnId: vendor?.assignedRPNId || prev.assignedRpnId,
                        }));
                      }}
                    >
                      <option value="">Select vendor</option>
                      {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.tradingName || vendor.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Add vendor / name option">
                    <input className={inputClass} value={receiptForm.vendorName} onChange={(event) => setReceiptForm((prev) => ({ ...prev, vendorName: event.target.value }))} placeholder="Vendor name" />
                  </Field>
                  <Field label="Invoice / bill reference">
                    <select
                      className={inputClass}
                      value={receiptForm.invoiceId}
                      onChange={(event) => {
                        const invoice = openInvoices.find((item) => item.id === event.target.value);
                        const vendor = invoice ? vendorById.get(invoice.vendorId) : undefined;
                        setReceiptForm((prev) => ({
                          ...prev,
                          invoiceId: event.target.value,
                          vendorId: invoice?.vendorId || prev.vendorId,
                          vendorName: invoice?.vendorName || prev.vendorName,
                          amount: invoice ? String(invoice.balanceDue) : prev.amount,
                          currency: invoice?.currency || prev.currency,
                          assignedRpnId: vendor?.assignedRPNId || prev.assignedRpnId,
                        }));
                      }}
                    >
                      <option value="">Select invoice / bill</option>
                      {openInvoices.map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} / {invoice.vendorName} / {formatMoney(invoice.balanceDue, invoice.currency)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Receipt category">
                    <select className={inputClass} value={receiptForm.receiptCategory} onChange={(event) => setReceiptForm((prev) => ({ ...prev, receiptCategory: event.target.value }))}>
                      <option value="vendor_invoice">Vendor invoice</option>
                      <option value="subscription">Subscription receipt</option>
                      <option value="service_job">Service job receipt</option>
                      <option value="other_vendor_receipt">Other vendor receipt</option>
                    </select>
                  </Field>
                  <Field label="Received into account">
                    <select className={inputClass} value={receiptForm.accountId} onChange={(event) => setReceiptForm((prev) => ({ ...prev, accountId: event.target.value }))}>
                      <option value="">Receiving account</option>
                      {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName} / {formatMoney(account.currentBalance, account.currency)}</option>)}
                    </select>
                  </Field>
                  <Field label="Payment method">
                    <select className={inputClass} value={receiptForm.paymentMethod} onChange={(event) => setReceiptForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}>
                      {["bank_transfer", "cash", "mobile_money", "card", "manual"].map((method) => <option key={method} value={method}>{method.replace(/_/g, " ")}</option>)}
                    </select>
                  </Field>
                  <Field label="Reference / POP number">
                    <input className={inputClass} value={receiptForm.reference} onChange={(event) => setReceiptForm((prev) => ({ ...prev, reference: event.target.value }))} />
                  </Field>
                  <Field label="Amount">
                    <input className={inputClass} type="number" value={receiptForm.amount} onChange={(event) => setReceiptForm((prev) => ({ ...prev, amount: event.target.value }))} />
                  </Field>
                  <Field label="Received by staff">
                    <select className={inputClass} value={receiptForm.receivedByStaffId} onChange={(event) => setReceiptForm((prev) => ({ ...prev, receivedByStaffId: event.target.value }))}>
                      <option value="">Select staff</option>
                      {staff.map((member) => <option key={member.id} value={member.id}>{member.fullName || member.displayName || member.staffName}</option>)}
                    </select>
                  </Field>
                  <Field label="Assigned RPN">
                    <select className={inputClass} value={receiptForm.assignedRpnId} onChange={(event) => setReceiptForm((prev) => ({ ...prev, assignedRpnId: event.target.value }))}>
                      <option value="">Select RPN</option>
                      {rpns.map((rpn) => <option key={rpn.id} value={rpn.id}>{rpn.name}</option>)}
                    </select>
                  </Field>
                  <div className="lg:col-span-2">
                    <Field label="Details / narration">
                      <textarea className={`${inputClass} min-h-20`} value={receiptForm.notes} onChange={(event) => setReceiptForm((prev) => ({ ...prev, notes: event.target.value }))} />
                    </Field>
                  </div>
                </div>
              )}

              {activeModal === "payment" && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <Field label="Payment number"><input className={inputClass} value={paymentForm.paymentNumber} readOnly /></Field>
                  <Field label="Payment date"><input className={inputClass} type="date" value={paymentForm.transactionDate} onChange={(event) => setPaymentForm((prev) => ({ ...prev, transactionDate: event.target.value }))} /></Field>
                  <Field label="Status"><select className={inputClass} value={paymentForm.status} onChange={(event) => setPaymentForm((prev) => ({ ...prev, status: event.target.value }))}><option value="posted">Posted</option><option value="draft">Draft reference</option></select></Field>
                  <Field label="Currency"><input className={inputClass} value={paymentForm.currency} onChange={(event) => setPaymentForm((prev) => ({ ...prev, currency: event.target.value }))} /></Field>
                  <Field label="Paying account"><select className={inputClass} value={paymentForm.accountId} onChange={(event) => setPaymentForm((prev) => ({ ...prev, accountId: event.target.value }))}><option value="">Paying account</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName} / {formatMoney(account.currentBalance, account.currency)}</option>)}</select></Field>
                  <Field label="Payment method"><select className={inputClass} value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}>{["manual", "cash", "bank_transfer", "mobile_money", "card"].map((method) => <option key={method} value={method}>{method.replace(/_/g, " ")}</option>)}</select></Field>
                  <Field label="Reference / document"><input className={inputClass} value={paymentForm.reference} onChange={(event) => setPaymentForm((prev) => ({ ...prev, reference: event.target.value }))} /></Field>
                  <Field label="Amount"><input className={inputClass} type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} /></Field>
                  <Field label="Paid by staff"><select className={inputClass} value={paymentForm.paidByStaffId} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paidByStaffId: event.target.value }))}><option value="">Select staff</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName || member.displayName || member.staffName}</option>)}</select></Field>
                  <div className="lg:col-span-3"><Field label="Details / narration"><textarea className={`${inputClass} min-h-20`} value={paymentForm.description} onChange={(event) => setPaymentForm((prev) => ({ ...prev, description: event.target.value }))} /></Field></div>
                </div>
              )}

              {activeModal === "transfer" && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <Field label="Transfer number"><input className={inputClass} value={transferForm.transferNumber} readOnly /></Field>
                  <Field label="Transfer date"><input className={inputClass} type="date" value={transferForm.transactionDate} onChange={(event) => setTransferForm((prev) => ({ ...prev, transactionDate: event.target.value }))} /></Field>
                  <Field label="Status"><select className={inputClass} value={transferForm.status} onChange={(event) => setTransferForm((prev) => ({ ...prev, status: event.target.value }))}><option value="posted">Posted</option><option value="draft">Draft reference</option></select></Field>
                  <Field label="Currency"><input className={inputClass} value={transferForm.currency} onChange={(event) => setTransferForm((prev) => ({ ...prev, currency: event.target.value }))} /></Field>
                  <Field label="Source account"><select className={inputClass} value={transferForm.accountId} onChange={(event) => setTransferForm((prev) => ({ ...prev, accountId: event.target.value }))}><option value="">Source account</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select></Field>
                  <Field label="Destination account"><select className={inputClass} value={transferForm.destinationAccountId} onChange={(event) => setTransferForm((prev) => ({ ...prev, destinationAccountId: event.target.value }))}><option value="">Destination account</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select></Field>
                  <Field label="Amount"><input className={inputClass} type="number" value={transferForm.amount} onChange={(event) => setTransferForm((prev) => ({ ...prev, amount: event.target.value }))} /></Field>
                  <Field label="Reference"><input className={inputClass} value={transferForm.reference} onChange={(event) => setTransferForm((prev) => ({ ...prev, reference: event.target.value }))} /></Field>
                  <Field label="Prepared by staff"><select className={inputClass} value={transferForm.preparedByStaffId} onChange={(event) => setTransferForm((prev) => ({ ...prev, preparedByStaffId: event.target.value }))}><option value="">Select staff</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName || member.displayName || member.staffName}</option>)}</select></Field>
                  <div className="lg:col-span-3"><Field label="Details / narration"><textarea className={`${inputClass} min-h-20`} value={transferForm.description} onChange={(event) => setTransferForm((prev) => ({ ...prev, description: event.target.value }))} /></Field></div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3 sm:flex-row sm:justify-between">
              <p className="text-[10px] font-bold uppercase text-stone-500">
                Document numbers are generated for the modal form; posted cashbook records retain the system transaction number.
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={activeModal === "receipt" ? recordReceipt : activeModal === "payment" ? recordPayment : recordTransfer}
                >
                  {activeModal === "receipt" ? "Post receipt" : activeModal === "payment" ? "Post payment" : "Post transfer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className={modalFieldClass}>
    <span className={labelClass}>{label}</span>
    {children}
  </label>
);

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
