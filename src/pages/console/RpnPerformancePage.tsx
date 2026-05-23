import React from "react";
import { BiConsolePage } from "./BiConsoleShared.tsx";

export const RpnPerformancePage: React.FC = () => (
  <BiConsolePage
    title="RPN Performance"
    subtitle="Review RPN vendor assignment signals and related commercial activity."
    focus="rpn"
    defaultReportType="rpn_performance"
  />
);
