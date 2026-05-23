import { Vendor, VendorInvoice, VendorInvoiceLine } from "../types.ts";
import { vendorBillingService } from "../services/vendorBillingService.ts";

const money = (value: number, currency: string) =>
  `${currency} ${Number(value || 0).toFixed(2)}`;

const safe = (value: unknown) =>
  String(value ?? "")
    .replace(/[<>]/g, "")
    .trim();

export const buildVendorInvoicePrintHtml = (
  invoice: VendorInvoice,
  lines: VendorInvoiceLine[],
  vendor?: Vendor,
) => {
  const address = [
    vendor?.streetAddress,
    vendor?.suburb,
    vendor?.cityTown,
    vendor?.district,
    vendor?.province,
    vendor?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safe(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1c1917; margin: 0; padding: 32px; }
    .page { max-width: 900px; margin: 0 auto; border: 2px solid #1c1917; padding: 28px; }
    .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #1c1917; padding-bottom: 18px; }
    h1 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: .04em; }
    h2 { margin: 4px 0 0; font-size: 13px; text-transform: uppercase; color: #ea580c; }
    .meta, .vendor, .footer { font-size: 12px; line-height: 1.6; }
    .section { margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { border: 1px solid #d6d3d1; padding: 9px; text-align: left; vertical-align: top; }
    th { background: #f5f5f4; text-transform: uppercase; font-size: 10px; }
    .right { text-align: right; }
    .totals { width: 360px; margin-left: auto; }
    .total-row { font-weight: 700; background: #fff7ed; }
    .footer { border-top: 2px solid #1c1917; margin-top: 32px; padding-top: 16px; }
    @media print { body { padding: 0; } .page { border: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div>
        <h1>seiGEN Commerce Infrastructure</h1>
        <h2>iTred Marketplace</h2>
      </div>
      <div class="meta">
        <strong>Invoice/Bill Number:</strong> ${safe(invoice.invoiceNumber)}<br />
        <strong>Invoice Date:</strong> ${safe(invoice.issueDate)}<br />
        <strong>Due Date:</strong> ${safe(invoice.dueDate)}
      </div>
    </div>
    <div class="section vendor">
      <strong>Vendor Name:</strong> ${safe(invoice.vendorName)}<br />
      <strong>Address:</strong> ${safe(address || "Not supplied")}<br />
      <strong>Phone:</strong> ${safe(vendor?.mainPhone || vendor?.whatsappNumber || "")}<br />
      <strong>Email:</strong> ${safe(vendor?.email || "")}<br />
      <strong>Sector:</strong> ${safe(vendor?.sector || "")}
    </div>
    <div class="section">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Qty</th>
            <th class="right">Unit Price</th>
            <th class="right">Tax</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (line) => `<tr>
                <td>${safe(line.description)}</td>
                <td class="right">${line.quantity}</td>
                <td class="right">${money(line.unitPrice, invoice.currency)}</td>
                <td class="right">${money(line.taxAmount, invoice.currency)}</td>
                <td class="right">${money(line.grossAmount, invoice.currency)}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="section">
      <table class="totals">
        <tr><td>Subtotal</td><td class="right">${money(invoice.subtotal, invoice.currency)}</td></tr>
        <tr><td>Tax</td><td class="right">${money(invoice.taxAmount, invoice.currency)}</td></tr>
        <tr class="total-row"><td>Total</td><td class="right">${money(invoice.totalAmount, invoice.currency)}</td></tr>
        <tr><td>Amount Paid</td><td class="right">${money(invoice.amountPaid, invoice.currency)}</td></tr>
        <tr class="total-row"><td>Balance Due</td><td class="right">${money(invoice.balanceDue, invoice.currency)}</td></tr>
      </table>
    </div>
    <div class="footer">
      <strong>Payment instructions:</strong> Please use the invoice number as payment reference and send proof of payment to SCI/iTred Finance.<br />
      Powered by seiGEN Commerce Infrastructure
    </div>
  </div>
</body>
</html>`;
};

export const printVendorInvoice = (
  invoice: VendorInvoice,
  vendor?: Vendor,
) => {
  const lines = vendorBillingService.getInvoiceLines(invoice.id);
  const popup = window.open("", "_blank", "width=1000,height=800");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(buildVendorInvoicePrintHtml(invoice, lines, vendor));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
  return true;
};
