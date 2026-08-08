# Test Cases

Manual test script. No automated test suite is included in this build — this document is written so it can be executed by hand against a deployed (or local) instance, and is detailed enough to later become the basis for Playwright/Cypress specs if desired.

Legend: **Given** = starting state, **When** = action, **Then** = expected result.

---

## 1. Business provisioning (CLI script)

**TC-1.1 — Successful provisioning**
Given: `node scripts/create-business.mjs` run from the project root, `.env.local` filled in.
When: enter a business name, owner name, valid email, accept default threshold, skip branding.
Then: script prints a business ID and temp password; `/business/{id}` exists with the entered name and `logoUrl: null`, `brandColor: null`; `/users/{ownerUid}` exists with `role: "owner"`, `active: true`, `businessId` matching; a new Firebase Auth user exists for that email.

**TC-1.2 — Duplicate owner email**
Given: an Auth account already exists for `owner@test.com`.
When: run the script again using that same email.
Then: script prints an error and exits without creating a business or user doc — verify no orphaned `/business/{id}` doc was created for this failed attempt.

**TC-1.3 — Invalid brand color rejected gracefully**
When: enter `"blue"` (not a hex code) at the brand color prompt.
Then: script prints a warning that the color is invalid and continues with `brandColor: null` — does not fail the whole run.

**TC-1.4 — Owner logs in with printed credentials**
Given: a business was just provisioned (TC-1.1).
When: the owner logs in at `/auth/login` with the printed email + temp password.
Then: succeeds; lands on `/dashboard`; header shows their business name (or "BizStock" if no branding set yet) via the Logo component's wordmark override.

**TC-1.5 — No public signup route exists**
When: navigate to `/auth/signup`.
Then: 404 — the route does not exist. The CLI script and the `/admin` panel (§13) are the only two ways to create a business — there is no public path.

---

## 2. Login & session

**TC-2.1 — Valid login**
Given: an active owner or staff account exists.
When: log in at `/auth/login` with correct credentials.
Then: redirected to `/dashboard` (or the `?next=` path if arrived via a blocked deep link).

**TC-2.2 — Wrong password**
When: log in with a valid email but wrong password.
Then: toast — "Incorrect email or password." Not signed in.

**TC-2.3 — Deactivated account at login**
Given: a staff account with `active: false`.
When: attempt to log in.
Then: toast — "This account has been deactivated. Contact your business owner." Immediately signed out (not left in a half-logged-in state).

**TC-2.4 — Deactivated mid-session**
Given: a staff member is logged in and active on `/dashboard/sales`.
When: the owner deactivates that staff member from `/dashboard/staff` in another session.
Then: within a few seconds, the staff member is toast-notified and redirected to `/auth/login` — without needing to refresh.

**TC-2.5 — Signed-out visitor hits a dashboard URL directly**
Given: not logged in.
When: navigate directly to `/dashboard/reports`.
Then: redirected to `/auth/login?next=/dashboard/reports`; after logging in as owner, lands on `/dashboard/reports`.

---

## 3. Role-based access control (RBAC)

**TC-3.1 — Staff cannot see owner-only nav items**
Given: logged in as staff.
Then: sidebar/bottom nav shows only Dashboard, Products, New Sale, Sales History. No Purchases, Reports, Staff, or Settings links anywhere in the UI.

**TC-3.2 — Staff blocked from owner-only pages via direct URL**
Given: logged in as staff.
When: navigate directly to `/dashboard/staff` (or `/purchases`, `/reports`, `/settings`, `/products/new`).
Then: toast — "This page is only available to the business owner." Redirected to `/dashboard`. Page content is never shown, even briefly.

**TC-3.3 — Staff sees Products as read-only**
Given: logged in as staff, on `/dashboard/products`.
Then: no "Add Product" button; no Edit/Delete actions on any row. Clicking a product name still opens the detail page, but as a read-only card with no stock history panel.

