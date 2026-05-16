/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Store,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ChevronRight,
  MapPin,
  Users,
  Briefcase,
  Calendar,
  DollarSign,
  Package,
  FileCode,
  Save,
  X,
  PlusCircle,
  Clock,
  User,
  Info,
  Layers,
  Globe,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  TablePanel,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  SearchInput,
  ConfirmDialog,
  DataPanel,
  BrandedAlertModal,
} from "../components/CommonUI.tsx";
import { vendorService } from "../services/vendorService.ts";
import { rpnService } from "../services/rpnService.ts";
import { productService } from "../services/productService.ts";
import { catalogueService } from "../services/catalogueService.ts";
import { logService } from "../services/logService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { pdfService } from "../services/pdfService.ts";
import { permissionService } from "../services/permissionService.ts";
import { staffService } from "../services/staffService.ts";
import { staffAuditService } from "../services/staffAuditService.ts";
import {
  Vendor,
  RPN,
  AppRoute,
  VendorStatus,
  SubscriptionStatus,
  FieldDataSource,
  Branch,
  PricingPlan,
  Product,
  MasterProduct,
  VendorProductOffer,
  CatalogueGeneration,
  Staff,
} from "../types.ts";
import { asArray } from "../utils/safeData.ts";
import { optimizeImageToWebP } from "../utils/imageUtils.ts";
import { findSimilarVendors } from "../utils/duplicateDetection.ts";
import { approvalService } from "../services/approvalService.ts";

const SECTORS = [
  "General Retail",
  "Motor Spares / Automotive",
  "Industrial Parts",
  "Hardware & Tools",
  "Construction",
  "Agriculture",
  "Food & Beverage",
  "Grocery",
  "Health / Medical",
  "Personal Care",
  "Pharmacy",
  "Clothing & Fashion",
  "Phones & Computers",
  "Education",
  "Tourism & Hospitality",
  "Leisure & Resorts",
  "Property",
  "Transport & Logistics",
  "Warehousing",
  "Engineering",
  "Plumbing",
  "Professional Services",
  "Jobbing Services",
  "Jewellery",
  "Perfumes & Cosmetics",
  "Spices",
  "Vehicle Dealer",
  "General Dealer",
  "Other",
];
const BUSINESS_TYPES = [
  "Wholesaler",
  "Retailer",
  "Manufacturer",
  "Distributor",
  "Digital Provider",
];
const DATA_SOURCES: FieldDataSource[] = [
  "RPN collected",
  "vendor submitted",
  "backend entered",
  "imported",
];
const VENDOR_STATUSES: VendorStatus[] = [
  "lead",
  "active",
  "suspended",
  "dormant",
  "cancelled",
  "pending_review",
];
const WORLD_COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];
const DEFAULT_COUNTRY = "Zimbabwe";

const SearchableCountrySelect: React.FC<{
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const listId = React.useId();
  return (
    <>
      <input
        list={listId}
        value={value || DEFAULT_COUNTRY}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          if (!e.target.value.trim()) onChange(DEFAULT_COUNTRY);
        }}
        className={className}
      />
      <datalist id={listId}>
        {WORLD_COUNTRIES.map((country) => (
          <option key={country} value={country} />
        ))}
      </datalist>
    </>
  );
};
const SUB_STATUSES: SubscriptionStatus[] = [
  "trial",
  "active",
  "due",
  "overdue",
  "suspended",
];

