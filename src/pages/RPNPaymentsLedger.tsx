/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { RPNPaymentLedgerEntry } from "../types.ts";
import { permissionService } from "../services/permissionService.ts";
import { rpnPaymentService } from "../services/rpnPaymentService.ts";
import { rpnService } from "../services/rpnService.ts";

type Tab =
  | "summary"
  | "generate"
  | "ledger"
  | "rpn-summary"
  | "approval-payout";

const inputClass =
  "w-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-brand-orange";
const labelClass =
  "text-[10px] font-black uppercase tracking-widest text-stone-400";

const formatMoney = (value: number, currency = "USD") =>
  `${currency} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;

const getSession = () => {
  try {
    const raw = localStorage.getItem("activeStaffSession");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const periodRange = (preset: string) => {
  const now = new Date();
  const start = new Date(now);
  if (preset === "today") return { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  if (preset === "this-week") {
    start.setDate(now.getDate() - now.getDay());
    return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (preset === "this-month") {
    start.setDate(1);
    return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (preset === "this-year") {
    start.setMonth(0, 1);
    return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  return { from: "", to: "" };
};

const RPNPaymentsLedger: React.FC = () => {
  const [tab, setTab] = useState<Tab>("summary");
  const [entries, setEntries] = useState<RPNPaymentLedgerEntry[]>(() =>
    rpnPaymentService.getLedgerEntries(),
  );
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    rpnId: "",
    vendor: "",
    status: "",
    sourceType: "",
    dateFrom: "",
    dateTo: "",
    periodPreset: "lifetime",
  });
  const [actionReason, setActionReason] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const rpns = useMemo(() => rpnService.getAll(), []);
  const session = getSession();
  const canView =
    permissionService.hasActionPermission("finance.rpnPayments.view") ||
    permissionService.hasMenuAccess("rpnPaymentsLedger");
  const canGenerate = permissionService.hasActionPermission(
    "finance.rpnPayments.generate",
  );
  const canApprove = permissionService.hasActionPermission(
    "finance.rpnPayments.approve",
  );
  const canPay = permissionService.hasActionPermission("finance.rpnPayments.pay");

  const refresh = () => setEntries(rpnPaymentService.getLedgerEntries());

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const dueDate = entry.dueDate.slice(0, 10);
      return (
        (!filters.rpnId || entry.rpnId === filters.rpnId) &&
        (!filters.vendor ||
          entry.vendorName.toLowerCase().includes(filters.vendor.toLowerCase())) &&
        (!filters.status || entry.status === filters.status) &&
        (!filters.sourceType || entry.sourceType === filters.sourceType) &&
        (!filters.dateFrom || dueDate >= filters.dateFrom) &&
        (!filters.dateTo || dueDate <= filters.dateTo)
      );
    });
  }, [entries, filters]);

  const summary = useMemo(() => {
    const total = (status?: RPNPaymentLedgerEntry["status"]) =>
      filteredEntries
        .filter((entry) => !status || entry.status === status)
        .reduce((sum, entry) => sum + entry.balanceDue, 0);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeekDue = filteredEntries
      .filter((entry) => new Date(entry.dueDate) >= weekStart)
      .reduce((sum, entry) => sum + entry.balanceDue, 0);
    const thisMonthDue = filteredEntries
      .filter((entry) => new Date(entry.dueDate) >= monthStart)
      .reduce((sum, entry) => sum + entry.balanceDue, 0);
    const byRpn = rpnPaymentService.getSummaryByRpn({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    return {
      totalDue: total("due"),
      pending: total("pending_approval"),
      approved: total("approved"),
      paid: filteredEntries
        .filter((entry) => entry.status === "paid")
        .reduce((sum, entry) => sum + entry.commissionAmountPaid, 0),
      held: total("held"),
      thisWeekDue,
      thisMonthDue,
      lifetimeDue: entries.reduce((sum, entry) => sum + entry.commissionAmountDue, 0),
      topRpn: byRpn[0]?.rpnName || "-",
    };
  }, [entries, filteredEntries, filters.dateFrom, filters.dateTo]);

  const applyPreset = (preset: string) => {
    const range = periodRange(preset);
    setFilters((prev) => ({
      ...prev,
      periodPreset: preset,
      dateFrom: range.from,
      dateTo: range.to,
    }));
  };

  const handleGenerate = async () => {
    try {
      const generated = await rpnPaymentService.generateDueCommissions();
      refresh();
      setMessage(
        generated.length
          ? `${generated.length} commission entries generated.`
          : "No paid vendor subscription records found.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate commissions.");
    }
  };

  const runAction = async (
    action: "approval" | "approve" | "paid" | "hold" | "reject",
    entry: RPNPaymentLedgerEntry,
  ) => {
    try {
      if (action === "approval") {
        await rpnPaymentService.markEntryPendingApproval(entry.id);
      } else if (action === "approve") {
        await rpnPaymentService.approveEntry(entry.id, session);
      } else if (action === "paid") {
        await rpnPaymentService.markEntryPaid(
          entry.id,
          session,
          paymentReference || undefined,
        );
      } else if (action === "hold") {
        await rpnPaymentService.holdEntry(entry.id, actionReason || "Held for review.");
      } else if (action === "reject") {
        await rpnPaymentService.rejectEntry(entry.id, actionReason || "Rejected.");
      }
      refresh();
      setMessage("Saved successfully");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  };

  if (!canView) {
    return (
      <div className="p-6">
        <div className="bg-white border border-red-200 p-6 text-sm font-bold text-red-700">
          You do not have permission to view RPN payments.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <section className="bg-white border border-stone-200 p-5 md:p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-brand-orange">
          SCI / iTred Finance
        </p>
        <h1 className="text-2xl font-black text-brand-charcoal mt-2">
          RPN Payments Ledger
        </h1>
        <p className="text-sm text-stone-600 mt-3 max-w-4xl">
          Calculates due RPN onboarding and recurring subscription commissions
          from paid vendor collection records.
        </p>
      </section>

      {message && (
        <div className="border-l-4 border-brand-orange bg-orange-50 p-4 text-xs font-bold uppercase tracking-wide text-orange-800">
          {message}
        </div>
      )}

      <nav className="grid grid-cols-2 lg:grid-cols-5 border border-stone-200 bg-white">
        {[
          ["summary", "Summary"],
          ["generate", "Generate Due Commissions"],
          ["ledger", "Ledger Entries"],
          ["rpn-summary", "RPN Summary"],
          ["approval-payout", "Approval / Payout Control"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as Tab)}
            className={`px-3 py-3 text-[10px] font-black uppercase tracking-widest border-b lg:border-b-0 lg:border-r last:border-r-0 border-stone-200 ${
              tab === id
                ? "bg-brand-charcoal text-white"
                : "bg-white text-stone-500 hover:text-brand-orange"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <label className="space-y-1">
          <span className={labelClass}>RPN</span>
          <select
            className={inputClass}
            value={filters.rpnId}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, rpnId: event.target.value }))
            }
          >
            <option value="">All RPNs</option>
            {rpns.map((rpn) => (
              <option key={rpn.id} value={rpn.id}>
                {rpn.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Period</span>
          <select
            className={inputClass}
            value={filters.periodPreset}
            onChange={(event) => applyPreset(event.target.value)}
          >
            <option value="today">Today</option>
            <option value="this-week">This Week</option>
            <option value="this-month">This Month</option>
            <option value="this-year">This Year</option>
            <option value="lifetime">Lifetime</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Date From</span>
          <input
            type="date"
            className={inputClass}
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
            }
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Date To</span>
          <input
            type="date"
            className={inputClass}
            value={filters.dateTo}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
            }
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Status</span>
          <select
            className={inputClass}
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          >
            <option value="">All</option>
            {["due", "pending_approval", "approved", "paid", "held", "rejected", "void"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Vendor</span>
          <input
            className={inputClass}
            value={filters.vendor}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, vendor: event.target.value }))
            }
          />
        </label>
      </section>

      {tab === "summary" && (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            ["Total Due", formatMoney(summary.totalDue)],
            ["Pending Approval", formatMoney(summary.pending)],
            ["Approved", formatMoney(summary.approved)],
            ["Paid", formatMoney(summary.paid)],
            ["Held", formatMoney(summary.held)],
            ["This Week Due", formatMoney(summary.thisWeekDue)],
            ["This Month Due", formatMoney(summary.thisMonthDue)],
            ["Lifetime Due", formatMoney(summary.lifetimeDue)],
            ["Top RPN by Due", summary.topRpn],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border-2 border-stone-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</p>
              <p className="text-2xl font-black text-brand-charcoal mt-3">{value}</p>
            </div>
          ))}
        </section>
      )}

      {tab === "generate" && (
        <section className="bg-white border border-stone-200 p-5 space-y-4">
          <h2 className="text-sm font-black uppercase text-brand-charcoal">
            Generate Due Commissions
          </h2>
          <p className="text-sm text-stone-600">
            This scans approved collection records and paid subscription records.
            It does not invent commissions when paid vendor payment data is
            missing.
          </p>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={handleGenerate}
            className="bg-brand-orange px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
          >
            Generate Due Commissions
          </button>
        </section>
      )}

      {(tab === "ledger" || tab === "approval-payout") && (
        <LedgerTable
          entries={filteredEntries}
          canApprove={canApprove}
          canPay={canPay}
          canGenerate={canGenerate}
          actionReason={actionReason}
          paymentReference={paymentReference}
          setActionReason={setActionReason}
          setPaymentReference={setPaymentReference}
          runAction={runAction}
        />
      )}

      {tab === "rpn-summary" && (
        <section className="bg-white border border-stone-200 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-widest text-stone-400">
              <tr>
                <th className="px-4 py-3">RPN</th>
                <th className="px-4 py-3">Entries</th>
                <th className="px-4 py-3">Total Due</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rpnPaymentService
                .getSummaryByRpn({ dateFrom: filters.dateFrom, dateTo: filters.dateTo })
                .map((row) => (
                  <tr key={row.rpnId}>
                    <td className="px-4 py-3 font-bold text-brand-charcoal">{row.rpnName}</td>
                    <td className="px-4 py-3">{row.entryCount}</td>
                    <td className="px-4 py-3 font-mono">{formatMoney(row.totalDue)}</td>
                    <td className="px-4 py-3 font-mono">{formatMoney(row.totalPaid)}</td>
                    <td className="px-4 py-3 font-mono font-bold">{formatMoney(row.balanceDue)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

const LedgerTable: React.FC<{
  entries: RPNPaymentLedgerEntry[];
  canApprove: boolean;
  canPay: boolean;
  canGenerate: boolean;
  actionReason: string;
  paymentReference: string;
  setActionReason: (value: string) => void;
  setPaymentReference: (value: string) => void;
  runAction: (
    action: "approval" | "approve" | "paid" | "hold" | "reject",
    entry: RPNPaymentLedgerEntry,
  ) => void;
}> = ({
  entries,
  canApprove,
  canPay,
  canGenerate,
  actionReason,
  paymentReference,
  setActionReason,
  setPaymentReference,
  runAction,
}) => (
  <section className="bg-white border border-stone-200">
    <div className="p-4 border-b border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-3">
      <input
        className={inputClass}
        value={actionReason}
        onChange={(event) => setActionReason(event.target.value)}
        placeholder="Hold/reject reason"
      />
      <input
        className={inputClass}
        value={paymentReference}
        onChange={(event) => setPaymentReference(event.target.value)}
        placeholder="Payment reference"
      />
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-widest text-stone-400">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">RPN</th>
            <th className="px-4 py-3">Vendor</th>
            <th className="px-4 py-3">Source Type</th>
            <th className="px-4 py-3">Vendor Payment</th>
            <th className="px-4 py-3">Rate</th>
            <th className="px-4 py-3">Commission Due</th>
            <th className="px-4 py-3">Paid</th>
            <th className="px-4 py-3">Balance</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3 font-mono">{entry.dueDate.slice(0, 10)}</td>
              <td className="px-4 py-3 font-bold text-brand-charcoal">{entry.rpnName}</td>
              <td className="px-4 py-3">{entry.vendorName}</td>
              <td className="px-4 py-3">{entry.sourceType}</td>
              <td className="px-4 py-3 font-mono">{formatMoney(entry.vendorPaymentAmount, entry.currency)}</td>
              <td className="px-4 py-3">{entry.commissionRate ? `${entry.commissionRate}%` : "-"}</td>
              <td className="px-4 py-3 font-mono font-bold">{formatMoney(entry.commissionAmountDue, entry.currency)}</td>
              <td className="px-4 py-3 font-mono">{formatMoney(entry.commissionAmountPaid, entry.currency)}</td>
              <td className="px-4 py-3 font-mono font-bold">{formatMoney(entry.balanceDue, entry.currency)}</td>
              <td className="px-4 py-3 capitalize">{entry.status.replace("_", " ")}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!canGenerate || entry.status !== "due"}
                    onClick={() => runAction("approval", entry)}
                    className="border border-stone-200 px-2 py-1 text-[9px] font-black uppercase disabled:opacity-40"
                  >
                    Send
                  </button>
                  <button
                    disabled={!canApprove || !["due", "pending_approval"].includes(entry.status)}
                    onClick={() => runAction("approve", entry)}
                    className="border border-green-200 px-2 py-1 text-[9px] font-black uppercase text-green-700 disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    disabled={!canPay || !["approved", "due"].includes(entry.status)}
                    onClick={() => runAction("paid", entry)}
                    className="border border-brand-orange px-2 py-1 text-[9px] font-black uppercase text-brand-orange disabled:opacity-40"
                  >
                    Paid
                  </button>
                  <button
                    disabled={!canApprove || entry.status === "paid"}
                    onClick={() => runAction("hold", entry)}
                    className="border border-stone-200 px-2 py-1 text-[9px] font-black uppercase disabled:opacity-40"
                  >
                    Hold
                  </button>
                  <button
                    disabled={!canApprove || entry.status === "paid"}
                    onClick={() => runAction("reject", entry)}
                    className="border border-red-200 px-2 py-1 text-[9px] font-black uppercase text-red-700 disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={11} className="px-4 py-10 text-center text-stone-400">
                No paid vendor subscription records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);

export default RPNPaymentsLedger;
