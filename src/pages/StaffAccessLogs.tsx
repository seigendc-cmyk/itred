/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  DataPanel,
  TablePanel,
  StatusBadge,
  StatCard,
  SearchInput,
} from "../components/CommonUI.tsx";
import { staffAuditService } from "../services/staffAuditService.ts";
import { StaffAuditLog } from "../types.ts";
import {
  Shield,
  AlertTriangle,
  UserX,
  Trash2,
  Activity as ActivityIcon,
  PlusCircle,
  Edit3,
  Key,
} from "lucide-react";

export const StaffAccessLogs: React.FC = () => {
  const [logs, setLogs] = useState<StaffAuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [filterStaff, setFilterStaff] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");

  const loadLogs = async () => {
    const rawLogs = await staffAuditService.getLogs();
    setLogs(rawLogs);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const uniqueStaff = Array.from(new Set(logs.map((l) => l.staffId))).map(
    (id) => {
      const log = logs.find((l) => l.staffId === id);
      return { id, name: log?.staffName || "Unknown" };
    },
  );
  const uniqueModules = Array.from(new Set(logs.map((l) => l.module)));
  const uniqueEvents = Array.from(new Set(logs.map((l) => l.eventType)));

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.staffName.toLowerCase().includes(search.toLowerCase()) ||
        (log.recordName &&
          log.recordName.toLowerCase().includes(search.toLowerCase()));
      const matchesStaff = filterStaff === "all" || log.staffId === filterStaff;
      const matchesModule =
        filterModule === "all" || log.module === filterModule;
      const matchesEvent =
        filterEvent === "all" || log.eventType === filterEvent;
      const matchesSeverity =
        filterSeverity === "all" || log.severity === filterSeverity;

      return (
        matchesSearch &&
        matchesStaff &&
        matchesModule &&
        matchesEvent &&
        matchesSeverity
      );
    });
  }, [logs, search, filterStaff, filterModule, filterEvent, filterSeverity]);

  const stats = useMemo(() => {
    return {
      totalLogs: logs.length,
      highRisk: logs.filter(
        (l) => l.severity === "high" || l.severity === "critical",
      ).length,
      accessDenied: logs.filter((l) => l.eventType === "ACCESS_DENIED").length,
      created: logs.filter((l) => l.eventType === "RECORD_CREATED").length,
      updated: logs.filter((l) => l.eventType === "RECORD_UPDATED").length,
      permChanges: logs.filter((l) => l.eventType === "PERMISSION_CHANGED")
        .length,
      critical: logs.filter((l) => l.severity === "critical").length,
    };
  }, [logs]);

  return (
    <div className="space-y-8 pb-20">
      <PageHeader
        title="Staff Audit & Behaviour Logs"
        subtitle="Immutable ledger of operational activity, access attempts, and administrative actions."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard
          label="Total Logs"
          value={stats.totalLogs}
          icon={ActivityIcon}
        />
        <StatCard
          label="High Risk"
          value={stats.highRisk}
          icon={AlertTriangle}
          variant={stats.highRisk > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Critical Actions"
          value={stats.critical}
          icon={Shield}
          variant={stats.critical > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Access Denied"
          value={stats.accessDenied}
          icon={UserX}
          variant={stats.accessDenied > 0 ? "warning" : "neutral"}
        />
        <StatCard label="Created" value={stats.created} icon={PlusCircle} />
        <StatCard label="Updated" value={stats.updated} icon={Edit3} />
        <StatCard
          label="Perm Changes"
          value={stats.permChanges}
          icon={Key}
          variant={stats.permChanges > 0 ? "warning" : "neutral"}
        />
      </div>

      <DataPanel
        title="Audit Matrix & Filters"
        className="border-t-4 border-t-brand-charcoal shadow-sm"
      >
        <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
          <SearchInput
            placeholder="Search Action/Record..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border-2 border-stone-100 p-2 text-xs font-bold uppercase outline-none focus:border-brand-orange"
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
          >
            <option value="all">All Staff</option>
            {uniqueStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="border-2 border-stone-100 p-2 text-xs font-bold uppercase outline-none focus:border-brand-orange"
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
          >
            <option value="all">All Modules</option>
            {uniqueModules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="border-2 border-stone-100 p-2 text-xs font-bold uppercase outline-none focus:border-brand-orange"
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
          >
            <option value="all">All Event Types</option>
            {uniqueEvents.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select
            className="border-2 border-stone-100 p-2 text-xs font-bold uppercase outline-none focus:border-brand-orange"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </DataPanel>

      <TablePanel
        title="System Audit Ledger"
        headers={[
          "Date/Time",
          "Staff Member",
          "Module / Context",
          "Action Trace",
          "Action",
          "Target Record",
          "Severity",
        ]}
      >
        {filteredLogs.map((log) => (
          <tr
            key={log.id}
            className="hover:bg-stone-50 border-b border-stone-100 transition-colors"
          >
            <td className="px-6 py-4">
              <p className="text-xs font-bold font-mono text-stone-600">
                {new Date(log.createdAt).toLocaleDateString()}
              </p>
              <p className="text-[10px] text-stone-400 font-mono">
                {new Date(log.createdAt).toLocaleTimeString()}
              </p>
            </td>
            <td className="px-6 py-4 flex flex-col justify-center">
              <p className="text-xs font-bold uppercase text-brand-charcoal">
                {log.staffName}
              </p>
              <p className="text-[9px] uppercase tracking-widest text-stone-400">
                {log.staffRole}
              </p>
            </td>
            <td className="px-6 py-4">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-stone-100 text-stone-500 px-2 py-1">
                {log.module}
              </span>
            </td>
            <td className="px-6 py-4">
              <StatusBadge
                status={log.eventType.replace(/_/g, " ")}
                variant={
                  log.severity === "high" ||
                  log.severity === "critical" ||
                  log.eventType.includes("FAIL") ||
                  log.eventType.includes("DENIED") ||
                  log.eventType.includes("DELETE")
                    ? "error"
                    : "neutral"
                }
              />
            </td>
            <td
              className="px-6 py-4 text-xs font-medium text-stone-600 max-w-sm truncate"
              title={log.action}
            >
              {log.action}
              {log.reason && (
                <p className="text-[9px] text-red-500 italic mt-0.5">
                  Reason: {log.reason}
                </p>
              )}
            </td>
            <td className="px-6 py-4">
              {log.recordName ? (
                <div>
                  <p className="text-xs font-bold uppercase text-stone-700">
                    {log.recordName}
                  </p>
                  <p className="text-[9px] font-mono text-stone-400">
                    {log.recordType}: {log.recordId}
                  </p>
                </div>
              ) : (
                <span className="text-[10px] text-stone-300 italic">
                  No Record Target
                </span>
              )}
            </td>
            <td className="px-6 py-4">
              <StatusBadge
                status={log.severity}
                variant={
                  log.severity === "high" || log.severity === "critical"
                    ? "error"
                    : log.severity === "warning"
                      ? "warning"
                      : "success"
                }
              />
            </td>
          </tr>
        ))}
        {filteredLogs.length === 0 && (
          <tr>
            <td colSpan={7} className="px-6 py-20 text-center">
              <Shield size={32} className="mx-auto text-stone-200 mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                No audit events match filters
              </p>
            </td>
          </tr>
        )}
      </TablePanel>
    </div>
  );
};
