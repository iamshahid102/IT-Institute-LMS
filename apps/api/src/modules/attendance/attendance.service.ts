import type { AttendanceStatus, Prisma, Role, SessionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../utils/audit';
import { sha256 } from '../../utils/crypto';
import { AppError, businessRule, conflict, notFound } from '../../utils/errors';
import { getBatchAttendanceReport, getStudentAttendanceSummaries } from './attendance.stats';

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

const sessionInclude = {
  batch: {
    select: {
      id: true,
      code: true,
      name: true,
      course: { select: { id: true, code: true, title: true } },
      _count: { select: { enrollments: true } },
    },
  },
  _count: { select: { attendance: true } },
};

function serializeSession(session: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: SessionStatus;
  topic: string | null;
  openedAt: Date | null;
  finalizedAt: Date | null;
  cancelledAt: Date | null;
  batch: {
    id: string;
    code: string;
    name: string;
    course: { id: string; code: string; title: string };
    _count?: { enrollments: number };
  };
  _count?: { attendance: number };
}) {
  return {
    id: session.id,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    status: session.status,
    topic: session.topic,
    openedAt: session.openedAt,
    finalizedAt: session.finalizedAt,
    cancelledAt: session.cancelledAt,
    batch: session.batch,
    markedCount: session._count?.attendance ?? 0,
  };
}

export async function createSession(
  actor: ActorMeta,
  input: { batchId: string; startsAt: string; endsAt: string; topic?: string },
) {
  const batch = await prisma.batch.findUnique({ where: { id: input.batchId } });
  if (!batch) throw notFound('Batch not found.');
  if (batch.status === 'CANCELLED') throw businessRule('Cancelled batches cannot have sessions.');

  const startsAt = new Date(input.startsAt);
  const existing = await prisma.classSession.findFirst({
    where: { batchId: input.batchId, startsAt, status: { not: 'CANCELLED' } },
  });
  if (existing) throw conflict('A session already exists for this batch at that start time.');

  const session = await prisma.classSession.create({
    data: {
      batchId: input.batchId,
      startsAt,
      endsAt: new Date(input.endsAt),
      topic: input.topic ?? null,
      status: 'SCHEDULED',
    },
    include: sessionInclude,
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'ATTENDANCE_SESSION_CREATED',
    entityType: 'ClassSession',
    entityId: session.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { batchCode: session.batch.code, startsAt: session.startsAt },
  });

  return serializeSession(session);
}

export async function listSessions(query: {
  page: number;
  pageSize: number;
  batchId?: string;
  status?: SessionStatus;
  date?: Date;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.ClassSessionWhereInput = {
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.date
      ? {
          startsAt: {
            gte: query.date,
            lt: new Date(query.date.getTime() + 24 * 60 * 60 * 1000),
          },
        }
      : {}),
    ...(query.from || query.to
      ? {
          startsAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lt: new Date(query.to.getTime() + 24 * 60 * 60 * 1000) } : {}),
          },
        }
      : {}),
  };

  const [total, sessions] = await prisma.$transaction([
    prisma.classSession.count({ where }),
    prisma.classSession.findMany({
      where,
      include: sessionInclude,
      orderBy: { startsAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: sessions.map(serializeSession), total };
}

export async function getSession(sessionId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });
  if (!session) throw notFound('Attendance session not found.');

  const enrollments = await prisma.enrollment.findMany({
    where: { batchId: session.batchId, status: { in: ['ACTIVE', 'COMPLETED', 'SUSPENDED'] } },
    include: {
      student: {
        select: { id: true, studentNumber: true, fullName: true, phone: true, status: true },
      },
    },
    orderBy: { student: { fullName: 'asc' } },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: { sessionId },
    include: {
      markedBy: { select: { id: true, fullName: true } },
      correctedBy: { select: { id: true, fullName: true } },
    },
  });
  const byEnrollment = new Map(records.map((record) => [record.enrollmentId, record]));

  return {
    ...serializeSession(session),
    roster: enrollments.map((enrollment) => {
      const record = byEnrollment.get(enrollment.id);
      return {
        enrollmentId: enrollment.id,
        student: enrollment.student,
        enrollmentStatus: enrollment.status,
        attendance: record
          ? {
              id: record.id,
              status: record.status,
              method: record.method,
              markedAt: record.markedAt,
              markedBy: record.markedBy,
              remarks: record.remarks,
              correctionReason: record.correctionReason,
              correctedAt: record.correctedAt,
              correctedBy: record.correctedBy,
            }
          : null,
      };
    }),
    counts: {
      present: records.filter((record) => record.status === 'PRESENT').length,
      late: records.filter((record) => record.status === 'LATE').length,
      absent: records.filter((record) => record.status === 'ABSENT').length,
      excused: records.filter((record) => record.status === 'EXCUSED').length,
      unmarked: enrollments.length - records.length,
    },
  };
}

async function loadOpenSession(sessionId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { batch: { select: { id: true, code: true, name: true } } },
  });
  if (!session) throw notFound('Attendance session not found.');
  if (session.status !== 'OPEN') {
    throw new AppError(
      409,
      'SESSION_NOT_OPEN',
      `Attendance can only be marked for an open session. This session is ${session.status.toLowerCase()}.`,
    );
  }
  return session;
}

