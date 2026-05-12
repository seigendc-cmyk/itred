/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PageHeader, DataPanel } from "../components/CommonUI.tsx";

export const SystemSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        subtitle="Configure system-wide settings and preferences"
      />

      <DataPanel title="System Configuration">
        <div className="text-center py-8 text-stone-500">
          <p>System settings and configuration options</p>
          <p className="text-sm mt-2">Coming soon...</p>
        </div>
      </DataPanel>
    </div>
  );
};
