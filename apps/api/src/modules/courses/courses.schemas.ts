import { z } from 'zod';
import { paginationSchema } from '../../utils/validate';

export const createCourseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Use 2-20 characters: letters, numbers or dashes.'),
  title: z.string().trim().min(3, 'Enter the course title.').max(160),
  description: z.string().trim().max(2000).optional(),
  durationValue: z.coerce.number().int().min(1).max(520),
  durationUnit: z.enum(['WEEKS', 'MONTHS']),
  defaultFeeMinor: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export const updateCourseSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    durationValue: z.coerce.number().int().min(1).max(520).optional(),
    durationUnit: z.enum(['WEEKS', 'MONTHS']).optional(),
    defaultFeeMinor: z.coerce.number().int().min(0).max(2_000_000_000).nullable().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No changes were supplied.' });

export const listCoursesQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});
