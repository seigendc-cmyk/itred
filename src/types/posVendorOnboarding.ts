export type VendorOnboardingLifecycle =
  | "ISSUED"
  | "RPN_OPENED"
  | "PROFILE_COMPLETION_PENDING"
  | "WAREHOUSE_SETUP_PENDING"
  | "BRANCH_SETUP_PENDING"
  | "TERMINAL_SETUP_PENDING"
  | "STAFF_SETUP_PENDING"
  | "READY_FOR_POS"
  | "EXPIRED"
  | "CANCELLED";

export type VendorOnboardingCodeStatus =
  | "issued"
  | "superseded"
  | "cancelled"
  | "expired";
export type VendorOnboardingActivationStatus = "trial" | "active" | "pending";

export interface PosVendorOnboardingForm {
  vendorName: string;
  tradingName: string;
  sector: string;
  category: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  district: string;
  suburb: string;
  city: string;
  posPlanId: string;
  posPlanName: string;
  posActivationType: VendorOnboardingActivationStatus;
  expiryDate: string;
  notes: string;
  rpnName: string;
  rpnPhone: string;
  rpnEmail: string;
}

export interface VendorSkeletonRecord {
  id: string;
  vendorId: string;
  vendorCode: string;
  onboardingCode: string;
  vendorName: string;
  tradingName?: string;
  sector?: string;
  category?: string;
  contactPerson?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  district?: string;
  suburb?: string;
  city?: string;
  onboardingStatus: VendorOnboardingLifecycle;
  activationStatus: VendorOnboardingActivationStatus;
  posPlanId?: string;
  posPlanName?: string;
  posActivationType: VendorOnboardingActivationStatus;
  posExpiresAt: string;
  onboardingCreatedAt: string;
  createdByBackendUser: string;
  rpnName?: string;
  rpnPhone?: string;
  rpnEmail?: string;
  notes?: string;
  source: "itred_console_pos_onboarding";
  createdAt: string;
  updatedAt: string;
}

export interface VendorOnboardingCodeRecord {
  id: string;
  code: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  tradingName?: string;
  status: VendorOnboardingCodeStatus;
  onboardingStatus: VendorOnboardingLifecycle;
  issuedBy: string;
  issuedByEmail?: string | null;
  issuedAt: string;
  expiresAt: string;
  rpnName?: string;
  rpnPhone?: string;
  rpnEmail?: string;
  notes?: string;
  usedAt: string | null;
  completedAt: string | null;
  source: "itred_console_backend_office";
  posPlanId?: string;
  posPlanName?: string;
  posActivationType: VendorOnboardingActivationStatus;
  whatsappMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorOnboardingAuditEntry {
  id: string;
  vendorId: string;
  code?: string;
  action:
    | "onboarding_issued"
    | "code_regenerated"
    | "code_cancelled"
    | "activation_changed"
    | "onboarding_marked_ready"
    | "whatsapp_message_copied"
    | "whatsapp_message_opened";
  actor: string;
  actorEmail?: string | null;
  timestamp: string;
  before?: unknown;
  after?: unknown;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PosVendorOnboardingRow extends VendorOnboardingCodeRecord {
  vendorSkeleton?: VendorSkeletonRecord | null;
}