export async function openSession(actor: ActorMeta, sessionId: string) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Attendance session not found.');
  if (session.status !== 'SCHEDULED') {
    throw businessRule(`Only scheduled sessions can be opened (current status: ${session.status}).`);
  }

  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { status: 'OPEN', openedById: actor.actorId, openedAt: new Date() },
    include: sessionInclude,
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'ATTENDANCE_SESSION_OPENED',
    entityType: 'ClassSession',
    entityId: sessionId,
    requestId: actor.requestId,
    ip: actor.ip,
  });

  return serializeSession(updated);
}

export async function finalizeSession(actor: ActorMeta, sessionId: string) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Attendance session not found.');
  if (session.status !== 'OPEN') {
    throw businessRule(`Only open sessions can be finalized (current status: ${session.status}).`);
  }

  await prisma.$transaction(async (tx) => {
    const enrollments = await tx.enrollment.findMany({
      where: { batchId: session.batchId, status: { in: ['ACTIVE', 'COMPLETED', 'SUSPENDED'] } },
      select: { id: true },
    });
    const marked = await tx.attendanceRecord.findMany({
      where: { sessionId },
      select: { enrollmentId: true },
    });
    const markedIds = new Set(marked.map((record) => record.enrollmentId));
    const missing = enrollments.filter((enrollment) => !markedIds.has(enrollment.id));

    if (missing.length > 0) {
      await tx.attendanceRecord.createMany({
        data: missing.map((enrollment) => ({
          sessionId,
          enrollmentId: enrollment.id,
          status: 'ABSENT' as const,
          markedById: actor.actorId,
        })),
      });
    }

    await tx.classSession.update({
      where: { id: sessionId },
      data: { status: 'FINALIZED', finalizedById: actor.actorId, finalizedAt: new Date() },
    });
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'ATTENDANCE_SESSION_FINALIZED',
    entityType: 'ClassSession',
    entityId: sessionId,
    requestId: actor.requestId,
    ip: actor.ip,
  });

  return getSession(sessionId);
}

export async function cancelSession(actor: ActorMeta, sessionId: string) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Attendance session not found.');
  if (session.status === 'FINALIZED') {
    throw businessRule('Finalized sessions cannot be cancelled. Use attendance corrections instead.');
  }
  if (session.status === 'CANCELLED') throw businessRule('This session is already cancelled.');

  const updated = await prisma.classSession.update({
    where: { id: sessionId },
    data: { status: 'CANCELLED', cancelledById: actor.actorId, cancelledAt: new Date() },
    include: sessionInclude,
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'ATTENDANCE_SESSION_CANCELLED',
    entityType: 'ClassSession',
    entityId: sessionId,
    requestId: actor.requestId,
    ip: actor.ip,
  });

  return serializeSession(updated);
}

function duplicateError(status: AttendanceStatus): AppError {
  return new AppError(
    409,
    'DUPLICATE_ATTENDANCE',
    `Attendance is already recorded for this student in this session (${status.toLowerCase()}).`,
  );
}

export async function markByScan(actor: ActorMeta, sessionId: string, qrToken: string) {
  const session = await loadOpenSession(sessionId);

  const token = await prisma.qrToken.findUnique({
    where: { tokenHash: sha256(qrToken) },
    include: { student: { select: { id: true, fullName: true, studentNumber: true, status: true, userId: true } } },
  });

  if (!token) throw new AppError(422, 'QR_TOKEN_INVALID', 'This attendance code is not recognised.');
  if (token.revokedAt) throw new AppError(422, 'QR_TOKEN_INVALID', 'This attendance code has been revoked.');
  if (token.expiresAt.getTime() <= Date.now()) {
    throw new AppError(422, 'QR_TOKEN_EXPIRED', 'This attendance code has expired. Ask the student to refresh it.');
  }
  if (token.student.status !== 'ACTIVE') {
    throw new AppError(422, 'STUDENT_INACTIVE', 'This student record is not active.');
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: token.studentId, batchId: session.batchId, status: 'ACTIVE' },
  });
  if (!enrollment) {
    throw new AppError(
      422,
      'STUDENT_NOT_ENROLLED',
      `${token.student.fullName} is not actively enrolled in ${session.batch.code}.`,
    );
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { sessionId_enrollmentId: { sessionId, enrollmentId: enrollment.id } },
  });
  if (existing) throw duplicateError(existing.status);

  const record = await prisma.attendanceRecord.create({
    data: {
      sessionId,
      enrollmentId: enrollment.id,
      status: 'PRESENT',
      method: 'QR',
      markedById: actor.actorId,
    },
  });

  return {
    record,
    student: token.student,
    batch: session.batch,
    sessionId,
  };
}

