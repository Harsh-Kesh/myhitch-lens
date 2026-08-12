# MYHitch Lens — Project Plan & Technical Specification

> **Vision:** Trusted Knowledge. Verified Voices.
> A verified, magazine-style publishing platform where domain experts publish
> articles either to a **public feed** (FB-style social reading) or into a
> **private stakeholder panel** where brands and authors transact around
> sponsorship, branding, and placement — and where authors earn real revenue,
> all connected into the wider **MYHitch app ecosystem**.

**Status:** Finalized plan — ready for Phase 0 (all key decisions locked; logical-consistency pass complete — see §17–§18)
**Last updated:** 2026-08-12 (code-audited + finalized)
**Authoritative feature source:** `MYHitch_Lens_Platform_Functions.pdf` (12 function groups)
**Codebase:** https://github.com/Harsh-Kesh/myhitch-lens (public; cloned & audited)
**Style reference (deployed):** https://myhitchlens.com.au

> ⚠️ The account's other repo `LogiQ-On-Tech` is an **unrelated project** — nothing in this plan is derived from it.

---

## 1. Locked decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Marketplace direction | **Two-sided** | Brands bid to sponsor/brand an author's article **and** authors bid/boost for premium placement. |
| DRM / provenance | **Realistic, standards-based** | C2PA Content Credentials + RFC-3161 trusted timestamping + invisible watermarking. **No blockchain/web3** — cost/risk without user value; tokenization can layer later. |
| Payouts | **Stripe Connect** | Real money to bank accounts; internal escrow ledger. |
| Currency | **AUD default + multi-currency** | Stripe multi-currency; AUD settlement; **GST (10%)** via Stripe Tax + tax invoices. |
| Placement fairness | **Capped, gated, always-labeled** *(see §7.1)* | Boosts affect distribution only — never article body or the Verified badge. |
| Stack | **Keep Next.js 16 + React 19 + Tailwind v4; add Postgres · Prisma · Auth.js v5 · Stripe · Claude** *(see §5)* | Grounded in the actual repo; adds a real backend behind the existing `lensStore` seam. |
| Login | **Lens's own login now; swap to shared MYHitch SSO later** | All sibling apps are still in development, so Lens ships standalone auth built behind the `@myhitch/auth-client` interface → later becomes an OIDC client of the central identity with no rewrite. |
| Who can bid | **Any paying member** (author must accept; all placements labeled; brand-safety applies) | Open two-sided market. Guardrails (§7.2) protect editorial trust; Stripe handles payer/payout identity (KYC). |
| Platform fee | **Configurable admin setting** (per revenue type) | Client will set the exact % later; built as an adjustable rate, not hard-coded. |
| Ecosystem | **Hub-and-spoke: central identity + gateway + embed SDK** *(see §5.1)* | Target model once sibling apps exist. Until then Lens runs standalone with placeholder integrations. |
| Deliverable order | **Written doc first**, then Phase 0 | This document. |

---

## 2. Product model — the two publishing lanes

After an author writes an article and it passes editorial approval, they choose a **lane**:

1. **Public lane** — Publishes to the public `/explore` feed (magazine + FB-style social: like, comment, share, follow, bookmark). Monetized by **read-time payouts, ads, and subscriptions**.
2. **Panel lane (Stakeholder Marketplace)** — Offered into a **private marketplace**. **Interim (apps in development):** bidders are Lens's own paying members. **Later:** expands to stakeholders/brands arriving from other MYHitch apps via the ecosystem (§5.1) — same code, wider audience. A **two-sided market**:
   - **Brand → Article (sponsorship auction):** brands bid to attach branding/sponsorship (sponsor banner, logo, "brought to you by", product placement). Author accepts the winning bid → labeled branding renders on the article → **author earns the bid** minus platform fee.
   - **Author → Placement (boost auction):** authors bid for premium placement slots (homepage feature, category-top, panel spotlight, newsletter).
3. **Hybrid** (configurable) — an article can be public **and** carry a sponsor placement won in the panel.

