import { Staff, MenuPermissions } from "../types.ts";
import { localStorageService } from "./localStorageService.ts";
import { analyticsService } from "./analyticsService.ts";
import { db } from "../lib/firebase.ts";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

const STAFF_KEY = "itred_staff_records";
const ROLE_TEMPLATES_KEY = "itred_role_templates";
const FIRESTORE_STAFF_COLLECTION = "itred_console_staff";
const FIRESTORE_SETTINGS_COLLECTION = "itred_system_settings";

const removeUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }

  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item !== undefined) {
        cleaned[key] = removeUndefinedDeep(item);
      }
    });

    return cleaned as T;
  }

  return value;
};

const buildFirestoreStaffPayload = (staff: Staff) => {
  return removeUndefinedDeep({
    ...staff,
    updatedAt: staff.updatedAt || new Date().toISOString(),
    firestoreUpdatedAt: serverTimestamp(),
  });
};

const getLocalStaff = (): Staff[] => {
  const storedStaff = localStorageService.get<Staff[]>(STAFF_KEY);

  if (!Array.isArray(storedStaff)) {
    return [];
  }

  return storedStaff;
};

const saveLocalStaff = (staffList: Staff[]) => {
  localStorageService.set(STAFF_KEY, staffList);
};

const upsertLocalStaff = (staff: Staff) => {
  const allStaff = getLocalStaff();
  const index = allStaff.findIndex((item) => item.id === staff.id);

  if (index >= 0) {
    allStaff[index] = staff;
  } else {
    allStaff.push(staff);
  }

  saveLocalStaff(allStaff);
};

const syncStaffToFirestore = async (staff: Staff): Promise<void> => {
  const docId = staff.id || staff.staffCode || `staff-${Date.now()}`;

  await setDoc(
    doc(db, FIRESTORE_STAFF_COLLECTION, docId),
    buildFirestoreStaffPayload({
      ...staff,
      id: docId,
    } as Staff),
    { merge: true },
  );
};

const loadStaffFromFirestore = async (): Promise<Staff[]> => {
  const snapshot = await getDocs(collection(db, FIRESTORE_STAFF_COLLECTION));

  return snapshot.docs.map((staffDoc) => {
    const data = staffDoc.data() as Partial<Staff>;

    return {
      ...data,
      id: data.id || staffDoc.id,
      docId: staffDoc.id,
      firestoreDocId: staffDoc.id,
    } as Staff;
  });
};

const validateUniqueStaffIdentity = async (staff: Staff): Promise<void> => {
  let remoteStaff: Staff[] = [];
  try {
    remoteStaff = await loadStaffFromFirestore();
  } catch (e) {
    remoteStaff = getLocalStaff();
  }

  const isSameStaff = (s: Staff, target: Staff) => {
    if (s.id === target.id) return true;
    if (s.docId && s.docId === target.id) return true;
    if (target.docId && s.id === target.docId) return true;
    if (s.firestoreDocId && s.firestoreDocId === target.id) return true;
    if (target.firestoreDocId && s.id === target.firestoreDocId) return true;
    if (
      s.firestoreDocId &&
      target.firestoreDocId &&
      s.firestoreDocId === target.firestoreDocId
    )
      return true;
    if (
      s.email &&
      target.email &&
      s.email.toLowerCase() === target.email.toLowerCase() &&
      s.staffCode === target.staffCode
    )
      return true;
    return false;
  };

  const codeDuplicate = remoteStaff.find(
    (s) => s.staffCode === staff.staffCode && !isSameStaff(s, staff),
  );
  if (codeDuplicate) {
    throw new Error(
      "This staff number already exists on another staff record. Please click Generate New Staff Code or repair duplicate staff records.",
    );
  }

  if (staff.email && staff.email.trim() !== "") {
    const emailDuplicate = remoteStaff.find(
      (s) =>
        s.email?.toLowerCase() === staff.email?.toLowerCase() &&
        !isSameStaff(s, staff) &&
        s.status === "active",
    );
    if (emailDuplicate) {
      throw new Error(
        "Duplicate staff email found. This email is already attached to another staff member.",
      );
    }
  }
};

