# Authentication

## 1. Roles and tenancy

Two roles, stored as `role` on `/users/{uid}`, alongside a `businessId` field that ties every account to exactly one business:

- **`owner`** — one per business. Full access to everything within their own business.
- **`staff`** — created only by their business's owner, from the Staff page. Can record sales and view products/prices within that business; cannot edit products, record purchases, view reports, manage staff, or change business settings.

A single Firebase Auth account (one email) belongs to exactly one business, forever — there's no "switch business" flow. Someone can be staff at Business A under one email and separately own Business B under a different email; those are two entirely unrelated accounts with no data crossover (see §2 for why this is safe).

The full RBAC matrix lives in [DATABASE.md](./DATABASE.md) (per-collection) and [PAGES.md](./PAGES.md) (per-page).

---

## 2. There is no public signup

`/auth/signup` doesn't exist in this app. New businesses are created, edited, and deleted by the platform admin, using the admin panel at `/admin` — see [ADMIN.md](./ADMIN.md) for the full flow (`scripts/create-business.mjs` still works too, as a creation-only fallback that doesn't depend on the app being deployed). This was a deliberate design decision, not a missing feature:

- Anyone who could reach a public signup route could create a business and become its owner. Multi-tenant isolation (§3 below) means that's actually *safe* in the sense that they'd only ever see their own new business's empty data — but BizStock is meant to be a service you operate for vetted clients, not an open platform, so self-serve signup doesn't fit the product even though it wouldn't be a security hole.
- Both the admin panel and the CLI script run with the Firebase Admin SDK, which bypasses Firestore Security Rules entirely (same as every route in `app/api/*`) — they create the Firebase Auth owner account, the `/business/{id}` doc, and the `/users/{uid}` doc directly, server-side, in one operation.

---

## 3. Multi-tenant isolation — how a second business can't see the first

Earlier in this project, before multi-tenancy existed, a real bug existed: business data lived at a single fixed document ID, and any new owner signup could silently overwrite it and inherit full access to the existing business's entire dataset. That's fixed now, structurally, at two independent layers:

1. **Firestore Security Rules** (`firestore.rules`) — every document in `products`, `sales`, `purchases`, `stockMovements`, and `users` carries a `businessId` field. Every rule compares that field against the CALLER's own `businessId`, read fresh from their own `/users/{uid}` doc on every request. A user can never claim a different `businessId` — the rule always re-reads their real, stored value.
2. **API routes + `lib/stock.ts`** — the Admin SDK bypasses Firestore rules entirely, so `adjustStock()` (the function that mutates stock for every sale and purchase) independently re-verifies that the target product's `businessId` matches the caller's own, INSIDE the transaction, before touching anything. This is the actual enforcement point for server-side mutations — rules alone don't cover it.

See `ARCHITECTURE.md §4` for the full layer breakdown and `DATABASE.md` for the exact rule on each collection.

---

## 4. Login (`/auth/login`)

Shared between owner and staff, across all businesses — one login page, no business selector needed (an account only ever belongs to one business). `lib/auth.ts` → `loginWithEmail()`:

1. `signInWithEmailAndPassword`.
2. Fetch `/users/{uid}`.
3. If no user doc exists → sign out immediately, error: *"No account record found."*
4. If `active === false` → sign out immediately, error: *"This account has been deactivated. Contact your business owner."*
5. Otherwise, sync the session cookie (§6) and return. `AuthProvider` then resolves which business this user belongs to from their `businessId` and subscribes to that business's doc (branding, settings) — see `ARCHITECTURE.md`.

The same deactivation check runs continuously, not just at login: `AuthProvider` keeps a live `onSnapshot` listener on the current user's `/users/{uid}` doc for the whole session, so if the owner deactivates a staff member who's mid-session, that staff member is signed out and redirected to `/auth/login` within moments — not just on their next login attempt.

---

## 5. Staff creation (`/dashboard/staff`, owner only)

Staff accounts can't self-register — there's no public staff signup route. The owner uses the "Add Staff" form, which calls `POST /api/staff/create`. This has to be a server route because creating a Firebase Auth account for someone else requires the Admin SDK (`adminAuth().createUser()`), which is never available in the browser.

The route:
1. Verifies the caller's ID token and confirms `role === "owner"` (see §7).
2. Creates the Firebase Auth user with a random temporary password.
3. Writes their `/users/{uid}` doc with `role: "staff"`, `active: true`, and **`businessId` set to the calling owner's OWN `businessId`** — read server-side from the owner's verified token, never from anything the client sends. There is no `businessId` field anywhere in the request body, so there's no way for a client to even attempt creating staff under a different business.
4. Returns the temp password to the owner's browser, shown once in a modal, to hand to the staff member directly (there's no email-invite flow in this build).

Deactivating/reactivating staff (the toggle on the Staff page) is a direct client-side `updateDoc` on `/users/{uid}` — no API route needed, since the Firestore rule already permits the owner to write that field, scoped to their own business's staff.

---

## 6. The session cookie — what it is and, more importantly, what it isn't

