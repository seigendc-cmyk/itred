/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  ExternalLink,
  Lock,
  FileCode,
  Layers,
  ShoppingBag,
  MessageSquare,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  Terminal,
  ShieldAlert,
  Briefcase,
  Network,
  Wallet,
  Wrench,
  ArrowRight,
  Check,
} from "lucide-react";
import { PageHeader, PrimaryButton, StatusBadge } from "../components/CommonUI";
import { AppRoute, MenuKey } from "../types";
import { permissionService } from "../services/permissionService";
import { useNavigate } from "react-router-dom";

interface HowToGuide {
  id: string;
  title: string;
  category: string;
  module: string;
  route?: string;
  audience: string[];
  summary: string;
  tags: string[];
  steps: string[];
  checks?: string[];
  warnings?: string[];
  commonMistakes?: string[];
  relatedGuides?: string[];
  permissionsNeeded?: string[];
  searchText: string;
}

const safeArray = <T,>(arr: T[] | undefined | null): T[] =>
  Array.isArray(arr) ? arr : [];

const guidesData: Omit<HowToGuide, "searchText">[] = [
  // ==========================================
  // A. Getting Started
  // ==========================================
  {
    id: "gs-1",
    title: "How to use the iTred dashboard",
    category: "Getting Started",
    module: "Command Centre",
    route: "/dashboard",
    audience: ["Admin", "Backoffice", "Staff"],
    summary: "Overview of the main iTred dashboard and its key metrics.",
    tags: ["dashboard", "overview", "metrics", "home"],
    steps: [
      "Navigate to the Dashboard via the Command Centre menu.",
      "Review the executive summary cards at the top for a quick system health check.",
      "Use the recent activity feed to monitor real-time updates.",
      "Click on quick action buttons to jump to common tasks like adding a vendor or logging activity.",
    ],
  },
  {
    id: "gs-2",
    title: "How to understand grouped menus",
    category: "Getting Started",
    module: "System Nav",
    audience: ["Admin", "Backoffice", "Staff"],
    summary:
      "The sidebar menu is organized into operational groups for easier navigation.",
    tags: ["menu", "navigation", "sidebar", "groups"],
    steps: [
      "Locate the left sidebar.",
      "Click a group header (e.g., 'Vendor Operations') to expand it.",
      "Select the specific module (e.g., 'Vendor Management') within the group.",
      "Groups automatically expand if you navigate to a route within them directly.",
    ],
  },
  {
    id: "gs-3",
    title: "How to search inside the app",
    category: "Getting Started",
    module: "Search",
    audience: ["Admin", "Backoffice", "Staff"],
    summary: "Using local search bars effectively.",
    tags: ["search", "filter", "find"],
    steps: [
      "Locate the search bar at the top of most tables/panels.",
      "Type multiple keywords in any order (e.g., 'motor spares harare').",
      "The system will filter items that match all words across any field.",
    ],
  },
  {
    id: "gs-4",
    title: "How to know whether a module is restricted by permission",
    category: "Getting Started",
    module: "Security",
    audience: ["Admin", "Backoffice", "Staff"],
    summary: "Identifying what you have access to based on your role.",
    tags: ["permission", "access", "restricted", "role"],
    steps: [
      "If a menu item is missing from your sidebar, your role template has set that module to 'hidden'.",
      "If you try to navigate directly via URL, you will see an 'Access Restricted' screen.",
      "If action buttons (like 'Save' or 'Delete') are greyed out or missing, you only have 'view' permission.",
      "Contact your SysAdmin to request elevated privileges.",
    ],
  },
  // ==========================================
  // B. Vendor Operations
  // ==========================================
  {
    id: "vo-1",
    title: "How to add a vendor",
    category: "Vendor Operations",
    module: "Vendor Management",
    route: "/vendor-management",
    audience: ["Admin", "Backoffice"],
    permissionsNeeded: ["addNewVendor"],
    summary: "Register a new vendor profile in the iTred system.",
    tags: ["vendor", "add", "register", "profile"],
    steps: [
      "Navigate to Vendor Management.",
      "Click the 'Add Vendor' button at the top right.",
      "Fill in the core business details (Name, Sector, Type).",
      "Add contact and location data.",
      "Assign an active Subscription Plan.",
      "Click 'Save Vendor'.",
    ],
  },
  {
    id: "vo-2",
    title: "How to edit vendor profile",
    category: "Vendor Operations",
    module: "Vendor Management",
    route: "/vendor-management",
    audience: ["Admin", "Backoffice"],
    permissionsNeeded: ["vendorManagement"],
    summary:
      "Update an existing vendor's details, branches, or delivery staff.",
    tags: ["vendor", "edit", "update", "profile"],
    steps: [
      "Locate the vendor in the registry table or grid.",
      "Click the 'Edit' (pencil) icon next to their name.",
      "Modify the fields in the form overlay.",
      "To add branches or staff, scroll down to the respective sub-panels within the form.",
      "Click 'Save Vendor'.",
    ],
  },
  {
    id: "vo-3",
    title: "How to approve/suspend vendor",
    category: "Vendor Operations",
    module: "Vendor Management",
    routePath: "/vendor-management",
    audience: ["Admin"],
    permissionsNeeded: ["vendorManagement"],
    summary: "Change a vendor's operational status.",
    tags: ["vendor", "suspend", "approve", "status"],
    steps: [
      "Edit the vendor profile.",
      "Locate the 'Status' dropdown.",
      "Select 'active' to approve, or 'suspended' to pause operations.",
      "Save the profile.",
    ],
    warnings: [
      "Suspending a vendor removes their products from future catalogue builds.",
    ],
  },
  {
    id: "vo-4",
    title: "How to prepare vendor identity for catalogue visibility",
    category: "Vendor Operations",
    module: "Vendor Management",
    route: "/vendor-management",
    audience: ["Admin", "Backoffice"],
    summary: "Ensure vendor details look professional in generated assets.",
    tags: ["vendor", "catalogue", "identity", "brand"],
    steps: [
      "Ensure 'Catalogue Display Name' is short and clean.",
      "Add a catchy 'Catalogue Slogan'.",
      "Provide a valid WhatsApp Number (with country code, no spaces).",
      "Upload a clean Logo if supported by their plan.",
    ],
  },
  {
    id: "vo-5",
    title: "How vendor cards should be checked for completeness",
    category: "Vendor Operations",
    module: "Vendor Management",
    routePath: "/vendor-management",
    audience: ["Backoffice", "Admin"],
    summary: "Audit requirements before deploying a vendor's storefront.",
    tags: ["vendor", "audit", "completeness"],
    steps: [
      "Check that at least one Branch is marked as Default.",
      "Verify the Subscription Plan allows Storefront Generation.",
      "Ensure WhatsApp numbers are formatted correctly.",
      "Ensure there is at least one active product linked to the vendor.",
    ],
  },
  // ==========================================
  // C. Product Operations
  // ==========================================
  {
    id: "po-1",
    title: "How to add a product",
    category: "Product Operations",
    module: "Product Management",
    route: "/product-management",
    audience: ["Admin", "Backoffice", "Product Data Desk"],
    permissionsNeeded: ["addNewProduct"],
    summary: "Add a new SKU/Item to a vendor's inventory buffer.",
    tags: ["product", "add", "sku", "inventory"],
    steps: [
      "Navigate to Product Management.",
      "Click 'Register New SKU'.",
      "Phase 1: Select the parent vendor and branch.",
      "Phase 2: Enter product name, SKU, and brand.",
      "Phase 3: Assign sector and category.",
      "Phase 4: Set price, stock quantity, and minimum alert thresholds.",
      "Phase 5: Upload an optimized image (under 8MB, auto-compressed to <100KB).",
      "Save the product.",
    ],
  },
  {
    id: "po-2",
    title: "How to edit product details",
    category: "Product Operations",
    module: "Product Management",
    route: "/product-management",
    audience: ["Admin", "Backoffice", "Product Data Desk"],
    permissionsNeeded: ["productManagement"],
    summary: "Modify pricing, stock levels, or images for existing items.",
    tags: ["product", "edit", "price", "stock", "update"],
    steps: [
      "Search for the product using the filter bar.",
      "Click the 'Edit' icon.",
      "Modify the necessary fields.",
      "To replace an image, click 'Delete Asset' on the preview, then upload a new one.",
      "Save changes.",
    ],
  },
  {
    id: "po-3",
    title: "How sector/category classification works",
    category: "Product Operations",
    module: "Product Management",
    audience: ["Admin", "Backoffice", "Product Data Desk"],
    summary: "Understanding product taxonomy for catalogue generation.",
    tags: ["product", "sector", "category", "classification"],
    steps: [
      "Products inherit their primary 'Sector' from the vendor profile by default.",
      "'Category' is specific to the product (e.g., Sector: Auto Parts, Category: Brakes).",
      "Global Catalogues are built by filtering for a specific Sector and Category combination.",
      "Ensure spelling is consistent so products group correctly during catalogue compilation.",
    ],
    commonMistakes: [
      "Spelling 'Hardware' as 'Hard ware' causes products to split into two separate catalogues.",
    ],
  },
  {
    id: "po-4",
    title: "How to prepare products for catalogue publishing",
    category: "Product Operations",
    module: "Product Management",
    route: "/product-management",
    audience: ["Admin", "Backoffice", "Product Data Desk"],
    summary: "Final checks before an item goes live.",
    tags: ["product", "publish", "visibility"],
    steps: [
      "Ensure 'Catalogue Visibility' is set to 'Published to Registry' (Eye icon).",
      "Ensure 'Modulation Vector (Status)' is set to 'active'.",
      "Ensure stock quantity is > 0 (unless catalogue settings explicitly allow out-of-stock items).",
    ],
  },
  {
    id: "po-5",
    title: "How product visibility affects customer discovery",
    category: "Product Operations",
    module: "Product Management",
    audience: ["Admin", "Backoffice"],
    summary: "The impact of hiding or suspending a product.",
    tags: ["product", "visibility", "discovery", "hidden"],
    steps: [
      "Hidden/Unpublished products remain in the database but are excluded from HTML generation.",
      "Changing status to 'out_of_stock' usually hides it, depending on the compiler toggles.",
      "If a product is hidden, previous HTML catalogues deployed in the wild will still show it until they expire or are replaced.",
    ],
  },
  // ==========================================
  // D. Catalogue & Storefronts
  // ==========================================
  {
    id: "cs-1",
    title: "How to create a global multi-vendor catalogue",
    category: "Catalogue & Storefronts",
    module: "Create Catalogue",
    route: "/catalogue-generator",
    audience: ["Admin", "Catalogue Deployment Desk"],
    permissionsNeeded: ["createCatalogue"],
    summary:
      "Compile products from multiple vendors into one shared HTML document.",
    tags: ["catalogue", "global", "multi-vendor", "create", "html"],
    steps: [
      "Navigate to Create Catalogue.",
      "Enter the target Sector and Category.",
      "Set expiry period (usually 7 days).",
      "Toggle filters (Active Only, Published Only).",
      "Select the participating vendors from the Vendor List panel.",
      "Select optional CAH distribution links.",
      "Review the checklist for limits/warnings.",
      "Click 'Create Multi-Vendor Catalogue'.",
    ],
  },
  {
    id: "cs-2",
    title: "How to select vendors for a catalogue",
    category: "Catalogue & Storefronts",
    module: "Create Catalogue",
    route: "/catalogue-generator",
    audience: ["Admin", "Catalogue Deployment Desk"],
    summary: "Pick specific vendors to feature in a compilation.",
    tags: ["catalogue", "vendor", "select", "compile"],
    steps: [
      "Scroll to the 'Vendor List' card.",
      "Click a vendor row to select them. A checkmark will appear.",
      "Select as many vendors as desired.",
      "Only products belonging to these selected vendors will be included in the build.",
    ],
    warnings: [
      "Selecting too many vendors may bloat the HTML file size past 12MB, making it hard to share on WhatsApp.",
    ],
  },
  {
    id: "cs-3",
    title: "How to select CAH/WhatsApp links for a catalogue",
    category: "Catalogue & Storefronts",
    module: "Create Catalogue",
    route: "/catalogue-generator",
    audience: ["Admin", "Catalogue Deployment Desk"],
    summary: "Embed community links in the catalogue footer.",
    tags: ["catalogue", "cah", "links", "whatsapp", "footer"],
    steps: [
      "Scroll to the 'WhatsApp Access Hub Links' card.",
      "Click the links you want embedded at the bottom of the catalogue.",
      "When users open the catalogue, they can click these links to join your communities.",
    ],
  },
  {
    id: "cs-4",
    title: "How to generate and download HTML catalogue",
    category: "Catalogue & Storefronts",
    module: "Create Catalogue",
    route: "/catalogue-generator",
    audience: ["Admin", "Catalogue Deployment Desk"],
    permissionsNeeded: ["createCatalogue", "export"],
    summary: "Exporting the final payload.",
    tags: ["catalogue", "generate", "download", "html", "export"],
    steps: [
      "After clicking Generate, wait for the preview frame to load.",
      "Click the 'Download' button in the Success frame.",
      "The file will save as a standard .html document to your device.",
    ],
  },
  {
    id: "cs-5",
    title: "How to mark catalogue as deployed",
    category: "Catalogue & Storefronts",
    module: "Create Catalogue",
    route: "/catalogue-generator",
    audience: ["Admin", "Catalogue Deployment Desk"],
    permissionsNeeded: ["createCatalogue", "approve"],
    summary: "Activate lifecycle tracking.",
    tags: ["catalogue", "deploy", "lifecycle", "status"],
    steps: [
      "In the Success frame or Catalogue Management list, click 'Deploy'.",
      "Status changes from 'generated' to 'deployed'.",
      "The system will now track its expiry date automatically.",
    ],
    warnings: [
      "Do not deploy test/junk catalogues. Archive them instead to keep stats clean.",
    ],
  },
  {
    id: "cs-6",
    title: "How to create a vendor storefront",
    category: "Catalogue & Storefronts",
    module: "Create Storefront",
    route: "/vendor-storefront-builder",
    audience: ["Admin", "Catalogue Deployment Desk"],
    permissionsNeeded: ["createStorefront"],
    summary: "Build a standalone digital presence for a single vendor.",
    tags: ["storefront", "vendor", "create", "html", "website"],
    steps: [
      "Navigate to Create Storefront.",
      "Select the specific Vendor.",
      "Review title, slogan, and configure expiry date.",
      "Select specific products, branches, and staff to feature.",
      "Check plan warnings in the right sidebar.",
      "Click 'Create Storefront'.",
    ],
  },
  {
    id: "cs-7",
    title: "How to select products for a vendor storefront",
    category: "Catalogue & Storefronts",
    module: "Create Storefront",
    route: "/vendor-storefront-builder",
    audience: ["Admin", "Catalogue Deployment Desk"],
    summary: "Curate the vendor's featured items.",
    tags: ["storefront", "products", "select"],
    steps: [
      "In the 'Select Products' panel, use the checkboxes next to the product names.",
      "Click 'Select all' to include everything.",
      "Ensure you do not exceed the max image limits defined by the vendor's plan.",
    ],
  },
  {
    id: "cs-8",
    title: "How to download/copy storefront HTML",
    category: "Catalogue & Storefronts",
    module: "Create Storefront",
    route: "/vendor-storefront-builder",
    audience: ["Admin", "Catalogue Deployment Desk"],
    permissionsNeeded: ["createStorefront", "export"],
    summary: "Export the storefront payload.",
    tags: ["storefront", "download", "copy", "html", "export"],
    steps: [
      "After generation, click 'Download HTML' to save the file.",
      "Alternatively, click 'Copy HTML' to copy the raw code if you are embedding it elsewhere.",
    ],
  },
  {
    id: "cs-9",
    title: "How to log WhatsApp share after catalogue/storefront deployment",
    category: "Catalogue & Storefronts",
    module: "Create Storefront",
    route: "/vendor-storefront-builder",
    audience: ["Admin", "Catalogue Deployment Desk"],
    summary: "Record distribution actions directly from the compiler.",
    tags: ["log", "share", "whatsapp", "catalogue", "storefront"],
    steps: [
      "After generating a catalogue or storefront, click the 'Log Share' button in the success frame.",
      "A Quick Log modal will appear, pre-filled with the asset ID and vendor data.",
      "Select the target WhatsApp Community/Group.",
      "Save the log.",
    ],
  },
  // ==========================================
  // E. Commerce Access Hub
  // ==========================================
  {
    id: "cah-1",
    title: "How to add WhatsApp Access Hub links",
    category: "Commerce Access Hub",
    module: "Access Hub",
    route: "/commerce-access-hub",
    audience: ["Admin", "CAH Operations Desk"],
    permissionsNeeded: ["accessHub", "create"],
    summary: "Register distribution channels and community links.",
    tags: ["cah", "add", "link", "whatsapp", "community", "group", "channel"],
    steps: [
      "Navigate to Access Hub.",
      "Click 'Deploy New Distribution Link'.",
      "Fill in the Asset Name, Link Type, Target Audience, and WhatsApp URL.",
      "Click 'Commit to Hub Registry'.",
    ],
  },
  {
    id: "cah-2",
    title: "How to classify links by sector/category",
    category: "Commerce Access Hub",
    module: "Access Hub",
    route: "/commerce-access-hub",
    audience: ["Admin", "CAH Operations Desk"],
    summary: "Organize links for targeted catalogue distribution.",
    tags: ["cah", "classify", "sector", "category", "location"],
    steps: [
      "When editing a link, fill in the 'Sector Affiliation' and 'Category'.",
      "Specify 'Province' and 'City/Town'.",
      "This helps the catalogue generator suggest the right CAH links when building regional catalogues.",
    ],
  },
  {
    id: "cah-3",
    title: "How to use Commerce Access Hub for customer discovery",
    category: "Commerce Access Hub",
    module: "Access Hub",
    route: "/commerce-access-hub",
    audience: ["Admin", "CAH Operations Desk"],
    summary: "Track the reach and utility of communities.",
    tags: ["cah", "discovery", "members", "followers"],
    steps: [
      "Use the 'Quick Update Follower Count' button (Users icon) on a link card.",
      "Enter the new member count.",
      "The system automatically tracks growth percentages and timestamps, contributing to 'Hub Assets' BI.",
    ],
  },
  {
    id: "cah-4",
    title: "How to log activity from Access Hub link",
    category: "Commerce Access Hub",
    module: "Access Hub",
    route: "/commerce-access-hub",
    audience: ["Admin", "CAH Operations Desk"],
    summary: "Quickly record engagement straight from the Hub.",
    tags: ["cah", "log", "activity", "quick"],
    steps: [
      "Click the 'Log Activity' button (Message icon) on any CAH link card.",
      "The Quick Logger modal opens, pre-filled with the source details.",
      "Add customer needs or vendor details, then save.",
    ],
  },
  {
    id: "cah-5",
    title: "How to view BI from Access Hub link",
    category: "Commerce Access Hub",
    module: "Access Hub",
    route: "/commerce-access-hub",
    audience: ["Admin", "CAH Operations Desk"],
    summary: "Jump directly to intelligence reports for a specific community.",
    tags: ["cah", "bi", "analytics", "view"],
    steps: [
      "Click the 'View BI' button (Chart icon) on any CAH link card.",
      "This navigates you to the Community BI dashboard, where you can filter by that source.",
    ],
  },
  // ==========================================
  // F. WhatsApp Activity & BI
  // ==========================================
  {
    id: "wa-1",
    title: "How to log WhatsApp activity",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Activity",
    route: "/whatsapp-activity",
    audience: ["Admin", "Backoffice", "Staff"],
    permissionsNeeded: ["whatsappActivity"],
    summary: "Record daily operational engagements on WhatsApp.",
    tags: ["whatsapp", "log", "activity", "record"],
    steps: [
      "Navigate to WhatsApp Activity.",
      "Click 'Log Activity'.",
      "Select the Activity Type and Date.",
      "Select the Source Type (Community, Group, Channel).",
      "Use the 'WhatsApp Group / Channel' dropdown to select or search for the source name.",
      "Enter the customer need, vendor, or product involved.",
      "Set Lead Status and Priority.",
      "Save the Activity Log.",
    ],
  },
  {
    id: "wa-2",
    title: "How to select WhatsApp Community and Group/Channel",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Activity",
    route: "/whatsapp-activity",
    audience: ["Admin", "Backoffice", "Staff"],
    summary: "Use the registry selector to ensure data consistency.",
    tags: ["whatsapp", "source", "select", "registry"],
    steps: [
      "In the Log Activity form, click the 'WhatsApp Group / Channel' input.",
      "Type the name to search existing groups.",
      "Click on an existing group to auto-fill the Community Name, Sector, and Location data.",
      "If the group is not listed, proceed to add a new one.",
    ],
    commonMistakes: [
      "Typing a slightly different name for the same group splits the BI data. Always try to search and select an existing entry first.",
    ],
  },
  {
    id: "wa-3",
    title: "How to add a new WhatsApp Group/Channel from the activity form",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Activity",
    route: "/whatsapp-activity",
    audience: ["Admin", "Backoffice", "Staff"],
    summary: "Register new sources on the fly.",
    tags: ["whatsapp", "new", "group", "add", "registry"],
    steps: [
      "Type the new group name in the 'WhatsApp Group / Channel' input.",
      "Click the 'Add [name] as New Group' button that appears at the bottom of the dropdown.",
      "A modal will appear. Fill in the Community Name, URL, Sector, and Location.",
      "Click 'Save Source & Select'. The form will auto-fill with your new source.",
    ],
  },
  {
    id: "wa-4",
    title: "How to record customer needs/product enquiries",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Activity",
    route: "/whatsapp-activity",
    audience: ["Admin", "Backoffice", "Staff"],
    summary: "Capture demand signals for BI analysis.",
    tags: ["whatsapp", "customer need", "enquiry", "demand"],
    steps: [
      "In the Log Activity form, locate the 'Customer Need / Requested Item' field.",
      "Type exactly what the customer asked for (e.g., 'Toyota Aqua brake pads').",
      "If referring to a specific vendor or product in our registry, fill those fields too.",
      "Set Activity Type to 'Product Enquiry' or 'Customer Request'.",
    ],
  },
  {
    id: "wa-5",
    title: "How to assign follow-up to RPN/staff",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Activity",
    route: "/whatsapp-activity",
    audience: ["Admin", "Backoffice"],
    summary: "Delegate tasks within the activity log.",
    tags: ["whatsapp", "assign", "follow-up", "rpn", "staff"],
    steps: [
      "At the bottom of the Activity Form, find the 'Assign Follow-up To' section.",
      "Select 'RPN' or 'Backend Staff' from the Type dropdown.",
      "Select the specific person from the Assignee dropdown.",
      "They will now appear as the owner of this task in the Follow-up Desk.",
    ],
  },
  {
    id: "wa-6",
    title: "How to mark follow-up required",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Activity",
    route: "/whatsapp-activity",
    audience: ["Admin", "Backoffice"],
    summary: "Ensure an issue is tracked until resolution.",
    tags: ["whatsapp", "follow-up", "required", "date"],
    steps: [
      "Check the 'Follow-up Required' box in the Activity Form.",
      "Select a 'Follow-up Date'.",
      "The record will now appear in the Follow-up Control Desk on the Performance Reports page.",
    ],
  },
  {
    id: "wa-7",
    title: "How to use Community BI",
    category: "WhatsApp Activity & BI",
    module: "Community BI",
    route: "/whatsapp-community-bi",
    audience: ["Admin", "BI & Analytics Desk"],
    permissionsNeeded: ["whatsappActivity"],
    summary: "Analyze the health and demand signals across communities.",
    tags: ["bi", "community", "analytics", "demand"],
    steps: [
      "Navigate to Community BI.",
      "Use the Intelligence Filters to narrow down by date, sector, or source type.",
      "Review 'Sector Demand Analytics' to see which industries have the most enquiries.",
      "Review 'Product Demand Signals' to spot highly requested items.",
      "Check the 'Community Performance' table to evaluate group health and conversion rates.",
    ],
  },
  {
    id: "wa-8",
    title: "How to use WhatsApp Reports",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Reports",
    route: "/whatsapp-performance-reports",
    audience: ["Admin", "BI & Analytics Desk"],
    permissionsNeeded: ["whatsappActivity"],
    summary: "Evaluate operational performance of Vendors and RPNs.",
    tags: ["reports", "performance", "vendor", "rpn"],
    steps: [
      "Navigate to WhatsApp Reports.",
      "Switch between 'Vendor Reports', 'RPN Reports', 'Product Demand', and 'Follow-up Desk' tabs.",
      "Click 'View Detail' on any row to open the side panel with scores and recommended actions.",
    ],
  },
  {
    id: "wa-9",
    title:
      "How to interpret member growth, enquiries, conversions, missed responses, and high priority issues",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Reports",
    audience: ["Admin", "BI & Analytics Desk"],
    summary: "Understanding the metrics.",
    tags: [
      "metrics",
      "growth",
      "conversions",
      "missed",
      "priority",
      "interpret",
    ],
    steps: [
      "Member Growth: Net positive/negative change in community size based on logged updates.",
      "Enquiries: Total count of customer requests. Indicates demand.",
      "Conversions: Leads marked as 'CONVERTED'. High conversion indicates effective sales.",
      "Missed Responses: Leads marked 'MISSED' or 'VENDOR_DID_NOT_RESPOND'. High counts negatively impact Vendor Scores.",
      "High Priority: Items marked HIGH or CRITICAL. Require immediate action in the Follow-up Desk.",
    ],
  },
  {
    id: "wa-10",
    title: "How to avoid duplicate/messy WhatsApp source names",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Activity",
    audience: ["Admin", "Backoffice", "Staff"],
    summary: "Best practices for data entry.",
    tags: ["whatsapp", "duplicate", "messy", "source", "registry"],
    steps: [
      "Always use the dropdown search to find a group before typing a new name.",
      "Ensure Community Names are consistent (e.g., 'Harare Trade Hub' not 'hre trade hub').",
      "If a duplicate exists, inform a SysAdmin to merge or clean up the `itred_whatsapp_sources` registry.",
    ],
  },
  // ==========================================
  // G. RPN & Field Network
  // ==========================================
  {
    id: "rpn-1",
    title: "How to register an RPN",
    category: "RPN & Field Network",
    module: "RPN Management",
    route: "/rpn-management",
    audience: ["Admin", "RPN Management Desk"],
    permissionsNeeded: ["rpnManagement"],
    summary: "Add a new Retail Promoter Network agent.",
    tags: ["rpn", "register", "add", "agent"],
    steps: [
      "Navigate to RPN Management.",
      "Click 'Register RPN'.",
      "Fill in Name, Phone, and Territory details.",
      "Set Level (e.g., Junior RPN) and Status.",
      "Save.",
    ],
  },
  {
    id: "rpn-2",
    title: "How to assign vendors or follow-ups to an RPN",
    category: "RPN & Field Network",
    module: "Vendor Management",
    audience: ["Admin", "RPN Management Desk"],
    summary: "Link responsibilities to field agents.",
    tags: ["rpn", "assign", "vendor", "follow-up"],
    steps: [
      "To assign a vendor: Edit the Vendor profile, locate 'Assigned RPN', and select the agent. Save.",
      "To assign a follow-up: In the WhatsApp Activity form, set 'Assign Follow-up To' -> 'RPN', and select the agent.",
    ],
  },
  {
    id: "rpn-3",
    title: "How RPN activity affects BI",
    category: "RPN & Field Network",
    module: "WhatsApp Reports",
    audience: ["Admin", "RPN Management Desk", "BI & Analytics Desk"],
    summary: "Tracking field performance.",
    tags: ["rpn", "bi", "performance", "score"],
    steps: [
      "RPNs receive an 'Activity Score' in WhatsApp Reports based on logs assigned to them.",
      "Completing follow-ups and converting leads increases their score.",
      "Overdue follow-ups or escalated priority cases decrease their score.",
    ],
  },
  {
    id: "rpn-4",
    title: "How to use RPN field reports",
    category: "RPN & Field Network",
    module: "Activity Logs",
    route: "/activity-logs",
    audience: ["Admin", "RPN Management Desk"],
    summary: "Reviewing submissions from the field.",
    tags: ["rpn", "field reports", "logs"],
    steps: [
      "Navigate to Activity Logs.",
      "Filter by the specific RPN's name to see all their submissions, product collections, and vendor visits.",
    ],
  },
  {
    id: "rpn-5",
    title: "How to escalate unresolved customer/vendor issues",
    category: "RPN & Field Network",
    module: "WhatsApp Reports",
    route: "/whatsapp-performance-reports",
    audience: ["Admin", "Backoffice"],
    summary: "Managing the Follow-up Desk.",
    tags: ["rpn", "escalate", "issue", "vendor", "customer"],
    steps: [
      "Navigate to WhatsApp Reports -> Follow-up Desk.",
      "Find the unresolved issue.",
      "Click 'Update'.",
      "Change 'Response Status' to 'ESCALATED' and 'Priority' to 'CRITICAL'.",
      "Add notes and save. This triggers a red alert in the BI dashboards.",
    ],
  },
  // ==========================================
  // H. Staff, Roles & Security
  // ==========================================
  {
    id: "srs-1",
    title: "How to add staff",
    category: "Staff, Roles & Security",
    module: "Staff Management",
    route: "/staff-management",
    audience: ["Admin"],
    permissionsNeeded: ["staffManagement"],
    summary: "Create accounts for backend system users.",
    tags: ["staff", "add", "user", "account"],
    steps: [
      "Navigate to Staff Management.",
      "Click 'Add Staff'.",
      "Fill in Name, Display Name.",
      "Select a Role. The Desk and Permissions will auto-fill based on the template.",
      "Set a 6-digit passcode and confirm.",
      "Save Profile.",
    ],
  },
  {
    id: "srs-2",
    title: "How to edit role templates",
    category: "Staff, Roles & Security",
    module: "Role & Menu Permissions",
    route: "/role-menu-permissions",
    audience: ["Admin"],
    permissionsNeeded: ["roleMenuPermissions"],
    summary: "Define default access levels for job titles.",
    tags: ["staff", "role", "template", "edit", "permissions"],
    steps: [
      "Navigate to Role & Menu Permissions.",
      "Click 'Edit Permissions' on an existing role, or 'New Template'.",
      "Adjust the permission levels (view, create, edit, full, hidden) for each menu item.",
      "Click 'Save Role Permissions'.",
      "Note: SysAdmin and Admin system roles cannot be renamed.",
    ],
  },
  {
    id: "srs-3",
    title: "How to assign permissions",
    category: "Staff, Roles & Security",
    module: "Staff Management",
    route: "/staff-management",
    audience: ["Admin"],
    permissionsNeeded: ["staffManagement"],
    summary: "Override permissions for a specific user.",
    tags: ["staff", "assign", "permissions", "override"],
    steps: [
      "Locate the staff member in the directory.",
      "Click the 'Edit Permissions' (Shield) icon.",
      "Change specific drop-downs for that user.",
      "Save Permissions. This breaks their inheritance from the role template.",
    ],
  },
  {
    id: "srs-4",
    title: "How menu access works",
    category: "Staff, Roles & Security",
    module: "Security",
    audience: ["Admin"],
    summary: "The technical logic behind sidebar visibility.",
    tags: ["staff", "menu", "access", "visibility", "logic"],
    steps: [
      "The `AppShell` component checks `permissionService.hasMenuAccess(key)`.",
      "If the user's permission for that key is 'hidden' or undefined, the menu item is removed.",
      "If a user navigates via URL to a hidden route, `RestrictedAccess` intercepts and blocks them, logging an `ACCESS_DENIED` event.",
    ],
  },
  {
    id: "srs-5",
    title: "How to troubleshoot missing menu access",
    category: "Troubleshooting",
    module: "Security",
    audience: ["Admin"],
    summary: "Steps to resolve 'I can't see the page'.",
    tags: ["troubleshoot", "missing", "menu", "access", "hidden"],
    steps: [
      "Check if the Page file exists in the codebase.",
      "Check if the Route is defined in App.tsx.",
      "Check if the Menu item exists in the `MENU_GROUPS` array in AppShell.tsx.",
      "Check if the appropriate Permission key exists in `types.ts`.",
      "Go to Role & Menu Permissions and verify the user's role template allows access.",
      "If fixing code, ensure `npm run build` passes.",
    ],
  },
  {
    id: "srs-6",
    title: "How to understand captured-by audit fields",
    category: "Staff, Roles & Security",
    module: "Audit",
    audience: ["Admin", "Backoffice"],
    summary: "Tracking data entry accountability.",
    tags: ["staff", "audit", "captured-by", "accountability"],
    steps: [
      "When a staff member creates a WhatsApp Log (or other records), the system reads `localStorage.getItem('activeStaffSession')`.",
      "It automatically records `capturedByStaffId`, `capturedByStaffName`, and `capturedByRole`.",
      "These fields are read-only and visible on the form.",
      "They are used in Community BI under 'Internal Staff Capture Analytics'.",
    ],
  },
  {
    id: "srs-7",
    title: "How to suspend/deactivate staff access",
    category: "Staff, Roles & Security",
    module: "Staff Management",
    route: "/staff-management",
    audience: ["Admin"],
    permissionsNeeded: ["staffManagement"],
    summary: "Remove access without deleting history.",
    tags: ["staff", "suspend", "deactivate", "lock"],
    steps: [
      "Locate the staff member.",
      "Click the 'Suspend Staff' (UserX) icon.",
      "Confirm the suspension.",
      "The user will immediately be blocked from logging in.",
    ],
  },
  // ==========================================
  // I. Finance & Subscriptions
  // ==========================================
  {
    id: "fs-1",
    title: "How to create pricing tier",
    category: "Finance & Subscriptions",
    module: "Pricing",
    route: "/pricing",
    audience: ["Admin"],
    permissionsNeeded: ["pricing"],
    summary: "Define subscription limits and costs.",
    tags: ["finance", "pricing", "tier", "create", "plan"],
    steps: [
      "Navigate to Pricing.",
      "Click 'Create New Plan'.",
      "Set limits for Max Products, Images, Branches, and Deployments.",
      "Toggle feature flags (e.g., 'Storefront Enabled').",
      "Save Plan.",
    ],
  },
  {
    id: "fs-2",
    title: "How to edit subscription status",
    category: "Finance & Subscriptions",
    module: "Vendor Management",
    route: "/vendor-management",
    audience: ["Admin", "Collections Desk"],
    permissionsNeeded: ["vendorManagement"],
    summary: "Update billing state.",
    tags: ["finance", "subscription", "status", "edit"],
    steps: [
      "Edit the Vendor profile.",
      "Locate the 'Subscription' dropdown.",
      "Change status (active, due, overdue, suspended).",
      "Save profile.",
    ],
  },
  {
    id: "fs-3",
    title: "How to handle collections",
    category: "Finance & Subscriptions",
    module: "Subscriptions & Collections",
    route: "/subscriptions",
    audience: ["Admin", "Collections Desk"],
    permissionsNeeded: ["subscriptionsCollections"],
    summary: "Log payments from vendors.",
    tags: ["finance", "collections", "payment", "log"],
    steps: [
      "Navigate to Subscriptions & Collections.",
      "Select 'Record Collection' next to a due vendor.",
      "Enter amount, currency, method, and reference number.",
      "Save.",
    ],
  },
  {
    id: "fs-4",
    title: "How vendor plan limits affect catalogue/storefront generation",
    category: "Finance & Subscriptions",
    module: "Pricing",
    audience: ["Admin", "Catalogue Deployment Desk"],
    summary: "Overage enforcement.",
    tags: ["finance", "limits", "catalogue", "storefront", "plan"],
    steps: [
      "The generator checks the vendor's assigned Pricing Plan.",
      "If the vendor's active products exceed `maxProducts`, a warning is generated.",
      "If monthly deployments exceed `maxStorefrontDeploymentsPerMonth`, a warning is generated.",
      "Admins can choose to override warnings, but standard protocol requires a plan upgrade.",
    ],
  },
  {
    id: "fs-5",
    title: "How plan restrictions affect features",
    category: "Finance & Subscriptions",
    module: "Pricing",
    audience: ["Admin", "Backoffice"],
    summary: "Feature gating based on subscription.",
    tags: ["finance", "features", "restrictions", "plan"],
    steps: [
      "If a plan has `isVendorStorefrontEnabled = false`, warnings appear in the Storefront Builder.",
      "If `inventorySpotChecksPerMonth = 0`, scheduling spot checks will show a quota warning.",
    ],
  },
  // ==========================================
  // J. Troubleshooting (Remaining tech issues)
  // ==========================================
  {
    id: "ts-1",
    title: "Firebase permission denied",
    category: "Troubleshooting",
    module: "Database",
    audience: ["Admin", "SysAdmin"],
    summary: "Fixing read/write rejections.",
    tags: [
      "troubleshoot",
      "firebase",
      "permission",
      "denied",
      "firestore",
      "rules",
    ],
    steps: [
      "Verify the `.env` file points to the correct Firebase project.",
      "Ensure the active user session meets authentication requirements (if rules enforce Auth).",
      "Check if Firestore rules are deployed and up to date.",
      "Ensure the collection name exactly matches the code (e.g., `itred_whatsapp_sources`).",
      "Verify the rules explicitly allow read/write to that collection path.",
    ],
  },
  {
    id: "ts-2",
    title: "App saves locally but not Firebase",
    category: "Troubleshooting",
    module: "Storage Service",
    audience: ["Admin", "SysAdmin"],
    summary: "Checking storage mode and network.",
    tags: ["troubleshoot", "save", "local", "firebase", "sync", "storage"],
    steps: [
      "Check `storageConfig.mode` in `src/services/storageService.ts` or `VITE_STORAGE_MODE` in `.env`.",
      "If set to 'local', Firebase is bypassed intentionally.",
      "If set to 'firebase', check the browser console for network errors or permission denied messages.",
      "Ensure payloads do not contain `undefined` fields or nested arrays masquerading as objects.",
    ],
  },
  {
    id: "ts-3",
    title: "Build error from missing lucide icon import",
    category: "Troubleshooting",
    module: "Codebase",
    audience: ["SysAdmin"],
    summary: "Fixing missing icon references.",
    tags: ["troubleshoot", "build", "error", "lucide", "icon", "import"],
    steps: [
      "Identify the file and line number from the terminal output.",
      "Go to the top of that file.",
      "Add the missing icon name to the `import { ... } from 'lucide-react';` statement.",
    ],
  },
  {
    id: "ts-4",
    title: "Build error from bad MenuKey union syntax",
    category: "Troubleshooting",
    module: "Types",
    audience: ["SysAdmin"],
    summary: "Fixing type union errors in types.ts.",
    tags: [
      "troubleshoot",
      "build",
      "error",
      "menukey",
      "union",
      "syntax",
      "types",
    ],
    steps: [
      "Open `src/types.ts`.",
      "Locate `export type MenuKey = ...`",
      "Ensure strings are separated by `|`.",
      "Ensure there is NO semicolon `;` before the final item. It should only be at the very end of the statement.",
    ],
  },
  {
    id: "ts-5",
    title: "Vite MIME type/module script errors in preview",
    category: "Troubleshooting",
    module: "Build/Deploy",
    audience: ["SysAdmin"],
    summary: "Fixing blank screens after deployment.",
    tags: [
      "troubleshoot",
      "vite",
      "mime",
      "module",
      "script",
      "blank",
      "preview",
    ],
    steps: [
      "This happens if Firebase Hosting rewrites are not configured to point to `index.html` for single-page apps.",
      'Check `firebase.json` for: `"rewrites": [ { "source": "**", "destination": "/index.html" } ]`',
      "Also ensure Vite built the assets correctly and the deploy command points to the `dist` folder.",
    ],
  },
  {
    id: "ts-6",
    title: "Firebase preview channel name mismatch",
    category: "Troubleshooting",
    module: "Build/Deploy",
    audience: ["SysAdmin"],
    summary: "Opening the correct preview URL.",
    tags: ["troubleshoot", "firebase", "preview", "channel", "mismatch"],
    steps: [
      "The deploy channel name must match the open channel name exactly.",
      "Example Deploy: `firebase hosting:channel:deploy itred-preview --expires 7d --project YOUR_PROJECT_ID`",
      "Example Open: `firebase hosting:channel:open itred-preview --project YOUR_PROJECT_ID`",
      "Do not mix up dashes and underscores.",
    ],
  },
  {
    id: "ts-7",
    title: "Firestore singleton document problem for arrays",
    category: "Troubleshooting",
    module: "Database",
    audience: ["SysAdmin"],
    summary: "Fixing array overwrites.",
    tags: ["troubleshoot", "firestore", "singleton", "array", "document"],
    steps: [
      "If an entire list (e.g., vendors) is saving into one document called 'singleton' with keys '0', '1', etc., the `storageService.ts` logic is failing to handle arrays properly.",
      "Ensure `firebaseAdapter.setItem` iterates over the array and writes individual documents using `writeBatch`.",
      "Ensure `removeUndefinedDeep` is sanitizing the objects before write.",
    ],
  },
  {
    id: "ts-8",
    title: "How to check if a page route exists",
    category: "Troubleshooting",
    module: "Routing",
    audience: ["SysAdmin"],
    summary: "Verifying navigation paths.",
    tags: ["troubleshoot", "route", "path", "page", "exists"],
    steps: [
      "Open `src/App.tsx`.",
      'Look for `<Route path="/your-path" element={<YourComponent />} />`.',
      "Ensure `YourComponent` is imported at the top.",
      "Ensure the path matches what is used in `AppShell` or `navigate()` calls.",
    ],
  },
  {
    id: "ts-9",
    title: "How to run npm run build before deployment",
    category: "Troubleshooting",
    module: "Build/Deploy",
    audience: ["SysAdmin"],
    summary: "Compiling the production assets.",
    tags: ["troubleshoot", "npm", "build", "deploy", "compile"],
    steps: [
      "Open the terminal in the root folder (`itredVD`).",
      "Run `npm run build`.",
      "Wait for Vite to compile the TypeScript.",
      "If errors appear (e.g., TS2304), fix the code. The build must finish with 'built in ...ms'.",
      "Only then run `firebase deploy`.",
    ],
  },
];

