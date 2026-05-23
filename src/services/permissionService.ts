/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MenuKey,
  MenuPermissions,
  Staff,
  ActionPermissionKey,
  ActionPermissions,
  PermissionLevel,
} from "../types.ts";

const SESSION_KEY = "activeStaffSession";

const normalizeRole = (role?: string | null): string =>
  (role || "").trim().toLowerCase().replace(/\s+/g, " ");

const ROLE_RANKS: Record<string, number> = {
  sysadmin: 1,
  "super admin": 1,
  superadmin: 1,
  admin: 2,
  manager: 3,
  "desk manager": 3,
  "backoffice operator": 4,
  "cah officer": 5,
  "product data clerk": 6,
  "catalogue deployment clerk": 7,
  "catalogue officer": 7,
  "collections clerk": 8,
  "collections officer": 8,
  "rpn manager": 9,
  rpn: 10,
  "field agent": 10,
  viewer: 11,
  "junior staff": 11,
};

const MENU_LEVEL_RANK: Record<string, number> = {
  hidden: 0,
  view: 1,
  create: 2,
  submit: 2,
  edit: 3,
  approve: 4,
  delete: 5,
  export: 5,
  full: 6,
};

const CRITICAL_MENU_PERMISSIONS: MenuKey[] = [
  "roleMenuPermissions",
  "staffManagement",
  "systemSettings",
];

const CRITICAL_ACTION_PERMISSIONS: ActionPermissionKey[] = [
  "roles.editPermissions",
  "staff.editPermissions",
  "staff.manage",
  "system.settings.edit",
];

const getRoleRank = (role?: string | null): number => {
  const normalized = normalizeRole(role);
  return ROLE_RANKS[normalized] || 99;
};

const isTopSysAdminRole = (role?: string | null): boolean =>
  getRoleRank(role) === 1;

const isAdminRole = (role?: string | null): boolean => getRoleRank(role) === 2;

const hasActionPermissionFromStaff = (
  staff: Partial<Staff> | null | undefined,
  key: ActionPermissionKey,
): boolean => !!staff?.actionPermissions?.[key];

const getMenuLevelRank = (level?: string | null): number =>
  MENU_LEVEL_RANK[level || "hidden"] || 0;

const isSameStaff = (
  currentStaff?: Partial<Staff> | null,
  targetStaff?: Partial<Staff> | null,
): boolean => {
  if (!currentStaff || !targetStaff) return false;
  const currentIds = [
    currentStaff.id,
    currentStaff.staffCode,
    (currentStaff as any).staffId,
  ].filter(Boolean);
  const targetIds = [
    targetStaff.id,
    targetStaff.staffCode,
    (targetStaff as any).staffId,
  ].filter(Boolean);
  return currentIds.some((id) => targetIds.includes(id));
};

export const protectCriticalPermissions = (
  role: string | undefined,
  menuPermissions: MenuPermissions = {},
  actionPermissions: ActionPermissions = {},
) => {
  const protectedMenu = { ...menuPermissions };
  const protectedActions = { ...actionPermissions };

  if (isTopSysAdminRole(role)) {
    CRITICAL_MENU_PERMISSIONS.forEach((key) => {
      protectedMenu[key] = "full";
    });
    CRITICAL_ACTION_PERMISSIONS.forEach((key) => {
      protectedActions[key] = true;
    });
  }

  return {
    menuPermissions: protectedMenu,
    actionPermissions: protectedActions,
  };
};

const getChangedKeys = <T extends Record<string, unknown>>(
  before: T = {} as T,
  after: T = {} as T,
): string[] => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys).filter((key) => before[key] !== after[key]);
};

