# Deployment — Railway (app) + Supabase (database)

The app is a standard Next.js server; the database is standard Postgres. Railway
hosts the app; Supabase hosts the database. They connect via one env variable.

---

## Part A — Move the database to Supabase

1. **Create the project** in the company's Supabase org (or a new project): supabase.com → New project. Pick the **Sydney (ap-southeast-2)** region (closest to us). Save the database password.
2. **Get the two connection strings** — Project Settings → Database → *Connection string*:
   - **Pooled** (Transaction, port `6543`) → used by the running app. Append `?pgbouncer=true`.
   - **Direct** (port `5432`) → used only for migrations.
3. **Enable the direct URL for migrations** — in `prisma/schema.prisma`, the datasource must be:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")   // pooled, ?pgbouncer=true
     directUrl = env("DIRECT_URL")     // direct, port 5432
   }
   ```
   *(Add the `directUrl` line when switching to Supabase; Neon didn't need it.)*
4. **Set env vars locally** in `.env` (`DATABASE_URL` = pooled, `DIRECT_URL` = direct).
5. **Create the schema + seed** against Supabase:
   ```bash
   npm run db:deploy   # prisma migrate deploy — creates all tables
   npm run db:seed     # loads categories, demo users, demo articles
   ```
6. **Verify** with `npm run db:studio` or by running the app locally pointed at Supabase.

> Migrating existing Neon data is optional — for now the seed recreates the demo
> content. If real user data needs to move later, use `pg_dump` (Neon) → `pg_restore` (Supabase).

---

## Part B — Deploy the app to Railway

1. **Get access** to the company Railway account/team (ask the boss to invite you), then create a **New Project → Deploy from GitHub repo** → select `Harsh-Kesh/myhitch-lens`, branch `main`.
2. Railway auto-detects Next.js. Confirm:
   - **Build:** `npm run build` (runs `prisma generate` via `postinstall`)
   - **Start:** `npm run start` (Next.js binds to Railway's `PORT` automatically)
3. **Set the environment variables** in Railway → service → Variables:
   - `DATABASE_URL` (Supabase pooled, `?pgbouncer=true`)
   - `DIRECT_URL` (Supabase direct)
   - `AUTH_SECRET` (generate a fresh one: `npx auth secret`)
   - `AUTH_URL` = the Railway public URL (e.g. `https://myhitch-lens-production.up.railway.app`)
   - (later) Stripe / AI keys as those phases land
4. **Run migrations against Supabase once** — either locally (`npm run db:deploy` with prod env) or add a Railway *deploy/release command*: `npm run db:deploy`.
5. **Deploy.** Railway builds and starts the service; open the generated URL.
6. **Custom domain** (optional) — add it in Railway → Settings → Domains, then update `AUTH_URL` to match.

---

## Env var checklist (production)

| Variable | Source |
|---|---|
| `DATABASE_URL` | Supabase pooled connection + `?pgbouncer=true` |
| `DIRECT_URL` | Supabase direct connection (port 5432) |
| `AUTH_SECRET` | `npx auth secret` (unique per environment) |
| `AUTH_URL` | Railway public URL |

## Gotchas
- **Pooler + Prisma:** the pooled URL **must** include `?pgbouncer=true`, or you'll hit prepared-statement errors.
- **`AUTH_URL`:** must be the real deployed URL or login callbacks break. `trustHost: true` is already set in `auth.ts`.
- **Secrets:** never commit `.env`; set everything in Railway's Variables UI.
- **Never** expose the Supabase *service_role* key here — we only use the Postgres connection string, not Supabase's API keys.
