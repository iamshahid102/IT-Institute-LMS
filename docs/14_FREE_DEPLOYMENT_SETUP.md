# Free-Tier Deployment Setup — Two Vercel Projects + Neon PostgreSQL

**Status:** Phase 1 (audit) complete. Configuration files for Phases 2–3 are deliberately **not written yet**;
they are added after the interactive setup steps confirm the architecture.
**Audited:** 23 October 2026, working copy at commit `7a5d287` on `main`.

## 1. Selected deployment architecture

```text
Browser ──(1)──> Frontend Vercel project (apps/web, Next.js)
                    │  same-origin fetch: /api/v1/*
                    ▼
                 Vercel rewrite (server-side, origin: API_ORIGIN)
                    │
                    ▼
                 Backend Vercel project (apps/api, Express app exported
                 as a serverless function — NOT app.listen)
                    │  Prisma (pooled Neon connection)
                    ▼
                 Neon PostgreSQL (free tier, new live-testing database)
```

Why this shape (and not two cross-site domains calling each other directly):

- The application authenticates with an **opaque session cookie** set with `SameSite=Lax`
  (`apps/api/src/utils/cookies.ts`). If the browser called a *different* site for the API, the browser
  would not send that cookie on fetches at all → login would be impossible without changing the cookie
  to `SameSite=None` and weakening the CSRF model.
- The codebase already avoids this problem: `apps/web/next.config.ts` rewrites
  `/api/v1/:path*` → `${API_ORIGIN}/api/v1/:path*`, so the browser only ever talks to **one origin**.
  The same design is kept in production, which means **no cookie, CSRF or session code changes**.
- The rewritten request forwards the browser's `Origin: <frontend>` header, so the backend's existing
  exact-match CORS allowlist (`WEB_ORIGIN`, `apps/api/src/app.ts`) must contain the frontend URL —
  exactly as it contains `http://localhost:3000` today.

Deployment topology:

| Piece | Where | Project name (suggested) | Root Directory |
|---|---|---|---|
| Frontend | Vercel project #1 | `lms-frontend` | `apps/web` |
| Backend | Vercel project #2 | `lms-api` | `apps/api` |
| Database | Neon Free | one project, one database | — |
| Source | GitHub `iamshahid102/IT-Institute-LMS`, branch `main` | both projects import this repo | — |

Both Vercel projects import the **same repository**. They do **not** share environment variables or URLs;
each is configured independently.

### Backend function entry (planned, Phase 2)

- `apps/api/src/server.ts` calls `app.listen(...)` for local development — that is a long-running
  server and must not run on Vercel's function runtime.
- Plan: add `apps/api/api/index.ts` that exports the already-built Express app from
  `src/app.ts` (`createApp()`), plus a `vercel.json` in `apps/api` with a catch-all rewrite so
  every incoming path reaches Express, preserving `/api/v1/*` and the structured JSON 404 handler
  (`notFoundHandler` in `src/middleware/error-handler.ts`). Local dev, `npm test` and Playwright are
  untouched because they still use `server.ts`.

## 2. Environment-variable inventory (from source code, not assumed)

### 2.1 Backend project — `lms-api`

