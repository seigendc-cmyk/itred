/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  DataPanel,
  TablePanel,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  SearchInput,
  StatCard,
  StatusBadge,
} from "../components/CommonUI.tsx";
import {
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Users,
  Activity,
  PhoneCall,
  AlertTriangle,
  X,
  TrendingUp,
} from "lucide-react";
import {
  WhatsAppActivityLog,
  WhatsAppActivityType,
  WhatsAppSourceType,
  WhatsAppLeadStatus,
  WhatsAppPriority,
  WhatsAppResponseStatus,
  WhatsAppSource,
} from "../types.ts";
import { whatsappActivityService } from "../services/whatsappActivityService.ts";
import { rpnService } from "../services/rpnService.ts";
import { staffService } from "../services/staffService.ts";
import { RPN } from "../types.ts";
import { focusMainContent } from "../utils/uiHelpers.ts";
import { whatsappSourceService } from "../services/whatsappSourceService.ts";

export const WhatsAppActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<WhatsAppActivityLog[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<WhatsAppActivityLog>>({});
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [sources, setSources] = useState<WhatsAppSource[]>([]);
  const [sourceSearch, setSourceSearch] = useState("");
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [newSourceData, setNewSourceData] = useState<Partial<WhatsAppSource>>(
    {},
  );

  const sessionStr = localStorage.getItem("activeStaffSession");
  let session: any = {};
  if (sessionStr) {
    try {
      session = JSON.parse(sessionStr);
    } catch (e) {}
  }

  const [search, setSearch] = useState("");
  const [filterActivityType, setFilterActivityType] = useState("all");
  const [filterSourceType, setFilterSourceType] = useState("all");
  const [filterLeadStatus, setFilterLeadStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterFollowUp, setFilterFollowUp] = useState("all");

  useEffect(() => {
    loadData();
    setRpns(rpnService.getAll());
    setStaffList(staffService.getAllStaff());
    setSources(whatsappSourceService.getSources());
  }, []);

  const loadData = () => {
    setLogs(whatsappActivityService.getLogs());
  };

  const bi = useMemo(() => whatsappActivityService.getBI(logs), [logs]);

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        const searchTerms = search
          .toLowerCase()
          .split(" ")
          .filter((t) => t.length > 0);

        const logText = [
          log.activityType,
          log.sourceType,
          log.sourceName,
          log.communityName,
          log.sector,
          log.category,
          log.province,
          log.cityTown,
          log.district,
          log.vendorName,
          log.productName,
          log.customerNeed,
          log.leadStatus,
          log.priority,
          log.notes,
          log.assignedRpnName,
          log.capturedByStaffName,
          log.assignedStaffName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = searchTerms.every((term) =>
          logText.includes(term),
        );

        const matchesActivity =
          filterActivityType === "all" ||
          log.activityType === filterActivityType;
        const matchesSource =
          filterSourceType === "all" || log.sourceType === filterSourceType;
        const matchesLeadStatus =
          filterLeadStatus === "all" || log.leadStatus === filterLeadStatus;
        const matchesPriority =
          filterPriority === "all" || log.priority === filterPriority;
        const matchesFollowUp =
          filterFollowUp === "all" ||
          (filterFollowUp === "yes"
            ? log.followUpRequired
            : !log.followUpRequired);

        return (
          matchesSearch &&
          matchesActivity &&
          matchesSource &&
          matchesLeadStatus &&
          matchesPriority &&
          matchesFollowUp
        );
      })
      .sort(
        (a, b) =>
          new Date(b.activityDate).getTime() -
          new Date(a.activityDate).getTime(),
      );
  }, [
    logs,
    search,
    filterActivityType,
    filterSourceType,
    filterLeadStatus,
    filterPriority,
    filterFollowUp,
  ]);

  const handleAddLog = () => {
    setFormData({
      activityDate: new Date().toISOString().split("T")[0],
      activityType: "OTHER" as WhatsAppActivityType,
      sourceType: "OTHER" as WhatsAppSourceType,
      leadStatus: "NOT_APPLICABLE" as WhatsAppLeadStatus,
      priority: "LOW" as WhatsAppPriority,
      responseStatus: "NOT_REQUIRED" as WhatsAppResponseStatus,
      followUpRequired: false,
    });
    setSourceSearch("");
    setIsFormOpen(true);
    focusMainContent();
  };

  const handleEditLog = (log: WhatsAppActivityLog) => {
    setFormData({ ...log });
    setSourceSearch(log.sourceName || "");
    setIsFormOpen(true);
    focusMainContent();
  };

  const handleDeleteLog = (id: string) => {
    if (confirm("Permanently delete this activity log?")) {
      whatsappActivityService.deleteLog(id);
      loadData();
    }
  };

  const handleMarkFollowUpDone = (log: WhatsAppActivityLog) => {
    whatsappActivityService.updateLog(log.id, {
      followUpRequired: false,
      responseStatus: "RESPONDED",
      notes: log.notes
        ? `${log.notes}\n[Follow-up marked done on ${new Date().toLocaleDateString()}]`
        : `[Follow-up marked done on ${new Date().toLocaleDateString()}]`,
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

  const handleSave = () => {
    if (
      !formData.activityType ||
      !formData.sourceType ||
      !formData.sourceName ||
      !formData.activityDate
    ) {
      alert(
        "Please fill all required fields: Activity Type, Source Type, Source Name, and Activity Date",
      );
      return;
    }

    const cleanObj = (obj: any) => {
      const cleaned = { ...obj };
      Object.keys(cleaned).forEach((key) => {
        if (cleaned[key] === undefined) delete cleaned[key];
      });
      return cleaned;
    };

    const logToSave: WhatsAppActivityLog = {
      ...(formData as WhatsAppActivityLog),
      id: formData.id || `WA-${Date.now()}`,
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      loggedBy: formData.loggedBy || "Staff",
      capturedByStaffId:
        formData.capturedByStaffId || session.staffId || "unknown",
      capturedByStaffName:
        formData.capturedByStaffName || session.staffName || "Unknown Staff",
      capturedByRole: formData.capturedByRole || session.role || "Unknown Role",
      capturedAt: formData.capturedAt || new Date().toISOString(),
      assignedToType: formData.assignedToType || "RPN",
      assignedStaffId: formData.assignedStaffId || "",
      assignedStaffName: formData.assignedStaffName || "",
    };

    whatsappActivityService.saveLog(cleanObj(logToSave));
    loadData();
    setIsFormOpen(false);
    setFormData({});
  };

  const inputClass =
    "w-full border-2 border-stone-200 p-3 text-xs font-bold outline-none focus:border-brand-orange bg-white rounded-none uppercase";

  const matchingSources = useMemo(() => {
    const terms = sourceSearch
      .toLowerCase()
      .split(" ")
      .filter((t) => t.length > 0);
    return sources.filter((s) => {
      const text = [
        s.communityName,
        s.sourceName,
        s.sector,
        s.category,
        s.province,
        s.cityTown,
        s.district,
        s.whatsappUrl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }, [sources, sourceSearch]);

  const handleSelectSource = (s: WhatsAppSource) => {
    setSourceSearch(s.sourceName);
    setFormData({
      ...formData,
      sourceId: s.id,
      sourceName: s.sourceName,
      sourceType: s.sourceType,
      whatsappUrl: s.whatsappUrl || formData.whatsappUrl,
      communityId: s.communityId || formData.communityId,
      communityName: s.communityName || formData.communityName,
      sector: s.sector || formData.sector,
      category: s.category || formData.category,
      province: s.province || formData.province,
      cityTown: s.cityTown || formData.cityTown,
      district: s.district || formData.district,
    });
    setShowSourceDropdown(false);
  };

  const uniqueCommunities = useMemo(() => {
    return Array.from(
      new Set(sources.map((s) => s.communityName).filter(Boolean)),
    ) as string[];
  }, [sources]);

  return (
    <div className="pb-20">
      <PageHeader
        title="WhatsApp Activity"
        subtitle="Track operational engagement across WhatsApp communities, groups and channels."
        actions={
          <PrimaryButton onClick={handleAddLog}>
            <Plus size={14} className="mr-2" /> Log Activity
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Total Activities"
          value={bi.totalLogs.toString()}
          icon={Activity}
        />
        <StatCard
          label="Product Enquiries"
          value={bi.totalEnquiries.toString()}
          icon={MessageSquare}
        />
        <StatCard
          label="Converted Leads"
          value={bi.convertedLeads.toString()}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Follow-ups Due"
          value={bi.followUpsDue.toString()}
          icon={PhoneCall}
          variant={bi.followUpsDue > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="High Priority"
          value={bi.highPriorityCount.toString()}
          icon={AlertTriangle}
          variant={bi.highPriorityCount > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Member Growth"
          value={
            bi.memberGrowthTotal > 0
              ? `+${bi.memberGrowthTotal}`
              : bi.memberGrowthTotal.toString()
          }
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {!isFormOpen ? (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 p-6 flex flex-wrap gap-4 items-center">
            <SearchInput
              placeholder="Search activity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px]"
            />
            <select
              className={inputClass}
              style={{ width: "auto" }}
              value={filterActivityType}
              onChange={(e) => setFilterActivityType(e.target.value)}
            >
              <option value="all">All Activities</option>
              <option value="CATALOGUE_SHARED">Catalogue Shared</option>
              <option value="STOREFRONT_SHARED">Storefront Shared</option>
              <option value="PRODUCT_ENQUIRY">Product Enquiry</option>
              <option value="VENDOR_REFERRAL">Vendor Referral</option>
              <option value="MEMBER_COUNT_UPDATE">Member Count Update</option>
              <option value="FOLLOW_UP_DONE">Follow Up Done</option>
            </select>
            <select
              className={inputClass}
              style={{ width: "auto" }}
              value={filterSourceType}
              onChange={(e) => setFilterSourceType(e.target.value)}
            >
              <option value="all">All Sources</option>
              <option value="WHATSAPP_COMMUNITY">Community</option>
              <option value="WHATSAPP_GROUP">Group</option>
              <option value="WHATSAPP_CHANNEL">Channel</option>
            </select>
            <select
              className={inputClass}
              style={{ width: "auto" }}
              value={filterFollowUp}
              onChange={(e) => setFilterFollowUp(e.target.value)}
            >
              <option value="all">Follow-up: All</option>
              <option value="yes">Follow-up Required</option>
              <option value="no">No Follow-up</option>
            </select>
          </div>

          <TablePanel
            title="Activity Registry"
            subtitle={`${filteredLogs.length} records matching criteria`}
            headers={[
              "Date",
              "Activity",
              "Source",
              "Sector",
              "Details",
              "Priority",
              "Follow-up",
              "Actions",
            ]}
          >
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12">
                  <EmptyState
                    title="No Activity Logs"
                    description="Try adjusting your filters or log a new activity."
                  />
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-stone-50 border-b border-stone-100"
                >
                  <td className="px-6 py-4 font-mono text-xs text-stone-500 whitespace-nowrap">
                    {log.activityDate}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold uppercase text-brand-charcoal">
                      {log.activityType.replace(/_/g, " ")}
                    </span>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {log.leadStatus}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold">{log.sourceName}</p>
                    <p className="text-[10px] text-stone-400 uppercase">
                      {log.sourceType.replace(/_/g, " ")}{" "}
                      {log.communityName ? `• ${log.communityName}` : ""}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium uppercase text-stone-600">
                    {log.sector || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs max-w-xs truncate text-stone-600">
                      {log.vendorName && (
                        <span className="font-bold">{log.vendorName}</span>
                      )}
                      {log.productName && <span>: {log.productName}</span>}
                      {log.customerNeed && (
                        <p className="truncate opacity-80 mt-0.5">
                          {log.customerNeed}
                        </p>
                      )}
                      {!log.vendorName &&
                        !log.productName &&
                        !log.customerNeed &&
                        "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={log.priority}
                      variant={
                        log.priority === "HIGH" || log.priority === "CRITICAL"
                          ? "error"
                          : log.priority === "MEDIUM"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </td>
                  <td className="px-6 py-4">
                    {log.followUpRequired ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded-none self-start">
                          Required
                        </span>
                        <span className="text-[10px] text-stone-500">
                          {log.followUpDate || "No date set"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {log.followUpRequired && (
                        <button
                          onClick={() => handleMarkFollowUpDone(log)}
                          className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all"
                          title="Mark Follow-up Done"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditLog(log)}
                        className="p-1.5 text-stone-400 hover:text-brand-charcoal hover:bg-stone-100 transition-all border border-transparent hover:border-stone-200"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-200"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </TablePanel>
        </div>
      ) : (
        <DataPanel
          title={
            formData.id ? "Edit Activity Log" : "Log New WhatsApp Activity"
          }
          className="max-w-4xl mx-auto shadow-xl border-t-4 border-t-brand-charcoal rounded-none"
        >
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Activity Type *
                </label>
                <select
                  className={inputClass}
                  value={formData.activityType || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      activityType: e.target.value as WhatsAppActivityType,
                    })
                  }
                >
                  <option value="">Select Type</option>
                  <option value="CATALOGUE_SHARED">Catalogue Shared</option>
                  <option value="STOREFRONT_SHARED">Storefront Shared</option>
                  <option value="PRODUCT_ENQUIRY">Product Enquiry</option>
                  <option value="VENDOR_REFERRAL">Vendor Referral</option>
                  <option value="CUSTOMER_REQUEST">Customer Request</option>
                  <option value="MEMBER_COUNT_UPDATE">
                    Member Count Update
                  </option>
                  <option value="FOLLOW_UP_DONE">Follow Up Done</option>
                  <option value="VENDOR_RESPONDED">Vendor Responded</option>
                  <option value="VENDOR_DID_NOT_RESPOND">
                    Vendor Did Not Respond
                  </option>
                  <option value="COMPLAINT_RECEIVED">Complaint Received</option>
                  <option value="GROUP_INACTIVE">Group Inactive</option>
                  <option value="DEMAND_SIGNAL">Demand Signal</option>
                  <option value="SPAM_OR_FALSE_LISTING">
                    Spam / False Listing
                  </option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Activity Date *
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={formData.activityDate || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, activityDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Source Type *
                </label>
                <select
                  className={inputClass}
                  value={formData.sourceType || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sourceType: e.target.value as WhatsAppSourceType,
                    })
                  }
                >
                  <option value="">Select Source</option>
                  <option value="WHATSAPP_COMMUNITY">WhatsApp Community</option>
                  <option value="WHATSAPP_GROUP">WhatsApp Group</option>
                  <option value="WHATSAPP_CHANNEL">WhatsApp Channel</option>
                  <option value="DIRECT_WHATSAPP">Direct WhatsApp</option>
                  <option value="BROADCAST_LIST">Broadcast List</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2 relative">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  WhatsApp Group / Channel *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className={inputClass}
                      value={sourceSearch}
                      onChange={(e) => {
                        setSourceSearch(e.target.value);
                        setShowSourceDropdown(true);
                        setFormData({
                          ...formData,
                          sourceName: e.target.value,
                          sourceId: undefined,
                        });
                      }}
                      onFocus={() => setShowSourceDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowSourceDropdown(false), 200)
                      }
                      placeholder="Search or type new group..."
                    />
                    {showSourceDropdown && sourceSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-brand-charcoal shadow-2xl max-h-60 overflow-y-auto z-50">
                        {matchingSources.map((s) => (
                          <div
                            key={s.id}
                            className="p-3 border-b border-stone-100 cursor-pointer hover:bg-orange-50 transition-colors"
                            onMouseDown={() => handleSelectSource(s)}
                          >
                            <p className="text-xs font-bold uppercase">
                              {s.sourceName}
                            </p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase truncate">
                              {[
                                s.sourceType,
                                s.communityName,
                                s.sector,
                                s.cityTown,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          </div>
                        ))}
                        <div
                          className="p-3 bg-stone-50 cursor-pointer hover:bg-stone-100 transition-colors border-t border-stone-200"
                          onMouseDown={() => {
                            setNewSourceData({
                              sourceName: sourceSearch,
                              sourceType:
                                formData.sourceType || "WHATSAPP_GROUP",
                              status: "active",
                              communityName: formData.communityName || "",
                              sector: formData.sector || "",
                              category: formData.category || "",
                              province: formData.province || "",
                              cityTown: formData.cityTown || "",
                              district: formData.district || "",
                              whatsappUrl: formData.whatsappUrl || "",
                            });
                            setIsSourceModalOpen(true);
                          }}
                        >
                          <p className="text-xs font-bold uppercase text-brand-orange flex items-center gap-2">
                            <Plus size={14} /> Add "{sourceSearch}" as New Group
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Community Name
                </label>
                <input
                  list="community-names-list"
                  type="text"
                  className={inputClass}
                  value={formData.communityName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, communityName: e.target.value })
                  }
                  placeholder="Search or type community..."
                />
                <datalist id="community-names-list">
                  {uniqueCommunities.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Sector
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={formData.sector || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, sector: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Category
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={formData.category || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  City / Town
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={formData.cityTown || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cityTown: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="p-6 bg-stone-50 border border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Customer Need / Requested Item
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={formData.customerNeed || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, customerNeed: e.target.value })
                  }
                  placeholder="e.g. Looking for Toyota Aqua brake pads"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Vendor Name
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={formData.vendorName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, vendorName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Product Name
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={formData.productName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, productName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Lead Status
                </label>
                <select
                  className={inputClass}
                  value={formData.leadStatus || "NOT_APPLICABLE"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      leadStatus: e.target.value as WhatsAppLeadStatus,
                    })
                  }
                >
                  <option value="NEW">New</option>
                  <option value="REFERRED">Referred</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="CONVERTED">Converted</option>
                  <option value="LOST">Lost</option>
                  <option value="FOLLOW_UP_REQUIRED">Follow Up Required</option>
                  <option value="NOT_APPLICABLE">Not Applicable</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Priority
                </label>
                <select
                  className={inputClass}
                  value={formData.priority || "LOW"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as WhatsAppPriority,
                    })
                  }
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Response Status
                </label>
                <select
                  className={inputClass}
                  value={formData.responseStatus || "NOT_REQUIRED"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      responseStatus: e.target.value as WhatsAppResponseStatus,
                    })
                  }
                >
                  <option value="NOT_REQUIRED">Not Required</option>
                  <option value="PENDING">Pending</option>
                  <option value="RESPONDED">Responded</option>
                  <option value="MISSED">Missed</option>
                  <option value="ESCALATED">Escalated</option>
                </select>
              </div>
            </div>

            <div className="p-6 bg-orange-50 border border-orange-200 grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-brand-orange"
                  checked={!!formData.followUpRequired}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      followUpRequired: e.target.checked,
                    })
                  }
                />
                <span className="text-sm font-bold uppercase text-brand-charcoal">
                  Follow-up Required
                </span>
              </label>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-500">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  className={`${inputClass} border-orange-200 bg-white`}
                  value={formData.followUpDate || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, followUpDate: e.target.value })
                  }
                  disabled={!formData.followUpRequired}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                Notes & Context
              </label>
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional details..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Assign Follow-up to RPN
                </label>
                <div className="flex gap-2">
                  <select
                    className={inputClass}
                    value={formData.assignedToType || "RPN"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
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
                  {formData.assignedToType === "STAFF" ? (
                    <select
                      className={inputClass}
                      value={formData.assignedStaffId || ""}
                      onChange={(e) => {
                        const s = staffList.find(
                          (r) => r.id === e.target.value,
                        );
                        setFormData({
                          ...formData,
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
                      value={formData.assignedRpnId || ""}
                      onChange={(e) => {
                        const rpn = rpns.find((r) => r.id === e.target.value);
                        setFormData({
                          ...formData,
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
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">
                  Captured By (System)
                </label>
                <input
                  type="text"
                  className={`${inputClass} bg-stone-50 text-stone-500 border-dashed cursor-not-allowed`}
                  disabled
                  value={
                    formData.capturedByStaffName ||
                    session.staffName ||
                    "Unknown Staff"
                  }
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-stone-100">
              <SecondaryButton
                className="flex-1 py-4"
                onClick={() => setIsFormOpen(false)}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton className="flex-1 py-4" onClick={handleSave}>
                Save Activity Log
              </PrimaryButton>
            </div>
          </div>
        </DataPanel>
      )}

      {isSourceModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-charcoal/40 backdrop-blur-sm p-4">
          <DataPanel
            title="Add WhatsApp Group / Channel"
            className="max-w-2xl w-full shadow-2xl border-t-4 border-t-brand-orange bg-white"
          >
            <div className="p-6 overflow-y-auto space-y-6 max-h-[80vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Source Name / Group *
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.sourceName || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        sourceName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Source Type
                  </label>
                  <select
                    className={inputClass}
                    value={newSourceData.sourceType || "WHATSAPP_GROUP"}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        sourceType: e.target.value as any,
                      })
                    }
                  >
                    <option value="WHATSAPP_COMMUNITY">
                      WhatsApp Community
                    </option>
                    <option value="WHATSAPP_GROUP">WhatsApp Group</option>
                    <option value="WHATSAPP_CHANNEL">WhatsApp Channel</option>
                    <option value="BROADCAST_LIST">Broadcast List</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Community Name
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.communityName || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        communityName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    WhatsApp URL
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.whatsappUrl || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        whatsappUrl: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Sector
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.sector || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        sector: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Category
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.category || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        category: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Province
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.province || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        province: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    City / Town
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.cityTown || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        cityTown: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    District
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.district || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        district: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Member Count
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={newSourceData.memberCount || 0}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        memberCount: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-4 shrink-0">
              <SecondaryButton
                onClick={() => setIsSourceModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                className="flex-1"
                onClick={() => {
                  if (!newSourceData.sourceName)
                    return alert("Source name required");
                  const sourceToSave: WhatsAppSource = {
                    ...newSourceData,
                    id: `WS-${Date.now()}`,
                    sourceType: newSourceData.sourceType || "WHATSAPP_GROUP",
                    status: newSourceData.status || "active",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  } as WhatsAppSource;
                  whatsappSourceService.saveSource(sourceToSave);
                  setSources(whatsappSourceService.getSources());
                  handleSelectSource(sourceToSave);
                  setIsSourceModalOpen(false);
                  alert("WhatsApp source saved.");
                }}
              >
                Save Source & Select
              </PrimaryButton>
            </div>
          </DataPanel>
        </div>
      )}
    </div>
  );
};
