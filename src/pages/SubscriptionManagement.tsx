/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  DataPanel,
  StatusBadge,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  StatCard,
} from "../components/CommonUI.tsx";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  MessageCircle,
  Receipt,
  Send,
  Users,
  Wallet,
} from "lucide-react";
import { vendorService } from "../services/vendorService.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { rpnService } from "../services/rpnService.ts";
import { subscriptionService } from "../services/subscriptionService.ts";
import { vendorBillingService } from "../services/vendorBillingService.ts";
import { staffService } from "../services/staffService.ts";
import {
  PricingPlan,
  RPN,
  Staff,
  Subscription,
  Vendor,
  VendorInvoice,
  VendorInvoiceStatus,
} from "../types.ts";
import { printVendorInvoice } from "../utils/vendorInvoicePrint.ts";

type AgeingBucketId =
  | "due_14_8"
  | "due_7_1"
  | "due_today"
  | "overdue_1_7"
  | "overdue_8_14"
  | "overdue_15_30"
  | "overdue_31_plus"
  | "future"
  | "unknown";

type StatusFilter = "active" | "due_soon" | "due_today" | "overdue" | "all" | "paid" | "void" | "cancelled";
type GroupMode = "rpn" | "staff";

type CollectionSource = "invoice" | "subscription";

type CollectionRow = {
  id: string;
  source: CollectionSource;
  vendorId: string;
  vendorName: string;
  vendorWhatsapp: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  daysDelta: number | null;
  bucketId: AgeingBucketId;
  bucketLabel: string;
  amountDue: number;
  status: VendorInvoiceStatus | Subscription["status"];
  planId?: string;
  planName?: string;
  rpnId?: string;
  rpnName: string;
  rpnWhatsapp: string;
  staffId?: string;
  staffName: string;
  staffWhatsapp: string;
  invoice?: VendorInvoice;
  subscription?: Subscription;
};

type WhatsAppGroup = {
  id: string;
  name: string;
  whatsapp: string;
  rows: CollectionRow[];
  total: number;
  message: string;
};

