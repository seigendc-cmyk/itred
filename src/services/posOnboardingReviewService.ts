import {
  collection,
  documentId,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase.ts";
import { dataCacheService } from "./dataCacheService.ts";
import { stripUndefined } from "../utils/firestoreSanitize.ts";
import { POS_PERMISSION_KEYS } from "../types/posGovernance.ts";
import {
  PosReviewDiagnostics,
  PosReviewNormalizedFields,
  PosOnboardingReviewData,
  PosTenantSetupRequest,
  VendorProfileCompletionRequest,
} from "../types/posOnboardingReview.ts";

export const POS_ONBOARDING_REVIEW_COLLECTIONS = {
  profileRequests: "vendorProfileCompletionRequests",
  setupRequests: "posTenantSetupRequests",
  onboardingCodes: "vendorOnboardingCodes",
  vendors: "vendors",
  warehouses: "posWarehouses",
  branches: "posBranches",
  terminals: "posTerminals",
  staffAccess: "posStaffAccess",
  roles: "posRoles",
  entitlementSnapshots: "posEntitlementSnapshots",
  activationLogs: "posActivationLogs",
  audit: "vendorOnboardingAudit",
} as const;

const REQUEST_COLLECTIONS = [
  "vendorProfileCompletionRequests",
  "posTenantSetupRequests",
  "vendorProfileRequests",
  "tenantSetupRequests",
  "posOnboardingRequests",
  "vendorOnboardingRequests",
] as const;

const PROFILE_COLLECTIONS = new Set([
  "vendorProfileCompletionRequests",
  "vendorProfileRequests",
]);

const SETUP_COLLECTIONS = new Set([
  "posTenantSetupRequests",
  "tenantSetupRequests",
]);

const PENDING_STATUSES = new Set([
  "pending",
  "submitted",
  "pending_backend_review",
  "backend_review_pending",
  "backend review pending",
  "profile_completion_pending",
  "warehouse_setup_pending",
  "branch_setup_pending",
  "terminal_setup_pending",
]);

const APPROVED_STATUSES = new Set(["approved", "ready_for_pos", "ready", "active"]);
const REJECTED_STATUSES = new Set(["rejected", "cancelled", "canceled", "declined"]);
const DEFAULT_READ_LIMIT = 250;
const POS_REVIEW_CACHE_TTL_MS = 30 * 1000;

const nowIso = () => new Date().toISOString();
const clean = <T>(value: T): T => stripUndefined(value);

const actorContext = () => {
  try {
    const raw = localStorage.getItem("activeStaffSession");
    const session = raw ? JSON.parse(raw) : null;
    return {
      actor:
        session?.staffName ||
        session?.displayName ||
        session?.fullName ||
        "Backend Office",
      actorEmail: session?.email || session?.googleEmailAllowed || null,
    };
  } catch {
    return { actor: "Backend Office", actorEmail: null };
  }
};

const readCollection = async <T>(
  collectionName: string,
  readLimit = DEFAULT_READ_LIMIT,
): Promise<T[]> => {
  const snapshot = await getDocs(
    query(collection(db, collectionName), orderBy(documentId()), limit(readLimit)),
  );
  return snapshot.docs.map((row) => ({ id: row.id, ...row.data() }) as T);
};

const getAny = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }
  return "";
};

const normalizeStatusText = (value: unknown) =>
  String(value || "pending")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const normalizeReviewStatus = (value: unknown) => {
  const normalized = normalizeStatusText(value).replace(/\s/g, "_");
  const spaced = normalizeStatusText(value);
  if (APPROVED_STATUSES.has(normalized) || APPROVED_STATUSES.has(spaced)) {
    return "approved" as const;
  }
  if (REJECTED_STATUSES.has(normalized) || REJECTED_STATUSES.has(spaced)) {
    return "rejected" as const;
  }
  if (PENDING_STATUSES.has(normalized) || PENDING_STATUSES.has(spaced)) {
    return "pending" as const;
  }
  return "pending" as const;
};

