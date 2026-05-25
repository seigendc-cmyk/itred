/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  PageHeader,
  DataPanel,
} from "../components/CommonUI.tsx";
import { Shield } from "lucide-react";
import { permissionService } from "../services/permissionService.ts";
import { ROLE_TEMPLATES } from "../services/staffService.ts";
import { getSession } from "../utils/session.ts";
import { ActionPermissions, MenuPermissions } from "../types.ts";

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
    name: "Plans & Prices",
    keys: ["pricing.view", "pricing.submitApproval", "pricing.approve"],
  },
  {
    name: "Notifications",
    keys: [
      "notifications.view",
      "notifications.markRead",
      "notifications.resolve",
      "notifications.archive",
      "notifications.viewAll",
      "notifications.viewOwn",
      "notifications.viewTeam",
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
];

export const RoleMenuPermissions: React.FC = () => {
  const canView =
    permissionService.canViewRolePermissions() ||
    permissionService.hasMenuAccess("roleMenuPermissions");
  const session = getSession();
  const currentStaff = permissionService.getCurrentStaff();
  const currentRole = session?.role || "Unassigned";
  const rawCurrentRoleTemplate =
    currentRole !== "Unassigned" ? ROLE_TEMPLATES[currentRole] || {} : {};
  const currentRoleTemplate = (
    "menuPermissions" in rawCurrentRoleTemplate
      ? (rawCurrentRoleTemplate as any).menuPermissions
      : rawCurrentRoleTemplate
  ) as MenuPermissions;
  const roleSummaries = Object.entries(ROLE_TEMPLATES).map(
    ([role, template]) => {
      const normalizedTemplate = (
        "menuPermissions" in template
          ? (template as any).menuPermissions
          : template
      ) as MenuPermissions;
      const actionPermissions = (
        "actionPermissions" in template ? (template as any).actionPermissions : {}
      ) as ActionPermissions;
      const canEdit = permissionService.canEditRolePermissions(
        currentStaff,
        role,
      );
      return { role, normalizedTemplate, actionPermissions, canEdit };
    },
  );

  if (!canView) {
    return (
      <div className="p-8 text-center text-stone-500">Access Restricted</div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role & Menu Permissions"
        subtitle="Operational summary of role menu access, action permissions, and edit authority"
      />

      <div className="p-4 bg-orange-50 border border-orange-200 text-brand-charcoal text-sm">
        <p className="font-bold uppercase text-xs tracking-widest text-brand-orange">
          Role permissions are managed from Staff Management.
        </p>
        <p className="mt-1">
          This page shows which role templates your session can edit. Use Staff
          Management to make changes.
        </p>
      </div>

      <DataPanel title="Role Edit Authority">
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {roleSummaries.map(({ role, canEdit }) => (
            <div
              key={role}
              className="border border-stone-200 bg-white p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-charcoal truncate">
                  {role}
                </p>
                {!canEdit && (
                  <p className="text-xs text-stone-500 mt-1">
                    You do not have permission to edit this role.
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  canEdit
                    ? "border-orange-200 bg-orange-50 text-brand-orange"
                    : "border-stone-200 bg-stone-50 text-stone-500"
                }`}
              >
                {canEdit ? "Editable by SysAdmin" : "Read only"}
              </span>
            </div>
          ))}
        </div>
      </DataPanel>

      <DataPanel title="Role Menu Access Summary">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 text-brand-charcoal">
            <Shield size={20} className="text-brand-orange" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Current Role
              </p>
              <p className="text-sm font-bold">{currentRole}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(currentRoleTemplate).map(([menuKey, level]) => (
              <div
                key={menuKey}
                className="border border-stone-200 bg-white p-3"
              >
                <p className="text-xs font-bold text-brand-charcoal">
                  {menuKey}
                </p>
                <p className="text-[10px] uppercase font-black text-brand-orange mt-1">
                  {level}
                </p>
              </div>
            ))}
            {Object.keys(currentRoleTemplate).length === 0 && (
              <p className="text-sm text-stone-500">No menu access assigned.</p>
            )}
          </div>
        </div>
      </DataPanel>

      <DataPanel title="Current Action Permissions & Approval Rights">
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ACTION_GROUPS.map((group) => (
            <div key={group.name} className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-brand-orange border-b border-stone-100 pb-2">
                {group.name}
              </h4>
              {group.keys.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-xs text-stone-600"
                >
                  <input
                    type="checkbox"
                    className="accent-brand-orange"
                    disabled
                    checked={permissionService.hasActionPermission(key as any)}
                    readOnly
                  />
                  {key}
                </label>
              ))}
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
};
