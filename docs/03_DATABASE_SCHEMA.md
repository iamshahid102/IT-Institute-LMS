# Database Schema and Data Model

**Database:** PostgreSQL  
**ORM:** Prisma  
**Version:** 0.1 — Draft for approval

## 1. Modeling principles

- Use UUID primary keys for internal entity IDs.
- Use human-readable unique numbers for student IDs, invoices, receipts, and certificates.
- Use foreign keys and database constraints; application validation alone is insufficient.
- Use `createdAt`/`updatedAt` where appropriate, plus actor fields on important records.
- Use UTC timestamps; use the institute's configured time zone for schedule interpretation and display.
- Use integer minor units (PKR paisa) or PostgreSQL `Decimal` for money. Never use floating-point money.
- Prefer archival/status fields over deleting records with academic/financial history.
- Consider PostgreSQL enums or Prisma enums for stable status values; use lookup tables when administrators need to configure values.

## 2. Core entities

### User
- `id UUID PK`
- `email` unique (nullable only if approved)
- `passwordHash` (omit if an external identity provider is used)
- `role` or role/permission relation
- `status`: ACTIVE, INVITED, SUSPENDED, DISABLED
- `lastLoginAt`, `createdAt`, `updatedAt`

### Student
- `id UUID PK`
- `userId UUID FK users.id`, unique, nullable until portal account is created if approved
- `studentNumber` unique, non-reusable
- `fullName`, `guardianName`, `phone`, optional `email`, `address`, `dateOfBirth`, `photoStorageKey`
- `admissionDate`, `status`, `createdAt`, `updatedAt`, `archivedAt`

Student profile and authentication account are separate concepts. Do not store plaintext passwords in the student table.

### Instructor
- `id UUID PK`
- optional `userId FK users.id`
- `fullName`, `email`, `phone`, `status`, timestamps

### Course
- `id UUID PK`
- `code` unique
- `title`, `description`, `durationValue`, `durationUnit`
- optional `defaultFeeMinor`
- `status`: DRAFT, ACTIVE, ARCHIVED

### Batch
- `id UUID PK`
- `courseId FK courses.id`
- `instructorId FK instructors.id`, nullable
- `code` unique, `name`, `startDate`, `endDate`, `capacity`
- `status`: PLANNED, ACTIVE, COMPLETED, CANCELLED

### BatchSchedule
- `id UUID PK`
- `batchId FK batches.id`
- `dayOfWeek`, `startTime`, `endTime`, optional `room`
- Define how holidays and one-off schedule overrides are represented before implementation.

### Enrollment
- `id UUID PK`
- `studentId FK students.id`
- `batchId FK batches.id`
- `joinedAt`, optional `completedAt`
- `status`: PENDING, ACTIVE, COMPLETED, WITHDRAWN, SUSPENDED
- `agreedFeeMinor`, `currency`
- `createdAt`, `updatedAt`
- Decide whether re-enrollment into the same batch is permitted; if not, add a suitable unique constraint or enforce an explicit re-enrollment policy.

### ClassSession
- `id UUID PK`
- `batchId FK batches.id`
- `startsAt`, `endsAt`
- `status`: SCHEDULED, OPEN, FINALIZED, CANCELLED
- `openedBy`, `finalizedBy`, timestamps
- Store a date/time representation that handles institute time zone and daylight-saving rules correctly.

### AttendanceRecord
- `id UUID PK`
- `sessionId FK class_sessions.id`
- `enrollmentId FK enrollments.id`
- `status`: PRESENT, ABSENT, LATE, EXCUSED
- `markedAt`, `markedBy FK users.id`, optional `remarks`
- `correctionReason`, optional `correctedAt`, `correctedBy`
- Unique constraint: `(sessionId, enrollmentId)`

### FeePlan
- `id UUID PK`
- `name`, optional `courseId`
- `currency`, `active`
- Reusable defaults; the enrollment's agreed fee is the source of truth after admission.

### Invoice
- `id UUID PK`
- `invoiceNumber` unique
- `enrollmentId FK enrollments.id`
- `issuedAt`, `dueAt`, `status`
- `currency`, `subtotalMinor`, `discountMinor`, `totalMinor`
- Avoid treating a mutable invoice total as the only audit source; preserve invoice items and approved adjustments.

### InvoiceItem
- `id UUID PK`
- `invoiceId FK invoices.id`
- `description`, `quantity`, `unitAmountMinor`, `lineTotalMinor`, `itemType`
- Define rounding and discount allocation rules.