export const VendorManagement: React.FC = () => {
  // Navigation & View State
  const [view, setView] = useState<"list" | "form">("list");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // Data State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [vendorOffers, setVendorOffers] = useState<VendorProductOffer[]>([]);
  const [productPickerSearch, setProductPickerSearch] = useState("");
  const [offerDraft, setOfferDraft] = useState<Partial<VendorProductOffer>>({
    sellingPrice: 0,
    stockQuantity: 0,
    stockStatus: "in_stock",
    publishToCatalogue: true,
    deliveryAvailable: true,
    featured: false,
    active: true,
  });

  // Lists stats (counts)
  const [productCounts, setProductCounts] = useState<Record<string, number>>(
    {},
  );
  const [catalogueCounts, setCatalogueCounts] = useState<
    Record<string, number>
  >({});

  // Filter State
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("All");
  const [filterRPN, setFilterRPN] = useState("All");
  const [filterSubStatus, setFilterSubStatus] = useState("All");
  const [filterVendorStatus, setFilterVendorStatus] = useState("All");

  // Deletion State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Vendor>>({
    branches: [],
    staff: [],
    deliveryStaff: [],
  });
  const [isManagerOverride, setIsManagerOverride] = useState(false);

  // Asset Upload State
  const [logoStatus, setLogoStatus] = useState<string>("");
  const [bannerStatus, setBannerStatus] = useState<string>("");
  const [showManualUrls, setShowManualUrls] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "seiGEN Commerce", message: "", type: "success" });

  const showBrandedAlert = (config: {
    title?: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
  }) => {
    setAlertConfig({ ...config, isOpen: true });
  };

  useEffect(() => {
    vendorService.migrateVendors();
    loadData();
  }, []);

  const loadData = async () => {
    const v = asArray<Vendor>(
      await Promise.resolve(vendorService.getVendors()),
    );
    const r = asArray<RPN>(await Promise.resolve(rpnService.getAll()));
    const p = asArray<Product>(
      await Promise.resolve(productService.getProducts()),
    );
    const mp = asArray<MasterProduct>(
      await Promise.resolve(productService.getMasterProducts()),
    );
    const offers = asArray<VendorProductOffer>(
      await Promise.resolve(productService.getVendorProductOffers()),
    );
    const c = asArray<CatalogueGeneration>(
      await Promise.resolve(catalogueService.getHistory()),
    );
    const pl = asArray<PricingPlan>(
      await Promise.resolve(pricingPlanService.getPlans()),
    );
    const st = asArray<Staff>(
      await Promise.resolve(staffService.getAllStaff()),
    );

    setVendors(v);
    setRpns(r);
    setPlans(pl);
    setStaffList(st);
    setMasterProducts(mp);
    setVendorOffers(offers);

    // Calculate counts
    const pCounts: Record<string, number> = {};
    offers.forEach((offer) => {
      if (!offer.active) return;
      pCounts[offer.vendorId] = (pCounts[offer.vendorId] || 0) + 1;
    });
    setProductCounts(pCounts);

    const cCounts: Record<string, number> = {};
    c.forEach((gen) => {
      (gen.vendorIds || []).forEach((vid) => {
        cCounts[vid] = (cCounts[vid] || 0) + 1;
      });
    });
    setCatalogueCounts(cCounts);
  };

  const filteredStaffRPNs = useMemo(() => {
    return staffList.filter((s) => {
      const role = (s.role || "").toLowerCase();
      return (
        role.includes("rpn") ||
        role.includes("agent") ||
        role.includes("field") ||
        role.includes("sales")
      );
    });
  }, [staffList]);

  const filtered = vendors.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.systemCode &&
        v.systemCode.toLowerCase().includes(search.toLowerCase())) ||
      v.id.toLowerCase().includes(search.toLowerCase());
    const matchesSector = filterSector === "All" || v.sector === filterSector;
    const matchesRPN = filterRPN === "All" || v.assignedRPNId === filterRPN;
    const matchesSub =
      filterSubStatus === "All" || v.subscriptionStatus === filterSubStatus;
    const matchesStatus =
      filterVendorStatus === "All" || v.status === filterVendorStatus;

    return (
      matchesSearch &&
      matchesSector &&
      matchesRPN &&
      matchesSub &&
      matchesStatus
    );
  });

  const handleDelete = () => {
    if (vendorToDelete) {
      try {
        vendorService.deleteVendor(vendorToDelete);
        analyticsService.logEvent({
          eventType: "VENDOR_DELETED",
          actorType: "admin",
          actorName: "System Admin",
          vendorId: vendorToDelete,
          details: { action: "purged" },
        });
        loadData();
        setIsDeleteDialogOpen(false);
        setVendorToDelete(null);
        showBrandedAlert({
          title: "seiGEN Commerce",
          message: "Deleted successfully.",
          type: "success",
        });

        // Non-blocking staff audit logging
        try {
          const vendor = vendors.find((v) => v.id === vendorToDelete);
          void staffAuditService.logDelete(
            "vendor",
            "vendor",
            vendorToDelete,
            vendor?.name || "Unknown",
            vendor,
          );
        } catch (e) {
          console.error("Audit log failed", e);
        }
      } catch (error: any) {
        console.error(error);
        showBrandedAlert({
          title: "seiGEN Commerce",
          message: error.message || "Delete failed",
          type: "error",
        });
      }
    }
  };

  const downloadOnboardingForm = () => {
    pdfService.generateOnboardingForm(vendors, rpns, plans);
  };

  const previewOnboardingForm = () => {
    pdfService.previewOnboardingForm(vendors, rpns, plans);
  };

  const startNewVendor = () => {
    const now = new Date().toISOString();
    setLogoStatus("");
    setBannerStatus("");
    setShowManualUrls(false);
    setIsManagerOverride(false);
    setFormError("");
    setFormSuccess("");
    setFormData({
      id: `VEND-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: "lead",
      subscriptionStatus: "trial",
      planId: "standard",
      dataSource: "backend entered",
      branches: [],
      staff: [],
      deliveryStaff: [],
      createdAt: now,
      updatedAt: now,
      createdBy: "STAFF-ADM",
      displayName: "", // Initialize displayName
      updatedBy: "STAFF-ADM",
      country: DEFAULT_COUNTRY,
    });
    setSelectedVendor(null);
    setView("form");
  };

  const startEditVendor = (vendor: Vendor) => {
    setLogoStatus("");
    setBannerStatus("");
    setShowManualUrls(false);
    setIsManagerOverride(false);
    setFormError("");
    setFormSuccess("");
    setFormData({ ...vendor });
    setFormData((prev) => ({
      ...prev,
      branches: vendor.branches || [],
      staff: vendor.staff || [],
      deliveryStaff: vendor.deliveryStaff || [],
    }));
    setSelectedVendor(vendor);
    setView("form");
  };

  const saveVendor = async () => {
    setFormError("");
    setFormSuccess("");

    if (!formData.name || !formData.sector) {
      setFormError("Name and Sector are required for terminal deployment.");
      return;
    }

    const sessionStr = localStorage.getItem("activeStaffSession");
    const session = sessionStr
      ? JSON.parse(sessionStr)
      : { staffId: "STAFF-ADM", staffName: "System Admin" };
    const canApprove = permissionService.canApprove("vendor");
    const isNew = !selectedVendor;
    const needsApproval = !canApprove;

    setIsSaving(true);
    const oldVendor = vendors.find(
      (v) => v.id === (selectedVendor?.id || formData.id),
    );
    try {
      const now = new Date().toISOString();
      const vendorToSave = {
        ...selectedVendor, // Preserve existing fields if not in formData
        ...formData,
        country: formData.country || DEFAULT_COUNTRY,
        updatedAt: now,
        updatedBy: session.staffId,
      } as Vendor;

      if (needsApproval) {
        vendorToSave.status = "pending_review";
      }

      await vendorService.updateVendor(vendorToSave);

      if (needsApproval) {
        await approvalService.submitApprovalRequest({
          requestType: isNew ? "vendor_create" : "vendor_update",
          recordType: "vendor",
          recordId: vendorToSave.id,
          recordName: vendorToSave.name,
          submittedByStaffId: session.staffId,
          submittedByName: session.staffName,
          riskLevel: "medium",
          beforeSnapshot: oldVendor || null,
          afterSnapshot: vendorToSave,
        });

        void staffAuditService.logAction({
          eventType: "APPROVAL_SUBMITTED",
          module: "vendor",
          action: `Submitted vendor ${isNew ? "creation" : "update"} for approval`,
          severity: "info",
          recordType: "vendor",
          recordId: vendorToSave.id,
          recordName: vendorToSave.name,
        });

        showBrandedAlert({
          title: "seiGEN Commerce",
          message: "Vendor submitted for approval.",
          type: "info",
        });
      } else {
        analyticsService.logEvent({
          eventType: isNew ? "VENDOR_CREATED" : "VENDOR_UPDATED",
          actorType: "admin",
          actorName: session.staffName,
          vendorId: vendorToSave.id,
          vendorName: vendorToSave.name,
          details: { action: isNew ? "creation" : "update" },
        });

        try {
          if (oldVendor) {
            await staffAuditService.logUpdate(
              "vendor",
              "vendor",
              vendorToSave.id,
              vendorToSave.name,
              oldVendor,
              vendorToSave,
            );
            if (oldVendor.status !== vendorToSave.status) {
              await staffAuditService.logAction({
                eventType: "RECORD_UPDATED",
                module: "vendor",
                action: `Vendor status changed from ${oldVendor.status} to ${vendorToSave.status}`,
                severity: "warning",
                recordType: "vendor",
                recordId: vendorToSave.id,
                recordName: vendorToSave.name,
              });
            }
          } else {
            await staffAuditService.logCreate(
              "vendor",
              "vendor",
              vendorToSave.id,
              vendorToSave.name,
              vendorToSave,
            );
          }
          if (
            oldVendor &&
            (oldVendor.rpnId !== vendorToSave.rpnId ||
              oldVendor.assignedRPNId !== vendorToSave.assignedRPNId)
          ) {
            await staffAuditService.logAction({
              eventType: "RECORD_UPDATED",
              module: "vendor",
              action: "Assigned/Reassigned vendor to RPN",
              severity: "high",
              recordType: "vendor",
              recordId: vendorToSave.id,
              recordName: vendorToSave.name,
            });
          }
        } catch (auditErr) {
          console.error("Audit log failed", auditErr);
        }
      }

      await loadData();
      if (!needsApproval) {
        showBrandedAlert({
          title: "seiGEN Commerce",
          message: "Vendor saved successfully.",
          type: "success",
        });
      }
      setView("list");
    } catch (error) {
      console.error("Save vendor error:", error);
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: error instanceof Error ? error.message : "Save failed",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBranchAdd = () => {
    const newBranch: Branch = {
      id: `BR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: "New Branch Location",
      phone: "",
      whatsapp: "", // Default to empty string
      country: formData.country || DEFAULT_COUNTRY,
      province: formData.province || "",
      cityTown: formData.cityTown || "",
      district: "",
      suburb: "",
      streetAddress: "",
      address: "",
      landmark: "",
      managerName: "",
      openingHours: "08:00 - 17:00",
      isDefault: formData.branches?.length === 0,
      status: "active",
    };
    setFormData({
      ...formData,
      branches: [...(formData.branches || []), newBranch],
    });
  };

  const handleBranchUpdate = (branchId: string, updates: Partial<Branch>) => {
    const updatedBranches = (formData.branches || []).map((b) =>
      b.id === branchId ? { ...b, ...updates } : b,
    );
    setFormData({ ...formData, branches: updatedBranches });
  };

  const handleBranchDelete = (branchId: string) => {
    setFormData({
      ...formData,
      branches: (formData.branches || []).filter((b) => b.id !== branchId),
    });
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: "Only image files are allowed.",
        type: "warning",
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: "File exceeds 8MB limit.",
        type: "warning",
      });
      return;
    }

    setLogoStatus("Optimizing...");
    try {
      const optimizedBlob = await optimizeImageToWebP(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.86,
      });
      if (optimizedBlob.size > 200 * 1024) {
        console.warn(
          `Optimized logo is still quite large: ${(optimizedBlob.size / 1024).toFixed(1)}KB`,
        );
      }
      setLogoStatus("Uploading...");
      const vendorId =
        formData.id ||
        `VEND-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      if (!formData.id) setFormData((prev) => ({ ...prev, id: vendorId }));
      const url = await vendorService.uploadVendorLogo(vendorId, optimizedBlob);
      setFormData((prev) => ({ ...prev, logoAssetUrl: url }));
      setLogoStatus("Uploaded");
      setTimeout(() => setLogoStatus(""), 3000);

      try {
        void staffAuditService.logAction({
          eventType: "RECORD_UPDATED",
          module: "vendor",
          severity: "high",
          action: "Updated vendor identity assets",
          recordType: "vendor",
          recordId: vendorId,
          recordName: formData.name,
        });
      } catch (e) {}
    } catch (error) {
      console.error("Logo upload failed", error);
      setLogoStatus("Failed");
    }
  };

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: "Only image files are allowed.",
        type: "warning",
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: "File exceeds 8MB limit.",
        type: "warning",
      });
      return;
    }

    setBannerStatus("Optimizing...");
    try {
      const optimizedBlob = await optimizeImageToWebP(file, {
        maxWidth: 1600,
        maxHeight: 700,
        quality: 0.86,
      });
      if (optimizedBlob.size > 500 * 1024) {
        console.warn(
          `Optimized banner is still quite large: ${(optimizedBlob.size / 1024).toFixed(1)}KB`,
        );
      }
      setBannerStatus("Uploading...");
      const vendorId =
        formData.id ||
        `VEND-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      if (!formData.id) setFormData((prev) => ({ ...prev, id: vendorId }));
      const url = await vendorService.uploadVendorBanner(
        vendorId,
        optimizedBlob,
      );
      setFormData((prev) => ({ ...prev, bannerAssetUrl: url }));
      setBannerStatus("Uploaded");
      setTimeout(() => setBannerStatus(""), 3000);

      try {
        void staffAuditService.logAction({
          eventType: "RECORD_UPDATED",
          module: "vendor",
          severity: "high",
          action: "Updated vendor identity assets",
          recordType: "vendor",
          recordId: vendorId,
          recordName: formData.name,
        });
      } catch (e) {}
    } catch (error) {
      console.error("Banner upload failed", error);
      setBannerStatus("Failed");
    }
  };

  const duplicates = useMemo(() => {
    if (
      view !== "form" ||
      (!formData.name &&
        !formData.tradingName &&
        !formData.catalogueDisplayName)
    )
      return [];
    // Filter out the current vendor we are editing
    const otherVendors = vendors.filter((v) => v.id !== formData.id);
    return findSimilarVendors(formData, otherVendors);
  }, [
    formData.name,
    formData.tradingName,
    formData.catalogueDisplayName,
    vendors,
    view,
    formData.id,
  ]);

  const hasCriticalDuplicate = duplicates.some(
    (d) => d.similarity.level === "exact" || d.similarity.level === "high",
  );
  const canManagerOverride = permissionService.canApprove("vendor");
  const isSaveBlocked = hasCriticalDuplicate && !isManagerOverride;

  const handleOverrideRequest = async () => {
    try {
      await approvalService.submitApprovalRequest({
        requestType: "Duplicate Vendor Override",
        recordType: "vendor",
        recordId: formData.id || "new",
        submittedByStaffId: "STAFF-ADM", // Uses session ID in production
        submittedByName: "Backend Staff",
        riskLevel: "medium",
        beforeSnapshot: null,
        afterSnapshot: formData,
      });
      setFormSuccess(
        "Override approval submitted to managers. You will be notified when reviewed.",
      );
      setTimeout(() => setView("list"), 2000);
    } catch (e) {
      console.error(e);
      setFormError("Failed to submit approval request.");
    }
  };

  const currentVendorOffers = useMemo(() => {
    const vendorId = formData.id || selectedVendor?.id || "";
    return vendorOffers.filter((offer) => offer.vendorId === vendorId);
  }, [vendorOffers, formData.id, selectedVendor?.id]);

  const productById = useMemo(
    () => new Map(masterProducts.map((product) => [product.id, product])),
    [masterProducts],
  );

  const productPickerResults = useMemo(() => {
    const terms = productPickerSearch.toLowerCase().split(" ").filter(Boolean);
    const linked = new Set(currentVendorOffers.map((offer) => offer.productId));
    return masterProducts
      .filter((product) => !linked.has(product.id))
      .filter((product) => {
        if (terms.length === 0) return true;
        const text = [
          product.productName,
          product.brand,
          product.category,
          product.sector,
          product.barcode,
          product.standardSku,
          product.description,
          ...(product.tags || []),
          ...(product.keywords || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return terms.every((term) => text.includes(term));
      })
      .slice(0, 8);
  }, [masterProducts, productPickerSearch, currentVendorOffers]);

  const resetOfferDraft = () =>
    setOfferDraft({
      sellingPrice: 0,
      stockQuantity: 0,
      stockStatus: "in_stock",
      publishToCatalogue: true,
      deliveryAvailable: true,
      featured: false,
      active: true,
    });

  const handleCreateOffer = async (product: MasterProduct) => {
    const vendorId = formData.id || selectedVendor?.id;
    if (!vendorId) {
      showBrandedAlert({
        title: "seiGEN Commerce",
        message: "Save the vendor profile before linking products.",
        type: "warning",
      });
      return;
    }
    const firstBranch = (formData.branches || [])[0];
    const offer: VendorProductOffer = {
      id: `VPO-${vendorId}-${product.id}-${Date.now()}`,
      vendorId,
      productId: product.id,
      branchId: offerDraft.branchId || firstBranch?.id || "",
      sellingPrice: Number(offerDraft.sellingPrice) || 0,
      buyingPrice: offerDraft.buyingPrice,
      discountPrice: offerDraft.discountPrice,
      minOrderQty: offerDraft.minOrderQty,
      maxOrderQty: offerDraft.maxOrderQty,
      stockQuantity: Number(offerDraft.stockQuantity) || 0,
      stockStatus:
        offerDraft.stockStatus ||
        ((Number(offerDraft.stockQuantity) || 0) > 0
          ? "in_stock"
          : "out_of_stock"),
      vendorSku: offerDraft.vendorSku || "",
      vendorProductImage: offerDraft.vendorProductImage || "",
      publishToCatalogue: offerDraft.publishToCatalogue !== false,
      deliveryAvailable: offerDraft.deliveryAvailable !== false,
      featured: !!offerDraft.featured,
      notes: offerDraft.notes || "",
      active: offerDraft.active !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await productService.saveVendorProductOffer(offer);
    void staffAuditService.logAction({
      eventType: "RECORD_CREATED",
      module: "product",
      severity: "info",
      action: `Linked ${product.productName} to vendor ${vendorId}`,
      recordType: "vendor_product_offer",
      recordId: offer.id,
      afterSnapshot: offer,
    });
    resetOfferDraft();
    setProductPickerSearch("");
    await loadData();
  };

  const handleUpdateOffer = async (
    offer: VendorProductOffer,
    patch: Partial<VendorProductOffer>,
  ) => {
    const updated = { ...offer, ...patch, updatedAt: new Date().toISOString() };
    await productService.saveVendorProductOffer(updated);
    await loadData();
  };

  const handleDeleteOffer = async (offerId: string) => {
    await productService.deleteVendorProductOffer(offerId);
    await loadData();
  };

  if (view === "form") {
    const currentStaff = staffService.getStaffById(
      formData.assignedStaffId || "STAFF-ADM",
    );
    const vendorLogo =
      formData.logoAssetUrl ||
      formData.logoUrl ||
      formData.businessLogoUrl ||
      "";
    const vendorBanner =
      formData.bannerAssetUrl ||
      formData.bannerUrl ||
      formData.businessBannerUrl ||
      "";
    return (
      <div className="space-y-8 pb-32">
        <BrandedAlertModal
          {...alertConfig}
          onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        />

        <div className="flex items-center justify-between bg-stone-50 p-6 border border-stone-200">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal transition-colors"
          >
            <ChevronRight size={14} className="rotate-180" /> Back to Registry
          </button>
          <div className="text-center">
            <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal">
              {selectedVendor
                ? `Edit Vendor: ${formData.id}`
                : "Add New Vendor"}
            </h3>
            <p className="text-[9px] font-mono text-stone-400 uppercase mt-0.5">
              Backend Management
            </p>
          </div>
          {permissionService.canEdit("vendorManagement") && (
            <PrimaryButton
              onClick={saveVendor}
              disabled={isSaving || isSaveBlocked}
              className={`flex items-center gap-2 ${!permissionService.canEdit("vendorManagement") || isSaving || isSaveBlocked ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Save size={14} /> {isSaving ? "Saving..." : "Save Changes"}
            </PrimaryButton>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {formError && (
              <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle size={16} /> {formError}
              </div>
            )}
            {formSuccess && (
              <div className="p-4 border-l-4 border-emerald-500 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={16} /> {formSuccess}
              </div>
            )}

            {/* Duplicate Intelligence */}
            {duplicates.length > 0 && (
              <DataPanel
                title="Duplicate Intelligence"
                className="border-t-4 border-t-red-500 shadow-sm bg-red-50/30"
              >
                <div className="p-6 space-y-4">
                  <div className="flex gap-3 text-red-600">
                    <AlertTriangle size={20} className="shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold uppercase">
                        Potential Duplicates Detected
                      </h4>
                      <p className="text-xs text-stone-600 mt-1">
                        The following registry records share strong naming
                        similarities with your input.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 mt-4">
                    {duplicates.map((dup, idx) => (
                      <div
                        key={idx}
                        className="p-4 border border-red-200 bg-white flex flex-col md:flex-row gap-4 justify-between md:items-center"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase text-brand-charcoal">
                            {dup.record.name}{" "}
                            <span className="text-[10px] text-stone-400 font-mono">
                              [{dup.record.systemCode}]
                            </span>
                          </p>
                          <p
                            className={`text-[10px] font-bold mt-1 uppercase ${dup.similarity.level === "exact" || dup.similarity.level === "high" ? "text-red-500" : "text-stone-500"}`}
                          >
                            Match: {dup.similarity.score}% -{" "}
                            {dup.similarity.level} ({dup.similarity.reason})
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <SecondaryButton
                            size="sm"
                            onClick={() => startEditVendor(dup.record)}
                          >
                            Use Existing Vendor
                          </SecondaryButton>
                          <SecondaryButton
                            size="sm"
                            onClick={() => startEditVendor(dup.record)}
                          >
                            Create Branch Instead
                          </SecondaryButton>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasCriticalDuplicate && !isManagerOverride && (
                    <div className="flex gap-3 mt-6 pt-4 border-t border-red-200">
                      {!canManagerOverride ? (
                        <PrimaryButton
                          size="sm"
                          onClick={handleOverrideRequest}
                        >
                          Submit Override Approval
                        </PrimaryButton>
                      ) : (
                        <PrimaryButton
                          size="sm"
                          onClick={() => setIsManagerOverride(true)}
                        >
                          Continue Anyway (Manager Override)
                        </PrimaryButton>
                      )}
                    </div>
                  )}
                </div>
              </DataPanel>
            )}

            {/* Basic Identity */}
            <DataPanel title="General Information">
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Legal Business Name
                  </label>
                  <input
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50/50"
                    placeholder="IDENTIFY BUSINESS ENTITY"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Trading Name / Alias
                  </label>
                  <input
                    value={formData.tradingName || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, tradingName: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Sector Classification
                  </label>
                  <select
                    value={formData.sector || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, sector: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-white"
                  >
                    <option value="">Select Sector...</option>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Principal Owner
                  </label>
                  <input
                    value={formData.ownerFullName || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ownerFullName: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Business Type
                  </label>
                  <select
                    value={formData.businessType || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, businessType: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-white"
                  >
                    <option value="">Select Type...</option>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Main Phone (Primary)
                  </label>
                  <input
                    value={formData.mainPhone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, mainPhone: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold font-mono focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    WhatsApp (Automated Orders)
                  </label>
                  <input
                    value={formData.whatsappNumber || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        whatsappNumber: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold font-mono focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Business Email Address
                  </label>
                  <input
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Business Summary / Capability
                  </label>
                  <textarea
                    value={formData.businessDescription || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessDescription: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-medium focus:border-brand-orange outline-none h-20 resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    WhatsApp Group Link
                  </label>
                  <input
                    value={formData.whatsappGroupLink || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        whatsappGroupLink: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs focus:border-brand-orange outline-none font-mono"
                    placeholder="https://chat.whatsapp.com/..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    WhatsApp Channel Link
                  </label>
                  <input
                    value={formData.whatsappChannelLink || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        whatsappChannelLink: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs focus:border-brand-orange outline-none font-mono"
                    placeholder="https://whatsapp.com/channel/..."
                  />
                </div>
              </div>
            </DataPanel>

            {/* Identity Assets */}
            <DataPanel title="Identity Assets">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Logo Upload */}
                  <div className="border-2 border-stone-100 p-4 bg-stone-50/30">
                    <h4 className="text-[10px] uppercase font-bold text-stone-400 mb-3 flex items-center gap-1.5">
                      <ImageIcon size={12} /> Vendor Logo
                    </h4>
                    <div className="flex gap-4 items-start">
                      <div className="w-20 h-20 bg-white border-2 border-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                        {vendorLogo ? (
                          <img
                            src={vendorLogo}
                            className="w-full h-full object-contain"
                            alt="Logo"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-[8px] uppercase font-bold text-stone-300 text-center">
                            No Logo
                            <br />
                            Uploaded
                          </span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoSelect}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="inline-flex items-center gap-2 bg-brand-charcoal text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest cursor-pointer hover:bg-brand-orange transition-colors"
                        >
                          <Upload size={10} /> Select Logo
                        </label>
                        {logoStatus && (
                          <p className="text-[9px] font-bold text-brand-orange uppercase">
                            {logoStatus}
                          </p>
                        )}
                        {vendorLogo && (
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                logoUrl: "",
                                logoAssetUrl: "",
                                businessLogoUrl: "",
                              }))
                            }
                            className="block text-[9px] text-red-500 hover:text-red-700 uppercase font-bold mt-2"
                          >
                            Remove Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Banner Upload */}
                  <div className="border-2 border-stone-100 p-4 bg-stone-50/30">
                    <h4 className="text-[10px] uppercase font-bold text-stone-400 mb-3 flex items-center gap-1.5">
                      <ImageIcon size={12} /> Vendor Banner
                    </h4>
                    <div className="flex gap-4 items-start flex-col sm:flex-row">
                      <div className="w-full sm:w-32 h-16 bg-white border-2 border-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                        {vendorBanner ? (
                          <img
                            src={vendorBanner}
                            className="w-full h-full object-cover"
                            alt="Banner"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-[8px] uppercase font-bold text-stone-300 text-center">
                            No Banner
                            <br />
                            Uploaded
                          </span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2 w-full">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBannerSelect}
                          className="hidden"
                          id="banner-upload"
                        />
                        <label
                          htmlFor="banner-upload"
                          className="inline-flex items-center gap-2 bg-brand-charcoal text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest cursor-pointer hover:bg-brand-orange transition-colors"
                        >
                          <Upload size={10} /> Select Banner
                        </label>
                        {bannerStatus && (
                          <p className="text-[9px] font-bold text-brand-orange uppercase">
                            {bannerStatus}
                          </p>
                        )}
                        {vendorBanner && (
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                bannerUrl: "",
                                bannerAssetUrl: "",
                                businessBannerUrl: "",
                              }))
                            }
                            className="block text-[9px] text-red-500 hover:text-red-700 uppercase font-bold mt-2"
                          >
                            Remove Banner
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setShowManualUrls(!showManualUrls)}
                    className="text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal transition-colors flex items-center gap-1"
                  >
                    {showManualUrls ? "Hide" : "Show"} Advanced: Paste URL
                    Manually
                  </button>
                  {showManualUrls && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-stone-50 border border-stone-200">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-stone-400">
                          Logo Asset URL
                        </label>
                        <input
                          value={formData.logoUrl || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              logoUrl: e.target.value,
                            })
                          }
                          className="w-full border-2 border-stone-200 p-2.5 text-xs font-mono focus:border-brand-orange outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-stone-400">
                          Banner Asset URL
                        </label>
                        <input
                          value={formData.bannerUrl || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bannerUrl: e.target.value,
                            })
                          }
                          className="w-full border-2 border-stone-200 p-2.5 text-xs font-mono focus:border-brand-orange outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DataPanel>

            {/* Geographic Mapping */}
            <DataPanel title="Locations">
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 font-mono">
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400 font-sans">
                    Country
                  </label>
                  <SearchableCountrySelect
                    value={formData.country || DEFAULT_COUNTRY}
                    onChange={(country) =>
                      setFormData({ ...formData, country })
                    }
                    className="w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50"
                  />
                </div>
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400 font-sans">
                    Province
                  </label>
                  <input
                    value={formData.province || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, province: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400 font-sans">
                    City / Town
                  </label>
                  <input
                    value={formData.cityTown || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, cityTown: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400 font-sans">
                    District
                  </label>
                  <input
                    value={formData.district || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, district: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400 font-sans">
                    Suburb
                  </label>
                  <input
                    value={formData.suburb || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, suburb: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400 font-sans">
                    GPS / Location Notes
                  </label>
                  <input
                    value={formData.gpsNotes || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, gpsNotes: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                  />
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400 font-sans">
                    Full Physical Address Specification
                  </label>
                  <input
                    value={formData.streetAddress || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        streetAddress: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none font-sans"
                  />
                </div>
              </div>
            </DataPanel>

            {/* Branch Management */}
            <DataPanel
              title="Branches"
              actions={
                <button
                  onClick={handleBranchAdd}
                  className="bg-brand-charcoal text-white px-3 py-1 text-[9px] font-bold uppercase flex items-center gap-1.5 transition-opacity hover:opacity-90"
                >
                  <Plus size={10} /> Add Branch
                </button>
              }
            >
              <div className="p-0 border-t border-stone-100 divide-y divide-stone-100">
                {(formData.branches || []).map((branch, index) => (
                  <div key={branch.id} className="p-6 space-y-4 bg-stone-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[9px] uppercase font-bold text-stone-400">
                          Branch Identity
                        </label>
                        <input
                          value={branch.name}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              name: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400">
                          Branch Status
                        </label>
                        <select
                          value={branch.status}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              status: e.target.value as any,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none"
                        >
                          <option value="active">ACTIVE</option>
                          <option value="suspended">SUSPENDED</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400">
                          Primary Branch
                        </label>
                        <button
                          onClick={() =>
                            handleBranchUpdate(branch.id, {
                              isDefault: !branch.isDefault,
                            })
                          }
                          className={`w-full px-3 py-1.5 text-[9px] font-bold uppercase border h-[34px] ${branch.isDefault ? "bg-brand-charcoal text-white border-brand-charcoal" : "bg-white text-stone-400 border-stone-200"}`}
                        >
                          {branch.isDefault
                            ? "SYSTEM DEFAULT"
                            : "SET AS DEFAULT"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400 font-mono italic">
                          Country
                        </label>
                        <SearchableCountrySelect
                          value={branch.country || formData.country || DEFAULT_COUNTRY}
                          onChange={(country) =>
                            handleBranchUpdate(branch.id, { country })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400 font-mono italic">
                          Province
                        </label>
                        <input
                          value={branch.province}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              province: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400 font-mono italic">
                          City / Town
                        </label>
                        <input
                          value={branch.cityTown}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              cityTown: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400 font-mono italic">
                          District
                        </label>
                        <input
                          value={branch.district}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              district: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400 font-mono italic">
                          Suburb
                        </label>
                        <input
                          value={branch.suburb}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              suburb: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400">
                          Branch Manager
                        </label>
                        <input
                          value={branch.managerName}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              managerName: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400">
                          Opening Hours
                        </label>
                        <input
                          value={branch.openingHours}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              openingHours: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none"
                          placeholder="e.g. 08:00 - 17:00"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400 font-mono italic">
                          Phone
                        </label>
                        <input
                          value={branch.phone}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              phone: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400 font-mono italic text-green-600">
                          WhatsApp
                        </label>
                        <input
                          value={branch.whatsapp}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              whatsapp: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400">
                          Physical Address
                        </label>
                        <input
                          value={branch.streetAddress || branch.address}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              address: e.target.value,
                              streetAddress: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-stone-400">
                          Landmark
                        </label>
                        <input
                          value={branch.landmark || ""}
                          onChange={(e) =>
                            handleBranchUpdate(branch.id, {
                              landmark: e.target.value,
                            })
                          }
                          className="w-full border border-stone-300 p-1.5 text-xs font-bold uppercase outline-none"
                        />
                      </div>
                      <div className="space-y-1.5 flex justify-end items-end pb-1.5">
                        <button
                          onClick={() => handleBranchDelete(branch.id)}
                          className="text-[9px] font-bold uppercase text-red-400 hover:text-red-700 transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={10} /> Delete Branch
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {(formData.branches || []).length === 0 && (
                  <div className="p-12 text-center text-stone-300">
                    <Store size={32} className="mx-auto mb-4 opacity-20" />
                    <p className="text-[10px] font-bold uppercase italic tracking-widest">
                      No branches configured.
                    </p>
                  </div>
                )}
              </div>
            </DataPanel>
          </div>

          <div className="space-y-8">
            {/* Lifecycle and Sub */}
            <DataPanel title="Subscription & Status">
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Entity Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {VENDOR_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setFormData({ ...formData, status: s })}
                        className={`px-2 py-1 text-[9px] font-bold uppercase border transition-all ${formData.status === s ? "bg-brand-orange text-white border-brand-orange shadow-sm" : "bg-white text-stone-400 border-stone-200 hover:border-stone-400"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-stone-100">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Subscription Matrix
                  </label>
                  <select
                    value={formData.planId || "starter"}
                    onChange={(e) =>
                      setFormData({ ...formData, planId: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50 font-mono"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name.toUpperCase()} TIER
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {SUB_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setFormData({ ...formData, subscriptionStatus: s })
                        }
                        className={`px-2 py-1 text-[9px] font-bold uppercase border transition-all ${formData.subscriptionStatus === s ? "bg-brand-charcoal text-white border-brand-charcoal" : "bg-white text-stone-400 border-stone-200"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-stone-100 font-mono">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-stone-400 font-sans">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={
                        formData.subscriptionStartDate?.split("T")[0] || ""
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subscriptionStartDate: new Date(
                            e.target.value,
                          ).toISOString(),
                        })
                      }
                      className="w-full border border-stone-300 p-1.5 text-[10px] font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-stone-400 font-sans">
                      Renewal Cycle
                    </label>
                    <input
                      type="date"
                      value={formData.subscriptionDueDate?.split("T")[0] || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subscriptionDueDate: new Date(
                            e.target.value,
                          ).toISOString(),
                        })
                      }
                      className="w-full border border-stone-300 p-1.5 text-[10px] font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-stone-400 font-sans">
                      Last Collection
                    </label>
                    <input
                      type="date"
                      value={formData.lastCollectionDate?.split("T")[0] || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lastCollectionDate: new Date(
                            e.target.value,
                          ).toISOString(),
                        })
                      }
                      className="w-full border border-stone-300 p-1.5 text-[10px] font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-stone-400 font-sans">
                      Next Follow-up
                    </label>
                    <input
                      type="date"
                      value={formData.nextFollowUpDate?.split("T")[0] || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nextFollowUpDate: new Date(
                            e.target.value,
                          ).toISOString(),
                        })
                      }
                      className="w-full border border-stone-300 p-1.5 text-[10px] font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-4">
                  <label className="text-[9px] uppercase font-bold text-stone-400">
                    Internal Collection Notes
                  </label>
                  <textarea
                    value={formData.collectionNotes || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        collectionNotes: e.target.value,
                      })
                    }
                    className="w-full border border-stone-300 p-2 text-[10px] font-medium outline-none h-16 resize-none focus:border-brand-orange"
                  />
                </div>
              </div>
            </DataPanel>

            {/* Assignments */}
            <DataPanel title="Personnel Assignments">
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Assigned RPN Agent
                  </label>
                  <select
                    value={formData.assignedRPNId || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        assignedRPNId: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50"
                  >
                    <option value="">Unassigned</option>
                    {rpns.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} [{r.id}]
                      </option>
                    ))}
                  </select>
                  {formData.assignedRPNId &&
                    rpns.find((r) => r.id === formData.assignedRPNId) && (
                      <div className="p-3 bg-stone-100 border border-stone-200 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-stone-500">
                          <Info size={10} className="text-brand-orange" /> RPN
                          Contact Info
                        </div>
                        <p className="text-[11px] font-bold text-stone-700">
                          {
                            rpns.find((r) => r.id === formData.assignedRPNId)
                              ?.name
                          }
                        </p>
                        <p className="text-[10px] font-mono text-stone-500">
                          {
                            rpns.find((r) => r.id === formData.assignedRPNId)
                              ?.phone
                          }
                        </p>
                      </div>
                    )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Assigned Staff Member
                  </label>
                  <input
                    value={
                      formData.assignedStaffId ||
                      currentStaff?.fullName ||
                      "STAFF-ADM"
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        assignedStaffId: e.target.value, // This should ideally be a dropdown of actual staff
                      })
                    }
                    className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50"
                    placeholder="ASSIGNED STAFF"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Source
                  </label>
                  <select
                    value={formData.dataSource || "backend entered"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dataSource: e.target.value as any,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                  >
                    {DATA_SOURCES.map((d) => (
                      <option key={d} value={d}>
                        {d.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </DataPanel>

            <DataPanel
              title="Vendor Products"
              subtitle="Attach master products and manage vendor-specific price, stock, branch and catalogue visibility."
              className="border-t-4 border-t-brand-orange"
            >
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
                    <input
                      value={productPickerSearch}
                      onChange={(e) => setProductPickerSearch(e.target.value)}
                      placeholder="Search master products by name, barcode, brand, category..."
                      className="w-full border-2 border-stone-200 pl-9 pr-3 py-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      value={offerDraft.sellingPrice || 0}
                      onChange={(e) =>
                        setOfferDraft({
                          ...offerDraft,
                          sellingPrice: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase outline-none"
                      placeholder="Selling price"
                    />
                    <input
                      type="number"
                      value={offerDraft.stockQuantity || 0}
                      onChange={(e) =>
                        setOfferDraft({
                          ...offerDraft,
                          stockQuantity: Number(e.target.value) || 0,
                          stockStatus:
                            Number(e.target.value) > 0
                              ? "in_stock"
                              : "out_of_stock",
                        })
                      }
                      className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase outline-none"
                      placeholder="Stock"
                    />
                    <select
                      value={offerDraft.branchId || ""}
                      onChange={(e) =>
                        setOfferDraft({ ...offerDraft, branchId: e.target.value })
                      }
                      className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase outline-none"
                    >
                      <option value="">Default branch</option>
                      {(formData.branches || []).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={offerDraft.vendorSku || ""}
                      onChange={(e) =>
                        setOfferDraft({ ...offerDraft, vendorSku: e.target.value })
                      }
                      className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase outline-none"
                      placeholder="Vendor SKU"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 border border-stone-200 p-3 text-[10px] font-black uppercase">
                      <input
                        type="checkbox"
                        checked={offerDraft.publishToCatalogue !== false}
                        onChange={(e) =>
                          setOfferDraft({
                            ...offerDraft,
                            publishToCatalogue: e.target.checked,
                          })
                        }
                        className="accent-brand-orange"
                      />
                      Publish
                    </label>
                    <label className="flex items-center gap-2 border border-stone-200 p-3 text-[10px] font-black uppercase">
                      <input
                        type="checkbox"
                        checked={offerDraft.deliveryAvailable !== false}
                        onChange={(e) =>
                          setOfferDraft({
                            ...offerDraft,
                            deliveryAvailable: e.target.checked,
                          })
                        }
                        className="accent-brand-orange"
                      />
                      Delivery
                    </label>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {productPickerResults.map((product) => (
                    <div
                      key={product.id}
                      className="border border-stone-200 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase text-brand-charcoal truncate">
                          {product.productName}
                        </p>
                        <p className="text-[9px] font-bold uppercase text-stone-400 truncate">
                          {product.brand || "No brand"} / {product.category} /{" "}
                          {product.barcode || product.standardSku || "No code"}
                        </p>
                      </div>
                      <PrimaryButton size="sm" onClick={() => handleCreateOffer(product)}>
                        <PlusCircle size={12} className="mr-1" /> Link
                      </PrimaryButton>
                    </div>
                  ))}
                  {productPickerSearch && productPickerResults.length === 0 && (
                    <p className="text-[10px] font-bold uppercase text-stone-400 text-center p-4">
                      No matching master products. Create it in Product Library first.
                    </p>
                  )}
                </div>

                <div className="border-t border-stone-200 pt-4 space-y-3">
                  <p className="text-[10px] font-black uppercase text-stone-400">
                    Linked Vendor Offers
                  </p>
                  {currentVendorOffers.map((offer) => {
                    const product = productById.get(offer.productId);
                    const branch = (formData.branches || []).find(
                      (b) => b.id === offer.branchId,
                    );
                    return (
                      <div key={offer.id} className="border border-stone-200 p-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase text-brand-charcoal truncate">
                              {product?.productName || offer.productId}
                            </p>
                            <p className="text-[9px] font-bold uppercase text-stone-400">
                              {branch?.name || "No branch"} / {offer.stockStatus}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteOffer(offer.id)}
                            className="p-2 border border-stone-200 text-stone-400 hover:text-red-600 hover:border-red-200"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={offer.sellingPrice}
                            onChange={(e) =>
                              handleUpdateOffer(offer, {
                                sellingPrice: Number(e.target.value) || 0,
                              })
                            }
                            className="border border-stone-200 p-2 text-[10px] font-bold"
                          />
                          <input
                            type="number"
                            value={offer.stockQuantity}
                            onChange={(e) =>
                              handleUpdateOffer(offer, {
                                stockQuantity: Number(e.target.value) || 0,
                                stockStatus:
                                  Number(e.target.value) > 0
                                    ? "in_stock"
                                    : "out_of_stock",
                              })
                            }
                            className="border border-stone-200 p-2 text-[10px] font-bold"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 text-[9px] font-black uppercase">
                            <input
                              type="checkbox"
                              checked={offer.publishToCatalogue}
                              onChange={(e) =>
                                handleUpdateOffer(offer, {
                                  publishToCatalogue: e.target.checked,
                                })
                              }
                              className="accent-brand-orange"
                            />
                            Catalogue
                          </label>
                          <label className="flex items-center gap-2 text-[9px] font-black uppercase">
                            <input
                              type="checkbox"
                              checked={offer.active}
                              onChange={(e) =>
                                handleUpdateOffer(offer, { active: e.target.checked })
                              }
                              className="accent-brand-orange"
                            />
                            Active
                          </label>
                        </div>
                      </div>
                    );
                  })}
                  {currentVendorOffers.length === 0 && (
                    <p className="text-[10px] font-bold uppercase text-stone-400 text-center p-4 border border-dashed border-stone-200">
                      No vendor product offers linked yet.
                    </p>
                  )}
                </div>
              </div>
            </DataPanel>

            <DataPanel title="System Information">
              <div className="p-6 space-y-2 font-mono">
                <div className="flex justify-between text-[9px] uppercase font-bold">
                  <span className="text-stone-400">System Code:</span>
                  <span className="text-stone-600 tracking-wider">
                    {formData.systemCode || "PENDING ASSIGNMENT"}
                  </span>
                </div>
                <div className="flex justify-between text-[9px] uppercase font-bold">
                  <span className="text-stone-400">ID Specification:</span>
                  <span className="text-stone-600">{formData.id}</span>
                </div>
                <div className="flex justify-between text-[9px] uppercase font-bold">
                  <span className="text-stone-400">Created At:</span>
                  <span className="text-stone-600">
                    {new Date(formData.createdAt || "").toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[9px] uppercase font-bold border-t border-stone-100 pt-2 mt-2">
                  <span className="text-stone-400">Origin Staff:</span>
                  <span className="text-stone-600">{formData.createdBy}</span>
                </div>
              </div>
            </DataPanel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      {/* Console Controls */}
      <div className="bg-stone-50 border border-stone-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal">
              Vendor Management
            </h3>
            <p className="text-[10px] text-stone-400 font-mono mt-1 uppercase italic">
              Backend System // Vendor Management
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {permissionService.canCreate("addNewVendor") && (
              <PrimaryButton // Check both addNewVendor and general vendorManagement create
                onClick={startNewVendor}
                className="flex items-center gap-2"
              >
                <Plus size={14} /> Add New Vendor
              </PrimaryButton>
            )}
            <SecondaryButton
              onClick={downloadOnboardingForm}
              className="flex items-center gap-2"
            >
              <FileCode size={14} /> Download Onboarding Form
            </SecondaryButton>
            <SecondaryButton
              onClick={previewOnboardingForm}
              className="flex items-center gap-2"
            >
              <Info size={14} /> Preview Onboarding Form
            </SecondaryButton>
          </div>
        </div>

        {/* Advanced Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-6 border-t border-stone-200">
          <SearchInput
            placeholder="Search Vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="lg:col-span-1 shadow-sm"
          />
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
            <select
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
              className="w-full bg-white border border-stone-200 pl-9 pr-6 py-1.5 text-[10px] font-bold uppercase focus:outline-none appearance-none"
            >
              <option value="All">All Sectors</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <select
            value={filterRPN}
            onChange={(e) => setFilterRPN(e.target.value)}
            className="w-full bg-white border border-stone-200 px-6 py-1.5 text-[10px] font-bold uppercase focus:outline-none"
          >
            <option value="All">All RPN Agents</option>
            {rpns.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} [{r.id}]
              </option>
            ))}
          </select>
          <select
            value={filterSubStatus}
            onChange={(e) => setFilterSubStatus(e.target.value)}
            className="w-full bg-white border border-stone-200 px-6 py-1.5 text-[10px] font-bold uppercase focus:outline-none"
          >
            <option value="All">Sub Status</option>
            {SUB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={filterVendorStatus}
            onChange={(e) => setFilterVendorStatus(e.target.value)}
            className="w-full bg-white border border-stone-200 px-6 py-1.5 text-[10px] font-bold uppercase focus:outline-none"
          >
            <option value="All">Lifecycle</option>
            {VENDOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataPanel
        title="Vendors"
        subtitle={`${filtered.length} active records found`}
        headers={[
          "System Code",
          "Vendor Details",
          "Location / RPN",
          "Plan / Status",
          "Due Date",
          "Operations",
        ]}
      >
        {filtered.map((vendor) => {
          const rpn = rpns.find((r) => r.id === vendor.assignedRPNId);
          const vendorLogo =
            vendor.logoAssetUrl ||
            vendor.logoUrl ||
            vendor.businessLogoUrl ||
            "";
          return (
            <tr
              key={vendor.id}
              className="group hover:bg-stone-50 transition-colors"
            >
              <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 border border-stone-200 bg-orange-50/50 flex items-center justify-center p-1">
                    {vendorLogo ? (
                      <img
                        src={vendorLogo}
                        className="w-full h-full object-cover grayscale opacity-80"
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <Store size={20} className="text-brand-charcoal" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-brand-charcoal">
                      {vendor.name}
                    </p>
                    <p className="text-[8px] font-mono text-stone-500 mt-0.5">
                      {vendor.systemCode || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase text-stone-500">
                    Contact
                  </p>
                  <p className="text-xs text-brand-charcoal break-words">
                    {vendor.email}
                  </p>
                  <p className="text-xs text-brand-charcoal break-words">
                    {vendor.mainPhone}
                  </p>
                  <p className="text-xs text-brand-charcoal break-words">
                    {vendor.whatsappNumber}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase text-stone-500">
                    Address
                  </p>
                  <p className="text-xs text-brand-charcoal break-words">
                    {vendor.streetAddress}
                  </p>
                  <p className="text-xs text-brand-charcoal break-words">
                    {vendor.cityTown}, {vendor.province}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase text-stone-500">
                    Plan / Status
                  </p>
                  <p className="text-xs font-bold uppercase text-brand-charcoal">
                    {plans.find((p) => p.id === vendor.planId)?.name ||
                      vendor.planId}
                  </p>
                  <StatusBadge
                    status={vendor.subscriptionStatus}
                    variant={
                      vendor.subscriptionStatus === "active"
                        ? "success"
                        : "warning"
                    }
                  />
                  <StatusBadge
                    status={vendor.status}
                    variant={vendor.status === "active" ? "success" : "neutral"}
                    className="mt-1"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase text-stone-500">
                    Due Date
                  </p>
                  <p className="text-xs font-bold text-brand-charcoal">
                    {vendor.subscriptionDueDate
                      ? new Date(
                          vendor.subscriptionDueDate,
                        ).toLocaleDateString()
                      : "N/A"}
                  </p>
                  <p className="text-[9px] font-bold uppercase text-stone-500 mt-1">
                    RPN
                  </p>
                  <p className="text-xs text-brand-charcoal">
                    {rpn?.name || "Unassigned"}
                  </p>
                </div>

                <div className="flex-shrink-0 flex gap-2">
                  {permissionService.canEdit("vendorManagement") && (
                    <button
                      onClick={() => startEditVendor(vendor)}
                      className="p-2 border border-stone-200 text-stone-400 hover:border-brand-charcoal hover:text-brand-charcoal transition-all bg-white"
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                  {permissionService.canDelete("vendorManagement") && (
                    <button
                      onClick={() => {
                        setVendorToDelete(vendor.id);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="p-2 border border-stone-200 text-stone-400 hover:border-red-600 hover:text-red-600 transition-all bg-white"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </tr>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-6">
            <EmptyState
              title="No Vendors Found"
              description="No vendors match the current filters. Clear filters to see more."
              icon={Layers}
              action={
                <SecondaryButton
                  onClick={() => {
                    setSearch("");
                    setFilterSector("All");
                    setFilterRPN("All");
                    setFilterSubStatus("All");
                    setFilterVendorStatus("All");
                  }}
                >
                  Clear Filters
                </SecondaryButton>
              }
            />
          </div>
        )}
      </DataPanel>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Confirm Vendor Deletion"
        message="Deleting this vendor will result in immediate loss of all branch data and product mappings."
        confirmLabel="Delete Vendor"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
};
