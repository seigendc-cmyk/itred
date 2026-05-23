import React from "react";
import { BiConsolePage } from "./BiConsoleShared.tsx";

export const BiOverviewPage: React.FC = () => (
  <BiConsolePage
    title="BI Overview"
    subtitle="Unified catalogue, product, WhatsApp, order, subscription, and RPN assignment signals."
    focus="overview"
    defaultReportType="management_weekly"
  />
);