`proxy.ts` (formerly `middleware.ts` — renamed per the Next.js 16 convention, see the comment at the top of that file) redirects signed-out visitors away from `/dashboard/*` based on one thing: whether a `bizstock_session` cookie is present. This cookie is set client-side (`lib/auth.ts` → `syncSessionCookie()`) whenever Firebase Auth reports a signed-in user, and cleared on sign-out.

**This cookie carries no cryptographic weight and is checked nowhere except the proxy.** It's a plain `"1"` flag, not a signed token, not verified against Firebase in any way, and it says nothing about WHICH business the person belongs to. A person could set it manually in dev tools and still hit a `/dashboard/*` URL — they'd just see a loading spinner and then get redirected once `AuthProvider` confirms (via the real Firebase SDK) that they're not actually signed in, because every page under `(dashboard)` also runs its own client-side check (`app/(dashboard)/layout.tsx`).

The reasons this is fine:
- The Firebase Admin SDK doesn't run in the Proxy runtime either, so verifying a real ID token there isn't a lightweight option.
- Every actual read/write is independently protected — client reads/writes by Firestore Security Rules (evaluated on Firebase's servers against the caller's real, verified auth token AND their businessId), and every mutation-capable API route by `requireUser()`/`requireOwner()` in `lib/api-auth.ts`, which verifies a real Firebase ID token server-side with the Admin SDK and re-derives businessId from that user's own record.

So: the cookie is UX polish (skip the flash of dashboard chrome before redirecting a logged-out visitor). Security rules and server-side token verification are the actual authorization AND tenant-isolation boundary.

---

## 7. How API routes verify identity

Every route in `app/api/*` that mutates data starts with:

```ts
const user = await requireUser(request);   // throws ApiAuthError if invalid/missing/inactive
requireOwner(user);                         // throws ApiAuthError if not role === "owner" (owner-only routes)
```

`requireUser()` (`lib/api-auth.ts`):
1. Reads the `Authorization: Bearer <idToken>` header.
2. `adminAuth().verifyIdToken(idToken)` — cryptographically verifies the token against Firebase, server-side.
3. Loads `/users/{uid}` and confirms `active === true`.
4. Returns the full `AppUser` (with role AND businessId) to the route handler.

Every route that touches a specific product (checkout, record purchase) then checks that product's `businessId` against `user.businessId` before doing anything with it — see `app/api/sales/checkout/route.ts` and `app/api/purchases/record/route.ts`.

The client obtains the ID token via `auth.currentUser.getIdToken()` right before each request (see `lib/sales.ts`, `lib/purchases.ts`, and the staff-create call in `StaffManagementTable.tsx`) — a fresh, short-lived token per request, not a long-lived stored credential.

---

## 8. Password changes

Owner only, from Settings (`/dashboard/settings`), using `updatePassword()` from the Firebase client SDK directly on `auth.currentUser`. If Firebase rejects it with `auth/requires-recent-login` (the account hasn't re-authenticated recently enough for a sensitive operation), the user is told to log out and back in and try again — there's no re-authentication modal built into this version.

Staff password changes aren't exposed in this build; if a staff member needs a new password, the owner would need to be given a "reset staff password" capability in a future iteration (not currently built).

---

## 9. Admin auth (`/admin`) — a completely separate system

Everything above this section describes the owner/staff model: Firebase Auth accounts, `/users/{uid}` docs with a `role` and a `businessId`, Firestore Security Rules that scope every read/write to one business. The admin panel at `/admin` does NOT use any of that.

Instead:

- There is exactly one admin identity: whoever knows `ADMIN_PASSWORD` (an env var — see `.env.local.example`). No Firebase Auth account, no `/users/{uid}` doc, no `businessId`.
- Logging in at `/admin/login` POSTs the password to `/api/admin/login`, which compares it (via a timing-safe comparison, `lib/admin-auth.ts`) and, if correct, sets a signed session cookie (`bizstock_admin_session`) — an HMAC-signed, self-expiring token, not a database-backed session.
- `app/admin/(protected)/layout.tsx` verifies that cookie server-side, cryptographically, on every request to any admin page — a REAL check, unlike the `/dashboard/*` guard in `proxy.ts` (§6), which only checks cookie *presence* because real dashboard auth depends on the Firebase client SDK and can't be verified synchronously in that runtime. Admin auth has no such constraint, so it gets the stronger check.
- Every `/api/admin/*` route calls `requireAdminSession()` before doing anything, same pattern as `requireUser()`/`requireOwner()` for the tenant-scoped routes, just checking a completely different, unrelated credential.

**Why not just make "admin" a role on a `/users/{uid}` doc?** Because that would mean giving one Firebase Auth account a `businessId`-less identity that every Firestore rule and every tenant-scoped API route would need to special-case ("...unless this user is a platform admin, in which case ignore the businessId check"). That's real new complexity injected into the exact rules that are otherwise the entire enforcement mechanism for tenant isolation (see §3) — and it means admin capability becomes reachable through the same login flow, session model, and attack surface as every regular business account. Keeping admin auth as a separate, parallel system means it can be reasoned about independently: nothing about `/admin` existing changes what a compromised owner or staff account could do, and nothing about the owner/staff Security Rules had to change to support it. See ARCHITECTURE.md §11 for more.
