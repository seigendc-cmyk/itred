/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import {
  analyticsService,
  AnalyticsFilters,
  ConsoleAnalyticsResult,
} from "./analyticsService.ts";
import { getStorageAdapter } from "./storageService.ts";
import { permissionService } from "./permissionService.ts";

export type AiReportType =
  | "vendor_advisory"
  | "product_trends"
  | "sector_demand"
  | "location_behaviour"
  | "rpn_performance"
  | "management_weekly";

export interface AiReportOutput {
  id: string;
  reportType: AiReportType;
  title: string;
  period: string;
  filters: AnalyticsFilters;
  narrative: string;
  actionPlan: string[];
  analyticsSnapshot: ConsoleAnalyticsResult;
  generatedByStaffId?: string;
  generatedByStaffName?: string;
  generatedAt: string;
  model: string;
  status: "generated" | "not_enough_data" | "failed";
}

const OUTPUTS_KEY = "ai_report_outputs";
const MODEL = "gemini-2.5-flash";

const reportTitles: Record<AiReportType, string> = {
  vendor_advisory: "Vendor Advisory Report",
  product_trends: "Product Trends Report",
  sector_demand: "Sector Demand Report",
  location_behaviour: "Location Behaviour Report",
  rpn_performance: "RPN Performance Report",
  management_weekly: "Management Weekly Report",
};

const parseSession = () => {
  try {
    const raw = localStorage.getItem("activeStaffSession");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const assertConsoleAccess = () => {
  if (
    permissionService.isSysAdmin() ||
    permissionService.hasMenuAccess("biMarketAnalytics") ||
    permissionService.hasMenuAccess("analytics") ||
    permissionService.hasMenuAccess("rpnPerformance")
  ) {
    return;
  }
  throw new Error("AI reports are restricted to console/admin users.");
};

const enoughData = (analytics: ConsoleAnalyticsResult) =>
  !analytics.empty &&
  Object.values(analytics.totals).reduce((sum, value) => sum + value, 0) > 0;

const compactRows = (rows: Array<{ label: string; totalSignals: number }>) =>
  rows.slice(0, 8).map((row) => ({
    label: row.label,
    totalSignals: row.totalSignals,
  }));

const analyticsForPrompt = (analytics: ConsoleAnalyticsResult) => ({
  period: analytics.filters,
  totals: analytics.totals,
  topVendors: compactRows(analytics.byVendor),
  topProducts: compactRows(analytics.byProduct),
  topSectors: compactRows(analytics.bySector),
  topCities: compactRows(analytics.byCity),
  topSuburbs: compactRows(analytics.bySuburb),
  topCountries: compactRows(analytics.byCountry),
  periodTrend: analytics.byPeriod.slice(0, 30),
  sourceCounts: analytics.sourceCounts,
});

const fallbackNarrative = (analytics: ConsoleAnalyticsResult) => {
  if (!enoughData(analytics)) return "Not enough data";
  const total =
    analytics.totals.catalogueViews +
    analytics.totals.productClicks +
    analytics.totals.whatsappEnquiries +
    analytics.totals.vendorOrders +
    analytics.totals.subscriptions +
    analytics.totals.rpnAssignments;
  return `The selected period recorded ${total} measured signals. Catalogue views totalled ${analytics.totals.catalogueViews}, product clicks ${analytics.totals.productClicks}, WhatsApp enquiries ${analytics.totals.whatsappEnquiries}, vendor orders ${analytics.totals.vendorOrders}, subscriptions ${analytics.totals.subscriptions}, and RPN assignments ${analytics.totals.rpnAssignments}.`;
};

const fallbackActions = (analytics: ConsoleAnalyticsResult): string[] => {
  if (!enoughData(analytics)) return ["Not enough data"];
  const topVendor = analytics.byVendor[0]?.label || "the leading vendor";
  const topProduct = analytics.byProduct[0]?.label || "the leading product";
  return [
    `Review fulfilment readiness for ${topVendor}.`,
    `Confirm stock and pricing accuracy for ${topProduct}.`,
    "Prioritise follow-up on WhatsApp enquiries before promoting more traffic.",
  ];
};

const buildPrompt = (reportType: AiReportType, analytics: ConsoleAnalyticsResult) => `
You are writing an iTredVD Console BI report for seiGEN Commerce.

Rules:
- Explain only the analytics JSON supplied below.
- Do not invent, estimate, infer, or add numbers that are not in the JSON.
- If the JSON has no meaningful data, reply with narrative exactly: Not enough data
- Keep the tone professional and operational.
- Return strict JSON with keys: narrative (string), actionPlan (array of strings).

Report type: ${reportType}
Analytics JSON:
${JSON.stringify(analyticsForPrompt(analytics))}
`;

const saveOutput = async (output: AiReportOutput) => {
  const storage = getStorageAdapter();
  if (storage.batchSetItems) {
    await storage.batchSetItems(OUTPUTS_KEY, [output]);
    return;
  }
  const existing = await storage.getItem<AiReportOutput[]>(OUTPUTS_KEY);
  await storage.setItem(OUTPUTS_KEY, [output, ...((existing as AiReportOutput[]) || [])]);
};

export const aiReportService = {
  async generateReport(
    reportType: AiReportType,
    filters?: Partial<AnalyticsFilters> | null,
  ): Promise<AiReportOutput> {
    assertConsoleAccess();
    const analytics = await analyticsService.getConsoleAnalytics(filters);
    const session = parseSession();
    const id = `AIR-${Date.now()}`;
    const period = `${analytics.filters.dateFrom} to ${analytics.filters.dateTo}`;

    let narrative = "Not enough data";
    let actionPlan = ["Not enough data"];
    let status: AiReportOutput["status"] = "not_enough_data";

    if (enoughData(analytics)) {
      try {
        const apiKey =
          import.meta.env.VITE_GEMINI_API_KEY ||
          import.meta.env.VITE_GOOGLE_GENAI_API_KEY ||
          import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Missing Gemini API key");

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: buildPrompt(reportType, analytics),
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });
        const raw = response.text || "";
        const parsed = JSON.parse(raw);
        narrative =
          typeof parsed.narrative === "string" && parsed.narrative.trim()
            ? parsed.narrative.trim()
            : fallbackNarrative(analytics);
        actionPlan = Array.isArray(parsed.actionPlan)
          ? parsed.actionPlan.map(String).filter(Boolean).slice(0, 8)
          : fallbackActions(analytics);
        status = narrative === "Not enough data" ? "not_enough_data" : "generated";
      } catch (error) {
        console.warn("Gemini report generation failed; using deterministic report.", error);
        narrative = fallbackNarrative(analytics);
        actionPlan = fallbackActions(analytics);
        status = narrative === "Not enough data" ? "not_enough_data" : "failed";
      }
    }

    const output: AiReportOutput = {
      id,
      reportType,
      title: reportTitles[reportType],
      period,
      filters: analytics.filters,
      narrative,
      actionPlan,
      analyticsSnapshot: analytics,
      generatedByStaffId: session.staffId || session.id,
      generatedByStaffName: session.staffName || session.displayName,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      status,
    };
    await saveOutput(output);
    return output;
  },

  async getOutputs(): Promise<AiReportOutput[]> {
    assertConsoleAccess();
    const data = await getStorageAdapter().getItem<AiReportOutput[]>(OUTPUTS_KEY);
    return Array.isArray(data) ? data : [];
  },
};
