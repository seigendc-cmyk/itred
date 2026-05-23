export const generateEntityId = (prefix: string) => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().split("-")[0].toUpperCase()
      : `${Date.now().toString(36)}${Math.floor(Math.random() * 100000)
          .toString(36)}`.toUpperCase();

  return `${prefix}-${stamp}-${randomPart}`;
};

const generateOperationalId = (prefix: string, length = 8): string => {
  const parts = generateEntityId(prefix).split("-");
  const randomPart = parts[2] || "";
  return `${parts[0]}-${parts[1]}-${randomPart.slice(0, length)}`;
};

export const generateCAHLinkId = (): string => generateOperationalId("CAH", 8);
export const generateVendorOfferId = (): string => generateOperationalId("VOF", 8);
export const generateFinanceTransactionId = (): string =>
  generateOperationalId("FIN", 6);
export const generateCatalogueId = (): string => generateOperationalId("CAT", 8);
export const generateActivityEventId = (): string => generateOperationalId("EV", 8);
export const generateDocumentSerial = (): string => generateOperationalId("DOC", 8);
export const generateSpotCheckId = (): string => generateOperationalId("SPOT", 6);
export const generateAuditLogId = (): string => generateOperationalId("AUDIT", 8);
export const generateNotificationId = (): string => generateOperationalId("NOTIF", 8);
export const generateApprovalId = (): string => generateOperationalId("APP", 6);
export const generateReportPrintLogId = (): string => generateOperationalId("FPR", 6);
export const generateTaskId = (): string => generateOperationalId("TASK", 6);
export const generateSubscriptionPaymentId = (): string =>
  generateOperationalId("SUBPAY", 6);
export const generateLedgerEntryId = (): string => generateOperationalId("LEDGER", 6);
export const generateRpnPaymentId = (): string => generateOperationalId("RPNPAY", 6);
