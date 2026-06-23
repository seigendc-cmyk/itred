export type PosReviewStatus = "pending" | "approved" | "rejected";
export type PosReviewRequestKind = "profile" | "setup" | "general";

export interface PosReviewDiagnosticsEntry {
  collectionName: string;
  recordsFound: number;
  statusesFound: string[];
  lastRequestTimestamp?: string;
  error?: string;
}

export interface PosReviewDiagnostics {
  collectionsChecked: string[];
  entries: PosReviewDiagnosticsEntry[];
  statusesFound: string[];
  totalRecordsFound: number;
  errors: string[];
}

export interface PosReviewNormalizedFields {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  submittedBy: string;
  submittedAt: string;
  rawStatus: string;
  normalizedStatus: PosReviewStatus;
}

export interface VendorProfileCompletionRequest {
  id: string;
  sourceCollection?: string;
  requestKind?: PosReviewRequestKind;
  normalized?: PosReviewNormalizedFields;
  vendorId: string;
  vendorCode?: string;
  vendorName?: string;
  submittedBy?: string;
  submittedByEmail?: string;
  submittedAt?: string;
  status: PosReviewStatus | string;
  proposedProfile?: Record<string, unknown>;
  currentSnapshot?: Record<string, unknown>;
  rpnNotes?: string;
  rejectionReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  [key: string]: unknown;
}

export interface PosTenantSetupRequest {
  id: string;
  sourceCollection?: string;
  requestKind?: PosReviewRequestKind;
  normalized?: PosReviewNormalizedFields;
  vendorId: string;
  vendorCode?: string;
  vendorName?: string;
  submittedBy?: string;
  submittedByEmail?: string;
  submittedAt?: string;
  status: PosReviewStatus | string;
  warehouse?: Record<string, unknown>;
  branch?: Record<string, unknown>;
  terminal?: Record<string, unknown>;
  staffAdmin?: Record<string, unknown>;
  proposedSetup?: {
    warehouse?: Record<string, unknown>;
    branch?: Record<string, unknown>;
    terminal?: Record<string, unknown>;
    staffAdmin?: Record<string, unknown>;
  };
  rejectionReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  [key: string]: unknown;
}

export interface PosOnboardingReviewData {
  profileRequests: VendorProfileCompletionRequest[];
  setupRequests: PosTenantSetupRequest[];
  allRequests: Array<VendorProfileCompletionRequest | PosTenantSetupRequest>;
  vendors: Record<string, unknown>[];
  onboardingCodes: Record<string, unknown>[];
  diagnostics: PosReviewDiagnostics;
}
