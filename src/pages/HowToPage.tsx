/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lock,
  FileCode,
  Layers,
  ShoppingBag,
  MessageSquare,
  Users,
} from "lucide-react";
import { PageHeader, PrimaryButton, StatusBadge } from "../components/CommonUI";
import { AppRoute, MenuKey } from "../types";
import { permissionService } from "../services/permissionService";
import { useNavigate } from "react-router-dom";

interface HowToArticle {
  id: string;
  title: string;
  module: string;
  category:
    | "Getting Started"
    | "Features"
    | "Troubleshooting"
    | "Best Practices";
  tags: string[];
  keywords: string[];
  summary: string;
  routePath?: string;
  requiredPermissions?: MenuKey[];
  steps: { title: string; description: string }[];
  warnings?: string[];
  troubleshooting?: { problem: string; solution: string }[];
  relatedActions?: { label: string; route: string }[];
  searchText: string;
}

const articlesData: Omit<HowToArticle, "searchText">[] = [
  {
    id: "global-catalogue",
    title: "Create and Deploy Global Catalogue",
    module: "Create Catalogue",
    category: "Features",
    tags: ["catalogue", "global", "multi-vendor", "deploy", "html"],
    keywords: [
      "sector",
      "category",
      "vendor list",
      "cah links",
      "expiry",
      "download",
    ],
    summary:
      "Global catalogues combine products from multiple vendors into one digital HTML catalogue grouped by sector, category, or location.",
    routePath: "/catalogue-generator",
    requiredPermissions: ["createCatalogue"],
    steps: [
      {
        title: "1. Open Create Catalogue",
        description: "Select Create Catalogue from the main navigation menu.",
      },
      {
        title: "2. Configure Build",
        description:
          "In the Build Configuration panel, enter the sector, category, and optional province/city.",
      },
      {
        title: "3. Set Expiry Period",
        description:
          "Choose an expiry period for the catalogue: 7, 14, or 30 days.",
      },
      {
        title: "4. Apply Filters",
        description:
          "Toggle filters like Active Only, Published Only, or Include Stockouts to refine the product list.",
      },
      {
        title: "5. Set Product Limit",
        description:
          "Set the maximum number of products to include: 100, 400, or 800 items.",
      },
      {
        title: "6. Select Vendors",
        description:
          "In the Vendor List panel, click to select the vendors you want to include.",
      },
      {
        title: "7. Select CAH Links",
        description:
          "Optionally, select relevant WhatsApp Access Hub links to embed in the footer.",
      },
      {
        title: "8. Review Checklist",
        description:
          "Check the sidebar for estimated file size, plan violations, and other warnings.",
      },
      {
        title: "9. Generate Catalogue",
        description: "Click the 'Create Multi-Vendor Catalogue' button.",
      },
      {
        title: "10. Preview",
        description: "A preview of the generated catalogue will appear.",
      },
      {
        title: "11. Deploy",
        description:
          "Click the 'Deploy' button to mark the catalogue as deployed and start its lifecycle tracking.",
      },
      {
        title: "12. Download",
        description:
          "Click 'Download' to save the standalone .html file for distribution.",
      },
    ],
  },
  {
    id: "vendor-storefront",
    title: "Create and Deploy Vendor Storefront",
    module: "Create Storefront",
    category: "Features",
    tags: ["storefront", "vendor", "website", "deploy", "html"],
    keywords: [
      "standalone",
      "offline",
      "products",
      "branches",
      "staff",
      "download",
    ],
    summary:
      "Vendor storefronts are dedicated, standalone, offline-ready HTML websites generated for a single specific vendor.",
    routePath: "/vendor-storefront-builder",
    requiredPermissions: ["createStorefront"],
    steps: [
      {
        title: "1. Open Create Storefront",
        description: "Select Create Storefront from the main navigation menu.",
      },
      {
        title: "2. Select Vendor",
        description:
          "Choose the target vendor from the 'Select Vendor' dropdown menu.",
      },
      {
        title: "3. Configure Details",
        description:
          "Confirm or edit the storefront title, slogan, and optional expiry date.",
      },
      {
        title: "4. Select Products",
        description:
          "In the 'Select Products' panel, choose which of the vendor's products to include.",
      },
      {
        title: "5. Select Sections",
        description:
          "Choose which vendor profile sections to include, such as Branches, Staff, Delivery Contacts, and CAH Footer Links.",
      },
      {
        title: "6. Review Limits",
        description:
          "Check the sidebar for warnings related to plan limits, image counts, and monthly deployments.",
      },
      {
        title: "7. Generate Storefront",
        description: "Click the 'Create Storefront' button.",
      },
      {
        title: "8. Preview",
        description:
          "Scroll down to the preview panel to review the generated storefront.",
      },
      {
        title: "9. Deploy",
        description:
          "Click 'Mark Deployed' to officially track the storefront's lifecycle.",
      },
      {
        title: "10. Export",
        description:
          "Click 'Download HTML' or 'Copy HTML' to get the file for distribution via WhatsApp or other channels.",
      },
    ],
  },
  {
    id: "add-vendor",
    title: "Add New Vendor",
    module: "Vendor Management",
    category: "Getting Started",
    tags: ["vendor", "onboarding", "new"],
    keywords: ["profile", "contact", "location", "subscription"],
    summary:
      "Onboard a new vendor into the iTred system by providing their business, contact, and location details.",
    routePath: "/vendor-management",
    requiredPermissions: ["addNewVendor"],
    steps: [
      {
        title: "1. Navigate",
        description: "Go to Vendor Management from the main menu.",
      },
      {
        title: "2. Initiate",
        description:
          "Click the 'Add Vendor' button to open the new vendor form.",
      },
      {
        title: "3. Core Details",
        description:
          "Fill in the vendor's core details: Name, Trading Name, Sector, and Business Type.",
      },
      {
        title: "4. Contact Info",
        description:
          "Enter contact information: Owner Name, Phone, WhatsApp, and Email.",
      },
      {
        title: "5. Location",
        description:
          "Provide detailed location information: Province, City, Suburb, and Street Address.",
      },
      {
        title: "6. Subscription",
        description: "Assign a subscription plan and set the billing cycle.",
      },
      {
        title: "7. Assign RPN",
        description: "Assign an RPN to manage the vendor relationship.",
      },
      {
        title: "8. Save",
        description: "Click 'Save Vendor' to create the profile.",
      },
    ],
  },
  {
    id: "add-product",
    title: "Add New Product",
    module: "Product Management",
    category: "Getting Started",
    tags: ["product", "inventory", "new", "item"],
    keywords: ["price", "stock", "image", "sku", "publish"],
    summary:
      "Add a new product to a vendor's inventory, including details, pricing, stock, and an image.",
    routePath: "/product-management",
    requiredPermissions: ["addNewProduct"],
    steps: [
      {
        title: "1. Navigate",
        description: "Go to Product Management from the main menu.",
      },
      { title: "2. Initiate", description: "Click 'Add New Product'." },
      {
        title: "3. Select Vendor",
        description: "Select the vendor this product belongs to.",
      },
      {
        title: "4. Product Details",
        description: "Enter the product name, category, brand, and SKU.",
      },
      {
        title: "5. Description",
        description: "Write a detailed product description.",
      },
      {
        title: "6. Pricing & Units",
        description:
          "Set the selling price, cost price (optional), and unit of measure (e.g., 'each', 'kg').",
      },
      { title: "7. Stock", description: "Enter the current stock quantity." },
      {
        title: "8. Image",
        description: "Upload a compressed WebP image for the product.",
      },
      {
        title: "9. Publish Flag",
        description:
          "Toggle 'Publish to Catalogue' if it should appear in global catalogues.",
      },
      { title: "10. Save", description: "Click 'Save Product'." },
    ],
  },
  {
    id: "add-cah-link",
    title: "Add WhatsApp Access Hub Link",
    module: "Access Hub",
    category: "Features",
    tags: ["cah", "whatsapp", "link", "group"],
    keywords: ["commerce access hub", "footer", "community"],
    summary:
      "Add a new WhatsApp group or channel link to the Commerce Access Hub (CAH) to be included in catalogue footers.",
    routePath: "/commerce-access-hub",
    requiredPermissions: ["accessHub"],
    steps: [
      {
        title: "1. Navigate",
        description: "Go to Access Hub management from the main menu.",
      },
      { title: "2. Initiate", description: "Click 'Add New Link'." },
      {
        title: "3. Name Link",
        description: "Enter the Link Name (e.g., 'Harare Motor Spares Group').",
      },
      {
        title: "4. Select Type",
        description: "Select the link type: 'Group' or 'Channel'.",
      },
      {
        title: "5. Paste URL",
        description: "Paste the full WhatsApp invite link.",
      },
      {
        title: "6. Categorize",
        description: "Assign a sector and category to help with filtering.",
      },
      {
        title: "7. Set Status",
        description:
          "Set the status to 'active' to make it available for selection.",
      },
      { title: "8. Save", description: "Click 'Save Link'." },
    ],
  },
  {
    id: "add-staff",
    title: "Add Staff Member",
    module: "Staff Management",
    category: "Getting Started",
    tags: ["staff", "user", "account", "permission"],
    keywords: ["role", "desk", "passcode", "login"],
    summary:
      "Create a new user profile for a staff member, assign a role and desk, and set their initial passcode.",
    routePath: "/staff-management",
    requiredPermissions: ["staffManagement"],
    steps: [
      {
        title: "1. Navigate",
        description:
          "Go to Staff Management from the Admin section of the menu.",
      },
      { title: "2. Initiate", description: "Click 'Add Staff'." },
      {
        title: "3. Enter Names",
        description:
          "Enter the staff member's Full Name and a shorter Display Name.",
      },
      {
        title: "4. Assign Role",
        description:
          "Assign a Role (e.g., 'Backoffice Operator'), which automatically sets their permissions and desk.",
      },
      {
        title: "5. Contact Info",
        description: "Enter their email and phone number (optional).",
      },
      {
        title: "6. Set Passcode",
        description: "Set an initial 6-digit passcode and confirm it.",
      },
      {
        title: "7. Force Change",
        description: "Check 'Must change passcode on next login' for security.",
      },
      { title: "8. Save", description: "Click 'Save Profile'." },
    ],
  },
  {
    id: "add-branches",
    title: "Add Branches to Vendor",
    module: "Vendor Management",
    category: "Features",
    tags: ["branch", "location", "vendor"],
    keywords: ["address", "multiple locations", "store"],
    summary:
      "Add multiple physical branch locations to a single vendor profile to show in storefronts and catalogues.",
    routePath: "/vendor-management",
    requiredPermissions: ["vendorManagement"],
    steps: [
      {
        title: "1. Navigate",
        description: "Go to Vendor Management and find the vendor to edit.",
      },
      {
        title: "2. Find Section",
        description:
          "In the vendor's profile page, scroll to the 'Branches' section.",
      },
      { title: "3. Add Branch", description: "Click 'Add Branch'." },
      {
        title: "4. Fill Details",
        description:
          "Fill in the branch details: Branch Name, Manager, Phone, Address, and Opening Hours.",
      },
      {
        title: "5. Set Default",
        description:
          "Mark one branch as the 'Default Branch' for general inquiries.",
      },
      { title: "6. Save", description: "Save the branch details." },
      { title: "7. Repeat", description: "Repeat for all other branches." },
    ],
  },
  {
    id: "add-delivery",
    title: "Add Delivery Contacts",
    module: "Vendor Management",
    category: "Features",
    tags: ["delivery", "contact", "vendor"],
    keywords: ["driver", "logistics", "transport"],
    summary:
      "Add dedicated delivery staff or services to a vendor's profile so they can be included in storefronts.",
    routePath: "/vendor-management",
    requiredPermissions: ["vendorManagement"],
    steps: [
      {
        title: "1. Navigate",
        description: "Go to Vendor Management and find the vendor to edit.",
      },
      {
        title: "2. Find Section",
        description:
          "In the vendor's profile page, scroll to the 'Delivery Contacts' section.",
      },
      { title: "3. Add Contact", description: "Click 'Add Delivery Contact'." },
      {
        title: "4. Fill Details",
        description:
          "Enter the delivery person's name, phone, and WhatsApp number.",
      },
      {
        title: "5. Extra Info",
        description: "Add vehicle details and service area if applicable.",
      },
      { title: "6. Save", description: "Save the contact." },
    ],
  },
  {
    id: "plan-limits",
    title: "Understand Catalogue Plan Limits",
    module: "Create Catalogue",
    category: "Best Practices",
    tags: ["plan", "limits", "subscription", "warnings"],
    keywords: ["products", "images", "deployments", "entitlements", "upgrade"],
    summary:
      "Each vendor subscription plan has limits on products, images, and deployments. Understand these to avoid warnings and ensure smooth catalogue generation.",
    routePath: "/pricing",
    requiredPermissions: ["pricing"],
    steps: [
      {
        title: "1. Product Limits",
        description:
          "Each plan (e.g., Starter, Growth, Pro) defines a maximum number of products a vendor can have.",
      },
      {
        title: "2. Image Limits",
        description:
          "Storefronts and catalogues have limits on the total number of images that can be included per vendor.",
      },
      {
        title: "3. Deployment Limits",
        description:
          "Plans restrict how many storefronts or global catalogues a vendor can be included in per month.",
      },
      {
        title: "4. Feature Entitlements",
        description:
          "Some features, like WhatsApp buttons or inventory checks, are only available on higher-tier plans.",
      },
      {
        title: "5. Review Warnings",
        description:
          "Before generating a catalogue or storefront, check the 'Warnings' or 'Review Checklist' panel. It will flag any vendor exceeding their plan limits.",
      },
      {
        title: "6. Take Action",
        description:
          "If a vendor exceeds limits, either reduce the number of selected products/images for the current build or advise the vendor to upgrade their plan.",
      },
    ],
  },
  {
    id: "fix-whatsapp-url",
    title: "Fix Missing WhatsApp URL",
    module: "Vendor Management",
    category: "Troubleshooting",
    tags: ["whatsapp", "missing", "contact", "vendor"],
    keywords: ["button disabled", "reminder", "url", "number"],
    summary:
      "If a WhatsApp button is missing or a reminder can't be sent, it's likely because the vendor's WhatsApp number is missing or formatted incorrectly.",
    routePath: "/vendor-management",
    requiredPermissions: ["vendorManagement"],
    troubleshooting: [
      {
        problem:
          "The 'Send WhatsApp Reminder' button is disabled in Subscription Management, or a contact button is missing on a storefront.",
        solution:
          "1. Go to Vendor Management and find the vendor.\n2. Click to edit their profile.\n3. Find the 'WhatsApp Number' field.\n4. Ensure the number is present and includes the international country code without spaces or symbols (e.g., 263772123456).\n5. Save the vendor profile. The WhatsApp features should now work correctly.",
      },
    ],
  },
  {
    id: "fix-product-not-showing",
    title: "Fix Product Not Showing in Catalogue",
    module: "Product Management",
    category: "Troubleshooting",
    tags: ["product", "missing", "catalogue", "hidden"],
    keywords: ["status active", "publish", "stockout", "filters"],
    summary:
      "If a product exists but doesn't appear in a generated catalogue, it's usually due to its status or the catalogue's build filters.",
    routePath: "/product-management",
    requiredPermissions: ["productManagement", "createCatalogue"],
    troubleshooting: [
      {
        problem: "A product is not visible in the generated global catalogue.",
        solution:
          "1. Check Product Status: Go to Product Management. Ensure the product's status is 'active'.\n2. Check 'Publish' Flag: Confirm the 'Publish to Catalogue' toggle is enabled for that product.\n3. Check Stock Quantity: In 'Create Catalogue', see if the 'Include Stockouts' filter is disabled. If so, products with 0 stock are excluded.\n4. Check Catalogue Filters: On the 'Create Catalogue' page, ensure the 'Active Only' and 'Published Only' filters are set correctly for your needs.",
      },
    ],
  },
  {
    id: "export-html",
    title: "Export Offline HTML Catalogue",
    module: "Create Catalogue",
    category: "Features",
    tags: ["export", "download", "html", "offline"],
    keywords: ["share", "whatsapp", "document", "standalone"],
    summary:
      "Both Global Catalogues and Vendor Storefronts are generated as single, self-contained HTML files that work offline and can be shared easily.",
    routePath: "/catalogue-generator",
    requiredPermissions: ["createCatalogue", "createStorefront"],
    steps: [
      {
        title: "1. Generate",
        description: "Generate a Global Catalogue or Vendor Storefront.",
      },
      {
        title: "2. Locate Button",
        description:
          "After generation, a preview and action panel will appear. Locate the 'Download HTML' button.",
      },
      {
        title: "3. Download",
        description:
          "Click the button to save the .html file to your computer.",
      },
      {
        title: "4. Distribute",
        description:
          "This single file can be sent via email or on WhatsApp as a document. It requires no internet to view.",
      },
    ],
  },
  {
    id: "mark-deployed",
    title: "Mark Catalogue as Deployed",
    module: "Create Catalogue",
    category: "Best Practices",
    tags: ["deploy", "status", "lifecycle", "expiry"],
    keywords: ["generated", "deployed", "tracking", "expired"],
    summary:
      "'Deploying' a catalogue or storefront is an internal status change that activates its lifecycle tracking, including expiry dates.",
    routePath: "/catalogue-generator",
    requiredPermissions: ["createCatalogue", "createStorefront"],
    steps: [
      {
        title: "1. Generate",
        description: "Generate a Global Catalogue or Vendor Storefront.",
      },
      {
        title: "2. Locate Button",
        description:
          "In the success/preview frame, find the 'Deploy' or 'Mark Deployed' button.",
      },
      {
        title: "3. Click to Deploy",
        description:
          "Click this button after you have downloaded the file and are ready to distribute it.",
      },
      {
        title: "4. Confirm Status Change",
        description:
          "The catalogue's status will change from 'generated' to 'deployed' in the history list.",
      },
      {
        title: "5. Lifecycle Tracking",
        description:
          "The system will now track its expiry date and automatically change its status to 'expired' when the date is reached.",
      },
    ],
  },
  {
    id: "search-catalogue",
    title: "Search Products in Catalogue",
    module: "Catalogue Usage",
    category: "Getting Started",
    tags: ["search", "filter", "product", "catalogue"],
    keywords: ["find", "lookup", "client-side", "offline"],
    summary:
      "The generated HTML catalogues include a powerful client-side search to help users find products quickly, even when offline.",
    steps: [
      {
        title: "1. Open Catalogue",
        description:
          "Open the downloaded .html catalogue file in any web browser on a phone or computer.",
      },
      {
        title: "2. Find Search Bar",
        description: "Locate the search bar, usually at the top of the page.",
      },
      {
        title: "3. Type Query",
        description:
          "Type product names, categories, brands, or even product codes.",
      },
      {
        title: "4. Real-time Filtering",
        description: "The product list will filter instantly as you type.",
      },
      {
        title: "5. Use Filters",
        description:
          "Use the category and brand filter buttons to further narrow down the results.",
      },
    ],
  },
  {
    id: "staff-permissions",
    title: "Understand Staff Permissions",
    module: "Staff Management",
    category: "Best Practices",
    tags: ["permissions", "roles", "access", "security"],
    keywords: ["staff", "admin", "sysadmin", "hidden", "view", "edit"],
    summary:
      "Access to different parts of the iTred system is controlled by roles and permissions. SysAdmins can customize what each role can see and do.",
    routePath: "/role-menu-permissions",
    requiredPermissions: ["staffManagement"],
    steps: [
      {
        title: "1. Roles",
        description:
          "Each staff member is assigned a Role (e.g., 'Catalogue Officer').",
      },
      {
        title: "2. Permissions",
        description:
          "Each Role has a set of permissions for every menu item (e.g., 'createCatalogue').",
      },
      {
        title: "3. Permission Levels",
        description:
          "Levels include 'hidden', 'view', 'create', 'edit', 'approve', 'delete', and 'full'.",
      },
      {
        title: "4. View Permissions",
        description:
          "Go to Staff Management and click the 'Roles' tab to see the default templates.",
      },
      {
        title: "5. Edit Permissions",
        description:
          "A SysAdmin can click 'Edit Permissions' on a role template to change what that role can do.",
      },
      {
        title: "6. Access Denied",
        description:
          "If you see an 'Access Restricted' page, your role does not have permission for that item. Contact a SysAdmin to request access.",
      },
    ],
  },
];

