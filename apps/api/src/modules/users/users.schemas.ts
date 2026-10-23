import { z } from 'zod';
import { paginationSchema } from '../../utils/validate';
import { passwordSchema } from '../auth/auth.schemas';

const staffRoleSchema = z.enum(['SUPER_ADMIN', 'FRONT_DESK'], {
  message: 'Select a staff role.',
});

const emailSchema = z
  .string()
  .trim()
  .pipe(z.email('Enter a valid email address.'))
  .transform((value) => value.toLowerCase());

export const createStaffSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the staff member name.').max(120),
  email: emailSchema,
  role: staffRoleSchema,
  password: passwordSchema,
});

export const updateStaffSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the staff member name.').max(120).optional(),
    role: staffRoleSchema.optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No changes were supplied.' });

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  role: z.enum(['SUPER_ADMIN', 'FRONT_DESK']).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED']).optional(),
});
