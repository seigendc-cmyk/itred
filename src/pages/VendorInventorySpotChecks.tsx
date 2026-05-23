import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Save,
  Upload,
  XCircle,
} from "lucide-react";
import {
  DataPanel,
  PrimaryButton,
  SecondaryButton,
  StatCard,
} from "../components/CommonUI.tsx";
import {
  MasterProduct,
  PricingPlan,
  RPN,
  Staff,
  Vendor,
  VendorInventoryAdjustmentLog,
  VendorInventorySpotCheck,
  VendorInventorySpotCheckLine,
  VendorProductOffer,
  VendorProductStockStatus,
} from "../types.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { productService } from "../services/productService.ts";
import { subscriptionService } from "../services/subscriptionService.ts";
import { vendorService } from "../services/vendorService.ts";
import { staffService } from "../services/staffService.ts";
import { rpnService } from "../services/rpnService.ts";
import { permissionService } from "../services/permissionService.ts";
import { staffAuditService } from "../services/staffAuditService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { vendorInventorySpotCheckService } from "../services/vendorInventorySpotCheckService.ts";
import {
  calculateSpotCheckUsage,
  canUseInventorySpotChecks,
  getEffectiveSpotCheckLimit,
} from "../services/entitlementEngine.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";
import {
  buildVendorProductExportRows,
  exportVendorProductRows,
  parseVendorInventoryCsv,
  safeNumber,
  VendorInventoryImportRow,
} from "../utils/vendorProductExport.ts";
import {
  getSession,
  getSessionStaffId,
  getSessionStaffName,
} from "../utils/session.ts";

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toNumber = (value: unknown) => safeNumber(value, 0);

const getVendorName = (vendor?: Vendor) =>
  vendor?.tradingName || vendor?.name || "Unknown Vendor";

const getStockStatus = (qty: number): VendorProductStockStatus => {
  if (qty <= 0) return "out_of_stock";
  if (qty <= 5) return "low_stock";
  return "in_stock";
};

const getOfferCurrentQty = (offer: VendorProductOffer) =>
  toNumber((offer as any).currentQty ?? offer.stockQuantity);

const getOfferSku = (offer: VendorProductOffer, master?: MasterProduct) =>
  String(
    offer.vendorSku ||
      offer.sku ||
      (master as any)?.sku ||
      master?.standardSku ||
      "",
  ).trim();

const getOfferProductName = (offer: VendorProductOffer, master?: MasterProduct) =>
  String(
    offer.productMode === "branded_product"
      ? offer.productName || "Unnamed Product"
      : master?.productName || offer.productName || "Unnamed Product",
  ).trim();

const getLineAction = (
  varianceQty: number,
  matchStatus: VendorInventorySpotCheckLine["matchStatus"],
): VendorInventorySpotCheckLine["action"] => {
  if (matchStatus === "unmatched") return "flag_review";
  if (varianceQty > 0) return "increase_stock";
  if (varianceQty < 0) return "decrease_stock";
  return "no_change";
};

const summarizeLines = (lines: VendorInventorySpotCheckLine[]) => ({
  totalRows: lines.length,
  changedRows: lines.filter((line) => line.varianceQty !== 0).length,
  matchedRows: lines.filter((line) => line.matchStatus !== "unmatched").length,
  unmatchedRows: lines.filter((line) => line.matchStatus === "unmatched").length,
  totalPositiveAdjustments: lines.reduce(
    (sum, line) => sum + Math.max(line.varianceQty, 0),
    0,
  ),
  totalNegativeAdjustments: lines.reduce(
    (sum, line) => sum + Math.min(line.varianceQty, 0),
    0,
  ),
});

const makeSpotCheckNumber = () =>
  `VISC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now()
    .toString()
    .slice(-5)}`;

const inputClass =
  "w-full border-2 border-stone-200 bg-white p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange disabled:bg-stone-100";

