import React from "react";
import { BiConsolePage } from "./BiConsoleShared.tsx";

export const AiReportsPage: React.FC = () => (
  <BiConsolePage
    title="AI Reports"
    subtitle="Generate management narratives and action plans from already-calculated iTredVD analytics."
    focus="ai"
    defaultReportType="management_weekly"
  />
);
