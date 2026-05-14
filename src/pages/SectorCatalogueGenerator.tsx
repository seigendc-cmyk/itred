/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  DataPanel,
  PrimaryButton,
  SecondaryButton,
} from "../components/CommonUI.tsx";
import {
  FileCode,
  Play,
  Download,
  Copy,
  Search,
  CheckCircle2,
  Package,
  Users,
  Building,
  Eye,
  Settings,
  AlertTriangle,
  Archive,
  Globe,
  Trash2,
  Edit3,
  Filter,
  Plus,
  MessageSquare,
} from "lucide-react";
import { catalogueService } from "../services/catalogueService.ts";
import {
  CatalogueGeneration,
  Vendor,
  Product,
  CAHLink,
  PricingPlan,
  DeploymentStatus,
  CatalogueContactHubSettings,
  SystemSettings,
  WhatsAppActivityLog,
} from "../types.ts";
import { generateCatalogueHtml } from "../lib/catalogueTemplate.ts";
import { cahService } from "../services/cahService.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { permissionService } from "../services/permissionService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { asArray } from "../utils/safeData.ts";
import { vendorService } from "../services/vendorService.ts";
import { productService } from "../services/productService.ts";
import { contactHubService } from "../services/contactHubService.ts";
import { settingsService } from "../services/settingsService.ts";
import { focusMainContent } from "../utils/uiHelpers.ts";
import { WhatsAppActivityQuickLog } from "../components/WhatsAppActivityQuickLog.tsx";
import { staffAuditService } from "../services/staffAuditService.ts";

async function assetUrlToDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to load asset: " + url);
  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface CatalogueConfig {
  id: string;
  serialNumber: string;
  sector: string;
  category: string;
  province?: string;
  cityTown?: string;
  vendorIds: string[];
  cahLinkIds: string[];
  notes?: string;
  expiryPeriodDays: number;
  onlyActive: boolean;
  onlyPublished: boolean;
  includeOutOfStock: boolean;
  maxProducts: number;
  maxImages: number;
}

