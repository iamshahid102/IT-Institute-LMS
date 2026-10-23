# UI/UX Specification

**Version:** 0.1 — Draft for approval  
**Design direction:** Professional, accessible, responsive education SaaS dashboard

## 1. Design principles

- Mobile-first responsive layouts.
- Clear hierarchy and low-friction daily workflows.
- Neutral light theme as the initial default; support dark mode only if it does not delay MVP.
- Use Tailwind CSS and shadcn/ui components consistently.
- Use accessible labels, keyboard focus, validation feedback, and sufficient contrast.
- Tables must have mobile alternatives such as stacked cards or controlled horizontal scrolling.
- Destructive and financial actions require clear confirmation.
- Show loading, empty, error, offline, success, and permission-denied states.

## 2. Application shell

### Staff shell
- Left sidebar on desktop; collapsible drawer on mobile.
- Header with page title, breadcrumbs, global search where useful, notifications, and user menu.
- Main content area with consistent spacing.
- Dashboard metric cards and charts only where they support decisions.
- Persistent role indicator for staff users.

### Student shell
- Compact navigation optimized for phone screens.
- Overview cards for course, attendance, and fee balance.
- Simple tabs/sections for Attendance, Fees, Receipts, Certificates, and Profile.
- Avoid exposing internal administrative actions.

## 3. Route map

### Public/auth
- `/login`
- `/forgot-password`
- `/reset-password`
- `/verify-certificate/[code]`
- `/privacy`
- `/terms`
- Optional `/` public institute landing page.

### Super Admin
- `/admin`
- `/admin/students`
- `/admin/students/new`
- `/admin/students/[id]`
- `/admin/students/[id]/edit`
- `/admin/courses`
- `/admin/batches`
- `/admin/instructors`
- `/admin/schedules`
- `/admin/attendance`
- `/admin/attendance/sessions`
- `/admin/attendance/scan`
- `/admin/attendance/reports`
- `/admin/fees`
- `/admin/fees/structures`
- `/admin/fees/payments`
- `/admin/fees/dues`
- `/admin/fees/receipts`
- `/admin/assessments`
- `/admin/certificates`
- `/admin/reports`
- `/admin/users`
- `/admin/announcements`
- `/admin/audit-logs`
- `/admin/settings`

### Front Desk Manager
- `/front-desk`
- `/front-desk/students`
- `/front-desk/students/new`
- `/front-desk/enrollments`
- `/front-desk/attendance`
- `/front-desk/attendance/scan`
- `/front-desk/attendance/manual`
- `/front-desk/fees`
- `/front-desk/fees/collect`
- `/front-desk/fees/receipts`
- `/front-desk/announcements`
- `/front-desk/reports`

### Student
- `/student`
- `/student/profile`
- `/student/courses`
- `/student/batches`
- `/student/attendance`
- `/student/fees`
- `/student/fees/ledger`
- `/student/fees/receipts`
- `/student/certificates`
- `/student/certificates/[id]`
- `/student/announcements`
- `/student/notifications`
- `/student/settings`

## 4. Required screen behavior

### Login and recovery
- Clear email/username and password fields based on approved login policy.
- Generic failure message to avoid account enumeration.
- Loading and rate-limit feedback.
- Password reset confirmation must not reveal whether an account exists.

### Student listing
- Search by student number/name/phone, subject to permissions.
- Filters for status, course, batch, admission date.
- Pagination, sortable allowlisted columns, and loading/empty/error states.
- Row actions follow permissions.
- Archive confirmation explains that historical records will remain.

### Student detail
Tabs: Overview, Enrollments, Attendance, Fees, Certificates, Activity.
- Display only permitted fields.
- Show linked records with clear status labels.
- Provide a compact mobile layout.
- Avoid exposing password/session data or internal security fields.

### Attendance session
- Choose batch/session and verify session is open.
- Scanner mode shows camera permission and clear scan feedback.
- Show matched student name/number and batch before confirming if needed by policy.
- Provide manual roll-number fallback.
- Distinguish successful, duplicate, invalid, inactive enrollment, closed session, and network error.
- Allow finalization only to authorized staff.
- Corrections require reason and are logged.

### Fee collection
- Search student/enrollment and select invoice/installment.
- Show server-calculated outstanding amount.
- Enter amount, method, reference, and notes as policy allows.
- Confirm amount and student before posting.
- Disable repeated submission while pending; still enforce idempotency server-side.
- Show receipt only after confirmed server success.
- Make reversal/refund separate from normal payment entry.

### Certificate management
- Show eligibility checklist and enrollment.
- Preview the certificate template before issue if practical.
- Issue action requires confirmation.
- Show issued/revoked status and audit information to authorized staff.
- Student download is only for own issued certificates.
- Public verification page has a minimal data disclosure design.

### Student dashboard
- Cards: current course/batch, attendance percentage, outstanding fee, recent receipt, certificates.
- Clear empty state when no enrollment or certificate exists.
- Show the date/time zone for schedules.
- Download actions work on mobile and provide a clear error state.

## 5. Shared components

- `AppSidebar`, `MobileNav`, `AppHeader`, `Breadcrumbs`
- `PageHeader`, `MetricCard`, `StatusBadge`
- `DataTable`, `DataTableToolbar`, `Pagination`
- `ConfirmDialog`, `FormField`, `FormErrorSummary`
- `EmptyState`, `ErrorState`, `LoadingSkeleton`, `OfflineBanner`
- `MoneyDisplay`, `DateTimeDisplay`
- `StudentSearch`, `EnrollmentSelector`
- `AttendanceScanner`, `AttendanceStatusControl`
- `FeeLedger`, `PaymentForm`, `ReceiptPreview`
- `CertificatePreview`, `CertificateDownload`
- `PermissionGate` for UX only; API remains the security boundary.

## 6. Form standards

- Use React Hook Form and Zod for client-side convenience; repeat authoritative validation on the API.
- Labels and help text must be explicit.
- Show field-level errors and a form-level summary when appropriate.
- Preserve safe non-sensitive form input after recoverable errors.
- Avoid placing personal or financial data in URLs.
- Require confirmation for archival, payment reversal, certificate issue/revocation, and other irreversible or high-impact actions.

## 7. Accessibility and responsive QA

- Keyboard navigation and visible focus.
- Correct heading order and accessible dialog behavior.
- Labels for icon-only buttons.
- Contrast meeting WCAG 2.2 AA targets where practical.
- Test at 360px mobile width, tablet, and desktop.
- Verify camera scanning and manual fallback on target Android browsers.
- Test reduced motion and zoomed text.