### Payment
- `id UUID PK`
- `paymentNumber` unique
- `amountMinor`, `currency`, `method`, `status`
- `reference` optional with a unique constraint when present
- `receivedAt`, `receivedBy FK users.id`
- `idempotencyKey` or a separate idempotency table
- Do not physically delete posted payments.

### PaymentAllocation
- `id UUID PK`
- `paymentId FK payments.id`
- `invoiceId FK invoices.id`
- `allocatedAmountMinor`
- Supports one payment being allocated across invoices, if the business approves this behavior.

### PaymentReversal
- `id UUID PK`
- `paymentId FK payments.id`
- `amountMinor`, `reason`, `status`, `createdBy`, `approvedBy`, `createdAt`
- Model partial refunds/reversals explicitly; ensure cumulative reversals cannot exceed the original successful payment.

### Assessment
- `id UUID PK`
- `courseId` or `batchId` FK
- `title`, `maxMarks`, `passMarks`, `assessmentDate`, `status`

### AssessmentResult
- `id UUID PK`
- `assessmentId FK assessments.id`
- `enrollmentId FK enrollments.id`
- `marksObtained`, `status`, optional `remarks`
- Unique constraint `(assessmentId, enrollmentId)`

### Certificate
- `id UUID PK`
- `certificateNumber` unique
- `verificationCode` unique, random and unguessable
- `enrollmentId FK enrollments.id`
- `status`: DRAFT, ISSUED, REVOKED
- `issuedAt`, `issuedBy`, `revokedAt`, `revokedBy`, `revocationReason`
- `storageKey`, `templateVersion`, optional `contentHash`
- Preserve metadata and audit history on revocation.

### QRToken
- `id UUID PK`
- `tokenHash` unique; do not store reusable raw tokens if avoidable
- `studentId` and/or `enrollmentId` FK, depending on approved QR model
- `expiresAt`, `revokedAt`, `createdAt`
- Use random opaque identifiers. Do not embed personal/financial data in QR codes.

### Announcement, Notification, AuditLog, InstituteSetting
- Announcement: author, audience, content, publication window, status.
- Notification: recipient, type, payload with minimal data, readAt, createdAt.
- AuditLog: actor, action, entityType, entityId, timestamp, requestId, safe metadata.
- InstituteSetting: branding, time zone, currency, attendance policy, receipt/certificate settings.

### Auth/session support
- Session table if using server-side sessions: hashed session identifier, user, expiry, revokedAt, metadata with privacy limits.
- PasswordResetToken: hashed token, user, expiry, usedAt.
- IdempotencyRecord: key, actor, operation, request hash, result reference, expiry.

## 3. Relationship summary

- User 1:0..1 Student (portal identity).
- User 1:0..1 Instructor (if instructors log in).
- Course 1:N Batch.
- Batch 1:N Enrollment.
- Student 1:N Enrollment.
- Batch 1:N ClassSession.
- ClassSession 1:N AttendanceRecord.
- Enrollment 1:N AttendanceRecord.
- Enrollment 1:N Invoice.
- Invoice 1:N InvoiceItem.
- Payment N:M Invoice through PaymentAllocation, if cross-invoice allocation is enabled.
- Enrollment 1:N AssessmentResult.
- Enrollment 0:N Certificate, subject to reissue policy.

## 4. Critical integrity rules

1. Attendance record must reference an enrollment in the same batch as the class session. Enforce in service logic and, where practical, with database design/constraints.
2. Only one attendance record per enrollment per session.
3. Payment amount must be positive for normal payment entries; reversal is a separate model.
4. Sum of allocations cannot exceed the eligible payment amount; validate transactionally.
5. Sum of reversals cannot exceed the successful payment amount.
6. Invoice/payment balance calculations must be defined in one domain service and covered by tests.
7. Certificate issue requires a valid enrollment and approved eligibility checks.
8. Certificate revocation must not erase the original issue event.
9. Use transactions for payment posting, allocations, receipt creation, and certificate issue metadata.
10. Index foreign keys and common query filters, including student number, enrollment status, batch, session date, invoice due date, payment received date, and certificate number.
11. Audit logs should not contain passwords, session cookies, raw QR tokens, or unnecessary sensitive data.

## 5. Decisions required before schema freeze

- Can one student repeat the same course/batch?
- Can a payment be allocated to multiple invoices?
- Are invoices editable after issue, or must changes use credit/adjustment records?
- Are fees fixed at enrollment, or can installments be rescheduled?
- Is a student portal account created at admission or later?
- Can students have email-less accounts and log in using student number?
- Which attendance statuses count as present?
- What completion rules are required for certificates?
- Is multi-branch support required at launch?
