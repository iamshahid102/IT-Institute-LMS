import type { AttendanceStatus, Role, SessionStatus } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/utils/crypto';

export const TEST_PASSWORD = 'TestPass#12345';

let sequence = 0;
function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}-${process.pid}-${sequence}`;
}

export const daysFromNow = (days: number): Date => {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

export async function createUser(options: {
  role: Role;
  email?: string;
  password?: string;
  status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';
  fullName?: string;
  studentId?: string;
}) {
  return prisma.user.create({
    data: {
      email: options.email ?? `${unique('user')}@institute.test`,
      passwordHash: await hashPassword(options.password ?? TEST_PASSWORD),
      fullName: options.fullName ?? `${options.role} User`,
      role: options.role,
      status: options.status ?? 'ACTIVE',
      ...(options.studentId ? { student: { connect: { id: options.studentId } } } : {}),
    },
  });
}

export async function createCourse(overrides: { code?: string; title?: string } = {}) {
  return prisma.course.create({
    data: {
      code: overrides.code ?? unique('CRS').toUpperCase(),
      title: overrides.title ?? 'Full Stack Web Development',
      durationValue: 12,
      durationUnit: 'WEEKS',
      status: 'ACTIVE',
    },
  });
}

export async function createBatch(
  courseId: string,
  overrides: { code?: string; status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' } = {},
) {
  return prisma.batch.create({
    data: {
      courseId,
      code: overrides.code ?? unique('BAT').toUpperCase(),
      name: 'Weekday Morning Batch',
      startDate: daysFromNow(-30),
      endDate: daysFromNow(30),
      capacity: 30,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

export async function createStudent(
  overrides: {
    fullName?: string;
    studentNumber?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'WITHDRAWN' | 'ARCHIVED';
    userId?: string;
  } = {},
) {
  return prisma.student.create({
    data: {
      studentNumber: overrides.studentNumber ?? unique('STU').toUpperCase(),
      fullName: overrides.fullName ?? 'Test Student',
      guardianName: 'Test Guardian',
      phone: '+92 300 5550000',
      email: `${unique('student')}@student.test`,
      admissionDate: daysFromNow(-30),
      status: overrides.status ?? 'ACTIVE',
      ...(overrides.userId ? { userId: overrides.userId } : {}),
    },
  });
}

/** Creates a student record plus the linked STUDENT portal account. */
export async function createStudentWithAccount(
  overrides: { fullName?: string; email?: string; password?: string } = {},
) {
  const student = await createStudent({ fullName: overrides.fullName ?? 'Portal Student' });
  const user = await createUser({
    role: 'STUDENT',
    email: overrides.email,
    password: overrides.password,
    fullName: student.fullName,
    studentId: student.id,
  });
  return { student, user };
}

export async function createEnrollment(options: {
  studentId: string;
  batchId: string;
  status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN' | 'SUSPENDED';
  agreedFeeMinor?: number;
  joinedAt?: Date;
  completedAt?: Date | null;
}) {
  return prisma.enrollment.create({
    data: {
      studentId: options.studentId,
      batchId: options.batchId,
      joinedAt: options.joinedAt ?? daysFromNow(-25),
      completedAt: options.completedAt ?? null,
      status: options.status ?? 'ACTIVE',
      agreedFeeMinor: options.agreedFeeMinor ?? 50_000_00,
    },
  });
}

export async function createSession(options: {
  batchId: string;
  startsAt?: Date;
  endsAt?: Date;
  status?: SessionStatus;
  topic?: string;
}) {
  const startsAt = options.startsAt ?? daysFromNow(-1);
  return prisma.classSession.create({
    data: {
      batchId: options.batchId,
      startsAt,
      endsAt: options.endsAt ?? new Date(startsAt.getTime() + 90 * 60 * 1000),
      status: options.status ?? 'SCHEDULED',
      topic: options.topic ?? 'Introduction',
    },
  });
}

export async function createAttendanceRecord(options: {
  sessionId: string;
  enrollmentId: string;
  status: AttendanceStatus;
  markedById: string;
}) {
  return prisma.attendanceRecord.create({
    data: {
      sessionId: options.sessionId,
      enrollmentId: options.enrollmentId,
      status: options.status,
      markedById: options.markedById,
      method: 'MANUAL',
    },
  });
}

export async function createPayment(options: {
  invoiceId: string;
  receivedById: string;
  amountMinor: number;
  method?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'JAZZCASH' | 'EASYPAISA' | 'CHEQUE' | 'OTHER';
}) {
  return prisma.payment.create({
    data: {
      paymentNumber: unique('RCPT').toUpperCase(),
      invoiceId: options.invoiceId,
      amountMinor: options.amountMinor,
      method: options.method ?? 'CASH',
      receivedById: options.receivedById,
    },
  });
}

export async function createCertificate(options: {
  enrollmentId: string;
  issuedById: string;
  status?: 'ISSUED' | 'REVOKED';
}) {
  return prisma.certificate.create({
    data: {
      certificateNumber: unique('CERT').toUpperCase(),
      verificationCode: unique('verifycode'),
      enrollmentId: options.enrollmentId,
      issuedById: options.issuedById,
      status: options.status ?? 'ISSUED',
      storageKey: `certificates/${unique('missing')}.pdf`,
      contentHash: 'test-content-hash',
    },
  });
}

export async function createInvoice(options: {
  enrollmentId: string;
  createdById: string;
  totalMinor: number;
  dueAt?: Date;
  items?: Array<{ description: string; unitAmountMinor: number; quantity?: number }>;
}) {
  const items = options.items ?? [
    { description: 'Tuition fee', unitAmountMinor: options.totalMinor, quantity: 1 },
  ];
  return prisma.invoice.create({
    data: {
      invoiceNumber: unique('INV').toUpperCase(),
      enrollmentId: options.enrollmentId,
      issuedAt: daysFromNow(-5),
      dueAt: options.dueAt ?? daysFromNow(10),
      subtotalMinor: options.totalMinor,
      discountMinor: 0,
      totalMinor: options.totalMinor,
      createdById: options.createdById,
      items: {
        create: items.map((item) => ({
          description: item.description,
          quantity: item.quantity ?? 1,
          unitAmountMinor: item.unitAmountMinor,
          lineTotalMinor: (item.quantity ?? 1) * item.unitAmountMinor,
          itemType: 'TUITION',
        })),
      },
    },
  });
}
