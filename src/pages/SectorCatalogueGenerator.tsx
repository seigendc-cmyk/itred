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
import { focusMainContent } from "../utils/uiHelpers.ts";
import { WhatsAppActivityQuickLog } from "../components/WhatsAppActivityQuickLog.tsx";

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

  const [lastGenerated, setLastGenerated] = useState<{
    html: string;
    id: string;
    fileName: string;
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
      ] = await Promise.all([
        vendorService.getVendors(),
        productService.getProducts(),
        cahService.getLinks(),
        pricingPlanService.getPlans(),
        catalogueService.getHistory(),
        contactHubService.getSettings(),
      ]);

      setVendors(asArray<Vendor>(rawVendors));
      setProducts(asArray<Product>(rawProducts));
      setCahLinks(asArray<CAHLink>(rawCahLinks));
      setPlans(asArray<PricingPlan>(rawPlans));
      setHistory(asArray<CatalogueGeneration>(rawHistory));
      setContactSettings(rawSettings);

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

  const safeVendors = asArray<Vendor>(vendors);
  const safeProducts = asArray<Product>(products);
  const safeCahLinks = asArray<CAHLink>(cahLinks);
  const safePlans = asArray<PricingPlan>(plans);
  const safeHistory = asArray<CatalogueGeneration>(history);

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
    safeSelectedVendors.forEach(async (vendor) => {
      const plan = await pricingPlanService.getPlan(vendor.planId);
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

  const handleGenerate = () => {
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

    setIsGenerating(true);
    focusMainContent();

    // Simulate generation delay
    setTimeout(() => {
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(now.getDate() + config.expiryPeriodDays);

      const html = generateCatalogueHtml(
        selectedVendors,
        allSelectedProducts,
        selectedCahLinks,
        plans,
        {
          serialNumber: config.serialNumber,
          sector: config.sector,
          category: config.category,
          expiryDate: expiry.toISOString(),
          seigenLogoUrl: contactSettings?.seigenLogoUrl,
          companyLogoUrl: contactSettings?.companyLogoUrl,
          systemLogoUrl: contactSettings?.systemLogoUrl,
        },
      );

      const newId = `CAT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

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

      const catalogueData: CatalogueGeneration = {
        id: newId,
        serialNumber: config.serialNumber,
        sector: config.sector,
        category: config.category,
        province: config.province,
        cityTown: config.cityTown,
        vendorIds: config.vendorIds,
        cahLinkIds: config.cahLinkIds,
        generatedBy: "System Admin",
        generatedAt: new Date().toISOString(),
        expiryPeriodDays: config.expiryPeriodDays,
        status: "generated",
        notes: config.notes,
        productCount: allSelectedProducts.length,
        htmlSize: html.length,
        fileName: finalFileName,
      };

      catalogueService.saveCatalogue(catalogueData);
      setLastGenerated({ html, id: newId, fileName: finalFileName });
      refreshHistory();
      setIsGenerating(false);
    }, 1200);
  };

  const handleMarkDeployed = (id: string) => {
    catalogueService.markAsDeployed(id);
    refreshHistory();
    alert("Catalogue deployed. Lifecycle tracking active.");
  };

  const handleArchive = (id: string) => {
    catalogueService.archiveCatalogue(id);
    refreshHistory();
  };

  const handleDelete = (id: string) => {
    if (confirm("Permanently purge this catalogue record?")) {
      const updated = safeHistory.filter((h) => h.id !== id);
      setHistory(updated);
      localStorage.setItem("itred_catalogue_history", JSON.stringify(updated));
    }
  };

  const filteredHistory = useMemo(() => {
    return safeHistory.filter((h) => {
      const matchesSector =
        !filterSector ||
        h.sector.toLowerCase().includes(filterSector.toLowerCase());
      const matchesCategory =
        !filterCategory ||
        h.category.toLowerCase().includes(filterCategory.toLowerCase());
      const matchesStatus = filterStatus === "all" || h.status === filterStatus;
      return matchesSector && matchesCategory && matchesStatus;
    });
  }, [safeHistory, filterSector, filterCategory, filterStatus]);

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
  };

  return (
    <div className="pb-20" id="create-catalogue-header" tabIndex={-1}>
      <PageHeader
        title="Create Catalogue"
        subtitle="Group multiple vendors into a single digital product catalogue."
        actions={
          permissionService.canCreate("createCatalogue") && ( // Check permission for creating catalogue
            <PrimaryButton
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                config.vendorIds.length === 0 ||
                !permissionService.canCreate("createCatalogue")
              }
              className={`${isGenerating ? "opacity-50 cursor-not-allowed" : ""} ${!permissionService.canCreate("createCatalogue") ? "opacity-50 cursor-not-allowed" : ""}`}
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
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Config */}
          <section className="card bg-white">
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
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-600 text-white flex items-center justify-center font-bold italic">
                  WA
                </div>
                <h3 className="text-sm uppercase font-bold tracking-[0.2em]">
                  WhatsApp Access Hub Links
                </h3>
              </div>
              <div className="text-[10px] font-bold text-emerald-600">
                {config.cahLinkIds.length} Selected
              </div>
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
                  </div>
                </div>
                <div className="flex gap-2">
                  <SecondaryButton
                    onClick={() => {
                      if (permissionService.canApprove("createCatalogue"))
                        handleMarkDeployed(lastGenerated.id);
                      else alert("Permission denied to deploy catalogues.");
                    }}
                    size="sm"
                    disabled={!permissionService.canApprove("createCatalogue")}
                  >
                    <Globe size={14} className="mr-2" /> Deploy
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
                    <Download size={14} className="mr-2" /> Download
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

          {/* Deployment Lifecycle / Archive */}
          <DataPanel title="Catalogue Management">
            <div className="px-6 py-4 bg-stone-50 border-b border-stone-100 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  size={12}
                />
                <input
                  type="text"
                  placeholder="Sector..."
                  className="w-full pl-8 pr-3 py-2 text-[10px] font-bold outline-none border border-stone-200"
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                />
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  size={12}
                />
                <input
                  type="text"
                  placeholder="Category..."
                  className="w-full pl-8 pr-3 py-2 text-[10px] font-bold outline-none border border-stone-200"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                />
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
            </div>

            <div className="divide-y divide-stone-100">
              {filteredHistory.map((cat) => {
                const isExpiringSoon =
                  cat.status === "deployed" &&
                  cat.expiryDate &&
                  new Date(cat.expiryDate).getTime() - new Date().getTime() <
                    2 * 24 * 60 * 60 * 1000;
                const isExpired =
                  cat.status === "expired" ||
                  (cat.status === "deployed" &&
                    cat.expiryDate &&
                    new Date(cat.expiryDate) < new Date());

                return (
                  <div
                    key={cat.id}
                    className="p-5 flex items-center justify-between hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={`p-2 ${cat.status === "deployed" ? "bg-emerald-50 text-emerald-500" : "bg-stone-100 text-stone-400"}`}
                      >
                        <FileCode size={18} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black uppercase tracking-tight">
                            {cat.serialNumber}
                          </p>
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
                        <div className="flex items-center gap-4 text-[9px] text-stone-400 font-bold uppercase">
                          <span>
                            Gen:{" "}
                            {new Date(cat.generatedAt).toLocaleDateString()}
                          </span>
                          {cat.deployedAt && (
                            <span>
                              Deployed:{" "}
                              {new Date(cat.deployedAt).toLocaleDateString()}
                            </span>
                          )}
                          {cat.expiryDate && (
                            <span>
                              Expiry:{" "}
                              {new Date(cat.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                          <span>{cat.productCount} Items</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {cat.status === "generated" && (
                        <button
                          onClick={() => {
                            if (permissionService.canApprove("createCatalogue"))
                              handleMarkDeployed(cat.id);
                            else
                              alert("Permission denied to deploy catalogues.");
                          }}
                          className={`p-2 px-3 bg-stone-900 text-white text-[9px] font-black uppercase hover:bg-brand-orange transition-colors ${!permissionService.canApprove("createCatalogue") ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          Deploy
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (permissionService.canDelete("createCatalogue"))
                            handleArchive(cat.id);
                          else
                            alert("Permission denied to archive catalogues.");
                        }}
                        className={`p-2 text-stone-400 hover:text-brand-charcoal transition-colors ${!permissionService.canDelete("createCatalogue") ? "opacity-50 cursor-not-allowed" : ""}`}
                        title="Archive"
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (permissionService.canDelete("createCatalogue"))
                            handleDelete(cat.id);
                          else alert("Permission denied to delete catalogues.");
                        }}
                        className={`p-2 text-stone-300 hover:text-red-500 transition-colors ${!permissionService.canDelete("createCatalogue") ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredHistory.length === 0 && (
                <div className="p-20 text-center text-stone-300">
                  <Package size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-[10px] font-extrabold uppercase">
                    Repository Empty
                  </p>
                </div>
              )}
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
