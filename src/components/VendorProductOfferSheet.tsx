import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  PackageSearch,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  BrandedAlertModal,
  PrimaryButton,
  SecondaryButton,
} from "./CommonUI.tsx";
import {
  MasterProduct,
  PricingPlan,
  Subscription,
  Vendor,
  VendorProductOffer,
  VendorProductStockStatus,
} from "../types.ts";
import { productService } from "../services/productService.ts";
import { subscriptionService } from "../services/subscriptionService.ts";
import { staffAuditService } from "../services/staffAuditService.ts";
import { permissionService } from "../services/permissionService.ts";
import { generateVendorOfferId } from "../utils/idGenerator.ts";
import { compressImage } from "../lib/imageUtils.ts";
import {
  getMaxImagesForListing,
  normalizeListingImages,
} from "../utils/listingImageEntitlements.ts";
import {
  calculateBrandedProductUsage,
  canUseBrandedProducts,
  getEffectiveBrandedProductLimit,
} from "../services/entitlementEngine.ts";
import {
  getSession,
  getSessionStaffId,
  getSessionStaffName,
  hasValidSession,
} from "../utils/session.ts";
import { sanitizeForFirestore } from "../utils/firestoreSanitize.ts";
import {
  buildVendorProductExportRows,
  exportVendorProductRows,
  parseVendorInventoryCsv,
  safeNumber,
} from "../utils/vendorProductExport.ts";

type SelectedVendorOfferDraft = {
  offerId?: string;
  existingLinkId?: string | null;
  linkMode: "new" | "edit_existing";
  productMode: "linked_product" | "branded_product";
  productId: string;
  productName: string;
  category: string;
  sector: string;
  description: string;
  brandDisplayName: string;
  brandLogoUrl: string;
  brandBannerUrl: string;
  images: { url: string; alt?: string | null; sortOrder?: number; isPrimary?: boolean }[];
  vendorId: string;
  branchId: string | null;
  openingQty: number;
  vendorReceipts: number;
  vendorSales: number;
  qty: number;
  sellingPrice: number;
  buyingPrice: number | null;
  discountPrice: number | null;
  vendorSku: string;
  publish: boolean;
  delivery: boolean;
  active: boolean;
  notes: string;
  createdAt?: string;
  error?: string;
};

interface VendorProductOfferSheetProps {
  open: boolean;
  onClose: () => void;
  vendorId?: string;
  vendorName?: string;
  lockVendor?: boolean;
  masterProducts: MasterProduct[];
  plans?: PricingPlan[];
  vendors: Vendor[];
  existingOffers: VendorProductOffer[];
  onSaved: (savedOffers: VendorProductOffer[]) => void;
}

export const normalizeSearch = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const matchesAllTokens = (query: string, searchBlob: string): boolean => {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const normalizedBlob = normalizeSearch(searchBlob);
  return tokens.every((token) => normalizedBlob.includes(token));
};

const normalizeFilterKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getProductSourceVendorKey = (product: any) =>
  normalizeFilterKey(
    product.sourceVendorId ??
      product.ownerVendorId ??
      product.brandOwnerVendorId ??
      product.createdByVendorId ??
      product.vendorId ??
      product.sourceVendorName ??
      product.vendorName ??
      product.brandName ??
      "",
  );

const getProductSourceVendorLabel = (product: any) =>
  String(
    product.sourceVendorName ??
      product.vendorName ??
      product.brandName ??
      product.sourceVendorId ??
      product.ownerVendorId ??
      product.brandOwnerVendorId ??
      product.createdByVendorId ??
      product.vendorId ??
      "No vendor/source",
  ).trim();

const numberOrZero = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const stockStatusFromQuantity = (quantity: number): VendorProductStockStatus => {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= 5) return "low_stock";
  return "in_stock";
};

const productSearchBlob = (product: MasterProduct) =>
  [
    product.productName,
    (product as any).name,
    product.brand,
    product.category,
    product.sector,
    product.barcode,
    product.standardSku,
    (product as any).sku,
    product.description,
    ...(product.tags || []),
    ...(product.keywords || []),
  ]
    .filter(Boolean)
    .join(" ");

