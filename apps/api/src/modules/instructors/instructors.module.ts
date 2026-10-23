import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { recordAudit } from '../../utils/audit';
import { conflict, notFound } from '../../utils/errors';
import { idParamSchema, paginationMeta, parseBody, parseParams, parseQuery, paginationSchema } from '../../utils/validate';

const instructorSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the instructor name.').max(120),
  email: z.union([z.literal(''), z.string().trim().pipe(z.email('Enter a valid email address.'))]).optional(),
  phone: z.string().trim().max(30).optional(),
  specialization: z.string().trim().max(160).optional(),
  active: z.boolean().default(true),
});

const listSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  active: z.enum(['true', 'false']).optional(),
});

function serialize(instructor: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  active: boolean;
  _count?: { batches: number };
}) {
  return {
    id: instructor.id,
    fullName: instructor.fullName,
    email: instructor.email,
    phone: instructor.phone,
    specialization: instructor.specialization,
    active: instructor.active,
    batchCount: instructor._count?.batches ?? 0,
  };
}

export const instructorsRouter = Router();
instructorsRouter.use(requireAuth);

instructorsRouter.get('/', requirePermission('instructor.read'), async (req, res) => {
  const query = parseQuery(listSchema, req);
  const where: Prisma.InstructorWhereInput = {
    ...(query.active ? { active: query.active === 'true' } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: 'insensitive' } },
            { specialization: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, instructors] = await prisma.$transaction([
    prisma.instructor.count({ where }),
    prisma.instructor.findMany({
      where,
      orderBy: { fullName: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { batches: true } } },
    }),
  ]);

  res.json({ data: instructors.map(serialize), meta: paginationMeta(query.page, query.pageSize, total) });
});

instructorsRouter.post('/', requirePermission('instructor.manage'), async (req, res) => {
  const auth = getAuth(req);
  const body = parseBody(instructorSchema, req);
  const instructor = await prisma.instructor.create({
    data: {
      fullName: body.fullName,
      email: body.email || null,
      phone: body.phone || null,
      specialization: body.specialization || null,
      active: body.active,
    },
  });

  await recordAudit(prisma, {
    actorId: auth.userId,
    actorRole: auth.role,
    action: 'INSTRUCTOR_CREATED',
    entityType: 'Instructor',
    entityId: instructor.id,
    requestId: req.requestId,
    ip: req.ip,
  });

  res.status(201).json({ data: serialize(instructor) });
});

instructorsRouter.patch('/:id', requirePermission('instructor.manage'), async (req, res) => {
  const auth = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(instructorSchema.partial(), req);

  const existing = await prisma.instructor.findUnique({ where: { id } });
  if (!existing) throw notFound('Instructor not found.');

  const instructor = await prisma.instructor.update({
    where: { id },
    data: {
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.email !== undefined ? { email: body.email || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
      ...(body.specialization !== undefined ? { specialization: body.specialization || null } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  await recordAudit(prisma, {
    actorId: auth.userId,
    actorRole: auth.role,
    action: 'INSTRUCTOR_UPDATED',
    entityType: 'Instructor',
    entityId: id,
    requestId: req.requestId,
    ip: req.ip,
    metadata: { fields: Object.keys(body) },
  });

  res.json({ data: serialize(instructor) });
});

instructorsRouter.delete('/:id', requirePermission('instructor.manage'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const batches = await prisma.batch.count({ where: { instructorId: id } });
  if (batches > 0) throw conflict('This instructor is assigned to batches. Deactivate the profile instead.');
  await prisma.instructor.delete({ where: { id } });
  res.status(204).send();
});
