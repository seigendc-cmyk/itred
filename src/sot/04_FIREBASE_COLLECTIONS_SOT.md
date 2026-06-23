# Firebase Collections Source of Truth

Firebase project:

gen-lang-client-0459000055

Known hosting:

- itredvd.web.app
- itredpos2.web.app

Core iTredVD collections must not be renamed without explicit migration.

Critical collections:

- itred_console_staff
- console_staff
- console_invites
- itred_read_diagnostics
- audit_logs
- app_users
- itred_users
- system_settings
- itred_settings
- itred_vendors
- itred_products
- itred_product_intake
- itred_catalogue_history
- itred_catalogue_deployments
- itred_storefronts
- vendor_storefronts
- storefronts
- itred_pricing_plans
- itred_activity_logs
- itred_analytics_events
- itred_leads
- itred_leads_center
- itred_whatsapp_groups
- itred_whatsapp_campaigns
- itred_tracked_links
- itred_cah_links
- cah_links
- access_hub_links

Additional iTredVD Firestore collections currently used (do not rename; rules must include them):

- pricingPlans
  - Purpose: Pricing plan definitions referenced by pricing plan management UI/services.
  - Status: Current/legacy (collection name differs from SOT’s itred_pricing_plans).
  - Migration candidate: itred_pricing_plans (preferred canonical name).
  - Rules required: Yes (collection is read/written by the app).

- vendorCatalogueStats
  - Purpose: Vendor catalogue statistics used by analytics/BI dashboards.
  - Status: Current/legacy (not listed in Critical collections section).
  - Migration candidate: itred_sector_reports / itred_vendor_reports (NOT specified; keep as-is unless a migration is planned).
  - Rules required: Yes.

- catalogueGenerations
  - Purpose: Catalogue generation history/metadata (used for catalogue lifecycle and tracking).
  - Status: Current/legacy (not listed in Critical collections section; SOT lists itred_catalogue_history / itred_catalogue_deployments).
  - Migration candidate: itred_catalogue_history (for history) and/or itred_catalogue_deployments (for deployment-specific records) if migration is explicitly planned.
  - Rules required: Yes.

- catalogueUsageLedger
  - Purpose: Ledger of catalogue usage/deployment/download events for auditing/usage tracking.
  - Status: Current/legacy.
  - Migration candidate: itred_catalogue_deployments (if ledger is intended to consolidate into that canonical collection).
  - Rules required: Yes.

- vendors
  - Purpose: Core vendor entity documents used by some legacy/alternate code paths.
  - Status: Legacy/current (duplicate of itred_vendors / vendor entity representations).
  - Migration candidate: itred_vendors (preferred canonical name).
  - Rules required: Yes.

- staffAuditLogs
  - Purpose: Audit log entries for staff actions.
  - Status: Current/legacy (alternates with audit_logs / itred_staff_audit_logs concepts).
  - Migration candidate: itred_staff_audit_logs (preferred canonical name, if consolidation is desired).
  - Rules required: Yes.

- notifications
  - Purpose: Notification feed used by notifications UI/services.
  - Status: Current/legacy (alternate with itred_notifications).
  - Migration candidate: itred_notifications (preferred canonical name).
  - Rules required: Yes.

- itred_whatsapp_intelligence_logs
  - Purpose: Stored WhatsApp intelligence logs used by BI/intelligence features.
  - Status: Current.
  - Migration candidate: None (keep as-is; not present in Critical collections list but used by app).
  - Rules required: Yes.



Firestore rule policy:

Every collection used by the app must be represented in Firestore rules.

Listener policy:

Every onSnapshot listener must:

- Return unsubscribe
- Avoid duplicate registration
- Include error callback
- Fall back to getDocs
- Log collection name and status