**TC-3.4 — Staff cannot write to protected collections even via raw Firestore calls**
Given: logged in as staff, browser dev console open.
When: attempt `updateDoc(doc(db, "products", "<id>"), { stock: 9999 })` directly.
Then: rejected with a Firestore `permission-denied` error (Security Rules enforce this independent of the UI).

**TC-3.5 — Owner sees everything**
Given: logged in as owner.
Then: all nav items visible; full CRUD on Products; Purchases, Reports, Staff, Settings all accessible and functional.

---

## 4. Multi-tenant isolation

This is the second most important set of guarantees in the app, after the checkout hard-block (§6 below): **a business must never be able to read or write another business's data, under any circumstance** — not through the UI, not through a direct Firestore call, not through a crafted API request.

**TC-4.1 — Two businesses, two separate product catalogs**
Given: Business A and Business B both provisioned, each owner logged in on a separate device/browser.
When: Business A's owner adds a product.
Then: it appears in Business A's product list. Business B's owner, viewing their own Products page at the same time, never sees it — even with both real-time listeners active simultaneously.

**TC-4.2 — Cross-tenant Firestore read blocked by rules**
Given: logged in as Business A's owner. Business B has a product with a known `productId` (e.g. copied from a Business B teammate for testing).
When: attempt `getDoc(doc(db, "products", "<Business B's productId>"))` directly from the browser console.
Then: the read either returns nothing usable or throws `permission-denied` — the Security Rule's `resource.data.businessId == myBusinessId()` check fails since it doesn't match Business A's owner.

**TC-4.3 — Cross-tenant checkout blocked server-side**
Given: logged in as Business A staff. A product ID belonging to Business B is known.
When: call `POST /api/sales/checkout` directly (e.g. via curl) with a valid Business A staff ID token and that Business B productId in the cart.
Then: `400` response — "Product ... no longer exists." (deliberately identical to a truly nonexistent product — no information about Business B leaks). Business B's stock is completely unchanged. This exercises the businessId check inside `adjustStock()` itself, which runs via the Admin SDK and therefore isn't protected by Firestore rules — see ARCHITECTURE.md §4.

**TC-4.4 — Staff created by Business A's owner can never belong to Business B**
Given: logged in as Business A's owner.
When: create a staff account via the Staff page.
Then: the new staff account's `/users/{uid}` doc has `businessId` equal to Business A's ID — verify there is no way to influence this via the request (the "Add Staff" form has no business selector at all).

**TC-4.5 — Business doc read is tenant-scoped**
Given: logged in as Business A's owner or staff.
When: attempt `getDoc(doc(db, "business", "<Business B's ID>"))`.
Then: `permission-denied` — the read rule requires `businessId == myBusinessId()`.

---

## 5. Product CRUD

**TC-5.1 — Add product**
Given: owner on `/dashboard/products/new`.
When: fill all fields with valid values → submit.
Then: redirected to `/dashboard/products`; new product appears in the list with the correct status badge (In Stock / Low Stock / Out of Stock based on stock vs. reorder threshold).

**TC-5.2 — Add product with invalid numbers**
When: submit with a negative cost price, or a non-numeric stock value.
Then: toast — "Prices, stock, and threshold must be valid, non-negative numbers." Form not submitted.

**TC-5.3 — Edit product**
Given: owner on a product's detail page.
When: change the selling price → save.
Then: toast — "Product updated."; new price reflected immediately in the product list (real-time listener, no manual refresh needed).

**TC-5.4 — Delete product**
When: click Delete on a product → confirm in the modal.
Then: product removed from the list. Past sales/purchases referencing that product are unaffected (their denormalized `name`/`price` fields still display correctly in history).

**TC-5.5 — Product photo upload**
Given: Cloudinary env vars configured.
When: upload an image on the product form.
Then: thumbnail preview appears; on save, `imageUrl` is a Cloudinary URL.

---

## 6. Sales — the hard-block checkout rule