const buildSearchText = (article: Omit<HowToArticle, "searchText">): string => {
  const safeTags = Array.isArray(article.tags) ? article.tags : [];
  const safeKeywords = Array.isArray(article.keywords) ? article.keywords : [];
  const safeSteps = Array.isArray(article.steps) ? article.steps : [];
  const safeWarnings = Array.isArray(article.warnings) ? article.warnings : [];
  const safeTroubleshooting = Array.isArray(article.troubleshooting) ? article.troubleshooting : [];
  const safeRelatedActions = Array.isArray(article.relatedActions) ? article.relatedActions : [];
  const safeRequiredPermissions = Array.isArray(article.requiredPermissions) ? article.requiredPermissions : [];

  const content = [
    article.title,
    article.title, // Weight title higher
    article.module,
    article.category,
    ...safeTags,
    ...safeKeywords,
    article.summary,
    article.routePath || "",
    ...safeSteps.map((s) => `${s.title} ${s.description}`),
    ...safeWarnings,
    ...safeTroubleshooting.map((t) => `${t.problem} ${t.solution}`),
    ...safeRelatedActions.map((a) => a.label),
    ...safeRequiredPermissions,
  ];
  return content
    .join(" ")
    .toLowerCase()
    .replace(/[^\w\s]/g, "");
};

