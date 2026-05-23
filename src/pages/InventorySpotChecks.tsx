import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MapPin,
  Package,
  PhoneCall,
  Search,
  ShieldAlert,
  Store,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { inventorySpotCheckService } from "../services/inventorySpotCheckService.ts";
import { vendorService } from "../services/vendorService.ts";
import { productService } from "../services/productService.ts";
import { whatsappActivityService } from "../services/whatsappActivityService.ts";
import { notificationService } from "../services/notificationService.ts";
import { staffAuditService } from "../services/staffAuditService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { staffService } from "../services/staffService.ts";
import { permissionService } from "../services/permissionService.ts";
import {
  ActivityLog,
  InventorySpotCheck,
  Product,
  SpotCheckSource,
  SpotCheckVarianceType,
  Staff,
  Vendor,
  VendorProductOffer,
  WhatsAppIntelligenceLog,
} from "../types.ts";
import {
  DataPanel,
  EmptyState,
  PrimaryButton,
  SearchInput,
  SearchableComboBox,
  SecondaryButton,
  StatCard,
  StatusBadge,
  TablePanel,
} from "../components/CommonUI.tsx";
import { buildSearchText } from "../utils/searchUtils.ts";
import { useFormDraft } from "../hooks/useFormDraft.ts";
import { offlineSyncService } from "../services/offlineSyncService.ts";

type SpotCheckTab =
  | "dashboard"
  | "queue"
  | "create"
  | "count"
  | "variance"
  | "advisory"
  | "history";

type AuditRecommendation = {
  id: string;
  alertKey: string;
  vendorId: string;
  vendorName: string;
  productId: string;
  productName: string;
  offerId?: string;
  branchId?: string;
  branchName?: string;
  startingQty: number;
  listedQtyBeforeAudit: number;
  whatsappHits: number;
  callHits: number;
  searchHits: number;
  complaintCount: number;
  leadPressureScore: number;
  recommendedAction: string;
  source: SpotCheckSource;
};

const tabs: Array<{ id: SpotCheckTab; label: string; icon: React.ElementType }> =
  [
    { id: "dashboard", label: "BI Spot Check Dashboard", icon: BarChart3 },
    { id: "queue", label: "Demand-Led Audit Queue", icon: Bell },
    { id: "create", label: "Create Spot Check", icon: ClipboardCheck },
    { id: "count", label: "Physical Count Entry", icon: UserCheck },
    { id: "variance", label: "Variance & Sales Estimate", icon: TrendingUp },
    { id: "advisory", label: "Vendor Advisory", icon: FileText },
    { id: "history", label: "Audit History", icon: Package },
  ];

const today = () => new Date().toISOString().split("T")[0];
const inputClass =
  "w-full border-2 border-stone-200 bg-white p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange";
const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
const isDemandType = (type?: string) =>
  ["Enquiry", "Price Request", "Stock Request", "Product Search"].includes(
    String(type),
  );
const isComplaintType = (type?: string) =>
  ["Complaint", "Delivery Complaint", "Warranty Issue", "Fraud Alert"].includes(
    String(type),
  );
const riskLevel = (score: number) => {
  if (score >= 90) return "Critical";
  if (score >= 51) return "High";
  if (score >= 21) return "Medium";
  return "Low";
};
const riskVariant = (score: number) => {
  if (score >= 90) return "error" as const;
  if (score >= 51) return "warning" as const;
  if (score >= 21) return "info" as const;
  return "neutral" as const;
};
const calculateLeadPressure = (
  whatsappHits = 0,
  callHits = 0,
  searchHits = 0,
  complaintCount = 0,
) => whatsappHits * 4 + callHits * 5 + searchHits * 2 + complaintCount * 6;

const ACKNOWLEDGED_ALERTS_KEY = "sci_acknowledged_alerts";

