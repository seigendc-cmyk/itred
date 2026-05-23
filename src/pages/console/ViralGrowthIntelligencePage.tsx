/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
  ClipboardCopy,
  Loader2,
  Megaphone,
  RefreshCcw,
  Save,
  Share2,
  TrendingUp,
} from "lucide-react";
import { EmptyState, PrimaryButton, SecondaryButton } from "../../components/CommonUI.tsx";
import { permissionService } from "../../services/permissionService.ts";
import {
  ViralGrowthFilters,
  ViralGrowthIntelligenceReport,
  ViralGrowthRankRow,
  viralGrowthIntelligenceService,
} from "../../services/viralGrowthIntelligenceService.ts";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const initialFilters: ViralGrowthFilters = {
  dateFrom: daysAgo(7),
  dateTo: today(),
};

const isConsoleAllowed = () =>
  permissionService.isSysAdmin() ||
  permissionService.hasMenuAccess("biMarketAnalytics") ||
  permissionService.hasMenuAccess("analytics") ||
  permissionService.hasMenuAccess("rpnPerformance");

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-[9px] font-black uppercase tracking-widest text-stone-500">
    {children}
  </label>
);

const MetricCard: React.FC<{
  label: string;
  value: number;
  hint?: string;
}> = ({ label, value, hint }) => (
  <div className="border border-stone-200 bg-white p-4 shadow-sm">
    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">
      {label}
    </p>
    <p className="mt-2 font-mono text-2xl font-black text-brand-charcoal">
      {value.toLocaleString()}
    </p>
    {hint && <p className="mt-1 text-[10px] font-bold uppercase text-stone-400">{hint}</p>}
  </div>
);