export const allArticles: HowToArticle[] = articlesData.map((article) => ({
  ...article,
  searchText: buildSearchText(article),
}));

const ArticleCard: React.FC<{
  article: HowToArticle;
  queryTokens: string[];
}> = ({ article, queryTokens }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const highlight = (text: string) => {
    if (queryTokens.length === 0) return text;
    const regex = new RegExp(`(${queryTokens.join("|")})`, "gi");
    return text.split(regex).map((part, index) =>
      queryTokens.includes(part.toLowerCase()) ? (
        <span key={index} className="bg-brand-orange/20">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    <div className="border border-stone-200 bg-white">
      <div
        className="p-6 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs uppercase text-stone-400 font-bold tracking-widest">
              {article.module}
            </p>
            <h3 className="text-lg font-bold text-brand-charcoal mt-1">
              {highlight(article.title)}
            </h3>
            <p className="text-sm text-stone-600 mt-2 max-w-2xl">
              {highlight(article.summary)}
            </p>
          </div>
          <button className="p-2 text-stone-400">
            {isExpanded ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {article.routePath && (
            <StatusBadge
              status={`Route: ${article.routePath}`}
              variant="neutral"
            />
          )}
          {article.requiredPermissions?.map((p) => (
            <StatusBadge
              key={p}
              status={p}
              variant="info"
              icon={<Lock size={12} />}
            />
          ))}
        </div>
      </div>
      {isExpanded && (
        <div className="p-6 border-t border-stone-200 bg-stone-50/50">
          {article.steps && (
            <div className="mb-6">
              <h4 className="font-bold text-brand-charcoal mb-3">
                Step-by-Step Guide
              </h4>
              <ol className="list-decimal list-inside space-y-3">
                {(Array.isArray(article.steps) ? article.steps : []).map((step, i) => (
                  <li key={i} className="text-sm text-stone-700">
                    <strong className="font-bold text-stone-800">
                      {step.title}:
                    </strong>{" "}
                    {highlight(step.description)}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {article.troubleshooting && (
            <div className="mb-6">
              <h4 className="font-bold text-brand-charcoal mb-3">
                Troubleshooting
              </h4>
              {(Array.isArray(article.troubleshooting) ? article.troubleshooting : []).map((item, i) => (
                <div
                  key={i}
                  className="p-4 border-l-4 border-brand-orange bg-orange-50/30"
                >
                  <p className="font-bold text-stone-800">Problem:</p>
                  <p className="text-sm text-stone-700 mb-2">
                    {highlight(item.problem)}
                  </p>
                  <p className="font-bold text-stone-800">Solution:</p>
                  <p className="text-sm text-stone-700 whitespace-pre-line">
                    {highlight(item.solution)}
                  </p>
                </div>
              ))}
            </div>
          )}
          {article.requiredPermissions?.some(
            (p) =>
              !permissionService.canCreate(p) && !permissionService.canEdit(p),
          ) && (
            <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-800 text-sm mb-6">
              <strong className="font-bold">Permission Required:</strong> You
              may not have the necessary permissions (
              {(Array.isArray(article.requiredPermissions) ? article.requiredPermissions : []).join(", ")}) to perform this action.
              Please contact a SysAdmin to request access.
            </div>
          )}
          {article.routePath &&
            permissionService.hasMenuAccess(
              article.requiredPermissions?.[0] || "dashboard",
            ) && (
              <PrimaryButton onClick={() => navigate(article.routePath!)}>
                Go to {article.module}{" "}
                <ExternalLink size={14} className="ml-2" />
              </PrimaryButton>
            )}
        </div>
      )}
    </div>
  );
};

export const HowToPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const navigate = useNavigate();

  const categories = ["All", ...new Set(allArticles.map((a) => a.category))];

  const searchResults = useMemo(() => {
    const queryTokens = query
      .toLowerCase()
      .split(" ")
      .filter((token) => token.length > 1);

    if (queryTokens.length === 0 && activeCategory === "All") {
      return allArticles;
    }

    const filteredByCategory =
      activeCategory === "All"
        ? allArticles
        : allArticles.filter((a) => a.category === activeCategory);

    if (queryTokens.length === 0) {
      return filteredByCategory;
    }

    const scoredArticles = filteredByCategory.map((article) => {
      let score = 0;
      let foundTokens = 0;

      queryTokens.forEach((token) => {
        if (article.searchText.includes(token)) {
          foundTokens++;
          score += 1; // base score
          if (article.title.toLowerCase().includes(token)) score += 10;
          if ((Array.isArray(article.tags) ? article.tags : []).join(" ").toLowerCase().includes(token)) score += 5;
          if (article.summary.toLowerCase().includes(token)) score += 2;
          if (
            (Array.isArray(article.steps) ? article.steps : [])
              .map((s) => s.title.toLowerCase() + s.description.toLowerCase())
              .join(" ")
              .includes(token)
          )
            score += 2;
          if (article.routePath?.toLowerCase().includes(token)) score += 2;
        }
      });

      // Big bonus if all tokens are found
      if (foundTokens === queryTokens.length) {
        score += 20;
      }

      // Penalize if not all tokens are found
      if (foundTokens < queryTokens.length) {
        score = score / 2;
      }

      return { ...article, score };
    });

    return scoredArticles
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, activeCategory]);

  const quickActions = [
    { label: "Create Catalogue", route: AppRoute.CATALOGUE_GEN, icon: Layers },
    {
      label: "Create Storefront",
      route: AppRoute.VENDOR_STOREFRONT,
      icon: FileCode,
    },
    {
      label: "Manage Products",
      route: AppRoute.PRODUCT_MGMT,
      icon: ShoppingBag,
    },
    { label: "Access Hub", route: AppRoute.CAH, icon: MessageSquare },
    { label: "Manage Staff", route: AppRoute.STAFF_MGMT, icon: Users },
  ];

  return (
    <div className="pb-20 bg-white min-h-screen">
      <PageHeader
        title="How To & Help Centre"
        subtitle="Find guides, best practices, and troubleshooting steps for using the iTred system."
      />

      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-6 border-b border-stone-200">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search articles (e.g., 'create global catalogue', 'vendor storefront staff')..."
            className="w-full border-2 border-stone-200 bg-white p-4 pl-12 text-base font-medium text-brand-charcoal outline-none focus:border-brand-orange"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-brand-charcoal"
            >
              <X />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-2 ${
                activeCategory === cat
                  ? "bg-brand-orange border-brand-orange text-white"
                  : "bg-white border-stone-200 text-stone-500 hover:border-brand-charcoal hover:text-brand-charcoal"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 p-6">
        <div className="space-y-4">
          {searchResults.length > 0 ? (
            searchResults.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                queryTokens={query
                  .toLowerCase()
                  .split(" ")
                  .filter((t) => t.length > 1)}
              />
            ))
          ) : (
            <div className="text-center py-20">
              <h3 className="text-xl font-bold text-brand-charcoal">
                No Results Found
              </h3>
              <p className="text-stone-500 mt-2">
                Try adjusting your search query or category filter.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="p-4 border border-stone-200">
            <h4 className="font-bold text-brand-charcoal uppercase tracking-widest text-sm mb-4">
              Quick Actions
            </h4>
            <div className="space-y-2">
              {quickActions.map((action) => (
                <button
                  key={action.route}
                  onClick={() => navigate(`/${action.route}`)}
                  className="w-full flex items-center gap-3 p-3 text-left bg-stone-100 hover:bg-brand-orange hover:text-white transition-colors"
                >
                  <action.icon size={16} />
                  <span className="text-sm font-bold">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToPage;
