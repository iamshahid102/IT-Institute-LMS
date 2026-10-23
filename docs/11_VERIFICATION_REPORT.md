# Verification Report

**Date:** 23 October 2026
**Environment:** Windows 11 host, Git Bash, Node.js 24.21.0, npm 12.x, PostgreSQL 18.4 (bundled development
launcher on 127.0.0.1:55432), Chrome (installed) driven by Playwright 1.64.1.

Everything below was executed in this working copy. No result is copied from a plan or assumed.

## 1. Database

| Check | Command | Result |
|---|---|---|
| Migrations apply to an empty database | `npx prisma migrate deploy` (on `lms_test`, empty) | `20261023072413_init` applied successfully |
| Deterministic seed | `npm run db:seed` | Seeded 2 staff accounts, 2 student portal accounts, 6 students, 3 courses, 3 batches, 5 enrollments, sessions, invoices, payments, 2 certificates (1 issued, 1 revoked) |

## 2. Automated API suite — `npm test -w @lms/api`

**Result: 68 tests passed, 8 files, exit code 0.** The suite runs against a real PostgreSQL `*_test` database,
which `tests/global-setup.ts` migrates and refuses to run against any database not ending in `_test`.

| File | Tests | Covers |
|---|---|---|
| `tests/unit/money.test.ts` | 6 | Minor-unit parsing, half-up rounding, rejection of malformed amounts, display formatting |
| `tests/unit/attendance.test.ts` | 7 | Attendance percentage under both Late/Excused policies, zero-denominator safety, unmarked sessions counting as absent, negative-input hardening |
| `tests/integration/auth.test.ts` | 11 | Login + HttpOnly/SameSite cookie, CSRF rejection, session/`/me`, generic credential and reset responses, suspended account, payload validation, logout revocation, password rotation signing out other sessions, wrong current password, health/readiness |
| `tests/integration/admissions.test.ts` | 8 | Server-generated student numbers, admission validation, archival that keeps history, portal-account validation, enrollment creation with agreed fee, duplicate enrollment rejection, completion transition, unknown-student rejection |
| `tests/integration/rbac.test.ts` | 6 | Front Desk denied staff/settings/audit/reversal/certificate-revocation actions, allowed operational actions, student blocked from staff surfaces, cross-student receipt/certificate/profile denial, protected profile fields ignored, empty portal state |
| `tests/integration/attendance.test.ts` | 11 | Session create/open/finalize (auto-absent), invalid time range, manual marking + duplicate rejection (DB unique constraint), unknown student, closed session, QR issue/scan/replay, wrong-batch token, invalid token, expired token, correction permission + reason + audit row, percentage excluding cancelled sessions |
| `tests/integration/fees.test.ts` | 11 | Integer invoice maths, discount guard, partial payment status/balance, ledger reconciliation, idempotent replay, key reuse with different payload, missing idempotency key, overpayment, duplicate reference, full settlement, partial + full reversal with ledger effect, reversal beyond remaining, staff and student receipt PDFs, fee plans |
| `tests/integration/certificates.test.ts` | 8 | Eligibility diagnostics for incomplete enrollment, fee-blocked eligibility, one-time issuance with unique number/code, front-desk denial, public verification field minimisation, unknown code 404, owner download and cross-student denial, revocation status + download block + double-revocation guard |

Additional checks: `npx tsc -p tsconfig.test.json` (sources + tests) exits 0; `eslint .` in `apps/api` reports no
errors.

## 3. Browser journeys — `npm run test:e2e -w @lms/web`

**Result: 19 tests passed, exit code 0**, against the production builds of both apps (`next start`,
`node dist/server.js`) and the seeded development database, using the installed Chrome.

| Spec | Tests | Journeys |
|---|---|---|
| `e2e/auth.spec.ts` | 2 | Anonymous visitor redirected to sign-in; invalid credentials rejected with a generic message |
| `e2e/admin.spec.ts` | 4 | Super Admin dashboard loads real metrics; mobile navigation opens at 390×844; course created through the UI appears in the list; student list opens an admission record |
| `e2e/student-portal.spec.ts` | 5 | Student dashboard, attendance page with API percentage, fees/ledger/receipts navigation, only contact fields editable, staff workspace unreachable |
| `e2e/public-verification.spec.ts` | 4 | Issued certificate shows "Valid · Issued"; revoked certificate shows "Revoked · Not valid"; unknown code reports not found; verification form navigates to a result |
| `e2e/pwa.spec.ts` | 4 | Manifest served with installable icons and `standalone`; service worker served uncached with `Service-Worker-Allowed: /` and no API caching; service worker registers in the browser; offline fallback renders |