const RankTable: React.FC<{ title: string; rows: ViralGrowthRankRow[] }> = ({
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
            <th className="px-4 py-3 text-right">Shares</th>
            <th className="px-4 py-3 text-right">Demand</th>
            <th className="px-4 py-3 text-right">Proof</th>
            <th className="px-4 py-3 text-right">RPN</th>
            <th className="px-4 py-3 text-right">Momentum</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.slice(0, 10).map((row) => (
              <tr key={row.key} className="border-t border-stone-100 text-xs">
                <td className="px-4 py-3">
                  <p className="font-black uppercase text-brand-charcoal">{row.label}</p>
                  <p className="text-[10px] uppercase text-stone-400">
                    {[row.sector, row.city].filter(Boolean).join(" / ") || "SCI iTred"}
                  </p>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.catalogueShares + row.customerShares}
                </td>
                <td className="px-4 py-3 text-right font-mono">{row.demandSignals}</td>
                <td className="px-4 py-3 text-right font-mono">{row.proofSignals}</td>
                <td className="px-4 py-3 text-right font-mono">{row.rpnImpact}</td>
                <td className="px-4 py-3 text-right font-mono font-black">
                  {row.momentumScore}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-xs italic text-stone-400">
                No viral growth rows found for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const CopyBlock: React.FC<{ title: string; rows: string[] }> = ({ title, rows }) => {
  const text = rows.join("\n");
  return (
    <div className="border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-charcoal">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(text)}
          className="border border-stone-200 p-2 text-stone-500 hover:bg-stone-50"
          title="Copy"
        >
          <ClipboardCopy size={15} />
        </button>
      </div>
      <div className="space-y-3 p-4">
        {rows.map((row, index) => (
          <p key={`${title}-${index}`} className="text-sm font-semibold text-stone-700">
            {row}
          </p>
        ))}
      </div>
    </div>
  );
};

export const ViralGrowthIntelligencePage: React.FC = () => {
  const [filters, setFilters] = useState<ViralGrowthFilters>(initialFilters);
  const [report, setReport] = useState<ViralGrowthIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");

  const normalizedFilters = useMemo(
    () => viralGrowthIntelligenceService.normalizeFilters(filters),
    [filters],
  );

  const loadReport = async () => {
    setLoading(true);
    setError("");
    setSavedAt("");
    try {
      const next = await viralGrowthIntelligenceService.getReport(filters);
      setReport(next);
    } catch (err) {
      console.error("Failed to load viral growth intelligence", err);
      setError("Viral Growth Intelligence could not be loaded. Check console access and BI data sources.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, []);

  const handleStoreOutput = async () => {
    if (!report) return;
    setSaving(true);
    setError("");
    try {
      const output = await viralGrowthIntelligenceService.storeOutput(report);
      setSavedAt(output.generatedAt);
    } catch (err) {
      console.error("Failed to store viral growth output", err);
      setError("The viral growth output could not be stored.");
    } finally {
      setSaving(false);
    }
  };

  if (!isConsoleAllowed()) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Restricted Intelligence"
        description="Viral Growth Intelligence is available only inside the SCI iTred console."
      />
    );
  }

  const sectorChart =
    report?.bySector.slice(0, 8).map((row) => ({
      name: row.label,
      momentum: row.momentumScore,
      shares: row.catalogueShares + row.customerShares,
      demand: row.demandSignals,
    })) || [];
  const cityChart =
    report?.byCity.slice(0, 8).map((row) => ({
      name: row.label,
      momentum: row.momentumScore,
    })) || [];

  return (
    <div className="space-y-6">
      <div className="border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-brand-orange">
              <Share2 size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                SCI iTred Growth Movement
              </span>
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-charcoal">
              Viral Growth Intelligence
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-stone-500">
              Tracks referrals, catalogue sharing, missing product demand, vendor proof,
              WhatsApp group growth, post performance, customer sharing, RPN impact, response
              quality, and sector momentum.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={loadReport} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              Refresh
            </SecondaryButton>
            <PrimaryButton onClick={handleStoreOutput} disabled={!report || loading || saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Outputs
            </PrimaryButton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <div>
          <FieldLabel>Date From</FieldLabel>
          <input
            type="date"
            value={normalizedFilters.dateFrom}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
          />
        </div>
        <div>
          <FieldLabel>Date To</FieldLabel>
          <input
            type="date"
            value={normalizedFilters.dateTo}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
          />
        </div>
        <div>
          <FieldLabel>Sector</FieldLabel>
          <input
            value={filters.sector || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, sector: e.target.value || undefined }))}
            placeholder="All sectors"
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
          />
        </div>
        <div>
          <FieldLabel>City</FieldLabel>
          <input
            value={filters.city || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value || undefined }))}
            placeholder="All cities"
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
          />
        </div>
        <div className="flex items-end">
          <PrimaryButton onClick={loadReport} disabled={loading}>
            Apply Filters
          </PrimaryButton>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} />
          <div>
            <p className="font-black uppercase">Load Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {savedAt && (
        <div className="border border-green-200 bg-green-50 p-3 text-xs font-black uppercase tracking-widest text-green-700">
          Viral growth outputs stored at {new Date(savedAt).toLocaleString()}.
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center border border-stone-200 bg-white">
          <Loader2 className="mr-3 animate-spin text-brand-orange" size={28} />
          <span className="text-xs font-black uppercase tracking-widest text-stone-500">
            Loading viral growth intelligence
          </span>
        </div>
      ) : !report || report.empty ? (
        <EmptyState
          icon={Megaphone}
          title="No Viral Growth Signals"
          description="No referrals, shares, demand, proof, or WhatsApp growth signals were found for this period."
          action={<SecondaryButton onClick={loadReport}>Retry</SecondaryButton>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard label="Referrals" value={report.totals.referrals} />
            <MetricCard label="Catalogue Shares" value={report.totals.catalogueShares} />
            <MetricCard label="Missing Demand" value={report.totals.missingProductDemand} />
            <MetricCard label="Group Growth" value={report.totals.whatsappGroupGrowth} />
            <MetricCard label="Sector Momentum" value={report.totals.sectorMomentum} />
            <MetricCard label="Vendor Proof" value={report.totals.vendorProofSignals} />
            <MetricCard label="Post Performance" value={report.totals.postPerformance} />
            <MetricCard label="Customer Shares" value={report.totals.customerShares} />
            <MetricCard label="RPN Viral Impact" value={report.totals.rpnViralImpact} />
            <MetricCard
              label="Response Quality"
              value={report.totals.vendorResponseQuality}
              hint="weighted score"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="border border-stone-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest">
                Sector Movement
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="momentum" fill="#ff6b00" />
                    <Bar dataKey="shares" fill="#2e2e2e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="border border-stone-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest">
                Location Momentum
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cityChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="momentum" stroke="#ff6b00" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CopyBlock title="Weekly Proof Posts" rows={report.proofPosts} />
            <CopyBlock title="Customer Trending Updates" rows={report.customerTrendingUpdates} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RankTable title="Vendor Advisory Reports" rows={report.vendorAdvisoryReports} />
            <RankTable title="RPN Performance Reports" rows={report.rpnPerformanceReports} />
            <RankTable title="Missing Product Demand" rows={report.missingDemand} />
            <RankTable title="WhatsApp Group Growth" rows={report.byWhatsAppGroup} />
          </div>

          <div className="border border-stone-200 bg-white p-4 text-[10px] font-black uppercase tracking-widest text-stone-500 shadow-sm">
            Sources: {report.sourceCounts.activityEvents} activity events /{" "}
            {report.sourceCounts.whatsappLogs} WhatsApp logs /{" "}
            {report.sourceCounts.intelligenceLogs} intelligence logs /{" "}
            {report.sourceCounts.whatsappGroups} active groups
          </div>
        </>
      )}
    </div>
  );
};
