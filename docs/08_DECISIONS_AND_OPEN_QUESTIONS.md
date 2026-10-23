# Decisions and Open Questions

**Version:** 0.2 — Phase 0 decisions recorded
**Purpose:** Resolve these items before schema freeze and implementation.

Status legend: **Adopted** = implemented as described, pending formal product-owner sign-off (no objection recorded). These are the documented safe defaults from v0.1 unless a row states otherwise. Changing an adopted decision after implementation requires a migration and a documentation update.

## A. Business decisions

| ID | Question | Decision |
|---|---|---|
| D-01 | Institute currency? | **Adopted:** PKR, stored as integer paisa. Configurable in institute settings; currency is immutable per invoice/payment once posted. |
| D-02 | Institute time zone? | **Adopted:** `Asia/Karachi`, configurable in settings. All timestamps stored UTC; schedules interpreted in institute time zone. |
| D-03 | One branch or multiple? | **Adopted:** one institute/branch for MVP. No branch column; adding multi-branch later is a documented migration. |
| D-04 | Student login identifier? | **Adopted:** email address (case-insensitive unique). Student numbers are operational identifiers, not credentials. |
| D-05 | Can students have no email? | **Adopted:** yes for the student record, but a student portal account requires an email. Admission may create the record without a portal account; staff add the account when the email is available. |
| D-06 | Who creates student accounts? | **Adopted:** staff only. Public privileged registration is disabled; student accounts are created through the student admission/account workflow. |
| D-07 | Attendance statuses? | **Adopted:** `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`. |
| D-08 | Does Late count as present? | **Adopted:** configurable `lateCountsAsPresent`, default **false**; late is always reported separately. |
| D-09 | Does Excused count in the attendance denominator? | **Adopted:** configurable `excusedCountsInDenominator`, default **false** (excused sessions are waived). |
| D-10 | Attendance eligibility? | **Adopted:** only `FINALIZED`, non-cancelled sessions inside the enrollment's active window. `OPEN` and `SCHEDULED` sessions never affect percentages. |
| D-11 | Fee plan model? | **Adopted:** enrollment carries `agreedFeeMinor` (source of truth) and may reference a reusable fee plan used to generate installment invoices. |
| D-12 | Are partial payments allowed? | **Adopted:** yes. Overpayment of a single invoice is rejected. |
| D-13 | Can one payment cover multiple invoices? | **Adopted:** no. One payment belongs to one invoice; an allocation row is still written for ledger clarity. |
| D-14 | How are refunds/discounts approved? | **Adopted:** Super Admin only (`fee.reverse`), reason required, cumulative reversals capped at the paid amount. Invoice-level discounts are applied at invoice creation by users with `fee.invoice.create`. |
| D-15 | Is online payment required at launch? | **Adopted:** no. Staff-recorded payments only; no gateway surfaces or claims. |
| D-16 | Certificate completion criteria? | **Adopted:** enrollment `COMPLETED`; attendance ≥ `attendanceThresholdPercent` (default 75); no outstanding balance; and, when `certificateRequireAssessmentsPassed` is enabled, every published assessment passed. Settings toggles allow the institute to relax the fee/assessment checks; the UI shows the checklist. |
| D-17 | Can a certificate be reissued? | **Adopted:** only after revocation, and only as a new certificate row with a new number and verification code. Issued certificates are never overwritten. |
| D-18 | Public certificate fields? | **Adopted:** certificate number, student name, course title, issue date, status, and revocation date when revoked. Never fee data, contact details, address, login identifiers, or storage keys. Name display is controlled by `certificatePublicShowName`. |
| D-19 | Need instructor login in MVP? | **Adopted:** no. Instructors are staff-managed records without portal accounts. |
| D-20 | Need online quizzes/exams? | **Adopted:** no engine. Assessment and result entry only, used for completion and certificate eligibility. |
| D-21 | Need SMS/WhatsApp? | **Adopted:** no. In-app announcements and notifications only. |
| D-22 | Student data retention policy? | **Adopted:** records are archived, never hard-deleted while financial/academic history exists. Retention period and lawful deletion remain an institute/legal decision before production; the system supports archival only. |
| D-23 | Backup RPO/RTO? | **Adopted starting point:** daily automated backup, RPO ≤ 24 h, RTO ≤ 4 h, monthly restore rehearsal. Documented in the runbook; production owner must confirm. |
| D-24 | Student ID format? | **Adopted:** `STU-YYYY-000001`, sequence reset per year, allocated transactionally so numbers are never reused. |
| D-25 | Receipt and certificate template? | **Adopted:** neutral built-in template version `v1`; institute name, logo, signatory and legal text come from settings. Templates are versioned on the certificate row. |
| D-26 | How is a password-reset link delivered without an approved email provider? | **Adopted:** token records are single-use, expiring, hashed. If SMTP is configured the link is emailed; otherwise a Super Admin can issue a one-time link through an audited staff action. Public reset requests always return a generic response. |
| D-27 | Re-enrollment in the same batch? | **Adopted:** not permitted; `(studentId, batchId)` is unique. A returning student is enrolled in a new batch. |
| D-28 | One assessment per batch or course? | **Adopted:** assessments may target a course and optionally a batch; results are keyed to enrollments. |

## B. Technical decisions

All adopted as recommended in v0.1, with the following confirmations:

- **Authentication:** server-side opaque sessions, `HttpOnly` cookie, hashed token at rest, 7-day idle expiry / absolute expiry, revoked on logout, password change, suspension and deactivation.
- **CSRF:** double-submit cookie with `X-CSRF-Token`, required on every unsafe request.
- **Database:** PostgreSQL with Prisma; managed PostgreSQL in production; bundled PostgreSQL 18 for local development and CI.
- **Storage:** private filesystem adapter for development, S3-compatible/private storage for production behind one interface (`STORAGE_DRIVER`).
- **Hosting:** Next.js on a Node/Next-compatible host, Express on a Node host, both behind one HTTPS origin with `/api/v1` proxied to Express.
- **Monorepo:** `apps/web`, `apps/api`, `packages/shared`.
- **PWA:** hand-written manifest and service worker (no PWA dependency), app-shell caching only.
- **Email:** optional SMTP transport; see D-26.
- **Logging:** structured JSON logs (pino) with request IDs; no secrets, tokens, or unnecessary personal data.
- **Payments gateway:** out of scope.

## C. Approval record

- Product owner:
- Technical owner:
- PRD approved on:
- SRS approved on:
- Database schema approved on:
- API contract approved on:
- Security requirements approved on:
- MVP scope approved on:
- Remaining blockers: none blocking implementation. Formal sign-off on the adopted defaults above is still required before production launch.
