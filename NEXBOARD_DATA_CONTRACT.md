# NexBoard data contract (Lens)

What MYHitch Lens gives to MYHitch NexBoard. NexBoard reads Lens only through these endpoints; it never connects to Lens's database. The rules follow the platform standard `platform-data-api.md` (myhitch-platform-docs, `standards/`). The code is in `src/app/api/nexboard/`, `src/lib/nexboardApi.ts` (checks, envelope, logging) and `src/lib/nexboardLens.ts` (queries).

## Common rules

- Base path `/api/nexboard/`. All endpoints here are `GET`, read-only.
- Header `x-api-key` must equal the environment variable `NEXBOARD_API_KEY` (compared in constant time). Missing or wrong key: `401 {"error":"Unauthorized"}`. Variable not set on Lens: `501 {"error":"..."}`. The key is checked before anything else, including parameter checks.
- Success body: `{ "contract": "<name>_v1", "asOf": "<ISO time>", "data": ..., "meta"?: {...}, "range"?: {...} }`. `range` is present when the call takes dates and echoes them.
- Error body: `{ "error": "<short sentence>" }` with `400` (bad parameters), `401`, `501`, or `500` (a fault: a generic sentence, the real error is only in Lens's server log; never a half answer).
- Every response carries `cache-control: no-store`.
- Calendar days are `YYYY-MM-DD` in Australia/Sydney. Timestamps are ISO 8601 UTC (`...Z`). Lens stores times as UTC without a zone.
- Money is AUD in dollars (decimal numbers, not cents). Lens's ledger has a currency column; its rows are summed as stored, with no conversion.
- No personal data: no emails, passwords, tax or payment details, bios, or text a reader wrote. Writer display names and country are public profile fields and are returned.
- Logging: one JSON line per call on Lens's server log: `{"nexboard_call":"lens","at","endpoint","outcome","status","ms","ip"}`. `outcome` is `ok`, `refused` (401, 501) or `error` (400, 500). `ip` is the first `x-forwarded-for` address. No keys, bodies or parameters are logged. A failed log write never fails the call.
- Versioning: the `contract` value names the exact shape. Adding a field is not breaking; renaming or removing one is, and ships as `_v2`.
- The article review endpoints (`articles/review-queue`, `POST articles/:id/review`, `POST articles/:id/originality-check`) are older, unchanged, and not part of these contracts. They use the same key.

Date parameters must be real days (`2026-02-30` is refused), `to >= from`, and each range at most 400 days counting both ends.

## `GET ping`

Health check, after the key check. Contract `ping_v1`.

```json
{ "contract": "ping_v1", "platform": "lens", "asOf": "2026-11-26T01:02:03.000Z", "data": { "ok": true } }
```

## `GET dashboard`

Everything on NexBoard's Lens dashboard pages. Contract `lens_dashboard_v1`.

Parameters (all required): `from`, `to` (the period shown, both days included), `prevFrom`, `prevTo` (the period before it, used for comparison). The two ranges may be any length up to 400 days; NexBoard sends two ranges of equal length.

Response: `range: { from, to, prevFrom, prevTo }` and `data` with exactly these keys.

| Key | Type | Meaning |
|---|---|---|
| `days` | array of day rows | One row per Sydney day from `prevFrom` to `to`, oldest first, so `prevDays + days` rows. Days with no activity are present with zeros. |
| `readers` | `{ cur: int, prev: int }` | Distinct signed-in readers who viewed an article in `from..to` (`cur`) and in `prevFrom..prevTo` (`prev`). A reader counts once over the whole range, so it is not the sum of the day rows. |
| `articles` | array of article rows | Every article, whatever its status. |
| `writers` | array of writer rows | Every user who has written at least one article. |
| `subscriptions` | array of subscription rows | Every paid subscription (plan not `free`, with a billing interval). |
| `reviews` | array of review rows | The newest originality check of each article that has one. |
| `deals` | array of deal rows | Every Exchange Hub opportunity. |
| `people` | object | Whole-platform counts (see below). |
| `attention` | object | Open items for the Lens team (see below). |
| `categories` | array of string | Lens's category names, A to Z. |

Day row: `day` (string, `YYYY-MM-DD` Sydney), `views` (int, article views), `readers` (int, distinct signed-in users who viewed that day), `likes`, `comments`, `bookmarks`, `shares` (events of kind `share`), `follows`, `signups` (new users), `published` (articles published, by `publishedAt`, status `published` only), all int; `fees` (number, AUD, the platform's cut recorded on ledger entries that day), `authorEarnings` (number, AUD, ledger `net` that day). Ledger entries of type `payout`, `fee`, `boost` and `refund` are left out of `fees` and `authorEarnings`.

Article row: `id`, `slug`, `title`, `category` (name), `contentType` (`Blog`, `News`, `Report` or `Research Paper`), `status` (`draft`, `in_review`, `changes_requested`, `approved`, `scheduled`, `pending_exchange`, `published`, `rejected`, `archived`), `authorId` (strings); `premium` (bool), `featured` (bool, an editor's lead pick for the magazine); `views`, `likes`, `shares` (int, all-time counters); `createdAt` (ISO), `submittedAt` (ISO or null), `publishedAt` (ISO or null); `win: { cur: int, prev: int }` (views of this article in `from..to` and in `prevFrom..prevTo`).

Writer row: `id`, `name` (display name), `country` (string or null: as the writer chose it in Lens, a short list or `Other`), `tier` (`bronze`, `silver`, `gold`; `bronze` when the writer has no rank), `verified` (bool), `joined` (ISO).

Subscription row: `plan` (`creator`, `professional`, `business`), `interval` (`month`, `year`), `status` (`active`, `past_due`, `canceled`, `incomplete`), `cancelling` (bool, set to end at the period end), `extraSeats` (int, company seats beyond the plan).

Review row: `articleId`, `state` (`pending`, `completed`, `error`), `passed` (bool or null, overall), `plagiarismPassed` (bool or null), `aiPassed` (bool or null), `createdAt` (ISO).

Deal row: `id`, `articleId`, `type` (`sponsorship`, `advertising`, `bidding`, `partnership`, `collaboration`, `other`), `status` (`open`, `in_negotiation`, `agreement_pending`, `approved`, `published`, `rejected`, `cancelled`), `expected` (number or null, AUD, the writer's expected value), `agreed` (number or null, AUD), `brand` (string or null, the agreed brand name), `createdAt` (ISO).

`people`: `total` (all users), `readers` (users with role `reader`), `authors` (distinct users with at least one article), `companies` (organisations), all int.

`attention`: `openAppeals` (disputes `open` or `under_review`, or with a pending appeal), `openFlags` (moderation flags not resolved), `suspended` (suspended users), all int.

Limits: `articles`, `writers`, `deals`, `reviews`, `subscriptions` are whole small collections, not paged and not capped. If Lens grows to where this is heavy, a `_v2` with paging replaces it.

## `GET magazine/articles`

The articles a magazine issue can hold. Contract `lens_magazine_articles_v1`.

Parameters: `from`, `to` (required, days included, in UTC as Lens counts its months); `also` (optional, comma-separated article ids, at most 100, default none).

Returns every article with status `published` and `publishedAt` on a day in `from..to`, plus every article named in `also` whatever its status or date (ids that do not exist are ignored). NexBoard decides eligibility; this endpoint does not filter by lane. `range: { from, to }`.

`data` is an array of rows, ordered by `publishedAt` oldest first (null last), then `id`:

| Field | Type | Meaning |
|---|---|---|
| `id`, `slug`, `title` | string | |
| `summary` | string or null | |
| `content` | string or null | The article body as Lens stores it (a JSON document string). |
| `category` | string | Category name. |
| `author` | string | Writer's display name. |
| `plan` | string or null | The writer's Lens plan (`creator`, `professional`, `business`) when their subscription is `active` or `trialing`; null otherwise (treat as free). |
| `status` | string | Article status. |
| `lane` | string | `public`, `panel` or `hybrid`. |
| `publishedAt` | ISO or null | |
| `featured` | int or null | Editor pick slot (1 to 3), null when not featured. |
| `exBrand`, `exValue`, `exAt` | string / number / ISO, each or null | The published Exchange Hub deal with a brand for this article (highest agreed value if several): brand name, agreed value in AUD, resolved time. |
| `bpCreative`, `bpAt` | object / ISO, each or null | The live branding placement (newest `liveFrom`, not past `liveUntil`): its creative object (for example `{ "brandName": "...", "amount": 250 }`) and when it went live. |

`meta: { total: int, capped: boolean }`. At most 500 rows are returned. `total` is the full number that match; `capped` is true when `total` is above 500, and the rows are the first 500 in the order above (an `also` article late in that order can be cut). Split the dates to get the rest.

## `GET magazine/bodies`

The full text of chosen articles. Contract `lens_magazine_bodies_v1`.

Parameter: `ids` (required, comma-separated article ids, 1 to 100 after removing blanks and repeats; each id at most 100 characters), else `400`.

`data`: array of `{ id: string, content: string | null }`, ordered by `id`. Unknown ids are left out. No `meta` and no `range`.
