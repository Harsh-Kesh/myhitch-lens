import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { MAGAZINE_CAP, lensDashboard, magazineArticles, magazineBodies, type Db } from "./nexboardLens";

/** A stand-in client: answers each query by a word in its text, and records the queries. */
function fake(answers: Record<string, unknown[]>) {
  const seen: Prisma.Sql[] = [];
  const db: Db = {
    async $queryRaw<T>(s: Prisma.Sql) {
      seen.push(s);
      const hit = Object.entries(answers).find(([k]) => s.text.includes(k));
      return (hit ? hit[1] : []) as T;
    },
  };
  return { db, seen };
}

const period = { from: "2026-11-01", to: "2026-11-30", prevFrom: "2026-10-02", prevTo: "2026-10-31" };
const at = new Date("2026-11-05T01:02:03.000Z");

describe("lensDashboard", () => {
  const answers = {
    "c.name as category": [{ id: "a1", slug: "s", title: "T", category: "News", contentType: "Blog", status: "published", premium: false, featured: true, authorId: "u1", views: BigInt(5), likes: 2, shares: 1, createdAt: at, submittedAt: null, publishedAt: at, cur: BigInt(3), prev: 1 }],
    generate_series: [{ day: "2026-11-01", views: BigInt(1), readers: 1, likes: 0, comments: 0, bookmarks: 0, shares: 0, follows: 0, signups: 0, published: 0, fees: 0.5, authorEarnings: 2 }],
    "count(distinct u)": [{ cur: BigInt(4), prev: 2 }],
    "p.country": [{ id: "u1", name: "Ann", country: null, tier: "gold", verified: true, joined: at }],
    '"cancelAtPeriodEnd"': [{ plan: "creator", interval: "month", status: "active", cancelling: false, extraSeats: 0 }],
    '"plagiarismPassed"': [{ articleId: "a1", state: "completed", passed: true, plagiarismPassed: null, aiPassed: false, createdAt: at }],
    '"agreedBrandName" as brand': [{ id: "d1", articleId: "a1", type: "sponsorship", status: "published", expected: null, agreed: new Prisma.Decimal("12.5"), brand: "Acme", createdAt: at }],
    "as total": [{ total: BigInt(9), readers: 5, authors: 2, companies: 1 }],
    openAppeals: [{ openAppeals: 1, openFlags: BigInt(2), suspended: 0 }],
    'select name from "Category"': [{ name: "News" }, { name: "Tech" }],
  };

  it("returns exactly the ten documented keys, as plain JSON (no BigInt, Decimal or Date left)", async () => {
    const out = await lensDashboard(fake(answers).db, period);
    assert.deepEqual(Object.keys(out), ["days", "readers", "articles", "writers", "subscriptions", "reviews", "deals", "people", "attention", "categories"]);
    assert.deepEqual(JSON.parse(JSON.stringify(out)), out); // JSON.stringify throws on BigInt
    assert.deepEqual(out.readers, { cur: 4, prev: 2 });
    assert.equal(out.articles[0].createdAt, "2026-11-05T01:02:03.000Z");
    assert.equal(out.articles[0].submittedAt, null);
    assert.deepEqual(out.articles[0].win, { cur: 3, prev: 1 });
    assert.equal(out.deals[0].agreed, 12.5);
    assert.equal(out.deals[0].expected, null);
    assert.deepEqual(out.people, { total: 9, readers: 5, authors: 2, companies: 1 });
    assert.equal(out.attention.openFlags, 2);
    assert.deepEqual(out.categories, ["News", "Tech"]);
  });

  it("writers carry no email or other personal field", async () => {
    const out = await lensDashboard(fake(answers).db, period);
    assert.deepEqual(Object.keys(out.writers[0]), ["id", "name", "country", "tier", "verified", "joined"]);
  });

  it("passes the dates to every query as values, never in the SQL text", async () => {
    const { db, seen } = fake(answers);
    await lensDashboard(db, period);
    assert.equal(seen.length, 10);
    for (const s of seen) assert.ok(!s.text.includes("2026-"));
    assert.ok(seen.some((s) => s.values.includes("2026-10-02")));
  });
});

describe("magazine", () => {
  const row = { id: "a1", slug: "s", title: "T", summary: "S", content: "C", category: "News", author: "Ann", plan: null, status: "published", lane: "public", publishedAt: at, featured: 2, exBrand: "Acme", exValue: new Prisma.Decimal("100.00"), exAt: at, bpCreative: { brandName: "B", amount: 5 }, bpAt: null };

  it("rows have exactly the documented fields; dates ISO, exValue a number", async () => {
    const { db } = fake({ "select a.id": [row], "count(*) as n": [{ n: BigInt(1) }] });
    const { data, meta } = await magazineArticles(db, "2026-11-01", "2026-11-30", []);
    assert.deepEqual(Object.keys(data[0]), ["id", "slug", "title", "summary", "content", "category", "author", "plan", "status", "lane", "publishedAt", "featured", "exBrand", "exValue", "exAt", "bpCreative", "bpAt"]);
    assert.equal(data[0].exValue, 100);
    assert.equal(data[0].publishedAt, "2026-11-05T01:02:03.000Z");
    assert.equal(data[0].bpAt, null);
    assert.deepEqual(data[0].bpCreative, { brandName: "B", amount: 5 });
    assert.deepEqual(meta, { total: 1, capped: false });
    JSON.stringify(data);
  });

  it("capped is true only above the cap, and the query is limited", async () => {
    const atCap = fake({ "select a.id": [row], "count(*) as n": [{ n: BigInt(MAGAZINE_CAP) }] });
    assert.equal((await magazineArticles(atCap.db, "2026-11-01", "2026-11-30", [])).meta.capped, false);
    assert.ok(atCap.seen[0].values.includes(MAGAZINE_CAP));
    const over = fake({ "select a.id": [row], "count(*) as n": [{ n: BigInt(MAGAZINE_CAP + 1) }] });
    assert.deepEqual((await magazineArticles(over.db, "2026-11-01", "2026-11-30", [])).meta, { total: MAGAZINE_CAP + 1, capped: true });
  });

  it("`also` adds an id clause only when ids are given", async () => {
    const none = fake({ "count(*) as n": [{ n: 0 }] });
    await magazineArticles(none.db, "2026-11-01", "2026-11-30", []);
    assert.ok(!none.seen[0].text.includes("any("));
    const some = fake({ "count(*) as n": [{ n: 0 }] });
    await magazineArticles(some.db, "2026-11-01", "2026-11-30", ["x", "y"]);
    assert.ok(some.seen[0].text.includes("any("));
    assert.ok(some.seen[0].values.some((v) => Array.isArray(v) && v.join() === "x,y"));
  });

  it("bodies are {id, content}", async () => {
    const { db } = fake({ "select id, content": [{ id: "a1", content: "<p>x</p>", extra: "no" }] });
    assert.deepEqual(await magazineBodies(db, ["a1"]), [{ id: "a1", content: "<p>x</p>" }]);
  });
});