Mapping to the required journeys in the master brief:

| # | Required journey | Where verified |
|---|---|---|
| 1 | Super Admin logs in and creates a course | `e2e/admin.spec.ts` (browser) |
| 2 | Staff creates a student and enrollment | API integration `admissions.test.ts` (admission + enrollment creation through the API); browser suite covers navigating an existing admission record only |
| 3 | Staff opens a session and marks attendance manually | API integration `attendance.test.ts` (session lifecycle + manual marking) |
| 4 | Staff marks attendance with a valid QR flow | API integration `attendance.test.ts` (student token issuance → scan success) |
| 5 | Duplicate attendance is rejected safely | API integration (409 `DUPLICATE_ATTENDANCE`, single row asserted) |
| 6 | Staff creates invoices and records a partial payment | API integration `fees.test.ts` |
| 7 | Receipt available after successful posting | API integration (PDF header + student download) |
| 8 | Outstanding balance is accurate | API integration (invoice detail, ledger and portal summaries) |
| 9 | Student views own attendance and fees | `e2e/student-portal.spec.ts` (browser) + API ownership tests |
| 10 | Eligible student receives a certificate and downloads the PDF | API integration `certificates.test.ts` |
| 11 | Public verification shows correct status | `e2e/public-verification.spec.ts` (browser) |
| 12 | Unauthorized users cannot access protected data or actions | `e2e/auth.spec.ts`, `e2e/student-portal.spec.ts`, `rbac.test.ts` |

Journeys 2–8 and 10 are exercised through the HTTP API because the business rules (eligibility, money, duplicate
protection) are server-side; they are not asserted through the DOM in the browser suite. This is a deliberate
split, not an omission of coverage, but it does mean UI regressions in those specific forms are not caught by
automation.

## 4. Static checks and builds

| Check | Command | Result |
|---|---|---|
| API lint | `eslint .` (`apps/api`) | 0 errors, 0 warnings |
| API typecheck | `tsc -p tsconfig.json --noEmit` | exit 0 |
| API test typecheck | `tsc -p tsconfig.test.json` | exit 0 |
| API build | `npm run build -w @lms/api` (`prisma generate` + `tsc`) | exit 0, `dist/` emitted |
| Web lint | `eslint .` (`apps/web`) | 160 files, 0 errors, 0 warnings |
| Web typecheck | `tsc -p tsconfig.json --noEmit` | exit 0 |
| Web build | `npm run build -w @lms/web` | exit 0, 59 routes prerendered/compiled, no build warnings |

## 5. Security checks exercised by tests

- CSRF: unsafe request without `X-CSRF-Token` → `403 CSRF_INVALID`.
- Account enumeration: identical status, code and message for unknown email and wrong password; identical bodies
  for known and unknown password-reset requests.
- Suspended account cannot sign in; error body contains no stack trace.
- Student ownership: another student's receipt download → 404, certificate download → 404, student record → 403;
  profile patch cannot change name, status or student number.
- Role separation: Front Desk denied `user.manage`, `settings.manage`, `audit.read`, `fee.reverse`,
  `certificate.revoke`, `report.financial.read`; students denied every staff surface.
- Rate limiting was observed live during test development (login limiter returned `429 RATE_LIMITED` after
  repeated attempts), which is why the browser suite signs each role in once via stored session state.
- Public verification response asserted not to contain phone, student number, email, address or storage keys.

## 6. Not verified automatically (requires manual or environment-specific QA)

1. Camera permission prompts and scanning a physical QR code in mobile Safari/Chrome.
2. PWA installation prompt and update flow on a real device over HTTPS.
3. Offline behaviour with the network actually disabled (the offline route and service-worker caching rules are
   covered; the disconnection experience is not).
4. Database backup and restore rehearsal in a production-like environment.
5. SMTP delivery of password-reset email (no SMTP server configured locally).
6. Accessibility audit with assistive technology (labels, focus order and dialog semantics exist but were not
   audited with a screen reader).
7. Load/performance testing and concurrent payment stress beyond the idempotency tests.