// Mock initial staff data
const DEFAULT_STAFF: Staff[] = [
  {
    id: "STAFF-001",
    staffCode: "ITR-STF-DEMO-0001",
    fullName: "Alice Johnson (SysAdmin)",
    role: "Admin",
    phone: "+263771234567",
    whatsapp: "+263771234567",
    email: "alice.admin@itred.com",
    assignedBranchId: "BR-MAIN",
    passcode: "123456",
    failedAttemptCount: 0,
    isLocked: false,
    status: "active",
    displayName: "Alice Admin",
    desk: "SysAdmin Desk",
    menuPermissions: {
      dashboard: "full",
      vendorManagement: "full",
      addNewVendor: "full",
      rpnManagement: "full",
      addNewAgent: "full",
      productManagement: "full",
      addNewProduct: "full",
      productList: "full",
      accessHub: "full",
      cahBooths: "full",
      pricing: "full",
      subscriptionsCollections: "full",
      collectionCalendar: "full",
      createCatalogue: "full",
      createStorefront: "full",
      inventorySpotChecks: "full",
      analytics: "full",
      biMarketAnalytics: "full",
      performanceMetrics: "full",
      activityLogs: "full",
      adminDashboard: "full",
      staffManagement: "full",
      roleMenuPermissions: "full",
      staffAccessLogs: "full",
      systemSettings: "full",
    },
    createdBy: "system",
    updatedBy: "system",
    createdAt: "2023-10-01T08:00:00Z",
    updatedAt: "2023-10-01T08:00:00Z",
  },
  {
    id: "STAFF-002",
    staffCode: "ITR-STF-DEMO-0002",
    fullName: "Bob Williams (RPN Manager)",
    role: "RPN Manager",
    phone: "+263772345678",
    whatsapp: "+263772345678",
    email: "bob.rpn@itred.com",
    assignedBranchId: "BR-HARARE",
    passcode: "222333",
    failedAttemptCount: 0,
    isLocked: false,
    status: "active",
    displayName: "Bob RPN",
    desk: "RPN Management Desk",
    menuPermissions: {
      dashboard: "view",
      rpnManagement: "full",
      addNewAgent: "create",
      vendorManagement: "edit",
      subscriptionsCollections: "edit",
      collectionCalendar: "view",
      inventorySpotChecks: "full",
      analytics: "view",
    },
    createdBy: "system",
    updatedBy: "system",
    createdAt: "2023-10-02T09:00:00Z",
    updatedAt: "2023-10-02T09:00:00Z",
  },
  {
    id: "STAFF-003",
    staffCode: "ITR-STF-DEMO-0003",
    fullName: "Charlie Brown (Backoffice)",
    role: "Backoffice Operator",
    phone: "+263773456789",
    whatsapp: "+263773456789",
    email: "charlie.bo@itred.com",
    assignedBranchId: "BR-BULAWAYO",
    passcode: "112233",
    failedAttemptCount: 0,
    isLocked: false,
    status: "suspended",
    displayName: "Charlie B.O.",
    desk: "Backoffice Desk",
    menuPermissions: {
      dashboard: "full",
      vendorManagement: "edit",
      addNewVendor: "create",
      productManagement: "edit",
      addNewProduct: "create",
      productList: "edit",
      createCatalogue: "export",
      createStorefront: "export",
      accessHub: "view",
      subscriptionsCollections: "view",
      activityLogs: "view",
      pricing: "view",
      inventorySpotChecks: "view",
    },
    createdBy: "system",
    updatedBy: "system",
    createdAt: "2023-10-03T10:00:00Z",
    updatedAt: "2023-10-03T10:00:00Z",
  },
  {
    id: "STAFF-004",
    staffCode: "ITR-STF-DEMO-0004",
    fullName: "Diana Prince (Locked Account)",
    role: "Backoffice Operator",
    phone: "+263774567890",
    whatsapp: "+263774567890",
    email: "diana.locked@itred.com",
    assignedBranchId: "BR-MAIN",
    passcode: "000000",
    failedAttemptCount: 5,
    isLocked: true,
    status: "active",
    displayName: "Diana Locked",
    desk: "Backoffice Desk",
    menuPermissions: {
      dashboard: "full",
      vendorManagement: "edit",
      addNewVendor: "create",
      productManagement: "edit",
      addNewProduct: "create",
      productList: "edit",
      createCatalogue: "export",
      createStorefront: "export",
      accessHub: "view",
      subscriptionsCollections: "view",
      activityLogs: "view",
      pricing: "view",
      inventorySpotChecks: "view",
    },
    createdBy: "system",
    updatedBy: "system",
    createdAt: "2023-10-04T11:00:00Z",
    updatedAt: "2023-10-04T11:00:00Z",
  },
];

