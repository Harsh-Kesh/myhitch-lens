# MYHitch Lens: Replace Registration with Portal SSO and Shared Stripe

**Audience:** an AI coding agent (and the human reviewing it) doing this work step by step in `myhitch-lens-nextjs`.
**Based on:** `NEW_SITE_SSO_AND_STRIPE_INTEGRATION_GUIDE.md` (the generic recipe), plus a read of this repo and of the portal repo (`C:\Users\USER\Desktop\Auth0`). Every file path and line below was checked against those two repos on 2026-10-06. Re-check before editing. Where something is a recommendation and not a fact, it is marked **Decision**.

> **Read first (project rules, from `AGENTS.md`).**
> 1. This is not the Next.js you know (Next 16.2). Before writing any route, page, proxy or server action, read the matching guide in `node_modules/next/dist/docs/`.
> 2. Major change, so work on a branch (`feat/portal-sso`), merge to `main` at the end.
> 3. Report every Railway / Supabase / Stripe change. §12 collects them all.

---

## 0. What changes and what does not

### 0.1 Today (verified)

| Area | How Lens works now | File |
|---|---|---|
| Sign-in / sign-up | One page, username + password, sign-up form picks `reader` / `author` / `corporate`, optional ABN | `src/app/auth/page.tsx`, `src/app/auth/actions.ts` |
| Session | Auth.js v5 (NextAuth beta), **JWT** strategy, Credentials provider checking `User.passwordHash` with bcrypt | `src/auth.ts`, `src/auth.config.ts` |
| Route gating | Edge `proxy.ts` + `authorized()` callback with `PORTAL_PREFIXES` and `ROLE_RULES` | `src/proxy.ts`, `src/auth.config.ts` |
| Roles | `reader`, `author`, `editor`, `corporate`, `admin` on `User.role`. Editor/admin are never self-assignable | `prisma/schema.prisma`, `parseRole()` |
| Companies | `Organization` + `OrgMembership`; the owner creates sub-accounts **with a password** | `src/app/(portal)/company/actions.ts` |
| Identity link slot | `PlatformIdentity { userId, myhitchId @unique }` already exists, "canonical id from the central IdP", unused | `prisma/schema.prisma:777` |
| Money in | Donations: Checkout Session on **Lens's own** Stripe platform, webhook credits `Wallet.balance` | `article/actions.ts` `createDonationCheckout`, `api/webhooks/stripe/route.ts` |
| Money out | Lens **creates an Express account itself** (`stripe.accounts.create`), stores it in `Wallet.stripeConnectId`, withdraws with `transfers.create` | `author-dashboard/payoutActions.ts` |

### 0.2 After this work

```
Visitor ─► Lens /auth/login ─► Portal /api/sso/lens?state=S ─► (login / sign-up at portal) ─► ticket
        ◄─ Lens /auth/callback?ticket=T&state=S  (state checked in the browser, URL stripped)
        ─► server action ─► Auth.js signIn("portal-sso", { ticket })
               └ authorize(): atomic UPDATE sso_tickets … RETURNING (portal DB)
                 find / link / create the Lens User  ─► normal Auth.js JWT session
```

- **Identity** belongs to the portal. Lens keeps its own users, roles and JWT session.
- **Link key:** the Auth0 user id, stored in the existing `PlatformIdentity.myhitchId`. No new column on `User`.
- **Stripe accounts** belong to the portal platform. Lens never creates one. It reads the account id live and charges **on** that account (direct charge + application fee).

### 0.3 Two things that make Lens different from Pass (they drive the design)

