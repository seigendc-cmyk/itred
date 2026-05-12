/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MenuKey, MenuPermissions, Staff } from "../types.ts";

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

  canApprove: (menuKey: MenuKey): boolean => {
    if (permissionService.isSysAdmin()) return true;
    const level = permissionService.getPermissions()[menuKey];
    return level === "approve" || level === "full"; // Only approve or full
  },

  canDelete: (menuKey: MenuKey): boolean => {
    if (permissionService.isSysAdmin()) return true;
    const level = permissionService.getPermissions()[menuKey];
    return level === "delete" || level === "full"; // Only delete or full
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
