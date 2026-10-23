import type { CourseStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../utils/audit';
import { businessRule, conflict, notFound } from '../../utils/errors';

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

export async function listCourses(query: {
  page: number;
  pageSize: number;
  search?: string;
  status?: CourseStatus;
}) {
  const where: Prisma.CourseWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' } },
            { title: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, courses] = await prisma.$transaction([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: { title: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { batches: true } } },
    }),
  ]);

  return {
    items: courses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      durationValue: course.durationValue,
      durationUnit: course.durationUnit,
      defaultFeeMinor: course.defaultFeeMinor,
      status: course.status,
      batchCount: course._count.batches,
      createdAt: course.createdAt,
    })),
    total,
  };
}

export async function getCourse(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      batches: {
        orderBy: { startDate: 'desc' },
        include: { instructor: { select: { id: true, fullName: true } }, _count: { select: { enrollments: true } } },
      },
    },
  });
  if (!course) throw notFound('Course not found.');
  return course;
}

export async function createCourse(
  actor: ActorMeta,
  input: {
    code: string;
    title: string;
    description?: string;
    durationValue: number;
    durationUnit: 'WEEKS' | 'MONTHS';
    defaultFeeMinor?: number;
    status: CourseStatus;
  },
) {
  const existing = await prisma.course.findUnique({ where: { code: input.code } });
  if (existing) throw conflict('A course with this code already exists.');

  const course = await prisma.course.create({
    data: {
      code: input.code,
      title: input.title,
      description: input.description ?? null,
      durationValue: input.durationValue,
      durationUnit: input.durationUnit,
      defaultFeeMinor: input.defaultFeeMinor ?? null,
      status: input.status,
    },
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'COURSE_CREATED',
    entityType: 'Course',
    entityId: course.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { code: course.code, title: course.title },
  });

  return course;
}

export async function updateCourse(
  actor: ActorMeta,
  courseId: string,
  input: Partial<{
    title: string;
    description: string | null;
    durationValue: number;
    durationUnit: 'WEEKS' | 'MONTHS';
    defaultFeeMinor: number | null;
    status: CourseStatus;
  }>,
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound('Course not found.');

  if (input.status === 'ARCHIVED') {
    const activeBatches = await prisma.batch.count({
      where: { courseId, status: { in: ['PLANNED', 'ACTIVE'] } },
    });
    if (activeBatches > 0) {
      throw businessRule('Complete or cancel the course’s active batches before archiving it.');
    }
  }

  const updated = await prisma.course.update({ where: { id: courseId }, data: input });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'COURSE_UPDATED',
    entityType: 'Course',
    entityId: courseId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { fields: Object.keys(input) },
  });

  return updated;
}
