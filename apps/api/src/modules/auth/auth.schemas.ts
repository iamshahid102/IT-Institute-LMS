import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must include at least one letter.')
  .regex(/\d/, 'Password must include at least one number.');

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .pipe(z.email('Enter a valid email address.'))
  .transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.').max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(16, 'This reset link is invalid.').max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.').max(128),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'The new password must be different from the current password.',
  });
