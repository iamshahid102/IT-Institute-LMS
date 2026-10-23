# Software Requirements Specification (SRS)

**Version:** 0.1 — Draft for approval

## 1. System context

The system consists of:
- Next.js frontend/PWA.
- Express.js REST API.
- PostgreSQL database accessed through Prisma ORM.
- Private object storage for certificate PDFs and uploaded documents.
- Optional email/SMS provider in a later release.
- Monitoring and backup services.

The browser must not connect directly to PostgreSQL. All business operations pass through the API.

## 2. Functional requirements

IDs are intended for traceability from tests and implementation tasks.

### Authentication and access
- FR-AUTH-01: Users can sign in using approved credentials.
- FR-AUTH-02: Users can sign out and invalidate their session.
- FR-AUTH-03: The system supports password recovery with single-use, expiring tokens.
- FR-AUTH-04: The API resolves the authenticated user and enforces active account status.
- FR-AUTH-05: The API enforces role permissions and record ownership on every protected request.
- FR-AUTH-06: Public self-registration of privileged staff is disabled.
- FR-AUTH-07: Sensitive staff actions are logged.

### Students and enrollments
- FR-STU-01: Authorized staff can create, search, view, update, and archive student records.
- FR-STU-02: Student numbers are unique and are not reused after archival.
- FR-STU-03: Staff can create courses, batches, schedules, and instructor assignments.
- FR-STU-04: Staff can enroll a student into a batch and define agreed fee and enrollment status.
- FR-STU-05: Student and enrollment history remains available to authorized staff after archival.
- FR-STU-06: List endpoints support pagination, search, filters, and allowlisted sorting.

### Attendance
- FR-ATT-01: Authorized staff can create and manage batch class sessions.
- FR-ATT-02: Staff can mark attendance by scanning a QR token.
- FR-ATT-03: Staff can mark attendance by student number.
- FR-ATT-04: The system validates active enrollment in the session's batch.
- FR-ATT-05: Duplicate attendance is prevented by both service logic and a database unique constraint.
- FR-ATT-06: Authorized corrections require a reason and are audited.
- FR-ATT-07: Cancelled sessions do not count in attendance percentages.
- FR-ATT-08: Attendance percentage policy for Late and Excused is configurable and documented.

### Fees and payments
- FR-FEE-01: Authorized users can configure fee plans and enrollment fee agreements.
- FR-FEE-02: The system supports invoices, due dates, line items, and installments.
- FR-FEE-03: Authorized staff can record partial or full payments.
- FR-FEE-04: Every payment receives a unique internal identifier and receipt number/reference.
- FR-FEE-05: The system calculates outstanding balances using approved ledger rules.
- FR-FEE-06: Payment reversals/refunds create traceable entries and require permission and reason.
- FR-FEE-07: Repeated requests with the same idempotency key do not create duplicate payments.
- FR-FEE-08: Student accounts can view only their own fee data and receipts.
- FR-FEE-09: Reports can summarize collections, overdue balances, and payment methods.

### Certificates
- FR-CERT-01: Certificate issuance requires an eligible enrollment and authorized permission.
- FR-CERT-02: Certificate numbers are unique.
- FR-CERT-03: Generated PDFs are stored privately.
- FR-CERT-04: Students can download only their own issued certificates.
- FR-CERT-05: Authorized staff can revoke certificates with a reason.
- FR-CERT-06: Public verification returns only approved minimum fields and current status.
- FR-CERT-07: Issuance/revocation is audited.

### Announcements and notifications
- FR-COM-01: Authorized staff can publish announcements to defined audiences.
- FR-COM-02: Students can view announcements available to their audience.
- FR-COM-03: In-app notifications support unread/read state.
- FR-COM-04: Email/SMS are optional integrations and must not be represented as sent unless provider confirms success.

### Reports and settings
- FR-REP-01: Authorized users can view role-appropriate reports.
- FR-REP-02: Exports respect the same authorization rules as on-screen reports.
- FR-SET-01: Super Admin can configure institute branding, currency, time zone, attendance rules, receipt settings, and certificate defaults.
- FR-AUD-01: Audit events record actor, action, target entity, timestamp, and safe metadata.

## 3. Non-functional requirements

- NFR-SEC-01: Enforce HTTPS in production.
- NFR-SEC-02: Hash passwords using a modern password hashing algorithm such as Argon2id.
- NFR-SEC-03: Store secrets only in server-side environment/secret management.
- NFR-SEC-04: Protect cookie-based authentication against CSRF; configure HttpOnly, Secure, and appropriate SameSite attributes.
- NFR-SEC-05: Validate all API input and return safe error messages.
- NFR-SEC-06: Apply rate limits to login, password recovery, QR scanning, and public verification endpoints.
- NFR-SEC-07: Private files are delivered only after authorization or via short-lived signed URLs.
- NFR-DATA-01: Use database constraints and transactions for critical multi-step workflows.
- NFR-DATA-02: Use exact decimal or integer minor units for monetary values, never binary floating point.
- NFR-DATA-03: Store timestamps in UTC and display them in configured institute time zone.
- NFR-AVAIL-01: Backups and restoration procedures are documented and tested.
- NFR-PWA-01: Sensitive API data is excluded from shared service-worker caching.
- NFR-UX-01: Primary workflows are responsive and usable on mobile.
- NFR-OBS-01: Server errors and key operational failures are monitored without logging secrets or unnecessary personal data.
- NFR-TEST-01: Critical permissions, fee calculations, duplicate prevention, and certificate access have automated tests.

## 4. Data validation rules

- Email format validated where email is supplied; uniqueness policy must be approved.
- Student number, course code, batch code, invoice number, receipt number, and certificate number are unique within their defined scope.
- Amounts must be positive unless a specific adjustment/reversal model permits otherwise.
- Attendance status must be an allowed enum.
- Date/time inputs must be valid and interpreted using the institute time zone.
- A certificate cannot be issued for an ineligible or archived enrollment without an explicit approved exception workflow.
- User-provided sort columns are allowlisted to prevent query abuse.
- Uploads are size/type checked, stored privately, and never trusted solely based on filename or client MIME type.

## 5. Error handling

Use a consistent API error structure:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      { "field": "studentNumber", "message": "Already in use." }
    ],
    "requestId": "server-generated-id"
  }
}
```

Do not return stack traces, SQL details, password hashes, internal tokens, or secrets to clients.

## 6. Proposed operational targets

These are initial targets to validate against expected scale:
- 95% of normal list/detail API requests complete within 700 ms under agreed test load, excluding file generation and external providers.
- Support at least 1,000 active student records and 50 concurrent users in the initial performance test.
- Critical database operations use transactions and appropriate unique constraints.
- Establish explicit backup retention, RPO, and RTO before production. Suggested starting point: daily automated backups, RPO no worse than 24 hours, and a tested restoration runbook. Tighter objectives may require point-in-time recovery.
