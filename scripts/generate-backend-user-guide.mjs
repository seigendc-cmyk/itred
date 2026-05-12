import fs from 'fs';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const margin = 14;
const maxWidth = 210 - margin * 2;
let y = 20;

const addTitle = (text) => {
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(text, margin, y);
  y += 10;
};

const addHeading = (text) => {
  y += 6;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(text, margin, y);
  y += 7;
};

const addParagraph = (text) => {
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, margin, y);
  y += lines.length * 5.5;
};

const addBullets = (items) => {
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  items.forEach((item) => {
    const lines = doc.splitTextToSize(item, maxWidth - 5);
    doc.text(['• ' + lines[0], ...lines.slice(1).map((line) => '  ' + line)], margin, y);
    y += lines.length * 5.5;
  });
  y += 2;
};

const addPageIfNeeded = () => {
  if (y > 275) {
    doc.addPage();
    y = 20;
  }
};

addTitle('iTred Backend User Guide');
addParagraph('This document explains how the iTred React application works from a backend operations perspective. It is intended for backend users who manage vendors, operational links, subscriptions, catalogue deployments, analytics and reporting.');

addHeading('1. Application Overview');
addParagraph('The application is a Vite-powered React TypeScript frontend designed to run locally and persist data in browser storage. Backend users operate the system through an administrative dashboard and specialized modules that represent vendor lifecycle, field partner networks, product inventory, subscription collections, catalogue generation, and access channels.');

addHeading('2. Startup and Running the App');
addBullets([
  'Install dependencies using npm install.',
  'Run the application locally with npm run dev.',
  'Build the production bundle with npm run build.',
  'The app uses localStorage as the primary persistence layer for the demo environment.',
]);

addHeading('3. Navigation and Main Modules');
addParagraph('The application uses the AppShell and React Router to display sections for backend operations. A backend user will typically navigate between the following pages:');
addBullets([
  'Dashboard: shows operational reminders, quality alerts, and system status.',
  'Vendor Management: register, update, and manage vendor businesses, branches, support contacts and subscriptions.',
  'RPN Management: manage the Regional Partner Network and field data collection pipeline.',
  'Product Management: maintain product records, SKU inventory, pricing, and catalogue publishing status.',
  'Commerce Access Hub (CAH): track WhatsApp channels, communities, group links, booth assets and follower/member counts.',
  'Pricing Plans: define subscription tiers and feature entitlements for vendors.',
  'Subscription Management: view payment statuses, due and overdue collections, and follow-up actions.',
  'Catalogue Generator: compile catalogues by sector and issue them to vendors or communities.',
  'Analytics and BI Market: review aggregated metrics, performance indicators, and market intelligence.',
  'Activity Logs: audit system events and backend operations.',
  'Inventory Spot Checks: verify stock integrity and schedule spot checks.',
]);

addHeading('4. Data Model and Shared Types');
addParagraph('The application defines a shared type system in src/types.ts that determines how vendors, products, subscriptions, plans, events, and CAH links are structured. Backend users can rely on these domain objects to understand status values, allowed actions, and reporting fields.');
addBullets([
  'Vendor records include business details, contact information, subscription state, assigned RPNs, and branch/staff collections.',
  'PricingPlan objects define monthly pricing, usage limits, feature flags, and entitlement levels.',
  'Subscription records track invoices, due dates, follow-up statuses, and collection results.',
  'CAH link records track WhatsApp channel/community links, follower counts, growth history, and update timestamps.',
  'Activity events (EventType) capture creation, updates, collection actions, catalogue deployments, and CAH changes for audit and analytics.',
]);

addHeading('5. Persistence and Services');
addParagraph('Backend data is managed through service modules in src/services. Each service reads and writes data to localStorage with a dedicated key. This means backend operations are immediately reflected in the browser session and persisted across refreshes.');
addBullets([
  'logService and analyticsService store audit events and activity history.',
  'vendorService manages vendor records, branch details, staff and delivery staff information.',
  'cahService handles CAH link records, booth records, and assets, including manual WhatsApp follower counts.',
  'subscriptionService manages subscription records and cash collection workflows.',
  'pricingPlanService manages plan definitions used to gate vendor entitlements.',
]);

addHeading('6. Commerce Access Hub Workflow');
addParagraph('The CAH module is one of the primary backend-facing tools for tracking WhatsApp-based engagement. Backend users can add or update links, record membership counts, and monitor link health through analytics.');
addBullets([
  'Open Commerce Access Hub and choose Distribution Links to manage CAH link records.',
  'Use the CAH editor to enter link metadata, WhatsApp URL, audience, sector, province, city, and support details.',
  'Update Current Count manually for follower/member tracking. The app automatically computes growth, stores previous counts, and records the update timestamp.',
  'A dashboard section displays top growing links, update reminders, follower counts by type, sector, and location, and a growth table for backend review.',
]);

addHeading('7. Audit and Event Logging');
addParagraph('Every important backend action is recorded as an event in the analytics system. The Activity Logs page exposes these events for auditing and troubleshooting.');
addBullets([
  'Events include vendor creation, updates, suspension, CAH link creation/updates, catalogue deployments, subscription due/overdue notifications, and collection actions.',
  'logService acts as an adapter for older calls and forwards events into the analytics event store.',
  'The dashboard uses these events to build reminders and operational alert cards.',
]);

addHeading('8. PDF Reporting and Backend Deliverables');
addParagraph('The app includes a PDF generation service for backend reporting. This service can create subscription reports, vendor statements, and onboarding forms in a printable format.');
addBullets([
  'pdfService.generateSubscriptionReport creates a portfolio report filtered by due status, RPN, and plan.',
  'pdfService.generateVendorStatement builds a vendor account statement with subscription history and outstanding balances.',
  'The generated PDFs include branded headers, metadata, table summaries, and privacy-safe footers.',
]);

addHeading('9. Step-by-Step Backend User Process');
addBullets([
  'Start by opening the Dashboard to identify overdue subscriptions, catalogue expiry, spot check obligations, and quality alerts.',
  'Navigate to Vendor Management to check vendor status, update contact data, and ensure assigned plans match service levels.',
  'Use RPN Management to review field partner performance, assign vendors, and validate collection entries.',
  'Manage product inventory in Product Management and ensure active SKUs have images, prices, and catalogue publication status.',
  'In Commerce Access Hub, track WhatsApp community links and manually update member/follower counts for each channel or group.',
  'Use Subscription Management to monitor due and overdue accounts, record payment collections, and schedule follow-up actions.',
  'Generate reports from the app when you need printable summaries or vendor statements for accounting and reconciliation.',
  'Review Activity Logs regularly to validate system changes and investigate any unexpected operations.',
]);

addHeading('10. Notes for Backend Users');
addParagraph('This application is optimized for a demo or internal operations environment. It does not currently use a remote database; all records are stored in local browser storage. For production use, the same logical modules should be backed by a server-side database, authentication, and API endpoints.');

// Add footer page numbers
const buffer = doc.output('arraybuffer');
fs.writeFileSync('backend-user-guide.pdf', Buffer.from(buffer));
console.log('Generated backend-user-guide.pdf');
