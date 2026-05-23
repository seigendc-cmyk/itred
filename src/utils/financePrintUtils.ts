/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const installFinancePrintStyles = () => {
  const styleId = "finance-report-print-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
    @media print {
      body * { visibility: hidden; }
      #finance-report-print-area, #finance-report-print-area * {
        visibility: visible;
      }
      #finance-report-print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 20mm;
        background: white;
      }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      @page { size: A4 portrait; margin: 12mm; }
    }
  `;
  document.head.appendChild(style);
};

export const printFinanceReport = () => {
  installFinancePrintStyles();
  window.print();
};

export const downloadCsv = (
  filename: string,
  rows: Record<string, unknown>[],
) => {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  const escapeCsv = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
