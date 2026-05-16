# Firebase Performance Indexes

Use these Firestore composite indexes as the app grows. They support list views, dashboards, filtered reports, and paginated operational logs without loading entire collections.

## vendors

- `status` ascending, `updatedAt` descending
- `rpnId` ascending, `status` ascending
- `sector` ascending, `status` ascending
- `cityTown` ascending, `status` ascending
- `suburb` ascending, `status` ascending

## products

- `status` ascending, `publishToCatalogue` ascending
- `vendorId` ascending, `status` ascending
- `sector` ascending, `category` ascending, `status` ascending
- `updatedAt` descending

## subscriptions

- `vendorId` ascending, `dueDate` descending
- `paymentStatus` ascending, `dueDate` descending
- `rpnId` ascending, `paymentStatus` ascending

## whatsapp logs

- `vendorId` ascending, `createdAt` descending
- `productId` ascending, `createdAt` descending
- `region` ascending, `createdAt` descending
- `interactionType` ascending, `createdAt` descending

## finance transactions

- `accountId` ascending, `transactionDate` descending
- `cashBankAccountId` ascending, `transactionDate` descending
- `status` ascending, `transactionDate` descending

## audit logs

- `staffId` ascending, `createdAt` descending
- `module` ascending, `createdAt` descending
- `severity` ascending, `createdAt` descending

## notifications

- `targetStaffId` ascending, `status` ascending, `createdAt` descending
- `status` ascending, `priority` ascending, `createdAt` descending

## Query Guidance

Prefer list queries with `where`, `orderBy`, and `limit` for dashboards and list pages. Load full records only when a user opens a detail view or edit form.
