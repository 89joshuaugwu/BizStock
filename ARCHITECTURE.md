# Architecture

## 1. Overview

BizStock is a **multi-tenant**, two-role (owner/staff) inventory system: one deployment serves many independent client businesses, each fully isolated from the others and each with its own branding. There is no public signup — new businesses are provisioned by the platform admin via a CLI script (see [ADMIN.md](./ADMIN.md)).

Three rules shape almost every architectural decision in this codebase:

1. **Every business's data is isolated by a `businessId` field, checked at every layer.** There's no per-tenant database or collection — all businesses' products, sales, etc. live in the same Firestore collections, distinguished only by `businessId`. Isolation is enforced independently by Firestore Security Rules (client reads/writes) AND by the server routes themselves (writes via the Admin SDK, which bypasses rules entirely). See §4.
2. **Stock changes must be atomic.** A sale and a purchase are the only two things that mutate a product's stock count, and both must do so inside a single Firestore transaction that also writes the audit record (`stockMovements`). Two staff members racing to sell the last unit of something must never both succeed.
3. **Writes that touch stock never happen directly from the client.** Firestore Security Rules are good at "can this user read/write this document," but they can't express "and also atomically decrement a different document and reject the whole operation if it would go negative." That logic lives server-side, in Next.js Route Handlers backed by the Firebase Admin SDK.

Everything else — product CRUD, business settings, marking a notification read — is safe to do directly from the client through the Firestore SDK, gated by Security Rules. See [DATABASE.md](./DATABASE.md) for the exact rule for each collection.

---

## 2. Folder structure

```
app/
  (public)/                  route group — no auth required
    page.tsx                 landing page (generic BizStock branding —
                              see §5 on why this isn't per-tenant)
    layout.tsx                wraps children in PublicShell
    auth/login/page.tsx       shared owner + staff login (no signup route)
  (dashboard)/                route group — behind auth
    layout.tsx                 client-side auth guard, wraps in AppShell
    dashboard/
      page.tsx                 home: stat cards + recent activity
      products/page.tsx        product list (RBAC: view-only for staff)
      products/new/page.tsx    add product (owner only)
      products/[id]/page.tsx   edit product + stock history (owner),
                                read-only detail (staff)
      sales/page.tsx           POS-lite sales screen (both roles)
      sales/history/page.tsx   sales history (both roles)
      purchases/page.tsx       record purchase (owner only)
      purchases/history/page.tsx  purchase history (owner only)
      reports/page.tsx         stock valuation, profit, best sellers (owner only)
      staff/page.tsx           staff accounts (owner only)
      settings/page.tsx        business info + branding + password (owner only)
  api/
    sales/checkout/route.ts    POST — atomic sale + stock deduction
    purchases/record/route.ts  POST — atomic purchase + stock addition
    staff/create/route.ts      POST — create staff Auth user + user doc
  layout.tsx                   root layout: fonts, AuthProvider, toaster
  icon.svg                     favicon (App Router convention — platform-wide, not per-tenant)

components/
  ui/            atoms — Button, Input, Select, StatusBadge, DataTable,
                 Card, Spinner, Modal, Toast, Logo (supports per-business
                 logo override — see §5)
  molecules/     ProductRow, CartItem, StockMovementRow, AlertBell
  organisms/     ProductManagementTable, ProductForm, SalesScreen,
                 PurchaseForm, ReportsDashboard, StaffManagementTable
  shells/        PublicShell, AppShell (applies per-business branding —
                 see §5), OwnerOnlyGuard
  providers/     AuthProvider (React context: firebaseUser, appUser,
                 business, businessId, role, loading)

lib/
  firebase.ts          client SDK init (safe for the browser)
  firebase-admin.ts     admin SDK init — SERVER ONLY, lazy singleton
  api-auth.ts           verifies a request's Firebase ID token server-side
  auth.ts               client: loginWithEmail, logout (no signup — see §3)
  stock.ts               THE atomic adjustStock() transaction, WITH
                          businessId re-verification — server-only
  errors.ts              InsufficientStockError
  products.ts, sales.ts, purchases.ts, movements.ts, users.ts,
  business.ts, notifications.ts    client read/write helpers, all
                                    scoped by businessId
  reports.ts              client-side aggregation for the Reports page
  cloudinary.ts            unsigned image upload (products + business logos)
  color.ts                 hex color math for per-business brand theming
  config.ts                 platform contact info (WhatsApp link, etc.)
  format.ts, cn.ts         Naira formatting, className helper

types/           one file per domain concept (Product, Sale, Purchase,
                 StockMovement, AppUser, Business, AppNotification) —
                 every type except AppNotification carries businessId

scripts/
  create-business.mjs      admin CLI — provisions a new business +
                            owner account (Admin SDK) — see ADMIN.md

firestore.rules             Firestore Security Rules — paste into console
database.rules.json          deny-all Realtime Database rules (see §6)
.env.local.example           every required env var, documented inline
proxy.ts                     UX-level route guard (see §4) — Next.js 16
                              renamed "middleware" to "proxy"; this file
                              is the renamed equivalent
```

