# IT Institute LMS — Institute Operations & Student Portal

A production-oriented management system for an IT training institute: admissions, courses and batches,
attendance (QR + manual), fee invoicing and receipts, digital certificates with public verification, reports,
an auditable admin surface, and a secure student portal. The web app is an installable PWA.

**Stack:** Next.js 15 (App Router, React 19, TypeScript strict, Tailwind, shadcn-style UI, TanStack Query)
+ Express 5 (TypeScript strict, Zod, Prisma, PostgreSQL) + a shared non-secret domain package.

## Repository layout

```text
apps/
  api/      Express REST API under /api/v1, Prisma schema + migrations, tests
  web/      Next.js PWA (staff + student portal), Playwright journeys
packages/
  shared/   Roles, permission catalogue, attendance policy, money helpers, shared types
docs/       Approved requirements pack + implementation plan + verification report
```

The browser only talks to the Next.js origin; `/api/v1/*` is proxied to the Express API, so session cookies stay
first-party and CSRF protection is meaningful. Prisma is never imported by the frontend.

## Quick start

Requirements: Node.js ≥ 20 (verified on 24.21), npm ≥ 10, and PostgreSQL (the repository ships a
development-only launcher that uses bundled binaries, so no Docker or system PostgreSQL is required).

```bash
npm install

# 1. Configure the API (placeholders only — never commit real secrets)
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.example apps/api/.env.test   # then point DATABASE_URL at lms_test
cp apps/web/.env.example apps/web/.env

# 2. Start PostgreSQL (development convenience, listens on 127.0.0.1:55432)
npm run db:start

# 3. Create the schema and deterministic development data
npm run db:migrate
npm run db:seed

# 4. Run both applications
npm run dev          # API :4000, web :3000
```

Seeded development accounts (development only — never usable as production defaults):

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@institute.test` | `Admin#12345` |
| Front Desk Manager | `frontdesk@institute.test` | `Frontdesk#12345` |
| Student | `fatima.noor@student.test` | `Student#12345` |

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | API and web development servers |
| `npm run build` | Shared package, API and web production builds |
| `npm run lint` | ESLint for every workspace |
| `npm run typecheck` | `tsc --noEmit` for every workspace |
| `npm test` | API unit + integration suite (Vitest + Supertest, real PostgreSQL) |
| `npm run test:e2e` | Playwright journeys against the production builds |
| `npm run db:start` / `db:migrate` / `db:seed` / `db:reset` | Local database lifecycle |
| `npm run seed:admin` | One-time Super Admin bootstrap (refuses if one exists) |

## Verified status

Run on 23 October 2026 on the development machine described in `docs/11_VERIFICATION_REPORT.md`:

| Check | Result |
|---|---|
| API unit + integration tests | **77 passed** (9 files) |
| API test-suite typecheck (`tsconfig.test.json`) | clean |
| Playwright journeys (desktop Chrome, real API + web builds) | **19 passed** |
| `npm run lint` (web + api) | clean |
| `npm run typecheck` (web + api) | clean |
| `npm run build` (shared, api, web) | clean |
| `prisma migrate deploy` from an empty database | applied `20261023072413_init` |

The API tests run against a dedicated `*_test` database, which the global setup migrates automatically and the
suite truncates between tests. The browser suite runs against the seeded `lms_dev` database.

## Security posture

- Opaque server-side sessions; only the SHA-256 hash is stored. `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Double-submit CSRF token required on every unsafe request, including login.
- Argon2id password hashing; identical generic errors for unknown accounts and wrong passwords.
- Central permission catalogue enforced server-side per route; student endpoints resolve the student from the
  session and never from a client-supplied identifier.
- Rate limits on login, password reset, QR scans, public verification and the API as a whole.
- Narrow CORS allowlist, Helmet headers, Zod validation on every request body/query/parameter.
- Private certificate PDFs and receipt PDFs are only served by authorised API endpoints.
- Certificate verification publishes only the approved fields (number, status, course, dates, approved name).

## Deployment outline

1. Provision managed PostgreSQL and a private object-storage volume/bucket.
2. Set the API environment from `apps/api/.env.example`: `NODE_ENV=production`, `DATABASE_URL`, `WEB_ORIGIN`
   (HTTPS), `APP_PUBLIC_URL`, `COOKIE_SECURE=true`, `SESSION_TTL_HOURS`, `LOG_LEVEL`, `STORAGE_*`.
3. Apply migrations with `npx prisma migrate deploy` (never `migrate dev` in production).
4. Bootstrap the first administrator with `npm run seed:admin` and a unique strong password.
5. Build and run the API (`npm run build -w @lms/api && npm run start -w @lms/api`).
6. Build and run the web app (`npm run build -w @lms/web && npm run start -w @lms/web`), with `/api/v1/*`
   routed to the API origin (reverse proxy or platform rewrite) over HTTPS so cookies and PWA install work.
7. Back up the database and the private storage directory together; restore into a clean environment and verify
   before go-live.

## Documentation

- `DOCUMENTATION_INDEX.md` — index of the approved pack and the implementation documents.
- `docs/10_IMPLEMENTATION_PLAN.md` — architecture, requirements traceability, approved business rules.
- `docs/11_VERIFICATION_REPORT.md` — what was tested, exact results, and known limitations.
- `docs/08_DECISIONS_AND_OPEN_QUESTIONS.md` — how unresolved requirements were decided.
- `apps/api/README.md`, `apps/web/README.md` — per-application setup, tests and operational notes.

## Known limitations

- Online payment gateways are out of scope; payments are recorded against invoices by staff.
- Only the local private-storage adapter ships; production S3-style storage must implement `StorageAdapter`.
- Email/SMS/WhatsApp delivery is limited to optional SMTP for password-reset mail; otherwise the audited,
  Super-Admin-issued reset link is used.
- Camera-based QR scanning and PWA installation require HTTPS and were reviewed manually; automated browser
  coverage exercises the QR token API, the manual fallback path and the install prerequisites (manifest +
  service worker).
- Database backup/restore runbooks are documented but a rehearsal in the target environment is still required
  before production sign-off.