| Variable | Required? | Meaning / value | Defined in code | Where the value comes from | Secret? | Environment |
|---|---|---|---|---|---|---|
| `NODE_ENV` | **Required** | Must be `production` (any other value leaves `COOKIE_SECURE` unchecked) | `src/config/env.ts` | typed as `production` | No | Production + Preview |
| `DATABASE_URL` | **Required** | PostgreSQL connection string — **Neon pooled (pooler) URL** | `src/config/env.ts` (`url = env("DATABASE_URL")` in `prisma/schema.prisma`) | Neon dashboard | **Yes** | Production + Preview |
| `DIRECT_URL` | **Required after a small schema change** (see §5) | Neon direct connection URL, used only by `prisma migrate` | **not yet referenced** — schema has no `directUrl` today | Neon dashboard | **Yes** | Production + Preview |
| `WEB_ORIGIN` | **Required** | Exact frontend origin(s), comma separated: `https://<frontend>.vercel.app` — this is the CORS allowlist checked against every forwarded `Origin` | `src/config/env.ts` → `env.allowedOrigins` → `src/app.ts` CORS | Vercel (frontend project URL) | No | Production + Preview |
| `APP_PUBLIC_URL` | **Required** | Public frontend URL used to build certificate verification links (`${APP_PUBLIC_URL}/verify-certificate/...`) | `src/config/env.ts` → `certificates.service.ts` | Vercel (frontend project URL) | No | Production |
| `COOKIE_SECURE` | **Required** (must be `true`) | The app *refuses to start* in production without `true` | `src/config/env.ts` | typed as `true` | No | Production + Preview |
| `TRUST_PROXY` | **Required** (must be `true`) | Vercel is a reverse proxy; without this `req.ip` is the proxy IP and **the rate limiter would bucket every visitor together** | `src/config/env.ts` → `app.set('trust proxy', 1)` | typed as `true` | No | Production + Preview |
| `LOG_LEVEL` | Optional (default `info`) | pino log level | `src/config/env.ts` | choice; `info` is fine | No | both |
| `SESSION_COOKIE_NAME` | Optional (default `lms_session`) | session cookie name | `src/config/env.ts` | leave default | No | — |
| `CSRF_COOKIE_NAME` | Optional (default `lms_csrf`) | CSRF cookie name | `src/config/env.ts` | leave default | No | — |
| `SESSION_TTL_HOURS` | Optional (default `168`) | session lifetime hours | `src/config/env.ts` | leave default | No | — |
| `STORAGE_DRIVER` | Optional (only value supported: `local`) | private file storage adapter | `src/config/env.ts` → `src/services/storage.ts` | leave default | No | — |
| `STORAGE_LOCAL_DIR` | Optional (default `./var/storage`) | certificate/receipt PDF directory — **ephemeral on Vercel, see §6.1** | `src/config/env.ts` | leave default | No | — |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Optional | password-reset email; when absent the audited Super-Admin "issue reset link" flow is used instead | `src/config/env.ts` → `src/services/mailer.ts` | any SMTP provider | `SMTP_PASS` **is a secret** | Production only |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | Optional, **one-time only** | used only by `npm run seed:admin` (first Super Admin bootstrap) | `src/config/env.ts` + `scripts/create-admin.ts` | you generate them | `SEED_ADMIN_PASSWORD` **is a secret** | **Set nowhere on Vercel** — passed only in the local terminal command for the bootstrap run (Phase 9) |
| `PORT` | Not needed | local-dev listen port (serverless never listens) | `src/config/env.ts` | default `4000` | No | — |
| `LOCAL_DB_PORT` | Not needed in production | bundled dev-PostgreSQL launcher only | `scripts/dev-db.mjs` | — | No | — |

### 2.2 Frontend project — `lms-frontend`

| Variable | Required? | Meaning / value | Defined in code | Where the value comes from | Secret? | Environment |
|---|---|---|---|---|---|---|
| `API_ORIGIN` | **Required** (build-time, server-side) | Backend base URL, e.g. `https://lms-api-xxxx.vercel.app` — used by the `/api/v1/*` rewrite | `apps/web/next.config.ts` (`process.env.API_ORIGIN`) | Vercel (backend project URL) | **No** — and it is deliberately **not** `NEXT_PUBLIC_*`, so it never ships to the browser bundle | Production + Preview (a redeploy is needed after every change, because `next.config.ts` is evaluated at build time) |
| `NODE_ENV` | automatic | set by Vercel's Next.js runtime | — | Vercel | No | — |

There are **no** `NEXT_PUBLIC_*` variables anywhere in `apps/web` (verified by grep). Database URLs,
session secrets and SMTP credentials never reach the frontend bundle.

### 2.3 Explicitly *not* used by this codebase

No `SESSION_SECRET`, `JWT_SECRET`, `SIGNING_KEY` or similar exists — sessions are random opaque tokens
stored hashed in the database, so there is no signing secret to invent.

## 3. Accounts required

