# REST API Specification

**Base path:** `/api/v1`  
**Transport:** HTTPS + JSON  
**Version:** 0.1 — Draft contract

## 1. Conventions

- Use nouns and HTTP methods consistently.
- Protected routes require an authenticated session/token and permission checks.
- Validate request body, params, and query with Zod.
- Use pagination: `page`, `pageSize` (cap page size, e.g. 100), and allowlisted `sort`.
- Return consistent error objects with stable error codes and a request ID.
- Use database transactions for multi-record financial and certificate operations.
- Use idempotency keys for payment creation and any retry-prone write operation.
- Dates are ISO 8601; API timestamps are UTC unless an endpoint explicitly accepts a local schedule date/time with a time zone.

## 2. Response examples

### Success list
```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 25, "total": 0 }
}
```

### Error
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "requestId": "server-generated-id"
  }
}
```

## 3. Authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public, rate-limited | Authenticate |
| POST | `/auth/logout` | Authenticated | End session |
| GET | `/auth/me` | Authenticated | Current identity/permissions |
| POST | `/auth/forgot-password` | Public, rate-limited | Request reset; avoid account enumeration |
| POST | `/auth/reset-password` | Public, token-validated | Reset password |
| PATCH | `/auth/change-password` | Authenticated | Change password |

Recommended default: secure HttpOnly cookie session. If JWT is selected, document access-token lifetime, refresh rotation, revocation, and storage before implementation.

## 4. Students and staff

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/students` | Student read permission | Paginated/filterable listing |
| POST | `/students` | Student create | Admission |
| GET | `/students/:id` | Student read + scope check | Details |
| PATCH | `/students/:id` | Student update + scope check | Update |
| POST | `/students/:id/archive` | Student archive | Archive record |
| GET | `/students/:id/fee-ledger` | Fee read + scope check | Ledger |
| GET | `/courses` | Course read | List courses |
| POST | `/courses` | Course manage | Create course |
| PATCH | `/courses/:id` | Course manage | Update course |
| GET | `/batches` | Batch read | List batches |
| POST | `/batches` | Batch manage | Create batch |
| PATCH | `/batches/:id` | Batch manage | Update batch |
| POST | `/enrollments` | Enrollment manage | Enroll student |
| GET | `/enrollments/:id` | Enrollment read + scope | Enrollment detail |
| PATCH | `/enrollments/:id` | Enrollment manage | Update status/agreement |

Use dedicated staff/user management endpoints for creating staff accounts and assigning permissions. Student CRUD permissions do not imply staff role-management permissions.

## 5. Attendance

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/attendance/sessions` | Session manage | Create class session |
| GET | `/attendance/sessions` | Attendance read | List/filter sessions |
| GET | `/attendance/sessions/:id` | Attendance read | Session detail/roster |
| POST | `/attendance/sessions/:id/open` | Session manage | Open marking window |
| POST | `/attendance/sessions/:id/finalize` | Session finalize | Finalize attendance |
| POST | `/attendance/scan` | Attendance mark | Validate QR and mark |
| POST | `/attendance/manual` | Attendance mark | Mark by student number |
| PATCH | `/attendance/records/:id` | Attendance correction | Correct with reason |
| GET | `/attendance/reports` | Attendance report | Summary/report |

Example QR scan request:
```json
{
  "sessionId": "uuid",
  "qrToken": "opaque-random-token",
  "idempotencyKey": "client-generated-unique-key"
}
```

Example manual request:
```json
{
  "sessionId": "uuid",
  "studentNumber": "STU-000123",
  "status": "PRESENT"
}
```

The server must validate session state, enrollment, batch relationship, token status/expiry if applicable, permissions, and duplicate status. Do not accept a client-supplied student ID as proof of identity.

## 6. Fees and payments

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/fee-plans` | Fee plan read | List fee plans |
| POST | `/fee-plans` | Fee plan manage | Create plan |
| POST | `/invoices` | Invoice create | Create invoice/installment |
| GET | `/invoices` | Invoice read + scope | List invoices |
| GET | `/invoices/:id` | Invoice read + scope | Invoice detail |
| POST | `/payments` | Payment receive | Record payment |
| GET | `/payments` | Payment read + scope | List payments |
| GET | `/payments/:id` | Payment read + scope | Payment detail |
| POST | `/payments/:id/reverse` | Payment reversal permission | Request/record reversal |
| GET | `/payments/:id/receipt` | Receipt read + scope | Download/print receipt |
| GET | `/reports/fees/collections` | Fee report | Collection report |
| GET | `/reports/fees/outstanding` | Fee report | Outstanding balances |

