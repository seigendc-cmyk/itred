/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bot,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import {
  analyticsService,
  AnalyticsFilters,
  AnalyticsMetricRow,
  ConsoleAnalyticsResult,
  normalizeAnalyticsFilters,
} from "../../services/analyticsService.ts";
import {
  aiReportService,
  AiReportOutput,
  AiReportType,
} from "../../services/aiReportService.ts";
import { pdfReportService } from "../../services/pdfReportService.ts";
import { EmptyState, StatusBadge } from "../../components/CommonUI.tsx";
import { permissionService } from "../../services/permissionService.ts";

type Focus = "overview" | "ai" | "products" | "vendors" | "rpn";

interface BiConsolePageProps {
  title: string;
  subtitle: string;
  focus: Focus;
  defaultReportType: AiReportType;
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const initialFilters: AnalyticsFilters = {
  dateFrom: daysAgo(30),
  dateTo: today(),
  period: "day",
};

const reportOptions: Array<{ value: AiReportType; label: string }> = [
  { value: "vendor_advisory", label: "Vendor Advisory" },
  { value: "product_trends", label: "Product Trends" },
  { value: "sector_demand", label: "Sector Demand" },
  { value: "location_behaviour", label: "Location Behaviour" },
  { value: "rpn_performance", label: "RPN Performance" },
  { value: "management_weekly", label: "Management Weekly" },
];

const metricCards = [
  ["Catalogue Views", "catalogueViews"],
  ["Product Clicks", "productClicks"],
  ["WhatsApp Enquiries", "whatsappEnquiries"],
  ["Vendor Orders", "vendorOrders"],
  ["Subscriptions", "subscriptions"],
  ["RPN Assignments", "rpnAssignments"],
] as const;

const isConsoleAllowed = () =>
  permissionService.isSysAdmin() ||
  permissionService.hasMenuAccess("analytics") ||
  permissionService.hasMenuAccess("biMarketAnalytics") ||
  permissionService.hasMenuAccess("rpnPerformance");

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-[9px] font-black uppercase tracking-widest text-stone-500">
    {children}
  </label>
);

const MetricCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="border border-stone-200 bg-white p-4 shadow-sm">
    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">
      {label}
    </p>
    <p className="mt-2 font-mono text-2xl font-black text-brand-charcoal">
      {value.toLocaleString()}
    </p>
  </div>
);