This converts the PDF's vague "Advertising / Sponsored content / Premium reports" bullets into a concrete, defensible **sponsorship + placement marketplace** — the most novel part of the product, and none of it exists in the current code.

---

## 3. Current-state audit (based on the actual repo)

**Stack today:** Next.js **16.2.12** (App Router, route groups `(landing)` + `(portal)`), React **19**, **Tailwind v4**, **GSAP** for reveal animations, TypeScript. **No backend, DB, auth, payments, AI, or storage.**

**How it works:** it's a **polished, fully-interactive front-end prototype** — all state lives in **`localStorage`** via a clean seam at [`src/lib/lensStore.ts`](../src/lib/lensStore.ts) (get/save helpers ported from an original vanilla `shared.js`), seeded from [`src/data/defaults.ts`](../src/data/defaults.ts). "Live" behaviors are simulated with `setTimeout` and hardcoded outputs.

> ⚠️ **Next.js 16 caveat:** `AGENTS.md` warns this version has breaking changes vs. training data — read `node_modules/next/dist/docs/` before writing app code.

**This means the front end is much more complete than the deployed demo implies.** (The live site appeared broken partly because the "Under Development" modal intercepts clicks and the deployment may lag the repo.)

### What already works (client-side simulation)
- **Explore:** live search (title/author/summary) + category filter; article cards navigate to `/article?id=` via `router.push`.
- **Article reader:** full content render, **like** (persists + toggles count), **bookmark** (persists), **comment** (persists), simulated audio-narration progress bar, and ecosystem widgets shown conditionally by integration toggle + category.
- **Submit:** persists a real `QueueItem` into the editorial queue; live word-count & read-time; simulated AI tasks; file "parsing" (uses filename as title).
- **Editorial:** assign editor, schedule date, **approve → publish** (moves queue item into live articles + notification), request revisions, reject (with confirm).
- **Reader/Author dashboards, Categories, Governance appeals, Integrations toggles, role switch, auth simulator** — all wired to the localStorage store.

### What is static / simulated (not real)
- **Auth:** password ignored; identity = role preset name (reader=Markus Green, author=Dr. Sarah Chen, editor=Chief Editor Vance); no registration, verification, or account persistence.
- **AI suite:** all six actions are hardcoded outputs behind a `setTimeout`; no model, no real plagiarism/translation/TTS.
- **Analytics:** headline KPIs, category-share, and trend points are hardcoded constants (only the asset table reads live articles).
- **Author dashboard:** rank "#42 (Gold tier)" and earnings "$2,140.50" are hardcoded display text.
- **Revenue/payments:** subscribe/payout/donation buttons are `alert()`s; no money moves.
- **DRM / web3 / narration / file-parsing:** all simulated.

---

## 4. Discrepancy register (PDF truth vs. actual code)

### 4.1 Real inconsistencies / bugs to fix
1. **Category taxonomy disagrees in four places** — PDF = **11** (Business, Supply Chain, Technology, AI, Healthcare, Education, Travel, Finance, Lifestyle, Research, Community). Code: `/categories` = 11 ✓; `/explore` filter = **10** (missing **Lifestyle**); `/submit` = **8** (missing **Education, Travel, Lifestyle**); homepage index card = **9**. → Single source-of-truth categories list.
2. **Fictional category counts** — `/categories` shows "24 Publications" etc. as hardcoded numbers unrelated to actual articles.
3. **Rank inconsistency** — author dashboard hardcodes "Gold #42" while article/queue data says "Silver Contributor." Cosmetic but visible.
4. **No dark/light toggle** — app is dark-only; PDF lists "Dark mode" as a reader feature, implying a preference/toggle.
5. **"distributed ledger ledger" typo** on the workflow marketing page.

> Note: several items I initially flagged from the *live site* (dead feed links, non-working search, submit not persisting) are **actually functional in the repo** — corrected here after auditing the code.

### 4.2 PDF functions present only as simulation (must become real)
Everything in §3 "static / simulated": real **auth + author verification**, **subscriptions/paywall**, **AI suite** (Claude), **analytics pipeline**, **revenue/payout engine**, **media upload + real Word/PDF parsing**, **DRM/provenance**, **corporate publisher team accounts** (pricing tier exists; no team UI), **social profile integration** (copy only).

