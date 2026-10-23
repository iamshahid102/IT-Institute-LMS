import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { randomToken, safeEqual } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { setCsrfCookie } from '../utils/cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Issues the readable half of the double-submit CSRF token on first contact. */
export const ensureCsrfCookie: RequestHandler = (req, res, next) => {
  const existing: unknown = req.cookies?.[env.CSRF_COOKIE_NAME];
  if (typeof existing !== 'string' || existing.length < 16) {
    const token = randomToken(32);
    res.locals.csrfToken = token;
    setCsrfCookie(res, token);
  }
  next();
};

/** Every unsafe request must echo the CSRF cookie in the X-CSRF-Token header. */
export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieValue: unknown = req.cookies?.[env.CSRF_COOKIE_NAME];
  const headerValue = req.get('x-csrf-token');

  if (typeof cookieValue !== 'string' || !headerValue || !safeEqual(cookieValue, headerValue)) {
    next(new AppError(403, 'CSRF_INVALID', 'Your session security token is missing or invalid. Refresh the page and try again.'));
    return;
  }

  next();
};
