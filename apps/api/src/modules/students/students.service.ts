import type { Prisma, Role, StudentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../utils/audit';
import { hashPassword } from '../../utils/crypto';
import { businessRule, conflict, notFound } from '../../utils/errors';
import { nextBusinessNumber } from '../../utils/numbers';

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

interface CreateInput {
  fullName: string;
  guardianName?: string;
  phone: string;
  email?: string;
  address?: string;
  dateOfBirth?: Date;
  admissionDate?: Date;
  notes?: string;
  portalPassword?: string;
}

interface ListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: StudentStatus;
  courseId?: string;
  batchId?: string;
  admissionFrom?: Date;
  admissionTo?: Date;
  sort: 'studentNumber' | 'fullName' | 'admissionDate' | 'createdAt';
  order: 'asc' | 'desc';
}

export function serializeStudent(student: {
  id: string;
  studentNumber: string;
  fullName: string;
  guardianName: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  admissionDate: Date;
  status: StudentStatus;
  notes: string | null;
  userId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: student.id,
    studentNumber: student.studentNumber,
    fullName: student.fullName,
    guardianName: student.guardianName,
    phone: student.phone,
    email: student.email,
    address: student.address,
    dateOfBirth: student.dateOfBirth,
    admissionDate: student.admissionDate,
    status: student.status,
    notes: student.notes,
    hasPortalAccount: Boolean(student.userId),
    archivedAt: student.archivedAt,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export async function createStudent(actor: ActorMeta, input: CreateInput) {
  if (input.email) {
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) throw conflict('An account already exists for this email address.');
  }

  const passwordHash =
    input.portalPassword && input.email ? await hashPassword(input.portalPassword) : null;

  const student = await prisma.$transaction(async (tx) => {
    const studentNumber = await nextBusinessNumber(tx, 'student', 'STU', input.admissionDate);

    let userId: string | null = null;
    if (passwordHash && input.email) {
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          role: 'STUDENT',
          status: 'ACTIVE',
          passwordHash,
        },
      });
      userId = user.id;
    }

    return tx.student.create({
      data: {
        studentNumber,
        fullName: input.fullName,
        guardianName: input.guardianName ?? null,
        phone: input.phone,
        email: input.email ?? null,
        address: input.address ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        admissionDate: input.admissionDate ?? new Date(),
        notes: input.notes ?? null,
        createdById: actor.actorId,
        userId,
      },
    });
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'STUDENT_CREATED',
    entityType: 'Student',
    entityId: student.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { studentNumber: student.studentNumber, portalAccount: Boolean(student.userId) },
  });

  return serializeStudent(student);
}

export async function listStudents(query: ListQuery) {
  const where: Prisma.StudentWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { studentNumber: { contains: query.search, mode: 'insensitive' } },
            { fullName: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.courseId || query.batchId
      ? {
          enrollments: {
            some: {
              ...(query.batchId ? { batchId: query.batchId } : {}),
              ...(query.courseId ? { batch: { courseId: query.courseId } } : {}),
            },
          },
        }
      : {}),
    ...(query.admissionFrom || query.admissionTo
      ? {
          admissionDate: {
            ...(query.admissionFrom ? { gte: query.admissionFrom } : {}),
            ...(query.admissionTo ? { lte: query.admissionTo } : {}),
          },
        }
      : {}),
  };

  const [total, students] = await prisma.$transaction([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: students.map(serializeStudent), total };
}