const normalizeFields = (record: Record<string, unknown>): PosReviewNormalizedFields => {
  const rawStatus = String(getAny(record, ["status", "state", "onboardingStatus"]) || "pending");
  return {
    vendorId: String(getAny(record, ["vendorId", "vendor_id", "tenantId"]) || ""),
    vendorCode: String(getAny(record, ["vendorCode", "vendor_code", "code"]) || ""),
    vendorName: String(
      getAny(record, ["vendorName", "businessName", "tradingName", "name"]) || "",
    ),
    submittedBy: String(
      getAny(record, ["submittedByEmail", "submittedBy", "rpnEmail", "actorEmail"]) || "",
    ),
    submittedAt: String(getAny(record, ["submittedAt", "createdAt", "timestamp"]) || ""),
    rawStatus,
    normalizedStatus: normalizeReviewStatus(rawStatus),
  };
};

const classifyRequest = (collectionName: string, record: Record<string, unknown>) => {
  const text = [
    collectionName,
    record.requestType,
    record.type,
    record.kind,
    record.onboardingStatus,
    record.status,
    JSON.stringify(record.proposedProfile || {}),
    JSON.stringify(record.proposedSetup || {}),
    JSON.stringify(record.warehouse || {}),
    JSON.stringify(record.branch || {}),
    JSON.stringify(record.terminal || {}),
  ]
    .join(" ")
    .toLowerCase();

  if (PROFILE_COLLECTIONS.has(collectionName) || text.includes("profile")) {
    return "profile" as const;
  }
  if (
    SETUP_COLLECTIONS.has(collectionName) ||
    text.includes("setup") ||
    text.includes("warehouse") ||
    text.includes("branch") ||
    text.includes("terminal")
  ) {
    return "setup" as const;
  }
  return "general" as const;
};

const withNormalizedShape = (
  collectionName: string,
  record: Record<string, unknown>,
) => {
  const normalized = normalizeFields(record);
  return {
    ...record,
    id: String(record.id || `${collectionName}-${Math.random().toString(36).slice(2)}`),
    sourceCollection: collectionName,
    requestKind: classifyRequest(collectionName, record),
    normalized,
    vendorId: String(record.vendorId || record.vendor_id || record.tenantId || normalized.vendorId),
    vendorCode: String(record.vendorCode || record.vendor_code || record.code || normalized.vendorCode),
    vendorName: String(
      record.vendorName ||
        record.businessName ||
        record.tradingName ||
        record.name ||
        normalized.vendorName,
    ),
    submittedByEmail: String(
      record.submittedByEmail ||
        record.submittedBy ||
        record.rpnEmail ||
        record.actorEmail ||
        normalized.submittedBy,
    ),
    submittedAt: String(record.submittedAt || record.createdAt || record.timestamp || normalized.submittedAt),
    status: normalized.normalizedStatus,
  };
};

const readRequestCollections = async () => {
  const diagnostics: PosReviewDiagnostics = {
    collectionsChecked: [...REQUEST_COLLECTIONS],
    entries: [],
    statusesFound: [],
    totalRecordsFound: 0,
    errors: [],
  };
  const records: Array<Record<string, unknown>> = [];

  for (const collectionName of REQUEST_COLLECTIONS) {
    try {
      const rows = await readCollection<Record<string, unknown>>(collectionName);
      const statuses = Array.from(
        new Set(
          rows.map((row) =>
            String(getAny(row, ["status", "state", "onboardingStatus"]) || "missing"),
          ),
        ),
      );
      const lastRequestTimestamp = rows
        .map((row) => String(getAny(row, ["submittedAt", "createdAt", "timestamp"]) || ""))
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      diagnostics.entries.push({
        collectionName,
        recordsFound: rows.length,
        statusesFound: statuses,
        lastRequestTimestamp,
      });
      diagnostics.totalRecordsFound += rows.length;
      statuses.forEach((status) => {
        if (!diagnostics.statusesFound.includes(status)) {
          diagnostics.statusesFound.push(status);
        }
      });
      rows.forEach((row) => records.push(withNormalizedShape(collectionName, row)));
    } catch (error: any) {
      const message = error?.message || String(error);
      diagnostics.errors.push(`${collectionName}: ${message}`);
      diagnostics.entries.push({
        collectionName,
        recordsFound: 0,
        statusesFound: [],
        error: message,
      });
    }
  }

  return { records, diagnostics };
};

