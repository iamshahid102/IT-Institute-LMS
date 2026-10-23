# Test Plan and Acceptance Criteria

**Version:** 0.1 — Draft for approval

## 1. Test layers

- Unit tests: calculations, policy functions, validators, permission helpers.
- API integration tests: Express routes, database transactions, authorization, and error behavior.
- UI component tests: critical form validation and interaction states where useful.
- End-to-end tests: Playwright workflows for each role.
- Security tests: direct API access, record ownership, rate limiting, and file access.
- Manual QA: mobile layout, camera permissions, PWA install/update, printing and PDF downloads.
- Recovery tests: restore database backup into a clean environment.

## 2. Critical acceptance scenarios

### Authentication and authorization
- [ ] Anonymous users cannot call protected endpoints.
- [ ] Suspended/disabled users cannot access protected routes.
- [ ] Front Desk cannot create Super Admin accounts or change privileged roles.
- [ ] Student A cannot fetch Student B's profile, attendance, invoices, receipts, or certificates by changing IDs.
- [ ] Password reset tokens expire and cannot be reused.
- [ ] Logout invalidates the session.

### Students and enrollment
- [ ] Duplicate student number is rejected.
- [ ] Required fields are validated on server.
- [ ] Student archive preserves financial and academic history.
- [ ] Enrollment is associated with the correct student, batch, and agreed fee.
- [ ] Pagination and filters do not leak unauthorized records.

### Attendance
- [ ] Valid QR token for an active enrolled student and open session marks attendance.
- [ ] Invalid, revoked, expired, or wrong-batch token is rejected.
- [ ] Manual student-number entry resolves the correct student.
- [ ] Student not enrolled in the session's batch cannot be marked.
- [ ] Duplicate scan/manual submission does not create a second record.
- [ ] Closed/finalized/cancelled session behavior follows policy.
- [ ] Corrections require permission and reason and produce an audit event.
- [ ] Attendance percentage excludes cancelled sessions and follows approved Late/Excused rules.

### Fees and payments
- [ ] Invoice total and line items reconcile.
- [ ] Partial payment reduces outstanding balance correctly.
- [ ] Payment submission retry with the same idempotency key does not double-post.
- [ ] Same key with materially different payload is rejected.
- [ ] Payment receipt is generated only after server confirms posting.
- [ ] Unauthorized staff cannot reverse a payment.
- [ ] Reversal cannot exceed successful payment amount.
- [ ] Ledger reflects original payment and reversal separately.
- [ ] Student sees only their own fee ledger and receipt.
- [ ] Daily/monthly reports reconcile with ledger entries.

### Certificates
- [ ] Ineligible enrollment cannot receive a certificate unless an approved exception flow exists.
- [ ] Unauthorized user cannot issue/revoke a certificate.
- [ ] Certificate number and verification code are unique.
- [ ] Student can download their own issued PDF.
- [ ] Student cannot download another student's PDF.
- [ ] Public verification reveals only approved fields.
- [ ] Revoked certificate shows invalid/revoked status.
- [ ] Certificate issue/revocation creates audit events.

### PWA and UX
- [ ] App manifest and icons validate.
- [ ] Install works in supported browsers over HTTPS.
- [ ] Offline fallback appears when network is unavailable.
- [ ] Sensitive API data and PDFs are not stored in shared service-worker cache.
- [ ] A failed network write is not shown as successful.
- [ ] QR scanner works with permission and provides manual fallback.
- [ ] Forms/tables work at mobile, tablet, and desktop widths.
- [ ] Keyboard focus, labels, and dialog behavior are usable.

## 3. Test data policy

- Use synthetic/fake students and payment records in development and test.
- Do not copy production student data into test systems unless explicitly approved and safely anonymized.
- Reset test database deterministically between integration test suites.
- Use fixed clock/time-zone test cases for due dates and class schedules.
- Use test storage buckets for generated PDFs.

## 4. Release blocking defects

Do not release with:
- Cross-student data exposure.
- Privilege escalation.
- Incorrect financial balance or duplicate payment creation.
- Duplicate attendance that affects reports.
- Unauthorized certificate issue/download.
- Public exposure of private files or secrets.
- Unrecoverable production database state.
