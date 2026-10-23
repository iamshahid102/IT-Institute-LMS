import type { Request, RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { hasPermission, type Permission } from '@lms/shared';
import { getSessionToken } from '../utils/cookies';
import { forbidden, unauthorized } from '../utils/errors';
import { resolveSession } from '../modules/auth/session.service';
import type { AuthContext } from '../types/auth';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = getSessionToken(req);
    if (!token) {
      next(unauthorized());
      return;
    }
    const session = await resolveSession(token);
    if (!session) {
      next(unauthorized('Your session has expired or is no longer valid. Please sign in again.'));
      return;
    }
    req.auth = session;
    next();
  } catch (error) {
    next(error);
  }
};

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) {
      next(unauthorized());
      return;
    }
    const allowed = permissions.every((permission) => hasPermission(auth.role, permission));
    if (!allowed) {
      next(forbidden());
      return;
    }
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(auth.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}

export const requireStudent: RequestHandler = (req, _res, next) => {
  const auth = req.auth;
  if (!auth) {
    next(unauthorized());
    return;
  }
  if (auth.role !== 'STUDENT' || !auth.studentId) {
    next(forbidden('This area is only available to student accounts.'));
    return;
  }
  next();
};
