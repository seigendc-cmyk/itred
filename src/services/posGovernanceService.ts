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
import { Vendor } from "../types.ts";
import {
  POS_PERMISSION_KEYS,
  PosActivationLog,
  PosActivationLogAction,
  PosBranch,
  PosEntitlementSnapshot,
  PosGovernanceData,
  PosPlan,
  PosRole,
  PosStaffAccess,
  PosSubscriptionStatus,
  PosTerminal,
  PosWarehouse,
  VendorPosSubscription,
} from "../types/posGovernance.ts";

export const POS_COLLECTIONS = {
  plans: "posPlans",
  subscriptions: "vendorPosSubscriptions",
  branches: "posBranches",
  warehouses: "posWarehouses",
  terminals: "posTerminals",
  staffAccess: "posStaffAccess",
  roles: "posRoles",
  entitlementSnapshots: "posEntitlementSnapshots",
  activationLogs: "posActivationLogs",
} as const;

type ActorContext = {
  actor?: string;
  actorEmail?: string | null;
};

type ActivationInput = ActorContext & {
  vendorId: string;
  planId: string;
  subscriptionStatus: Extract<PosSubscriptionStatus, "trial" | "active">;
  paymentReference?: string;
  activationSource?: string;
  expiresAt?: string;
};

const nowIso = () => new Date().toISOString();

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, Number(days) || 0));
  return date.toISOString();
};

const clean = <T>(value: T): T => stripUndefined(value);

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const DEFAULT_READ_LIMIT = 250;
const ACTIVATION_LOG_LIMIT = 200;
const POS_CACHE_TTL_MS = 30 * 1000;

const generateTemporaryAccessCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const actorContext = () => {
  try {
    const raw = localStorage.getItem("activeStaffSession");
    const session = raw ? JSON.parse(raw) : null;
    return {
      actor:
        session?.staffName ||
        session?.displayName ||
        session?.fullName ||
        "Console Admin",
      actorEmail: session?.email || session?.googleEmailAllowed || null,
    };
  } catch {
    return { actor: "Console Admin", actorEmail: null };
  }
};

const normalizeCode = (value: string) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

const normalizeCompare = (value: unknown) =>
  String(value || "").trim().toLowerCase();

const readCollection = async <T>(
  collectionName: string,
  readLimit = DEFAULT_READ_LIMIT,
): Promise<T[]> => {
  const snapshot = await getDocs(
    query(collection(db, collectionName), orderBy(documentId()), limit(readLimit)),
  );
  return snapshot.docs.map((row) => ({ id: row.id, ...row.data() }) as T);
};

const readVendor = async (vendorId: string): Promise<Vendor | null> => {
  const direct = await getDoc(doc(db, "itred_vendors", vendorId));
  if (direct.exists()) return { id: direct.id, ...direct.data() } as Vendor;

  const [idMatches, vendorIdMatches] = await Promise.all([
    getDocs(query(collection(db, "itred_vendors"), where("id", "==", vendorId), limit(1))),
    getDocs(
      query(collection(db, "itred_vendors"), where("vendorId", "==", vendorId), limit(1)),
    ),
  ]);
  const match = idMatches.docs[0] || vendorIdMatches.docs[0];

  return match ? ({ id: match.id, ...match.data() } as Vendor) : null;
};

