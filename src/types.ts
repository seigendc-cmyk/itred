/**
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
  | "Viewer Desk";

export type PermissionLevel =
  | "hidden"
  | "view"
  | "create"
  | "edit"
  | "approve"
  | "delete"
  | "export"
  | "full";

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
  | "whatsappCommunityBI";

export type MenuPermissions = Partial<Record<MenuKey, PermissionLevel>>;

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
  province: string;
  cityTown: string;
  district: string;
  suburb: string;
  address: string;
  managerName: string;
  openingHours: string;
  isDefault: boolean;
  status: "active" | "suspended";
}

export interface Staff {
  id: string;
  staffCode: string;
  fullName: string;
  displayName: string;
  role: string;
  desk: DeskType;
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
    | "archived";
  passcode: string;
  mustChangePasscode: boolean;
  failedAttemptCount: number;
  isLocked: boolean;
  lastLoginDate?: string;
  lastLogoutDate?: string;
  // Permissions are now an object mapping MenuKey to PermissionLevel
  menuPermissions: MenuPermissions;
  createdBy: string;
  updatedBy: string;
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

export type FeatureStatus = "active" | "inactive" | "archived";
export type DeploymentFrequency = "weekly" | "bi-weekly" | "monthly" | "custom";
export type BIAnalyticsLevel = "none" | "basic" | "standard" | "advanced";
export type RPNSupportLevel = "none" | "basic" | "standard" | "priority";
export type FarmProducerShowcaseLevel = "none" | "basic" | "full";
export type CahBoothSupportLevel = "none" | "basic" | "priority";
export type CahFollowerTrackingLevel = "none" | "basic" | "advanced";

export interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  maxProducts: number;
  maxVendorsPerCatalogue: number;
  maxImagesPerCatalogue: number;
  deploymentFrequency: DeploymentFrequency;
  maxDeploymentsPerMonth: number;
  maxCahLinks: number;
  maxBranchesPerVendor: number;
  maxStaffPerVendor: number;
  maxDeliveryContactsPerVendor: number;
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

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "due"
  | "overdue"
  | "paid"
  | "suspended"
  | "cancelled";
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
  name: string;
  tradingName: string;
  ownerFullName: string;
  sector: string;
  businessType: string;
  vendorType: VendorType;
  mainPhone: string;
  whatsappNumber: string;
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
  catalogueDisplayName: string;
  catalogueSlogan: string;
  openingHours: string;
  whatsappGroupLink?: string;
  whatsappChannelLink?: string;
  status: VendorStatus;

  // Management & Subscription
  assignedRPNId?: string;
  assignedStaffId?: string;
  planId: string; // References PricingPlan.id
  subscriptionStatus: SubscriptionStatus;
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
}

export type ProductStatus =
  | "active"
  | "hidden"
  | "out_of_stock"
  | "discontinued";
export type ImageStatus =
  | "missing"
  | "uploaded"
  | "compressed"
  | "approved"
  | "needs replacement";

export type ActorType = "backend_staff" | "rpn" | "admin" | "system";

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
  | "ACCESS_DENIED";

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
  | "scheduled"
  | "completed"
  | "cancelled"
  | "escalated";

export interface InventorySpotCheck {
  id: string;
  vendorId: string;
  vendorSystemCode: string;
  vendorNameSnapshot: string;
  assignedRPNId?: string;
  backendStaffName: string;
  branchName?: string;
  sector: string;
  checkDate: string;
  type: SpotCheckType;
  productsCheckedCount: number;
  productsCorrectCount: number;
  productsVarianceCount: number;
  productsMissingImagesCount: number;
  productsNeedingPriceUpdateCount: number;
  notes: string;
  result: SpotCheckResult;
  nextCheckDate?: string;
  status: SpotCheckStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  vendorId: string;
  vendorName: string; // snapshot
  branchId: string;
  branchName: string; // snapshot
  sector: string;
  category: string;
  name: string;
  sku: string;
  productCode: string; // barcode
  brand: string;
  model: string;
  description: string;
  tags: string[];
  unitOfMeasure: string;
  sellingPrice: number;
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
  createdAt: string;
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
}

export type CollectionType =
  | "vendor profile"
  | "itred_products"
  | "price update"
  | "image update"
  | "subscription collection"
  | "follow-up";

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

export type CAHTargetAudience =
  | "customers"
  | "itred_vendors"
  | "RPN"
  | "backend staff"
  | "mixed";
export type CAHStatus = "active" | "inactive" | "archived";

export interface CAHLink {
  id: string;
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
  | "WHATSAPP"
  | "VENDOR"
  | "CATALOGUE"
  | "STOREFRONT"
  | "RPN"
  | "SYSTEM"
  | "SUBSCRIPTION";
export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL" | "SYSTEM";
export type NotificationStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "RESOLVED"
  | "DISMISSED";

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  relatedModule?: string;
  relatedRecordId?: string;
  actionPath?: string;
  status: NotificationStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface SystemSettings {
  seigenLogoUrl?: string;
  updatedAt?: string;
}
