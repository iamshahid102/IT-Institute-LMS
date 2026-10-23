# Decisions and Open Questions

**Purpose:** Resolve these items before schema freeze and implementation. Suggested defaults are recommendations, not approved facts.

## A. Business decisions

| ID | Question | Suggested default | Decision |
|---|---|---|---|
| D-01 | Institute currency? | PKR | Pending |
| D-02 | Institute time zone? | Asia/Karachi | Pending |
| D-03 | One branch or multiple? | One branch in MVP | Pending |
| D-04 | Student login identifier? | Email or staff-created username; decide if student number login is needed | Pending |
| D-05 | Can students have no email? | Yes, if username/student-number login and recovery policy are defined | Pending |
| D-06 | Who creates student accounts? | Staff only; no public registration | Pending |
| D-07 | Attendance statuses? | Present, Absent, Late, Excused | Pending |
| D-08 | Does Late count as present? | Configurable; default exclude from present count but report separately until approved | Pending |
| D-09 | Does Excused count in attendance denominator? | Exclude from denominator if approved policy says excused sessions are waived | Pending |
| D-10 | Attendance eligibility? | Only finalized, non-cancelled sessions | Pending |
| D-11 | Fee plan model? | Enrollment-specific agreed fee, with optional reusable fee-plan template | Pending |
| D-12 | Are partial payments allowed? | Yes | Pending |
| D-13 | Can one payment cover multiple invoices? | No in simplest MVP; allow only if required | Pending |
| D-14 | How are refunds/discounts approved? | Super Admin permission; reason required | Pending |
| D-15 | Is online payment required at launch? | No; manual recording first | Pending |
| D-16 | Certificate completion criteria? | Enrollment completed + required assessment/attendance/fee checks as institute policy defines | Pending |
| D-17 | Can a certificate be reissued? | Keep a traceable issue/reissue history; never overwrite silently | Pending |
| D-18 | What public certificate fields are visible? | Certificate number, course, issue date, status; student name only if approved | Pending |
| D-19 | Need instructor login in MVP? | No; staff-managed instructor profile only | Pending |
| D-20 | Need online quizzes/exams? | No; assessment/result entry only or defer entirely | Pending |
| D-21 | Need SMS/WhatsApp? | No; in-app notifications first | Pending |
| D-22 | Student data retention policy? | Define with institute and applicable law before production | Pending |
| D-23 | Backup RPO/RTO? | Start with daily backup and tested restore; confirm acceptable data loss/downtime | Pending |
| D-24 | Student ID format? | `STU-YYYY-000001` or another configurable format | Pending |
| D-25 | Receipt and certificate template? | Institute supplies branding, legal text, signatory | Pending |

## B. Technical decisions

- Authentication: server-side sessions with secure cookies recommended; confirm before implementation.
- Database hosting: managed PostgreSQL; Supabase is an option.
- File storage: private S3-compatible storage or Supabase Storage; select provider before certificate implementation.
- Hosting: Next.js on Vercel or equivalent; Express on a Node-compatible host.
- Monorepo: recommended `apps/web`, `apps/api`, optional `packages/shared`.
- PWA library: select and verify compatibility with the chosen Next.js version.
- Email provider: choose only if password reset/email notifications are required.
- Logging/monitoring provider: select before production.
- Payment gateway: select only if online payments become in scope.

## C. Approval record

- Product owner:
- Technical owner:
- PRD approved on:
- SRS approved on:
- Database schema approved on:
- API contract approved on:
- Security requirements approved on:
- MVP scope approved on:
- Remaining blockers:
