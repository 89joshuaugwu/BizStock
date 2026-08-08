# Database

BizStock uses **Firestore only** (Spark/free plan), and is **multi-tenant**: every business's data lives in the same collections as every other business's, isolated entirely by a `businessId` field. There is no per-tenant database or collection prefix. No Realtime Database collections exist in this app — see [ARCHITECTURE.md](./ARCHITECTURE.md) for why a deny-all RTDB ruleset is still included.

---

## Multi-tenancy in one paragraph

Every document below (except `/notifications`, which is scoped by `uid` instead) carries a `businessId` field pointing at the `/business/{id}` doc it belongs to. Every Firestore Security Rule checks that field against the CALLING USER's own `businessId` (read fresh from their own `/users/{uid}` doc — never from client-supplied data). Every client query filters `where("businessId", "==", currentBusinessId)` — this is what makes those queries provably safe for Firestore to evaluate under its list-query rules. Every server-side write (via the Admin SDK, which bypasses Security Rules) independently re-verifies the `businessId` match before touching anything — see `lib/stock.ts`.

---

## Collections

### `/business/{businessId}`

One document per client business. `businessId` is an auto-generated Firestore document ID, created by `scripts/create-business.mjs` (see [ADMIN.md](./ADMIN.md)) — never a fixed value.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Shop name, shown in the app header/wordmark |
| `ownerUid` | string | uid of this business's owner |
| `defaultReorderThreshold` | number | Pre-fills the reorder threshold field when adding a new product |
| `logoUrl` | string \| null | Owner-editable (Settings → Branding). Falls back to the default BizStock mark when null |
| `brandColor` | string \| null | Hex color, e.g. `"#7C3AED"`. Owner-editable. Falls back to default Violet when null — see `components/shells/AppShell.tsx` for how this re-themes the dashboard |
| `createdAt` | Timestamp | |

**Rules:** read — any active member (owner or staff) of that specific business. Create — real creation happens server-side via the provisioning script (Admin SDK, bypasses rules); the client-side rule is a defensive fallback only, requiring `ownerUid == caller`. Update — owner of that business only. Delete — never, from the client.

---

### `/users/{uid}`

Doc ID == Firebase Auth uid. One doc per person (owner or staff), across ALL businesses — this is a single flat collection, not partitioned per business, so every query against it filters by `businessId`.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | duplicated from the doc ID for convenience in queries |
| `email` | string | |
| `displayName` | string | |
| `role` | `"owner"` \| `"staff"` | |
| `active` | boolean | `false` = deactivated; blocks login, doesn't delete the account |
| `businessId` | string | Which business this account belongs to. Set once at creation, never changed |
| `createdAt` | Timestamp | |

**Rules:** a user can always read their own doc; an owner can read any user doc WITHIN THEIR OWN BUSINESS (Staff page list — enforced via `resource.data.businessId == myBusinessId()`, combined with a client query that filters the same way). Create — defensive fallback only (see `/business` above); real account creation is server-side (provisioning script for owners, `/api/staff/create` for staff, both Admin SDK). Update — owner only, within their own business. Delete — never.

---

### `/products/{productId}`

| Field | Type | Notes |
|---|---|---|
| `businessId` | string | |
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

**Rules:** read — any active member of the SAME business. Create/update/delete — owner of that business only, with `businessId` re-checked on both the existing doc and the incoming write (can't be changed after creation). The `stock` field is also written by the server (Admin SDK, inside `adjustStock()`'s transaction) during sales/purchases — that path independently re-verifies `businessId` too (see `lib/stock.ts`).

---

### `/stockMovements/{movementId}`

Append-only audit log. One doc per unit-of-stock-change event.

| Field | Type | Notes |
|---|---|---|
| `businessId` | string | |
| `productId` | string | |
| `productName` | string | Denormalized at write time |
| `type` | `"purchase"` \| `"sale"` | |
| `quantity` | number | Always positive — direction is implied by `type` |
| `unitPrice` | number | Cost price for purchases, selling price for sales |
| `totalValue` | number | `quantity * unitPrice` |
| `recordedBy` | string | uid of whoever triggered it |
| `createdAt` | Timestamp | |

**Rules:** read — owner only, scoped to their own business. Write — never from the client; only `lib/stock.ts`'s `adjustStock()`, via the Admin SDK inside a transaction, which stamps `businessId` from the product it just read (not from any caller-supplied value).

---

### `/sales/{saleId}`

One doc per completed checkout (which may contain multiple line items).

| Field | Type | Notes |
|---|---|---|
| `businessId` | string | Stamped server-side from the caller's own session — see `app/api/sales/checkout/route.ts` |
| `items` | array of `{ productId, name, qty, unitPrice, lineTotal }` | Denormalized product name/price at time of sale |
| `total` | number | Sum of all `lineTotal`s |
| `soldBy` | string | uid |
| `soldByName` | string | Denormalized display name |
| `createdAt` | Timestamp | |

**Rules:** read — both owner and staff, scoped to their own business. Write — never from the client; only `POST /api/sales/checkout`, via the Admin SDK.

---

### `/purchases/{purchaseId}`

One doc per "record purchase" submission (always a single product + quantity).

| Field | Type | Notes |
|---|---|---|
| `businessId` | string | Stamped server-side |
| `productId`, `productName` | string | |
| `quantity` | number | |
| `costPrice` | number | ₦ per unit, as entered on that purchase |
| `totalCost` | number | `quantity * costPrice` |
| `supplier` | string | |
| `recordedBy`, `recordedByName` | string | |
| `createdAt` | Timestamp | |

**Rules:** read — owner only, scoped to their own business. Write — never from the client; only `POST /api/purchases/record`, via the Admin SDK.

---

### `/notifications/{uid}/items/{notificationId}`

Subcollection per user — the one collection that does NOT need an explicit `businessId` check, because it's scoped by `uid`, and each `uid` belongs to exactly one business (see `getBusinessOwnerUid(businessId)` in `lib/stock.ts`, which looks up the correct owner uid per business before writing here).

| Field | Type | Notes |
|---|---|---|
| `businessId` | string | Included for audit/debugging consistency — not load-bearing for the Security Rule, since uid-scoping already isolates it |
| `type` | `"low_stock"` \| `"out_of_stock"` | |
| `productId` | string | |
| `message` | string | Pre-formatted, human-readable |
| `read` | boolean | |
| `createdAt` | Timestamp | |

**Rules:** a user may only read/update their own subcollection, and update is restricted to changing only the `read` field. Create/delete — never from the client; only `checkStockLevel()` in `lib/stock.ts`, via the Admin SDK, right after a stock-changing transaction commits.

---

## Indexes

Firestore auto-creates single-field indexes. Every list query in this app now combines a `businessId` equality filter with either an `orderBy` or a second `where` (e.g. `stockMovements` filtered by `businessId` + `productId`, ordered by `createdAt`) — these are compound queries that need a composite index. Firestore will prompt with a direct console link the first time each query runs if the index doesn't exist yet; click the link and it pre-fills the correct definition. Expect this to happen once per distinct query shape the first time you exercise that part of the app against a fresh Firestore database.

---

## Why costs/margins aren't shown to staff

`costPrice` lives on the `products` collection, which staff CAN read (they need selling prices for the Sales screen) — so cost price is technically visible to staff via the Products page today. This is a deliberate scope trade-off: splitting cost data into an owner-only subcollection would meaningfully complicate the product read model for a small-business tool where, in practice, staff often already know rough costs. `stockMovements` and `purchases` (which reveal cost trends and supplier terms over time, not just a single snapshot) ARE locked to owner-only, which is where the more sensitive, aggregatable information actually lives.
