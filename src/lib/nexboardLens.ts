import { Prisma } from "@prisma/client";

/**
 * The queries behind /api/nexboard/dashboard and /api/nexboard/magazine/* (NEXBOARD_DATA_CONTRACT.md). They are the same SQL
 * MYHitch NexBoard used to run itself through a read-only database login, moved here so NexBoard asks Lens instead.
 * Each takes a client with `$queryRaw` (the app's Prisma client; a test can pass a stand-in).
 */
export type Db = { $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T> };

type Period = { from: string; to: string; prevFrom: string; prevTo: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

// Prisma returns Date for timestamps, BigInt for counts not cast to int, Decimal for numeric: JSON needs plain values.
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

// Lens stores times as UTC without a zone (Prisma reads them as UTC); days are Sydney calendar days
const local = (col: string) => Prisma.raw(`((${col} at time zone 'UTC') at time zone 'Australia/Sydney')::date`);

export async function lensDashboard(q: Db, period: Period) {
  const run = (s: Prisma.Sql) => q.$queryRaw<Raw[]>(s);
  // a day early in UTC, so every Sydney day of the previous period is included
  const since = Prisma.sql`(${period.prevFrom}::date - 1)::timestamp`;
  const cur = Prisma.sql`d between ${period.from}::date and ${period.to}::date`;
  const prev = Prisma.sql`d between ${period.prevFrom}::date and ${period.prevTo}::date`;

  const [articles, daily, readers, writers, subs, reviews, deals, people, attention, cats] = await Promise.all([
    run(Prisma.sql`
      with v as (select "articleId" as id, ${local('"createdAt"')} as d from "AnalyticsEvent" where kind = 'view' and "createdAt" >= ${since})
      select a.id, a.slug, a.title, c.name as category, a."contentType" as "contentType", a.status::text as status, a."isPremium" as premium,
             a."magazineFeatured" as featured, a."authorId" as "authorId", a."viewsCount"::int as views, a."likesCount"::int as likes,
             a."sharesCount"::int as shares, a."createdAt" as "createdAt", a."submittedAt" as "submittedAt", a."publishedAt" as "publishedAt",
             coalesce(w.cur, 0) as cur, coalesce(w.prev, 0) as prev
      from "Article" a
      join "Category" c on c.id = a."categoryId"
      left join (
        select id, (count(*) filter (where ${cur}))::int as cur, (count(*) filter (where ${prev}))::int as prev
        from v group by id
      ) w on w.id = a.id`),
    run(Prisma.sql`
      with days as (select generate_series(${period.prevFrom}::date, ${period.to}::date, interval '1 day')::date as d),
      vv as (select ${local('"createdAt"')} as d, count(*)::int as views, count(distinct "userId")::int as readers from "AnalyticsEvent" where kind = 'view' and "createdAt" >= ${since} group by 1),
      sh as (select ${local('"createdAt"')} as d, count(*)::int as n from "AnalyticsEvent" where kind = 'share' and "createdAt" >= ${since} group by 1),
      li as (select ${local('"createdAt"')} as d, count(*)::int as n from "Like" where "createdAt" >= ${since} group by 1),
      co as (select ${local('"createdAt"')} as d, count(*)::int as n from "Comment" where "createdAt" >= ${since} group by 1),
      bo as (select ${local('"createdAt"')} as d, count(*)::int as n from "Bookmark" where "createdAt" >= ${since} group by 1),
      fo as (select ${local('"createdAt"')} as d, count(*)::int as n from "Follow" where "createdAt" >= ${since} group by 1),
      su as (select ${local('"createdAt"')} as d, count(*)::int as n from "User" where "createdAt" >= ${since} group by 1),
      pu as (select ${local('"publishedAt"')} as d, count(*)::int as n from "Article" where status = 'published' and "publishedAt" >= ${since} group by 1),
      le as (select ${local('"createdAt"')} as d, sum("feeApplied")::float8 as fees, sum(net)::float8 as net from "RevenueLedger"
             where type not in ('payout', 'fee', 'boost', 'refund') and "createdAt" >= ${since} group by 1)
      select to_char(days.d, 'YYYY-MM-DD') as day, coalesce(vv.views, 0) as views, coalesce(vv.readers, 0) as readers, coalesce(li.n, 0) as likes,
             coalesce(co.n, 0) as comments, coalesce(bo.n, 0) as bookmarks, coalesce(sh.n, 0) as shares, coalesce(fo.n, 0) as follows,
             coalesce(su.n, 0) as signups, coalesce(pu.n, 0) as published, coalesce(le.fees, 0) as fees, coalesce(le.net, 0) as "authorEarnings"
      from days left join vv using (d) left join sh using (d) left join li using (d) left join co using (d) left join bo using (d)
                left join fo using (d) left join su using (d) left join pu using (d) left join le using (d)
      order by days.d`),
    run(Prisma.sql`
      with v as (select "userId" as u, ${local('"createdAt"')} as d from "AnalyticsEvent" where kind = 'view' and "userId" is not null and "createdAt" >= ${since})
      select (count(distinct u) filter (where ${cur}))::int as cur, (count(distinct u) filter (where ${prev}))::int as prev
      from v`),
    run(Prisma.sql`
      select u.id, u."displayName" as name, p.country, coalesce(r.tier::text, 'bronze') as tier, u."isVerified" as verified, u."createdAt" as joined
      from "User" u left join "Profile" p on p."userId" = u.id left join "ContributorRank" r on r."userId" = u.id
      where exists (select 1 from "Article" a where a."authorId" = u.id)`),
    run(Prisma.sql`select plan::text as plan, interval::text as interval, status::text as status, "cancelAtPeriodEnd" as cancelling, "extraSeats"::int as "extraSeats"
      from "Subscription" where plan <> 'free' and interval is not null`),
    run(Prisma.sql`select distinct on ("articleId") "articleId", state::text as state, passed, "plagiarismPassed", "aiPassed", "createdAt"
      from "ArticleReview" order by "articleId", "createdAt" desc`),
    run(Prisma.sql`select id, "articleId", type::text as type, status::text as status, "expectedValue"::float8 as expected, "agreedValue"::float8 as agreed,
             "agreedBrandName" as brand, "createdAt" from "ExchangeOpportunity"`),
    run(Prisma.sql`select (select count(*) from "User")::int as total, (select count(*) from "User" where role = 'reader')::int as readers,
             (select count(distinct "authorId") from "Article")::int as authors, (select count(*) from "Organization")::int as companies`),
    run(Prisma.sql`select (select count(*) from "DisputeTicket" where status in ('open', 'under_review') or "appealStatus" = 'pending')::int as "openAppeals",
             (select count(*) from "ModerationFlag" where not resolved)::int as "openFlags",
             (select count(*) from "User" where suspended)::int as suspended`),
    run(Prisma.sql`select name from "Category" order by name`),
  ]);

  const r = readers[0];
  const p = people[0];
  const at = attention[0];
  return {
    days: daily.map((d) => ({
      day: d.day as string, views: num(d.views), readers: num(d.readers), likes: num(d.likes), comments: num(d.comments), bookmarks: num(d.bookmarks),
      shares: num(d.shares), follows: num(d.follows), signups: num(d.signups), published: num(d.published), fees: num(d.fees), authorEarnings: num(d.authorEarnings),
    })),
    readers: { cur: num(r.cur), prev: num(r.prev) },
    articles: articles.map((a) => ({
      id: a.id as string, slug: a.slug as string, title: a.title as string, category: a.category as string, contentType: a.contentType as string,
      status: a.status as string, premium: a.premium as boolean, featured: a.featured as boolean, authorId: a.authorId as string,
      views: num(a.views), likes: num(a.likes), shares: num(a.shares),
      createdAt: iso(a.createdAt)!, submittedAt: iso(a.submittedAt), publishedAt: iso(a.publishedAt),
      win: { cur: num(a.cur), prev: num(a.prev) },
    })),
    writers: writers.map((w) => ({ id: w.id as string, name: w.name as string, country: (w.country ?? null) as string | null, tier: w.tier as string, verified: w.verified as boolean, joined: iso(w.joined)! })),
    subscriptions: subs.map((s) => ({ plan: s.plan as string, interval: s.interval as string, status: s.status as string, cancelling: s.cancelling as boolean, extraSeats: num(s.extraSeats) })),
    reviews: reviews.map((v) => ({ articleId: v.articleId as string, state: v.state as string, passed: v.passed as boolean | null, plagiarismPassed: v.plagiarismPassed as boolean | null, aiPassed: v.aiPassed as boolean | null, createdAt: iso(v.createdAt)! })),
    deals: deals.map((x) => ({ id: x.id as string, articleId: x.articleId as string, type: x.type as string, status: x.status as string, expected: numOrNull(x.expected), agreed: numOrNull(x.agreed), brand: (x.brand ?? null) as string | null, createdAt: iso(x.createdAt)! })),
    people: { total: num(p.total), readers: num(p.readers), authors: num(p.authors), companies: num(p.companies) },
    attention: { openAppeals: num(at.openAppeals), openFlags: num(at.openFlags), suspended: num(at.suspended) },
    categories: cats.map((c) => c.name as string),
  };
}

/** Most rows magazine/articles returns. */
export const MAGAZINE_CAP = 500;

// The articles a magazine issue can hold: published in the window (dates inclusive, UTC days as Lens counts its months), plus any `also`
const magazineSelect = Prisma.sql`
  select a.id, a.slug, a.title, a.summary, a.content, c.name as category, u."displayName" as author,
         (select s.plan::text from "Subscription" s where s."userId" = a."authorId" and s.status::text in ('active', 'trialing') limit 1) as plan,
         a.status::text as status, a.lane::text as lane, a."publishedAt" as "publishedAt",
         case when a."magazineFeatured" then a."magazineFeatureOrder" end as featured,
         ex."agreedBrandName" as "exBrand", ex."agreedValue" as "exValue", ex."resolvedAt" as "exAt",
         bp."creativeAsset" as "bpCreative", bp."liveFrom" as "bpAt"
  from "Article" a
  join "Category" c on c.id = a."categoryId"
  join "User" u on u.id = a."authorId"
  left join lateral (
    select e."agreedBrandName", e."agreedValue", e."resolvedAt" from "ExchangeOpportunity" e
    where e."articleId" = a.id and e.status::text = 'published' and e."agreedBrandName" is not null
    order by e."agreedValue" desc nulls last limit 1
  ) ex on true
  left join lateral (
    select b."creativeAsset", b."liveFrom" from "BrandingPlacement" b
    where b."articleId" = a.id and b.status::text = 'live' and (b."liveUntil" is null or b."liveUntil" > now())
    order by b."liveFrom" desc nulls last limit 1
  ) bp on true`;

export async function magazineArticles(q: Db, from: string, to: string, also: string[]) {
  // no `also` ids: leave the clause out rather than send Prisma an empty array
  const where = Prisma.sql`where (a.status::text = 'published' and a."publishedAt" >= ${from}::date and a."publishedAt" < (${to}::date + 1)) ${also.length ? Prisma.sql`or a.id = any(${also}::text[])` : Prisma.empty}`;
  const [rows, count] = await Promise.all([
    q.$queryRaw<Raw[]>(Prisma.sql`${magazineSelect} ${where} order by a."publishedAt" asc, a.id limit ${MAGAZINE_CAP}`),
    q.$queryRaw<Raw[]>(Prisma.sql`select count(*) as n from "Article" a ${where}`),
  ]);
  const total = num(count[0].n);
  return {
    data: rows.map((r) => ({
      id: r.id as string, slug: r.slug as string, title: r.title as string, summary: (r.summary ?? null) as string | null, content: (r.content ?? null) as string | null,
      category: r.category as string, author: r.author as string, plan: (r.plan ?? null) as string | null, status: r.status as string, lane: r.lane as string,
      publishedAt: iso(r.publishedAt), featured: numOrNull(r.featured), exBrand: (r.exBrand ?? null) as string | null, exValue: numOrNull(r.exValue), exAt: iso(r.exAt),
      bpCreative: (r.bpCreative ?? null) as { brandName?: string; amount?: number } | null, bpAt: iso(r.bpAt),
    })),
    meta: { total, capped: total > MAGAZINE_CAP },
  };
}

export async function magazineBodies(q: Db, ids: string[]) {
  const rows = await q.$queryRaw<Raw[]>(Prisma.sql`select id, content from "Article" where id = any(${ids}::text[]) order by id`);
  return rows.map((r) => ({ id: r.id as string, content: (r.content ?? null) as string | null }));
}