1. **GitHub** — already have it (`iamshahid102/IT-Institute-LMS`).
2. **Vercel (Hobby/free plan)** — hosts both projects.
3. **Neon (Free plan)** — PostgreSQL for live testing.

No other service is required. SMTP is optional and can wait.

## 4. Free-tier limitations (must be accepted or worked around)

1. **Certificate PDFs may not download reliably.** `STORAGE_DRIVER=local` writes files to a serverless
   filesystem (`/tmp`), which is **ephemeral**: a file written when a certificate is issued may be gone
   when a later download request lands on another instance. Receipts are safe (regenerated from the
   database on every request), but **stored certificate PDFs are not**. This is the one feature that
   cannot work reliably on the selected free tier without a genuinely free object store (e.g. an
   S3-compatible adapter pointed at Cloudflare R2's free tier). **Decision needed from you** — asked at
   the storage step; no paid service will be introduced without asking first.
2. **Neon Free:** ~0.5 GB storage, monthly compute-hour quota, and the compute **auto-suspends after
   inactivity** — the first request after idle takes a few extra seconds (cold start). Not suitable as
   a production database, fine for live testing.
3. **Vercel Hobby:** serverless function duration and bandwidth are limited and bursty on the free tier;
   no SLA, no autoscaling guarantees.
4. **Rate limiting is per-instance.** `express-rate-limit` keeps counters in process memory, so on
   serverless each warm instance has its own counter. Limits still exist but are weaker than on a
   single long-running server.
5. **No backups are claimed.** Neon Free has no backup guarantee we have verified; a manual
   `pg_dump` schedule is a separate task.
6. **Cross-domain cookie caveat.** The design keeps everything first-party via the frontend rewrite, so
   `SameSite=Lax` keeps working. If Phase 8 testing shows Vercel drops `Set-Cookie` on external
   rewrites (a known risk area), the fallback is to make the API a first-party path of the frontend or
   to allow cross-site cookies explicitly — **this would be discussed with you before any code change.**
7. **Never use the test database for live testing.** `lms_test` (used by the automated suite) stays
   separate; a brand-new Neon database is the live-testing target. `prisma migrate reset` will never be
   run against Neon.

## 5. Code/config changes required (small, reviewed before applying)

| Change | Why | Risk |
|---|---|---|
| `apps/api/api/index.ts` exporting the Express app + `apps/api/vercel.json` catch-all rewrite | serverless entry without `app.listen` | none for local dev/tests (they keep using `server.ts`) |
| `prisma/schema.prisma`: add `directUrl = env("DIRECT_URL")` to the datasource | Neon's pooled (pgbouncer) connection cannot run `prisma migrate deploy` transactions reliably; migrations must use the direct URL. `DATABASE_URL` stays the runtime URL. | additive only; no migration SQL, existing local setup keeps working once `DIRECT_URL` is set (locally it can point to the same dev URL) |
| Build commands that build `@lms/shared` first | both apps import `packages/shared` (`main: dist/index.js`); a per-app Vercel build does not build it today | none |
| (Pending Phase 8 result) S3-compatible storage adapter for certificates | only if you accept the free object store option | isolated behind `StorageAdapter` interface |

## 6. Manual steps in this plan

1. Push the 2 outstanding local commits to GitHub.
2. Create the Vercel account and import the repo twice (two projects).
3. Create the Neon account/database and copy both connection strings (entered only in Vercel).
4. Enter environment variables in each Vercel project's dashboard (never in chat).
5. Run `prisma migrate deploy` against Neon from your own terminal, with approval, no destructive commands.
6. Run the one-time Super Admin bootstrap with secrets passed via the local terminal only.
7. Phase 8 end-to-end verification on the real URLs.

## 7. Verification commands to run before/after deployment

```bash
npm run lint && npm run typecheck     # local
npm test                               # local, uses lms_test only
npm run build                          # shared + api + web
npx prisma migrate deploy              # against Neon, Phase 9, with approval
curl https://<backend>/api/v1/health    # {"status":"ok",...} — no secrets
curl https://<backend>/api/v1/nope      # structured JSON 404 with requestId
```