const ROLE_TEMPLATES_OBJECT: Record<string, MenuPermissions> = {
  SysAdmin: {
    dashboard: "full",
    vendorManagement: "full",
    addNewVendor: "full",
    rpnManagement: "full",
    addNewAgent: "full",
    productManagement: "full",
    addNewProduct: "full",
    productList: "full",
    accessHub: "full",
    cahBooths: "full",
    pricing: "full",
    subscriptionsCollections: "full",
    collectionCalendar: "full",
    createCatalogue: "full",
    createStorefront: "full",
    inventorySpotChecks: "full",
    analytics: "full",
    biMarketAnalytics: "full",
    performanceMetrics: "full",
    activityLogs: "full",
    adminDashboard: "full",
    staffManagement: "full",
    roleMenuPermissions: "full",
    staffAccessLogs: "full",
    systemSettings: "full",
    rpnPerformance: "full",
    howTo: "view",
  },
  Admin: {
    dashboard: "full",
    vendorManagement: "full",
    addNewVendor: "full",
    rpnManagement: "full",
    addNewAgent: "full",
    productManagement: "full",
    addNewProduct: "full",
    productList: "full",
    accessHub: "full",
    cahBooths: "full",
    pricing: "full",
    subscriptionsCollections: "full",
    collectionCalendar: "full",
    createCatalogue: "full",
    createStorefront: "full",
    inventorySpotChecks: "full",
    analytics: "full",
    biMarketAnalytics: "full",
    performanceMetrics: "full",
    activityLogs: "full",
    adminDashboard: "full",
    staffManagement: "full",
    roleMenuPermissions: "full",
    staffAccessLogs: "full",
    systemSettings: "full",
    rpnPerformance: "full",
    howTo: "view",
  },
  "Backoffice Operator": {
    dashboard: "full",
    vendorManagement: "edit",
    addNewVendor: "create",
    productManagement: "edit",
    addNewProduct: "create",
    productList: "edit",
    createCatalogue: "export",
    createStorefront: "export",
    accessHub: "view",
    subscriptionsCollections: "view",
    activityLogs: "view",
    pricing: "view",
    inventorySpotChecks: "view",
  },
  "Product Data Clerk": {
    dashboard: "view",
    productManagement: "edit",
    addNewProduct: "create",
    productList: "edit",
    vendorManagement: "view",
    createCatalogue: "view",
  },
  "Catalogue Officer": {
    dashboard: "view",
    vendorManagement: "view",
    productManagement: "view",
    productList: "view",
    createCatalogue: "full",
    createStorefront: "full",
    accessHub: "view",
    analytics: "view",
  },
  "Collections Officer": {
    dashboard: "view",
    subscriptionsCollections: "full",
    collectionCalendar: "full",
    vendorManagement: "view",
    activityLogs: "view",
  },
  "RPN Manager": {
    dashboard: "view",
    rpnManagement: "full",
    addNewAgent: "create",
    vendorManagement: "edit",
    subscriptionsCollections: "edit",
    collectionCalendar: "view",
    inventorySpotChecks: "full",
    analytics: "view",
    rpnPerformance: "full",
  },
  "CAH Officer": {
    dashboard: "view",
    accessHub: "full",
    cahBooths: "full",
    createCatalogue: "view",
    analytics: "view",
  },
  "BI Analyst": {
    dashboard: "view",
    analytics: "full",
    biMarketAnalytics: "full",
    performanceMetrics: "full",
    activityLogs: "view",
  },
  Viewer: {
    dashboard: "view",
    vendorManagement: "view",
    productList: "view",
    accessHub: "view",
    pricing: "view",
    subscriptionsCollections: "view",
    inventorySpotChecks: "view",
    analytics: "view",
    biMarketAnalytics: "view",
    performanceMetrics: "view",
    activityLogs: "view",
    rpnPerformance: "view",
  },
};

