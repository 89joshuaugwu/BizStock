# Database

BizStock uses **Firestore only** (Spark/free plan). No Realtime Database collections exist in this app — see [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-why-realtime-database-rules-are-included-but-unused) for why a deny-all RTDB ruleset is still included.

---

## Collections

### `/business/{businessId}`

Exactly one document, always at ID `"main"` (see `BUSINESS_DOC_ID` in `lib/auth.ts`). Created once, during owner signup.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Shop name, shown in the app header |
| `ownerUid` | string | uid of the owner who created it |
| `defaultReorderThreshold` | number | Pre-fills the reorder threshold field when adding a new product |
| `createdAt` | Timestamp | |

**Rules:** read — any active signed-in user. Create — only as the owner, and only during signup (see rule comment). Update — owner only. Delete — never, from the client.

---

### `/users/{uid}`

Doc ID == Firebase Auth uid. One doc per person (owner or staff).

| Field | Type | Notes |
|---|---|---|
| `uid` | string | duplicated from the doc ID for convenience in queries |
| `email` | string | |
| `displayName` | string | |
| `role` | `"owner"` \| `"admin"` \| `"staff"` | |
| `active` | boolean | `false` = deactivated; blocks login, doesn't delete the account |
| `createdAt` | Timestamp | |

**Rules:** a user can always read their own doc; the owner/admin can read anyone's (needed for the Staff page). Create — only your own doc, only as role `"owner"` (self-service signup path); staff/admin docs are created server-side by `/api/staff/create` using the Admin SDK, which bypasses rules entirely. Update — owner or admin (role changes, the active/deactivate toggle). Admins can only edit regular staff users. Delete — never.

---

### `/products/{productId}`

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `sku` | string | Free-text, not enforced unique at the database level |
| `category` | string | Free-text; populates the category filter dropdown |
| `costPrice` | number | ₦ per unit |
| `sellingPrice` | number | ₦ per unit |
| `stock` | number | The only field ever touched by `adjustStock()` outside of manual edits |
| `reorderThreshold` | number | Triggers a low-stock notification when `stock <= reorderThreshold` |
| `supplier` | string | |
| `imageUrl` | string \| null | Cloudinary URL, or null if no photo uploaded |
| `createdAt`, `updatedAt` | Timestamp | |

**Rules:** read — any active signed-in user (staff need this for the Sales screen and the view-only Products page). Create/update/delete — owner or admin. Note: the `stock` field is also written by the server (Admin SDK, inside `adjustStock()`'s transaction) during sales/purchases — that path bypasses Security Rules by design, since the Admin SDK always does.

---

### `/stockMovements/{movementId}`

Append-only audit log. One doc per unit-of-stock-change event (a purchase of 50 units and a sale of 3 units each create exactly one movement doc, not one per unit).

| Field | Type | Notes |
|---|---|---|
| `productId` | string | |
| `productName` | string | Denormalized at write time, so history views don't need an extra product read |
| `type` | `"purchase"` \| `"sale"` | |
| `quantity` | number | Always positive — direction is implied by `type` |
| `unitPrice` | number | Cost price for purchases, selling price for sales |
| `totalValue` | number | `quantity * unitPrice` |
| `recordedBy` | string | uid of whoever triggered it |
| `createdAt` | Timestamp | |

**Rules:** read — owner or admin (reveals cost prices/margins, not appropriate for staff). Write — never from the client; only `lib/stock.ts`'s `adjustStock()`, via the Admin SDK inside a transaction.

---

### `/sales/{saleId}`

One doc per completed checkout (which may contain multiple line items).

| Field | Type | Notes |
|---|---|---|
| `items` | array of `{ productId, name, qty, unitPrice, lineTotal }` | Denormalized product name/price at time of sale — a later price change never rewrites history |
| `total` | number | Sum of all `lineTotal`s |
| `soldBy` | string | uid |
| `soldByName` | string | Denormalized display name, so history pages don't need a `/users` read (which staff can't do anyway — see below) |
| `createdAt` | Timestamp | |

**Rules:** read — all roles. Write — never from the client; only `POST /api/sales/checkout`, via the Admin SDK.

---

### `/purchases/{purchaseId}`

One doc per "record purchase" submission (always a single product + quantity).

| Field | Type | Notes |
|---|---|---|
| `productId`, `productName` | string | |
| `quantity` | number | |
| `costPrice` | number | ₦ per unit, as entered on that purchase |
| `totalCost` | number | `quantity * costPrice` |
| `supplier` | string | |
| `recordedBy`, `recordedByName` | string | |
| `createdAt` | Timestamp | |

**Rules:** read — owner or admin. Write — never from the client; only `POST /api/purchases/record`, via the Admin SDK.

---

### `/notifications/{uid}/items/{notificationId}`

Subcollection per user. Currently only ever populated for the owner (see `getBusinessOwnerUid()` in `lib/stock.ts`), but structured per-uid so a future multi-owner scenario doesn't require a schema change.

| Field | Type | Notes |
|---|---|---|
| `type` | `"low_stock"` \| `"out_of_stock"` | |
| `productId` | string | |
| `message` | string | Pre-formatted, human-readable |
| `read` | boolean | |
| `createdAt` | Timestamp | |

**Rules:** a user may only read/update their own subcollection, and update is restricted to changing only the `read` field (`request.resource.data.diff(resource.data).affectedKeys().hasOnly(["read"])`). Create/delete — never from the client; only `checkStockLevel()` in `lib/stock.ts`, via the Admin SDK, right after a stock-changing transaction commits.

---

## Indexes

Firestore auto-creates single-field indexes; the only compound query in this app is `stockMovements` filtered by `productId` and ordered by `createdAt` (used on the product detail page's stock history). If Firestore prompts for a composite index the first time that query runs, click the link in the console error — it will pre-fill the correct index definition.

---

## Why costs/margins aren't shown to staff

`costPrice` lives on the `products` collection, which staff CAN read (they need selling prices for the Sales screen) — so cost price is technically visible to staff via the Products page today. This is a deliberate scope trade-off: splitting cost data into an owner-only subcollection would meaningfully complicate the product read model for a small-business tool where, in practice, staff often already know rough costs. `stockMovements` and `purchases` (which reveal cost trends and supplier terms over time, not just a single snapshot) ARE locked to owner-only, which is where the more sensitive, aggregatable information actually lives.