---

## 3. No public signup

There is no `/auth/signup` route. New businesses are created exclusively by `scripts/create-business.mjs`, run by the platform admin — see [ADMIN.md](./ADMIN.md) for the full flow and [AUTHENTICATION.md](./AUTHENTICATION.md) for the reasoning. This script uses the Firebase Admin SDK directly (bypassing Firestore Security Rules, same as every route in `app/api/*`) to create the Firebase Auth owner account, the `/business/{id}` doc, and the `/users/{uid}` doc together.

---

## 4. Multi-tenant isolation — enforced independently at two layers

Every business-scoped collection (`products`, `sales`, `purchases`, `stockMovements`, `users`) carries a `businessId` field. Two independent layers enforce that a business can only ever see or touch its own data:

1. **Firestore Security Rules** (`firestore.rules`) — every rule compares `resource.data.businessId` (or `request.resource.data.businessId` on writes) against `myBusinessId()`, a helper that reads the CALLER's own `businessId` fresh from their own `/users/{uid}` doc on every single evaluation. This is Firestore's documented multi-tenancy pattern, and it's what protects every direct client read/write.
2. **Server-side re-verification** — the Admin SDK (used by every route in `app/api/*` and by `lib/stock.ts`) bypasses Firestore Security Rules entirely, so rules alone don't protect server-side mutations. `adjustStock()` independently re-checks that the target product's `businessId` matches the caller's own businessId INSIDE its transaction, before writing anything. The checkout and purchase routes also pre-check this before even calling `adjustStock()`, treating a cross-tenant product ID identically to "doesn't exist" — no information about tenant boundaries is ever observable from an API response.

A bug or malicious request that somehow got a cross-tenant `productId` this far would, without layer 2, let one business silently deduct or inflate a competitor's stock — since the Admin SDK doesn't care what the rules say. This is why the check exists at the actual point of mutation, not just at the rules layer.

---

## 5. Per-business branding

Each business can set a `logoUrl` and `brandColor` on their `/business/{id}` doc (via the provisioning script at creation, or later from Settings → Branding). `AppShell` applies these dynamically:

- **Logo**: `components/ui/Logo.tsx` renders the business's uploaded logo image when `logoUrl` is set, falling back to the default BizStock isometric-box mark otherwise. The header wordmark also switches from "BizStock" to the business's own name.
- **Color**: `AppShell` computes CSS variable overrides (`--color-violet` and its derived shades) from `brandColor` using `lib/color.ts` (simple RGB interpolation — no color library needed) and applies them as an inline style on the dashboard's root wrapper. Every Tailwind utility using the Violet palette (`bg-violet`, `text-violet`, etc.) compiles to `var(--color-violet)`, so this one override re-themes buttons, active nav states, badges — the entire dashboard — without touching individual components.

**What is NOT branded per business, deliberately:** the public landing page (`/`), the login page (`/auth/login`), and the site favicon (`app/icon.svg`) always show BizStock's own default mark. All businesses currently share one domain, and there's no way to know which business an unauthenticated visitor represents before login — no subdomain-per-tenant routing exists in this build. Per-tenant public-facing branding would require adding that (a genuinely separate, larger piece of work) — see ADMIN.md §4.

---

## 6. The atomic stock transaction

`lib/stock.ts` exports `adjustStock(productId, delta, context)`, where `context.businessId` is the caller's own businessId (never trusted from client input — always read server-side from their verified session). Every stock mutation in the app — a sale line item, a purchase — goes through this one function. It:

1. Opens a Firestore transaction.
2. Reads the product's current `stock` AND `businessId`.
3. **Rejects immediately if the product's `businessId` doesn't match `context.businessId`** — treated identically to "product doesn't exist," so nothing about tenant boundaries leaks through an error message.
4. Computes `stock + delta` (delta is negative for a sale, positive for a purchase).
5. If the result would be negative, throws `InsufficientStockError` **without writing anything** — the transaction is aborted.
6. Otherwise, writes the new stock count **and** a `stockMovements` document (stamped with `businessId`) in the same transaction.
7. After the transaction commits, runs `checkStockLevel()` — a separate, non-transactional write that creates a low-stock/out-of-stock notification if needed, for that specific business's owner (looked up via `getBusinessOwnerUid(businessId)`, always filtered by business — never a bare "find any owner" query). This runs outside the transaction deliberately: transactions should stay focused on the invariant they're protecting (stock never goes negative), and a notification write to an unrelated document tree doesn't need the same atomicity guarantee.

