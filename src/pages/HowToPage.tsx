/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ChevronDown, Search, X } from "lucide-react";
import { staffConductRules, troubleshootingGuides } from "../data/manualData.ts";
import { ManualSection } from "../types/manual.ts";

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="border border-stone-200 bg-white p-4">
    <h3 className="text-xs font-black uppercase tracking-widest text-brand-orange mb-3">
      {title}
    </h3>
    <div className="text-sm text-stone-700 leading-relaxed space-y-3">
      {children}
    </div>
  </div>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2">
    {items.map((item) => (
      <li key={item} className="flex gap-2">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-brand-orange" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const manualSections: ManualSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    summary: "What SCI / iTred is and how the operating console works.",
    searchText:
      "getting started overview vendors products catalogues customers management performance",
    body: (
      <Panel title="Console Purpose">
        <p>
          SCI / iTred is a commerce operating console for vendor visibility,
          catalogues, WhatsApp activity, RPN management, finance control, asset
          tracking, and operational BI.
        </p>
        <Bullets
          items={[
            "Vendors are onboarded with identity, address, branch and contact details.",
            "Products are prepared with clean images, prices, stock and catalogue visibility settings.",
            "Catalogues are generated so customers can discover products and contact vendors.",
            "Staff log WhatsApp activity, follow-ups, complaints and customer intelligence.",
            "Managers monitor performance, approvals, finance reports, RPN activity and audit logs.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "login-security",
    title: "Staff Login & Session Security",
    summary: "Passcodes, first SysAdmin setup, timeouts and login problems.",
    searchText:
      "login passcode sysadmin setup session timeout suspended locked staff name missing",
    body: (
      <Panel title="Login Rules">
        <Bullets
          items={[
            "Use the Select Your Name dropdown on the login screen, then enter your passcode.",
            "If no staff exist, the system opens first SysAdmin setup so the primary administrator can be created.",
            "Suspended, archived or locked staff cannot log in.",
            "Do not share passcodes. Every action is linked to the logged-in staff profile.",
            "Session timeout logs users out after inactivity. SysAdmin can configure timeout settings.",
            "If a staff name does not appear, check Staff Management status and confirm the staff profile saved correctly.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "staff-permissions",
    title: "Staff Management & Permissions",
    summary: "Creating staff, assigning roles, desks and permissions.",
    searchText:
      "staff management permissions roles desk kyc duplicate code action menu finance reports print rpn thresholds",
    body: (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Staff Profiles">
          <Bullets
            items={[
              "Create staff with correct full name, display name, phone, email and assigned branch.",
              "Assign the right desk and role before giving access.",
              "Record KYC, personal and address details where required.",
              "Use active, suspended, locked and archived status carefully.",
              "Run Staff Code Integrity repair if old data creates duplicate staff codes.",
            ]}
          />
        </Panel>
        <Panel title="Menu vs Action Permissions">
          <p>
            Menu permission controls page access. Action permission controls
            what the user can do inside a page.
          </p>
          <Bullets
            items={[
              "finance.reports.print allows finance report printing.",
              "finance.assets.create or finance asset permissions control asset setup when configured.",
              "rpn.setThresholds controls RPN target changes.",
              "catalogue.overridePlanLimit controls plan-limit overrides where enabled.",
              "approvalQueue.approve allows managers to approve queued work.",
            ]}
          />
        </Panel>
      </div>
    ),
  },
  {
    id: "vendor-management",
    title: "Vendor Management",
    summary: "Creating complete vendor profiles and improving readiness.",
    searchText:
      "vendor management readiness logo banner branch suburb rpn sector campaign source products",
    body: (
      <Panel title="Vendor Setup">
        <Bullets
          items={[
            "Create the vendor profile and complete identity details.",
            "Add address details down to suburb so catalogues can be searched by city, district and suburb.",
            "Upload logo and banner. Images are optimized to WebP where implemented.",
            "Assign the vendor to the correct RPN, sector and category.",
            "Complete branches, staff contacts and delivery details.",
            "Readiness drops when logo, contact details, branches or products are missing.",
            "Good readiness improves catalogue quality and can reduce follow-up work.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "product-management",
    title: "Product Management",
    summary: "How product records become visible in catalogues.",
    searchText:
      "product management master library duplicate active publish catalogue vendor offers images metadata",
    body: (
      <Panel title="Product Visibility">
        <Bullets
          items={[
            "The intended model is a master product library with reusable products linked to vendors through vendor product offers.",
            "Avoid duplicate product records for every vendor when reusable product structures are available.",
            "Products must be active and publishToCatalogue must be true to appear in a catalogue.",
            "Product images and metadata improve search, customer trust and catalogue quality.",
            "If products do not appear, check active status, publishToCatalogue, selected vendor and regenerate the catalogue after changes.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "catalogue",
    title: "Catalogue Generation & Exported Catalogue",
    summary: "Generating fresh catalogues and understanding exported UX.",
    searchText:
      "catalogue generation export html search bubble orange dots products vendors hub staff branches terms plan entitlement",
    body: (
      <Panel title="Catalogue Export">
        <Bullets
          items={[
            "Select sector/category, vendors/products and WhatsApp Hub links before export.",
            "Export a fresh catalogue after changes. Old downloaded HTML files do not update automatically.",
            "The exported catalogue has a modern header, floating footer search bubble and clear X icon to reset search.",
            "The three orange dots menu opens Products, Vendors, Hub, Staff, Branches and Terms.",
            "Search supports products, vendor names, branches, city, district and suburb.",
            "Customers can WhatsApp or call the vendor from the product modal.",
            "Vendor plan limits control visibility. Excess products may be dropped if there is no credit or entitlement.",
            "One vendor exceeding a plan limit should not fail the whole catalogue.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "access-hub",
    title: "Commerce Access Hub / WhatsApp Links",
    summary: "Managing WhatsApp communities, groups and channels.",
    searchText:
      "commerce access hub whatsapp links groups communities channels invalid url member follower counts",
    body: (
      <Panel title="Hub Links">
        <Bullets
          items={[
            "Access Hub stores WhatsApp communities, groups and channels.",
            "Selected links can be included in exported catalogues.",
            "Invalid WhatsApp URLs will not show correctly.",
            "Member and follower counts help BI measure channel reach.",
            "Hub links support vendor visibility and customer discovery.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "whatsapp-intelligence",
    title: "WhatsApp Activity & Customer Intelligence",
    summary: "Logging activity and turning it into operational intelligence.",
    searchText:
      "whatsapp activity customer intelligence query complaint compliment follow up sentiment fraud alerts",
    body: (
      <Panel title="Activity Logging">
        <Bullets
          items={[
            "Log customer number, vendor/product, date and activity type.",
            "Record whether the item is a query, complaint, compliment, lead, follow-up or alert.",
            "Capture action required, follow-up date, assigned staff, region, sector and product tags.",
            "The system groups similar logs by product, vendor, region and market.",
            "Managers use this BI to detect demand, complaints, fraud alerts and customer sentiment.",
            "Live alerts and notification feeds may be created from repeated patterns.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "spot-checks",
    title: "Inventory Spot Checks",
    summary: "Using lead pressure to recommend stock audits.",
    searchText:
      "inventory spot checks whatsapp hits lead pressure stock audit starting quantity restocked physical count variance",
    body: (
      <Panel title="Spot Check Flow">
        <Bullets
          items={[
            "Customer hits or WhatsApp leads increase.",
            "Lead pressure score rises.",
            "The system recommends a stock audit.",
            "Staff records starting vendor quantity.",
            "Staff enters physical count before restocking.",
            "System estimates sales movement and classifies variance.",
            "Vendor receives advisory and office updates stock/reliability score.",
            "Estimated Sales Qty = Starting Qty + Restocked Qty - Physical Count Qty.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "rpn",
    title: "RPN Management & Performance",
    summary: "Managing RPN profiles, targets and campaign intelligence.",
    searchText:
      "rpn management performance daily weekly monthly target active vendors churn campaign radio tv roadshows whatsapp referral cah roi",
    body: (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="RPN Profiles">
          <Bullets
            items={[
              "Record RPN KYC, DOB, contact details and active/suspended status.",
              "Assign vendors to the correct RPN.",
              "Editing RPN profiles requires permission.",
            ]}
          />
        </Panel>
        <Panel title="Performance & Campaigns">
          <Bullets
            items={[
              "Track daily, weekly and monthly onboarding targets.",
              "Review active vendors, returning vendors, churn and revenue contribution.",
              "Use best areas, best sectors and best days of month to guide field work.",
              "Market resilience score and bonus/support review help management decide interventions.",
              "Campaign sources include radio, TV, roadshows, WhatsApp, referral and CAH.",
              "Reports measure onboarding, revenue, retention and ROI.",
            ]}
          />
        </Panel>
      </div>
    ),
  },
  {
    id: "finance-accounts",
    title: "Finance & Accounts",
    summary: "Finance Desk, COA, cash/bank ledger and future accounting areas.",
    searchText:
      "finance accounts chart of accounts coa cash bank ledger check writer receipts deposits journal rpn payments",
    body: (
      <Panel title="Finance Desk">
        <Bullets
          items={[
            "Chart of Accounts is the accounting list used to classify assets, liabilities, income, expenses and equity.",
            "Cash/Bank Accounts include cash on hand, bank account, mobile money wallet and card processor accounts linked to COA.",
            "Cash/Bank Ledger shows transactions by accountID and tracks debit, credit and running balance.",
            "The ledger can be filtered by period, account and status.",
            "Check Writer / Payments, Receipts & Deposits, Journal Entries and RPN Payments Ledger are controlled finance areas and must only be used where enabled.",
            "A journal must balance debit and credit before posting when that module is implemented.",
            "RPN Payments Ledger tracks onboarding commissions, recurring commission, due, paid and balance using rates controlled in settings when configured.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "asset-register",
    title: "Asset Register & Maintenance",
    summary: "Tracking SCI company property, custody and maintenance.",
    searchText:
      "asset register maintenance starlink routers phones furniture vehicles buildings promotional roadshow training data centre custody disposal",
    body: (
      <Panel title="Company Assets">
        <Bullets
          items={[
            "The Asset Register tracks Starlink kits, routers, RPN phones, furniture, vehicles, buildings, promotional kits, roadshow equipment, training equipment and data centre equipment.",
            "Each asset record should include asset code, category, serial/IMEI/reg number, purchase price, supplier, location, custodian, COA asset account, condition and status.",
            "Maintenance records cover inspection, repair, service, replacement, connectivity subscription, insurance/licence renewal, next service date and maintenance cost linked to COA.",
            "Custody records should show which staff, RPN, office, CAH site or vendor has the asset and the return condition.",
            "Disposal can include sold, scrapped, written off, donated, stolen or lost and may require approval where configured.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "finance-reports",
    title: "Finance Reports & Printing",
    summary: "Controlled finance reports, filters, print/PDF and approvals.",
    searchText:
      "finance reports printing pdf filters approval cash bank ledger transaction coa balances receipts payments journal rpn commissions asset audit",
    body: (
      <Panel title="Reports and Print Control">
        <Bullets
          items={[
            "Finance Reports include Cash/Bank Ledger, Transaction Listing, Chart of Accounts, Cash/Bank Balances, Receipts, Payments, Journal Entries, RPN Commissions, Asset Register, Asset Maintenance, Approval Report and Print/Export Audit Report.",
            "Filters include period, account, cash/bank account, transaction type, status, vendor, RPN, staff, payee/payer and asset category.",
            "Printing requires finance report print permission.",
            "Sensitive reports may require approval before print or PDF download.",
            "Printed reports must show organization header, printed by staff name, print date/time and report reference.",
            "Every print, PDF download and export is audit logged.",
            "Unauthorized printing is blocked.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "notifications-approvals",
    title: "Notifications & Approval Queue",
    summary: "Alerts, approvals, returns and sensitive action review.",
    searchText:
      "notifications approval queue pending rejected returned tasks vendor readiness follow ups stock finance asset maintenance report print approvals",
    body: (
      <Panel title="Operational Alerts">
        <Bullets
          items={[
            "Notifications show approvals pending, tasks due, vendor readiness issues, WhatsApp follow-ups, stock audit alerts, finance approval requests, asset maintenance due and report print approvals.",
            "Approval Queue allows managers to approve, reject or return work for correction.",
            "Sensitive finance actions should go through approval where configured.",
            "Print approvals can be requested for sensitive finance reports.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "audit-logs",
    title: "Staff Audit Logs",
    summary: "Accountability records for sensitive actions.",
    searchText:
      "staff audit logs login logout settings permission vendor product finance asset report printing deleted approval decisions",
    body: (
      <Panel title="Audit Coverage">
        <Bullets
          items={[
            "Audit logs record login/logout, settings changes, permission changes, vendor/product changes and deleted records.",
            "Finance actions, asset actions, report printing and approval decisions are logged.",
            "Managers use audit logs for accountability, investigation and BI.",
          ]}
        />
      </Panel>
    ),
  },
  {
    id: "daily-routine",
    title: "Daily Operating Routine",
    summary: "Morning, during-day and end-of-day checks.",
    searchText:
      "daily operating routine morning notifications approval queue rpn target whatsapp follow ups finance approvals end of day",
    body: (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Morning">
          <Bullets
            items={[
              "Log in.",
              "Check notifications.",
              "Check approval queue.",
              "Check RPN target alerts.",
              "Check WhatsApp follow-ups.",
              "Check finance approvals.",
            ]}
          />
        </Panel>
        <Panel title="During Day">
          <Bullets
            items={[
              "Onboard vendors.",
              "Update products.",
              "Log WhatsApp activity.",
              "Create spot checks.",
              "Update vendor readiness.",
              "Record finance transactions where enabled.",
              "Update asset custody/maintenance.",
            ]}
          />
        </Panel>
        <Panel title="End of Day">
          <Bullets
            items={[
              "Review staff logs.",
              "Review WhatsApp reports.",
              "Review RPN performance.",
              "Review finance dashboard.",
              "Resolve pending notifications.",
              "Prepare next-day follow-ups.",
            ]}
          />
        </Panel>
      </div>
    ),
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary: "Common problems, likely causes and fixes.",
    searchText:
      "troubleshooting no products catalogue no hub links staff missing duplicate code print finance asset missing coa seeded old design",
    body: (
      <div className="overflow-x-auto border border-stone-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr>
              <th className="px-4 py-3">Problem</th>
              <th className="px-4 py-3">Likely Cause</th>
              <th className="px-4 py-3">Fix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {troubleshootingGuides.map(({ problem, likelyCause, fix }) => (
              <tr key={problem}>
                <td className="px-4 py-3 font-bold text-brand-charcoal">{problem}</td>
                <td className="px-4 py-3 text-stone-600">{likelyCause}</td>
                <td className="px-4 py-3 text-stone-600">{fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "conduct",
    title: "Staff Conduct Rules",
    summary: "Non-negotiable operating rules for all staff.",
    searchText:
      "staff conduct rules passcodes duplicate records fake whatsapp activity finance reports assets custody permissions approval audit",
    body: (
      <Panel title="Rules">
        <Bullets items={staffConductRules} />
      </Panel>
    ),
  },
];

export const HowToPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("getting-started");

  const filteredSections = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return manualSections;
    return manualSections.filter(
      (section) =>
        section.title.toLowerCase().includes(search) ||
        section.summary.toLowerCase().includes(search) ||
        section.searchText.includes(search),
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-6 pb-20">
      <section className="bg-white border border-stone-200 p-5 md:p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-brand-orange">
          SCI / iTred Operations Manual
        </p>
        <h1 className="text-2xl font-black text-brand-charcoal mt-2">
          How To / Staff Operating Guide
        </h1>
        <p className="text-sm text-stone-600 mt-3 max-w-4xl">
          Practical instructions for vendor visibility, catalogues, WhatsApp
          activity, RPN management, finance control, asset tracking, approvals
          and daily operations.
        </p>
      </section>

      <section className="sticky top-0 z-20 bg-stone-50 py-4">
        <div className="relative bg-white border-2 border-stone-200">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            size={18}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-white py-4 pl-12 pr-12 text-sm font-bold text-brand-charcoal outline-none focus:border-brand-orange"
            placeholder="Search finance reports, catalogue, RPN, staff permissions, asset register..."
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-brand-orange"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <aside className="bg-white border border-stone-200 p-3 h-fit xl:sticky xl:top-24">
          <h2 className="text-xs font-black uppercase tracking-widest text-brand-charcoal flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-brand-orange" />
            Manual Sections
          </h2>
          <div className="space-y-1">
            {filteredSections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setOpenId(section.id)}
                className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                  openId === section.id
                    ? "bg-brand-charcoal text-white"
                    : "text-stone-600 hover:bg-orange-50 hover:text-brand-orange"
                }`}
              >
                {index + 1}. {section.title}
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-3">
          {filteredSections.length === 0 && (
            <div className="bg-white border border-stone-200 p-10 text-center">
              <AlertTriangle className="mx-auto text-stone-300 mb-3" />
              <p className="text-sm font-bold text-stone-500">
                No manual section matches the search.
              </p>
            </div>
          )}
          {filteredSections.map((section) => {
            const isOpen = openId === section.id;
            return (
              <article key={section.id} className="bg-white border border-stone-200">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? "" : section.id)}
                  className="w-full flex items-start justify-between gap-4 p-4 md:p-5 text-left"
                >
                  <div>
                    <h2 className="text-sm md:text-base font-black uppercase tracking-tight text-brand-charcoal">
                      {section.title}
                    </h2>
                    <p className="text-xs md:text-sm text-stone-500 mt-1">
                      {section.summary}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`mt-1 shrink-0 text-brand-orange transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-stone-100 p-4 md:p-5 bg-stone-50">
                    {section.body}
                  </div>
                )}
              </article>
            );
          })}
        </main>
      </section>
    </div>
  );
};

export default HowToPage;
