import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { envelope, logCall, nexboardGet, okJson, parseIds, parsePeriod, parseRange } from "./nexboardApi";
import { nexboardDenied } from "./nexboardReview";

const q = (s: string) => new URLSearchParams(s);
const bad = (r: { ok: boolean }) => assert.equal(r.ok, false);

describe("parseRange", () => {
  it("accepts a real range and echoes it", () => {
    assert.deepEqual(parseRange(q("from=2026-11-01&to=2026-11-30")), { ok: true, value: { from: "2026-11-01", to: "2026-11-30" } });
    assert.equal(parseRange(q("from=2026-11-01&to=2026-11-01")).ok, true); // one day
  });
  it("rejects missing, malformed and impossible dates", () => {
    for (const s of ["", "from=2026-11-01", "to=2026-11-01", "from=2026-11-1&to=2026-11-30", "from=2026-02-30&to=2026-03-05", "from=2026-13-01&to=2026-13-02", "from=x&to=y", "from=2026-11-01T00:00:00Z&to=2026-11-02"]) bad(parseRange(q(s)));
    assert.equal(parseRange(q("from=2028-02-29&to=2028-03-01")).ok, true); // leap day is real
    bad(parseRange(q("from=2027-02-29&to=2027-03-01")));
  });
  it("rejects to before from", () => bad(parseRange(q("from=2026-11-30&to=2026-11-29"))));
  it("allows 400 days and refuses 401", () => {
    assert.equal(parseRange(q("from=2026-01-01&to=2027-02-04")).ok, true); // 400 days counting both ends
    bad(parseRange(q("from=2026-01-01&to=2027-02-05")));
  });
});

describe("parsePeriod", () => {
  const ok = "from=2026-11-01&to=2026-11-30&prevFrom=2026-10-02&prevTo=2026-10-31";
  it("needs all four dates", () => {
    assert.deepEqual(parsePeriod(q(ok)), { ok: true, value: { from: "2026-11-01", to: "2026-11-30", prevFrom: "2026-10-02", prevTo: "2026-10-31" } });
    for (const drop of ["from", "to", "prevFrom", "prevTo"]) bad(parsePeriod(q(ok.split("&").filter((p) => !p.startsWith(drop + "=")).join("&"))));
  });
  it("checks each range on its own", () => {
    bad(parsePeriod(q("from=2026-11-30&to=2026-11-01&prevFrom=2026-10-02&prevTo=2026-10-31")));
    bad(parsePeriod(q("from=2026-11-01&to=2026-11-30&prevFrom=2026-10-31&prevTo=2026-10-02")));
    bad(parsePeriod(q("from=2026-11-01&to=2026-11-30&prevFrom=2025-01-01&prevTo=2026-10-31")));
    bad(parsePeriod(q("from=2026-11-01&to=2026-11-30&prevFrom=2026-10-02&prevTo=2026-02-31")));
  });
});

describe("parseIds", () => {
  it("splits, trims, drops blanks and repeats", () => {
    assert.deepEqual(parseIds(" a, b ,,a,c", "ids", 1), { ok: true, value: ["a", "b", "c"] });
  });
  it("empty is fine for `also` (min 0) and an error for `ids` (min 1)", () => {
    assert.deepEqual(parseIds(null, "also", 0), { ok: true, value: [] });
    assert.deepEqual(parseIds("", "also", 0), { ok: true, value: [] });
    bad(parseIds(null, "ids", 1));
    bad(parseIds(" , ", "ids", 1));
  });
  it("caps at 100 distinct ids", () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => `id${i}`).join(",");
    assert.equal(parseIds(n(100), "ids", 1).ok, true);
    bad(parseIds(n(101), "ids", 1));
    assert.equal(parseIds(n(100) + ",id0,id1", "ids", 1).ok, true); // repeats do not count
  });
  it("refuses an over-long id", () => bad(parseIds("x".repeat(101), "ids", 1)));
});

