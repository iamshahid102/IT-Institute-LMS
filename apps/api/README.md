# @lms/api — Express REST API

Express 5 + TypeScript (strict) + Prisma + PostgreSQL. All endpoints live under `/api/v1`; the OpenAPI document is
served at `/api/v1/openapi.json`. The browser never connects to PostgreSQL directly.

## Setup

```bash
cp .env.example .env          # development values, placeholders only
cp .env.example .env.test     # point DATABASE_URL at a *_test database
npm install                   # from the repository root (npm workspaces)

npm run db:start              # from the repository root: bundled local PostgreSQL
npm run db:migrate
npm run db:seed
npm run dev
```

Environment variables are validated at boot (`src/config/env.ts`); the process refuses to start with an invalid
configuration. Production also requires `COOKIE_SECURE=true` and an HTTPS `WEB_ORIGIN`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Watch-mode server on `PORT` (default 4000) |
| `npm run build` | `prisma generate` + `tsc` into `dist/` |
| `npm start` | Run the built server (`dist/server.js`) |
| `npm run typecheck` | Typecheck application sources |
| `tsc -p tsconfig.test.json` | Typecheck sources and the test suite |
| `npm run lint` | ESLint (no `any`, no unused vars, consistent type imports) |
| `npm test` | Vitest unit + Supertest integration tests |
| `npm run seed:admin` | Create the first Super Admin from `SEED_ADMIN_*` |

## Tests

- `tests/unit` — money helpers and attendance policy maths (pure functions).
- `tests/integration` — authentication/session behaviour, CSRF, RBAC, student record ownership (IDOR),
  attendance (sessions, manual marking, QR flow, duplicates, corrections, reporting), fees (invoice maths,
  partial payments, idempotency, reversals, receipts) and certificates (eligibility, issuance, public
  verification, revocation, downloads).
- `tests/global-setup.ts` applies `prisma migrate deploy` to the configured test database and refuses any
  database name that does not end in `_test`. `tests/helpers/db.ts` truncates tables between tests.
- Rate limits are disabled while `NODE_ENV=test` so the suite can exercise login repeatedly.

```bash
npm test                       # 68 tests, 8 files
npm test -- tests/unit         # unit tests only
```

The test database must exist (the bundled launcher creates `lms_test` alongside `lms_dev`).

## Structure

```text
src/
  config/       validated environment
  lib/          prisma client, logger
  middleware/   auth + RBAC, CSRF, rate limits, request ids, error handling
  modules/      auth, users, students, courses, instructors, batches, enrollments,
                attendance, fees, assessments, certificates, announcements, portal,
                reports, settings, audit
  services/     mailer, private storage adapter
  utils/        audit, cookies, crypto, csv, dates, numbers, validation, errors
  routes/       API router + OpenAPI document
prisma/         schema, migrations, deterministic seed
scripts/        dev database launcher, admin bootstrap, live flow/certificate checks
tests/          unit + integration suites and helpers
```

## Operational notes

- Health: `GET /health` (liveness) and `GET /health/ready` (database readiness).
- Money is always integer minor units (paisa); no floating point is used.
- Payments require an `Idempotency-Key` header; replays return the original payment with
  `Idempotent-Replayed: true`, while a reused key with a different payload is rejected.
- Posted payments are never deleted: reversals create auditable rows and recompute the invoice status inside the
  same transaction.
- Certificate and receipt PDFs are written to private storage and streamed only through authorised endpoints.
- Audit logs record logins, password changes, attendance corrections, invoice/payment/reversal events and
  certificate issuance/revocation, with request ids and hashed client IPs. Secrets, cookies and raw tokens are
  never logged.
- When SMTP is not configured, password recovery uses the audited Super-Admin "issue reset link" action; the
  public forgot-password endpoint still answers generically.

## Production checklist

1. `npx prisma migrate deploy` (never `migrate dev`).
2. `npm run seed:admin` with a unique password, then remove `SEED_ADMIN_*` from the environment.
3. Set `COOKIE_SECURE=true`, HTTPS `WEB_ORIGIN`, `TRUST_PROXY=true` behind a TLS terminator.
4. Mount persistent private storage for `STORAGE_LOCAL_DIR` (or implement and select an S3-compatible adapter).
5. Back up the database and the storage directory on the same schedule, and rehearse a restore.
