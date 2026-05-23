import { ManualGuide, ManualTag, TroubleshootingGuide } from "../types/manual.ts";

// TODO: Replace with Firebase CMS when the operations manual becomes editable by managers.
export const manualTags: ManualTag[] = [
  { id: "finance", label: "Finance" },
  { id: "catalogue", label: "Catalogue" },
  { id: "rpn", label: "RPN" },
  { id: "security", label: "Security" },
];

export const manualGuides: ManualGuide[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    summary: "What SCI / iTred is and how the operating console works.",
    tags: ["security", "catalogue", "finance", "rpn"],
  },
  {
    id: "finance-reports",
    title: "Finance Reports & Printing",
    summary: "Controlled finance reports, filters, print/PDF and approvals.",
    tags: ["finance"],
  },
  {
    id: "conduct",
    title: "Staff Conduct Rules",
    summary: "Non-negotiable operating rules for all staff.",
    tags: ["security"],
  },
];

export const troubleshootingGuides: TroubleshootingGuide[] = [
  {
    problem: "No products in catalogue",
    likelyCause: "Not active/published or old file",
    fix: "Activate, publish and regenerate.",
  },
  {
    problem: "No Hub links",
    likelyCause: "Invalid URL or not selected",
    fix: "Fix CAH link and regenerate.",
  },
  {
    problem: "Staff name missing at login",
    likelyCause: "Staff inactive or not saved",
    fix: "Check Staff Management.",
  },
  {
    problem: "Duplicate staff code",
    likelyCause: "Old duplicated data",
    fix: "Run Staff Code Integrity repair.",
  },
  {
    problem: "Cannot print finance report",
    likelyCause: "No permission or approval pending",
    fix: "Request permission or approval.",
  },
  {
    problem: "Asset missing",
    likelyCause: "Asset inactive or filter applied",
    fix: "Clear filters and check status.",
  },
  {
    problem: "Finance account missing",
    likelyCause: "COA not seeded",
    fix: "Seed default COA.",
  },
  {
    problem: "Catalogue old design",
    likelyCause: "Old downloaded file",
    fix: "Export fresh catalogue.",
  },
];

export const staffConductRules = [
  "Do not share passcodes.",
  "Do not create duplicate records.",
  "Do not fake WhatsApp activity.",
  "Do not print finance reports without authority.",
  "Do not issue assets without a custody record.",
  "Do not change permissions without approval.",
  "All sensitive actions are logged.",
];