### 4.3 Scope inflation in copy (beyond the PDF)
UI invents a **blockchain/web3 layer** ("DRM token minting", "distributed ledger", "web3 wallets", "DOI checking") the PDF never asks for. → Replace with realistic provenance (§7 DRM) and standard payouts.

### 4.4 Net-new (not in code at all)
The **two publishing lanes**, the **sponsorship + placement marketplace**, and the **ecosystem identity/integration backends**.

---

## 5. Target architecture

**Principle:** keep the existing UI and re-point the `lensStore` seam from `localStorage` to a real API. Because `lensStore.ts` already centralizes all reads/writes, most components need little change when data moves server-side — this is the single biggest lever for a low-risk migration.

- **Frontend:** keep Next.js 16 App Router, React 19, Tailwind v4, GSAP, TypeScript.
- **Backend:** Next.js server actions / route handlers; **Zod** validation at every boundary.
- **Database:** **PostgreSQL** (managed — Neon/RDS) with **Prisma** ORM (`pgvector` for embeddings later).
- **Auth:** **Auth.js (NextAuth v5)** — credentials + OAuth now, ready to act as an **OIDC client** of the central ecosystem IdP (§5.1); MFA for editors/admins/brands.
- **Storage:** S3-compatible (Cloudflare R2 / AWS S3) for media + uploads.
- **Payments:** **Stripe** — Subscriptions (3 tiers), **Stripe Connect** (creator payouts), PaymentIntents + escrow ledger, **Stripe Tax** (GST).
- **AI:** **Anthropic Claude** — grammar assist, summaries, translation, SEO/auto-tags, plagiarism & citation *assist* (assistant, never generator, per the About page principle). Managed **TTS** for narration.
- **Realtime (auctions/notifications):** managed **Ably/Pusher** (or Postgres `LISTEN/NOTIFY` + a small WS service) — Next.js serverless doesn't hold long-lived sockets well.
- **Search:** Postgres full-text → **Meilisearch/Typesense** at scale.
- **Provenance/DRM:** C2PA Content Credentials + RFC-3161 timestamping + invisible watermarking.
- **Hosting:** Vercel (natural for Next.js) + managed Postgres.

*All components are self-hostable; nothing hard-locks to one vendor.*

### 5.1 Ecosystem integration architecture ("connect all the MYHitch apps")

**Goal:** one MYHitch platform where a user or stakeholder/brand is a **single identity** across Mart, JetNRest, Pass, Nexus, and Lens, and apps can embed each other's capabilities. **Stakeholders reaching the Lens panel are users/brands originating in the other apps.**

> ✅ **Decided:** all sibling apps are still in development, so **Lens ships standalone now** (its own Auth.js login + placeholder integrations) and adopts the hub model below when the ecosystem is ready. The critical rule: **build behind the interfaces from day one** so the later swap is config, not a rewrite.

Target pattern (adopt as siblings come online) — **hub-and-spoke, independent app repos sharing platform packages**:

1. **Central Identity Provider (the linchpin).** A single **MYHitch SSO** speaking **OpenID Connect / OAuth2**; every app is an OIDC client (Lens via Auth.js). A Mart user is automatically a known identity in Lens; entitlements/roles travel in the token → this is how stakeholders enter the panel. Options: self-hosted **Keycloak/Ory**, or managed **WorkOS/Auth0** (better if enterprise SSO for corporate stakeholders is near-term).
2. **API gateway + shared contracts.** A versioned `@myhitch/api-contracts` package (TS types + Zod + OpenAPI). Lens calls Mart (products), JetNRest (SAF/travel), Pass (events), Nexus (video) through the gateway — never direct DB coupling.
3. **Event bus (async).** A broker (NATS/RabbitMQ/Kafka) carrying `purchase.completed`, `booking.created`, `article.published`, `bid.won` → powers cross-app notifications, **revenue attribution**, and stakeholder onboarding.
4. **Embed SDK.** The 12-integration set becomes `@myhitch/embed-sdk` — signed, sandboxed widgets (Mart cards, JetNRest SAF forms, Pass checkout, Nexus video, consulting scheduler, donations) rendered in Lens articles.
5. **Shared platform packages:** `@myhitch/design-system` (enforces the shared look), `@myhitch/auth-client`, `@myhitch/api-contracts`, `@myhitch/embed-sdk`, `@myhitch/wallet`.
6. **Unified profile & wallet.** The IdP owns the canonical profile; a platform wallet/ledger keeps earnings + stakeholder spend consistent. Each app still owns its domain data (Lens owns articles; Mart owns products) — **single source of truth per entity, federated by the gateway.**

