/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PageHeader, DataPanel } from "../components/CommonUI.tsx";

export const RoleMenuPermissions: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Role & Menu Permissions"
        subtitle="Configure role-based access control and menu permissions"
      />

      <DataPanel title="Permission Management">
        <div className="text-center py-8 text-stone-500">
          <p>Role and menu permissions configuration interface</p>
          <p className="text-sm mt-2">Coming soon...</p>
        </div>
      </DataPanel>
    </div>
  );
};