This is the most important business rule in the app: **if any single item in a cart has insufficient stock, the entire sale is rejected — nothing is partially completed.**

**TC-6.1 — Normal sale**
Given: Product A has 10 units in stock, selling price ₦500.
When: add 3 units of Product A to the cart → Complete Sale.
Then: sale succeeds; toast shows the total (₦1,500); Product A's stock is now 7; a `sales` doc and a `stockMovements` doc (type `sale`, quantity 3) are created.

**TC-6.2 — Cart with one item exceeding stock (single item, hard block)**
Given: Product A has 2 units in stock.
When: try to add a 3rd unit via the cart's + stepper.
Then: blocked client-side with a toast — "Only 2 available." (Can't even build an over-limit cart in the UI.)

**TC-6.3 — Race condition: two staff sell the last unit simultaneously**
Given: Product A has exactly 1 unit in stock. Two staff members, on two different devices, both have 1 unit of Product A in their cart.
When: both tap "Complete Sale" at nearly the same moment.
Then: exactly ONE checkout succeeds (stock → 0). The other receives a 409 response with a message naming the product and that 0 are now available, and their sale is fully rejected — no partial deduction, no duplicate sale record.
*(This is the scenario the atomic `adjustStock()` transaction in `lib/stock.ts` exists to prevent — see ARCHITECTURE.md §3.)*

**TC-6.4 — Multi-item cart where a later item fails stock check**
Given: Product A has 10 units, Product B has 0 units (someone else just bought them all, moments before this checkout).
When: cart contains Product A × 2 and Product B × 1 → Complete Sale.
Then: the ENTIRE sale is rejected (not just Product B's line) — toast names Product B specifically and states 0 are available. Product A's stock is untouched (still 10) — verify no partial stock deduction occurred.

**TC-6.5 — Empty cart**
When: tap "Complete Sale" with an empty cart.
Then: button is disabled — cannot be tapped at all.

---

## 7. Purchases

**TC-7.1 — Record a purchase**
Given: Product A has 5 units in stock.
When: owner records a purchase of 20 units at ₦300 cost each, supplier "ABC Distributors."
Then: Product A's stock becomes 25; a `purchases` doc is created (`totalCost: 6000`); a `stockMovements` doc (type `purchase`, quantity 20) is created.

**TC-7.2 — Purchase form pre-fills from selected product**
When: select a product in the purchase form.
Then: cost price and supplier fields pre-fill from the product's current values (still editable).

**TC-7.3 — Staff cannot record purchases**
Given: logged in as staff.
When: attempt `POST /api/purchases/record` directly (e.g. via browser dev tools or curl) with a valid ID token.
Then: `403` response — "This action is only available to the business owner." Stock unchanged.

---

## 8. Low-stock notifications

**TC-8.1 — Crossing the threshold triggers a notification**
Given: Product A has stock 11, reorder threshold 10 (not yet low).
When: a sale brings stock to 10.
Then: a new notification appears in the owner's AlertBell (unread badge increments); message: "Product A is low: 10 units left."

**TC-8.2 — Reaching zero triggers a different notification type**
When: a sale brings Product A's stock to 0.
Then: notification type is `out_of_stock`; message: "Product A is now out of stock."; StatusBadge on the product shows "Out of Stock" (not pulsing, unlike Low Stock).

**TC-8.3 — Restocking above threshold doesn't re-trigger**
Given: Product A is currently below threshold (already has an unread low-stock notification).
When: owner records a purchase bringing stock back above the threshold.
Then: no new notification is created for this restock (only sales/purchases that leave stock AT OR BELOW threshold create one).

**TC-8.4 — Mark notification as read**
When: click a notification in the AlertBell dropdown.
Then: it's marked read (`read: true`); unread badge count decrements; the dot indicator disappears from that row.

**TC-8.5 — Staff never receive notifications**
Given: logged in as staff.
Then: AlertBell shows no badge and an empty "You're all caught up" state, regardless of how many products are low/out of stock — notifications are only ever written for the owner.

---

## 9. Reports

**TC-9.1 — Stock valuation matches manual calculation**
Given: known product list with known `stock` and `costPrice`/`sellingPrice`.
When: open `/dashboard/reports`.
Then: "Stock value (cost)" equals `Σ(stock × costPrice)` across all products; "Retail value" equals `Σ(stock × sellingPrice)`.

**TC-9.2 — Date range filter changes profit and best sellers**
When: switch the range selector from "This month" to "Today."
Then: profit, units sold, and the best-sellers chart all update to reflect only today's sales — verify against a manual count of today's sale docs.

**TC-9.3 — No sales in range**
Given: a business with products but zero sales today.
When: select "Today."
Then: Profit and Units sold both show ₦0 / 0; best-sellers panel shows "No sales in this period yet." instead of an empty chart.

---

## 10. Staff management

**TC-10.1 — Create staff account**
Given: owner on `/dashboard/staff`.
When: click "Add Staff," enter name + email → submit.
Then: modal shows the generated email + temp password; a new `/users/{uid}` doc exists with `role: "staff"`, `active: true`; a new Firebase Auth user exists.

**TC-10.2 — Duplicate staff email**
When: create a staff account with an email that already has an account.
Then: toast — "An account with this email already exists." No duplicate account created.

**TC-10.3 — Deactivate / reactivate**
When: click "Deactivate" on a staff row.
Then: badge changes to "Deactivated"; button changes to "Activate"; that staff member can no longer log in (TC-2.3) and is signed out if currently active (TC-2.4).

**TC-10.4 — Owner row has no deactivate button**
Given: viewing the Staff list.
Then: the owner's own row shows no Activate/Deactivate button (owners can't deactivate themselves via this UI).

---

## 11. Settings

**TC-11.1 — Update business name**
When: change the business name in Settings → save.
Then: header immediately reflects the new name across all open tabs (real-time listener on `/business/main`).

**TC-11.2 — Change password**
When: enter a new password (6+ chars) matching in both fields → submit.
Then: toast — "Password updated."; can log out and back in with the new password.

**TC-11.3 — Password mismatch**
When: "New password" and "Confirm new password" don't match.
Then: toast — "Passwords don't match." No update attempted.

---

**TC-11.4 — Upload a logo**
Given: Cloudinary configured, owner on Settings → Branding.
When: upload an image → Save branding.
Then: `/business/{id}.logoUrl` updates; header logo swaps from the default BizStock mark to the uploaded image, on every open tab in real time (business doc listener).

**TC-11.5 — Set a brand color**
When: enter a valid hex color (e.g. `#059669`) → Save branding.
Then: sidebar active-nav highlight, buttons, and badges across the dashboard immediately switch from Violet to the new color — verify this happens without a page reload (CSS variable override, not a rebuild).

**TC-11.6 — Invalid brand color rejected**
When: enter `"not-a-color"` in the brand color field → Save branding.
Then: toast — "Brand color must be a hex code like #7C3AED." Not saved.

**TC-11.7 — Clearing branding reverts to defaults**
When: remove the logo and clear the brand color field → Save branding.
Then: dashboard reverts to the default BizStock mark and default Violet color.

---

## 12. Cross-cutting

**TC-12.1 — Mobile layout**
On a viewport under 640px: bottom tab bar replaces the sidebar; product/purchase tables render as stacked cards; the sales cart renders as a sticky bottom sheet above the tab bar.

**TC-12.2 — Real-time sync across tabs**
Given: two browser tabs open to `/dashboard/products`, both as the owner.
When: add a product in tab A.
Then: it appears in tab B's list within moments, with no manual refresh.

**TC-12.3 — Currency formatting**
Verify all money values app-wide are formatted as Nigerian Naira (`₦`) with tabular numerals, via `formatNaira()` — check sales cart totals, reports, purchase form total, and history tables.

---

## 13. Admin panel (`/admin`)

The admin panel is a completely separate authentication system from everything above (see AUTHENTICATION.md §9) — these cases specifically verify that separation holds, in addition to the create/edit/delete/config functionality itself.

**TC-13.1 — Admin login with correct password**
Given: `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` set in `.env.local`.
When: enter the correct password at `/admin/login`.
Then: redirected to `/admin`; business list loads.

**TC-13.2 — Admin login with wrong password**
When: enter an incorrect password.
Then: toast — "Incorrect password." Not redirected; no session cookie set.

**TC-13.3 — Unauthenticated visitor blocked from `/admin`**
Given: no admin session cookie.
When: navigate directly to `/admin`.
Then: server-side redirect to `/admin/login` — verify this happens even with JavaScript disabled or via a raw `curl` request (this is a real server-side check, not a client-side one — see ARCHITECTURE.md §11).

**TC-13.4 — Business owner/staff credentials do NOT work as admin login**
Given: a valid business owner's email + password from `/auth/login`.
When: try entering that same password at `/admin/login`.
Then: rejected — "Incorrect password." (Admin auth has nothing to do with any business account or Firebase Auth at all — this confirms the two systems are genuinely unrelated, not just presented separately.)

**TC-13.5 — Admin session does not grant dashboard access, and vice versa**
Given: logged in as admin only (no business account session).
When: navigate to `/dashboard`.
Then: redirected to `/auth/login` — the admin session cookie is a different cookie entirely and confers no access to any business's dashboard.

**TC-13.6 — Create a business from the panel**
When: click "Create business," fill in name/owner name/owner email, optionally set branding, submit.
Then: credentials modal shows the owner's email + a generated temp password; the business appears in the list immediately after closing the modal; `/business/{id}`, `/users/{ownerUid}` created correctly (same checks as TC-1.1).

**TC-13.7 — Edit a business's branding and threshold**
When: click Edit on a business, change the name, upload a new logo, change the brand color, change the threshold, save.
Then: toast success; list view reflects the new name/logo/color immediately; the business's own dashboard (logged in separately as that owner) shows the updated branding on next load.

**TC-13.8 — Deactivate an owner from the edit modal**
When: toggle "Owner account active" off, save.
Then: `/users/{ownerUid}.active` becomes `false` AND the Firebase Auth account becomes disabled (verify in Firebase Console → Authentication). If that owner is logged in elsewhere, they're signed out within moments (same live-listener behavior as TC-2.4). They cannot log back in until reactivated.

**TC-13.9 — Delete requires typing the exact business name**
When: click Delete on a business, then try clicking "Delete permanently" with the confirmation field empty or containing the wrong text.
Then: the delete button stays disabled — the request is never sent.

**TC-13.10 — Delete cascades completely**
Given: a test business with at least one product, one sale, one purchase, and one staff account.
When: type the exact business name and confirm delete.
Then: success toast shows non-zero counts for products/sales/purchases; `/business/{id}` no longer exists; querying `products`/`sales`/`purchases`/`stockMovements` for that `businessId` returns nothing; the owner's and staff's `/users/{uid}` docs are gone; their Firebase Auth accounts no longer exist (Console → Authentication); their `/notifications/{uid}/items` subcollections are gone.

**TC-13.11 — Contact number update reflects on public pages**
When: change the WhatsApp number in the admin panel's Contact card, save.
Then: reload the (logged-out) landing page and login page — the "Get started" / "Get in touch" links now point to the new number (verify by inspecting the `href`, which should contain the new digits).

**TC-13.12 — Invalid contact number rejected**
When: enter a number containing letters or a `+` prefix, save.
Then: toast error naming the expected format; not saved.

**TC-13.13 — Admin logout**
When: click "Log out" in the admin header.
Then: session cookie cleared; navigating to `/admin` afterward redirects to `/admin/login` again.
