/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PageHeader, DataPanel } from "../components/CommonUI.tsx";

export const StaffAccessLogs: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Access Logs"
        subtitle="Monitor staff login activities and access patterns"
      />

      <DataPanel title="Access Log Viewer">
        <div className="text-center py-8 text-stone-500">
          <p>Staff access logs and activity monitoring</p>
          <p className="text-sm mt-2">Coming soon...</p>
        </div>
      </DataPanel>
    </div>
  );
};