export const staffService = {
  getAllStaff: (): Staff[] => {
    return getLocalStaff();
  },

  loadStaffFromFirebase: async (): Promise<Staff[]> => {
    try {
      const remoteStaff = await loadStaffFromFirestore();
      console.log(
        `[Firebase Diagnostic] Loaded ${remoteStaff.length} staff records from Firestore collection: ${FIRESTORE_STAFF_COLLECTION}`,
      );

      saveLocalStaff(remoteStaff);
      return remoteStaff;
    } catch (error) {
      console.warn(
        "Failed to load staff from Firebase. Using local staff records.",
        error,
      );

      return getLocalStaff();
    }
  },

  getStaffById: (id: string): Staff | undefined => {
    return getLocalStaff().find((staff) => staff.id === id);
  },

  isLastActiveSysAdmin: (staffId: string): boolean => {
    const activeAdmins = getLocalStaff().filter(
      (s) =>
        (s.role === "SysAdmin" || s.role === "Admin") &&
        s.status === "active" &&
        s.id !== staffId,
    );
    return activeAdmins.length === 0;
  },

  saveStaff: async (staff: Staff): Promise<void> => {
    const now = new Date().toISOString();
    let staffCode = staff.staffCode;

    if (!staffCode) {
      try {
        staffCode = await staffService.generateUniqueStaffCodeFromFirebase();
      } catch (e) {
        staffCode = staffService.generateStaffCode();
      }
    }

    const staffId = staff.id || staffCode || `STF-${Date.now()}`;

    const staffToSave = removeUndefinedDeep({
      ...staff,
      id: staffId,
      staffCode,
      updatedAt: now,
      createdAt: staff.createdAt || now,
    } as Staff);

    await validateUniqueStaffIdentity(staffToSave);

    upsertLocalStaff(staffToSave);

    try {
      console.log(
        `[Firebase Diagnostic] Saving staff record to Firestore collection: ${FIRESTORE_STAFF_COLLECTION}`,
        staffToSave,
      );
      await syncStaffToFirestore(staffToSave);
    } catch (error) {
      console.error(
        `Failed to save staff ${staffToSave.staffCode || staffToSave.id} to Firebase.`,
        error,
      );
      throw error;
    }
  },

  deleteStaff: (id: string): void => {
    const allStaff = getLocalStaff().filter((staff) => staff.id !== id);
    saveLocalStaff(allStaff);

    void deleteDoc(doc(db, FIRESTORE_STAFF_COLLECTION, id)).catch((error) => {
      console.error(`Failed to delete staff ${id} from Firebase.`, error);
    });
  },

  ROLE_TEMPLATES: ROLE_TEMPLATES_OBJECT,

  ROLE_TO_DESK_MAP: {
    SysAdmin: "SysAdmin Desk",
    Admin: "SysAdmin Desk",
    "Backoffice Operator": "Backoffice Desk",
    "Product Data Clerk": "Product Data Desk",
    "Catalogue Officer": "Catalogue Deployment Desk",
    "Collections Officer": "Collections Desk",
    "RPN Manager": "RPN Management Desk",
    "CAH Officer": "CAH Operations Desk",
    "BI Analyst": "BI & Analytics Desk",
    Viewer: "Viewer Desk",
  } as Record<string, string>,

  getDefaultDesk: (role: string): string => {
    return staffService.ROLE_TO_DESK_MAP[role] || "Viewer Desk";
  },

  getDefaultMenuPermissions: (role: string): MenuPermissions => {
    return staffService.ROLE_TEMPLATES[role] || {};
  },

  generateStaffCode: (): string => {
    const now = new Date();
    const yearMonth =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0");

    const allStaff = getLocalStaff();
    const prefix = `ITR-STF-${yearMonth}-`;

    const existingCodes = allStaff
      .filter(
        (staff) =>
          staff &&
          typeof staff.staffCode === "string" &&
          staff.staffCode.startsWith(prefix),
      )
      .map((staff) => staff.staffCode as string);

    let nextNumber = 1;

    if (existingCodes.length > 0) {
      const numbers = existingCodes
        .map((code) => parseInt(code.split("-").pop() || "0", 10))
        .filter((value) => !Number.isNaN(value))
        .sort((a, b) => b - a);

      nextNumber = (numbers[0] || 0) + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
  },

  generateUniqueStaffCodeFromFirebase: async (): Promise<string> => {
    const now = new Date();
    const yearMonth =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0");

    const prefix = `ITR-STF-${yearMonth}-`;

    let allStaff: Staff[] = [];
    try {
      allStaff = await loadStaffFromFirestore();
    } catch (e) {
      allStaff = getLocalStaff();
    }

    const existingCodes = allStaff
      .filter(
        (staff) =>
          staff &&
          typeof staff.staffCode === "string" &&
          staff.staffCode.startsWith(prefix),
      )
      .map((staff) => staff.staffCode as string);

    let nextNumber = 1;

    if (existingCodes.length > 0) {
      const numbers = existingCodes
        .map((code) => parseInt(code.split("-").pop() || "0", 10))
        .filter((value) => !Number.isNaN(value))
        .sort((a, b) => b - a);

      nextNumber = (numbers[0] || 0) + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
  },

  findDuplicateStaffCodes: async (): Promise<
    { staffCode: string; records: Staff[] }[]
  > => {
    let allStaff: Staff[] = [];
    try {
      allStaff = await staffService.loadStaffFromFirebase();
    } catch {
      allStaff = getLocalStaff();
    }
    const map = new Map<string, Staff[]>();
    for (const staff of allStaff) {
      if (!staff.staffCode) continue;
      const current = map.get(staff.staffCode) || [];
      current.push(staff);
      map.set(staff.staffCode, current);
    }

    const duplicates: { staffCode: string; records: Staff[] }[] = [];
    map.forEach((records, staffCode) => {
      if (records.length > 1) {
        duplicates.push({ staffCode, records });
      }
    });

    return duplicates;
  },

  repairDuplicateStaffCodes: async (): Promise<{ totalRepaired: number }> => {
    const duplicates = await staffService.findDuplicateStaffCodes();
    let totalRepaired = 0;

    for (const { records } of duplicates) {
      const sorted = [...records].sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;

        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const [, ...others] = sorted;

      for (const other of others) {
        let newCode = "";
        try {
          newCode = await staffService.generateUniqueStaffCodeFromFirebase();
        } catch (e) {
          newCode = staffService.generateStaffCode();
        }

        other.staffCode = newCode;
        other.updatedAt = new Date().toISOString();

        upsertLocalStaff(other);

        try {
          await syncStaffToFirestore(other);
        } catch (e) {
          console.error("Failed to sync repaired record to firestore", e);
        }
        totalRepaired++;
      }
    }

    return { totalRepaired };
  },

  saveRoleTemplates: (templates: Record<string, MenuPermissions>): void => {
    localStorageService.set(ROLE_TEMPLATES_KEY, templates);
    Object.assign(staffService.ROLE_TEMPLATES, templates);

    void setDoc(
      doc(db, FIRESTORE_SETTINGS_COLLECTION, "role_templates"),
      removeUndefinedDeep({
        templates,
        updatedAt: new Date().toISOString(),
        firestoreUpdatedAt: serverTimestamp(),
      }),
      { merge: true },
    ).catch((error) => {
      console.error("Failed to save role templates to Firebase.", error);
    });
  },

  resetPasscode: (
    staffId: string,
    newPasscode: string,
    isOverride: boolean = false,
  ): void => {
    const staff = staffService.getStaffById(staffId);

    if (staff) {
      const updatedStaff: Staff = {
        ...staff,
        passcode: newPasscode,
        failedAttemptCount: 0,
        isLocked: false,
        status: isOverride ? "active" : "passcode_reset_required",
        mustChangePasscode: !isOverride,
        updatedAt: new Date().toISOString(),
      };

      staffService.saveStaff(updatedStaff);

      analyticsService.logEvent({
        eventType: isOverride
          ? "STAFF_PASSCODE_OVERRIDDEN"
          : "STAFF_PASSCODE_RESET",
        actorType: "admin",
        actorName: "SysAdmin",
        details: {
          staffId,
          staffCode: updatedStaff.staffCode,
        },
      });
    }
  },
};

const storedTemplates =
  localStorageService.get<Record<string, MenuPermissions>>(ROLE_TEMPLATES_KEY);

if (storedTemplates) {
  Object.assign(staffService.ROLE_TEMPLATES, storedTemplates);
}

export const ROLE_TEMPLATES = staffService.ROLE_TEMPLATES;
