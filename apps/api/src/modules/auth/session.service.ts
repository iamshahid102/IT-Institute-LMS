import type { Role } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { randomToken, sha256 } from '../../utils/crypto';

const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

export interface ResolvedSession {
  sessionId: string;
  userId: string;
  role: Role;
  email: string;
  fullName: string;
  studentId?: string;
}

export async function createSession(userId: string, ip?: string | null): Promise<string> {
  const token = randomToken(32);
  await prisma.authSession.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + env.sessionTtlMs),
      ipHash: ip ? sha256(ip) : null,
    },
  });
  return token;
}

export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: { student: { select: { id: true, status: true } } },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  if (session.user.status !== 'ACTIVE') {
    return null;
  }
  if (session.user.role === 'STUDENT' && (!session.user.student || session.user.student.status === 'ARCHIVED')) {
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
    await prisma.authSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    role: session.user.role,
    email: session.user.email,
    fullName: session.user.fullName,
    ...(session.user.student ? { studentId: session.user.student.id } : {}),
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}
