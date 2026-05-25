import {
  PricingPlan,
  Vendor,
  VendorBillingLedgerEntry,
  VendorInvoice,
  VendorInvoiceBillingProfile,
  VendorInvoiceLine,
  VendorInvoiceLineItemType,
  VendorJob,
  VendorPayment,
} from "../types.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";
import { getSession, getSessionStaffId, getSessionStaffName } from "../utils/session.ts";
import { analyticsService } from "./analyticsService.ts";
import { localStorageService } from "./localStorageService.ts";
import { staffAuditService } from "./staffAuditService.ts";

const INVOICES_KEY = "vendorInvoices";
const INVOICE_LINES_KEY = "vendorInvoiceLines";
const PAYMENTS_KEY = "vendorPayments";
const JOBS_KEY = "vendorJobs";
const LEDGER_KEY = "vendorBillingLedger";
const BILLING_PROFILE_KEY = "vendorInvoiceBillingProfile";
export const VENDOR_INVOICE_PAYMENT_TERMS_DAYS = 30;
export const DEFAULT_VENDOR_INVOICE_BILLING_PROFILE: VendorInvoiceBillingProfile = {
  companyName: "Digital Commerce",
  companyAddress: "49 Brechin Est. Commerce Valley, Marirangwe, Mhondoro",
  phoneNumbers: ["+263775747198", "+263774479121", "+263789487287"],
  ecocashNumber: "0773543642",
  innBucksNumber: "0775747198",
  mukuruNumber: "0775747198",
  invoiceTermsText:
    "Activation or renewal is processed after proof of payment verification.",
  popInstructionText:
    "Vendor must send POP to the attached company numbers for payment confirmation and activation. Payment should reference the invoice number and vendor name.",
  useVendorAssignedRpnForPayments: true,
};

export const VENDOR_JOB_TYPES = [
  "stocktake",
  "catalogue_setup",
  "storefront_setup",
  "data_capture",
  "image_cleanup",
  "onboarding_support",
  "training",
  "field_visit",
  "manual_charge",
];

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const addDaysToDate = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return today();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const money = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const getAll = <T>(key: string): T[] => asArray<T>(localStorageService.get<T[]>(key));
const setAll = <T>(key: string, rows: T[]) =>
  localStorageService.set(key, sanitizeForFirestore(rows) as T[]);
const normalizeBillingProfile = (
  profile?: Partial<VendorInvoiceBillingProfile> | null,
): VendorInvoiceBillingProfile => ({
  ...DEFAULT_VENDOR_INVOICE_BILLING_PROFILE,
  ...(profile || {}),
  phoneNumbers:
    Array.isArray(profile?.phoneNumbers) && profile.phoneNumbers.length > 0
      ? profile.phoneNumbers.map((phone) => String(phone || "").trim()).filter(Boolean)
      : DEFAULT_VENDOR_INVOICE_BILLING_PROFILE.phoneNumbers,
  useVendorAssignedRpnForPayments:
    profile?.useVendorAssignedRpnForPayments ??
    DEFAULT_VENDOR_INVOICE_BILLING_PROFILE.useVendorAssignedRpnForPayments,
});

const upsert = <T extends { id: string }>(rows: T[], row: T) => {
  const index = rows.findIndex((item) => item.id === row.id);
  if (index >= 0) rows[index] = row;
  else rows.push(row);
  return rows;
};