const dayMs = 24 * 60 * 60 * 1000;
const todayKey = () => new Date().toISOString().slice(0, 10);
const money = (value: unknown) => {
  const amount = Number(value || 0);
  return `$${Number.isFinite(amount) ? Math.round(amount).toLocaleString("en-US") : "0"}`;
};
const dateLabel = (dateKey?: string) => {
  if (!dateKey) return "Not supplied";
  const parsed = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? dateKey : parsed.toLocaleDateString();
};
const parseDate = (dateKey?: string) => {
  if (!dateKey) return null;
  const parsed = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const cleanPhone = (value?: string) =>
  String(value || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
const vendorDisplayName = (vendor?: Vendor, fallback = "Unknown vendor") =>
  vendor?.tradingName || vendor?.name || fallback;
const staffDisplayName = (staff?: Staff, fallback = "No staff assigned") =>
  staff?.fullName || staff?.displayName || staff?.staffName || fallback;
const getVendorRpnId = (vendor?: Vendor, subscription?: Subscription) =>
  vendor?.assignedRPNId || vendor?.rpnId || subscription?.assignedRPNId || "";
const getVendorStaffId = (vendor?: Vendor) =>
  vendor?.assignedStaffId || vendor?.assignedMemberId || vendor?.onboardedByStaffId || "";

const bucketMeta: Record<AgeingBucketId, { label: string; active: boolean }> = {
  due_14_8: { label: "Due in 14-8 days", active: true },
  due_7_1: { label: "Due in 7-1 days", active: true },
  due_today: { label: "Due today", active: true },
  overdue_1_7: { label: "Overdue 1-7 days", active: true },
  overdue_8_14: { label: "Overdue 8-14 days", active: true },
  overdue_15_30: { label: "Overdue 15-30 days", active: true },
  overdue_31_plus: { label: "Overdue 31+ days", active: true },
  future: { label: "Due beyond 14 days", active: false },
  unknown: { label: "No due date", active: false },
};

const ageingBucketFor = (dueDate?: string): { id: AgeingBucketId; daysDelta: number | null } => {
  const due = parseDate(dueDate);
  if (!due) return { id: "unknown", daysDelta: null };
  const today = parseDate(todayKey()) || new Date();
  const daysDelta = Math.ceil((due.getTime() - today.getTime()) / dayMs);
  if (daysDelta >= 8 && daysDelta <= 14) return { id: "due_14_8", daysDelta };
  if (daysDelta >= 1 && daysDelta <= 7) return { id: "due_7_1", daysDelta };
  if (daysDelta === 0) return { id: "due_today", daysDelta };
  const overdueDays = Math.abs(daysDelta);
  if (daysDelta < 0 && overdueDays <= 7) return { id: "overdue_1_7", daysDelta };
  if (daysDelta < 0 && overdueDays <= 14) return { id: "overdue_8_14", daysDelta };
  if (daysDelta < 0 && overdueDays <= 30) return { id: "overdue_15_30", daysDelta };
  if (daysDelta < 0) return { id: "overdue_31_plus", daysDelta };
  return { id: "future", daysDelta };
};

const daysPhrase = (row: CollectionRow) => {
  if (row.daysDelta === null) return "Due date missing";
  if (row.daysDelta === 0) return "Due today";
  if (row.daysDelta > 0) return `Due in ${row.daysDelta} day${row.daysDelta === 1 ? "" : "s"}`;
  const overdue = Math.abs(row.daysDelta);
  return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
};

const isClosedInvoiceStatus = (status: string) =>
  status === "paid" || status === "void" || status === "cancelled";

const collectionStatusLabel = (row: CollectionRow) => {
  if (row.status === "paid") return "paid";
  if (row.status === "void") return "void";
  if (row.status === "cancelled") return "cancelled";
  if (row.bucketId === "due_today") return "due today";
  if (String(row.bucketId).startsWith("overdue")) return "overdue";
  if (row.bucketId === "due_14_8" || row.bucketId === "due_7_1") return "due soon";
  return String(row.status || "open").replace(/_/g, " ");
};

const statusVariant = (row: CollectionRow) => {
  if (row.status === "paid") return "success";
  if (row.status === "void" || row.status === "cancelled" || row.bucketId.toString().startsWith("overdue")) return "danger";
  if (row.bucketId === "due_today" || row.bucketId === "due_7_1" || row.bucketId === "due_14_8") return "warning";
  return "neutral";
};

const buildVendorReminderMessage = (row: CollectionRow) => {
  const dueDate = dateLabel(row.dueDate);
  if (row.daysDelta !== null && row.daysDelta < 0) {
    return [
      `Hello ${row.vendorName}, invoice ${row.invoiceNumber} for ${money(row.amountDue)} is overdue since ${dueDate}.`,
      "",
      "Please arrange payment or send proof of payment for activation/payment confirmation.",
      "",
      "Powered by seiGEN Commerce",
    ].join("\n");
  }
  return [
    `Hello ${row.vendorName}, this is a reminder that invoice ${row.invoiceNumber} for ${money(row.amountDue)} is due on ${dueDate}.`,
    "",
    "Please arrange payment or send proof of payment for activation/payment confirmation.",
    "",
    "Powered by seiGEN Commerce",
  ].join("\n");
};

const buildCollectorMessage = (name: string, bucketLabel: string, rows: CollectionRow[]) => {
  const total = rows.reduce((sum, row) => sum + row.amountDue, 0);
  return [
    "Collections follow-up list",
    "",
    `Collector: ${name}`,
    `Ageing period: ${bucketLabel}`,
    "",
    ...rows.map(
      (row, index) =>
        `${index + 1}. ${row.vendorName} - Invoice ${row.invoiceNumber} - ${money(row.amountDue)} - Due ${dateLabel(row.dueDate)} - ${daysPhrase(row)}`,
    ),
    "",
    `Total collection value: ${money(total)}`,
    "",
    "Please follow up with vendors and update payment/POP status in the console.",
    "",
    "Powered by seiGEN Commerce",
  ].join("\n");
};

export const SubscriptionManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupMode, setGroupMode] = useState<GroupMode | null>(null);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    bucket: "active",
    rpnId: "all",
    staffId: "all",
    vendor: "",
    status: "active" as StatusFilter,
    planId: "all",
  });

  const loadData = async () => {
    const [nextVendors, nextPlans] = await Promise.all([
      vendorService.getVendors(),
      pricingPlanService.getPlans(),
    ]);
    setVendors(Array.isArray(nextVendors) ? nextVendors : []);
    setPlans(Array.isArray(nextPlans) ? nextPlans : []);
    setRpns(rpnService.getAll());
    setStaff(staffService.getAllStaff());
    setSubscriptions(subscriptionService.getAllSubscriptions());
    setInvoices(vendorBillingService.getInvoices());
  };

  useEffect(() => {
    void loadData();
  }, []);

  const vendorById = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const rpnById = useMemo(() => new Map(rpns.map((rpn) => [rpn.id, rpn])), [rpns]);
  const staffById = useMemo(() => new Map(staff.map((item) => [item.id, item])), [staff]);

  const rows = useMemo<CollectionRow[]>(() => {
    const invoiceRows = invoices.map((invoice) => {
      const vendor = vendorById.get(invoice.vendorId);
      const plan = invoice.planId ? planById.get(invoice.planId) : undefined;
      const rpnId = getVendorRpnId(vendor);
      const rpn = rpnId ? rpnById.get(rpnId) : undefined;
      const staffId = getVendorStaffId(vendor);
      const assignedStaff = staffId ? staffById.get(staffId) : undefined;
      const ageing = ageingBucketFor(invoice.dueDate);
      return {
        id: `invoice:${invoice.id}`,
        source: "invoice" as const,
        vendorId: invoice.vendorId,
        vendorName: invoice.vendorName || vendorDisplayName(vendor),
        vendorWhatsapp: cleanPhone(vendor?.whatsappNumber || vendor?.whatsapp || vendor?.mainPhone || vendor?.phone),
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate || invoice.issueDate || invoice.createdAt?.slice(0, 10) || "",
        dueDate: invoice.dueDate || "",
        daysDelta: ageing.daysDelta,
        bucketId: ageing.id,
        bucketLabel: bucketMeta[ageing.id].label,
        amountDue: Number(invoice.balanceDue || invoice.totalAmount || 0),
        status: invoice.status,
        planId: invoice.planId || undefined,
        planName: invoice.planName || plan?.name,
        rpnId,
        rpnName: rpn?.name || vendor?.rpnName || "No RPN assigned",
        rpnWhatsapp: cleanPhone(rpn?.whatsapp || rpn?.phone),
        staffId,
        staffName: staffDisplayName(assignedStaff, vendor?.assignedStaffName || vendor?.assignedMemberName || "No staff assigned"),
        staffWhatsapp: cleanPhone(assignedStaff?.whatsapp || assignedStaff?.phone),
        invoice,
      };
    });

    const activeInvoiceVendorIds = new Set(
      invoices.filter((invoice) => !isClosedInvoiceStatus(invoice.status)).map((invoice) => invoice.vendorId),
    );
    const subscriptionRows = subscriptions
      .filter((subscription) => !activeInvoiceVendorIds.has(subscription.vendorId))
      .map((subscription) => {
        const vendor = vendorById.get(subscription.vendorId);
        const plan = planById.get(subscription.planId || vendor?.planId || "");
        const rpnId = getVendorRpnId(vendor, subscription);
        const rpn = rpnId ? rpnById.get(rpnId) : undefined;
        const staffId = getVendorStaffId(vendor);
        const assignedStaff = staffId ? staffById.get(staffId) : undefined;
        const ageing = ageingBucketFor(subscription.dueDate || vendor?.subscriptionDueDate);
        return {
          id: `subscription:${subscription.id}`,
          source: "subscription" as const,
          vendorId: subscription.vendorId,
          vendorName: vendorDisplayName(vendor, subscription.vendorNameSnapshot),
          vendorWhatsapp: cleanPhone(vendor?.whatsappNumber || vendor?.whatsapp || vendor?.mainPhone || vendor?.phone),
          invoiceNumber: subscription.id,
          invoiceDate: subscription.startDate || subscription.createdAt?.slice(0, 10) || "",
          dueDate: subscription.dueDate || vendor?.subscriptionDueDate || "",
          daysDelta: ageing.daysDelta,
          bucketId: ageing.id,
          bucketLabel: bucketMeta[ageing.id].label,
          amountDue: Number(subscription.amountDue || plan?.monthlyPrice || vendor?.monthlyPlanValue || 0),
          status: subscription.status,
          planId: subscription.planId || vendor?.planId,
          planName: plan?.name || subscription.planId || vendor?.planId,
          rpnId,
          rpnName: rpn?.name || vendor?.rpnName || "No RPN assigned",
          rpnWhatsapp: cleanPhone(rpn?.whatsapp || rpn?.phone),
          staffId,
          staffName: staffDisplayName(assignedStaff, vendor?.assignedStaffName || vendor?.assignedMemberName || "No staff assigned"),
          staffWhatsapp: cleanPhone(assignedStaff?.whatsapp || assignedStaff?.phone),
          subscription,
        };
      });

    return [...invoiceRows, ...subscriptionRows].sort((a, b) => {
      const aTime = parseDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = parseDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [invoices, subscriptions, vendorById, planById, rpnById, staffById]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const isClosed = isClosedInvoiceStatus(String(row.status));
      const isActiveBucket = bucketMeta[row.bucketId].active;
      const status = String(row.status);
      const statusMatch =
        filters.status === "all" ||
        (filters.status === "active" && !isClosed && isActiveBucket) ||
        (filters.status === "due_soon" && (row.bucketId === "due_14_8" || row.bucketId === "due_7_1")) ||
        (filters.status === "due_today" && row.bucketId === "due_today") ||
        (filters.status === "overdue" && row.daysDelta !== null && row.daysDelta < 0) ||
        filters.status === status;

      return (
        statusMatch &&
        (filters.bucket === "active" ? isActiveBucket && !isClosed : filters.bucket === "all" || row.bucketId === filters.bucket) &&
        (filters.rpnId === "all" || row.rpnId === filters.rpnId) &&
        (filters.staffId === "all" || row.staffId === filters.staffId) &&
        (!filters.vendor || row.vendorName.toLowerCase().includes(filters.vendor.toLowerCase())) &&
        (filters.planId === "all" || row.planId === filters.planId)
      );
    });
  }, [rows, filters]);

  const activeRows = rows.filter((row) => bucketMeta[row.bucketId].active && !isClosedInvoiceStatus(String(row.status)));
  const selectedRows = filteredRows.filter((row) => selectedIds.includes(row.id));
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  const summaryByBucket = useMemo(() => {
    const activeBucketIds: AgeingBucketId[] = [
      "due_14_8",
      "due_7_1",
      "due_today",
      "overdue_1_7",
      "overdue_8_14",
      "overdue_15_30",
      "overdue_31_plus",
    ];
    return activeBucketIds.map((bucketId) => {
      const bucketRows = activeRows.filter((row) => row.bucketId === bucketId);
      return {
        bucketId,
        label: bucketMeta[bucketId].label,
        count: bucketRows.length,
        total: bucketRows.reduce((sum, row) => sum + row.amountDue, 0),
      };
    });
  }, [activeRows]);

  const totals = {
    activeCount: activeRows.length,
    activeAmount: activeRows.reduce((sum, row) => sum + row.amountDue, 0),
    overdueAmount: activeRows.filter((row) => row.daysDelta !== null && row.daysDelta < 0).reduce((sum, row) => sum + row.amountDue, 0),
    vendors: new Set(activeRows.map((row) => row.vendorId)).size,
  };

  const groupedMessages = useMemo<WhatsAppGroup[]>(() => {
    if (!groupMode || selectedRows.length === 0) return [];
    const grouped = new Map<string, CollectionRow[]>();
    selectedRows.forEach((row) => {
      const key = groupMode === "rpn" ? row.rpnId || "unassigned-rpn" : row.staffId || "unassigned-staff";
      grouped.set(key, [...(grouped.get(key) || []), row]);
    });
    const selectedBucketLabels = Array.from(new Set(selectedRows.map((row) => row.bucketLabel)));
    const ageingLabel = selectedBucketLabels.length === 1 ? selectedBucketLabels[0] : "Mixed";
    return Array.from(grouped.entries()).map(([id, groupRows]) => {
      const first = groupRows[0];
      const name = groupMode === "rpn" ? first.rpnName : first.staffName;
      const whatsapp = groupMode === "rpn" ? first.rpnWhatsapp : first.staffWhatsapp;
      const total = groupRows.reduce((sum, row) => sum + row.amountDue, 0);
      return {
        id,
        name,
        whatsapp,
        rows: groupRows,
        total,
        message: buildCollectorMessage(name, ageingLabel, groupRows),
      };
    });
  }, [groupMode, selectedRows]);

  const toggleRow = (rowId: string) => {
    setSelectedIds((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
    setGroupMode(null);
  };

  const toggleVisibleRows = () => {
    setSelectedIds(allVisibleSelected ? [] : filteredRows.map((row) => row.id));
    setGroupMode(null);
  };

  const notifyVendor = (row: CollectionRow) => {
    if (!row.vendorWhatsapp) {
      setMessage("Vendor WhatsApp number is missing.");
      return;
    }
    const reminderMessage = buildVendorReminderMessage(row);
    if (row.invoice) {
      const saved = vendorBillingService.recordCollectionReminder({
        invoiceId: row.invoice.id,
        channel: "whatsapp",
        message: reminderMessage,
      });
      if (saved) setInvoices(vendorBillingService.getInvoices());
    }
    window.open(`https://wa.me/${row.vendorWhatsapp}?text=${encodeURIComponent(reminderMessage)}`, "_blank", "noopener,noreferrer");
    setMessage(`WhatsApp reminder opened for ${row.vendorName}.`);
  };

  const downloadInvoice = (row: CollectionRow) => {
    if (!row.invoice) {
      setMessage("Invoice download is available once a vendor bill has been generated.");
      return;
    }
    const opened = printVendorInvoice(row.invoice, vendorById.get(row.vendorId));
    setMessage(opened ? `Invoice view opened for ${row.invoice.invoiceNumber}.` : "Popup blocked. Allow popups to download/print the invoice.");
  };

  const recordPayment = async (row: CollectionRow) => {
    if (!row.invoice) {
      setMessage("Record payment is available for generated vendor bills.");
      return;
    }
    const amountText = window.prompt(`Record payment for ${row.invoice.invoiceNumber}`, String(Math.round(row.amountDue)));
    if (amountText === null) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid payment amount.");
      return;
    }
    try {
      vendorBillingService.recordPayment({
        invoiceId: row.invoice.id,
        amount,
        paymentMethod: "manual",
        paymentDate: todayKey(),
        notes: "Recorded from Collections operations desk.",
      });
      setInvoices(vendorBillingService.getInvoices());
      setMessage(`Payment recorded for ${row.invoice.invoiceNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to record payment.");
    }
  };

  const openCollectorWhatsapp = (group: WhatsAppGroup) => {
    if (!group.whatsapp) {
      setMessage(`${group.name} WhatsApp number is missing.`);
      return;
    }
    window.open(`https://wa.me/${group.whatsapp}?text=${encodeURIComponent(group.message)}`, "_blank", "noopener,noreferrer");
    setMessage(`WhatsApp follow-up list opened for ${group.name}.`);
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Collections"
        subtitle="Vendor subscription and bill follow-up desk for RPN/staff collections coordination."
      />

      {message && (
        <div className="border-l-4 border-brand-orange bg-white p-4 text-sm font-semibold text-brand-charcoal shadow-sm">
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Active Collections" value={totals.activeCount} icon={Receipt} />
        <StatCard label="Active Value" value={money(totals.activeAmount)} icon={Wallet} variant="warning" />
        <StatCard label="Overdue Value" value={money(totals.overdueAmount)} icon={AlertTriangle} variant="danger" />
        <StatCard label="Vendors In Follow-up" value={totals.vendors} icon={Users} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {summaryByBucket.map((bucket) => (
          <DataPanel key={bucket.bucketId}>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, bucket: bucket.bucketId }))}
              className="block w-full p-4 text-left hover:bg-stone-50"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">{bucket.label}</p>
              <p className="mt-2 text-lg font-black text-brand-charcoal">{bucket.count} invoices</p>
              <p className="text-sm font-black text-brand-orange">{money(bucket.total)}</p>
            </button>
          </DataPanel>
        ))}
      </div>

      <DataPanel title="Collections filters">
        <div className="grid gap-3 p-4 md:grid-cols-6">
          <select value={filters.bucket} onChange={(event) => setFilters((prev) => ({ ...prev, bucket: event.target.value }))} className="border border-stone-300 bg-white px-3 py-2 text-xs font-bold">
            <option value="active">Active ageing buckets</option>
            <option value="all">All ageing buckets</option>
            {Object.entries(bucketMeta).map(([id, meta]) => (
              <option key={id} value={id}>{meta.label}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as StatusFilter }))} className="border border-stone-300 bg-white px-3 py-2 text-xs font-bold">
            <option value="active">Active</option>
            <option value="due_soon">Due soon</option>
            <option value="due_today">Due today</option>
            <option value="overdue">Overdue</option>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="void">Voided</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={filters.rpnId} onChange={(event) => setFilters((prev) => ({ ...prev, rpnId: event.target.value }))} className="border border-stone-300 bg-white px-3 py-2 text-xs font-bold">
            <option value="all">All RPNs</option>
            {rpns.map((rpn) => <option key={rpn.id} value={rpn.id}>{rpn.name}</option>)}
          </select>
          <select value={filters.staffId} onChange={(event) => setFilters((prev) => ({ ...prev, staffId: event.target.value }))} className="border border-stone-300 bg-white px-3 py-2 text-xs font-bold">
            <option value="all">All staff</option>
            {staff.map((item) => <option key={item.id} value={item.id}>{staffDisplayName(item)}</option>)}
          </select>
          <select value={filters.planId} onChange={(event) => setFilters((prev) => ({ ...prev, planId: event.target.value }))} className="border border-stone-300 bg-white px-3 py-2 text-xs font-bold">
            <option value="all">All plans</option>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
          <input value={filters.vendor} onChange={(event) => setFilters((prev) => ({ ...prev, vendor: event.target.value }))} placeholder="Search vendor" className="border border-stone-300 px-3 py-2 text-xs font-bold" />
        </div>
      </DataPanel>

      <DataPanel title="Bulk follow-up">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SecondaryButton onClick={toggleVisibleRows} disabled={filteredRows.length === 0}>
            {allVisibleSelected ? "Clear selection" : "Select visible"}
          </SecondaryButton>
          <PrimaryButton onClick={() => setGroupMode("rpn")} disabled={selectedRows.length === 0}>
            <Send size={14} className="mr-2" /> Send selected to assigned RPNs
          </PrimaryButton>
          <PrimaryButton onClick={() => setGroupMode("staff")} disabled={selectedRows.length === 0}>
            <Users size={14} className="mr-2" /> Send selected to assigned staff
          </PrimaryButton>
          <span className="text-xs font-bold uppercase text-stone-500">{selectedRows.length} selected</span>
        </div>
        {groupedMessages.length > 0 && (
          <div className="grid gap-3 border-t border-stone-100 p-4 md:grid-cols-2 xl:grid-cols-3">
            {groupedMessages.map((group) => (
              <div key={group.id} className="border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-black uppercase text-brand-charcoal">{group.name}</p>
                <p className="mt-1 text-[11px] font-semibold text-stone-500">{group.rows.length} invoices / {money(group.total)}</p>
                <p className="mt-1 text-[11px] text-stone-500">{group.whatsapp || "WhatsApp number missing"}</p>
                <button type="button" onClick={() => openCollectorWhatsapp(group)} className="mt-3 inline-flex items-center gap-2 bg-brand-charcoal px-3 py-2 text-[10px] font-black uppercase text-white">
                  <MessageCircle size={13} /> Open WhatsApp
                </button>
              </div>
            ))}
          </div>
        )}
      </DataPanel>

      <DataPanel title="Active collections list">
        {filteredRows.length === 0 ? (
          <div className="p-12">
            <EmptyState title="No Collections" description="No vendor bills or subscriptions match the selected filters." icon={Wallet} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[9px] uppercase tracking-widest text-stone-500">
                  <th className="px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleRows} /></th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Collector</th>
                  <th className="px-4 py-3">Invoice/subscription</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Ageing</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50">
                    <td className="px-4 py-4 align-top">
                      <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-xs font-black uppercase text-brand-charcoal">{row.vendorName}</p>
                      <p className="mt-1 text-[10px] font-mono text-stone-500">{row.vendorWhatsapp || "Vendor WhatsApp number is missing."}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-xs">
                      <p className="font-bold text-stone-700">RPN: {row.rpnName}</p>
                      <p className="mt-1 text-stone-500">Staff: {row.staffName}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-xs font-black text-brand-charcoal">{row.invoiceNumber}</p>
                      <p className="mt-1 text-[10px] uppercase text-stone-500">{row.source} / {row.planName || "No plan"}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-stone-600">
                      <p>Invoice: {dateLabel(row.invoiceDate)}</p>
                      <p className="mt-1 font-bold">Due: {dateLabel(row.dueDate)}</p>
                      <p className={`mt-1 text-[10px] font-black uppercase ${row.daysDelta !== null && row.daysDelta < 0 ? "text-red-700" : "text-brand-orange"}`}>{daysPhrase(row)}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-right font-mono text-xs font-black text-brand-charcoal">{money(row.amountDue)}</td>
                    <td className="px-4 py-4 align-top text-xs font-bold text-stone-700">
                      <CalendarClock size={14} className="mb-1 text-brand-orange" />
                      {row.bucketLabel}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge status={collectionStatusLabel(row)} variant={statusVariant(row)} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => notifyVendor(row)} className="inline-flex items-center gap-1 border border-brand-orange px-2 py-1 text-[10px] font-black uppercase text-brand-orange">
                          <MessageCircle size={12} /> Notify vendor
                        </button>
                        <button type="button" onClick={() => downloadInvoice(row)} className="inline-flex items-center gap-1 border border-stone-300 px-2 py-1 text-[10px] font-black uppercase text-stone-700">
                          <Download size={12} /> Download invoice
                        </button>
                        <button type="button" onClick={() => recordPayment(row)} disabled={!row.invoice || isClosedInvoiceStatus(String(row.status))} className="inline-flex items-center gap-1 border border-stone-300 px-2 py-1 text-[10px] font-black uppercase text-stone-700 disabled:opacity-40">
                          <CheckCircle2 size={12} /> Mark paid
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </div>
  );
};

export default SubscriptionManagement;
