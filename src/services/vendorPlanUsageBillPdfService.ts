import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface VendorPlanUsageBill {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  sector: string;
  city: string;
  suburb: string;
  planId: string;
  planName: string;
  planMonthlyPrice: number;
  currency: string;
  subscriptionStatus?: string;
  periodFrom: string;
  periodTo: string;
  productsAllowed: number;
  productsUsed: number;
  productsOverLimit: number;
  imagesAllowed: number;
  imagesUsed: number;
  imagesDue: number;
  deploymentsAllowed: number;
  deploymentsUsed: number;
  deploymentsDue: number;
  lastDeploymentDate?: string;
  nextDeploymentDate: string;
  creditBalance: number;
  creditUsed: number;
  remainingCredit: number;
  overageDue: number;
  billDue: number;
  recommendedAction: string;
  generatedAt: string;
}

const getFinalY = (doc: jsPDF, fallback = 100): number => {
  return (doc as any).lastAutoTable?.finalY ?? fallback;
};

export const generateVendorPlanUsageBillPdf = (bill: VendorPlanUsageBill) => {
  const doc = new jsPDF();

  doc.setFillColor(31, 31, 31);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("iTred Business Systems", 14, 20);
  doc.setFontSize(10);
  doc.text("Vendor Plan Usage Bill | Powered by seiGEN Commerce", 14, 30);

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(16);
  doc.text("Plan Usage & Overage Statement", 14, 55);

  doc.setFontSize(9);
  doc.text(`Vendor: ${bill.vendorName} (${bill.vendorCode})`, 14, 62);
  doc.text(`Period: ${bill.periodFrom} to ${bill.periodTo}`, 14, 67);

  autoTable(doc, {
    startY: 75,
    head: [["Item", "Details"]],
    body: [
      ["Plan", bill.planName],
      ["Subscription Status", bill.subscriptionStatus || "N/A"],
      [
        "Plan Monthly Price",
        `${bill.planMonthlyPrice.toFixed(2)} ${bill.currency}`,
      ],
      ["", ""],
      ["Products Allowed", `${bill.productsAllowed}`],
      ["Products Used", `${bill.productsUsed}`],
      ["Products Over Limit", `${bill.productsOverLimit}`],
      ["Overage Due", `${bill.overageDue.toFixed(2)} ${bill.currency}`],
      ["", ""],
      [
        "Credit Balance (Start)",
        `${(bill.creditBalance + bill.creditUsed).toFixed(2)}`,
      ],
      ["Credit Used for Overage", `-${bill.creditUsed.toFixed(2)}`],
      ["Remaining Credit", `${bill.remainingCredit.toFixed(2)}`],
      ["", ""],
      ["Total Bill Due", `${bill.billDue.toFixed(2)} ${bill.currency}`],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 31, 31] },
    styles: { fontSize: 10 },
  });

  const finalY = getFinalY(doc, 100);

  doc.setFontSize(10);
  doc.text("Recommendation:", 14, finalY + 10);
  doc.text(bill.recommendedAction, 14, finalY + 15, { maxWidth: 180 });

  const fileName = `vendor-bill-${bill.vendorCode}-${bill.periodTo}.pdf`;
  doc.save(fileName);

  return {
    fileName,
    content: doc.output("datauristring"),
  };
};
