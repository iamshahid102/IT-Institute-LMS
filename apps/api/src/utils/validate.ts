import type { Request } from 'express';
import { z } from 'zod';
import { validationError } from './errors';

function parseWithSchema<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : 'request',
      message: issue.message,
    }));
    throw validationError(details);
  }
  return result.data;
}

/**
 * Express 5 exposes `req.query` as a getter, so validated data is returned
 * instead of being written back onto the request object.
 */
export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return parseWithSchema(schema, req.body);
}

export function parseQuery<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return parseWithSchema(schema, req.query);
}

export function parseParams<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return parseWithSchema(schema, req.params);
}

export const idParamSchema = z.object({ id: z.uuid('A valid identifier is required.') });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function paginationMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}
