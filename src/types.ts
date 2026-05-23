﻿﻿/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum AppRoute {
  DASHBOARD = "dashboard",
  VENDOR_MGMT = "vendor-management",
  RPN_MGMT = "rpn-management",
  PRODUCT_MGMT = "product-management",
  CAH = "commerce-access-hub",
  PRICING = "pricing",
  SUBSCRIPTIONS = "itred_subscriptions",
  CATALOGUE_GEN = "catalogue-generator",
  VENDOR_STOREFRONT = "vendor-storefront-builder",
  ANALYTICS = "analytics",
  BI_MARKET = "bi-market",
  PERFORMANCE_METRICS = "performance-metrics",
  ACTIVITY_LOGS = "activity-logs",
  SPOT_CHECKS = "inventory-spot-checks",
  STAFF_MGMT = "staff-management",
  ADMIN_DASHBOARD = "admin-dashboard",
  ROLE_MENU_PERMISSIONS = "role-menu-permissions",
  STAFF_ACCESS_LOGS = "staff-access-logs",
  SYSTEM_SETTINGS = "system-settings",
  CONTACT_HUB_SETTINGS = "contact-hub-settings",
  HOW_TO = "how-to",
  WHATSAPP_ACTIVITY = "whatsapp-activity",
  COMMUNITY_BI = "whatsapp-community-bi",
  WHATSAPP_REPORTS = "whatsapp-performance-reports",
  APPROVAL_QUEUE = "approval-queue",
  NOTIFICATIONS = "notifications",
  STAFF_TASKS = "staff-tasks",
  RPN_PERFORMANCE = "rpn-performance",
  FINANCE_DESK = "finance-desk",
  CASH_BANK_MANAGER = "cash-bank-manager",
  RPN_PAYMENTS_LEDGER = "rpn-payments-ledger",
  FINANCE_REPORTS = "finance-reports",
  BI_OVERVIEW = "console-bi-overview",
  AI_REPORTS = "console-ai-reports",
  PRODUCT_TRENDS = "console-product-trends",
  VENDOR_REPORTS = "console-vendor-reports",
  RPN_BI_PERFORMANCE = "console-rpn-performance",
  VIRAL_GROWTH = "console-viral-growth",
}
export type DeskType =
  | "SysAdmin Desk"
  | "Backoffice Desk"
  | "Product Data Desk"
  | "Catalogue Deployment Desk"
  | "Collections Desk"
  | "RPN Management Desk"
  | "CAH Operations Desk"
  | "BI & Analytics Desk"
  | "Finance Desk"
  | "Viewer Desk";

export type PermissionLevel =
  | "hidden"
  | "view"
  | "create"
  | "submit"
  | "edit"
  | "approve"
  | "delete"
  | "export"
  | "full";

export type FieldDataSource = "manual" | "import" | "field" | "system" | "firebase" | string;

export type MenuKey =
  | "dashboard"
  | "vendorManagement"
  | "addNewVendor"
  | "rpnManagement"
  | "addNewAgent"
  | "productManagement"
  | "addNewProduct"
  | "productList"
  | "accessHub"
  | "cahBooths"
  | "pricing"
  | "subscriptionsCollections"
  | "collectionCalendar"
  | "createCatalogue"
  | "createStorefront"
  | "inventorySpotChecks"
  | "analytics"
  | "biMarketAnalytics"
  | "performanceMetrics"
  | "activityLogs"
  | "adminDashboard"
  | "staffManagement"
  | "roleMenuPermissions"
  | "staffAccessLogs"
  | "systemSettings"
  | "howTo"
  | "whatsappActivity"
  | "whatsappCommunityBI"
  | "approvalQueue"
  | "notifications"
  | "staffTasks"
  | "rpnPerformance"
  | "financeDesk"
  | "cashBankManager"
  | "rpnPaymentsLedger"
  | "financeReports"
  | "biOverview"
  | "aiReports"
  | "productTrends"
  | "vendorReports"
  | "viralGrowth";

export type MenuPermissions = Partial<Record<MenuKey, PermissionLevel>>;

export type ActionPermissionKey =
  | "vendor.view"
  | "vendor.createDraft"
  | "vendor.submitApproval"
  | "vendor.approve"
  | "vendor.publish"
  | "vendor.delete"
  | "product.view"
  | "product.createDraft"
  | "product.submitApproval"
  | "product.approve"
  | "product.publish"
  | "product.changePrice"
  | "product.delete"
  | "catalogue.view"
  | "catalogue.generate"
  | "catalogue.submitApproval"
  | "catalogue.approveDeploy"
  | "catalogue.download"
  | "catalogue.archive"
  | "catalogue.overridePlanLimit"
  | "whatsapp.view"
  | "whatsapp.logs.view"
  | "whatsapp.logs.create"
  | "whatsapp.logs.edit"
  | "whatsapp.logs.delete"
  | "whatsapp.analytics.view"
  | "whatsapp.alerts.manage"
  | "whatsapp.followups.manage"
  | "whatsapp.vendorReputation.view"
  | "whatsapp.view"
  | "whatsapp.logActivity"
  | "whatsapp.verifyConversion"
  | "inventory.spotChecks.view"
  | "inventory.spotChecks.create"
  | "inventory.spotChecks.complete"
  | "inventory.spotChecks.assign"
  | "inventory.spotChecks.updateStock"
  | "inventory.updateStockAfterAudit"
  | "inventory.spotChecks.escalate"
  | "inventory.spotChecks.viewAnalytics"
  | "cah.view"
  | "cah.createLink"
  | "cah.submitApproval"
  | "cah.approveLink"
  | "pricing.view"
  | "pricing.submitApproval"
  | "pricing.approve"
  | "subscriptions.view"
  | "subscriptions.recordPayment"
  | "subscriptions.waive"
  | "subscriptions.generateReceipt"
  | "subscriptions.postToFinance"
  | "subscriptions.generateRpnCommission"
  | "notifications.view"
  | "notifications.markRead"
  | "notifications.resolve"
  | "notifications.archive"
  | "notifications.viewAll"
  | "notifications.viewOwn"
  | "notifications.viewTeam"
  | "staffTasks.view"
  | "staffTasks.create"
  | "staffTasks.assign"
  | "staffTasks.updateStatus"
  | "staffTasks.review"
  | "staffTasks.cancel"
  | "staffChat.view"
  | "staffChat.sendDirect"
  | "staffChat.sendGroup"
  | "staffChat.assignTask"
  | "staffChat.monitor"
  | "staffChat.deleteMessage"
  | "approvalQueue.view"
  | "approvalQueue.approve"
  | "staffTasks.viewOwn"
  | "staffTasks.complete"
  | "rpn.viewAgents"
  | "rpn.createAgent"
  | "rpn.editAgent"
  | "rpn.suspendAgent"
  | "rpn.deleteAgent"
  | "rpn.viewPerformance"
  | "rpn.viewFinancials"
  | "rpn.setThresholds"
  | "rpn.assignVendor"
  | "rpn.reassignVendor"
  | "rpn.viewChurn"
  | "rpn.viewCommissions"
  | "rpn.exportReports"
  | "staff.editKycDetails"
  | "rpnProspects.view"
  | "rpnProspects.create"
  | "rpnProspects.edit"
  | "rpnProspects.delete"
  | "rpnPipeline.moveStage"
  | "rpnPipeline.managerOverride"
  | "rpnPipeline.convertToVendor"
  | "rpnAppointments.edit"
  | "rpnFollowups.edit"
  | "rpnPipeline.analytics"
  | "staff.editPermissions"
  | "staff.manage"
  | "staff.generateStaffCode"
  | "staff.repairDuplicateCodes"
  | "staff.suspend"
  | "staff.reactivate"
  | "staff.archive"
  | "staff.requestDelete"
  | "staff.approveDelete"
  | "staff.deletePermanent"
  | "roles.viewPermissions"
  | "roles.editPermissions"
  | "roles.createRoleTemplate"
  | "roles.deleteRoleTemplate"
  | "roles.assignRoleToStaff"
  | "roles.auditPermissionChanges"
  | "system.settings.edit"
  | "approvalQueue.reject"
  | "approvalQueue.returnForCorrection"
  | "staffAudit.view"
  | "staffAudit.viewAll"
  | "staffAudit.export"
  | "finance.view"
  | "finance.settings.manage"
  | "finance.coa.manage"
  | "finance.cashBankAccounts.manage"
  | "finance.ledger.view"
  | "finance.transaction.create"
  | "finance.ledger.exportPdf"
  | "finance.payment.create"
  | "finance.payment.approve"
  | "finance.payment.post"
  | "finance.payment.void"
  | "finance.receipt.create"
  | "finance.receipt.post"
  | "finance.journal.create"
  | "finance.journal.approve"
  | "finance.journal.post"
  | "finance.allowOverdraw"
  | "finance.rpnPayments.view"
  | "finance.rpnPayments.generate"
  | "finance.rpnPayments.approve"
  | "finance.rpnPayments.pay"
  | "finance.reports.view"
  | "finance.reports.print"
  | "finance.reports.downloadPdf"
  | "finance.reports.exportCsv"
  | "finance.reports.approvePrint"
  | "finance.reports.viewSensitive"
  | "finance.reports.viewRpnPayments"
  | "finance.reports.viewAssets"
  | "finance.reports.viewLedger"
  | "finance.reports.viewAuditTrail";

export type ActionPermissions = Partial<Record<ActionPermissionKey, boolean>>;

export type AccountType =
  | "Asset"
  | "Liability"
  | "Equity"
  | "Income"
  | "Expense"
  | "Cost of Sales"
  | "Contra Asset"
  | "Contra Income";