const sequence = (prefix: string, existingCount: number) =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(existingCount + 1).padStart(4, "0")}`;

const currentStaff = () => {
  const session = getSession();
  return {
    staffId: getSessionStaffId(session) || null,
    staffName: getSessionStaffName(session, "SCI Finance"),
  };
};

const lineTotals = (
  quantity: number,
  unitPrice: number,
  taxable: boolean,
  taxRate: number,
) => {
  const netAmount = money(quantity) * money(unitPrice);
  const taxAmount = taxable ? money(netAmount * (money(taxRate) / 100)) : 0;
  return {
    netAmount: money(netAmount),
    taxAmount: money(taxAmount),
    grossAmount: money(netAmount + taxAmount),
  };
};

const invoiceStatusFromBalance = (
  invoice: Pick<VendorInvoice, "totalAmount" | "amountPaid" | "dueDate" | "status">,
): VendorInvoice["status"] => {
  if (invoice.status === "cancelled" || invoice.status === "void" || invoice.status === "draft") return invoice.status;
  const balance = money(invoice.totalAmount - invoice.amountPaid);
  if (balance <= 0) return "paid";
  if (invoice.dueDate && invoice.dueDate < today()) return "overdue";
  if (invoice.dueDate && invoice.dueDate <= addDaysToDate(today(), 7)) return "due_soon";
  return "issued";
};

const collectionStatusFromInvoice = (
  invoice: Pick<VendorInvoice, "status" | "dueDate" | "balanceDue">,
): VendorInvoice["collectionStatus"] => {
  if (invoice.status === "void") return "void";
  if (invoice.status === "cancelled") return "cancelled";
  if (invoice.status === "paid" || invoice.balanceDue <= 0) return "paid";
  if (invoice.dueDate < today()) return "overdue";
  if (invoice.dueDate <= addDaysToDate(today(), 7)) return "due_soon";
  return "not_due";
};

const normalizeInvoice = (invoice: VendorInvoice): VendorInvoice => {
  const invoiceDate = invoice.invoiceDate || invoice.issueDate || invoice.createdAt?.slice(0, 10) || today();
  const paymentTermsDays = Number(invoice.paymentTermsDays || VENDOR_INVOICE_PAYMENT_TERMS_DAYS);
  const dueDate = invoice.dueDate || addDaysToDate(invoiceDate, paymentTermsDays);
  const balanceDue =
    invoice.status === "void" ? 0 : Math.max(0, money(invoice.totalAmount - invoice.amountPaid));
  const nextStatus = invoiceStatusFromBalance({
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    dueDate,
    status: invoice.status,
  });
  return {
    ...invoice,
    invoiceDate,
    issueDate: invoice.issueDate || invoiceDate,
    dueDate,
    paymentTermsDays,
    balanceDue,
    status: nextStatus,
    collectionStatus: collectionStatusFromInvoice({
      status: nextStatus,
      dueDate,
      balanceDue,
    }),
    reminderCount: Number(invoice.reminderCount || 0),
  };
};

const addLedger = (entry: Omit<VendorBillingLedgerEntry, "id" | "createdAt">) => {
  const ledger = getAll<VendorBillingLedgerEntry>(LEDGER_KEY);
  const saved: VendorBillingLedgerEntry = {
    ...entry,
    id: `VBL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: nowIso(),
  };
  setAll(LEDGER_KEY, [...ledger, saved]);
  return saved;
};

const audit = (
  action: string,
  recordType: string,
  recordId: string,
  afterSnapshot?: unknown,
) => {
  void staffAuditService.logAction({
    eventType: "RECORD_UPDATED",
    module: "finance",
    severity: "info",
    action,
    recordType,
    recordId,
    afterSnapshot,
  });
  void analyticsService.logEvent({
    eventType: "FINANCE_EVENT" as any,
    actorType: "backend_staff",
    actorName: currentStaff().staffName,
    result: "success",
    details: { action, recordType, recordId },
  });
};

