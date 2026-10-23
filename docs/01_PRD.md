# Product Requirements Document (PRD)

**Product:** IT Institute LMS & Institute Operations Portal  
**Version:** 0.1 — Draft for approval  
**Primary audience:** Institute owners, Super Admin, Front Desk Manager, students, engineering team

## 1. Product vision

Provide a secure, responsive, installable web application that centralizes student admissions, course/batch administration, attendance, fee collection, student self-service, and digital certificate issuance for an IT training institute.

This is an institute operations system with selected LMS capabilities. It is not an online course-video platform in the first release.

## 2. Goals

- Maintain a reliable central record for each student and enrollment.
- Reduce manual attendance work through QR scanning and roll-number entry.
- Track fee plans, invoices/installments, payments, outstanding balances, receipts, and reversals.
- Give students controlled self-service access to their own profile, attendance, fees, receipts, courses, and certificates.
- Issue downloadable PDF certificates with a public authenticity/status verification page.
- Provide role-specific dashboards and operational reports.
- Deliver a mobile-first PWA experience with safe caching behavior.

## 3. Non-goals for MVP

- Native Android/iOS applications distributed through app stores.
- Video hosting, live classes, or a full course-content authoring platform.
- Online exam engine or automated proctoring.
- Payroll, procurement, inventory, or full accounting/general ledger.
- Multi-branch tenancy, unless confirmed as a launch requirement.
- Online payment gateway; MVP may record payments received by staff. Gateway integration is a later decision.
- Offline attendance submission or offline financial transactions.

## 4. User roles

### Super Admin
Full operational control, including staff accounts/permissions, institute settings, student/course/batch management, attendance corrections, fee policy and authorized adjustments, certificate issue/revocation, reports, and audit logs.

### Front Desk Manager
Daily admissions, permitted student updates, enrollment, attendance marking, fee collection and receipts, and operational reports. Cannot manage staff roles, global security settings, unrestricted refunds/adjustments, or certificate revocation by default.

### Student
Read-only access to own profile, enrollments, schedule, attendance, fee ledger, receipts, announcements, and issued certificates. May update only explicitly permitted profile fields and own password.

Roles must be enforced by the API. UI visibility is not authorization.

## 5. MVP scope and requirements

### Student and enrollment management
- Create, view, update, search, filter, paginate, and archive student records.
- Generate a unique, non-reusable student number.
- Create course and batch records, schedules, instructor assignment, capacity, and lifecycle status.
- Enroll a student into a specific batch with joining date, agreed fee, and enrollment status.
- Support a student having multiple enrollments over time.
- Preserve history after a student or enrollment is archived.

### Attendance
- Create a class session for a batch and mark it open, finalized, or cancelled.
- Mark attendance through an authenticated staff QR scanner or manual student-number lookup.
- Support Present, Absent, Late, and Excused statuses.
- Prevent duplicate records for the same enrollment and session.
- Allow authorized corrections with a reason and audit entry.
- Calculate attendance using eligible finalized sessions only. Cancelled sessions are excluded.
- Configure whether Late counts as present for the attendance percentage.

### Fees
- Configure fee plans and enrollment-specific agreed fee.
- Generate invoices/installments with due dates and line items.
- Record full or partial payments and supported payment methods.
- Generate unique receipts and show a student ledger.
- Calculate outstanding balance from invoice charges, approved adjustments, successful payments, and reversals according to the approved accounting policy.
- Support authorized refunds/reversals through new ledger entries; never silently delete a payment.
- Provide overdue dues and collection reports.
- MVP records staff-received payments; online payment gateway is not included unless separately approved.

### Student portal
- Secure login and password recovery.
- View own profile, enrollment/course/batch, timetable, attendance, fee ledger, receipts, announcements, notifications, and certificates.
- Never trust a student ID supplied by the client to authorize access to another student's data.

### Certificates
- Issue only to eligible enrollments and authorized users.
- Store certificate number, enrollment, issue date, status, template/version metadata, and private storage key.
- Generate a PDF with institute branding, student name, course title, dates, authorized signatory, and verification URL/QR.
- Permit the authenticated student to download their own issued certificate.
- Public verification reveals only minimum necessary information and certificate status.
- Preserve revoked certificate history and show revoked status on verification.

### Reports
- Admissions and student status.
- Batch-wise and student-wise attendance.
- Fee collection, outstanding invoices, overdue installments, and payment method summaries.
- Course completion and certificate status.
- CSV export where authorized; exports must be audited if they contain sensitive data.

### PWA
- Installable manifest, icons, HTTPS deployment, responsive mobile layout, service worker, app-shell caching, offline fallback, and update behavior.
- Do not cache sensitive API responses, fee data, student records, or private certificate PDFs in shared service-worker caches.
- If the network is unavailable, show a clear offline state; do not imply a write succeeded unless the server confirms it.

## 6. Success metrics

Proposed initial targets; approve or adjust before release:
- 100% of protected API routes have authentication and authorization tests.
- Duplicate attendance and duplicate payment submission tests pass.
- Students cannot access another student's records in API and browser tests.
- Fee balances reconcile against invoices, payments, adjustments, and reversals in test fixtures.
- Certificate downloads require authorization; public verification exposes no sensitive personal data.
- Core student/attendance/fee workflows are usable on common Android mobile browsers.
- Production backup restoration is successfully rehearsed before launch.

## 7. Assumptions

- One institute/organization for MVP.
- One institute time zone is configurable; Pakistan time (`Asia/Karachi`) is a reasonable default, pending approval.
- Currency is PKR by default, pending approval.
- Staff record payments manually in MVP.
- The institute supplies logo, certificate text, authorized signatory details, attendance policy, and fee policy.
- Student accounts are created by authorized staff; public student registration is disabled.

## 8. Release gates

- **Gate A — Scope approval:** confirm MVP, roles, policies, currency/time zone, and fee rules.
- **Gate B — Design approval:** approve page flows, forms, dashboard metrics, certificate template.
- **Gate C — Technical approval:** approve schema, API contract, security decisions, hosting, and backup strategy.
- **Gate D — MVP acceptance:** all critical tests in `09_TEST_PLAN.md` pass; known limitations documented.
