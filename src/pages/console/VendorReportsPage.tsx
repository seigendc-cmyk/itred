import React from "react";
import { BiConsolePage } from "./BiConsoleShared.tsx";

export const VendorReportsPage: React.FC = () => (
  <BiConsolePage
    title="Vendor Reports"
    subtitle="Track vendor-level demand, order, subscription, and RPN assignment performance."
    focus="vendors"
    defaultReportType="vendor_advisory"
  />
);
