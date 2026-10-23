import { z } from 'zod';

/** Accepts YYYY-MM-DD and returns a UTC midnight Date (stored as PostgreSQL `date`). */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .transform((value, ctx) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid calendar date.' });
      return z.NEVER;
    }
    return date;
  });

export const optionalDateOnlySchema = dateOnlySchema.optional();

export function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
