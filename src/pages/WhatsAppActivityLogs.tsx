/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  DataPanel,
  TablePanel,
  PrimaryButton,
  SecondaryButton,
  SearchInput,
  StatCard,
  StatusBadge,
  EmptyState,
} from "../components/CommonUI.tsx";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Download,
  History,
  Map as MapIcon,
  MessageSquare,
  PackageSearch,
  Phone,
  Search,
  ShieldAlert,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import {
  IntelligenceSource,
  InteractionType,
  Product,
  ResolutionStatus,
  Sentiment,
  Staff,
  UrgencyLevel,
  Vendor,
  WhatsAppActivityLog,
  WhatsAppIntelligenceLog,
} from "../types.ts";
import { whatsappActivityService } from "../services/whatsappActivityService.ts";
import { staffService } from "../services/staffService.ts";
import { vendorService } from "../services/vendorService.ts";
import { productService } from "../services/productService.ts";
import { staffAuditService } from "../services/staffAuditService.ts";
import { permissionService } from "../services/permissionService.ts";
import { notificationService } from "../services/notificationService.ts";

type IntelTab =
  | "feed"
  | "customer"
  | "risks"
  | "market"
  | "alerts"
  | "reputation"
  | "regional"
  | "product";

const tabs: Array<{ id: IntelTab; label: string; icon: React.ElementType }> = [
  { id: "feed", label: "Activity Feed", icon: History },
  { id: "customer", label: "Customer Intelligence", icon: UserPlus },
  { id: "risks", label: "Complaints & Risks", icon: ShieldAlert },
  { id: "market", label: "Market Analytics", icon: BarChart3 },
  { id: "alerts", label: "Live Alerts", icon: Bell },
  { id: "reputation", label: "Vendor Reputation", icon: Star },
  { id: "regional", label: "Regional BI", icon: MapIcon },
  { id: "product", label: "Product Intelligence", icon: PackageSearch },
];

const interactionTypes: InteractionType[] = [
  "Enquiry",
  "Complaint",
  "Compliment",
  "Price Request",
  "Delivery Complaint",
  "Stock Request",
  "Warranty Issue",
  "Fraud Alert",
  "Product Search",
  "Service Request",
  "Market Feedback",
];

const sources: IntelligenceSource[] = [
  "WhatsApp",
  "Call",
  "Walk-in",
  "Catalogue",
  "CAH",
  "Storefront",
];

const urgencyLevels: UrgencyLevel[] = ["Low", "Medium", "High", "Critical"];
const statuses: ResolutionStatus[] = [
  "Pending",
  "In Progress",
  "Resolved",
  "Escalated",
];
const sentiments: Sentiment[] = ["Positive", "Neutral", "Negative"];

const inputClass =
  "w-full border-2 border-stone-200 bg-white p-3 text-xs font-bold uppercase outline-none rounded-none focus:border-brand-orange";

