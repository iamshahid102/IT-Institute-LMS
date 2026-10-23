import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });

const booleanFromString = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string.',
    }),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  APP_PUBLIC_URL: z.string().default('http://localhost:3000'),
  SESSION_COOKIE_NAME: z.string().min(1).default('lms_session'),
  CSRF_COOKIE_NAME: z.string().min(1).default('lms_csrf'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  COOKIE_SECURE: booleanFromString(false),
  TRUST_PROXY: booleanFromString(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./var/storage'),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromString(false),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: z.string().default('IT Institute <no-reply@example.edu>'),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: optionalString,
  SEED_ADMIN_NAME: z.string().default('Institute Administrator'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  console.error(`Invalid environment configuration:\n${issues.join('\n')}`);
  throw new Error('Invalid environment configuration');
}

const data = parsed.data;
const isProduction = data.NODE_ENV === 'production';

if (isProduction && !data.COOKIE_SECURE) {
  throw new Error('COOKIE_SECURE must be true in production.');
}
if (isProduction && !data.WEB_ORIGIN.startsWith('https://')) {
  throw new Error('WEB_ORIGIN must use HTTPS in production.');
}

export const env = {
  ...data,
  isProduction,
  isTest: data.NODE_ENV === 'test',
  isDevelopment: data.NODE_ENV === 'development',
  allowedOrigins: data.WEB_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  storageDir: path.resolve(__dirname, '../../', data.STORAGE_LOCAL_DIR),
  sessionTtlMs: data.SESSION_TTL_HOURS * 60 * 60 * 1000,
  smtpConfigured: Boolean(data.SMTP_HOST),
} as const;

export type Env = typeof env;
