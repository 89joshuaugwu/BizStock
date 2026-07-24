# Pages

Every route in the app, who can access it, and what it does. "Both" means owner and active staff; owner-only pages redirect staff to `/dashboard` with a toast (`OwnerOnlyGuard`) if they navigate there directly.

---

## Public (no auth)

| Route | Access | Purpose |
|---|---|---|
| `/` | Anyone | Landing page — hero, feature grid, CTA to sign up |
| `/auth/signup` | Anyone | Owner-only self-service signup (business name, owner name, email, password) |
| `/auth/login` | Anyone | Shared login for owner and staff |

A signed-out visitor hitting any `/dashboard/*` URL is redirected to `/auth/login?next=<original path>` and sent back there after logging in.

---

## Dashboard (behind auth)

### `/dashboard` — Home
**Access:** Both.
Stat cards (total products, low stock count, out-of-stock count, today's sales total). Quick-action buttons (New Sale for both; Add Product / Record Purchase for owner only). Recent activity feed — owner sees the last 8 stock movements (purchases + sales combined, across all products); staff see the last 8 sales only (movements are owner-only data, per `stockMovements`' Security Rules).

### `/dashboard/products` — Products
**Access:** Both (owner: full CRUD; staff: read-only).
Searchable, filterable (by category) product table. Desktop: real `<table>`. Mobile: stacked cards. Owner sees Edit/Delete actions and an "Add Product" button; staff see neither.

### `/dashboard/products/new` — Add Product
**Access:** Owner only (`OwnerOnlyGuard`).
Form: name, SKU, category, supplier, cost price, selling price, initial stock, reorder threshold, optional photo upload (Cloudinary).

### `/dashboard/products/[id]` — Product Detail
**Access:** Both, different content per role.
- **Owner:** the same form as Add Product, pre-filled and editable, plus a stock history panel (all `stockMovements` for this product — owner-only data).
- **Staff:** a read-only info card (SKU, category, supplier, price, stock, reorder threshold). No stock history panel, since staff can't read `stockMovements`.

### `/dashboard/sales` — New Sale
**Access:** Both.
POS-lite screen: search a product by name/SKU, tap a result to add it to the cart, adjust quantities with +/− steppers, see a running total, tap "Complete Sale." On success, stock is deducted server-side (see `POST /api/sales/checkout`) and a sale record is created.

### `/dashboard/sales/history` — Sales History
**Access:** Both.
Chronological list of the last 100 sales, each row expandable to show line items. Shows who sold it (`soldByName`).

### `/dashboard/purchases` — Record Purchase
**Access:** Owner only.
Pick an existing product, enter quantity received + cost price + supplier, submit. Stock is added server-side (see `POST /api/purchases/record`).

### `/dashboard/purchases/history` — Purchase History
**Access:** Owner only.
Sortable table of the last 100 purchases: date, product, quantity, unit cost, total, supplier, who recorded it.

### `/dashboard/reports` — Reports
**Access:** Owner only.
Date range filter (Today / This week / This month / All time). Three stat cards: stock value at cost (+ retail value), profit for the selected period (+ margin %), units sold. A horizontal bar chart of the top 8 best-selling products by units sold in the selected period.

### `/dashboard/staff` — Staff
**Access:** Owner only.
List of every account (owner + staff) with role and active/deactivated status. "Add Staff" opens a modal to create a new staff account (email + auto-generated temp password, shown once). Each staff row has an Activate/Deactivate toggle.

### `/dashboard/settings` — Settings
**Access:** Owner only.
Two forms: business info (name, default reorder threshold) and change password.

---

## Not found

`app/not-found.tsx` — a branded 404 for any unmatched route, with a link back to `/`.
