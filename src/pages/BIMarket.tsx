/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  DataPanel,
  TablePanel,
  StatusBadge,
  PrimaryButton,
} from "../components/CommonUI.tsx";
import {
  Zap,
  Target,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  ChevronRight,
  MapPin,
  Tag,
  ImageIcon,
  DollarSign,
  Package,
  Layers,
  Globe,
  BarChart3,
} from "lucide-react";
import { biService } from "../services/biService.ts";
import { vendorService } from "../services/vendorService.ts";
import { productService } from "../services/productService.ts";
import { cahService } from "../services/cahService.ts";
import { catalogueService } from "../services/catalogueService.ts";
import { rpnService } from "../services/rpnService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { permissionService } from "../services/permissionService.ts";
import { settingsService } from "../services/settingsService.ts";
import { whatsappActivityService } from "../services/whatsappActivityService.ts";
import { vendorReadinessService } from "../services/vendorReadinessService.ts";
import { taskService } from "../services/taskService.ts";
import { notificationService } from "../services/notificationService.ts";
import {
  Vendor,
  Product,
  CAHLink,
  CatalogueGeneration,
  EstimatedRevenueGrowth,
  StaffTask,
  SystemSettings,
  VendorReadinessResult,
  WhatsAppActivityLog,
  WhatsAppIntelligenceLog,
} from "../types.ts";

const normalizeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as T[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const obj = value as Record<string, unknown>;

  if (Array.isArray(obj.data)) return obj.data.filter(Boolean) as T[];
  if (Array.isArray(obj.items)) return obj.items.filter(Boolean) as T[];
  if (Array.isArray(obj.docs)) return obj.docs.filter(Boolean) as T[];
  if (Array.isArray(obj.results)) return obj.results.filter(Boolean) as T[];
  if (Array.isArray(obj.records)) return obj.records.filter(Boolean) as T[];
  if (Array.isArray(obj.vendors)) return obj.vendors.filter(Boolean) as T[];
  if (Array.isArray(obj.products)) return obj.products.filter(Boolean) as T[];
  if (Array.isArray(obj.events)) return obj.events.filter(Boolean) as T[];
  if (Array.isArray(obj.cahLinks)) return obj.cahLinks.filter(Boolean) as T[];
  if (Array.isArray(obj.catalogueHistory)) {
    return obj.catalogueHistory.filter(Boolean) as T[];
  }

  return [];
};

const safeString = (value: unknown, fallback = "Unknown"): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
};

const safeNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const safePercent = (value: unknown): number => {
  return Math.max(0, Math.min(100, safeNumber(value, 0)));
};

const defaultBiMarketSettings = {
  vendorReadinessTaskThreshold: 70,
  enableReadinessAutoTasks: true,
  readinessTaskCooldownDays: 3,
  averageLeadConversionRatePercent: 12,
  averageOrderValueUsd: 15,
  leadRevenueConfidenceFactor: 0.65,
};

const money = (value: number) => `$${Math.round(value || 0).toLocaleString()}`;

const estimateRevenueGrowth = (
  leadCount: number,
  settings: SystemSettings,
): EstimatedRevenueGrowth => {
  const averageLeadConversionRatePercent =
    settings.averageLeadConversionRatePercent ??
    defaultBiMarketSettings.averageLeadConversionRatePercent;
  const averageOrderValueUsd =
    settings.averageOrderValueUsd ?? defaultBiMarketSettings.averageOrderValueUsd;
  const leadRevenueConfidenceFactor =
    settings.leadRevenueConfidenceFactor ??
    defaultBiMarketSettings.leadRevenueConfidenceFactor;
  const estimatedConvertedLeads =
    leadCount * (averageLeadConversionRatePercent / 100);
  const estimatedGrossRevenue = estimatedConvertedLeads * averageOrderValueUsd;
  return {
    leadCount,
    estimatedConvertedLeads,
    averageLeadConversionRatePercent,
    averageOrderValueUsd,
    leadRevenueConfidenceFactor,
    estimatedGrossRevenue,
    estimatedRevenueGrowth:
      estimatedGrossRevenue * leadRevenueConfidenceFactor,
  };
};

const leadEventTypes = new Set([
  "WHATSAPP_VENDOR_CLICKED",
  "CALL_VENDOR_CLICKED",
  "PRODUCT_VIEWED",
  "SEARCH_PERFORMED",
  "NO_RESULTS_SEARCH",
  "PRODUCT_ENQUIRY",
  "CUSTOMER_REQUEST",
  "DEMAND_SIGNAL",
]);

const getVendorKey = (vendor: Partial<Vendor> | any, index: number): string => {
  return safeString(
    vendor?.id || vendor?.vendorId || vendor?.uid,
    `vendor-${index}`,
  );
};

const createEmptyMarketInsights = () => ({
  summary: {},
  sectors: [] as string[],
  riskSectors: [] as string[],
  topSectors: [] as [string, number][],
  topLocations: [] as [string, number][],
  vendorsWithPoorImages: [] as Vendor[],
  overdueSubs: [] as Vendor[],
  missingPrice: [] as Product[],
  missingImage: [] as Product[],
  hiddenAvailable: [] as Product[],
  stockOutPublished: [] as Product[],
  sectorsWithoutCah: [] as string[],
  whatsappHits: 0,
  catalogueViews: 0,
  productViews: 0,
  leadsCreated: 0,
  activeVendors: 0,
  activeProducts: 0,
  rpnCount: 0,
  eventCount: 0,
});

