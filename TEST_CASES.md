# Test Cases

Manual test script. No automated test suite is included in this build — this document is written so it can be executed by hand against a deployed (or local) instance, and is detailed enough to later become the basis for Playwright/Cypress specs if desired.

Legend: **Given** = starting state, **When** = action, **Then** = expected result.

---

## 1. Owner signup & business creation

**TC-1.1 — Successful signup**
Given: no account exists for `owner@test.com`.
When: fill out `/auth/signup` with business name, owner name, email, password (6+ chars) → submit.
Then: redirected to `/dashboard`; header shows the business name; `/users/{uid}` exists with `role: "owner"`, `active: true`; `/business/main` exists with the entered name.

**TC-1.2 — Duplicate email**
Given: `owner@test.com` already has an account.
When: sign up again with the same email.
Then: toast — "An account already exists with this email." No new Firestore docs created.

**TC-1.3 — Weak password**
When: submit signup with a 4-character password.
Then: toast — "Password should be at least 6 characters." (Also blocked by the `minLength={6}` field, but verify the Firebase-side message too.)

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

**TC-3.1 — Staff cannot see owner/admin nav items**
Given: logged in as staff.
Then: sidebar/bottom nav shows only Dashboard, Products, New Sale, Sales History. No Purchases, Reports, Staff, or Settings links anywhere in the UI.

**TC-3.2 — Staff blocked from owner/admin pages via direct URL**
Given: logged in as staff.
When: navigate directly to `/dashboard/staff` (or `/purchases`, `/reports`, `/settings`, `/products/new`).
Then: toast — "This page is only available to the business owner or admin." Redirected to `/dashboard`. Page content is never shown, even briefly.

**TC-3.3 — Staff sees Products as read-only**
Given: logged in as staff, on `/dashboard/products`.
Then: no "Add Product" button; no Edit/Delete actions on any row. Clicking a product name still opens the detail page, but as a read-only card with no stock history panel.

**TC-3.4 — Staff cannot write to protected collections even via raw Firestore calls**
Given: logged in as staff, browser dev console open.
When: attempt `updateDoc(doc(db, "products", "<id>"), { stock: 9999 })` directly.
Then: rejected with a Firestore `permission-denied` error (Security Rules enforce this independent of the UI).

**TC-3.5 — Admin sees owner/admin pages**
Given: logged in as admin.
Then: all nav items visible; full CRUD on Products; Purchases, Reports, Staff, Settings all accessible and functional.

**TC-3.6 — Owner sees everything**
Given: logged in as owner.
Then: all nav items visible; full CRUD on Products; Purchases, Reports, Staff, Settings all accessible and functional.

---

## 4. Product CRUD

**TC-4.1 — Add product**
Given: owner on `/dashboard/products/new`.
When: fill all fields with valid values → submit.
Then: redirected to `/dashboard/products`; new product appears in the list with the correct status badge (In Stock / Low Stock / Out of Stock based on stock vs. reorder threshold).

**TC-4.2 — Add product with invalid numbers**
When: submit with a negative cost price, or a non-numeric stock value.
Then: toast — "Prices, stock, and threshold must be valid, non-negative numbers." Form not submitted.

**TC-4.3 — Edit product**
Given: owner on a product's detail page.
When: change the selling price → save.
Then: toast — "Product updated."; new price reflected immediately in the product list (real-time listener, no manual refresh needed).

**TC-4.4 — Delete product**
When: click Delete on a product → confirm in the modal.
Then: product removed from the list. Past sales/purchases referencing that product are unaffected (their denormalized `name`/`price` fields still display correctly in history).

**TC-4.5 — Product photo upload**
Given: Cloudinary env vars configured.
When: upload an image on the product form.
Then: thumbnail preview appears; on save, `imageUrl` is a Cloudinary URL.

---

## 5. Sales — the hard-block checkout rule

This is the most important business rule in the app: **if any single item in a cart has insufficient stock, the entire sale is rejected — nothing is partially completed.**

**TC-5.1 — Normal sale**
Given: Product A has 10 units in stock, selling price ₦500.
When: add 3 units of Product A to the cart → Complete Sale.
Then: sale succeeds; toast shows the total (₦1,500); Product A's stock is now 7; a `sales` doc and a `stockMovements` doc (type `sale`, quantity 3) are created.

