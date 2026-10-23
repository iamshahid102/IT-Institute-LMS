import { z } from 'zod';
import { dateOnlySchema } from '../../utils/dates';
import { paginationSchema } from '../../utils/validate';

export const createSessionSchema = z
  .object({
    batchId: z.uuid('Select a batch.'),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    topic: z.string().trim().max(160).optional(),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    path: ['endsAt'],
    message: 'The end time must be after the start time.',
  });

export const listSessionsQuerySchema = paginationSchema.extend({
  batchId: z.uuid().optional(),
  status: z.enum(['SCHEDULED', 'OPEN', 'FINALIZED', 'CANCELLED']).optional(),
  date: dateOnlySchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

export const scanSchema = z.object({
  sessionId: z.uuid('Select a session.'),
  qrToken: z.string().min(16, 'Scan a valid attendance code.').max(300),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const manualAttendanceSchema = z.object({
  sessionId: z.uuid('Select a session.'),
  studentNumber: z.string().trim().min(3, 'Enter a student number.').max(40),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  remarks: z.string().trim().max(300).optional(),
});

export const correctAttendanceSchema = z.object({
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  reason: z.string().trim().min(5, 'Provide a reason for the correction.').max(500),
});

export const attendanceReportQuerySchema = z.object({
  batchId: z.uuid().optional(),
  studentId: z.uuid().optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
