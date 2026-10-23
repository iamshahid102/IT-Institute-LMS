import type { EnrollmentStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../utils/audit';
import { businessRule, conflict, notFound } from '../../utils/errors';
import { getEnrollmentAttendance } from '../attendance/attendance.stats';

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

const enrollmentInclude = {
  student: {
    select: {
      id: true,
      studentNumber: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
    },
  },
  batch: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      capacity: true,
      course: { select: { id: true, code: true, title: true, defaultFeeMinor: true } },
      instructor: { select: { id: true, fullName: true } },
    },
  },
};

function serialize(enrollment: {
  id: string;
  status: EnrollmentStatus;
  joinedAt: Date;
  completedAt: Date | null;
  agreedFeeMinor: number;
  currency: string;
  notes: string | null;
  createdAt: Date;
  student: { id: string; studentNumber: string; fullName: string; phone: string; email: string | null; status: string };
  batch: {
    id: string;
    code: string;
    name: string;
    status: string;
    startDate: Date;
    endDate: Date;
    capacity: number;
    course: { id: string; code: string; title: string; defaultFeeMinor: number | null };
    instructor: { id: string; fullName: string } | null;
  };
}) {
  return {
    id: enrollment.id,
    status: enrollment.status,
    joinedAt: enrollment.joinedAt,
    completedAt: enrollment.completedAt,
    agreedFeeMinor: enrollment.agreedFeeMinor,
    currency: enrollment.currency,
    notes: enrollment.notes,
    createdAt: enrollment.createdAt,
    student: enrollment.student,
    batch: enrollment.batch,
  };
}

async function assertCapacity(batchId: string): Promise<void> {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!batch) throw notFound('Batch not found.');
  if (batch.status === 'CANCELLED' || batch.status === 'COMPLETED') {
    throw businessRule('This batch is not open for enrollment.');
  }
  const activeCount = await prisma.enrollment.count({
    where: { batchId, status: { in: ['PENDING', 'ACTIVE'] } },
  });
  if (activeCount >= batch.capacity) {
    throw businessRule('This batch is at full capacity.');
  }
}

export async function createEnrollment(
  actor: ActorMeta,
  input: {
    studentId: string;
    batchId: string;
    joinedAt?: Date;
    agreedFeeMinor?: number;
    status: EnrollmentStatus;
    notes?: string;
  },
) {
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw notFound('Student not found.');
  if (student.status === 'ARCHIVED') throw businessRule('Archived students cannot be enrolled.');

  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    include: { course: { select: { defaultFeeMinor: true } } },
  });
  if (!batch) throw notFound('Batch not found.');

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_batchId: { studentId: input.studentId, batchId: input.batchId } },
  });
  if (existing) throw conflict('This student is already enrolled in this batch.');

  if (input.status === 'ACTIVE' || input.status === 'PENDING') {
    await assertCapacity(input.batchId);
  }

  const agreedFee = input.agreedFeeMinor ?? batch.course.defaultFeeMinor ?? 0;

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: input.studentId,
      batchId: input.batchId,
      joinedAt: input.joinedAt ?? new Date(),
      status: input.status,
      agreedFeeMinor: agreedFee,
      notes: input.notes ?? null,
      completedAt:
        input.status === 'COMPLETED' || input.status === 'WITHDRAWN' ? new Date() : null,
    },
    include: enrollmentInclude,
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'ENROLLMENT_CREATED',
    entityType: 'Enrollment',
    entityId: enrollment.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: {
      studentNumber: enrollment.student.studentNumber,
      batchCode: enrollment.batch.code,
      agreedFeeMinor: agreedFee,
    },
  });

  return serialize(enrollment);
}

export async function listEnrollments(query: {
  page: number;
  pageSize: number;
  studentId?: string;
  batchId?: string;
  courseId?: string;
  status?: EnrollmentStatus;
  search?: string;
}) {
  const where: Prisma.EnrollmentWhereInput = {
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.courseId ? { batch: { courseId: query.courseId } } : {}),
    ...(query.search
      ? {
          OR: [
            { student: { fullName: { contains: query.search, mode: 'insensitive' } } },
            { student: { studentNumber: { contains: query.search, mode: 'insensitive' } } },
            { batch: { code: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, enrollments] = await prisma.$transaction([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      include: enrollmentInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: enrollments.map(serialize), total };
}

export async function getEnrollment(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      ...enrollmentInclude,
      invoices: {
        orderBy: { issuedAt: 'desc' },
        include: {
          _count: { select: { payments: true } },
          payments: { select: { amountMinor: true, reversedAmountMinor: true } },
        },
      },
      certificates: {
        orderBy: { issuedAt: 'desc' },
        select: {
          id: true,
          certificateNumber: true,
          status: true,
          issuedAt: true,
          revokedAt: true,
        },
      },
      results: {
        include: {
          assessment: { select: { id: true, title: true, maxMarks: true, passMarks: true } },
        },
      },
    },
  });
  if (!enrollment) throw notFound('Enrollment not found.');

  const paid = await prisma.paymentAllocation.aggregate({
    where: { invoice: { enrollmentId }, payment: { status: { not: 'REVERSED' } } },
    _sum: { allocatedAmountMinor: true },
  });
  const reversed = await prisma.paymentReversal.aggregate({
    where: { payment: { invoice: { enrollmentId } } },
    _sum: { amountMinor: true },
  });

  const billed = enrollment.invoices
    .filter((invoice) => invoice.status !== 'VOID')
    .reduce((sum, invoice) => sum + invoice.totalMinor, 0);
  const netPaid = (paid._sum.allocatedAmountMinor ?? 0) - (reversed._sum.amountMinor ?? 0);

  return {
    ...serialize(enrollment),
    invoices: enrollment.invoices,
    certificates: enrollment.certificates,
    results: enrollment.results,
    attendance: await getEnrollmentAttendance(enrollmentId),
    fees: {
      billedMinor: billed,
      paidMinor: netPaid,
      outstandingMinor: billed - netPaid,
    },
  };
}

export async function updateEnrollment(
  actor: ActorMeta,
  enrollmentId: string,
  input: Partial<{
    status: EnrollmentStatus;
    agreedFeeMinor: number;
    completedAt: Date | null;
    notes: string | null;
  }>,
) {
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw notFound('Enrollment not found.');

  if (input.agreedFeeMinor !== undefined && input.agreedFeeMinor !== enrollment.agreedFeeMinor) {
    const invoiceCount = await prisma.invoice.count({
      where: { enrollmentId, status: { not: 'VOID' } },
    });
    if (invoiceCount > 0) {
      throw businessRule(
        'The agreed fee cannot be changed after invoices have been issued. Issue an adjustment invoice instead.',
      );
    }
  }

  if ((input.status === 'ACTIVE' || input.status === 'PENDING') && enrollment.status !== input.status) {
    await assertCapacity(enrollment.batchId);
  }

  const closing = input.status === 'COMPLETED' || input.status === 'WITHDRAWN';

  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.agreedFeeMinor !== undefined ? { agreedFeeMinor: input.agreedFeeMinor } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.completedAt !== undefined
        ? { completedAt: input.completedAt }
        : closing && !enrollment.completedAt
          ? { completedAt: new Date() }
          : input.status === 'ACTIVE' && enrollment.completedAt && enrollment.status !== 'COMPLETED'
            ? { completedAt: null }
            : {}),
    },
    include: enrollmentInclude,
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'ENROLLMENT_UPDATED',
    entityType: 'Enrollment',
    entityId: enrollmentId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { fields: Object.keys(input), ...(input.status ? { status: input.status } : {}) },
  });

  return serialize(updated);
}