export const vendorBillingService = {
  getBillingProfile: (): VendorInvoiceBillingProfile =>
    normalizeBillingProfile(
      localStorageService.get<VendorInvoiceBillingProfile>(BILLING_PROFILE_KEY),
    ),
  saveBillingProfile: (
    profile: Partial<VendorInvoiceBillingProfile>,
  ): VendorInvoiceBillingProfile => {
    const saved = normalizeBillingProfile({
      ...profile,
      updatedAt: nowIso(),
    });
    localStorageService.set(
      BILLING_PROFILE_KEY,
      sanitizeForFirestore(saved) as VendorInvoiceBillingProfile,
    );
    audit("Updated vendor invoice billing profile", "vendor_invoice_billing_profile", "default", saved);
    return saved;
  },
  getInvoices: (): VendorInvoice[] => getAll<VendorInvoice>(INVOICES_KEY).map(normalizeInvoice),
  getInvoiceLines: (invoiceId?: string): VendorInvoiceLine[] => {
    const rows = getAll<VendorInvoiceLine>(INVOICE_LINES_KEY);
    return invoiceId ? rows.filter((row) => row.invoiceId === invoiceId) : rows;
  },
  getPayments: (invoiceId?: string): VendorPayment[] => {
    const rows = getAll<VendorPayment>(PAYMENTS_KEY);
    return invoiceId ? rows.filter((row) => row.invoiceId === invoiceId) : rows;
  },
  getJobs: (vendorId?: string): VendorJob[] => {
    const rows = getAll<VendorJob>(JOBS_KEY);
    return vendorId ? rows.filter((row) => row.vendorId === vendorId) : rows;
  },
  getLedger: (): VendorBillingLedgerEntry[] =>
    getAll<VendorBillingLedgerEntry>(LEDGER_KEY),

  makeInvoiceLine(input: {
    invoiceId: string;
    invoiceNumber: string;
    vendorId: string;
    itemType: VendorInvoiceLineItemType;
    description: string;
    quantity: number;
    unitPrice: number;
    taxable?: boolean;
    taxRate?: number;
    referenceId?: string | null;
  }): VendorInvoiceLine {
    const now = nowIso();
    const totals = lineTotals(
      input.quantity,
      input.unitPrice,
      !!input.taxable,
      input.taxRate || 0,
    );
    return {
      id: `VIL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      vendorId: input.vendorId,
      itemType: input.itemType,
      description: input.description,
      quantity: money(input.quantity),
      unitPrice: money(input.unitPrice),
      taxable: !!input.taxable,
      taxRate: money(input.taxRate || 0),
      ...totals,
      referenceId: input.referenceId || null,
      createdAt: now,
      updatedAt: now,
    };
  },

  generateInvoice(input: {
    vendor: Vendor;
    plan?: PricingPlan | null;
    dueDate?: string;
    notes?: string | null;
    includeCompletedJobs?: boolean;
    extraLines?: Array<{
      itemType: VendorInvoiceLineItemType;
      description: string;
      quantity: number;
      unitPrice: number;
      taxable?: boolean;
      taxRate?: number;
      referenceId?: string | null;
    }>;
  }): { invoice: VendorInvoice; lines: VendorInvoiceLine[] } {
    const invoices = vendorBillingService.getInvoices();
    const invoiceId = `VI-${Date.now()}`;
    const invoiceNumber = sequence("SCI-INV", invoices.length);
    const staff = currentStaff();
    const invoiceDate = today();
    const dueDate = addDaysToDate(invoiceDate, VENDOR_INVOICE_PAYMENT_TERMS_DAYS);
    const vendorName = input.vendor.tradingName || input.vendor.name || "Vendor";
    const currency = input.plan?.currency || "USD";

    const baseLines = [];
    if (input.plan?.monthlyPrice) {
      baseLines.push({
        itemType: "subscription" as VendorInvoiceLineItemType,
        description: `${input.plan.name} monthly subscription`,
        quantity: 1,
        unitPrice: input.plan.monthlyPrice,
        taxable: false,
        taxRate: 0,
      });
    }

    const completedJobs = input.includeCompletedJobs
      ? vendorBillingService
          .getJobs(input.vendor.id)
          .filter((job) => job.status === "completed" && !job.linkedInvoiceId)
          .map((job) => ({
            itemType:
              job.jobType === "manual_charge"
                ? ("manual_charge" as VendorInvoiceLineItemType)
                : job.jobType === "stocktake"
                  ? ("stocktake_service_job" as VendorInvoiceLineItemType)
                  : ("service_job" as VendorInvoiceLineItemType),
            description: job.description || job.jobType,
            quantity: job.quantity,
            unitPrice: job.unitPrice,
            taxable: job.taxable,
            taxRate: job.taxRate,
            referenceId: job.id,
          }))
      : [];

    const lines = [...baseLines, ...completedJobs, ...(input.extraLines || [])].map((line) =>
      vendorBillingService.makeInvoiceLine({
        invoiceId,
        invoiceNumber,
        vendorId: input.vendor.id,
        ...line,
      }),
    );
    const subtotal = money(lines.reduce((sum, line) => sum + line.netAmount, 0));
    const taxAmount = money(lines.reduce((sum, line) => sum + line.taxAmount, 0));
    const totalAmount = money(subtotal + taxAmount);
    const now = nowIso();
    const invoice: VendorInvoice = {
      id: invoiceId,
      invoiceNumber,
      vendorId: input.vendor.id,
      vendorName,
      planId: input.plan?.id || input.vendor.planId || null,
      planName: input.plan?.name || null,
      invoiceDate,
      issueDate: invoiceDate,
      dueDate,
      paymentTermsDays: VENDOR_INVOICE_PAYMENT_TERMS_DAYS,
      status: totalAmount > 0 ? "issued" : "draft",
      subtotal,
      taxAmount,
      totalAmount,
      amountPaid: 0,
      balanceDue: totalAmount,
      currency,
      notes: input.notes || null,
      collectionStatus:
        totalAmount > 0
          ? collectionStatusFromInvoice({
              status: "issued",
              dueDate,
              balanceDue: totalAmount,
            })
          : "not_due",
      lastReminderAt: null,
      lastReminderChannel: null,
      lastReminderMessage: null,
      reminderCount: 0,
      generatedByStaffId: staff.staffId,
      generatedByStaffName: staff.staffName,
      createdAt: now,
      updatedAt: now,
    };
    vendorBillingService.saveInvoiceWithLines(invoice, lines);
    completedJobs.forEach((line) => {
      if (line.referenceId) {
        vendorBillingService.markJobBilled(line.referenceId, invoice);
      }
    });
    addLedger({
      vendorId: invoice.vendorId,
      vendorName: invoice.vendorName,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      entryType: "invoice_generated",
      debit: invoice.totalAmount,
      credit: 0,
      balanceImpact: invoice.totalAmount,
      notes: invoice.notes || null,
      createdByStaffId: staff.staffId,
      createdByStaffName: staff.staffName,
    });
    audit(`Generated vendor invoice ${invoice.invoiceNumber}`, "vendor_invoice", invoice.id, invoice);
    return { invoice, lines };
  },

  saveInvoiceWithLines(invoice: VendorInvoice, lines: VendorInvoiceLine[]) {
    setAll(INVOICES_KEY, upsert(vendorBillingService.getInvoices(), normalizeInvoice(invoice)));
    const retained = vendorBillingService
      .getInvoiceLines()
      .filter((line) => line.invoiceId !== invoice.id);
    setAll(INVOICE_LINES_KEY, [...retained, ...lines]);
  },

  saveJob(input: Partial<VendorJob> & Pick<VendorJob, "vendorId" | "vendorName" | "jobType" | "description">): VendorJob {
    const jobs = vendorBillingService.getJobs();
    const now = nowIso();
    const quantity = money(input.quantity || 1);
    const unitPrice = money(input.unitPrice || 0);
    const totals = lineTotals(quantity, unitPrice, !!input.taxable, input.taxRate || 0);
    const existing = input.id ? jobs.find((job) => job.id === input.id) : undefined;
    const saved: VendorJob = {
      id: input.id || `VJ-${Date.now()}`,
      jobNumber: input.jobNumber || sequence("SCI-JOB", jobs.length),
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      jobType: input.jobType,
      description: input.description,
      requestedBy: input.requestedBy || null,
      performedByStaffId: input.performedByStaffId || null,
      performedByStaffName: input.performedByStaffName || null,
      rpnId: input.rpnId || null,
      rpnName: input.rpnName || null,
      status: input.status || "completed",
      jobDate: input.jobDate || today(),
      completedAt:
        input.completedAt ||
        (input.status === "completed" || !input.status ? now : null),
      quantity,
      unitPrice,
      taxable: !!input.taxable,
      taxRate: money(input.taxRate || 0),
      ...totals,
      notes: input.notes || null,
      linkedInvoiceId: input.linkedInvoiceId || null,
      linkedInvoiceNumber: input.linkedInvoiceNumber || null,
      createdAt: existing?.createdAt || input.createdAt || now,
      updatedAt: now,
    };
    setAll(JOBS_KEY, upsert(jobs, saved));
    const staff = currentStaff();
    addLedger({
      vendorId: saved.vendorId,
      vendorName: saved.vendorName,
      jobId: saved.id,
      entryType: saved.status === "completed" ? "job_completed" : "job_created",
      debit: 0,
      credit: 0,
      balanceImpact: 0,
      notes: saved.description,
      createdByStaffId: staff.staffId,
      createdByStaffName: staff.staffName,
    });
    audit(`Saved vendor job ${saved.jobNumber}`, "vendor_job", saved.id, saved);
    return saved;
  },

  markJobBilled(jobId: string, invoice: VendorInvoice): VendorJob | undefined {
    const jobs = vendorBillingService.getJobs();
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return undefined;
    const saved = {
      ...job,
      status: "billed" as const,
      linkedInvoiceId: invoice.id,
      linkedInvoiceNumber: invoice.invoiceNumber,
      updatedAt: nowIso(),
    };
    setAll(JOBS_KEY, upsert(jobs, saved));
    const staff = currentStaff();
    addLedger({
      vendorId: saved.vendorId,
      vendorName: saved.vendorName,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      jobId: saved.id,
      entryType: "job_billed",
      debit: saved.grossAmount,
      credit: 0,
      balanceImpact: saved.grossAmount,
      notes: saved.description,
      createdByStaffId: staff.staffId,
      createdByStaffName: staff.staffName,
    });
    audit(`Linked job ${saved.jobNumber} to invoice ${invoice.invoiceNumber}`, "vendor_job", saved.id, saved);
    return saved;
  },

  generateInvoiceFromJob(jobId: string, vendor: Vendor): VendorInvoice | undefined {
    const job = vendorBillingService.getJobs().find((item) => item.id === jobId);
    if (!job) return undefined;
    return vendorBillingService.generateInvoice({
      vendor,
      notes: `Generated from vendor job ${job.jobNumber}`,
      extraLines: [
        {
          itemType:
            job.jobType === "manual_charge"
              ? "manual_charge"
              : job.jobType === "stocktake"
                ? "stocktake_service_job"
                : "service_job",
          description: job.description,
          quantity: job.quantity,
          unitPrice: job.unitPrice,
          taxable: job.taxable,
          taxRate: job.taxRate,
          referenceId: job.id,
        },
      ],
    }).invoice;
  },

  generateInventoryControlAddOnInvoice(input: {
    vendor: Vendor;
    plan?: PricingPlan | null;
    serviceType: "spot_check" | "stocktake";
    quantity?: number;
    taxable?: boolean;
    taxRate?: number;
  }): VendorInvoice {
    const quantity = Math.max(1, Number(input.quantity) || 1);
    const isSpotCheck = input.serviceType === "spot_check";
    const unitPrice = isSpotCheck
      ? Number(input.plan?.spotCheckAddOnPrice || 0)
      : Number(input.plan?.stocktakeAddOnPrice || 0);
    return vendorBillingService.generateInvoice({
      vendor: input.vendor,
      plan: input.plan,
      notes: isSpotCheck
        ? "Inventory spot check add-on / over-quota charge."
        : "Stocktake add-on / over-quota charge.",
      extraLines: [
        {
          itemType: isSpotCheck ? "spot_check_addon" : "stocktake_addon",
          description: isSpotCheck
            ? "Inventory Spot Check Add-on"
            : "Stocktake Add-on",
          quantity,
          unitPrice,
          taxable: !!input.taxable,
          taxRate: input.taxRate || 0,
        },
      ],
    }).invoice;
  },

  recordPayment(input: {
    invoiceId: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    referenceNumber?: string | null;
    notes?: string | null;
  }): { invoice: VendorInvoice; payment: VendorPayment } {
    const invoices = vendorBillingService.getInvoices();
    const invoice = invoices.find((item) => item.id === input.invoiceId);
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "void") throw new Error("Voided invoices cannot receive payments.");
    const staff = currentStaff();
    const now = nowIso();
    const amount = money(input.amount);
    const payment: VendorPayment = {
      id: `VPAY-${Date.now()}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      vendorId: invoice.vendorId,
      vendorName: invoice.vendorName,
      amount,
      paymentMethod: input.paymentMethod || "manual",
      paymentDate: input.paymentDate || today(),
      referenceNumber: input.referenceNumber || null,
      notes: input.notes || null,
      recordedByStaffId: staff.staffId,
      recordedByStaffName: staff.staffName,
      createdAt: now,
      updatedAt: now,
    };
    const amountPaid = money(invoice.amountPaid + amount);
    const balanceDue = money(invoice.totalAmount - amountPaid);
    const nextInvoice: VendorInvoice = {
      ...invoice,
      amountPaid,
      balanceDue: Math.max(0, balanceDue),
      status: invoiceStatusFromBalance({ ...invoice, amountPaid }),
      updatedAt: now,
    };
    const normalizedInvoice = normalizeInvoice(nextInvoice);
    setAll(PAYMENTS_KEY, [...vendorBillingService.getPayments(), payment]);
    setAll(INVOICES_KEY, upsert(invoices, normalizedInvoice));
    addLedger({
      vendorId: invoice.vendorId,
      vendorName: invoice.vendorName,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentId: payment.id,
      entryType: "payment_recorded",
      debit: 0,
      credit: amount,
      balanceImpact: -amount,
      notes: payment.notes || payment.referenceNumber || null,
      createdByStaffId: staff.staffId,
      createdByStaffName: staff.staffName,
    });
    audit(`Recorded payment for invoice ${invoice.invoiceNumber}`, "vendor_payment", payment.id, payment);
    return { invoice: normalizedInvoice, payment };
  },

  recordCollectionReminder(input: {
    invoiceId: string;
    channel: "whatsapp" | "call" | "manual";
    message?: string | null;
  }): VendorInvoice | undefined {
    const invoices = vendorBillingService.getInvoices();
    const invoice = invoices.find((item) => item.id === input.invoiceId);
    if (!invoice) return undefined;
    if (invoice.status === "void") return undefined;
    const staff = currentStaff();
    const now = nowIso();
    const next = normalizeInvoice({
      ...invoice,
      lastReminderAt: now,
      lastReminderChannel: input.channel,
      lastReminderMessage: input.message || null,
      reminderCount: Number(invoice.reminderCount || 0) + 1,
      updatedAt: now,
    });
    setAll(INVOICES_KEY, upsert(invoices, next));
    addLedger({
      vendorId: next.vendorId,
      vendorName: next.vendorName,
      invoiceId: next.id,
      invoiceNumber: next.invoiceNumber,
      entryType: "collection_reminder_sent",
      debit: 0,
      credit: 0,
      balanceImpact: 0,
      notes: input.message || `${input.channel} collection reminder sent`,
      createdByStaffId: staff.staffId,
      createdByStaffName: staff.staffName,
    });
    audit(`Sent ${input.channel} collection reminder for ${next.invoiceNumber}`, "vendor_invoice", next.id, next);
    return next;
  },

  cancelInvoice(invoiceId: string): VendorInvoice | undefined {
    const invoices = vendorBillingService.getInvoices();
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return undefined;
    const next = normalizeInvoice({ ...invoice, status: "cancelled" as const, updatedAt: nowIso() });
    setAll(INVOICES_KEY, upsert(invoices, next));
    const staff = currentStaff();
    addLedger({
      vendorId: next.vendorId,
      vendorName: next.vendorName,
      invoiceId: next.id,
      invoiceNumber: next.invoiceNumber,
      entryType: "invoice_cancelled",
      debit: 0,
      credit: next.balanceDue,
      balanceImpact: -next.balanceDue,
      notes: "Invoice cancelled",
      createdByStaffId: staff.staffId,
      createdByStaffName: staff.staffName,
    });
    audit(`Cancelled invoice ${next.invoiceNumber}`, "vendor_invoice", next.id, next);
    return next;
  },

  voidInvoice(input: {
    invoiceId: string;
    reason?: string | null;
  }): VendorInvoice | undefined {
    const invoices = vendorBillingService.getInvoices();
    const invoice = invoices.find((item) => item.id === input.invoiceId);
    if (!invoice) return undefined;
    if (invoice.status === "void") return invoice;
    if (invoice.status === "paid" || invoice.amountPaid > 0) {
      throw new Error("Paid or partially paid invoices cannot be voided. Use the payment workflow for adjustments.");
    }
    const staff = currentStaff();
    const now = nowIso();
    const next = normalizeInvoice({
      ...invoice,
      status: "void",
      balanceDue: 0,
      collectionStatus: "void",
      voidedAt: now,
      voidedByStaffId: staff.staffId,
      voidedByStaffName: staff.staffName,
      voidReason: input.reason || "Voided from Vendor Bills / Receivables.",
      updatedAt: now,
    });
    setAll(INVOICES_KEY, upsert(invoices, next));
    addLedger({
      vendorId: next.vendorId,
      vendorName: next.vendorName,
      invoiceId: next.id,
      invoiceNumber: next.invoiceNumber,
      entryType: "invoice_voided",
      debit: 0,
      credit: invoice.balanceDue,
      balanceImpact: -invoice.balanceDue,
      notes: next.voidReason || "Invoice voided",
      createdByStaffId: staff.staffId,
      createdByStaffName: staff.staffName,
    });
    audit(`Voided invoice ${next.invoiceNumber}`, "vendor_invoice", next.id, next);
    return next;
  },
};