export const VendorProductOfferSheet: React.FC<VendorProductOfferSheetProps> = ({
  open,
  onClose,
  vendorId,
  vendorName,
  lockVendor = false,
  masterProducts,
  plans = [],
  vendors,
  existingOffers,
  onSaved,
}) => {
  const [search, setSearch] = useState("");
  const [selectedSourceVendorFilter, setSelectedSourceVendorFilter] =
    useState("all");
  const [creationMode, setCreationMode] = useState<
    "linked_product" | "branded_product"
  >("linked_product");
  const [selectedSheetSearch, setSelectedSheetSearch] = useState("");
  const [
    selectedOfferDraftsByProductId,
    setSelectedOfferDraftsByProductId,
  ] = useState<Record<string, SelectedVendorOfferDraft>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [bulkBranchId, setBulkBranchId] = useState("");
  const [bulkPublish, setBulkPublish] = useState(true);
  const [bulkDelivery, setBulkDelivery] = useState(true);
  const [bulkActive, setBulkActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, message: "", type: "info" });

  const canSave =
    permissionService.canEdit("vendorManagement") ||
    permissionService.canEdit("productManagement") ||
    permissionService.canCreate("productManagement");

  const productById = useMemo(
    () => new Map(masterProducts.map((product) => [product.id, product])),
    [masterProducts],
  );

  const vendorById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors],
  );

  const selectedVendor = vendorId ? vendorById.get(vendorId) : undefined;
  const activeVendorId = vendorId || vendors[0]?.id || "";
  const activeVendor = vendorById.get(activeVendorId);
  const activePlan = plans.find((plan) => plan.id === activeVendor?.planId);
  const activeSubscription = activeVendorId
    ? (subscriptionService.getSubscriptionByVendor(activeVendorId) as
        | Subscription
        | undefined)
    : undefined;
  const brandedUsage = calculateBrandedProductUsage(
    activeVendorId,
    existingOffers,
  );
  const brandedEntitlement = canUseBrandedProducts({
    vendorId: activeVendorId,
    plan: activePlan,
    subscription: activeSubscription,
    usage: brandedUsage,
  });
  const brandedLimit = getEffectiveBrandedProductLimit(
    activePlan,
    activeSubscription,
  );
  const activeVendorName =
    vendorName || activeVendor?.tradingName || activeVendor?.name || "this vendor";

  useEffect(() => {
    if (!open) return;
    setSelectedOfferDraftsByProductId({});
    setHasUnsavedChanges(false);
  }, [open, vendorId]);

  const existingVendorProductLinks = useMemo(
    () =>
      existingOffers.filter(
        (offer) => offer.vendorId === activeVendorId && !!(offer.masterProductId || offer.productId),
      ),
    [activeVendorId, existingOffers],
  );

  const linkedProductMap = useMemo(() => {
    const map = new Map<string, VendorProductOffer>();
    existingVendorProductLinks.forEach((link) => {
      if (link.productMode === "branded_product") return;
      const key = String(link.masterProductId || link.productId);
      map.set(key, link);
    });
    return map;
  }, [existingVendorProductLinks]);

  const linkedByProductId = useMemo(() => {
    const map = new Map<string, VendorProductOffer[]>();
    existingVendorProductLinks.forEach((link) => {
      if (link.productMode === "branded_product") return;
      const productId = String(link.masterProductId || link.productId);
      const rows = map.get(productId) ?? [];
      rows.push(link);
      map.set(productId, rows);
    });
    return map;
  }, [existingVendorProductLinks]);

  const sourceVendorOptions = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; count: number }
    >();

    masterProducts.forEach((product: any) => {
      const key = getProductSourceVendorKey(product) || "no-source";
      const label = getProductSourceVendorLabel(product) || "No vendor/source";
      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, label, count: 1 });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [masterProducts]);

  const searchResults = useMemo(() => {
    return masterProducts
      .filter((product) => {
        const matchesSearch = matchesAllTokens(search, productSearchBlob(product));
        const productSourceKey =
          getProductSourceVendorKey(product) || "no-source";
        const matchesSourceVendor =
          selectedSourceVendorFilter === "all" ||
          productSourceKey === selectedSourceVendorFilter;

        return matchesSearch && matchesSourceVendor;
      })
      .slice(0, 40);
  }, [masterProducts, search, selectedSourceVendorFilter]);

  const vendorBranches = (rowVendorId: string) =>
    vendorById.get(rowVendorId)?.branches || [];

  const selectedOfferDrafts = useMemo(
    () => Object.values(selectedOfferDraftsByProductId),
    [selectedOfferDraftsByProductId],
  );

  const visibleSelectedOfferDrafts = useMemo(
    () =>
      selectedOfferDrafts.filter((draft) =>
        matchesAllTokens(
          selectedSheetSearch,
          [
            draft.productName,
            draft.vendorSku,
            draft.notes,
            vendorById.get(draft.vendorId)?.name,
            vendorById.get(draft.vendorId)?.tradingName,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      ),
    [selectedOfferDrafts, selectedSheetSearch, vendorById],
  );

  const handleExportExistingOffers = () => {
    const rows = buildVendorProductExportRows({
      offers: existingVendorProductLinks,
      masterProducts,
      vendorName: activeVendorName,
      getBranchName: (branchId) =>
        vendorBranches(activeVendorId).find((branch) => branch.id === branchId)
          ?.name || "",
    });

    if (!exportVendorProductRows(rows, activeVendorName)) {
      setAlertConfig({
        isOpen: true,
        message: "No products available to export.",
        type: "info",
      });
    }
  };

  const handleImportInventoryCsv = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!activeVendorId) {
      showAlert("Select a vendor before importing inventory.", "warning");
      return;
    }

    setIsImporting(true);
    try {
      const rows = parseVendorInventoryCsv(await file.text());
      if (!rows.length) {
        showAlert("No inventory rows were found in the import file.", "warning");
        return;
      }

      const byId = new Map(existingVendorProductLinks.map((offer) => [offer.id, offer]));
      const bySku = new Map<string, VendorProductOffer>();
      existingVendorProductLinks.forEach((offer) => {
        const product = productById.get(String(offer.masterProductId || offer.productId));
        const sku = String(
          offer.vendorSku ||
            offer.sku ||
            (product as any)?.sku ||
            product?.standardSku ||
            "",
        )
          .trim()
          .toLowerCase();
        if (sku && !bySku.has(sku)) bySku.set(sku, offer);
      });

      const warnings: string[] = [];
      const updatedOffers: VendorProductOffer[] = [];
      const pendingUpdates: VendorProductOffer[] = [];
      const now = new Date().toISOString();

      for (const [index, row] of rows.entries()) {
        const offerId = String(row["Vendor Product/Offer ID"] || "").trim();
        const sku = String(row.SKU || "").trim().toLowerCase();
        const match = (offerId && byId.get(offerId)) || (sku && bySku.get(sku));
        if (!match || match.vendorId !== activeVendorId) {
          warnings.push(`Row ${index + 2}: no matching vendor offer found.`);
          continue;
        }

        const openingQty = safeNumber(row["Opening QTY"]);
        const vendorReceipts = safeNumber(row["Vendor Receipts"]);
        const vendorSales = safeNumber(row["Vendor Sales"]);
        const currentQty = safeNumber(row["Current Product QTY"]);
        const expectedQty = openingQty + vendorReceipts - vendorSales;
        if (Math.abs(currentQty - expectedQty) > 0.01) {
          warnings.push(
            `Row ${index + 2}: Current Product QTY ${currentQty} differs from Opening QTY + Vendor Receipts - Vendor Sales (${expectedQty}).`,
          );
        }

        const updatedOffer: VendorProductOffer = sanitizeForFirestore({
          ...match,
          openingQty,
          vendorReceipts,
          vendorSales,
          currentQty,
          stockQuantity: currentQty,
          stockStatus: stockStatusFromQuantity(currentQty),
          notes: String(row.Notes || ""),
          updatedAt: now,
        }) as VendorProductOffer;
        pendingUpdates.push(updatedOffer);
      }

      if (warnings.length > 0) {
        const shouldContinue = window.confirm(
          [
            "Inventory import completed with warnings.",
            "",
            ...warnings.slice(0, 8),
            warnings.length > 8 ? `...and ${warnings.length - 8} more warnings.` : "",
            "",
            "The mismatched rows were imported as operator overrides. Continue?",
          ]
            .filter(Boolean)
            .join("\n"),
        );
        if (!shouldContinue) {
          showAlert("Inventory import cancelled. No offer updates were saved.", "info");
          return;
        }
      }

      for (const updatedOffer of pendingUpdates) {
        await productService.saveVendorProductOffer(updatedOffer);
        updatedOffers.push(updatedOffer);
      }

      if (updatedOffers.length > 0) onSaved(updatedOffers);
      showAlert(
        `Imported inventory updates for ${updatedOffers.length} vendor offer${updatedOffers.length === 1 ? "" : "s"}.`,
        warnings.length > 0 ? "warning" : "success",
      );
    } catch (error) {
      console.error("Vendor inventory import failed", error);
      showAlert(
        error instanceof Error ? error.message : "Inventory import failed.",
        "error",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const showAlert = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "info",
  ) => setAlertConfig({ isOpen: true, message, type });

  const getBranchName = (rowVendorId: string, rowBranchId?: string | null) => {
    if (!rowBranchId) return "General Stock";
    return (
      vendorById
        .get(rowVendorId)
        ?.branches?.find((branch) => branch.id === rowBranchId)?.name ||
      "Selected Branch"
    );
  };

  const focusSelectedDraft = (productId: string) => {
    setSelectedSheetSearch("");
    window.setTimeout(() => {
      document
        .getElementById(`vendor-offer-draft-${productId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const draftFromExistingOffer = (
    offer: VendorProductOffer,
  ): SelectedVendorOfferDraft => {
    const linkedProductId = String(offer.masterProductId || offer.productId);
    const product = productById.get(linkedProductId);
    return {
      offerId: offer.id,
      existingLinkId: offer.id,
      linkMode: "edit_existing",
      productId: linkedProductId,
      productMode: offer.productMode || "linked_product",
      productName:
        product?.productName ||
        offer.productName ||
        (product as any)?.name ||
        "Unnamed product",
      vendorId: offer.vendorId || activeVendorId,
      category: offer.category || product?.category || "",
      sector: offer.sector || product?.sector || "",
      description: offer.description || product?.description || "",
      brandDisplayName: offer.brandDisplayName || "",
      brandLogoUrl: offer.brandLogoUrl || "",
      brandBannerUrl: offer.brandBannerUrl || "",
      images: normalizeListingImages(offer, getMaxImagesForListing(activeVendor, activePlan, offer)) as any,
      branchId: offer.branchId || null,
      openingQty: numberOrZero((offer as any).openingQty),
      vendorReceipts: numberOrZero((offer as any).vendorReceipts),
      vendorSales: numberOrZero((offer as any).vendorSales),
      qty: numberOrZero(offer.stockQuantity),
      sellingPrice: numberOrZero(offer.sellingPrice),
      buyingPrice:
        offer.buyingPrice === undefined || offer.buyingPrice === null
          ? null
          : numberOrZero(offer.buyingPrice),
      discountPrice:
        offer.discountPrice === undefined || offer.discountPrice === null
          ? null
          : numberOrZero(offer.discountPrice),
      vendorSku: offer.vendorSku || product?.standardSku || "",
      publish: offer.publishToCatalogue !== false,
      delivery: offer.deliveryAvailable !== false,
      active: offer.active !== false,
      notes: offer.notes || "",
      createdAt: offer.createdAt,
    };
  };

  const loadExistingOfferDraft = (
    offer: VendorProductOffer,
    options: { warn?: boolean } = {},
  ) => {
    const linkedProductId = String(offer.masterProductId || offer.productId);
    setSelectedOfferDraftsByProductId((prev) => ({
      ...prev,
      [linkedProductId]: prev[linkedProductId] || draftFromExistingOffer(offer),
    }));
    focusSelectedDraft(linkedProductId);
    if (options.warn) {
      showAlert(
        "This product is already linked to this vendor. Edit the existing row instead.",
        "info",
      );
    }
  };

  const addProductToSheet = (product: MasterProduct) => {
    const existingDraft = selectedOfferDraftsByProductId[product.id];
    if (existingDraft) {
      focusSelectedDraft(product.id);
      showAlert(
        "This product is already selected in the sheet. Edit the existing row instead.",
        "info",
      );
      return;
    }

    const existingProductLinks = linkedByProductId.get(product.id) || [];
    const defaultVendorId = activeVendorId;
    const defaultBranchId =
      bulkBranchId || vendorById.get(defaultVendorId)?.branches?.[0]?.id || null;
    const sameBranchLink = linkedProductMap.get(product.id);

    if (sameBranchLink) {
      loadExistingOfferDraft(sameBranchLink, { warn: true });
      return;
    }

    setSelectedOfferDraftsByProductId((prev) => {
      if (prev[product.id]) return prev;
      setHasUnsavedChanges(true);
      return {
        ...prev,
        [product.id]: {
          existingLinkId: null,
          linkMode: "new",
          productMode: "linked_product",
          productId: product.id,
          productName:
            product.productName ||
            (product as any).name ||
            (product as any).title ||
            "Unnamed product",
          vendorId: defaultVendorId,
          category: product.category || "",
          sector: product.sector || "",
          description: product.description || "",
          brandDisplayName: "",
          brandLogoUrl: "",
          brandBannerUrl: "",
          images: normalizeListingImages(product, getMaxImagesForListing(vendorById.get(defaultVendorId), activePlan, product)) as any,
          branchId: defaultBranchId,
          openingQty: 0,
          vendorReceipts: 0,
          vendorSales: 0,
          qty: 0,
          sellingPrice: Number((product as any).price ?? (product as any).sellingPrice ?? 0),
          buyingPrice: Number((product as any).buyingPrice ?? 0) || null,
          discountPrice: null,
          vendorSku: product.standardSku || (product as any).sku || "",
          publish: true,
          delivery: true,
          active: true,
          notes: "",
          createdAt: new Date().toISOString(),
        },
      };
    });
  };

  const addBrandedProductToSheet = () => {
    if (!activeVendorId) {
      showAlert("Select a vendor before creating a branded product.", "warning");
      return;
    }

    if (!brandedEntitlement.allowed) {
      showAlert(
        "Branded Products is not enabled for this vendor. Add the Branded Products add-on or upgrade entitlement.",
        "warning",
      );
      return;
    }

    const productId = `BP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const defaultBranchId =
      bulkBranchId || vendorById.get(activeVendorId)?.branches?.[0]?.id || null;
    const vendor = vendorById.get(activeVendorId);

    setSelectedOfferDraftsByProductId((prev) => ({
      ...prev,
      [productId]: {
        existingLinkId: null,
        linkMode: "new",
        productMode: "branded_product",
        productId,
        productName: "",
        vendorId: activeVendorId,
        category: vendor?.category || "",
        sector: vendor?.sector || "",
        description: "",
        brandDisplayName:
          vendor?.catalogueDisplayName || vendor?.tradingName || vendor?.name || "",
        brandLogoUrl: vendor?.logoAssetUrl || vendor?.logoUrl || "",
        brandBannerUrl: vendor?.bannerAssetUrl || vendor?.bannerUrl || "",
        images: [],
        branchId: defaultBranchId,
        openingQty: 0,
        vendorReceipts: 0,
        vendorSales: 0,
        qty: 0,
        sellingPrice: 0,
        buyingPrice: null,
        discountPrice: null,
        vendorSku: "",
        publish: true,
        delivery: true,
        active: true,
        notes: "",
        createdAt: new Date().toISOString(),
      },
    }));
    setHasUnsavedChanges(true);
    focusSelectedDraft(productId);
  };

  const updateSelectedOfferDraft = <K extends keyof SelectedVendorOfferDraft>(
    productId: string,
    field: K,
    value: SelectedVendorOfferDraft[K],
  ) => {
    setSelectedOfferDraftsByProductId((prev) => {
      const current = prev[productId];
      if (!current) return prev;
      setHasUnsavedChanges(true);
      return {
        ...prev,
        [productId]: {
          ...current,
          [field]: value,
          error: undefined,
        },
      };
    });
  };

  const handleDraftImagesUpload = async (
    productId: string,
    files: FileList | null,
  ) => {
    const row = selectedOfferDraftsByProductId[productId];
    if (!row || !files?.length) return;
    const rowVendor = vendorById.get(row.vendorId);
    const rowPlan = plans.find((plan) => plan.id === rowVendor?.planId);
    const maxImages = getMaxImagesForListing(rowVendor, rowPlan, row);
    const currentImages = normalizeListingImages(row, maxImages) as any[];
    const remaining = maxImages - currentImages.length;
    if (remaining <= 0) {
      showAlert(`This plan allows up to ${maxImages} images per listing.`, "warning");
      return;
    }

    try {
      const compressed = await Promise.all(
        Array.from(files)
          .slice(0, remaining)
          .map((file) => compressImage(file, 720, 0.7)),
      );
      const nextImages = [
        ...currentImages,
        ...compressed.map((result, index) => ({
          url: result.base64,
          alt: row.productName || null,
          sortOrder: currentImages.length + index,
          isPrimary: currentImages.length + index === 0,
        })),
      ].slice(0, maxImages);
      updateSelectedOfferDraft(productId, "images", nextImages as any);
      if (files.length > remaining) {
        showAlert(`This plan allows up to ${maxImages} images per listing.`, "warning");
      }
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Image processing failed.",
        "error",
      );
    }
  };

  const removeDraftImage = (productId: string, imageUrl: string) => {
    const row = selectedOfferDraftsByProductId[productId];
    if (!row) return;
    const nextImages = normalizeListingImages(row)
      .filter((image) => image.url !== imageUrl)
      .map((image, index) => ({
        ...image,
        sortOrder: index,
        isPrimary: index === 0,
      }));
    updateSelectedOfferDraft(productId, "images", nextImages as any);
  };

  const removeDraft = (productId: string) => {
    setSelectedOfferDraftsByProductId((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const clearSelection = () => {
    if (
      selectedOfferDrafts.length > 0 &&
      !window.confirm("Clear all selected product sheet rows?")
    ) {
      return;
    }
    setSelectedOfferDraftsByProductId({});
    setHasUnsavedChanges(true);
  };

  const applyBranchToAll = () => {
    setSelectedOfferDraftsByProductId((current) =>
      Object.fromEntries(
        Object.entries(current).map(([productId, row]) => [
          productId,
          { ...row, branchId: bulkBranchId || null, error: undefined },
        ]),
      ),
    );
    setHasUnsavedChanges(true);
  };

  const applyBooleanToAll = (
    key: "publish" | "delivery" | "active",
    value: boolean,
  ) => {
    setSelectedOfferDraftsByProductId((current) =>
      Object.fromEntries(
        Object.entries(current).map(([productId, row]) => [
          productId,
          { ...row, [key]: value },
        ]),
      ),
    );
    setHasUnsavedChanges(true);
  };

  const validateRows = (): SelectedVendorOfferDraft[] => {
    const seen = new Set<string>();

    return selectedOfferDrafts.map((row) => {
      let error = "";
      if (!row.vendorId) error = "Vendor is required.";
      else if (!row.productId) error = "Product is required.";
      else if (row.productMode === "branded_product" && !row.productName.trim())
        error = "Product name is required for branded products.";
      else if (row.productMode === "branded_product" && !row.category.trim())
        error = "Category is required for branded products.";
      else if (row.productMode === "branded_product" && !row.sector.trim())
        error = "Sector is required for branded products.";
      else if (numberOrZero(row.qty) < 0) error = "Qty must be 0 or more.";
      else if (numberOrZero(row.openingQty) < 0) error = "Opening QTY must be 0 or more.";
      else if (numberOrZero(row.vendorReceipts) < 0) error = "Vendor Receipts must be 0 or more.";
      else if (numberOrZero(row.vendorSales) < 0) error = "Vendor Sales must be 0 or more.";
      else if (numberOrZero(row.sellingPrice) < 0)
        error = "Selling price must be 0 or more.";
      else if (numberOrZero(row.buyingPrice) < 0)
        error = "Buying price must be 0 or more.";
      else if (
        normalizeListingImages(row).length >
        getMaxImagesForListing(
          vendorById.get(row.vendorId),
          plans.find((plan) => plan.id === vendorById.get(row.vendorId)?.planId),
          row,
        )
      )
        error = "Image limit exceeded for current plan.";
      else {
        const key = `${row.vendorId}::${row.productId}`;
        const matchedExisting = existingOffers.find(
          (offer) =>
            `${offer.vendorId}::${offer.masterProductId || offer.productId}` === key,
        );
        const currentLinkId = row.existingLinkId || row.offerId;
        const isExistingDuplicate =
          !!matchedExisting && matchedExisting.id !== currentLinkId;
        const isSheetDuplicate = seen.has(key);
        if (
          row.productMode !== "branded_product" &&
          (isExistingDuplicate || isSheetDuplicate)
        ) {
          error = "This master product is already linked to this vendor.";
        }
        seen.add(key);
      }
      return { ...row, error };
    });
  };

  const saveSheet = async () => {
    if (!canSave) {
      showAlert("You do not have permission to save vendor product offers.", "warning");
      return;
    }

    const session = getSession();
    if (!hasValidSession(session)) {
      showAlert("Session expired. Please login again before saving.", "warning");
      return;
    }

    if (selectedOfferDrafts.length === 0) {
      showAlert("Add products to the sheet before saving.", "warning");
      return;
    }

    const validated = validateRows();
    setSelectedOfferDraftsByProductId(
      Object.fromEntries(validated.map((row) => [row.productId, row])),
    );
    if (validated.some((row) => row.error)) {
      showAlert("Fix validation errors before saving the product sheet.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const savedOffers: VendorProductOffer[] = [];

      for (const row of validated) {
        const product = productById.get(row.productId);
        const existingOffer = row.existingLinkId || row.offerId
          ? existingOffers.find(
              (offer) =>
                offer.id === (row.existingLinkId || row.offerId),
            )
          : undefined;
        const offer: VendorProductOffer = {
          ...(existingOffer || {}),
          id: row.existingLinkId || row.offerId || generateVendorOfferId(),
          vendorId: row.vendorId,
          productId: row.productId,
          productMode: row.productMode,
          sourceType:
            row.productMode === "branded_product"
              ? "vendor_branded"
              : "master_linked",
          masterProductId:
            row.productMode === "branded_product" ? null : row.productId,
          brandOwnerVendorId:
            row.productMode === "branded_product" ? row.vendorId : undefined,
          isVendorBranded: row.productMode === "branded_product",
          productName: product?.productName || row.productName,
          category: row.category,
          sector: row.sector,
          description: row.description,
          brandDisplayName: row.brandDisplayName,
          brandLogoUrl: row.brandLogoUrl,
          brandBannerUrl: row.brandBannerUrl,
          branchId: row.branchId || "",
          openingQty: numberOrZero(row.openingQty),
          vendorReceipts: numberOrZero(row.vendorReceipts),
          vendorSales: numberOrZero(row.vendorSales),
          currentQty: numberOrZero(row.qty),
          stockQuantity: numberOrZero(row.qty),
          stockStatus: stockStatusFromQuantity(numberOrZero(row.qty)),
          sellingPrice: numberOrZero(row.sellingPrice),
          buyingPrice: numberOrZero(row.buyingPrice),
          discountPrice: numberOrZero(row.discountPrice),
          vendorSku: row.vendorSku || "",
          vendorProductImage: row.images?.[0]?.url || existingOffer?.vendorProductImage || "",
          images: (row.images || []).map((image, index) => ({
            ...image,
            sortOrder: index,
            isPrimary: index === 0,
          })),
          publishToCatalogue: row.publish,
          deliveryAvailable: row.delivery,
          active: row.active,
          featured: existingOffer?.featured || false,
          notes: row.notes || "",
          createdAt: row.createdAt || existingOffer?.createdAt || now,
          updatedAt: now,
        } as VendorProductOffer;

        const safeOffer = sanitizeForFirestore({
          ...offer,
          branchId: offer.branchId || null,
          buyingPrice:
            row.buyingPrice === null ? null : numberOrZero(row.buyingPrice),
          discountPrice:
            row.discountPrice === null ? null : numberOrZero(row.discountPrice),
          notes: row.notes || "",
          category: row.category || null,
          sector: row.sector || null,
          description: row.description || null,
          brandDisplayName: row.brandDisplayName || null,
          brandLogoUrl: row.brandLogoUrl || null,
          brandBannerUrl: row.brandBannerUrl || null,
          images: offer.images || [],
        }) as VendorProductOffer;

        await productService.saveVendorProductOffer(safeOffer);
        savedOffers.push(safeOffer);

        try {
          void staffAuditService.logAction({
            eventType:
              row.linkMode === "edit_existing" || existingOffer
                ? "RECORD_UPDATED"
                : "RECORD_CREATED",
            module: "vendor_products",
            severity: "info",
            action: "Saved vendor product offer",
            recordType: "vendor_product_offer",
            recordId: safeOffer.id,
            recordName: product?.productName || row.productName,
            afterSnapshot: {
              ...safeOffer,
              updatedBy: getSessionStaffId(session),
              updatedByName: getSessionStaffName(session),
            },
          });
        } catch (auditError) {
          console.error("Vendor product offer audit logging failed", auditError);
        }
      }

      onSaved(savedOffers);
      setSelectedOfferDraftsByProductId({});
      setHasUnsavedChanges(false);
      setSearch("");
      setSelectedSheetSearch("");
      showAlert("Vendor product sheet saved successfully.", "success");
    } catch (error) {
      console.error("Vendor product sheet save failed", error);
      showAlert(
        error instanceof Error
          ? error.message
          : "Product sheet save failed. Please try again.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  const defaultBulkBranches = selectedVendor?.branches || [];
  const handleClose = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Close Product Sheet and discard unsaved product changes?")
    ) {
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40">
      <div className="mx-auto mt-4 h-[92vh] w-[96vw] max-w-[1400px] bg-white border-t-4 border-t-brand-orange shadow-2xl flex min-w-0 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-black uppercase tracking-widest text-brand-charcoal">
              Vendor Product Sheet
            </h2>
            <p className="mt-1 text-[10px] font-bold uppercase text-stone-400">
              Build this vendor's price, stock, branch and catalogue publishing sheet from the Master Product Library.
            </p>
            {(vendorName || selectedVendor?.name) && (
              <p className="mt-2 text-[10px] font-black uppercase text-brand-orange">
                {vendorName || selectedVendor?.name}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="border border-brand-orange bg-orange-50 px-2 py-1 text-[10px] font-black uppercase text-brand-orange">
                Selected: {selectedOfferDrafts.length}
              </span>
              {hasUnsavedChanges && (
                <span className="border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-700">
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportInventoryCsv}
            />
            <SecondaryButton
              size="sm"
              disabled={existingVendorProductLinks.length === 0 || isImporting}
              onClick={() => importInputRef.current?.click()}
            >
              <Upload size={14} className="mr-2 inline" /> Import Inventory Excel
            </SecondaryButton>
            <SecondaryButton
              size="sm"
              disabled={existingVendorProductLinks.length === 0}
              onClick={handleExportExistingOffers}
            >
              <Download size={14} className="mr-2 inline" /> Export Vendor Inventory Excel
            </SecondaryButton>
            <button
              type="button"
              onClick={handleClose}
              className="border border-stone-200 p-2 text-stone-400 hover:border-brand-orange hover:text-brand-orange"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {!canSave && (
            <div className="flex items-center gap-2 border-l-4 border-brand-orange bg-orange-50 p-3 text-xs font-bold uppercase text-orange-800">
              <AlertTriangle size={16} /> You do not have permission to save vendor product offers.
            </div>
          )}

          <section className="border border-stone-200 bg-stone-50 p-4">
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center gap-3 border p-3 text-[10px] font-black uppercase ${
                  creationMode === "linked_product"
                    ? "border-brand-orange bg-orange-50 text-brand-orange"
                    : "border-stone-200 bg-white text-stone-500"
                }`}
              >
                <input
                  type="radio"
                  checked={creationMode === "linked_product"}
                  onChange={() => setCreationMode("linked_product")}
                  className="accent-brand-orange"
                />
                Link from Master Product Library
              </label>
              <label
                className={`flex cursor-pointer items-center gap-3 border p-3 text-[10px] font-black uppercase ${
                  creationMode === "branded_product"
                    ? "border-brand-orange bg-orange-50 text-brand-orange"
                    : "border-stone-200 bg-white text-stone-500"
                }`}
              >
                <input
                  type="radio"
                  checked={creationMode === "branded_product"}
                  onChange={() => setCreationMode("branded_product")}
                  className="accent-brand-orange"
                />
                Create Branded Vendor Product
              </label>
            </div>

            {creationMode === "branded_product" && (
              <div className="mb-4 flex flex-col gap-3 border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[10px] font-bold uppercase text-stone-500">
                  Branded products used: {brandedUsage}/
                  {brandedLimit === "unlimited" ? "Unlimited" : brandedLimit}
                  {!brandedEntitlement.allowed && (
                    <p className="mt-1 text-red-600">
                      Branded Products is not enabled for this vendor. Add the Branded Products add-on or upgrade entitlement.
                    </p>
                  )}
                </div>
                <PrimaryButton
                  onClick={addBrandedProductToSheet}
                  disabled={!brandedEntitlement.allowed}
                >
                  <PackageSearch size={14} className="mr-2 inline" /> New Branded Product
                </PrimaryButton>
              </div>
            )}

            {creationMode === "linked_product" && (
              <>
            <div className="grid grid-cols-1 gap-2 lg:[grid-template-columns:minmax(0,1fr)_280px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full border-2 border-stone-200 bg-white py-3 pl-10 pr-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                  placeholder="Search products by name, brand, barcode, SKU, category or keywords..."
                />
              </div>
              <select
                value={selectedSourceVendorFilter}
                onChange={(event) => setSelectedSourceVendorFilter(event.target.value)}
                aria-label="Filter by product source/vendor"
                className="w-full border-2 border-stone-200 bg-white p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
              >
                <option value="all">All Vendors / Sources</option>
                {sourceVendorOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
              {(search || selectedSourceVendorFilter !== "all") && (
                <SecondaryButton
                  onClick={() => {
                    setSearch("");
                    setSelectedSourceVendorFilter("all");
                  }}
                >
                  <X size={14} className="mr-2 inline" />
                  Clear Filters
                </SecondaryButton>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
              {searchResults.map((product) => {
                const draft = selectedOfferDraftsByProductId[product.id];
                const linkedRows = linkedByProductId.get(product.id) || [];
                const sameBranchLink = linkedProductMap.get(product.id);
                const firstLink = sameBranchLink || linkedRows[0];
                const isSelected = !!draft;
                const isLinked = linkedRows.length > 0;
                const isLinkedOtherBranch = false;
                const canAddToSheet = !isSelected && !sameBranchLink;
                const statusLabel = isSelected
                  ? "SELECTED"
                  : isLinkedOtherBranch
                    ? "LINKED OTHER BRANCH"
                    : isLinked
                      ? "LINKED"
                      : "NOT LINKED";
                const helperText = isSelected
                  ? "Pending save"
                  : firstLink
                    ? `Already linked to ${activeVendorName} / ${getBranchName(firstLink.vendorId, firstLink.branchId)}`
                    : "Not linked to this vendor";
                return (
                  <div
                    key={product.id}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button,input,a,select,textarea")) return;
                      if (canAddToSheet) addProductToSheet(product);
                      else if (draft) focusSelectedDraft(product.id);
                      else if (sameBranchLink) loadExistingOfferDraft(sameBranchLink, { warn: true });
                    }}
                    className={`flex min-w-0 items-center gap-3 border p-3 ${
                      isSelected
                        ? "border-brand-orange bg-orange-50"
                        : isLinked
                          ? "border-stone-200 bg-stone-100 text-stone-500"
                          : "border-stone-200 bg-white"
                    } ${canAddToSheet ? "cursor-pointer hover:border-brand-orange" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (!isSelected) addProductToSheet(product);
                        if (isSelected) focusSelectedDraft(product.id);
                      }}
                      className="accent-brand-orange"
                    />
                    <div className="h-10 w-10 shrink-0 border border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <PackageSearch size={16} className="text-stone-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs font-black uppercase text-brand-charcoal">
                          {product.productName}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) focusSelectedDraft(product.id);
                            else if (firstLink) loadExistingOfferDraft(firstLink);
                          }}
                          disabled={!isSelected && !firstLink}
                          className={`border px-2 py-0.5 text-[8px] font-black uppercase ${
                            isSelected
                              ? "border-brand-orange bg-white text-brand-orange"
                              : isLinkedOtherBranch
                                ? "border-amber-300 bg-amber-50 text-amber-700"
                                : isLinked
                                  ? "border-stone-300 bg-white text-stone-600"
                                  : "border-stone-200 bg-white text-stone-400"
                          } disabled:cursor-default`}
                        >
                          {statusLabel}
                        </button>
                      </div>
                      <p className="truncate text-[9px] font-bold uppercase text-stone-400">
                        {product.brand || "No brand"} / {product.category || "No category"}
                      </p>
                      <p className="truncate text-[9px] font-mono text-stone-400">
                        {product.barcode || product.standardSku || "No barcode / SKU"}
                      </p>
                      <p className="mt-1 truncate text-[9px] font-bold uppercase text-stone-500">
                        {helperText}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {canAddToSheet && (
                          <button
                            type="button"
                            onClick={() => addProductToSheet(product)}
                            className="border border-brand-orange bg-brand-orange px-2 py-1 text-[9px] font-black uppercase text-white hover:bg-orange-600"
                          >
                            Add To Sheet
                          </button>
                        )}
                        {firstLink && !isSelected && (
                          <button
                            type="button"
                            onClick={() => loadExistingOfferDraft(firstLink)}
                            className="border border-brand-orange px-2 py-1 text-[9px] font-black uppercase text-brand-orange hover:bg-orange-50"
                          >
                            Edit Existing
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <PrimaryButton
                onClick={() => searchResults.forEach(addProductToSheet)}
                disabled={searchResults.length === 0}
              >
                <Check size={14} className="mr-2 inline" /> Add Visible Results
              </PrimaryButton>
              <SecondaryButton onClick={clearSelection}>
                Clear Selection
              </SecondaryButton>
            </div>
              </>
            )}
          </section>

          <section className="border border-stone-200 p-4">
            <div className="grid grid-cols-1 gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              <select
                value={bulkBranchId}
                onChange={(event) => setBulkBranchId(event.target.value)}
                className="border-2 border-stone-200 bg-white p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
              >
                <option value="">General Stock / No Branch</option>
                {defaultBulkBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <SecondaryButton onClick={applyBranchToAll}>Apply Branch To All</SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  applyBooleanToAll("publish", bulkPublish);
                  setBulkPublish(!bulkPublish);
                }}
              >
                Apply Publish To All
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  applyBooleanToAll("delivery", bulkDelivery);
                  setBulkDelivery(!bulkDelivery);
                }}
              >
                Apply Delivery To All
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  applyBooleanToAll("active", bulkActive);
                  setBulkActive(!bulkActive);
                }}
              >
                Apply Active To All
              </SecondaryButton>
            </div>
          </section>

          <section className="border border-stone-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">
                  Selected Product Sheet
                </h3>
                <p className="mt-1 text-[10px] font-bold uppercase text-stone-400">
                  Selected rows stay here while you search, filter, scroll or edit the library above.
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                <input
                  value={selectedSheetSearch}
                  onChange={(event) => setSelectedSheetSearch(event.target.value)}
                  className="w-full border border-stone-200 bg-white py-2 pl-9 pr-3 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
                  placeholder="Filter selected rows..."
                />
              </div>
            </div>
          </section>

          <section className="hidden overflow-x-auto border border-stone-200 lg:block">
            <table className="min-w-[1280px] w-full border-collapse text-left">
              <thead className="bg-stone-50 text-[9px] font-black uppercase text-stone-400">
                <tr>
                  {[
                    "Product",
                    "Vendor",
                    "Branch",
                    "Opening QTY",
                    "Vendor Receipts",
                    "Vendor Sales",
                    "Current Product QTY",
                    "Selling Price",
                    "Buying Price",
                    "Discount Price",
                    "Vendor SKU",
                    "Images",
                    "Publish",
                    "Delivery",
                    "Active",
                    "Notes",
                    "",
                  ].map((header) => (
                    <th key={header} className="border-b border-stone-200 px-3 py-2">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleSelectedOfferDrafts.map((row) => {
                  const product = productById.get(row.productId);
                  const branches = vendorBranches(row.vendorId);
                  return (
                    <tr
                      id={`vendor-offer-draft-${row.productId}`}
                      key={row.productId}
                      className={row.error ? "bg-red-50" : "bg-white"}
                    >
                      <td className="border-b border-stone-100 px-3 py-2 text-[10px] font-black uppercase">
                        {row.productMode === "branded_product" ? (
                          <div className="space-y-2">
                            <input
                              value={row.productName}
                              onChange={(event) =>
                                updateSelectedOfferDraft(
                                  row.productId,
                                  "productName",
                                  event.target.value,
                                )
                              }
                              className="w-full border border-stone-200 p-2 text-[10px] font-bold uppercase"
                              placeholder="Product name"
                            />
                            <input
                              value={row.category}
                              onChange={(event) =>
                                updateSelectedOfferDraft(
                                  row.productId,
                                  "category",
                                  event.target.value,
                                )
                              }
                              className="w-full border border-stone-200 p-2 text-[10px] font-bold uppercase"
                              placeholder="Category"
                            />
                            <input
                              value={row.sector}
                              onChange={(event) =>
                                updateSelectedOfferDraft(
                                  row.productId,
                                  "sector",
                                  event.target.value,
                                )
                              }
                              className="w-full border border-stone-200 p-2 text-[10px] font-bold uppercase"
                              placeholder="Sector"
                            />
                          </div>
                        ) : (
                          product?.productName || row.productName
                        )}
                        <p className="mt-1">
                          <span
                            className={`border px-2 py-0.5 text-[8px] font-black uppercase ${
                              row.productMode === "branded_product"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : row.linkMode === "edit_existing"
                                ? "border-stone-300 bg-stone-50 text-stone-600"
                                : "border-brand-orange bg-orange-50 text-brand-orange"
                            }`}
                          >
                            {row.productMode === "branded_product"
                              ? row.linkMode === "edit_existing"
                                ? "Existing Branded Product Editing"
                                : "New Branded Product"
                              : row.linkMode === "edit_existing"
                              ? "Existing Linked Offer Editing"
                              : "New Linked Offer"}
                          </span>
                          <span className="ml-1 border border-stone-300 bg-white px-2 py-0.5 text-[8px] font-black uppercase text-stone-500">
                            {row.productMode === "branded_product"
                              ? "BRANDED"
                              : "LINKED"}
                          </span>
                        </p>
                        {row.productMode === "branded_product" && (
                          <div className="mt-2 space-y-2">
                            <input
                              value={row.brandDisplayName}
                              onChange={(event) =>
                                updateSelectedOfferDraft(
                                  row.productId,
                                  "brandDisplayName",
                                  event.target.value,
                                )
                              }
                              className="w-full border border-stone-200 p-2 text-[10px] font-bold uppercase"
                              placeholder="Brand display name"
                            />
                            <input
                              value={row.brandLogoUrl}
                              onChange={(event) =>
                                updateSelectedOfferDraft(
                                  row.productId,
                                  "brandLogoUrl",
                                  event.target.value,
                                )
                              }
                              className="w-full border border-stone-200 p-2 text-[10px] font-bold"
                              placeholder="Logo URL"
                            />
                            <input
                              value={row.brandBannerUrl}
                              onChange={(event) =>
                                updateSelectedOfferDraft(
                                  row.productId,
                                  "brandBannerUrl",
                                  event.target.value,
                                )
                              }
                              className="w-full border border-stone-200 p-2 text-[10px] font-bold"
                              placeholder="Banner URL"
                            />
                          </div>
                        )}
                        {row.error && (
                          <p className="mt-1 text-[9px] font-bold text-red-600">
                            {row.error}
                          </p>
                        )}
                      </td>
                      <td className="border-b border-stone-100 px-3 py-2">
                        <select
                          value={row.vendorId}
                          disabled={lockVendor}
                          onChange={(event) =>
                            updateSelectedOfferDraft(row.productId, "vendorId", event.target.value)
                          }
                          className="w-full border border-stone-200 p-2 text-[10px] font-bold uppercase disabled:bg-stone-100"
                        >
                          <option value="">Select vendor</option>
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.tradingName || vendor.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-stone-100 px-3 py-2">
                        <select
                          value={row.branchId || ""}
                          onChange={(event) =>
                            updateSelectedOfferDraft(
                              row.productId,
                              "branchId",
                              event.target.value || null,
                            )
                          }
                          className="w-full border border-stone-200 p-2 text-[10px] font-bold uppercase"
                        >
                          <option value="">General Stock / No Branch</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      {([
                        ["openingQty", "number"],
                        ["vendorReceipts", "number"],
                        ["vendorSales", "number"],
                        ["qty", "number"],
                        ["sellingPrice", "number"],
                        ["buyingPrice", "number"],
                        ["discountPrice", "number"],
                        ["vendorSku", "text"],
                      ] as const).map(([key, type]) => (
                        <td key={key} className="border-b border-stone-100 px-3 py-2">
                          <input
                            type={type}
                            value={(row[key] ?? "") as any}
                            onChange={(event) =>
                              updateSelectedOfferDraft(
                                row.productId,
                                key as keyof SelectedVendorOfferDraft,
                                (type === "number"
                                  ? event.target.value === "" && key !== "qty" && key !== "sellingPrice"
                                    ? null
                                    : numberOrZero(event.target.value)
                                  : event.target.value) as any,
                              )
                            }
                            className="w-full border border-stone-200 p-2 text-[10px] font-bold"
                          />
                        </td>
                      ))}
                      <td className="border-b border-stone-100 px-3 py-2 min-w-[180px]">
                        {(() => {
                          const rowVendor = vendorById.get(row.vendorId);
                          const rowPlan = plans.find((plan) => plan.id === rowVendor?.planId);
                          const maxImages = getMaxImagesForListing(rowVendor, rowPlan, row);
                          const images = normalizeListingImages(row, maxImages);
                          const limitReached = images.length >= maxImages;
                          return (
                            <div className="space-y-2">
                              <div className="text-[9px] font-black uppercase text-brand-orange">
                                Images {images.length}/{maxImages}
                              </div>
                              <label className={`block border border-dashed p-2 text-center text-[9px] font-black uppercase ${limitReached ? "cursor-not-allowed border-stone-200 text-stone-300" : "cursor-pointer border-brand-orange text-brand-orange"}`}>
                                Add Images
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  disabled={limitReached}
                                  className="hidden"
                                  onChange={(event) => {
                                    void handleDraftImagesUpload(row.productId, event.target.files);
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                              {limitReached && (
                                <p className="text-[8px] font-bold uppercase text-orange-700">
                                  This plan allows up to {maxImages} images per listing.
                                </p>
                              )}
                              <div className="grid grid-cols-3 gap-1">
                                {images.map((image) => (
                                  <button
                                    key={image.url}
                                    type="button"
                                    onClick={() => removeDraftImage(row.productId, image.url)}
                                    className="h-12 border border-stone-200 bg-stone-50"
                                    title="Remove image"
                                  >
                                    <img src={image.url} alt="" className="h-full w-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      {([
                        ["publish", "Publish"],
                        ["delivery", "Delivery"],
                        ["active", "Active"],
                      ] as const).map(([key]) => (
                        <td key={key} className="border-b border-stone-100 px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={row[key]}
                            onChange={(event) =>
                              updateSelectedOfferDraft(
                                row.productId,
                                key,
                                event.target.checked,
                              )
                            }
                            className="accent-brand-orange"
                          />
                        </td>
                      ))}
                      <td className="border-b border-stone-100 px-3 py-2">
                        {row.productMode === "branded_product" && (
                          <textarea
                            value={row.description}
                            onChange={(event) =>
                              updateSelectedOfferDraft(
                                row.productId,
                                "description",
                                event.target.value,
                              )
                            }
                            className="mb-2 w-full border border-stone-200 p-2 text-[10px] font-bold"
                            placeholder="Branded product description"
                            rows={2}
                          />
                        )}
                        <input
                          value={row.notes}
                          onChange={(event) =>
                            updateSelectedOfferDraft(row.productId, "notes", event.target.value)
                          }
                          className="w-full border border-stone-200 p-2 text-[10px] font-bold"
                        />
                      </td>
                      <td className="border-b border-stone-100 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeDraft(row.productId)}
                          className="border border-stone-200 p-2 text-stone-400 hover:border-red-500 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {selectedOfferDrafts.length === 0 && (
              <div className="p-10 text-center text-xs font-bold uppercase text-stone-400">
                Add selected products to start building the sheet.
              </div>
            )}
          </section>

          <section className="space-y-3 lg:hidden">
            {visibleSelectedOfferDrafts.map((row) => {
              const product = productById.get(row.productId);
              const branches = vendorBranches(row.vendorId);
              return (
                <div
                  id={`vendor-offer-draft-${row.productId}`}
                  key={row.productId}
                  className={`border p-3 ${row.error ? "border-red-300 bg-red-50" : "border-stone-200 bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black uppercase text-brand-charcoal">
                        {product?.productName || row.productName || "New branded product"}
                      </p>
                      <span
                        className={`mt-1 inline-flex border px-2 py-0.5 text-[8px] font-black uppercase ${
                          row.productMode === "branded_product"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : row.linkMode === "edit_existing"
                            ? "border-stone-300 bg-stone-50 text-stone-600"
                            : "border-brand-orange bg-orange-50 text-brand-orange"
                        }`}
                      >
                        {row.productMode === "branded_product"
                          ? row.linkMode === "edit_existing"
                            ? "Existing Branded Product Editing"
                            : "New Branded Product"
                          : row.linkMode === "edit_existing"
                          ? "Existing Linked Offer Editing"
                          : "New Linked Offer"}
                      </span>
                      {row.error && (
                        <p className="mt-1 text-[9px] font-bold uppercase text-red-600">
                          {row.error}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => removeDraft(row.productId)}>
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <select
                      value={row.vendorId}
                      disabled={lockVendor}
                      onChange={(event) => {
                        setHasUnsavedChanges(true);
                        setSelectedOfferDraftsByProductId((prev) => ({
                          ...prev,
                          [row.productId]: {
                            ...prev[row.productId],
                            vendorId: event.target.value,
                            branchId: null,
                            error: undefined,
                          },
                        }));
                      }}
                      className="border border-stone-200 p-2 text-xs font-bold uppercase disabled:bg-stone-100"
                    >
                      <option value="">Select vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.tradingName || vendor.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.branchId || ""}
                      onChange={(event) =>
                        updateSelectedOfferDraft(
                          row.productId,
                          "branchId",
                          event.target.value || null,
                        )
                      }
                      className="border border-stone-200 p-2 text-xs font-bold uppercase"
                    >
                      <option value="">General Stock / No Branch</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      {row.productMode === "branded_product" && (
                        <>
                          <input value={row.productName} onChange={(event) => updateSelectedOfferDraft(row.productId, "productName", event.target.value)} className="col-span-2 border border-stone-200 p-2 text-xs font-bold uppercase" placeholder="Product name" />
                          <input value={row.category} onChange={(event) => updateSelectedOfferDraft(row.productId, "category", event.target.value)} className="border border-stone-200 p-2 text-xs font-bold uppercase" placeholder="Category" />
                          <input value={row.sector} onChange={(event) => updateSelectedOfferDraft(row.productId, "sector", event.target.value)} className="border border-stone-200 p-2 text-xs font-bold uppercase" placeholder="Sector" />
                          <input value={row.brandDisplayName} onChange={(event) => updateSelectedOfferDraft(row.productId, "brandDisplayName", event.target.value)} className="col-span-2 border border-stone-200 p-2 text-xs font-bold uppercase" placeholder="Brand display name" />
                        </>
                      )}
                      <input type="number" value={row.openingQty} onChange={(event) => updateSelectedOfferDraft(row.productId, "openingQty", numberOrZero(event.target.value))} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Opening QTY" />
                      <input type="number" value={row.vendorReceipts} onChange={(event) => updateSelectedOfferDraft(row.productId, "vendorReceipts", numberOrZero(event.target.value))} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Receipts" />
                      <input type="number" value={row.vendorSales} onChange={(event) => updateSelectedOfferDraft(row.productId, "vendorSales", numberOrZero(event.target.value))} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Sales" />
                      <input type="number" value={row.qty} onChange={(event) => updateSelectedOfferDraft(row.productId, "qty", numberOrZero(event.target.value))} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Current QTY" />
                      <input type="number" value={row.sellingPrice} onChange={(event) => updateSelectedOfferDraft(row.productId, "sellingPrice", numberOrZero(event.target.value))} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Selling" />
                      <input type="number" value={row.buyingPrice ?? ""} onChange={(event) => updateSelectedOfferDraft(row.productId, "buyingPrice", event.target.value === "" ? null : numberOrZero(event.target.value))} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Buying" />
                      <input type="number" value={row.discountPrice ?? ""} onChange={(event) => updateSelectedOfferDraft(row.productId, "discountPrice", event.target.value === "" ? null : numberOrZero(event.target.value))} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Discount" />
                    </div>
                    <input value={row.vendorSku} onChange={(event) => updateSelectedOfferDraft(row.productId, "vendorSku", event.target.value)} className="border border-stone-200 p-2 text-xs font-bold uppercase" placeholder="Vendor SKU" />
                    {(() => {
                      const rowVendor = vendorById.get(row.vendorId);
                      const rowPlan = plans.find((plan) => plan.id === rowVendor?.planId);
                      const maxImages = getMaxImagesForListing(rowVendor, rowPlan, row);
                      const images = normalizeListingImages(row, maxImages);
                      const limitReached = images.length >= maxImages;
                      return (
                        <div className="border border-stone-200 p-3">
                          <div className="mb-2 text-[10px] font-black uppercase text-brand-orange">
                            Images {images.length}/{maxImages}
                          </div>
                          <label className={`block border border-dashed p-3 text-center text-[10px] font-black uppercase ${limitReached ? "cursor-not-allowed border-stone-200 text-stone-300" : "cursor-pointer border-brand-orange text-brand-orange"}`}>
                            Add Images
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={limitReached}
                              className="hidden"
                              onChange={(event) => {
                                void handleDraftImagesUpload(row.productId, event.target.files);
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                          {limitReached && (
                            <p className="mt-2 text-[9px] font-bold uppercase text-orange-700">
                              This plan allows up to {maxImages} images per listing.
                            </p>
                          )}
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {images.map((image) => (
                              <button
                                key={image.url}
                                type="button"
                                onClick={() => removeDraftImage(row.productId, image.url)}
                                className="h-16 border border-stone-200 bg-stone-50"
                                title="Remove image"
                              >
                                <img src={image.url} alt="" className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {row.productMode === "branded_product" && (
                      <textarea value={row.description} onChange={(event) => updateSelectedOfferDraft(row.productId, "description", event.target.value)} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Description" rows={2} />
                    )}
                    <input value={row.notes} onChange={(event) => updateSelectedOfferDraft(row.productId, "notes", event.target.value)} className="border border-stone-200 p-2 text-xs font-bold" placeholder="Notes" />
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-black uppercase">
                      <label className="flex items-center gap-2 border border-stone-200 p-2">
                        <input type="checkbox" checked={row.publish} onChange={(event) => updateSelectedOfferDraft(row.productId, "publish", event.target.checked)} className="accent-brand-orange" />
                        Publish
                      </label>
                      <label className="flex items-center gap-2 border border-stone-200 p-2">
                        <input type="checkbox" checked={row.delivery} onChange={(event) => updateSelectedOfferDraft(row.productId, "delivery", event.target.checked)} className="accent-brand-orange" />
                        Delivery
                      </label>
                      <label className="flex items-center gap-2 border border-stone-200 p-2">
                        <input type="checkbox" checked={row.active} onChange={(event) => updateSelectedOfferDraft(row.productId, "active", event.target.checked)} className="accent-brand-orange" />
                        Active
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedOfferDrafts.length === 0 && (
              <div className="border border-stone-200 bg-white p-6 text-center text-xs font-bold uppercase text-stone-400">
                Add selected products to start building the sheet.
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50 px-5 py-4 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={handleClose}>Close</SecondaryButton>
          <PrimaryButton onClick={saveSheet} disabled={isSaving || !canSave}>
            <Save size={14} className="mr-2 inline" />
            {isSaving ? "Saving Product Sheet..." : "Save Product Sheet"}
          </PrimaryButton>
        </div>
      </div>

      <BrandedAlertModal
        isOpen={alertConfig.isOpen}
        title="seiGEN Commerce"
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig((previous) => ({ ...previous, isOpen: false }))}
      />
    </div>
  );
};

export default VendorProductOfferSheet;
