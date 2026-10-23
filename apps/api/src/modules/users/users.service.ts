import type { Prisma, Role, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../utils/audit';
import { hashPassword } from '../../utils/crypto';
import { businessRule, conflict, forbidden, notFound } from '../../utils/errors';

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

interface ListQuery {
  page: number;
  pageSize: number;
  search?: string;
  role?: Role;
  status?: UserStatus;
}

function serialize(user: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function listStaff(query: ListQuery) {
  const where: Prisma.UserWhereInput = {
    role: query.role ?? { in: ['SUPER_ADMIN', 'FRONT_DESK'] },
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: users.map(serialize), total };
}

export async function createStaff(
  actor: ActorMeta,
  input: { fullName: string; email: string; role: Role; password: string },
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with this email address already exists.');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      status: 'ACTIVE',
      passwordHash,
    },
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'STAFF_ACCOUNT_CREATED',
    entityType: 'User',
    entityId: user.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { role: user.role, email: user.email },
  });

  return serialize(user);
}

async function assertNotLastSuperAdmin(targetId: string): Promise<void> {
  const remaining = await prisma.user.count({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: targetId } },
  });
  if (remaining === 0) {
    throw businessRule('At least one active Super Admin must remain.');
  }
}

export async function updateStaff(
  actor: ActorMeta,
  targetId: string,
  input: { fullName?: string; role?: Role; status?: UserStatus },
) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || target.role === 'STUDENT') throw notFound('Staff account not found.');

  if (actor.actorId === targetId && (input.role || input.status)) {
    throw forbidden('You cannot change your own role or account status.');
  }

  const losingSuperAdmin =
    target.role === 'SUPER_ADMIN' &&
    (input.role === 'FRONT_DESK' || (input.status !== undefined && input.status !== 'ACTIVE'));

  if (losingSuperAdmin) {
    await assertNotLastSuperAdmin(targetId);
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });

  if (input.status && input.status !== 'ACTIVE') {
    await prisma.authSession.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'STAFF_ACCOUNT_UPDATED',
    entityType: 'User',
    entityId: targetId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: {
      changed: Object.keys(input),
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  });

  return serialize(user);
}

export async function getStaff(targetId: string) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user || user.role === 'STUDENT') throw notFound('Staff account not found.');
  return serialize(user);
}