1. **Lens users are not all businesses.** Readers, authors and sub-accounts of a company are individuals. The portal today forces every new login through the business wizard (`Auth0/src/app/(auth)/callback/route.ts:115-125` and `mfa/route.ts:~150` call `resolveOnboardingDestination`, which overrides `returnTo` for `in_progress`, `submitted`, `in_review`, `rejected`). Pass avoids this because only organizers use the portal. Lens cannot. See **Phase A, change A3**.
2. **Money model.** Lens credits a wallet and then pays out with transfers from its own platform balance. Under the shared-Stripe rules that path must go away (no `accounts.create`, no use of another platform's accounts). See Phase C.

### 0.4 Decisions to confirm with the human before coding

Answer these at the top of your work log. Defaults are what this guide assumes.

| # | Decision | Default used in this guide |
|---|---|---|
| D1 | Do **all** Lens users sign in via the portal? | **Yes.** Readers too. Needs portal change A3. If the human says no, keep password sign-in for readers only and skip A3 (the rest still applies to authors/companies). |
| D2 | Who may get a ticket? | **Any email-verified portal user** (not approved-only). Approval is checked later, only where it matters (company account creation, payouts). |
| D3 | Production + local origins | Prod `https://myhitchlens.com.au` (from `AUTH_URL`). Local **`http://localhost:3001`** (portal uses 3000, so run Lens with `next dev -p 3001`). |
| D4 | Company sub-accounts (no passwords any more) | **Invite by email.** Owner enters the colleague's email; the account is activated when that person first signs in through the portal with the same verified email. |
| D5 | Donation platform fee | Keep the existing `feeFor("donation", gross)` from `src/lib/marketplace.ts`. |
| D6 | Wallet withdrawals | **Disable `requestPayout`** (as Pass does). Authors manage payouts in their portal-owned Stripe account. Finance must decide what to do with wallet balances that are not Stripe-backed (see C9). |
| D7 | Does Lens bill users itself (subscriptions)? | Code search shows no live billing code (`Subscription` model exists but nothing creates Checkout subscriptions). Default: **no**, so Lens's own `STRIPE_SECRET_KEY` is retired at the end. |

---

## 1. Phase 0: Prep

1. `git checkout -b feat/portal-sso`
2. **Secrets hygiene (checked 2026-10-06).** The committed `.env.example` contains placeholders only, and git history has no real keys. Real values live in the untracked local `.env` and in Railway. Nothing to scrub from git. Still rotate `AUTH_SECRET` at cutover (§5.2 step 3), and rotate any key that was ever pasted into chat or a ticket. Keep `.env.example` placeholder-only and add the new variables to it as each phase introduces them.
3. Run Lens on port 3001 for local SSO testing: set the dev script to `next dev -p 3001`, or start it with `npm run dev -- -p 3001`.

---

## 2. Phase A: Portal changes (`C:\Users\USER\Desktop\Auth0`). Do first, deploy first.

Make these on a portal branch. They touch the portal's behaviour, so get the human's OK before merging.

### A1. Env var

`src/lib/env.ts`, inside `serverSchema`, next to `PASS_SSO_CALLBACK_URL` (line ~122):

```ts
  /** Where Lens receives an SSO ticket. Fixed by config, NEVER read from the request. */
  LENS_SSO_CALLBACK_URL: z.string().url().optional(),
```

`.env.example` (portal):

```bash
# Where Lens receives an SSO ticket (src/app/api/sso/lens). Never read from the query string.
# Local: http://localhost:3001/auth/callback   Prod: https://myhitchlens.com.au/auth/callback
# LENS_SSO_CALLBACK_URL=
```

### A2. New route `src/app/api/sso/lens/route.ts`

Copy `src/app/api/sso/pass/route.ts` (read it again first) and change exactly four things:

```ts
const SITE = "lens";
const callbackUrl = serverEnv().LENS_SSO_CALLBACK_URL;
if (!callbackUrl) return NextResponse.json({ error: "not_configured" }, { status: 501 });
// …state check, verifySession → /login?returnTo=…&site=lens (+mode=signup), emailVerified check: unchanged…
// REMOVE the approved-only block (decision D2). Keep readOnboardingState() only to get profileId:
const onboarding = await readOnboardingState(user);
if (!onboarding) return NextResponse.redirect(absoluteAppUrl("/login?error=auth_failed"));
// insert sso_tickets with audience: SITE ("lens"), 60 s TTL, hash only. Redirect to callbackUrl + ticket + state.
```

Keep every invariant from the generic guide §2.3: destination only from env, `state` shape-validated and echoed, only the SHA-256 stored, `absoluteAppUrl()` for all absolute URLs, `force-dynamic`, `nodejs` runtime. `/api/sso/*` is already no-store in `src/proxy.ts`; no change needed.

No migration: `sso_tickets.audience` is free text.

### A3. Let `site=lens` skip the business wizard (only if D1 = yes)

Problem: after login, `callback/route.ts` and `mfa/route.ts` send `in_progress` users to `/onboarding/business` and `submitted/in_review/rejected` users to `/onboarding/pending`, ignoring `returnTo`.

Fix, small and explicit: define a fixed allow-list of sites that do not need the wizard and bypass the resume redirect only for them.

```ts
// src/lib/onboarding/resume.ts (new export)
/** Sites whose users are not required to finish business onboarding just to sign in. */
const WIZARD_OPTIONAL_SITES = new Set(["lens"]);
export function wizardOptional(site: string | undefined): boolean {
  return !!site && WIZARD_OPTIONAL_SITES.has(site);
}
```

In both `callback/route.ts` (the `const destination = …` block) and `mfa/route.ts` (the same block near line 150):

```ts
const destination = !emailVerified
  ? absoluteAppUrl("/verify-email")
  : bootstrap && !wizardOptional(transaction.site)   // ← new condition
    ? resolveOnboardingDestination({ … })
    : transaction.returnTo;
```

Rules: the unverified-email branch must stay first and unchanged. `transaction.site` already comes from the encrypted transaction cookie and is validated by `^[a-z0-9-]+$`, so it cannot be spoofed after the fact. Add the same bypass anywhere else that calls `resolveOnboardingDestination` after login (`grep -rn resolveOnboardingDestination src`). The `/api/sso/lens` route itself does not call it any more (A2).

> Not verified: I did not read `bootstrapSession()` (`src/lib/core-api.ts`) to confirm it needs no per-site change. Read it before finishing A3.

The business wizard still exists and still matters: it is how an author or company gets a Stripe account (Phase C).

### A4. Portal env and Railway

```bash
LENS_SSO_CALLBACK_URL=https://myhitchlens.com.au/auth/callback     # local: http://localhost:3001/auth/callback
ALLOWED_RETURN_ORIGINS=…unchanged (portal's own origin only)…
```

Do **not** add Lens's origin to `ALLOWED_RETURN_ORIGINS`. The `returnTo` the portal builds points back at the portal's own `/api/sso/lens`.

### A5. Verify the portal before touching Lens

1. Private window: `http://localhost:3000/api/sso/lens?state=abcdefghijklmnop1234` → redirect to `/login?returnTo=…&site=lens`.
2. Sign up a brand-new user with a verified email. Expect to land on `/api/sso/lens` and then on the callback URL **without** passing the wizard (A3).
3. `sso_tickets` has one row, `audience='lens'`, `consumed_at null`.
4. `?state=bad` → `400 invalid_state`.
5. `…&redirect=https://evil.example` → still only the configured URL.
6. `GET /api/sso/pass?state=…` still behaves exactly as before (no regression for Pass). Pass's own wizard behaviour is unchanged because `wizardOptional("pass")` is false.

---

## 3. Phase B: Lens SSO

### B1. Database

No change to `User`. Use the existing `PlatformIdentity` (`myhitchId` = Auth0 `sub`, `userId` unique, `myhitchId` unique). Nothing to migrate.

Optional, and only if D4 invites are built: add `OrgInvite` (see B7).

### B2. Environment (Lens)

```bash
# Public, inlined at build. REBUILD after changing.
NEXT_PUBLIC_PORTAL_URL=https://businessauth.myhitch.com.au     # local: http://localhost:3000

# Server only. Never NEXT_PUBLIC_. Names are PORTAL_-prefixed because SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
# already mean Lens's OWN Supabase project (used for uploads).
PORTAL_SUPABASE_URL=https://<portal-project-ref>.supabase.co
PORTAL_SUPABASE_SERVICE_ROLE_KEY=<portal service-role key>
```

Add placeholder lines for all three to `.env.example`. Set them in Railway (§12).

### B3. `src/lib/portalDb.ts` (new, server-only)

`@supabase/supabase-js` is already a dependency.

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export class PortalDbError extends Error {}

const url = process.env.PORTAL_SUPABASE_URL;
const key = process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY;

export const portalDb = url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function db() {
  if (!portalDb) throw new PortalDbError("Portal database is not configured.");
  return portalDb;
}

export type PortalProfile = {
  profileId: string; auth0UserId: string; email: string; emailVerified: boolean; displayName: string | null;
};
export type PortalBusiness = {
  legalEntityName: string | null; tradingName: string | null; abn: string | null; reviewStatus: string | null;
};

/** Explicit columns only. Never read id_type, id_number or business_documents. */
export async function loadPortalProfile(auth0UserId: string): Promise<PortalProfile | null> {
  const { data, error } = await db().from("profiles")
    .select("id, auth0_user_id, email, email_verified, display_name")
    .eq("auth0_user_id", auth0UserId).maybeSingle();
  if (error) throw new PortalDbError(error.message);
  return data && {
    profileId: data.id, auth0UserId: data.auth0_user_id, email: data.email,
    emailVerified: data.email_verified, displayName: data.display_name,
  };
}

export async function loadPortalBusiness(profileId: string): Promise<PortalBusiness | null> {
  const { data, error } = await db().from("business_profiles")
    .select("legal_entity_name, trading_name, abn, review_status")
    .eq("profile_id", profileId).maybeSingle();
  if (error) throw new PortalDbError(error.message);
  return data && {
    legalEntityName: data.legal_entity_name, tradingName: data.trading_name,
    abn: data.abn, reviewStatus: data.review_status,
  };
}

export type PortalStripeAccount = {
  accountId: string; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean;
};
export async function loadPortalStripeAccount(auth0UserId: string): Promise<PortalStripeAccount | null> {
  const profile = await loadPortalProfile(auth0UserId);
  if (!profile) return null;
  const { data, error } = await db().from("stripe_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
    .eq("profile_id", profile.profileId).maybeSingle();
  if (error) throw new PortalDbError(error.message);
  return data && {
    accountId: data.stripe_account_id, chargesEnabled: data.charges_enabled,
    payoutsEnabled: data.payouts_enabled, detailsSubmitted: data.details_submitted,
  };
}

/** The one write this client ever does: atomically redeem a ticket. Returns the Auth0 id or null. */
export async function consumeTicket(ticket: string): Promise<string | null> {
  const { createHash } = await import("node:crypto");
  const now = new Date().toISOString();
  const { data, error } = await db().from("sso_tickets")
    .update({ consumed_at: now })
    .eq("token_hash", createHash("sha256").update(ticket).digest("hex"))
    .eq("audience", "lens")               // a ticket for Pass can never match
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("auth0_user_id")
    .maybeSingle();
  if (error) throw new PortalDbError(error.message);
  return data?.auth0_user_id ?? null;
}
```

Rules: read-only except `consumeTicket`; Auth0 id only ever comes from a redeemed ticket or from the authenticated Lens user's `PlatformIdentity`, never from the browser. One conditional `UPDATE … RETURNING`, never SELECT then UPDATE (that was the SEC-004 replay bug).

### B4. `src/lib/portalSignIn.ts` (new): find, link or create the Lens user

Signature: `signInPortalUser(auth0UserId, intent?)` returns `{ id, name, email, role } | null`. In order:

1. `loadPortalProfile(auth0UserId)`; return null unless it exists and `emailVerified` is true.
2. **Already linked:** `prisma.platformIdentity.findUnique({ where: { myhitchId }, include: { user: true } })` → return that user (reject if `user.suspended`? Keep current behaviour: the existing login does not block suspended users at sign-in, `isSuspended()` guards actions. Do not change that here).
3. **Same verified email, no identity yet:** `prisma.user.findUnique({ where: { email: lower } })`. If found and it has **no** `PlatformIdentity`, create the identity, set `emailVerified = now`, and **set `passwordHash = null`** (see the warning below). If found and it **already has a different** identity, log `[sso] email already linked to another identity` and return null (surface as 409-style error). Never overwrite a link.
4. **New:** create `User` with `role` from the intent allow-list (below), `displayName` from the portal profile (fallback: email local part), a unique `username`, plus the same nested `profile`, `wallet`, `rank` creates that `registerUser` does today. Create the `PlatformIdentity` in the same `prisma.user.create`. On Prisma `P2002` (lost a race), re-select by `myhitchId`.
5. Activate any pending company invite for this email (B7).

**Username:** derive from the email local part, lower-case, `[a-z0-9_]`, then append a 4-digit random suffix until `findUnique` is empty (cap the retries). Usernames are no longer typed by users, so they must never be used for login after Phase B5.

**Role intent allow-list** (first creation only; existing users keep their role):

```ts
const SELF_ASSIGNABLE = new Set(["reader", "author"]);
// "corporate" is NOT honoured from the browser. Only if the portal business is approved and has a legal name:
//   create role "corporate" + Organization { name: legalEntityName ?? tradingName, abn } + OrgMembership { isAdmin: true, orgRole: "owner" }
//   (same nested create registerUser uses today). Otherwise create a reader and send them to /profile with a notice.
// "editor" / "admin": never from SSO. Granted internally with scripts/grantRole.ts (B9).
```

> **Pre-hijack warning for step 3.** Existing Lens accounts were created with an unverified email. Someone could have registered `victim@x.com` with a password they know. When the real owner later signs in through the portal, step 3 would hand them the attacker's pre-existing account. Setting `passwordHash = null` on link removes the attacker's password. The Auth.js JWTs of any attacker session cannot be revoked individually, which is why §5.2 step 3 rotates `AUTH_SECRET` at cutover.

### B5. Auth.js: add the `portal-sso` provider

`src/auth.ts`: add a second Credentials provider; keep the first temporarily (removed in Phase E).

```ts
Credentials({
  id: "portal-sso",
  name: "MYHitch",
  credentials: { ticket: {}, intent: {} },
  authorize: async (credentials) => {
    const ticket = String(credentials?.ticket ?? "");
    if (!ticket) return null;
    let auth0UserId: string | null;
    try { auth0UserId = await consumeTicket(ticket); }
    catch { return null; }                       // portal unavailable → fail closed
    if (!auth0UserId) return null;
    const intent = String(credentials?.intent ?? "");
    const user = await signInPortalUser(auth0UserId, intent);
    return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
  },
}),
```

`auth.config.ts` needs no change: the `jwt` and `session` callbacks already copy `uid` and `role`. Change `pages: { signIn: "/auth" }` to `"/auth/login"`.

The role in the JWT is the source of truth, as today. `updateSession()` (used by `becomeAuthor()`) keeps working.

### B6. Launcher, callback and server action

**`src/app/auth/login/page.tsx`** (client; replaces the current `/auth` form). Must:
- generate `state` from 32 CSPRNG bytes (`crypto.getRandomValues`) base64url-encoded, matching the portal regex `^[A-Za-z0-9_-]{16,128}$`;
- `sessionStorage.setItem("portal_sso_state", state)`;
- store the optional UI hint `sessionStorage.setItem("lens_sso_intent", role)` where `role` is `?role=` if it is `reader|author|corporate`, else nothing;
- `window.location.replace(`${NEXT_PUBLIC_PORTAL_URL}/api/sso/lens?state=${state}${mode==="signup" ? "&mode=signup" : ""}`)`;
- guard against Strict Mode running the effect twice (`useRef`);
- forward **no** other query parameter to the portal.

**`src/app/auth/callback/page.tsx`** (client). In this order:
1. Run once (`useRef`).
2. Read `ticket` and `state`. Read `portal_sso_state` from `sessionStorage` and **remove it**. Read and remove `lens_sso_intent`.
3. `history.replaceState(null, "", "/auth/callback")` so the ticket leaves the address bar and history.
4. If either value is missing or `expected !== state`, show "This sign-in didn't start here, please try again" and **do not call the server**. This blocks login CSRF.
5. Otherwise call the server action `completePortalSignIn(ticket, intent)`.

**`src/app/auth/actions.ts`**: add

```ts
export async function completePortalSignIn(ticket: string, intent?: string): Promise<AuthResult> {
  try {
    await signIn("portal-sso", { ticket, intent: intent ?? "", redirectTo: "/auth/landing" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "This sign-in link has expired or was already used. Please try again." };
    throw error; // NEXT_REDIRECT
  }
}
```

`redirectTo: "/auth/landing"` is a tiny server component that reads `auth()` and redirects to `ROLE_HOME[role]` (move `ROLE_HOME` out of `actions.ts` into a shared non-"use server" module so both can import it; a `"use server"` file may only export async functions).

### B7. Company sub-accounts without passwords (D4)

Replace `createSubAccount` (it takes `password` and hashes it):

1. Owner enters email, display name and `orgRole` (`author` | `editor`). Keep the seat-limit check.
2. Create an `OrgInvite { id, orgId, email (lower), orgRole, displayName, createdAt, acceptedAt? }` row (new Prisma model; this is the only schema change in the whole project, so write one migration).
3. In `signInPortalUser` step 5: if an unaccepted invite exists for the verified portal email and the user is not yet in an org, create `OrgMembership` with the invite's `orgRole`, set `User.role = "corporate"`, mark the invite accepted. Never auto-create an owner this way.
4. Show pending invites in `CompanyDashboard` with a revoke button.
5. Delete the password fields from the form and from the server action's input type.

Existing sub-accounts keep working: on their first portal sign-in, step 3 of B4 links them by email (they must use the same email that is on their Lens account).

### B8. Company name and ABN come from the portal

Commits `e1c5339`, `b944d89` and `5c11378` added ABN search, ABN-vs-name cross-check, and a company-owner "edit name and ABN" action. Under SSO the legal entity is the portal's:
- Remove `AbnField` from sign-up (the sign-up form is gone).
- Make the company name and ABN **read-only** in `CompanyDashboard`, loaded from `loadPortalBusiness` (fall back to the local `Organization` row if the portal is unreachable; never error the page).
- Replace the edit action with a link: "Edit in MYHitch Business" → `${NEXT_PUBLIC_PORTAL_URL}/onboarding/business`.
- Keep `src/lib/abn.ts` only if something else still needs it.

### B9. Staff roles (`editor`, `admin`)

SSO never grants these. Add `scripts/grantRole.ts` (run with `npx tsx`): takes an email and a role, requires that a `User` with that email and a `PlatformIdentity` exists, sets the role, prints before/after. Staff sign up through the portal once, then an operator runs the script.

Seed demo users (`prisma/seed.ts`) have `@lens.demo` emails and no identity, so they cannot sign in through the portal. For local development only, keep a Credentials provider gated by **both** `process.env.NODE_ENV !== "production"` and `process.env.ENABLE_DEMO_LOGIN === "true"`, and render the demo preset buttons only under the same condition. In production, neither the provider nor the buttons exist.

### B10. Re-point every entry to login

Everything currently links to `/auth`, `/auth?mode=signin`, `/auth?mode=signup[&role=…]`, or redirects to `/auth`. Files found by search:

- Links: `components/layout/LandingHeader.tsx:64,67`, `MobileMenu.tsx:114,121`, `LandingHero.tsx:50`, `app/(landing)/pricing/page.tsx:39,57,76`
- Redirects: `(portal)/layout.tsx:18`, `exchange/page.tsx:17`, `profile/page.tsx:11,22`, `author-dashboard/payouts/page.tsx:23`

Do both: change the links to `/auth/login` (keep `?mode=signup` and `?role=` for the UI hint), and keep `src/app/auth/page.tsx` as a server redirect to `/auth/login` preserving `mode` and `role`, so nothing that was missed breaks. Note: pricing links `?role=editor`; the launcher must ignore it (allow-list `reader|author|corporate` only). Fix the link itself to `author` or `reader`.

The `unauthenticated → signIn page` path from the `authorized()` callback now lands on `/auth/login` automatically.

### B11. Logout

`logoutUser` (`signOut({ redirectTo: "/" })`) ends only the Lens session. The portal session stays, so the next Login signs in with no password, which is the intended SSO behaviour. Do not try to send users to the portal's `/logout?returnTo=<Lens>`: the portal only honours return URLs on its own `ALLOWED_RETURN_ORIGINS` and silently falls back to its default. If the human wants "sign out everywhere", do it as Pass does (open the portal `/logout` in a background tab) as a separate follow-up.

### B12. `SessionSync` and localStorage

`SessionSync` copies role and name into the localStorage store for UI only. Nothing in it changes. Server authorization still comes from the JWT.

---

## 4. Phase C: Shared Stripe

> **DECISION (2026-10-06): donations stay OFF in Lens.** Found during implementation: `createDonationCheckout` had no callers, and the article page already says contributions happen through MYHitch Impact (commit `2924042`, "single revenue path"). With the owner's approval the dead donation code and the old `/api/webhooks/stripe` route were **deleted**, so Lens takes **no card payments**. Consequences for this phase:
> - **C4, C5, C6 and C7 are SKIPPED.** There is no checkout to rewrite, no Connect webhook to register, no `externalRef` migration, no webhook fan-out with Pass, and **no change is needed in the Pass repo**.
> - `PORTAL_STRIPE_CONNECT_WEBHOOK_SECRET` is not needed. Remove it from any env file.
> - What remains: C1-C3 (done), **C8** (replace Lens's own Connect onboarding and withdrawals), **C9** (wallet balances), and the matching tests.
> - If donations are ever re-enabled, C4-C7 below are the design to follow.

### C0. The rules (non-negotiable, from the generic guide §4.1)

1. The portal is the only platform that owns organizer/author Stripe accounts. **`stripe.accounts.create` must not appear in Lens.** Delete the call in `payoutActions.ts`.
2. Author identity maps through `PlatformIdentity.myhitchId` → portal `profiles.auth0_user_id` → portal `stripe_accounts.stripe_account_id`, read **live** every time. No copy in Lens.
3. Charges use the **portal** Stripe client (`PORTAL_STRIPE_SECRET_KEY`) with `{ stripeAccount }` (direct charge) and `application_fee_amount`. Never `transfer_data` or `on_behalf_of`.
4. Metadata on every payment carries `site: "lens"`, `stripe_platform: "portal"`, `stripe_account_id`. Re-checked in the webhook.
5. Fail closed. Portal unreachable ≠ "no account". Unreachable → 503, never fall back to another account or to Lens's own platform.
6. Lens never reads or shows bank details.

### C1. Env

```bash
# Server only
PORTAL_STRIPE_SECRET_KEY=              # portal platform key (sk_ or restricted rk_: Checkout Sessions, PaymentIntents, Charges, Balance, Refunds)
PORTAL_STRIPE_CONNECT_WEBHOOK_SECRET=  # whsec_ of THIS site's Connect endpoint (C6)
# STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET (Lens's own platform): keep ONLY until C7 drains, then delete (decision D7)
```

No `NEXT_PUBLIC_` Stripe key is needed: donations use Stripe-hosted Checkout, so Stripe.js is never loaded in Lens. Test and live keys must come from the same mode. Verify which platform a key belongs to with `stripe.accounts.retrieve()` (no argument) before using it. It must be the platform that owns the portal's connected accounts.

### C2. `src/lib/stripe.ts`: two clients, never mixed

Add next to the existing `getStripe()`:

```ts
let portalClient: Stripe | null = null;
export function getPortalStripe(): Stripe | null {
  const key = process.env.PORTAL_STRIPE_SECRET_KEY;
  if (!key) return null;
  return (portalClient ??= new Stripe(key));
}
```

A `null` client means refuse the payment. Never retry on the other client.

### C3. `src/lib/authorPaymentAccount.ts` (new): resolve the author's account

```ts
export type AuthorAccount =
  | { ok: true; accountId: string; chargesEnabled: boolean; payoutsEnabled: boolean }
  | { ok: false; reason: "unavailable" | "not_ready"; status: 503; message: string };

export async function resolveAuthorAccount(authorUserId: string): Promise<AuthorAccount> {
  const unavailable = { ok: false, reason: "unavailable", status: 503, message: "Payments are temporarily unavailable. Please try again shortly." } as const;
  const notReady = { ok: false, reason: "not_ready", status: 503, message: "This author hasn't finished payout setup yet." } as const;
  try {
    const identity = await prisma.platformIdentity.findUnique({ where: { userId: authorUserId }, select: { myhitchId: true } });
    if (!identity) return notReady;                       // never signed in through the portal
    const acct = await loadPortalStripeAccount(identity.myhitchId);
    if (!acct) return notReady;
    return { ok: true, ...acct };
  } catch (e) {
    return e instanceof PortalDbError ? unavailable : unavailable;   // any failure: unavailable, never a fallback
  }
}
```

The author id always comes from the DB row of the thing being paid for (the article), never from the logged-in donor.

### C4. Donations as direct charges: rewrite `createDonationCheckout`

In `src/app/(portal)/article/actions.ts`:

1. Keep the existing validation (signed in, amount range, article published, not your own article).
2. `const acct = await resolveAuthorAccount(article.authorId)`; if `!acct.ok || !acct.chargesEnabled` return `{ error: acct.message ?? "This author hasn't finished payout setup yet." }`. **Do this before creating anything.**
3. `const stripe = getPortalStripe()`; if null return the "temporarily unavailable" error.
4. Compute `fee = feeFor("donation", amount)` (decision D5), `feeCents = Math.round(fee * 100)`.
5. Create the session **on the author's account**:

```ts
const meta = {
  site: "lens", kind: "donation", lens_ref: `${articleId}:${session.user.id}`,
  articleId, authorId: article.authorId, donorId: session.user.id,
  stripe_platform: "portal", stripe_account_id: acct.accountId,
};
const checkoutSession = await stripe.checkout.sessions.create(
  {
    mode: "payment",
    line_items: [ /* unchanged price_data */ ],
    payment_intent_data: { application_fee_amount: feeCents, metadata: meta },
    metadata: meta,
    success_url: `${base}/article?id=${articleId}&donation=success`,
    cancel_url:  `${base}/article?id=${articleId}&donation=cancelled`,
  },
  { stripeAccount: acct.accountId },
);
```

6. Map Stripe error code `account_invalid` to the 503 message; `amount_too_small` to a 422-style message.
7. UI: where the donate button renders, hide or disable it with "This author hasn't set up payouts yet" when `resolveAuthorAccount` is not ok. Add a small server helper `canReceiveDonations(authorId)` for the article page.

### C5. Retire the wallet-credit step for donations

Money now lands directly in the author's own Stripe balance. If the webhook still did `wallet.balance += net`, the author would be paid twice. So the new settlement function records a ledger row **without** touching the wallet:

- `RevenueLedger` row: `type: "donation"`, `gross`, `feeApplied = application fee`, `net = gross − fee`, `meta: { stripeSessionId, donorId, settlement: "direct", stripeAccount }`.
- `Notification` to the author: unchanged.
- No `wallet.upsert`.

Add a real idempotency key: `RevenueLedger.externalRef String? @unique` (set to the Checkout Session id). The current check (`findFirst` on a JSON path) is racy under concurrent redelivery. This is a Lens Supabase migration (one nullable column + unique index). Handle `P2002` as "already booked".

### C6. New Connect webhook `src/app/api/stripe/portal-webhook/route.ts`

Pattern: the existing `api/webhooks/stripe/route.ts`, but with the portal client and secret.

```ts
const stripe = getPortalStripe();
const secret = process.env.PORTAL_STRIPE_CONNECT_WEBHOOK_SECRET;
if (!stripe || !secret) return new Response("not configured", { status: 501 });
const raw = await req.text();                                   // raw body, one secret
event = stripe.webhooks.constructEvent(raw, req.headers.get("stripe-signature")!, secret);   // 400 on throw

if (event.type === "checkout.session.completed") {
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.metadata?.site !== "lens") return ok("ignored_other_site");       // other sites share this platform
  if (!event.account || s.metadata.stripe_platform !== "portal" || s.metadata.stripe_account_id !== event.account)
    return ok("mismatch_rejected");
  if (s.payment_status !== "paid") return ok("not_paid");
  if (s.metadata.kind === "donation") await settleDonation(s, event.account);   // idempotent (C5)
}
return ok("received");
```

Transient failure (DB down) → return 500 so Stripe retries. Permanent failure (bad metadata) → 200 and log. Also handle `charge.refunded` for donations: add a negative/reversal `RevenueLedger` row and a notification (look up by `payment_intent`). Refunds on direct charges are issued by the author in their Stripe dashboard.

**Register the endpoint** in the **portal's** Stripe Dashboard: Developers → Webhooks → Add endpoint → **"Listen to events on Connected accounts"** → `https://myhitchlens.com.au/api/stripe/portal-webhook` → events `checkout.session.completed`, `charge.refunded`. Put its signing secret in `PORTAL_STRIPE_CONNECT_WEBHOOK_SECRET`. Local: `stripe listen --forward-connect-to localhost:3001/api/stripe/portal-webhook`.

### C7. Webhook fan-out between sites (important)

Every Connect endpoint on the portal platform receives events for every connected account, including Pass payments. Lens's handler ignores anything without `metadata.site === "lens"` (above). The mirror side: Pass's `app/api/stripe/portal-webhook/route.ts` today treats intents with `metadata.event_id` as its own. Lens metadata has no `event_id`, so Pass should ignore Lens events, but **tell the human** that Pass needs the explicit guard ("ignore any intent whose `metadata.site` is set and is not `pass`") before Lens goes live. Do not edit the Pass repo unasked.

**Drain the old platform:** the old `/api/webhooks/stripe` endpoint (Lens's own platform) must stay until no Checkout Session created before cutover can still complete (sessions expire in 24 h by default). Wait 24-48 h after deploy, then delete the route, delete `STRIPE_WEBHOOK_SECRET` and (decision D7) `STRIPE_SECRET_KEY`, and remove the old endpoint in the Lens Stripe Dashboard.

### C8. Replace Connect onboarding and withdrawals (`payoutActions.ts`)

| Old function | New behaviour |
|---|---|
| `startStripeConnectOnboarding` (creates Express account) | Delete. Replace the buttons in `profile/ProfileSettings.tsx:116,269-286` with a link to `${NEXT_PUBLIC_PORTAL_URL}/onboarding/business` ("Set up payouts in MYHitch Business"). |
| `getConnectStatus` | Read `resolveAuthorAccount(user.id)` and map: `configured = !!getPortalStripe()`, `connected = ok`, `payoutsEnabled`. Keep the same return type so `profile/page.tsx` and `MonetizationPanel` need no change. |
| `requestPayout` (transfers from Lens's platform balance) | Disable: return `{ error: "Withdrawals are managed in your MYHitch Business Stripe account." }` and hide the withdraw UI. See C9. |
| `getPayoutHistory` | Keep for historic `Payout` rows. |

The payouts page can show the live balance with `stripe.balance.retrieve(undefined, { stripeAccount: acct.accountId })` on the portal client, display only. Bank changes happen in the Stripe Dashboard; Lens builds no bank form.

Legacy: `Wallet.stripeConnectId` rows point at accounts on Lens's old platform. Stop reading them. Leave the column for now; drop it in a later cleanup migration once finance confirms nothing is owed.

### C9. Wallet balances that are not Stripe-backed

> **DONE 2026-10-06 (option a):** the wallet balance is shown as held platform credit with a note that withdrawals are not available in Lens. **Still open for finance/product:** how and when sponsorship / report-sale balances are actually paid out. Lens has no withdrawal path for them now.

Only donations ever touched Stripe in Lens. Sponsorship, report sales and other `RevenueLedger` types credit the wallet internally with no matching charge. The old `requestPayout` was paying those out from donation money. With withdrawals off, those balances have no payout path. **This needs a finance/product decision before launch**; do not invent one. Options to present: (a) show them as "platform credit" and hold, (b) settle them through a portal-platform transfer funded by the company, (c) convert marketplace purchases to direct charges the same way as donations later.

---

## 5. Phase D: Cutover

### 5.1 Order (it matters)

1. Portal: deploy Phase A with `LENS_SSO_CALLBACK_URL` set in Railway. Run the A5 checks against production.
2. Stripe (portal account): register the Connect webhook (C6), copy the secret.
3. Lens Supabase: run the migration(s) (`RevenueLedger.externalRef`, `OrgInvite`) with `npm run db:deploy`.
4. Lens Railway: set `NEXT_PUBLIC_PORTAL_URL`, `PORTAL_SUPABASE_URL`, `PORTAL_SUPABASE_SERVICE_ROLE_KEY`, `PORTAL_STRIPE_SECRET_KEY`, `PORTAL_STRIPE_CONNECT_WEBHOOK_SECRET`, rotated `AUTH_SECRET`. `NEXT_PUBLIC_*` is baked in at build, so **rebuild**.
5. Deploy Lens. Merge the branch to `main` only after the §7 checklist passes.
6. Pass: deploy the `metadata.site` guard (C7) before real Lens payments.

### 5.2 Existing users

1. Nothing is migrated up front. Each person is linked on their first SSO sign-in by matching verified email (B4 step 3).
2. Users who have no usable email on their Lens account (demo `@lens.demo`) are not expected to sign in.
3. Rotate `AUTH_SECRET` at cutover so all old password-based JWT sessions end and everyone re-authenticates through the portal.
4. Announce the change: "Sign in with your email through MYHitch. Your articles, wallet and ranks stay attached to the same account when you use the same email."

### 5.3 Rollback

Re-deploy the previous Lens build (the password provider is still in the code until Phase E). The portal route is inert without callers. Do not rotate `AUTH_SECRET` back.

---

## 6. Phase E: Cleanup (≈ 2 weeks after stable)

- Delete the `credentials` provider, `loginUser`, `registerUser`, `src/app/auth/page.tsx` form code, `AbnField` usage in auth, and the demo preset buttons.
- Remove the old `/api/webhooks/stripe` route (C7) and the old env vars.
- Drop `User.passwordHash` usage; keep the column until a later migration.
- Remove `Wallet.stripeConnectId` after finance sign-off (C8).
- Delete the dev-only demo provider if it is no longer needed.

---

## 7. Test checklist (all must pass)

There is no test runner in this repo (`package.json` has none). Add small `npx tsx` scripts under `scripts/` for the concurrency and linking tests, or add Vitest if the human agrees.

**SSO**
- [ ] New person: Lens Login → portal sign-up → verify email → back on Lens signed in, landing on their role home, **without** seeing the business wizard (A3).
- [ ] Existing Lens user with the same email: lands on the **same** account (articles, wallet, rank intact), `passwordHash` is now null, `PlatformIdentity` exists.
- [ ] Email already linked to a different Auth0 id: sign-in refused, logged, no link overwritten.
- [ ] Portal session already active: Login returns immediately with no password.
- [ ] Reloading `/auth/callback?ticket=…` fails ("expired or already used").
- [ ] Ticket older than 60 s is rejected.
- [ ] Editing `state` in the callback URL: error shown and **no** request to the server action.
- [ ] 10 parallel `consumeTicket` calls with one ticket: exactly one succeeds.
- [ ] A ticket minted for `pass` is rejected by Lens (wrong audience).
- [ ] Unverified email never reaches Lens.
- [ ] `…/api/sso/lens?state=…&redirect=https://evil.example` only ever goes to the configured callback.
- [ ] `?role=editor` / `?role=admin` on the launcher never produces an editor/admin user.
- [ ] Self-chosen `corporate` with no approved portal business creates a **reader**, not a company.
- [ ] Company invite: owner invites an email → that person signs in → joins the org with the invited `orgRole`. Seat limit still enforced.
- [ ] `/editorial`, `/trust-safety`, `/magazine` still redirect non-staff (ROLE_RULES unchanged).
- [ ] In production build, no demo buttons and no password provider path works.
- [ ] Logout → Login returns instantly (portal session alive); logout at the portal → Login needs a password.

**Stripe**
- [ ] Author with no portal Stripe account: donate refused with the "payout setup" message, **no** Checkout Session created.
- [ ] Portal DB unreachable (bad `PORTAL_SUPABASE_URL`): 503 "unavailable", no fallback.
- [ ] Test-card donation (`4242 4242 4242 4242`): one `RevenueLedger` row, **no wallet increment**, notification sent, even when the webhook is redelivered twice.
- [ ] The charge appears on the **author's connected account** with `application_fee_amount`, platform balance only gets the fee.
- [ ] A Pass `payment_intent.succeeded` delivered to the Lens endpoint is ignored with 200.
- [ ] Metadata tampering (`stripe_account_id` ≠ `event.account`): rejected.
- [ ] `grep -rn "accounts.create" src` returns nothing.
- [ ] Built client bundle contains no `sk_`, `rk_`, `whsec_` or service-role key.
- [ ] `requestPayout` no longer calls `transfers.create`.

---

## 8. Security invariants (final review)

| Area | Must be true |
|---|---|
| Ticket | 256-bit random, SHA-256 stored, 60 s TTL, atomic single use, audience `lens` only |
| Redirect | Destination from env only; Lens origin is not on the portal's return allow-list |
| CSRF | Browser-compared `state`, single read from `sessionStorage` |
| URL hygiene | Ticket removed from the address bar before any other work |
| Linking | Verified email only; never over an existing different link; password cleared on link; sessions reset by `AUTH_SECRET` rotation |
| Roles | `editor`/`admin` never from SSO or browser hints; `corporate` only with an approved portal business or a valid invite |
| Portal DB | Service-role key server-only, explicit columns, no identity-document columns, only write is ticket redemption |
| Money | Direct charges on the portal platform; fee set server-side; metadata re-validated in webhook; ledger idempotent; wallet not double-credited |
| Failure mode | Portal or Stripe unavailable → refuse, never fall back |
| Secrets | Nothing real in git; `.env.example` is placeholders (verified) |

**Known risk to flag, not fix silently:** the portal service-role key gives Lens full access to the portal database. A restricted Postgres role or `SECURITY DEFINER` functions (only "consume ticket" and the four read queries above) would be safer. Offer it; it changes the portal schema, so do not do it unrequested.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| After portal login you land in the business wizard | A3 not applied, or `site=lens` not carried | Check the portal login URL has `site=lens`; check both `callback` and `mfa` routes |
| Portal says `501 not_configured` | `LENS_SSO_CALLBACK_URL` unset on the portal | Set it in Railway, redeploy |
| `400 invalid_state` | Hand-typed URL | Start from `/auth/login` |
| "didn't start here" on callback | Different tab/browser, or storage cleared | Start again in the same tab |
| Callback loops back to login | `authorize()` returned null: expired ticket, wrong audience, portal DB unreachable, email unverified, or email linked elsewhere | Check server logs for `[sso]` lines |
| Redirect goes to `http://localhost:8080` on the portal | URL built from the request, not `absoluteAppUrl()` | Use `absoluteAppUrl()` |
| Session lost locally | Portal and Lens both on port 3000 | Run Lens on 3001 |
| Donate button says payouts not set up | Author has no `stripe_accounts` row (portal onboarding not done) | Author completes portal business onboarding |
| `account_invalid` from Stripe | Key belongs to a different platform than the one that owns the author's account | Confirm with `accounts.retrieve()` |
| Webhook 400 on every event | Wrong secret, or body parsed before verification | Raw `req.text()`, this endpoint's own secret |
| Duplicate ledger rows | Missing unique `externalRef` | C5 |

---

## 10. Reference map

| Concern | Lens file (new = to create) | Portal / other |
|---|---|---|
| Portal hand-off route | n/a | `Auth0/src/app/api/sso/lens/route.ts` (new) from `…/sso/pass/route.ts` |
| Wizard bypass | n/a | `Auth0/src/lib/onboarding/resume.ts`, `(auth)/callback/route.ts`, `(auth)/mfa/route.ts` |
| Ticket table | n/a | `Auth0/supabase/migrations/20260924000000_sso_tickets.sql` |
| Launcher / callback | `src/app/auth/login/page.tsx`, `src/app/auth/callback/page.tsx` (new) | n/a |
| Ticket redemption + linking | `src/lib/portalDb.ts`, `src/lib/portalSignIn.ts` (new), `src/auth.ts` | n/a |
| Role home map | move `ROLE_HOME` out of `src/app/auth/actions.ts` | n/a |
| Stripe clients / account resolve | `src/lib/stripe.ts`, `src/lib/authorPaymentAccount.ts` (new) | portal `stripe_accounts` table |
| Donation checkout | `src/app/(portal)/article/actions.ts` | n/a |
| Connect webhook | `src/app/api/stripe/portal-webhook/route.ts` (new) | portal Stripe Dashboard |
| Payout UI | `author-dashboard/payoutActions.ts`, `profile/ProfileSettings.tsx`, `MonetizationPanel.tsx` | `${PORTAL}/onboarding/business` |

---

## 11. Suggested commit sequence on `feat/portal-sso`

1. `Run dev server on port 3001 for local SSO`
2. `Add portal DB client and ticket redemption`
3. `Add portal-sso Auth.js provider and find/link/create sign-in`
4. `Add SSO launcher, callback and landing pages; re-point all auth links`
5. `Replace company sub-account passwords with email invites`
6. `Make company name and ABN read-only from the portal`
7. `Add portal Stripe client and author account resolver`
8. `Switch donations to direct charges on the author's portal account`
9. `Add Connect webhook and idempotent ledger settlement`
10. `Retire Stripe account creation and wallet withdrawals`
11. (later) cleanup commits from Phase E

Merge to `main` only after §7 passes. Ask before pushing.

---

## 12. Infrastructure changes to report (per AGENTS.md)

**Railway: portal service:** add `LENS_SSO_CALLBACK_URL`.
**Railway: Lens service:** add `NEXT_PUBLIC_PORTAL_URL`, `PORTAL_SUPABASE_URL`, `PORTAL_SUPABASE_SERVICE_ROLE_KEY`, `PORTAL_STRIPE_SECRET_KEY`, `PORTAL_STRIPE_CONNECT_WEBHOOK_SECRET`; rotate `AUTH_SECRET`; later remove `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Rebuild after `NEXT_PUBLIC_*` changes.
**Supabase: Lens project:** migration adding `RevenueLedger.externalRef` (unique) and `OrgInvite`; Later: drop `Wallet.stripeConnectId`.
**Supabase: portal project:** no schema change (`sso_tickets.audience` is free text). Only read access for Lens through the existing service-role key (see risk in §8).
**Stripe: portal account:** register the Connect webhook endpoint for Lens. **Stripe: Lens's old account:** remove the old webhook endpoint after the drain period.
**Pass repo (not touched by this work):** needs the `metadata.site` guard before Lens payments go live (C7).
