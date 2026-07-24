# Architecture

## 1. Overview

BizStock is a single-business, three-role (owner/admin/staff) inventory system. There is no multi-tenant selector, no organization switcher — one deployment serves one shop, matching the scope in the original brief. It enforce a strict single-tenant lockout so secondary signups cannot happen.

Two rules shape almost every architectural decision in this codebase:

1. **Stock changes must be atomic.** A sale and a purchase are the only two things that mutate a product's stock count, and both must do so inside a single Firestore transaction that also writes the audit record (`stockMovements`). Two staff members racing to sell the last unit of something must never both succeed.
2. **Writes that touch stock never happen directly from the client.** Firestore Security Rules are good at "can this user read/write this document," but they can't express "and also atomically decrement a different document and reject the whole operation if it would go negative." That logic lives server-side, in Next.js Route Handlers backed by the Firebase Admin SDK.

Everything else — product CRUD, business settings, marking a notification read — is safe to do directly from the client through the Firestore SDK, gated by Security Rules. See [DATABASE.md](./DATABASE.md) for the exact rule for each collection.

---

## 2. Folder structure

```
app/
  (public)/                  route group — no auth required
    page.tsx                 landing page
    layout.tsx                wraps children in PublicShell
    auth/signup/page.tsx      owner signup
    auth/login/page.tsx       shared owner + staff login
  (dashboard)/                route group — behind auth
    layout.tsx                 client-side auth guard, wraps in AppShell
    dashboard/
      page.tsx                 home: stat cards + recent activity
      products/page.tsx        product list (RBAC: view-only for staff)
      products/new/page.tsx    add product (owner/admin)
      products/[id]/page.tsx   edit product + stock history (owner/admin),
                                read-only detail (staff)
      sales/page.tsx           POS-lite sales screen (all roles)
      sales/history/page.tsx   sales history (all roles)
      purchases/page.tsx       record purchase (owner/admin)
      purchases/history/page.tsx  purchase history (owner/admin)
      reports/page.tsx         stock valuation, profit, best sellers (owner/admin)
      staff/page.tsx           staff accounts (owner/admin)
      settings/page.tsx        business info + password (owner/admin)
  api/
    sales/checkout/route.ts    POST — atomic sale + stock deduction
    purchases/record/route.ts  POST — atomic purchase + stock addition
    staff/create/route.ts      POST — create staff Auth user + user doc
  layout.tsx                   root layout: fonts, AuthProvider, toaster
  icon.svg                     favicon (App Router convention)

components/
  ui/            atoms — Button, Input, Select, StatusBadge, DataTable,
                 Card, Spinner, Modal, Toast, Logo
  molecules/     ProductRow, CartItem, StockMovementRow, AlertBell
  organisms/     ProductManagementTable, ProductForm, SalesScreen,
                 PurchaseForm, ReportsDashboard, StaffManagementTable
  shells/        PublicShell, AppShell, OwnerOrAdminGuard
  providers/     AuthProvider (React context: firebaseUser, appUser,
                 business, role, loading)

lib/
  firebase.ts          client SDK init (safe for the browser)
  firebase-admin.ts     admin SDK init — SERVER ONLY, lazy singleton
  api-auth.ts           verifies a request's Firebase ID token server-side
  auth.ts               client: signUpOwner, loginWithEmail, logout
  stock.ts               THE atomic adjustStock() transaction — server-only
  errors.ts              InsufficientStockError
  products.ts, sales.ts, purchases.ts, movements.ts, users.ts,
  business.ts, notifications.ts    client read/write helpers per collection
  reports.ts              client-side aggregation for the Reports page
  cloudinary.ts            unsigned image upload
  format.ts, cn.ts         Naira formatting, className helper

types/           one file per domain concept (Product, Sale, Purchase,
                 StockMovement, AppUser, Business, AppNotification)

firestore.rules             Firestore Security Rules — paste into console
database.rules.json          deny-all Realtime Database rules (see below)
.env.local.example           every required env var, documented inline
```

---

## 3. The atomic stock transaction

`lib/stock.ts` exports `adjustStock(productId, delta, context)`. Every stock mutation in the app — a sale line item, a purchase — goes through this one function. It:

