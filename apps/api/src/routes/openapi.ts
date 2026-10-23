const errorResponse = {
  description: 'Error response with a stable code and request ID',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const unauthorized = { ...errorResponse, description: 'Authentication required (401)' };
const forbidden = { ...errorResponse, description: 'Insufficient permission (403)' };
const notFound = { ...errorResponse, description: 'Record not found (404)' };
const conflict = { ...errorResponse, description: 'Duplicate or invalid state transition (409)' };

function listOp(summary: string, tag: string, permission: string) {
  return {
    tags: [tag],
    summary,
    security: [{ sessionCookie: [] }],
    description: `Requires the \`${permission}\` permission.`,
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
    ],
    responses: {
      200: { description: 'Paginated list' },
      401: unauthorized,
      403: forbidden,
    },
  };
}

export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'IT Institute LMS API',
    version: '1.0.0',
    description:
      'REST API for the IT Institute LMS. Cookie session authentication with a double-submit CSRF token (X-CSRF-Token header) required on unsafe methods.',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'Auth' },
    { name: 'Students' },
    { name: 'Academics' },
    { name: 'Attendance' },
    { name: 'Fees' },
    { name: 'Assessments' },
    { name: 'Certificates' },
    { name: 'Portal' },
    { name: 'Reports' },
    { name: 'Administration' },
  ],
  components: {
    securitySchemes: {
      sessionCookie: { type: 'apiKey', in: 'cookie', name: 'lms_session' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { field: { type: 'string' }, message: { type: 'string' } },
                },
              },
              requestId: { type: 'string' },
            },
            required: ['code', 'message', 'requestId'],
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    '/auth/csrf': {
      get: {
        tags: ['Auth'],
        summary: 'Issue/read the CSRF token (also sets the readable lms_csrf cookie)',
        responses: { 200: { description: 'CSRF token' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in (rate limited; sets the HttpOnly session cookie)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Signed in' }, 400: errorResponse, 401: unauthorized, 429: errorResponse },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the current session',
        security: [{ sessionCookie: [] }],
        responses: { 204: { description: 'Signed out' }, 401: unauthorized },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user, role and permissions',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Current user' }, 401: unauthorized },
      },
    },
    '/auth/change-password': {
      patch: {
        tags: ['Auth'],
        summary: 'Change the current password and rotate the session',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Password changed' }, 400: errorResponse, 401: unauthorized },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset (generic response, rate limited)',
        responses: { 200: { description: 'Accepted' }, 429: errorResponse },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Complete a password reset with a single-use token',
        responses: { 200: { description: 'Password reset' }, 400: errorResponse },
      },
    },
    '/students': {
      get: listOp('List students', 'Students', 'student.read'),
      post: {
        tags: ['Students'],
        summary: 'Admit a student (allocates a unique student number)',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden, 409: conflict },
      },
    },
    '/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Student detail with enrollments and fee summary',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Student' }, 401: unauthorized, 404: notFound },
      },
      patch: {
        tags: ['Students'],
        summary: 'Update permitted student fields',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Updated' }, 401: unauthorized, 403: forbidden, 404: notFound },
      },
    },
    '/students/{id}/archive': {
      post: {
        tags: ['Students'],
        summary: 'Archive a student record (history preserved)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Archived' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/students/{id}/fee-ledger': {
      get: {
        tags: ['Students', 'Fees'],
        summary: 'Student fee ledger',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Ledger' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/courses': {
      get: listOp('List courses', 'Academics', 'course.read'),
      post: {
        tags: ['Academics'],
        summary: 'Create a course',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden, 409: conflict },
      },
    },
    '/courses/{id}': {
      patch: {
        tags: ['Academics'],
        summary: 'Update a course',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Updated' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/instructors': {
      get: listOp('List instructors', 'Academics', 'instructor.read'),
      post: {
        tags: ['Academics'],
        summary: 'Create an instructor profile',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/batches': {
      get: listOp('List batches', 'Academics', 'batch.read'),
      post: {
        tags: ['Academics'],
        summary: 'Create a batch with schedules',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden, 409: conflict },
      },
    },
    '/batches/{id}': {
      get: {
        tags: ['Academics'],
        summary: 'Batch detail with roster and recent sessions',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Batch' }, 401: unauthorized, 404: notFound },
      },
      patch: {
        tags: ['Academics'],
        summary: 'Update a batch, schedule or capacity',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Updated' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/enrollments': {
      get: listOp('List enrollments', 'Academics', 'enrollment.read'),
      post: {
        tags: ['Academics'],
        summary: 'Enroll a student in a batch with an agreed fee',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden, 409: conflict, 422: errorResponse },
      },
    },
    '/enrollments/{id}': {
      get: {
        tags: ['Academics'],
        summary: 'Enrollment detail with attendance and fee summary',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Enrollment' }, 401: unauthorized, 404: notFound },
      },
      patch: {
        tags: ['Academics'],
        summary: 'Change enrollment status or fee agreement',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Updated' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/attendance/sessions': {
      get: listOp('List class sessions', 'Attendance', 'attendance.read'),
      post: {
        tags: ['Attendance'],
        summary: 'Create a class session',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden, 409: conflict },
      },
    },
    '/attendance/sessions/{id}': {
      get: {
        tags: ['Attendance'],
        summary: 'Session roster with attendance records',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Session' }, 401: unauthorized, 404: notFound },
      },
    },
    '/attendance/sessions/{id}/open': {
      post: {
        tags: ['Attendance'],
        summary: 'Open a session for marking',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Opened' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/attendance/sessions/{id}/finalize': {
      post: {
        tags: ['Attendance'],
        summary: 'Finalize attendance (unmarked students become absent)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Finalized' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/attendance/scan': {
      post: {
        tags: ['Attendance'],
        summary: 'Mark attendance from a scanned student QR token',
        security: [{ sessionCookie: [] }],
        responses: {
          200: { description: 'Marked' },
          401: unauthorized,
          403: forbidden,
          409: conflict,
          422: errorResponse,
        },
      },
    },
    '/attendance/manual': {
      post: {
        tags: ['Attendance'],
        summary: 'Mark attendance by student number',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Marked' }, 401: unauthorized, 403: forbidden, 409: conflict, 422: errorResponse },
      },
    },
    '/attendance/records/{id}': {
      patch: {
        tags: ['Attendance'],
        summary: 'Correct a finalized attendance record (reason required, audited)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Corrected' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/attendance/reports': {
      get: {
        tags: ['Attendance', 'Reports'],
        summary: 'Attendance report by batch or student',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Report' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/fee-plans': {
      get: {
        tags: ['Fees'],
        summary: 'List reusable fee plans',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Plans' }, 401: unauthorized, 403: forbidden },
      },
      post: {
        tags: ['Fees'],
        summary: 'Create a fee plan',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/invoices': {
      get: listOp('List invoices', 'Fees', 'fee.invoice.read'),
      post: {
        tags: ['Fees'],
        summary: 'Create an invoice with server-computed totals',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/invoices/plan': {
      post: {
        tags: ['Fees'],
        summary: 'Generate an installment schedule from the agreed fee',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/invoices/{id}': {
      get: {
        tags: ['Fees'],
        summary: 'Invoice detail with payments and balance',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Invoice' }, 401: unauthorized, 404: notFound },
      },
    },
    '/payments': {
      get: listOp('List payments', 'Fees', 'fee.invoice.read'),
      post: {
        tags: ['Fees'],
        summary: 'Post a payment (requires Idempotency-Key header)',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 8 } },
        ],
        responses: {
          201: { description: 'Posted (or replayed for a duplicate key)' },
          400: errorResponse,
          401: unauthorized,
          403: forbidden,
          409: errorResponse,
          422: errorResponse,
        },
      },
    },
    '/payments/{id}': {
      get: {
        tags: ['Fees'],
        summary: 'Payment detail',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Payment' }, 401: unauthorized, 404: notFound },
      },
    },
    '/payments/{id}/reverse': {
      post: {
        tags: ['Fees'],
        summary: 'Reverse a posted payment (Super Admin, reason required)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Reversed' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/payments/{id}/receipt': {
      get: {
        tags: ['Fees'],
        summary: 'Download the payment receipt PDF',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'PDF', content: { 'application/pdf': {} } }, 404: notFound },
      },
    },
    '/assessments': {
      get: listOp('List assessments', 'Assessments', 'assessment.read'),
      post: {
        tags: ['Assessments'],
        summary: 'Create an assessment',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/assessments/{id}/results': {
      put: {
        tags: ['Assessments'],
        summary: 'Record or update assessment results',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Saved' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/certificates': {
      get: listOp('List certificates', 'Certificates', 'certificate.read'),
    },
    '/certificates/eligibility/{id}': {
      get: {
        tags: ['Certificates'],
        summary: 'Eligibility checklist for an enrollment',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Eligibility' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/certificates/issue': {
      post: {
        tags: ['Certificates'],
        summary: 'Issue a certificate PDF for an eligible completed enrollment',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Issued' }, 401: unauthorized, 403: forbidden, 409: conflict, 422: errorResponse },
      },
    },
    '/certificates/{id}/download': {
      get: {
        tags: ['Certificates'],
        summary: 'Download a certificate PDF (staff permission)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'PDF', content: { 'application/pdf': {} } }, 404: notFound },
      },
    },
    '/certificates/{id}/revoke': {
      post: {
        tags: ['Certificates'],
        summary: 'Revoke a certificate with a reason',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Revoked' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/public/certificates/verify/{code}': {
      get: {
        tags: ['Certificates'],
        summary: 'Public certificate verification (rate limited, minimum disclosure)',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Certificate status' }, 404: notFound, 429: errorResponse },
      },
    },
    '/me/profile': {
      get: {
        tags: ['Portal'],
        summary: 'Own profile (identity derived from the session)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Profile' }, 401: unauthorized },
      },
      patch: {
        tags: ['Portal'],
        summary: 'Update permitted profile fields (phone, address)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Updated' }, 400: errorResponse, 401: unauthorized },
      },
    },
    '/me/enrollments': {
      get: {
        tags: ['Portal'],
        summary: 'Own enrollments, schedules and per-enrollment summaries',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Enrollments' }, 401: unauthorized },
      },
    },
    '/me/attendance': {
      get: {
        tags: ['Portal'],
        summary: 'Own attendance history and percentages',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Attendance' }, 401: unauthorized },
      },
    },
    '/me/attendance/qr': {
      post: {
        tags: ['Portal'],
        summary: 'Issue a short-lived personal attendance QR token',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Token' }, 401: unauthorized },
      },
    },
    '/me/fees': {
      get: {
        tags: ['Portal'],
        summary: 'Own fee ledger and balance',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Ledger' }, 401: unauthorized },
      },
    },
    '/me/receipts': {
      get: {
        tags: ['Portal'],
        summary: 'Own payment receipts',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Receipts' }, 401: unauthorized },
      },
    },
    '/me/receipts/{id}/download': {
      get: {
        tags: ['Portal'],
        summary: 'Download own receipt PDF (ownership enforced)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'PDF' }, 404: notFound },
      },
    },
    '/me/certificates': {
      get: {
        tags: ['Portal'],
        summary: 'Own certificates',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Certificates' }, 401: unauthorized },
      },
    },
    '/me/certificates/{id}/download': {
      get: {
        tags: ['Portal'],
        summary: 'Download own issued certificate (ownership enforced)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'PDF' }, 404: notFound, 409: errorResponse },
      },
    },
    '/me/announcements': {
      get: {
        tags: ['Portal'],
        summary: 'Announcements visible to the student',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Announcements' }, 401: unauthorized },
      },
    },
    '/me/notifications': {
      get: {
        tags: ['Portal'],
        summary: 'Own notifications',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Notifications' }, 401: unauthorized },
      },
    },
    '/reports/admissions': {
      get: {
        tags: ['Reports'],
        summary: 'Admissions report (format=csv for export)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Report' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/reports/attendance': {
      get: {
        tags: ['Reports'],
        summary: 'Attendance report',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Report' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/reports/fees/collections': {
      get: {
        tags: ['Reports'],
        summary: 'Fee collections report (financial permission, format=csv)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Report' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/reports/fees/outstanding': {
      get: {
        tags: ['Reports'],
        summary: 'Outstanding and overdue balances (format=csv)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Report' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/reports/completions': {
      get: {
        tags: ['Reports'],
        summary: 'Course completions and certificate status',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Report' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/dashboards/admin': {
      get: {
        tags: ['Reports'],
        summary: 'Super Admin dashboard metrics',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Metrics' }, 403: forbidden },
      },
    },
    '/dashboards/front-desk': {
      get: {
        tags: ['Reports'],
        summary: 'Front Desk dashboard metrics',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Metrics' }, 403: forbidden },
      },
    },
    '/settings': {
      get: {
        tags: ['Administration'],
        summary: 'Institute settings',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Settings' }, 401: unauthorized },
      },
      patch: {
        tags: ['Administration'],
        summary: 'Update institute settings (Super Admin)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Updated' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/users': {
      get: listOp('List staff accounts', 'Administration', 'user.manage'),
      post: {
        tags: ['Administration'],
        summary: 'Create a staff account (Super Admin only)',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden, 409: conflict },
      },
    },
    '/users/{id}': {
      patch: {
        tags: ['Administration'],
        summary: 'Update staff role or account status',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Updated' }, 401: unauthorized, 403: forbidden, 422: errorResponse },
      },
    },
    '/users/{id}/reset-link': {
      post: {
        tags: ['Administration'],
        summary: 'Issue a one-time password reset link (audited)',
        security: [{ sessionCookie: [] }],
        responses: { 200: { description: 'Link' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/announcements': {
      get: listOp('List announcements', 'Administration', 'announcement.read'),
      post: {
        tags: ['Administration'],
        summary: 'Create and optionally publish an announcement',
        security: [{ sessionCookie: [] }],
        responses: { 201: { description: 'Created' }, 401: unauthorized, 403: forbidden },
      },
    },
    '/audit-logs': {
      get: listOp('List audit events', 'Administration', 'audit.read'),
    },
  },
};
