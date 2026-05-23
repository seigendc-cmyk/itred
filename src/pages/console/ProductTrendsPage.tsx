import React from "react";
import { BiConsolePage } from "./BiConsoleShared.tsx";

export const ProductTrendsPage: React.FC = () => (
  <BiConsolePage
    title="Product Trends"
    subtitle="Rank product demand using product clicks, WhatsApp enquiries, catalogue views, and order signals."
    focus="products"
    defaultReportType="product_trends"
  />
);
