/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

const sections = [
  {
    title: "Getting Started",
    body:
      "SCI / iTred is the operations console for vendor visibility, catalogues, WhatsApp activity, RPN management, finance control, asset tracking, reports, approvals and operational BI.",
  },
  {
    title: "Staff Login & Security",
    body:
      "Staff select their name, enter their passcode, and access only the menus and actions allowed by their role. Suspended staff cannot log in. Sensitive actions are audit logged.",
  },
  {
    title: "Vendor & Product Operations",
    body:
      "Create vendor profiles, complete address details up to suburb, upload identity assets, add branches, staff and delivery details, and ensure products are active and published before catalogue export.",
  },
  {
    title: "Catalogue Generation",
    body:
      "Generate fresh catalogues after vendor, product or Hub link changes. Old downloaded HTML files do not update automatically. The exported catalogue includes products, vendors, Hub links, staff, branches and terms.",
  },
  {
    title: "WhatsApp Activity & BI",
    body:
      "Log customer enquiries, complaints, compliments, product requests and follow-ups. The system groups activity by product, vendor, region and sector to support market intelligence.",
  },
  {
    title: "Inventory Spot Checks",
    body:
      "Use product hits and WhatsApp demand signals to recommend stock audits. Physical counts help estimate sales movement and verify catalogue stock accuracy.",
  },
  {
    title: "RPN Performance",
    body:
      "Monitor onboarding targets, active vendors, churn, best sectors, best areas, revenue contribution, campaign attribution, market resilience and bonus/support recommendations.",
  },
  {
    title: "Finance & Accounts",
    body:
      "Finance includes Chart of Accounts, Cash/Bank Accounts, ledgers, payments, receipts, journals, RPN commissions, asset register, maintenance tracking and finance reports.",
  },
  {
    title: "Asset Register",
    body:
      "Track Starlink kits, routers, furniture, buildings, vehicles, phones issued to RPN, promotional kits and other assets. Record custody, maintenance, disposal and COA links.",
  },
  {
    title: "Reports, Printing & Approvals",
    body:
      "Finance reports can be filtered by period, account, staff, vendor, RPN and status. Sensitive reports require permission and may go through approval before printing or PDF download.",
  },
];

const HowToPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <section className="bg-white border border-slate-200 p-6">
        <p className="text-xs font-black uppercase tracking-wide text-orange-600">
          SCI / iTred Operations Manual
        </p>
        <h1 className="text-2xl font-black text-slate-900 mt-2">
          How To Use the System
        </h1>
        <p className="text-sm text-slate-600 mt-3 max-w-4xl">
          This guide explains the current SCI / iTred console modules, staff
          controls, finance upgrades, catalogue operations and management BI
          workflow.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((section) => (
          <article
            key={section.title}
            className="bg-white border border-slate-200 p-5"
          >
            <h2 className="text-sm font-black uppercase text-slate-900">
              {section.title}
            </h2>
            <p className="text-sm text-slate-600 mt-3 leading-6">
              {section.body}
            </p>
          </article>
        ))}
      </section>

      <section className="bg-orange-50 border border-orange-200 p-5">
        <h2 className="text-sm font-black uppercase text-orange-700">
          Staff Conduct Rules
        </h2>
        <ul className="text-sm text-slate-700 mt-3 space-y-2 list-disc pl-5">
          <li>Do not share passcodes.</li>
          <li>Do not create duplicate vendor, product or staff records.</li>
          <li>Do not print finance reports without permission.</li>
          <li>Do not issue assets without custody records.</li>
          <li>All sensitive actions are recorded in audit logs.</li>
        </ul>
      </section>
    </div>
  );
};

export default HowToPage;
