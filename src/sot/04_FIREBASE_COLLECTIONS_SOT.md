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

Firestore rule policy:

Every collection used by the app must be represented in Firestore rules.

Listener policy:

Every onSnapshot listener must:

- Return unsubscribe
- Avoid duplicate registration
- Include error callback
- Fall back to getDocs
- Log collection name and status
