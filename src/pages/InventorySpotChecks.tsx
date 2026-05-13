import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck,
  Plus,
  Filter,
  Search,
  LayoutGrid,
  List,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  User,
  Store,
  MapPin,
  Package,
  TrendingDown,
  Info,
  X,
  AlertTriangle,
} from "lucide-react";
import { inventorySpotCheckService } from "../services/inventorySpotCheckService.ts";
import { vendorService } from "../services/vendorService.ts";
import { rpnService } from "../services/rpnService.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { productService } from "../services/productService.ts";
import { permissionService } from "../services/permissionService.ts";
import {
  InventorySpotCheck,
  Vendor,
  RPN,
  PricingPlan,
  SpotCheckType,
  SpotCheckResult,
  SpotCheckStatus,
  Product,
} from "../types.ts";
import {
  DataPanel,
  TablePanel,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  ConfirmDialog,
  StatCard,
} from "../components/CommonUI.tsx";

const normalizeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as T[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const obj = value as Record<string, unknown>;

  if (Array.isArray(obj.data)) {
    return obj.data.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.items)) {
    return obj.items.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.docs)) {
    return obj.docs.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.results)) {
    return obj.results.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.vendors)) {
    return obj.vendors.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.products)) {
    return obj.products.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.checks)) {
    return obj.checks.filter(Boolean) as T[];
  }

  if (Array.isArray(obj.spotChecks)) {
    return obj.spotChecks.filter(Boolean) as T[];
  }

  return [];
};