### Why the sale checkout does a pre-flight pass first

`POST /api/sales/checkout` doesn't just loop over cart items and call `adjustStock()` for each one. It first fetches every product in the cart, checks each one's `businessId` matches the caller's, and checks that stock >= requested quantity for **every line** — only if all lines pass does it start calling `adjustStock()`. This is what makes the "hard block the whole sale" rule work in practice: without the pre-flight check, a 5-item cart could deduct stock for items 1–4 and then fail on item 5, leaving a half-completed sale. The pre-flight check makes that the rare case rather than the common one.

It's still not a *single* cross-document transaction across all cart lines (Firestore transactions have a practical limit on document count, and locking every product in a cart for the duration of one big transaction would hurt concurrency for unrelated sales). Instead: pre-flight check for the common case, and if a genuine race loses anyway (two customers buying the last unit at the same instant), `adjustStock()`'s own transaction catches it and the API returns a clear 409 naming the product and the real available count.

---

## 7. Auth architecture — three layers, three jobs

| Layer | What it checks | What it protects |
|---|---|---|
| `proxy.ts` | Presence of a `bizstock_session` cookie | UX only — bounces signed-out visitors from `/dashboard/*` before a flash of dashboard chrome |
| Firestore Security Rules (`firestore.rules`) | The caller's Firebase Auth identity + their `/users/{uid}` role/active status/**businessId**, evaluated **on Firebase's servers** | Every direct client read/write (products, business settings, notifications, etc.), including cross-tenant isolation |
| `lib/api-auth.ts` (`requireUser`, `requireOwner`) + per-route businessId checks | A verified Firebase ID token, decoded server-side with the Admin SDK, plus explicit businessId matching on every touched document | Every Route Handler that mutates stock or creates accounts |

The cookie in layer 1 is explicitly **not** a trust boundary — see the comment at the top of `proxy.ts`. Real authorization (and tenant isolation) is layers 2 and 3. See [AUTHENTICATION.md](./AUTHENTICATION.md) for the full login/deactivation/provisioning flow.

(Note: `proxy.ts` is the Next.js 16 renamed equivalent of the old `middleware.ts` convention — pure rename, same logic, same `config.matcher`.)

---

## 8. Why Realtime Database rules are included but unused

**BizStock's own data model uses Firestore only** — there's no Realtime Database read or write anywhere in this codebase. `database.rules.json` is a deny-all ruleset included as a safety net: if the Firebase project this is deployed to has Realtime Database enabled (Firebase sometimes provisions it by default), an unlocked RTDB with its default rules is a real, live exposure sitting next to your actual app. Publishing the deny-all rules closes that door even though this app never opens it.

---

## 9. State management

No global state library. Three layers:

- **`AuthProvider`** (React Context) — the only genuinely global client state: current Firebase user, their Firestore profile (role, active, businessId), the resolved business doc for that businessId (branding, settings), and derived `loading`/`isOwner` flags. The business doc is only ever exposed once it's confirmed to match the current user's `businessId` (guards against showing stale data for a split second when switching accounts).
- **Firestore `onSnapshot` listeners**, one per page/section, wrapped in small `lib/*.ts` helpers (`onProductsSnapshot(businessId, ...)`, `onSalesSnapshot(businessId, ...)`, etc.) — every one of these takes `businessId` as its first argument and filters accordingly. Each page owns its own real-time subscription and local `useState`, and waits for `businessId` to be available before subscribing. This keeps data fresh across tabs/devices without a cache-invalidation layer to maintain.
- **Local component state** for forms, cart contents, filters, and UI toggles (modals, dropdowns).

---

## 10. Design system

Tailwind v4 theme tokens (`app/globals.css`, `@theme` block) — Violet (`#7C3AED`) as the DEFAULT brand/primary color (overridden per-business — see §5), Slate neutrals, semantic Success/Warning/Error colors (never overridden per-tenant — status colors stay consistent everywhere). Inter for UI text, JetBrains Mono for SKUs and other identifiers. Full component list in `components/ui/`. Mobile-first: `DataTable` renders as a real `<table>` on `sm:` and up, and as stacked cards below that; the sales cart is a sticky bottom sheet on mobile and a static sidebar panel on desktop.