export async function getStudentDetail(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        include: {
          batch: { include: { course: true, instructor: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!student) throw notFound('Student not found.');

  const [invoiceTotals, invoices, certificates] = await Promise.all([
    prisma.invoice.aggregate({
      where: { enrollment: { studentId }, status: { not: 'VOID' } },
      _sum: { totalMinor: true },
    }),
    prisma.invoice.findMany({
      where: { enrollment: { studentId }, status: { not: 'VOID' } },
      select: { id: true, totalMinor: true, status: true },
    }),
    prisma.certificate.count({ where: { enrollment: { studentId }, status: 'ISSUED' } }),
  ]);

  const paid = await prisma.paymentAllocation.aggregate({
    where: { invoice: { enrollment: { studentId } }, payment: { status: { not: 'REVERSED' } } },
    _sum: { allocatedAmountMinor: true },
  });
  const reversed = await prisma.paymentReversal.aggregate({
    where: { payment: { invoice: { enrollment: { studentId } } } },
    _sum: { amountMinor: true },
  });

  const totalBilled = invoiceTotals._sum.totalMinor ?? 0;
  const totalPaid = (paid._sum.allocatedAmountMinor ?? 0) - (reversed._sum.amountMinor ?? 0);

  return {
    ...serializeStudent(student),
    enrollments: student.enrollments.map((enrollment) => ({
      id: enrollment.id,
      status: enrollment.status,
      joinedAt: enrollment.joinedAt,
      completedAt: enrollment.completedAt,
      agreedFeeMinor: enrollment.agreedFeeMinor,
      currency: enrollment.currency,
      batch: {
        id: enrollment.batch.id,
        code: enrollment.batch.code,
        name: enrollment.batch.name,
        status: enrollment.batch.status,
        startDate: enrollment.batch.startDate,
        endDate: enrollment.batch.endDate,
        course: {
          id: enrollment.batch.course.id,
          code: enrollment.batch.course.code,
          title: enrollment.batch.course.title,
        },
        instructor: enrollment.batch.instructor
          ? { id: enrollment.batch.instructor.id, fullName: enrollment.batch.instructor.fullName }
          : null,
      },
    })),
    summary: {
      activeEnrollments: student.enrollments.filter((item) => item.status === 'ACTIVE').length,
      totalBilledMinor: totalBilled,
      totalPaidMinor: totalPaid,
      outstandingMinor: totalBilled - totalPaid,
      invoiceCount: invoices.length,
      issuedCertificates: certificates,
    },
  };
}

export async function updateStudent(
  actor: ActorMeta,
  studentId: string,
  input: Partial<{
    fullName: string;
    guardianName: string | null;
    phone: string;
    email: string | undefined;
    address: string | null;
    dateOfBirth: Date;
    notes: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'WITHDRAWN';
  }>,
) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw notFound('Student not found.');
  if (student.status === 'ARCHIVED') throw businessRule('Archived student records cannot be edited.');

  if (input.email && input.email !== student.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw conflict('An account already exists for this email address.');
  }

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: {
      ...input,
      ...(input.email !== undefined ? { email: input.email ?? null } : {}),
    },
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'STUDENT_UPDATED',
    entityType: 'Student',
    entityId: studentId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { fields: Object.keys(input) },
  });

  return serializeStudent(updated);
}

export async function archiveStudent(actor: ActorMeta, studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { enrollments: { where: { status: 'ACTIVE' } } },
  });
  if (!student) throw notFound('Student not found.');
  if (student.status === 'ARCHIVED') throw businessRule('This student is already archived.');
  if (student.enrollments.length > 0) {
    throw businessRule('Withdraw or complete the student’s active enrollments before archiving the record.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const archived = await tx.student.update({
      where: { id: studentId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    if (student.userId) {
      await tx.user.update({ where: { id: student.userId }, data: { status: 'DISABLED' } });
      await tx.authSession.updateMany({
        where: { userId: student.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return archived;
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'STUDENT_ARCHIVED',
    entityType: 'Student',
    entityId: studentId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { studentNumber: student.studentNumber },
  });

  return serializeStudent(updated);
}

export async function createPortalAccount(
  actor: ActorMeta,
  studentId: string,
  input: { email: string; password: string },
) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw notFound('Student not found.');
  if (student.userId) throw conflict('This student already has a portal account.');
  if (student.status === 'ARCHIVED') throw businessRule('Archived students cannot receive a portal account.');

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account already exists for this email address.');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        fullName: student.fullName,
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
      },
    });
    await tx.student.update({
      where: { id: studentId },
      data: { userId: created.id, email: student.email ?? input.email },
    });
    return created;
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'STUDENT_PORTAL_ACCOUNT_CREATED',
    entityType: 'Student',
    entityId: studentId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { userId: user.id },
  });

  return { userId: user.id, email: user.email };
}

export async function getStudentAttendance(studentId: string) {
  const records = await prisma.attendanceRecord.findMany({
    where: { enrollment: { studentId } },
    include: {
      session: { include: { batch: { select: { id: true, code: true, name: true } } } },
      enrollment: { select: { id: true, batchId: true } },
    },
    orderBy: { session: { startsAt: 'desc' } },
    take: 200,
  });

  return records.map((record) => ({
    id: record.id,
    status: record.status,
    method: record.method,
    markedAt: record.markedAt,
    remarks: record.remarks,
    correctionReason: record.correctionReason,
    session: {
      id: record.session.id,
      startsAt: record.session.startsAt,
      endsAt: record.session.endsAt,
      status: record.session.status,
      topic: record.session.topic,
      batch: record.session.batch,
    },
    enrollmentId: record.enrollmentId,
  }));
}

export async function getStudentCertificates(studentId: string) {
  const certificates = await prisma.certificate.findMany({
    where: { enrollment: { studentId } },
    include: {
      enrollment: {
        include: { batch: { include: { course: { select: { title: true, code: true } } } } },
      },
    },
    orderBy: { issuedAt: 'desc' },
  });

  return certificates.map((certificate) => ({
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    verificationCode: certificate.verificationCode,
    status: certificate.status,
    issuedAt: certificate.issuedAt,
    revokedAt: certificate.revokedAt,
    revocationReason: certificate.revocationReason,
    courseTitle: certificate.enrollment.batch.course.title,
    courseCode: certificate.enrollment.batch.course.code,
  }));
}

export async function findStudentByUserId(userId: string) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw notFound('Student profile not found for this account.');
  return student;
}
