import type jsPDF from "jspdf";
import autoTableImport from "jspdf-autotable";

type AutoTableRunner = (doc: jsPDF, options: Record<string, unknown>) => void;

const resolveAutoTable = (doc: jsPDF): AutoTableRunner | null => {
  const imported = autoTableImport as unknown as {
    default?: AutoTableRunner;
    autoTable?: AutoTableRunner;
  } & AutoTableRunner;

  if (typeof imported === "function") return imported;
  if (typeof imported.default === "function") return imported.default;
  if (typeof imported.autoTable === "function") return imported.autoTable;

  const docAutoTable = (doc as unknown as { autoTable?: (options: Record<string, unknown>) => void }).autoTable;
  if (typeof docAutoTable === "function") {
    return (_doc, options) => docAutoTable.call(_doc, options);
  }

  return null;
};

export function runAutoTable(doc: jsPDF, options: Record<string, unknown>): void {
  const autoTable = resolveAutoTable(doc);
  if (!autoTable) {
    throw new Error("PDF table export failed because jspdf-autotable is not available.");
  }
  autoTable(doc, options);
}