const safeText = (value: unknown, fallback = ""): string => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const safeDateText = (value: unknown): string => {
  if (!value) return "No date";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return parsed.toLocaleDateString();
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const InventorySpotChecks: React.FC = () => {
  const [checks, setChecks] = useState<InventorySpotCheck[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // UI State
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [rpnFilter, setRpnFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<InventorySpotCheck | null>(
    null,
  );
  const [formData, setFormData] = useState<Partial<InventorySpotCheck>>({
    type: "random",
    status: "scheduled",
    checkDate: new Date().toISOString().split("T")[0],
    productsCheckedCount: 0,
    productsCorrectCount: 0,
    productsVarianceCount: 0,
    productsMissingImagesCount: 0,
    productsNeedingPriceUpdateCount: 0,
    result: "passed",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [nextChecks, nextVendors, nextRpns, nextPlans, nextProducts] =
        await Promise.all([
          Promise.resolve(inventorySpotCheckService.getSpotChecks()),
          Promise.resolve(vendorService.getVendors()),
          Promise.resolve(rpnService.getAll()),
          Promise.resolve(pricingPlanService.getPlans()),
          Promise.resolve(productService.getProducts()),
        ]);

      setChecks(normalizeArray<InventorySpotCheck>(nextChecks));
      setVendors(normalizeArray<Vendor>(nextVendors));
      setRpns(normalizeArray<RPN>(nextRpns));
      setPlans(normalizeArray<PricingPlan>(nextPlans));
      setProducts(normalizeArray<Product>(nextProducts));
    } catch (error) {
      console.error("Failed to load inventory spot check data", error);
      setChecks([]);
      setVendors([]);
      setRpns([]);
      setPlans([]);
      setProducts([]);
    }
  };

  const safeChecks = useMemo(
    () => normalizeArray<InventorySpotCheck>(checks),
    [checks],
  );
  const safeVendors = useMemo(() => normalizeArray<Vendor>(vendors), [vendors]);
  const safeRpns = useMemo(() => normalizeArray<RPN>(rpns), [rpns]);
  const safePlans = useMemo(() => normalizeArray<PricingPlan>(plans), [plans]);
  const safeProducts = useMemo(
    () => normalizeArray<Product>(products),
    [products],
  );

  const filtered = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return safeChecks
      .filter((c) => {
        const vendor = safeVendors.find((v) => v.id === c.vendorId);
        const vendorName = safeText(
          c.vendorNameSnapshot || vendor?.name,
        ).toLowerCase();
        const vendorCode = safeText(
          c.vendorSystemCode || vendor?.systemCode,
        ).toLowerCase();
        const checkId = safeText(c.id).toLowerCase();
        const matchesSearch =
          !searchValue ||
          vendorName.includes(searchValue) ||
          vendorCode.includes(searchValue) ||
          checkId.includes(searchValue);
        const matchesRPN = !rpnFilter || c.assignedRPNId === rpnFilter;
        const matchesStatus = !statusFilter || c.status === statusFilter;
        const matchesResult = !resultFilter || c.result === resultFilter;

        return matchesSearch && matchesRPN && matchesStatus && matchesResult;
      })
      .sort((a, b) =>
        safeText(b.checkDate).localeCompare(safeText(a.checkDate)),
      );
  }, [safeChecks, safeVendors, search, rpnFilter, statusFilter, resultFilter]);

  const biRecommendations = useMemo(() => {
    const recs: {
      vendorId: string;
      reason: string;
      severity: "low" | "medium" | "high";
    }[] = [];

    safeVendors.forEach((v) => {
      const vendorProducts = safeProducts.filter((p) => p.vendorId === v.id);
      if (vendorProducts.length === 0) return;

      const outOfStock = vendorProducts.filter(
        (p) => p.status === "out_of_stock",
      ).length;
      const missingImages = vendorProducts.filter((p) => !p.imageUrl).length;
      const oosRatio = outOfStock / vendorProducts.length;

      if (oosRatio > 0.4) {
        recs.push({
          vendorId: v.id,
          reason: "High Out-of-Stock Ratio (>40%)",
          severity: "high",
        });
      }
      if (missingImages / vendorProducts.length > 0.5) {
        recs.push({
          vendorId: v.id,
          reason: "Incomplete Visual Assets (>50% missing)",
          severity: "medium",
        });
      }

      // Check if stale (not updated in 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const allStale = vendorProducts.every(
        (p) => new Date(safeText(p.updatedAt)) < thirtyDaysAgo,
      );
      if (allStale) {
        recs.push({
          vendorId: v.id,
          reason: "Stale Inventory Metadata (>30 days)",
          severity: "low",
        });
      }

      // Check if subscription overdue
      if (v.subscriptionStatus === "overdue") {
        recs.push({
          vendorId: v.id,
          reason: "Overdue Subscription Compliance check",
          severity: "medium",
        });
      }
    });

    return recs;
  }, [safeVendors, safeProducts]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyCompleted = safeChecks.filter((c) => {
      const d = new Date(c.checkDate);
      return (
        d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear &&
        c.status === "completed"
      );
    }).length;

    return {
      total: safeChecks.length,
      scheduled: safeChecks.filter((c) => c.status === "scheduled").length,
      completedMonth: monthlyCompleted,
      failed: safeChecks.filter((c) => c.result === "major issues").length,
      recommendations: biRecommendations.length,
    };
  }, [safeChecks, biRecommendations]);

  const handleSave = () => {
    if (!formData.vendorId) return;

    const vendor = safeVendors.find((v) => v.id === formData.vendorId);
    if (!vendor) return;

    const plan = safePlans.find((p) => p.id === vendor.planId);

    // Check entitlement if creating new scheduled item
    if (!selectedCheck && formData.status === "completed") {
      const monthChecks = inventorySpotCheckService.getSpotChecksByMonth(
        vendor.id,
        new Date().getMonth(),
        new Date().getFullYear(),
      );
      const limit = plan?.inventorySpotChecksPerMonth || 0;

      if (monthChecks.length >= limit && limit > 0) {
        if (
          !confirm(
            `Vendor has already used ${monthChecks.length}/${limit} monthly spot checks. Proceed anyway?`,
          )
        ) {
          return;
        }
      }
    }

    const check: InventorySpotCheck = {
      id:
        selectedCheck?.id ||
        `SC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      vendorId: vendor.id,
      vendorSystemCode: vendor.systemCode,
      vendorNameSnapshot: vendor.name,
      assignedRPNId: vendor.assignedRPNId,
      backendStaffName: formData.backendStaffName || "System Admin",
      branchName: formData.branchName || "N/A",
      sector: vendor.sector,
      checkDate: formData.checkDate || new Date().toISOString().split("T")[0],
      type: formData.type || "random",
      productsCheckedCount: formData.productsCheckedCount || 0,
      productsCorrectCount: formData.productsCorrectCount || 0,
      productsVarianceCount: formData.productsVarianceCount || 0,
      productsMissingImagesCount: formData.productsMissingImagesCount || 0,
      productsNeedingPriceUpdateCount:
        formData.productsNeedingPriceUpdateCount || 0,
      notes: formData.notes || "",
      result: formData.result || "passed",
      nextCheckDate: formData.nextCheckDate,
      status: formData.status || "scheduled",
      createdBy: selectedCheck?.createdBy || "Admin",
      updatedBy: "Admin",
      createdAt: selectedCheck?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inventorySpotCheckService.saveSpotCheck(check);

    analyticsService.logEvent({
      eventType:
        check.status === "completed"
          ? "SPOT_CHECK_COMPLETED"
          : check.status === "escalated"
            ? "SPOT_CHECK_ESCALATED"
            : "SPOT_CHECK_SCHEDULED",
      actorType: "admin",
      actorName: "System Admin",
      vendorId: vendor.id,
      vendorName: vendor.name,
      spotCheckId: check.id,
      details: { type: check.type, result: check.result },
    });

    setShowScheduleModal(false);
    setSelectedCheck(null);
    loadData();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-brand-charcoal">
            Inventory Integrity
          </h1>
          <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest mt-1">
            Audit & Veracity Verification Engine
          </p>
        </div>
        {permissionService.canCreate("inventorySpotChecks") && (
          <div className="flex gap-2">
            {" "}
            {/* Check permission for scheduling spot checks */}
            <PrimaryButton
              onClick={() => {
                setFormData({
                  type: "random",
                  status: "scheduled",
                  checkDate: new Date().toISOString().split("T")[0],
                  productsCheckedCount: 0,
                  productsCorrectCount: 0,
                  productsVarianceCount: 0,
                  productsMissingImagesCount: 0,
                  productsNeedingPriceUpdateCount: 0,
                  result: "passed",
                });
                setSelectedCheck(null);
                setShowScheduleModal(true);
              }}
            >
              <Plus size={16} className="mr-2" /> Schedule Check
            </PrimaryButton>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Checks Logged"
          value={stats.total}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Active Schedule"
          value={stats.scheduled}
          icon={Clock}
        />
        <StatCard
          label="Completed (Mo)"
          value={stats.completedMonth}
          icon={CheckCircle2}
        />
        <StatCard
          label="Fails / Issues"
          value={stats.failed}
          icon={AlertCircle}
          variant="error"
        />
        <StatCard
          label="BI Alerts"
          value={stats.recommendations}
          icon={TrendingDown}
          variant="warning"
        />
      </div>

      {/* BI Recommendations Section */}
      {biRecommendations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DataPanel
              title="BI Distribution Intelligence"
              subtitle="System detected anomalies requiring human verification"
              className="border-l-4 border-l-brand-orange"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-stone-100 bg-stone-50/50">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black uppercase text-stone-400">
                        Target Vendor
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase text-stone-400">
                        Analysis Result
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black uppercase text-stone-400">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {biRecommendations.slice(0, 5).map((rec, i) => {
                      const vendor = safeVendors.find(
                        (v) => v.id === rec.vendorId,
                      );
                      return (
                        <tr
                          key={i}
                          className="hover:bg-orange-50/20 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-mono font-bold text-stone-400">
                                {vendor?.systemCode}
                              </span>
                              <span className="text-xs font-bold uppercase text-brand-charcoal">
                                {vendor?.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-stone-600">
                            {rec.reason}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                rec.severity === "high"
                                  ? "bg-red-100 text-red-700"
                                  : rec.severity === "medium"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {rec.severity} priority
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                if (
                                  permissionService.canCreate(
                                    "inventorySpotChecks",
                                  )
                                ) {
                                  setFormData({
                                    vendorId: vendor?.id,
                                    type: "BI-recommended",
                                    status: "scheduled",
                                    notes: `Automated recommendation: ${rec.reason}`,
                                  });
                                  setShowScheduleModal(true);
                                } else {
                                  alert(
                                    "Permission denied to schedule spot checks.",
                                  );
                                }
                              }}
                              className={`text-[9px] font-bold text-brand-orange hover:underline uppercase ${!permissionService.canCreate("inventorySpotChecks") ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              Schedule Check
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DataPanel>
          </div>
          <div className="space-y-6">
            <DataPanel title="Plan Entitlements">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-stone-100">
                  <div>
                    <p className="text-[10px] font-black uppercase text-stone-300">
                      Entitlement Mode
                    </p>
                    <p className="text-sm font-bold text-stone-800">
                      Growth Plan
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-stone-300">
                      Quota
                    </p>
                    <p className="text-sm font-bold text-brand-orange">
                      1 / Month
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase text-stone-300">
                      Entitlement Mode
                    </p>
                    <p className="text-sm font-bold text-stone-800">Pro tier</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-stone-300">
                      Quota
                    </p>
                    <p className="text-sm font-bold text-brand-orange">
                      4 / Month
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-stone-100 text-[10px] text-stone-500 font-bold leading-relaxed uppercase">
                  Spot checks are essential for maintaining catalogue trust.
                  Starter plans do not include verified inventory checks.
                </div>
              </div>
            </DataPanel>
          </div>
        </div>
      )}

      {/* Main Filter & Table */}
      <div className="bg-white border border-stone-200">
        <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by Vendor, System Code, or Check ID..."
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-100 outline-none text-xs focus:border-brand-orange transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select
              className="flex-1 md:flex-none px-3 py-2 bg-stone-50 border border-stone-100 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
              value={rpnFilter}
              onChange={(e) => setRpnFilter(e.target.value)}
            >
              <option value="">All RPNs</option>
              {safeRpns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              className="flex-1 md:flex-none px-3 py-2 bg-stone-50 border border-stone-100 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="escalated">Escalated</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <TablePanel
          title="Integrity Audit Trail"
          headers={[
            "Identity Snapshot",
            "Audit Metadata",
            "Integrity Result",
            "Status",
            "Operations",
          ]}
        >
          {filtered.map((check) => {
            const vendor = safeVendors.find((v) => v.id === check.vendorId);
            return (
              <tr
                key={check.id}
                className="group hover:bg-stone-50/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border border-stone-200 bg-white flex items-center justify-center font-bold text-stone-300">
                      {vendor?.logoUrl ? (
                        <img
                          src={vendor.logoUrl}
                          className="w-full h-full object-cover grayscale"
                          alt=""
                        />
                      ) : (
                        "V"
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-mono font-black text-stone-500 bg-stone-100 px-1 border border-stone-200 w-fit mb-1">
                        {check.vendorSystemCode}
                      </p>
                      <p className="text-xs font-bold uppercase text-brand-charcoal">
                        {check.vendorNameSnapshot}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-stone-400">
                      <Calendar size={10} /> {safeDateText(check.checkDate)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-stone-400">
                      <User size={10} /> {check.backendStaffName}
                    </div>
                    <div className="text-[8px] font-mono text-stone-300 uppercase italic">
                      Check ID: {check.id}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {check.status === "completed" ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex flex-col items-center px-2 py-1 bg-emerald-50 rounded border border-emerald-100">
                          <span className="text-[8px] font-black text-emerald-600 uppercase">
                            Correct
                          </span>
                          <span className="text-xs font-bold text-emerald-700">
                            {check.productsCorrectCount}
                          </span>
                        </div>
                        <div className="flex flex-col items-center px-2 py-1 bg-red-50 rounded border border-red-100">
                          <span className="text-[8px] font-black text-red-600 uppercase">
                            Variance
                          </span>
                          <span className="text-xs font-bold text-red-700">
                            {check.productsVarianceCount}
                          </span>
                        </div>
                      </div>
                      <StatusBadge
                        status={check.result}
                        variant={
                          check.result === "passed"
                            ? "success"
                            : check.result === "major issues"
                              ? "error"
                              : "warning"
                        }
                      />
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-stone-300 italic uppercase">
                      Awaiting integrity audit...
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={check.status}
                    variant={
                      check.status === "completed" ? "success" : "warning"
                    }
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {check.status === "scheduled" && (
                      <button
                        onClick={() => {
                          if (
                            permissionService.canEdit("inventorySpotChecks")
                          ) {
                            setSelectedCheck(check);
                            setFormData({ ...check, status: "completed" });
                            setShowScheduleModal(true);
                          } else {
                            alert(
                              "Permission denied to enter spot check results.",
                            );
                          }
                        }}
                        className={`text-[9px] font-bold text-brand-orange hover:underline uppercase ${!permissionService.canEdit("inventorySpotChecks") ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        Enter Results
                      </button>
                    )}
                    <button
                      className={`p-1 px-2 border border-stone-200 text-[9px] font-bold uppercase text-stone-400 hover:text-stone-900 transition-all rounded ${!permissionService.canEdit("inventorySpotChecks") ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => {
                        if (permissionService.canEdit("inventorySpotChecks")) {
                          setSelectedCheck(check);
                          setFormData(check);
                          setShowScheduleModal(true);
                        } else {
                          alert("Permission denied to edit spot checks.");
                        }
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="py-20">
                <EmptyState
                  title="No Integrity Records"
                  description="No inventory spot checks found and synchronized for current buffer."
                />
              </td>
            </tr>
          )}
        </TablePanel>
      </div>

      {/* Schedule / Entry Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-charcoal/40 backdrop-blur-sm p-2 md:p-4">
          <div className="bg-white w-[96vw] md:w-[80vw] max-w-[1200px] md:min-h-[70vh] max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border-t-4 border-t-brand-orange rounded-none">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
              <div>
                <h2 className="text-sm md:text-base font-bold uppercase tracking-tight text-brand-charcoal">
                  {selectedCheck
                    ? "Manage Integrity Record"
                    : "Schedule Integrity Audit"}
                </h2>
                <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">
                  {selectedCheck
                    ? "Updating existing audit node"
                    : "Create a new scheduled audit record"}
                </p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 hover:bg-stone-200 text-stone-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 custom-scrollbar">
              {/* Section A: Audit Header */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange border-b border-orange-100 pb-2 flex items-center gap-2">
                  <Info size={14} /> Audit Header
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Target Vendor Node
                    </label>
                    <select
                      className="w-full bg-stone-50 border-2 border-stone-100 p-3 md:p-4 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={formData.vendorId || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, vendorId: e.target.value })
                      }
                      disabled={!!selectedCheck}
                    >
                      <option value="">Select Vendor</option>
                      {safeVendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.systemCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Audit Date
                    </label>
                    <input
                      type="date"
                      className="w-full bg-stone-50 border-2 border-stone-100 p-3 md:p-4 text-xs font-bold outline-none focus:border-brand-orange"
                      value={formData.checkDate}
                      onChange={(e) =>
                        setFormData({ ...formData, checkDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Check Type
                    </label>
                    <select
                      className="w-full bg-stone-50 border-2 border-stone-100 p-3 md:p-4 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as SpotCheckType,
                        })
                      }
                    >
                      <option value="random">Random</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="complaint-based">Complaint</option>
                      <option value="renewal-based">Renewal</option>
                      <option value="BI-recommended">BI Forecast</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 lg:col-start-4">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Status Node
                    </label>
                    <select
                      className="w-full bg-stone-50 border-2 border-stone-100 p-3 md:p-4 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as SpotCheckStatus,
                        })
                      }
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="escalated">Escalated</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section B: Precision Metrics */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange border-b border-orange-100 pb-2 flex items-center gap-2">
                  <ClipboardCheck size={14} /> Precision Metrics
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      SKUs Screened
                    </label>
                    <input
                      type="number"
                      className="w-full bg-white border-2 border-stone-100 p-3 md:p-4 text-xs font-bold outline-none focus:border-brand-orange"
                      value={formData.productsCheckedCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          productsCheckedCount: toNumber(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Quantity Accuracy
                    </label>
                    <input
                      type="number"
                      className="w-full bg-white border-2 border-stone-100 p-3 md:p-4 text-xs font-bold outline-none focus:border-brand-orange"
                      value={formData.productsCorrectCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          productsCorrectCount: toNumber(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Image Gaps
                    </label>
                    <input
                      type="number"
                      className="w-full bg-white border-2 border-stone-100 p-3 md:p-4 text-xs font-bold outline-none focus:border-brand-orange"
                      value={formData.productsMissingImagesCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          productsMissingImagesCount: toNumber(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Pricing Gaps
                    </label>
                    <input
                      type="number"
                      className="w-full bg-white border-2 border-stone-100 p-3 md:p-4 text-xs font-bold outline-none focus:border-brand-orange"
                      value={formData.productsNeedingPriceUpdateCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          productsNeedingPriceUpdateCount: toNumber(
                            e.target.value,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Section C: Observations */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange border-b border-orange-100 pb-2 flex items-center gap-2">
                  <AlertCircle size={14} /> Observations
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Audit Observations
                    </label>
                    <textarea
                      className="w-full bg-stone-50 border-2 border-stone-100 p-4 text-xs font-medium outline-none h-24 focus:border-brand-orange resize-none"
                      placeholder="Detail physical vs digital variances..."
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-stone-400">
                      Final Verdict
                    </label>
                    <select
                      className="w-full bg-white border-2 border-stone-100 p-4 text-xs font-bold uppercase outline-none focus:border-brand-orange h-[6rem] lg:h-24"
                      value={formData.result}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          result: e.target.value as SpotCheckResult,
                        })
                      }
                    >
                      <option value="passed">Integrity Passed</option>
                      <option value="minor issues">Minor Discrepancies</option>
                      <option value="major issues">Major Failure</option>
                      <option value="follow-up required">
                        Pending Follow-up
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section D: Follow-up Result */}
              <div
                className={`p-4 md:p-6 border-2 flex items-center gap-4 ${formData.result === "passed" ? "bg-emerald-50 border-emerald-100" : "bg-orange-50 border-orange-100"}`}
              >
                {formData.result === "passed" ? (
                  <>
                    <CheckCircle2
                      size={24}
                      className="text-emerald-500 shrink-0"
                    />
                    <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">
                      Integrity Passed. No follow-up tasks will be triggered.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle
                      size={24}
                      className="text-brand-orange shrink-0"
                    />
                    <span className="text-xs font-bold uppercase text-orange-800 tracking-wider">
                      Discrepancies detected. Follow-up tasks will be triggered
                      automatically.
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:p-6 border-t border-stone-100 bg-stone-50 flex justify-end gap-3 shrink-0">
              <SecondaryButton
                onClick={() => setShowScheduleModal(false)}
                className="px-6 md:px-8 py-3 text-xs"
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onClick={handleSave}
                className="px-6 md:px-8 py-3 text-xs"
              >
                Persist Record
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
