/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  History,
  Shield,
  Filter,
  Download,
  Trash2,
  Search,
  Calendar,
  User,
  Zap,
  MoreVertical,
  Activity,
} from "lucide-react";
import {
  TablePanel,
  StatusBadge,
  SearchInput,
  PrimaryButton,
  EmptyState,
  SecondaryButton,
  ConfirmDialog,
  DataPanel,
} from "../components/CommonUI.tsx";
import { permissionService } from "../services/permissionService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { ActivityLog, ActorType, EventType } from "../types.ts";
import { asArray } from "../utils/safeData.ts";

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");

  // Filters
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorType | "">("");
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dialogs
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLogs(await analyticsService.getEvents());
  };

  const filtered = useMemo(() => {
    const safeLogs = asArray<ActivityLog>(logs);
    return safeLogs.filter((l) => {
      const eventTypeStr = l.eventType || "SYSTEM EVENT";
      const actorNameStr = l.actorName || "System";
      const vendorNameStr = l.vendorName || "";

      const matchesSearch =
        eventTypeStr.toLowerCase().includes(search.toLowerCase()) ||
        actorNameStr.toLowerCase().includes(search.toLowerCase()) ||
        vendorNameStr.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase());

      const matchesActor = !actorTypeFilter || l.actorType === actorTypeFilter;
      const matchesEvent = !eventTypeFilter || l.eventType === eventTypeFilter;

      const logDate = new Date(l.timestamp).toISOString().split("T")[0];
      const matchesDateFrom = !dateFrom || logDate >= dateFrom;
      const matchesDateTo = !dateTo || logDate <= dateTo;

      return (
        matchesSearch &&
        matchesActor &&
        matchesEvent &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [logs, search, actorTypeFilter, eventTypeFilter, dateFrom, dateTo]);

  const handleExport = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(filtered, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `itred_logs_${new Date().toISOString()}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleClearLogs = async () => {
    await analyticsService.clearEvents();
    await loadLogs();
    setShowClearConfirm(false);
  };

  const eventTypes: EventType[] = Array.from(
    new Set(
      asArray<ActivityLog>(logs)
        .map((l) => l.eventType)
        .filter(Boolean) as EventType[],
    ),
  );
  const actorTypes: ActorType[] = ["admin", "rpn", "backend_staff", "system"];

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Main Controls */}
      <div className="bg-stone-50 border border-stone-200 p-8 flex flex-col lg:flex-row gap-6 justify-between items-center">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-white border border-stone-200 flex items-center justify-center text-brand-orange shadow-sm rotate-3">
            <History size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold uppercase tracking-tight text-brand-charcoal">
              Global Activity Matrix
            </h3>
            <p className="text-[10px] text-stone-400 font-mono mt-0.5 uppercase flex items-center gap-2">
              <Zap size={10} className="text-brand-orange" /> Real-time console
              audit trail & change ledger
            </p>
          </div>
        </div>
        {permissionService.canExport("activityLogs") && (
          <div className="flex flex-wrap gap-2 justify-center">
            <SecondaryButton
              onClick={handleExport}
              className={`flex items-center gap-2 ${!permissionService.canExport("activityLogs") ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Download size={14} /> Export JSON
            </SecondaryButton>
            <button
              onClick={() => {
                if (permissionService.canDelete("activityLogs"))
                  setShowClearConfirm(true);
                else alert("Permission denied to clear logs.");
              }}
              className={`flex items-center gap-2 px-6 py-2 bg-red-50 text-red-500 text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white transition-all border border-red-100 ${!permissionService.canDelete("activityLogs") ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Trash2 size={14} /> Clear Demo Logs
            </button>
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-white p-6 border border-stone-200 shadow-sm">
        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase text-stone-400">
            Search Keywords
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300"
              size={14}
            />
            <input
              type="text"
              placeholder="Vendor, Action, ID..."
              className="w-full bg-stone-50 border border-stone-100 px-9 py-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase text-stone-400">
            Actor Tier
          </label>
          <select
            className="w-full bg-stone-50 border border-stone-100 px-3 py-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
            value={actorTypeFilter}
            onChange={(e) =>
              setActorTypeFilter(e.target.value as ActorType | "")
            }
          >
            <option value="">All Actors</option>
            {actorTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase text-stone-400">
            Operation Type
          </label>
          <select
            className="w-full bg-stone-50 border border-stone-100 px-3 py-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
            value={eventTypeFilter}
            onChange={(e) =>
              setEventTypeFilter(e.target.value as EventType | "")
            }
          >
            <option value="">All Operations</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase text-stone-400">
            Date From
          </label>
          <input
            type="date"
            className="w-full bg-stone-50 border border-stone-100 px-3 py-1.5 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase text-stone-400">
            Date To
          </label>
          <input
            type="date"
            className="w-full bg-stone-50 border border-stone-100 px-3 py-1.5 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <TablePanel
        title="Operation Ledger"
        subtitle={`${filtered.length} audit entries retrieved`}
        headers={[
          "Timeline",
          "Actor / Node",
          "Operation",
          "Traceability",
          "Context",
        ]}
      >
        {filtered.map((log) => (
          <tr
            key={log.id}
            className="hover:bg-brand-orange/[0.02] transition-colors group"
          >
            <td className="px-6 py-6 border-b border-stone-50">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-mono font-bold text-stone-900">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
                <p className="text-[9px] font-mono text-stone-400">
                  {new Date(log.timestamp).toLocaleDateString()}
                </p>
              </div>
            </td>
            <td className="px-6 py-6 border-b border-stone-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded-full ${
                    log.actorType === "admin"
                      ? "bg-stone-900 text-white"
                      : log.actorType === "rpn"
                        ? "bg-orange-100 text-brand-orange"
                        : "bg-stone-100 text-stone-400"
                  }`}
                >
                  <User size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-brand-charcoal">
                    {log.actorName || "System"}
                  </p>
                  <p className="text-[8px] font-mono text-stone-400 uppercase tracking-widest">
                    {(log.actorType || "system").replace("_", " ")}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-6 py-6 border-b border-stone-50">
              <StatusBadge
                status={(log.eventType || "SYSTEM EVENT").replace(/_/g, " ")}
                variant="neutral"
              />
            </td>
            <td className="px-6 py-6 border-b border-stone-50">
              <div className="flex flex-col gap-1">
                {log.vendorName && (
                  <p className="text-[10px] font-bold text-stone-800 uppercase flex items-center gap-2">
                    <Activity size={10} className="text-stone-300" />{" "}
                    {log.vendorName}
                  </p>
                )}
                <p className="text-[9px] font-mono text-stone-400 flex flex-wrap gap-1">
                  {log.vendorId && <span>V:{log.vendorId}</span>}
                  {log.productId && <span>P:{log.productId}</span>}
                  {log.subscriptionId && <span>S:{log.subscriptionId}</span>}
                </p>
              </div>
            </td>
            <td className="px-6 py-6 border-b border-stone-50 max-w-xs">
              <div className="bg-stone-50 p-3 border border-stone-100 group-hover:bg-white transition-all">
                <pre className="text-[9px] font-mono text-stone-500 whitespace-pre-wrap">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            </td>
          </tr>
        ))}
        {filtered.length === 0 && (
          <tr>
            <td colSpan={5} className="px-6 py-20 text-center">
              <EmptyState
                title="No Logs In This Segment"
                description="Adjust your filters or initiate new system operations to populate the audit ledger."
                icon={Shield}
              />
            </td>
          </tr>
        )}
      </TablePanel>

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Wipe Audit Trail"
        message="Are you sure you want to delete all activity logs from the system? This action is permanent and only intended for demo cleanup."
        confirmLabel="Permanent Delete"
        onConfirm={handleClearLogs}
        onCancel={() => setShowClearConfirm(false)}
        variant="danger"
      />
    </div>
  );
};