const buildSearchText = (guide: Omit<HowToGuide, "searchText">): string => {
  const tags = safeArray(guide.tags);
  const steps = safeArray(guide.steps);
  const warnings = safeArray(guide.warnings);
  const mistakes = safeArray(guide.commonMistakes);
  const audience = safeArray(guide.audience);
  const perms = safeArray(guide.permissionsNeeded);

  const content = [
    guide.title,
    guide.title, // Weight title higher
    guide.category,
    guide.module,
    guide.route || "",
    guide.summary,
    ...tags,
    ...audience,
    ...perms,
    ...steps,
    ...warnings,
    ...mistakes,
  ];

  return content
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
};

const allGuides: HowToGuide[] = guidesData.map((guide) => ({
  ...guide,
  searchText: buildSearchText(guide),
}));

export const HowToPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);

  const navigate = useNavigate();

  const categories = [
    "All",
    "Getting Started",
    "Vendor Operations",
    "Product Operations",
    "Catalogue & Storefronts",
    "Commerce Access Hub",
    "WhatsApp Activity & BI",
    "RPN & Field Network",
    "Staff, Roles & Security",
    "Finance & Subscriptions",
    "Troubleshooting",
  ];

  const searchResults = useMemo(() => {
    const queryTokens = query
      .toLowerCase()
      .split(" ")
      .filter((token) => token.length > 0);

    if (queryTokens.length === 0 && activeCategory === "All") {
      return allGuides;
    }

    const filteredByCategory =
      activeCategory === "All"
        ? allGuides
        : allGuides.filter((a) => a.category === activeCategory);

    if (queryTokens.length === 0) {
      return filteredByCategory;
    }

    const scoredGuides = filteredByCategory.map((guide) => {
      let score = 0;
      let foundTokens = 0;

      queryTokens.forEach((token) => {
        if (guide.searchText.includes(token)) {
          foundTokens++;
          score += 1;
          if (guide.title.toLowerCase().includes(token)) score += 10;
          if (safeArray(guide.tags).join(" ").toLowerCase().includes(token))
            score += 5;
          if (guide.summary.toLowerCase().includes(token)) score += 2;
          if (guide.route?.toLowerCase().includes(token)) score += 2;
        }
      });

      if (foundTokens === queryTokens.length) {
        score += 20;
      }

      if (foundTokens < queryTokens.length) {
        score = score / 2;
      }

      return { ...guide, score };
    });

    return scoredGuides
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, activeCategory]);

  const selectedGuide = useMemo(() => {
    if (!selectedGuideId) return null;
    return allGuides.find((g) => g.id === selectedGuideId) || null;
  }, [selectedGuideId]);

  const handleCopySteps = (steps: string[]) => {
    const text = steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    navigator.clipboard.writeText(text);
    alert("Steps copied to clipboard.");
  };

  return (
    <div className="pb-20 bg-stone-50 min-h-screen flex flex-col">
      <PageHeader
        title="iTred Operations Manual"
        subtitle="Step-by-step operating guidance for vendor visibility, catalogues, WhatsApp activity, RPN workflows, and system administration."
      />

      {/* Fixed / Sticky Search Panel */}
      <div className="sticky top-0 z-30 bg-white p-6 border-b-4 border-brand-charcoal shadow-sm shrink-0">
        <div className="relative max-w-4xl mx-auto">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search how to create catalogue, log WhatsApp activity, add vendor, assign follow-up..."
            className="w-full border-2 border-stone-200 bg-stone-50 p-4 pl-12 text-sm font-bold uppercase text-brand-charcoal outline-none focus:border-brand-orange transition-colors"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-brand-orange transition-colors"
            >
              <X />
            </button>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-6xl mx-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 transition-all ${
                activeCategory === cat
                  ? "bg-brand-orange border-brand-orange text-white"
                  : "bg-white border-stone-200 text-stone-500 hover:border-brand-charcoal hover:text-brand-charcoal"
              }`}
            >
              {cat === "Commerce Access Hub" ? "Access Hub" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 max-w-[1600px] mx-auto w-full items-start">
        {/* Left Column: Navigator / Search Results */}
        <div className="bg-white border-2 border-stone-200 shadow-sm flex flex-col h-[calc(100vh-280px)] sticky top-[180px]">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand-charcoal flex items-center gap-2">
              <BookOpen size={14} className="text-brand-orange" />
              {query ? "Search Results" : "Operations Modules"}
            </h3>
            <span className="text-[10px] font-bold text-stone-400 bg-stone-200 px-2 py-0.5 rounded-full">
              {searchResults.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {searchResults.length > 0 ? (
              searchResults.map((guide) => (
                <div
                  key={guide.id}
                  onClick={() => setSelectedGuideId(guide.id)}
                  className={`p-4 border-2 cursor-pointer transition-all ${
                    selectedGuideId === guide.id
                      ? "border-brand-orange bg-orange-50"
                      : "border-stone-100 hover:border-stone-300 bg-white"
                  }`}
                >
                  <p className="text-[9px] font-bold uppercase text-stone-400 mb-1 flex items-center gap-1">
                    <Terminal size={10} /> {guide.module}
                  </p>
                  <h4
                    className={`text-xs font-bold uppercase leading-tight ${selectedGuideId === guide.id ? "text-brand-orange" : "text-brand-charcoal"}`}
                  >
                    {guide.title}
                  </h4>
                  <p className="text-[10px] text-stone-500 mt-2 line-clamp-2 italic">
                    {guide.summary}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-16 px-4">
                <AlertTriangle
                  size={32}
                  className="mx-auto text-stone-300 mb-4"
                />
                <h3 className="text-sm font-bold text-brand-charcoal uppercase">
                  No guide found.
                </h3>
                <p className="text-xs text-stone-500 mt-2 mb-6">
                  Try searching by module, action, route, or issue.
                </p>
                <div className="space-y-2 text-left bg-stone-50 p-4 border border-stone-200 inline-block">
                  <p className="text-[10px] font-bold uppercase text-stone-400 mb-2">
                    Try these common searches:
                  </p>
                  <button
                    onClick={() => setQuery("WhatsApp activity")}
                    className="block text-xs font-bold text-brand-orange hover:underline uppercase w-full text-left"
                  >
                    › WhatsApp activity
                  </button>
                  <button
                    onClick={() => setQuery("create catalogue")}
                    className="block text-xs font-bold text-brand-orange hover:underline uppercase w-full text-left"
                  >
                    › create catalogue
                  </button>
                  <button
                    onClick={() => setQuery("add vendor")}
                    className="block text-xs font-bold text-brand-orange hover:underline uppercase w-full text-left"
                  >
                    › add vendor
                  </button>
                  <button
                    onClick={() => setQuery("menu permissions")}
                    className="block text-xs font-bold text-brand-orange hover:underline uppercase w-full text-left"
                  >
                    › menu permissions
                  </button>
                  <button
                    onClick={() => setQuery("Firebase save issue")}
                    className="block text-xs font-bold text-brand-orange hover:underline uppercase w-full text-left"
                  >
                    › Firebase save issue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Guide Detail Panel */}
        {selectedGuide ? (
          <div className="bg-white border-2 border-brand-charcoal shadow-lg flex flex-col h-[calc(100vh-280px)] overflow-hidden">
            {/* Detail Header */}
            <div className="p-6 md:p-8 border-b border-stone-100 bg-stone-50 shrink-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-black uppercase text-brand-orange tracking-widest px-2 py-1 bg-orange-100 border border-brand-orange">
                  {selectedGuide.category}
                </span>
                <span className="text-[10px] font-bold uppercase text-stone-500 tracking-widest px-2 py-1 border border-stone-200 bg-white">
                  Module: {selectedGuide.module}
                </span>
                {selectedGuide.route && (
                  <span
                    className="text-[10px] font-mono text-stone-500 tracking-widest px-2 py-1 border border-stone-200 bg-white flex items-center gap-1 cursor-pointer hover:bg-stone-100"
                    onClick={() => navigate(selectedGuide.route!)}
                  >
                    <ExternalLink size={10} /> {selectedGuide.route}
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight leading-tight">
                {selectedGuide.title}
              </h2>

              <p className="text-sm text-stone-600 mt-4 leading-relaxed font-medium">
                {selectedGuide.summary}
              </p>

              <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-stone-200">
                {safeArray(selectedGuide.audience).map((aud) => (
                  <span
                    key={aud}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase bg-stone-800 text-white px-2 py-1"
                  >
                    <Users size={10} /> {aud}
                  </span>
                ))}
                {safeArray(selectedGuide.permissionsNeeded).map((perm) => (
                  <span
                    key={perm}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase bg-red-50 text-red-700 border border-red-200 px-2 py-1"
                  >
                    <Lock size={10} /> Requires: {perm}
                  </span>
                ))}
              </div>
            </div>

            {/* Detail Body */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-10">
              {/* Steps Section */}
              {safeArray(selectedGuide.steps).length > 0 && (
                <section>
                  <div className="flex items-center justify-between border-b-2 border-brand-charcoal pb-2 mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-brand-charcoal flex items-center gap-2">
                      <Terminal size={16} className="text-brand-orange" />{" "}
                      Operating Procedure
                    </h3>
                    <button
                      onClick={() =>
                        handleCopySteps(safeArray(selectedGuide.steps))
                      }
                      className="text-[10px] font-bold uppercase text-stone-400 hover:text-brand-orange flex items-center gap-1 transition-colors"
                    >
                      <Copy size={12} /> Copy Steps
                    </button>
                  </div>
                  <div className="space-y-4">
                    {safeArray(selectedGuide.steps).map((step, idx) => (
                      <div key={idx} className="flex gap-4 items-start group">
                        <div className="w-6 h-6 shrink-0 bg-stone-100 border border-stone-300 text-stone-500 font-bold text-xs flex items-center justify-center group-hover:bg-brand-orange group-hover:text-white group-hover:border-brand-orange transition-colors">
                          {idx + 1}
                        </div>
                        <p className="text-sm font-medium text-stone-700 pt-0.5 leading-relaxed">
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Checks Section */}
              {safeArray(selectedGuide.checks).length > 0 && (
                <section className="bg-emerald-50 p-6 border border-emerald-200">
                  <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800 border-b border-emerald-200 pb-2 mb-4 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Pre-Flight Checks
                  </h3>
                  <ul className="space-y-3">
                    {safeArray(selectedGuide.checks).map((check, idx) => (
                      <li
                        key={idx}
                        className="flex gap-3 text-emerald-900 text-sm font-medium"
                      >
                        <Check size={16} className="shrink-0 mt-0.5" /> {check}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Common Mistakes Section */}
              {safeArray(selectedGuide.commonMistakes).length > 0 && (
                <section className="bg-stone-50 p-6 border border-stone-200">
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-600 border-b border-stone-200 pb-2 mb-4 flex items-center gap-2">
                    <Info size={16} /> Common Pitfalls
                  </h3>
                  <ul className="space-y-3">
                    {safeArray(selectedGuide.commonMistakes).map(
                      (mistake, idx) => (
                        <li
                          key={idx}
                          className="flex gap-3 text-stone-600 text-sm font-medium"
                        >
                          <span className="w-1.5 h-1.5 bg-stone-400 rounded-full shrink-0 mt-2" />{" "}
                          {mistake}
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              )}

              {/* Warnings Section */}
              {safeArray(selectedGuide.warnings).length > 0 && (
                <section className="bg-red-50 p-6 border border-red-200">
                  <h3 className="text-xs font-black uppercase tracking-widest text-red-800 border-b border-red-200 pb-2 mb-4 flex items-center gap-2">
                    <ShieldAlert size={16} /> Critical Warnings
                  </h3>
                  <ul className="space-y-3">
                    {safeArray(selectedGuide.warnings).map((warning, idx) => (
                      <li
                        key={idx}
                        className="flex gap-3 text-red-900 text-sm font-bold"
                      >
                        <AlertTriangle
                          size={16}
                          className="shrink-0 mt-0.5 text-red-600"
                        />{" "}
                        {warning}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-stone-200 shadow-sm flex flex-col items-center justify-center h-[calc(100vh-280px)] text-center p-10">
            <div className="w-16 h-16 bg-stone-100 flex items-center justify-center rounded-none mb-6">
              <BookOpen size={32} className="text-stone-300" />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-brand-charcoal mb-2">
              Operations Manual Reader
            </h2>
            <p className="text-stone-500 text-sm max-w-md">
              Select an operational module or troubleshooting guide from the
              left panel to display the step-by-step procedure.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HowToPage;