export const BIMarket: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cahLinks, setCahLinks] = useState<CAHLink[]>([]);
  const [catalogueHistory, setCatalogueHistory] = useState<
    CatalogueGeneration[]
  >([]);
  const [events, setEvents] = useState<any[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppActivityLog[]>([]);
  const [intelligenceLogs, setIntelligenceLogs] = useState<
    WhatsAppIntelligenceLog[]
  >([]);
  const [settings, setSettings] = useState<SystemSettings>({});
  const [staffTasks, setStaffTasks] = useState<StaffTask[]>([]);
  const [rpns, setRpns] = useState<any[]>([]);
  const [view, setView] = useState<"market" | "readiness" | "audit">("market");
  const [loadError, setLoadError] = useState<string>("");
  const [scanStatus, setScanStatus] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoadError("");
        const [v, p, c, ch, e, r, s, tasks] = await Promise.all([
          vendorService.getVendors(),
          productService.getProducts(),
          cahService.getLinks(),
          catalogueService.getHistory(),
          analyticsService.getEvents(),
          rpnService.getAll(),
          settingsService.getSettings(),
          taskService.getAll(),
        ]);
        if (isMounted) {
          setVendors(normalizeArray<Vendor>(v));
          setProducts(normalizeArray<Product>(p));
          setCahLinks(normalizeArray<CAHLink>(c));
          setCatalogueHistory(normalizeArray<CatalogueGeneration>(ch));
          setEvents(normalizeArray<any>(e));
          setRpns(normalizeArray<any>(r));
          setSettings(s || {});
          setStaffTasks(normalizeArray<StaffTask>(tasks));
          setWhatsappLogs(whatsappActivityService.getLogs());
          setIntelligenceLogs(whatsappActivityService.getIntelligenceLogs());
        }
      } catch (error) {
        console.error("Failed to load BI Market data", error);
        if (isMounted) {
          setVendors([]);
          setProducts([]);
          setCahLinks([]);
          setCatalogueHistory([]);
          setEvents([]);
          setRpns([]);
          setSettings({});
          setStaffTasks([]);
          setWhatsappLogs([]);
          setIntelligenceLogs([]);
          setLoadError(
            "BI Market data could not be loaded. Check Firebase permissions and service fallback handling.",
          );
        }
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const safeVendors = useMemo(() => normalizeArray<Vendor>(vendors), [vendors]);
  const safeProducts = useMemo(
    () => normalizeArray<Product>(products),
    [products],
  );
  const safeCahLinks = useMemo(
    () => normalizeArray<CAHLink>(cahLinks),
    [cahLinks],
  );
  const safeCatalogueHistory = useMemo(
    () => normalizeArray<CatalogueGeneration>(catalogueHistory),
    [catalogueHistory],
  );
  const safeEvents = useMemo(() => normalizeArray<any>(events), [events]);
  const safeRpns = useMemo(() => normalizeArray<any>(rpns), [rpns]);
  const safeWhatsappLogs = useMemo(
    () => normalizeArray<WhatsAppActivityLog>(whatsappLogs),
    [whatsappLogs],
  );
  const safeIntelligenceLogs = useMemo(
    () => normalizeArray<WhatsAppIntelligenceLog>(intelligenceLogs),
    [intelligenceLogs],
  );
  const safeStaffTasks = useMemo(
    () => normalizeArray<StaffTask>(staffTasks),
    [staffTasks],
  );

  const marketInsights = useMemo(() => {
    try {
      const insights = biService.getMarketInsights(
        safeProducts,
        safeVendors,
        safeEvents,
        safeCahLinks,
        safeCatalogueHistory,
        safeRpns,
      );
      return {
        ...createEmptyMarketInsights(),
        ...(insights || {}),
        topSectors: normalizeArray<[string, number]>(
          (insights as any)?.topSectors,
        ),
        topLocations: normalizeArray<[string, number]>(
          (insights as any)?.topLocations,
        ),
        vendorsWithPoorImages: normalizeArray<Vendor>(
          (insights as any)?.vendorsWithPoorImages,
        ),
        overdueSubs: normalizeArray<Vendor>((insights as any)?.overdueSubs),
        missingPrice: normalizeArray<Product>((insights as any)?.missingPrice),
        missingImage: normalizeArray<Product>((insights as any)?.missingImage),
        hiddenAvailable: normalizeArray<Product>(
          (insights as any)?.hiddenAvailable,
        ),
        stockOutPublished: normalizeArray<Product>(
          (insights as any)?.stockOutPublished,
        ),
        sectorsWithoutCah: normalizeArray<string>(
          (insights as any)?.sectorsWithoutCah,
        ),
      };
    } catch (error) {
      console.error("Failed to generate BI market insights", error);
      return createEmptyMarketInsights();
    }
  }, [safeVendors, safeProducts]);

  const sectorReadiness = useMemo(() => {
    const sectors = [
      ...new Set(
        safeVendors
          .map((v: any) =>
            safeString(v?.sector || v?.businessSector || v?.category, ""),
          )
          .filter(Boolean),
      ),
    ];

    return sectors
      .map((sector) =>
        biService.calculateSectorReadiness(
          sector,
          safeVendors,
          safeProducts,
          safeCahLinks,
          safeCatalogueHistory,
        ),
      )
      .sort(
        (a, b) => safeNumber(b.readinessScore) - safeNumber(a.readinessScore),
      );
  }, [safeVendors, safeProducts, safeCahLinks, safeCatalogueHistory]);

  const vendorReadiness = useMemo(() => {
    return safeVendors
      .map((vendor) =>
        vendorReadinessService.calculateVendorReadiness(vendor, safeProducts),
      )
      .sort((a, b) => safeNumber(b.score) - safeNumber(a.score));
  }, [safeVendors, safeProducts]);

  const leadRows = useMemo(() => {
    const rows: Array<{
      vendorId?: string;
      vendorName?: string;
      productName?: string;
      sector?: string;
      region?: string;
      source: string;
      date?: string;
      leadCount: number;
    }> = [];

    safeEvents.forEach((event) => {
      const eventType = safeString(event.eventType || event.type || event.action, "");
      if (!leadEventTypes.has(eventType)) return;
      rows.push({
        vendorId: event.vendorId || event.details?.vendorId,
        vendorName: event.vendorName || event.details?.vendorName,
        productName: event.productName || event.details?.productName,
        sector: event.sector || event.details?.sector,
        region:
          event.region ||
          event.province ||
          event.cityTown ||
          event.details?.region ||
          event.details?.cityTown,
        source: eventType,
        date: event.timestamp || event.createdAt,
        leadCount: 1,
      });
    });

    safeWhatsappLogs.forEach((log) => {
      if (
        !["PRODUCT_ENQUIRY", "CUSTOMER_REQUEST", "DEMAND_SIGNAL", "VENDOR_REFERRAL"].includes(
          log.activityType,
        )
      )
        return;
      rows.push({
        vendorId: log.vendorId,
        vendorName: log.vendorName,
        productName: log.productName,
        sector: log.sector,
        region: log.cityTown || log.province || log.district,
        source: log.activityType,
        date: log.activityDate || log.createdAt,
        leadCount: Math.max(1, Number(log.enquiryCount) || 1),
      });
    });

    safeIntelligenceLogs.forEach((log) => {
      if (
        ![
          "Enquiry",
          "Price Request",
          "Stock Request",
          "Product Search",
          "Service Request",
          "Market Feedback",
        ].includes(log.interactionType)
      )
        return;
      rows.push({
        vendorId: log.vendorId,
        vendorName: log.vendorName,
        productName: log.productName,
        sector: log.sector || log.category,
        region: log.region || log.city || log.province,
        source: log.source,
        date: log.createdAt,
        leadCount: 1,
      });
    });

    return rows;
  }, [safeEvents, safeIntelligenceLogs, safeWhatsappLogs]);

  const estimatedGrowth = useMemo(() => {
    const vendorMap = new Map<string, any>();
    const productMap = new Map<string, any>();
    const sectorMap = new Map<string, number>();
    const regionMap = new Map<string, number>();
    let totalLeadCount = 0;

    leadRows.forEach((row) => {
      totalLeadCount += row.leadCount;
      const vendorId =
        row.vendorId ||
        safeVendors.find((vendor) => vendor.name === row.vendorName)?.id ||
        "unknown";
      const vendor = safeVendors.find((item) => item.id === vendorId);
      const vendorKey = vendorId || row.vendorName || "unknown";
      const vendorEntry = vendorMap.get(vendorKey) || {
        vendorId: vendorKey,
        vendorName: vendor?.name || row.vendorName || "Unknown Vendor",
        leadCount: 0,
        region: vendor?.suburb || vendor?.cityTown || row.region || "Unknown",
        topProduct: "N/A",
        products: {} as Record<string, number>,
      };
      vendorEntry.leadCount += row.leadCount;
      if (row.productName) {
        vendorEntry.products[row.productName] =
          (vendorEntry.products[row.productName] || 0) + row.leadCount;
      }
      vendorMap.set(vendorKey, vendorEntry);

      const productKey = row.productName || "Unspecified Product";
      const productEntry = productMap.get(productKey) || {
        productName: productKey,
        leadCount: 0,
        vendorIds: new Set<string>(),
        totalStock: 0,
      };
      productEntry.leadCount += row.leadCount;
      if (vendorKey !== "unknown") productEntry.vendorIds.add(vendorKey);
      productEntry.totalStock = safeProducts
        .filter((product) => product.name === productKey)
        .reduce((sum, product) => sum + safeNumber(product.stockQuantity), 0);
      productMap.set(productKey, productEntry);

      const sector = row.sector || vendor?.sector || "Unspecified";
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + row.leadCount);
      const region = row.region || vendor?.cityTown || "Unspecified";
      regionMap.set(region, (regionMap.get(region) || 0) + row.leadCount);
    });

    const total = estimateRevenueGrowth(totalLeadCount, settings);
    const vendorRows = Array.from(vendorMap.values())
      .map((entry) => {
        const estimate = estimateRevenueGrowth(entry.leadCount, settings);
        const topProduct = Object.entries(entry.products).sort(
          ([, a], [, b]) => Number(b) - Number(a),
        )[0]?.[0];
        const readiness = vendorReadiness.find(
          (item) => item.vendorId === entry.vendorId,
        );
        return {
          ...entry,
          ...estimate,
          topProduct: topProduct || "N/A",
          readinessScore: readiness?.score ?? 100,
          recommendedAction:
            (readiness?.score ?? 100) < (settings.vendorReadinessTaskThreshold ?? 70)
              ? "Create readiness task before demand is wasted"
              : estimate.estimatedRevenueGrowth > 100
                ? "Follow up and protect stock"
                : "Monitor demand",
        };
      })
      .sort((a, b) => b.estimatedRevenueGrowth - a.estimatedRevenueGrowth);

    const productRows = Array.from(productMap.values())
      .map((entry) => {
        const estimate = estimateRevenueGrowth(entry.leadCount, settings);
        return {
          ...entry,
          vendorCount: entry.vendorIds.size,
          ...estimate,
          stockAuditRecommended: entry.leadCount >= 10 && entry.totalStock <= 5,
          restockRecommended: entry.leadCount >= 10 && entry.totalStock <= 10,
        };
      })
      .sort((a, b) => b.estimatedRevenueGrowth - a.estimatedRevenueGrowth);

    const topVendor = vendorRows[0];
    const topProduct = productRows[0];
    const topSector = Array.from(sectorMap.entries()).sort(
      ([, a], [, b]) => b - a,
    )[0];

    return {
      total,
      vendorRows,
      productRows,
      sectorMap,
      regionMap,
      topVendor,
      topProduct,
      topSector,
    };
  }, [leadRows, safeProducts, safeVendors, settings, vendorReadiness]);

  const readinessTaskRows = useMemo(() => {
    return vendorReadiness
      .filter(
        (result) =>
          result.score < (settings.vendorReadinessTaskThreshold ?? 70),
      )
      .map((result) => {
        const task = safeStaffTasks.find(
          (item) =>
            item.taskType === "vendor_readiness" &&
            item.vendorId === result.vendorId &&
            !["completed", "reviewed", "cancelled"].includes(item.status),
        );
        return { ...result, task };
      });
  }, [safeStaffTasks, settings.vendorReadinessTaskThreshold, vendorReadiness]);

  const hasNoMarketData =
    safeVendors.length === 0 &&
    safeProducts.length === 0 &&
    marketInsights.topSectors.length === 0 &&
    marketInsights.topLocations.length === 0;

  const handleRunReadinessScan = async () => {
    setScanStatus("Scanning vendor readiness...");
    let created = 0;
    let skipped = 0;
    try {
      for (const vendor of safeVendors) {
        const highPotential = estimatedGrowth.vendorRows.find(
          (row) =>
            row.vendorId === vendor.id &&
            row.estimatedRevenueGrowth >=
              (settings.averageOrderValueUsd ??
                defaultBiMarketSettings.averageOrderValueUsd) *
                5,
        );
        const response = await vendorReadinessService.ensureReadinessTask(
          vendor,
          safeProducts,
          settings,
          highPotential
            ? "Vendor has high lead potential but low readiness."
            : "Manual BI Market readiness scan.",
        );
        if (response.skipped) skipped++;
        else created++;
      }

      for (const product of estimatedGrowth.productRows.filter(
        (row) => row.stockAuditRecommended,
      )) {
        const matching = safeProducts.find(
          (item) => item.name === product.productName,
        );
        await notificationService.createNotification({
          title: "High lead pressure detected",
          message: `${product.productName} has ${product.leadCount} leads and low stock. Stock audit recommended.`,
          type: "system_alert",
          priority: "high",
          targetRole: "Backoffice",
          recordType: "product",
          recordId: matching?.id || product.productName,
          dedupeKey: `estimated_growth_stock_audit:${matching?.vendorId || "market"}:${matching?.productId || matching?.id || product.productName}:${new Date().toISOString().split("T")[0]}`,
        });
      }

      setStaffTasks(await taskService.getAll());
      setScanStatus(
        `Readiness scan complete. Created ${created} task(s), skipped ${skipped} due to threshold/cooldown.`,
      );
    } catch (error) {
      console.error("Readiness scan failed", error);
      setScanStatus("Readiness scan failed. Check console for details.");
    }
  };

  return (
    <div className="pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 mt-8">
        <PageHeader
          title="Intelligence Engine"
          subtitle="Rule-based market analysis, vendor readiness scoring, and operational recommendations."
        />

        <div className="flex bg-stone-100 p-1 self-start md:self-center">
          <button
            onClick={() => setView("market")}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === "market" ? "bg-white shadow-sm" : "text-stone-400"
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setView("readiness")}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === "readiness" ? "bg-white shadow-sm" : "text-stone-400"
            }`}
          >
            Readiness
          </button>
          <button
            onClick={() => setView("audit")}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
              view === "audit" ? "bg-white shadow-sm" : "text-stone-400"
            }`}
          >
            Quality Audit
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={handleRunReadinessScan}>
            Run Readiness Scan
          </PrimaryButton>
          {scanStatus && (
            <p className="text-[10px] font-bold uppercase text-brand-orange">
              {scanStatus}
            </p>
          )}
        </div>
      </div>

      {loadError && (
        <div className="mb-8 p-5 border-2 border-red-100 bg-red-50 text-red-700">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2">
            BI Market Load Warning
          </p>
          <p className="text-xs leading-relaxed">{loadError}</p>
        </div>
      )}

      {hasNoMarketData && (
        <div className="mb-8 p-6 border-2 border-orange-100 bg-orange-50 text-brand-charcoal">
          <div className="flex items-start gap-4">
            <BarChart3
              size={22}
              className="text-brand-orange shrink-0 mt-0.5"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">
                No BI Market Analytics Yet. Start by adding vendors, products,
                tracked catalogue views, WhatsApp hits, product views, and
                vendor lead activity.
              </p>
            </div>
          </div>
        </div>
      )}

      {view === "market" && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <AuditMetric
              label="Active Vendors"
              value={safeNumber(
                marketInsights.activeVendors,
                safeVendors.length,
              )}
              icon={<Zap size={20} />}
              variant="warning"
            />
            <AuditMetric
              label="Active Products"
              value={safeNumber(
                marketInsights.activeProducts,
                safeProducts.length,
              )}
              icon={<Package size={20} />}
              variant="warning"
            />
            <AuditMetric
              label="WhatsApp Hits"
              value={safeNumber(marketInsights.whatsappHits)}
              icon={<Globe size={20} />}
              variant="warning"
            />
            <AuditMetric
              label="Leads Created"
              value={safeNumber(marketInsights.leadsCreated)}
              icon={<Target size={20} />}
              variant="warning"
            />
            <AuditMetric
              label="Total Lead Count"
              value={estimatedGrowth.total.leadCount}
              icon={<BarChart3 size={20} />}
              variant="warning"
            />
            <AuditMetric
              label="Estimated Converted Leads"
              value={estimatedGrowth.total.estimatedConvertedLeads.toFixed(1)}
              icon={<Target size={20} />}
              variant="warning"
            />
            <AuditMetric
              label="Estimated Revenue Growth"
              value={money(estimatedGrowth.total.estimatedRevenueGrowth)}
              icon={<DollarSign size={20} />}
              variant="warning"
            />
            <AuditMetric
              label="Lead-to-Revenue Confidence"
              value={`${Math.round(estimatedGrowth.total.leadRevenueConfidenceFactor * 100)}%`}
              icon={<Lightbulb size={20} />}
              variant="warning"
            />
          </div>

          <DataPanel
            title="Estimated Revenue Growth"
            subtitle="Estimated Revenue Growth is calculated from customer lead activity using configurable conversion assumptions. It is not confirmed cash received."
          >
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-stone-200 p-4">
                <p className="text-[10px] font-black uppercase text-stone-400">
                  Top Revenue Growth Vendor
                </p>
                <p className="text-lg font-black text-brand-charcoal">
                  {estimatedGrowth.topVendor?.vendorName || "N/A"}
                </p>
                <p className="text-xs font-mono text-emerald-700">
                  {money(estimatedGrowth.topVendor?.estimatedRevenueGrowth || 0)}
                </p>
              </div>
              <div className="border border-stone-200 p-4">
                <p className="text-[10px] font-black uppercase text-stone-400">
                  Top Revenue Growth Product
                </p>
                <p className="text-lg font-black text-brand-charcoal">
                  {estimatedGrowth.topProduct?.productName || "N/A"}
                </p>
                <p className="text-xs font-mono text-emerald-700">
                  {money(estimatedGrowth.topProduct?.estimatedRevenueGrowth || 0)}
                </p>
              </div>
              <div className="border border-stone-200 p-4">
                <p className="text-[10px] font-black uppercase text-stone-400">
                  Top Revenue Growth Sector
                </p>
                <p className="text-lg font-black text-brand-charcoal">
                  {estimatedGrowth.topSector?.[0] || "N/A"}
                </p>
                <p className="text-xs font-mono text-emerald-700">
                  {estimatedGrowth.topSector?.[1] || 0} leads
                </p>
              </div>
            </div>
          </DataPanel>

          <TablePanel
            title="Estimated Revenue Growth by Vendor"
            headers={[
              "Vendor",
              "Lead Count",
              "Converted Leads",
              "Estimated Growth",
              "Confidence",
              "Top Product",
              "Region",
              "Recommended Action",
            ]}
          >
            {estimatedGrowth.vendorRows.slice(0, 20).map((row) => (
              <tr key={row.vendorId} className="border-b border-stone-100">
                <td className="px-6 py-4 text-xs font-black uppercase">
                  {row.vendorName}
                </td>
                <td className="px-6 py-4 text-xs font-mono">{row.leadCount}</td>
                <td className="px-6 py-4 text-xs font-mono">
                  {row.estimatedConvertedLeads.toFixed(1)}
                </td>
                <td className="px-6 py-4 text-xs font-mono text-emerald-700 font-bold">
                  {money(row.estimatedRevenueGrowth)}
                </td>
                <td className="px-6 py-4 text-xs font-mono">
                  {Math.round(row.leadRevenueConfidenceFactor * 100)}%
                </td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase">
                  {row.topProduct}
                </td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase">
                  {row.region}
                </td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase">
                  {row.recommendedAction}
                </td>
              </tr>
            ))}
          </TablePanel>

          <TablePanel
            title="Estimated Revenue Growth by Product"
            headers={[
              "Product",
              "Lead Count",
              "Vendor Count",
              "Estimated Growth",
              "Stock Audit",
              "Restock",
            ]}
          >
            {estimatedGrowth.productRows.slice(0, 20).map((row) => (
              <tr key={row.productName} className="border-b border-stone-100">
                <td className="px-6 py-4 text-xs font-black uppercase">
                  {row.productName}
                </td>
                <td className="px-6 py-4 text-xs font-mono">{row.leadCount}</td>
                <td className="px-6 py-4 text-xs font-mono">
                  {row.vendorCount}
                </td>
                <td className="px-6 py-4 text-xs font-mono text-emerald-700 font-bold">
                  {money(row.estimatedRevenueGrowth)}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={row.stockAuditRecommended ? "recommended" : "normal"}
                    variant={row.stockAuditRecommended ? "warning" : "neutral"}
                  />
                </td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={row.restockRecommended ? "recommended" : "normal"}
                    variant={row.restockRecommended ? "warning" : "neutral"}
                  />
                </td>
              </tr>
            ))}
          </TablePanel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <DataPanel
              title="Top Growth Sectors"
              subtitle="Sectors with highest product density."
            >
              <div className="p-6 space-y-4">
                {marketInsights.topSectors.length > 0 ? (
                  marketInsights.topSectors.map(([sector, count], index) => (
                    <div
                      key={`${sector}-${index}`}
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <Tag size={14} className="text-brand-orange" />
                        <span className="text-xs font-bold uppercase">
                          {safeString(sector, "Unclassified")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold">
                          {safeNumber(count)} SKUs
                        </span>
                        <ChevronRight
                          size={14}
                          className="text-stone-300 group-hover:text-brand-orange transition-all"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-stone-400">
                    No sector data available.
                  </p>
                )}
              </div>
            </DataPanel>

            <DataPanel
              title="Primary Locations"
              subtitle="Logistics nodes by inventory volume."
            >
              <div className="p-6 space-y-4">
                {marketInsights.topLocations.length > 0 ? (
                  marketInsights.topLocations.map(([loc, count], index) => (
                    <div
                      key={`${loc}-${index}`}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin size={14} className="text-brand-orange" />
                        <span className="text-xs font-bold uppercase">
                          {safeString(loc, "Unknown")}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold">
                        {safeNumber(count)} SKUs
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-stone-400">
                    No location data available.
                  </p>
                )}
              </div>
            </DataPanel>

            <DataPanel
              title="Sector Expansion Opportunities"
              subtitle="Active sectors lacking CAH distribution hubs."
            >
              <div className="p-6 space-y-4">
                {marketInsights.sectorsWithoutCah
                  .slice(0, 5)
                  .map((sector, index) => (
                    <div
                      key={`${sector}-${index}`}
                      className="flex items-center gap-3"
                    >
                      <Globe size={14} className="text-stone-300" />
                      <span className="text-xs font-bold uppercase text-stone-600">
                        {safeString(sector, "Unclassified")}
                      </span>
                      <StatusBadge status="no link" variant="warning" />
                    </div>
                  ))}

                {marketInsights.sectorsWithoutCah.length === 0 && (
                  <p className="text-xs italic text-green-600 flex items-center gap-2">
                    <Zap size={14} fill="currentColor" /> All sectors have
                    active distribution hubs.
                  </p>
                )}

                <div className="pt-4 border-t border-stone-100">
                  {permissionService.canView("accessHub") && (
                    <button
                      className="text-[10px] font-bold uppercase text-brand-orange flex items-center gap-2 hover:gap-3 transition-all"
                      onClick={() => {
                        /* Navigate to CAH Management */
                      }}
                    >
                      Open CAH Registry <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </DataPanel>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <DataPanel
              title="Commercial Risk"
              subtitle="Vendors requiring immediate staff intervention."
            >
              <div className="p-6 space-y-4">
                {marketInsights.overdueSubs.length > 0 ? (
                  marketInsights.overdueSubs.map((vendor, index) => (
                    <div
                      key={getVendorKey(vendor, index)}
                      className="p-4 border-2 border-red-50 bg-red-50/30 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold uppercase">
                          {safeString((vendor as any)?.name, "Unnamed Vendor")}
                        </p>
                        <p className="text-[9px] text-red-600 font-bold uppercase tracking-widest">
                          Subscription Overdue
                        </p>
                      </div>
                      <StatusBadge status="suspended" variant="error" />
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-stone-400 py-4">
                    No critical commercial risks detected.
                  </p>
                )}
              </div>
            </DataPanel>

            <DataPanel
              title="Sector Readiness Matrix"
              subtitle="Top sectors poised for catalogue distribution."
            >
              <div className="p-6 space-y-4">
                {sectorReadiness.slice(0, 5).map((sector) => (
                  <div key={sector.sector} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase">
                        {safeString(sector.sector, "Unclassified")}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          safePercent(sector.readinessScore) >= 70
                            ? "text-green-600"
                            : "text-stone-400"
                        }`}
                      >
                        {safePercent(sector.readinessScore)}/100 Score
                      </span>
                    </div>
                    <div className="w-full h-1 bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          safePercent(sector.readinessScore) >= 70
                            ? "bg-green-500"
                            : "bg-brand-charcoal"
                        }`}
                        style={{
                          width: `${safePercent(sector.readinessScore)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}

                {sectorReadiness.length === 0 && (
                  <p className="text-xs italic text-stone-400">
                    Add vendors to generate sector scores.
                  </p>
                )}
              </div>
            </DataPanel>
          </div>
        </div>
      )}

      {view === "readiness" && (
        <div className="space-y-10">
          <TablePanel
            title="Sector Readiness Scoreboard"
            subtitle="Evaluating sectors based on density, asset coverage, and distribution readiness."
            headers={[
              "Sector",
              "KPI Score",
              "Vendors",
              "Products",
              "Issues",
              "Action",
            ]}
          >
            {sectorReadiness.length > 0 ? (
              sectorReadiness.map((sector) => (
                <tr
                  key={sector.sector}
                  className="hover:bg-stone-50 border-b border-stone-100"
                >
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase">
                        {safeString(sector.sector, "Unclassified")}
                      </span>
                      <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">
                        Market Segment
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 border-4 flex items-center justify-center font-bold text-xs ${
                          safePercent(sector.readinessScore) >= 70
                            ? "border-green-500 text-green-600"
                            : "border-stone-100 text-stone-400"
                        }`}
                      >
                        {safePercent(sector.readinessScore)}
                      </div>
                      <StatusBadge
                        status={sector.isReady ? "ready" : "incomplete"}
                        variant={sector.isReady ? "success" : "neutral"}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center text-xs font-bold font-mono">
                    {safeNumber(sector.vendorCount)}
                  </td>
                  <td className="px-6 py-5 text-center text-xs font-bold font-mono">
                    {safeNumber(sector.productCount)}
                  </td>
                  <td className="px-6 py-5">
                    {normalizeArray<string>(sector.issues).length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {normalizeArray<string>(sector.issues)
                          .slice(0, 2)
                          .map((issue, index) => (
                            <div
                              key={`${issue}-${index}`}
                              className="flex items-center gap-1.5 text-[9px] text-red-500 font-bold uppercase"
                            >
                              <AlertTriangle size={10} /> {issue}
                            </div>
                          ))}
                        {normalizeArray<string>(sector.issues).length > 2 && (
                          <span className="text-[8px] text-stone-400 font-bold italic">
                            +{normalizeArray<string>(sector.issues).length - 2}{" "}
                            more...
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[9px] text-green-500 font-bold uppercase">
                        <Zap size={10} fill="currentColor" /> Optimization Meta
                        Ready
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <button className="btn btn-secondary px-4 py-2 text-[10px] w-full">
                      Generate Report
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-xs text-stone-400 italic"
                >
                  No sector data found.
                </td>
              </tr>
            )}
          </TablePanel>

          <TablePanel
            title="Vendor Readiness Scoring"
            subtitle="Top 20 vendors by catalogue/storefront readiness."
            headers={[
              "Vendor",
              "Total Score",
              "Level",
              "Primary Issues",
              "Top Recommendation",
              "Task Status",
            ]}
          >
            {vendorReadiness.length > 0 ? (
              vendorReadiness.slice(0, 20).map((vendor, index) => {
                const issues = normalizeArray<string>(vendor.missingItems);
                const recommendations = normalizeArray<string>(
                  vendor.recommendedActions,
                );
                const vendorName = safeString(vendor.vendorName, "Unnamed Vendor");
                const task = safeStaffTasks.find(
                  (item) =>
                    item.taskType === "vendor_readiness" &&
                    item.vendorId === vendor.vendorId &&
                    !["completed", "reviewed", "cancelled"].includes(item.status),
                );

                return (
                  <tr
                    key={vendor.vendorId || `vendor-readiness-${index}`}
                    className="hover:bg-stone-50 border-b border-stone-100"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-stone-100 flex items-center justify-center font-bold text-xs text-stone-400">
                          {vendorName.charAt(0)}
                        </div>
                        <span className="text-xs font-bold uppercase">
                          {vendorName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-bold tracking-tighter">
                          {safePercent(vendor.score)}
                        </div>
                        <div className="w-24 h-1 bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-brand-orange"
                            style={{ width: `${safePercent(vendor.score)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge
                        status={vendor.level}
                        variant={
                          vendor.level === "Ready"
                            ? "success"
                            : vendor.level === "Needs Attention"
                              ? "warning"
                              : "error"
                        }
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {issues.slice(0, 2).map((issue, issueIndex) => (
                          <span
                            key={`${issue}-${issueIndex}`}
                            className="px-1.5 py-0.5 bg-stone-100 text-stone-500 text-[8px] font-bold uppercase"
                          >
                            {issue}
                          </span>
                        ))}
                        {issues.length === 0 && (
                          <span className="text-green-500 text-[9px] font-bold uppercase italic">
                            Data Certified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {recommendations.length > 0 ? (
                        <div className="flex items-start gap-2 text-[10px] text-stone-600 font-medium">
                          <Lightbulb
                            size={12}
                            className="text-brand-orange shrink-0 mt-0.5"
                          />
                          <span>{recommendations[0]}</span>
                        </div>
                      ) : (
                        <span className="text-stone-300 text-[9px] uppercase font-bold italic">
                          No pending actions
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge
                        status={task ? task.status : "no open task"}
                        variant={task ? "warning" : "neutral"}
                      />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-xs text-stone-400 italic"
                >
                  No vendor data found.
                </td>
              </tr>
            )}
          </TablePanel>

          <TablePanel
            title="Vendor Readiness Tasks"
            subtitle="Low readiness vendors, open task status, assigned desk and latest task date."
            headers={[
              "Vendor",
              "Score",
              "Missing Items",
              "Task Status",
              "Assigned Desk",
              "Last Task Date",
            ]}
          >
            {readinessTaskRows.map((row) => (
              <tr key={row.vendorId} className="border-b border-stone-100">
                <td className="px-6 py-4 text-xs font-black uppercase">
                  {row.vendorName}
                </td>
                <td className="px-6 py-4 text-xs font-mono">{row.score}</td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase">
                  {row.missingItems.slice(0, 4).join(", ") || "N/A"}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge
                    status={row.task?.status || "not created"}
                    variant={row.task ? "warning" : "neutral"}
                  />
                </td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase">
                  {row.task?.assignedDesk || "Backoffice / Vendor Quality Control"}
                </td>
                <td className="px-6 py-4 text-[10px] font-mono">
                  {row.task?.createdAt
                    ? new Date(row.task.createdAt).toLocaleDateString()
                    : "N/A"}
                </td>
              </tr>
            ))}
            {readinessTaskRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-xs text-stone-400 italic"
                >
                  No vendors are below the current readiness threshold.
                </td>
              </tr>
            )}
          </TablePanel>
        </div>
      )}

      {view === "audit" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AuditMetric
              label="Price Missing"
              value={marketInsights.missingPrice.length}
              icon={<DollarSign size={20} />}
              variant="error"
            />
            <AuditMetric
              label="Image Missing"
              value={marketInsights.missingImage.length}
              icon={<ImageIcon size={20} />}
              variant="error"
            />
            <AuditMetric
              label="Hidden (In Stock)"
              value={marketInsights.hiddenAvailable.length}
              icon={<Target size={20} />}
              variant="warning"
            />
            <AuditMetric
              label="Out of Stock (Live)"
              value={marketInsights.stockOutPublished.length}
              icon={<Package size={20} />}
              variant="warning"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DataPanel
              title="Data Enrichment Queue"
              subtitle="Vendors with poor image coverage requiring RPN follow-up."
            >
              <div className="p-6 divide-y divide-stone-100">
                {marketInsights.vendorsWithPoorImages.length > 0 ? (
                  marketInsights.vendorsWithPoorImages.map((vendor, index) => (
                    <div
                      key={getVendorKey(vendor, index)}
                      className="py-4 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-50 border border-orange-200 flex items-center justify-center text-brand-orange">
                          <ImageIcon size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase">
                            {safeString(
                              (vendor as any)?.name,
                              "Unnamed Vendor",
                            )}
                          </p>
                          <p className="text-[9px] text-stone-400 font-bold tracking-widest uppercase">
                            Coverage Factor: &lt;50%
                          </p>
                        </div>
                      </div>
                      <button className="p-2 text-stone-300 hover:text-brand-orange hover:bg-stone-50 transition-all border border-stone-100 group-hover:border-brand-orange">
                        <Zap size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-stone-400 py-8 text-center">
                    No enrichment required.
                  </p>
                )}
              </div>
            </DataPanel>

            <DataPanel
              title="Quality Recommendations"
              subtitle="Automated system interventions for backend staff."
            >
              <div className="p-8 space-y-6">
                <Recommendation
                  title="Catalogue Segmentation"
                  desc="Multiple sectors are approaching high asset density. Recommend monitored splitting if catalogues exceed 15MB."
                  icon={<Layers size={18} />}
                />
                <Recommendation
                  title="Audit Required"
                  desc={`${marketInsights.missingPrice.length} products have base prices of zero. These must be updated before next sector rollout.`}
                  icon={<DollarSign size={18} />}
                />
                <Recommendation
                  title="RPN Imbalance"
                  desc="Detection of territory nodes with high vendor volume but no active RPN assignments."
                  icon={<MapPin size={18} />}
                />
              </div>
            </DataPanel>
          </div>
        </div>
      )}
    </div>
  );
};

const AuditMetric: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  variant: "error" | "warning";
}> = ({ label, value, icon, variant }) => (
  <div
    className={`p-6 border-b-4 bg-white shadow-sm ${
      variant === "error" ? "border-red-500" : "border-brand-orange"
    }`}
  >
    <div
      className={`mb-4 ${
        variant === "error" ? "text-red-500" : "text-brand-orange"
      }`}
    >
      {icon}
    </div>
    <div className="text-2xl font-bold tracking-tighter mb-1">
      {safeNumber(value).toLocaleString()}
    </div>
    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 leading-tight">
      {label}
    </div>
  </div>
);

const Recommendation: React.FC<{
  title: string;
  desc: string;
  icon: React.ReactNode;
}> = ({ title, desc, icon }) => (
  <div className="flex gap-4 group">
    <div className="w-10 h-10 shrink-0 bg-stone-900 text-white flex items-center justify-center transform group-hover:rotate-12 transition-transform">
      {icon}
    </div>
    <div className="space-y-1">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">
        {title}
      </h4>
      <p className="text-xs italic text-stone-600 leading-relaxed">{desc}</p>
    </div>
  </div>
);