Payment creation must require an idempotency key. The server recalculates totals and balances; it never trusts a client-calculated outstanding amount. Record method, received-by, timestamp, amount, currency, reference, and allocation. Refund/reversal must enforce approval policy and cumulative limits.

## 7. Certificates

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/certificates/issue` | Certificate issue | Issue PDF and metadata |
| GET | `/certificates` | Certificate read + scope | List |
| GET | `/certificates/:id` | Certificate read + scope | Details |
| GET | `/certificates/:id/download` | Own certificate or staff permission | Authorized PDF |
| POST | `/certificates/:id/revoke` | Certificate revoke | Revoke with reason |
| GET | `/public/certificates/verify/:code` | Public, rate-limited | Verify status |

Public verification should return only status, certificate number, course, issue date, and approved identity information (e.g. student name only if institute policy approves). It must not return address, phone, fee data, login identifiers, or private file storage keys.

## 8. Student self-service

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/me/profile` | Student | Own profile |
| PATCH | `/me/profile` | Student, field allowlist | Update permitted fields |
| GET | `/me/enrollments` | Student | Own enrollments |
| GET | `/me/attendance` | Student | Own attendance |
| GET | `/me/fees` | Student | Own invoices/balances |
| GET | `/me/receipts` | Student | Own receipts |
| GET | `/me/certificates` | Student | Own certificates |
| GET | `/me/announcements` | Student | Audience-filtered announcements |
| GET | `/me/notifications` | Student | Own notifications |
| PATCH | `/me/notifications/:id/read` | Student | Mark own notification read |

The server derives the student identity from the authenticated account. Do not accept `studentId` as a query parameter for self-service access.

## 9. Reports, settings, and audit

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/reports/admissions` | Admin/report permission | Admissions |
| GET | `/reports/attendance` | Admin/report permission | Attendance |
| GET | `/reports/fees` | Admin/report permission | Financial summaries |
| GET | `/reports/completions` | Admin/report permission | Completion |
| GET | `/settings` | Settings read | Institute settings |
| PATCH | `/settings` | Super Admin | Update settings |
| GET | `/audit-logs` | Audit read | Filtered audit history |
| GET | `/announcements` | Audience/role scope | List announcements |
| POST | `/announcements` | Announcement manage | Publish announcement |

## 10. Standard status codes

- `200 OK`: successful read/update/action.
- `201 Created`: resource created.
- `204 No Content`: successful action with no response body.
- `400 Bad Request`: malformed request.
- `401 Unauthorized`: unauthenticated.
- `403 Forbidden`: insufficient permission.
- `404 Not Found`: resource not found or intentionally concealed for privacy.
- `409 Conflict`: duplicate, invalid state transition, or idempotency conflict.
- `422 Unprocessable Entity`: validation/business-rule failure, if adopted consistently.
- `429 Too Many Requests`: rate limit.
- `500 Internal Server Error`: generic unexpected failure.

## 11. API implementation checklist

- OpenAPI document generated/maintained with schemas and auth requirements.
- Request validation and response serialization.
- Pagination and maximum page sizes.
- Allowlisted sort fields.
- Rate limiting and request IDs.
- Consistent error middleware.
- Audit events for sensitive actions.
- Authorization tests for each role and record scope.
- Idempotency and transaction tests for payments and attendance.
