/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  PageHeader,
  DataPanel,
  PrimaryButton,
} from "../components/CommonUI.tsx";
import { Shield } from "lucide-react";
import { permissionService } from "../services/permissionService.ts";

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
  const canEdit = permissionService.canEditRolePermissions();
  const canView =
    permissionService.canViewRolePermissions() ||
    permissionService.hasMenuAccess("roleMenuPermissions");

  if (!canView) {
    return (
      <div className="p-8 text-center text-stone-500">Access Restricted</div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role & Menu Permissions"
        subtitle="Configure role-based access control and menu permissions"
      />

      {!canEdit && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          You can view role permissions, but you do not have authority to edit
          them.
        </div>
      )}

      <DataPanel title="Permission Management">
        <div className="text-center py-8 text-stone-500">
          <Shield size={48} className="mx-auto mb-4 text-stone-300" />
          <p className="text-sm font-bold uppercase tracking-widest text-brand-charcoal">
            Role Template Manager
          </p>
          <p className="text-xs mt-2 max-w-md mx-auto">
            Full configuration interface for menu visibility, junior staff
            workflows, and manager approval queues is now actively managed
            through the Staff Management module.
          </p>
          <PrimaryButton
            onClick={() => (window.location.href = "/staff-management")}
            className="mt-6"
          >
            Open Staff Management
          </PrimaryButton>
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
                  className="flex items-center gap-2 text-xs text-stone-600"
                >
                  <input
                    type="checkbox"
                    className="accent-brand-orange"
                    disabled
                    checked
                  />
                  {key.split(".")[1]}
                </label>
              ))}
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
};
