# iTredVD Source of Truth

## Product Identity

iTredVD is the Vendor Discovery and Digital Commerce console for iTred Marketplace, powered by seiGEN Commerce.

The application manages vendors, products, catalogues, storefronts, access hub links, WhatsApp community activity, pricing plans, console staff, diagnostics, reports, and marketplace discovery data.

## Core Direction

iTredVD must remain a professional, industrial-grade commerce backoffice and vendor discovery platform.

The app must support:

- Vendor onboarding
- Product intake
- Product linking to vendors
- Catalogue generation
- Storefront publication
- Offline catalogue deployment
- WhatsApp Access Hub tracking
- RPN and field activity support
- Pricing plan management
- Console staff access
- Read diagnostics
- Audit logs
- Analytics events
- Public marketplace discovery

## Branding

Use iTred Marketplace branding powered by seiGEN Commerce.

Primary colors:

- seiGEN Commerce Orange
- Charcoal matte grey
- Light professional background

UI direction:

- Professional industrial-grade layout
- Sharp/square cards, panels, and windows
- Mobile-first navigation
- Clean dashboards
- Minimal visual clutter
- Strong operational visibility

## Firebase Project

Firebase project:

gen-lang-client-0459000055

Known hosting targets:

- itredvd.web.app
- itredpos2.web.app

## Critical Firestore Collections

The app must preserve existing collection names unless a migration is explicitly planned.

Console and admin:

- itred_console_staff
- console_staff
- console_invites
- itred_read_diagnostics
- audit_logs
- app_users
- itred_users
- system_settings
- itred_settings

Marketplace:

- itred_vendors
- itred_products
- itred_product_intake
- itred_catalogue_history
- itred_catalogue_deployments
- itred_storefronts
- vendor_storefronts
- storefronts

Access Hub and WhatsApp:

- itred_whatsapp_groups
- itred_whatsapp_campaigns
- itred_group_daily_logs
- itred_vendor_response_logs
- itred_rpn_distribution_logs
- itred_community_moderation_logs
- itred_tracked_links
- itred_cah_links
- cah_links
- access_hub_links

Analytics and events:

- itred_activity_logs
- itred_analytics_events
- itred_whatsapp_hits
- itred_leads
- itred_leads_center
- itred_link_click_events
- itred_product_view_events
- itred_catalogue_view_events
- itred_whatsapp_enquiry_events
- itred_phone_call_events
- itred_share_events
- itred_offline_catalogue_downloads

Pricing and reports:

- itred_pricing_plans
- itred_vendor_reports
- itred_sector_reports
- itred_sector_demand_tags

## Firestore Listener Policy

All Firestore real-time listeners must be safe.

Every onSnapshot listener must:

- Return unsubscribe
- Avoid duplicate listener registration
- Include an error callback
- Log collection name and listener status
- Fall back to getDocs when live listener fails
- Never crash the UI because of a listener failure

Deprecated Firestore persistence must not be used.

Do not use:

enableMultiTabIndexedDbPersistence

Use modern Firestore cache settings instead.

## Firebase Rules Policy

Firestore rules must include all collections used by the app.

If the code reads or writes a collection, the rules must explicitly mention that collection unless intentionally blocked.

Important rule requirement:

- itred_console_staff must be allowed for console admins and super admins.
- itred_read_diagnostics must be allowed for console admins and super admins.

Default deny must remain at the bottom of Firestore rules.

## Development Policy

When Gemini, Cursor, Copilot, or another AI coding assistant modifies this app, it must first read this file.

No AI assistant should rename core collections, remove existing modules, or bypass this SOT without explicit instruction.

## Build Discipline

Before changing code:

1. Check this SOT.
2. Check existing service names.
3. Preserve Firebase collection names.
4. Preserve vendor discovery workflows.
5. Preserve console staff workflows.
6. Preserve catalogue and storefront workflows.
7. Preserve WhatsApp Access Hub workflows.
8. Avoid hallucinated collection names.
9. Avoid broad rewrites unless requested.
10. Keep the app production-oriented.

## Current Priority

Current technical priority:

Stabilize Firebase loading and Firestore listeners.

Specifically:

- Fix Firestore initialization
- Replace deprecated persistence
- Harden storageService listeners
- Add getDocs fallback
- Ensure rules match collection names
- Ensure iTredVD can load data reliably
