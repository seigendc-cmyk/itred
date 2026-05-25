import jsPDF from "jspdf";
import { runAutoTable } from "../utils/pdfAutoTable.ts";
import {
  Vendor,
  Subscription,
  CollectionRecord,
  PricingPlan,
  RPN,
  Staff,
  ActivityLog,
} from "../types.ts";
import { generateDocumentSerial } from "../utils/idGenerator.ts";

const getFinalY = (doc: jsPDF, fallback = 100): number => {
  return (doc as any).lastAutoTable?.finalY ?? fallback;
};

export type ReportType =
  | "due"
  | "overdue"
  | "received"
  | "rpn_route"
  | "statement";

interface ReportConfig {
  type: ReportType;
  title: string;
  startDate?: string;
  endDate?: string;
  rpnId?: string;
  planId?: string;
}

export const pdfService = {
  generateSubscriptionReport: (
    config: ReportConfig,
    data: {
      subs: Subscription[];
      collections: CollectionRecord[];
      vendors: Vendor[];
      plans: PricingPlan[];
      rpns: RPN[];
    },
  ) => {
    const doc = new jsPDF();
    const { type, title, startDate, endDate, rpnId, planId } = config;
    const { subs, collections, vendors, plans, rpns } = data;

    // Header section
    doc.setFillColor(31, 31, 31); // Brand Charcoal
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("iTred Business Systems", 14, 20);

    doc.setFontSize(10);
    doc.text("Subscription Management | Powered by seiGEN Commerce", 14, 30);

    doc.setFillColor(255, 122, 0); // Brand Orange
    doc.rect(0, 40, 210, 2, "F");

    // Report Meta
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(16);
    doc.text(title, 14, 55);

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 62);
    if (startDate && endDate) {
      doc.text(`Range: ${startDate} to ${endDate}`, 14, 67);
    }

    // Filter Logic
    let filteredSubs = [...subs];
    if (type === "due")
      filteredSubs = filteredSubs.filter((s) => s.status === "due");
    if (type === "overdue")
      filteredSubs = filteredSubs.filter((s) => s.status === "overdue");
    if (rpnId)
      filteredSubs = filteredSubs.filter((s) => s.assignedRPNId === rpnId);
    if (planId) filteredSubs = filteredSubs.filter((s) => s.planId === planId);

    // Table Data
    const tableHeaders = [
      ["Ref", "System Code", "Vendor", "Plan", "Due Date", "Status", "Amount"],
    ];
    const tableRows = filteredSubs.map((s) => {
      const vendor = vendors.find((v) => v.id === s.vendorId);
      return [
        s.id.substring(0, 8),
        vendor?.systemCode || "N/A",
        vendor?.name.substring(0, 20) || "Unknown",
        s.planId.toUpperCase(),
        new Date(s.dueDate).toLocaleDateString(),
        s.status.toUpperCase(),
        `${s.currency} ${s.amountDue.toLocaleString()}`,
      ];
    });

    runAutoTable(doc, {
      startY: 75,
      head: tableHeaders,
      body: tableRows,
      headStyles: { fillColor: [31, 31, 31] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { top: 75 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `PRIVACY SAFE REPORT - NO PHONE NUMBERS EXPOSED - ID: ${generateDocumentSerial()}`,
        14,
        285,
      );
      doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: "right" });
    }

    doc.save(
      `itred_report_${type}_${new Date().toISOString().split("T")[0]}.pdf`,
    );
  },

  generateVendorStatement: (
    vendor: Vendor,
    data: {
      subs: Subscription[];
      collections: CollectionRecord[];
      plans: PricingPlan[];
    },
  ) => {
    const doc = new jsPDF();
    const vendorSubs = data.subs.filter((s) => s.vendorId === vendor.id);
    const vendorCollections = data.collections.filter(
      (c) => c.vendorId === vendor.id,
    );

    // Header
    doc.setFillColor(31, 31, 31);
    doc.rect(0, 0, 210, 50, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("Vendor Statement", 14, 25);

    doc.setFontSize(10);
    doc.text(`System Code: ${vendor.systemCode}`, 14, 35);
    doc.text(`Issued: ${new Date().toLocaleDateString()}`, 14, 42);

    doc.setFillColor(255, 122, 0);
    doc.rect(0, 50, 210, 2, "F");

    // Vendor Info
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.text("Billing Entity:", 14, 65);
    doc.setFontSize(14);
    doc.text(vendor.name, 14, 72);
    doc.setFontSize(10);
    doc.text(`${vendor.cityTown || ""}, ${vendor.province || ""}`, 14, 78);

    // Ledger
    doc.setFontSize(12);
    doc.text("Subscription History", 14, 95);

    const subHeaders = [["Date", "Plan", "Amount", "Status"]];
    const subRows = vendorSubs.map((s) => [
      new Date(s.dueDate).toLocaleDateString(),
      s.planId.toUpperCase(),
      `${s.currency} ${s.amountDue}`,
      s.status.toUpperCase(),
    ]);

    runAutoTable(doc, {
      startY: 100,
      head: subHeaders,
      body: subRows,
      headStyles: { fillColor: [31, 31, 31] },
      margin: { top: 100 },
    });

    // Summary
    const totalDue = vendorSubs
      .filter((s) => s.status !== "paid")
      .reduce((sum, s) => sum + s.amountDue, 0);
    const finalY = getFinalY(doc, 150) + 15;

    doc.setFontSize(12);
    doc.text("Outstanding Balance:", 14, finalY);
    doc.setFontSize(18);
    doc.setTextColor(255, 122, 0);
    doc.text(`$ ${totalDue.toLocaleString()}`, 14, finalY + 10);

    doc.save(`statement_${vendor.systemCode}.pdf`);
  },

  generateStaffAccessReport: (data: {
    logs: ActivityLog[];
    staffList: Staff[];
    dateFrom?: string;
    dateTo?: string;
    filters: { staff: string; eventType: string; result: string };
  }) => {
    const doc = new jsPDF();
    const { logs, staffList, dateFrom, dateTo, filters } = data;

    doc.setFillColor(31, 31, 31);
    doc.rect(0, 0, 210, 45, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("iTred Security Audit Report", 14, 20);
    doc.setFontSize(10);
    doc.text("Internal Staff Access & Operations Ledger", 14, 30);
    doc.setFillColor(255, 122, 0);
    doc.rect(0, 45, 210, 2, "F");

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.text("Staff Access Logs", 14, 55);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 62);
    if (dateFrom || dateTo) {
      doc.text(
        `Period: ${dateFrom || "Start"} to ${dateTo || "Present"}`,
        14,
        67,
      );
    }
    doc.text(
      `Filters: Staff: ${filters.staff} | Event: ${filters.eventType} | Result: ${filters.result}`,
      14,
      72,
    );

    doc.setTextColor(255, 0, 0);
    doc.setFontSize(8);
    doc.text(
      "CONFIDENTIAL: SECURITY AUDIT DATA. DO NOT DISTRIBUTE UNLESS AUTHORISED.",
      14,
      80,
    );

    const tableHeaders = [
      ["Timestamp", "Staff Node", "Event", "Result", "Technical Trace"],
    ];
    const tableRows = logs.map((log) => {
      const staff = staffList.find(
        (s) => s.id === (log.actorId || log.details?.staffId),
      );
      let trace = JSON.stringify(log.details);
      if (trace.length > 80) trace = trace.substring(0, 77) + "...";

      return [
        new Date(log.timestamp).toLocaleString(),
        `${log.actorName}\n(${staff?.staffCode || "SYSTEM"})`,
        log.eventType.replace("STAFF_", "").replace(/_/g, " "),
        log.result?.toUpperCase() || "---",
        trace,
      ];
    });

    runAutoTable(doc, {
      startY: 85,
      head: tableHeaders,
      body: tableRows,
      headStyles: { fillColor: [31, 31, 31], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 3 },
      columnStyles: { 4: { cellWidth: 60 } },
    });

    doc.save(
      `staff_security_audit_${new Date().toISOString().split("T")[0]}.pdf`,
    );
  },

  generateOnboardingForm: (
    vendors: Vendor[],
    rpns: RPN[],
    plans: PricingPlan[],
  ) => {
    const doc = new jsPDF();
    let yPosition = 20;

    // Header Section
    doc.setFillColor(31, 31, 31); // Brand Charcoal
    doc.rect(0, 0, 210, 45, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("iTred Vendor Onboarding Form", 14, 20);

    doc.setFontSize(10);
    doc.text("Powered by seiGEN Commerce", 14, 30);

    doc.setFillColor(255, 122, 0); // Brand Orange
    doc.rect(0, 45, 210, 2, "F");

    yPosition = 55;

    // 1. Header (Meta Data)
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.text(`Form serial number: ${generateDocumentSerial()}`, 14, yPosition);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, yPosition);
    yPosition += 10;

    doc.text("RPN name: _________________________________", 14, yPosition);
    doc.text("RPN code: ________________________", 120, yPosition);
    yPosition += 10;

    doc.text("Territory: _________________________________", 14, yPosition);
    doc.text("Backend staff assigned: ____________", 120, yPosition);
    yPosition += 15;

    const checkPageBreak = (spaceNeeded: number) => {
      if (yPosition + spaceNeeded > 270) {
        doc.addPage();
        yPosition = 20;
      }
    };

    // Section Headers with Orange styling
    const addSection = (title: string) => {
      checkPageBreak(20);
      doc.setFillColor(255, 122, 0);
      doc.rect(14, yPosition - 5, 180, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(title, 16, yPosition);
      doc.setTextColor(50, 50, 50);
      yPosition += 15;
    };

    const drawFieldLine = (label: string) => {
      checkPageBreak(12);
      doc.setFontSize(10);
      doc.text(
        `${label}: _____________________________________________________`,
        14,
        yPosition,
      );
      yPosition += 12; // Spacing for handwritten entry
    };

    // 2. Vendor Details
    addSection("2. Vendor Details");
    [
      "Vendor name",
      "Trading name",
      "Owner full name",
      "National ID (optional)",
      "Phone",
      "WhatsApp",
      "Email",
      "Sector",
      "Business type",
      "Country",
      "Province",
      "City/town",
      "District",
      "Suburb",
      "Street address",
      "GPS/location notes",
      "Business description",
    ].forEach(drawFieldLine);
    yPosition += 5;

    // 3. Branch Details
    addSection("3. Branch Details");
    [
      "Branch name",
      "Branch manager",
      "Phone",
      "WhatsApp",
      "Province",
      "City/town",
      "District",
      "Suburb",
      "Address",
      "Opening hours",
      "Is default branch",
    ].forEach(drawFieldLine);
    yPosition += 5;

    // 4. Vendor Staff Details
    addSection("4. Vendor Staff Details");
    [
      "Staff full name",
      "Role",
      "Phone",
      "WhatsApp",
      "Assigned branch",
      "Status",
    ].forEach(drawFieldLine);
    yPosition += 5;

    // 5. Delivery Contact Details
    addSection("5. Delivery Contact Details");
    [
      "Delivery person/service name",
      "Phone",
      "WhatsApp",
      "Vehicle type",
      "Vehicle registration",
      "Driver licence",
      "National ID",
      "Service area",
      "Assigned branch",
    ].forEach(drawFieldLine);
    yPosition += 5;

    // 6. Product Collection Sheet
    addSection("6. Product Collection Sheet");

    const productHeaders = [
      [
        "Product name",
        "Category",
        "Brand/model",
        "SKU/product code",
        "Quantity available",
        "Price",
        "Unit",
        "Branch",
        "Image taken yes/no",
        "Notes",
      ],
    ];

    // 20 blank rows
    const productRows = Array(20).fill([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    runAutoTable(doc, {
      startY: yPosition,
      head: productHeaders,
      body: productRows,
      headStyles: { fillColor: [31, 31, 31], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 4, minCellHeight: 10 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 15 },
        5: { cellWidth: 15 },
        6: { cellWidth: 12 },
        7: { cellWidth: 15 },
        8: { cellWidth: 15 },
        9: { cellWidth: 25 },
      },
      margin: { left: 14, right: 14 },
    });

    yPosition = getFinalY(doc, yPosition) + 15;

    // 7. Farm Producer Section
    addSection("7. Farm Producer Section");
    [
      "Crop type",
      "Variety",
      "Date of availability",
      "Quantity available",
      "Packaging type",
      "Packaging size",
      "Minimum order quantity",
      "Farm/location",
      "Harvest status (planted / growing / ready soon / ready now / sold out)",
      "Storage condition",
      "Delivery/pickup option",
      "Notes",
    ].forEach(drawFieldLine);
    yPosition += 5;

    // 8. Subscription and Plan Section
    addSection("8. Subscription and Plan Section");
    [
      "Selected plan",
      "Billing period",
      "Amount due",
      "Due date",
      "Collection method",
      "Trial days if any",
      "RPN follow-up date",
    ].forEach(drawFieldLine);
    yPosition += 5;

    // 9. CAH and WhatsApp Consent
    addSection("9. CAH and WhatsApp Consent");
    const consentFields = [
      "☐ Vendor agrees to be listed in iTred catalogue",
      "☐ Vendor agrees to be listed in CAH WhatsApp distribution",
      "☐ Vendor agrees to receive subscription reminders",
      "☐ Vendor agrees to product contact buttons",
      "",
    ];

    consentFields.forEach((f) => {
      checkPageBreak(10);
      doc.setFontSize(10);
      doc.text(f, 14, yPosition);
      yPosition += 10;
    });

    drawFieldLine("Signature");
    drawFieldLine("Date");
    yPosition += 5;

    // 10. Backend Verification
    addSection("10. Backend Verification");
    [
      "Entered by backend staff",
      "Date entered",
      "Checked by",
      "Approved by",
      "Notes",
    ].forEach(drawFieldLine);

    // Footer with page numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: "right" });
    }

    doc.save(
      `rpn_onboarding_form_${new Date().toISOString().split("T")[0]}.pdf`,
    );
  },

  previewOnboardingForm: (
    vendors: Vendor[],
    rpns: RPN[],
    plans: PricingPlan[],
  ) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>iTred Vendor Onboarding Form</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.5; }
          .header { background: #1f1f1f; color: white; padding: 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; font-size: 14px; }
          .orange-bar { background: #ff7a00; height: 4px; margin: 0 0 20px 0; }
          .meta-header { display: flex; flex-wrap: wrap; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
          .meta-header div { width: 48%; margin-bottom: 10px; }
          .section { margin: 30px 0; page-break-inside: avoid; }
          .section-header { background: #ff7a00; color: white; padding: 8px 12px; font-weight: bold; font-size: 16px; margin-bottom: 15px; }
          .field { margin: 15px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .checkbox { margin: 10px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
          th { background: #1f1f1f; color: white; }
          td { height: 25px; }
          .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; }
          @media print { 
            @page { margin: 0; }
            body { margin: 1.5cm; } 
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>iTred Vendor Onboarding Form</h1>
          <p>Powered by seiGEN Commerce</p>
        </div>
        <div class="orange-bar"></div>
        
        <div class="meta-header">
          <div>Form serial number: ${generateDocumentSerial()}</div>
          <div>Date: ${new Date().toLocaleDateString()}</div>
          <div>RPN name: _________________________________</div>
          <div>RPN code: ________________________</div>
          <div>Territory: _________________________________</div>
          <div>Backend staff assigned: ____________</div>
        </div>

        <div class="section">
          <div class="section-header">2. Vendor Details</div>
          <div class="field">Vendor name:</div>
          <div class="field">Trading name:</div>
          <div class="field">Owner full name:</div>
          <div class="field">National ID (optional):</div>
          <div class="field">Phone:</div>
          <div class="field">WhatsApp:</div>
          <div class="field">Email:</div>
          <div class="field">Sector:</div>
          <div class="field">Business type:</div>
          <div class="field">Country:</div>
          <div class="field">Province:</div>
          <div class="field">City/town:</div>
          <div class="field">District:</div>
          <div class="field">Suburb:</div>
          <div class="field">Street address:</div>
          <div class="field">GPS/location notes:</div>
          <div class="field">Business description:</div>
        </div>

        <div class="section">
          <div class="section-header">3. Branch Details</div>
          <div class="field">Branch name:</div>
          <div class="field">Branch manager:</div>
          <div class="field">Phone:</div>
          <div class="field">WhatsApp:</div>
          <div class="field">Province:</div>
          <div class="field">City/town:</div>
          <div class="field">District:</div>
          <div class="field">Suburb:</div>
          <div class="field">Address:</div>
          <div class="field">Opening hours:</div>
          <div class="field">Is default branch:</div>
        </div>

        <div class="section">
          <div class="section-header">4. Vendor Staff Details</div>
          <div class="field">Staff full name:</div>
          <div class="field">Role:</div>
          <div class="field">Phone:</div>
          <div class="field">WhatsApp:</div>
          <div class="field">Assigned branch:</div>
          <div class="field">Status:</div>
        </div>

        <div class="section">
          <div class="section-header">5. Delivery Contact Details</div>
          <div class="field">Delivery person/service name:</div>
          <div class="field">Phone:</div>
          <div class="field">WhatsApp:</div>
          <div class="field">Vehicle type:</div>
          <div class="field">Vehicle registration:</div>
          <div class="field">Driver licence:</div>
          <div class="field">National ID:</div>
          <div class="field">Service area:</div>
          <div class="field">Assigned branch:</div>
        </div>

        <div class="section">
          <div class="section-header">6. Product Collection Sheet</div>
          <table>
            <thead>
              <tr>
                <th>Product name</th>
                <th>Category</th>
                <th>Brand/model</th>
                <th>SKU/product code</th>
                <th>Quantity available</th>
                <th>Price</th>
                <th>Unit</th>
                <th>Branch</th>
                <th>Image taken yes/no</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${Array(20).fill("<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join("")}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-header">7. Farm Producer Section</div>
          <div class="field">Crop type:</div>
          <div class="field">Variety:</div>
          <div class="field">Date of availability:</div>
          <div class="field">Quantity available:</div>
          <div class="field">Packaging type:</div>
          <div class="field">Packaging size:</div>
          <div class="field">Minimum order quantity:</div>
          <div class="field">Farm/location:</div>
          <div class="field">Harvest status (planted / growing / ready soon / ready now / sold out):</div>
          <div class="field">Storage condition:</div>
          <div class="field">Delivery/pickup option:</div>
          <div class="field">Notes:</div>
        </div>

        <div class="section">
          <div class="section-header">8. Subscription and Plan Section</div>
          <div class="field">Selected plan:</div>
          <div class="field">Billing period:</div>
          <div class="field">Amount due:</div>
          <div class="field">Due date:</div>
          <div class="field">Collection method:</div>
          <div class="field">Trial days if any:</div>
          <div class="field">RPN follow-up date:</div>
        </div>

        <div class="section">
          <div class="section-header">9. CAH and WhatsApp Consent</div>
          <div class="checkbox">☐ Vendor agrees to be listed in iTred catalogue</div>
          <div class="checkbox">☐ Vendor agrees to be listed in CAH WhatsApp distribution</div>
          <div class="checkbox">☐ Vendor agrees to receive subscription reminders</div>
          <div class="checkbox">☐ Vendor agrees to product contact buttons</div>
          <div class="field" style="margin-top:20px;">Signature:</div>
          <div class="field">Date:</div>
        </div>

        <div class="section">
          <div class="section-header">10. Backend Verification</div>
          <div class="field">Entered by backend staff:</div>
          <div class="field">Date entered:</div>
          <div class="field">Checked by:</div>
          <div class="field">Approved by:</div>
          <div class="field">Notes:</div>
        </div>

        <div class="footer">
          <p>Powered by seiGEN Commerce</p>
          <p>iTred Vendor Onboarding Form - Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  },
};
