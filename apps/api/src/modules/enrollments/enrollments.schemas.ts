import { z } from 'zod';
import { dateOnlySchema } from '../../utils/dates';
import { paginationSchema } from '../../utils/validate';

export const createEnrollmentSchema = z.object({
  studentId: z.uuid('Select a student.'),
  batchId: z.uuid('Select a batch.'),
  joinedAt: dateOnlySchema.optional(),
  agreedFeeMinor: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED']).default('ACTIVE'),
  notes: z.string().trim().max(1000).optional(),
});

export const updateEnrollmentSchema = z
  .object({
    status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED']).optional(),
    agreedFeeMinor: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
    completedAt: dateOnlySchema.nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No changes were supplied.' });

export const listEnrollmentsQuerySchema = paginationSchema.extend({
  studentId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  courseId: z.uuid().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED']).optional(),
  search: z.string().trim().max(120).optional(),
});
