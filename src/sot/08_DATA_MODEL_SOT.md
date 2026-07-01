# SCI / iTredVD Data Model Source of Truth


This file defines the official data model direction for iTredVD and SCI Commerce Console.

## Core Entities


### Vendor

A vendor represents a business visible in the SCI/iTred ecosystem.

Must support:

- vendorId
- businessName
- sector
- country
- province
- city
- district
- suburb
- contactPhone
- WhatsApp number
- email
- status
- visibility
- subscription status
- createdAt
- updatedAt

### Product

A product belongs to a vendor and supports marketplace discovery.

Must support:

- productId
- vendorId
- productName
- category
- sector
- brand
- model
- description
- price
- stock status
- images
- tags
- visibility
- createdAt
- updatedAt

### Storefront

A storefront is the public vendor-facing commerce profile.

Must support:

- storefrontId
- vendorId
- business identity
- logo
- banner
- products
- branches
- contact actions
- WhatsApp actions
- catalogue links
- status
- visibility

### Catalogue

A catalogue is a vendor/product discovery and offline commerce asset.

Must support:

- catalogueId
- vendorId
- products
- generatedAt
- expiryDate
- deployment status
- offline availability
- public link
- download tracking

### Subscription

A subscription controls vendor access to SCI services.

Must support:

- subscriptionId
- vendorId
- planId
- status
- startDate
- expiryDate
- trial status
- payment status
- activation status

### License

A license controls application access for SCI products.

Must support:

- licenseId
- vendorId
- appCode
- planId
- activation token
- status
- expiryDate
- device or terminal limit
- createdAt
- updatedAt

### SCI Application Registry

Each SCI application should be registered for monitoring.

Must support:

- appId
- appName
- appCode
- status
- hostingUrl
- version
- environment
- health status
- last heartbeat
- linked vendors
- linked subscriptions

### Console Staff

Console staff are users who manage iTredVD and SCI operations.

Must support:

- staffId
- displayName
- email
- role
- menuPermissions
- status
- createdAt
- updatedAt

### Audit Log

Audit logs record important system actions.

Must support:

- logId
- actorId
- actorEmail
- action
- module
- targetCollection
- targetId
- before
- after
- createdAt

### Analytics Event

Analytics events support BI and monitoring.

Must support:

- eventId
- vendorId
- eventType
- source
- productId
- storefrontId
- catalogueId
- metadata
- createdAt

### WhatsApp Intelligence Log

WhatsApp intelligence logs store enriched/enforced insight records derived from WhatsApp and other interactions.

Must support:

- id
- createdAt
- updatedAt
- loggedByStaffId
- loggedByStaffName
- customerPhone
- customerName?
- vendorId?
- vendorName?
- productId?
- productName?
- category?
- sector?
- region?
- province?
- city?
- source
- interactionType
- customerMessage
- internalNotes?
- actionRequired
- urgencyLevel
- resolutionStatus
- assignedToStaffId?
- assignedToStaffName?
- followUpRequired
- followUpDate?
- tags
- sentiment
- biScore?
- flaggedRisk?
- duplicatePatternDetected?

### Staff Audit Log

Staff audit logs record important backoffice staff actions and security-sensitive events.

Must support:

- id
- eventType
- severity
- staffId
- staffName
- staffRole?
- module
- action
- recordType?
- recordId?
- recordName?
- beforeSnapshot?
- afterSnapshot?
- reason?
- managerComment?
- deviceInfo?
- sessionId?
- createdAt



## Rule

No AI assistant or developer should invent new collection names when an existing official collection already exists.

Before adding new data structures, check:

- 04_FIREBASE_COLLECTIONS_SOT.md
- this file
- existing service files
- Firestore rules
