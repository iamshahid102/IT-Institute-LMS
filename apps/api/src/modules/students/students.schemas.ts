import { z } from 'zod';
import { dateOnlySchema, optionalDateOnlySchema } from '../../utils/dates';
import { paginationSchema } from '../../utils/validate';
import { passwordSchema } from '../auth/auth.schemas';

const optionalEmail = z
  .union([z.literal(''), z.string().trim().pipe(z.email('Enter a valid email address.'))])
  .optional()
  .transform((value) => (value === '' ? undefined : value?.toLowerCase()));

export const createStudentSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the student name.').max(120),
    guardianName: z.string().trim().max(120).optional(),
    phone: z.string().trim().min(7, 'Enter a contact number.').max(30),
    email: optionalEmail,
    address: z.string().trim().max(240).optional(),
    dateOfBirth: optionalDateOnlySchema,
    admissionDate: dateOnlySchema.optional(),
    notes: z.string().trim().max(1000).optional(),
    portalPassword: passwordSchema.optional(),
  })
  .refine((value) => !value.portalPassword || Boolean(value.email), {
    path: ['portalPassword'],
    message: 'A portal account requires an email address.',
  });

export const updateStudentSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    guardianName: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    email: optionalEmail,
    address: z.string().trim().max(240).nullable().optional(),
    dateOfBirth: optionalDateOnlySchema,
    notes: z.string().trim().max(1000).nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No changes were supplied.' });

export const listStudentsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN', 'ARCHIVED']).optional(),
  courseId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  admissionFrom: dateOnlySchema.optional(),
  admissionTo: dateOnlySchema.optional(),
  sort: z.enum(['studentNumber', 'fullName', 'admissionDate', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const createStudentAccountSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email('Enter a valid email address.'))
    .transform((value) => value.toLowerCase()),
  password: passwordSchema,
});
