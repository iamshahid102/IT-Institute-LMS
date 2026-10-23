import type { User } from '@prisma/client';
import { permissionsForRole } from '@lms/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { sendPasswordResetEmail } from '../../services/mailer';
import { recordAudit } from '../../utils/audit';
import { hashPassword, randomToken, sha256, verifyPassword } from '../../utils/crypto';
import { invalidCredentials, notFound, validationError } from '../../utils/errors';
import { createSession, revokeAllSessions, revokeSession } from './session.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = hashPassword(randomToken(16));
  return dummyHash;
}

export interface RequestMeta {
  ip?: string | null;
  requestId?: string | null;
}

export function publicUser(user: User, studentId?: string | null) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    ...(studentId ? { studentId } : {}),
    permissions: permissionsForRole(user.role),
  };
}

export async function login(email: string, password: string, meta: RequestMeta) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { student: { select: { id: true, status: true } } },
  });

  if (!user) {
    // Equalise response time so absent accounts are not detectable.
    await verifyPassword(await getDummyHash(), password);
    throw invalidCredentials();
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid || user.status !== 'ACTIVE') {
    throw invalidCredentials();
  }

  if (user.role === 'STUDENT' && (!user.student || user.student.status === 'ARCHIVED')) {
    throw invalidCredentials();
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = await createSession(user.id, meta.ip ?? null);

  await recordAudit(prisma, {
    actorId: user.id,
    actorRole: user.role,
    action: 'AUTH_LOGIN',
    entityType: 'User',
    entityId: user.id,
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { token, user: publicUser(user, user.student?.id) };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: { select: { id: true } } },
  });
  if (!user) throw notFound('Account not found.');
  return publicUser(user, user.student?.id);
}

export async function revokeAllForUser(userId: string, meta: RequestMeta): Promise<void> {
  await revokeAllSessions(userId);
  await recordAudit(prisma, {
    actorId: userId,
    action: 'AUTH_ALL_SESSIONS_REVOKED',
    entityType: 'User',
    entityId: userId,
    requestId: meta.requestId,
    ip: meta.ip,
  });
}

export async function logout(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
  await revokeSession(sessionId);
  await recordAudit(prisma, {
    actorId: userId,
    action: 'AUTH_LOGOUT',
    entityType: 'User',
    entityId: userId,
    requestId: meta.requestId,
    ip: meta.ip,
  });
}

export async function requestPasswordReset(email: string, meta: RequestMeta): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') {
    // Always return the same response to avoid account enumeration.
    return;
  }

  const token = randomToken(32);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.create({
      data: {
        tokenHash: sha256(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
  });

  const resetUrl = `${env.APP_PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const delivered = await sendPasswordResetEmail(user.email, resetUrl);

  await recordAudit(prisma, {
    actorId: user.id,
    actorRole: user.role,
    action: 'AUTH_PASSWORD_RESET_REQUESTED',
    entityType: 'User',
    entityId: user.id,
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { emailDelivered: delivered },
  });
}

export async function resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw validationError([
      { field: 'token', message: 'This password reset link is invalid or has expired.' },
    ]);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await tx.authSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  await recordAudit(prisma, {
    actorId: record.userId,
    actorRole: record.user.role,
    action: 'AUTH_PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: record.userId,
    requestId: meta.requestId,
    ip: meta.ip,
  });
}

export async function changePassword(
  userId: string,
  sessionId: string,
  currentPassword: string,
  newPassword: string,
  meta: RequestMeta,
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Account not found.');

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw validationError([{ field: 'currentPassword', message: 'Current password is incorrect.' }]);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllSessions(userId);
  await revokeSession(sessionId);
  const token = await createSession(userId, meta.ip ?? null);

  await recordAudit(prisma, {
    actorId: userId,
    actorRole: user.role,
    action: 'AUTH_PASSWORD_CHANGED',
    entityType: 'User',
    entityId: userId,
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return token;
}

export async function issueResetLink(
  actorId: string,
  actorRole: User['role'],
  targetUserId: string,
  meta: RequestMeta,
): Promise<{ resetUrl: string; expiresAt: Date }> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw notFound('Account not found.');

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.create({
      data: { tokenHash: sha256(token), userId: user.id, expiresAt },
    });
  });

  await recordAudit(prisma, {
    actorId,
    actorRole,
    action: 'AUTH_RESET_LINK_ISSUED',
    entityType: 'User',
    entityId: targetUserId,
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return {
    resetUrl: `${env.APP_PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`,
    expiresAt,
  };
}