describe("envelope", () => {
  it("has contract, asOf, data; meta, range and platform only when given", () => {
    const e = envelope("x_v1", [1]) as Record<string, unknown>;
    assert.deepEqual(Object.keys(e), ["contract", "asOf", "data"]);
    assert.equal(e.contract, "x_v1");
    assert.equal(new Date(e.asOf as string).toISOString(), e.asOf);
    const f = envelope("x_v1", {}, { meta: { total: 1 }, range: { from: "a" }, platform: "lens" });
    assert.deepEqual(Object.keys(f).sort(), ["asOf", "contract", "data", "meta", "platform", "range"]);
  });
  it("okJson sends no-store", async () => {
    const res = okJson("ping_v1", { ok: true }, { platform: "lens" });
    assert.equal(res.headers.get("cache-control"), "no-store");
    const body = await res.json();
    assert.equal(body.platform, "lens");
    assert.deepEqual(body.data, { ok: true });
  });
});

describe("nexboardGet: key check, logging, errors", () => {
  const saved = process.env.NEXBOARD_API_KEY;
  const lines: unknown[][] = [];
  const realInfo = console.info;
  const realError = console.error;
  beforeEach(() => {
    lines.length = 0;
    console.info = (...a: unknown[]) => void lines.push(a);
    console.error = () => {};
  });
  afterEach(() => {
    console.info = realInfo;
    console.error = realError;
    if (saved === undefined) delete process.env.NEXBOARD_API_KEY;
    else process.env.NEXBOARD_API_KEY = saved;
  });
  const req = (key?: string, ip = "203.0.113.9, 10.0.0.1") => new Request("http://lens.test/api/nexboard/ping?x=1", { headers: { ...(key ? { "x-api-key": key } : {}), "x-forwarded-for": ip } });
  const handler = async () => okJson("ping_v1", { ok: true });
  const logged = () => JSON.parse(lines[0][0] as string);

  it("501 when no key is set on Lens, and the handler never runs", async () => {
    delete process.env.NEXBOARD_API_KEY;
    let ran = false;
    const res = await nexboardGet(req("anything"), "ping", async () => ((ran = true), okJson("x", 1)));
    assert.equal(res.status, 501);
    assert.equal(ran, false);
    assert.ok(typeof (await res.json()).error === "string");
    assert.equal(logged().outcome, "refused");
  });
  it("401 for a missing or wrong key", async () => {
    process.env.NEXBOARD_API_KEY = "s3cret";
    for (const r of [req(), req("wrong")]) {
      const res = await nexboardGet(r, "ping", handler);
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { error: "Unauthorized" });
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
    assert.equal(lines.length, 2);
  });
  it("200 with the right key; one log line with endpoint, outcome, status, ms, first forwarded address and no key", async () => {
    process.env.NEXBOARD_API_KEY = "s3cret";
    const res = await nexboardGet(req("s3cret"), "ping", handler);
    assert.equal(res.status, 200);
    assert.equal(lines.length, 1);
    const l = logged();
    assert.deepEqual([l.nexboard_call, l.endpoint, l.outcome, l.status, l.ip], ["lens", "ping", "ok", 200, "203.0.113.9"]);
    assert.equal(typeof l.ms, "number");
    assert.ok(!JSON.stringify(l).includes("s3cret"));
  });
  it("a handler 400 is logged as an error outcome", async () => {
    process.env.NEXBOARD_API_KEY = "s3cret";
    const res = await nexboardGet(req("s3cret"), "dashboard", async () => Response.json({ error: "bad" }, { status: 400 }) as never);
    assert.equal(res.status, 400);
    assert.deepEqual([logged().outcome, logged().status], ["error", 400]);
  });
  it("a thrown error gives a generic 500 that leaks nothing", async () => {
    process.env.NEXBOARD_API_KEY = "s3cret";
    const res = await nexboardGet(req("s3cret"), "dashboard", async () => {
      throw new Error("password=hunter2 connection refused");
    });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.ok(!body.error.includes("hunter2"));
    assert.equal(logged().outcome, "error");
  });
  it("a failing log never fails the call", async () => {
    process.env.NEXBOARD_API_KEY = "s3cret";
    console.info = () => {
      throw new Error("log down");
    };
    const res = await nexboardGet(req("s3cret"), "ping", handler);
    assert.equal(res.status, 200);
    assert.doesNotThrow(() => logCall("ping", 200, Date.now(), req()));
  });
  it("uses the shared Lens key check (nexboardDenied)", () => {
    process.env.NEXBOARD_API_KEY = "s3cret";
    assert.equal(nexboardDenied(req("s3cret")), null);
    assert.equal(nexboardDenied(req("nope"))?.status, 401);
    delete process.env.NEXBOARD_API_KEY;
    assert.equal(nexboardDenied(req("s3cret"))?.status, 501);
  });
});
