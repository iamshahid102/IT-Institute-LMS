import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'lms-api' },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      'password',
      'currentPassword',
      'newPassword',
      'passwordHash',
      'token',
      'tokenHash',
      'qrToken',
      'verificationCode',
      'smtpPass',
    ],
    censor: '[redacted]',
  },
});
