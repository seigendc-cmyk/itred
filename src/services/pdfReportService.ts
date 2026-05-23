/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ConsoleAnalyticsResult, AnalyticsMetricRow } from "./analyticsService.ts";
import { AiReportOutput } from "./aiReportService.ts";

export interface PdfReportInput {
  title: string;
  period: string;
  filters: Record<string, unknown>;
  analytics: ConsoleAnalyticsResult;
  aiNarrative?: string;
  actionPlan?: string[];
}

const finalY = (doc: jsPDF, fallback: number) =>
  (doc as any).lastAutoTable?.finalY ?? fallback;

const filterLines = (filters: Record<string, unknown>) =>
  Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`);

const metricRows = (rows: AnalyticsMetricRow[]) =>
  rows.slice(0, 12).map((row) => [
    row.label,
    row.catalogueViews,
    row.productClicks,
    row.whatsappEnquiries,
    row.vendorOrders,
    row.subscriptions,
    row.rpnAssignments,
    row.totalSignals,
  ]);

export const pdfReportService = {
  exportReport(input: PdfReportInput): void {
    const doc = new jsPDF();

    doc.setFillColor(46, 46, 46);
    doc.rect(0, 0, 210, 35, "F");
    doc.setFillColor(255, 107, 0);
    doc.rect(0, 35, 210, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("seiGEN Commerce / iTred", 14, 16);
    doc.setFontSize(9);
    doc.text("iTredVD Console BI + AI Reports", 14, 25);

    doc.setTextColor(46, 46, 46);
    doc.setFontSize(15);
    doc.text(input.title, 14, 50);
    doc.setFontSize(9);
    doc.text(`Period: ${input.period}`, 14, 58);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 64);

    const filters = filterLines(input.filters);
    if (filters.length > 0) {
      autoTable(doc, {
        startY: 72,
        head: [["Filters"]],
        body: filters.map((line) => [line]),
        theme: "grid",
        headStyles: { fillColor: [46, 46, 46] },
        styles: { fontSize: 8, cellPadding: 2 },
      });
    }

    autoTable(doc, {
      startY: finalY(doc, 72) + 8,
      head: [["Metric", "Value"]],
      body: [
        ["Catalogue Views", input.analytics.totals.catalogueViews],
        ["Product Clicks", input.analytics.totals.productClicks],
        ["WhatsApp Enquiries", input.analytics.totals.whatsappEnquiries],
        ["Vendor Orders", input.analytics.totals.vendorOrders],
        ["Subscriptions", input.analytics.totals.subscriptions],
        ["RPN Assignments", input.analytics.totals.rpnAssignments],
      ],
      theme: "striped",
      headStyles: { fillColor: [46, 46, 46] },
      alternateRowStyles: { fillColor: [246, 246, 246] },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    const sections: Array<[string, AnalyticsMetricRow[]]> = [
      ["Top Vendors", input.analytics.byVendor],
      ["Top Products", input.analytics.byProduct],
      ["Top Sectors", input.analytics.bySector],
      ["Top Cities", input.analytics.byCity],
      ["Period Trend", input.analytics.byPeriod],
    ];

    sections.forEach(([title, rows]) => {
      if (rows.length === 0) return;
      autoTable(doc, {
        startY: finalY(doc, 90) + 8,
        head: [[title, "Views", "Clicks", "WA", "Orders", "Subs", "RPN", "Total"]],
        body: metricRows(rows),
        theme: "striped",
        headStyles: { fillColor: [255, 107, 0] },
        styles: { fontSize: 7, cellPadding: 2 },
      });
    });

    let y = finalY(doc, 120) + 10;
    if (y > 245) {
      doc.addPage();
      y = 18;
    }

    doc.setFontSize(12);
    doc.setTextColor(46, 46, 46);
    doc.text("AI Narrative", 14, y);
    doc.setFontSize(9);
    const narrative = input.aiNarrative || "Not enough data";
    doc.text(doc.splitTextToSize(narrative, 180), 14, y + 8);

    y += 8 + doc.splitTextToSize(narrative, 180).length * 5 + 8;
    if (y > 245) {
      doc.addPage();
      y = 18;
    }

    doc.setFontSize(12);
    doc.text("Action Plan", 14, y);
    doc.setFontSize(9);
    const actions = input.actionPlan?.length ? input.actionPlan : ["Not enough data"];
    actions.forEach((action, index) => {
      const lineY = y + 8 + index * 7;
      if (lineY > 280) return;
      doc.text(`${index + 1}. ${action}`, 14, lineY);
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text("Internal console report. Admin/BI use only.", 14, 287);
      doc.text(`Page ${page} of ${pageCount}`, 196, 287, { align: "right" });
    }

    doc.save(
      `itred_vd_${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`,
    );
  },

  exportAiReport(report: AiReportOutput): void {
    pdfReportService.exportReport({
      title: report.title,
      period: report.period,
      filters: report.filters as Record<string, unknown>,
      analytics: report.analyticsSnapshot,
      aiNarrative: report.narrative,
      actionPlan: report.actionPlan,
    });
  },
};