export const permissionService = {
  getCurrentStaff: (): Partial<Staff> | null => {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;
    try {
      const session = JSON.parse(sessionStr);
      if (!session || typeof session !== "object") return null;
      const staffRecords = JSON.parse(
        localStorage.getItem("itred_staff_records") || "[]",
      );
      const matchedStaff = Array.isArray(staffRecords)
        ? staffRecords.find(
            (staff: Staff) =>
              staff.id === session.id ||
              staff.id === session.staffId ||
              staff.staffCode === session.staffCode,
          )
        : null;
      return matchedStaff ? { ...matchedStaff, ...session } : session;
    } catch (e) {
      return null;
    }
  },

  getPermissions: (): MenuPermissions => {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return {};
    try {
      const session = JSON.parse(sessionStr);
      return session.menuPermissions || {}; // Ensure this is always an object
    } catch (e) {
      return {};
    }
  },

  getActionPermissions: (): ActionPermissions => {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return {};
    try {
      const session = JSON.parse(sessionStr);
      return session.actionPermissions || {};
    } catch (e) {
      return {};
    }
  },

  isSysAdmin: (): boolean => {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return false;
    try {
      const session = JSON.parse(sessionStr);
      return (
        session.role === "Admin" ||
        session.role === "SysAdmin" ||
        session.role === "Super Admin" ||
        session.role === "SuperAdmin"
      );
    } catch (e) {
      return false;
    }
  },

  hasMenuAccess: (menuKey: MenuKey): boolean => {
    if (permissionService.isSysAdmin()) return true;
    const level = permissionService.getPermissions()[menuKey];
    return level !== undefined && level !== "hidden" && level !== null;
  },

  canView: (menuKey: MenuKey): boolean => {
    if (permissionService.isSysAdmin()) return true;
    const level = permissionService.getPermissions()[menuKey];
    return (
      level === "view" ||
      level === "create" ||
      level === "edit" ||
      level === "approve" ||
      level === "delete" ||
      level === "export" ||
      level === "full"
    );
  },

  canCreate: (menuKey: MenuKey): boolean => {
    if (permissionService.isSysAdmin()) return true;
    const level = permissionService.getPermissions()[menuKey];
    return (
      level === "create" ||
      level === "edit" ||
      level === "full" ||
      level === "approve" ||
      level === "delete"
    );
  },

  canEdit: (menuKey: MenuKey): boolean => {
    if (permissionService.isSysAdmin()) return true;
    const level = permissionService.getPermissions()[menuKey];
    return (
      level === "edit" ||
      level === "full" ||
      level === "approve" ||
      level === "delete"
    );
  },

  hasActionPermission: (key: ActionPermissionKey): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return !!permissionService.getActionPermissions()[key];
  },

  canSubmitApproval: (module: string): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission(
      `${module}.submitApproval` as ActionPermissionKey,
    );
  },

  canApprove: (moduleOrMenuKey: MenuKey | string): boolean => {
    if (permissionService.isSysAdmin()) return true;
    if (moduleOrMenuKey === "catalogue")
      return permissionService.hasActionPermission("catalogue.approveDeploy");
    if (moduleOrMenuKey === "cah")
      return permissionService.hasActionPermission("cah.approveLink");
    if (
      ["vendor", "product", "pricing", "approvalQueue"].includes(
        moduleOrMenuKey as string,
      )
    ) {
      return permissionService.hasActionPermission(
        `${moduleOrMenuKey}.approve` as ActionPermissionKey,
      );
    }
    const level =
      permissionService.getPermissions()[moduleOrMenuKey as MenuKey];
    return level === "approve" || level === "full"; // Only approve or full
  },

  canPublish: (module: string): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission(
      `${module}.publish` as ActionPermissionKey,
    );
  },

  canDelete: (moduleOrMenuKey: MenuKey | string): boolean => {
    if (permissionService.isSysAdmin()) return true;
    if (["vendor", "product"].includes(moduleOrMenuKey as string)) {
      return permissionService.hasActionPermission(
        `${moduleOrMenuKey}.delete` as ActionPermissionKey,
      );
    }
    const level =
      permissionService.getPermissions()[moduleOrMenuKey as MenuKey];
    return level === "delete" || level === "full"; // Only delete or full
  },

  canResolveNotification: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("notifications.resolve");
  },

  canViewNotifications: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("notifications.view") ||
      permissionService.hasActionPermission("notifications.viewOwn") ||
      permissionService.hasMenuAccess("notifications")
    );
  },

  canViewAllNotifications: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("notifications.viewAll") ||
      permissionService.hasActionPermission("notifications.viewTeam")
    );
  },

  canMarkNotificationRead: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("notifications.markRead") ||
      permissionService.hasActionPermission("notifications.viewOwn") ||
      permissionService.hasMenuAccess("notifications")
    );
  },

  canArchiveNotification: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("notifications.archive");
  },

  canManageIntelAlerts: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("whatsapp.alerts.manage");
  },

  canViewVendorReputation: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("whatsapp.vendorReputation.view") ||
      permissionService.canView("whatsappActivity")
    );
  },

  canAssignTask: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffTasks.assign");
  },

  canEditRpnProspects: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpnProspects.edit");
  },

  canMoveRpnPipelineStage: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("rpnPipeline.moveStage") ||
      permissionService.hasActionPermission("rpnPipeline.managerOverride")
    );
  },

  canViewStaffTasks: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("staffTasks.view") ||
      permissionService.hasActionPermission("staffTasks.viewOwn") ||
      permissionService.hasMenuAccess("staffTasks")
    );
  },

  canCreateStaffTask: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("staffTasks.create") ||
      permissionService.hasActionPermission("staffTasks.assign")
    );
  },

  canUpdateStaffTaskStatus: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("staffTasks.updateStatus") ||
      permissionService.hasActionPermission("staffTasks.complete")
    );
  },

  canReviewStaffTask: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffTasks.review");
  },

  canCancelStaffTask: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffTasks.cancel");
  },

  canViewStaffChat: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffChat.view");
  },

  canSendDirectStaffChat: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffChat.sendDirect");
  },

  canSendGroupStaffChat: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffChat.sendGroup");
  },

  canAssignStaffChatTask: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffChat.assignTask");
  },

  canMonitorStaffChat: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffChat.monitor");
  },

  canDeleteStaffChatMessage: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffChat.deleteMessage");
  },

  canSetRpnThresholds: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.setThresholds");
  },

  canViewRpnPerformance: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.viewPerformance");
  },

  canViewRpnFinancials: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.viewFinancials");
  },

  canAssignVendorToRpn: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.assignVendor");
  },

  canViewRpnAgents: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.viewAgents");
  },

  canCreateRpnAgent: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.createAgent");
  },

  canEditRpnAgent: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.editAgent");
  },

  canSuspendRpnAgent: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.suspendAgent");
  },

  canDeleteRpnAgent: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("rpn.deleteAgent");
  },

  canEditStaffKycDetails: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staff.editKycDetails");
  },

  canViewRolePermissions: (): boolean => {
    const actor = permissionService.getCurrentStaff();
    if (isTopSysAdminRole(actor?.role)) return true;
    return hasActionPermissionFromStaff(actor, "roles.viewPermissions");
  },

  canEditRolePermissions: (
    currentStaff?: Partial<Staff> | null,
    targetRole?: string | null,
  ): boolean => {
    const actor = currentStaff || permissionService.getCurrentStaff();
    if (!targetRole) {
      if (isTopSysAdminRole(actor?.role)) return true;
      return hasActionPermissionFromStaff(actor, "roles.editPermissions");
    }

    const actorRank = getRoleRank(actor?.role);
    const targetRank = getRoleRank(targetRole);

    if (isTopSysAdminRole(targetRole)) {
      return isTopSysAdminRole(actor?.role);
    }

    if (isTopSysAdminRole(actor?.role)) {
      return targetRank > actorRank;
    }

    if (
      isAdminRole(actor?.role) &&
      hasActionPermissionFromStaff(actor, "roles.editPermissions")
    ) {
      return targetRank > actorRank;
    }

    return false;
  },

  canEditStaffPermissions: (
    currentStaff?: Partial<Staff> | null,
    targetStaff?: Partial<Staff> | null,
  ): boolean => {
    const actor = currentStaff || permissionService.getCurrentStaff();
    if (!targetStaff?.role) return false;
    if (isSameStaff(actor, targetStaff) && !isTopSysAdminRole(actor?.role)) {
      return false;
    }
    return permissionService.canEditRolePermissions(actor, targetStaff.role);
  },

  canGrantMenuPermission: (
    currentStaff: Partial<Staff> | null | undefined,
    menuKey: MenuKey,
    level: PermissionLevel,
  ): boolean => {
    if (isTopSysAdminRole(currentStaff?.role)) return true;
    const actorLevel = currentStaff?.menuPermissions?.[menuKey] || "hidden";
    return getMenuLevelRank(actorLevel) >= getMenuLevelRank(level);
  },

  canGrantActionPermission: (
    currentStaff: Partial<Staff> | null | undefined,
    key: ActionPermissionKey,
  ): boolean => {
    if (isTopSysAdminRole(currentStaff?.role)) return true;
    return hasActionPermissionFromStaff(currentStaff, key);
  },

  filterGrantablePermissions: (
    currentStaff: Partial<Staff> | null | undefined,
    menuPermissions: MenuPermissions = {},
    actionPermissions: ActionPermissions = {},
  ) => {
    if (isTopSysAdminRole(currentStaff?.role)) {
      return { menuPermissions, actionPermissions };
    }

    const filteredMenu = { ...menuPermissions };
    Object.entries(filteredMenu).forEach(([key, level]) => {
      if (
        !permissionService.canGrantMenuPermission(
          currentStaff,
          key as MenuKey,
          level as PermissionLevel,
        )
      ) {
        filteredMenu[key as MenuKey] =
          currentStaff?.menuPermissions?.[key as MenuKey] || "hidden";
      }
    });

    const filteredActions = { ...actionPermissions };
    Object.entries(filteredActions).forEach(([key, enabled]) => {
      if (
        enabled &&
        !permissionService.canGrantActionPermission(
          currentStaff,
          key as ActionPermissionKey,
        )
      ) {
        filteredActions[key as ActionPermissionKey] = false;
      }
    });

    return {
      menuPermissions: filteredMenu,
      actionPermissions: filteredActions,
    };
  },

  protectCriticalPermissions,

  getChangedPermissionKeys: getChangedKeys,

  canCreateRoleTemplate: (): boolean => {
    const actor = permissionService.getCurrentStaff();
    if (isTopSysAdminRole(actor?.role)) return true;
    return hasActionPermissionFromStaff(actor, "roles.createRoleTemplate");
  },

  canDeleteRoleTemplate: (): boolean => {
    const actor = permissionService.getCurrentStaff();
    if (isTopSysAdminRole(actor?.role)) return true;
    return hasActionPermissionFromStaff(actor, "roles.deleteRoleTemplate");
  },

  canAssignRoleToStaff: (): boolean => {
    const actor = permissionService.getCurrentStaff();
    if (isTopSysAdminRole(actor?.role)) return true;
    return hasActionPermissionFromStaff(actor, "roles.assignRoleToStaff");
  },

  canOverridePasscode: (menuKey: MenuKey): boolean => {
    if (permissionService.isSysAdmin()) return true; // Only SysAdmin can override passcodes
    const level = permissionService.getPermissions()[menuKey];
    return level === "full"; // Only full access (SysAdmin) can override
  },

  canExport: (menuKey: MenuKey): boolean => {
    if (permissionService.isSysAdmin()) return true;
    const level = permissionService.getPermissions()[menuKey];
    return level === "export" || level === "full";
  },

  canViewApprovalQueue: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("approvalQueue.view") ||
      permissionService.hasMenuAccess("approvalQueue")
    );
  },

  canApproveWork: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("approvalQueue.approve");
  },

  canRejectWork: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("approvalQueue.reject");
  },

  canReturnWorkForCorrection: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission(
      "approvalQueue.returnForCorrection",
    );
  },

  canViewOwnNotifications: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("notifications.viewOwn");
  },

  canViewTeamNotifications: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("notifications.viewTeam");
  },

  canViewStaffAuditLogs: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffAudit.view");
  },

  canViewAllStaffAuditLogs: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffAudit.viewAll");
  },

  canViewFinance: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("finance.view") ||
      permissionService.hasMenuAccess("financeDesk")
    );
  },

  canManageFinanceSettings: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("finance.settings.manage");
  },

  canManageChartOfAccounts: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("finance.coa.manage");
  },

  canManageCashBankAccounts: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission(
      "finance.cashBankAccounts.manage",
    );
  },

  canViewFinanceLedger: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("finance.ledger.view") ||
      permissionService.hasMenuAccess("cashBankManager")
    );
  },

  canCreateFinanceTransaction: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("finance.transaction.create");
  },

  canViewFinanceReports: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return (
      permissionService.hasActionPermission("finance.reports.view") ||
      permissionService.hasMenuAccess("financeReports")
    );
  },

  canPrintFinanceReports: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("finance.reports.print");
  },

  canDownloadFinanceReportPdf: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("finance.reports.downloadPdf");
  },

  canExportFinanceReportCsv: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("finance.reports.exportCsv");
  },

  canApproveFinanceReportPrint: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission(
      "finance.reports.approvePrint",
    );
  },

  canViewSensitiveFinanceReports: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission(
      "finance.reports.viewSensitive",
    );
  },

  canUseAction: (
    menuKey: MenuKey,
    action: "view" | "create" | "edit" | "approve" | "delete" | "export",
  ): boolean => {
    if (permissionService.isSysAdmin()) return true;
    const funcMap: Record<string, (k: MenuKey) => boolean> = {
      view: permissionService.canView,
      create: permissionService.canCreate,
      edit: permissionService.canEdit,
      approve: permissionService.canApprove,
      delete: permissionService.canDelete,
      export: permissionService.canExport,
    };
    return funcMap[action] ? funcMap[action](menuKey) : false;
  },
};
