# Implementation Plan and Requirements Traceability

**Version:** 1.0 — produced by the Phase 0 repository/documentation audit
**Status:** Implementation baseline. Supersedes nothing in `01`–`09`; resolves their open items per `08_DECISIONS_AND_OPEN_QUESTIONS.md`.

## 1. Repository audit (Phase 0)

Findings at audit time:

- The repository contained **documentation only**: `README.md`, `DOCUMENTATION_INDEX.md`, and `docs/01`–`docs/09`. No application source, build configuration, lockfile, environment file, or database migration existed.
- Consequently there was no prior implementation to preserve or overwrite, and nothing to reverse-engineer.
- No Git history was available in the working copy (no commits); the documentation pack is therefore the sole source of truth.
- Local environment: Node.js 24.x, npm 12.x, Windows host, bash shell. **No system PostgreSQL and no Docker** were available.
- To satisfy the documentation's mandate that migrations and tests actually run, the project ships a guarded **development database launcher** using bundled PostgreSQL binaries (`embedded-postgres`, PostgreSQL 18.4) on `127.0.0.1:55432`. Production continues to use managed PostgreSQL; the launcher is a development/CI convenience only and is never enabled in production.

Because the required documentation was present and internally consistent, Phase 0 did not stop for missing files. The audit did find unresolved business/technical decisions. Each is resolved in `08_DECISIONS_AND_OPEN_QUESTIONS.md` with the suggested default, or with an explicitly reasoned safe default where the pack offered none (password-recovery delivery, re-enrollment policy, certificate reissue, certificate eligibility).

### Contradictions and gaps identified, and how they are handled

| Gap | Resolution (recorded in doc 08) |
|---|---|
| FR-AUTH-03 requires password recovery, but no email provider is approved and email is listed as a future enhancement | Recovery tokens are implemented as single-use, expiring, hashed records. Delivery is pluggable: SMTP when configured; otherwise a Super-Admin-only, audited "issue reset link" operation supplies the one-time link to staff. Public reset requests never reveal account existence. |
| Schema doc lists `PaymentAllocation` "if required" while API doc offers no allocation endpoint | MVP posts each payment against exactly one invoice, and still writes one allocation row so the ledger and future multi-invoice allocation are honest. Client-supplied allocations are not accepted. |
| `Payment.idempotencyKey` is described as either a column or a separate table | A dedicated `IdempotencyRecord` table with `(actor, operation, key)` uniqueness and request-hash comparison, so a retried key with a different payload is rejected instead of silently replayed. |
| Attendance denominator is not defined (only "Late/Excused policy is configurable") | Defined in `packages/shared/src/attendance.ts` and documented in §4 below: eligible sessions are finalized, non-cancelled sessions of the enrollment's batch within the enrollment's active window. |
| Certificate reissue history (D-17) | Certificates are never overwritten: revoked rows are retained, and a reissued certificate is a new row with a new number and verification code. |
| UI route map lists ~45 routes but no explicit staff page for class-session roster | Added `/admin/attendance/sessions/[id]` and `/front-desk/attendance/sessions/[id]` roster screens; recorded here rather than silently omitting a required workflow. |
| `.env.example`, bootstrap, backup instructions required by §15 of the master brief but absent from the pack | Delivered as part of Phase 9 handover and per-app READMEs. |

## 2. Delivered architecture

Modular monolith, two deployable applications, one optional shared package:

```text
it-institute-lms/
├── apps/
│   ├── api/     Express 5 + TypeScript (strict) + Prisma 6 + PostgreSQL
│   └── web/     Next.js 15 App Router + React 19 + Tailwind + shadcn-style UI + PWA
├── packages/
│   └── shared/  Non-secret domain types, permission map, attendance policy, money/format helpers
├── docs/
└── package.json (npm workspaces)
```

- The browser never reaches PostgreSQL; Prisma stays inside `apps/api`.
- The web app calls the API through a same-origin path (`/api/v1/*`) rewritten by Next.js in development and by the reverse proxy in production, so the session cookie stays first-party and CSRF protection is meaningful. A CORS allowlist exists for direct API use.
- Money is stored and computed as **integer minor units (paisa)**. No floating point is used for money anywhere.
- Authentication is an opaque server-side session token in an `HttpOnly` cookie; only its SHA-256 hash is stored. CSRF uses a double-submit cookie plus `X-CSRF-Token` on every unsafe method, including login.
- Private object storage is accessed through a small storage interface; the shipped adapter writes to a private directory outside any public root and is swapped for S3-compatible storage in production via `STORAGE_DRIVER`.

## 3. Requirements traceability

