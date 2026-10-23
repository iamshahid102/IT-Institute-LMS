import { z } from 'zod';
import { dateOnlySchema } from '../../utils/dates';
import { paginationSchema } from '../../utils/validate';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time, for example 09:30.');

export const scheduleSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
    room: z.string().trim().max(60).optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    path: ['endTime'],
    message: 'The end time must be after the start time.',
  });

export const createBatchSchema = z
  .object({
    courseId: z.uuid('Select a course.'),
    instructorId: z.uuid().nullable().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{2,30}$/, 'Use 2-30 characters: letters, numbers or dashes.'),
    name: z.string().trim().min(3, 'Enter the batch name.').max(160),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    capacity: z.coerce.number().int().min(1).max(500),
    status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('PLANNED'),
    notes: z.string().trim().max(1000).optional(),
    schedules: z.array(scheduleSchema).max(14).default([]),
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'The end date must be on or after the start date.',
  });

export const updateBatchSchema = z
  .object({
    instructorId: z.uuid().nullable().optional(),
    name: z.string().trim().min(3).max(160).optional(),
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
    capacity: z.coerce.number().int().min(1).max(500).optional(),
    status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    schedules: z.array(scheduleSchema).max(14).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No changes were supplied.' });

export const listBatchesQuerySchema = paginationSchema.extend({
  courseId: z.uuid().optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  search: z.string().trim().max(120).optional(),
});
