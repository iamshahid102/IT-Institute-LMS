import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { dateOnlySchema } from '../../utils/dates';
import { paginationMeta, paginationSchema, parseQuery } from '../../utils/validate';

const querySchema = paginationSchema.extend({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(60).optional(),
  actorId: z.uuid().optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requirePermission('audit.read'), async (req, res) => {
  const query = parseQuery(querySchema, req);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lt: new Date(query.to.getTime() + 24 * 60 * 60 * 1000) } : {}),
          },
        }
      : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  res.json({ data: logs, meta: paginationMeta(query.page, query.pageSize, total) });
});
