import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../config/env';

const skipInTest = () => env.isTest;

function makeLimiter(windowMs: number, limit: number, message: string): RequestHandler {
  return rateLimit({
    windowMs,
    limit: env.isTest ? 100_000 : limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: skipInTest,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message,
        requestId: 'rate-limited',
      },
    },
  });
}

export const loginLimiter = makeLimiter(
  15 * 60 * 1000,
  10,
  'Too many sign-in attempts. Please wait fifteen minutes and try again.',
);

export const passwordResetLimiter = makeLimiter(
  60 * 60 * 1000,
  5,
  'Too many password reset requests. Please try again later.',
);

export const publicVerificationLimiter = makeLimiter(
  60 * 1000,
  30,
  'Too many verification requests. Please try again shortly.',
);

export const scanLimiter = makeLimiter(
  60 * 1000,
  120,
  'Too many attendance scans. Please slow down and try again.',
);

export const apiLimiter = makeLimiter(60 * 1000, 600, 'Too many requests. Please try again shortly.');