export async function markManually(
  actor: ActorMeta,
  input: { sessionId: string; studentNumber: string; status: AttendanceStatus; remarks?: string },
) {
  const session = await loadOpenSession(input.sessionId);

  const student = await prisma.student.findUnique({
    where: { studentNumber: input.studentNumber.toUpperCase() },
  });
  if (!student) throw notFound('No student matches that student number.');
  if (student.status === 'ARCHIVED') throw businessRule('Archived students cannot be marked present.');

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, batchId: session.batchId, status: 'ACTIVE' },
  });
  if (!enrollment) {
    throw new AppError(
      422,
      'STUDENT_NOT_ENROLLED',
      `${student.fullName} is not actively enrolled in ${session.batch.code}.`,
    );
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { sessionId_enrollmentId: { sessionId: input.sessionId, enrollmentId: enrollment.id } },
  });
  if (existing) throw duplicateError(existing.status);

  const record = await prisma.attendanceRecord.create({
    data: {
      sessionId: input.sessionId,
      enrollmentId: enrollment.id,
      status: input.status,
      method: 'MANUAL',
      markedById: actor.actorId,
      remarks: input.remarks ?? null,
    },
  });

  return {
    record,
    student: { id: student.id, fullName: student.fullName, studentNumber: student.studentNumber },
    batch: session.batch,
    sessionId: input.sessionId,
  };
}

export async function correctAttendance(
  actor: ActorMeta,
  recordId: string,
  input: { status: AttendanceStatus; reason: string },
) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    include: {
      session: { select: { id: true, status: true, batch: { select: { code: true } } } },
      enrollment: { select: { student: { select: { fullName: true, studentNumber: true } } } },
    },
  });
  if (!record) throw notFound('Attendance record not found.');
  if (record.session.status !== 'FINALIZED') {
    throw businessRule('Attendance can only be corrected after the session is finalized.');
  }
  if (record.status === input.status) {
    throw businessRule('The requested status matches the existing status.');
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      status: input.status,
      correctionReason: input.reason,
      correctedAt: new Date(),
      correctedById: actor.actorId,
    },
    include: {
      markedBy: { select: { id: true, fullName: true } },
      correctedBy: { select: { id: true, fullName: true } },
    },
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'ATTENDANCE_CORRECTED',
    entityType: 'AttendanceRecord',
    entityId: recordId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: {
      from: record.status,
      to: input.status,
      reason: input.reason,
      studentNumber: record.enrollment.student.studentNumber,
      batchCode: record.session.batch.code,
    },
  });

  return updated;
}

export async function getAttendanceReport(query: {
  batchId?: string;
  studentId?: string;
  from?: Date;
  to?: Date;
}) {
  if (query.studentId) {
    const summaries = await getStudentAttendanceSummaries(query.studentId);
    const records = await prisma.attendanceRecord.findMany({
      where: {
        enrollment: { studentId: query.studentId },
        ...(query.from || query.to
          ? {
              session: {
                startsAt: {
                  ...(query.from ? { gte: query.from } : {}),
                  ...(query.to ? { lt: new Date(query.to.getTime() + 24 * 60 * 60 * 1000) } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        session: {
          select: {
            id: true,
            startsAt: true,
            status: true,
            topic: true,
            batch: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { session: { startsAt: 'desc' } },
    });
    return { studentId: query.studentId, summaries, records };
  }

  if (query.batchId) {
    const rows = await getBatchAttendanceReport(query.batchId);
    const batch = await prisma.batch.findUnique({
      where: { id: query.batchId },
      select: { id: true, code: true, name: true, course: { select: { title: true } } },
    });
    if (!batch) throw notFound('Batch not found.');
    return { batch, rows };
  }

  const batches = await prisma.batch.findMany({
    where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
    select: { id: true, code: true, name: true, course: { select: { title: true } } },
    orderBy: { startDate: 'desc' },
  });

  const rows = await Promise.all(
    batches.map(async (batch) => {
      const report = await getBatchAttendanceReport(batch.id);
      const totalPercentage = report.reduce((sum, row) => sum + row.summary.percentage, 0);
      return {
        batch,
        enrollmentCount: report.length,
        averagePercentage: report.length > 0 ? Math.round((totalPercentage / report.length) * 10) / 10 : 0,
        atRiskCount: report.filter((row) => row.summary.percentage < 75).length,
      };
    }),
  );

  return { rows };
}
