import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { recordAudit } from '../../utils/audit';
import { businessRule, notFound } from '../../utils/errors';
import {
  idParamSchema,
  paginationMeta,
  paginationSchema,
  parseBody,
  parseParams,
  parseQuery,
} from '../../utils/validate';

const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Enter an announcement title.').max(160),
  body: z.string().trim().min(10, 'Enter the announcement body.').max(5000),
  audience: z.enum(['EVERYONE', 'STUDENTS', 'STAFF']).default('STUDENTS'),
  batchId: z.uuid().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
});

const listQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  audience: z.enum(['EVERYONE', 'STUDENTS', 'STAFF']).optional(),
  search: z.string().trim().max(120).optional(),
});

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

async function notifyPublishedAnnouncement(announcement: {
  id: string;
  title: string;
  body: string;
  audience: 'EVERYONE' | 'STUDENTS' | 'STAFF';
  batchId: string | null;
}) {
  if (announcement.audience === 'STAFF') return;

  const users = await prisma.user.findMany({
    where: {
      role: announcement.audience === 'STUDENTS' ? 'STUDENT' : undefined,
      status: 'ACTIVE',
      ...(announcement.batchId
        ? { student: { enrollments: { some: { batchId: announcement.batchId, status: 'ACTIVE' } } } }
        : {}),
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type: 'ANNOUNCEMENT',
      title: announcement.title,
      body: announcement.body.slice(0, 240),
      link: '/student/announcements',
    })),
  });
}

export const announcementsRouter = Router();
announcementsRouter.use(requireAuth);

function actor(req: Parameters<typeof getAuth>[0]): ActorMeta {
  const auth = getAuth(req);
  return { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip };
}

announcementsRouter.get('/', requirePermission('announcement.read'), async (req, res) => {
  const query = parseQuery(listQuerySchema, req);
  const where: Prisma.AnnouncementWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.audience ? { audience: query.audience } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { body: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, announcements] = await prisma.$transaction([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      include: { createdBy: { select: { id: true, fullName: true } } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  res.json({ data: announcements, meta: paginationMeta(query.page, query.pageSize, total) });
});

announcementsRouter.post('/', requirePermission('announcement.manage'), async (req, res) => {
  const body = parseBody(announcementSchema, req);
  if (body.batchId) {
    const batch = await prisma.batch.findUnique({ where: { id: body.batchId } });
    if (!batch) throw notFound('Batch not found.');
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: body.title,
      body: body.body,
      audience: body.audience,
      batchId: body.batchId ?? null,
      status: body.status,
      publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
      createdById: getAuth(req).userId,
    },
  });

  if (announcement.status === 'PUBLISHED') {
    await notifyPublishedAnnouncement(announcement);
  }

  await recordAudit(prisma, {
    ...actor(req),
    action: 'ANNOUNCEMENT_CREATED',
    entityType: 'Announcement',
    entityId: announcement.id,
    metadata: { status: announcement.status, audience: announcement.audience },
  });

  res.status(201).json({ data: announcement });
});

announcementsRouter.patch('/:id', requirePermission('announcement.manage'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(announcementSchema.partial(), req);

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw notFound('Announcement not found.');
  if (existing.status === 'ARCHIVED') throw businessRule('Archived announcements cannot be edited.');

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.audience !== undefined ? { audience: body.audience } : {}),
      ...(body.batchId !== undefined ? { batchId: body.batchId } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.status === 'PUBLISHED' && !existing.publishedAt
        ? { publishedAt: new Date() }
        : {}),
    },
  });

  const newlyPublished = existing.status !== 'PUBLISHED' && announcement.status === 'PUBLISHED';
  if (newlyPublished) await notifyPublishedAnnouncement(announcement);

  await recordAudit(prisma, {
    ...actor(req),
    action: 'ANNOUNCEMENT_UPDATED',
    entityType: 'Announcement',
    entityId: id,
    metadata: { fields: Object.keys(body) },
  });

  res.json({ data: announcement });
});
