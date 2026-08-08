# Admin Guide — Managing Businesses

BizStock is multi-tenant: one deployment can serve many client businesses, each with its own isolated data and its own branding. There is no public signup — every business is created, edited, and (if needed) deleted by you, the platform operator, through the admin panel at **`/admin`**.

---

## 1. Why there's no public signup

Earlier in this project's design, signup was open (`/auth/signup`) — anyone could create a business. That was changed deliberately:

- BizStock is a product you operate and support, not an open marketplace strangers self-onboard into.
- Open signup means taking on abuse/spam prevention, support obligations to businesses you've never vetted, and security surface you don't control.
- The actual goal — "any business that wants one, we set it up and brand it for them" — is a white-label service model, which fits an admin-managed flow far better than self-serve.

See `AUTHENTICATION.md` for the full reasoning and how this interacts with the multi-tenant Security Rules.

---

## 2. Setting up admin access

Two env vars in `.env.local` (see `.env.local.example`):

```
ADMIN_PASSWORD=<a long, random value>
ADMIN_SESSION_SECRET=<a different long, random value>
```

Generate each with `openssl rand -hex 24` (or any equivalent). **This is deliberately NOT a Firebase Auth account** — it's a single shared password only you know, checked server-side, completely separate from the owner/staff login system every business uses. See `lib/admin-auth.ts` for the full reasoning: this keeps the entire multi-tenant Security Rules model untouched by admin capability — nothing about `/admin` ever runs through Firestore rules or the client Firebase SDK at all, which means adding admin access couldn't accidentally weaken tenant isolation for regular businesses.

Log in at `yourdeployment.com/admin/login`. The session lasts 7 days, then you'll need to log in again.

---

## 3. Managing businesses from `/admin`

Once logged in, you get one page with everything:

**Create a business** — "Create business" button opens a form: business name, owner's name + email, default reorder threshold, optional logo + brand color. On submit, it creates the Firebase Auth owner account, the `/business/{id}` doc, and the `/users/{uid}` doc, then shows you the owner's email + a generated temporary password **once** — copy it before closing, it isn't stored anywhere retrievable afterward. Send those credentials to the business owner; they log in at `/auth/login` and should change their password from Settings.

**Edit a business** — the Edit button on any business card lets you change its name, default reorder threshold, logo, brand color, and toggle the owner's account active/deactivated. Deactivating here does both things at once (disables their Firebase Auth login AND flips their Firestore `active` flag), so the app's normal deactivation UX (clear error message, forced logout if they're mid-session) kicks in properly instead of them just hitting a generic error.

**Delete a business** — irreversible, and gated behind typing the business's exact name to confirm. This cascades through everything scoped to that business: every product, sale, purchase, and stock movement record, every staff and owner account (both their Firestore doc AND their Firebase Auth login), and their notifications. See `lib/admin-businesses.ts` (`deleteBusinessCascade`) for exactly what happens and in what order — the business doc itself is deleted last, so a failure partway through never leaves things in a state where the business "looks gone" while its data still exists.

**Change the contact number** — the card at the top of `/admin` edits the WhatsApp number and pre-filled message shown on the public landing and login pages (`lib/config.ts` holds the static fallback; the live value lives in Firestore at `/platformConfig/main`, read/written exclusively server-side — see `lib/platform-config.ts`).

---

## 4. What the owner can do after you create their business

Once logged in, the owner is fully self-service from there:

- Add staff accounts (Staff page) — no further admin involvement needed
- Add products, record purchases, run sales, view reports
- Update their own branding (Settings → Branding: logo + brand color) and business info (name, default reorder threshold)
- Change their own password

You never need to touch their data again unless they ask for help, or you need to use Edit/Delete from `/admin`.

---

## 5. Branding — what's dynamic and what isn't

Once a business has a logo and brand color set (via `/admin` at creation, via Edit later, or by the owner themselves from Settings), their **entire dashboard** re-themes: the header logo, the sidebar/nav highlight color, buttons, badges — anything using the Violet brand color swaps to theirs automatically (see `components/shells/AppShell.tsx` — it overrides the relevant CSS variables for that business's whole subtree, computed from their `brandColor` via `lib/color.ts`).

**What does NOT change per business, and why:** the public landing page (`/`), the login page (`/auth/login`), and the site favicon always show BizStock's own default mark, not any individual client's branding. This is a deliberate limitation, not an oversight — all businesses currently share one domain, and there's no way to know which business a visitor represents before they've logged in (no subdomain-per-tenant routing exists in this build). If per-tenant public-facing branding (e.g. `client-name.yourdomain.com` before login) becomes something you want later, that requires adding subdomain-based tenant resolution, which is a genuinely separate, larger piece of work — flag it if you want it scoped.

---

## 6. The CLI script — still there as a fallback

`scripts/create-business.mjs` (`npm run create-business`) still works and does the same business-creation operation as the admin panel's "Create business" form, independently implemented. It's worth keeping around because it has zero dependency on the Next.js app being deployed or reachable — useful if you ever need to provision a business while the app itself is down, or want to script/automate creation. It only supports creating, not editing or deleting — use `/admin` for those.

If it ever fails partway through (e.g. the Firestore write fails after the Auth user was already created), you'll have an orphaned Firebase Auth user with no matching `/users/{uid}` doc — check Firebase Console → Authentication if a run errors out, and delete that orphaned user before retrying with the same email. (The admin panel's create flow has the same theoretical failure mode, for the same reason — Auth user creation and Firestore writes aren't a single atomic operation.)
