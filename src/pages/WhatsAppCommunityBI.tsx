/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PageHeader,
  StatCard,
  TablePanel,
  StatusBadge,
  DataPanel,
  PrimaryButton,
  SearchInput,
} from "../components/CommonUI.tsx";
import {
  Activity as ActivityIcon,
  MessageSquare,
  CheckCircle2,
  PhoneCall,
  AlertTriangle,
  TrendingUp,
  Users,
  LineChart,
  Filter,
} from "lucide-react";
import { WhatsAppActivityLog } from "../types.ts";
import { whatsappActivityService } from "../services/whatsappActivityService.ts";
import { notificationService } from "../services/notificationService.ts";

export const WhatsAppCommunityBI: React.FC = () => {
  const [rawLogs, setRawLogs] = useState<WhatsAppActivityLog[]>([]);
  const navigate = useNavigate();

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sector, setSector] = useState("all");
  const [sourceType, setSourceType] = useState("all");
  const [activityType, setActivityType] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");

  useEffect(() => {
    const logs = whatsappActivityService.getLogs();
    setRawLogs(Array.isArray(logs) ? logs : []);
  }, []);

  // Date helper
  const getDaysSince = (dateStr: string) => {
    if (!dateStr) return 999;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 999;
    return Math.floor(
      (new Date().getTime() - d.getTime()) / (1000 * 3600 * 24),
    );
  };

  // 1. Compute Base Community Health (Unfiltered - true state of community)
  const baseCommunityHealth = useMemo(() => {
    const comms = new Map<string, any>();
    rawLogs.forEach((log) => {
      const sourceKey = log.sourceId || log.sourceName;
      if (!sourceKey) return;
      const c = comms.get(sourceKey) || {
        sourceName: log.sourceName || "Unknown Source",
        sourceType: log.sourceType,
        lastActivityDate: "1970-01-01",
        complaints: 0,
      };
      if (log.activityDate > c.lastActivityDate)
        c.lastActivityDate = log.activityDate;
      if (
        log.activityType === "COMPLAINT_RECEIVED" ||
        log.priority === "CRITICAL"
      )
        c.complaints++;
      comms.set(sourceKey, c);
    });

    const healthMap = new Map<string, string>();
    comms.forEach((c, key) => {
      const days = getDaysSince(c.lastActivityDate);
      let health = "Active";
      if (days > 30 || c.complaints > 2) health = "Critical";
      else if (days >= 15) health = "Dormant";
      else if (days >= 8) health = "Watch";
      healthMap.set(key, health);
    });
    return healthMap;
  }, [rawLogs]);

  // 2. Main Filter Logic
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((log) => {
      // Word order search
      const searchTerms = search
        .toLowerCase()
        .split(" ")
        .filter((t) => t.length > 0);
      const logText = [
        log.sourceName,
        log.communityName,
        log.sector,
        log.category,
        log.province,
        log.cityTown,
        log.vendorName,
        log.productName,
        log.customerNeed,
        log.notes,
        log.activityType,
        log.sourceType,
        log.assignedRpnName,
        log.capturedByStaffName,
        log.assignedStaffName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchTerms.every((term) => logText.includes(term));
      const matchesDateFrom = !dateFrom || log.activityDate >= dateFrom;
      const matchesDateTo = !dateTo || log.activityDate <= dateTo;
      const matchesSector = sector === "all" || log.sector === sector;
      const matchesSourceType =
        sourceType === "all" || log.sourceType === sourceType;
      const matchesActivityType =
        activityType === "all" || log.activityType === activityType;
      const matchesHealth =
        healthFilter === "all" ||
        baseCommunityHealth.get(log.sourceId || log.sourceName || "") ===
          healthFilter;

      return (
        matchesSearch &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesSector &&
        matchesSourceType &&
        matchesActivityType &&
        matchesHealth
      );
    });
  }, [
    rawLogs,
    search,
    dateFrom,
    dateTo,
    sector,
    sourceType,
    activityType,
    healthFilter,
    baseCommunityHealth,
  ]);

  // 3. Extract BI Data
  const bi = useMemo(() => {
    const exec = {
      activities: 0,
      enquiries: 0,
      converted: 0,
      followUpsDue: 0,
      highPriority: 0,
      memberGrowth: 0,
      activeComms: new Set<string>(),
    };

    const sectorMap = new Map<string, any>();
    const productMap = new Map<string, any>();
    const communityMap = new Map<string, any>();
    const vendorMap = new Map<string, any>();
    const rpnMap = new Map<string, any>();
    const staffCaptureMap = new Map<string, any>();
    const commAggMap = new Map<string, any>();

    filteredLogs.forEach((log) => {
      // Exec
      exec.activities++;
      const isEnq =
        log.activityType === "PRODUCT_ENQUIRY" ||
        (log.enquiryCount && log.enquiryCount > 0);
      if (isEnq) exec.enquiries += log.enquiryCount || 1;
      if (log.leadStatus === "CONVERTED") exec.converted++;
      if (log.followUpRequired) exec.followUpsDue++;
      if (log.priority === "HIGH" || log.priority === "CRITICAL")
        exec.highPriority++;
      if (
        log.memberCount !== undefined &&
        log.previousMemberCount !== undefined
      ) {
        exec.memberGrowth += log.memberCount - log.previousMemberCount;
      }
      const sourceKey = log.sourceId || log.sourceName;
      if (sourceKey) exec.activeComms.add(sourceKey);

      // Community Aggregates
      const commName = log.communityName || "Unassigned Community";
      const ca = commAggMap.get(commName) || {
        name: commName,
        activities: 0,
        enquiries: 0,
        conversions: 0,
        groups: new Set<string>(),
      };
      ca.activities++;
      if (isEnq) ca.enquiries += log.enquiryCount || 1;
      if (log.leadStatus === "CONVERTED") ca.conversions++;
      if (sourceKey) ca.groups.add(sourceKey);
      commAggMap.set(commName, ca);

      // Sector Demand
      const secName = log.sector || "Uncategorized";
      const s = sectorMap.get(secName) || {
        name: secName,
        enquiries: 0,
        converted: 0,
        highPriority: 0,
      };
      if (isEnq) s.enquiries += log.enquiryCount || 1;
      if (log.leadStatus === "CONVERTED") s.converted++;
      if (log.priority === "HIGH" || log.priority === "CRITICAL")
        s.highPriority++;
      sectorMap.set(secName, s);

      // Product Demand
      const prodName = log.productName || log.customerNeed || "Unknown Need";
      if (prodName !== "Unknown Need") {
        const p = productMap.get(prodName) || {
          name: prodName,
          sector: secName,
          location: log.cityTown || "Various",
          requests: 0,
          noResponse: 0,
          followUp: 0,
        };
        p.requests++;
        if (log.responseStatus === "MISSED" || log.responseStatus === "PENDING")
          p.noResponse++;
        if (log.followUpRequired) p.followUp++;
        productMap.set(prodName, p);
      }

      // Community Health
      if (sourceKey) {
        const c = communityMap.get(sourceKey) || {
          sourceName: log.sourceName || "Unknown Source",
          sourceType: log.sourceType,
          activities: 0,
          enquiries: 0,
          catShares: 0,
          storefrontShares: 0,
          complaints: 0,
          memberGrowth: 0,
          lastActivityDate: "1970-01-01",
          followUpsDue: 0,
        };
        c.activities++;
        if (isEnq) c.enquiries += log.enquiryCount || 1;
        if (log.activityType === "CATALOGUE_SHARED") c.catShares++;
        if (log.activityType === "STOREFRONT_SHARED") c.storefrontShares++;
        if (log.activityType === "COMPLAINT_RECEIVED") c.complaints++;
        if (
          log.memberCount !== undefined &&
          log.previousMemberCount !== undefined
        )
          c.memberGrowth += log.memberCount - log.previousMemberCount;
        if (log.followUpRequired) c.followUpsDue++;
        if (log.activityDate > c.lastActivityDate)
          c.lastActivityDate = log.activityDate;
        communityMap.set(sourceKey, c);
      }

      // Vendor Response
      if (log.vendorName) {
        const v = vendorMap.get(log.vendorName) || {
          name: log.vendorName,
          enquiries: 0,
          responded: 0,
          missed: 0,
          converted: 0,
          followUpsDue: 0,
          complaints: 0,
          responseTimeSum: 0,
          responseCount: 0,
        };
        if (isEnq) v.enquiries += log.enquiryCount || 1;
        if (log.responseStatus === "RESPONDED") v.responded++;
        if (log.responseStatus === "MISSED") v.missed++;
        if (log.leadStatus === "CONVERTED") v.converted++;
        if (log.followUpRequired) v.followUpsDue++;
        if (log.activityType === "COMPLAINT_RECEIVED") v.complaints++;
        if (log.responseTimeMinutes) {
          v.responseTimeSum += log.responseTimeMinutes;
          v.responseCount++;
        }
        vendorMap.set(log.vendorName, v);
      }

      // RPN Activity
      if (log.assignedRpnName) {
        const r = rpnMap.get(log.assignedRpnName) || {
          name: log.assignedRpnName,
          logs: 0,
          enquiries: 0,
          followUpsDone: 0,
          followUpsDue: 0,
          conversions: 0,
          highPriority: 0,
        };
        r.logs++;
        if (isEnq) r.enquiries += log.enquiryCount || 1;
        if (log.activityType === "FOLLOW_UP_DONE") r.followUpsDone++;
        if (log.followUpRequired) r.followUpsDue++;
        if (log.leadStatus === "CONVERTED") r.conversions++;
        if (log.priority === "HIGH" || log.priority === "CRITICAL")
          r.highPriority++;
        rpnMap.set(log.assignedRpnName, r);
      }

      // Staff Capture Map
      if (log.capturedByStaffName) {
        const sc = staffCaptureMap.get(log.capturedByStaffName) || {
          name: log.capturedByStaffName,
          logs: 0,
          enquiries: 0,
          followUps: 0,
        };
        sc.logs++;
        if (isEnq) sc.enquiries += log.enquiryCount || 1;
        if (log.followUpRequired) sc.followUps++;
        staffCaptureMap.set(log.capturedByStaffName, sc);
      }

      // Assigned Staff Map integration
      if (log.assignedStaffName && log.assignedToType === "STAFF") {
        const sc = staffCaptureMap.get(log.assignedStaffName) || {
          name: log.assignedStaffName,
          logs: 0,
          enquiries: 0,
          followUps: 0,
          assigned: 0,
        };
        if (log.followUpRequired) sc.assigned = (sc.assigned || 0) + 1;
        staffCaptureMap.set(log.assignedStaffName, sc);
      }
    });

    // Calculations & Sorting
    const conversionRate =
      exec.activities > 0
        ? ((exec.converted / exec.activities) * 100).toFixed(1)
        : "0.0";

    const sectors = Array.from(sectorMap.values())
      .map((s) => ({
        ...s,
        oppScore: Math.max(
          0,
          (s.enquiries - s.converted) * 10 + s.highPriority * 5,
        ),
      }))
      .sort((a, b) => b.oppScore - a.oppScore);

    const products = Array.from(productMap.values())
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 20);

    const communities = Array.from(communityMap.values())
      .map((c) => ({
        ...c,
        daysSinceLast: getDaysSince(c.lastActivityDate),
        healthStatus:
          baseCommunityHealth.get(c.sourceId || c.sourceName) || "Active",
      }))
      .sort((a, b) => b.activities - a.activities);

    const vendors = Array.from(vendorMap.values())
      .map((v) => ({
        ...v,
        avgResponseTime:
          v.responseCount > 0
            ? Math.round(v.responseTimeSum / v.responseCount)
            : 0,
        score: Math.max(
          0,
          Math.min(
            100,
            100 -
              v.missed * 10 -
              v.followUpsDue * 5 -
              v.complaints * 10 +
              v.converted * 5,
          ),
        ),
      }))
      .sort((a, b) => b.enquiries - a.enquiries);

    const rpns = Array.from(rpnMap.values())
      .map((r) => ({
        ...r,
        score: Math.max(
          0,
          Math.min(
            100,
            50 + r.conversions * 10 + r.followUpsDone * 5 - r.followUpsDue * 5,
          ),
        ),
      }))
      .sort((a, b) => b.logs - a.logs);

    const staffCaptures = Array.from(staffCaptureMap.values()).sort(
      (a, b) => b.logs - a.logs,
    );

    const communityAggregates = Array.from(commAggMap.values())
      .map((c) => ({ ...c, groupCount: c.groups.size }))
      .sort((a, b) => b.activities - a.activities);

    return {
      exec,
      conversionRate,
      sectors,
      products,
      communities,
      communityAggregates,
      vendors,
      rpns,
      staffCaptures,
    };
  }, [filteredLogs, baseCommunityHealth]);

  useEffect(() => {
    bi.communities.forEach((c) => {
      if (c.healthStatus === "Critical") {
        void notificationService.createNotification({
          type: "system_alert",
          priority: "critical",
          title: "Community Health Critical",
          message: `Source "${c.sourceName}" requires immediate operational attention.`,
          recordType: "Community BI",
          recordId: `comm-critical-${c.sourceId || c.sourceName}`,
        });
      }
    });
  }, [bi.communities]);

  const pendingFollowUps = useMemo(() => {
    return filteredLogs
      .filter(
        (l) =>
          l.followUpRequired &&
          l.leadStatus !== "CONVERTED" &&
          l.leadStatus !== "LOST",
      )
      .sort(
        (a, b) =>
          new Date(a.followUpDate || a.activityDate).getTime() -
          new Date(b.followUpDate || b.activityDate).getTime(),
      );
  }, [filteredLogs]);

  // Dropdown options
  const uniqueSectors = Array.from(
    new Set(rawLogs.map((l) => l.sector).filter(Boolean)),
  );
  const uniqueSourceTypes = Array.from(
    new Set(rawLogs.map((l) => l.sourceType).filter(Boolean)),
  );
  const uniqueActivityTypes = Array.from(
    new Set(rawLogs.map((l) => l.activityType).filter(Boolean)),
  );

  const inputClass =
    "w-full border-2 border-stone-200 p-2 text-[10px] font-bold outline-none focus:border-brand-orange bg-white rounded-none uppercase";

  return (
    <div className="pb-20 space-y-8">
      <PageHeader
        title="Community BI & Analytics"
        subtitle="Actionable intelligence derived from structured WhatsApp operational logs."
        actions={
          <PrimaryButton
            onClick={() => navigate("/whatsapp-activity")}
            className="text-xs"
          >
            <MessageSquare size={14} className="mr-2" /> View Raw Logs
          </PrimaryButton>
        }
      />

      {/* Filters */}
      <DataPanel
        title="Intelligence Filters"
        className="border-t-4 border-t-brand-charcoal"
      >
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 bg-stone-50/50">
          <div className="xl:col-span-2">
            <SearchInput
              placeholder="Word order search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            type="date"
            className={inputClass}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Date From"
          />
          <input
            type="date"
            className={inputClass}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Date To"
          />
          <select
            className={inputClass}
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value="all">All Sectors</option>
            {uniqueSectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            <option value="all">All Sources</option>
            {uniqueSourceTypes.map((s) => (
              <option key={s} value={s}>
                {s?.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
          >
            <option value="all">All Activities</option>
            {uniqueActivityTypes.map((s) => (
              <option key={s} value={s}>
                {s?.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
          >
            <option value="all">All Health</option>
            <option value="Active">Active</option>
            <option value="Watch">Watch</option>
            <option value="Dormant">Dormant</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </DataPanel>

      {/* Executive Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <StatCard
          label="Activities"
          value={bi.exec.activities}
          icon={ActivityIcon}
        />
        <StatCard
          label="Enquiries"
          value={bi.exec.enquiries}
          icon={MessageSquare}
        />
        <StatCard
          label="Converted"
          value={bi.exec.converted}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Conversion %"
          value={`${bi.conversionRate}%`}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          label="Follow-ups Due"
          value={bi.exec.followUpsDue}
          icon={PhoneCall}
          variant={bi.exec.followUpsDue > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="High Priority"
          value={bi.exec.highPriority}
          icon={AlertTriangle}
          variant={bi.exec.highPriority > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Active Comms"
          value={bi.exec.activeComms.size}
          icon={Users}
        />
        <StatCard
          label="Member Growth"
          value={
            bi.exec.memberGrowth > 0
              ? `+${bi.exec.memberGrowth}`
              : bi.exec.memberGrowth
          }
          icon={LineChart}
          variant="success"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Sector Demand BI */}
        <TablePanel
          title="Sector Demand Analytics"
          subtitle="Identify high-demand sectors and conversion bottlenecks."
          headers={[
            "Sector",
            "Enquiries",
            "Converted",
            "High Priority",
            "Opp Score",
          ]}
        >
          {bi.sectors.slice(0, 10).map((s, i) => (
            <tr key={i} className="hover:bg-stone-50">
              <td className="px-6 py-4 font-bold text-xs uppercase">
                {s.name}
              </td>
              <td className="px-6 py-4 font-mono text-xs">{s.enquiries}</td>
              <td className="px-6 py-4 font-mono text-xs text-emerald-600">
                {s.converted}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-red-500">
                {s.highPriority}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 text-[10px] font-black ${s.oppScore > 50 ? "bg-orange-100 text-brand-orange" : "bg-stone-100 text-stone-600"}`}
                >
                  {s.oppScore}
                </span>
              </td>
            </tr>
          ))}
          {bi.sectors.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="p-8 text-center text-stone-400 text-xs"
              >
                No sector data available.
              </td>
            </tr>
          )}
        </TablePanel>

        {/* Product Demand Signals */}
        <TablePanel
          title="Product Demand Signals"
          subtitle="Most requested items and unmet customer needs."
          headers={[
            "Product / Need",
            "Sector",
            "Requests",
            "Missed Resp",
            "Follow-ups",
          ]}
        >
          {bi.products.map((p, i) => (
            <tr key={i} className="hover:bg-stone-50">
              <td className="px-6 py-4">
                <p
                  className="font-bold text-xs uppercase truncate max-w-[200px]"
                  title={p.name}
                >
                  {p.name}
                </p>
                <p className="text-[9px] text-stone-400 uppercase mt-0.5">
                  {p.location}
                </p>
              </td>
              <td className="px-6 py-4 text-[10px] font-bold text-stone-500 uppercase">
                {p.sector}
              </td>
              <td className="px-6 py-4 font-mono text-xs font-bold">
                {p.requests}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-red-500">
                {p.noResponse > 0 ? p.noResponse : "-"}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-brand-orange">
                {p.followUp > 0 ? p.followUp : "-"}
              </td>
            </tr>
          ))}
          {bi.products.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="p-8 text-center text-stone-400 text-xs"
              >
                No product demand data available.
              </td>
            </tr>
          )}
        </TablePanel>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Staff Capture BI */}

        {/* Community Aggregates BI */}
        <TablePanel
          title="Community Performance (Aggregated)"
          subtitle="High-level metrics across entire WhatsApp communities."
          headers={[
            "Community Name",
            "Groups/Channels",
            "Total Activities",
            "Enquiries",
            "Conversions",
          ]}
        >
          {bi.communityAggregates.map((c, i) => (
            <tr key={i} className="hover:bg-stone-50">
              <td className="px-6 py-4 font-bold text-xs uppercase">
                {c.name}
              </td>
              <td className="px-6 py-4 font-mono text-xs">{c.groupCount}</td>
              <td className="px-6 py-4 font-mono text-xs text-brand-charcoal font-bold">
                {c.activities}
              </td>
              <td className="px-6 py-4 font-mono text-xs">{c.enquiries}</td>
              <td className="px-6 py-4 font-mono text-xs text-emerald-600 font-bold">
                {c.conversions}
              </td>
            </tr>
          ))}
          {bi.communityAggregates.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="p-8 text-center text-stone-400 text-xs"
              >
                No community aggregate metrics available.
              </td>
            </tr>
          )}
        </TablePanel>

        <TablePanel
          title="Internal Staff Capture Analytics"
          subtitle="Measuring team contributions for WhatsApp data entry and digitization."
          headers={[
            "Staff Member",
            "Total Logs Captured",
            "Enquiries Captured",
            "Follow-ups Created",
            "Assigned Active",
          ]}
        >
          {bi.staffCaptures.map((s, i) => (
            <tr key={i} className="hover:bg-stone-50">
              <td className="px-6 py-4 font-bold text-xs uppercase">
                {s.name}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-brand-charcoal font-bold">
                {s.logs}
              </td>
              <td className="px-6 py-4 font-mono text-xs">{s.enquiries}</td>
              <td className="px-6 py-4 font-mono text-xs text-brand-orange">
                {s.followUps > 0 ? s.followUps : "-"}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">
                {s.assigned > 0 ? s.assigned : "-"}
              </td>
            </tr>
          ))}
          {bi.staffCaptures.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="p-8 text-center text-stone-400 text-xs"
              >
                No internal staff capture metrics available.
              </td>
            </tr>
          )}
        </TablePanel>
      </div>

      {/* Community Health BI */}
      <TablePanel
        title="Community & Group Health Matrix"
        subtitle="Monitor engagement levels across all tracked distribution channels."
        headers={[
          "Source Name",
          "Type",
          "Health",
          "Activities",
          "Enquiries",
          "Shares (Cat/SF)",
          "Complaints",
          "Growth",
          "Last Active",
        ]}
      >
        {bi.communities.map((c, i) => (
          <tr key={i} className="hover:bg-stone-50 border-b border-stone-100">
            <td
              className="px-6 py-4 font-bold text-xs uppercase max-w-[250px] truncate"
              title={c.sourceName}
            >
              {c.sourceName}
            </td>
            <td className="px-6 py-4 text-[9px] text-stone-500 uppercase font-bold">
              {c.sourceType?.replace(/_/g, " ")}
            </td>
            <td className="px-6 py-4">
              <StatusBadge
                status={c.healthStatus}
                variant={
                  c.healthStatus === "Active"
                    ? "success"
                    : c.healthStatus === "Critical"
                      ? "error"
                      : c.healthStatus === "Watch"
                        ? "warning"
                        : "neutral"
                }
              />
            </td>
            <td className="px-6 py-4 font-mono text-xs">{c.activities}</td>
            <td className="px-6 py-4 font-mono text-xs font-bold">
              {c.enquiries}
            </td>
            <td className="px-6 py-4 font-mono text-xs text-stone-500">
              {c.catShares} / {c.storefrontShares}
            </td>
            <td className="px-6 py-4 font-mono text-xs text-red-500">
              {c.complaints > 0 ? c.complaints : "-"}
            </td>
            <td className="px-6 py-4 font-mono text-xs text-emerald-600">
              {c.memberGrowth > 0 ? `+${c.memberGrowth}` : c.memberGrowth}
            </td>
            <td className="px-6 py-4 text-[10px] text-stone-400 font-mono">
              {c.lastActivityDate} <br />
              <span className="text-[8px] italic">
                {c.daysSinceLast} days ago
              </span>
            </td>
          </tr>
        ))}
        {bi.communities.length === 0 && (
          <tr>
            <td colSpan={9} className="p-8 text-center text-stone-400 text-xs">
              No community data available.
            </td>
          </tr>
        )}
      </TablePanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Vendor Response BI */}
        <TablePanel
          title="Vendor Response Metrics"
          subtitle="Evaluate vendor engagement and reliability scoring."
          headers={[
            "Vendor",
            "Score",
            "Enquiries",
            "Responded",
            "Missed",
            "Converted",
            "Avg Time",
          ]}
        >
          {bi.vendors.slice(0, 15).map((v, i) => (
            <tr key={i} className="hover:bg-stone-50">
              <td
                className="px-6 py-4 font-bold text-xs uppercase truncate max-w-[150px]"
                title={v.name}
              >
                {v.name}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 text-[10px] font-black ${v.score >= 80 ? "bg-emerald-100 text-emerald-700" : v.score >= 50 ? "bg-orange-100 text-brand-orange" : "bg-red-100 text-red-700"}`}
                >
                  {v.score}/100
                </span>
              </td>
              <td className="px-6 py-4 font-mono text-xs">{v.enquiries}</td>
              <td className="px-6 py-4 font-mono text-xs text-emerald-600">
                {v.responded}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-red-500">
                {v.missed > 0 ? v.missed : "-"}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">
                {v.converted}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-stone-500">
                {v.avgResponseTime > 0 ? `${v.avgResponseTime}m` : "-"}
              </td>
            </tr>
          ))}
          {bi.vendors.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="p-8 text-center text-stone-400 text-xs"
              >
                No vendor response data available.
              </td>
            </tr>
          )}
        </TablePanel>

        {/* RPN Activity BI */}
        <TablePanel
          title="RPN Activity & Performance"
          subtitle="Track agent efficiency and lead conversion support."
          headers={[
            "RPN Agent",
            "Score",
            "Logs",
            "Enquiries",
            "F/Ups Done",
            "F/Ups Due",
            "Conversions",
          ]}
        >
          {bi.rpns.slice(0, 15).map((r, i) => (
            <tr key={i} className="hover:bg-stone-50">
              <td className="px-6 py-4 font-bold text-xs uppercase">
                {r.name}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 text-[10px] font-black ${r.score >= 80 ? "bg-emerald-100 text-emerald-700" : r.score >= 50 ? "bg-orange-100 text-brand-orange" : "bg-red-100 text-red-700"}`}
                >
                  {r.score}/100
                </span>
              </td>
              <td className="px-6 py-4 font-mono text-xs">{r.logs}</td>
              <td className="px-6 py-4 font-mono text-xs">{r.enquiries}</td>
              <td className="px-6 py-4 font-mono text-xs text-emerald-600">
                {r.followUpsDone}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-brand-orange">
                {r.followUpsDue > 0 ? r.followUpsDue : "-"}
              </td>
              <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">
                {r.conversions}
              </td>
            </tr>
          ))}
          {bi.rpns.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="p-8 text-center text-stone-400 text-xs"
              >
                No RPN activity data available.
              </td>
            </tr>
          )}
        </TablePanel>
      </div>

      {/* Follow-up Control Desk */}
      <TablePanel
        title="Follow-up Control Desk"
        subtitle="Actionable list of unresolved high-value requests and critical vendor issues."
        className="border-t-4 border-t-brand-orange"
        headers={[
          "Due Date",
          "Source",
          "Sector",
          "Vendor / Product",
          "Customer Need",
          "Priority",
          "Status",
          "Action",
        ]}
      >
        {pendingFollowUps.map((log) => (
          <tr
            key={log.id}
            className="hover:bg-stone-50 border-b border-stone-100"
          >
            <td className="px-6 py-4 font-mono text-xs font-bold text-brand-orange">
              {log.followUpDate || log.activityDate}
            </td>
            <td className="px-6 py-4">
              <p className="font-bold text-xs uppercase truncate max-w-[150px]">
                {log.sourceName}
              </p>
              <p className="text-[9px] text-stone-400 uppercase mt-0.5">
                {log.sourceType?.replace(/_/g, " ")}
              </p>
            </td>
            <td className="px-6 py-4 text-[10px] font-bold text-stone-500 uppercase">
              {log.sector || "-"}
            </td>
            <td className="px-6 py-4">
              {log.vendorName && (
                <p className="font-bold text-xs uppercase truncate max-w-[150px]">
                  {log.vendorName}
                </p>
              )}
              {log.productName && (
                <p className="text-[10px] text-stone-600 uppercase mt-0.5">
                  {log.productName}
                </p>
              )}
              {!log.vendorName && !log.productName && "-"}
            </td>
            <td
              className="px-6 py-4 text-xs text-stone-600 truncate max-w-[200px]"
              title={log.customerNeed}
            >
              {log.customerNeed || "-"}
            </td>
            <td className="px-6 py-4">
              <StatusBadge
                status={log.priority}
                variant={
                  log.priority === "CRITICAL" || log.priority === "HIGH"
                    ? "error"
                    : log.priority === "MEDIUM"
                      ? "warning"
                      : "neutral"
                }
              />
            </td>
            <td className="px-6 py-4">
              <StatusBadge status={log.leadStatus} variant="neutral" />
            </td>
            <td className="px-6 py-4">
              <PrimaryButton
                onClick={() => navigate("/whatsapp-activity")}
                size="sm"
              >
                Resolve
              </PrimaryButton>
            </td>
          </tr>
        ))}
        {pendingFollowUps.length === 0 && (
          <tr>
            <td
              colSpan={8}
              className="p-12 text-center text-stone-400 text-xs uppercase font-bold tracking-widest"
            >
              No pending follow-ups. Clear desk!
            </td>
          </tr>
        )}
      </TablePanel>
    </div>
  );
};
