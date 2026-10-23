import type { BatchStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../utils/audit';
import { businessRule, conflict, notFound } from '../../utils/errors';

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

interface ScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
}

const batchInclude = {
  course: {
    select: { id: true, code: true, title: true, durationValue: true, durationUnit: true, defaultFeeMinor: true },
  },
  instructor: { select: { id: true, fullName: true } },
  schedules: { orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }] },
  _count: { select: { enrollments: true } },
};

function serialize(batch: {
  id: string;
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  capacity: number;
  status: BatchStatus;
  notes: string | null;
  course: { id: string; code: string; title: string; durationValue: number; durationUnit: string };
  instructor: { id: string; fullName: string } | null;
  schedules: ScheduleInput[];
  _count?: { enrollments: number };
}) {
  return {
    id: batch.id,
    code: batch.code,
    name: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    capacity: batch.capacity,
    enrolledCount: batch._count?.enrollments ?? 0,
    status: batch.status,
    notes: batch.notes,
    course: batch.course,
    instructor: batch.instructor,
    schedules: batch.schedules,
  };
}

export async function listBatches(query: {
  page: number;
  pageSize: number;
  courseId?: string;
  status?: BatchStatus;
  search?: string;
}) {
  const where: Prisma.BatchWhereInput = {
    ...(query.courseId ? { courseId: query.courseId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { course: { title: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, batches] = await prisma.$transaction([
    prisma.batch.count({ where }),
    prisma.batch.findMany({
      where,
      include: batchInclude,
      orderBy: [{ startDate: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: batches.map(serialize), total };
}

export async function getBatch(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      ...batchInclude,
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              studentNumber: true,
              fullName: true,
              phone: true,
              status: true,
            },
          },
        },
        orderBy: { student: { fullName: 'asc' } },
      },
      sessions: {
        orderBy: { startsAt: 'desc' },
        take: 25,
        include: { _count: { select: { attendance: true } } },
      },
    },
  });

  if (!batch) throw notFound('Batch not found.');
  return {
    ...serialize(batch),
    enrollments: batch.enrollments.map((enrollment) => ({
      id: enrollment.id,
      status: enrollment.status,
      joinedAt: enrollment.joinedAt,
      agreedFeeMinor: enrollment.agreedFeeMinor,
      student: enrollment.student,
    })),
    sessions: batch.sessions,
  };
}

export async function createBatch(
  actor: ActorMeta,
  input: {
    courseId: string;
    instructorId?: string | null;
    code: string;
    name: string;
    startDate: Date;
    endDate: Date;
    capacity: number;
    status: BatchStatus;
    notes?: string;
    schedules: ScheduleInput[];
  },
) {
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course) throw notFound('Course not found.');
  if (course.status === 'ARCHIVED') throw businessRule('Archived courses cannot receive new batches.');

  if (input.instructorId) {
    const instructor = await prisma.instructor.findUnique({ where: { id: input.instructorId } });
    if (!instructor) throw notFound('Instructor not found.');
  }

  const duplicate = await prisma.batch.findUnique({ where: { code: input.code } });
  if (duplicate) throw conflict('A batch with this code already exists.');

  const batch = await prisma.batch.create({
    data: {
      courseId: input.courseId,
      instructorId: input.instructorId ?? null,
      code: input.code,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      capacity: input.capacity,
      status: input.status,
      notes: input.notes ?? null,
      schedules: { create: input.schedules },
    },
    include: batchInclude,
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'BATCH_CREATED',
    entityType: 'Batch',
    entityId: batch.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { code: batch.code, courseId: input.courseId },
  });

  return serialize(batch);
}

export async function updateBatch(
  actor: ActorMeta,
  batchId: string,
  input: Partial<{
    instructorId: string | null;
    name: string;
    startDate: Date;
    endDate: Date;
    capacity: number;
    status: BatchStatus;
    notes: string | null;
    schedules: ScheduleInput[];
  }>,
) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!batch) throw notFound('Batch not found.');

  const activeEnrollments = await prisma.enrollment.count({
    where: { batchId, status: { in: ['PENDING', 'ACTIVE'] } },
  });
  if (input.capacity !== undefined && input.capacity < activeEnrollments) {
    throw businessRule(`Capacity cannot be lower than the ${activeEnrollments} active enrollments.`);
  }

  const start = input.startDate ?? batch.startDate;
  const end = input.endDate ?? batch.endDate;
  if (end < start) throw businessRule('The end date must be on or after the start date.');

  if (input.instructorId) {
    const instructor = await prisma.instructor.findUnique({ where: { id: input.instructorId } });
    if (!instructor) throw notFound('Instructor not found.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.schedules) {
      await tx.batchSchedule.deleteMany({ where: { batchId } });
      if (input.schedules.length > 0) {
        await tx.batchSchedule.createMany({
          data: input.schedules.map((schedule) => ({ ...schedule, batchId })),
        });
      }
    }

    return tx.batch.update({
      where: { id: batchId },
      data: {
        ...(input.instructorId !== undefined ? { instructorId: input.instructorId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: batchInclude,
    });
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'BATCH_UPDATED',
    entityType: 'Batch',
    entityId: batchId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { fields: Object.keys(input) },
  });

  return serialize(updated);
}