export const SectorCatalogueGenerator: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cahLinks, setCahLinks] = useState<CAHLink[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [history, setHistory] = useState<CatalogueGeneration[]>([]);
  const [contactSettings, setContactSettings] =
    useState<CatalogueContactHubSettings | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(
    null,
  );

  // Filters
  const [filterSector, setFilterSector] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState<DeploymentStatus | "all">(
    "all",
  );

  // Catalogue Config State
  const [config, setConfig] = useState<CatalogueConfig>({
    id: `CAT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    serialNumber: "",
    sector: "",
    category: "",
    province: "",
    cityTown: "",
    vendorIds: [],
    cahLinkIds: [],
    notes: "",
    expiryPeriodDays: 7,
    onlyActive: true,
    onlyPublished: true,
    includeOutOfStock: false,
    maxProducts: 800,
    maxImages: 800,
  });

  // History Management & Editing State
  const [editingCatalogueId, setEditingCatalogueId] = useState<string | null>(
    null,
  );
  const [historySearch, setHistorySearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showReplaced, setShowReplaced] = useState(false);

  const [lastGenerated, setLastGenerated] = useState<{
    html: string;
    id: string;
    fileName: string;
    hostedUrl?: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogData, setQuickLogData] = useState<
    Partial<WhatsAppActivityLog>
  >({});

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      const [
        rawVendors,
        rawProducts,
        rawCahLinks,
        rawPlans,
        rawHistory,
        rawSettings,
        rawSystemSettings,
      ] = await Promise.all([
        vendorService.getVendors(),
        productService.getProducts(),
        cahService.getLinks(),
        pricingPlanService.getPlans(),
        catalogueService.getHistory(),
        contactHubService.getSettings(),
        settingsService.getSettings(),
      ]);

      setVendors(asArray<Vendor>(rawVendors));
      setProducts(asArray<Product>(rawProducts));
      setCahLinks(asArray<CAHLink>(rawCahLinks));
      setPlans(asArray<PricingPlan>(rawPlans));
      setHistory(asArray<CatalogueGeneration>(rawHistory));
      setContactSettings(rawSettings);
      setSystemSettings(rawSystemSettings);

      await catalogueService.checkExpirations();
    } catch (error) {
      console.warn(
        "Create Catalogue data failed to load. Using empty arrays.",
        error,
      );
      setVendors([]);
      setProducts([]);
      setPlans([]);
      setHistory([]);
    }
  };

  const refreshHistory = () => {
    setHistory(catalogueService.getHistory());
  };

  const generateSerialNumber = (sector: string, category: string) => {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const year = now.getFullYear().toString().slice(-2);
    return `${sector || "SECTOR"} | ${category || "CAT"} | ${month}${year}`;
  };

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      serialNumber: generateSerialNumber(prev.sector, prev.category),
    }));
  }, [config.sector, config.category]);

  const safeVendors = useMemo(() => asArray<Vendor>(vendors), [vendors]);
  const safeProducts = useMemo(() => asArray<Product>(products), [products]);
  const safeCahLinks = useMemo(() => asArray<CAHLink>(cahLinks), [cahLinks]);
  const safePlans = useMemo(() => asArray<PricingPlan>(plans), [plans]);
  const safeHistory = useMemo(
    () => asArray<CatalogueGeneration>(history),
    [history],
  );

  const selectedVendors = useMemo(
    () => safeVendors.filter((v) => config.vendorIds.includes(v.id)),
    [safeVendors, config.vendorIds],
  );

  const allSelectedProducts = useMemo(() => {
    let filtered = safeProducts.filter((p) =>
      config.vendorIds.includes(p.vendorId),
    );

    if (config.onlyActive) {
      filtered = filtered.filter((p) => p.status === "active");
    }
    if (config.onlyPublished) {
      filtered = filtered.filter((p) => p.publishToCatalogue);
    }
    if (!config.includeOutOfStock) {
      filtered = filtered.filter((p) => p.stockQuantity > 0);
    }

    // Limit to max products
    return filtered.slice(0, config.maxProducts);
  }, [safeProducts, config]);

  const selectedCahLinks = useMemo(
    () => safeCahLinks.filter((l) => config.cahLinkIds.includes(l.id)),
    [safeCahLinks, config.cahLinkIds],
  );

  const estimatedSize = useMemo(() => {
    if (config.vendorIds.length === 0 || allSelectedProducts.length === 0)
      return 0;

    let totalBytes = 100000; // Base size with JS/CSS

    allSelectedProducts.forEach((p) => {
      totalBytes += JSON.stringify(p).length;
      if (p.imageUrl) {
        if (p.imageMetadata?.compressedSize) {
          totalBytes += p.imageMetadata.compressedSize;
        } else {
          totalBytes += 80000; // Average estimation for WebP
        }
      }
    });

    return totalBytes;
  }, [config.vendorIds, allSelectedProducts]);

  const warnings = useMemo(() => {
    const safeSelectedVendors = asArray<Vendor>(selectedVendors);

    const list: string[] = [];

    if (allSelectedProducts.length > 800) {
      list.push(`CRITICAL: Product limit exceeded. Stability not guaranteed.`);
    }

    if (estimatedSize > 20 * 1024 * 1024) {
      list.push(
        `CRITICAL SIZE: Estimated at ${(estimatedSize / 1024 / 1024).toFixed(1)}MB. Split by city or category.`,
      );
    } else if (estimatedSize > 12 * 1024 * 1024) {
      list.push(`SIZE WARNING: High asset footprint. Performance may degrade.`);
    }

    const vendorsWithoutDetails = safeSelectedVendors.filter(
      (v) => !v.whatsappNumber || !v.catalogueDisplayName,
    );
    if (vendorsWithoutDetails.length > 0) {
      list.push(
        `DATA QUALITY: ${vendorsWithoutDetails.length} vendors missing critical contact info.`,
      );
    }

    const oversizedImages = allSelectedProducts.filter(
      (p) =>
        p.imageMetadata?.compressedSize &&
        p.imageMetadata.compressedSize > 150 * 1024,
    ).length;
    if (oversizedImages > 0) {
      list.push(
        `OPTIMIZATION: ${oversizedImages} images are bloated (> 150KB). Fix to reduce total size.`,
      );
    }

    const missingImages = allSelectedProducts.filter((p) => !p.imageUrl).length;
    if (missingImages > 0) {
      list.push(`AUDIT: ${missingImages} units missing visual assets.`);
    }

    // Plan Enforcement
    safeSelectedVendors.forEach((vendor) => {
      const plan = safePlans.find((p) => p.id === vendor.planId);
      if (!plan) return;

      const vendorProducts = safeProducts.filter(
        (p) => p.vendorId === vendor.id,
      );
      const productsExceeded = vendorProducts.length > plan.maxProducts;
      const imagesExceeded =
        vendorProducts.filter((p) => p.imageUrl).length >
        plan.maxImagesPerCatalogue;
      const branchesExceeded =
        (vendor.branches?.length || 0) > plan.maxBranchesPerVendor;
      const staffExceeded =
        (vendor.staff?.length || 0) > plan.maxStaffPerVendor;

      if (productsExceeded)
        list.push(
          `PLAN LIMIT: ${vendor.name} exceeds max products (${vendorProducts.length}/${plan.maxProducts}). Upgrade to ${plan.id === "starter" ? "Growth" : "Pro"} recommended.`,
        );
      if (imagesExceeded)
        list.push(
          `PLAN LIMIT: ${vendor.name} exceeds image threshold (${vendorProducts.filter((p) => p.imageUrl).length}/${plan.maxImagesPerCatalogue}).`,
        );
      if (branchesExceeded)
        list.push(
          `PLAN LIMIT: ${vendor.name} listed branches (${vendor.branches?.length}/${plan.maxBranchesPerVendor}) exceed ${plan.name} allowance.`,
        );
      if (staffExceeded)
        list.push(`PLAN LIMIT: ${vendor.name} team size exceeds plan limits.`);

      // Frequency Check
      const monthlyDeployments = safeHistory.filter(
        (h) =>
          h.vendorIds.includes(vendor.id) &&
          new Date(h.generatedAt).getMonth() === new Date().getMonth() &&
          new Date(h.generatedAt).getFullYear() === new Date().getFullYear(),
      ).length;

      if (monthlyDeployments >= plan.maxDeploymentsPerMonth) {
        list.push(
          `POLICY: ${vendor.name} reached monthly deployment cap (${monthlyDeployments}/${plan.maxDeploymentsPerMonth}).`,
        );
      }
    });

    return list;
  }, [
    allSelectedProducts,
    estimatedSize,
    selectedVendors,
    safeProducts,
    safeHistory,
    safePlans,
  ]);

  const filteredHistory = useMemo(() => {
    return safeHistory.filter((h) => {
      if (!showArchived && h.status === "archived") return false;
      if (!showReplaced && h.status === "replaced") return false;

      const searchBlob =
        `${h.id} ${h.serialNumber} ${h.sector} ${h.category}`.toLowerCase();
      if (historySearch && !searchBlob.includes(historySearch.toLowerCase()))
        return false;

      const matchesSector =
        !filterSector ||
        h.sector.toLowerCase().includes(filterSector.toLowerCase());
      const matchesCategory =
        !filterCategory ||
        h.category.toLowerCase().includes(filterCategory.toLowerCase());
      const matchesStatus = filterStatus === "all" || h.status === filterStatus;
      return matchesSector && matchesCategory && matchesStatus;
    });
  }, [
    safeHistory,
    filterSector,
    filterCategory,
    filterStatus,
    showArchived,
    showReplaced,
    historySearch,
  ]);

  const uniqueSectors = useMemo(
    () => Array.from(new Set(safeHistory.map((h) => h.sector))),
    [safeHistory],
  );

  const sectorMatchedCahLinks = useMemo(() => {
    const s = config.sector?.toLowerCase().trim() || "";
    const c = config.category?.toLowerCase().trim() || "";

    if (!s && !c) return [];

    return safeCahLinks.filter((link) => {
      if (link.status !== "active" || link.showInCatalogue === false)
        return false;

      const linkSector = (link.sector || "").toLowerCase();
      const linkCategory = (link.category || "").toLowerCase();
      const linkName = (link.name || "").toLowerCase();
      const linkDesc = (link.description || "").toLowerCase();

      const matchesSector =
        s &&
        (linkSector.includes(s) ||
          linkName.includes(s) ||
          linkDesc.includes(s));
      const matchesCategory =
        c &&
        (linkCategory.includes(c) ||
          linkName.includes(c) ||
          linkDesc.includes(c));

      return matchesSector || matchesCategory;
    });
  }, [safeCahLinks, config.sector, config.category]);

  const handleAutoSelectCAHLinks = () => {
    const s = config.sector?.toLowerCase().trim() || "";
    const c = config.category?.toLowerCase().trim() || "";

    if (!s && !c) {
      alert("Please enter a Sector or Category first to auto-select links.");
      return;
    }

    if (sectorMatchedCahLinks.length === 0) {
      alert(
        "No active matching WhatsApp/CAH links found for this sector/category.",
      );
      return;
    }

    setConfig((prev) => ({
      ...prev,
      cahLinkIds: Array.from(
        new Set([
          ...prev.cahLinkIds,
          ...sectorMatchedCahLinks.map((l) => l.id),
        ]),
      ),
    }));
  };

  const handleGenerate = async (mode: "new" | "update" | "replace" = "new") => {
    if (config.vendorIds.length === 0 || !config.sector || !config.category) {
      alert("Please provide Sector, Category and select at least one vendor.");
      return;
    }

    if (
      warnings.some((w) => w.includes("PLAN LIMIT") || w.includes("POLICY"))
    ) {
      if (
        !confirm(
          "Deployment plan violations detected. Pro-rata overage or upgrade may be required. Proceed with compilation?",
        )
      ) {
        return;
      }
    }

    let finalCahLinks = selectedCahLinks;
    const finalCahLinkIds = [...config.cahLinkIds];

    if (finalCahLinks.length === 0 && sectorMatchedCahLinks.length > 0) {
      finalCahLinks = sectorMatchedCahLinks;
      sectorMatchedCahLinks.forEach((l) => {
        if (!finalCahLinkIds.includes(l.id)) {
          finalCahLinkIds.push(l.id);
        }
      });
    }

    console.log("Selected CAH links for export", finalCahLinks);

    setIsGenerating(true);
    focusMainContent();

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(now.getDate() + config.expiryPeriodDays);

      let seigenLogoDataUri = "";

      try {
        seigenLogoDataUri = await assetUrlToDataUri(
          "/brand/seigen-commerce-logo.png",
        );
      } catch (error) {
        console.warn("Failed to embed default seiGEN logo", error);
      }

      const newId = `CAT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const finalId =
        mode === "update" && editingCatalogueId ? editingCatalogueId : newId;

      const publicSlug = `${config.sector}-${config.category}-${finalId}`
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-");

      const hostedUrl = "";

      const resolveFeedbackNumber = () => {
        const routes = (systemSettings?.feedbackWhatsAppRoutes || []).filter(r => r.isActive).sort((a,b) => b.priority - a.priority);
        let match = routes.find(r => r.sector === config.sector && r.category === config.category);
        if (match) return match.whatsappNumber;
        match = routes.find(r => r.sector === config.sector);
        if (match) return match.whatsappNumber;
        match = routes.find(r => r.purpose === "DEFAULT");
        if (match) return match.whatsappNumber;
        return systemSettings?.defaultFeedbackWhatsAppNumber || "";
      };

      const html = generateCatalogueHtml(
        selectedVendors,
        allSelectedProducts,
        finalCahLinks,
        plans,
        {
          serialNumber: config.serialNumber,
catalogueId: finalId,
          sector: config.sector,
          category: config.category,
          expiryDate: expiry.toISOString(),
          seigenLogoDataUri,
          seigenLogoUrl:
            systemSettings?.seigenLogoUrl ||
            contactSettings?.seigenLogoUrl ||
            "",
          companyLogoUrl: contactSettings?.companyLogoUrl,
          systemLogoUrl: contactSettings?.systemLogoUrl,
          hostedUrl,
          feedbackWhatsAppNumber: resolveFeedbackNumber(),
          syncEndpointUrl: systemSettings?.syncEndpointUrl || "",
        },
      );

      const displaySector = config.sector
        ? config.sector.trim()
        : "All Sectors";
      const displayCategory = config.category
        ? config.category.trim()
        : "All Categories";
      const yyyyMmDd = new Date().toISOString().split("T")[0];
      let safeFileName = `SCI_${displaySector}_${displayCategory}_${yyyyMmDd}`;
      safeFileName = safeFileName
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .replace(/_+/g, "_");
      const finalFileName = `${safeFileName}.html`;

      const configSnapshot = {
        vendorIds: config.vendorIds,
        cahLinkIds: finalCahLinkIds,
        sector: config.sector,
        category: config.category,
        province: config.province,
        cityTown: config.cityTown,
        notes: config.notes,
        expiryPeriodDays: config.expiryPeriodDays,
        onlyActive: config.onlyActive,
        onlyPublished: config.onlyPublished,
        includeOutOfStock: config.includeOutOfStock,
        maxProducts: config.maxProducts,
        maxImages: config.maxImages,
      };

      const catalogueData: CatalogueGeneration = {
        id: finalId,
        serialNumber: config.serialNumber,
        sector: config.sector,
        category: config.category,
        province: config.province,
        cityTown: config.cityTown,
        vendorIds: config.vendorIds,
        cahLinkIds: finalCahLinkIds,
        generatedBy: "System Admin",
        generatedAt: new Date().toISOString(),
        expiryPeriodDays: config.expiryPeriodDays,
        status: "generated",
        notes: config.notes,
        productCount: allSelectedProducts.length,
        htmlSize: html.length,
        fileName: finalFileName,
        htmlContent: html,
        hostedUrl,
        publicSlug,
        configSnapshot: configSnapshot,
      };

      if (mode === "replace" && editingCatalogueId) {
        catalogueData.previousCatalogueId = editingCatalogueId;
        await catalogueService.saveCatalogue(catalogueData);
        await catalogueService.replaceCatalogue(editingCatalogueId, finalId);
      } else {
        await catalogueService.saveCatalogue(catalogueData);
      }

      // Non-blocking staff audit logging
      try {
        void staffAuditService.logAction({
          eventType: "CATALOGUE_GENERATED",
          module: "catalogue",
          action: `Generated catalogue ${finalId}`,
          severity: "info",
          recordType: "catalogue",
          recordId: finalId,
          recordName: config.serialNumber
        });
      } catch (auditErr) {
        console.error("Audit log failed", auditErr);
      }

      setLastGenerated({
        html,
        id: finalId,
        fileName: finalFileName,
        hostedUrl,
      });
      if (mode === "update" || mode === "replace") {
        setEditingCatalogueId(null);
      }
      await refreshHistory();
      alert(
        `Catalogue ${mode === "new" ? "created" : mode === "update" ? "updated" : "replaced"} successfully.`,
      );
    } catch (err) {
      console.error(err);
      alert(
        "Catalogue generation or save failed. Check permissions and network.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkDeployed = async (id: string) => {
    try {
      await catalogueService.markAsDeployed(id);
      refreshHistory();
      alert("Catalogue deployed. Lifecycle tracking active.");
      
      // Non-blocking staff audit logging
      try {
        void staffAuditService.logAction({
          eventType: "CATALOGUE_DEPLOYED",
          module: "catalogue",
          action: `Deployed catalogue ${id}`,
          severity: "high",
          recordType: "catalogue",
          recordId: id
        });
      } catch (auditErr) {
        console.error("Audit log failed", auditErr);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to deploy catalogue.");
    }
  };

  const handleRedeploy = async (id: string) => {
    try {
      await catalogueService.redeployCatalogue(id);
      refreshHistory();
      alert("Catalogue redeployed. Expiry timeline reset.");
    } catch (err) {
      console.error(err);
      alert("Failed to redeploy catalogue.");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await catalogueService.archiveCatalogue(id);
      refreshHistory();
    } catch (err) {
      console.error(err);
      alert("Failed to archive catalogue.");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        "Permanently delete this catalogue record? This cannot be undone.",
      )
    ) {
      try {
        await catalogueService.deleteCatalogue(id);
        refreshHistory();
      } catch (err) {
        console.error(err);
        alert("Failed to delete catalogue record.");
      }
    }
  };

  const handleEditConfig = (cat: CatalogueGeneration) => {
    if (cat.configSnapshot) {
      setConfig({ ...config, ...cat.configSnapshot });
    } else {
      setConfig({
        ...config,
        sector: cat.sector || "",
        category: cat.category || "",
        vendorIds: cat.vendorIds || [],
        cahLinkIds: cat.cahLinkIds || [],
        notes: cat.notes || "",
        expiryPeriodDays: cat.expiryPeriodDays || 7,
      });
    }
    setEditingCatalogueId(cat.id);
    focusMainContent();
  };

  const handleViewPreview = (cat: CatalogueGeneration) => {
    if (cat.htmlContent) {
      setLastGenerated({
        html: cat.htmlContent,
        id: cat.id,
        fileName: cat.fileName || `${cat.serialNumber}.html`,
        hostedUrl: cat.hostedUrl,
      });
      focusMainContent();
    } else {
      alert(
        "HTML content not available for this older record. Please regenerate.",
      );
    }
  };

  const handleCopyHtml = async (html: string) => {
    await navigator.clipboard.writeText(html);
    alert("Catalogue HTML copied to clipboard.");
  };

  const toggleVendorSelection = (vendorId: string) => {
    setConfig((prev) => ({
      ...prev,
      vendorIds: prev.vendorIds.includes(vendorId)
        ? prev.vendorIds.filter((id) => id !== vendorId)
        : [...prev.vendorIds, vendorId],
    }));
  };

  const toggleCAHLinkSelection = (linkId: string) => {
    setConfig((prev) => ({
      ...prev,
      cahLinkIds: prev.cahLinkIds.includes(linkId)
        ? prev.cahLinkIds.filter((id) => id !== linkId)
        : [...prev.cahLinkIds, linkId],
    }));
  };

  const downloadFile = (html: string, filename: string) => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    analyticsService.logEvent({
      eventType: "CATALOGUE_DOWNLOADED",
      actorType: "admin",
      actorName: "System Admin",
      details: { filename },
    });

    // Non-blocking staff audit logging
    try {
      void staffAuditService.logAction({
        eventType: "EXPORT_DOWNLOADED",
        module: "catalogue",
        action: `Downloaded catalogue HTML: ${filename}`,
        severity: "info",
        recordType: "file",
        recordName: filename
      });
    } catch (auditErr) {
      console.error("Audit log failed", auditErr);
    }
  };

  return (
    <div className="pb-20" id="create-catalogue-header" tabIndex={-1}>
      <PageHeader
        title="Create Catalogue"
        subtitle="Group multiple vendors into a single digital product catalogue."
        actions={
          permissionService.canCreate("createCatalogue") &&
          (editingCatalogueId ? (
            <div className="flex gap-2">
              <SecondaryButton onClick={() => setEditingCatalogueId(null)}>
                Cancel Edit
              </SecondaryButton>
              <PrimaryButton
                onClick={() => handleGenerate("update")}
                disabled={isGenerating || config.vendorIds.length === 0}
              >
                {isGenerating ? "Updating..." : "Update Existing"}
              </PrimaryButton>
              <PrimaryButton
                onClick={() => handleGenerate("replace")}
                disabled={isGenerating || config.vendorIds.length === 0}
              >
                {isGenerating ? "Replacing..." : "Save as Replacement"}
              </PrimaryButton>
            </div>
          ) : (
            <PrimaryButton
              onClick={() => handleGenerate("new")}
              disabled={isGenerating || config.vendorIds.length === 0}
              className={isGenerating ? "opacity-50 cursor-not-allowed" : ""}
            >
              {isGenerating ? (
                "Creating..."
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" /> Create Multi-Vendor
                  Catalogue
                </>
              )}
            </PrimaryButton>
          ))
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Config */}
          <section className="card bg-white">
            {editingCatalogueId && (
              <div className="mb-6 p-4 bg-orange-50 border-l-4 border-brand-orange flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-brand-orange uppercase">
                    Editing Mode Active
                  </h4>
                  <p className="text-xs text-stone-600 font-medium mt-1">
                    Editing catalogue {editingCatalogueId}. Regenerate to apply
                    changes.
                  </p>
                </div>
                <SecondaryButton onClick={() => setEditingCatalogueId(null)}>
                  Cancel Edit
                </SecondaryButton>
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-brand-orange text-white flex items-center justify-center font-bold italic">
                GEN
              </div>
              <h3 className="text-sm uppercase font-bold tracking-[0.2em]">
                Build Configuration
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block">
                <span className="text-[10px] font-extrabold uppercase text-stone-400">
                  Catalogue Serial Number
                </span>
                <input
                  type="text"
                  disabled
                  className="w-full mt-1 border-2 border-stone-50 bg-stone-50 p-3 text-xs font-mono font-bold text-brand-orange"
                  value={config.serialNumber}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-extrabold uppercase text-stone-400">
                    Sector *
                  </span>
                  <input
                    type="text"
                    className="w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange"
                    placeholder="e.g. Motor Spares"
                    value={config.sector}
                    onChange={(e) =>
                      setConfig({ ...config, sector: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-extrabold uppercase text-stone-400">
                    Category *
                  </span>
                  <input
                    type="text"
                    className="w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange"
                    placeholder="e.g. Brake Pads"
                    value={config.category}
                    onChange={(e) =>
                      setConfig({ ...config, category: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-extrabold uppercase text-stone-400">
                    Province
                  </span>
                  <input
                    type="text"
                    className="w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange"
                    value={config.province}
                    onChange={(e) =>
                      setConfig({ ...config, province: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-extrabold uppercase text-stone-400">
                    City/Town
                  </span>
                  <input
                    type="text"
                    className="w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange"
                    value={config.cityTown}
                    onChange={(e) =>
                      setConfig({ ...config, cityTown: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-stone-50 grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block">
                <span className="text-[10px] font-extrabold uppercase text-stone-400">
                  Build Notes & Internal Memo
                </span>
                <textarea
                  className="w-full mt-1 border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange h-20"
                  placeholder="Deployment context, source RPN etc."
                  value={config.notes}
                  onChange={(e) =>
                    setConfig({ ...config, notes: e.target.value })
                  }
                />
              </label>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase">
                    Expiry Period
                  </span>
                  <select
                    className="bg-stone-50 p-3 text-xs font-bold outline-none"
                    value={config.expiryPeriodDays}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        expiryPeriodDays: parseInt(e.target.value),
                      })
                    }
                  >
                    <option value={7}>7 Days (Standard)</option>
                    <option value={14}>14 Days (Extended)</option>
                    <option value={30}>30 Days (Monthly)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-stone-50 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <ToggleItem
                label="Active Only"
                active={config.onlyActive}
                onClick={() =>
                  setConfig({ ...config, onlyActive: !config.onlyActive })
                }
              />
              <ToggleItem
                label="Published Only"
                active={config.onlyPublished}
                onClick={() =>
                  setConfig({ ...config, onlyPublished: !config.onlyPublished })
                }
              />
              <ToggleItem
                label="Incl. Stockouts"
                active={config.includeOutOfStock}
                onClick={() =>
                  setConfig({
                    ...config,
                    includeOutOfStock: !config.includeOutOfStock,
                  })
                }
              />
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-stone-400 uppercase">
                  Product Limit
                </span>
                <select
                  className="bg-stone-50 p-2 text-[10px] font-bold outline-none"
                  value={config.maxProducts}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      maxProducts: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={100}>100 Items</option>
                  <option value={400}>400 Items</option>
                  <option value={800}>800 Items</option>
                </select>
              </div>
            </div>
          </section>

          {/* Multi-Vendor Selection */}
          <section className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-charcoal text-white flex items-center justify-center font-bold italic">
                  VL
                </div>
                <h3 className="text-sm uppercase font-bold tracking-[0.2em]">
                  Vendor List
                </h3>
              </div>
              <div className="text-[10px] font-bold text-brand-orange">
                {config.vendorIds.length} Selected
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {safeVendors.map((v) => (
                <div
                  key={v.id}
                  onClick={() => toggleVendorSelection(v.id)}
                  className={`p-3 border-2 flex items-center gap-4 cursor-pointer transition-all ${
                    config.vendorIds.includes(v.id)
                      ? "border-brand-orange bg-orange-50/20"
                      : "border-stone-50 hover:border-stone-100"
                  }`}
                >
                  <div
                    className={`w-8 h-8 flex items-center justify-center font-bold text-[10px] italic ${
                      config.vendorIds.includes(v.id)
                        ? "bg-brand-orange text-white"
                        : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {v.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase">{v.name}</p>
                    <p className="text-[9px] text-stone-400 font-bold uppercase">
                      {v.sector} • {v.cityTown}
                    </p>
                  </div>
                  {config.vendorIds.includes(v.id) && (
                    <CheckCircle2 size={12} className="text-brand-orange" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* WhatsApp Access Hub Link Selection */}
          <section className="card">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-600 text-white flex items-center justify-center font-bold italic shrink-0">
                  WA
                </div>
                <div>
                  <h3 className="text-sm uppercase font-bold tracking-[0.2em]">
                    WhatsApp Access Hub Links
                  </h3>
                  <p className="text-[10px] text-stone-500 mt-1 leading-tight">
                    Selected WhatsApp/CAH links will appear under the Hub tab in
                    the exported catalogue.
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-emerald-600 shrink-0 ml-4 pt-1">
                {config.cahLinkIds.length} Selected
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <SecondaryButton size="sm" onClick={handleAutoSelectCAHLinks}>
                Auto-select Sector Links
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                onClick={() => setConfig({ ...config, cahLinkIds: [] })}
              >
                Clear Selected Links
              </SecondaryButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {safeCahLinks
                .filter((link) => link.status === "active")
                .map((link) => (
                  <div
                    key={link.id}
                    onClick={() => toggleCAHLinkSelection(link.id)}
                    className={`p-3 border-2 flex items-center gap-4 cursor-pointer transition-all ${
                      config.cahLinkIds.includes(link.id)
                        ? "border-emerald-600 bg-emerald-50/20"
                        : "border-stone-50 hover:border-stone-100"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 flex items-center justify-center font-bold text-[10px] italic ${
                        config.cahLinkIds.includes(link.id)
                          ? "bg-emerald-600 text-white"
                          : "bg-stone-100 text-stone-400"
                      }`}
                    >
                      WA
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold uppercase">
                        {link.name}
                      </p>
                      <p className="text-[9px] text-stone-400 font-bold uppercase">
                        {link.type} · {link.sector || "General"}
                      </p>
                    </div>
                    {config.cahLinkIds.includes(link.id) && (
                      <CheckCircle2 size={12} className="text-emerald-600" />
                    )}
                  </div>
                ))}
              {safeCahLinks.filter((l) => l.status === "active").length ===
                0 && (
                <div className="col-span-2 py-10 text-center text-stone-400 text-xs">
                  No active WhatsApp Access Hub links found.
                </div>
              )}
            </div>
          </section>

          {/* Compiler Success Frame */}
          {lastGenerated && (
            <section className="card border-2 border-emerald-500 bg-emerald-50/10">
              <div className="flex items-center justify-between mb-8">
                {" "}
                {/* Check permission for these buttons */}
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-emerald-500" size={24} />
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-tight">
                      Catalogue Created
                    </h4>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                      Catalogue ID: {lastGenerated.id}
                    </p>
                    {lastGenerated.hostedUrl && (
                      <p className="text-[10px] font-bold text-brand-orange mt-1">
                        iPhone users should use the hosted link.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <SecondaryButton
                    onClick={() => {
                      if (permissionService.canApprove("createCatalogue")) {
                        handleMarkDeployed(lastGenerated.id);
                        if (lastGenerated.hostedUrl) {
                          window.open(lastGenerated.hostedUrl, "_blank");
                        }
                      } else alert("Permission denied to deploy catalogues.");
                    }}
                    size="sm"
                    disabled={!permissionService.canApprove("createCatalogue")}
                  >
                    <Globe size={14} className="mr-2" /> Deploy / Open Hosted
                    Catalogue
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => {
                      setQuickLogData({
                        activityType: "CATALOGUE_SHARED",
                        catalogueId: lastGenerated.id,
                        sector: config.sector,
                        category: config.category,
                        province: config.province,
                        cityTown: config.cityTown,
                        vendorName: "Multi-vendor Catalogue",
                        leadStatus: "NOT_APPLICABLE",
                        priority: "MEDIUM",
                      });
                      setIsQuickLogOpen(true);
                    }}
                    size="sm"
                  >
                    <MessageSquare size={14} className="mr-2" /> Log Share
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() => {
                      if (permissionService.canEdit("createCatalogue"))
                        setLastGenerated(null);
                      else
                        alert(
                          "Permission denied to clear generated catalogue.",
                        );
                    }}
                    size="sm"
                    disabled={!permissionService.canEdit("createCatalogue")}
                  >
                    Clear
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={() =>
                      downloadFile(lastGenerated.html, lastGenerated.fileName)
                    }
                    size="sm"
                    disabled={!permissionService.canExport("createCatalogue")}
                  >
                    <Download size={14} className="mr-2" /> Download Offline
                    HTML
                  </PrimaryButton>
                </div>
              </div>
              <div className="aspect-[3/4] w-full border-2 border-stone-200 shadow-inner relative overflow-hidden bg-white">
                <iframe
                  srcDoc={lastGenerated.html}
                  title="Catalogue Preview"
                  className="w-full h-[250%] border-0 pointer-events-none transform scale-[0.4] origin-top border-stone-200"
                />
                <div className="absolute inset-0 bg-stone-900/5 flex items-center justify-center group cursor-pointer hover:bg-stone-900/20 transition-all">
                  <div className="bg-white p-4 font-bold text-[10px] uppercase tracking-widest shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                    Audit View Active
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Catalogue Archive / History Manager */}
          <DataPanel title="Catalogue Archive & History Manager">
            <div className="px-6 py-4 bg-stone-50 border-b border-stone-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  size={12}
                />
                <input
                  type="text"
                  placeholder="Search Serial, Sector..."
                  className="w-full pl-8 pr-3 py-2 text-[10px] font-bold outline-none border border-stone-200"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <select
                  className="w-full p-2 text-[10px] font-bold outline-none border border-stone-200 uppercase"
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                >
                  <option value="">All Sectors</option>
                  {uniqueSectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <select
                className="p-2 text-[10px] font-bold outline-none border border-stone-200"
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as DeploymentStatus | "all")
                }
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="generated">Generated</option>
                <option value="deployed">Deployed</option>
                <option value="expired">Expired</option>
                <option value="replaced">Replaced</option>
                <option value="archived">Archived</option>
              </select>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-[9px] font-bold uppercase text-stone-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="accent-brand-orange"
                  />{" "}
                  Show Archived
                </label>
                <label className="flex items-center gap-2 text-[9px] font-bold uppercase text-stone-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showReplaced}
                    onChange={(e) => setShowReplaced(e.target.checked)}
                    className="accent-brand-orange"
                  />{" "}
                  Show Replaced
                </label>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-[9px] font-bold uppercase tracking-widest text-stone-400">
                    <th className="px-4 py-3">Serial / ID</th>
                    <th className="px-4 py-3">Classification</th>
                    <th className="px-4 py-3">Entities</th>
                    <th className="px-4 py-3">Lifecycle</th>
                    <th className="px-4 py-3">Timeline</th>
                    <th className="px-4 py-3">Payload</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-stone-600 divide-y divide-stone-100">
                  {filteredHistory.map((cat) => {
                    const isExpiringSoon =
                      cat.status === "deployed" &&
                      cat.expiryDate &&
                      new Date(cat.expiryDate).getTime() -
                        new Date().getTime() <
                        2 * 24 * 60 * 60 * 1000;
                    const isExpired =
                      cat.status === "expired" ||
                      (cat.status === "deployed" &&
                        cat.expiryDate &&
                        new Date(cat.expiryDate) < new Date());

                    return (
                      <tr
                        key={cat.id}
                        className="hover:bg-stone-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-tight">
                            {cat.serialNumber}
                          </p>
                          <p className="text-[9px] text-stone-400 font-mono mt-0.5">
                            {cat.id}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-bold uppercase">
                          <p className="text-brand-charcoal">{cat.sector}</p>
                          <p className="text-stone-400">{cat.category}</p>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono">
                          <p>{cat.productCount} Products</p>
                          <p>{cat.vendorIds?.length || 0} Vendors</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <CatalogueStatusBadge status={cat.status} />
                            {isExpiringSoon && !isExpired && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase">
                                Expiring Soon
                              </span>
                            )}
                            {isExpired && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase">
                                Expired
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[9px] font-bold uppercase text-stone-500 whitespace-nowrap space-y-1">
                          <span>
                            Gen:{" "}
                            {new Date(cat.generatedAt).toLocaleDateString()}
                          </span>
                          <br />
                          {cat.deployedAt && (
                            <span>
                              Deployed:{" "}
                              {new Date(cat.deployedAt).toLocaleDateString()}
                            </span>
                          )}
                          <br />
                          {cat.expiryDate && (
                            <span>
                              Expiry:{" "}
                              {new Date(cat.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-stone-500">
                          {cat.htmlSize
                            ? `${(cat.htmlSize / 1024).toFixed(1)} KB`
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap max-w-[140px] ml-auto">
                            <button
                              onClick={() => handleViewPreview(cat)}
                              className="p-1.5 text-stone-400 hover:text-brand-charcoal border border-stone-200 bg-white"
                              title="View Preview"
                            >
                              <Eye size={12} />
                            </button>

                            {cat.htmlContent &&
                              permissionService.canExport(
                                "createCatalogue",
                              ) && (
                                <>
                                  <button
                                    onClick={() =>
                                      downloadFile(
                                        cat.htmlContent!,
                                        cat.fileName ||
                                          `${cat.serialNumber}.html`,
                                      )
                                    }
                                    className="p-1.5 text-stone-400 hover:text-brand-charcoal border border-stone-200 bg-white"
                                    title="Download HTML"
                                  >
                                    <Download size={12} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleCopyHtml(cat.htmlContent!)
                                    }
                                    className="p-1.5 text-stone-400 hover:text-brand-charcoal border border-stone-200 bg-white"
                                    title="Copy HTML"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </>
                              )}

                            {permissionService.canEdit("createCatalogue") && (
                              <button
                                onClick={() => handleEditConfig(cat)}
                                className="p-1.5 text-brand-orange hover:bg-orange-50 border border-orange-200 bg-white"
                                title="Edit Configuration"
                              >
                                <Edit3 size={12} />
                              </button>
                            )}

                            {cat.status === "generated" && (
                              <button
                                onClick={() => {
                                  if (
                                    permissionService.canApprove(
                                      "createCatalogue",
                                    )
                                  )
                                    handleMarkDeployed(cat.id);
                                  else
                                    alert(
                                      "Permission denied to deploy catalogues.",
                                    );
                                }}
                                className={`p-1.5 bg-stone-900 text-white hover:bg-brand-orange transition-colors ${!permissionService.canApprove("createCatalogue") ? "opacity-50 cursor-not-allowed" : ""}`}
                                title="Deploy"
                              >
                                <Globe size={12} />
                              </button>
                            )}

                            {cat.status === "deployed" &&
                              permissionService.canApprove(
                                "createCatalogue",
                              ) && (
                                <button
                                  onClick={() => handleRedeploy(cat.id)}
                                  className="p-1.5 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 bg-white"
                                  title="Redeploy / Reset Expiry"
                                >
                                  <Globe size={12} />
                                </button>
                              )}

                            <button
                              onClick={() => {
                                if (
                                  permissionService.canDelete("createCatalogue")
                                )
                                  handleArchive(cat.id);
                                else
                                  alert(
                                    "Permission denied to archive catalogues.",
                                  );
                              }}
                              className={`p-1.5 text-stone-400 border border-stone-200 hover:text-brand-charcoal transition-colors bg-white ${!permissionService.canDelete("createCatalogue") ? "opacity-50 cursor-not-allowed" : ""}`}
                              title="Archive"
                            >
                              <Archive size={12} />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  permissionService.canDelete("createCatalogue")
                                )
                                  handleDelete(cat.id);
                                else
                                  alert(
                                    "Permission denied to delete catalogues.",
                                  );
                              }}
                              className={`p-1.5 text-stone-400 border border-stone-200 hover:text-red-500 hover:border-red-200 transition-colors bg-white ${!permissionService.canDelete("createCatalogue") ? "opacity-50 cursor-not-allowed" : ""}`}
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-20 text-center text-stone-300"
                      >
                        <Package
                          size={48}
                          className="mx-auto mb-4 opacity-20"
                        />
                        <p className="text-[10px] font-extrabold uppercase">
                          Repository Empty
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DataPanel>
        </div>

        {/* Sidebar / Build Stats */}
        <div className="space-y-8">
          <DataPanel title="Review Checklist">
            <div className="p-6 space-y-6">
              {warnings.length > 0 ? (
                <div className="space-y-3">
                  {warnings.map((w, i) => (
                    <div key={i} className="flex gap-3 text-red-600">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold uppercase leading-tight italic">
                        {w}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-emerald-600">
                  <CheckCircle2 size={16} />
                  <p className="text-[10px] font-bold uppercase">
                    Ready to create
                  </p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel title="Catalogue Performance">
            <div className="p-6 space-y-8">
              <div className="p-4 bg-stone-900 text-white flex flex-col items-center justify-center border-4 border-brand-orange">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1 opacity-60">
                  Estimated File Size
                </p>
                <p className="text-3xl font-bold tracking-tighter">
                  {estimatedSize > 1024 * 1024
                    ? `${(estimatedSize / 1024 / 1024).toFixed(2)} MB`
                    : `${(estimatedSize / 1024).toFixed(0)} KB`}
                </p>
                <div className="w-full h-1 bg-white/20 mt-4 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${estimatedSize > 15 * 1024 * 1024 ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{
                      width: `${Math.min(100, (estimatedSize / (20 * 1024 * 1024)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 border border-stone-100">
                  <div className="text-xs font-bold">
                    {allSelectedProducts.length}
                  </div>
                  <div className="text-[8px] font-extrabold uppercase text-stone-400">
                    Products
                  </div>
                </div>
                <div className="text-center p-3 border border-stone-100">
                  <div className="text-xs font-bold">
                    {allSelectedProducts.filter((p) => !!p.imageUrl).length}
                  </div>
                  <div className="text-[8px] font-extrabold uppercase text-stone-400">
                    Images
                  </div>
                </div>
              </div>
            </div>
          </DataPanel>

          <div className="p-6 bg-orange-50 border border-orange-100 text-orange-900 rounded-lg">
            <h4 className="text-[10px] font-extrabold uppercase mb-2 flex items-center gap-2">
              <Filter size={12} /> Optimization Tip
            </h4>
            <p className="text-[10px] font-bold leading-relaxed italic opacity-80">
              Avoid catalogues larger than 12MB. Group items by price-point or
              specific vehicle category to keep asset size minimal for users on
              shared mobile data.
            </p>
          </div>
        </div>
      </div>

      <WhatsAppActivityQuickLog
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        initialData={quickLogData}
      />
    </div>
  );
};

const ToggleItem: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <div
    onClick={onClick}
    className={`p-3 border-2 cursor-pointer transition-all flex items-center justify-between ${
      active
        ? "border-brand-orange bg-brand-orange text-white"
        : "border-stone-50 text-stone-400"
    }`}
  >
    <span className="text-[9px] font-bold uppercase">{label}</span>
    {active ? <CheckCircle2 size={10} /> : <Plus size={10} />}
  </div>
);

const CatalogueStatusBadge: React.FC<{ status: DeploymentStatus }> = ({
  status,
}) => {
  const styles = {
    draft: "bg-stone-100 text-stone-600",
    generated: "bg-blue-100 text-blue-700",
    deployed: "bg-emerald-100 text-emerald-700",
    expired: "bg-red-100 text-red-700",
    replaced: "bg-purple-100 text-purple-700",
    archived: "bg-stone-800 text-stone-300",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-none text-[8px] font-black uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  );
};
