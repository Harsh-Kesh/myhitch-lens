/**
 * Create (or find) the Stripe products and prices for the Lens plans. Safe to run
 * any number of times: each price is identified by a lookup key, and an existing
 * one is left untouched, so re-running never creates duplicates.
 *
 *   npx tsx scripts/setupStripePlans.ts            # create what is missing
 *   npx tsx scripts/setupStripePlans.ts --dry-run  # only report
 *
 * Uses STRIPE_SECRET_KEY, Lens's OWN Stripe account (test or live, whichever the
 * key is for). It prints which mode it is talking to. The prices come from
 * src/lib/plans.ts, so the catalogue and Stripe cannot drift apart silently: if a
 * price in the catalogue changes, this script reports the mismatch instead of
 * editing a live price (Stripe prices are immutable; make a new one deliberately).
 */
import Stripe from "stripe";

import { PLANS, EXTRA_SEAT_MONTHLY_CENTS } from "../src/lib/plans";

const dryRun = process.argv.includes("--dry-run");
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}
const stripe = new Stripe(key);

type Row = { lookupKey: string; productName: string; cents: number; interval: "month" | "year" };

const rows: Row[] = [];
for (const plan of [PLANS.creator, PLANS.professional, PLANS.business]) {
  rows.push({ lookupKey: `lens_${plan.code}_month`, productName: plan.name, cents: plan.monthlyCents!, interval: "month" });
  rows.push({ lookupKey: `lens_${plan.code}_year`, productName: plan.name, cents: plan.yearlyCents!, interval: "year" });
}
rows.push({ lookupKey: "lens_business_extra_seat_month", productName: "Lens Business extra user", cents: EXTRA_SEAT_MONTHLY_CENTS, interval: "month" });

async function productFor(name: string): Promise<string> {
  const found = await stripe.products.search({ query: `name:'${name}' AND active:'true' AND metadata['app']:'lens'` });
  if (found.data[0]) return found.data[0].id;
  if (dryRun) return "(would create)";
  const created = await stripe.products.create({ name, metadata: { app: "lens" } });
  return created.id;
}

async function main() {
  const balance = await stripe.balance.retrieve(); // cheap call that proves the key works and tells us the mode
  console.log(`Stripe ${balance.livemode ? "LIVE" : "test"} mode${dryRun ? " [dry run]" : ""}`);

  const productIds = new Map<string, string>();
  for (const row of rows) {
    if (!productIds.has(row.productName)) productIds.set(row.productName, await productFor(row.productName));

    const existing = (await stripe.prices.list({ lookup_keys: [row.lookupKey], active: true, limit: 1 })).data[0];
    if (existing) {
      const ok = existing.unit_amount === row.cents && existing.currency === "aud" && existing.recurring?.interval === row.interval;
      console.log(`${ok ? "ok      " : "MISMATCH"} ${row.lookupKey} ${existing.id} (${existing.unit_amount} cents)${ok ? "" : ` catalogue says ${row.cents}`}`);
      continue;
    }
    if (dryRun) {
      console.log(`would create ${row.lookupKey} = ${row.cents} cents / ${row.interval}`);
      continue;
    }
    const price = await stripe.prices.create({
      product: productIds.get(row.productName)!,
      currency: "aud",
      unit_amount: row.cents,
      recurring: { interval: row.interval },
      lookup_key: row.lookupKey,
      metadata: { app: "lens" },
    });
    console.log(`created  ${row.lookupKey} ${price.id}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
