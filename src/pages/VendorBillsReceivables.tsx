import React, { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Briefcase,
  DollarSign,
  Eye,
  FileText,
  MessageCircle,
  PlusCircle,
  Printer,
  Receipt,
} from "lucide-react";
import {
  DataPanel,
  PrimaryButton,
  SecondaryButton,
  StatCard,
  StatusBadge,
} from "../components/CommonUI.tsx";
import {
  PricingPlan,
  RPN,
  Staff,
  CashBankAccount,
  Vendor,
  VendorInvoice,
  VendorInvoiceBillingProfile,
  VendorInvoiceStatus,
  VendorJob,
} from "../types.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { cashBankService } from "../services/cashBankService.ts";
import { financeService } from "../services/financeService.ts";
import { rpnService } from "../services/rpnService.ts";
import { staffService } from "../services/staffService.ts";
import { subscriptionService } from "../services/subscriptionService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import {
  calculateStocktakeUsage,
  canUseStocktake,
  getEffectiveStocktakeLimit,
} from "../services/entitlementEngine.ts";
import {
  VENDOR_INVOICE_PAYMENT_TERMS_DAYS,
  VENDOR_JOB_TYPES,
  vendorBillingService,
} from "../services/vendorBillingService.ts";
import { vendorService } from "../services/vendorService.ts";
import { printVendorInvoice } from "../utils/vendorInvoicePrint.ts";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const money = (value: number) =>
  `$${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
const moneyCellClass =
  "whitespace-nowrap text-right font-mono text-[11px] leading-tight tabular-nums sm:text-xs";
const inputClass =
  "w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold uppercase outline-none focus:border-brand-orange";

const statusVariant = (status: VendorInvoiceStatus) => {
  if (status === "paid") return "success";
  if (status === "overdue" || status === "cancelled" || status === "void") return "danger";
  if (status === "due_soon" || status === "partially_paid" || status === "unpaid") return "warning";
  return "neutral";
};

const vendorName = (vendor?: Vendor) =>
  vendor?.tradingName || vendor?.name || "Unknown Vendor";

const invoiceDate = (invoice: VendorInvoice) => invoice.invoiceDate || invoice.issueDate;

const collectionLabel = (invoice: VendorInvoice) => {
  if (invoice.collectionStatus) return invoice.collectionStatus.replace(/_/g, " ");
  if (invoice.status === "paid" || invoice.status === "cancelled" || invoice.status === "void") return invoice.status;
  if (invoice.dueDate < today()) return "overdue";
  if (invoice.dueDate <= addDays(7)) return "due soon";
  return "not due";
};

const whatsappNumber = (vendor?: Vendor) =>
  String(vendor?.whatsappNumber || vendor?.whatsapp || vendor?.mainPhone || vendor?.phone || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");

const buildCollectionReminderMessage = (invoice: VendorInvoice) =>
  [
    "iTred vendor invoice reminder",
    "",
    `Vendor: ${invoice.vendorName}`,
    `Invoice: ${invoice.invoiceNumber}`,
    `Invoice date: ${invoiceDate(invoice)}`,
    `Due date: ${invoice.dueDate}`,
    `Payment terms: ${invoice.paymentTermsDays || VENDOR_INVOICE_PAYMENT_TERMS_DAYS} days`,
    `Balance due: ${money(invoice.balanceDue)}`,
    "",
    "Please arrange payment or send proof of payment for allocation.",
    "",
    "Powered by seiGEN Commerce",
  ].join("\n");

export const VendorBillsReceivables: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashBankAccount[]>([]);
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [jobs, setJobs] = useState<VendorJob[]>([]);
  const [billingProfile, setBillingProfile] = useState<VendorInvoiceBillingProfile>(() =>
    vendorBillingService.getBillingProfile(),
  );
  const [phoneNumbersText, setPhoneNumbersText] = useState(() =>
    vendorBillingService.getBillingProfile().phoneNumbers.join("\n"),
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [jobVendorId, setJobVendorId] = useState("");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    vendorId: "",
    status: "all",
    due: "all",
    dateFrom: "",
    dateTo: "",
    planId: "",
    sector: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    accountId: "",
    paymentMethod: "manual",
    paymentDate: today(),
    referenceNumber: "",
    notes: "",
  });
  const [jobForm, setJobForm] = useState({
    jobType: "stocktake",
    description: "",
    requestedBy: "",
    performedByStaffId: "",
    rpnId: "",
    jobDate: today(),
    quantity: 1,
    unitPrice: 0,
    taxable: false,
    taxRate: 0,
    notes: "",
  });

  const loadData = async () => {
    const [nextVendors, nextPlans] = await Promise.all([
      vendorService.getVendors(),
      pricingPlanService.getPlans(),
    ]);
    setVendors(Array.isArray(nextVendors) ? nextVendors : []);
    setPlans(Array.isArray(nextPlans) ? nextPlans : []);
    setStaff(staffService.getAllStaff());
    setRpns(rpnService.getAll());
    setInvoices(vendorBillingService.getInvoices());
    setJobs(vendorBillingService.getJobs());
    setCashAccounts(financeService.getActiveCashBankAccounts());
    const nextProfile = vendorBillingService.getBillingProfile();
    setBillingProfile(nextProfile);
    setPhoneNumbersText(nextProfile.phoneNumbers.join("\n"));
  };

  useEffect(() => {
    void loadData();
  }, []);

  const vendorById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors],
  );
  const planById = useMemo(
    () => new Map(plans.map((plan) => [plan.id, plan])),
    [plans],
  );
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) || null;
  const selectedInvoiceLines = selectedInvoice
    ? vendorBillingService.getInvoiceLines(selectedInvoice.id)
    : [];
  const selectedJobVendor = vendorById.get(jobVendorId || filters.vendorId);
  const selectedJobPlan = selectedJobVendor?.planId
    ? planById.get(selectedJobVendor.planId)
    : undefined;
  const selectedJobSubscription = selectedJobVendor
    ? subscriptionService.getSubscriptionByVendor(selectedJobVendor.id)
    : undefined;
  const stocktakeUsage = selectedJobVendor
    ? calculateStocktakeUsage(selectedJobVendor.id)
    : 0;
  const stocktakeLimit = getEffectiveStocktakeLimit(
    selectedJobPlan,
    selectedJobSubscription,
  );
  const stocktakeEntitlement = selectedJobVendor
    ? canUseStocktake({
        vendorId: selectedJobVendor.id,
        plan: selectedJobPlan,
        subscription: selectedJobSubscription,
        usage: stocktakeUsage,
      })
    : { allowed: true, severity: "ok" as const, reasons: [] };

  const filteredInvoices = useMemo(() => {
    const todayKey = today();
    const weekKey = addDays(7);
    return invoices
      .filter((invoice) => {
        const vendor = vendorById.get(invoice.vendorId);
        const dueMatch =
          filters.due === "all" ||
          (filters.due === "overdue" && invoice.balanceDue > 0 && invoice.dueDate < todayKey) ||
          (filters.due === "due_this_week" &&
            invoice.balanceDue > 0 &&
            invoice.dueDate >= todayKey &&
            invoice.dueDate <= weekKey);
        return (
          (!filters.vendorId || invoice.vendorId === filters.vendorId) &&
          (filters.status === "all" || invoice.status === filters.status) &&
          dueMatch &&
          (!filters.dateFrom || invoiceDate(invoice) >= filters.dateFrom) &&
          (!filters.dateTo || invoiceDate(invoice) <= filters.dateTo) &&
          (!filters.planId || invoice.planId === filters.planId) &&
          (!filters.sector || vendor?.sector === filters.sector)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filters, invoices, vendorById]);

  const summary = useMemo(() => {
    const todayKey = today();
    const weekKey = addDays(7);
    const paidMonth = todayKey.slice(0, 7);
    const payments = vendorBillingService.getPayments();
    return {
      totalReceivables: invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      overdueAmount: invoices
        .filter((invoice) => invoice.balanceDue > 0 && invoice.dueDate < todayKey)
        .reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      dueThisWeek: invoices
        .filter((invoice) => invoice.balanceDue > 0 && invoice.dueDate >= todayKey && invoice.dueDate <= weekKey)
        .reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      paidThisMonth: payments
        .filter((payment) => payment.paymentDate.slice(0, 7) === paidMonth)
        .reduce((sum, payment) => sum + payment.amount, 0),
      vendorsOutstanding: new Set(
        invoices.filter((invoice) => invoice.balanceDue > 0).map((invoice) => invoice.vendorId),
      ).size,
    };
  }, [invoices]);

  const sectors = Array.from(new Set(vendors.map((vendor) => vendor.sector).filter(Boolean))).sort();

  const generateBill = () => {
    const vendor = vendorById.get(filters.vendorId || jobVendorId);
    if (!vendor) return setMessage("Select a vendor first.");
    const plan = vendor.planId ? planById.get(vendor.planId) : undefined;
    const result = vendorBillingService.generateInvoice({
      vendor,
      plan,
      includeCompletedJobs: true,
      notes: "Generated from Finance & Accounts receivables.",
    });
    setInvoices(vendorBillingService.getInvoices());
    setJobs(vendorBillingService.getJobs());
    setSelectedInvoiceId(result.invoice.id);
    setMessage(`Generated invoice ${result.invoice.invoiceNumber}.`);
  };

  const saveBillingProfile = () => {
    const saved = vendorBillingService.saveBillingProfile({
      ...billingProfile,
      phoneNumbers: phoneNumbersText
        .split(/\r?\n|,/)
        .map((phone) => phone.trim())
        .filter(Boolean),
    });
    setBillingProfile(saved);
    setPhoneNumbersText(saved.phoneNumbers.join("\n"));
    setMessage("Invoice billing profile saved.");
  };

  const recordPayment = () => {
    const invoiceId = paymentInvoiceId || selectedInvoiceId;
    if (!invoiceId) return setMessage("Select an invoice before recording payment.");
    try {
      const result = cashBankService.recordVendorReceipt({
        invoiceId,
        accountId: paymentForm.accountId,
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        transactionDate: paymentForm.paymentDate,
        reference: paymentForm.referenceNumber || null,
        notes: paymentForm.notes || null,
      });
      setInvoices(vendorBillingService.getInvoices());
      setCashAccounts(financeService.getActiveCashBankAccounts());
      setSelectedInvoiceId(result.invoice.id);
      setPaymentInvoiceId("");
      setPaymentForm({
        amount: "",
        accountId: "",
        paymentMethod: "manual",
        paymentDate: today(),
        referenceNumber: "",
        notes: "",
      });
      setMessage(`Payment recorded for ${result.invoice.invoiceNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to record payment.");
    }
  };

  const addJob = (generateInvoice = false) => {
    const vendor = vendorById.get(jobVendorId || filters.vendorId);
    if (!vendor) return setMessage("Select a vendor before adding a job.");
    if (jobForm.jobType === "stocktake" && !stocktakeEntitlement.allowed) {
      void analyticsService.logEvent({
        eventType: "addon_required" as any,
        actorType: "backend_staff",
        actorName: "SCI Finance",
        result: "blocked",
        vendorId: vendor.id,
        details: {
          service: "stocktake",
          usage: stocktakeUsage,
          limit: stocktakeLimit,
          reason: stocktakeEntitlement.reasons[0]?.message,
        },
      });
      return setMessage(
        stocktakeEntitlement.reasons[0]?.message ||
          "Stocktake is not enabled for this vendor plan. Add the Stocktake add-on or upgrade plan.",
      );
    }
    const staffMember = staff.find((item) => item.id === jobForm.performedByStaffId);
    const rpn = rpns.find((item) => item.id === jobForm.rpnId);
    const saved = vendorBillingService.saveJob({
      vendorId: vendor.id,
      vendorName: vendorName(vendor),
      jobType: jobForm.jobType,
      description: jobForm.description || jobForm.jobType.replace(/_/g, " "),
      requestedBy: jobForm.requestedBy || null,
      performedByStaffId: staffMember?.id || null,
      performedByStaffName:
        staffMember?.fullName || staffMember?.displayName || staffMember?.staffName || null,
      rpnId: rpn?.id || null,
      rpnName: rpn?.name || null,
      status: "completed",
      jobDate: jobForm.jobDate,
      quantity: Number(jobForm.quantity),
      unitPrice: Number(jobForm.unitPrice),
      taxable: jobForm.taxable,
      taxRate: Number(jobForm.taxRate),
      notes: jobForm.notes || null,
    });
    if (generateInvoice) {
      const invoice = vendorBillingService.generateInvoiceFromJob(saved.id, vendor);
      if (invoice) setSelectedInvoiceId(invoice.id);
    }
    setJobs(vendorBillingService.getJobs());
    setInvoices(vendorBillingService.getInvoices());
    setJobForm({
      jobType: "stocktake",
      description: "",
      requestedBy: "",
      performedByStaffId: "",
      rpnId: "",
      jobDate: today(),
      quantity: 1,
      unitPrice: 0,
      taxable: false,
      taxRate: 0,
      notes: "",
    });
    setMessage(generateInvoice ? "Job saved and billed." : "Vendor job saved.");
    if (saved.jobType === "stocktake") {
      void analyticsService.logEvent({
        eventType: "stocktake_completed" as any,
        actorType: "backend_staff",
        actorName: "SCI Finance",
        result: "success",
        vendorId: vendor.id,
        details: { jobId: saved.id, generatedInvoice: generateInvoice },
      });
    }
  };

  const printInvoice = (invoice: VendorInvoice) => {
    printVendorInvoice(invoice, vendorById.get(invoice.vendorId));
    setMessage(`Print view opened for ${invoice.invoiceNumber}.`);
  };

  const sendCollectionReminder = (invoice: VendorInvoice) => {
    if (invoice.balanceDue <= 0 || invoice.status === "paid") {
      return setMessage("This invoice is already paid.");
    }
    if (invoice.status === "cancelled") {
      return setMessage("Cancelled invoices cannot receive collection reminders.");
    }
    if (invoice.status === "void") {
      return setMessage("Voided invoices cannot receive collection reminders.");
    }
    const vendor = vendorById.get(invoice.vendorId);
    const phone = whatsappNumber(vendor);
    if (!phone) {
      return setMessage("Vendor WhatsApp number is missing.");
    }
    const reminderMessage = buildCollectionReminderMessage(invoice);
    const saved = vendorBillingService.recordCollectionReminder({
      invoiceId: invoice.id,
      channel: "whatsapp",
      message: reminderMessage,
    });
    if (saved) {
      setInvoices(vendorBillingService.getInvoices());
      setSelectedInvoiceId(saved.id);
    }
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(reminderMessage)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setMessage(`WhatsApp reminder opened for ${invoice.invoiceNumber}.`);
  };

  const voidInvoice = (invoice: VendorInvoice) => {
    if (invoice.status === "void") return setMessage("This invoice is already void.");
    if (invoice.status === "paid" || invoice.amountPaid > 0) {
      return setMessage("Paid or partially paid invoices cannot be voided. Use the payment workflow for adjustments.");
    }
    const reason = window.prompt(
      `Void invoice ${invoice.invoiceNumber}? Enter the void reason for audit records.`,
      "Incorrect or duplicate vendor bill.",
    );
    if (reason === null) return undefined;
    const trimmedReason = reason.trim();
    if (!trimmedReason) return setMessage("A void reason is required.");
    try {
      const saved = vendorBillingService.voidInvoice({
        invoiceId: invoice.id,
        reason: trimmedReason,
      });
      if (saved) {
        setInvoices(vendorBillingService.getInvoices());
        setSelectedInvoiceId(saved.id);
        setMessage(`Invoice ${saved.invoiceNumber} was voided.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to void invoice.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <StatCard label="Total Receivables" value={money(summary.totalReceivables)} icon={DollarSign} />
        <StatCard label="Overdue Amount" value={money(summary.overdueAmount)} icon={Receipt} variant="danger" />
        <StatCard label="Due This Week" value={money(summary.dueThisWeek)} icon={FileText} variant="warning" />
        <StatCard label="Paid This Month" value={money(summary.paidThisMonth)} icon={DollarSign} variant="success" />
        <StatCard label="Vendors Outstanding" value={summary.vendorsOutstanding} icon={Briefcase} />
      </div>

      <DataPanel
        title="Vendor Bills / Receivables"
        subtitle="Generate bills, attach jobs, record payments and monitor vendor financial behavior."
        actions={
          <PrimaryButton onClick={generateBill} size="sm">
            <FileText size={13} className="mr-1 inline" /> Generate Bill
          </PrimaryButton>
        }
      >
        <div className="space-y-4 p-4">
          {message && (
            <div className="border-l-4 border-brand-orange bg-orange-50 p-3 text-xs font-bold uppercase text-orange-800">
              {message}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
            <select value={filters.vendorId} onChange={(e) => setFilters((p) => ({ ...p, vendorId: e.target.value }))} className={inputClass}>
              <option value="">All Vendors</option>
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendorName(vendor)}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
              <option value="all">All Statuses</option>
              {["draft", "issued", "due_soon", "pending", "unpaid", "partially_paid", "paid", "overdue", "cancelled", "void"].map((status) => (
                <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
              ))}
            </select>
            <select value={filters.due} onChange={(e) => setFilters((p) => ({ ...p, due: e.target.value }))} className={inputClass}>
              <option value="all">All Due Dates</option>
              <option value="overdue">Overdue</option>
              <option value="due_this_week">Due This Week</option>
            </select>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))} className={inputClass} />
            <select value={filters.planId} onChange={(e) => setFilters((p) => ({ ...p, planId: e.target.value }))} className={inputClass}>
              <option value="">All Plans</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
            <select value={filters.sector} onChange={(e) => setFilters((p) => ({ ...p, sector: e.target.value }))} className={inputClass}>
              <option value="">All Sectors</option>
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </div>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left text-xs">
            <thead className="bg-stone-100 text-[9px] font-black uppercase text-stone-500">
              <tr>
                {["Vendor Name", "Active Plan", "Invoice Number", "Invoice Date", "Terms", "Amount Due", "Amount Paid", "Balance Due", "Due Date", "Collection", "Status", "Last Reminder", "Last Payment Date", "Actions"].map((header) => (
                  <th key={header} className="border-b border-stone-200 px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => {
                const vendor = vendorById.get(invoice.vendorId);
                const payments = vendorBillingService.getPayments(invoice.id);
                const lastPayment = payments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0];
                return (
                  <tr key={invoice.id} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-bold uppercase">{invoice.vendorName}</td>
                    <td className="px-4 py-3">{invoice.planName || planById.get(vendor?.planId || "")?.name || "No plan"}</td>
                    <td className="px-4 py-3 font-mono">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">{invoiceDate(invoice)}</td>
                    <td className="px-4 py-3 font-mono">{invoice.paymentTermsDays || VENDOR_INVOICE_PAYMENT_TERMS_DAYS} days</td>
                    <td className={`px-4 py-3 ${moneyCellClass}`}>{money(invoice.totalAmount)}</td>
                    <td className={`px-4 py-3 ${moneyCellClass}`}>{money(invoice.amountPaid)}</td>
                    <td className={`px-4 py-3 font-black ${moneyCellClass}`}>{money(invoice.balanceDue)}</td>
                    <td className="px-4 py-3">{invoice.dueDate}</td>
                    <td className="px-4 py-3 font-bold uppercase">{collectionLabel(invoice)}</td>
                    <td className="px-4 py-3"><StatusBadge status={invoice.status} variant={statusVariant(invoice.status) as any} /></td>
                    <td className="px-4 py-3">{invoice.lastReminderAt ? invoice.lastReminderAt.slice(0, 10) : "-"}</td>
                    <td className="px-4 py-3">{lastPayment?.paymentDate || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="border border-stone-200 p-2" onClick={() => setSelectedInvoiceId(invoice.id)} title="View"><Eye size={13} /></button>
                        <button className="border border-stone-200 p-2" onClick={() => printInvoice(invoice)} title="Print"><Printer size={13} /></button>
                        <button className="border border-stone-200 p-2" onClick={() => setPaymentInvoiceId(invoice.id)} title="Record payment"><DollarSign size={13} /></button>
                        <button className="border border-stone-200 p-2" onClick={() => sendCollectionReminder(invoice)} title="WhatsApp reminder"><MessageCircle size={13} /></button>
                        <button className="border border-stone-200 p-2 text-red-700" onClick={() => voidInvoice(invoice)} title="Void invoice"><Ban size={13} /></button>
                        <button className="border border-stone-200 p-2" onClick={() => setJobVendorId(invoice.vendorId)} title="Add job"><PlusCircle size={13} /></button>
                        <button className="border border-stone-200 px-2 py-1 text-[9px] font-black uppercase" onClick={() => window.location.assign(`/vendor-management`)}>
                          Open Vendor
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredInvoices.length === 0 && (
            <div className="p-8 text-center text-xs font-bold uppercase text-stone-400">
              No vendor bills match the selected filters.
            </div>
          )}
        </div>
      </DataPanel>

      <DataPanel
        title="Invoice Settings"
        subtitle="Company billing profile used on generated vendor invoice print/download output."
      >
        <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-3">
          <div className="space-y-3">
            <input
              value={billingProfile.companyName}
              onChange={(event) =>
                setBillingProfile((profile) => ({
                  ...profile,
                  companyName: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Company name"
            />
            <textarea
              value={billingProfile.companyAddress}
              onChange={(event) =>
                setBillingProfile((profile) => ({
                  ...profile,
                  companyAddress: event.target.value,
                }))
              }
              className={`${inputClass} min-h-20`}
              placeholder="Company address"
            />
            <textarea
              value={phoneNumbersText}
              onChange={(event) => setPhoneNumbersText(event.target.value)}
              className={`${inputClass} min-h-24`}
              placeholder="Phone numbers, one per line"
            />
          </div>
          <div className="space-y-3">
            <input
              value={billingProfile.ecocashNumber}
              onChange={(event) =>
                setBillingProfile((profile) => ({
                  ...profile,
                  ecocashNumber: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Ecocash number"
            />
            <input
              value={billingProfile.innBucksNumber}
              onChange={(event) =>
                setBillingProfile((profile) => ({
                  ...profile,
                  innBucksNumber: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="InnBucks number"
            />
            <input
              value={billingProfile.mukuruNumber}
              onChange={(event) =>
                setBillingProfile((profile) => ({
                  ...profile,
                  mukuruNumber: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Mukuru number"
            />
            <label className="flex items-center gap-2 text-[10px] font-black uppercase text-stone-600">
              <input
                type="checkbox"
                checked={billingProfile.useVendorAssignedRpnForPayments}
                onChange={(event) =>
                  setBillingProfile((profile) => ({
                    ...profile,
                    useVendorAssignedRpnForPayments: event.target.checked,
                  }))
                }
                className="accent-brand-orange"
              />
              Use vendor assigned RPN for payment follow-up
            </label>
          </div>
          <div className="space-y-3">
            <textarea
              value={billingProfile.popInstructionText}
              onChange={(event) =>
                setBillingProfile((profile) => ({
                  ...profile,
                  popInstructionText: event.target.value,
                }))
              }
              className={`${inputClass} min-h-24`}
              placeholder="POP instruction text"
            />
            <textarea
              value={billingProfile.invoiceTermsText}
              onChange={(event) =>
                setBillingProfile((profile) => ({
                  ...profile,
                  invoiceTermsText: event.target.value,
                }))
              }
              className={`${inputClass} min-h-24`}
              placeholder="Invoice terms text"
            />
            <PrimaryButton onClick={saveBillingProfile} size="sm">
              Save Invoice Settings
            </PrimaryButton>
          </div>
        </div>
      </DataPanel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DataPanel title="Record Payment" subtitle="Payments update invoice amount paid, balance due and status.">
          <div className="space-y-3 p-4">
            <select value={paymentInvoiceId || selectedInvoiceId} onChange={(e) => setPaymentInvoiceId(e.target.value)} className={inputClass}>
              <option value="">Select Invoice</option>
              {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} / {invoice.vendorName} / {money(invoice.balanceDue)}</option>)}
            </select>
            <select value={paymentForm.accountId} onChange={(e) => setPaymentForm((p) => ({ ...p, accountId: e.target.value }))} className={inputClass}>
              <option value="">Receiving Cash/Bank Account</option>
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName} / {money(account.currentBalance)}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={paymentForm.amount} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))} className={inputClass} type="number" placeholder="Payment amount" />
              <select value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm((p) => ({ ...p, paymentMethod: e.target.value }))} className={inputClass}>
                {["manual", "cash", "bank_transfer", "mobile_money", "card"].map((method) => <option key={method} value={method}>{method.replace(/_/g, " ")}</option>)}
              </select>
              <input value={paymentForm.paymentDate} onChange={(e) => setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))} className={inputClass} type="date" />
              <input value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm((p) => ({ ...p, referenceNumber: e.target.value }))} className={inputClass} placeholder="Reference number" />
            </div>
            <input value={paymentForm.notes} onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))} className={inputClass} placeholder="Payment notes" />
            <PrimaryButton onClick={recordPayment}>
              <DollarSign size={14} className="mr-2 inline" /> Record Payment
            </PrimaryButton>
          </div>
        </DataPanel>

        <DataPanel title="Add Vendor Job" subtitle="Completed jobs can be added to the next bill or billed immediately.">
          <div className="space-y-3 p-4">
            <select value={jobVendorId || filters.vendorId} onChange={(e) => setJobVendorId(e.target.value)} className={inputClass}>
              <option value="">Select Vendor</option>
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendorName(vendor)}</option>)}
            </select>
            {selectedJobVendor && (
              <div
                className={`border p-3 text-[10px] font-black uppercase ${
                  stocktakeEntitlement.allowed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                Stocktakes used this month: {stocktakeUsage} /{" "}
                {stocktakeLimit === "unlimited" ? "Unlimited" : stocktakeLimit}
                {!stocktakeEntitlement.allowed && (
                  <div className="mt-1">
                    {stocktakeEntitlement.reasons[0]?.message ||
                      "Stocktake is not enabled for this vendor plan. Add the Stocktake add-on or upgrade plan."}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input list="vendor-job-types" value={jobForm.jobType} onChange={(e) => setJobForm((p) => ({ ...p, jobType: e.target.value }))} className={inputClass} />
              <datalist id="vendor-job-types">
                {VENDOR_JOB_TYPES.map((type) => <option key={type} value={type} />)}
              </datalist>
              <input value={jobForm.jobDate} onChange={(e) => setJobForm((p) => ({ ...p, jobDate: e.target.value }))} className={inputClass} type="date" />
              <input value={jobForm.quantity} onChange={(e) => setJobForm((p) => ({ ...p, quantity: Number(e.target.value) }))} className={inputClass} type="number" placeholder="Quantity" />
              <input value={jobForm.unitPrice} onChange={(e) => setJobForm((p) => ({ ...p, unitPrice: Number(e.target.value) }))} className={inputClass} type="number" placeholder="Unit price" />
              <input value={jobForm.taxRate} onChange={(e) => setJobForm((p) => ({ ...p, taxRate: Number(e.target.value) }))} className={inputClass} type="number" placeholder="Tax rate" />
              <select value={jobForm.performedByStaffId} onChange={(e) => setJobForm((p) => ({ ...p, performedByStaffId: e.target.value }))} className={inputClass}>
                <option value="">Performed By Staff</option>
                {staff.map((member) => <option key={member.id} value={member.id}>{member.fullName || member.displayName || member.staffName}</option>)}
              </select>
              <select value={jobForm.rpnId} onChange={(e) => setJobForm((p) => ({ ...p, rpnId: e.target.value }))} className={inputClass}>
                <option value="">RPN</option>
                {rpns.map((rpn) => <option key={rpn.id} value={rpn.id}>{rpn.name}</option>)}
              </select>
            </div>
            <input value={jobForm.description} onChange={(e) => setJobForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} placeholder="Description" />
            <label className="flex items-center gap-2 text-[10px] font-black uppercase text-stone-600">
              <input type="checkbox" checked={jobForm.taxable} onChange={(e) => setJobForm((p) => ({ ...p, taxable: e.target.checked }))} className="accent-brand-orange" />
              Taxable
            </label>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                onClick={() => addJob(false)}
                disabled={jobForm.jobType === "stocktake" && !stocktakeEntitlement.allowed}
              >
                <Briefcase size={14} className="mr-2 inline" /> Save Job
              </SecondaryButton>
              <PrimaryButton
                onClick={() => addJob(true)}
                disabled={jobForm.jobType === "stocktake" && !stocktakeEntitlement.allowed}
              >
                <FileText size={14} className="mr-2 inline" /> Generate Bill From Job
              </PrimaryButton>
            </div>
          </div>
        </DataPanel>
      </div>

      {selectedInvoice && (
        <DataPanel
          title={`Invoice ${selectedInvoice.invoiceNumber}`}
          subtitle="Printable bill preview and linked invoice lines."
          actions={<SecondaryButton onClick={() => printInvoice(selectedInvoice)} size="sm"><Printer size={13} className="mr-1 inline" /> Print</SecondaryButton>}
        >
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase text-stone-500 md:grid-cols-7">
              <div className="border border-stone-200 p-3">Vendor: {selectedInvoice.vendorName}</div>
              <div className="border border-stone-200 p-3">Invoice Date: {invoiceDate(selectedInvoice)}</div>
              <div className="border border-stone-200 p-3">Due: {selectedInvoice.dueDate}</div>
              <div className="border border-stone-200 p-3">Terms: {selectedInvoice.paymentTermsDays || VENDOR_INVOICE_PAYMENT_TERMS_DAYS} days</div>
              <div className="min-w-0 border border-stone-200 p-3">Total: <span className="whitespace-nowrap tabular-nums">{money(selectedInvoice.totalAmount)}</span></div>
              <div className="min-w-0 border border-stone-200 p-3">Paid: <span className="whitespace-nowrap tabular-nums">{money(selectedInvoice.amountPaid)}</span></div>
              <div className="min-w-0 border border-stone-200 p-3">Balance: <span className="whitespace-nowrap tabular-nums">{money(selectedInvoice.balanceDue)}</span></div>
            </div>
            {selectedInvoice.status === "void" && (
              <div className="mt-3 border border-red-200 bg-red-50 p-3 text-[10px] font-bold uppercase text-red-800">
                Void audit: {selectedInvoice.voidedAt ? selectedInvoice.voidedAt.slice(0, 10) : "Date unavailable"} /{" "}
                {selectedInvoice.voidedByStaffName || "Staff unavailable"} /{" "}
                {selectedInvoice.voidReason || "No reason supplied"}
              </div>
            )}
            <table className="mt-4 w-full text-left text-xs">
              <thead className="bg-stone-100 text-[9px] font-black uppercase text-stone-500">
                <tr>
                  {["Description", "Qty", "Unit Price", "Tax", "Amount"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {selectedInvoiceLines.map((line) => (
                  <tr key={line.id} className="border-b border-stone-100">
                    <td className="px-3 py-2 font-bold uppercase">{line.description}</td>
                    <td className="px-3 py-2 font-mono">{line.quantity}</td>
                    <td className={`px-3 py-2 ${moneyCellClass}`}>{money(line.unitPrice)}</td>
                    <td className={`px-3 py-2 ${moneyCellClass}`}>{money(line.taxAmount)}</td>
                    <td className={`px-3 py-2 ${moneyCellClass}`}>{money(line.grossAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
      )}

      <DataPanel title="Vendor Financial Intelligence" subtitle="Prepared BI signals for receivables, support cost and service revenue analysis.">
        <div className="grid grid-cols-1 gap-3 p-4 text-[10px] font-bold uppercase text-stone-500 md:grid-cols-3">
          <div className="border border-stone-200 p-3">High support-cost vendors: {jobs.filter((job) => job.grossAmount > 0).length}</div>
          <div className="border border-stone-200 p-3">Service revenue by sector is available through linked vendor/job records.</div>
          <div className="border border-stone-200 p-3">Recurring overdue balances: {invoices.filter((invoice) => invoice.status === "overdue").length}</div>
        </div>
      </DataPanel>
    </div>
  );
};

export default VendorBillsReceivables;
