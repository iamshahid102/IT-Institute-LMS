import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.SESSION_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: env.sessionTtlMs,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, baseOptions());
}

export function getSessionToken(req: Request): string | undefined {
  const value: unknown = req.cookies?.[env.SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(env.CSRF_COOKIE_NAME, token, {
    ...baseOptions(),
    httpOnly: false,
    maxAge: env.sessionTtlMs,
  });
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(env.CSRF_COOKIE_NAME, { ...baseOptions(), httpOnly: false });
}