export const VendorInventorySpotChecks: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [offers, setOffers] = useState<VendorProductOffer[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [spotChecks, setSpotChecks] = useState<VendorInventorySpotCheck[]>([]);
  const [adjustmentLogs, setAdjustmentLogs] = useState<VendorInventoryAdjustmentLog[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedRpnId, setSelectedRpnId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [periodFrom, setPeriodFrom] = useState(today());
  const [periodTo, setPeriodTo] = useState(today());
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [activeSpotCheck, setActiveSpotCheck] =
    useState<VendorInventorySpotCheck | null>(null);
  const [lines, setLines] = useState<VendorInventorySpotCheckLine[]>([]);
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement | null>(null);

  const session = getSession();
  const sessionStaffId = getSessionStaffId(session) || null;
  const sessionStaffName = getSessionStaffName(session, "SCI Office");
  const sessionRole = String(session?.role || "").toLowerCase();
  const canCreate =
    permissionService.hasActionPermission("inventory.spotChecks.create") ||
    permissionService.canCreate("inventorySpotChecks");
  const canPost =
    permissionService.hasActionPermission("inventory.spotChecks.updateStock") ||
    permissionService.hasActionPermission("inventory.updateStockAfterAudit") ||
    permissionService.canEdit("inventorySpotChecks");
  const canOverrideFormula =
    sessionRole.includes("admin") || sessionRole.includes("supervisor");

  const loadData = async () => {
    const [nextVendors, nextOffers, nextMasterProducts, nextPlans] = await Promise.all([
      vendorService.getVendors(),
      productService.getVendorProductOffers(),
      productService.getMasterProducts(),
      pricingPlanService.getPlans(),
    ]);
    setVendors(Array.isArray(nextVendors) ? nextVendors : []);
    setOffers(Array.isArray(nextOffers) ? nextOffers : []);
    setMasterProducts(Array.isArray(nextMasterProducts) ? nextMasterProducts : []);
    setPlans(Array.isArray(nextPlans) ? nextPlans : []);
    setStaffList(staffService.getAllStaff());
    setRpns(rpnService.getAll());
    setSpotChecks(vendorInventorySpotCheckService.getSpotChecks());
    setAdjustmentLogs(vendorInventorySpotCheckService.getAdjustmentLogs());
  };

  useEffect(() => {
    void loadData();
  }, []);

  const vendorById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors],
  );
  const masterById = useMemo(
    () => new Map(masterProducts.map((product) => [product.id, product])),
    [masterProducts],
  );
  const offerById = useMemo(
    () => new Map(offers.map((offer) => [offer.id, offer])),
    [offers],
  );
  const selectedVendor = vendorById.get(selectedVendorId);
  const selectedVendorName = getVendorName(selectedVendor);
  const selectedPlan = plans.find((plan) => plan.id === selectedVendor?.planId);
  const selectedSubscription = selectedVendorId
    ? subscriptionService.getSubscriptionByVendor(selectedVendorId)
    : undefined;
  const spotCheckUsage = selectedVendorId
    ? calculateSpotCheckUsage(selectedVendorId)
    : 0;
  const spotCheckLimit = getEffectiveSpotCheckLimit(
    selectedPlan,
    selectedSubscription,
  );
  const spotCheckEntitlement = selectedVendorId
    ? canUseInventorySpotChecks({
        vendorId: selectedVendorId,
        plan: selectedPlan,
        subscription: selectedSubscription,
        usage: spotCheckUsage,
      })
    : { allowed: true, severity: "ok" as const, reasons: [] };
  const hasInventoryControlOverride =
    canOverrideFormula && overrideReason.trim().length > 0;
  const canProceedWithSpotCheck =
    spotCheckEntitlement.allowed || hasInventoryControlOverride;
  const selectedVendorOffers = useMemo(
    () => offers.filter((offer) => offer.vendorId === selectedVendorId),
    [offers, selectedVendorId],
  );
  const selectedRpn = rpns.find((rpn) => rpn.id === selectedRpnId);
  const selectedStaff = staffList.find((staff) => staff.id === selectedStaffId);
  const summary = useMemo(() => summarizeLines(lines), [lines]);
  const formulaWarningCount = lines.filter((line) => line.formulaWarning).length;
  const recentPosted = useMemo(
    () => spotChecks.filter((check) => check.status === "posted"),
    [spotChecks],
  );
  const stockAccuracyScore =
    summary.totalRows > 0
      ? Math.round(((summary.totalRows - summary.changedRows) / summary.totalRows) * 100)
      : 100;

  const branchesById = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach((vendor) =>
      (vendor.branches || []).forEach((branch) => {
        map.set(branch.id, branch.name);
      }),
    );
    return map;
  }, [vendors]);

  const makeLineFromOffer = (
    offer: VendorProductOffer,
    spotCheckId: string,
  ): VendorInventorySpotCheckLine => {
    const masterId = String(offer.masterProductId || offer.productId || "");
    const master = masterById.get(masterId);
    const currentQty = getOfferCurrentQty(offer);
    const now = nowIso();
    return {
      id: `VISCL-${offer.id}`,
      spotCheckId,
      vendorId: offer.vendorId || null,
      vendorName: selectedVendorName,
      productMode:
        offer.productMode === "branded_product" ? "branded_product" : "linked_product",
      vendorProductOfferId: offer.id,
      masterProductId:
        offer.productMode === "branded_product" ? null : masterId || null,
      sku: getOfferSku(offer, master) || null,
      productName: getOfferProductName(offer, master),
      branch: offer.branchId ? branchesById.get(offer.branchId) || offer.branchId : null,
      openingQty: toNumber((offer as any).openingQty),
      vendorReceipts: toNumber((offer as any).vendorReceipts),
      vendorSales: toNumber((offer as any).vendorSales),
      systemCurrentQty: currentQty,
      checkedQty: currentQty,
      varianceQty: 0,
      sellingPrice: toNumber(offer.sellingPrice),
      buyingPrice: toNumber(offer.buyingPrice),
      publishToCatalogue: offer.publishToCatalogue !== false,
      status: offer.active === false ? "inactive" : "active",
      notes: offer.notes || null,
      matchStatus: "matched_by_offer_id",
      action: "no_change",
      formulaWarning: null,
      overrideReason: null,
      createdAt: now,
      updatedAt: now,
    };
  };

  const createSpotCheckShell = (
    source: VendorInventorySpotCheck["source"],
    fileName: string | null = null,
  ): VendorInventorySpotCheck => {
    const now = nowIso();
    return {
      id: `VISC-${Date.now()}`,
      spotCheckNumber: makeSpotCheckNumber(),
      vendorId: selectedVendorId || null,
      vendorName: selectedVendorName,
      rpnId: selectedRpn?.id || null,
      rpnName: selectedRpn?.name || null,
      staffId: selectedStaff?.id || sessionStaffId,
      staffName:
        selectedStaff?.fullName ||
        selectedStaff?.displayName ||
        selectedStaff?.staffName ||
        sessionStaffName,
      source,
      status: "draft",
      periodFrom: periodFrom || null,
      periodTo: periodTo || null,
      importedFileName: fileName,
      totalRows: 0,
      changedRows: 0,
      matchedRows: 0,
      unmatchedRows: 0,
      totalPositiveAdjustments: 0,
      totalNegativeAdjustments: 0,
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      approvedByStaffId: null,
      notes: notes || null,
    };
  };

  const createManualDraft = () => {
    if (!selectedVendorId) {
      setMessage("Select a vendor before loading inventory.");
      return;
    }
    if (!canProceedWithSpotCheck) {
      setMessage(
        spotCheckEntitlement.reasons[0]?.message ||
          "Inventory Spot Checks are not enabled for this vendor plan. Add the Spot Check add-on or upgrade plan.",
      );
      void analyticsService.logEvent({
        eventType: "addon_required" as any,
        actorType: "backend_staff",
        actorName: sessionStaffName,
        result: "blocked",
        vendorId: selectedVendorId,
        details: { service: "inventory_spot_check", reason: spotCheckEntitlement.reasons[0]?.message },
      });
      return;
    }
    if (hasInventoryControlOverride) {
      void analyticsService.logEvent({
        eventType: "admin_override" as any,
        actorType: "admin",
        actorName: sessionStaffName,
        result: "success",
        vendorId: selectedVendorId,
        details: { service: "inventory_spot_check", overrideReason },
      });
    }
    const check = createSpotCheckShell("manual_entry");
    const nextLines = selectedVendorOffers.map((offer) => makeLineFromOffer(offer, check.id));
    setActiveSpotCheck({ ...check, ...summarizeLines(nextLines) });
    setLines(nextLines);
    setImportedFileName(null);
    setMessage(`Loaded ${nextLines.length} vendor products for spot checking.`);
    void analyticsService.logEvent({
      eventType: "spot_check_created" as any,
      actorType: "backend_staff",
      actorName: sessionStaffName,
      result: "success",
      vendorId: selectedVendorId,
      details: { source: "manual_entry", usage: spotCheckUsage, limit: spotCheckLimit },
    });
  };

  const exportInventory = () => {
    if (!selectedVendorId) {
      setMessage("Select a vendor before exporting inventory.");
      return;
    }
    const rows = buildVendorProductExportRows({
      offers: selectedVendorOffers,
      masterProducts,
      vendorName: selectedVendorName,
      getBranchName: (branchId) =>
        branchId ? branchesById.get(branchId) || branchId : "",
    });
    if (!exportVendorProductRows(rows, selectedVendorName, "Vendor-Inventory-Spot-Check")) {
      setMessage("No vendor products available to export.");
    }
  };

  const matchImportedRow = (
    row: VendorInventoryImportRow,
  ): {
    offer?: VendorProductOffer;
    master?: MasterProduct;
    matchStatus: VendorInventorySpotCheckLine["matchStatus"];
  } => {
    const rowOfferId = String(row["Vendor Product/Offer ID"] || "").trim();
    const rowSku = normalizeKey(row.SKU);
    const rowProductName = normalizeKey(row["Product Name"]);
    const rowVendorName = normalizeKey(row["Vendor Name"] || selectedVendorName);
    const vendorNameMatches = (offer: VendorProductOffer) =>
      !selectedVendorId ||
      offer.vendorId === selectedVendorId ||
      normalizeKey(getVendorName(vendorById.get(offer.vendorId))) === rowVendorName;

    if (rowOfferId && offerById.has(rowOfferId)) {
      const offer = offerById.get(rowOfferId);
      return {
        offer,
        master: offer
          ? masterById.get(String(offer.masterProductId || offer.productId || ""))
          : undefined,
        matchStatus: "matched_by_offer_id",
      };
    }

    if (rowSku) {
      const skuMatch = offers.find((offer) => {
        const master = masterById.get(String(offer.masterProductId || offer.productId || ""));
        return normalizeKey(getOfferSku(offer, master)) === rowSku && vendorNameMatches(offer);
      });
      if (skuMatch) {
        return {
          offer: skuMatch,
          master: masterById.get(String(skuMatch.masterProductId || skuMatch.productId || "")),
          matchStatus: "matched_by_sku_vendor",
        };
      }
    }

    if (rowProductName) {
      const nameMatch = offers.find((offer) => {
        const master = masterById.get(String(offer.masterProductId || offer.productId || ""));
        return (
          normalizeKey(getOfferProductName(offer, master)) === rowProductName &&
          vendorNameMatches(offer)
        );
      });
      if (nameMatch) {
        return {
          offer: nameMatch,
          master: masterById.get(String(nameMatch.masterProductId || nameMatch.productId || "")),
          matchStatus: "matched_by_name_vendor",
        };
      }
    }

    return { matchStatus: "unmatched" };
  };

  const importCompletedFile = async (file: File) => {
    if (!canProceedWithSpotCheck) {
      setMessage(
        spotCheckEntitlement.reasons[0]?.message ||
          "Inventory Spot Checks are not enabled for this vendor plan. Add the Spot Check add-on or upgrade plan.",
      );
      return;
    }
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("XLSX parsing is not installed in this app yet. Export or save the sheet as CSV and import it here.");
      return;
    }
    const importedRows = parseVendorInventoryCsv(await file.text());
    const check = createSpotCheckShell("excel_import", file.name);
    const now = nowIso();
    const nextLines = importedRows.map((row, index): VendorInventorySpotCheckLine => {
      const { offer, master, matchStatus } = matchImportedRow(row);
      const systemCurrentQty = offer ? getOfferCurrentQty(offer) : 0;
      const checkedQty = toNumber(row["Current Product QTY"]);
      const openingQty = toNumber(row["Opening QTY"]);
      const vendorReceipts = toNumber(row["Vendor Receipts"]);
      const vendorSales = toNumber(row["Vendor Sales"]);
      const expectedQty = openingQty + vendorReceipts - vendorSales;
      const varianceQty = checkedQty - systemCurrentQty;
      const formulaWarning =
        Math.abs(expectedQty - checkedQty) > 0.01
          ? "Current Product QTY does not equal Opening QTY + Vendor Receipts - Vendor Sales."
          : null;
      const productMode =
        offer?.productMode === "branded_product" ? "branded_product" : "linked_product";

      return {
        id: `VISCL-${check.id}-${index + 1}`,
        spotCheckId: check.id,
        vendorId: offer?.vendorId || selectedVendorId || null,
        vendorName:
          getVendorName(vendorById.get(offer?.vendorId || selectedVendorId)) ||
          String(row["Vendor Name"] || selectedVendorName),
        productMode,
        vendorProductOfferId: offer?.id || String(row["Vendor Product/Offer ID"] || "").trim() || null,
        masterProductId:
          productMode === "branded_product"
            ? null
            : String(offer?.masterProductId || offer?.productId || row["Master Product ID"] || "").trim() || null,
        sku: String(row.SKU || getOfferSku(offer as VendorProductOffer, master) || "").trim() || null,
        productName:
          String(row["Product Name"] || (offer ? getOfferProductName(offer, master) : "")).trim() ||
          "Unnamed Product",
        branch: String(row.Branch || "").trim() || null,
        openingQty,
        vendorReceipts,
        vendorSales,
        systemCurrentQty,
        checkedQty,
        varianceQty,
        sellingPrice: toNumber(row["Selling Price"] ?? offer?.sellingPrice),
        buyingPrice: toNumber(row["Buying Price"] ?? offer?.buyingPrice),
        publishToCatalogue:
          String(row["Publish To Catalogue"] || "").trim().toLowerCase() !== "no",
        status: String(row.Status || (offer?.active === false ? "inactive" : "active") || "").trim() || null,
        notes: String(row.Notes || "").trim() || null,
        matchStatus,
        action: getLineAction(varianceQty, matchStatus),
        formulaWarning,
        overrideReason: null,
        createdAt: now,
        updatedAt: now,
      };
    });

    setActiveSpotCheck({ ...check, ...summarizeLines(nextLines) });
    setLines(nextLines);
    setImportedFileName(file.name);
    setMessage(`Imported ${nextLines.length} spot-check rows. Review variances before posting.`);
  };

  const updateLine = (
    lineId: string,
    patch: Partial<VendorInventorySpotCheckLine>,
  ) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch, updatedAt: nowIso() };
        const checkedQty =
          patch.checkedQty === undefined ? next.checkedQty : toNumber(patch.checkedQty);
        const varianceQty = checkedQty - next.systemCurrentQty;
        return {
          ...next,
          checkedQty,
          varianceQty,
          action: getLineAction(varianceQty, next.matchStatus),
        };
      }),
    );
  };

  const saveDraft = (status: VendorInventorySpotCheck["status"] = "draft") => {
    if (!activeSpotCheck) {
      setMessage("Load or import inventory before saving.");
      return;
    }
    if (!canCreate) {
      setMessage("No permission to save vendor inventory spot checks.");
      return;
    }
    const nextCheck = {
      ...activeSpotCheck,
      ...summary,
      status,
      periodFrom: periodFrom || null,
      periodTo: periodTo || null,
      importedFileName,
      rpnId: selectedRpn?.id || null,
      rpnName: selectedRpn?.name || null,
      staffId: selectedStaff?.id || sessionStaffId,
      staffName:
        selectedStaff?.fullName ||
        selectedStaff?.displayName ||
        selectedStaff?.staffName ||
        sessionStaffName,
      notes: notes || null,
      updatedAt: nowIso(),
    };
    vendorInventorySpotCheckService.saveSpotCheckWithLines(nextCheck, lines);
    setActiveSpotCheck(nextCheck);
    setSpotChecks(vendorInventorySpotCheckService.getSpotChecks());
    setMessage(status === "pending_review" ? "Spot check saved for review." : "Draft saved.");
  };

  const postAdjustments = async () => {
    if (!activeSpotCheck) return setMessage("Load or import inventory before posting.");
    if (!canPost) return setMessage("No permission to approve and post adjustments.");
    if (!canProceedWithSpotCheck) {
      void analyticsService.logEvent({
        eventType: "quota_exceeded" as any,
        actorType: "backend_staff",
        actorName: sessionStaffName,
        result: "blocked",
        vendorId: selectedVendorId,
        details: { service: "inventory_spot_check", usage: spotCheckUsage, limit: spotCheckLimit },
      });
      return setMessage(
        spotCheckEntitlement.reasons[0]?.message ||
          "Inventory Spot Check quota exceeded. Add the add-on, upgrade plan, or enter an admin override reason.",
      );
    }
    if (summary.unmatchedRows > 0)
      return setMessage("Resolve or remove unmatched rows before posting.");
    if (formulaWarningCount > 0 && (!canOverrideFormula || !overrideReason.trim())) {
      return setMessage("Formula mismatch rows need an admin/supervisor override reason before posting.");
    }

    const postedAt = nowIso();
    const approvedByStaffId = sessionStaffId;
    const approvedByStaffName = sessionStaffName;
    const logs: VendorInventoryAdjustmentLog[] = [];

    for (const line of lines) {
      const offer = line.vendorProductOfferId
        ? offerById.get(line.vendorProductOfferId)
        : undefined;
      if (!offer || line.matchStatus === "unmatched") continue;
      const notesWithOverride = [line.notes, overrideReason ? `Override: ${overrideReason}` : ""]
        .filter(Boolean)
        .join(" | ");
      await productService.saveVendorProductOffer(
        sanitizeForFirestore({
          ...offer,
          openingQty: line.openingQty,
          vendorReceipts: line.vendorReceipts,
          vendorSales: line.vendorSales,
          currentQty: line.checkedQty,
          stockQuantity: line.checkedQty,
          notes: notesWithOverride || offer.notes || "",
          stockStatus: getStockStatus(line.checkedQty),
          updatedAt: postedAt,
        }) as VendorProductOffer,
      );
      logs.push({
        id: `VIAL-${activeSpotCheck.id}-${line.id}`,
        spotCheckId: activeSpotCheck.id,
        vendorId: line.vendorId,
        vendorName: line.vendorName,
        productMode: line.productMode,
        vendorProductOfferId: line.vendorProductOfferId,
        masterProductId: line.masterProductId,
        sku: line.sku,
        productName: line.productName,
        previousQty: line.systemCurrentQty,
        checkedQty: line.checkedQty,
        varianceQty: line.varianceQty,
        adjustmentType:
          line.varianceQty > 0 ? "increase" : line.varianceQty < 0 ? "decrease" : "no_change",
        reason: "rpn_spot_check",
        notes: notesWithOverride || null,
        rpnId: selectedRpn?.id || activeSpotCheck.rpnId,
        rpnName: selectedRpn?.name || activeSpotCheck.rpnName,
        approvedByStaffId,
        approvedByStaffName,
        createdAt: postedAt,
      });
    }

    const postedCheck: VendorInventorySpotCheck = {
      ...activeSpotCheck,
      ...summary,
      status: "posted",
      approvedAt: postedAt,
      approvedByStaffId,
      notes: notes || null,
      updatedAt: postedAt,
    };
    const postedLines = lines.map((line) => ({
      ...line,
      overrideReason: line.formulaWarning ? overrideReason || null : line.overrideReason || null,
      updatedAt: postedAt,
    }));
    vendorInventorySpotCheckService.saveSpotCheckWithLines(postedCheck, postedLines);
    vendorInventorySpotCheckService.addAdjustmentLogs(logs);
    void staffAuditService.logAction({
      eventType: "STOCK_CHANGED",
      module: "product",
      severity: summary.changedRows > 0 ? "high" : "info",
      action: `Posted vendor inventory spot check ${postedCheck.spotCheckNumber}`,
      recordType: "vendor_inventory_spot_check",
      recordId: postedCheck.id,
      afterSnapshot: { spotCheck: postedCheck, lineCount: postedLines.length },
    });
    await loadData();
    setActiveSpotCheck(postedCheck);
    setLines(postedLines);
    setMessage("Spot check posted. Vendor product quantities and BI adjustment logs were updated.");
    void analyticsService.logEvent({
      eventType: "spot_check_posted" as any,
      actorType: "backend_staff",
      actorName: sessionStaffName,
      result: "success",
      vendorId: selectedVendorId,
      details: { spotCheckId: postedCheck.id, changedRows: summary.changedRows },
    });
  };

  const cancelOrReject = (status: "rejected" | "cancelled") => {
    if (!activeSpotCheck) return;
    const nextCheck = {
      ...activeSpotCheck,
      ...summary,
      status,
      notes: notes || activeSpotCheck.notes,
      updatedAt: nowIso(),
    };
    vendorInventorySpotCheckService.saveSpotCheckWithLines(nextCheck, lines);
    setActiveSpotCheck(nextCheck);
    setSpotChecks(vendorInventorySpotCheckService.getSpotChecks());
    setMessage(status === "rejected" ? "Spot check rejected." : "Spot check cancelled.");
  };

  const rowTone = (line: VendorInventorySpotCheckLine) => {
    if (line.matchStatus === "unmatched") return "bg-red-50 text-red-800";
    if (line.varianceQty > 0) return "bg-emerald-50 text-emerald-800";
    if (line.varianceQty < 0) return "bg-orange-50 text-orange-800";
    return "bg-white text-stone-700";
  };

  const topVarianceProducts = adjustmentLogs
    .filter((log) => log.varianceQty !== 0)
    .sort((a, b) => Math.abs(b.varianceQty) - Math.abs(a.varianceQty))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <StatCard label="Spot Checks Completed" value={recentPosted.length} icon={ClipboardCheck} />
        <StatCard label="Vendors Checked" value={new Set(recentPosted.map((check) => check.vendorId)).size} icon={CheckCircle2} />
        <StatCard label="Products Checked" value={adjustmentLogs.length} icon={FileSpreadsheet} />
        <StatCard label="Total Variance" value={adjustmentLogs.reduce((sum, log) => sum + log.varianceQty, 0)} icon={AlertTriangle} variant="warning" />
        <StatCard label="Stock Accuracy Score" value={`${stockAccuracyScore}%`} icon={CheckCircle2} variant={stockAccuracyScore >= 90 ? "success" : "warning"} />
      </div>

      <DataPanel
        title="Vendor Inventory Spot Checks"
        subtitle="Export vendor inventory, import completed spot-check CSVs, preview variances and post stock adjustments."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={exportInventory} size="sm">
              <Download size={13} className="mr-1 inline" /> Export Vendor Inventory
            </SecondaryButton>
            <SecondaryButton
              onClick={() => importRef.current?.click()}
              size="sm"
              disabled={!!selectedVendorId && !canProceedWithSpotCheck}
            >
              <Upload size={13} className="mr-1 inline" /> Import Completed CSV
            </SecondaryButton>
            <input
              ref={importRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) void importCompletedFile(file);
              }}
            />
          </div>
        }
      >
        <div className="space-y-4 p-4">
          {message && (
            <div className="border-l-4 border-brand-orange bg-orange-50 p-3 text-xs font-bold uppercase text-orange-800">
              {message}
            </div>
          )}
          {selectedVendorId && (
            <div
              className={`border p-3 text-[10px] font-black uppercase ${
                canProceedWithSpotCheck
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              Spot Checks used this month: {spotCheckUsage} /{" "}
              {spotCheckLimit === "unlimited" ? "Unlimited" : spotCheckLimit}
              {!spotCheckEntitlement.allowed && (
                <div className="mt-1">
                  {spotCheckEntitlement.reasons[0]?.message ||
                    "Inventory Spot Checks are not enabled for this vendor plan. Add the Spot Check add-on or upgrade plan."}
                </div>
              )}
              {hasInventoryControlOverride && (
                <div className="mt-1 text-amber-700">
                  Admin override active for this spot check.
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <select
              value={selectedVendorId}
              onChange={(event) => setSelectedVendorId(event.target.value)}
              className={inputClass}
            >
              <option value="">Select Vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {getVendorName(vendor)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={periodFrom}
              onChange={(event) => setPeriodFrom(event.target.value)}
              className={inputClass}
            />
            <input
              type="date"
              value={periodTo}
              onChange={(event) => setPeriodTo(event.target.value)}
              className={inputClass}
            />
            <select
              value={selectedRpnId}
              onChange={(event) => setSelectedRpnId(event.target.value)}
              className={inputClass}
            >
              <option value="">RPN / Field Checker</option>
              {rpns.map((rpn) => (
                <option key={rpn.id} value={rpn.id}>
                  {rpn.name}
                </option>
              ))}
            </select>
            <select
              value={selectedStaffId}
              onChange={(event) => setSelectedStaffId(event.target.value)}
              className={inputClass}
            >
              <option value="">Staff Reviewer</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.fullName || staff.displayName || staff.staffName || staff.email}
                </option>
              ))}
            </select>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClass}
              placeholder="Spot check notes"
            />
            <input
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              className={inputClass}
              placeholder="Formula override reason"
            />
            <SecondaryButton
              onClick={createManualDraft}
              disabled={!!selectedVendorId && !canProceedWithSpotCheck}
            >
              <FileSpreadsheet size={14} className="mr-2 inline" /> Load Manual Table
            </SecondaryButton>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase md:grid-cols-6">
            <div className="border border-stone-200 p-3">Rows: {summary.totalRows}</div>
            <div className="border border-stone-200 p-3">Matched: {summary.matchedRows}</div>
            <div className="border border-stone-200 p-3">Unmatched: {summary.unmatchedRows}</div>
            <div className="border border-stone-200 p-3 text-emerald-700">Positive: {summary.totalPositiveAdjustments}</div>
            <div className="border border-stone-200 p-3 text-orange-700">Negative: {summary.totalNegativeAdjustments}</div>
            <div className="border border-stone-200 p-3 text-red-700">Formula Warnings: {formulaWarningCount}</div>
          </div>
        </div>
      </DataPanel>

      <DataPanel
        title="Preview Variances"
        subtitle="Checked QTY updates variance in real time. Unmatched rows are never posted automatically."
      >
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left text-xs">
            <thead className="bg-stone-100 text-[9px] font-black uppercase text-stone-500">
              <tr>
                {[
                  "Match Status",
                  "SKU",
                  "Product Name",
                  "Product Mode",
                  "Opening QTY",
                  "Vendor Receipts",
                  "Vendor Sales",
                  "System Current QTY",
                  "Checked QTY",
                  "Variance",
                  "Notes",
                  "Action",
                ].map((header) => (
                  <th key={header} className="border-b border-stone-200 px-3 py-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className={`${rowTone(line)} border-b border-stone-100`}>
                  <td className="px-3 py-2 font-black uppercase">{line.matchStatus.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 font-mono">{line.sku || "No SKU"}</td>
                  <td className="px-3 py-2 font-bold uppercase">
                    {line.productName}
                    {line.formulaWarning && (
                      <div className="mt-1 text-[9px] font-black text-red-600">
                        {line.formulaWarning}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-black uppercase">{line.productMode}</td>
                  {(["openingQty", "vendorReceipts", "vendorSales"] as const).map((field) => (
                    <td key={field} className="px-3 py-2">
                      <input
                        type="number"
                        value={line[field]}
                        onChange={(event) => updateLine(line.id, { [field]: toNumber(event.target.value) })}
                        className="w-24 border border-stone-200 bg-white p-2 font-mono"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 font-mono font-black">{line.systemCurrentQty}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={line.checkedQty}
                      onChange={(event) => updateLine(line.id, { checkedQty: toNumber(event.target.value) })}
                      className="w-24 border border-stone-200 bg-white p-2 font-mono"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-black">{line.varianceQty}</td>
                  <td className="px-3 py-2">
                    <input
                      value={line.notes || ""}
                      onChange={(event) => updateLine(line.id, { notes: event.target.value || null })}
                      className="w-56 border border-stone-200 bg-white p-2"
                    />
                  </td>
                  <td className="px-3 py-2 font-black uppercase">{line.action.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length === 0 && (
            <div className="p-8 text-center text-xs font-bold uppercase text-stone-400">
              Select a vendor and load or import inventory to start a spot check.
            </div>
          )}
        </div>
      </DataPanel>

      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        <SecondaryButton onClick={() => saveDraft("draft")} disabled={!lines.length}>
          <Save size={14} className="mr-2 inline" /> Save Draft
        </SecondaryButton>
        <SecondaryButton onClick={() => saveDraft("pending_review")} disabled={!lines.length}>
          <ClipboardCheck size={14} className="mr-2 inline" /> Submit For Review
        </SecondaryButton>
        <SecondaryButton onClick={() => cancelOrReject("rejected")} disabled={!activeSpotCheck}>
          <XCircle size={14} className="mr-2 inline" /> Reject
        </SecondaryButton>
        <SecondaryButton onClick={() => cancelOrReject("cancelled")} disabled={!activeSpotCheck}>
          Cancel
        </SecondaryButton>
        <PrimaryButton onClick={postAdjustments} disabled={!lines.length || !canPost || !canProceedWithSpotCheck}>
          <CheckCircle2 size={14} className="mr-2 inline" /> Approve & Post Adjustments
        </PrimaryButton>
      </div>

      <DataPanel
        title="BI-Ready Spot Check Signals"
        subtitle="Prepared widgets for vendor discipline, RPN performance and market intelligence."
      >
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
          <div className="border border-stone-200 p-4">
            <h4 className="mb-3 text-[10px] font-black uppercase text-brand-charcoal">
              Top Products with Variance
            </h4>
            <div className="space-y-2">
              {topVarianceProducts.map((log) => (
                <div key={log.id} className="flex justify-between gap-3 text-[10px] font-bold uppercase">
                  <span className="truncate">{log.productName}</span>
                  <span className={log.varianceQty < 0 ? "text-orange-700" : "text-emerald-700"}>
                    {log.varianceQty}
                  </span>
                </div>
              ))}
              {topVarianceProducts.length === 0 && (
                <p className="text-[10px] font-bold uppercase text-stone-400">No posted variances yet.</p>
              )}
            </div>
          </div>
          <div className="border border-stone-200 p-4 text-[10px] font-bold uppercase text-stone-500">
            Negative Variance Count: {adjustmentLogs.filter((log) => log.varianceQty < 0).length}
            <br />
            Positive Variance Count: {adjustmentLogs.filter((log) => log.varianceQty > 0).length}
            <br />
            Vendors with Repeated Variance: {
              Array.from(
                adjustmentLogs.reduce((map, log) => {
                  if (log.varianceQty !== 0 && log.vendorId) {
                    map.set(log.vendorId, (map.get(log.vendorId) || 0) + 1);
                  }
                  return map;
                }, new Map<string, number>()),
              ).filter(([, count]) => count > 1).length
            }
          </div>
          <div className="border border-stone-200 p-4 text-[10px] font-bold uppercase text-stone-500">
            RPN Check Performance records: {new Set(recentPosted.map((check) => check.rpnId).filter(Boolean)).size}
            <br />
            Adjustment logs are stored in vendorInventoryAdjustmentLogs.
            <br />
            Spot check headers and lines are stored in vendorInventorySpotChecks and vendorInventorySpotCheckLines.
          </div>
        </div>
      </DataPanel>
    </div>
  );
};

export default VendorInventorySpotChecks;