> **Interim integrations (now):** each of the 12 MYHitch integrations renders as a labeled "Coming soon" placeholder driven by the same `@myhitch/embed-sdk` contract, so when an app's API goes live it lights up with no UI change.

---

## 6. Data model (key entities)

- **User** (role: reader|author|editor|corporate|brand|admin, status) · **Profile** (bio, expertise[], portfolio, social links) · **AuthorVerification** (state, credential docs, domain match, reviewer) · **ContributorRank** (points, tier bronze|silver|gold — now *computed*, not hardcoded)
- **Subscription** (tier, stripe ids, status) · **Organization** (corporate publisher; seats)
- **Article** (title, body, category, contentType, status draft→in_review→approved→published, **lane public|panel|hybrid**, media, aiScores, publishedAt, scheduledAt) · **Revision** · **MediaAsset**
- **Category / Tag** (canonical 11 categories — single source of truth) · **EditorialAssignment** · **Review** (double-blind)
- **Comment / Like / Bookmark / Follow / Notification**
- **AnalyticsEvent** (view, read-time-ping, click) → aggregates · **RevenueLedger** (subscription|adshare|read_payout|sponsorship|boost|donation|report_sale|affiliate; records fee applied) · **PlatformFeeConfig** (rate per revenue type, admin-editable) · **Wallet** · **Payout** (Stripe Connect)
- **Marketplace:** **Listing** · **Auction** (type sponsorship|placement) · **Bid** (amount, autobid ceiling) · **BrandingPlacement** · **Campaign** · **BrandSafetyRule**
- **Governance:** **DisputeTicket/Appeal** · **ModerationFlag** · **ProvenanceRecord** (C2PA manifest, timestamp token, watermark id)
- **Ecosystem:** **PlatformIdentity** (canonical MYHitch id ↔ local User) · **Entitlement** (role granted by another app, e.g. `mart.brand`) · **AttributionEvent** (source app, action, value, commission split) · **EmbedInstance**

---

## 7. Two-sided marketplace design (Phase headline)

**Brand → Article (sponsorship auction):** author opens a **Listing** on an approved article (slots, floor price, deadline, allowed brand-safety categories) → verified brands place **Bids** (with auto-bid ceilings; realtime outbid alerts) → author accepts winner → funds to **escrow** → labeled **BrandingPlacement** renders for the live window → escrow releases to author wallet minus fee → **Payout**.

**Author → Placement (boost auction):** author bids for premium slots (homepage feature, category-top, panel spotlight, newsletter) → allocated by effective bid under the fairness rules below → charged via Stripe → live for the won window → tracked in analytics.

**DRM/provenance:** on publish, mint a **C2PA content credential** (signed authorship manifest) + **RFC-3161 timestamp** + **invisible watermark**; expose a public "verify" view. No blockchain.

### 7.1 Placement fairness policy (decided)

Money buys **distribution**, never **credibility**. Organic rank = `f(relevance, recency, engagement, author rank, editorial quality)`. Boosts sit on top under hard constraints:

1. **Quality gate** — content below an editorial/verification threshold **cannot be boosted at all**.
2. **Capped share** — boosted items are a small fixed fraction of any feed (≤ 1 in 5 slots), **always labeled "Boosted/Sponsored."**
3. **Bounded lift** — a boost adds a capped multiplier; it can raise a good article but can't float a weak one above strong organic content.
4. **Frequency caps** — per-reader limits so no buyer dominates a feed.
5. **Second-price (Vickrey) auctions** — winner pays runner-up + increment; discourages overpay wars.
6. **Firewall** — sponsorship/boosts affect placement only; never the body, the Verified badge, or editorial decisions. Reserve price + brand-safety + category match always apply.