export interface ChartOfAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubType?: string;
  normalBalance: "Debit" | "Credit";
  description?: string;
  parentAccountId?: string;
  isCashBankAccount?: boolean;
  isSystemAccount?: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface CashBankAccount {
  id: string;
  accountId: string;
  accountCode?: string;
  accountName: string;
  accountType: "Cash" | "Bank" | "Mobile Money" | "Card Processor" | "Other";
  currency: "USD" | "ZiG" | "ZAR" | "Other";
  bankName?: string;
  branchName?: string;
  accountNumber?: string;
  walletNumber?: string;
  openingBalance: number;
  currentBalance: number;
  status: "active" | "inactive";
  requiresApprovalForPayments: boolean;
  approvalLimit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceLedgerEntry {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  transactionType:
    | "Opening Balance"
    | "Payment"
    | "Receipt"
    | "Deposit"
    | "Transfer"
    | "Journal";
  accountId: string;
  cashBankAccountId?: string;
  description: string;
  payeeName?: string;
  payerName?: string;
  debit: number;
  credit: number;
  amount: number;
  runningBalance?: number;
  reference?: string;
  status: "draft" | "posted" | "void";
  createdByStaffId?: string;
  createdByStaffName?: string;
  createdAt: string;
  updatedAt: string;
}

export type FinanceAssetCategory =
  | "Starlink / Connectivity Kit"
  | "Router / Network Device"
  | "Office Furniture"
  | "Office Equipment"
  | "Building"
  | "Vehicle"
  | "RPN Issued Phone"
  | "Promotional Kit"
  | "Roadshow Equipment"
  | "Training Equipment"
  | "Data Centre Equipment"
  | "Other";

export type FinanceAssetStatus =
  | "active"
  | "assigned"
  | "in-maintenance"
  | "disposed"
  | "inactive";

export interface FinanceAsset {
  id: string;
  assetCode: string;
  assetName: string;
  category: FinanceAssetCategory;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  assignedTo?: string;
  acquisitionDate: string;
  purchaseCost: number;
  currentValue: number;
  assetAccountId: string;
  cashBankAccountId?: string;
  maintenanceExpenseAccountId: string;
  disposalAccountId?: string;
  supplierName?: string;
  warrantyExpiryDate?: string;
  notes?: string;
  status: FinanceAssetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceAssetMaintenanceRecord {
  id: string;
  assetId: string;
  maintenanceDate: string;
  maintenanceType:
    | "Inspection"
    | "Repair"
    | "Service"
    | "Replacement"
    | "Upgrade"
    | "Other";
  provider?: string;
  cost: number;
  expenseAccountId: string;
  notes?: string;
  nextMaintenanceDate?: string;
  status: "scheduled" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface FinanceAssetDisposalRecord {
  id: string;
  assetId: string;
  disposalDate: string;
  disposalMethod: "Sold" | "Scrapped" | "Donated" | "Lost" | "Stolen" | "Other";
  proceeds: number;
  disposalAccountId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FinanceReportType =
  | "Cash / Bank Ledger Report"
  | "Transaction Listing Report"
  | "Chart of Accounts Report"
  | "Cash / Bank Account Balances Report"
  | "Receipts Report"
  | "Payments Report"
  | "Journal Entries Report"
  | "RPN Payments / Commissions Report"
  | "Asset Register Report"
  | "Asset Maintenance Report"
  | "Finance Approval Report"
  | "Print / Export Audit Report";

export interface FinanceReportFilters {
  reportType: FinanceReportType;
  dateFrom?: string;
  dateTo?: string;
  periodPreset?:
    | "Today"
    | "This Week"
    | "This Month"
    | "This Quarter"
    | "This Year"
    | "Custom";
  accountId?: string;
  cashBankAccountId?: string;
  transactionType?: string;
  status?: string;
  staff?: string;
  vendor?: string;
  rpn?: string;
  assetCategory?: string;
  assetStatus?: string;
  payeePayer?: string;
  approvalStatus?: string;
  amountMin?: number;
  amountMax?: number;
}

export interface FinanceReportResult {
  reportRef: string;
  reportType: FinanceReportType;
  title: string;
  filters: FinanceReportFilters;
  rows: any[];
  totals: Record<string, number | string>;
  generatedAt: string;
  unavailableMessage?: string;
}

export interface FinanceReportPrintLog {
  id: string;
  reportRef: string;
  reportType: FinanceReportType;
  filters: FinanceReportFilters;
  action: "print" | "pdf_download" | "csv_export" | "approval_requested";
  staffId?: string;
  staffName?: string;
  staffDesk?: string;
  approvalId?: string;
  status: "allowed" | "blocked" | "pending_approval" | "completed";
  createdAt: string;
}

export interface RPNPaymentLedgerEntry {
  id: string;
  rpnId: string;
  rpnName: string;
  vendorId: string;
  vendorName: string;
  sourceType:
    | "Paid Onboarding"
    | "Recurring Subscription"
    | "Bonus"
    | "Adjustment";
  sourceTransactionId?: string;
  sourceSubscriptionId?: string;
  sourcePaymentId?: string;
  vendorPlan?: string;
  vendorPaymentAmount: number;
  commissionRate?: number;
  commissionAmountDue: number;
  commissionAmountPaid: number;
  balanceDue: number;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
  dueDate: string;
  status:
    | "due"
    | "pending_approval"
    | "approved"
    | "paid"
    | "held"
    | "rejected"
    | "void";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  approvedByStaffId?: string;
  approvedAt?: string;
  paidByStaffId?: string;
  paidAt?: string;
}

export interface RPNPaymentSummary {
  rpnId: string;
  rpnName: string;
  totalDue: number;
  totalPaid: number;
  balanceDue: number;
  entryCount: number;
}

export interface NavItem {
  id: AppRoute;
  label: string;
  icon: string;
}

export interface Branch {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  country?: string;
  province: string;
  cityTown: string;
  district: string;
  suburb: string;
  streetAddress?: string;
  address: string;
  landmark?: string;
  managerName: string;
  openingHours: string;
  isDefault: boolean;
  status: "active" | "suspended";
}

export interface Staff {
  id: string;
  docId?: string;
  firestoreDocId?: string;
  staffCode: string;
  fullName: string;
  displayName: string;
  role: string;
  desk: DeskType | string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  googleEmailAllowed?: string;
  assignedBranchId: string;
  status:
    | "active"
    | "suspended"
    | "passcode_reset_required"
    | "locked"
    | "archived"
    | "pending_delete"
    | "archived_deleted"
    | "deleted"
    | string;
  staffName?: string;
  passcode: string;
  mustChangePasscode?: boolean;
  failedAttemptCount: number;
  isLocked: boolean;
  lastLoginDate?: string;
  lastLogoutDate?: string;
  personalDetails?: {
    nationalId?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    nextOfKinName?: string;
    nextOfKinPhone?: string;
  };
  addressDetails?: {
    country?: string;
    province?: string;
    cityTown?: string;
    district?: string;
    suburb?: string;
    streetAddress?: string;
    gpsNotes?: string;
  };
  kycDetails?: {
    idType?: string;
    idNumber?: string;
    kycStatus?: "not_started" | "pending" | "verified" | "rejected";
    verifiedByStaffId?: string;
    verifiedByName?: string;
    verifiedAt?: string;
    notes?: string;
  };
  kycDocuments?: {
    idDocumentUrl?: string;
    proofOfResidenceUrl?: string;
    photoUrl?: string;
  };
  // Permissions are now an object mapping MenuKey to PermissionLevel
  menuPermissions: MenuPermissions;
  actionPermissions?: ActionPermissions;
  createdBy: string;
  updatedBy: string;
  deleteRequestedAt?: string;
  deleteRequestedBy?: string;
  deleteReason?: string;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppActivityType =
  | "CATALOGUE_SHARED"
  | "STOREFRONT_SHARED"
  | "PRODUCT_ENQUIRY"
  | "VENDOR_REFERRAL"
  | "CUSTOMER_REQUEST"
  | "MEMBER_COUNT_UPDATE"
  | "FOLLOW_UP_DONE"
  | "VENDOR_RESPONDED"
  | "VENDOR_DID_NOT_RESPOND"
  | "COMPLAINT_RECEIVED"
  | "GROUP_INACTIVE"
  | "DEMAND_SIGNAL"
  | "SPAM_OR_FALSE_LISTING"
  | "OTHER";

export type WhatsAppSourceType =
  | "WHATSAPP_COMMUNITY"
  | "WHATSAPP_GROUP"
  | "WHATSAPP_CHANNEL"
  | "DIRECT_WHATSAPP"
  | "BROADCAST_LIST"
  | "OTHER";

export interface WhatsAppSource {
  id: string;
  sourceType: WhatsAppSourceType;
  communityId?: string;
  communityName?: string;
  sourceName: string;
  whatsappUrl?: string;
  sector?: string;
  category?: string;
  province?: string;
  cityTown?: string;
  district?: string;
  memberCount?: number;
  status: "active" | "inactive" | "dormant";
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppLeadStatus =
  | "NEW"
  | "REFERRED"
  | "CONTACTED"
  | "CONVERTED"
  | "LOST"
  | "FOLLOW_UP_REQUIRED"
  | "NOT_APPLICABLE";
export type WhatsAppPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type WhatsAppResponseStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "RESPONDED"
  | "MISSED"
  | "ESCALATED";

export interface WhatsAppActivityLog {
  id: string;
  activityDate: string;
  activityType: WhatsAppActivityType;
  sourceType: WhatsAppSourceType;
  sourceName: string;
  sourceId?: string;
  communityId?: string;
  communityName?: string;
  whatsappUrl?: string;
  sector?: string;
  category?: string;
  province?: string;
  cityTown?: string;
  district?: string;
  vendorId?: string;
  vendorName?: string;
  catalogueId?: string;
  storefrontId?: string;
  productName?: string;
  customerNeed?: string;
  leadStatus: WhatsAppLeadStatus;
  priority: WhatsAppPriority;
  memberCount?: number;
  previousMemberCount?: number;
  enquiryCount?: number;
  responseStatus: WhatsAppResponseStatus;
  responseTimeMinutes?: number;
  assignedRpnId?: string;
  assignedRpnName?: string;
  loggedBy: string;
  notes?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
  capturedByStaffId?: string;
  capturedByStaffName?: string;
  capturedByRole?: string;
  capturedAt?: string;
  assignedToType?: "STAFF" | "RPN" | "ADMIN";
  assignedStaffId?: string;
  assignedStaffName?: string;
}

export type InteractionType =
  | "Enquiry"
  | "Complaint"
  | "Compliment"
  | "Price Request"
  | "Delivery Complaint"
  | "Stock Request"
  | "Warranty Issue"
  | "Fraud Alert"
  | "Product Search"
  | "Service Request"
  | "Market Feedback";

export type UrgencyLevel = "Low" | "Medium" | "High" | "Critical";
export type ResolutionStatus =
  | "Pending"
  | "In Progress"
  | "Resolved"
  | "Escalated";
export type Sentiment = "Positive" | "Neutral" | "Negative";
export type IntelligenceSource =
  | "WhatsApp"
  | "Call"
  | "Walk-in"
  | "Catalogue"
  | "CAH"
  | "Storefront";

export interface WhatsAppIntelligenceLog {
  id: string;
  createdAt: string;
  updatedAt: string;
  loggedByStaffId: string;
  loggedByStaffName: string;
  customerName?: string;
  customerPhone: string;
  vendorId?: string;
  vendorName?: string;
  productId?: string;
  productName?: string;
  category?: string;
  sector?: string;
  region?: string;
  province?: string;
  city?: string;
  source: IntelligenceSource;
  interactionType: InteractionType;
  customerMessage: string;
  internalNotes?: string;
  actionRequired: boolean;
  urgencyLevel: UrgencyLevel;
  resolutionStatus: ResolutionStatus;
  assignedToStaffId?: string;
  assignedToStaffName?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  tags: string[];
  sentiment: Sentiment;
  biScore?: number;
  flaggedRisk?: boolean;
  duplicatePatternDetected?: boolean;
}

export interface VendorMarketFeedInsight {
  id: string;
  category:
    | "observation"
    | "risk"
    | "demand"
    | "handling"
    | "opportunity";
  severity: "info" | "warning" | "high" | "critical";
  title: string;
  message: string;
  metric?: string;
}

export interface VendorMarketFeedRecommendation {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  action: string;
  reason: string;
  owner?: string;
}

export interface VendorMarketFeedScore {
  value: number;
  grade: "A" | "B" | "C" | "D" | "E";
  demandScore: number;
  conversionScore: number;
  handlingScore: number;
  riskScore: number;
  summary: string;
}

export interface VendorMarketFeedReport {
  vendorId: string;
  vendorName: string;
  sector?: string;
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
  totalInteractions: number;
  uniqueCustomers: number;
  productEnquiries: number;
  priceEnquiries: number;
  stockAvailabilityEnquiries: number;
  confirmedOrders: number;
  convertedLeads: number;
  lostLeads: number;
  pendingFollowUps: number;
  complaints: number;
  deliveryComplaints: number;
  warrantyIssues: number;
  fraudAlerts: number;
  averageResponseTimeMinutes: number;
  topRequestedProducts: Array<{ name: string; count: number }>;
  topRequestedCategories: Array<{ name: string; count: number }>;
  topCustomerLocations: Array<{ name: string; count: number }>;
  repeatCustomerCount: number;
  unresolvedIssues: number;
  score: VendorMarketFeedScore;
  executiveSummary: string;
  keyObservations: VendorMarketFeedInsight[];
  riskWarnings: VendorMarketFeedInsight[];
  demandSignals: VendorMarketFeedInsight[];
  customerHandlingWeaknesses: VendorMarketFeedInsight[];
  remedialRecommendations: VendorMarketFeedRecommendation[];
  whatsappSummary: string;
}

export interface MarketTrendFilters {
  dateFrom?: string;
  dateTo?: string;
  vendorId?: string;
  productId?: string;
  sector?: string;
  category?: string;
  suburb?: string;
  city?: string;
  province?: string;
  country?: string;
  interactionType?: string;
  source?: string;
  buyingIntent?: string;
  status?: string;
}

export interface TrendingProduct {
  productId?: string;
  productName: string;
  vendorId?: string;
  vendorName?: string;
  sector?: string;
  category?: string;
  trendScore: number;
  totalInteractions: number;
  productEnquiries: number;
  priceEnquiries: number;
  stockQueries: number;
  clickSignals: number;
  repeatCustomerInterest: number;
  confirmedOrders: number;
  convertedLeads: number;
  lostLeads: number;
  complaints: number;
  topLocations: Array<{ name: string; count: number }>;
}

export interface LocationTrend {
  level: "suburb" | "city" | "province" | "country";
  name: string;
  totalInteractions: number;
  topProducts: Array<{ name: string; count: number }>;
  topSectors: Array<{ name: string; count: number }>;
  confirmedBuyingIntent: number;
  lostLeads: number;
  complaints: number;
  conversionRate: number;
  dominantMarketBehaviour: string;
}

export interface CustomerBehaviourSummary {
  totalCustomers: number;
  priceCheckers: number;
  seriousBuyers: number;
  repeatBuyers: number;
  hotLeads: number;
  lostBuyers: number;
  complaintRisks: number;
  convertedCustomers: number;
  behaviourMix: Array<{ behaviour: string; count: number }>;
}

export interface VendorMarketPerformance {
  vendorId: string;
  vendorName: string;
  totalInteractions: number;
  uniqueCustomers: number;
  topRequestedProducts: Array<{ name: string; count: number }>;
  confirmedOrders: number;
  convertedLeads: number;
  lostLeads: number;
  pendingFollowUps: number;
  complaints: number;
  averageResponseTimeMinutes: number;
  marketFeedScore: number;
  remedialRecommendations: string[];
}

export interface MarketRiskSignal {
  id: string;
  type:
    | "complaint"
    | "lost_opportunity"
    | "stock_gap"
    | "slow_response"
    | "fraud"
    | "follow_up";
  severity: "info" | "warning" | "high" | "critical";
  title: string;
  message: string;
  vendorId?: string;
  productName?: string;
  location?: string;
  count: number;
}

export interface MarketRecommendation {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  action: string;
  reason: string;
  target?: string;
}

export interface MarketTrendReport {
  filters: MarketTrendFilters;
  generatedAt: string;
  periodLabel: string;
  executiveSummary: string;
  totalInteractions: number;
  uniqueCustomers: number;
  confirmedBuyingIntent: number;
  convertedLeads: number;
  lostLeads: number;
  complaints: number;
  pendingFollowUps: number;
  trendingProducts: TrendingProduct[];
  locationTrends: LocationTrend[];
  customerBehaviour: CustomerBehaviourSummary;
  vendorPerformance: VendorMarketPerformance[];
  riskSignals: MarketRiskSignal[];
  recommendations: MarketRecommendation[];
  whatsappSummary: string;
}

export interface DeliveryStaff {
  id: string;
  fullName: string;
  phone: string;
  whatsapp: string;
  vehicleType: "bike" | "car" | "lorry" | "other";
  vehicleRegistration: string;
  driverLicenseNumber: string;
  nationalId: string;
  serviceArea: string;
  assignedBranchId: string;
  status: "active" | "suspended";
}

export interface IDeliverProvider {
  id: string;
  vendorId: string;
  providerName: string;
  phoneNumber: string;
  whatsappNumber?: string;
  driverLicenseNumber: string;
  vehicleNumber?: string;
  vehicleType?: string;
  policeClearanceCertificateUrl?: string;
  nationalIdNumber: string;
  address?: string;
  country?: string;
  province?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  status: "pending" | "verified" | "suspended";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FeatureStatus = "active" | "inactive" | "archived";
export type DeploymentFrequency = "weekly" | "bi-weekly" | "monthly" | "custom";
export type BIAnalyticsLevel = "none" | "basic" | "standard" | "advanced";
export type RPNSupportLevel = "none" | "basic" | "standard" | "priority";
export type FarmProducerShowcaseLevel = "none" | "basic" | "full";
export type CahBoothSupportLevel = "none" | "basic" | "priority";
export type CahFollowerTrackingLevel = "none" | "basic" | "advanced";

export type PlanEntitlements = {
  maxImagesPerListing?: number;
  maxImagesPerProduct?: number;
};

export type ListingImage = {
  url: string;
  alt?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
};

export interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  maxProducts: number;
  enableBrandedProducts?: boolean;
  brandedProductsIncluded?: number | "unlimited";
  brandedProductAddOnEnabled?: boolean;
  brandedProductAddOnPrice?: number;
  brandedProductAddOnQuantity?: number;
  maxBrandedProducts?: number | "unlimited";
  maxVendorsPerCatalogue: number;
  maxImagesPerCatalogue: number;
  maxImagesPerListing?: number;
  maxImagesPerProduct?: number;
  deploymentFrequency: DeploymentFrequency;
  maxDeploymentsPerMonth: number;
  maxCahLinks: number;
  maxNoticesPerMonth?: number;
  maxBranchesPerVendor: number;
  maxStaffPerVendor: number;
  maxDeliveryContactsPerVendor: number;
  enableIDeliver?: boolean;
  maxDeliveryProviders?: number;
  allowVerifiedDeliveryProvider?: boolean;
  isWhatsAppProductButtonEnabled: boolean;
  isDirectCallProductButtonEnabled: boolean;
  isVendorWhatsAppGroupLinkEnabled: boolean;
  isVendorWhatsAppChannelLinkEnabled: boolean;
  isInventorySpotCheckIncluded: boolean;
  inventorySpotChecksPerMonth: number;
  biAnalyticsLevel: BIAnalyticsLevel;
  rpnSupportLevel: RPNSupportLevel;
  isVendorStorefrontEnabled: boolean;
  isVendorStorefrontBannerSupported: boolean;
  isVendorStorefrontSearchSupported: boolean;
  isVendorStorefrontCahLinksSupported: boolean;
  isVendorStorefrontWhatsAppButtonEnabled: boolean;
  isVendorStorefrontDirectCallButtonEnabled: boolean;
  enableStorefrontCart?: boolean;
  enableWhatsappOrders?: boolean;
  maxStorefrontImages: number;
  maxStorefrontDeploymentsPerMonth: number;
  storefrontExpiryPeriodDays?: number;
  isCollectionReminderEnabled: boolean;
  isHostedCatalogueSupportEnabled: boolean;
  /** @deprecated use isVendorStorefrontEnabled */
  isVendorStorefrontBuilderEnabled?: boolean;
  isCahBoothAccessEnabled: boolean;
  isWhatsAppCustomerSupportEnabled: boolean;
  farmProducerShowcaseLevel: FarmProducerShowcaseLevel;
  cahFollowerTrackingLevel: CahFollowerTrackingLevel;
  cahBoothSupportLevel: CahBoothSupportLevel;
  isRpnOnboardingPdfEnabled: boolean;
  trialDays: number;
  features: string[]; // Additional custom features list
  status: FeatureStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorEntitlementSnapshot {
  vendorId: string;
  planId: string;
  planName: string;
  subscriptionStatus: SubscriptionStatus;
  isLocked: boolean;
  lockReason?: string;
  limits: {
    maxProducts: number;
    maxBranchesPerVendor: number;
    maxStaffPerVendor: number;
    maxDeliveryContactsPerVendor: number;
    maxDeploymentsPerMonth: number;
    maxStorefrontDeploymentsPerMonth: number;
    maxStorefrontImages: number;
    maxCahLinks: number;
    maxNoticesPerMonth: number;
    inventorySpotChecksPerMonth: number;
    biAnalyticsLevel: BIAnalyticsLevel;
    isVendorStorefrontEnabled: boolean;
    enableStorefrontCart?: boolean;
    enableWhatsappOrders?: boolean;
  };
  usage: VendorPlanUsageSnapshot;
  generatedAt: string;
}

export interface VendorPlanUsageSnapshot {
  vendorId: string;
  monthKey: string;
  productCount: number;
  branchCount: number;
  staffCount: number;
  deliveryContactCount: number;
  catalogueGenerationsThisMonth: number;
  storefrontGenerationsThisMonth: number;
  noticesUsedThisMonth: number;
  biReportsGeneratedThisMonth: number;
  cahLinksUsed: number;
  inventorySpotChecksUsedThisMonth: number;
  updatedAt: string;
}

export interface VendorPlanUsageLedgerEntry {
  id: string;
  vendorId: string;
  usageDate: string;
  monthKey: string;
  usageType:
    | "product_created"
    | "branch_added"
    | "staff_invited"
    | "delivery_contact_added"
    | "catalogue_generated"
    | "storefront_generated"
    | "notice_published"
    | "bi_report_generated"
    | "inventory_spot_check_used"
    | "cah_link_added";
  quantity: number;
  sourceId?: string;
  description?: string;
  createdAt: string;
}

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "due"
  | "overdue"
  | "paid"
  | "suspended"
  | "cancelled"
  | "pending_review";
export type FollowUpStatus =
  | "not started"
  | "contacted"
  | "promised to pay"
  | "paid"
  | "failed"
  | "escalated";
export type CollectionMethod =
  | "cash"
  | "EcoCash"
  | "InnBucks"
  | "Mukuru"
  | "bank transfer"
  | "manual"
  | "other";
export type CollectionRecordStatus =
  | "pending approval"
  | "approved"
  | "rejected";
export type VendorStatus =
  | "lead"
  | "active"
  | "pending_review"
  | "suspended"
  | "dormant"
  | "cancelled";
export type VendorType =
  | "retail"
  | "wholesale"
  | "manufacturer"
  | "service"
  | "farm_producer"
  | "other";

export interface Vendor {
  id: string;
  systemCode: string;
  vendorCode?: string;
  name: string;
  tradingName: string;
  ownerFullName: string;
  sector: string;
  category?: string;
  businessType: string;
  vendorType: VendorType;
  mainPhone: string;
  whatsappNumber: string;
  phone?: string;
  whatsapp?: string;
  email: string;
  country: string;
  province: string;
  cityTown: string;
  district: string;
  suburb: string;
  streetAddress: string;
  gpsNotes?: string;
  businessDescription: string;
  logoUrl?: string;
  bannerUrl?: string;
  logoAssetUrl?: string;
  bannerAssetUrl?: string;
  businessLogoUrl?: string;
  businessBannerUrl?: string;
  catalogueDisplayName: string;
  catalogueSlogan: string;
  openingHours: string;
  whatsappGroupLink?: string;
  whatsappChannelLink?: string;
  status: VendorStatus;

  // Management & Subscription
  assignedRPNId?: string;
  rpnId?: string;
  rpnName?: string;
  onboardedByStaffId?: string;
  onboardedByName?: string;
  onboardedAt?: string;
  monthlyPlanValue?: number;
  lifetimeValue?: number;
  churnStatus?: "active" | "at_risk" | "churned";
  churnReason?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedMemberId?: string;
  assignedMemberName?: string;
  assignedMemberStaffCode?: string;
  assignedMemberRole?: string;
  assignedMemberDesk?: string;
  planId: string; // References PricingPlan.id
  subscriptionStatus: SubscriptionStatus;
  campaignCode?: string;
  campaignSource?: string;
  heardAboutUsVia?: string;
  subscriptionStartDate?: string;
  subscriptionDueDate?: string;
  lastCollectionDate?: string;
  nextFollowUpDate?: string;
  collectionNotes?: string;
  dataSource: FieldDataSource;

  // Traceability
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;

  // Embedded collections (kept for localStorage simplicity, but can be synced)
  branches: Branch[];
  staff: Staff[];
  deliveryStaff: DeliveryStaff[];
  deliveryProviders?: IDeliverProvider[];
}

export type ProductStatus =
  | "active"
  | "hidden"
  | "out_of_stock"
  | "discontinued"
  | "pending_review";
export type VendorProductStockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "made_to_order"
  | "unknown";
export type ImageStatus =
  | "missing"
  | "uploaded"
  | "compressed"
  | "approved"
  | "needs replacement";

export interface MasterProduct {
  id: string;
  productName: string;
  brand?: string;
  category: string;
  sector: string;
  description?: string;
  barcode?: string;
  standardSku?: string;
  tags: string[];
  keywords: string[];
  imageUrl?: string;
  images?: ListingImage[];
  additionalImages?: string[];
  unit?: string;
  searchableText: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VendorProductOffer {
  id: string;
  vendorId: string;
  productId: string;
  productMode?: "linked_product" | "branded_product";
  sourceType?: "master_linked" | "vendor_branded";
  masterProductId?: string | null;
  brandOwnerVendorId?: string;
  isVendorBranded?: boolean;
  brandDisplayName?: string;
  brandLogoUrl?: string;
  brandBannerUrl?: string;
  category?: string;
  sector?: string;
  description?: string;
  sku?: string;
  productName?: string;
  branchId?: string;
  sellingPrice: number;
  buyingPrice?: number;
  discountPrice?: number;
  openingQty?: number;
  vendorReceipts?: number;
  vendorSales?: number;
  currentQty?: number;
  minOrderQty?: number;
  maxOrderQty?: number;
  stockQuantity: number;
  stockStatus: VendorProductStockStatus;
  vendorSku?: string;
  vendorProductImage?: string;
  images?: ListingImage[];
  publishToCatalogue: boolean;
  deliveryAvailable: boolean;
  featured: boolean;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VendorListItem {
  id: string;
  name: string;
  tradingName?: string;
  status: VendorStatus;
  planId?: string;
  sector?: string;
  category?: string;
  province?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  rpnId?: string;
  readinessScore?: number;
  productCount?: number;
  branchCount?: number;
  updatedAt?: string;
}

export interface ProductListItem {
  id: string;
  name?: string;
  productName: string;
  vendorId: string;
  vendorName?: string;
  sector?: string;
  category?: string;
  status: ProductStatus;
  publishToCatalogue: boolean;
  sellingPrice: number;
  stockQuantity: number;
  imageThumbUrl?: string;
  updatedAt?: string;
}

export type ActorType = "backend_staff" | "rpn" | "admin" | "system" | string;

export type EventType =
  | "VENDOR_CREATED"
  | "VENDOR_UPDATED"
  | "VENDOR_ASSIGNED_TO_RPN"
  | "VENDOR_SUSPENDED"
  | "VENDOR_REACTIVATED"
  | "VENDOR_DELETED"
  | "VENDOR_SYSTEM_CODE_GENERATED"
  | "BRANCH_CREATED"
  | "BRANCH_UPDATED"
  | "RPN_CREATED"
  | "RPN_UPDATED"
  | "FIELD_COLLECTION_RECORDED"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_IMAGE_UPLOADED"
  | "PRODUCT_IMAGE_COMPRESSED"
  | "PRODUCT_PRICE_UPDATED"
  | "PRODUCT_PUBLISHED"
  | "PRODUCT_UNPUBLISHED"
  | "PRODUCT_DELETED"
  | "PLAN_CREATED"
  | "PLAN_UPDATED"
  | "PLAN_ASSIGNED_TO_VENDOR"
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_DUE"
  | "SUBSCRIPTION_OVERDUE"
  | "COLLECTION_RECORDED"
  | "COLLECTION_APPROVED"
  | "FOLLOW_UP_RECORDED"
  | "WHATSAPP_COLLECTION_REMINDER_OPENED"
  | "SPOT_CHECK_SCHEDULED"
  | "SPOT_CHECK_COMPLETED"
  | "SPOT_CHECK_ESCALATED"
  | "CAH_LINK_CREATED"
  | "CAH_LINK_UPDATED"
  | "CATALOGUE_GENERATED"
  | "CATALOGUE_DOWNLOADED"
  | "CATALOGUE_DEPLOYED"
  | "CATALOGUE_EXPIRING_SOON"
  | "CATALOGUE_EXPIRED"
  | "CATALOGUE_REPLACED"
  | "CATALOGUE_ARCHIVED"
  | "CATALOGUE_REDEPLOYED"
  | "CATALOGUE_DELETED"
  | "CATALOGUE_UPDATED"
  | "STOREFRONT_GENERATED"
  | "STOREFRONT_DOWNLOADED"
  | "STOREFRONT_DEPLOYED"
  | "STOREFRONT_ARCHIVED"
  | "HTML_COPIED"
  | "FARM_PRODUCE_CREATED"
  | "FARM_PRODUCE_UPDATED"
  | "FARM_PRODUCE_AVAILABILITY_CHANGED"
  | "CAH_FOLLOWER_COUNT_UPDATED"
  | "FIRST_SYSADMIN_CREATED"
  | "STAFF_CREATED"
  | "STAFF_UPDATED"
  | "STAFF_SUSPENDED"
  | "STAFF_REACTIVATED"
  | "STAFF_LOCKED"
  | "STAFF_UNLOCKED"
  | "STAFF_PASSCODE_RESET"
  | "STAFF_PASSCODE_OVERRIDDEN"
  | "STAFF_ROLE_CHANGED"
  | "STAFF_DESK_CHANGED"
  | "STAFF_PERMISSIONS_UPDATED"
  | "STAFF_ARCHIVED"
  | "STAFF_LOGIN_SUCCESS"
  | "STAFF_LOGIN_FAILED"
  | "STAFF_LOCKED_AFTER_FAILED_ATTEMPTS"
  | "STAFF_LOGIN_BLOCKED_SUSPENDED"
  | "STAFF_LOGOUT"
  | "ACCESS_DENIED"
  | "STAFF_DELETE_REQUESTED"
  | "STAFF_DELETE_APPROVED"
  | "STAFF_DELETE_REJECTED"
  | "RPN_PIPELINE_UPDATED"
  | "RPN_PROSPECT_EDITED"
  | string;

export type VendorStorefrontStatus =
  | "draft"
  | "generated"
  | "deployed"
  | "archived"
  | "expired";

export interface VendorStorefront {
  id: string;
  storefrontId: string;
  vendorId: string;
  vendorSystemCode: string;
  vendorName: string;
  title: string;
  slogan: string;
  selectedProductIds: string[];
  selectedBranchIds: string[];
  selectedStaffIds: string[];
  selectedDeliveryContactIds: string[];
  selectedCAHLinkIds: string[];
  generatedBy: string;
  generatedAt: string;
  deployedAt?: string;
  expiryDate?: string;
  status: VendorStorefrontStatus;
  estimatedHtmlSize: number;
  productCount: number;
  imageCount: number;
  htmlFileName: string;
  fileName?: string;
  htmlContent?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  eventType: EventType;
  timestamp: string;
  actorType: ActorType;
  actorName: string;
  vendorId?: string;
  actorId?: string;
  vendorName?: string;
  productId?: string;
  productName?: string;
  rpnId?: string;
  catalogueId?: string;
  cahId?: string;
  cahBoothId?: string;
  subscriptionId?: string;
  storefrontId?: string;
  spotCheckId?: string;
  result?: "success" | "failed" | "blocked" | "locked" | "updated";
  details: any;
}

export type SpotCheckType =
  | "random"
  | "scheduled"
  | "complaint-based"
  | "renewal-based"
  | "BI-recommended";
export type SpotCheckResult =
  | "passed"
  | "minor issues"
  | "major issues"
  | "follow-up required";
export type SpotCheckStatus =
  | "recommended"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "escalated"
  | "cancelled";
export type SpotCheckSource =
  | "manual"
  | "whatsapp_hits"
  | "catalogue_hits"
  | "customer_complaints"
  | "bi_recommendation";
export type SpotCheckVarianceType =
  | "matched"
  | "possible_sales"
  | "stock_mismatch"
  | "overstated_stock"
  | "understated_stock";

export interface InventorySpotCheck {
  id: string;
  vendorId: string;
  vendorName?: string;
  productId?: string;
  productName?: string;
  branchId?: string;
  vendorSystemCode: string;
  vendorNameSnapshot: string;
  assignedRPNId?: string;
  backendStaffName: string;
  branchName?: string;
  sector: string;
  source?: SpotCheckSource;
  checkDate: string;
  type: SpotCheckType;
  startingQty?: number;
  listedQtyBeforeAudit?: number;
  physicalCountQty?: number;
  restockedQty?: number;
  adjustedQtyAfterAudit?: number;
  estimatedSalesQty?: number;
  varianceQty?: number;
  varianceType?: SpotCheckVarianceType;
  whatsappHits?: number;
  callHits?: number;
  searchHits?: number;
  complaintCount?: number;
  leadPressureScore?: number;
  stockAccuracyScore?: number;
  vendorReliabilityImpact?: number;
  actionRequired?: string;
  officeNotes?: string;
  vendorAdvice?: string;
  assignedToStaffId?: string;
  assignedToStaffName?: string;
  productsCheckedCount: number;
  productsCorrectCount: number;
  productsVarianceCount: number;
  productsMissingImagesCount: number;
  productsNeedingPriceUpdateCount: number;
  notes: string;
  result: SpotCheckResult;
  nextCheckDate?: string;
  status: SpotCheckStatus;
  completedAt?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  productMode?: "linked_product" | "branded_product";
  sourceType?: "master_linked" | "vendor_branded";
  masterProductId?: string | null;
  brandOwnerVendorId?: string;
  isVendorBranded?: boolean;
  brandDisplayName?: string;
  brandLogoUrl?: string;
  brandBannerUrl?: string;
  productId?: string;
  offerId?: string;
  vendorId: string;
  vendorName: string; // snapshot
  branchId: string;
  branchName: string; // snapshot
  productName?: string;
  country?: string;
  province?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  streetAddress?: string;
  sector: string;
  category: string;
  name: string;
  sku: string;
  productCode: string; // barcode
  barcode?: string;
  brand: string;
  model: string;
  description: string;
  tags: string[];
  keywords?: string[];
  searchableText?: string;
  additionalImages?: string[];
  images?: ListingImage[];
  unitOfMeasure: string;
  sellingPrice: number;
  buyingPrice?: number;
  oldPrice?: number;
  stockQuantity: number; // available quantity
  minStockAlert: number;
  locationDisplayText: string;
  imageUrl?: string; // Base64 compressed webp
  imageStatus: ImageStatus;
  source: FieldDataSource;
  collectedByRPNId?: string;
  enteredByStaffId: string;
  lastUpdatedBy: string;
  status: ProductStatus;
  publishToCatalogue: boolean;
  lastPriceUpdateDate?: string;
  lastImageUpdateDate?: string;
  createdAt: string;
  updatedAt: string;
  imageMetadata?: {
    originalName: string;
    originalSize: number;
    compressedSize: number;
  };

  // Farm Produce Fields
  isFarmProduce?: boolean;
  cropType?: string;
  cropVariety?: string;
  dateOfAvailability?: string;
  harvestWindowStartDate?: string;
  harvestWindowEndDate?: string;
  quantityAvailable?: number;
  quantityUnit?:
    | "kg"
    | "tonne"
    | "crate"
    | "bag"
    | "box"
    | "bundle"
    | "sack"
    | "litre"
    | "other";
  packagingType?:
    | "loose"
    | "bagged"
    | "boxed"
    | "crated"
    | "bottled"
    | "bundled"
    | "other";
  packagingSize?: string;
  minimumOrderQuantity?: number;
  farmLocation?: string;
  pickupLocation?: string;
  deliveryAvailable?: boolean;
  storageCondition?:
    | "fresh"
    | "dried"
    | "chilled"
    | "frozen"
    | "ambient"
    | "other";
  harvestStatus?:
    | "planted"
    | "growing"
    | "ready soon"
    | "ready now"
    | "sold out";
  producerNotes?: string;
}

export type DeploymentStatus =
  | "draft"
  | "generated"
  | "deployed"
  | "expired"
  | "replaced"
  | "archived";

export interface CatalogueGeneration {
  id: string;
  serialNumber: string; // Sector | Category | MMYY
  sector: string;
  category: string;
  province?: string;
  cityTown?: string;
  vendorIds: string[];
  cahLinkIds: string[];
  generatedBy: string;
  generatedAt: string;
  deployedAt?: string;
  expiryDate?: string;
  expiryPeriodDays: number;
  status: DeploymentStatus;
  replacementCatalogueId?: string;
  previousCatalogueId?: string;
  notes?: string;
  productCount: number;
  htmlSize?: number;
  fileName?: string;
  htmlContent?: string;
  archivedAt?: string;
  deletedAt?: string;
  hostedUrl?: string;
  publicSlug?: string;
  catalogueAnalyticsSnapshot?: any;
  configSnapshot?: {
    vendorIds: string[];
    cahLinkIds: string[];
    sector: string;
    category: string;
    province?: string;
    cityTown?: string;
    notes?: string;
    expiryPeriodDays: number;
    onlyActive: boolean;
    onlyPublished: boolean;
    includeOutOfStock: boolean;
    maxProducts: number;
    maxImages: number;
  };
}

export interface Subscription {
  id: string;
  vendorId: string;
  vendorNameSnapshot: string;
  assignedRPNId?: string;
  planId: string;
  amountDue: number;
  currency: string;
  billingPeriod: "monthly" | "quarterly" | "yearly";
  startDate: string;
  dueDate: string;
  gracePeriodDays: number;
  status: SubscriptionStatus;
  addOns?: Array<{
    addOnKey: "branded_products" | string;
    enabled: boolean;
    quantity: number;
    price: number;
    billingCycle: "monthly" | "quarterly" | "yearly" | string;
    startsAt?: string;
    endsAt?: string;
    status: "active" | "inactive" | "cancelled" | "expired" | string;
  }>;
  lastPaymentDate?: string;
  lastCollectionAmount?: number;
  collectionMethod?: CollectionMethod;
  popNote?: string; // Proof of payment note
  followUpStatus: FollowUpStatus;
  nextFollowUpDate?: string;
  collectionNotes?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionRecord {
  id: string;
  vendorId: string;
  vendorNameSnapshot: string;
  rpnId?: string;
  staffId: string; // backend staff
  amountCollected: number;
  currency: string;
  collectionDate: string;
  collectionMethod: CollectionMethod;
  referenceNumber: string;
  notes: string;
  status: CollectionRecordStatus;
  approvedBy?: string;
  approvedAt?: string;
  receiptNumber?: string;
  financeTransactionId?: string;
  rpnCommissionGenerated?: boolean;
  createdAt: string;
}

export interface VendorSubscriptionPayment {
  id: string;
  vendorId: string;
  vendorName: string;
  rpnId?: string;
  rpnName?: string;
  planId?: string;
  planName?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  paymentStatus:
    | "unpaid"
    | "partial"
    | "paid"
    | "overdue"
    | "waived"
    | "cancelled";
  paymentDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  receiptNumber?: string;
  financeTransactionId?: string;
  rpnCommissionGenerated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RPNLevel = "Junior RPN" | "Leader RPN" | "IMM";
export type RPNStatus = "active" | "suspended" | "inactive";

export interface RPN {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  province: string;
  cityTown: string;
  district: string;
  territory: string;
  status: RPNStatus;
  level: RPNLevel;
  notes: string;
  assignedVendors: string[]; // Vendor IDs
  createdAt: string;
  updatedAt: string;
  personalDetails?: {
    nationalId?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    nextOfKinName?: string;
    nextOfKinPhone?: string;
    nextOfKinRelationship?: string;
    highestEducation?: string;
    skills?: string;
  };
  addressDetails?: {
    country?: string;
    province?: string;
    cityTown?: string;
    district?: string;
    suburb?: string;
    streetAddress?: string;
    gpsNotes?: string;
  };
  kycDetails?: {
    idType?: string;
    idNumber?: string;
    kycStatus?: "not_started" | "pending" | "verified" | "rejected";
    verifiedByStaffId?: string;
    verifiedByName?: string;
    verifiedAt?: string;
    notes?: string;
    vettingNotes?: string;
  };
  kycDocuments?: {
    passportPhotoUrl?: string;
    passportPhotoName?: string;
    passportPhotoUpdatedAt?: string;
  };
}

export type RpnChurnBonusType = "fixed" | "percentage_of_recurring_revenue";
export type RpnAssignmentStatus = "active" | "released" | "transferred";
export type RpnOnboardingLogStatus = "pending" | "approved" | "rejected" | "duplicate";
export type RpnCompensationRunStatus =
  | "draft"
  | "reviewed"
  | "approved"
  | "posted"
  | "paid"
  | "cancelled";

export interface RpnCompensationPlan {
  id: string;
  name: string;
  isActive: boolean;
  wageEnabled: boolean;
  dailyVendorTarget: number;
  wageRatePerVendor: number;
  maxDailyWagePayable: number;
  portfolioCeiling: number;
  recurringCommissionEnabled: boolean;
  recurringCommissionRate: number;
  churnBonusEnabled: boolean;
  churnThresholdPercent: number;
  churnBonusType: RpnChurnBonusType;
  churnBonusValue: number;
  autoDisableWageAfterThreshold: boolean;
  switchToCommissionOnlyAfterMonths: number;
  createdAt: string;
  updatedAt: string;
}

export interface RpnCompensationPolicy {
  id: string;
  rpnId: string;
  planId: string;
  wageEnabledOverride?: boolean;
  commissionOnly: boolean;
  recurringCommissionRateOverride?: number;
  movedToCommissionOnlyAt?: string;
  movedToCommissionOnlyBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RpnVendorAssignment {
  id: string;
  vendorId: string;
  vendorName: string;
  rpnId: string;
  rpnName: string;
  status: RpnAssignmentStatus;
  assignedAt: string;
  releasedAt?: string;
  releaseReason?: string;
  transferredToRpnId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RpnOnboardingLog {
  id: string;
  rpnId: string;
  rpnName: string;
  vendorId: string;
  vendorName: string;
  onboardingDate: string;
  status: RpnOnboardingLogStatus;
  qualifiesForWage: boolean;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RpnCompensationRunLine {
  id: string;
  runId: string;
  rpnId: string;
  rpnName: string;
  planId: string;
  portfolioCount: number;
  portfolioCeiling: number;
  openingActivePortfolio: number;
  churnedVendors: number;
  churnRatePercent: number;
  qualifyingOnboardings: number;
  wageAmount: number;
  recurringRevenue: number;
  recurringCommissionAmount: number;
  churnBonusAmount: number;
  totalPayable: number;
  commissionOnly: boolean;
  overPortfolioCeiling: boolean;
  readyForCommissionOnly: boolean;
  notes?: string;
}

export interface RpnCommissionPosting {
  id: string;
  runId: string;
  ledgerEntryIds: string[];
  postedAt: string;
  postedBy?: string;
  status: "posted" | "reversed";
}

export interface RpnPaymentBatch {
  id: string;
  runId: string;
  paymentAccountId: string;
  ledgerEntryIds: string[];
  paidAt: string;
  paidBy?: string;
  totalPaid: number;
  status: "paid" | "reversed";
}

export interface RpnCompensationRun {
  id: string;
  periodFrom: string;
  periodTo: string;
  status: RpnCompensationRunStatus;
  lines: RpnCompensationRunLine[];
  wageTotal: number;
  recurringCommissionTotal: number;
  churnBonusTotal: number;
  totalPayable: number;
  postedAt?: string;
  paidAt?: string;
  paymentAccountId?: string;
  posting?: RpnCommissionPosting;
  paymentBatch?: RpnPaymentBatch;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RpnCompensationLedgerTransactionType =
  | "onboarding_wage"
  | "recurring_commission"
  | "churn_bonus"
  | "manual_adjustment"
  | "wage_reversal"
  | "commission_reversal"
  | "bonus_reversal"
  | "coa_posting"
  | "payment";

export interface RpnCompensationLedgerEntry {
  id: string;
  rpnId: string;
  rpnName?: string;
  transactionDate: string;
  periodFrom: string;
  periodTo: string;
  transactionType: RpnCompensationLedgerTransactionType;
  sourceType: "compensation_run" | "run_line" | "manual" | "coa" | "cashbook" | "reversal";
  sourceId: string;
  compensationRunId?: string;
  vendorId?: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  currency: string;
  status: "draft" | "approved" | "posted" | "paid" | "reversed" | "cancelled";
  coaDebitAccountId?: string;
  coaCreditAccountId?: string;
  cashbookEntryId?: string;
  journalEntryId?: string;
  description: string;
  createdBy?: string;
  createdAt: string;
}

export interface RpnCompensationStatementReport {
  rpnId: string;
  rpnName: string;
  periodFrom: string;
  periodTo: string;
  wageEarned: number;
  recurringCommissionEarned: number;
  churnBonusEarned: number;
  adjustments: number;
  reversals: number;
  totalEarned: number;
  amountPaid: number;
  balanceDue: number;
  portfolioVendorCount: number;
  returningVendorCount: number;
  churnRatePercent: number;
  commissionRate: number;
  wageStatus: "enabled" | "disabled" | "commission_only";
}

export interface RpnPayablesLedgerReport {
  rpnId: string;
  rpnName: string;
  openingBalance: number;
  wageEarned: number;
  commissionEarned: number;
  bonusEarned: number;
  adjustments: number;
  reversals: number;
  payments: number;
  closingBalance: number;
}

export interface RpnPortfolioRevenueReport {
  rpnId: string;
  rpnName: string;
  openingPortfolioVendors: number;
  newVendorsOnboarded: number;
  returningVendors: number;
  churnedVendors: number;
  grossVendorRevenueReceived: number;
  wageCost: number;
  commissionCost: number;
  bonusCost: number;
  totalRpnCost: number;
  netRpnContribution: number;
  portfolioCeilingUsagePercent: number;
}

export interface RpnChurnRetentionReport {
  rpnId: string;
  rpnName: string;
  openingActiveVendors: number;
  returningVendors: number;
  churnedVendors: number;
  churnPercentage: number;
  churnThreshold: number;
  bonusQualification: boolean;
  bonusAmount: number;
  highChurnWarning: boolean;
}

export interface RpnCashbookPaymentReport {
  paymentDate: string;
  rpnId: string;
  rpnName: string;
  amount: number;
  paymentAccount: string;
  paymentMethod: string;
  reference: string;
  cashbookEntryId?: string;
  compensationRunId: string;
  paidBy?: string;
  status: string;
}

export interface RpnProfitabilityReport {
  rpnId: string;
  rpnName: string;
  grossRevenueFromAssignedVendors: number;
  wageCost: number;
  commissionCost: number;
  bonusCost: number;
  totalRpnCost: number;
  netContribution: number;
  costToRevenuePercentage: number;
  churnImpact: number;
  portfolioProductivity: number;
}

export interface RpnCompensationException {
  id: string;
  severity: "warning" | "high" | "critical";
  type:
    | "duplicate_active_assignment"
    | "receipt_without_assignment"
    | "reversed_receipt_after_commission"
    | "unapproved_onboarding_wage"
    | "portfolio_ceiling"
    | "duplicate_vendor_count"
    | "posted_unpaid"
    | "unusual_commission"
    | "commission_only_wage";
  message: string;
  rpnId?: string;
  vendorId?: string;
  compensationRunId?: string;
}

export interface RpnCompensationReportFilters {
  dateFrom?: string;
  dateTo?: string;
  rpnId?: string;
  vendorId?: string;
  compensationRunId?: string;
  status?: string;
  transactionType?: RpnCompensationLedgerTransactionType | "";
  paymentStatus?: string;
}

export type CollectionType =
  | "vendor profile"
  | "itred_products"
  | "price update"
  | "image update"
  | "subscription collection"
  | "follow-up"
  | "prospect_details";

export type CollectionStatus =
  | "pending backend entry"
  | "entered"
  | "rejected"
  | "needs clarification";

export interface FieldCollectionRecord {
  id: string;
  rpnId: string;
  vendorId: string;
  dateCollected: string;
  type: CollectionType;
  productCount: number;
  imageCount: number;
  notes: string;
  status: CollectionStatus;
  assignedStaffId: string;
  createdAt: string;
  updatedAt: string;
}

export type CAHLinkType =
  | "WhatsApp Community"
  | "WhatsApp Channel"
  | "WhatsApp Group"
  | "WhatsApp Customer Support"
  | "Sector Group"
  | "Vendor Support Group"
  | "Customer Discovery Group"
  | "RPN Support Group"
  | "Catalogue Distribution Group"
  | "Other";

export type MarketingCampaignType =
  | "Radio"
  | "TV"
  | "Roadshow"
  | "WhatsApp"
  | "Flyer"
  | "Social Media"
  | "Referral"
  | "Commerce Access Hub"
  | "Other";

export interface MarketingCampaign {
  id: string;
  campaignName: string;
  campaignType: MarketingCampaignType;
  startDate: string;
  endDate: string;
  targetArea?: string;
  targetSector?: string;
  budget: number;
  message?: string;
  channelPartner?: string;
  assignedRpnIds: string[];
  campaignCode: string;
  status: "active" | "completed" | "paused";
  createdAt: string;
  updatedAt: string;
}

export type CAHTargetAudience =
  | "customers"
  | "itred_vendors"
  | "RPN"
  | "backend staff"
  | "mixed";
export type CAHStatus = "active" | "inactive" | "archived";

export interface CAHLink {
  id: string;
  firestoreDocId?: string;
  /** @deprecated use id */
  cahId?: string;
  name: string;
  type: CAHLinkType;
  status: CAHStatus;
  description: string;
  targetAudience: CAHTargetAudience;
  sector?: string;
  category?: string;
  province: string;
  cityTown: string;
  district: string;
  suburb?: string;

  // WhatsApp Distribution
  whatsappCommunityName?: string;
  whatsappCommunityLink?: string;
  whatsappCommunityCount?: number;
  whatsappChannelName?: string;
  whatsappChannelLink?: string;
  whatsappChannelCount?: number;
  whatsappGroupName?: string;
  whatsappGroupLink?: string;
  whatsappGroupCount?: number;
  additionalWhatsappGroups?: string[];
  catalogueDistributionGroupLink?: string;
  vendorSupportGroupLink?: string;
  customerDiscoveryGroupLink?: string;
  rpnSupportGroupLink?: string;

  // Customer Support
  supportName?: string;
  supportNumber?: string;
  supportWhatsappNumber?: string;
  supportLink?: string;
  supportMessageTemplate?: string;
  supportAvailabilityNotes?: string;

  // Catalogue Deployment Linkage
  linkedCatalogueSectors?: string[];
  linkedCatalogueCategories?: string[];
  linkedDeployedCatalogueIds?: string[];
  lastCatalogueSharedDate?: string;
  lastCatalogueSerialNumberShared?: string;
  nextCatalogueRefreshDueDate?: string;

  // Tracking & Analytics
  currentFollowerCount?: number;
  previousFollowerCount?: number;
  followerCountUpdatedAt?: string;
  followerCountUpdatedBy?: string;
  followerGrowth?: number;
  followerGrowthPercentage?: number;
  followerGrowthNotes?: string;

  // Internal legacy support
  whatsappUrl: string;
  url?: string;
  vendorId?: string;
  showInCatalogue?: boolean;
  locationLink?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

// Removed redundant Subscription interface replaced above

export interface BIReport {
  id: string;
  vendorId: string;
  timestamp: string;
  score: number;
  issuesCount: number;
  recommendations: string[];
}
export type CAHBoothStatus =
  | "planned"
  | "active"
  | "maintenance"
  | "suspended"
  | "closed";
export type CAHBoothInternetType =
  | "Starlink"
  | "Fibre"
  | "LTE"
  | "WiFi partner"
  | "Other";
export type CAHBoothInternetStatus =
  | "active"
  | "unstable"
  | "offline"
  | "suspended";
export type CAHBoothPowerSource =
  | "grid"
  | "solar"
  | "battery"
  | "generator"
  | "mixed";

export interface CAHBooth {
  id: string; // Booth ID
  code: string;
  name: string;
  province: string;
  cityTown: string;
  district: string;
  suburb: string;
  streetLocation: string;
  gpsCoordinates?: string;
  hostName: string;
  hostPhone: string; // internal only
  assignedRPNId?: string;
  assignedStaffId?: string;
  internetType: CAHBoothInternetType;
  internetStatus: CAHBoothInternetStatus;
  powerSource: CAHBoothPowerSource;
  operatingHours: string;
  customerAccessNotes: string;
  supportedSectors: string[];
  linkedWhatsappCommunityId?: string;
  linkedWhatsappChannelId?: string;
  linkedWhatsappGroupIds: string[];
  status: CAHBoothStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CAHBoothAssetType =
  | "router"
  | "Starlink kit"
  | "table"
  | "chair"
  | "signage"
  | "phone"
  | "tablet"
  | "laptop"
  | "power bank"
  | "solar equipment"
  | "printer"
  | "other";
export type CAHBoothAssetCondition =
  | "new"
  | "good"
  | "fair"
  | "damaged"
  | "missing";

export interface CAHBoothAsset {
  id: string;
  boothId: string;
  type: CAHBoothAssetType;
  name: string;
  serialNumber: string;
  condition: CAHBoothAssetCondition;
  assignedDate: string;
  lastCheckedDate: string;
  checkedById: string;
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | "approval_request"
  | "staff_task"
  | "task_due"
  | "vendor_readiness"
  | "subscription_due"
  | "subscription_overdue"
  | "lead_followup" // This might be deprecated in favor of RPNFollowUpTask
  | "catalogue_warning"
  | "customer_feedback"
  | "system_alert"
  | "finance_report"
  | "notification"
  | "permission_change";
export type NotificationPriority = "low" | "medium" | "high" | "critical";
export type NotificationStatus =
  | "unread"
  | "read"
  | "resolved"
  | "archived"
  | "dismissed";

export interface ITredNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  targetRole?: string;
  assignedToStaffId?: string;
  assignedToName?: string;
  createdByStaffId?: string;
  createdByName?: string;
  recordType: string;
  recordId: string;
  status: NotificationStatus;
  dedupeKey?: string;
  createdAt: string;
  updatedAt?: string;
  readAt?: string;
  resolvedAt?: string;
  archivedAt?: string;
}

export type AppNotification = ITredNotification;

export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "returned_for_correction"
  | "cancelled";
export type RequestRiskLevel = "low" | "medium" | "high" | "critical";

export interface ApprovalRequest {
  id: string;
  requestType:
    | "vendor_create"
    | "vendor_update"
    | "product_create"
    | "product_update"
    | "price_change"
    | "catalogue_deploy"
    | "cah_link_create"
    | "subscription_change"
    | "lead_conversion"
    | "rpn_agent_update"
    | "staff_kyc_update"
    | "permission_change"
    | "finance_report_print"
    | "rpn_commission_payout"
    | "Duplicate Vendor Override"
    | "staff_delete";
  recordType: string;
  recordId: string;
  recordName?: string;
  submittedByStaffId: string;
  submittedByName: string;
  assignedManagerId?: string;
  assignedManagerName?: string;
  status: ApprovalRequestStatus;
  riskLevel: RequestRiskLevel;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  managerComment?: string;
  correctionNotes?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedByStaffId?: string;
  reviewedByName?: string;
}

export type StaffTaskType =
  | "vendor_cleanup"
  | "vendor_readiness"
  | "product_image_fix"
  | "price_confirmation"
  | "lead_followup"
  | "catalogue_review"
  | "customer_feedback_followup";
export type StaffTaskStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "reviewed"
  | "cancelled";
export type StaffTaskPriority = "low" | "medium" | "high" | "critical";

export interface StaffTask {
  id: string;
  title: string;
  description: string;
  assignedToStaffId: string;
  assignedToName: string;
  assignedByStaffId: string;
  assignedByName: string;
  module: string;
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  dueDate: string;
  notes?: string;
  reviewNotes?: string;
  completedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  taskType?: StaffTaskType;
  relatedRecordType?: string;
  relatedRecordId?: string;
  dueAt?: string;
  vendorId?: string;
  vendorName?: string;
  productId?: string;
  productName?: string;
  assignedDesk?: string;
  sourceModule?: string;
  metadata?: Record<string, any>;
}

export interface RPNFollowUpTask {
  id: string;
  prospectId: string;
  prospectName: string;
  assignedToStaffId: string;
  assignedToStaffName: string;
  dueDate: string;
  status: "Pending" | "Completed" | "Cancelled";
  notes?: string;
  completionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type StaffMessageType = "direct" | "group" | "task" | "alert";
export type StaffMessagePriority = "normal" | "high" | "critical";
export type StaffChatTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "overdue";

export interface StaffMessage {
  id: string;
  threadId: string;
  messageType: StaffMessageType;
  fromStaffId: string;
  fromStaffName: string;
  toStaffId?: string;
  toStaffName?: string;
  groupId?: string;
  groupName?: string;
  targetDesk?: string;
  targetRole?: string;
  message: string;
  priority: StaffMessagePriority;
  relatedModule?: string;
  relatedRecordId?: string;
  taskId?: string;
  taskTitle?: string;
  taskDescription?: string;
  assignedToStaffId?: string;
  dueDate?: string;
  taskStatus?: StaffChatTaskStatus;
  readBy?: string[];
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffChatThread {
  id: string;
  threadType: "direct" | "group";
  participantStaffIds: string[];
  groupId?: string;
  groupName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadBy?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffChatGroup {
  id: string;
  groupName: string;
  targetDesk?: string;
  targetRole?: string;
  memberStaffIds?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffChatMonitorSummary {
  unreadByStaff: Array<{
    staffId: string;
    staffName: string;
    unreadCount: number;
  }>;
  overdueTaskMessages: StaffMessage[];
  unresolvedCriticalMessages: StaffMessage[];
  responseDelays: Array<{
    staffId: string;
    staffName: string;
    oldestUnreadAt: string;
    hoursWaiting: number;
  }>;
  activity: Array<{
    staffId: string;
    staffName: string;
    sentCount: number;
    receivedUnreadCount: number;
  }>;
}

export interface FeedbackWhatsAppRoute {
  id: string;
  deskName: string;
  whatsappNumber: string;
  purpose:
    | "SURVEY_FEEDBACK"
    | "LEAD_FOLLOWUP"
    | "COMPLAINTS"
    | "CATALOGUE_IMPACT"
    | "DEFAULT";
  sector?: string;
  category?: string;
  province?: string;
  cityTown?: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorReadinessResult {
  vendorId: string;
  vendorName: string;
  score: number;
  level: "Ready" | "Needs Attention" | "Critical" | string;
  missingItems: string[];
  recommendedActions: string[];
}

export interface EstimatedRevenueGrowth {
  leadCount: number;
  estimatedConvertedLeads: number;
  averageLeadConversionRatePercent: number;
  averageOrderValueUsd: number;
  leadRevenueConfidenceFactor: number;
  estimatedGrossRevenue: number;
  estimatedRevenueGrowth: number;
}

export interface RPNAppointment {
  id: string;
  [key: string]: any;
}

export interface RPNInvitationPipelineItem {
  id: string;
  [key: string]: any;
}

export interface CatalogueContactHubSettings {
  whatsappCommunityGroups: any[];
  marketingPhoneContacts: any[];
  marketingWhatsappContacts: any[];
  updatedAt?: string;
  seigenLogoUrl?: string;
  companyLogoUrl?: string;
  systemLogoUrl?: string;
}

export interface RPNPerformanceSettings {
  dailyOnboardingThreshold?: number;
  weeklyOnboardingThreshold?: number;
  monthlyOnboardingThreshold?: number;
  minimumActiveVendorRetentionRate?: number;
  bonusEligibilityTargetPercent?: number;
  underperformanceAlertDays?: number;
  churnRiskThreshold?: number;
  churnWarningPercent?: number;
  minimumCollectionRatePercent?: number;
  graceDaysBeforeWarning?: number;
  minimumRevenueContributionTarget?: number;
  campaignAttributionWindowDays?: number;
  subscriptionDueWarningDays?: number;
  subscriptionOverdueEscalationDays?: number;
  recurringVendorRetentionTarget?: number;
  minimumRecurringRevenueTarget?: number;
  enableThresholdAlerts?: boolean;
  requireApprovalForThresholdChange?: boolean;
  rpnOnboardingCommissionAmount?: number;
  rpnRecurringCommissionPercent?: number;
  rpnRecurringCommissionAfterMonths?: number;
  rpnSalaryDropAfterMonths?: number;
  rpnPostSalaryRecurringCommissionPercent?: number;
  rpnCommissionCurrency?: string;
  updatedAt?: string;
  updatedByStaffId?: string;
  updatedByName?: string;
}

export interface SystemSettings {
  seigenLogoUrl?: string;
  feedbackWhatsAppRoutes?: FeedbackWhatsAppRoute[];
  defaultFeedbackWhatsAppNumber?: string;
  catalogueSupportTitle?: string;
  catalogueSupportMessage?: string;
  catalogueSupportWhatsAppNumber?: string;
  syncEndpointUrl?: string;
  rpnPerformanceSettings?: RPNPerformanceSettings;
  vendorReadinessTaskThreshold?: number;
  enableReadinessAutoTasks?: boolean;
  readinessTaskCooldownDays?: number;
  averageLeadConversionRatePercent?: number;
  averageOrderValueUsd?: number;
  leadRevenueConfidenceFactor?: number;
  financeCustomSubTypes?: Partial<Record<AccountType, string[]>>;
  customBusinessTypes?: string[];
  customSectors?: string[];
  customProductCategories?: Partial<Record<string, string[]>>;
  catalogueArchiveRetentionDays?: number;
  enableSessionTimeout?: boolean;
  sessionTimeoutMinutes?: number;
  updatedAt?: string;
}

export interface StaffAuditLog {
  id: string;
  eventType:
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "LOGOUT"
    | "PAGE_VIEWED"
    | "ACCESS_DENIED"
    | "RECORD_CREATED"
    | "RECORD_UPDATED"
    | "RECORD_DELETED"
    | "APPROVAL_SUBMITTED"
    | "APPROVAL_APPROVED"
    | "APPROVAL_REJECTED"
    | "APPROVAL_RETURNED"
    | "CATALOGUE_GENERATED"
    | "CATALOGUE_DEPLOYED"
    | "STOREFRONT_GENERATED"
    | "WHATSAPP_ACTIVITY_LOGGED"
    | "WHATSAPP_INTELLIGENCE_LOGGED"
    | "COMPLAINT_RESOLVED"
    | "FOLLOWUP_ASSIGNED"
    | "ISSUE_ESCALATED"
    | "LEAD_FOLLOWED_UP"
    | "PRICE_CHANGED"
    | "STOCK_CHANGED"
    | "SUBSCRIPTION_CHANGED"
    | "PERMISSION_CHANGED"
    | "EXPORT_DOWNLOADED"
    | "SYSTEM_SETTING_CHANGED"
    | "TASK_CREATED"
    | "TASK_STATUS_UPDATED"
    | "TASK_REVIEWED"
    | "TASK_CANCELLED"
    | "NOTIFICATION_UPDATED"
    | "REPORT_PRINTED"
    | "REPORT_EXPORT_REQUESTED"
    | string;
  severity: "info" | "warning" | "high" | "critical";
  staffId: string;
  staffName: string;
  staffRole?: string;
  module:
    | "auth"
    | "vendor"
    | "product"
    | "catalogue"
    | "storefront"
    | "cah"
    | "whatsapp"
    | "pricing"
    | "subscription"
    | "staff"
    | "roles"
    | "approval"
    | "staff_tasks"
    | "notifications"
    | "catalogue_archive"
    | "finance"
    | "finance_reports"
    | "settings"
    | "analytics"
    | "rpn"
    | "system"
    | "staff_chat"
    | "vendor_readiness"
    | "vendor_products"
    | string;
  action: string;
  recordType?: string;
  recordId?: string;
  recordName?: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  reason?: string;
  managerComment?: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    language?: string;
  };
  sessionId?: string;
  createdAt: string;
}

export type PipelineStage =
  | "New Prospect"
  | "Contacted"
  | "Introduction Sent"
  | "Interested"
  | "Follow-up Required"
  | "Demo Scheduled"
  | "Negotiation"
  | "Ready for Onboarding"
  | "Onboarded"
  | "Not Interested"
  | "Dormant"
  | "Rejected"
  // Legacy pipeline stages
  | "New Query"
  | "Invitation Sent"
  | "Appointment Set"
  | "Visited / Demo Done"
  | "Business Details Collected"
  | "Products Requested"
  | "Onboarding Started"
  | "Converted to Vendor"
  | "Deferred"
  | "Closed / Lost";

export const PROSPECT_PIPELINE_STAGES: PipelineStage[] = [
  "New Prospect",
  "Contacted",
  "Introduction Sent",
  "Interested",
  "Follow-up Required",
  "Demo Scheduled",
  "Negotiation",
  "Ready for Onboarding",
  "Onboarded",
  "Not Interested",
  "Dormant",
  "Rejected",
];

export type ProspectSourceType =
  | "Phone Call"
  | "WhatsApp Introduction"
  | "Referral"
  | "Field Visit"
  | "Walk-in"
  | "Marketing Response"
  | "Other";

export const PROSPECT_SOURCE_TYPES: ProspectSourceType[] = [
  "Phone Call",
  "WhatsApp Introduction",
  "Referral",
  "Field Visit",
  "Walk-in",
  "Marketing Response",
  "Other",
];

export interface ProspectActivityLog {
  id: string;
  prospectId: string;
  actionType: string;
  actionLabel: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
  createdBy: string;
  createdByRole?: string;
  createdAt: string;
}

export type ProspectPriority = "Low" | "Medium" | "High" | "Urgent" | "Critical";

export const PROSPECT_PRIORITIES: ProspectPriority[] = [
  "Low",
  "Medium",
  "High",
  "Urgent",
  "Critical",
];

export const PROSPECT_COST_CATEGORIES = [
  "estimatedCost",
  "transportCost",
  "airtimeCost",
  "otherCost",
  "totalCost",
] as const;

export type RPNProspectSource =
  | "Phone"
  | "WhatsApp Intro"
  | "Referral"
  | "Field Visit"
  | "Other";

export interface RPNProspectQuery {
  id: string;
  prospectName?: string;
  contactPerson?: string;
  businessName?: string;
  phone?: string;
  whatsapp?: string;
  whatsappNumber?: string;
  sector?: string;
  category?: string;
  location?: string;
  suburb?: string;
  district?: string;
  city?: string;
  querySource?: RPNProspectSource | string;
  sourceType?: ProspectSourceType | string;
  sourceName?: string;
  referredBy?: string;
  campaignName?: string;
  urgency?: UrgencyLevel;
  priority?: ProspectPriority;
  notes?: string;
  introLetterSent?: boolean;
  phoneCallMade?: boolean;
  taskObjective?: string;
  costFactors?: string | number;
  estimatedCost?: number;
  transportCost?: number;
  airtimeCost?: number;
  otherCost?: number;
  totalCost?: number;
  estimatedTransportCost?: number;
  estimatedAirtimeCost?: number;
  estimatedOtherCost?: number;
  totalEstimatedCost?: number;
  actualTransportCost?: number;
  actualAirtimeCost?: number;
  actualOtherCost?: number;
  totalActualCost?: number;
  costNotes?: string;
  lastActivityDate?: string;
  lastActivityNote?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  pipelineStage: PipelineStage;
  stageUpdatedAt: string;
  stageUpdatedBy: string;
  stageHistory: Array<{
    stage: PipelineStage;
    enteredAt: string;
    enteredByStaffId?: string;
    enteredByStaffName?: string;
    notes?: string;
    fromStage?: PipelineStage;
  }>;
  assignedRpnId?: string;
  assignedRpnName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignmentDate?: string;
  assignmentRole?: "Owner" | "Support" | "Observer" | string;
  nextFollowUpDate?: string;
  followUpDate?: string;
  timelineNotes?: string;
  status?: "Converted" | string;
  conversionDate?: string;
  activityHistory?: ProspectActivityLog[];
}

export interface RPNWorkflowAnalytics {
  totalProspects: number;
  prospectsToday: number;
  invitationsToday: number;
  appointmentsBookedToday: number;
  appointmentsCompletedToday: number;
  conversionsToday: number;
  overdueFollowUps: number;
  conversionRate: number;
  bestSource: string;
  bestSector: string;
  bestArea: string;
  averageDaysToConversion: number;
}