**TC-5.2 — Cart with one item exceeding stock (single item, hard block)**
Given: Product A has 2 units in stock.
When: try to add a 3rd unit via the cart's + stepper.
Then: blocked client-side with a toast — "Only 2 available." (Can't even build an over-limit cart in the UI.)

**TC-5.3 — Race condition: two staff sell the last unit simultaneously**
Given: Product A has exactly 1 unit in stock. Two staff members, on two different devices, both have 1 unit of Product A in their cart.
When: both tap "Complete Sale" at nearly the same moment.
Then: exactly ONE checkout succeeds (stock → 0). The other receives a 409 response with a message naming the product and that 0 are now available, and their sale is fully rejected — no partial deduction, no duplicate sale record.
*(This is the scenario the atomic `adjustStock()` transaction in `lib/stock.ts` exists to prevent — see ARCHITECTURE.md §3.)*

**TC-5.4 — Multi-item cart where a later item fails stock check**
Given: Product A has 10 units, Product B has 0 units (someone else just bought them all, moments before this checkout).
When: cart contains Product A × 2 and Product B × 1 → Complete Sale.
Then: the ENTIRE sale is rejected (not just Product B's line) — toast names Product B specifically and states 0 are available. Product A's stock is untouched (still 10) — verify no partial stock deduction occurred.

**TC-5.5 — Empty cart**
When: tap "Complete Sale" with an empty cart.
Then: button is disabled — cannot be tapped at all.

---

## 6. Purchases

**TC-6.1 — Record a purchase**
Given: Product A has 5 units in stock.
When: owner records a purchase of 20 units at ₦300 cost each, supplier "ABC Distributors."
Then: Product A's stock becomes 25; a `purchases` doc is created (`totalCost: 6000`); a `stockMovements` doc (type `purchase`, quantity 20) is created.

**TC-6.2 — Purchase form pre-fills from selected product**
When: select a product in the purchase form.
Then: cost price and supplier fields pre-fill from the product's current values (still editable).

**TC-6.3 — Staff cannot record purchases**
Given: logged in as staff.
When: attempt `POST /api/purchases/record` directly (e.g. via browser dev tools or curl) with a valid ID token.
Then: `403` response — "This action is only available to the business owner." Stock unchanged.

---

## 7. Low-stock notifications

**TC-7.1 — Crossing the threshold triggers a notification**
Given: Product A has stock 11, reorder threshold 10 (not yet low).
When: a sale brings stock to 10.
Then: a new notification appears in the owner's AlertBell (unread badge increments); message: "Product A is low: 10 units left."

**TC-7.2 — Reaching zero triggers a different notification type**
When: a sale brings Product A's stock to 0.
Then: notification type is `out_of_stock`; message: "Product A is now out of stock."; StatusBadge on the product shows "Out of Stock" (not pulsing, unlike Low Stock).

**TC-7.3 — Restocking above threshold doesn't re-trigger**
Given: Product A is currently below threshold (already has an unread low-stock notification).
When: owner records a purchase bringing stock back above the threshold.
Then: no new notification is created for this restock (only sales/purchases that leave stock AT OR BELOW threshold create one).

**TC-7.4 — Mark notification as read**
When: click a notification in the AlertBell dropdown.
Then: it's marked read (`read: true`); unread badge count decrements; the dot indicator disappears from that row.

**TC-7.5 — Staff never receive notifications**
Given: logged in as staff.
Then: AlertBell shows no badge and an empty "You're all caught up" state, regardless of how many products are low/out of stock — notifications are only ever written for the owner.

---

## 8. Reports

**TC-8.1 — Stock valuation matches manual calculation**
Given: known product list with known `stock` and `costPrice`/`sellingPrice`.
When: open `/dashboard/reports`.
Then: "Stock value (cost)" equals `Σ(stock × costPrice)` across all products; "Retail value" equals `Σ(stock × sellingPrice)`.

**TC-8.2 — Date range filter changes profit and best sellers**
When: switch the range selector from "This month" to "Today."
Then: profit, units sold, and the best-sellers chart all update to reflect only today's sales — verify against a manual count of today's sale docs.

**TC-8.3 — No sales in range**
Given: a business with products but zero sales today.
When: select "Today."
Then: Profit and Units sold both show ₦0 / 0; best-sellers panel shows "No sales in this period yet." instead of an empty chart.

---

## 9. Staff management

**TC-9.1 — Create staff/admin account**
Given: owner on `/dashboard/staff`.
When: click "Add Staff," select role, enter name + email → submit.
Then: modal shows the generated email + temp password; a new `/users/{uid}` doc exists with `role: "admin"` or `"staff"`, `active: true`; a new Firebase Auth user exists.

**TC-9.2 — Duplicate staff email**
When: create a staff account with an email that already has an account.
Then: toast — "An account with this email already exists." No duplicate account created.

**TC-9.3 — Deactivate / reactivate**
When: click "Deactivate" on a staff row.
Then: badge changes to "Deactivated"; button changes to "Activate"; that staff member can no longer log in (TC-2.3) and is signed out if currently active (TC-2.4).

**TC-9.4 — Owner row has no deactivate button**
Given: viewing the Staff list.
Then: the owner's own row shows no Activate/Deactivate button (owners can't deactivate themselves via this UI).

**TC-9.5 — Admin cannot deactivate or edit owner/admins**
Given: logged in as admin, viewing the Staff list.
Then: owner and admin rows show no Activate/Deactivate button. Admin can only toggle regular staff.

---

## 10. Settings

**TC-10.1 — Update business name**
When: change the business name in Settings → save.
Then: header immediately reflects the new name across all open tabs (real-time listener on `/business/main`).

**TC-10.2 — Change password**
When: enter a new password (6+ chars) matching in both fields → submit.
Then: toast — "Password updated."; can log out and back in with the new password.

**TC-10.3 — Password mismatch**
When: "New password" and "Confirm new password" don't match.
Then: toast — "Passwords don't match." No update attempted.

---

## 11. Cross-cutting

**TC-11.1 — Mobile layout**
On a viewport under 640px: bottom tab bar replaces the sidebar; product/purchase tables render as stacked cards; the sales cart renders as a sticky bottom sheet above the tab bar.

**TC-11.2 — Real-time sync across tabs**
Given: two browser tabs open to `/dashboard/products`, both as the owner.
When: add a product in tab A.
Then: it appears in tab B's list within moments, with no manual refresh.

**TC-11.3 — Currency formatting**
Verify all money values app-wide are formatted as Nigerian Naira (`₦`) with tabular numerals, via `formatNaira()` — check sales cart totals, reports, purchase form total, and history tables.