const today = () => new Date().toISOString().split("T")[0];
const asList = (value: Record<string, number>, limit = 8) =>
  Object.entries(value || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

const isComplaint = (type?: InteractionType) =>
  type === "Complaint" ||
  type === "Delivery Complaint" ||
  type === "Warranty Issue" ||
  type === "Fraud Alert";

const badgeVariant = (value?: string) => {
  if (value === "Critical" || value === "Escalated" || value === "Negative")
    return "error" as const;
  if (value === "High" || value === "Pending" || value === "In Progress")
    return "warning" as const;
  if (value === "Resolved" || value === "Positive" || value === "Low")
    return "success" as const;
  return "neutral" as const;
};

export const WhatsAppActivityLogs: React.FC = () => {
  const [activityLogs, setActivityLogs] = useState<WhatsAppActivityLog[]>([]);
  const [intelLogs, setIntelLogs] = useState<WhatsAppIntelligenceLog[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<IntelTab>("customer");
  const [search, setSearch] = useState("");
  const [showPopupFeed, setShowPopupFeed] = useState(true);
  const [formData, setFormData] = useState<Partial<WhatsAppIntelligenceLog>>({
    source: "WhatsApp",
    interactionType: "Enquiry",
    urgencyLevel: "Medium",
    resolutionStatus: "Pending",
    sentiment: "Neutral",
    followUpRequired: false,
    actionRequired: false,
    tags: [],
  });

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("activeStaffSession") || "{}");
    } catch {
      return {};
    }
  }, []);

  const canCreate = permissionService.hasActionPermission("whatsapp.logs.create");
  const canViewAnalytics =
    permissionService.hasActionPermission("whatsapp.analytics.view") ||
    permissionService.canView("whatsappActivity");
  const canViewReputation = permissionService.canViewVendorReputation();

  const loadData = async () => {
    setActivityLogs(whatsappActivityService.getLogs());
    setIntelLogs(whatsappActivityService.getIntelligenceLogs());
    setStaffList(staffService.getAllStaff());
    setVendors(await vendorService.getVendors());
    setProducts(await productService.getProducts());
  };

  useEffect(() => {
    void loadData();
  }, []);

  const commerceBI = useMemo(
    () => whatsappActivityService.calculateCommerceBI(intelLogs),
    [intelLogs],
  );

  const filteredIntelLogs = useMemo(() => {
    const terms = search.toLowerCase().split(" ").filter(Boolean);
    return intelLogs
      .filter((log) => {
        const text = [
          log.customerPhone,
          log.customerName,
          log.vendorName,
          log.productName,
          log.category,
          log.sector,
          log.region,
          log.province,
          log.city,
          log.interactionType,
          log.customerMessage,
          log.internalNotes,
          ...(log.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return terms.every((term) => text.includes(term));
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [intelLogs, search]);

  const customerTimeline = useMemo(() => {
    if (!formData.customerPhone) return [];
    return intelLogs
      .filter((log) => log.customerPhone === formData.customerPhone)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [formData.customerPhone, intelLogs]);

  const legacyFeed = useMemo(() => {
    const terms = search.toLowerCase().split(" ").filter(Boolean);
    return activityLogs
      .filter((log) => {
        const text = [
          log.activityType,
          log.sourceName,
          log.vendorName,
          log.productName,
          log.customerNeed,
          log.cityTown,
          log.province,
          log.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return terms.every((term) => text.includes(term));
      })
      .sort(
        (a, b) =>
          new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime(),
      );
  }, [activityLogs, search]);

  const handlePullCustomer = () => {
    if (!formData.customerPhone) {
      alert("Enter a customer phone number first.");
      return;
    }
    const latest = customerTimeline[0];
    if (!latest) {
      alert("No existing customer intelligence records found.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      customerName: latest.customerName,
      region: latest.region,
      province: latest.province,
      city: latest.city,
      vendorName: latest.vendorName,
      productName: latest.productName,
    }));
  };

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    setFormData((prev) => ({
      ...prev,
      vendorId,
      vendorName: vendor?.tradingName || vendor?.name || prev.vendorName,
      sector: vendor?.sector || prev.sector,
      province: vendor?.province || prev.province,
      city: vendor?.cityTown || prev.city,
      region: vendor?.suburb || prev.region,
    }));
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    setFormData((prev) => ({
      ...prev,
      productId,
      productName: product?.name || prev.productName,
      category: product?.category || prev.category,
      sector: product?.sector || prev.sector,
      vendorId: product?.vendorId || prev.vendorId,
      vendorName: product?.vendorName || prev.vendorName,
    }));
  };

  const handleAssignStaff = (staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId);
    setFormData((prev) => ({
      ...prev,
      assignedToStaffId: staff?.id || "",
      assignedToStaffName: staff?.displayName || staff?.fullName || "",
    }));
  };

  const resetForm = () => {
    setFormData({
      source: "WhatsApp",
      interactionType: "Enquiry",
      urgencyLevel: "Medium",
      resolutionStatus: "Pending",
      sentiment: "Neutral",
      followUpRequired: false,
      actionRequired: false,
      tags: [],
    });
  };

  const handleSaveIntel = async () => {
    if (!canCreate) {
      alert("You do not have permission to create WhatsApp logs.");
      return;
    }
    if (!formData.customerPhone || !formData.interactionType) {
      alert("Customer Phone and Interaction Type are required.");
      return;
    }

    const now = new Date().toISOString();
    const record: WhatsAppIntelligenceLog = {
      id: formData.id || `INTEL-${Date.now()}`,
      createdAt: formData.createdAt || now,
      updatedAt: now,
      loggedByStaffId: session.staffId || "unknown",
      loggedByStaffName: session.staffName || session.displayName || "Unknown Staff",
      customerName: formData.customerName || "",
      customerPhone: formData.customerPhone,
      vendorId: formData.vendorId || "",
      vendorName: formData.vendorName || "",
      productId: formData.productId || "",
      productName: formData.productName || "",
      category: formData.category || "",
      sector: formData.sector || "",
      region: formData.region || "",
      province: formData.province || "",
      city: formData.city || "",
      source: (formData.source as IntelligenceSource) || "WhatsApp",
      interactionType: formData.interactionType as InteractionType,
      customerMessage: formData.customerMessage || "",
      internalNotes: formData.internalNotes || "",
      actionRequired: !!formData.actionRequired,
      urgencyLevel: (formData.urgencyLevel as UrgencyLevel) || "Medium",
      resolutionStatus:
        (formData.resolutionStatus as ResolutionStatus) || "Pending",
      assignedToStaffId: formData.assignedToStaffId || "",
      assignedToStaffName: formData.assignedToStaffName || "",
      followUpRequired: !!formData.followUpRequired,
      followUpDate: formData.followUpDate || "",
      tags: formData.tags || [],
      sentiment: (formData.sentiment as Sentiment) || "Neutral",
    };

    whatsappActivityService.saveIntelligenceLog(record);
    await staffAuditService.logAction({
      eventType: formData.id ? "RECORD_UPDATED" : "WHATSAPP_INTELLIGENCE_LOGGED",
      module: "whatsapp",
      severity:
        record.urgencyLevel === "Critical" || record.interactionType === "Fraud Alert"
          ? "critical"
          : isComplaint(record.interactionType)
            ? "high"
            : "info",
      action: `${formData.id ? "Updated" : "Created"} customer intelligence record ${record.id}`,
      recordType: "whatsapp_intelligence",
      recordId: record.id,
      afterSnapshot: record,
    });
    if (record.followUpRequired) {
      await staffAuditService.logAction({
        eventType: "FOLLOWUP_ASSIGNED",
        module: "whatsapp",
        severity: "info",
        action: `Assigned follow-up for ${record.customerPhone}`,
        recordType: "whatsapp_intelligence",
        recordId: record.id,
      });
    }
    await loadData();
    resetForm();
    setActiveTab("feed");
    notificationService.toast("Customer intelligence saved.", "success");
  };

  const handleResolve = async (log: WhatsAppIntelligenceLog) => {
    const updated = {
      ...log,
      resolutionStatus: "Resolved" as ResolutionStatus,
      followUpRequired: false,
      updatedAt: new Date().toISOString(),
    };
    whatsappActivityService.saveIntelligenceLog(updated);
    await staffAuditService.logAction({
      eventType: "COMPLAINT_RESOLVED",
      module: "whatsapp",
      severity: "info",
      action: `Resolved intelligence issue ${log.id}`,
      recordType: "whatsapp_intelligence",
      recordId: log.id,
      beforeSnapshot: log,
      afterSnapshot: updated,
    });
    await loadData();
  };

  const handleEscalate = async (log: WhatsAppIntelligenceLog) => {
    const updated = {
      ...log,
      resolutionStatus: "Escalated" as ResolutionStatus,
      urgencyLevel: "Critical" as UrgencyLevel,
      flaggedRisk: true,
      updatedAt: new Date().toISOString(),
    };
    whatsappActivityService.saveIntelligenceLog(updated);
    await staffAuditService.logAction({
      eventType: "ISSUE_ESCALATED",
      module: "whatsapp",
      severity: "critical",
      action: `Escalated intelligence issue ${log.id}`,
      recordType: "whatsapp_intelligence",
      recordId: log.id,
      beforeSnapshot: log,
      afterSnapshot: updated,
    });
    await notificationService.createNotification({
      type: "system_alert",
      priority: "critical",
      title: "WhatsApp Issue Escalated",
      message: `${log.interactionType} for ${log.vendorName || log.customerPhone} was escalated.`,
      recordType: "whatsapp_intelligence",
      recordId: log.id,
      dedupeKey: `intel-escalated:${log.id}:${today()}`,
    });
    await loadData();
  };

  const exportCsv = () => {
    const headers = [
      "createdAt",
      "customerPhone",
      "customerName",
      "vendorName",
      "productName",
      "category",
      "sector",
      "region",
      "province",
      "city",
      "source",
      "interactionType",
      "urgencyLevel",
      "resolutionStatus",
      "sentiment",
      "assignedToStaffName",
      "followUpDate",
      "tags",
      "customerMessage",
    ];
    const csv = [
      headers.join(","),
      ...filteredIntelLogs.map((log) =>
        headers
          .map((key) => {
            const value = key === "tags" ? log.tags?.join("|") : (log as any)[key];
            return `"${String(value || "").replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `whatsapp-intelligence-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    void staffAuditService.logAction({
      eventType: "EXPORT_DOWNLOADED",
      module: "whatsapp",
      severity: "info",
      action: "Exported WhatsApp intelligence CSV",
      recordType: "whatsapp_intelligence",
      recordId: "csv-export",
    });
  };

  const renderRankList = (
    title: string,
    data: Record<string, number>,
    empty = "No signals yet.",
  ) => (
    <DataPanel title={title} className="border-t-4 border-t-brand-orange">
      <div className="p-4 space-y-3">
        {asList(data).map(([name, count], index) => (
          <div
            key={name}
            className="flex items-center justify-between border border-stone-200 p-3"
          >
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-brand-charcoal truncate">
                {index + 1}. {name}
              </p>
              <p className="text-[10px] font-bold uppercase text-stone-400">
                Commerce signal count
              </p>
            </div>
            <span className="font-mono text-xl font-black text-brand-orange">
              {count}
            </span>
          </div>
        ))}
        {asList(data).length === 0 && (
          <p className="p-6 text-center text-xs font-bold uppercase text-stone-400">
            {empty}
          </p>
        )}
      </div>
    </DataPanel>
  );

  const renderCustomerForm = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] gap-6">
      <DataPanel
        title="Customer Intelligence Intake"
        subtitle="Structured market intelligence capture with audit, alerts and follow-up routing."
        className="border-t-4 border-t-brand-orange"
      >
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-stone-50 border border-stone-200 p-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-stone-400">
                Auto Date / Time
              </p>
              <p className="text-xs font-black text-brand-charcoal">
                {new Date().toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-stone-400">
                Logged By
              </p>
              <p className="text-xs font-black text-brand-charcoal">
                {session.staffName || session.displayName || "Unknown Staff"}
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-stone-400">
                Source
              </label>
              <select
                className={inputClass}
                value={formData.source || "WhatsApp"}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value as IntelligenceSource })
                }
              >
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <SecondaryButton className="w-full" onClick={handlePullCustomer}>
                <Search size={13} className="mr-2" /> Pull Existing Customer
              </SecondaryButton>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Customer Phone *
              </span>
              <input
                className={inputClass}
                value={formData.customerPhone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, customerPhone: e.target.value })
                }
                placeholder="+263..."
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Customer Name
              </span>
              <input
                className={inputClass}
                value={formData.customerName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, customerName: e.target.value })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Vendor
              </span>
              <select
                className={inputClass}
                value={formData.vendorId || ""}
                onChange={(e) => handleVendorChange(e.target.value)}
              >
                <option value="">Manual / Unlinked Vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.tradingName || vendor.name}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                value={formData.vendorName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, vendorName: e.target.value })
                }
                placeholder="Vendor name"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Product
              </span>
              <select
                className={inputClass}
                value={formData.productId || ""}
                onChange={(e) => handleProductChange(e.target.value)}
              >
                <option value="">Manual / Unlinked Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                value={formData.productName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, productName: e.target.value })
                }
                placeholder="Product name"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(["sector", "category", "province", "city"] as const).map((field) => (
              <label key={field} className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  {field}
                </span>
                <input
                  className={inputClass}
                  value={(formData[field] as string) || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [field]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Region / Suburb
              </span>
              <input
                className={inputClass}
                value={formData.region || ""}
                onChange={(e) =>
                  setFormData({ ...formData, region: e.target.value })
                }
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Interaction Type *
              </span>
              <select
                className={inputClass}
                value={formData.interactionType || "Enquiry"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    interactionType: e.target.value as InteractionType,
                  })
                }
              >
                {interactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-[10px] font-bold uppercase text-stone-400">
              Query / Complaint / Compliment
            </span>
            <textarea
              className={`${inputClass} min-h-[120px] normal-case`}
              value={formData.customerMessage || ""}
              onChange={(e) =>
                setFormData({ ...formData, customerMessage: e.target.value })
              }
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="flex items-center gap-3 border border-stone-200 p-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-orange"
                checked={!!formData.actionRequired}
                onChange={(e) =>
                  setFormData({ ...formData, actionRequired: e.target.checked })
                }
              />
              <span className="text-xs font-black uppercase">Action Required</span>
            </label>
            <label className="flex items-center gap-3 border border-stone-200 p-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-orange"
                checked={!!formData.followUpRequired}
                onChange={(e) =>
                  setFormData({ ...formData, followUpRequired: e.target.checked })
                }
              />
              <span className="text-xs font-black uppercase">Follow-up Required</span>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Urgency
              </span>
              <select
                className={inputClass}
                value={formData.urgencyLevel || "Medium"}
                onChange={(e) =>
                  setFormData({ ...formData, urgencyLevel: e.target.value as UrgencyLevel })
                }
              >
                {urgencyLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Sentiment
              </span>
              <select
                className={inputClass}
                value={formData.sentiment || "Neutral"}
                onChange={(e) =>
                  setFormData({ ...formData, sentiment: e.target.value as Sentiment })
                }
              >
                {sentiments.map((sentiment) => (
                  <option key={sentiment} value={sentiment}>
                    {sentiment}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Assigned Staff
              </span>
              <select
                className={inputClass}
                value={formData.assignedToStaffId || ""}
                onChange={(e) => handleAssignStaff(e.target.value)}
              >
                <option value="">Unassigned</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.displayName || staff.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Follow-up Date
              </span>
              <input
                type="date"
                className={inputClass}
                value={formData.followUpDate || ""}
                onChange={(e) =>
                  setFormData({ ...formData, followUpDate: e.target.value })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Resolution Status
              </span>
              <select
                className={inputClass}
                value={formData.resolutionStatus || "Pending"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    resolutionStatus: e.target.value as ResolutionStatus,
                  })
                }
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-[10px] font-bold uppercase text-stone-400">
              Tags
            </span>
            <input
              className={inputClass}
              value={(formData.tags || []).join(", ")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tags: e.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              placeholder="delivery, stock, pricing"
            />
          </label>

          <label className="space-y-2 block">
            <span className="text-[10px] font-bold uppercase text-stone-400">
              Internal Notes
            </span>
            <textarea
              className={`${inputClass} min-h-[90px] normal-case`}
              value={formData.internalNotes || ""}
              onChange={(e) =>
                setFormData({ ...formData, internalNotes: e.target.value })
              }
            />
          </label>

          <div className="flex flex-col sm:flex-row gap-3 border-t border-stone-200 pt-5">
            <SecondaryButton className="sm:w-40" onClick={resetForm}>
              Clear
            </SecondaryButton>
            <PrimaryButton className="flex-1" onClick={handleSaveIntel}>
              <CheckCircle2 size={15} className="mr-2" /> Save Intelligence Record
            </PrimaryButton>
          </div>
        </div>
      </DataPanel>

      <DataPanel
        title="Customer Timeline"
        subtitle="Previous interactions pulled by phone number."
      >
        <div className="p-4 space-y-3">
          {customerTimeline.map((log) => (
            <div key={log.id} className="border-l-4 border-brand-orange bg-stone-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-brand-charcoal">
                    {log.interactionType}
                  </p>
                  <p className="text-[10px] font-bold text-stone-400">
                    {new Date(log.createdAt).toLocaleString()} by {log.loggedByStaffName}
                  </p>
                </div>
                <StatusBadge
                  status={log.resolutionStatus}
                  variant={badgeVariant(log.resolutionStatus)}
                />
              </div>
              <p className="mt-3 text-xs font-semibold text-stone-700">
                {log.customerMessage || log.internalNotes || "No message captured."}
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase text-stone-400">
                {log.vendorName || "No vendor"} / {log.productName || "No product"}
              </p>
            </div>
          ))}
          {customerTimeline.length === 0 && (
            <EmptyState
              icon={Phone}
              title="No Customer History"
              description="Enter a phone number and pull an existing customer to view the timeline."
            />
          )}
        </div>
      </DataPanel>
    </div>
  );

  return (
    <div className="pb-20 space-y-6">
      <PageHeader
        title="WhatsApp Activity"
        subtitle="Commerce intelligence operations layer for SCI / iTred."
        actions={
          <div className="flex gap-2">
            <SecondaryButton onClick={exportCsv}>
              <Download size={14} className="mr-2" /> Export
            </SecondaryButton>
            <PrimaryButton onClick={() => setActiveTab("customer")}>
              <UserPlus size={14} className="mr-2" /> Customer Intelligence
            </PrimaryButton>
          </div>
        }
      />

      <div className="sticky top-0 z-20 border-b-4 border-brand-charcoal bg-white">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-[54px] items-center gap-2 whitespace-nowrap px-4 text-[10px] font-black uppercase tracking-tight transition-colors ${
                activeTab === tab.id
                  ? "bg-brand-orange text-white"
                  : "text-stone-500 hover:bg-stone-50"
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Interactions"
          value={commerceBI.totalInteractions}
          icon={MessageSquare}
        />
        <StatCard
          label="Complaints Today"
          value={commerceBI.complaintsToday}
          icon={AlertTriangle}
          variant={commerceBI.complaintsToday > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Compliments Today"
          value={commerceBI.complimentsToday}
          icon={Star}
          variant="success"
        />
        <StatCard
          label="Unresolved Complaints"
          value={commerceBI.unresolvedComplaints}
          icon={ShieldAlert}
          variant={commerceBI.unresolvedComplaints > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Follow-ups Overdue"
          value={commerceBI.followUpsOverdue}
          icon={Bell}
          variant={commerceBI.followUpsOverdue > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Return Rate"
          value={`${commerceBI.returnInteractionRate}%`}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Advanced search: customer, vendor, product, region, tags..."
          className="w-full"
        />
        <div className="flex gap-2">
          <StatusBadge status={`Avg Resolution ${commerceBI.averageResolutionDays}d`} />
          <StatusBadge
            status={`${commerceBI.fraudAlerts} Fraud Alerts`}
            variant={commerceBI.fraudAlerts > 0 ? "error" : "neutral"}
          />
        </div>
      </div>

      {showPopupFeed && commerceBI.alerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(380px,calc(100vw-2rem))] space-y-3">
          {commerceBI.alerts.slice(0, 2).map((alert) => (
            <div
              key={alert.id}
              className="border-2 border-brand-charcoal bg-white p-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-brand-charcoal">
                    SCI Intelligence Feed
                  </p>
                  <p className="mt-1 text-sm font-bold text-brand-orange">
                    {alert.title}
                  </p>
                </div>
                <button
                  className="text-[10px] font-black uppercase text-stone-400"
                  onClick={() => setShowPopupFeed(false)}
                >
                  Dismiss
                </button>
              </div>
              <p className="mt-2 text-xs font-semibold text-stone-600">
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "customer" && renderCustomerForm()}

      {activeTab === "feed" && (
        <TablePanel
          title="Activity Feed"
          subtitle="Unified view of legacy WhatsApp logs and new customer intelligence records."
          headers={[
            "Date",
            "Type",
            "Customer / Source",
            "Vendor",
            "Product / Need",
            "Status",
            "Staff",
          ]}
        >
          {filteredIntelLogs.map((log) => (
            <tr key={log.id} className="hover:bg-orange-50/30">
              <td className="px-6 py-4 text-[10px] font-bold text-stone-400">
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className="px-6 py-4">
                <StatusBadge
                  status={log.interactionType}
                  variant={isComplaint(log.interactionType) ? "warning" : "neutral"}
                />
              </td>
              <td className="px-6 py-4">
                <p className="text-xs font-black uppercase text-brand-charcoal">
                  {log.customerName || log.customerPhone}
                </p>
                <p className="text-[10px] font-bold text-stone-400">{log.source}</p>
              </td>
              <td className="px-6 py-4 text-xs font-bold uppercase">
                {log.vendorName || "-"}
              </td>
              <td className="px-6 py-4 text-xs font-semibold text-stone-600">
                {log.productName || log.customerMessage || "-"}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge
                    status={log.resolutionStatus}
                    variant={badgeVariant(log.resolutionStatus)}
                  />
                  {log.duplicatePatternDetected && (
                    <StatusBadge status="Duplicate Pattern" variant="warning" />
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-[10px] font-bold uppercase text-stone-500">
                {log.loggedByStaffName}
              </td>
            </tr>
          ))}
          {legacyFeed.map((log) => (
            <tr key={log.id} className="hover:bg-stone-50">
              <td className="px-6 py-4 text-[10px] font-bold text-stone-400">
                {log.activityDate}
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={log.activityType} />
              </td>
              <td className="px-6 py-4 text-xs font-bold uppercase">
                {log.sourceName}
              </td>
              <td className="px-6 py-4 text-xs font-bold uppercase">
                {log.vendorName || "-"}
              </td>
              <td className="px-6 py-4 text-xs font-semibold text-stone-600">
                {log.productName || log.customerNeed || "-"}
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={log.leadStatus} />
              </td>
              <td className="px-6 py-4 text-[10px] font-bold uppercase text-stone-500">
                {log.capturedByStaffName || log.loggedBy}
              </td>
            </tr>
          ))}
        </TablePanel>
      )}

      {activeTab === "risks" && (
        <TablePanel
          title="Complaints & Risks"
          subtitle="Unresolved complaints, fraud alerts, duplicate patterns and escalation controls."
          headers={[
            "Customer",
            "Risk Type",
            "Vendor",
            "Product",
            "Urgency",
            "Status",
            "Assigned",
            "Action",
          ]}
        >
          {filteredIntelLogs
            .filter(
              (log) =>
                isComplaint(log.interactionType) ||
                log.flaggedRisk ||
                log.sentiment === "Negative" ||
                log.duplicatePatternDetected,
            )
            .map((log) => (
              <tr key={log.id} className="hover:bg-red-50/30">
                <td className="px-6 py-4">
                  <p className="text-xs font-black uppercase">
                    {log.customerName || log.customerPhone}
                  </p>
                  <p className="text-[10px] font-bold text-stone-400">
                    {log.customerPhone}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={log.interactionType}
                    variant={log.interactionType === "Fraud Alert" ? "error" : "warning"}
                  />
                </td>
                <td className="px-6 py-4 text-xs font-bold uppercase">
                  {log.vendorName || "-"}
                </td>
                <td className="px-6 py-4 text-xs font-semibold">
                  {log.productName || "-"}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={log.urgencyLevel}
                    variant={badgeVariant(log.urgencyLevel)}
                  />
                </td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={log.resolutionStatus}
                    variant={badgeVariant(log.resolutionStatus)}
                  />
                </td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase">
                  {log.assignedToStaffName || "Unassigned"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <SecondaryButton size="sm" onClick={() => handleEscalate(log)}>
                      Escalate
                    </SecondaryButton>
                    <PrimaryButton size="sm" onClick={() => handleResolve(log)}>
                      Resolve
                    </PrimaryButton>
                  </div>
                </td>
              </tr>
            ))}
        </TablePanel>
      )}

      {activeTab === "market" && canViewAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {renderRankList("Most Requested Products", commerceBI.productDemand)}
          {renderRankList("Most Complained Vendors", commerceBI.vendorComplaints)}
          {renderRankList("Most Active Staff", commerceBI.staffActivity)}
          {renderRankList("Sector Activity", commerceBI.sectorActivity)}
          {renderRankList("Category Sentiment Pressure", commerceBI.categoryActivity)}
          {renderRankList("Repeat Complaint Keywords", commerceBI.complaintKeywords)}
        </div>
      )}

      {activeTab === "alerts" && (
        <DataPanel
          title="Live Alerts"
          subtitle="Market signal detection from customer demand, vendor risk and regional patterns."
          className="border-t-4 border-t-brand-orange"
        >
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {commerceBI.alerts.map((alert) => (
              <div key={alert.id} className="border-2 border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-brand-orange">
                      {alert.category}
                    </p>
                    <p className="text-sm font-black uppercase text-brand-charcoal">
                      {alert.title}
                    </p>
                  </div>
                  <StatusBadge
                    status={alert.severity}
                    variant={alert.severity === "critical" ? "error" : "warning"}
                  />
                </div>
                <p className="mt-3 text-xs font-semibold text-stone-600">
                  {alert.message}
                </p>
              </div>
            ))}
            {commerceBI.alerts.length === 0 && (
              <EmptyState
                icon={Bell}
                title="No Active BI Alerts"
                description="New alerts will appear when product demand, complaint volume or regional patterns cross thresholds."
              />
            )}
          </div>
        </DataPanel>
      )}

      {activeTab === "reputation" && canViewReputation && (
        <TablePanel
          title="Vendor Reputation Engine"
          subtitle="Score blends complaint rate, compliments, delivery issues, unresolved cases and sentiment."
          headers={[
            "Vendor",
            "Score",
            "Trend",
            "Risk",
            "Complaints",
            "Compliments",
            "Delivery",
            "Response Quality",
          ]}
        >
          {Object.entries(commerceBI.vendorReputation)
            .sort((a, b) => a[1].score - b[1].score)
            .map(([vendor, score]) => (
              <tr key={vendor} className="hover:bg-stone-50">
                <td className="px-6 py-4 text-xs font-black uppercase">
                  {vendor}
                </td>
                <td className="px-6 py-4 font-mono text-xl font-black text-brand-orange">
                  {score.score}/100
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={score.trend} />
                </td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={score.riskLevel}
                    variant={
                      score.riskLevel === "Critical" || score.riskLevel === "High"
                        ? "error"
                        : score.riskLevel === "Medium"
                          ? "warning"
                          : "success"
                    }
                  />
                </td>
                <td className="px-6 py-4 font-mono text-xs">{score.complaints}</td>
                <td className="px-6 py-4 font-mono text-xs">{score.compliments}</td>
                <td className="px-6 py-4 font-mono text-xs">{score.deliveryIssues}</td>
                <td className="px-6 py-4 font-mono text-xs">
                  {score.responseQuality}/100
                </td>
              </tr>
            ))}
        </TablePanel>
      )}

      {activeTab === "regional" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {renderRankList("Demand by Province", commerceBI.provinceDemand)}
          {renderRankList("Demand by City / Region", commerceBI.regionDemand)}
          {renderRankList("Regional Enquiry Ranking", commerceBI.regionalEnquiryRank)}
          <DataPanel title="Product Demand Heatmap" className="lg:col-span-3">
            <div className="p-4 overflow-x-auto">
              {Object.entries(commerceBI.productDemandHeatmap).map(([region, products]) => (
                <div key={region} className="mb-4 border border-stone-200 p-3">
                  <p className="mb-3 text-xs font-black uppercase text-brand-charcoal">
                    {region}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {asList(products, 12).map(([product, count]) => (
                      <div
                        key={product}
                        className="bg-orange-50 border border-orange-100 p-3"
                      >
                        <p className="truncate text-[10px] font-black uppercase text-brand-charcoal">
                          {product}
                        </p>
                        <p className="font-mono text-lg font-black text-brand-orange">
                          {count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === "product" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {renderRankList("Most Searched / Requested Products", commerceBI.productDemand)}
          {renderRankList("Unavailable / Stock Request Products", commerceBI.unavailableProducts)}
          {renderRankList("Complaint-heavy Products", commerceBI.productComplaints)}
          <TablePanel
            title="Fast-moving Demand Trends"
            subtitle="Product signals weighted by total demand and regional spread."
            className="lg:col-span-3"
            headers={["Product", "Demand", "Complaint Load", "Stock Requests", "BI Signal"]}
          >
            {asList(commerceBI.productDemand, 20).map(([product, demand]) => {
              const complaints = commerceBI.productComplaints[product] || 0;
              const stockRequests = commerceBI.unavailableProducts[product] || 0;
              const score = demand * 4 + stockRequests * 5 - complaints * 2;
              return (
                <tr key={product} className="hover:bg-stone-50">
                  <td className="px-6 py-4 text-xs font-black uppercase">
                    {product}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{demand}</td>
                  <td className="px-6 py-4 font-mono text-xs">{complaints}</td>
                  <td className="px-6 py-4 font-mono text-xs">{stockRequests}</td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={score >= 20 ? "High Demand" : "Watch"}
                      variant={score >= 20 ? "warning" : "neutral"}
                    />
                  </td>
                </tr>
              );
            })}
          </TablePanel>
        </div>
      )}

      {!canViewAnalytics && activeTab === "market" && (
        <EmptyState
          icon={ShieldAlert}
          title="Analytics Permission Required"
          description="This staff profile does not have whatsapp.analytics.view access."
        />
      )}
    </div>
  );
};
