# Implementation Roadmap and Delivery Gates

**Version:** 0.1 — Planning estimate, not a fixed commitment

## 1. Delivery approach

Build a modular monolith with two deployable apps: `apps/web` and `apps/api`. Use short iterations, feature branches, reviewed migrations, automated tests, and acceptance gates. Finish vertical slices (UI + API + database + tests) rather than building all frontend screens first.

## 2. Phase plan

### Phase 0 — Approval and setup
**Deliverables**
- Approved PRD, SRS, schema, API contract, and UX route map.
- Confirmed fee, attendance, certificate, account, currency, and time-zone policies.
- Repository, lint/format/type-check, CI, environment validation, error handling.
- Local PostgreSQL and Prisma migration/seed setup.

**Exit gate**
- Clean install from README works.
- CI passes lint, type-check, and baseline tests.
- No unresolved decision blocks core schema.

### Phase 1 — Authentication and RBAC
**Deliverables**
- Login/logout/current-user/password recovery.
- Secure cookie/session setup and CSRF protection.
- Role/permission middleware and account status handling.
- Role-specific app shells and route protection.

**Exit gate**
- API authorization tests pass for all roles.
- No public privileged account creation.

### Phase 2 — Students, courses, batches, enrollment
**Deliverables**
- Student CRUD/archive, unique student number.
- Course/instructor/batch/schedule management.
- Enrollment workflow and fee agreement.
- Search, filters, pagination, responsive tables.

**Exit gate**
- Historical enrollment references remain valid after archival.
- Duplicate identifiers are rejected by database constraints.

### Phase 3 — Attendance
**Deliverables**
- Session lifecycle and batch roster.
- QR scanner and manual student-number flow.
- Status management, correction reason, audit logs.
- Attendance summary and reports.

**Exit gate**
- Duplicate scan is safe; invalid batch/session is rejected.
- Attendance calculation matches approved policy.

### Phase 4 — Fees and receipts
**Deliverables**
- Fee plan, invoice/items, installments.
- Payment recording, allocations, receipt generation.
- Outstanding balance and collection reports.
- Reversal workflow and idempotency.

**Exit gate**
- Financial test fixtures reconcile exactly.
- Repeated requests do not create duplicate payments.
- Reversal limits are enforced.

### Phase 5 — Student self-service
**Deliverables**
- Profile, enrollments, schedules, attendance, fees, receipts.
- Announcements and in-app notifications.
- Password/account settings.

**Exit gate**
- Ownership tests prove a student can access only their own data.

### Phase 6 — Certificates
**Deliverables**
- Completion eligibility checks.
- PDF template and versioning.
- Unique certificate number and verification code.
- Private storage, authorized download, revocation, public verification.

**Exit gate**
- Unauthorized issuance/download fails.
- Revoked certificate is visibly invalid on verification.

### Phase 7 — Reports, PWA, launch hardening
**Deliverables**
- Approved reports and exports.
- PWA manifest, icons, service worker, offline fallback, update prompt.
- Responsive/mobile and camera testing.
- Monitoring, backup and restore runbook.
- Production deployment and handover documentation.

**Exit gate**
- Critical end-to-end tests pass.
- Backup restore and access-control checks are demonstrated.
- Known limitations are approved.

## 3. Suggested timeline

For one experienced full-stack developer, a rough planning range is 7–10+ weeks for a focused MVP, depending on design complexity, integrations, and testing. A beginner or part-time schedule may take significantly longer. Do not promise dates until scope and availability are confirmed.

## 4. Engineering standards

- TypeScript strict mode.
- ESLint and formatter.
- Zod request validation.
- Prisma migrations reviewed in version control.
- No business rules exclusively in React components.
- API service layer owns financial and academic rules.
- Automated tests required for each critical workflow.
- PR review or self-review checklist before merging.
- Never commit `.env` or production secrets.
- Maintain `.env.example` with placeholder values only.
- Use seed data for development; never use real student data in test environments.
- Keep `docs/` updated when API, schema, or policy changes.

## 5. Definition of done for a feature

- Requirements and permissions documented.
- UI includes loading, empty, error, success, and responsive states.
- API validates all inputs.
- Authorization includes role and record ownership where relevant.
- Database constraints and transactions are present where needed.
- Unit/integration tests cover success and failure paths.
- Audit logs are added for sensitive actions.
- OpenAPI documentation updated.
- Accessibility and mobile behavior checked.
- No secrets or sensitive data in logs.
- Acceptance criteria signed off.

## 6. First implementation sprint

1. Create repository and app workspaces.
2. Configure Next.js, TypeScript, Tailwind, shadcn/ui.
3. Configure Express, TypeScript, Zod, Prisma, PostgreSQL.
4. Add environment validation and health endpoints.
5. Define User, Student, Course, Batch, Enrollment baseline models.
6. Add first migration and deterministic development seed.
7. Add login/session skeleton and permission middleware.
8. Add CI checks and first API/frontend tests.
9. Review the resulting architecture before expanding modules.
