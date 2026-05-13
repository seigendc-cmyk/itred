/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  StatCard,
  DataPanel,
  TablePanel,
  StatusBadge,
  SearchInput,
  PrimaryButton,
  SecondaryButton,
} from "../components/CommonUI.tsx";
import {
  Activity,
  MessageSquare,
  CheckCircle2,
  PhoneCall,
  AlertTriangle,
  Briefcase,
  Users,
  PackageSearch,
  ClipboardList,
  BarChart3,
  X,
  MapPin,
  Clock,
  Edit,
  UserCheck,
  Check,
  XCircle,
  TrendingUp as TrendingUpIcon,
  AlertCircle,
  Save,
} from "lucide-react";
import { whatsappActivityService } from "../services/whatsappActivityService.ts";
import { rpnService } from "../services/rpnService.ts";
import {
  RPN,
  WhatsAppActivityLog,
  WhatsAppLeadStatus,
  WhatsAppActivityType,
} from "../types.ts";
import { staffService } from "../services/staffService.ts";
import { Staff } from "../types.ts";
import { notificationService } from "../services/notificationService.ts";

type TabMode = "vendor" | "rpn" | "product" | "followup";

export const WhatsAppPerformanceReports: React.FC = () => {
  const [rawLogs, setRawLogs] = useState<WhatsAppActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<TabMode>("vendor");
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Detail View State
  const [selectedVendorDetail, setSelectedVendorDetail] = useState<any | null>(
    null,
  );
  const [selectedRpnDetail, setSelectedRpnDetail] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WhatsAppActivityLog | null>(
    null,
  );
  const [updateFormData, setUpdateFormData] = useState<
    Partial<WhatsAppActivityLog>
  >({});

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSector, setFilterSector] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterLeadStatus, setFilterLeadStatus] = useState("all");

  useEffect(() => {
    loadData();
    setRpns(rpnService.getAll());
    setStaffList(staffService.getAllStaff());
  }, []);

  const loadData = () => {
    const logs = whatsappActivityService.getLogs();
    setRawLogs(Array.isArray(logs) ? logs : []);
  };

  // Filter Logs
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((log) => {
      const searchTerms = search
        .toLowerCase()
        .split(" ")
        .filter((t) => t.length > 0);

      const logText = [
        log.vendorName,
        log.assignedRpnName,
        log.productName,
        log.customerNeed,
        log.sector,
        log.category,
        log.sourceName,
        log.communityName,
        log.province,
        log.cityTown,
        log.district,
        log.notes,
        log.activityType,
        log.leadStatus,
        log.responseStatus,
        log.capturedByStaffName,
        log.assignedStaffName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchTerms.every((term) => logText.includes(term));
      const matchesDateFrom = !dateFrom || log.activityDate >= dateFrom;
      const matchesDateTo = !dateTo || log.activityDate <= dateTo;
      const matchesSector =
        filterSector === "all" || log.sector === filterSector;
      const matchesPriority =
        filterPriority === "all" || log.priority === filterPriority;
      const matchesLeadStatus =
        filterLeadStatus === "all" || log.leadStatus === filterLeadStatus;

      return (
        matchesSearch &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesSector &&
        matchesPriority &&
        matchesLeadStatus
      );
    });
  }, [
    rawLogs,
    search,
    dateFrom,
    dateTo,
    filterSector,
    filterPriority,
    filterLeadStatus,
  ]);

  // Executive Summary
  const execSummary = useMemo(() => {
    const summary = {
      totalLogs: filteredLogs.length,
      productEnquiries: 0,
      catalogueShares: 0,
      storefrontShares: 0,
      convertedLeads: 0,
      missedResponses: 0,
      followUpsDue: 0,
      highPriority: 0,
      overdueFollowUps: 0,
      followUpsDueToday: 0,
      completedFollowUps: 0,
      vendorNonResponseCount: 0,
      conversionsAfterFollowUp: 0,
    };

    filteredLogs.forEach((log) => {
      if (
        log.activityType === "PRODUCT_ENQUIRY" ||
        (log.enquiryCount && log.enquiryCount > 0)
      ) {
        summary.productEnquiries += log.enquiryCount || 1;
      }
      if (log.activityType === "CATALOGUE_SHARED") summary.catalogueShares++;
      if (log.activityType === "STOREFRONT_SHARED") summary.storefrontShares++;
      if (log.leadStatus === "CONVERTED") summary.convertedLeads++;
      if (log.responseStatus === "MISSED") summary.missedResponses++;
      if (
        log.followUpRequired &&
        log.leadStatus !== "CONVERTED" &&
        log.leadStatus !== "LOST"
      ) {
        summary.followUpsDue++;
      }
      if (log.priority === "HIGH" || log.priority === "CRITICAL") {
        summary.highPriority++;
      }

      const today = new Date().toISOString().split("T")[0];
      if (log.followUpRequired && log.followUpDate) {
        if (log.followUpDate < today) summary.overdueFollowUps++;
        if (log.followUpDate === today) summary.followUpsDueToday++;
      }
      if (log.activityType === "FOLLOW_UP_DONE") summary.completedFollowUps++;
      if (log.activityType === "VENDOR_DID_NOT_RESPOND")
        summary.vendorNonResponseCount++;
      if (log.leadStatus === "CONVERTED" && log.followUpDate) {
        summary.conversionsAfterFollowUp++;
      }
    });

    return summary;
  }, [filteredLogs]);

  useEffect(() => {
    if (execSummary.overdueFollowUps > 0) {
      notificationService.addNotification({
        type: "WHATSAPP",
        severity: "CRITICAL",
        title: "Overdue Follow-ups Detected",
        message: `${execSummary.overdueFollowUps} follow-ups are currently overdue across the network.`,
        relatedModule: "WhatsApp Reports",
        relatedRecordId: "bi-overdue-followups",
      });
    }
    if (execSummary.highPriority > 0) {
      notificationService.addNotification({
        type: "WHATSAPP",
        severity: "CRITICAL",
        title: "High Priority Issues Pending",
        message: `${execSummary.highPriority} critical priority items remain unresolved.`,
        relatedModule: "WhatsApp Reports",
        relatedRecordId: "bi-high-priority",
      });
    }
    vendorReports.forEach((v) => {
      if (v.missedResponses >= 2) {
        notificationService.addNotification({
          type: "VENDOR",
          severity: "WARNING",
          title: "Repeated Missed Responses",
          message: `${v.vendorName} has missed ${v.missedResponses} responses.`,
          relatedModule: "WhatsApp Reports",
          relatedRecordId: `vendor-missed-${v.vendorId}`,
        });
      }
    });
  }, [execSummary, vendorReports]);

  // Vendor Reports
  const vendorReports = useMemo(() => {
    const vMap = new Map<string, any>();

    filteredLogs.forEach((log) => {
      const vKey = log.vendorId || log.vendorName;
      if (!vKey) return;

      const v = vMap.get(vKey) || {
        vendorId: log.vendorId || "",
        vendorName: log.vendorName || "Unknown Vendor",
        totalActivities: 0,
        catalogueShares: 0,
        storefrontShares: 0,
        productEnquiries: 0,
        customerRequests: 0,
        convertedLeads: 0,
        lostLeads: 0,
        missedResponses: 0,
        vendorRespondedCount: 0,
        complaints: 0,
        followUpsDue: 0,
        highPriorityIssues: 0,
        totalResponseMinutes: 0,
        responsesWithTime: 0,
        productsRequested: new Set<string>(),
        sourceGroups: new Set<string>(),
        catalogueIds: new Set<string>(),
        storefrontIds: new Set<string>(),
        lastActivityDate: "1970-01-01",
        logs: [] as WhatsAppActivityLog[],
      };

      v.totalActivities++;
      v.logs.push(log);

      if (log.activityType === "CATALOGUE_SHARED") v.catalogueShares++;
      if (log.activityType === "STOREFRONT_SHARED") v.storefrontShares++;
      if (log.activityType === "PRODUCT_ENQUIRY") v.productEnquiries++;
      if (log.activityType === "CUSTOMER_REQUEST") v.customerRequests++;

      if (log.leadStatus === "CONVERTED") v.convertedLeads++;
      if (log.leadStatus === "LOST") v.lostLeads++;
      if (
        log.responseStatus === "MISSED" ||
        log.activityType === "VENDOR_DID_NOT_RESPOND"
      )
        v.missedResponses++;
      if (
        log.responseStatus === "RESPONDED" ||
        log.activityType === "VENDOR_RESPONDED"
      )
        v.vendorRespondedCount++;

      if (log.activityType === "COMPLAINT_RECEIVED") v.complaints++;
      if (
        log.followUpRequired &&
        log.leadStatus !== "CONVERTED" &&
        log.leadStatus !== "LOST"
      )
        v.followUpsDue++;
      if (log.priority === "HIGH" || log.priority === "CRITICAL")
        v.highPriorityIssues++;

      if (log.responseTimeMinutes) {
        v.totalResponseMinutes += log.responseTimeMinutes;
        v.responsesWithTime++;
      }

      if (log.productName) v.productsRequested.add(log.productName);
      const sKey = log.sourceId || log.sourceName;
      if (sKey) v.sourceGroups.add(log.sourceName || sKey);
      if (log.catalogueId) v.catalogueIds.add(log.catalogueId);
      if (log.storefrontId) v.storefrontIds.add(log.storefrontId);

      if (log.activityDate > v.lastActivityDate)
        v.lastActivityDate = log.activityDate;

      vMap.set(vKey, v);
    });

    return Array.from(vMap.values())
      .map((v) => {
        let score = 100;
        score += v.convertedLeads * 5;
        score += v.vendorRespondedCount * 2;
        score -= v.missedResponses * 10;
        score -= v.followUpsDue * 5;
        score -= v.complaints * 10;
        score -= v.highPriorityIssues * 10;
        score = Math.max(0, Math.min(100, score));

        let recommendedAction = "Vendor performing well";
        if (score < 50)
          recommendedAction =
            "Urgent: Improve vendor response speed and resolve issues";
        else if (v.followUpsDue > 0)
          recommendedAction = "Follow up overdue enquiries";
        else if (v.missedResponses > 0)
          recommendedAction = "Address missed customer requests";
        else if (v.productsRequested.size > 2)
          recommendedAction = "Stock products with repeated demand";
        else if (v.storefrontShares === 0)
          recommendedAction = "Promote storefront to more groups";

        return {
          ...v,
          averageResponseTimeMinutes:
            v.responsesWithTime > 0
              ? Math.round(v.totalResponseMinutes / v.responsesWithTime)
              : 0,
          vendorResponseScore: score,
          recommendedAction,
          topRequestedProducts: Array.from(v.productsRequested),
          topSourceGroups: Array.from(v.sourceGroups),
        };
      })
      .sort((a, b) => b.totalActivities - a.totalActivities);
  }, [filteredLogs]);

  // RPN Reports
  const rpnReports = useMemo(() => {
    const rpnMap = new Map<string, any>();

    filteredLogs.forEach((log) => {
      const rpnKey = log.assignedRpnId || log.assignedRpnName;
      if (!rpnKey) return;

      const r = rpnMap.get(rpnKey) || {
        assignedRpnId: log.assignedRpnId || "",
        assignedRpnName: log.assignedRpnName || "Unknown RPN",
        totalActivitiesLogged: 0,
        catalogueShares: 0,
        storefrontShares: 0,
        productEnquiriesHandled: 0,
        customerRequestsHandled: 0,
        followUpsCompleted: 0,
        followUpsDue: 0,
        convertedLeads: 0,
        highPriorityCases: 0,
        complaintsHandled: 0,
        sectors: new Set<string>(),
        sourceGroups: new Set<string>(),
        lastActivityDate: "1970-01-01",
        logs: [] as WhatsAppActivityLog[],
      };

      r.totalActivitiesLogged++;
      r.logs.push(log);

      if (log.activityType === "CATALOGUE_SHARED") r.catalogueShares++;
      if (log.activityType === "STOREFRONT_SHARED") r.storefrontShares++;
      if (log.activityType === "PRODUCT_ENQUIRY") r.productEnquiriesHandled++;
      if (log.activityType === "CUSTOMER_REQUEST") r.customerRequestsHandled++;
      if (log.activityType === "FOLLOW_UP_DONE") r.followUpsCompleted++;

      if (
        log.followUpRequired &&
        log.leadStatus !== "CONVERTED" &&
        log.leadStatus !== "LOST"
      )
        r.followUpsDue++;
      if (log.leadStatus === "CONVERTED") r.convertedLeads++;
      if (log.priority === "HIGH" || log.priority === "CRITICAL")
        r.highPriorityCases++;
      if (log.activityType === "COMPLAINT_RECEIVED") r.complaintsHandled++;

      if (log.sector) r.sectors.add(log.sector);
      const sKey = log.sourceId || log.sourceName;
      if (sKey) r.sourceGroups.add(log.sourceName || sKey);

      if (log.activityDate > r.lastActivityDate)
        r.lastActivityDate = log.activityDate;

      rpnMap.set(rpnKey, r);
    });

    return Array.from(rpnMap.values())
      .map((r) => {
        let score = 50;
        score += r.totalActivitiesLogged * 2;
        score += r.convertedLeads * 5;
        score += r.followUpsCompleted * 3;
        score -= r.followUpsDue * 5;
        score -= r.highPriorityCases * 5;
        score = Math.max(0, Math.min(100, score));

        return {
          ...r,
          activeSectors: Array.from(r.sectors),
          activeSourceGroups: Array.from(r.sourceGroups),
          rpnActivityScore: score,
        };
      })
      .sort((a, b) => b.totalActivitiesLogged - a.totalActivitiesLogged);
  }, [filteredLogs]);

  // Product Demand Reports
  const productReports = useMemo(() => {
    const pMap = new Map<string, any>();

    filteredLogs.forEach((log) => {
      const pKey = log.productName || log.customerNeed;
      if (!pKey) return;

      const p = pMap.get(pKey) || {
        productName: pKey,
        sector: log.sector || "Uncategorized",
        demandCount: 0,
        locations: new Set<string>(),
        vendorsMentioned: new Set<string>(),
        sources: new Set<string>(),
        conversions: 0,
        missedResponses: 0,
        followUpsDue: 0,
      };

      if (
        log.activityType === "PRODUCT_ENQUIRY" ||
        log.activityType === "CUSTOMER_REQUEST" ||
        log.activityType === "DEMAND_SIGNAL"
      ) {
        p.demandCount++;
      }

      if (log.cityTown) p.locations.add(log.cityTown);
      if (log.vendorName) p.vendorsMentioned.add(log.vendorName);
      const sKey = log.sourceId || log.sourceName;
      if (sKey) p.sources.add(log.sourceName || sKey);

      if (log.leadStatus === "CONVERTED") p.conversions++;
      if (log.responseStatus === "MISSED") p.missedResponses++;
      if (
        log.followUpRequired &&
        log.leadStatus !== "CONVERTED" &&
        log.leadStatus !== "LOST"
      )
        p.followUpsDue++;

      pMap.set(pKey, p);
    });

    return Array.from(pMap.values())
      .filter((p) => p.demandCount > 0)
      .map((p) => {
        let score = 0;
        score += p.demandCount * 5;
        score += Math.max(0, p.sources.size - 1) * 5;
        score += Math.max(0, p.locations.size - 1) * 3;
        score -= p.missedResponses * 5;
        score = Math.max(0, Math.min(100, score));

        return {
          ...p,
          opportunityScore: score,
          locationList: Array.from(p.locations),
          vendorList: Array.from(p.vendorsMentioned),
        };
      })
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [filteredLogs]);

  // Follow-up Desk
  const followUpDesk = useMemo(() => {
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

  const handleMarkFollowUpDone = (log: WhatsAppActivityLog) => {
    const notes = log.notes
      ? `${log.notes}\n[Follow-up marked done on ${new Date().toLocaleDateString()}]`
      : `[Follow-up marked done on ${new Date().toLocaleDateString()}]`;

    whatsappActivityService.updateLog(log.id, {
      followUpRequired: false,
      responseStatus: "RESPONDED",
      notes: notes,
    });

    const newLog: WhatsAppActivityLog = {
      ...log,
      id: `WA-${Date.now()}`,
      activityDate: new Date().toISOString().split("T")[0],
      activityType: "FOLLOW_UP_DONE",
      notes: `Follow-up completed for original log: ${log.id}`,
      followUpRequired: false,
      followUpDate: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    whatsappActivityService.saveLog(newLog);
    loadData();
  };

  const handleOpenUpdateModal = (log: WhatsAppActivityLog) => {
    setSelectedLog(log);
    setUpdateFormData(log);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
    setUpdateFormData({});
  };

  const handleModalSave = () => {
    if (!selectedLog) return;
    whatsappActivityService.updateLog(selectedLog.id, {
      ...updateFormData,
      notes: updateFormData.notes,
      assignedRpnId: updateFormData.assignedRpnId,
      assignedRpnName: rpns.find((r) => r.id === updateFormData.assignedRpnId)
        ?.name,
      assignedToType: updateFormData.assignedToType,
      assignedStaffId: updateFormData.assignedStaffId,
      assignedStaffName:
        staffList.find((s) => s.id === updateFormData.assignedStaffId)
          ?.displayName ||
        staffList.find((s) => s.id === updateFormData.assignedStaffId)
          ?.fullName,
      leadStatus: updateFormData.leadStatus,
      followUpDate: updateFormData.followUpDate,
      priority: updateFormData.priority,
    });
    handleModalClose();
    loadData();
  };

  const handleModalAction = (
    type:
      | "converted"
      | "lost"
      | "vendorResponded"
      | "vendorDidNotRespond"
      | "contacted"
      | "escalate",
  ) => {
    if (!selectedLog) return;

    const createNewActivity = (
      activityType: WhatsAppActivityType,
      notes: string,
    ) => {
      const newLog: WhatsAppActivityLog = {
        ...selectedLog,
        id: `WA-${Date.now()}`,
        activityDate: new Date().toISOString().split("T")[0],
        activityType,
        notes,
        followUpRequired: false,
        followUpDate: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      whatsappActivityService.saveLog(newLog);
    };

    if (type === "converted" || type === "lost") {
      whatsappActivityService.updateLog(selectedLog.id, {
        leadStatus: type === "converted" ? "CONVERTED" : "LOST",
        followUpRequired: false,
      });
      createNewActivity(
        "FOLLOW_UP_DONE",
        `Follow-up resulted in ${type} lead for original log: ${selectedLog.id}`,
      );
    } else if (type === "vendorResponded") {
      whatsappActivityService.updateLog(selectedLog.id, {
        responseStatus: "RESPONDED",
      });
      createNewActivity(
        "VENDOR_RESPONDED",
        `Vendor responded to enquiry from log: ${selectedLog.id}`,
      );
    } else if (type === "vendorDidNotRespond") {
      whatsappActivityService.updateLog(selectedLog.id, {
        responseStatus: "MISSED",
        priority: "HIGH",
      });
      createNewActivity(
        "VENDOR_DID_NOT_RESPOND",
        `Vendor did not respond to enquiry from log: ${selectedLog.id}. Escalating.`,
      );
    } else if (type === "contacted") {
      whatsappActivityService.updateLog(selectedLog.id, {
        leadStatus: "CONTACTED",
      });
      createNewActivity(
        "FOLLOW_UP_DONE",
        `Follow-up contacted for log: ${selectedLog.id}`,
      );
    } else if (type === "escalate") {
      whatsappActivityService.updateLog(selectedLog.id, {
        responseStatus: "ESCALATED",
        priority: "CRITICAL",
      });
      createNewActivity(
        "OTHER",
        `Issue escalated for original log: ${selectedLog.id}`,
      );
    }

    handleModalClose();
    loadData();
  };

  const inputClass =
    "w-full border-2 border-stone-200 p-2 text-[10px] font-bold outline-none focus:border-brand-orange bg-white rounded-none uppercase";

  // Unique options for filters
  const uniqueSectors = Array.from(
    new Set(rawLogs.map((l) => l.sector).filter(Boolean)),
  );

  return (
    <div className="pb-20 space-y-8 min-h-screen bg-stone-50">
      <PageHeader
        title="WhatsApp Performance Reports"
        subtitle="Actionable operational intelligence from structured WhatsApp activity logs."
      />

      {/* Executive Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 px-6">
        <StatCard
          label="Total Logs"
          value={execSummary.totalLogs}
          icon={Activity}
        />
        <StatCard
          label="Enquiries"
          value={execSummary.productEnquiries}
          icon={MessageSquare}
        />
        <StatCard
          label="Cat Shares"
          value={execSummary.catalogueShares}
          icon={BarChart3}
        />
        <StatCard
          label="SF Shares"
          value={execSummary.storefrontShares}
          icon={BarChart3}
        />
        <StatCard
          label="Converted"
          value={execSummary.convertedLeads}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Missed Resp."
          value={execSummary.missedResponses}
          icon={AlertTriangle}
          variant={execSummary.missedResponses > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Follow-ups"
          value={execSummary.followUpsDue}
          icon={PhoneCall}
          variant={execSummary.followUpsDue > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="High Priority"
          value={execSummary.highPriority}
          icon={AlertTriangle}
          variant={execSummary.highPriority > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Overdue F/Ups"
          value={execSummary.overdueFollowUps}
          icon={AlertCircle}
          variant={execSummary.overdueFollowUps > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="F/Ups Today"
          value={execSummary.followUpsDueToday}
          icon={Clock}
          variant={execSummary.followUpsDueToday > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="F/Ups Done"
          value={execSummary.completedFollowUps}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Conversions (F/Up)"
          value={execSummary.conversionsAfterFollowUp}
          icon={TrendingUpIcon}
          variant="success"
        />
      </div>

      {/* Global Filters */}
      <div className="px-6">
        <DataPanel
          title="Report Filters"
          className="border-t-4 border-t-brand-charcoal shadow-sm"
        >
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <div className="xl:col-span-2">
              <SearchInput
                placeholder="Free-order search across all fields..."
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
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
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
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </DataPanel>
      </div>

      {/* Tabs */}
      <div className="px-6">
        <div className="flex border-b-2 border-stone-200">
          {[
            { id: "vendor", label: "Vendor Reports", icon: Briefcase },
            { id: "rpn", label: "RPN Reports", icon: Users },
            {
              id: "product",
              label: "Product Demand Reports",
              icon: PackageSearch,
            },
            { id: "followup", label: "Follow-up Desk", icon: ClipboardList },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as TabMode);
                setSelectedVendorDetail(null);
                setSelectedRpnDetail(null);
              }}
              className={`flex items-center gap-2 px-6 py-4 font-bold text-xs uppercase tracking-widest transition-colors ${
                activeTab === tab.id
                  ? "border-b-4 border-brand-orange text-brand-orange bg-white"
                  : "text-stone-500 hover:bg-stone-100 hover:text-brand-charcoal border-b-4 border-transparent"
              }`}
            >
              <tab.icon size={16} />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6">
        {/* VENDOR REPORTS */}
        {activeTab === "vendor" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div
              className={
                selectedVendorDetail ? "xl:col-span-2" : "xl:col-span-3"
              }
            >
              <TablePanel
                title="Vendor Operational Performance"
                subtitle="Metrics based on logged WhatsApp activities."
                headers={[
                  "Vendor",
                  "Activities",
                  "Enquiries",
                  "Conversions",
                  "Missed Resp.",
                  "Follow-ups",
                  "Avg Resp Time",
                  "Score",
                  "Action",
                ]}
              >
                {vendorReports.map((v, i) => (
                  <tr
                    key={i}
                    className={`hover:bg-stone-50 border-b border-stone-100 cursor-pointer ${selectedVendorDetail?.vendorName === v.vendorName ? "bg-orange-50/50" : ""}`}
                    onClick={() => setSelectedVendorDetail(v)}
                  >
                    <td className="px-6 py-4 font-bold text-xs uppercase">
                      {v.vendorName}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {v.totalActivities}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {v.productEnquiries}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-emerald-600 font-bold">
                      {v.convertedLeads}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-red-500">
                      {v.missedResponses > 0 ? v.missedResponses : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-brand-orange">
                      {v.followUpsDue > 0 ? v.followUpsDue : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-stone-500">
                      {v.averageResponseTimeMinutes > 0
                        ? `${v.averageResponseTimeMinutes}m`
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-[10px] font-black ${v.vendorResponseScore >= 80 ? "bg-emerald-100 text-emerald-700" : v.vendorResponseScore >= 50 ? "bg-orange-100 text-brand-orange" : "bg-red-100 text-red-700"}`}
                      >
                        {v.vendorResponseScore}/100
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <SecondaryButton
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVendorDetail(v);
                        }}
                      >
                        View Detail
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
                {vendorReports.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-8 text-center text-stone-400 text-xs"
                    >
                      No vendor data available based on filters.
                    </td>
                  </tr>
                )}
              </TablePanel>
            </div>

            {/* Vendor Detail Side Panel */}
            {selectedVendorDetail && (
              <div className="bg-white border-2 border-brand-orange shadow-lg p-6 flex flex-col h-fit sticky top-6">
                <div className="flex justify-between items-start mb-6 border-b border-stone-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-brand-charcoal uppercase">
                      {selectedVendorDetail.vendorName}
                    </h3>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-stone-400 mt-1">
                      Vendor Detail Report
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedVendorDetail(null)}
                    className="text-stone-400 hover:text-brand-charcoal"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-2">
                      Recommended Action
                    </p>
                    <div
                      className={`p-3 text-xs font-bold border-l-4 ${selectedVendorDetail.vendorResponseScore >= 80 ? "border-emerald-500 bg-emerald-50 text-emerald-800" : selectedVendorDetail.vendorResponseScore >= 50 ? "border-brand-orange bg-orange-50 text-orange-900" : "border-red-500 bg-red-50 text-red-800"}`}
                    >
                      {selectedVendorDetail.recommendedAction}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-50 p-3 border border-stone-100">
                      <p className="text-[10px] uppercase font-bold text-stone-400">
                        Score
                      </p>
                      <p className="text-xl font-black mt-1 text-brand-charcoal">
                        {selectedVendorDetail.vendorResponseScore}/100
                      </p>
                    </div>
                    <div className="bg-stone-50 p-3 border border-stone-100">
                      <p className="text-[10px] uppercase font-bold text-stone-400">
                        Avg Response
                      </p>
                      <p className="text-xl font-black mt-1 text-brand-charcoal">
                        {selectedVendorDetail.averageResponseTimeMinutes > 0
                          ? `${selectedVendorDetail.averageResponseTimeMinutes} mins`
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-2 border-b border-stone-100 pb-1">
                      Top Requested Products
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedVendorDetail.topRequestedProducts.length > 0 ? (
                        selectedVendorDetail.topRequestedProducts.map(
                          (p: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase"
                            >
                              {p}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-[10px] text-stone-400 italic">
                          None logged
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-2 border-b border-stone-100 pb-1">
                      Active Communities
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedVendorDetail.topSourceGroups.length > 0 ? (
                        selectedVendorDetail.topSourceGroups.map(
                          (g: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold uppercase truncate max-w-full"
                            >
                              {g}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-[10px] text-stone-400 italic">
                          None logged
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-2 border-b border-stone-100 pb-1">
                      Recent Logs
                    </p>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {selectedVendorDetail.logs
                        .slice(0, 10)
                        .map((log: WhatsAppActivityLog) => (
                          <div
                            key={log.id}
                            className="p-3 border border-stone-200 text-xs"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-[10px] text-stone-500">
                                {log.activityDate}
                              </span>
                              <StatusBadge
                                status={log.activityType}
                                variant="neutral"
                              />
                            </div>
                            <p className="font-medium text-stone-700 truncate">
                              {log.productName ||
                                log.customerNeed ||
                                "General Enquiry"}
                            </p>
                            {log.notes && (
                              <p className="text-[10px] text-stone-500 mt-1 italic truncate">
                                {log.notes}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RPN REPORTS */}
        {activeTab === "rpn" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div
              className={selectedRpnDetail ? "xl:col-span-2" : "xl:col-span-3"}
            >
              <TablePanel
                title="RPN Agent Performance"
                subtitle="Tracking field agent WhatsApp engagement."
                headers={[
                  "RPN Name",
                  "Activities",
                  "Enquiries",
                  "Conversions",
                  "F/Ups Done",
                  "F/Ups Due",
                  "High Priority",
                  "Score",
                  "Action",
                ]}
              >
                {rpnReports.map((r, i) => (
                  <tr
                    key={i}
                    className={`hover:bg-stone-50 border-b border-stone-100 cursor-pointer ${selectedRpnDetail?.assignedRpnName === r.assignedRpnName ? "bg-blue-50/50" : ""}`}
                    onClick={() => setSelectedRpnDetail(r)}
                  >
                    <td className="px-6 py-4 font-bold text-xs uppercase">
                      {r.assignedRpnName}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {r.totalActivitiesLogged}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {r.productEnquiriesHandled}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-emerald-600 font-bold">
                      {r.convertedLeads}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-blue-600">
                      {r.followUpsCompleted}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-brand-orange">
                      {r.followUpsDue > 0 ? r.followUpsDue : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-red-500">
                      {r.highPriorityCases > 0 ? r.highPriorityCases : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-[10px] font-black ${r.rpnActivityScore >= 80 ? "bg-emerald-100 text-emerald-700" : r.rpnActivityScore >= 50 ? "bg-orange-100 text-brand-orange" : "bg-red-100 text-red-700"}`}
                      >
                        {r.rpnActivityScore}/100
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <SecondaryButton
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRpnDetail(r);
                        }}
                      >
                        View Detail
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
                {rpnReports.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-8 text-center text-stone-400 text-xs"
                    >
                      No RPN data available based on filters.
                    </td>
                  </tr>
                )}
              </TablePanel>
            </div>

            {/* RPN Detail Side Panel */}
            {selectedRpnDetail && (
              <div className="bg-white border-2 border-blue-500 shadow-lg p-6 flex flex-col h-fit sticky top-6">
                <div className="flex justify-between items-start mb-6 border-b border-stone-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-brand-charcoal uppercase">
                      {selectedRpnDetail.assignedRpnName}
                    </h3>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-stone-400 mt-1">
                      RPN Activity Detail
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedRpnDetail(null)}
                    className="text-stone-400 hover:text-brand-charcoal"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-50 p-3 border border-stone-100 text-center">
                      <p className="text-[10px] uppercase font-bold text-stone-400">
                        Activity Score
                      </p>
                      <p className="text-2xl font-black mt-1 text-brand-charcoal">
                        {selectedRpnDetail.rpnActivityScore}
                      </p>
                    </div>
                    <div className="bg-stone-50 p-3 border border-stone-100 text-center">
                      <p className="text-[10px] uppercase font-bold text-stone-400">
                        Total Logs
                      </p>
                      <p className="text-2xl font-black mt-1 text-brand-charcoal">
                        {selectedRpnDetail.totalActivitiesLogged}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-2 border-b border-stone-100 pb-1">
                      Active Sectors
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedRpnDetail.activeSectors.length > 0 ? (
                        selectedRpnDetail.activeSectors.map(
                          (s: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase"
                            >
                              {s}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-[10px] text-stone-400 italic">
                          None logged
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-2 border-b border-stone-100 pb-1">
                      Recent Logs
                    </p>
                    <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                      {selectedRpnDetail.logs
                        .slice(0, 10)
                        .map((log: WhatsAppActivityLog) => (
                          <div
                            key={log.id}
                            className="p-3 border border-stone-200 text-xs"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-[10px] text-stone-500">
                                {log.activityDate}
                              </span>
                              <StatusBadge
                                status={log.activityType}
                                variant="neutral"
                              />
                            </div>
                            <p className="font-bold text-brand-charcoal truncate">
                              {log.vendorName || "General Activity"}
                            </p>
                            <p className="font-medium text-stone-500 truncate mt-0.5">
                              {log.productName || log.customerNeed || "N/A"}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRODUCT DEMAND REPORTS */}
        {activeTab === "product" && (
          <TablePanel
            title="Product Demand Intelligence"
            subtitle="Identifying market opportunities from customer requests."
            headers={[
              "Product / Customer Need",
              "Sector",
              "Demand Count",
              "Location Spread",
              "Vendors Linked",
              "Missed Resp.",
              "Opp Score",
            ]}
          >
            {productReports.map((p, i) => (
              <tr
                key={i}
                className="hover:bg-stone-50 border-b border-stone-100"
              >
                <td className="px-6 py-4">
                  <p className="font-bold text-xs uppercase truncate max-w-xs">
                    {p.productName}
                  </p>
                </td>
                <td className="px-6 py-4 text-[10px] font-bold text-stone-500 uppercase">
                  {p.sector}
                </td>
                <td className="px-6 py-4 font-mono text-xs font-bold text-brand-charcoal">
                  {p.demandCount}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-[10px] text-stone-500 uppercase font-bold">
                    <MapPin size={10} /> {p.locationList.length} Area(s)
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-stone-600">
                  {p.vendorList.length} Vendor(s)
                </td>
                <td className="px-6 py-4 font-mono text-xs text-red-500">
                  {p.missedResponses > 0 ? p.missedResponses : "-"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-[10px] font-black ${p.opportunityScore >= 70 ? "bg-emerald-100 text-emerald-700" : p.opportunityScore >= 30 ? "bg-orange-100 text-brand-orange" : "bg-stone-100 text-stone-600"}`}
                  >
                    {p.opportunityScore}/100
                  </span>
                </td>
              </tr>
            ))}
            {productReports.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-stone-400 text-xs"
                >
                  No product demand data available.
                </td>
              </tr>
            )}
          </TablePanel>
        )}

        {/* FOLLOW-UP DESK */}
        {activeTab === "followup" && (
          <TablePanel
            title="Active Follow-up Desk"
            subtitle="Unresolved enquiries, leads, and high priority issues."
            className="border-t-4 border-t-brand-orange"
            headers={[
              "Due Date",
              "Source",
              "Vendor / Product",
              "Customer Need",
              "Captured By",
              "Assigned To",
              "Priority",
              "Status",
              "Action",
            ]}
          >
            {followUpDesk.map((log) => (
              <tr
                key={log.id}
                className="hover:bg-orange-50/30 border-b border-stone-100"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-brand-orange font-mono text-xs font-bold">
                    <Clock size={12} />
                    {log.followUpDate || log.activityDate}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-xs uppercase truncate max-w-[150px]">
                    {log.sourceName}
                  </p>
                  <p className="text-[9px] text-stone-400 uppercase mt-0.5">
                    {log.sourceType?.replace(/_/g, " ")}
                    {log.communityName ? ` • ${log.communityName}` : ""}
                  </p>
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
                  <p className="text-[10px] font-bold text-stone-500 uppercase">
                    {log.capturedByStaffName || "Unknown"}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[10px] font-bold text-brand-charcoal uppercase">
                    {log.assignedStaffName ||
                      log.assignedRpnName ||
                      "Unassigned"}
                  </p>
                  <p className="text-[8px] text-stone-400 uppercase mt-0.5">
                    {log.assignedStaffName
                      ? "Staff"
                      : log.assignedRpnName
                        ? "RPN"
                        : ""}
                  </p>
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
                  <div className="flex flex-col gap-1 items-start">
                    <StatusBadge status={log.leadStatus} variant="neutral" />
                    {log.responseStatus &&
                      log.responseStatus !== "NOT_REQUIRED" && (
                        <StatusBadge
                          status={log.responseStatus}
                          variant="neutral"
                        />
                      )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <SecondaryButton
                      size="sm"
                      onClick={() => handleOpenUpdateModal(log)}
                    >
                      <Edit size={12} className="mr-1" /> Update
                    </SecondaryButton>
                    <PrimaryButton
                      size="sm"
                      onClick={() => handleMarkFollowUpDone(log)}
                    >
                      <CheckCircle2 size={12} className="mr-1" /> Done
                    </PrimaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {followUpDesk.length === 0 && (
              <tr>
                <td colSpan={8} className="p-16 text-center text-stone-400">
                  <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-xs font-black uppercase tracking-widest">
                    Desk is clear. No pending follow-ups.
                  </p>
                </td>
              </tr>
            )}
          </TablePanel>
        )}
      </div>

      {isModalOpen && selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <DataPanel
            title={`Update Follow-up: ${selectedLog.id}`}
            className="w-full max-w-3xl bg-white shadow-2xl border-t-4 border-brand-orange"
          >
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2 flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Assign To Type
                    </label>
                    <select
                      className={inputClass}
                      value={updateFormData.assignedToType || "RPN"}
                      onChange={(e) =>
                        setUpdateFormData({
                          ...updateFormData,
                          assignedToType: e.target.value as
                            | "STAFF"
                            | "RPN"
                            | "ADMIN",
                          assignedRpnId: "",
                          assignedRpnName: "",
                          assignedStaffId: "",
                          assignedStaffName: "",
                        })
                      }
                    >
                      <option value="RPN">RPN</option>
                      <option value="STAFF">Backend Staff</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Assignee
                    </label>
                    {updateFormData.assignedToType === "STAFF" ? (
                      <select
                        className={inputClass}
                        value={updateFormData.assignedStaffId || ""}
                        onChange={(e) => {
                          const s = staffList.find(
                            (r) => r.id === e.target.value,
                          );
                          setUpdateFormData({
                            ...updateFormData,
                            assignedStaffId: s?.id,
                            assignedStaffName: s?.displayName || s?.fullName,
                          });
                        }}
                      >
                        <option value="">Unassigned</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.displayName || s.fullName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className={inputClass}
                        value={updateFormData.assignedRpnId || ""}
                        onChange={(e) => {
                          const rpn = rpns.find((r) => r.id === e.target.value);
                          setUpdateFormData({
                            ...updateFormData,
                            assignedRpnId: rpn?.id,
                            assignedRpnName: rpn?.name,
                          });
                        }}
                      >
                        <option value="">Unassigned</option>
                        {rpns.map((rpn) => (
                          <option key={rpn.id} value={rpn.id}>
                            {rpn.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={updateFormData.followUpDate || ""}
                    onChange={(e) =>
                      setUpdateFormData({
                        ...updateFormData,
                        followUpDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Lead Status
                  </label>
                  <select
                    className={inputClass}
                    value={updateFormData.leadStatus || ""}
                    onChange={(e) =>
                      setUpdateFormData({
                        ...updateFormData,
                        leadStatus: e.target.value as WhatsAppLeadStatus,
                      })
                    }
                  >
                    <option value="NEW">New</option>
                    <option value="REFERRED">Referred</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="FOLLOW_UP_REQUIRED">
                      Follow Up Required
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Priority
                  </label>
                  <select
                    className={inputClass}
                    value={updateFormData.priority || "LOW"}
                    onChange={(e) =>
                      setUpdateFormData({
                        ...updateFormData,
                        priority: e.target.value as any,
                      })
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Follow-up Notes
                </label>
                <textarea
                  className={`${inputClass} min-h-[100px]`}
                  value={updateFormData.notes || ""}
                  onChange={(e) =>
                    setUpdateFormData({
                      ...updateFormData,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Add notes about the follow-up..."
                />
              </div>

              <div className="pt-4 border-t border-stone-200 space-y-3">
                <p className="text-[10px] font-bold uppercase text-stone-400">
                  Quick Actions
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <SecondaryButton
                    onClick={() => handleModalAction("converted")}
                  >
                    <Check size={14} className="mr-1" /> Converted
                  </SecondaryButton>
                  <SecondaryButton onClick={() => handleModalAction("lost")}>
                    <XCircle size={14} className="mr-1" /> Lost
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => handleModalAction("vendorResponded")}
                  >
                    Vendor Responded
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => handleModalAction("vendorDidNotRespond")}
                  >
                    Vendor No-Response
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => handleModalAction("contacted")}
                  >
                    Contacted
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => handleModalAction("escalate")}
                  >
                    <AlertTriangle size={14} className="mr-1" /> Escalate
                  </SecondaryButton>
                </div>
              </div>
            </div>
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex gap-4">
              <SecondaryButton className="w-1/3" onClick={handleModalClose}>
                Cancel
              </SecondaryButton>
              <PrimaryButton className="flex-1" onClick={handleModalSave}>
                <Save size={14} className="mr-2" /> Save Follow-up Details
              </PrimaryButton>
            </div>
          </DataPanel>
        </div>
      )}
    </div>
  );
};
