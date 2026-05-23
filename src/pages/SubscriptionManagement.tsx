/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  DataPanel,
  TablePanel,
  StatusBadge,
  EmptyState,
  PrimaryButton,
} from "../components/CommonUI.tsx";
import {
  AlertTriangle,
  Calendar,
  Download,
  FileText,
  Receipt,
  RefreshCw,
  Send,
  Wallet,
  Loader2,
} from "lucide-react";
import { vendorService } from "../services/vendorService.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { pdfService } from "../services/pdfService.ts";
import { rpnService } from "../services/rpnService.ts";
import { subscriptionService } from "../services/subscriptionService.ts";
import { permissionService } from "../services/permissionService.ts";
import {
  CollectionMethod,
  PricingPlan,
  RPN,
  Subscription,
  Vendor,
  VendorSubscriptionPayment,
} from "../types.ts";
import { asArray } from "../utils/safeData.ts";

type PaymentStatusFilter =
  | "all"
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue"
  | "waived"
  | "cancelled";

type CollectionRow = {
  vendor: Vendor;
  plan?: PricingPlan;
  rpn?: RPN;
  latestPayment?: VendorSubscriptionPayment;
  amountDue: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string;
  overdueDays: number;
  paymentStatus: VendorSubscriptionPayment["paymentStatus"];
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const dateInPeriod = (dateValue: string, period: string) => {
  if (!dateValue || period === "lifetime") return true;
  const date = new Date(dateValue);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return true;
  if (period === "today") return date.toDateString() === now.toDateString();
  if (period === "this-week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }
  if (period === "this-month") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }
  if (period === "this-year") {
    return date.getFullYear() === now.getFullYear();
  }
  return true;
};

const getVendorRpnId = (vendor: Vendor) =>
  vendor.rpnId ||
  vendor.assignedRPNId ||
  vendor.assignedStaffId ||
  vendor.onboardedByStaffId ||
  "";

const paymentStatusFromRow = (
  vendor: Vendor,
  latestPayment: VendorSubscriptionPayment | undefined,
  amountDue: number,
): VendorSubscriptionPayment["paymentStatus"] => {
  if (latestPayment?.paymentStatus) return latestPayment.paymentStatus;
  if (vendor.subscriptionStatus === "paid" || vendor.subscriptionStatus === "active") {
    return "paid";
  }
  if (vendor.subscriptionStatus === "overdue") return "overdue";
  if (vendor.subscriptionStatus === "cancelled") return "cancelled";
  if (amountDue <= 0) return "unpaid";
  return "unpaid";
};

const statusVariant = (status: string) => {
  if (status === "paid") return "success";
  if (status === "overdue" || status === "cancelled") return "error";
  if (status === "partial" || status === "unpaid") return "warning";
  return "neutral";
};

export const SubscriptionManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [payments, setPayments] = useState<VendorSubscriptionPayment[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [periodFilter, setPeriodFilter] = useState("lifetime");
  const [vendorFilter, setVendorFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>("all");
  const [rpnFilter, setRpnFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<CollectionMethod>("manual");
  const [paymentReference, setPaymentReference] = useState("");
  const [message, setMessage] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);

  const canRecordPayment = permissionService.hasActionPermission(
    "subscriptions.recordPayment",
  );
  const canWaive = permissionService.hasActionPermission("subscriptions.waive");
  const canPostFinance = permissionService.hasActionPermission(
    "subscriptions.postToFinance",
  );
  const canGenerateCommission = permissionService.hasActionPermission(
    "subscriptions.generateRpnCommission",
  );

  const loadData = async () => {
    setIsLoadingData(true);
    const startMs = performance.now();
    try {
      const rawVendors = await Promise.resolve(vendorService.getVendors());
      void vendorService.evaluateSubscriptionRpnAlerts();
      void subscriptionService.generateOverdueAlerts();
      const rawPlans = await Promise.resolve(pricingPlanService.getPlans());
      const rawRpns = await Promise.resolve(rpnService.getAll());
      setVendors(asArray<Vendor>(rawVendors));
      setPlans(asArray<PricingPlan>(rawPlans));
      setRpns(asArray<RPN>(rawRpns));
      setPayments(subscriptionService.getAllPayments());
    } catch (error) {
      console.error("Failed to load collections data", error);
      setMessage("Failed to load collections data.");
    } finally {
      setIsLoadingData(false);
      console.info("Data load completed", {
        page: "SubscriptionManagement",
        elapsedMs: Math.round(performance.now() - startMs)
      });
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const rows = useMemo<CollectionRow[]>(() => {
    return vendors
      .filter(
        (vendor) =>
          vendor.subscriptionStatus === "due" ||
          vendor.subscriptionStatus === "overdue" ||
          vendor.subscriptionStatus === "active" ||
          vendor.subscriptionStatus === "paid" ||
          vendor.subscriptionStatus === "suspended",
      )
      .map((vendor) => {
        const plan = plans.find((item) => item.id === vendor.planId);
        const rpnId = getVendorRpnId(vendor);
        const rpn = rpns.find((item) => item.id === rpnId);
        const vendorPayments = payments
          .filter((payment) => payment.vendorId === vendor.id)
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
        const latestPayment = vendorPayments[0];
        const amountDue = latestPayment?.amountDue ?? plan?.monthlyPrice ?? 0;
        const amountPaid = latestPayment?.amountPaid ?? 0;
        const balanceDue = latestPayment?.balanceDue ?? Math.max(amountDue - amountPaid, 0);
        const dueDate = latestPayment?.dueDate || vendor.subscriptionDueDate || "";
        const dueTime = dueDate ? new Date(dueDate).getTime() : NaN;
        const overdueDays = Number.isNaN(dueTime)
          ? 0
          : Math.max(
              Math.floor((Date.now() - dueTime) / (24 * 60 * 60 * 1000)),
              0,
            );
        return {
          vendor,
          plan,
          rpn,
          latestPayment,
          amountDue,
          amountPaid,
          balanceDue,
          dueDate,
          overdueDays,
          paymentStatus: paymentStatusFromRow(vendor, latestPayment, amountDue),
        };
      });
  }, [vendors, plans, rpns, payments]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      return (
        (!vendorFilter ||
          row.vendor.name.toLowerCase().includes(vendorFilter.toLowerCase())) &&
        (planFilter === "all" || row.vendor.planId === planFilter) &&
        (statusFilter === "all" || row.paymentStatus === statusFilter) &&
        (rpnFilter === "all" || getVendorRpnId(row.vendor) === rpnFilter) &&
        (!overdueOnly || row.overdueDays > 0 || row.paymentStatus === "overdue") &&
        dateInPeriod(row.dueDate || row.latestPayment?.paymentDate || "", periodFilter)
      );
    });
  }, [rows, vendorFilter, planFilter, statusFilter, rpnFilter, overdueOnly, periodFilter]);

  const selectedRow = rows.find((row) => row.vendor.id === selectedVendorId);

  const totals = filteredRows.reduce(
    (acc, row) => {
      acc.amountDue += row.amountDue;
      acc.amountPaid += row.amountPaid;
      acc.balanceDue += row.balanceDue;
      if (row.overdueDays > 0 || row.paymentStatus === "overdue") acc.overdue += 1;
      return acc;
    },
    { amountDue: 0, amountPaid: 0, balanceDue: 0, overdue: 0 },
  );

  const handleExportPDF = () => {
    const subs: Subscription[] = filteredRows.map((row) => ({
      id: row.latestPayment?.id || row.vendor.id,
      vendorId: row.vendor.id,
      vendorNameSnapshot: row.vendor.name,
      assignedRPNId: getVendorRpnId(row.vendor),
      planId: row.vendor.planId,
      amountDue: row.amountDue,
      currency: row.plan?.currency || row.latestPayment?.currency || "USD",
      billingPeriod: "monthly",
      startDate: row.latestPayment?.billingPeriodStart || row.vendor.subscriptionStartDate || "",
      dueDate: row.dueDate,
      gracePeriodDays: 7,
      status: row.vendor.subscriptionStatus,
      followUpStatus: "not started",
      createdBy: "system",
      updatedBy: "system",
      createdAt: row.vendor.createdAt,
      updatedAt: row.vendor.updatedAt,
    }));

    pdfService.generateSubscriptionReport(
      { type: "statement", title: "Collections Report" },
      { subs, collections: [], vendors, plans, rpns },
    );
  };

  const handleRecordPayment = async () => {
    if (!selectedRow) {
      setMessage("Select a vendor first.");
      return;
    }
    const paid = Number(amountPaid || selectedRow.balanceDue || selectedRow.amountDue);
    if (!Number.isFinite(paid) || paid <= 0) {
      setMessage("Enter a valid amount paid.");
      return;
    }
    const rpnId = getVendorRpnId(selectedRow.vendor);
    const periodStart =
      selectedRow.latestPayment?.billingPeriodStart ||
      selectedRow.vendor.subscriptionStartDate ||
      todayKey();
    const periodEnd = selectedRow.dueDate || todayKey();

    try {
      const saved = await subscriptionService.recordSubscriptionPayment(
        {
          id: "",
          vendorId: selectedRow.vendor.id,
          vendorName: selectedRow.vendor.name,
          rpnId: rpnId || undefined,
          rpnName: selectedRow.rpn?.name || selectedRow.vendor.rpnName,
          planId: selectedRow.vendor.planId,
          planName: selectedRow.plan?.name || selectedRow.vendor.planId,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          dueDate: selectedRow.dueDate || todayKey(),
          amountDue: selectedRow.amountDue,
          amountPaid: paid,
          balanceDue: Math.max(selectedRow.amountDue - paid, 0),
          currency: selectedRow.plan?.currency || "USD",
          paymentStatus:
            paid >= selectedRow.amountDue
              ? "paid"
              : paid > 0
                ? "partial"
                : "unpaid",
          paymentDate: todayKey(),
          paymentMethod,
          paymentReference,
          createdAt: "",
          updatedAt: "",
        },
        {
          postToFinance: canPostFinance,
          generateRpnCommission: canGenerateCommission,
        },
      );
      setMessage(
        `Payment saved. Receipt ${saved.receiptNumber || "pending"}${
          saved.financeTransactionId
            ? " and posted to finance ledger."
            : ". Finance posting pending until Cash/Bank Ledger is configured."
        }${!rpnId ? " No RPN assigned to this vendor." : ""}`,
      );
      setAmountPaid("");
      setPaymentReference("");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment save failed.");
    }
  };

  const handleWaive = async (paymentId?: string) => {
    if (!paymentId) {
      setMessage("No payment record selected to waive.");
      return;
    }
    try {
      subscriptionService.markPaymentWaived(paymentId);
      setMessage("Payment balance waived.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Waive action failed.");
    }
  };

  const handleSendFollowUp = async (row: CollectionRow) => {
    setMessage(
      `Follow-up noted for ${row.vendor.name}. Notification routing is active through overdue alerts.`,
    );
  };

  const renderTableRows = (data: CollectionRow[]) => {
    return data.map((row) => (
      <tr key={row.vendor.id} className="hover:bg-stone-50">
        <td className="px-4 py-4">
          <p className="font-bold text-xs uppercase text-brand-charcoal">
            {row.vendor.name}
          </p>
          <p className="text-[10px] text-stone-500 font-mono">
            {row.vendor.systemCode}
          </p>
        </td>
        <td className="px-4 py-4 text-xs font-bold uppercase">
          {row.plan?.name || row.vendor.planId || "No plan"}
        </td>
        <td className="px-4 py-4 text-xs">{row.rpn?.name || "No RPN assigned"}</td>
        <td className="px-4 py-4 font-mono text-xs">
          {row.plan?.currency || row.latestPayment?.currency || "USD"}{" "}
          {row.amountDue.toFixed(2)}
        </td>
        <td className="px-4 py-4 font-mono text-xs">
          {row.amountPaid.toFixed(2)}
        </td>
        <td className="px-4 py-4 font-mono text-xs font-bold">
          {row.balanceDue.toFixed(2)}
        </td>
        <td className="px-4 py-4 text-xs">
          {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "N/A"}
          {row.overdueDays > 0 && (
            <span className="ml-2 text-[10px] font-bold text-red-600">
              {row.overdueDays}d overdue
            </span>
          )}
        </td>
        <td className="px-4 py-4">
          <StatusBadge
            status={row.paymentStatus}
            variant={statusVariant(row.paymentStatus)}
          />
        </td>
        <td className="px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedVendorId(row.vendor.id);
                setAmountPaid(String(row.balanceDue || row.amountDue));
              }}
              disabled={!canRecordPayment}
              className="border border-brand-orange px-2 py-1 text-[10px] font-bold uppercase text-brand-orange disabled:opacity-40"
            >
              Record Payment
            </button>
            <button
              type="button"
              onClick={() => handleSendFollowUp(row)}
              className="border border-stone-300 px-2 py-1 text-[10px] font-bold uppercase text-stone-700"
            >
              Follow-up
            </button>
            <button
              type="button"
              onClick={() => handleWaive(row.latestPayment?.id)}
              disabled={!canWaive || !row.latestPayment}
              className="border border-stone-300 px-2 py-1 text-[10px] font-bold uppercase text-stone-700 disabled:opacity-40"
            >
              Waive
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  if (isLoadingData) {
    return (
      <div className="pb-20 min-w-0 max-w-full flex items-center justify-center pt-20">
        <div className="text-center text-stone-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest">Loading Subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Collections & Subscriptions"
        subtitle="Manage vendor subscriptions, record collections, issue receipt references, and feed finance/RPN commission ledgers."
        actions={
          <PrimaryButton
            onClick={handleExportPDF}
            disabled={filteredRows.length === 0}
          >
            <Download size={14} className="mr-2" /> Export Report
          </PrimaryButton>
        }
      />

      {message && (
        <div className="mb-4 border-l-4 border-brand-orange bg-white p-4 text-sm font-semibold text-brand-charcoal shadow-sm">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Amount Due", totals.amountDue],
          ["Amount Paid", totals.amountPaid],
          ["Balance", totals.balanceDue],
          ["Overdue Accounts", totals.overdue],
        ].map(([label, value]) => (
          <DataPanel key={label as string}>
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-black text-brand-charcoal">
                {typeof value === "number" && label !== "Overdue Accounts"
                  ? value.toFixed(2)
                  : value}
              </p>
            </div>
          </DataPanel>
        ))}
      </div>

      <DataPanel className="mt-6">
        <div className="grid gap-3 p-4 md:grid-cols-6">
          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
            className="border border-stone-300 bg-white px-3 py-2 text-xs"
          >
            <option value="lifetime">Lifetime</option>
            <option value="today">Today</option>
            <option value="this-week">This Week</option>
            <option value="this-month">This Month</option>
            <option value="this-year">This Year</option>
          </select>
          <input
            value={vendorFilter}
            onChange={(event) => setVendorFilter(event.target.value)}
            placeholder="Vendor"
            className="border border-stone-300 px-3 py-2 text-xs"
          />
          <select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
            className="border border-stone-300 bg-white px-3 py-2 text-xs"
          >
            <option value="all">All plans</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as PaymentStatusFilter)
            }
            className="border border-stone-300 bg-white px-3 py-2 text-xs"
          >
            <option value="all">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="waived">Waived</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={rpnFilter}
            onChange={(event) => setRpnFilter(event.target.value)}
            className="border border-stone-300 bg-white px-3 py-2 text-xs"
          >
            <option value="all">All RPNs</option>
            {rpns.map((rpn) => (
              <option key={rpn.id} value={rpn.id}>
                {rpn.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 border border-stone-300 px-3 py-2 text-xs font-bold uppercase">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => setOverdueOnly(event.target.checked)}
            />
            Overdue only
          </label>
        </div>
      </DataPanel>

      <DataPanel className="mt-6">
        <div className="grid gap-4 p-4 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Receipt size={18} className="text-brand-orange" />
              <h3 className="text-sm font-black uppercase text-brand-charcoal">
                Record Payment
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={selectedVendorId}
                onChange={(event) => {
                  setSelectedVendorId(event.target.value);
                  const row = rows.find(
                    (item) => item.vendor.id === event.target.value,
                  );
                  setAmountPaid(row ? String(row.balanceDue || row.amountDue) : "");
                }}
                className="border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select vendor</option>
                {rows.map((row) => (
                  <option key={row.vendor.id} value={row.vendor.id}>
                    {row.vendor.name}
                  </option>
                ))}
              </select>
              <input
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                placeholder="Amount paid"
                className="border border-stone-300 px-3 py-2 text-sm"
              />
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as CollectionMethod)
                }
                className="border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="EcoCash">EcoCash</option>
                <option value="InnBucks">InnBucks</option>
                <option value="Mukuru">Mukuru</option>
                <option value="bank transfer">Bank transfer</option>
                <option value="manual">Manual</option>
                <option value="other">Other</option>
              </select>
              <input
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                placeholder="Reference"
                className="border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleRecordPayment}
              disabled={!canRecordPayment}
              className="mt-3 flex items-center gap-2 bg-brand-orange px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-40"
            >
              <Wallet size={14} /> Record Payment
            </button>
          </div>
          <div className="border-l border-stone-200 pl-4 text-xs text-stone-600">
            <p className="font-black uppercase text-brand-charcoal">
              Finance connection
            </p>
            <p className="mt-2">
              Paid records generate a receipt number and can post a receipt to
              Cash/Bank Ledger when a cash/bank account and Subscription Revenue
              COA exist.
            </p>
            <p className="mt-2">
              If the vendor has an assigned RPN, paid records can generate a
              recurring commission in RPN Payments Ledger.
            </p>
          </div>
        </div>
      </DataPanel>

      {filteredRows.length === 0 ? (
        <DataPanel className="mt-6">
          <div className="p-12">
            <EmptyState
              title="No Collections"
              description="No subscription collection records match the selected filters."
              icon={Wallet}
            />
          </div>
        </DataPanel>
      ) : (
        <div className="mt-6 space-y-8">
          {totals.overdue > 0 && (
            <div className="flex items-center gap-2 border-l-4 border-red-600 bg-white p-4 text-sm font-semibold text-red-700">
              <AlertTriangle size={16} />
              {totals.overdue} overdue account(s) require follow-up.
            </div>
          )}
          <TablePanel
            title="Subscription Collections"
            subtitle="Payment records, balances, due dates, RPN linkage and collection actions"
            headers={[
              "Vendor",
              "Plan",
              "RPN",
              "Amount Due",
              "Paid",
              "Balance",
              "Due Date",
              "Status",
              "Actions",
            ]}
          >
            {renderTableRows(filteredRows)}
          </TablePanel>
          <div className="grid gap-4 md:grid-cols-3">
            <DataPanel>
              <div className="p-4">
                <FileText className="mb-2 text-brand-orange" size={20} />
                <p className="text-xs font-black uppercase text-brand-charcoal">
                  Receipt Numbering
                </p>
                <p className="mt-2 text-xs text-stone-600">
                  Receipts use SCI-RCT-YYYYMM-0001 format when payment is
                  recorded.
                </p>
              </div>
            </DataPanel>
            <DataPanel>
              <div className="p-4">
                <RefreshCw className="mb-2 text-brand-orange" size={20} />
                <p className="text-xs font-black uppercase text-brand-charcoal">
                  Ledger Posting
                </p>
                <p className="mt-2 text-xs text-stone-600">
                  Debit cash/bank and credit Subscription Revenue when finance
                  setup is available.
                </p>
              </div>
            </DataPanel>
            <DataPanel>
              <div className="p-4">
                <Send className="mb-2 text-brand-orange" size={20} />
                <p className="text-xs font-black uppercase text-brand-charcoal">
                  RPN Commission
                </p>
                <p className="mt-2 text-xs text-stone-600">
                  Paid subscriptions feed recurring commission entries where RPN
                  assignment exists.
                </p>
              </div>
            </DataPanel>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement;