| Requirement | Implementation | Verification |
|---|---|---|
| FR-AUTH-01..07 | `apps/api/src/modules/auth`, `users`; `middleware/auth.ts`, `middleware/csrf.ts` | `tests/integration/auth.test.ts` (11), `tests/integration/rbac.test.ts` |
| FR-STU-01..06 | `modules/students`, `courses`, `batches`, `instructors`, `enrollments` | `tests/integration/admissions.test.ts` (8) |
| FR-ATT-01..08 | `modules/attendance`; shared `attendance.ts` policy | `tests/integration/attendance.test.ts` (11), unit `tests/unit/attendance.test.ts` (7) |
| FR-FEE-01..09 | `modules/fees` (plans, invoices, payments, reversals, receipts) | `tests/integration/fees.test.ts` (11), unit `tests/unit/money.test.ts` (6) |
| FR-CERT-01..07 | `modules/certificates`, `services/storage.ts` | `tests/integration/certificates.test.ts` (8) |
| FR-COM-01..04 | `modules/announcements`, `modules/notifications` (portal feed) | `tests/integration/operations.test.ts` (announcements 2) |
| FR-REP-01..02 | `modules/reports` + CSV serializers | `tests/integration/operations.test.ts` (reports 2) |
| FR-SET-01 | `modules/settings` | `tests/integration/operations.test.ts` (settings 3) |
| FR-AUD-01 | `modules/audit` + `utils/audit.ts` | asserted inside attendance, assessment and reversal tests |
| NFR-SEC-01..07 | helmet, CORS allowlist, rate limits, Argon2id, cookie flags, CSRF, Zod validation, private storage | `tests/integration/auth.test.ts`, `tests/integration/rbac.test.ts` |
| NFR-DATA-01..03 | Prisma transactions, `Int` minor units, UTC storage | `tests/integration/fees.test.ts`, `tests/unit/money.test.ts` |
| NFR-PWA-01 | Custom service worker with app-shell-only caching | `apps/web/e2e/pwa.spec.ts` + documented cache policy audit |
| NFR-TEST-01 | Vitest + Supertest suites, Playwright specs | `npm test -w @lms/api` (77), `npm run test:e2e -w @lms/web` (19) |
| Module 12 (PWA) | `apps/web/public/manifest.webmanifest`, `public/sw.js`, install/update/offline components | `apps/web/e2e/pwa.spec.ts` (4), manual checklist |

## 4. Approved business rules implemented

1. **Attendance percentage**: eligible sessions = `FINALIZED` and not `CANCELLED` sessions in the enrollment's batch with `startsAt` on/after `enrollment.joinedAt` and, for completed/withdrawn enrollments, on/before `completedAt`. Numerator counts `PRESENT`, plus `LATE` when `lateCountsAsPresent`; `EXCUSED` is removed from the denominator when `excusedCountsInDenominator` is false. `ABSENT` always counts in the denominator. Percentage is 0 when there are no eligible sessions, and the response also reports the raw counts.
2. **Fee balance**: `outstanding = sum(invoice.totalMinor) − sum(invoice.discountMinor applied at issue) − sum(active payment allocations) + sum(completed reversals)`. Invoice status is derived after every posting inside the same transaction.
3. **Payment reversal**: requires `payment.reverse`, a reason, and cannot exceed `amountMinor − alreadyReversed`. A reversal posts a new auditable row; the payment and receipt rows are never deleted or rewritten.
4. **Certificate eligibility**: enrollment `COMPLETED`, attendance ≥ configured threshold, no outstanding balance, and (when enabled) all published assessments passed. Revoked certificates keep their audit trail; reissue creates a new certificate.
5. **Archival**: students, courses, batches and enrollments are status-archived. No hard delete exists for records with financial or academic history.

## 5. Verification plan and results

Executed on 2026-10-23 on this Windows machine (Node 24.21, npm 12, PostgreSQL 18.4 via the bundled development
launcher, Chrome through Playwright 1.64). Exact figures, what each suite covers, and what remains manual are in
`11_verification.md`.

- `npm run lint` — clean for `@lms/api` (0 errors/warnings) and `@lms/web` (160 files, 0 errors/warnings).
- `npm run typecheck` — clean for every workspace; `tsc -p tsconfig.test.json` also clean.
- `npm test -w @lms/api` — **77 tests, 9 files, all passing** against a migrated `lms_test` database.
- `npm run test:e2e -w @lms/web` — **19 Playwright journeys passing** against the production builds of both apps.
- `npm run build` — shared, API and web production builds all succeed.
- `prisma migrate deploy` from an empty database applies `20261023072413_init` cleanly.
- Manual: mobile widths, camera permission/fallback, PWA install, offline banner, PDF downloads, backup/restore
  rehearsal.
- CI: `.github/workflows/ci.yml` runs lint, typecheck, the API suite against a PostgreSQL service, production
  builds, and then the Playwright suite against seeded data.

## 6. Environment prerequisites

- Node.js ≥ 20 (verified on 24.21), npm ≥ 10.
- PostgreSQL 14+ for real deployments (verified locally against 18.4).
- Public origin served over HTTPS for cookies, camera access, and PWA installation.
- SMTP credentials if password-reset email delivery is required; otherwise the documented staff-issued reset-link procedure applies.
- Private storage location (`STORAGE_DRIVER=local` for dev; S3-compatible credentials for production).