function getAcknowledgedAlertKeys(): string[] {
  try {
    const raw = localStorage.getItem(ACKNOWLEDGED_ALERTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveAcknowledgedAlertKey(alertKey: string) {
  if (!alertKey) return;
  const existing = getAcknowledgedAlertKeys();
  const next = Array.from(new Set([...existing, alertKey]));
  localStorage.setItem(ACKNOWLEDGED_ALERTS_KEY, JSON.stringify(next));
}

function isAlertAcknowledged(alertKey: string) {
  return getAcknowledgedAlertKeys().includes(alertKey);
}

const getStockMismatchAlertKey = (
  vendorId: string,
  productId: string,
  branchId?: string,
) =>
  branchId
    ? `stock-mismatch-${vendorId}-${branchId}-${productId}`
    : `stock-mismatch-${vendorId}-${productId}`;

const classifyVariance = (
  listedQty: number,
  physicalQty: number,
  leadPressureScore: number,
): SpotCheckVarianceType => {
  const variance = listedQty - physicalQty;
  if (variance === 0) return "matched";
  if (physicalQty > listedQty) return "understated_stock";
  if (variance > Math.max(5, listedQty * 0.5)) return "overstated_stock";
  if (leadPressureScore > 50) return "possible_sales";
  return "stock_mismatch";
};

const generateVendorAdvice = (check: InventorySpotCheck) => {
  const product = check.productName || "this product";
  const demand =
    (check.whatsappHits || 0) + (check.callHits || 0) + (check.searchHits || 0);
  const movement = check.estimatedSalesQty || 0;
  const accuracy =
    check.varianceType === "matched"
      ? "Stock matched the catalogue record."
      : `Stock accuracy needs attention: listed ${check.listedQtyBeforeAudit || 0}, counted ${check.physicalCountQty || 0}.`;
  const restock =
    (check.physicalCountQty || 0) <= 5 || check.leadPressureScore! > 50
      ? "We recommend restocking before the next catalogue update."
      : "Current stock can remain listed, with normal monitoring.";

  return `Your product ${product} received ${demand} customer demand signals, including ${check.whatsappHits || 0} WhatsApp hits. Starting quantity was ${check.startingQty || 0}. Physical count is ${check.physicalCountQty || 0}. Estimated sales movement is ${movement} units. ${accuracy} ${restock} Catalogue stock should be updated to ${check.adjustedQtyAfterAudit ?? check.physicalCountQty ?? 0}.`;
};

const createBlankCheck = (): Partial<InventorySpotCheck> => ({
  source: "manual",
  status: "scheduled",
  checkDate: today(),
  startingQty: 0,
  listedQtyBeforeAudit: 0,
  physicalCountQty: 0,
  restockedQty: 0,
  adjustedQtyAfterAudit: 0,
  whatsappHits: 0,
  callHits: 0,
  searchHits: 0,
  complaintCount: 0,
  productsCheckedCount: 1,
  productsCorrectCount: 0,
  productsVarianceCount: 0,
  productsMissingImagesCount: 0,
  productsNeedingPriceUpdateCount: 0,
  result: "follow-up required",
  type: "BI-recommended",
});

export const InventorySpotChecks: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SpotCheckTab>("dashboard");
  const [checks, setChecks] = useState<InventorySpotCheck[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<VendorProductOffer[]>([]);
  const [intelLogs, setIntelLogs] = useState<WhatsAppIntelligenceLog[]>([]);
  const [events, setEvents] = useState<ActivityLog[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCheckId, setSelectedCheckId] = useState("");
  const [formData, setFormData] =
    useState<Partial<InventorySpotCheck>>(createBlankCheck());
  const [showSpotCheckDraftPrompt, setShowSpotCheckDraftPrompt] = useState(false);
  const [hasCheckedDraftRecovery, setHasCheckedDraftRecovery] = useState(false);
  const [draftDecisionMade, setDraftDecisionMade] = useState(false);
  const [showPopupFeed, setShowPopupFeed] = useState(true);

  const canCreate =
    permissionService.hasActionPermission("inventory.spotChecks.create") ||
    permissionService.canCreate("inventorySpotChecks");
  const canComplete =
    permissionService.hasActionPermission("inventory.spotChecks.complete") ||
    permissionService.canEdit("inventorySpotChecks");
  const canUpdateStock =
    permissionService.hasActionPermission("inventory.spotChecks.updateStock") ||
    permissionService.hasActionPermission("inventory.updateStockAfterAudit");
  const canViewAnalytics =
    permissionService.hasActionPermission("inventory.spotChecks.viewAnalytics") ||
    permissionService.canView("inventorySpotChecks");

  const spotCheckDraft = useFormDraft<Partial<InventorySpotCheck>>({
    draftKey: `inventory-spot-check:${formData.id || "new"}`,
    formData,
    setFormData,
    enabled: activeTab === "create" || activeTab === "count",
    saveDelayMs: 900,
  });

  useEffect(() => {
    const isDraftFormOpen = activeTab === "create" || activeTab === "count";
    if (!isDraftFormOpen) {
      setHasCheckedDraftRecovery(false);
      setDraftDecisionMade(false);
      setShowSpotCheckDraftPrompt(false);
      return;
    }

    if (hasCheckedDraftRecovery || draftDecisionMade) return;

    if (spotCheckDraft.getDraftValue()) {
      setShowSpotCheckDraftPrompt(true);
    }
    setHasCheckedDraftRecovery(true);
  }, [
    activeTab,
    hasCheckedDraftRecovery,
    draftDecisionMade,
    spotCheckDraft.getDraftValue,
  ]);

  const loadData = async () => {
    const [
      nextVendors,
      nextProducts,
      nextOffers,
      nextEvents,
    ] = await Promise.all([
      vendorService.getVendors(),
      productService.getProducts(),
      productService.getVendorProductOffers(),
      analyticsService.getEvents(),
    ]);
    setChecks(inventorySpotCheckService.getSpotChecks());
    setVendors(Array.isArray(nextVendors) ? nextVendors : []);
    setProducts(Array.isArray(nextProducts) ? nextProducts : []);
    setOffers(Array.isArray(nextOffers) ? nextOffers : []);
    setEvents(Array.isArray(nextEvents) ? nextEvents : []);
    setIntelLogs(whatsappActivityService.getIntelligenceLogs());
    setStaffList(staffService.getAllStaff());
  };

  useEffect(() => {
    void loadData();
  }, []);

  const productById = useMemo(
    () =>
      new Map(
        products.flatMap((product) => [
          [product.id, product],
          [product.productId || product.id, product],
          [product.offerId || product.id, product],
        ]),
      ),
    [products],
  );
  const vendorById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors],
  );
  const activeStaff = useMemo(
    () =>
      staffList.filter(
        (staff) =>
          (staff.status || "").toLowerCase() === "active" &&
          staff.isLocked !== true,
      ),
    [staffList],
  );
  const inactiveAssignedStaff = useMemo(() => {
    const assignedId = formData.assignedToStaffId;
    if (!assignedId) return null;
    const staff = staffList.find((item) => item.id === assignedId);
    if (
      staff &&
      ((staff.status || "").toLowerCase() !== "active" ||
        staff.isLocked === true)
    ) {
      return staff;
    }
    return null;
  }, [formData.assignedToStaffId, staffList]);
  const getVendorSearchText = (vendor: Vendor) =>
    buildSearchText([
      vendor.name,
      vendor.tradingName,
      vendor.phone,
      vendor.whatsapp,
      vendor.suburb,
      vendor.cityTown,
      vendor.district,
      vendor.province,
      vendor.sector,
      vendor.systemCode,
      vendor.id,
    ]);
  const getProductSearchText = (product: Product) =>
    buildSearchText([
      product.name,
      product.productName,
      product.brand,
      product.sku,
      product.productCode,
      product.barcode,
      product.category,
      product.sector,
      product.vendorName,
      vendorById.get(product.vendorId)?.name,
      vendorById.get(product.vendorId)?.tradingName,
    ]);
  const getStaffSearchText = (staff: Staff) =>
    buildSearchText([
      staff.fullName,
      staff.displayName,
      staff.email,
      staff.staffCode,
      staff.role,
      staff.desk,
    ]);

  const demandRecommendations = useMemo<AuditRecommendation[]>(() => {
    const rows = products.map((product) => {
      const vendor = vendorById.get(product.vendorId);
      const terms = [
        product.productId,
        product.id,
        product.offerId,
        product.name,
        product.productCode,
        product.sku,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      const matchesProduct = (log: WhatsAppIntelligenceLog) => {
        const blob = [
          log.productId,
          log.productName,
          log.customerMessage,
          log.internalNotes,
          ...(log.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const vendorMatch =
          !log.vendorId ||
          log.vendorId === product.vendorId ||
          !log.vendorName ||
          log.vendorName === product.vendorName;
        return vendorMatch && terms.some((term) => term && blob.includes(term));
      };
      const productLogs = intelLogs.filter(matchesProduct);
      const whatsappHits = productLogs.filter(
        (log) => log.source === "WhatsApp" && isDemandType(log.interactionType),
      ).length;
      const callHits = productLogs.filter(
        (log) => log.source === "Call" && isDemandType(log.interactionType),
      ).length;
      const searchHits =
        productLogs.filter((log) => log.interactionType === "Product Search")
          .length +
        events.filter((event) => {
          const details = JSON.stringify(event.details || {}).toLowerCase();
          return (
            String(event.eventType).toLowerCase().includes("search") &&
            terms.some((term) => term && details.includes(term))
          );
        }).length;
      const complaintCount = productLogs.filter(
        (log) =>
          isComplaintType(log.interactionType) &&
          /stock|unavailable|sold out|not available|shortage/i.test(
            `${log.customerMessage || ""} ${log.internalNotes || ""} ${(log.tags || []).join(" ")}`,
          ),
      ).length;
      const leadPressureScore = calculateLeadPressure(
        whatsappHits,
        callHits,
        searchHits,
        complaintCount,
      );
      const listedQtyBeforeAudit = product.stockQuantity || 0;
      let recommendedAction = "Call vendor for stock confirmation";
      if (complaintCount > 0 && listedQtyBeforeAudit > 0)
        recommendedAction = "Flag vendor stock mismatch";
      else if (leadPressureScore >= 90)
        recommendedAction = "Perform physical count";
      else if (leadPressureScore >= 51 && listedQtyBeforeAudit <= 10)
        recommendedAction = "Recommend restock";
      else if (listedQtyBeforeAudit <= 3 && leadPressureScore > 20)
        recommendedAction = "Update catalogue stock";

      return {
        id: `${product.vendorId}:${product.productId || product.id}`,
        alertKey: getStockMismatchAlertKey(
          product.vendorId,
          product.productId || product.id,
          product.branchId,
        ),
        vendorId: product.vendorId,
        vendorName: product.vendorName || vendor?.name || "Unknown Vendor",
        productId: product.productId || product.id,
        productName: product.name,
        offerId: product.offerId || product.id,
        branchId: product.branchId,
        branchName: product.branchName || product.locationDisplayText,
        startingQty: listedQtyBeforeAudit,
        listedQtyBeforeAudit,
        whatsappHits,
        callHits,
        searchHits,
        complaintCount,
        leadPressureScore,
        recommendedAction,
        source:
          complaintCount > 0
            ? "customer_complaints"
            : whatsappHits > 0
              ? "whatsapp_hits"
              : "bi_recommendation",
      } as AuditRecommendation;
    });

    return rows
      .filter(
        (row) =>
          row.leadPressureScore > 20 ||
          row.complaintCount > 0 ||
          (row.listedQtyBeforeAudit <= 5 && row.whatsappHits + row.callHits > 0),
      )
      .sort((a, b) => b.leadPressureScore - a.leadPressureScore);
  }, [products, vendorById, intelLogs, events]);

  useEffect(() => {
    demandRecommendations.slice(0, 8).forEach((rec) => {
      if (rec.leadPressureScore < 51 && rec.complaintCount === 0) return;
      void notificationService.createNotification({
        type: "system_alert",
        priority: rec.leadPressureScore >= 90 ? "critical" : "high",
        title: "Stock Audit Recommended",
        message: `${rec.productName} has ${rec.whatsappHits} WhatsApp hits and ${rec.listedQtyBeforeAudit} listed units.`,
        recordType: "inventory_spot_check",
        recordId: rec.id,
        dedupeKey: `stock-audit:${rec.vendorId}:${rec.productId}:demand:${today()}`,
      });
    });
  }, [demandRecommendations]);

  useEffect(() => {
    checks.forEach((check) => {
      if (
        check.status !== "scheduled" &&
        check.status !== "in_progress" &&
        check.status !== "recommended"
      ) {
        return;
      }
      if (!check.checkDate || check.checkDate >= today()) return;
      void notificationService.createNotification({
        type: "task_due",
        priority: "high",
        title: "Overdue Stock Audit",
        message: `${check.productName || "Inventory audit"} for ${check.vendorName || check.vendorNameSnapshot} is overdue.`,
        recordType: "inventory_spot_check",
        recordId: check.id,
        assignedToStaffId: check.assignedToStaffId,
        assignedToName: check.assignedToStaffName,
        dedupeKey: `stock-audit:${check.vendorId}:${check.productId || check.id}:overdue:${today()}`,
      });
    });
  }, [checks]);

  const selectedCheck = useMemo(
    () => checks.find((check) => check.id === selectedCheckId) || null,
    [checks, selectedCheckId],
  );

  const filteredChecks = useMemo(() => {
    const terms = search.toLowerCase().split(" ").filter(Boolean);
    return checks
      .filter((check) => {
        const blob = [
          check.id,
          check.vendorName,
          check.vendorNameSnapshot,
          check.productName,
          check.branchName,
          check.status,
          check.varianceType,
          check.actionRequired,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return terms.every((term) => blob.includes(term));
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
  }, [checks, search]);

  const stats = useMemo(() => {
    const completed = checks.filter((check) => check.status === "completed");
    return {
      total: checks.length,
      queue: demandRecommendations.length,
      highPressure: demandRecommendations.filter(
        (rec) => rec.leadPressureScore >= 51,
      ).length,
      unresolved: checks.filter(
        (check) =>
          check.status !== "completed" &&
          check.status !== "cancelled" &&
          check.status !== "escalated",
      ).length,
      estimatedSales: completed.reduce(
        (sum, check) => sum + (check.estimatedSalesQty || 0),
        0,
      ),
      accurateVendors: completed.filter((check) => check.varianceType === "matched")
        .length,
      mismatches: completed.filter(
        (check) =>
          check.varianceType === "stock_mismatch" ||
          check.varianceType === "overstated_stock",
      ).length,
    };
  }, [checks, demandRecommendations]);

  const visiblePopupAlerts = useMemo(
    () =>
      demandRecommendations.filter(
        (alert) =>
          alert.leadPressureScore >= 51 &&
          !isAlertAcknowledged(alert.alertKey || alert.id),
      ),
    [demandRecommendations],
  );

  const activePopupAlert = visiblePopupAlerts[0] || null;

  const handleAcknowledgePopupAlert = (alert: AuditRecommendation | null) => {
    if (!alert) return;
    const key = alert.alertKey || alert.id;
    if (key) {
      saveAcknowledgedAlertKey(key);
    }

    setShowPopupFeed(false);

    void notificationService
      .getAll()
      .then((notifications) => {
        const relatedNotification = notifications.find(
          (notification) =>
            notification.type === "system_alert" &&
            notification.recordType === "inventory_spot_check" &&
            notification.recordId === alert.id &&
            notification.status === "unread",
        );
        if (relatedNotification) {
          return notificationService.markRead(relatedNotification.id);
        }
        return undefined;
      })
      .catch((error) => {
        console.warn("Failed to mark popup alert notification as read", error);
      });
  };

  const populateFromProduct = (productId: string) => {
    const product = productById.get(productId);
    const vendor = product ? vendorById.get(product.vendorId) : undefined;
    if (!product || !vendor) return;
    setFormData((prev) => ({
      ...prev,
      vendorId: product.vendorId,
      vendorName: product.vendorName || vendor.name,
      vendorNameSnapshot: product.vendorName || vendor.name,
      vendorSystemCode: vendor.systemCode,
      productId: product.productId || product.id,
      productName: product.name,
      branchId: product.branchId,
      branchName: product.branchName,
      sector: product.sector,
      startingQty: product.stockQuantity || 0,
      listedQtyBeforeAudit: product.stockQuantity || 0,
      adjustedQtyAfterAudit: product.stockQuantity || 0,
    }));
  };

  const loadRecommendation = (rec: AuditRecommendation) => {
    setFormData({
      ...createBlankCheck(),
      id: `SC-${Date.now()}`,
      vendorId: rec.vendorId,
      vendorName: rec.vendorName,
      vendorNameSnapshot: rec.vendorName,
      vendorSystemCode: vendorById.get(rec.vendorId)?.systemCode || "",
      productId: rec.productId,
      productName: rec.productName,
      branchId: rec.branchId,
      branchName: rec.branchName,
      sector: productById.get(rec.offerId || rec.productId)?.sector || "",
      source: rec.source,
      status: "scheduled",
      startingQty: rec.startingQty,
      listedQtyBeforeAudit: rec.listedQtyBeforeAudit,
      adjustedQtyAfterAudit: rec.listedQtyBeforeAudit,
      whatsappHits: rec.whatsappHits,
      callHits: rec.callHits,
      searchHits: rec.searchHits,
      complaintCount: rec.complaintCount,
      leadPressureScore: rec.leadPressureScore,
      actionRequired: rec.recommendedAction,
      officeNotes: `Demand-led audit recommendation: ${rec.recommendedAction}`,
    });
    setSelectedCheckId("");
    setActiveTab("create");
  };

  const buildCompletedCheck = (
    patch: Partial<InventorySpotCheck>,
    status: InventorySpotCheck["status"],
  ): InventorySpotCheck => {
    const now = new Date().toISOString();
    const vendor = vendorById.get(String(patch.vendorId || ""));
    const product = productById.get(String(patch.productId || ""));
    const startingQty = toNumber(patch.startingQty);
    const restockedQty = toNumber(patch.restockedQty);
    const physicalCountQty = toNumber(patch.physicalCountQty);
    const listedQtyBeforeAudit = toNumber(patch.listedQtyBeforeAudit);
    const estimatedSalesQty = Math.max(
      0,
      startingQty + restockedQty - physicalCountQty,
    );
    const varianceQty = listedQtyBeforeAudit - physicalCountQty;
    const leadPressureScore =
      patch.leadPressureScore ??
      calculateLeadPressure(
        patch.whatsappHits || 0,
        patch.callHits || 0,
        patch.searchHits || 0,
        patch.complaintCount || 0,
      );
    const varianceType = classifyVariance(
      listedQtyBeforeAudit,
      physicalCountQty,
      leadPressureScore,
    );
    const stockAccuracyScore = clamp(
      100 - (Math.abs(varianceQty) / Math.max(listedQtyBeforeAudit, 1)) * 100,
    );
    const vendorReliabilityImpact =
      varianceType === "matched"
        ? 5
        : varianceType === "possible_sales"
          ? 0
          : varianceType === "understated_stock"
            ? -3
            : -12;

    const check: InventorySpotCheck = {
      id: patch.id || `SC-${Date.now()}`,
      vendorId: String(patch.vendorId || product?.vendorId || ""),
      vendorName: patch.vendorName || product?.vendorName || vendor?.name || "",
      vendorSystemCode: patch.vendorSystemCode || vendor?.systemCode || "",
      vendorNameSnapshot:
        patch.vendorNameSnapshot || patch.vendorName || product?.vendorName || vendor?.name || "",
      productId: String(patch.productId || product?.productId || product?.id || ""),
      productName: patch.productName || product?.name || "",
      branchId: patch.branchId || product?.branchId,
      branchName: patch.branchName || product?.branchName,
      source: (patch.source as SpotCheckSource) || "manual",
      assignedRPNId: vendor?.assignedRPNId,
      backendStaffName: patch.backendStaffName || "SCI Office",
      sector: patch.sector || product?.sector || vendor?.sector || "",
      checkDate: patch.checkDate || today(),
      type: patch.type || "BI-recommended",
      startingQty,
      listedQtyBeforeAudit,
      physicalCountQty,
      restockedQty,
      adjustedQtyAfterAudit:
        patch.adjustedQtyAfterAudit ?? physicalCountQty,
      estimatedSalesQty,
      varianceQty,
      varianceType,
      whatsappHits: patch.whatsappHits || 0,
      callHits: patch.callHits || 0,
      searchHits: patch.searchHits || 0,
      complaintCount: patch.complaintCount || 0,
      leadPressureScore,
      stockAccuracyScore,
      vendorReliabilityImpact,
      status,
      actionRequired:
        patch.actionRequired ||
        (varianceType === "matched"
          ? "No stock action required"
          : varianceType === "possible_sales"
            ? "Recommend restock"
            : "Flag vendor stock mismatch"),
      officeNotes: patch.officeNotes || "",
      assignedToStaffId: patch.assignedToStaffId || "",
      assignedToStaffName: patch.assignedToStaffName || "",
      productsCheckedCount: 1,
      productsCorrectCount: varianceType === "matched" ? 1 : 0,
      productsVarianceCount: varianceType === "matched" ? 0 : 1,
      productsMissingImagesCount: product?.imageUrl ? 0 : 1,
      productsNeedingPriceUpdateCount: 0,
      notes: patch.officeNotes || patch.notes || "",
      result:
        varianceType === "matched"
          ? "passed"
          : varianceType === "possible_sales"
            ? "follow-up required"
            : "major issues",
      createdBy: patch.createdBy || "SCI Office",
      updatedBy: "SCI Office",
      createdAt: patch.createdAt || now,
      completedAt: status === "completed" ? now : patch.completedAt,
      updatedAt: now,
    };
    check.vendorAdvice = generateVendorAdvice(check);
    return check;
  };

  const saveScheduledCheck = async () => {
    if (!canCreate) return alert("No permission to create spot checks.");
    if (!formData.vendorId || !formData.productId)
      return alert("Select vendor and product first.");
    const check = buildCompletedCheck(formData, "scheduled");
    check.physicalCountQty = formData.physicalCountQty || 0;
    check.varianceQty = undefined;
    check.varianceType = undefined;
    check.estimatedSalesQty = undefined;
    check.stockAccuracyScore = undefined;
    inventorySpotCheckService.saveSpotCheck(check);
    if (!navigator.onLine) {
      offlineSyncService.enqueue({
        module: "inventory",
        operation: "schedule_spot_check",
        recordId: check.id,
        payload: { productName: check.productName, vendorName: check.vendorName },
      });
      alert("Saved to this device. It will sync when internet returns.");
    }
    spotCheckDraft.clearDraft();
    void staffAuditService.logAction({
      eventType: "SPOT_CHECK_SCHEDULED" as any,
      module: "product",
      severity: check.leadPressureScore! >= 51 ? "high" : "info",
      action: `Created demand-led spot check for ${check.productName}`,
      recordType: "inventory_spot_check",
      recordId: check.id,
      afterSnapshot: check,
    });
    await loadData();
    setSelectedCheckId(check.id);
    setActiveTab("count");
  };

  const submitPhysicalCount = async () => {
    if (!canComplete) return alert("No permission to complete spot checks.");
    const base = selectedCheck || formData;
    const check = buildCompletedCheck({ ...base, ...formData }, "completed");
    inventorySpotCheckService.saveSpotCheck(check);
    if (!navigator.onLine) {
      offlineSyncService.enqueue({
        module: "inventory",
        operation: "complete_spot_check",
        recordId: check.id,
        payload: { productName: check.productName, vendorName: check.vendorName },
      });
      alert("Saved to this device. It will sync when internet returns.");
    }
    spotCheckDraft.clearDraft();
    void staffAuditService.logAction({
      eventType: "SPOT_CHECK_COMPLETED" as any,
      module: "product",
      severity:
        check.varianceType === "matched"
          ? "info"
          : check.varianceType === "possible_sales"
            ? "warning"
            : "high",
      action: `Physical count submitted for ${check.productName}`,
      recordType: "inventory_spot_check",
      recordId: check.id,
      afterSnapshot: check,
    });
    void staffAuditService.logAction({
      eventType: "RECORD_CREATED",
      module: "product",
      severity: "info",
      action: `Vendor advisory generated for ${check.productName}`,
      recordType: "vendor_advisory",
      recordId: check.id,
      afterSnapshot: { vendorAdvice: check.vendorAdvice },
    });
    if (check.varianceType !== "matched") {
      void notificationService.createNotification({
        type: "system_alert",
        priority:
          check.varianceType === "possible_sales" ? "high" : "critical",
        title:
          check.varianceType === "possible_sales"
            ? "Possible Sales Movement"
            : "Stock Mismatch",
        message:
          check.varianceType === "possible_sales"
            ? `${check.vendorName} product ${check.productName} appears to have moved ${check.estimatedSalesQty} units.`
            : `Listed stock ${check.listedQtyBeforeAudit}, physical count ${check.physicalCountQty}, low sales signal.`,
        recordType: "inventory_spot_check",
        recordId: check.id,
        dedupeKey: `stock-audit:${check.vendorId}:${check.productId}:${check.varianceType}:${today()}`,
      });
    }
    await loadData();
    setSelectedCheckId(check.id);
    setFormData(check);
    setActiveTab("variance");
  };

  const updateCatalogueStock = async (check: InventorySpotCheck) => {
    if (!canUpdateStock) return;
    const product = products.find(
      (p) =>
        p.vendorId === check.vendorId &&
        (p.productId === check.productId ||
          p.id === check.productId ||
          p.name === check.productName),
    );
    if (!product) return alert("Could not find linked product offer.");
    const nextQty = toNumber(check.adjustedQtyAfterAudit ?? check.physicalCountQty);
    const offer = offers.find((item) => item.id === product.offerId || item.id === product.id);
    if (offer) {
      await productService.saveVendorProductOffer({
        ...offer,
        stockQuantity: nextQty,
        stockStatus: nextQty > 0 ? "in_stock" : "out_of_stock",
        updatedAt: new Date().toISOString(),
      });
    } else {
      await productService.saveProduct({
        ...product,
        stockQuantity: nextQty,
        status: nextQty > 0 ? "active" : "out_of_stock",
      });
    }
    void staffAuditService.logAction({
      eventType: "STOCK_CHANGED",
      module: "product",
      severity: "high",
      action: `Catalogue stock updated after audit for ${check.productName}`,
      recordType: "inventory_spot_check",
      recordId: check.id,
      afterSnapshot: { adjustedQtyAfterAudit: nextQty },
    });
    await loadData();
  };

  const selectedOrRecentCompleted =
    selectedCheck ||
    checks.find((check) => check.status === "completed") ||
    null;

  const renderCreateForm = (mode: "create" | "count") => (
    <DataPanel
      title={mode === "create" ? "Create Spot Check" : "Physical Count Entry"}
      subtitle="Compare starting quantity, listed stock, restocks and physical count."
      className="border-t-4 border-t-brand-orange"
    >
      <div className="p-5 space-y-5">
        {mode === "count" && (
          <select
            className={inputClass}
            value={selectedCheckId}
            onChange={(event) => {
              const check = checks.find((item) => item.id === event.target.value);
              setSelectedCheckId(event.target.value);
              setFormData(check || createBlankCheck());
            }}
          >
            <option value="">Select scheduled check...</option>
            {checks
              .filter((check) => check.status !== "completed")
              .map((check) => (
                <option key={check.id} value={check.id}>
                  {check.productName} / {check.vendorName || check.vendorNameSnapshot}
                </option>
              ))}
          </select>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SearchableComboBox
            label="Vendor"
            value={formData.vendorName || formData.vendorNameSnapshot || ""}
            options={vendors}
            getOptionLabel={(vendor) =>
              [vendor.name, vendor.tradingName, vendor.cityTown, vendor.sector]
                .filter(Boolean)
                .join(" / ")
            }
            getOptionValue={(vendor) => vendor.id}
            getOptionSearchText={getVendorSearchText}
            placeholder="Search vendor name, phone, location, sector..."
            emptyMessage="No vendors found."
            onSelect={(vendor) =>
              setFormData({
                ...formData,
                vendorId: vendor?.id || "",
                vendorName: vendor?.name || "",
                vendorNameSnapshot: vendor?.name || "",
                vendorSystemCode: vendor?.systemCode || "",
                productId: vendor ? formData.productId : "",
                productName: vendor ? formData.productName : "",
              })
            }
          />
          <SearchableComboBox
            label="Product"
            value={formData.productName || ""}
            options={products.filter(
              (product) =>
                !formData.vendorId || product.vendorId === formData.vendorId,
            )}
            getOptionLabel={(product) =>
              [
                product.name || product.productName,
                product.brand,
                product.vendorName,
                `${product.stockQuantity || 0} units`,
              ]
                .filter(Boolean)
                .join(" / ")
            }
            getOptionValue={(product) => product.id}
            getOptionSearchText={getProductSearchText}
            placeholder="Search product, brand, SKU, barcode, vendor..."
            emptyMessage="No product offers found."
            className="md:col-span-2"
            onSelect={(product) => {
              if (product) {
                populateFromProduct(product.id);
              } else {
                setFormData({
                  ...formData,
                  productId: "",
                  productName: "",
                });
              }
            }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["startingQty", "Starting Vendor Qty"],
            ["listedQtyBeforeAudit", "Listed Qty Before Audit"],
            ["physicalCountQty", "Physical Count Qty"],
            ["restockedQty", "Restocked Qty"],
          ].map(([field, label]) => (
            <label className="space-y-2" key={field}>
              <span className="text-[10px] font-black uppercase text-stone-400">
                {label}
              </span>
              <input
                type="number"
                className={inputClass}
                value={(formData as any)[field] || 0}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    [field]: toNumber(event.target.value),
                    adjustedQtyAfterAudit:
                      field === "physicalCountQty"
                        ? toNumber(event.target.value)
                        : formData.adjustedQtyAfterAudit,
                  })
                }
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["whatsappHits", "WhatsApp Hits"],
            ["callHits", "Call Hits"],
            ["searchHits", "Search Hits"],
            ["complaintCount", "Complaints"],
          ].map(([field, label]) => (
            <label className="space-y-2" key={field}>
              <span className="text-[10px] font-black uppercase text-stone-400">
                {label}
              </span>
              <input
                type="number"
                className={inputClass}
                value={(formData as any)[field] || 0}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    [field]: toNumber(event.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {inactiveAssignedStaff && (
              <div className="border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                Previously assigned staff is no longer active. Please reassign
                to an active staff member.
              </div>
            )}
            <SearchableComboBox
              label="Assigned Staff"
              value={formData.assignedToStaffName || ""}
              options={activeStaff}
              getOptionLabel={(staff) =>
                [
                  staff.displayName || staff.fullName,
                  staff.role,
                  staff.desk,
                  staff.staffCode,
                ]
                  .filter(Boolean)
                  .join(" / ")
              }
              getOptionValue={(staff) => staff.id}
              getOptionSearchText={getStaffSearchText}
              placeholder="Search active staff..."
              emptyMessage="No active staff members available."
              onSelect={(staff) =>
                setFormData({
                  ...formData,
                  assignedToStaffId: staff?.id || "",
                  assignedToStaffName:
                    staff?.displayName || staff?.fullName || "",
                  assignedToStaffRole: staff?.role || "",
                  assignedToStaffDesk: staff?.desk || "",
                } as Partial<InventorySpotCheck>)
              }
            />
          </div>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase text-stone-400">
              Action Required
            </span>
            <input
              className={inputClass}
              value={formData.actionRequired || ""}
              onChange={(event) =>
                setFormData({ ...formData, actionRequired: event.target.value })
              }
            />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="text-[10px] font-black uppercase text-stone-400">
            Office Notes
          </span>
          <textarea
            className={`${inputClass} min-h-[90px] normal-case`}
            value={formData.officeNotes || ""}
            onChange={(event) =>
              setFormData({ ...formData, officeNotes: event.target.value })
            }
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-stone-50 border border-stone-200 p-4">
          <div>
            <p className="text-[10px] font-black uppercase text-stone-400">
              Formula
            </p>
            <p className="text-xs font-bold text-brand-charcoal">
              estimatedSalesQty = startingQty + restockedQty - physicalCountQty
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-stone-400">
              Variance
            </p>
            <p className="text-xs font-bold text-brand-charcoal">
              varianceQty = listedQtyBeforeAudit - physicalCountQty
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-stone-400">
              Lead Pressure
            </p>
            <p className="text-xs font-bold text-brand-charcoal">
              WA*4 + Call*5 + Search*2 + Complaint*6
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <SecondaryButton
            className="sm:w-44"
            onClick={() => setFormData(createBlankCheck())}
          >
            Clear
          </SecondaryButton>
          {mode === "create" ? (
            <PrimaryButton className="flex-1" onClick={saveScheduledCheck}>
              {navigator.onLine ? "Schedule Audit" : "Save Locally"}
            </PrimaryButton>
          ) : (
            <PrimaryButton className="flex-1" onClick={submitPhysicalCount}>
              {navigator.onLine ? "Submit Physical Count" : "Save Locally"}
            </PrimaryButton>
          )}
        </div>
      </div>
    </DataPanel>
  );

  return (
    <div className="space-y-6 pb-20">
      {showSpotCheckDraftPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md border-2 border-brand-orange bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-brand-charcoal">
              Unsaved draft found
            </h3>
            <p className="mt-2 text-xs font-bold text-stone-600">
              Resume or discard the inventory spot check draft saved on this device?
            </p>
            <div className="mt-5 flex gap-3">
              <PrimaryButton
                type="button"
                className="flex-1"
                onClick={() => {
                  spotCheckDraft.restoreDraft();
                  setDraftDecisionMade(true);
                  setShowSpotCheckDraftPrompt(false);
                }}
              >
                Resume
              </PrimaryButton>
              <SecondaryButton
                type="button"
                className="flex-1"
                onClick={() => {
                  spotCheckDraft.discardDraft();
                  setDraftDecisionMade(true);
                  setShowSpotCheckDraftPrompt(false);
                }}
              >
                Discard
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-brand-charcoal">
            Inventory Spot Checks
          </h1>
          <p className="text-[10px] font-bold uppercase text-stone-400">
            WhatsApp-led stock audit, sales movement and vendor advisory layer.
          </p>
        </div>
        <PrimaryButton onClick={() => setActiveTab("create")}>
          <ClipboardCheck size={14} className="mr-2" /> Create Spot Check
        </PrimaryButton>
      </div>

      <div className="sticky top-0 z-20 bg-white border-b-4 border-brand-charcoal overflow-x-auto">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[54px] whitespace-nowrap flex items-center gap-2 px-4 text-[10px] font-black uppercase ${
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

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard label="Spot Checks" value={stats.total} icon={ClipboardCheck} />
        <StatCard label="Audit Queue" value={stats.queue} icon={Bell} variant="warning" />
        <StatCard label="High Pressure" value={stats.highPressure} icon={TrendingUp} variant={stats.highPressure ? "error" : "neutral"} />
        <StatCard label="Unresolved" value={stats.unresolved} icon={AlertTriangle} variant={stats.unresolved ? "warning" : "neutral"} />
        <StatCard label="Est. Sales" value={stats.estimatedSales} icon={Package} />
        <StatCard label="Accurate Vendors" value={stats.accurateVendors} icon={CheckCircle2} variant="success" />
        <StatCard label="Mismatches" value={stats.mismatches} icon={ShieldAlert} variant={stats.mismatches ? "error" : "neutral"} />
      </div>

      {showPopupFeed && activePopupAlert && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(390px,calc(100vw-2rem))] border-2 border-brand-charcoal bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-brand-charcoal">
                SCI Stock Intelligence Feed
              </p>
              <p className="mt-1 text-sm font-bold text-brand-orange">
                {activePopupAlert.recommendedAction ===
                "Flag vendor stock mismatch"
                  ? "Stock Mismatch"
                  : "Stock Audit Recommended"}
              </p>
            </div>
            <button
              type="button"
              className="text-[10px] font-black uppercase text-stone-400"
              onClick={() => setShowPopupFeed(false)}
            >
              Dismiss
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-stone-600">
            {activePopupAlert.productName} has {activePopupAlert.whatsappHits}{" "}
            WhatsApp hits and only {activePopupAlert.listedQtyBeforeAudit}{" "}
            listed units.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="border-2 border-brand-charcoal bg-brand-charcoal px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-brand-orange"
              onClick={() => handleAcknowledgePopupAlert(activePopupAlert)}
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {activeTab === "dashboard" && canViewAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DataPanel title="SCI Office BI Summary" className="lg:col-span-2 border-t-4 border-t-brand-orange">
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["High demand products needing stock audit", stats.highPressure],
                ["Vendors with accurate stock", stats.accurateVendors],
                ["Vendors with repeated mismatches", stats.mismatches],
                ["Unresolved spot checks", stats.unresolved],
                ["Estimated sales from demand-led audits", stats.estimatedSales],
                ["Branches needing verification", new Set(demandRecommendations.map((r) => r.branchName).filter(Boolean)).size],
              ].map(([label, value]) => (
                <div key={String(label)} className="border border-stone-200 p-4">
                  <p className="text-[10px] font-black uppercase text-stone-400">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-brand-charcoal font-mono">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </DataPanel>
          <DataPanel title="Top Lead Pressure">
            <div className="p-4 space-y-3">
              {demandRecommendations.slice(0, 6).map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => loadRecommendation(rec)}
                  className="w-full text-left border border-stone-200 p-3 hover:border-brand-orange"
                >
                  <p className="text-xs font-black uppercase text-brand-charcoal truncate">
                    {rec.productName}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-400 truncate">
                    {rec.vendorName}
                  </p>
                  <StatusBadge
                    status={`${riskLevel(rec.leadPressureScore)} ${rec.leadPressureScore}`}
                    variant={riskVariant(rec.leadPressureScore)}
                  />
                </button>
              ))}
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === "queue" && (
        <TablePanel
          title="Demand-Led Audit Queue"
          subtitle="Generated from WhatsApp, calls, product searches, stock complaints and listed stock."
          headers={[
            "Vendor",
            "Product / Branch",
            "Listed Qty",
            "WA",
            "Calls",
            "Search",
            "Complaints",
            "Pressure",
            "Action",
          ]}
        >
          {demandRecommendations.map((rec) => (
            <tr key={rec.id} className="hover:bg-orange-50/30">
              <td className="px-6 py-4 text-xs font-black uppercase">{rec.vendorName}</td>
              <td className="px-6 py-4">
                <p className="text-xs font-black uppercase">{rec.productName}</p>
                <p className="text-[10px] font-bold uppercase text-stone-400 flex items-center gap-1">
                  <MapPin size={10} /> {rec.branchName || "No branch"}
                </p>
              </td>
              <td className="px-6 py-4 font-mono text-xs">{rec.listedQtyBeforeAudit}</td>
              <td className="px-6 py-4 font-mono text-xs">{rec.whatsappHits}</td>
              <td className="px-6 py-4 font-mono text-xs">{rec.callHits}</td>
              <td className="px-6 py-4 font-mono text-xs">{rec.searchHits}</td>
              <td className="px-6 py-4 font-mono text-xs text-red-600">{rec.complaintCount}</td>
              <td className="px-6 py-4">
                <StatusBadge status={`${riskLevel(rec.leadPressureScore)} ${rec.leadPressureScore}`} variant={riskVariant(rec.leadPressureScore)} />
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-2 items-start">
                  <span className="text-[10px] font-bold uppercase text-stone-500">
                    {rec.recommendedAction}
                  </span>
                  <PrimaryButton size="sm" onClick={() => loadRecommendation(rec)}>
                    Create Audit
                  </PrimaryButton>
                </div>
              </td>
            </tr>
          ))}
          {demandRecommendations.length === 0 && (
            <tr>
              <td colSpan={9} className="p-10">
                <EmptyState
                  icon={CheckCircle2}
                  title="No Demand-led Audit Pressure"
                  description="No products currently cross the lead pressure or complaint thresholds."
                />
              </td>
            </tr>
          )}
        </TablePanel>
      )}

      {activeTab === "create" && renderCreateForm("create")}
      {activeTab === "count" && renderCreateForm("count")}

      {activeTab === "variance" && (
        <TablePanel
          title="Variance & Sales Estimate"
          subtitle="estimatedSalesQty = startingQty + restockedQty - physicalCountQty."
          headers={["Product", "Vendor", "Start", "Restocked", "Physical", "Est. Sales", "Variance", "Type", "Stock Update"]}
        >
          {filteredChecks
            .filter((check) => check.status === "completed")
            .map((check) => (
              <tr key={check.id} className="hover:bg-stone-50">
                <td className="px-6 py-4 text-xs font-black uppercase">{check.productName}</td>
                <td className="px-6 py-4 text-xs font-bold uppercase">{check.vendorName || check.vendorNameSnapshot}</td>
                <td className="px-6 py-4 font-mono text-xs">{check.startingQty}</td>
                <td className="px-6 py-4 font-mono text-xs">{check.restockedQty}</td>
                <td className="px-6 py-4 font-mono text-xs">{check.physicalCountQty}</td>
                <td className="px-6 py-4 font-mono text-xs text-brand-orange font-black">{check.estimatedSalesQty}</td>
                <td className="px-6 py-4 font-mono text-xs">{check.varianceQty}</td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={check.varianceType || "pending"}
                    variant={check.varianceType === "matched" ? "success" : check.varianceType === "possible_sales" ? "warning" : "error"}
                  />
                </td>
                <td className="px-6 py-4">
                  {canUpdateStock ? (
                    <PrimaryButton size="sm" onClick={() => updateCatalogueStock(check)}>
                      Update Catalogue Stock
                    </PrimaryButton>
                  ) : (
                    <span className="text-[10px] font-black uppercase text-stone-400">
                      No permission to update catalogue stock.
                    </span>
                  )}
                </td>
              </tr>
            ))}
        </TablePanel>
      )}

      {activeTab === "advisory" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredChecks
            .filter((check) => check.status === "completed")
            .map((check) => (
              <DataPanel key={check.id} title="Vendor Advisory Card" className="border-t-4 border-t-brand-orange">
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Store className="text-brand-orange shrink-0" size={20} />
                    <div>
                      <p className="text-xs font-black uppercase text-brand-charcoal">
                        {check.vendorName || check.vendorNameSnapshot}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-stone-400">
                        {check.productName}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-stone-700 leading-relaxed">
                    {check.vendorAdvice || generateVendorAdvice(check)}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <StatusBadge status={`Demand ${riskLevel(check.leadPressureScore || 0)}`} variant={riskVariant(check.leadPressureScore || 0)} />
                    <StatusBadge status={`Accuracy ${Math.round(check.stockAccuracyScore || 0)}%`} variant={(check.stockAccuracyScore || 0) >= 90 ? "success" : "warning"} />
                  </div>
                </div>
              </DataPanel>
            ))}
        </div>
      )}

      {activeTab === "history" && (
        <DataPanel title="Audit History" subtitle="All scheduled, completed and escalated stock audit records.">
          <div className="p-4">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vendor, product, status, variance..."
            />
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredChecks.map((check) => (
              <button
                key={check.id}
                onClick={() => {
                  setSelectedCheckId(check.id);
                  setFormData(check);
                  setActiveTab(check.status === "completed" ? "variance" : "count");
                }}
                className="text-left border-2 border-stone-200 bg-white p-4 hover:border-brand-orange"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-brand-charcoal">
                      {check.productName || "Legacy vendor audit"}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-stone-400">
                      {check.vendorName || check.vendorNameSnapshot}
                    </p>
                  </div>
                  <StatusBadge status={check.status} variant={check.status === "completed" ? "success" : "warning"} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-stone-50 p-2">
                    <p className="text-[8px] font-black uppercase text-stone-400">Listed</p>
                    <p className="font-mono text-xs font-black">{check.listedQtyBeforeAudit ?? "-"}</p>
                  </div>
                  <div className="bg-stone-50 p-2">
                    <p className="text-[8px] font-black uppercase text-stone-400">Count</p>
                    <p className="font-mono text-xs font-black">{check.physicalCountQty ?? "-"}</p>
                  </div>
                  <div className="bg-stone-50 p-2">
                    <p className="text-[8px] font-black uppercase text-stone-400">Lead</p>
                    <p className="font-mono text-xs font-black">{check.leadPressureScore ?? 0}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DataPanel>
      )}

      {activeTab === "dashboard" && !canViewAnalytics && (
        <EmptyState
          icon={ShieldAlert}
          title="Analytics Permission Required"
          description="This staff profile does not have inventory.spotChecks.viewAnalytics access."
        />
      )}
    </div>
  );
};