const TableBlock: React.FC<{ title: string; rows: AnalyticsMetricRow[] }> = ({
  title,
  rows,
}) => (
  <div className="border border-stone-200 bg-white shadow-sm">
    <div className="border-b border-stone-200 px-4 py-3">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-charcoal">
        {title}
      </h3>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-left">
        <thead className="bg-stone-50 text-[9px] uppercase tracking-widest text-stone-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3 text-right">Views</th>
            <th className="px-4 py-3 text-right">Clicks</th>
            <th className="px-4 py-3 text-right">WA</th>
            <th className="px-4 py-3 text-right">Orders</th>
            <th className="px-4 py-3 text-right">Subs</th>
            <th className="px-4 py-3 text-right">RPN</th>
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.slice(0, 12).map((row) => (
              <tr key={row.key} className="border-t border-stone-100 text-xs">
                <td className="px-4 py-3 font-bold uppercase text-brand-charcoal">
                  {row.label}
                </td>
                <td className="px-4 py-3 text-right font-mono">{row.catalogueViews}</td>
                <td className="px-4 py-3 text-right font-mono">{row.productClicks}</td>
                <td className="px-4 py-3 text-right font-mono">{row.whatsappEnquiries}</td>
                <td className="px-4 py-3 text-right font-mono">{row.vendorOrders}</td>
                <td className="px-4 py-3 text-right font-mono">{row.subscriptions}</td>
                <td className="px-4 py-3 text-right font-mono">{row.rpnAssignments}</td>
                <td className="px-4 py-3 text-right font-mono font-black">
                  {row.totalSignals}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-xs italic text-stone-400">
                No rows found for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const ChartPanel: React.FC<{ analytics: ConsoleAnalyticsResult; focus: Focus }> = ({
  analytics,
  focus,
}) => {
  const rows =
    focus === "products"
      ? analytics.byProduct
      : focus === "vendors"
        ? analytics.byVendor
        : focus === "rpn"
          ? analytics.byVendor.filter((row) => row.rpnAssignments > 0)
          : analytics.bySector;
  const barData = rows.slice(0, 8).map((row) => ({
    name: row.label,
    total: row.totalSignals,
  }));
  const periodData = analytics.byPeriod.map((row) => ({
    name: row.label,
    total: row.totalSignals,
    enquiries: row.whatsappEnquiries,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest">
          Signal Trend
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={periodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#ff6b00" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="enquiries" stroke="#2e2e2e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest">
          Top Signal Sources
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#ff6b00" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export const BiConsolePage: React.FC<BiConsolePageProps> = ({
  title,
  subtitle,
  focus,
  defaultReportType,
}) => {
  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [analytics, setAnalytics] = useState<ConsoleAnalyticsResult | null>(null);
  const [reportType, setReportType] = useState<AiReportType>(defaultReportType);
  const [report, setReport] = useState<AiReportOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const normalizedFilters = useMemo(() => normalizeAnalyticsFilters(filters), [filters]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await analyticsService.getConsoleAnalytics(filters);
      setAnalytics(next);
    } catch (err) {
      console.error("Failed to load BI console analytics", err);
      setError("BI analytics could not be loaded. Check Firestore access and collection availability.");
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError("");
    try {
      const next = await aiReportService.generateReport(reportType, filters);
      setReport(next);
    } catch (err) {
      console.error("Failed to generate AI report", err);
      setError(
        err instanceof Error
          ? err.message
          : "AI report generation failed for this console session.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = () => {
    if (report) {
      pdfReportService.exportAiReport(report);
      return;
    }
    if (!analytics) return;
    pdfReportService.exportReport({
      title,
      period: `${normalizedFilters.dateFrom} to ${normalizedFilters.dateTo}`,
      filters: { ...normalizedFilters },
      analytics,
      aiNarrative: "Not enough data",
      actionPlan: ["Generate an AI report to include narrative actions."],
    });
  };

  if (!isConsoleAllowed()) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Console Access Required"
        description="BI and AI reports are restricted to console/admin users."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-l-4 border-brand-orange bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
            iTredVD Console
          </p>
          <h1 className="mt-1 text-lg font-black uppercase tracking-tight text-brand-charcoal">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-xs font-medium text-stone-500">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadAnalytics}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCcw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="btn-secondary flex items-center gap-2"
            disabled={!analytics}
          >
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-1">
          <FieldLabel>Date From</FieldLabel>
          <input
            type="date"
            value={filters.dateFrom || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            className="w-full border border-stone-200 px-3 py-2 text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Date To</FieldLabel>
          <input
            type="date"
            value={filters.dateTo || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            className="w-full border border-stone-200 px-3 py-2 text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Period</FieldLabel>
          <select
            value={filters.period || "day"}
            onChange={(e) => setFilters((prev) => ({ ...prev, period: e.target.value as any }))}
            className="w-full border border-stone-200 px-3 py-2 text-xs font-bold"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <div className="space-y-1">
          <FieldLabel>Sector</FieldLabel>
          <input
            value={filters.sector || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, sector: e.target.value || undefined }))}
            placeholder="All sectors"
            className="w-full border border-stone-200 px-3 py-2 text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>City</FieldLabel>
          <input
            value={filters.city || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value || undefined }))}
            placeholder="All cities"
            className="w-full border border-stone-200 px-3 py-2 text-xs font-bold"
          />
        </div>
        <div className="flex items-end">
          <button type="button" onClick={loadAnalytics} className="btn-primary w-full">
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex min-h-[320px] items-center justify-center border border-stone-200 bg-white">
          <Loader2 className="mr-2 animate-spin text-brand-orange" size={20} />
          <span className="text-xs font-black uppercase tracking-widest text-stone-500">
            Loading Analytics
          </span>
        </div>
      )}

      {!loading && analytics && analytics.empty && (
        <EmptyState
          icon={FileText}
          title="No BI Signals Found"
          description="No catalogue, product, WhatsApp, order, subscription, or RPN assignment activity was found for the selected filters."
        />
      )}

      {!loading && analytics && !analytics.empty && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {metricCards.map(([label, key]) => (
              <MetricCard key={key} label={label} value={analytics.totals[key]} />
            ))}
          </div>

          <ChartPanel analytics={analytics} focus={focus} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {(focus === "overview" || focus === "vendors" || focus === "ai") && (
              <TableBlock title="Vendor Signal Ranking" rows={analytics.byVendor} />
            )}
            {(focus === "overview" || focus === "products" || focus === "ai") && (
              <TableBlock title="Product Trend Ranking" rows={analytics.byProduct} />
            )}
            {(focus === "overview" || focus === "ai") && (
              <TableBlock title="Sector Demand Ranking" rows={analytics.bySector} />
            )}
            {(focus === "overview" || focus === "rpn") && (
              <TableBlock
                title="RPN Assignment Signals"
                rows={analytics.byVendor.filter((row) => row.rpnAssignments > 0)}
              />
            )}
            {(focus === "overview" || focus === "ai") && (
              <TableBlock title="City Behaviour Ranking" rows={analytics.byCity} />
            )}
          </div>

          <div className="border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-charcoal">
                  AI Report Generator
                </h3>
                <p className="mt-1 text-xs font-medium text-stone-500">
                  Gemini explains the calculated analytics only. Missing data returns Not enough data.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as AiReportType)}
                  className="border border-stone-200 px-3 py-2 text-xs font-bold"
                >
                  {reportOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  Generate
                </button>
              </div>
            </div>
            <div className="mt-4 border-t border-stone-100 pt-4">
              {report ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={report.status}
                      variant={report.status === "generated" ? "success" : "warning"}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                      {report.period}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-brand-charcoal">
                    {report.narrative}
                  </p>
                  <ol className="list-decimal space-y-1 pl-5 text-xs font-bold text-stone-600">
                    {report.actionPlan.map((action, index) => (
                      <li key={`${action}-${index}`}>{action}</li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="text-xs italic text-stone-400">
                  No AI report generated in this session yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
