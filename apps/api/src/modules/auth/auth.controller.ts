import type { Request, RequestHandler } from 'express';
import { env } from '../../config/env';
import { getSessionToken, setSessionCookie } from '../../utils/cookies';
import { parseBody } from '../../utils/validate';
import { getAuth } from '../../middleware/auth';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from './auth.schemas';
import * as authService from './auth.service';

function meta(req: Request) {
  return { ip: req.ip ?? null, requestId: req.requestId };
}

export const getCsrfToken: RequestHandler = (req, res) => {
  const existing: unknown = req.cookies?.[env.CSRF_COOKIE_NAME];
  const token = res.locals.csrfToken ?? (typeof existing === 'string' ? existing : null);
  res.json({ data: { csrfToken: token } });
};

export const login: RequestHandler = async (req, res) => {
  const body = parseBody(loginSchema, req);
  const result = await authService.login(body.email, body.password, meta(req));
  setSessionCookie(res, result.token);
  res.status(200).json({ data: { user: result.user } });
};

export const logout: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  await authService.logout(auth.userId, auth.sessionId, meta(req));
  const token = getSessionToken(req);
  if (token) {
    // Session is already revoked; clear the cookie regardless.
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
  }
  res.status(204).send();
};

export const me: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const user = await authService.getCurrentUser(auth.userId);
  res.json({ data: { user } });
};

export const forgotPassword: RequestHandler = async (req, res) => {
  const body = parseBody(forgotPasswordSchema, req);
  await authService.requestPasswordReset(body.email, meta(req));
  res.json({
    data: {
      message: 'If an account matches that email address, password reset instructions have been sent.',
    },
  });
};

export const resetPassword: RequestHandler = async (req, res) => {
  const body = parseBody(resetPasswordSchema, req);
  await authService.resetPassword(body.token, body.password, meta(req));
  res.json({ data: { message: 'Your password has been reset. You can now sign in.' } });
};

export const changePassword: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = parseBody(changePasswordSchema, req);
  const token = await authService.changePassword(
    auth.userId,
    auth.sessionId,
    body.currentPassword,
    body.newPassword,
    meta(req),
  );
  setSessionCookie(res, token);
  res.json({ data: { message: 'Password updated. Other sessions have been signed out.' } });
};

export const logoutAllSessions: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  await authService.revokeAllForUser(auth.userId, meta(req));
  res.status(204).send();
};