1. Opens a Firestore transaction.
2. Reads the product's current `stock`.
3. Computes `stock + delta` (delta is negative for a sale, positive for a purchase).
4. If the result would be negative, throws `InsufficientStockError` **without writing anything** — the transaction is aborted.
5. Otherwise, writes the new stock count **and** a `stockMovements` document in the same transaction.
6. After the transaction commits, runs `checkStockLevel()` — a separate, non-transactional write that creates a low-stock/out-of-stock notification if needed. This runs outside the transaction deliberately: transactions should stay focused on the invariant they're protecting (stock never goes negative), and a notification write to an unrelated document tree doesn't need the same atomicity guarantee — worst case, a notification is written a few hundred milliseconds after the stock actually changed.

### Why the sale checkout does a pre-flight pass first

`POST /api/sales/checkout` doesn't just loop over cart items and call `adjustStock()` for each one. It first fetches every product in the cart and checks that stock >= requested quantity for **every line**, and only if all lines pass does it start calling `adjustStock()`. This is what makes the "hard block the whole sale" rule work in practice: without the pre-flight check, a 5-item cart could deduct stock for items 1–4 and then fail on item 5, leaving a half-completed sale. The pre-flight check makes that the rare case rather than the common one.

It's still not a *single* cross-document transaction across all cart lines (Firestore transactions have a practical limit on document count, and locking every product in a cart for the duration of one big transaction would hurt concurrency for unrelated sales). Instead: pre-flight check for the common case, and if a genuine race loses anyway (two customers buying the last unit at the same instant), `adjustStock()`'s own transaction catches it and the API returns a clear 409 naming the product and the real available count.

---

## 4. Auth architecture — three layers, three jobs

| Layer | What it checks | What it protects |
|---|---|---|
| `middleware.ts` | Presence of a `bizstock_session` cookie | UX only — bounces signed-out visitors from `/dashboard/*` before a flash of dashboard chrome |
| Firestore Security Rules (`firestore.rules`) | The caller's Firebase Auth identity + their `/users/{uid}` role/active status, evaluated **on Firebase's servers** | Every direct client read/write (products, business settings, notifications, etc.) |
| `lib/api-auth.ts` (`requireUser`, `requireOwner`) | A verified Firebase ID token, decoded server-side with the Admin SDK | Every Route Handler that mutates stock or creates accounts |

The cookie in layer 1 is explicitly **not** a trust boundary — see the comment at the top of `middleware.ts`. Real authorization is layers 2 and 3. See [AUTHENTICATION.md](./AUTHENTICATION.md) for the full signup/login/deactivation flow.

---

## 5. Why Realtime Database rules are included but unused

The brief asked for both Firestore and Realtime Database rules to paste into the Firebase Console. **BizStock's own data model uses Firestore only** — there's no Realtime Database read or write anywhere in this codebase. `database.rules.json` is a deny-all ruleset included as a safety net: if the Firebase project this is deployed to has Realtime Database enabled (Firebase sometimes provisions it by default, or a prior project on the same Firebase project used it), an unlocked RTDB with its default rules is a real, live exposure sitting next to your actual app. Publishing the deny-all rules closes that door even though this app never opens it.

---

## 6. State management

No global state library. Three layers:

- **`AuthProvider`** (React Context) — the only genuinely global client state: current Firebase user, their Firestore profile (role, active), the single business doc, and derived `loading`/`isOwner` flags.
- **Firestore `onSnapshot` listeners**, one per page/section, wrapped in small `lib/*.ts` helpers (`onProductsSnapshot`, `onSalesSnapshot`, etc.) — each page owns its own real-time subscription and local `useState`. This keeps data fresh across tabs/devices without a cache-invalidation layer to maintain.
- **Local component state** for forms, cart contents, filters, and UI toggles (modals, dropdowns).

---

## 7. Design system

Tailwind v4 theme tokens (`app/globals.css`, `@theme` block) — Violet (`#7C3AED`) as the brand/primary color, Slate neutrals, semantic Success/Warning/Error colors. Inter for UI text, JetBrains Mono for SKUs and other identifiers. Full component list in `components/ui/`. Mobile-first: `DataTable` renders as a real `<table>` on `sm:` and up, and as stacked cards below that; the sales cart is a sticky bottom sheet on mobile and a static sidebar panel on desktop.
