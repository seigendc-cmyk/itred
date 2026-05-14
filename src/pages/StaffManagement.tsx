﻿﻿/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Users,
  Plus,
  Edit2,
  Lock,
  Unlock,
  UserX,
  Eye,
  EyeOff,
  Shield,
  RotateCcw,
  FileText,
  Download,
  AlertTriangle,
} from "lucide-react";
import {
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  SearchInput,
  ConfirmDialog,
  DataPanel,
  FormField,
} from "../components/CommonUI.tsx";
import { staffService, ROLE_TEMPLATES } from "../services/staffService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { permissionService } from "../services/permissionService.ts";
import {
  Staff,
  MenuKey,
  PermissionLevel,
  DeskType,
  ActivityLog,
  MenuPermissions,
  ActionPermissions,
  ActionPermissionKey,
} from "../types.ts";
import { asArray, stripUndefinedDeep } from "../utils/safeData.ts";
import { pdfService } from "../services/pdfService.ts";
import { focusMainContent } from "../utils/uiHelpers.ts";

import { staffAuditService } from "../services/staffAuditService.ts";

const DESKS: DeskType[] = [
  "SysAdmin Desk",
  "Backoffice Desk",
  "Product Data Desk",
  "Catalogue Deployment Desk",
  "Collections Desk",
  "RPN Management Desk",
  "CAH Operations Desk",
  "BI & Analytics Desk",
  "Viewer Desk",
];

const MENU_KEYS: MenuKey[] = [
  "dashboard",
  "vendorManagement",
  "addNewVendor",
  "rpnManagement",
  "addNewAgent",
  "productManagement",
  "addNewProduct",
  "productList",
  "accessHub",
  "whatsappActivity",
  "whatsappCommunityBI",
  "cahBooths",
  "pricing",
  "subscriptionsCollections",
  "collectionCalendar",
  "createCatalogue",
  "createStorefront",
  "inventorySpotChecks",
  "analytics",
  "biMarketAnalytics",
  "performanceMetrics",
  "activityLogs",
  "adminDashboard",
  "staffManagement",
  "roleMenuPermissions",
  "staffAccessLogs",
  "systemSettings",
  "howTo",
];

const PERMISSIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "vendorManagement", label: "Vendor Management" },
  { id: "addNewVendor", label: "Add New Vendor" },
  { id: "rpnManagement", label: "RPN Management" },
  { id: "addNewAgent", label: "Add New Agent" },
  { id: "productManagement", label: "Product Management" },
  { id: "addNewProduct", label: "Add New Product" },
  { id: "productList", label: "Product List" },
  { id: "accessHub", label: "Access Hub" },
  { id: "whatsappActivity", label: "WhatsApp Activity" },
  { id: "whatsappCommunityBI", label: "WhatsApp Community BI" },
  { id: "cahBooths", label: "CAH Booths" },
  { id: "pricing", label: "Pricing" },
  { id: "subscriptionsCollections", label: "Subscriptions & Collections" },
  { id: "collectionCalendar", label: "Collection Calendar" },
  { id: "createCatalogue", label: "Create Catalogue" },
  { id: "createStorefront", label: "Create Storefront" },
  { id: "inventorySpotChecks", label: "Inventory Spot Checks" },
  { id: "analytics", label: "Analytics" },
  { id: "biMarketAnalytics", label: "BI Market Analytics" },
  { id: "performanceMetrics", label: "Performance Metrics" },
  { id: "activityLogs", label: "Activity Logs" },
  { id: "adminDashboard", label: "Admin Dashboard" },
  { id: "staffManagement", label: "Staff Management" },
  { id: "roleMenuPermissions", label: "Role & Menu Permissions" },
  { id: "staffAccessLogs", label: "Staff Access Logs" },
  { id: "systemSettings", label: "System Settings" },
  { id: "howTo", label: "How To & Help" },
  { id: "approvalQueue", label: "Approval Queue" },
  { id: "notifications", label: "Notifications" },
  { id: "staffTasks", label: "Staff Tasks" },
];

const ACTION_GROUPS = [
  {
    name: "Vendor Operations",
    keys: [
      "vendor.view",
      "vendor.createDraft",
      "vendor.submitApproval",
      "vendor.approve",
      "vendor.publish",
      "vendor.delete",
    ],
  },
  {
    name: "Product Operations",
    keys: [
      "product.view",
      "product.createDraft",
      "product.submitApproval",
      "product.approve",
      "product.publish",
      "product.changePrice",
      "product.delete",
    ],
  },
  {
    name: "Catalogue Operations",
    keys: [
      "catalogue.view",
      "catalogue.generate",
      "catalogue.submitApproval",
      "catalogue.approveDeploy",
      "catalogue.download",
      "catalogue.archive",
    ],
  },
  {
    name: "Commerce Access Hub",
    keys: [
      "cah.view",
      "cah.createLink",
      "cah.submitApproval",
      "cah.approveLink",
    ],
  },
  {
    name: "WhatsApp Activity",
    keys: [
      "whatsapp.view",
      "whatsapp.logActivity",
      "whatsapp.verifyConversion",
    ],
  },
  {
    name: "Finance & Subscriptions",
    keys: ["pricing.view", "pricing.submitApproval", "pricing.approve"],
  },
  {
    name: "Notifications",
    keys: [
      "notifications.viewOwn",
      "notifications.viewTeam",
      "notifications.resolve",
    ],
  },
  {
    name: "Approval Queue",
    keys: ["approvalQueue.view", "approvalQueue.approve"],
  },
  {
    name: "Staff Tasks",
    keys: ["staffTasks.viewOwn", "staffTasks.assign", "staffTasks.complete"],
  },
  {
    name: "RPN & Field Network",
    keys: [
      "rpn.viewPerformance",
      "rpn.viewFinancials",
      "rpn.setThresholds",
      "rpn.assignVendor",
      "rpn.reassignVendor",
      "rpn.viewChurn",
      "rpn.viewCommissions",
      "rpn.exportReports",
    ],
  },
  {
    name: "Role & Menu Permissions",
    keys: [
      "roles.viewPermissions",
      "roles.editPermissions",
      "roles.createRoleTemplate",
      "roles.deleteRoleTemplate",
      "roles.assignRoleToStaff",
      "roles.auditPermissionChanges",
    ],
  },
] as const;

const JUNIOR_STAFF_PERMS: ActionPermissions = {
  "vendor.view": true,
  "vendor.createDraft": true,
  "vendor.submitApproval": true,
  "product.view": true,
  "product.createDraft": true,
  "product.submitApproval": true,
  "catalogue.view": true,
  "catalogue.generate": true,
  "catalogue.submitApproval": true,
  "cah.view": true,
  "cah.createLink": true,
  "cah.submitApproval": true,
  "pricing.view": true,
  "pricing.submitApproval": true,
  "whatsapp.view": true,
  "whatsapp.logActivity": true,
  "notifications.viewOwn": true,
  "staffTasks.viewOwn": true,
  "staffTasks.complete": true,
};

const MANAGER_PERMS: ActionPermissions = {
  ...JUNIOR_STAFF_PERMS,
  "vendor.approve": true,
  "product.approve": true,
  "product.changePrice": true,
  "catalogue.approveDeploy": true,
  "cah.approveLink": true,
  "pricing.approve": true,
  "whatsapp.verifyConversion": true,
  "notifications.viewTeam": true,
  "notifications.resolve": true,
  "approvalQueue.view": true,
  "approvalQueue.approve": true,
  "staffTasks.assign": true,
  "roles.viewPermissions": true,
};

const SUPER_ADMIN_PERMS: ActionPermissions = {
  ...MANAGER_PERMS,
  "vendor.publish": true,
  "vendor.delete": true,
  "product.publish": true,
  "product.delete": true,
  "catalogue.download": true,
  "catalogue.archive": true,
  "roles.viewPermissions": true,
  "roles.editPermissions": true,
  "roles.createRoleTemplate": true,
  "roles.deleteRoleTemplate": true,
  "roles.assignRoleToStaff": true,
  "roles.auditPermissionChanges": true,
};