const valueOf = (
  source: Record<string, unknown> | undefined,
  keys: string[],
  fallback = "",
) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return fallback;
};

const boolOf = (source: Record<string, unknown> | undefined, keys: string[]) =>
  keys.some((key) => source?.[key] === true || source?.[key] === "true");

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const generateTemporaryAccessCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const findExistingByVendorAndKeys = async (
  collectionName: string,
  vendorId: string,
  keys: Array<{ field: string; value: string }>,
) => {
  for (const item of keys) {
    if (!item.value) continue;
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where("vendorId", "==", vendorId),
        where(item.field, "==", item.value),
        limit(1),
      ),
    );
    if (!snapshot.empty) return snapshot.docs[0].id;
  }
  return "";
};

const auditRecord = (
  action: string,
  vendorId: string,
  vendorCode: string | undefined,
  requestId: string,
  before: unknown,
  after: unknown,
  notes?: string,
) => {
  const { actor, actorEmail } = actorContext();
  const timestamp = nowIso();
  return {
    id: makeId(`review-audit-${vendorId}`),
    action,
    vendorId,
    vendorCode: vendorCode || vendorId,
    requestId,
    actor,
    actorEmail,
    timestamp,
    before,
    after,
    notes: notes || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const setupParts = (request: PosTenantSetupRequest) => ({
  warehouse: request.warehouse || request.proposedSetup?.warehouse || {},
  branch: request.branch || request.proposedSetup?.branch || {},
  terminal: request.terminal || request.proposedSetup?.terminal || {},
  staffAdmin: request.staffAdmin || request.proposedSetup?.staffAdmin || {},
});

export const posOnboardingReviewService = {
  getData: async (): Promise<PosOnboardingReviewData> => {
    return dataCacheService.getOrFetch("pos-onboarding-review-data", POS_REVIEW_CACHE_TTL_MS, async () => {
    const [{ records, diagnostics }, vendors, onboardingCodes] = await Promise.all([
      readRequestCollections(),
      readCollection<Record<string, unknown>>(POS_ONBOARDING_REVIEW_COLLECTIONS.vendors),
      readCollection<Record<string, unknown>>(POS_ONBOARDING_REVIEW_COLLECTIONS.onboardingCodes),
    ]);

    const profileRequests = records.filter(
      (record) => record.requestKind === "profile",
    ) as VendorProfileCompletionRequest[];
    const setupRequests = records.filter(
      (record) => record.requestKind === "setup",
    ) as PosTenantSetupRequest[];

    return {
      profileRequests,
      setupRequests,
      allRequests: records as Array<VendorProfileCompletionRequest | PosTenantSetupRequest>,
      vendors,
      onboardingCodes,
      diagnostics,
    };
    });
  },

  approveProfile: async (request: VendorProfileCompletionRequest) => {
    const timestamp = nowIso();
    const { actor } = actorContext();
    const proposed = request.proposedProfile || request;
    const vendorId = request.normalized?.vendorId || request.vendorId;
    const requestCollection =
      request.sourceCollection || POS_ONBOARDING_REVIEW_COLLECTIONS.profileRequests;
    const vendorPatch = {
      vendorId,
      vendorCode: request.normalized?.vendorCode || request.vendorCode || vendorId,
      vendorName: valueOf(proposed, ["vendorName", "businessName", "name"], request.normalized?.vendorName || request.vendorName || ""),
      tradingName: valueOf(proposed, ["tradingName"]),
      sector: valueOf(proposed, ["sector"]),
      category: valueOf(proposed, ["category"]),
      contactPerson: valueOf(proposed, ["contactPerson", "ownerFullName"]),
      phone: valueOf(proposed, ["phone", "mainPhone"]),
      whatsapp: valueOf(proposed, ["whatsapp", "whatsappNumber"]),
      email: valueOf(proposed, ["email"]),
      address: valueOf(proposed, ["address", "streetAddress"]),
      district: valueOf(proposed, ["district"]),
      suburb: valueOf(proposed, ["suburb"]),
      city: valueOf(proposed, ["city", "cityTown"]),
      rpnNotes: request.rpnNotes || valueOf(proposed, ["rpnNotes"]),
      onboardingStatus: "PROFILE_COMPLETION_PENDING",
      updatedAt: timestamp,
      profileApprovedAt: timestamp,
      profileApprovedBy: actor,
    };
    const approvedRequest = {
      ...request,
      status: "approved",
      approvedAt: timestamp,
      approvedBy: actor,
      updatedAt: timestamp,
    };
    const audit = auditRecord(
      "profile approved",
      vendorId,
      request.vendorCode,
      request.id,
      request,
      { vendorPatch, approvedRequest },
    );

    const batch = writeBatch(db);
    batch.set(
      doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.vendors, vendorId),
      clean(vendorPatch),
      { merge: true },
    );
    batch.set(
      doc(db, requestCollection, request.id),
      clean(approvedRequest),
      { merge: true },
    );
    batch.set(
      doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.onboardingCodes, vendorId),
      clean({ onboardingStatus: "PROFILE_COMPLETION_PENDING", updatedAt: timestamp }),
      { merge: true },
    );
    batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.audit, audit.id), clean(audit));
    await batch.commit();
    dataCacheService.clearCache("pos-onboarding-review-data");
  },

  rejectProfile: async (
    request: VendorProfileCompletionRequest,
    rejectionReason: string,
  ) => {
    if (!rejectionReason.trim()) throw new Error("Rejection reason is required.");
    const timestamp = nowIso();
    const { actor } = actorContext();
    const requestCollection =
      request.sourceCollection || POS_ONBOARDING_REVIEW_COLLECTIONS.profileRequests;
    const rejectedRequest = {
      ...request,
      status: "rejected",
      rejectionReason,
      rejectedAt: timestamp,
      rejectedBy: actor,
      updatedAt: timestamp,
    };
    const audit = auditRecord(
      "profile rejected",
      request.normalized?.vendorId || request.vendorId,
      request.normalized?.vendorCode || request.vendorCode,
      request.id,
      request,
      rejectedRequest,
      rejectionReason,
    );
    const batch = writeBatch(db);
    batch.set(
      doc(db, requestCollection, request.id),
      clean(rejectedRequest),
      { merge: true },
    );
    batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.audit, audit.id), clean(audit));
    await batch.commit();
    dataCacheService.clearCache("pos-onboarding-review-data");
  },

  approveSetup: async (request: PosTenantSetupRequest) => {
    const timestamp = nowIso();
    const { actor, actorEmail } = actorContext();
    const vendorId = request.normalized?.vendorId || request.vendorId;
    const vendorCode = request.normalized?.vendorCode || request.vendorCode || vendorId;
    const vendorName = request.normalized?.vendorName || request.vendorName || vendorId;
    const requestCollection =
      request.sourceCollection || POS_ONBOARDING_REVIEW_COLLECTIONS.setupRequests;
    const parts = setupParts(request);

    const warehouseName = valueOf(parts.warehouse, ["warehouseName", "name"], "Main Warehouse");
    const warehouseCode = valueOf(parts.warehouse, ["warehouseCode", "code"], `${vendorId}-WH`);
    const branchName = valueOf(parts.branch, ["branchName", "name"], "Main Branch");
    const branchCode = valueOf(parts.branch, ["branchCode", "code"], `${vendorId}-BR`);
    const terminalName = valueOf(parts.terminal, ["terminalName", "name"], "Main Terminal");
    const terminalCode = valueOf(parts.terminal, ["terminalCode", "code"], `${vendorId}-TM`);
    const staffEmail =
      request.submittedByEmail ||
      valueOf(parts.staffAdmin, ["email", "submittedByEmail"]);
    const staffDisplayName =
      valueOf(parts.staffAdmin, ["displayName", "name", "fullName"]) ||
      (staffEmail ? staffEmail.split("@")[0] : "");
    const staffPhone = valueOf(parts.staffAdmin, ["phone", "staffPhone", "mobile"]);

    const warehouseId =
      (await findExistingByVendorAndKeys(
        POS_ONBOARDING_REVIEW_COLLECTIONS.warehouses,
        vendorId,
        [
          { field: "warehouseCode", value: warehouseCode },
          { field: "warehouseName", value: warehouseName },
        ],
      )) || `${vendorId}-${warehouseCode}`.toLowerCase();
    const branchId =
      (await findExistingByVendorAndKeys(
        POS_ONBOARDING_REVIEW_COLLECTIONS.branches,
        vendorId,
        [
          { field: "branchCode", value: branchCode },
          { field: "branchName", value: branchName },
        ],
      )) || `${vendorId}-${branchCode}`.toLowerCase();
    const terminalId =
      (await findExistingByVendorAndKeys(
        POS_ONBOARDING_REVIEW_COLLECTIONS.terminals,
        vendorId,
        [
          { field: "terminalCode", value: terminalCode },
          { field: "terminalName", value: terminalName },
        ],
      )) || `${vendorId}-${terminalCode}`.toLowerCase();
    const roleId =
      (await findExistingByVendorAndKeys(
        POS_ONBOARDING_REVIEW_COLLECTIONS.roles,
        vendorId,
        [{ field: "roleName", value: "SysAdmin" }],
      )) || `${vendorId}-sysadmin`;
    const existingStaffAccess = await getDocs(
      query(
        collection(db, POS_ONBOARDING_REVIEW_COLLECTIONS.staffAccess),
        where("vendorId", "==", vendorId),
        limit(100),
      ),
    );
    const activeStaffExists = existingStaffAccess.docs.some((row) => {
      const data = row.data();
      return (
        data.status === "active" &&
        (data.branchId || data.branchIds?.length) &&
        (data.terminalId || data.terminalIds?.length) &&
        data.roleId
      );
    });
    const shouldCreateStaffAccess = !activeStaffExists && (!!staffEmail || !!staffDisplayName);
    const staffAccessId = shouldCreateStaffAccess
      ? staffEmail
        ? `${vendorId}-${staffEmail}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-")
        : `${vendorId}-${staffDisplayName}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-")
      : "";

    const approvedMeta = {
      status: "active",
      source: "backend_onboarding_approval",
      approvedAt: timestamp,
      approvedBy: actor,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const warehouseRecord = {
      id: warehouseId,
      vendorId,
      warehouseName,
      warehouseCode,
      address: valueOf(parts.warehouse, ["address"]),
      district: valueOf(parts.warehouse, ["district"]),
      suburb: valueOf(parts.warehouse, ["suburb"]),
      isDefault: boolOf(parts.warehouse, ["isDefault"]),
      ...approvedMeta,
    };
    const branchRecord = {
      id: branchId,
      vendorId,
      branchName,
      branchCode,
      branchType: valueOf(parts.branch, ["branchType"], "shop"),
      address: valueOf(parts.branch, ["address"]),
      district: valueOf(parts.branch, ["district"]),
      suburb: valueOf(parts.branch, ["suburb"]),
      ...approvedMeta,
    };
    const terminalRecord = {
      id: terminalId,
      vendorId,
      branchId,
      terminalName,
      terminalCode,
      deskName: valueOf(parts.terminal, ["deskName"], "Cashier Desk 1"),
      terminalAccessCode: valueOf(parts.terminal, ["terminalAccessCode"]),
      deviceBindingStatus: valueOf(parts.terminal, ["deviceBindingStatus"], "unbound"),
      lastSeenAt: null,
      ...approvedMeta,
    };
    const roleRecord = {
      id: roleId,
      vendorId,
      roleName: "SysAdmin",
      permissions: [...POS_PERMISSION_KEYS],
      ...approvedMeta,
    };
    const temporaryAccessCode = staffAccessId ? generateTemporaryAccessCode() : "";
    const staffAccessRecord = staffAccessId
      ? {
          id: staffAccessId,
          vendorId,
          vendorCode,
          vendorName,
          branchId,
          branchName,
          branchIds: [branchId],
          terminalId,
          terminalName,
          deskName: terminalRecord.deskName,
          terminalIds: [terminalId],
          staffId: staffEmail || staffDisplayName,
          displayName: staffDisplayName || "POS Staff",
          email: staffEmail || "",
          phone: staffPhone,
          roleId,
          roleName: "SysAdmin",
          permissions: [...POS_PERMISSION_KEYS],
          // TODO: Replace temporaryAccessCode with hashed PIN / secure auth flow before production.
          temporaryAccessCode,
          accessCode: temporaryAccessCode,
          accessCodeLastResetAt: timestamp,
          mustChangePin: true,
          pinMode: "temporary_plaintext_prototype",
          status: "active",
          accessStatus: "active",
          notes: "Created automatically during POS setup approval.",
          createdBy: actor,
          createdByEmail: actorEmail,
          ...approvedMeta,
          source: "backend_office_staff_setup",
        }
      : null;
    const readyForPos = activeStaffExists || !!staffAccessRecord;
    const nextOnboardingStatus = readyForPos ? "READY_FOR_POS" : "STAFF_SETUP_PENDING";
    const approvedRequest = {
      ...request,
      status: "approved",
      approvedAt: timestamp,
      approvedBy: actor,
      updatedAt: timestamp,
    };
    const audit = auditRecord(
      "setup approved",
      vendorId,
      request.vendorCode,
      request.id,
      request,
      {
        warehouseRecord,
        branchRecord,
        terminalRecord,
        roleRecord,
        staffAccessRecord,
      },
    );

    const batch = writeBatch(db);
    batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.warehouses, warehouseId), clean(warehouseRecord), { merge: true });
    batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.branches, branchId), clean(branchRecord), { merge: true });
    batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.terminals, terminalId), clean(terminalRecord), { merge: true });
    batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.roles, roleId), clean(roleRecord), { merge: true });
    if (staffAccessRecord) {
      batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.staffAccess, staffAccessId), clean(staffAccessRecord), { merge: true });
    }
    batch.set(
      doc(db, requestCollection, request.id),
      clean(approvedRequest),
      { merge: true },
    );
    batch.set(
      doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.vendors, vendorId),
      clean({
        onboardingStatus: nextOnboardingStatus,
        updatedAt: timestamp,
        readyForPosAt: readyForPos ? timestamp : null,
      }),
      { merge: true },
    );
    batch.set(
      doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.onboardingCodes, vendorId),
      clean({
        onboardingStatus: nextOnboardingStatus,
        completedAt: readyForPos ? timestamp : null,
        updatedAt: timestamp,
      }),
      { merge: true },
    );
    batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.audit, audit.id), clean(audit));
    [
      ["warehouse created", warehouseRecord],
      ["branch created", branchRecord],
      ["terminal created", terminalRecord],
      ["role created", roleRecord],
      ["staff access created", staffAccessRecord],
      [readyForPos ? "onboarding ready for POS" : "staff setup pending", { vendorId }],
    ].forEach(([action, after]) => {
      const event = auditRecord(
        String(action),
        vendorId,
        request.vendorCode,
        request.id,
        null,
        after,
      );
      batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.audit, event.id), clean(event));
    });
    await batch.commit();
    dataCacheService.clearCache("pos-onboarding-review-data");
  },

  rejectSetup: async (request: PosTenantSetupRequest, rejectionReason: string) => {
    if (!rejectionReason.trim()) throw new Error("Rejection reason is required.");
    const timestamp = nowIso();
    const { actor } = actorContext();
    const requestCollection =
      request.sourceCollection || POS_ONBOARDING_REVIEW_COLLECTIONS.setupRequests;
    const rejectedRequest = {
      ...request,
      status: "rejected",
      rejectionReason,
      rejectedAt: timestamp,
      rejectedBy: actor,
      updatedAt: timestamp,
    };
    const audit = auditRecord(
      "setup rejected",
      request.normalized?.vendorId || request.vendorId,
      request.normalized?.vendorCode || request.vendorCode,
      request.id,
      request,
      rejectedRequest,
      rejectionReason,
    );
    const batch = writeBatch(db);
    batch.set(
      doc(db, requestCollection, request.id),
      clean(rejectedRequest),
      { merge: true },
    );
    batch.set(doc(db, POS_ONBOARDING_REVIEW_COLLECTIONS.audit, audit.id), clean(audit));
    await batch.commit();
    dataCacheService.clearCache("pos-onboarding-review-data");
  },
};
