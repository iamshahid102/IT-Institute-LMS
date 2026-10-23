import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { recordAudit } from '../../utils/audit';
import { dateOnlySchema } from '../../utils/dates';
import { businessRule, notFound } from '../../utils/errors';
import { idParamSchema, paginationMeta, parseBody, parseParams, parseQuery, paginationSchema } from '../../utils/validate';

const assessmentSchema = z
  .object({
    courseId: z.uuid('Select a course.'),
    batchId: z.uuid().nullable().optional(),
    title: z.string().trim().min(3, 'Enter the assessment title.').max(160),
    maxMarks: z.coerce.number().int().min(1).max(1000),
    passMarks: z.coerce.number().int().min(0).max(1000),
    assessmentDate: dateOnlySchema,
    status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).default('DRAFT'),
  })
  .refine((value) => value.passMarks <= value.maxMarks, {
    path: ['passMarks'],
    message: 'Pass marks cannot exceed the maximum marks.',
  });

const resultsSchema = z.object({
  results: z
    .array(
      z.object({
        enrollmentId: z.uuid(),
        marksObtained: z.coerce.number().int().min(0).max(1000),
        remarks: z.string().trim().max(300).optional(),
      }),
    )
    .min(1)
    .max(200),
});

const listQuerySchema = paginationSchema.extend({
  courseId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
});

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

async function getAssessmentOrThrow(assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      course: { select: { id: true, code: true, title: true } },
      results: {
        include: {
          enrollment: {
            include: { student: { select: { id: true, studentNumber: true, fullName: true } } },
          },
        },
        orderBy: { enrollment: { student: { fullName: 'asc' } } },
      },
    },
  });
  if (!assessment) throw notFound('Assessment not found.');

  const enrollments = await prisma.enrollment.findMany({
    where: {
      ...(assessment.batchId ? { batchId: assessment.batchId } : { batch: { courseId: assessment.courseId } }),
      status: { in: ['ACTIVE', 'COMPLETED'] },
    },
    include: { student: { select: { id: true, studentNumber: true, fullName: true } } },
    orderBy: { student: { fullName: 'asc' } },
  });

  return { ...assessment, eligibleEnrollments: enrollments };
}

export const assessmentsRouter = Router();
assessmentsRouter.use(requireAuth);

function actor(req: Parameters<typeof getAuth>[0]): ActorMeta {
  const auth = getAuth(req);
  return { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip };
}

assessmentsRouter.get('/', requirePermission('assessment.read'), async (req, res) => {
  const query = parseQuery(listQuerySchema, req);
  const where: Prisma.AssessmentWhereInput = {
    ...(query.courseId ? { courseId: query.courseId } : {}),
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, assessments] = await prisma.$transaction([
    prisma.assessment.count({ where }),
    prisma.assessment.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, title: true } },
        _count: { select: { results: true } },
      },
      orderBy: { assessmentDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  res.json({ data: assessments, meta: paginationMeta(query.page, query.pageSize, total) });
});

assessmentsRouter.get('/:id', requirePermission('assessment.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await getAssessmentOrThrow(id) });
});

assessmentsRouter.post('/', requirePermission('assessment.manage'), async (req, res) => {
  const body = parseBody(assessmentSchema, req);
  const course = await prisma.course.findUnique({ where: { id: body.courseId } });
  if (!course) throw notFound('Course not found.');
  if (body.batchId) {
    const batch = await prisma.batch.findUnique({ where: { id: body.batchId } });
    if (!batch) throw notFound('Batch not found.');
    if (batch.courseId !== body.courseId) throw businessRule('The batch does not belong to the selected course.');
  }

  const assessment = await prisma.assessment.create({
    data: {
      courseId: body.courseId,
      batchId: body.batchId ?? null,
      title: body.title,
      maxMarks: body.maxMarks,
      passMarks: body.passMarks,
      assessmentDate: body.assessmentDate,
      status: body.status,
    },
  });

  await recordAudit(prisma, {
    ...actor(req),
    action: 'ASSESSMENT_CREATED',
    entityType: 'Assessment',
    entityId: assessment.id,
    metadata: { title: assessment.title, maxMarks: assessment.maxMarks },
  });

  res.status(201).json({ data: assessment });
});

assessmentsRouter.patch('/:id', requirePermission('assessment.manage'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(assessmentSchema.partial(), req);

  const existing = await prisma.assessment.findUnique({ where: { id } });
  if (!existing) throw notFound('Assessment not found.');

  const maxMarks = body.maxMarks ?? existing.maxMarks;
  const passMarks = body.passMarks ?? existing.passMarks;
  if (passMarks > maxMarks) throw businessRule('Pass marks cannot exceed the maximum marks.');

  const updated = await prisma.assessment.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.maxMarks !== undefined ? { maxMarks: body.maxMarks } : {}),
      ...(body.passMarks !== undefined ? { passMarks: body.passMarks } : {}),
      ...(body.assessmentDate !== undefined ? { assessmentDate: body.assessmentDate } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.batchId !== undefined ? { batchId: body.batchId } : {}),
    },
  });

  await recordAudit(prisma, {
    ...actor(req),
    action: 'ASSESSMENT_UPDATED',
    entityType: 'Assessment',
    entityId: id,
    metadata: { fields: Object.keys(body) },
  });

  res.json({ data: updated });
});

assessmentsRouter.put('/:id/results', requirePermission('assessment.manage'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(resultsSchema, req);

  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment) throw notFound('Assessment not found.');

  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: body.results.map((result) => result.enrollmentId) } },
    select: { id: true, batchId: true, batch: { select: { courseId: true } } },
  });
  const byId = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));

  for (const result of body.results) {
    const enrollment = byId.get(result.enrollmentId);
    if (!enrollment) throw notFound('One of the selected enrollments no longer exists.');
    if (assessment.batchId && enrollment.batchId !== assessment.batchId) {
      throw businessRule('Results can only be recorded for enrollments in the assessment batch.');
    }
    if (!assessment.batchId && enrollment.batch.courseId !== assessment.courseId) {
      throw businessRule('Results can only be recorded for enrollments in the assessment course.');
    }
    if (result.marksObtained > assessment.maxMarks) {
      throw businessRule(`Marks cannot exceed the maximum of ${assessment.maxMarks}.`);
    }
  }

  await prisma.$transaction(
    body.results.map((result) =>
      prisma.assessmentResult.upsert({
        where: {
          assessmentId_enrollmentId: { assessmentId: id, enrollmentId: result.enrollmentId },
        },
        create: {
          assessmentId: id,
          enrollmentId: result.enrollmentId,
          marksObtained: result.marksObtained,
          status: result.marksObtained >= assessment.passMarks ? 'PASS' : 'FAIL',
          remarks: result.remarks ?? null,
          recordedById: getAuth(req).userId,
        },
        update: {
          marksObtained: result.marksObtained,
          status: result.marksObtained >= assessment.passMarks ? 'PASS' : 'FAIL',
          remarks: result.remarks ?? null,
          recordedById: getAuth(req).userId,
          recordedAt: new Date(),
        },
      }),
    ),
  );

  await recordAudit(prisma, {
    ...actor(req),
    action: 'ASSESSMENT_RESULTS_RECORDED',
    entityType: 'Assessment',
    entityId: id,
    metadata: { count: body.results.length },
  });

  res.json({ data: await getAssessmentOrThrow(id) });
});
