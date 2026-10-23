/**
 * Domain constants shared by the API and the web client.
 * These values are mirrored by PostgreSQL enums in `apps/api/prisma/schema.prisma`.
 */

export const ROLES = ['SUPER_ADMIN', 'FRONT_DESK', 'STUDENT'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: readonly Role[] = ['SUPER_ADMIN', 'FRONT_DESK'];

export const USER_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN', 'ARCHIVED'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const COURSE_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const BATCH_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const ENROLLMENT_STATUSES = ['PENDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const SESSION_STATUSES = ['SCHEDULED', 'OPEN', 'FINALIZED', 'CANCELLED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_METHODS = ['MANUAL', 'QR'] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const INVOICE_STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'JAZZCASH', 'EASYPAISA', 'CHEQUE', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['POSTED', 'PARTIALLY_REVERSED', 'REVERSED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ASSESSMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const RESULT_STATUSES = ['PASS', 'FAIL', 'ABSENT'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const CERTIFICATE_STATUSES = ['ISSUED', 'REVOKED'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const ANNOUNCEMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const AUDIENCES = ['EVERYONE', 'STUDENTS', 'STAFF'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const DURATION_UNITS = ['WEEKS', 'MONTHS'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    requestId: string;
  };
}
