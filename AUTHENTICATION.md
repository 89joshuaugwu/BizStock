# Authentication

## 1. Roles

Two roles, stored as `role` on `/users/{uid}`:

- **`owner`** — exactly one per deployment (enforced by convention, not by a database constraint — see §2). Full access to everything.
- **`staff`** — created only by the owner, from the Staff page. Can record sales and view products/prices; cannot edit products, record purchases, view reports, manage staff, or change business settings.

The full RBAC matrix lives in [DATABASE.md](./DATABASE.md) (per-collection) and [PAGES.md](./PAGES.md) (per-page).

---

## 2. Owner signup (`/auth/signup`)

`lib/auth.ts` → `signUpOwner()`:

1. `createUserWithEmailAndPassword` — creates the Firebase Auth user.
2. `updateProfile` — sets `displayName`.
3. `setDoc(/users/{uid})` with `role: "owner"`, `active: true`.
4. `setDoc(/business/main)` with the business name and default reorder threshold.

**Steps 3 and 4 run sequentially, not as a batch**, and the order matters. The Firestore rule for writing `/business/{businessId}` calls `getRole()`, which reads `/users/{uid}` — if that read happens before the user doc exists (which it would, inside an atomic batch, since rule evaluation for a batched write sees pre-batch state), the business write is rejected. Two sequential writes sidestep this entirely; there's no correctness reason they need to be atomic with each other (if step 4 fails after step 3 succeeds, the person has an owner account but no business doc yet — worst case they'd need to retry signup, which is an acceptable failure mode for a one-time setup step).

There is no enforcement preventing a second person from also signing up as `"owner"` and creating a second `/business/{id}` doc under a different ID — the app just always reads/writes `/business/main`, so a second signup would silently create an orphaned document nobody ever sees. This is a deliberate non-issue for the target use case (one shop, one setup, done once) rather than a gap that needed solving.

---

## 3. Login (`/auth/login`)

Shared between owner and staff. `lib/auth.ts` → `loginWithEmail()`:

1. `signInWithEmailAndPassword`.
2. Fetch `/users/{uid}`.
3. If no user doc exists → sign out immediately, error: *"No account record found."*
4. If `active === false` → sign out immediately, error: *"This account has been deactivated. Contact your business owner."*
5. Otherwise, sync the session cookie (§5) and return.

The same deactivation check runs continuously, not just at login: `AuthProvider` keeps a live `onSnapshot` listener on the current user's `/users/{uid}` doc for the whole session, so if the owner deactivates a staff member who's mid-session, that staff member is signed out and redirected to `/auth/login` within moments — not just on their next login attempt.

---

## 4. Staff creation (`/dashboard/staff`, owner only)

Staff accounts can't self-register — there's no public staff signup route. The owner uses the "Add Staff" form, which calls `POST /api/staff/create`. This has to be a server route because creating a Firebase Auth account for someone else requires the Admin SDK (`adminAuth().createUser()`), which is never available in the browser.

The route:
1. Verifies the caller's ID token and confirms `role === "owner"` (see §6).
2. Creates the Firebase Auth user with a random temporary password.
3. Writes their `/users/{uid}` doc with `role: "staff"`, `active: true`.
4. Returns the temp password to the owner's browser, shown once in a modal, to hand to the staff member directly (there's no email-invite flow in this build).

Deactivating/reactivating staff (the toggle on the Staff page) is a direct client-side `updateDoc` on `/users/{uid}` — no API route needed, since the Firestore rule already permits the owner to write that field directly.

---

## 5. The session cookie — what it is and, more importantly, what it isn't

`middleware.ts` redirects signed-out visitors away from `/dashboard/*` based on one thing: whether a `bizstock_session` cookie is present. This cookie is set client-side (`lib/auth.ts` → `syncSessionCookie()`) whenever Firebase Auth reports a signed-in user, and cleared on sign-out.

**This cookie carries no cryptographic weight and is checked nowhere except middleware.** It's a plain `"1"` flag, not a signed token, not verified against Firebase in any way. A person could set it manually in dev tools and still hit a `/dashboard/*` URL — they'd just see a loading spinner and then get redirected once `AuthProvider` confirms (via the real Firebase SDK) that they're not actually signed in, because every page under `(dashboard)` also runs its own client-side check (`app/(dashboard)/layout.tsx`).

The reasons this is fine:
- Firebase Admin SDK doesn't run in Next.js's Edge middleware runtime by default, so verifying a real ID token in `middleware.ts` isn't a lightweight option here.
- Every actual read/write is independently protected — client reads/writes by Firestore Security Rules (evaluated on Firebase's servers against the caller's real, verified auth token), and every mutation-capable API route by `requireUser()`/`requireOwner()` in `lib/api-auth.ts`, which verifies a real Firebase ID token server-side with the Admin SDK.

So: the cookie is UX polish (skip the flash of dashboard chrome before redirecting a logged-out visitor). Security rules and server-side token verification are the actual authorization boundary. This is called out directly in the comments at the top of `middleware.ts` and `lib/api-auth.ts`.

---

## 6. How API routes verify identity

Every route in `app/api/*` that mutates data starts with:

```ts
const user = await requireUser(request);   // throws ApiAuthError if invalid/missing/inactive
requireOwner(user);                         // throws ApiAuthError if not role === "owner" (owner-only routes)
```

`requireUser()` (`lib/api-auth.ts`):
1. Reads the `Authorization: Bearer <idToken>` header.
2. `adminAuth().verifyIdToken(idToken)` — cryptographically verifies the token against Firebase, server-side.
3. Loads `/users/{uid}` and confirms `active === true`.
4. Returns the full `AppUser` (with role) to the route handler.

The client obtains that token via `auth.currentUser.getIdToken()` right before each request (see `lib/sales.ts`, `lib/purchases.ts`, and the staff-create call in `StaffManagementTable.tsx`) — a fresh, short-lived token per request, not a long-lived stored credential.

---

## 7. Password changes

Owner only, from Settings (`/dashboard/settings`), using `updatePassword()` from the Firebase client SDK directly on `auth.currentUser`. If Firebase rejects it with `auth/requires-recent-login` (the account hasn't re-authenticated recently enough for a sensitive operation), the user is told to log out and back in and try again — there's no re-authentication modal built into this version.

Staff password changes aren't exposed in this build; if a staff member needs a new password, the owner would need to be given a "reset staff password" capability in a future iteration (not currently built).
