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
} from "../types.ts";

const SESSION_KEY = "activeStaffSession";

export const permissionService = {
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
      return session.role === "Admin" || session.role === "SysAdmin";
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

  canAssignTask: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("staffTasks.assign");
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
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("roles.viewPermissions");
  },

  canEditRolePermissions: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("roles.editPermissions");
  },

  canCreateRoleTemplate: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("roles.createRoleTemplate");
  },

  canDeleteRoleTemplate: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("roles.deleteRoleTemplate");
  },

  canAssignRoleToStaff: (): boolean => {
    if (permissionService.isSysAdmin()) return true;
    return permissionService.hasActionPermission("roles.assignRoleToStaff");
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
