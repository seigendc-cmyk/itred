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
  // 1. Welcome & Getting Started
  // ==========================================
  {
    id: "gs-1",
    title: "Welcome to iTred & Console Overview",
    category: "Getting Started",
    module: "Command Centre",
    route: "/dashboard",
    audience: ["All Staff"],
    summary: "Introduction to the iTred operating system and its purpose.",
    tags: ["welcome", "overview", "purpose", "system"],
    steps: [
      "iTred is the vendor discovery, catalogue, storefront, WhatsApp visibility, RPN and operations console powered by seiGEN Commerce.",
      "The system serves as a central hub to manage vendors, build digital catalogues, track field agents, and analyze WhatsApp community data.",
      "Your access to specific desks and menus depends on your assigned role (e.g., SysAdmin, Backoffice Operator, CAH Officer, RPN Manager, Junior Staff).",
      "Navigate through the left sidebar to access the modules assigned to your desk.",
    ],
  },
  {
    id: "gs-2",
    title: "Login & Staff Access Rules",
    category: "Getting Started",
    module: "Authentication",
    audience: ["All Staff"],
    summary: "How to access the console and maintain session security.",
    tags: ["login", "access", "passcode", "timeout", "suspended"],
    steps: [
      "On the login page, use the 'Select Your Name' dropdown to find your profile. Only active staff appear here.",
      "If no staff exist yet, the system enters 'First SysAdmin Setup' mode automatically.",
      "Enter your unique 6-digit passcode. If you enter it incorrectly 5 times, your account locks.",
      "Suspended or locked staff cannot log in and must contact a SysAdmin.",
      "For security, your session will automatically time out after a period of inactivity (configurable in System Settings).",
      "All login attempts, logouts, and access denials are recorded in the immutable Staff Audit Logs.",
    ],
  },
  {
    id: "gs-3",
    title: "Daily Operating Routine",
    category: "Getting Started",
    module: "Operations",
    audience: ["All Staff"],
    summary: "Standard operating procedures for daily system management.",
    tags: ["routine", "daily", "checklist", "morning", "evening"],
    steps: [
      "MORNING: Log in securely. Check the Notification Bell for urgent alerts. Review the Approval Queue if you are a manager. Check RPN threshold alerts and pending WhatsApp follow-ups.",
      "DURING DAY: Update vendor and product registries. Log WhatsApp activities accurately. Verify catalogue readiness and follow up on escalated vendor issues.",
      "END OF DAY: Review staff logs (if SysAdmin). Check WhatsApp Performance Reports. Review RPN onboarding numbers. Resolve pending notifications before logging out.",
    ],
  },
  {
    id: "gs-4",
    title: "Staff Conduct Rules",
    category: "Getting Started",
    module: "Governance",
    audience: ["All Staff"],
    summary: "Critical rules of engagement for all system users.",
    tags: ["rules", "conduct", "policy", "warnings"],
    steps: [
      "DO NOT create duplicate staff, vendor, or product records. Use the search functions first.",
      "DO NOT share your 6-digit passcode. All actions are permanently tied to your profile in the audit ledger.",
      "DO NOT attempt to edit permissions without proper authority.",
      "DO NOT upload poor-quality, irrelevant, or massive images. Ensure identity assets look professional.",
      "DO NOT publish incomplete vendor or product data to the live registries.",
      "Every click, edit, and deletion is recorded. Operate with integrity.",
    ],
  },
  // ==========================================
  // 2. Staff, Roles & Security
  // ==========================================
  {
    id: "srs-1",
    title: "Staff Management & KYC",
    category: "Staff, Roles & Security",
    module: "Staff Management",
    route: "/staff-management",
    audience: ["SysAdmin", "Admin"],
    permissionsNeeded: ["staffManagement"],
    summary: "Creating staff profiles, enforcing code integrity, and KYC.",
    tags: ["staff", "add", "code", "integrity", "duplicate", "kyc"],
    steps: [
      "Click 'Add Staff' to create a new profile. The system ensures staff codes are unique and generated sequentially.",
      "If you encounter a duplicate code issue from old data, use the 'Staff Code Integrity' panel to scan and repair duplicates.",
      "SysAdmins can manually 'Generate New Staff Code' for an existing user if a conflict occurs.",
      "Assign the appropriate Role, Desk, and Permissions. The 'Viewer' role is the safest default.",
      "Use the 'Personal, Address & KYC Details' tabs to record ID numbers and upload vetting documents.",
      "Use the action buttons in the registry to Suspend, Lock, or Reactivate staff immediately.",
    ],
  },
  {
    id: "srs-2",
    title: "Role, Menu & Action Permissions",
    category: "Staff, Roles & Security",
    module: "Role & Menu Permissions",
    route: "/role-menu-permissions",
    audience: ["SysAdmin"],
    permissionsNeeded: ["roles.editPermissions"],
    summary: "Controlling system access down to the specific action.",
    tags: ["permissions", "roles", "access", "action", "menu"],
    steps: [
      "Menu Permissions dictate which pages appear in the sidebar (e.g., Hidden, View, Full).",
      "Action Permissions control specific sensitive buttons. Only users with the 'roles.editPermissions' authority can change these.",
      "Examples of Action Permissions include: 'roles.editPermissions', 'rpn.editAgent', 'rpn.setThresholds', 'staff.editKycDetails', 'approvalQueue.approve', 'vendor.approve', 'product.approve'.",
      "You can apply a Role Template to multiple staff at once, or edit an individual's permissions to override their template.",
    ],
  },
  {
    id: "srs-3",
    title: "Approval Queue Workflows",
    category: "Staff, Roles & Security",
    module: "Approval Queue",
    route: "/approval-queue",
    audience: ["Admin", "SysAdmin", "Junior Staff"],
    permissionsNeeded: ["approvalQueue.view", "approvalQueue.approve"],
    summary: "How junior staff submissions are vetted before going live.",
    tags: ["approval", "queue", "pending", "manager", "reject", "return"],
    steps: [
      "When Junior Staff edit sensitive data (like prices or creating vendors), they cannot save directly. They must submit it for approval.",
      "The record enters a 'pending_review' state and will not appear in live catalogues until approved.",
      "Managers with 'approvalQueue.approve' permission must review the queue.",
      "Managers can Approve (commits the change), Reject (discards the change), or Return for Correction (sends back with notes).",
      "All approval actions are heavily audited.",
    ],
  },
  {
    id: "srs-4",
    title: "Staff Audit & Behaviour Logs",
    category: "Staff, Roles & Security",
    module: "Staff Access Logs",
    route: "/staff-access-logs",
    audience: ["SysAdmin"],
    permissionsNeeded: ["staffAccessLogs"],
    summary: "Monitoring the immutable ledger of system activity.",
    tags: ["audit", "logs", "ledger", "immutable", "tracking"],
    steps: [
      "The system records all sensitive actions including: logins, logouts, access denied attempts, record creations, updates, deletions, and setting changes.",
      "Catalogue generations, WhatsApp logs, and permission changes are also strictly tracked.",
      "Use the filters to search by Staff Member, Module, or Severity (Info, Warning, High, Critical).",
      "Managers must review logs regularly to ensure accountability and detect anomalies.",
    ],
  },
  {
    id: "srs-5",
    title: "Notification Bell & Alerts",
    category: "Staff, Roles & Security",
    module: "Notifications",
    route: "/notifications",
    audience: ["All Staff"],
    summary:
      "Notifications page is active for system alerts, approval alerts, staff task alerts, and operational follow-ups.",
    tags: ["notifications", "bell", "alerts", "dedupe", "resolve"],
    steps: [
      "The bell icon in the top right shows a red badge for unread critical or high-priority alerts.",
      "Click the bell to view latest unread alerts, or use View All Notifications to open the full Notifications page.",
      "Use the Notifications page to filter by status, priority, type, assigned staff member, or search text.",
      "Staff can view their own notifications and mark them read or unread.",
      "Managers with the right permissions can view all notifications, resolve operational alerts, and archive closed noise.",
      "Alerts are intelligently deduplicated by the system to prevent spam.",
      "Notification actions are audit logged for accountability.",
    ],
  },
  {
    id: "srs-6",
    title: "Staff Tasks",
    category: "Staff, Roles & Security",
    module: "Staff Tasks",
    route: "/staff-tasks",
    audience: ["SysAdmin", "Admin", "Managers", "Junior Staff"],
    permissionsNeeded: [
      "staffTasks.view",
      "staffTasks.create",
      "staffTasks.assign",
      "staffTasks.updateStatus",
      "staffTasks.review",
    ],
    summary:
      "Operational task module where managers assign work, staff complete tasks, and managers review completed work.",
    tags: ["tasks", "staff", "assign", "complete", "review", "audit"],
    steps: [
      "Managers use Create Task to assign a staff member, title, description, module, priority, and due date.",
      "Staff use My Assigned Tasks to move their own work from Open to In Progress, then Completed.",
      "Managers use Completed / Review Queue to review completed tasks and close the loop.",
      "Managers can cancel Open or In Progress tasks when work is no longer required.",
      "Overdue tasks are flagged when the due date is before today and the task is not completed, reviewed, or cancelled.",
      "Task creation, status changes, reviews, and cancellations are recorded in Staff Audit Logs.",
    ],
  },
  // ==========================================
  // 3. System Administration
  // ==========================================
  {
    id: "sys-1",
    title: "System Settings Configuration",
    category: "System Settings",
    module: "System Settings",
    route: "/system-settings",
    audience: ["SysAdmin"],
    permissionsNeeded: ["systemSettings"],
    summary: "Configuring global parameters, timeouts, and logos.",
    tags: ["settings", "timeout", "logo", "thresholds", "feedback"],
    steps: [
      "Global Catalogue Logo: Upload the master logo here. Any image format is accepted and will be auto-converted/optimized to WebP for catalogue use.",
      "RPN Performance Thresholds: Set the daily/weekly/monthly targets and churn warnings that trigger BI alerts.",
      "Session Timeout: Configure how many minutes of inactivity will trigger an automatic security logout (e.g., 30 minutes).",
      "Contact Routes: Set the default WhatsApp feedback numbers used in catalogues and storefronts.",
      "Security Warning: Only highly trusted SysAdmins should edit these settings, as they impact the entire network.",
    ],
  },
  // ==========================================
  // 4. Vendor & Product Operations
  // ==========================================
  {
    id: "vo-1",
    title: "Vendor Management",
    category: "Vendor Operations",
    module: "Vendor Management",
    route: "/vendor-management",
    audience: ["Admin", "Backoffice"],
    permissionsNeeded: ["vendor.createDraft", "vendor.approve"],
    summary: "Creating vendors, uploading assets, and ensuring completeness.",
    tags: ["vendor", "add", "duplicates", "logo", "banner", "webp"],
    steps: [
      "When creating a vendor, watch the Duplicate Intelligence panel. Do not create a duplicate identity if a strong match exists.",
      "Upload the Vendor Logo and Banner in the Identity Assets section. Any image format is accepted; the system will automatically optimize and save it as a lightweight WebP.",
      "Ensure all Branches, Staff, and Delivery details are completely filled out, as these are exported directly to the vendor's storefronts.",
      "These identity assets and details are critical for a professional appearance in generated catalogues.",
    ],
    warnings: [
      "Junior staff saving vendor changes will trigger an approval request. It will not be active until a manager approves.",
    ],
  },
  {
    id: "po-1",
    title: "Product Management & Visibility",
    category: "Product Operations",
    module: "Product Management",
    route: "/product-management",
    audience: ["Admin", "Backoffice", "Product Data Desk"],
    permissionsNeeded: ["product.createDraft", "product.approve"],
    summary: "Managing inventory, pricing, and visibility rules.",
    tags: ["product", "add", "price", "stock", "publish"],
    steps: [
      "When adding a product, you MUST select a parent vendor and branch first.",
      "Provide clear details: Name, Category, Price, Stock, and Image.",
      "Watch for duplicate product warnings. Do not create identical SKUs for the same vendor.",
      "CRITICAL: A product will ONLY appear in catalogues if its status is 'Active' AND 'Publish to Catalogue' is true.",
      "Price and stock changes are highly sensitive and are explicitly flagged in the Staff Audit Logs.",
    ],
  },
  // ==========================================
  // 5. Catalogue & Storefronts
  // ==========================================
  {
    id: "cs-1",
    title: "Create Catalogue & Export Procedures",
    category: "Catalogue & Storefronts",
    module: "Create Catalogue",
    route: "/catalogue-generator",
    audience: ["Admin", "Catalogue Deployment Desk"],
    permissionsNeeded: ["createCatalogue"],
    summary: "Compiling static HTML payload documents.",
    tags: ["catalogue", "export", "build", "html", "tabs", "whatsapp"],
    steps: [
      "Select the Sector, Category, Products, Vendors, and Hub Links you wish to include.",
      "Generate the catalogue and click Download Offline HTML.",
      "IMPORTANT: The downloaded file is static. Old downloaded catalogues do not update automatically when you change prices.",
      "To push updates to customers, you must generate a fresh catalogue and distribute the new file.",
      "The exported catalogue includes tabs for: Products, Vendors, Hub Links, Staff Directory, Branch Directory, and Terms.",
      "The offline search bar supports fuzzy matching across products, vendors, and locations.",
      "All WhatsApp and Call buttons inside the catalogue automatically route customers directly to the correct vendor.",
    ],
    checks: [
      "If a catalogue does not show products, ensure: 1) Products are active. 2) PublishToCatalogue is true. 3) The vendor is selected. 4) You generated a fresh file after saving.",
    ],
  },
  {
    id: "cs-2",
    title: "Catalogue Troubleshooting Guide",
    category: "Catalogue & Storefronts",
    module: "Troubleshooting",
    audience: ["Catalogue Deployment Desk", "Admin"],
    summary: "Quick fixes for common catalogue generation issues.",
    tags: ["troubleshoot", "catalogue", "missing", "broken", "links", "ios"],
    steps: [
      "• PROBLEM: No products showing ➔ CAUSE: Product not active/published or old file ➔ FIX: Update product status and regenerate catalogue.",
      "• PROBLEM: No Hub links ➔ CAUSE: Links not selected or invalid WhatsApp URL ➔ FIX: Check CAH setup and re-select links.",
      "• PROBLEM: Logo missing ➔ CAUSE: System Settings logo not uploaded or Storage rules issue ➔ FIX: Re-upload logo in System Settings.",
      "• PROBLEM: Old file still broken ➔ CAUSE: File was downloaded before a system fix ➔ FIX: Export a fresh file from the console.",
      "• PROBLEM: iPhone issues ➔ CAUSE: iOS restrictions on downloaded files ➔ FIX: Advise user to use the hosted/online link where possible.",
      "• PROBLEM: Browser warning ➔ CAUSE: Compatibility ➔ FIX: Advise users to open the file in Google Chrome for best results.",
    ],
  },
  // ==========================================
  // 6. Commerce Access Hub
  // ==========================================
  {
    id: "cah-1",
    title: "Commerce Access Hub (CAH) Links",
    category: "Commerce Access Hub",
    module: "Access Hub",
    route: "/commerce-access-hub",
    audience: ["Admin", "CAH Operations Desk"],
    permissionsNeeded: ["accessHub", "create"],
    summary: "Managing WhatsApp distribution communities.",
    tags: ["cah", "links", "whatsapp", "hub", "followers"],
    steps: [
      "Hub links are managed centrally in the CAH / Access Hub module.",
      "Links must have a valid WhatsApp URL (wa.me, chat.whatsapp.com, etc.).",
      "When you build a catalogue, selected Hub links are exported into the catalogue's 'Hub' tab for customers to join.",
      "Ensure you assign the correct Sector and Category to the link. This helps users and staff discover the right group.",
      "Regularly update the Follower/Member counts on the link cards to feed the BI growth reports.",
    ],
  },
  // ==========================================
  // 7. WhatsApp Activity & BI
  // ==========================================
  {
    id: "wa-1",
    title: "WhatsApp Activity Logging",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Activity",
    route: "/whatsapp-activity",
    audience: ["Admin", "Backoffice", "Staff"],
    permissionsNeeded: ["whatsappActivity"],
    summary: "Capturing intelligence from social channels.",
    tags: ["whatsapp", "activity", "log", "leads", "bi"],
    steps: [
      "Log every meaningful interaction (leads, follow-ups, customer enquiries, CAH activity).",
      "Staff must record real actions and accurate outcomes, not fake activity, as this data directly feeds the BI reports.",
      "Assign follow-ups to specific RPN agents or backend staff if a request is unresolved.",
    ],
  },
  {
    id: "wa-2",
    title: "WhatsApp Performance Reports",
    category: "WhatsApp Activity & BI",
    module: "WhatsApp Reports",
    route: "/whatsapp-performance-reports",
    audience: ["Admin", "BI & Analytics Desk"],
    permissionsNeeded: ["whatsappActivity"],
    summary: "Evaluating operational efficiency and vendor responsiveness.",
    tags: ["whatsapp", "reports", "performance", "vendor", "dedupe"],
    steps: [
      "Use the reports to track vendor performance, response times, and missed responses.",
      "The system generates automated notifications for overdue follow-ups or critical risks.",
      "These notifications are deduplicated daily to avoid spamming the bell icon.",
      "Use these reports to improve vendor impact, and escalate issues via the Follow-up Desk if vendors routinely ignore leads.",
    ],
  },
  // ==========================================
  // 8. RPN & Field Network
  // ==========================================
  {
    id: "rpn-1",
    title: "RPN Agent Management",
    category: "RPN & Field Network",
    module: "RPN Management",
    route: "/rpn-management",
    audience: ["Admin", "RPN Management Desk"],
    permissionsNeeded: ["rpn.editAgent"],
    summary: "Managing field agent profiles and vendor assignments.",
    tags: ["rpn", "agent", "kyc", "governance", "status"],
    steps: [
      "Only users with the 'rpn.editAgent' permission can modify agent profiles.",
      "Record Date of Birth, National ID, and KYC vetting documents in the agent profile.",
      "Vendors mapped to an agent dictate the agent's onboarding and collection metrics.",
      "Ensure RPN profile governance by strictly maintaining their 'active' or 'suspended' status.",
    ],
  },
  {
    id: "rpn-2",
    title: "RPN Performance Control",
    category: "RPN & Field Network",
    module: "RPN Performance",
    route: "/rpn-performance",
    audience: ["Admin", "RPN Management Desk"],
    summary: "Monitoring and enforcing onboarding and value targets.",
    tags: ["rpn", "performance", "thresholds", "mrr", "churn"],
    steps: [
      "RPN Performance tracks daily onboarding against the Daily Onboarding Threshold.",
      "It monitors weekly and monthly targets to ensure field efficiency.",
      "The report automatically sums the Monthly Recurring Revenue (MRR) of active vendors attached to an RPN.",
      "It calculates Churn Rate based on vendors lost. Threshold settings are controlled in System Settings.",
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
    "Daily Operations",
    "Vendor Operations",
    "Product Operations",
    "Catalogue & Storefronts",
    "Commerce Access Hub",
    "WhatsApp Activity & BI",
    "RPN & Field Network",
    "Staff, Roles & Security",
    "System Settings",
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