### 7.2 Open-bidding trust guardrails (because *any paying member* can bid)

Open bidding is convenient but could let anyone slap branding on serious research. Five guardrails keep "Verified Voices" intact:

1. **Author acceptance is mandatory** — a brand→article bid is only an *offer*; nothing renders until the author accepts. Authors can decline any bidder for any reason.
2. **Always labeled** — every placement shows a clear "Sponsored by …" tag (ACCC-compliant).
3. **Category brand-safety** — articles carry sensitivity flags; bids from mismatched or blocklisted categories are rejected automatically.
4. **Editorial veto + blocklist** — moderators can remove a placement or ban a bidder platform-wide.
5. **Body is untouchable** — sponsorship only affects labeled placement zones, never the article text or the Verified badge.

---

## 8. Revenue model (consolidated)

**Money flow (how the economics close).** Money **in**: subscriptions, ad revenue, sponsorship bids, placement boosts, premium report sales, donations, and later cross-app affiliate commission. Each inbound flow is split by a **configurable platform fee** (set later by the client, per revenue type) → the platform's cut + the creator's share. The **read-time payout pool is funded by a defined slice of subscription + ad revenue** and distributed to authors in proportion to *verified* read-time (anti-fraud gated) — so payouts can never exceed money actually collected. All entries post to **RevenueLedger**; authors withdraw via **Stripe Connect**.

- **Configurable fee:** stored as `PlatformFeeConfig` (rate per revenue type), editable by admins; every ledger entry records the fee applied for auditability.
- **Read-time pool is bounded:** pool size = collected subscription/ad revenue × pool-share %; distribution is share-of-pool, never a fixed per-read amount, so it is always solvent.

**Currency & tax (decided):** **AUD default + multi-currency.** Detect locale, present/settle AUD, allow multi-currency checkout via Stripe. **GST (10%)** via **Stripe Tax**; tax invoices for subscriptions, report sales, boosts, sponsorships. Payout minimums + FX rules in the ledger. Sponsored content labeled per **ACCC** rules.

---

## 9. Phased roadmap (with acceptance criteria)

| Phase | Scope | Done when… |
|-------|-------|-----------|
| **0. Foundation** | Repo audit ✓; Postgres + Prisma schema v1; Auth.js scaffold; re-point `lensStore` reads/writes to server actions behind the same interface; CI + error monitoring | App runs on real DB; a signup persists a row; existing UI works unchanged |
| **1. Accounts & access** *(§1,§2)* | Real registration + login, roles + server-side authorization, **author verification**, **corporate publisher team accounts (seats)**, social-profile fields, Stripe subscriptions, **metered/freemium paywall** (public articles stay crawlable for SEO; premium reports gated) | Role-gated routes enforced server-side; a paid subscription unlocks premium; a corporate org can add seats |
| **2. Article lifecycle** *(§3,§4,§5,§6)* | Real rich editor + Word/PDF parsing + media upload/storage; server-backed submit → editorial → publish/schedule; **admin category & author management**; **single-source categories (all 11)**; **SEO-friendly `/article/[slug]`** + schema.org; **basic feed ranking** (foundation for later boosts); computed contributor rank | Submission → approved → live & readable, server-side; feed ranks by a real signal |
| **3. Reader engagement** *(§9)* | Server-backed like/bookmark/comment/follow/notifications (poll-based now, realtime in P6); **light-dark toggle** + reading prefs | Engagement persists per real account and updates on refresh |
| **4. AI suite** *(§8)* | Claude: grammar, plagiarism/citation assist, summary, translation, SEO/auto-tags; real TTS narration | Each AI action returns real output; narration plays generated audio |
| **5. Monetization core** *(§7,§10)* | Analytics event pipeline (replace hardcoded KPIs); read-time payout engine + anti-fraud; wallet + Stripe Connect payouts; ads; report sales; donations | A read → ledger entry; author withdraws to a connected account |
| **6. ⭐ Marketplace / Bidding Panel** | Two-lane publish; panel (bidders = paying members now); sponsorship + placement auctions with **author acceptance** + **open-bidding guardrails (§7.2)**; **realtime layer** (live bids, outbid alerts, upgrades P3 notifications); boost layer on the P2 ranking; escrow/settlement; configurable fee | A member wins a bid, author accepts → labeled placement live → author paid; fee recorded |
| **7. Governance & trust** *(§11)* | Moderation tools, appeals engine, C2PA provenance + timestamp + watermark, copyright | Appeals resolve; published articles carry a verifiable credential |
| **8. Ecosystem — identity & gateway** *(§5.1)* | Central MYHitch SSO (OIDC) integration; `@myhitch/api-contracts` + gateway; entitlement mapping so stakeholders from other apps get panel/bid rights; event bus + attribution | A user/brand from another MYHitch app signs into Lens with one identity and appears in the panel |
| **9. Ecosystem — embeds & attribution** *(§12)* | `@myhitch/embed-sdk`: real Mart / JetNRest / Pass / Nexus / consulting / donations widgets; cross-app revenue attribution | Toggling an integration renders a live widget; a Mart purchase from an article credits the author |
| **10. Hardening & advancements** | Perf, security review, accessibility (WCAG), SEO/SSR, mobile/PWA | Lighthouse/a11y targets met; security review passed |

