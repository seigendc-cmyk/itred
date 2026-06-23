import {
  collection,
  documentId,
  doc,
  getDoc,
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
import {
  PosVendorOnboardingForm,
  PosVendorOnboardingRow,
  VendorOnboardingAuditEntry,
  VendorOnboardingCodeRecord,
  VendorOnboardingLifecycle,
  VendorSkeletonRecord,
} from "../types/posVendorOnboarding.ts";

export const POS_VENDOR_ONBOARDING_COLLECTIONS = {
  vendors: "vendors",
  onboardingCodes: "vendorOnboardingCodes",
  subscriptions: "vendorPosSubscriptions",
  branches: "posBranches",
  terminals: "posTerminals",
  staffAccess: "posStaffAccess",
  roles: "posRoles",
  activationLogs: "posActivationLogs",
  audit: "vendorOnboardingAudit",
} as const;

const clean = <T>(value: T): T => stripUndefined(value);
const nowIso = () => new Date().toISOString();
const DEFAULT_READ_LIMIT = 250;
const AUDIT_READ_LIMIT = 200;
const POS_VENDOR_ONBOARDING_CACHE_TTL_MS = 30 * 1000;

const actorContext = (fallback: string) => {
  try {
    const raw = localStorage.getItem("activeStaffSession");
    const session = raw ? JSON.parse(raw) : null;
    return {
      actor: session?.staffName || session?.displayName || session?.fullName || fallback,
      actorEmail: session?.email || session?.googleEmailAllowed || null,
    };
  } catch {
    return { actor: fallback, actorEmail: null };
  }
};

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const normalizeDigits = (value: string) => String(value || "").replace(/\D/g, "");

const cleanPhoneForWhatsApp = (value: string) => {
  let digits = normalizeDigits(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = `263${digits.slice(1)}`;
  return digits;
};

const makeAuditId = (vendorId: string) =>
  `onboarding-audit-${vendorId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const readCollection = async <T>(
  collectionName: string,
  readLimit = DEFAULT_READ_LIMIT,
): Promise<T[]> => {
  const snapshot = await getDocs(
    query(collection(db, collectionName), orderBy(documentId()), limit(readLimit)),
  );
  return snapshot.docs.map((row) => ({ id: row.id, ...row.data() }) as T);
};

const readVendorDocs = async (collectionName: string, vendorId: string) => {
  const snapshot = await getDocs(
    query(collection(db, collectionName), where("vendorId", "==", vendorId), limit(100)),
  );
  return snapshot.docs;
};

const assertReadyForPos = async (vendorId: string) => {
  const [subscriptions, branches, terminals, roles, staffAccess] = await Promise.all([
    readVendorDocs(POS_VENDOR_ONBOARDING_COLLECTIONS.subscriptions, vendorId),
    readVendorDocs(POS_VENDOR_ONBOARDING_COLLECTIONS.branches, vendorId),
    readVendorDocs(POS_VENDOR_ONBOARDING_COLLECTIONS.terminals, vendorId),
    readVendorDocs(POS_VENDOR_ONBOARDING_COLLECTIONS.roles, vendorId),
    readVendorDocs(POS_VENDOR_ONBOARDING_COLLECTIONS.staffAccess, vendorId),
  ]);
  const platformReady = subscriptions.some((row) =>
    ["active", "trial"].includes(String(row.data().subscriptionStatus || "")),
  );
  const staffReady = staffAccess.some((row) => {
    const data = row.data();
    return (
      data.status === "active" &&
      (data.branchId || data.branchIds?.length) &&
      (data.terminalId || data.terminalIds?.length) &&
      data.roleId
    );
  });

  if (!platformReady || !branches.length || !terminals.length || !roles.length || !staffReady) {
    throw new Error(
      "READY_FOR_POS requires active platform access, branch, terminal, role and active staff access records.",
    );
  }
};

const nextVendorSequence = async () => {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  const prefix = `ITR-VEN-${yearMonth}`;
  const snapshot = await getDocs(
    query(
      collection(db, POS_VENDOR_ONBOARDING_COLLECTIONS.vendors),
      where("vendorId", ">=", prefix),
      where("vendorId", "<", `${prefix}\uf8ff`),
      orderBy("vendorId", "desc"),
      limit(1),
    ),
  );
  let max = 0;

  snapshot.docs.forEach((row) => {
    const data = row.data();
    const candidate = String(data.vendorId || data.vendorCode || row.id || "");
    if (!candidate.startsWith(prefix)) return;
    const sequence = Number(candidate.split("-").pop());
    if (!Number.isNaN(sequence)) max = Math.max(max, sequence);
  });

  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
};

const generateUniqueCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await getDocs(
      query(
        collection(db, POS_VENDOR_ONBOARDING_COLLECTIONS.onboardingCodes),
        where("code", "==", code),
        where("status", "==", "issued"),
        limit(1),
      ),
    );
    if (existing.empty) return code;
  }

  throw new Error("Could not generate a unique onboarding code. Try again.");
};

export const buildOnboardingWhatsAppMessage = (
  vendorName: string,
  vendorId: string,
  code: string,
) =>
  [
    "Welcome to iTred POS.",
    "",
    "Vendor:",
    vendorName,
    "",
    "Vendor ID:",
    vendorId,
    "",
    "Vendor Setup Code:",
    code,
    "",
    "Instructions:",
    "1. Open iTred POS",
    "2. Sign in with Google",
    "3. Select \"Start Vendor Setup With Code\"",
    "4. Enter the Vendor Setup Code",
    "5. Complete the vendor profile and POS setup",
    "",
    "Generated by:",
    "Digital Commerce / seiGEN Commerce OS",
  ].join("\n");

const buildAudit = (
  vendorId: string,
  code: string | undefined,
  action: VendorOnboardingAuditEntry["action"],
  actor: string,
  actorEmail: string | null,
  before: unknown,
  after: unknown,
  notes: string | null = null,
): VendorOnboardingAuditEntry => {
  const timestamp = nowIso();
  return {
    id: makeAuditId(vendorId),
    vendorId,
    code,
    action,
    actor,
    actorEmail,
    timestamp,
    before,
    after,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const buildActivationLog = (
  action: string,
  vendorId: string,
  actor: string,
  before: unknown,
  after: unknown,
) => {
  const timestamp = nowIso();
  return {
    id: `pos-onboarding-log-${vendorId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    vendorId,
    actor,
    timestamp,
    before,
    after,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const posVendorOnboardingService = {
  getRows: async (): Promise<PosVendorOnboardingRow[]> => {
    return dataCacheService.getOrFetch("pos-vendor-onboarding-rows", POS_VENDOR_ONBOARDING_CACHE_TTL_MS, async () => {
    const codes = await readCollection<VendorOnboardingCodeRecord>(
      POS_VENDOR_ONBOARDING_COLLECTIONS.onboardingCodes,
    );
    const vendorIds = Array.from(new Set(codes.map((code) => code.vendorId).filter(Boolean)));
    const vendorSnapshots = await Promise.all(
      vendorIds.map((vendorId) =>
        getDoc(doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.vendors, vendorId)),
      ),
    );
    const vendors = vendorSnapshots
      .filter((snapshot) => snapshot.exists())
      .map(
        (snapshot) =>
          ({ id: snapshot.id, ...snapshot.data() }) as VendorSkeletonRecord,
      );

    return codes
      .map((code) => ({
        ...code,
        vendorSkeleton:
          vendors.find((vendor) => vendor.vendorId === code.vendorId) || null,
      }))
      .sort(
        (a, b) =>
          new Date(b.issuedAt || b.createdAt).getTime() -
          new Date(a.issuedAt || a.createdAt).getTime(),
      );
    });
  },

  getAudit: () =>
    dataCacheService.getOrFetch(
      "pos-vendor-onboarding-audit",
      POS_VENDOR_ONBOARDING_CACHE_TTL_MS,
      () =>
        readCollection<VendorOnboardingAuditEntry>(
          POS_VENDOR_ONBOARDING_COLLECTIONS.audit,
          AUDIT_READ_LIMIT,
        ),
    ),

  createOnboarding: async (
    form: PosVendorOnboardingForm,
    actorFallback = "Backend Office",
  ) => {
    if (!form.vendorName.trim()) throw new Error("Vendor Name is required.");
    const { actor, actorEmail } = actorContext(actorFallback);
    const timestamp = nowIso();
    const vendorId = await nextVendorSequence();
    const code = await generateUniqueCode();
    const expiresAt = form.expiryDate
      ? new Date(form.expiryDate).toISOString()
      : addDaysIso(7);
    const vendorName = form.vendorName.trim();
    const whatsappMessage = buildOnboardingWhatsAppMessage(vendorName, vendorId, code);

    const vendorSkeleton: VendorSkeletonRecord = {
      id: vendorId,
      vendorId,
      vendorCode: vendorId,
      onboardingCode: code,
      vendorName,
      tradingName: form.tradingName,
      sector: form.sector,
      category: form.category,
      contactPerson: form.contactPerson,
      phone: form.phone,
      whatsapp: form.whatsapp,
      email: form.email,
      address: form.address,
      district: form.district,
      suburb: form.suburb,
      city: form.city,
      onboardingStatus: "ISSUED",
      activationStatus: form.posActivationType,
      posPlanId: form.posPlanId,
      posPlanName: form.posPlanName,
      posActivationType: form.posActivationType,
      posExpiresAt: expiresAt,
      onboardingCreatedAt: timestamp,
      createdByBackendUser: actor,
      rpnName: form.rpnName,
      rpnPhone: form.rpnPhone,
      rpnEmail: form.rpnEmail,
      notes: form.notes,
      source: "itred_console_pos_onboarding",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const codeRecord: VendorOnboardingCodeRecord = {
      id: code,
      code,
      vendorId,
      vendorName,
      vendorCode: vendorId,
      tradingName: form.tradingName,
      status: "issued",
      onboardingStatus: "ISSUED",
      issuedBy: actor,
      issuedByEmail: actorEmail,
      issuedAt: timestamp,
      expiresAt,
      rpnName: form.rpnName,
      rpnPhone: form.rpnPhone,
      rpnEmail: form.rpnEmail,
      notes: form.notes,
      usedAt: null,
      completedAt: null,
      source: "itred_console_backend_office",
      posPlanId: form.posPlanId,
      posPlanName: form.posPlanName,
      posActivationType: form.posActivationType,
      whatsappMessage,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const subscription = {
      id: vendorId,
      vendorId,
      vendorName,
      planId: form.posPlanId,
      planName: form.posPlanName,
      subscriptionStatus:
        form.posActivationType === "pending"
          ? "payment_pending"
          : form.posActivationType,
      activationSource: "backend_onboarding",
      activatedBy: actor,
      activatedAt: timestamp,
      expiresAt,
      trialEndsAt: form.posActivationType === "trial" ? expiresAt : null,
      paymentReference: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const audit = buildAudit(
      vendorId,
      code,
      "onboarding_issued",
      actor,
      actorEmail,
      null,
      codeRecord,
      form.notes || null,
    );

    const activationLog = buildActivationLog(
      "onboarding_issued",
      vendorId,
      actor,
      null,
      { vendorSkeleton, codeRecord, subscription },
    );

    const batch = writeBatch(db);
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.vendors, vendorId),
      clean(vendorSkeleton),
    );
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.onboardingCodes, code),
      clean(codeRecord),
    );
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.subscriptions, vendorId),
      clean(subscription),
      { merge: true },
    );
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.audit, audit.id),
      clean(audit),
    );
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.activationLogs, activationLog.id),
      clean(activationLog),
    );
    await batch.commit();
    dataCacheService.clearCache("pos-vendor-onboarding-rows");
    dataCacheService.clearCache("pos-vendor-onboarding-audit");

    return { vendorSkeleton, codeRecord };
  },

  reissueCode: async (row: VendorOnboardingCodeRecord, actorFallback = "Backend Office") => {
    const { actor, actorEmail } = actorContext(actorFallback);
    const timestamp = nowIso();
    const newCode = await generateUniqueCode();
    const next: VendorOnboardingCodeRecord = {
      ...row,
      id: newCode,
      code: newCode,
      status: "issued",
      onboardingStatus: "ISSUED",
      issuedBy: actor,
      issuedByEmail: actorEmail,
      issuedAt: timestamp,
      expiresAt: addDaysIso(7),
      usedAt: null,
      completedAt: null,
      whatsappMessage: buildOnboardingWhatsAppMessage(
        row.vendorName,
        row.vendorId,
        newCode,
      ),
      updatedAt: timestamp,
    };
    const superseded: VendorOnboardingCodeRecord = {
      ...row,
      status: "superseded",
      notes: [row.notes, `Reissued as ${newCode}`].filter(Boolean).join(" | "),
      updatedAt: timestamp,
    };
    const audit = buildAudit(
      row.vendorId,
      newCode,
      "code_regenerated",
      actor,
      actorEmail,
      row,
      next,
      `Old code ${row.code} superseded.`,
    );

    const batch = writeBatch(db);
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.onboardingCodes, row.id),
      clean(superseded),
      { merge: true },
    );
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.onboardingCodes, newCode),
      clean(next),
    );
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.vendors, row.vendorId),
      clean({
        onboardingCode: newCode,
        onboardingStatus: "ISSUED",
        posExpiresAt: next.expiresAt,
        updatedAt: timestamp,
      }),
      { merge: true },
    );
    batch.set(doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.audit, audit.id), clean(audit));
    await batch.commit();
    dataCacheService.clearCache("pos-vendor-onboarding-rows");
    dataCacheService.clearCache("pos-vendor-onboarding-audit");
    return next;
  },

  cancelCode: async (row: VendorOnboardingCodeRecord, actorFallback = "Backend Office") => {
    const { actor, actorEmail } = actorContext(actorFallback);
    const timestamp = nowIso();
    const next: VendorOnboardingCodeRecord = {
      ...row,
      status: "cancelled",
      onboardingStatus: "CANCELLED",
      updatedAt: timestamp,
    };
    const audit = buildAudit(
      row.vendorId,
      row.code,
      "code_cancelled",
      actor,
      actorEmail,
      row,
      next,
      "Code cancelled by Backend Office. Vendor skeleton retained.",
    );

    const batch = writeBatch(db);
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.onboardingCodes, row.id),
      clean(next),
      { merge: true },
    );
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.vendors, row.vendorId),
      clean({
        onboardingStatus: "CANCELLED",
        updatedAt: timestamp,
      }),
      { merge: true },
    );
    batch.set(doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.audit, audit.id), clean(audit));
    await batch.commit();
    dataCacheService.clearCache("pos-vendor-onboarding-rows");
    dataCacheService.clearCache("pos-vendor-onboarding-audit");
  },

  updateLifecycle: async (
    row: VendorOnboardingCodeRecord,
    lifecycle: VendorOnboardingLifecycle,
    actorFallback = "Backend Office",
  ) => {
    if (lifecycle === "READY_FOR_POS") {
      await assertReadyForPos(row.vendorId);
    }
    const { actor, actorEmail } = actorContext(actorFallback);
    const timestamp = nowIso();
    const codeRecord: VendorOnboardingCodeRecord = {
      ...row,
      onboardingStatus: lifecycle,
      status:
        lifecycle === "CANCELLED"
          ? "cancelled"
        : lifecycle === "EXPIRED"
            ? "expired"
            : row.status,
      completedAt: lifecycle === "READY_FOR_POS" ? timestamp : row.completedAt,
      updatedAt: timestamp,
    };
    const audit = buildAudit(
      row.vendorId,
      row.code,
      lifecycle === "READY_FOR_POS"
        ? "onboarding_marked_ready"
        : "activation_changed",
      actor,
      actorEmail,
      row,
      codeRecord,
      lifecycle === "READY_FOR_POS" ? "Marked ready for POS onboarding." : null,
    );

    const batch = writeBatch(db);
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.onboardingCodes, row.id),
      clean(codeRecord),
      { merge: true },
    );
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.vendors, row.vendorId),
      clean({
        onboardingStatus: lifecycle,
        posExpiresAt: codeRecord.expiresAt,
        updatedAt: timestamp,
      }),
      { merge: true },
    );
    batch.set(doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.audit, audit.id), clean(audit));
    await batch.commit();
    dataCacheService.clearCache("pos-vendor-onboarding-rows");
    dataCacheService.clearCache("pos-vendor-onboarding-audit");
  },

  suspendPosAccess: async (
    row: VendorOnboardingCodeRecord,
    actorFallback = "Backend Office",
  ) => {
    const { actor, actorEmail } = actorContext(actorFallback);
    const timestamp = nowIso();
    const before = {
      vendorId: row.vendorId,
      subscriptionStatus: row.posActivationType,
    };
    const after = {
      id: row.vendorId,
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      subscriptionStatus: "suspended",
      updatedAt: timestamp,
      suspendedAt: timestamp,
      suspendedBy: actor,
    };
    const audit = buildAudit(
      row.vendorId,
      row.code,
      "activation_changed",
      actor,
      actorEmail,
      before,
      after,
      "POS access suspended from onboarding support table.",
    );
    const activationLog = buildActivationLog(
      "suspension",
      row.vendorId,
      actor,
      before,
      after,
    );

    const batch = writeBatch(db);
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.subscriptions, row.vendorId),
      clean(after),
      { merge: true },
    );
    batch.set(doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.audit, audit.id), clean(audit));
    batch.set(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.activationLogs, activationLog.id),
      clean(activationLog),
    );
    await batch.commit();
    dataCacheService.clearCache("pos-vendor-onboarding-rows");
    dataCacheService.clearCache("pos-vendor-onboarding-audit");
  },

  logWhatsappAction: async (
    row: VendorOnboardingCodeRecord | null,
    action: "whatsapp_message_copied" | "whatsapp_message_opened",
    notes: string,
    actorFallback = "Backend Office",
  ) => {
    if (!row) return;
    const { actor, actorEmail } = actorContext(actorFallback);
    const audit = buildAudit(
      row.vendorId,
      row.code,
      action,
      actor,
      actorEmail,
      null,
      {
        vendorId: row.vendorId,
        code: row.code,
        rpnPhone: row.rpnPhone || null,
      },
      notes,
    );
    await setDoc(
      doc(db, POS_VENDOR_ONBOARDING_COLLECTIONS.audit, audit.id),
      clean(audit),
    );
  },

  whatsappLink: (phone: string, message: string) => {
    const digits = cleanPhoneForWhatsApp(phone);
    const encoded = encodeURIComponent(message);
    return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  },
};