const buildEntitlementSnapshot = (
  plan: PosPlan,
  subscriptionStatus: PosSubscriptionStatus,
  vendorId: string,
): PosEntitlementSnapshot => {
  const timestamp = nowIso();
  return {
    id: makeId(`snapshot-${vendorId}`),
    vendorId,
    planId: plan.planId,
    planName: plan.planName,
    subscriptionStatus,
    generatedAt: timestamp,
    limits: {
      maxBranches: plan.maxBranches,
      maxWarehouses: plan.maxWarehouses,
      maxTerminals: plan.maxTerminals,
      maxStaff: plan.maxStaff,
      maxProducts: plan.maxProducts,
    },
    features: {
      allowOfflineMode: plan.allowOfflineMode,
      allowCreditSales: plan.allowCreditSales,
      allowLaybye: plan.allowLaybye,
      allowReturns: plan.allowReturns,
      allowAssembly: plan.allowAssembly,
      allowConsignment: plan.allowConsignment,
      allowFinanceManager: plan.allowFinanceManager,
      allowBI: plan.allowBI,
      allowMarketplacePublish: plan.allowMarketplacePublish,
      allowPoolWisePublish: plan.allowPoolWisePublish,
      allowFiscalization: plan.allowFiscalization,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const logRecord = (
  action: PosActivationLogAction,
  vendorId: string,
  actor: string,
  before: unknown,
  after: unknown,
): PosActivationLog => {
  const timestamp = nowIso();
  return {
    id: makeId(`pos-log-${vendorId}`),
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

export const posGovernanceService = {
  getPlans: () =>
    dataCacheService.getOrFetch("pos-governance-plans", POS_CACHE_TTL_MS, () =>
      readCollection<PosPlan>(POS_COLLECTIONS.plans),
    ),

  getActivePlans: async () => {
    const plans = await posGovernanceService.getPlans();
    return plans.filter((plan) => plan.status === "active");
  },

  getData: async (): Promise<PosGovernanceData> => {
    return dataCacheService.getOrFetch("pos-governance-data", POS_CACHE_TTL_MS, async () => {
    const [
      plans,
      subscriptions,
      branches,
      warehouses,
      terminals,
      staffAccess,
      roles,
      entitlementSnapshots,
      activationLogs,
    ] = await Promise.all([
      readCollection<PosPlan>(POS_COLLECTIONS.plans),
      readCollection<VendorPosSubscription>(POS_COLLECTIONS.subscriptions),
      readCollection<PosBranch>(POS_COLLECTIONS.branches),
      readCollection<PosWarehouse>(POS_COLLECTIONS.warehouses),
      readCollection<PosTerminal>(POS_COLLECTIONS.terminals),
      readCollection<PosStaffAccess>(POS_COLLECTIONS.staffAccess),
      readCollection<PosRole>(POS_COLLECTIONS.roles),
      readCollection<PosEntitlementSnapshot>(
        POS_COLLECTIONS.entitlementSnapshots,
      ),
      readCollection<PosActivationLog>(POS_COLLECTIONS.activationLogs, ACTIVATION_LOG_LIMIT),
    ]);

    return {
      plans,
      subscriptions,
      branches,
      warehouses,
      terminals,
      staffAccess,
      roles,
      entitlementSnapshots,
      activationLogs,
    };
    });
  },

  savePlan: async (input: Partial<PosPlan>, actor = "Console Admin") => {
    const timestamp = nowIso();
    const planId = normalizeCode(input.planId || input.planName || makeId("POS"));
    const id = input.id || planId.toLowerCase();
    const existing = await getDoc(doc(db, POS_COLLECTIONS.plans, id));
    const plan: PosPlan = {
      id,
      planId,
      planName: input.planName || planId,
      monthlyPrice: Number(input.monthlyPrice) || 0,
      trialDays: Number(input.trialDays) || 0,
      maxBranches: Number(input.maxBranches) || 1,
      maxWarehouses: Number(input.maxWarehouses) || 1,
      maxTerminals: Number(input.maxTerminals) || 1,
      maxStaff: Number(input.maxStaff) || 1,
      maxProducts: Number(input.maxProducts) || 0,
      allowOfflineMode: !!input.allowOfflineMode,
      allowCreditSales: !!input.allowCreditSales,
      allowLaybye: !!input.allowLaybye,
      allowReturns: !!input.allowReturns,
      allowAssembly: !!input.allowAssembly,
      allowConsignment: !!input.allowConsignment,
      allowFinanceManager: !!input.allowFinanceManager,
      allowBI: !!input.allowBI,
      allowMarketplacePublish: !!input.allowMarketplacePublish,
      allowPoolWisePublish: !!input.allowPoolWisePublish,
      allowFiscalization: !!input.allowFiscalization,
      status: input.status || "active",
      createdAt: (existing.data()?.createdAt as string) || timestamp,
      updatedAt: timestamp,
      createdBy: (existing.data()?.createdBy as string) || actor,
      updatedBy: actor,
    };

    await setDoc(doc(db, POS_COLLECTIONS.plans, id), clean(plan), {
      merge: true,
    });
    dataCacheService.clearCache("pos-governance-plans");
    dataCacheService.clearCache("pos-governance-data");
    return plan;
  },

  updatePlanStatus: async (plan: PosPlan, status: PosPlan["status"], actor?: string) => {
    return posGovernanceService.savePlan({ ...plan, status }, actor);
  },

  duplicatePlan: async (plan: PosPlan, actor?: string) => {
    return posGovernanceService.savePlan(
      {
        ...plan,
        id: undefined,
        planId: `${plan.planId}-COPY-${Date.now()}`,
        planName: `${plan.planName} Copy`,
        status: "inactive",
      },
      actor,
    );
  },

  activateVendor: async (input: ActivationInput) => {
    const actor = input.actor || "Console Admin";
    const timestamp = nowIso();
    const vendor = await readVendor(input.vendorId);
    if (!vendor) throw new Error("Vendor record was not found.");

    const plan = await getDoc(doc(db, POS_COLLECTIONS.plans, input.planId));
    if (!plan.exists()) throw new Error("POS plan was not found.");
    const posPlan = { id: plan.id, ...plan.data() } as PosPlan;
    if (posPlan.status !== "active") throw new Error("POS plan is not active.");

    const vendorId = vendor.id || input.vendorId;
    const vendorName = vendor.tradingName || vendor.name || vendorId;
    const subscriptionId = vendorId;
    const oldSubscription = await getDoc(
      doc(db, POS_COLLECTIONS.subscriptions, subscriptionId),
    );
    const trialEndsAt =
      input.subscriptionStatus === "trial" ? addDaysIso(posPlan.trialDays) : null;

    const subscription: VendorPosSubscription = {
      id: subscriptionId,
      vendorId,
      vendorName,
      planId: posPlan.planId,
      planName: posPlan.planName,
      subscriptionStatus: input.subscriptionStatus,
      activatedAt:
        (oldSubscription.data()?.activatedAt as string | undefined) || timestamp,
      expiresAt: input.expiresAt || null,
      trialEndsAt,
      paymentReference: input.paymentReference || null,
      activationSource: input.activationSource || "console",
      activatedBy: actor,
      suspendedAt: null,
      suspensionReason: null,
      createdAt: (oldSubscription.data()?.createdAt as string) || timestamp,
      updatedAt: timestamp,
    };

    const existingBranches = await getDocs(
      query(collection(db, POS_COLLECTIONS.branches), where("vendorId", "==", vendorId), limit(1)),
    );
    const existingWarehouses = await getDocs(
      query(
        collection(db, POS_COLLECTIONS.warehouses),
        where("vendorId", "==", vendorId),
        limit(1),
      ),
    );
    const existingRoles = await getDocs(
      query(collection(db, POS_COLLECTIONS.roles), where("vendorId", "==", vendorId), limit(1)),
    );
    const existingTerminals = await getDocs(
      query(
        collection(db, POS_COLLECTIONS.terminals),
        where("vendorId", "==", vendorId),
        limit(1),
      ),
    );

    const defaultBranchId = `${vendorId}-main-branch`;
    const defaultWarehouseId = `${vendorId}-main-warehouse`;
    const defaultRoleId = `${vendorId}-sysadmin`;
    const defaultTerminalId = `${vendorId}-main-terminal`;
    const branchCode = `${normalizeCode(vendorName).slice(0, 12) || "MAIN"}-BR01`;
    const timestampFields = { createdAt: timestamp, updatedAt: timestamp };
    const defaultBranch: PosBranch = {
      id: defaultBranchId,
      vendorId,
      branchName: "Main Branch",
      branchCode,
      branchType: "shop",
      address: vendor.streetAddress || "",
      district: vendor.district || "",
      suburb: vendor.suburb || "",
      status: "active",
      branchAccessPassKey: `BR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ...timestampFields,
    };
    const defaultWarehouse: PosWarehouse = {
      id: defaultWarehouseId,
      vendorId,
      warehouseName: "Main Warehouse",
      warehouseCode: `${branchCode}-WH01`,
      address: vendor.streetAddress || "",
      district: vendor.district || "",
      suburb: vendor.suburb || "",
      isDefault: true,
      status: "active",
      ...timestampFields,
    };
    const defaultRole: PosRole = {
      id: defaultRoleId,
      vendorId,
      roleName: "SysAdmin",
      permissions: [...POS_PERMISSION_KEYS],
      status: "active",
      ...timestampFields,
    };
    const defaultTerminal: PosTerminal = {
      id: defaultTerminalId,
      vendorId,
      branchId: defaultBranchId,
      terminalName: "Main Terminal",
      terminalCode: `${branchCode}-T01`,
      deskName: "Cashier Desk 1",
      status: "active",
      terminalAccessCode: `TM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      deviceBindingStatus: "unbound",
      lastSeenAt: null,
      ...timestampFields,
    };
    const snapshot = buildEntitlementSnapshot(
      posPlan,
      input.subscriptionStatus,
      vendorId,
    );

    const batch = writeBatch(db);
    batch.set(
      doc(db, POS_COLLECTIONS.subscriptions, subscriptionId),
      clean(subscription),
      { merge: true },
    );
    batch.set(
      doc(db, POS_COLLECTIONS.entitlementSnapshots, snapshot.id),
      clean(snapshot),
      { merge: true },
    );
    batch.set(
      doc(db, POS_COLLECTIONS.activationLogs, makeId(`pos-log-${vendorId}`)),
      clean(logRecord("activation", vendorId, actor, oldSubscription.data() || null, subscription)),
    );
    batch.set(
      doc(db, POS_COLLECTIONS.activationLogs, makeId(`pos-log-${vendorId}`)),
      clean(logRecord("entitlement_snapshot_creation", vendorId, actor, null, snapshot)),
    );

    if (existingBranches.empty) {
      batch.set(doc(db, POS_COLLECTIONS.branches, defaultBranch.id), clean(defaultBranch));
      batch.set(
        doc(db, POS_COLLECTIONS.activationLogs, makeId(`pos-log-${vendorId}`)),
        clean(logRecord("branch_creation", vendorId, actor, null, defaultBranch)),
      );
    }
    if (existingWarehouses.empty) {
      batch.set(
        doc(db, POS_COLLECTIONS.warehouses, defaultWarehouse.id),
        clean(defaultWarehouse),
      );
      batch.set(
        doc(db, POS_COLLECTIONS.activationLogs, makeId(`pos-log-${vendorId}`)),
        clean(logRecord("warehouse_creation", vendorId, actor, null, defaultWarehouse)),
      );
    }
    if (existingRoles.empty) {
      batch.set(doc(db, POS_COLLECTIONS.roles, defaultRole.id), clean(defaultRole));
      batch.set(
        doc(db, POS_COLLECTIONS.activationLogs, makeId(`pos-log-${vendorId}`)),
        clean(logRecord("role_change", vendorId, actor, null, defaultRole)),
      );
    }
    if (existingTerminals.empty) {
      batch.set(
        doc(db, POS_COLLECTIONS.terminals, defaultTerminal.id),
        clean(defaultTerminal),
      );
      batch.set(
        doc(db, POS_COLLECTIONS.activationLogs, makeId(`pos-log-${vendorId}`)),
        clean(logRecord("terminal_creation", vendorId, actor, null, defaultTerminal)),
      );
    }

    await batch.commit();
    dataCacheService.clearCache("pos-governance-data");
    return subscription;
  },

  updateSubscriptionStatus: async (
    subscription: VendorPosSubscription,
    status: PosSubscriptionStatus,
    actor = "Console Admin",
  ) => {
    const before = subscription;
    const after: VendorPosSubscription = {
      ...subscription,
      subscriptionStatus: status,
      suspendedAt: status === "suspended" ? nowIso() : null,
      updatedAt: nowIso(),
    };
    const action: PosActivationLogAction =
      status === "suspended"
        ? "suspension"
        : status === "active"
          ? "reactivation"
          : "renewal";

    const batch = writeBatch(db);
    batch.set(
      doc(db, POS_COLLECTIONS.subscriptions, after.id),
      clean(after),
      { merge: true },
    );
    batch.set(
      doc(db, POS_COLLECTIONS.activationLogs, makeId(`pos-log-${after.vendorId}`)),
      clean(logRecord(action, after.vendorId, actor, before, after)),
    );
    await batch.commit();
    dataCacheService.clearCache("pos-governance-data");
  },

  saveBranch: async (input: Partial<PosBranch>, actor?: string) => {
    const timestamp = nowIso();
    const id = input.id || makeId(`branch-${input.vendorId || "vendor"}`);
    const branch: PosBranch = {
      id,
      vendorId: input.vendorId || "",
      branchName: input.branchName || "New Branch",
      branchCode: normalizeCode(input.branchCode || input.branchName || id),
      branchType: input.branchType || "shop",
      address: input.address || "",
      district: input.district || "",
      suburb: input.suburb || "",
      status: input.status || "active",
      branchAccessPassKey: input.branchAccessPassKey || null,
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(db, POS_COLLECTIONS.branches, id), clean(branch), {
      merge: true,
    });
    await posGovernanceService.addLog("branch_creation", branch.vendorId, actor, null, branch);
    return branch;
  },

  saveWarehouse: async (input: Partial<PosWarehouse>, actor?: string) => {
    const timestamp = nowIso();
    const id = input.id || makeId(`warehouse-${input.vendorId || "vendor"}`);
    const warehouse: PosWarehouse = {
      id,
      vendorId: input.vendorId || "",
      warehouseName: input.warehouseName || "New Warehouse",
      warehouseCode: normalizeCode(input.warehouseCode || input.warehouseName || id),
      address: input.address || "",
      district: input.district || "",
      suburb: input.suburb || "",
      isDefault: !!input.isDefault,
      status: input.status || "active",
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(db, POS_COLLECTIONS.warehouses, id), clean(warehouse), {
      merge: true,
    });
    await posGovernanceService.addLog(
      "warehouse_creation",
      warehouse.vendorId,
      actor,
      null,
      warehouse,
    );
    return warehouse;
  },

  saveTerminal: async (input: Partial<PosTerminal>, actor?: string) => {
    const timestamp = nowIso();
    const id = input.id || makeId(`terminal-${input.vendorId || "vendor"}`);
    const terminal: PosTerminal = {
      id,
      vendorId: input.vendorId || "",
      branchId: input.branchId || "",
      terminalName: input.terminalName || "New Terminal",
      terminalCode: normalizeCode(input.terminalCode || input.terminalName || id),
      deskName: input.deskName || "Cashier Desk",
      status: input.status || "active",
      terminalAccessCode: input.terminalAccessCode || null,
      deviceBindingStatus: input.deviceBindingStatus || "unbound",
      lastSeenAt: input.lastSeenAt || null,
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(db, POS_COLLECTIONS.terminals, id), clean(terminal), {
      merge: true,
    });
    await posGovernanceService.addLog("terminal_creation", terminal.vendorId, actor, null, terminal);
    return terminal;
  },

  saveRole: async (input: Partial<PosRole>, actor?: string) => {
    const timestamp = nowIso();
    const id = input.id || makeId(`role-${input.vendorId || "vendor"}`);
    const role: PosRole = {
      id,
      vendorId: input.vendorId || "",
      roleName: input.roleName || "POS Role",
      permissions: input.permissions || [],
      status: input.status || "active",
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(db, POS_COLLECTIONS.roles, id), clean(role), {
      merge: true,
    });
    await posGovernanceService.addLog("role_change", role.vendorId, actor, null, role);
    return role;
  },

  saveStaffAccess: async (input: Partial<PosStaffAccess>, actor?: string) => {
    const timestamp = nowIso();
    const id = input.id || makeId(`access-${input.vendorId || "vendor"}`);
    const vendorId = input.vendorId || "";
    if (!vendorId) throw new Error("Private tenant is required.");
    if (!input.displayName?.trim()) throw new Error("Display name is required.");

    const vendor = await readVendor(vendorId);
    const vendorCode = input.vendorCode || vendor?.vendorCode || vendor?.id || vendorId;
    const vendorName = input.vendorName || vendor?.tradingName || vendor?.name || vendorId;
    const branchId = input.branchId || input.branchIds?.[0] || "";
    const terminalId = input.terminalId || input.terminalIds?.[0] || "";
    if (!branchId) throw new Error("Branch assignment is required.");
    if (!terminalId) throw new Error("Terminal assignment is required.");

    const [branchSnap, terminalSnap] = await Promise.all([
      getDoc(doc(db, POS_COLLECTIONS.branches, branchId)),
      getDoc(doc(db, POS_COLLECTIONS.terminals, terminalId)),
    ]);
    if (!branchSnap.exists()) throw new Error("Selected branch record was not found.");
    if (!terminalSnap.exists()) throw new Error("Selected terminal record was not found.");

    const branch = { id: branchSnap.id, ...branchSnap.data() } as PosBranch;
    const terminal = { id: terminalSnap.id, ...terminalSnap.data() } as PosTerminal;
    if (branch.vendorId !== vendorId) throw new Error("Selected branch does not belong to this private tenant.");
    if (terminal.vendorId !== vendorId) throw new Error("Selected terminal does not belong to this private tenant.");
    if (terminal.branchId && terminal.branchId !== branchId) {
      throw new Error("Selected terminal is not assigned to the selected branch.");
    }

    let roleId = input.roleId || "";
    let roleName = input.roleName || "";
    let permissions = input.permissions || [];
    if (roleId) {
      const roleSnap = await getDoc(doc(db, POS_COLLECTIONS.roles, roleId));
      if (!roleSnap.exists()) throw new Error("Selected role record was not found.");
      const role = { id: roleSnap.id, ...roleSnap.data() } as PosRole;
      if (role.vendorId !== vendorId) throw new Error("Selected role does not belong to this private tenant.");
      roleName = role.roleName;
      permissions = role.permissions || [];
    } else {
      const sysAdminQuery = await getDocs(
        query(
          collection(db, POS_COLLECTIONS.roles),
          where("vendorId", "==", vendorId),
          where("roleName", "==", "SysAdmin"),
          limit(1),
        ),
      );
      if (sysAdminQuery.empty) {
        const role = await posGovernanceService.saveRole(
          {
            id: `${vendorId}-sysadmin`,
            vendorId,
            roleName: "SysAdmin",
            permissions: [...POS_PERMISSION_KEYS],
            status: "active",
          },
          actor,
        );
        roleId = role.id;
        roleName = role.roleName;
        permissions = role.permissions;
      } else {
        const role = {
          id: sysAdminQuery.docs[0].id,
          ...sysAdminQuery.docs[0].data(),
        } as PosRole;
        roleId = role.id;
        roleName = role.roleName;
        permissions = role.permissions || [];
      }
    }

    const existingAccess = await getDocs(
      query(collection(db, POS_COLLECTIONS.staffAccess), where("vendorId", "==", vendorId), limit(100)),
    );
    const displayNameKey = normalizeCompare(input.displayName);
    const emailKey = normalizeCompare(input.email);
    const duplicate = existingAccess.docs
      .map((row) => ({ id: row.id, ...row.data() }) as PosStaffAccess)
      .find((row) => {
        if (row.id === id) return false;
        const sameTerminal =
          row.terminalId === terminalId || (row.terminalIds || []).includes(terminalId);
        const sameName = normalizeCompare(row.displayName) === displayNameKey;
        const sameEmail = !!emailKey && normalizeCompare(row.email) === emailKey;
        return row.status === "active" && sameTerminal && (sameName || sameEmail);
      });
    if (duplicate) {
      throw new Error(`Duplicate active staff access exists for this private tenant, staff identity and terminal. Edit existing record ${duplicate.id} instead.`);
    }

    const beforeSnap = await getDoc(doc(db, POS_COLLECTIONS.staffAccess, id));
    const before = beforeSnap.exists() ? { id: beforeSnap.id, ...beforeSnap.data() } : null;
    // TODO: Replace temporaryAccessCode with a secure hashed PIN flow.
    const temporaryAccessCode =
      input.temporaryAccessCode || input.accessCode || generateTemporaryAccessCode();
    const { actor: currentActor, actorEmail } = actorContext();
    const createdBy = input.createdBy || actor || currentActor;
    const access: PosStaffAccess = {
      id,
      vendorId,
      vendorCode,
      vendorName,
      staffId: input.staffId || id,
      displayName: input.displayName || "POS Staff",
      email: input.email || "",
      phone: input.phone || "",
      branchId,
      branchName: input.branchName || branch.branchName,
      branchIds: [branchId],
      terminalId,
      terminalName: input.terminalName || terminal.terminalName,
      terminalIds: [terminalId],
      roleId,
      roleName,
      permissions,
      temporaryAccessCode,
      accessCode: temporaryAccessCode,
      accessCodeLastResetAt: input.accessCodeLastResetAt || timestamp,
      pinMode: input.pinMode || "temporary_plaintext_prototype",
      accessStatus: input.accessStatus || "active",
      status: input.status || "active",
      notes: input.notes || "",
      mustChangePin: input.mustChangePin ?? true,
      accessCodePlaceholder:
        input.accessCodePlaceholder || "Temporary code issued by Backend Office",
      pinPlaceholder: input.pinPlaceholder || "Temporary PIN stored pending secure hash flow",
      lastLoginAt: input.lastLoginAt || null,
      createdBy,
      createdByEmail: input.createdByEmail || actorEmail || null,
      source: input.source || "backend_office_staff_setup",
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(db, POS_COLLECTIONS.staffAccess, id), clean(access), {
      merge: true,
    });
    await posGovernanceService.addLog(
      "staff_access_change",
      access.vendorId,
      actor,
      before,
      access,
    );
    return access;
  },

  addLog: async (
    action: PosActivationLogAction,
    vendorId: string,
    actor = "Console Admin",
    before: unknown,
    after: unknown,
  ) => {
    const log = logRecord(action, vendorId, actor, before, after);
    await setDoc(doc(db, POS_COLLECTIONS.activationLogs, log.id), clean(log));
    return log;
  },
};