export const StaffManagement: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<
    "directory" | "roles" | "logs" | "settings"
  >("directory");

  const location = useLocation();

  const [view, setView] = useState<
    "list" | "form" | "permissions" | "roleEdit"
  >("list");

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [search, setSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [filterStaff, setFilterStaff] = useState("all");
  const [filterEventType, setFilterEventType] = useState("all");
  const [filterResult, setFilterResult] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formData, setFormData] = useState<Partial<Staff>>({});
  const [showPasscode, setShowPasscode] = useState(false);
  const [tempPasscode, setTempPasscode] = useState("");
  const [confirmTempPasscode, setConfirmTempPasscode] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [isApplyRoleModalOpen, setIsApplyRoleModalOpen] = useState(false);
  const [applyRoleConfig, setApplyRoleConfig] = useState<{
    role: string;
  } | null>(null);
  const [localRoleTemplates, setLocalRoleTemplates] = useState<
    Record<
      string,
      {
        menuPermissions: MenuPermissions;
        actionPermissions?: ActionPermissions;
      }
    >
  >(() => {
    const base: Record<string, any> = { ...ROLE_TEMPLATES };
    Object.keys(base).forEach((k) => {
      if (!base[k].menuPermissions) {
        base[k] = { menuPermissions: base[k], actionPermissions: {} };
      }
    });
    base["Junior Staff"] = {
      menuPermissions: { dashboard: "view" },
      actionPermissions: JUNIOR_STAFF_PERMS,
    };
    base["Manager"] = {
      menuPermissions: {
        dashboard: "full",
        vendorManagement: "approve",
        productManagement: "approve",
        createCatalogue: "approve",
      },
      actionPermissions: MANAGER_PERMS,
    };
    base["Super Admin"] = {
      menuPermissions: { dashboard: "full" },
      actionPermissions: SUPER_ADMIN_PERMS,
    };
    return base;
  });
  const [editedRoleName, setEditedRoleName] = useState("");
  const [passcodeModalConfig, setPasscodeModalConfig] = useState<{
    staff: Staff;
    isOverride: boolean;
  } | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    action: () => void;
    variant: "danger" | "warning" | "success";
  } | null>(null);

  const closeAllModals = useCallback(() => {
    setIsConfirmOpen(false);
    setIsPasscodeModalOpen(false);
    setIsApplyRoleModalOpen(false);
    setConfirmConfig(null);
    setPasscodeModalConfig(null);
    setApplyRoleConfig(null);
    setTempPasscode("");
    setConfirmTempPasscode("");
    setFormError("");
    setFormSuccess("");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAllModals();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeAllModals]);

  useEffect(() => {
    if (location.pathname === "/role-menu-permissions") {
      setActiveTab("roles");
    } else if (location.pathname === "/staff-access-logs") {
      setActiveTab("logs");
    } else if (location.pathname === "/system-settings") {
      setActiveTab("settings");
    } else {
      setActiveTab("directory");
    }
  }, [location.pathname]);

  useEffect(() => {
    loadStaff();
    loadLogs();
  }, []);

  const loadStaff = async () => {
    try {
      const serviceWithFirebase = staffService as typeof staffService & {
        loadStaffFromFirebase?: () => Promise<Staff[]>;
      };

      const staff =
        typeof serviceWithFirebase.loadStaffFromFirebase === "function"
          ? await serviceWithFirebase.loadStaffFromFirebase()
          : staffService.getAllStaff();

      setStaffList(asArray<Staff>(staff));
    } catch (error) {
      console.error(
        "Failed to load staff from Firebase. Falling back local.",
        error,
      );
      setStaffList(asArray<Staff>(staffService.getAllStaff()));
    }
  };

  const loadLogs = async () => {
    setAllLogs(
      asArray<ActivityLog>(await Promise.resolve(analyticsService.getEvents())),
    );
  };

  const filteredStaff = useMemo(
    () =>
      asArray<Staff>(staffList).filter(
        (s) =>
          ((s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
            (s.displayName || "")
              .toLowerCase()
              .includes(search.toLowerCase()) ||
            (s.staffCode || "").toLowerCase().includes(search.toLowerCase())) &&
          s.status !== "archived",
      ),
    [staffList, search],
  );

  const staffLogs = useMemo(() => {
    const safeAllLogs = asArray<ActivityLog>(allLogs);

    return safeAllLogs
      .filter((log) => {
        const isStaffEvent =
          log.eventType?.startsWith("STAFF_") ||
          log.eventType === "ACCESS_DENIED";

        if (!isStaffEvent) return false;

        const staffId = log.actorId || log.details?.staffId;
        const matchesStaff = filterStaff === "all" || staffId === filterStaff;
        const matchesEvent =
          filterEventType === "all" || log.eventType === filterEventType;
        const matchesResult =
          filterResult === "all" || log.result === filterResult;

        const searchBlob = `${log.actorName} ${log.eventType} ${JSON.stringify(
          log.details,
        )}`.toLowerCase();

        const matchesSearch =
          logSearch === "" || searchBlob.includes(logSearch.toLowerCase());

        const logDate = log.timestamp?.split("T")[0] || "";
        const matchesDateFrom = !dateFrom || logDate >= dateFrom;
        const matchesDateTo = !dateTo || logDate <= dateTo;

        return (
          matchesStaff &&
          matchesEvent &&
          matchesResult &&
          matchesSearch &&
          matchesDateFrom &&
          matchesDateTo
        );
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [
    allLogs,
    filterStaff,
    filterEventType,
    filterResult,
    logSearch,
    dateFrom,
    dateTo,
  ]);

  const handleAddStaff = () => {
    const staffCode = staffService.generateStaffCode();

    setFormData({
      id: staffCode,
      staffCode,
      fullName: "",
      displayName: "",
      status: "active",
      role: "Backoffice Operator",
      desk: "Backoffice Desk",
      menuPermissions:
        localRoleTemplates["Backoffice Operator"]?.menuPermissions || {},
      actionPermissions:
        localRoleTemplates["Backoffice Operator"]?.actionPermissions || {},
      mustChangePasscode: true,
      passcode: "",
      failedAttemptCount: 0,
      isLocked: false,
      personalDetails: {},
      addressDetails: {},
      kycDetails: { kycStatus: "not_started" },
      kycDocuments: {},
      createdAt: new Date().toISOString(),
      createdBy: "SysAdmin",
    });

    setTempPasscode("");
    setConfirmTempPasscode("");
    setSelectedStaff(null);
    setFormError("");
    setFormSuccess("");
    setView("form");
    focusMainContent();
  };

  const saveStaff = async () => {
    setFormError("");
    setFormSuccess("");

    if (
      !formData.fullName ||
      !formData.displayName ||
      !formData.role ||
      !formData.desk
    ) {
      setFormError(
        "Please fill in all required fields: Full Name, Display Name, Role, and Desk.",
      );
      return;
    }

    if (
      formData.personalDetails?.nationalId &&
      formData.personalDetails.nationalId.trim().length > 0 &&
      formData.personalDetails.nationalId.trim().length < 5
    ) {
      setFormError("National ID must be at least 5 characters.");
      return;
    }

    if (!selectedStaff && (!tempPasscode || tempPasscode.length !== 6)) {
      setFormError("Please set a 6-digit passcode for new staff members.");
      return;
    }

    if (!selectedStaff && tempPasscode !== formData.passcode) {
      setFormError("Passcode confirmation does not match.");
      return;
    }

    if (selectedStaff && formData.passcode && formData.passcode.length !== 6) {
      setFormError("Passcode must be 6 digits.");
      return;
    }

    const defaultPermissions =
      localRoleTemplates[formData.role as string]?.menuPermissions ||
      localRoleTemplates["Viewer"]?.menuPermissions ||
      {};
    const defaultActions =
      localRoleTemplates[formData.role as string]?.actionPermissions || {};

    const now = new Date().toISOString();
    const staffCode = selectedStaff
      ? formData.staffCode || selectedStaff.staffCode
      : formData.staffCode || staffService.generateStaffCode();

    const staffId = selectedStaff
      ? selectedStaff.id
      : formData.id || staffCode || `STF-${Date.now()}`;

    const staffToSave: Staff = stripUndefinedDeep({
      ...(formData as Staff),
      id: staffId,
      staffCode,
      menuPermissions: !selectedStaff
        ? defaultPermissions
        : formData.menuPermissions || defaultPermissions,
      actionPermissions: !selectedStaff
        ? defaultActions
        : formData.actionPermissions || defaultActions,
      failedAttemptCount: !selectedStaff
        ? 0
        : formData.failedAttemptCount || selectedStaff.failedAttemptCount || 0,
      isLocked: !selectedStaff
        ? false
        : formData.isLocked || selectedStaff.isLocked || false,
      passcode: selectedStaff
        ? formData.passcode || selectedStaff.passcode
        : tempPasscode,
      updatedAt: now,
      createdAt: formData.createdAt || selectedStaff?.createdAt || now,
      updatedBy: "SysAdmin",
    });

    try {
      await staffService.saveStaff(staffToSave);

      analyticsService.logEvent({
        eventType: selectedStaff ? "STAFF_UPDATED" : "STAFF_CREATED",
        actorType: "admin",
        actorName: "SysAdmin",
        actorId: staffToSave.id,
        result: "updated",
        details: {
          staffId: staffToSave.id,
          staffCode: staffToSave.staffCode,
          fullName: staffToSave.fullName,
          role: staffToSave.role,
          desk: staffToSave.desk,
        },
      });

      if (selectedStaff) {
        const oldStaff = selectedStaff;
        const oldKycStatus = oldStaff.kycDetails?.kycStatus;
        const newKycStatus = staffToSave.kycDetails?.kycStatus;

        if (oldKycStatus !== newKycStatus) {
          void staffAuditService.logAction({
            eventType: "RECORD_UPDATED",
            module: "staff",
            severity: "critical",
            action: "Updated staff KYC status",
            recordType: "staff",
            recordId: staffToSave.id,
            recordName: staffToSave.displayName || staffToSave.fullName,
            beforeSnapshot: oldStaff,
            afterSnapshot: staffToSave,
          });
        }

        const pChanged =
          JSON.stringify(oldStaff.personalDetails || {}) !==
          JSON.stringify(staffToSave.personalDetails || {});
        const aChanged =
          JSON.stringify(oldStaff.addressDetails || {}) !==
          JSON.stringify(staffToSave.addressDetails || {});
        const kChanged =
          JSON.stringify(oldStaff.kycDetails || {}) !==
          JSON.stringify(staffToSave.kycDetails || {});
        const dChanged =
          JSON.stringify(oldStaff.kycDocuments || {}) !==
          JSON.stringify(staffToSave.kycDocuments || {});

        if (pChanged || aChanged || kChanged || dChanged) {
          void staffAuditService.logAction({
            eventType: "RECORD_UPDATED",
            module: "staff",
            severity: "high",
            action: "Updated staff Personal, Address & KYC Details",
            recordType: "staff",
            recordId: staffToSave.id,
            recordName: staffToSave.displayName || staffToSave.fullName,
            beforeSnapshot: oldStaff,
            afterSnapshot: staffToSave,
          });
        }
      }

      setStaffList(asArray<Staff>(staffService.getAllStaff()));
      await loadLogs();

      window.setTimeout(() => {
        void loadStaff();
      }, 800);

      setTempPasscode("");
      setConfirmTempPasscode("");
      setSelectedStaff(null);
      setFormData({});
      setFormSuccess("Staff Personal, Address & KYC details saved.");
      setView("list");
      focusMainContent();
      setTimeout(() => setFormSuccess(""), 3000);
    } catch (error: any) {
      console.error("Failed to save staff profile.", error);
      if (error.message && error.message.includes("Duplicate")) {
        void staffAuditService.logAction({
          eventType: "ACCESS_DENIED",
          module: "staff",
          severity: "high",
          action: "Blocked duplicate staff code/email save",
        });
        setFormError(error.message);
      } else {
        setFormError(
          "Staff details were not saved. Check permissions or network.",
        );
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const triggerAction = (staff: Staff, type: string) => {
    const configs: Record<string, any> = {
      suspend: {
        title: "Suspend Staff?",
        variant: "danger",
        status: "suspended",
        eventType: "STAFF_SUSPENDED",
      },
      reactivate: {
        title: "Reactivate Staff?",
        variant: "success",
        status: "active",
        eventType: "STAFF_REACTIVATED",
      },
      lock: {
        title: "Lock Profile?",
        variant: "danger",
        status: "locked",
        isLocked: true,
        eventType: "STAFF_LOCKED",
      },
      unlock: {
        title: "Unlock Profile?",
        variant: "success",
        status: "active",
        isLocked: false,
        failedAttemptCount: 0,
        eventType: "STAFF_UNLOCKED",
      },
      resetPasscode: {
        title: "Reset Passcode?",
        variant: "warning",
        status: "passcode_reset_required",
        mustChangePasscode: true,
        isLocked: false,
        failedAttemptCount: 0,
        eventType: "STAFF_PASSCODE_RESET",
      },
      overridePasscode: {
        title: "Override Passcode?",
        variant: "danger",
        status: "active",
        mustChangePasscode: false,
        isLocked: false,
        failedAttemptCount: 0,
        eventType: "STAFF_PASSCODE_OVERRIDDEN",
      },
    };

    const cfg = configs[type];

    setConfirmConfig({
      title: cfg.title,
      message: `Confirm change for ${staff.displayName}.`,
      variant: cfg.variant,
      action: async () => {
        try {
          await staffService.saveStaff({
            ...staff,
            status: cfg.status || staff.status,
            isLocked:
              cfg.isLocked !== undefined ? cfg.isLocked : staff.isLocked,
            failedAttemptCount:
              cfg.failedAttemptCount !== undefined
                ? cfg.failedAttemptCount
                : staff.failedAttemptCount,
            mustChangePasscode:
              cfg.mustChangePasscode !== undefined
                ? cfg.mustChangePasscode
                : staff.mustChangePasscode,
            updatedAt: new Date().toISOString(),
            updatedBy: "SysAdmin",
          });

          analyticsService.logEvent({
            eventType: cfg.eventType || `STAFF_${type.toUpperCase()}`,
            actorType: "admin",
            actorName: "SysAdmin",
            actorId: staff.id,
            result: "updated",
            details: {
              staffId: staff.id,
              staffCode: staff.staffCode,
              action: type,
            },
          });

          setStaffList(asArray<Staff>(staffService.getAllStaff()));

          window.setTimeout(() => {
            void loadStaff();
            void loadLogs();
          }, 800);

          setFormSuccess("Staff saved to Firebase/local cache");
          setTimeout(() => setFormSuccess(""), 3000);
        } catch (error) {
          console.error("Failed to update staff status.", error);
          setFormError(
            "Failed to save staff profile to Firebase. Check console for details.",
          );
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
    });

    setIsConfirmOpen(true);
  };

  const handlePasscodeAction = async (
    staff: Staff,
    newPasscode: string,
    isOverride: boolean,
  ) => {
    if (newPasscode.length !== 6 || !/^\d{6}$/.test(newPasscode)) {
      alert("Passcode must be exactly 6 digits.");
      return;
    }

    try {
      await staffService.saveStaff({
        ...staff,
        passcode: newPasscode,
        mustChangePasscode: !isOverride,
        status: isOverride ? "active" : "passcode_reset_required",
        failedAttemptCount: 0,
        isLocked: false,
        updatedAt: new Date().toISOString(),
        updatedBy: "SysAdmin",
      });

      analyticsService.logEvent({
        eventType: isOverride
          ? "STAFF_PASSCODE_OVERRIDDEN"
          : "STAFF_PASSCODE_RESET",
        actorType: "admin",
        actorName: "SysAdmin",
        actorId: staff.id,
        result: "updated",
        details: {
          staffId: staff.id,
          staffCode: staff.staffCode,
        },
      });

      setStaffList(asArray<Staff>(staffService.getAllStaff()));

      window.setTimeout(() => {
        void loadStaff();
        void loadLogs();
      }, 800);

      setTempPasscode("");
      setConfirmTempPasscode("");
      setIsPasscodeModalOpen(false);

      setFormSuccess("Staff saved to Firebase/local cache");
      setTimeout(() => setFormSuccess(""), 3000);
    } catch (error) {
      console.error("Failed to save new passcode.", error);
      alert(
        "Failed to save staff profile to Firebase. Check console for details.",
      );
    }
  };

  const exportLogsJSON = () => {
    const data = JSON.stringify(staffLogs, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `staff_access_logs_${new Date().toISOString()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const exportLogsPDF = () => {
    pdfService.generateStaffAccessReport({
      logs: staffLogs,
      staffList,
      dateFrom,
      dateTo,
      filters: {
        staff:
          filterStaff !== "all"
            ? staffList.find((s) => s.id === filterStaff)?.fullName ||
              "Selected"
            : "All",
        eventType: filterEventType !== "all" ? filterEventType : "All",
        result: filterResult !== "all" ? filterResult : "All",
      },
    });
  };

  const handlePermissionChange = (menuKey: MenuKey, level: PermissionLevel) => {
    setFormData((prev) => ({
      ...prev,
      menuPermissions: {
        ...prev?.menuPermissions,
        [menuKey]: level,
      },
    }));
  };

  const handleActionPermissionChange = (
    key: ActionPermissionKey,
    level: boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      actionPermissions: {
        ...prev?.actionPermissions,
        [key]: level,
      },
    }));
  };

  const duplicates = useMemo(() => {
    if (!formData.staffCode && !formData.email) return [];

    return staffList.filter((s) => {
      if (s.id === formData.id) return false;
      const sameCode =
        !!formData.staffCode && s.staffCode === formData.staffCode;
      const sameEmail =
        !!formData.email &&
        !!s.email &&
        s.email.toLowerCase() === formData.email.toLowerCase() &&
        s.status === "active";
      return sameCode || sameEmail;
    });
  }, [formData.staffCode, formData.email, formData.id, staffList]);

  const hasDuplicateCode = duplicates.some(
    (s) => s.staffCode === formData.staffCode,
  );

  return (
    <div className="space-y-8 pb-20">
      <div
        className="flex bg-stone-100 p-1 rounded-none w-fit"
        id="staff-management-header"
        tabIndex={-1}
      >
        {["directory", "roles", "logs", "settings"].map((tab) => {
          if (
            tab === "roles" &&
            !permissionService.hasMenuAccess("roleMenuPermissions")
          )
            return null;
          if (
            tab === "logs" &&
            !permissionService.hasMenuAccess("staffAccessLogs")
          )
            return null;
          if (
            tab === "settings" &&
            !permissionService.hasMenuAccess("systemSettings")
          )
            return null;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab as any);
                setView("list");
              }}
              className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest ${
                activeTab === tab
                  ? "bg-white text-brand-orange shadow-sm"
                  : "text-stone-400"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === "roles" &&
        permissionService.canViewRolePermissions() &&
        view === "list" && (
          <div className="space-y-6">
            {!permissionService.canEditRolePermissions() && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                You can view role permissions, but you do not have authority to
                edit them.
              </div>
            )}
            <DataPanel
              title="Role Templates"
              actions={
                permissionService.canCreateRoleTemplate() && (
                  <PrimaryButton
                    onClick={() => {
                      setEditedRoleName("New Custom Role");
                      setFormData({ menuPermissions: {} });
                      setSelectedStaff({ role: "New Custom Role" } as any);
                      setView("roleEdit");
                      focusMainContent();
                    }}
                    className="text-xs px-3 py-1 flex items-center gap-1"
                  >
                    <Plus size={14} /> New Template
                  </PrimaryButton>
                )
              }
            >
              <div className="space-y-4">
                {Object.keys(localRoleTemplates).map((role) => (
                  <div
                    key={role}
                    className="border border-stone-200 rounded-none p-4"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-stone-800">{role}</h3>
                        <p className="text-sm text-stone-600">
                          {role === "SysAdmin" || role === "Admin"
                            ? "Full system access"
                            : role === "Backoffice Operator"
                              ? "General operational tasks"
                              : role === "Product Data Clerk"
                                ? "Product data management"
                                : role === "Catalogue Officer"
                                  ? "Catalogue creation and deployment"
                                  : role === "Collections Officer"
                                    ? "Subscription and collections management"
                                    : role === "RPN Manager"
                                      ? "RPN network management"
                                      : role === "CAH Officer"
                                        ? "Commerce Access Hub operations"
                                        : role === "BI Analyst"
                                          ? "Business intelligence and analytics"
                                          : "Read-only access"}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {permissionService.canAssignRoleToStaff() && (
                          <PrimaryButton
                            onClick={() => {
                              setApplyRoleConfig({ role });
                              setIsApplyRoleModalOpen(true);
                            }}
                            className="text-xs px-3 py-1"
                          >
                            Apply to Staff
                          </PrimaryButton>
                        )}

                        <SecondaryButton
                          onClick={() => {
                            setFormData({
                              menuPermissions: {
                                ...localRoleTemplates[role].menuPermissions,
                              },
                              actionPermissions: {
                                ...localRoleTemplates[role].actionPermissions,
                              },
                            });
                            setSelectedStaff({ role } as any);
                            setEditedRoleName(role);
                            setView("roleEdit");
                            focusMainContent();
                          }}
                          className="text-xs px-3 py-1"
                        >
                          {permissionService.canEditRolePermissions()
                            ? "Edit Permissions"
                            : "View Permissions"}
                        </SecondaryButton>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {Object.entries(
                        localRoleTemplates[role].menuPermissions || {},
                      ).map(([key, level]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-stone-600">
                            {PERMISSIONS.find((p) => p.id === key)?.label ||
                              key}
                            :
                          </span>
                          <span
                            className={`font-medium ${
                              level === "full"
                                ? "text-green-600"
                                : level === "hidden"
                                  ? "text-red-600"
                                  : "text-blue-600"
                            }`}
                          >
                            {level}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
        )}

      {activeTab === "roles" &&
        permissionService.canViewRolePermissions() &&
        view === "roleEdit" &&
        selectedStaff?.role && (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-stone-900 text-white p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest">
                {permissionService.canEditRolePermissions()
                  ? "Edit Role Template"
                  : "View Role Template"}{" "}
                - {editedRoleName || selectedStaff.role}
              </h3>

              <div className="flex gap-3">
                <SecondaryButton className="text-white border-white/20">
                  Cancel
                </SecondaryButton>

                {permissionService.canEditRolePermissions() && (
                  <>
                    <SecondaryButton
                      onClick={() => {
                        const resetPerms =
                          ROLE_TEMPLATES[selectedStaff.role as string] || {};
                        setFormData((prev) => ({
                          ...prev,
                          menuPermissions: { ...resetPerms.menuPermissions },
                          actionPermissions: {
                            ...resetPerms.actionPermissions,
                          },
                        }));
                      }}
                      className="text-stone-300 border-stone-600 hover:text-white"
                    >
                      Reset to Default
                    </SecondaryButton>

                    <PrimaryButton
                      onClick={() => {
                        if (!permissionService.canEditRolePermissions()) {
                          alert(
                            "You do not have permission to edit role permissions.",
                          );
                          return;
                        }
                        const updatedRole = selectedStaff.role as string;
                        const newRole = editedRoleName.trim() || updatedRole;
                        const newTemplates = {
                          ...localRoleTemplates,
                        };
                        if (updatedRole !== newRole) {
                          newTemplates[newRole] = {
                            menuPermissions:
                              formData.menuPermissions as MenuPermissions,
                            actionPermissions: formData.actionPermissions,
                          };
                          delete newTemplates[updatedRole];
                        } else {
                          newTemplates[updatedRole] = {
                            menuPermissions:
                              formData.menuPermissions as MenuPermissions,
                            actionPermissions: formData.actionPermissions,
                          };
                        }

                        staffService.saveRoleTemplates(newTemplates);
                        setLocalRoleTemplates(newTemplates);

                        analyticsService.logEvent({
                          eventType: "ROLE_TEMPLATE_UPDATED",
                          actorType: "admin",
                          actorName: "SysAdmin",
                          result: "updated",
                          details: { role: updatedRole },
                        });

                        // Non-blocking staff audit logging
                        try {
                          void staffAuditService.logAction({
                            eventType: "PERMISSION_CHANGED",
                            module: "staff",
                            action: "Updated role/menu/action permissions",
                            severity: "critical",
                            recordType: "role_template",
                            recordName: newRole,
                            beforeSnapshot: localRoleTemplates[updatedRole],
                            afterSnapshot: newTemplates[newRole],
                          });
                        } catch (auditErr) {
                          console.error("Audit log failed", auditErr);
                        }

                        setView("list");
                        focusMainContent();
                      }}
                    >
                      Save Role Permissions
                    </PrimaryButton>
                  </>
                )}
              </div>
            </div>

            {!permissionService.canEditRolePermissions() && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm mt-4 mx-6">
                You can view role permissions, but you do not have authority to
                edit them.
              </div>
            )}

            <DataPanel title="Template Identity">
              <div className="p-6">
                <FormField label="Role / Template Name">
                  <input
                    type="text"
                    value={editedRoleName}
                    onChange={(e) => setEditedRoleName(e.target.value)}
                    className="form-input max-w-md"
                    disabled={
                      !permissionService.canEditRolePermissions() ||
                      selectedStaff?.role === "SysAdmin" ||
                      selectedStaff?.role === "Admin"
                    }
                  />
                </FormField>
                {(selectedStaff?.role === "SysAdmin" ||
                  selectedStaff?.role === "Admin") && (
                  <p className="text-xs text-stone-400 mt-2 italic">
                    System roles cannot be renamed.
                  </p>
                )}
              </div>
            </DataPanel>

            <DataPanel title="Role Template Permissions">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MENU_KEYS.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 border border-stone-200 rounded-none"
                  >
                    <span className="text-sm font-medium">
                      {PERMISSIONS.find((p) => p.id === key)?.label || key}
                    </span>

                    <select
                      value={formData.menuPermissions?.[key] || "hidden"}
                      onChange={(e) =>
                        handlePermissionChange(
                          key,
                          e.target.value as PermissionLevel,
                        )
                      }
                      disabled={
                        !permissionService.canEditRolePermissions() ||
                        selectedStaff?.role === "SysAdmin" ||
                        selectedStaff?.role === "Admin"
                      }
                      className="text-xs border border-stone-200 rounded-none px-2 py-1"
                    >
                      <option value="hidden">Hidden</option>
                      <option value="view">View</option>
                      <option value="create">Create</option>
                      <option value="submit">Submit</option>
                      <option value="edit">Edit</option>
                      <option value="approve">Approve</option>
                      <option value="delete">Delete</option>
                      <option value="export">Export</option>
                      <option value="full">Full</option>
                    </select>
                  </div>
                ))}
              </div>
            </DataPanel>

            <DataPanel title="Action Permissions & Approval Rights">
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ACTION_GROUPS.map((group) => (
                  <div key={group.name} className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-brand-orange border-b border-stone-100 pb-2">
                      {group.name}
                    </h4>
                    {group.keys.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="accent-brand-orange"
                          checked={
                            !!formData.actionPermissions?.[
                              key as ActionPermissionKey
                            ]
                          }
                          onChange={(e) =>
                            handleActionPermissionChange(
                              key as ActionPermissionKey,
                              e.target.checked,
                            )
                          }
                          disabled={
                            !permissionService.canEditRolePermissions() ||
                            selectedStaff?.role === "SysAdmin" ||
                            selectedStaff?.role === "Admin"
                          }
                        />
                        {key.split(".")[1]}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
        )}

      {activeTab === "directory" &&
        (view === "list" || permissionService.isSysAdmin()) && (
          <div className="space-y-6">
            {formSuccess && view === "list" && (
              <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-none text-sm font-medium">
                {formSuccess}
              </div>
            )}
            {formError && view === "list" && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-none text-sm font-medium">
                {formError}
              </div>
            )}
            <div className="flex justify-between items-center">
              <SearchInput
                placeholder="Search staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />

              {permissionService.canEdit("staffManagement") && (
                <PrimaryButton onClick={handleAddStaff}>
                  <Plus size={16} className="mr-2" />
                  Add Staff
                </PrimaryButton>
              )}
            </div>

            <DataPanel title="Staff Registry">
              {permissionService.isSysAdmin() && (
                <div className="p-2 mb-4 bg-stone-100 border border-stone-200 text-[10px] font-mono text-stone-500">
                  [Firebase Diagnostic] Target Collection: itred_console_staff |
                  Loaded Count: {staffList.length} | loadStaffFromFirebase
                  Exists:{" "}
                  {typeof (staffService as any).loadStaffFromFirebase ===
                  "function"
                    ? "Yes"
                    : "No"}
                </div>
              )}
              {filteredStaff.length === 0 ? (
                <EmptyState
                  title="No Staff Records"
                  description="No staff records found. Click Add Staff to create a staff profile."
                  icon={Users}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-3 px-6 font-semibold text-stone-700">
                          ID / Code
                        </th>
                        <th className="text-left py-3 px-6 font-semibold text-stone-700">
                          Identity
                        </th>
                        <th className="text-left py-3 px-6 font-semibold text-stone-700">
                          Role
                        </th>
                        <th className="text-left py-3 px-6 font-semibold text-stone-700">
                          Desk
                        </th>
                        <th className="text-left py-3 px-6 font-semibold text-stone-700">
                          Status
                        </th>
                        <th className="text-right py-3 px-6 font-semibold text-stone-700">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredStaff.map((staff) => (
                        <tr
                          key={staff.id}
                          className="border-b border-stone-200 hover:bg-stone-50"
                        >
                          <td className="px-6 py-4 font-mono text-sm">
                            {staff.staffCode}
                          </td>

                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium">{staff.displayName}</p>
                              <p className="text-sm text-stone-600">
                                {staff.fullName}
                              </p>
                              {staff.email && (
                                <p className="text-xs text-stone-400">
                                  {staff.email}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">{staff.role}</td>
                          <td className="px-6 py-4">{staff.desk}</td>

                          <td className="px-6 py-4">
                            <StatusBadge
                              status={staff.status}
                              variant={
                                staff.status === "active"
                                  ? "success"
                                  : staff.status === "suspended"
                                    ? "warning"
                                    : "danger"
                              }
                            />
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {permissionService.canEdit("staffManagement") && (
                                <button
                                  onClick={() => {
                                    setFormData(staff);
                                    setSelectedStaff(staff);
                                    setView("form");
                                    focusMainContent();
                                  }}
                                  className="p-1.5 border border-stone-200 rounded-none hover:bg-stone-100"
                                  title="Edit Staff"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}

                              {permissionService.canEdit("staffManagement") && (
                                <button
                                  onClick={() =>
                                    triggerAction(
                                      staff,
                                      staff.isLocked ? "unlock" : "lock",
                                    )
                                  }
                                  className="p-1.5 border border-stone-200 rounded-none hover:bg-stone-100"
                                  title={
                                    staff.isLocked
                                      ? "Unlock Staff"
                                      : "Lock Staff"
                                  }
                                >
                                  {staff.isLocked ? (
                                    <Unlock size={12} />
                                  ) : (
                                    <Lock size={12} />
                                  )}
                                </button>
                              )}

                              {permissionService.canEdit("staffManagement") && (
                                <button
                                  onClick={() => {
                                    setPasscodeModalConfig({
                                      staff,
                                      isOverride: false,
                                    });
                                    setTempPasscode("");
                                    setConfirmTempPasscode("");
                                    setIsPasscodeModalOpen(true);
                                  }}
                                  className="p-1.5 border border-stone-200 rounded-none hover:bg-stone-100"
                                  title="Reset Passcode (Force Change)"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}

                              {permissionService.isSysAdmin() && (
                                <button
                                  onClick={() => {
                                    setPasscodeModalConfig({
                                      staff,
                                      isOverride: true,
                                    });
                                    setTempPasscode("");
                                    setConfirmTempPasscode("");
                                    setIsPasscodeModalOpen(true);
                                  }}
                                  className="p-1.5 border border-stone-200 rounded-none hover:bg-stone-100"
                                  title="Override Passcode"
                                >
                                  <Shield size={12} />
                                </button>
                              )}

                              {permissionService.canEdit("staffManagement") && (
                                <button
                                  onClick={() =>
                                    triggerAction(
                                      staff,
                                      staff.status === "active"
                                        ? "suspend"
                                        : "reactivate",
                                    )
                                  }
                                  className="p-1.5 border border-stone-200 rounded-none hover:bg-stone-100"
                                  title={
                                    staff.status === "active"
                                      ? "Suspend Staff"
                                      : "Reactivate Staff"
                                  }
                                >
                                  <UserX size={12} />
                                </button>
                              )}

                              {permissionService.canEdit("staffManagement") && (
                                <button
                                  onClick={() => {
                                    setFormData(staff);
                                    setSelectedStaff(staff);
                                    setView("permissions");
                                    focusMainContent();
                                  }}
                                  className="p-1.5 border border-stone-200 rounded-none hover:bg-stone-100"
                                  title="Edit Permissions"
                                >
                                  <Shield size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataPanel>
          </div>
        )}

      {activeTab === "logs" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
              <SearchInput
                placeholder="Search logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-64"
              />

              <select
                value={filterStaff}
                onChange={(e) => setFilterStaff(e.target.value)}
                className="form-input w-48"
              >
                <option value="all">All Staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>

              <select
                value={filterEventType}
                onChange={(e) => setFilterEventType(e.target.value)}
                className="form-input w-48"
              >
                <option value="all">All Events</option>
                <option value="STAFF_LOGIN_SUCCESS">Login Success</option>
                <option value="STAFF_LOGIN_FAILED">Login Failed</option>
                <option value="STAFF_CREATED">Staff Created</option>
                <option value="STAFF_UPDATED">Staff Updated</option>
                <option value="STAFF_SUSPENDED">Staff Suspended</option>
                <option value="STAFF_REACTIVATED">Staff Reactivated</option>
                <option value="STAFF_LOCKED">Staff Locked</option>
                <option value="STAFF_UNLOCKED">Staff Unlocked</option>
                <option value="STAFF_PASSCODE_RESET">Passcode Reset</option>
                <option value="STAFF_PASSCODE_OVERRIDDEN">
                  Passcode Override
                </option>
                <option value="STAFF_PERMISSIONS_UPDATED">
                  Permissions Updated
                </option>
                <option value="STAFF_ROLE_CHANGED">Role Changed</option>
                <option value="ACCESS_DENIED">Access Denied</option>
              </select>

              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
                className="form-input w-32"
              >
                <option value="all">All Results</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="updated">Updated</option>
              </select>
            </div>

            <div className="flex gap-2">
              <PrimaryButton onClick={exportLogsJSON} className="text-xs">
                <Download size={14} className="mr-2" /> Export JSON
              </PrimaryButton>

              <PrimaryButton onClick={exportLogsPDF} className="text-xs">
                <FileText size={14} className="mr-2" /> Export PDF
              </PrimaryButton>

              <SecondaryButton
                onClick={() => {
                  if (confirm("Clear all demo logs? This cannot be undone.")) {
                    analyticsService.clearLogs();
                    loadLogs();
                  }
                }}
                className="text-xs text-red-600"
              >
                Clear Logs
              </SecondaryButton>
            </div>
          </div>

          <DataPanel title={`Staff Access Logs (${staffLogs.length})`}>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {staffLogs.slice(0, 100).map((log, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-stone-50 rounded-none border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-stone-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>

                      <span
                        className={`text-xs px-2 py-1 rounded-none ${
                          log.result === "success"
                            ? "bg-green-100 text-green-800"
                            : log.result === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.result}
                      </span>

                      <span className="text-xs font-medium text-stone-700">
                        {log.eventType?.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="text-xs text-stone-600 mt-1">
                      {log.actorName} â€¢{" "}
                      {log.details ? JSON.stringify(log.details) : ""}
                    </div>
                  </div>
                </div>
              ))}

              {staffLogs.length === 0 && (
                <div className="text-center py-8 text-stone-500">
                  No staff access logs found.
                </div>
              )}
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === "directory" && view === "form" && (
        <div className="space-y-8">
          <div className="flex justify-between items-center bg-stone-900 text-white p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest">
              {selectedStaff ? "Modify Staff Node" : "Initialize Staff Node"}
            </h3>

            <div className="flex gap-3">
              <SecondaryButton
                onClick={() => {
                  setView("list");
                  setSelectedStaff(null);
                  setFormData({});
                  setFormError("");
                }}
                className="text-white border-white/20"
              >
                Discard
              </SecondaryButton>

              <PrimaryButton
                onClick={saveStaff}
                disabled={duplicates.length > 0}
              >
                Save Profile
              </PrimaryButton>
            </div>
          </div>

          <DataPanel title="Staff Profile">
            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-none text-sm">
                {formError}
              </div>
            )}

            {duplicates.length > 0 && (
              <div className="mb-4 p-4 border-t-4 border-t-red-500 bg-red-50/30 text-red-700">
                <div className="flex gap-3 text-red-600">
                  <AlertTriangle size={20} className="shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold uppercase">
                      Possible duplicate staff record found
                    </h4>
                    <p className="text-xs text-stone-600 mt-1">
                      Another record shares the same staff code or email.
                    </p>
                    {hasDuplicateCode && permissionService.isSysAdmin() && (
                      <PrimaryButton
                        className="mt-3 text-xs px-3 py-1"
                        onClick={async () => {
                          let newCode = "";
                          try {
                            newCode =
                              await staffService.generateUniqueStaffCodeFromFirebase();
                          } catch (e) {
                            newCode = staffService.generateStaffCode();
                          }
                          setFormData((prev) => ({
                            ...prev,
                            staffCode: newCode,
                          }));
                        }}
                      >
                        Regenerate Code
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Staff Code">
                <input
                  type="text"
                  value={formData.staffCode || ""}
                  disabled
                  className="form-input bg-stone-100 text-stone-500 cursor-not-allowed"
                />
              </FormField>

              <FormField label="Full Name *" required>
                <input
                  type="text"
                  value={formData.fullName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </FormField>

              <FormField label="Display Name *" required>
                <input
                  type="text"
                  value={formData.displayName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </FormField>

              <FormField label="Role *" required>
                <select
                  value={formData.role || ""}
                  onChange={(e) => {
                    const role = e.target.value;

                    setFormData({
                      ...formData,
                      role,
                      desk:
                        (staffService as any).ROLE_TO_DESK_MAP?.[role] || "",
                      menuPermissions:
                        localRoleTemplates[role]?.menuPermissions || {},
                      actionPermissions:
                        localRoleTemplates[role]?.actionPermissions || {},
                    });
                  }}
                  className="form-input"
                  required
                >
                  <option value="">Select Role</option>
                  {Object.keys(localRoleTemplates).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Desk *" required>
                <select
                  value={formData.desk || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, desk: e.target.value })
                  }
                  className="form-input"
                  required
                >
                  <option value="">Select Desk</option>
                  {DESKS.map((desk) => (
                    <option key={desk} value={desk}>
                      {desk}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="form-input"
                />
              </FormField>

              <FormField label="Phone">
                <input
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="form-input"
                />
              </FormField>

              <FormField label="WhatsApp">
                <input
                  type="tel"
                  value={formData.whatsapp || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                  className="form-input"
                />
              </FormField>

              <FormField label="Allowed Google Email">
                <input
                  type="email"
                  value={formData.googleEmailAllowed || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      googleEmailAllowed: e.target.value,
                    })
                  }
                  className="form-input"
                />
              </FormField>

              <FormField label="Status">
                <select
                  value={formData.status || "active"}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="form-input"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </FormField>

              <FormField label="6-digit Passcode *" required>
                <div className="relative">
                  <input
                    type={showPasscode ? "text" : "password"}
                    value={
                      selectedStaff ? formData.passcode || "" : tempPasscode
                    }
                    onChange={(e) => {
                      const value = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);

                      if (selectedStaff) {
                        setFormData({ ...formData, passcode: value });
                      } else {
                        setTempPasscode(value);
                      }
                    }}
                    className="form-input pr-10"
                    placeholder="123456"
                    maxLength={6}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPasscode ? (
                      <EyeOff size={16} className="text-stone-400" />
                    ) : (
                      <Eye size={16} className="text-stone-400" />
                    )}
                  </button>
                </div>
              </FormField>

              {!selectedStaff && (
                <FormField label="Confirm 6-digit Passcode *" required>
                  <input
                    type="password"
                    value={formData.passcode || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        passcode: e.target.value.replace(/\D/g, "").slice(0, 6),
                      })
                    }
                    className="form-input"
                    placeholder="123456"
                    maxLength={6}
                    required
                  />
                </FormField>
              )}

              <div className="flex items-center gap-4 md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.mustChangePasscode || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mustChangePasscode: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm">
                    Must change passcode on next login
                  </span>
                </label>
              </div>
            </div>
          </DataPanel>

          <DataPanel title="Personal Details">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              <FormField label="National ID">
                <input
                  type="text"
                  value={formData.personalDetails?.nationalId || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        nationalId: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                  placeholder="At least 5 chars"
                />
              </FormField>
              <FormField label="Date of Birth">
                <input
                  type="date"
                  value={formData.personalDetails?.dateOfBirth || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        dateOfBirth: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <FormField label="Gender">
                <select
                  value={formData.personalDetails?.gender || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        gender: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField label="Marital Status">
                <select
                  value={formData.personalDetails?.maritalStatus || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        maritalStatus: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                >
                  <option value="">Select Status</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </FormField>
              <FormField label="Next of Kin Name">
                <input
                  type="text"
                  value={formData.personalDetails?.nextOfKinName || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        nextOfKinName: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <FormField label="Next of Kin Phone">
                <input
                  type="tel"
                  value={formData.personalDetails?.nextOfKinPhone || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      personalDetails: {
                        ...(prev.personalDetails || {}),
                        nextOfKinPhone: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                  placeholder="+263..."
                />
              </FormField>
            </div>
          </DataPanel>

          <DataPanel title="Address Details">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              <FormField label="Country">
                <input
                  type="text"
                  value={formData.addressDetails?.country || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        country: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <FormField label="Province">
                <input
                  type="text"
                  value={formData.addressDetails?.province || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        province: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <FormField label="City / Town">
                <input
                  type="text"
                  value={formData.addressDetails?.cityTown || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        cityTown: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <FormField label="District">
                <input
                  type="text"
                  value={formData.addressDetails?.district || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        district: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <FormField label="Suburb">
                <input
                  type="text"
                  value={formData.addressDetails?.suburb || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        suburb: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <FormField label="Street Address">
                <input
                  type="text"
                  value={formData.addressDetails?.streetAddress || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressDetails: {
                        ...(prev.addressDetails || {}),
                        streetAddress: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormField label="GPS Notes">
                  <textarea
                    value={formData.addressDetails?.gpsNotes || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        addressDetails: {
                          ...(prev.addressDetails || {}),
                          gpsNotes: e.target.value,
                        },
                      }))
                    }
                    className="form-input min-h-[80px]"
                    placeholder="Directions or landmarks..."
                  />
                </FormField>
              </div>
            </div>
          </DataPanel>

          <DataPanel title="KYC Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <FormField label="ID Type">
                <select
                  value={formData.kycDetails?.idType || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      kycDetails: {
                        ...(prev.kycDetails || {}),
                        idType: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                >
                  <option value="">Select ID Type</option>
                  <option value="National ID">National ID</option>
                  <option value="Passport">Passport</option>
                  <option value="Driver's License">Driver's License</option>
                </select>
              </FormField>
              <FormField label="ID Number">
                <input
                  type="text"
                  value={formData.kycDetails?.idNumber || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      kycDetails: {
                        ...(prev.kycDetails || {}),
                        idNumber: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                />
              </FormField>
              <FormField label="KYC Status">
                <select
                  value={formData.kycDetails?.kycStatus || "not_started"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      kycDetails: {
                        ...(prev.kycDetails || {}),
                        kycStatus: e.target.value as any,
                      },
                    }))
                  }
                  className="form-input font-bold"
                >
                  <option value="not_started">Not Started</option>
                  <option value="pending">Pending Verification</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </FormField>
              <div className="md:col-span-2">
                <FormField label="KYC Notes">
                  <textarea
                    value={formData.kycDetails?.notes || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        kycDetails: {
                          ...(prev.kycDetails || {}),
                          notes: e.target.value,
                        },
                      }))
                    }
                    className="form-input min-h-[80px]"
                  />
                </FormField>
              </div>
            </div>
          </DataPanel>

          <DataPanel title="KYC Documents">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              <FormField label="ID Document URL">
                <input
                  type="text"
                  value={formData.kycDocuments?.idDocumentUrl || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      kycDocuments: {
                        ...(prev.kycDocuments || {}),
                        idDocumentUrl: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                  placeholder="Link to ID scan"
                />
              </FormField>
              <FormField label="Proof of Residence URL">
                <input
                  type="text"
                  value={formData.kycDocuments?.proofOfResidenceUrl || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      kycDocuments: {
                        ...(prev.kycDocuments || {}),
                        proofOfResidenceUrl: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                  placeholder="Link to utility bill"
                />
              </FormField>
              <FormField label="Staff Photo URL">
                <input
                  type="text"
                  value={formData.kycDocuments?.photoUrl || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      kycDocuments: {
                        ...(prev.kycDocuments || {}),
                        photoUrl: e.target.value,
                      },
                    }))
                  }
                  className="form-input"
                  placeholder="Link to portrait"
                />
              </FormField>
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === "directory" && view === "permissions" && (
        <div className="space-y-8">
          <div className="flex justify-between items-center bg-stone-900 text-white p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest">
              {permissionService.canEditRolePermissions()
                ? "Edit Staff Permissions"
                : "View Staff Permissions"}{" "}
              - {selectedStaff?.displayName}
            </h3>

            <div className="flex gap-3">
              <SecondaryButton
                onClick={() => setView("list")}
                className="text-white border-white/20"
              >
                Cancel
              </SecondaryButton>

              {permissionService.canEditRolePermissions() && (
                <PrimaryButton
                  onClick={async () => {
                    if (!permissionService.canEditRolePermissions()) {
                      alert(
                        "You do not have permission to edit role permissions.",
                      );
                      return;
                    }
                    if (selectedStaff) {
                      try {
                        await staffService.saveStaff({
                          ...selectedStaff,
                          menuPermissions: formData.menuPermissions,
                          actionPermissions: formData.actionPermissions,
                          updatedAt: new Date().toISOString(),
                          updatedBy: "SysAdmin",
                        });

                        analyticsService.logEvent({
                          eventType: "STAFF_PERMISSIONS_UPDATED",
                          actorType: "admin",
                          actorName: "SysAdmin",
                          actorId: selectedStaff.id,
                          result: "updated",
                          details: { staffId: selectedStaff.id },
                        });

                        // Non-blocking staff audit logging
                        try {
                          void staffAuditService.logAction({
                            eventType: "PERMISSION_CHANGED",
                            module: "staff",
                            action: "Updated role/menu/action permissions",
                            severity: "critical",
                            recordType: "staff",
                            recordId: selectedStaff.id,
                            recordName: selectedStaff.displayName,
                            beforeSnapshot: {
                              menuPermissions: selectedStaff.menuPermissions,
                              actionPermissions:
                                selectedStaff.actionPermissions,
                            },
                            afterSnapshot: {
                              menuPermissions: formData.menuPermissions,
                              actionPermissions: formData.actionPermissions,
                            },
                          });
                        } catch (auditErr) {
                          console.error("Audit log failed", auditErr);
                        }

                        window.setTimeout(() => {
                          void loadStaff();
                          void loadLogs();
                        }, 800);

                        setView("list");
                        focusMainContent();
                        setFormSuccess("Staff saved to Firebase/local cache");
                        setTimeout(() => setFormSuccess(""), 3000);
                      } catch (error) {
                        console.error("Failed to save permissions.", error);
                        setFormError(
                          "Failed to save staff profile to Firebase. Check console for details.",
                        );
                      }
                    }
                  }}
                >
                  Save Permissions
                </PrimaryButton>
              )}
            </div>
          </div>

          {!permissionService.canEditRolePermissions() && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm mt-4 mx-6">
              You can view staff permissions, but you do not have authority to
              edit them.
            </div>
          )}

          <DataPanel title="Menu Permissions">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MENU_KEYS.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 border border-stone-200 rounded-none"
                >
                  <span className="text-sm font-medium">
                    {PERMISSIONS.find((p) => p.id === key)?.label || key}
                  </span>

                  <select
                    value={formData.menuPermissions?.[key] || "hidden"}
                    onChange={(e) =>
                      handlePermissionChange(
                        key,
                        e.target.value as PermissionLevel,
                      )
                    }
                    disabled={!permissionService.canEditRolePermissions()}
                    className="text-xs border border-stone-200 rounded-none px-2 py-1"
                  >
                    <option value="hidden">Hidden</option>
                    <option value="view">View</option>
                    <option value="create">Create</option>
                    <option value="submit">Submit</option>
                    <option value="edit">Edit</option>
                    <option value="approve">Approve</option>
                    <option value="delete">Delete</option>
                    <option value="export">Export</option>
                    <option value="full">Full</option>
                  </select>
                </div>
              ))}
            </div>
          </DataPanel>
          <DataPanel title="Action Permissions & Approval Rights">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ACTION_GROUPS.map((group) => (
                <div key={group.name} className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-brand-orange border-b border-stone-100 pb-2">
                    {group.name}
                  </h4>
                  {group.keys.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="accent-brand-orange"
                        checked={
                          !!formData.actionPermissions?.[
                            key as ActionPermissionKey
                          ]
                        }
                        onChange={(e) =>
                          handleActionPermissionChange(
                            key as ActionPermissionKey,
                            e.target.checked,
                          )
                        }
                        disabled={!permissionService.canEditRolePermissions()}
                      />
                      {key.split(".")[1]}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </DataPanel>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-6">
          <DataPanel title="Security Settings">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Failed Login Limit">
                  <input
                    type="number"
                    defaultValue={5}
                    className="form-input"
                    min="1"
                    max="10"
                  />
                </FormField>

                <FormField label="Passcode Length">
                  <input
                    type="number"
                    defaultValue={6}
                    className="form-input"
                    disabled
                  />
                </FormField>

                <FormField label="Session Timeout (minutes)">
                  <input
                    type="number"
                    defaultValue={480}
                    className="form-input"
                    min="60"
                    max="1440"
                  />
                </FormField>

                <FormField label="Default Role for New Staff">
                  <select className="form-input">
                    {Object.keys(localRoleTemplates).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Default Desk for New Staff">
                  <select className="form-input">
                    <option value="Backoffice Desk">Backoffice Desk</option>
                    <option value="Product Data Desk">Product Data Desk</option>
                    <option value="Catalogue Deployment Desk">
                      Catalogue Deployment Desk
                    </option>
                    <option value="Collections Desk">Collections Desk</option>
                    <option value="RPN Management Desk">
                      RPN Management Desk
                    </option>
                    <option value="CAH Operations Desk">
                      CAH Operations Desk
                    </option>
                    <option value="BI & Analytics Desk">
                      BI & Analytics Desk
                    </option>
                    <option value="Viewer Desk">Viewer Desk</option>
                  </select>
                </FormField>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked />
                    <span className="text-sm">Require numbers only</span>
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked />
                    <span className="text-sm">
                      Require passcode change after reset
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" />
                    <span className="text-sm">
                      Allow first SysAdmin setup mode
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" />
                    <span className="text-sm">Privacy mode for reports</span>
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" />
                    <span className="text-sm">
                      Show phone numbers in admin-only views
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <PrimaryButton>Save Settings</PrimaryButton>
                <SecondaryButton>Reset to Defaults</SecondaryButton>
              </div>
            </div>
          </DataPanel>
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={confirmConfig?.title || ""}
        message={confirmConfig?.message || ""}
        variant={confirmConfig?.variant}
        onConfirm={() => {
          confirmConfig?.action();
          setIsConfirmOpen(false);
        }}
        onCancel={closeAllModals}
      />

      <ConfirmDialog
        isOpen={isPasscodeModalOpen}
        title={
          passcodeModalConfig?.isOverride
            ? "Override Passcode"
            : "Reset Passcode (Force Change)"
        }
        message={`Enter new 6-digit passcode for ${passcodeModalConfig?.staff.displayName}:`}
        variant="warning"
        onConfirm={() => {
          if (tempPasscode !== confirmTempPasscode) {
            alert("Passcodes do not match.");
            return;
          }

          if (passcodeModalConfig) {
            handlePasscodeAction(
              passcodeModalConfig.staff,
              tempPasscode,
              passcodeModalConfig.isOverride,
            );
          }
        }}
        onCancel={closeAllModals}
      >
        <div className="mt-4 space-y-4">
          <input
            type="password"
            value={tempPasscode}
            onChange={(e) =>
              setTempPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="New 6-digit Passcode"
            className="form-input w-full"
            maxLength={6}
            required
            autoFocus
          />

          <input
            type="password"
            value={confirmTempPasscode}
            onChange={(e) =>
              setConfirmTempPasscode(
                e.target.value.replace(/\D/g, "").slice(0, 6),
              )
            }
            placeholder="Confirm 6-digit Passcode"
            className="form-input w-full"
            maxLength={6}
            required
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={isApplyRoleModalOpen}
        title={`Apply Template: ${applyRoleConfig?.role}`}
        message={`This will update the permissions of all staff members currently assigned to the "${applyRoleConfig?.role}" role. Existing individual overrides will be replaced.`}
        variant="warning"
        onConfirm={async () => {
          if (applyRoleConfig) {
            const staffToUpdate = staffList.filter(
              (s) => s.role === applyRoleConfig.role,
            );
            if (staffToUpdate.length > 0) {
              try {
                for (const staff of staffToUpdate) {
                  await staffService.saveStaff({
                    ...staff,
                    menuPermissions:
                      localRoleTemplates[applyRoleConfig.role]
                        ?.menuPermissions || {},
                    actionPermissions:
                      localRoleTemplates[applyRoleConfig.role]
                        ?.actionPermissions || {},
                    updatedAt: new Date().toISOString(),
                    updatedBy: "SysAdmin",
                  });
                }

                analyticsService.logEvent({
                  eventType: "STAFF_PERMISSIONS_UPDATED",
                  actorType: "admin",
                  actorName: "SysAdmin",
                  result: "updated",
                  details: {
                    appliedRoleTemplate: applyRoleConfig.role,
                    affectedCount: staffToUpdate.length,
                  },
                });

                setStaffList(asArray<Staff>(staffService.getAllStaff()));

                window.setTimeout(() => {
                  void loadStaff();
                  void loadLogs();
                }, 800);

                setIsApplyRoleModalOpen(false);
                setFormSuccess(
                  `Template applied to ${staffToUpdate.length} staff members.`,
                );
                setTimeout(() => setFormSuccess(""), 3000);
              } catch (error) {
                console.error("Failed to apply role.", error);
                alert(
                  "Failed to save staff profile to Firebase. Check console for details.",
                );
              }
            } else {
              alert("No staff found with this role.");
            }
          }
        }}
        onCancel={closeAllModals}
      >
        <div className="mt-4 p-3 bg-orange-50 border border-brand-orange text-brand-orange text-xs font-bold uppercase tracking-wide">
          Affected Staff:{" "}
          {staffList.filter((s) => s.role === applyRoleConfig?.role).length}
        </div>
      </ConfirmDialog>
    </div>
  );
};
