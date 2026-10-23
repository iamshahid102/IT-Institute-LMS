import { z } from 'zod';
import { dateOnlySchema } from '../../utils/dates';
import { paginationSchema } from '../../utils/validate';

const amountMinor = z.coerce
  .number()
  .int('Amounts are expressed in minor units (paisa).')
  .min(0)
  .max(2_000_000_000);

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(2, 'Enter an item description.').max(160),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
  unitAmountMinor: amountMinor,
  itemType: z.enum(['TUITION', 'ADMISSION', 'EXAM', 'MATERIAL', 'OTHER']).default('TUITION'),
});

export const createInvoiceSchema = z.object({
  enrollmentId: z.uuid('Select an enrollment.'),
  issuedAt: dateOnlySchema.optional(),
  dueAt: dateOnlySchema,
  discountMinor: amountMinor.default(0),
  notes: z.string().trim().max(500).optional(),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one invoice item.').max(30),
});

export const createInvoicePlanSchema = z.object({
  enrollmentId: z.uuid('Select an enrollment.'),
  installmentCount: z.coerce.number().int().min(1).max(12),
  firstDueAt: dateOnlySchema,
  intervalDays: z.coerce.number().int().min(7).max(180).default(30),
  notes: z.string().trim().max(500).optional(),
});

export const listInvoicesQuerySchema = paginationSchema.extend({
  studentId: z.uuid().optional(),
  enrollmentId: z.uuid().optional(),
  status: z.enum(['ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(120).optional(),
  dueFrom: dateOnlySchema.optional(),
  dueTo: dateOnlySchema.optional(),
});

export const createPaymentSchema = z.object({
  invoiceId: z.uuid('Select an invoice.'),
  amountMinor: amountMinor.refine((value) => value > 0, 'Enter a payment amount greater than zero.'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'JAZZCASH', 'EASYPAISA', 'CHEQUE', 'OTHER']),
  reference: z.string().trim().max(80).optional(),
  receivedAt: z.iso.datetime({ offset: true }).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const reversePaymentSchema = z.object({
  amountMinor: amountMinor.refine((value) => value > 0, 'Enter an amount greater than zero.').optional(),
  reason: z.string().trim().min(5, 'Provide a reason for the reversal.').max(500),
});

export const listPaymentsQuerySchema = paginationSchema.extend({
  studentId: z.uuid().optional(),
  invoiceId: z.uuid().optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'JAZZCASH', 'EASYPAISA', 'CHEQUE', 'OTHER']).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  search: z.string().trim().max(120).optional(),
});

const feePlanItemSchema = z.object({
  description: z.string().trim().min(2).max(160),
  amountMinor,
});

export const createFeePlanSchema = z.object({
  name: z.string().trim().min(2, 'Enter a plan name.').max(120),
  courseId: z.uuid().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default('PKR'),
  installmentCount: z.coerce.number().int().min(1).max(12).default(1),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().default(true),
  items: z.array(feePlanItemSchema).min(1, 'Add at least one plan item.').max(20),
});
