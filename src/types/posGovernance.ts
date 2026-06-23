export type PosPlanStatus = "active" | "inactive";
export type PosSubscriptionStatus =
  | "not_activated"
  | "trial"
  | "active"
  | "payment_pending"
  | "expired"
  | "suspended";

export type PosRecordStatus = "active" | "inactive" | "disabled" | "suspended";
export type PosBranchType = "shop" | "warehouse" | "agent";
export type PosDeviceBindingStatus = "unbound" | "pending" | "bound" | "revoked";

export const POS_PERMISSION_KEYS = [
  "dashboard",
  "sale_cart",
  "returns",
  "credit_sales",
  "laybye",
  "stock_receive",
  "stock_transfer",
  "stocktake",
  "approvals",
  "cash_drawer",
  "finance_manager",
  "reports",
  "settings",
  "staff_management",
  "terminal_management",
  "assembly",
  "consignment",
  "marketplace_publish",
  "poolwise_publish",
] as const;

export type PosPermissionKey = (typeof POS_PERMISSION_KEYS)[number];

export interface PosPlan {
  id: string;
  planId: string;
  planName: string;
  monthlyPrice: number;
  trialDays: number;
  maxBranches: number;
  maxWarehouses: number;
  maxTerminals: number;
  maxStaff: number;
  maxProducts: number;
  allowOfflineMode: boolean;
  allowCreditSales: boolean;
  allowLaybye: boolean;
  allowReturns: boolean;
  allowAssembly: boolean;
  allowConsignment: boolean;
  allowFinanceManager: boolean;
  allowBI: boolean;
  allowMarketplacePublish: boolean;
  allowPoolWisePublish: boolean;
  allowFiscalization: boolean;
  status: PosPlanStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface VendorPosSubscription {
  id: string;
  vendorId: string;
  vendorName: string;
  planId: string;
  planName: string;
  subscriptionStatus: PosSubscriptionStatus;
  activatedAt?: string | null;
  expiresAt?: string | null;
  trialEndsAt?: string | null;
  paymentReference?: string | null;
  activationSource: string;
  activatedBy: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PosBranch {
  id: string;
  vendorId: string;
  branchName: string;
  branchCode: string;
  branchType: PosBranchType;
  address: string;
  district: string;
  suburb: string;
  status: PosRecordStatus;
  branchAccessPassKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PosWarehouse {
  id: string;
  vendorId: string;
  warehouseName: string;
  warehouseCode: string;
  address: string;
  district: string;
  suburb: string;
  isDefault: boolean;
  status: PosRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PosTerminal {
  id: string;
  vendorId: string;
  branchId: string;
  terminalName: string;
  terminalCode: string;
  deskName: string;
  status: PosRecordStatus;
  terminalAccessCode?: string | null;
  deviceBindingStatus: PosDeviceBindingStatus;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PosStaffAccess {
  id: string;
  vendorId: string;
  vendorCode?: string;
  vendorName?: string;
  staffId?: string | null;
  displayName: string;
  email: string;
  phone?: string;
  branchId?: string;
  branchName?: string;
  branchIds: string[];
  terminalId?: string;
  terminalName?: string;
  terminalIds: string[];
  roleId: string;
  roleName?: string;
  permissions?: PosPermissionKey[];
  temporaryAccessCode?: string;
  accessCode?: string;
  accessCodeLastResetAt?: string;
  pinMode?: string;
  accessStatus?: string;
  status: PosRecordStatus;
  notes?: string;
  mustChangePin?: boolean;
  accessCodePlaceholder?: string | null;
  pinPlaceholder?: string | null;
  lastLoginAt?: string | null;
  createdBy?: string;
  createdByEmail?: string | null;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PosRole {
  id: string;
  vendorId: string;
  roleName: string;
  permissions: PosPermissionKey[];
  status: PosRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PosEntitlementSnapshot {
  id: string;
  vendorId: string;
  planId: string;
  planName: string;
  subscriptionStatus: PosSubscriptionStatus;
  generatedAt: string;
  limits: Pick<
    PosPlan,
    | "maxBranches"
    | "maxWarehouses"
    | "maxTerminals"
    | "maxStaff"
    | "maxProducts"
  >;
  features: Pick<
    PosPlan,
    | "allowOfflineMode"
    | "allowCreditSales"
    | "allowLaybye"
    | "allowReturns"
    | "allowAssembly"
    | "allowConsignment"
    | "allowFinanceManager"
    | "allowBI"
    | "allowMarketplacePublish"
    | "allowPoolWisePublish"
    | "allowFiscalization"
  >;
  createdAt: string;
  updatedAt: string;
}

export type PosActivationLogAction =
  | "activation"
  | "renewal"
  | "suspension"
  | "reactivation"
  | "branch_creation"
  | "warehouse_creation"
  | "terminal_creation"
  | "staff_access_change"
  | "role_change"
  | "entitlement_snapshot_creation";

export interface PosActivationLog {
  id: string;
  action: PosActivationLogAction;
  vendorId: string;
  actor: string;
  timestamp: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface PosGovernanceData {
  plans: PosPlan[];
  subscriptions: VendorPosSubscription[];
  branches: PosBranch[];
  warehouses: PosWarehouse[];
  terminals: PosTerminal[];
  staffAccess: PosStaffAccess[];
  roles: PosRole[];
  entitlementSnapshots: PosEntitlementSnapshot[];
  activationLogs: PosActivationLog[];
}