---

## 10. Non-functional requirements

- **Security:** row/tenant-scoped authorization enforced server-side on every route + Prisma query; PCI handled entirely by Stripe; audit logs for editorial + marketplace; MFA (via IdP) for editors/admins/brands.
- **Privacy/compliance:** Australian Privacy Act (APPs) + GDPR (consent, export, delete); ACCC advertising-disclosure for sponsored content.
- **Performance:** SSR/ISR for public articles (SEO), sub-second feed loads, CDN media.
- **Reliability:** idempotent payment webhooks; escrow consistency; bid race-safety via DB transactions/constraints.
- **Accessibility:** WCAG 2.2 AA; keyboard nav; add a light theme with verified contrast.

---

## 11. UI / design system — keep & fix

**Keep:** the dark editorial "verified/telemetry" aesthetic, sidebar app nav, card feed, SVG analytics, GSAP reveals, role-aware nav, the clean `lensStore` seam.

**Fix:** single-source the 11 categories everywhere; add light/dark toggle; replace hardcoded rank/earnings/KPIs with real data; real empty/loading/skeleton states; responsive/mobile polish; accessible contrast & focus; label all sponsored placements; fix the "ledger ledger" typo.

---

## 12. Advancements backlog

**Trust & quality:** **AI fact-check & citation-verification assist** (makes "Verified Voices" real; replaces the fake DOI claim) · a **public "Sponsored/Boosted" transparency ledger** (anyone can see what was paid-for) · C2PA content credentials with a public verify page · AI comment moderation.
**Discovery & reach:** personalized/semantic feed & "related articles" (pgvector) · SEO slugs + schema.org rich results · RSS + email digests · "resume reading" · UI internationalization (pairs with the translation feature).
**Creator experience:** draft autosave + version history → collaborative editing · creator payout dashboard with downloadable tax invoices · scheduling/embargo.
**Integrity:** read-time payout anti-fraud (bot/click-farm detection) · auction anti-shill/anti-snipe rules · brand-safety scoring.
**Reach:** PWA/offline reading · developer API + webhooks (serves the Corporate tier's "API access to reader metrics").

---

## 13. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Read-time payout fraud (bots) | Signed read events, heuristics, human-review thresholds |
| Sponsorship eroding editorial trust (open bidding) | Author acceptance + labeling + brand-safety + editorial veto + body firewall (§7.2) |
| Read-time payout pool insolvency | Pool = share of *collected* revenue; share-of-pool distribution, never fixed per-read (§8) |
| Bid race conditions / double-spend | DB transactions + constraints, escrow holds, idempotent settlement |
| Next.js 16 bleeding-edge breakage | Follow `node_modules/next/dist/docs`; pin versions; CI |
| Overbuilding fake blockchain | Dropped; realistic provenance instead |

---

## 14. Grey areas — status

**G1 — Ecosystem reality. ✅ Decided.** All sibling apps are in development. Lens ships **standalone now** (own login + placeholder integrations built behind the ecosystem interfaces) and joins the hub when siblings expose APIs/SSO. *Still useful later:* a running inventory of sibling app APIs as they come online.

**G2 — Who can bid. ✅ Decided (with guardrails).** **Any paying member** may bid. Trust is protected by **author acceptance + labeling + category brand-safety + editorial veto** (§7.2). Payer/recipient identity (KYC) is handled by **Stripe** at pay-in and Stripe Connect at payout — no separate KYC build needed initially.

**G3 — Marketplace economics. ◑ Partly decided.** Platform fee is a **configurable admin setting** (client sets % later). *Still to confirm before Stripe goes live:* minimum bid / reserve defaults, escrow hold period, refund/chargeback handling, payout minimums. Built with sensible defaults + admin overrides; ledger reconciliation is mandatory (§13).

**G4 — Legal/compliance.** Australian Consumer Law + Privacy Act (APPs), GST/tax registration, **ACCC** sponsored-content disclosure, defamation/publisher liability for articles + comments, DMCA/takedown, copyright, cross-border data. **Action:** legal review of ToS, publisher liability, and ad-disclosure before public launch.

**G5 — "AI as assistant, not creator."** The About page prohibits AI-generated articles, but reliable AI-detection does not exist. **Action:** enforce via *disclosure + assist-only tooling + human editorial*, not a false "AI detector." Define the policy explicitly.

**G6 — Author verification rigor.** What credentials count? Manual vs automated? Who runs the vetting board and to what SLA? Fraud/impersonation risk. **Action:** define the verification standard + reviewer workflow.

**G7 — Content moderation & liability at scale.** Comments, disputes, appeals, takedowns; who is the legal publisher; escalation paths. **Action:** moderation policy + tooling scope in Phase 7.

**G8 — Data ownership across apps.** Single source of truth per entity (profile, wallet, product catalog); avoid duplication. **Action:** an entity-ownership map for the ecosystem.

**G9 — Migration & coexistence.** Is the existing demo replaced wholesale or hardened incrementally? Any real user data to migrate (currently only localStorage)? **Action:** confirm — recommended: incremental, re-pointing `lensStore` per feature.

**G10 — Auction fairness & anti-gaming.** Second-price auctions can be gamed (shill bids, sniping); read-time payouts invite bots. **Action:** bid-audit logging, anti-shill rules, reserve prices, and the anti-fraud engine (§13) are non-negotiable for Phase 6.

**G11 — Realtime scale.** Live bidding under concurrency needs tested transactional guarantees and a socket layer Next.js serverless can't host alone. **Action:** decide managed realtime vs. self-hosted early; load-test Phase 6.

---

## 15. Open items still to confirm (owner: client)

Only three remain — none block Phase 0–1:
1. **Exact platform fee %** (built configurable; set when ready).
2. **Marketplace defaults** — min bid/reserve, escrow hold, refund policy (needed before Stripe live in Phase 6).
3. **Author-verification standard** — what credentials count + who runs the vetting board (needed for Phase 1 verification).

## 16. Immediate next steps

1. Sign-off on this document.
2. **Phase 0:** stand up Postgres + Prisma + Auth.js in the repo; re-point `lensStore` to server actions behind the same interface (UI unchanged); Stripe + Claude test-mode keys.
3. Begin **Phase 1** (accounts, roles, verification, subscriptions) — unblocked.

---

## 17. Requirements traceability — every required function is covered

Proof that all 12 PDF groups + the new requirements map to a phase. (Each row = a delivered capability.)

| # | Required function (PDF) | Where it's built |
|---|--------------------------|------------------|
| 1 | **User Management** — registration, verified authors, corporate publisher accounts, author portfolio, contributor ranking, social profiles | Phase 1 (accounts, verification, corporate seats, social fields) + Phase 2 (computed rank) |
| 2 | **Subscription Plans** — Reader/Author/Corporate, premium access, analytics, AI assistant, SEO tools | Phase 1 (tiers + metered paywall); analytics P5; AI + SEO P4 |
| 3 | **Article Submission** — rich editor, Word/PDF upload, images/video/infographics/audio, research/reports/news/blogs | Phase 2 |
| 4 | **Editorial Workflow** — submit, AI quality check, review, approve/reject/revise, publish featured | Phase 2 (workflow) + P4 (AI check) + P6 (featured = boost) |
| 5 | **Editorial Dashboard** — review, assign editors, schedule, moderate comments, manage categories & authors | Phase 2 (assign/schedule/manage) + P7 (moderation) |
| 6 | **Content Categories** — 11 sectors + dynamic filtering | Phase 2 (single-source 11 + filter) |
| 7 | **Revenue Model** — subscriptions, advertising, sponsored content, premium reports, corporate | Phase 5 (subs/ads/reads/reports) + P6 (sponsorship/boosts) |
| 8 | **AI Features** — grammar/plagiarism, SEO, summaries, translations, auto-tags, voice narration | Phase 4 (Claude + TTS) |
| 9 | **Reader Features** — bookmarks, comments, likes, follow, dark mode, notifications | Phase 3 |
| 10 | **Analytics** — views, reading time, followers, revenue, engagement, top categories | Phase 5 |
| 11 | **Governance** — editorial policies, copyright, moderation, appeals, DRM | Phase 7 |
| 12 | **MYHitch Integration** — Mart, professional services, JetNRest, Pass events, donations, Nexus videos | Phase 8–9 (placeholders now → live as siblings ship) |
| N1 | **Two publishing lanes** (public vs. panel) | Phase 6 |
| N2 | **Two-sided bidding marketplace** (brand→article, author→placement) + branding on articles | Phase 6 |
| N3 | **Creator revenue / payouts** | Phase 5 (payouts) + P6 (marketplace earnings) |
| N4 | **Ecosystem connection** (one identity + embeds across apps) | Phase 8–9 |

---

## 18. Logical-consistency review (flaws found & resolved)

The final pass surfaced these contradictions; each is now resolved in the plan:

1. **Double-blind review vs. public bylines & "follow authors."** These seem to conflict. **Resolved:** double-blind applies *only to the vetting stage* (reviewers ↔ authors hidden during review); once published, authorship is public. No contradiction.
2. **Premium paywall vs. public reach/SEO.** A hard paywall would kill the public-feed SEO the revenue model needs. **Resolved:** **metered/freemium** — public articles stay crawlable and readable (with limits for non-subscribers); only premium *reports* are fully gated.
3. **Read-time payouts need a funding source.** Paying authors "per read" with no pool is insolvent. **Resolved:** payout pool = a defined slice of *collected* subscription + ad revenue, distributed as share-of-pool (§8) — can never overspend.
4. **Boosts need a ranking to boost.** The feed just lists articles today. **Resolved:** basic feed ranking lands in Phase 2; the boost layer sits on top in Phase 6.
5. **Open bidding vs. editorial trust.** "Any paying member" could brand serious research. **Resolved:** §7.2 guardrails (author acceptance, labeling, brand-safety, veto, body-firewall).
6. **Realtime notifications (P3) vs. realtime infra (P6).** **Resolved:** notifications start poll-based in P3 and upgrade to realtime when the socket layer arrives in P6.
7. **"Stakeholders from other apps" vs. apps still in development.** **Resolved:** interim bidders = Lens paying members; the audience widens to ecosystem identities later with the same code.
8. **Web3 wallet/DRM copy vs. no-blockchain decision.** **Resolved:** donations = normal Stripe; DRM = C2PA provenance; all web3 copy removed.
9. **`/article?id=` query route vs. SEO.** **Resolved:** move to `/article/[slug]` with schema.org metadata in Phase 2.
10. **Hardcoded rank/earnings/KPIs vs. real data.** **Resolved:** replaced by computed rank (P2) and the analytics/ledger pipeline (P5).
