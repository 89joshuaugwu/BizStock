# Admin Guide — Provisioning Businesses

BizStock is multi-tenant: one deployment can serve many client businesses, each with its own isolated data and its own branding. There is no public signup — every business is created by you (the platform operator), using a CLI script.

---

## 1. Why there's no public signup

Earlier in this project's design, signup was open (`/auth/signup`) — anyone could create a business. That was changed deliberately:

- BizStock is a product you operate and support, not an open marketplace strangers self-onboard into.
- Open signup means taking on abuse/spam prevention, support obligations to businesses you've never vetted, and security surface you don't control.
- The actual goal — "any business that wants one, we set it up and brand it for them" — is a white-label service model, which fits an admin-provisioning flow far better than self-serve.

See `AUTHENTICATION.md` for the full reasoning and how this interacts with the multi-tenant Security Rules.

---

## 2. Creating a new business

From the project root, with `.env.local` filled in (the script reads the same `FIREBASE_ADMIN_*` variables the app uses):

```bash
npm run create-business
```

This runs `scripts/create-business.mjs`, an interactive CLI. It asks for:

1. **Business name**
2. **Owner's full name**
3. **Owner's email**
4. **Default reorder threshold** (optional, defaults to 10)
5. **Brand color** as a hex code, e.g. `#7C3AED` (optional — leave blank to use BizStock's default Violet)
6. **Logo URL** (optional — leave blank to use the default BizStock mark; the owner can also upload one later from Settings → Branding)

It then:

- Creates the Firebase Auth account for the owner, with a random temporary password
- Creates the `/business/{id}` document (name, branding, default threshold, `ownerUid`)
- Creates the `/users/{uid}` document (`role: "owner"`, `active: true`, `businessId` pointing at the new business)
- Prints the business ID and the owner's login credentials to the terminal

**Send the printed email + temporary password to the business owner.** They log in at `/auth/login` and should change their password from Settings afterward.

---

## 3. What the owner can do after that

Once logged in, the owner is fully self-service for their own business:

- Add staff accounts (Staff page) — no further admin involvement needed
- Add products, record purchases, run sales, view reports
- Update their own branding (Settings → Branding: logo + brand color) and business info (name, default reorder threshold)
- Change their own password

You (the admin) never need to touch their data again unless they ask for help — the CLI script's job is done the moment their account exists.

---

## 4. Branding — what's dynamic and what isn't

Once an owner sets a logo and brand color (via the script at creation time, or later from Settings), their **entire dashboard** re-themes: the header logo, the sidebar/nav highlight color, buttons, badges — anything using the Violet brand color swaps to theirs automatically (see `components/shells/AppShell.tsx` — it overrides the relevant CSS variables for that business's whole subtree, computed from their `brandColor` via `lib/color.ts`).

**What does NOT change per business, and why:** the public landing page (`/`), the login page (`/auth/login`), and the site favicon always show BizStock's own default mark, not any individual client's branding. This is a deliberate limitation, not an oversight — all businesses currently share one domain, and there's no way to know which business a visitor represents before they've logged in (no subdomain-per-tenant routing exists in this build). If per-tenant public-facing branding (e.g. `client-name.yourdomain.com` before login) becomes something you want later, that requires adding subdomain-based tenant resolution, which is a genuinely separate, larger piece of work — flag it if you want it scoped.

---

## 5. If you ever need to deactivate or remove a business

There's no "delete a business" flow built in (deliberately — deleting a business's data is destructive and higher-stakes than anything else in this app, and doing it safely means cascading through `products`, `sales`, `purchases`, `stockMovements`, and `notifications`, all filtered by `businessId`). To handle this today:

1. **Deactivate the owner's account**: Firebase Console → Authentication → find the user → Disable account. This blocks login immediately without touching any data.
2. If you need actual deletion later (e.g. for a data-removal request), that's a script worth writing deliberately, scoped to exactly what needs to go — ask for it when the need is concrete rather than building it speculatively now.

---

## 6. Running the script safely

- The script only ever creates NEW businesses — it has no "update" or "delete" mode, so there's no risk of it accidentally modifying an existing business.
- It validates the owner's email format and the brand color's hex format before writing anything.
- If it fails partway through (e.g. Firestore write fails after the Auth user was already created), you'll have an orphaned Firebase Auth user with no matching `/users/{uid}` doc — check Firebase Console → Authentication if a run ever errors out, and delete that orphaned user before retrying with the same email.
