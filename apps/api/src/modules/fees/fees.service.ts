import { Prisma } from '@prisma/client';
import type { InvoiceStatus, Payment, PaymentMethod, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../utils/audit';
import { sha256 } from '../../utils/crypto';
import { AppError, businessRule, conflict, notFound } from '../../utils/errors';
import { nextBusinessNumber } from '../../utils/numbers';
import { getSettings } from '../settings/settings.service';
import { buildReceiptPdf } from './receipt.pdf';

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitAmountMinor: number;
  itemType: 'TUITION' | 'ADMISSION' | 'EXAM' | 'MATERIAL' | 'OTHER';
}

function netPaid(payments: Array<{ amountMinor: number; reversedAmountMinor: number }>): number {
  return payments.reduce((sum, payment) => sum + payment.amountMinor - payment.reversedAmountMinor, 0);
}

export function deriveInvoiceStatus(totalMinor: number, paidMinor: number): InvoiceStatus {
  if (paidMinor >= totalMinor) return 'PAID';
  if (paidMinor > 0) return 'PARTIALLY_PAID';
  return 'ISSUED';
}

async function recomputeInvoiceStatus(tx: Prisma.TransactionClient, invoiceId: string): Promise<InvoiceStatus> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { select: { amountMinor: true, reversedAmountMinor: true } } },
  });
  if (!invoice) throw notFound('Invoice not found.');
  if (invoice.status === 'VOID') return invoice.status;

  const status = deriveInvoiceStatus(invoice.totalMinor, netPaid(invoice.payments));
  if (status !== invoice.status) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  }
  return status;
}

async function assertEnrollmentForBilling(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: { select: { id: true, fullName: true, studentNumber: true, status: true } },
      batch: { select: { code: true, name: true } },
    },
  });
  if (!enrollment) throw notFound('Enrollment not found.');
  if (enrollment.student.status === 'ARCHIVED') {
    throw businessRule('Archived students cannot receive new invoices.');
  }
  return enrollment;
}

export async function createInvoice(
  actor: ActorMeta,
  input: {
    enrollmentId: string;
    issuedAt?: Date;
    dueAt: Date;
    discountMinor: number;
    notes?: string;
    items: InvoiceItemInput[];
  },
) {
  await assertEnrollmentForBilling(input.enrollmentId);

  const lines = input.items.map((item) => ({
    ...item,
    lineTotalMinor: item.quantity * item.unitAmountMinor,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  if (subtotal <= 0) throw businessRule('The invoice subtotal must be greater than zero.');
  if (input.discountMinor > subtotal) throw businessRule('The discount cannot exceed the invoice subtotal.');
  const total = subtotal - input.discountMinor;

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextBusinessNumber(tx, 'invoice', 'INV', input.issuedAt);
    return tx.invoice.create({
      data: {
        invoiceNumber,
        enrollmentId: input.enrollmentId,
        issuedAt: input.issuedAt ?? new Date(),
        dueAt: input.dueAt,
        subtotalMinor: subtotal,
        discountMinor: input.discountMinor,
        totalMinor: total,
        notes: input.notes ?? null,
        createdById: actor.actorId,
        items: { create: lines },
      },
      include: {
        items: true,
        enrollment: {
          include: {
            student: { select: { id: true, studentNumber: true, fullName: true } },
            batch: { select: { code: true, name: true } },
          },
        },
      },
    });
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'INVOICE_CREATED',
    entityType: 'Invoice',
    entityId: invoice.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      totalMinor: invoice.totalMinor,
      enrollmentId: invoice.enrollmentId,
    },
  });

  return invoice;
}

export async function createInvoicePlan(
  actor: ActorMeta,
  input: {
    enrollmentId: string;
    installmentCount: number;
    firstDueAt: Date;
    intervalDays: number;
    notes?: string;
  },
) {
  const enrollment = await assertEnrollmentForBilling(input.enrollmentId);
  const total = enrollment.agreedFeeMinor;
  if (total <= 0) throw businessRule('Set an agreed fee before generating an installment plan.');

  const base = Math.floor(total / input.installmentCount);
  const amounts = Array.from({ length: input.installmentCount }, (_, index) =>
    index === input.installmentCount - 1 ? total - base * (input.installmentCount - 1) : base,
  );

  const invoices = await prisma.$transaction(async (tx) => {
    const created = [];
    for (let index = 0; index < amounts.length; index += 1) {
      const amount = amounts[index]!;
      const dueAt = new Date(input.firstDueAt);
      dueAt.setUTCDate(dueAt.getUTCDate() + index * input.intervalDays);
      const invoiceNumber = await nextBusinessNumber(tx, 'invoice', 'INV');
      created.push(
        await tx.invoice.create({
          data: {
            invoiceNumber,
            enrollmentId: input.enrollmentId,
            issuedAt: new Date(),
            dueAt,
            subtotalMinor: amount,
            discountMinor: 0,
            totalMinor: amount,
            notes: input.notes ? `${input.notes} — installment ${index + 1}` : `Installment ${index + 1}`,
            createdById: actor.actorId,
            items: {
              create: [
                {
                  description: `Installment ${index + 1} of ${input.installmentCount}`,
                  quantity: 1,
                  unitAmountMinor: amount,
                  lineTotalMinor: amount,
                  itemType: 'TUITION' as const,
                },
              ],
            },
          },
        }),
      );
    }
    return created;
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'INVOICE_PLAN_CREATED',
    entityType: 'Enrollment',
    entityId: input.enrollmentId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { installments: input.installmentCount, totalMinor: total },
  });

  return invoices;
}

export async function listInvoices(query: {
  page: number;
  pageSize: number;
  studentId?: string;
  enrollmentId?: string;
  status?: InvoiceStatus;
  overdue?: boolean;
  search?: string;
  dueFrom?: Date;
  dueTo?: Date;
}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const where: Prisma.InvoiceWhereInput = {
    ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
    ...(query.studentId ? { enrollment: { studentId: query.studentId } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.overdue
      ? { dueAt: { lt: today }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } }
      : {}),
    ...(query.dueFrom || query.dueTo
      ? {
          dueAt: {
            ...(query.dueFrom ? { gte: query.dueFrom } : {}),
            ...(query.dueTo ? { lte: query.dueTo } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
            { enrollment: { student: { fullName: { contains: query.search, mode: 'insensitive' } } } },
            { enrollment: { student: { studentNumber: { contains: query.search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const [total, invoices] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        payments: { select: { amountMinor: true, reversedAmountMinor: true } },
        enrollment: {
          select: {
            id: true,
            student: { select: { id: true, studentNumber: true, fullName: true } },
            batch: { select: { code: true, name: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: invoices.map(({ payments, ...invoice }) => {
      const paidMinor = netPaid(payments);
      return {
        ...invoice,
        paidMinor,
        outstandingMinor: invoice.totalMinor - paidMinor,
      };
    }),
    total,
  };
}

export async function getInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: { orderBy: { description: 'asc' } },
      payments: {
        orderBy: { receivedAt: 'desc' },
        include: { reversals: true },
      },
      enrollment: {
        include: {
          student: { select: { id: true, studentNumber: true, fullName: true, phone: true, email: true } },
          batch: { select: { code: true, name: true, course: { select: { title: true, code: true } } } },
        },
      },
    },
  });
  if (!invoice) throw notFound('Invoice not found.');
  const paidMinor = netPaid(invoice.payments);
  return {
    ...invoice,
    paidMinor,
    outstandingMinor: invoice.totalMinor - paidMinor,
  };
}

export async function getStudentLedger(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, studentNumber: true, fullName: true, status: true },
  });
  if (!student) throw notFound('Student not found.');

  const invoices = await prisma.invoice.findMany({
    where: { enrollment: { studentId }, status: { not: 'VOID' } },
    include: {
      payments: { include: { reversals: true }, orderBy: { receivedAt: 'asc' } },
      enrollment: {
        select: { id: true, batch: { select: { code: true, name: true, course: { select: { title: true } } } } },
      },
    },
    orderBy: { issuedAt: 'asc' },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const entries: Array<{
    type: 'INVOICE' | 'PAYMENT' | 'REVERSAL';
    date: Date;
    reference: string;
    description: string;
    debitMinor: number;
    creditMinor: number;
    invoiceId: string;
    paymentId?: string;
  }> = [];

  let billedMinor = 0;
  let paidMinor = 0;
  let outstandingMinor = 0;
  let overdueMinor = 0;

  for (const invoice of invoices) {
    billedMinor += invoice.totalMinor;
    outstandingMinor += invoice.totalMinor;
    const overdue = invoice.dueAt < today && invoice.totalMinor - netPaid(invoice.payments) > 0;

    entries.push({
      type: 'INVOICE',
      date: invoice.issuedAt,
      reference: invoice.invoiceNumber,
      description: `${invoice.enrollment.batch.course.title} — ${invoice.enrollment.batch.code}`,
      debitMinor: invoice.totalMinor,
      creditMinor: 0,
      invoiceId: invoice.id,
    });

    for (const payment of invoice.payments) {
      entries.push({
        type: 'PAYMENT',
        date: payment.receivedAt,
        reference: payment.paymentNumber,
        description: `Payment received (${payment.method.replace('_', ' ').toLowerCase()})`,
        debitMinor: 0,
        creditMinor: payment.amountMinor,
        invoiceId: invoice.id,
        paymentId: payment.id,
      });
      paidMinor += payment.amountMinor;
      outstandingMinor -= payment.amountMinor;

      for (const reversal of payment.reversals) {
        entries.push({
          type: 'REVERSAL',
          date: reversal.createdAt,
          reference: `${payment.paymentNumber} reversal`,
          description: reversal.reason,
          debitMinor: reversal.amountMinor,
          creditMinor: 0,
          invoiceId: invoice.id,
          paymentId: payment.id,
        });
        paidMinor -= reversal.amountMinor;
        outstandingMinor += reversal.amountMinor;
      }
    }

    const invoiceOutstanding = invoice.totalMinor - netPaid(invoice.payments);
    if (overdue && invoiceOutstanding > 0) overdueMinor += invoiceOutstanding;
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    student,
    entries,
    summary: {
      billedMinor,
      paidMinor,
      outstandingMinor,
      overdueMinor,
      invoiceCount: invoices.length,
    },
  };
}

export async function createPayment(
  actor: ActorMeta,
  input: {
    invoiceId: string;
    amountMinor: number;
    method: PaymentMethod;
    reference?: string;
    receivedAt?: string;
    notes?: string;
  },
  idempotencyKey: string,
) {
  const requestHash = sha256(
    JSON.stringify({
      invoiceId: input.invoiceId,
      amountMinor: input.amountMinor,
      method: input.method,
      reference: input.reference ?? null,
      receivedAt: input.receivedAt ?? null,
      notes: input.notes ?? null,
    }),
  );
  const operation = 'payment.create';

  const existing = await prisma.idempotencyRecord.findUnique({
    where: { actorId_operation_key: { actorId: actor.actorId, operation, key: idempotencyKey } },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AppIdempotencyConflict();
    }
    const stored = existing.responseBody as { paymentId?: string } | null;
    if (stored?.paymentId) {
      return { payment: await getPayment(stored.paymentId), replayed: true };
    }
    throw conflict('This request was already processed.');
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: {
      payments: { select: { amountMinor: true, reversedAmountMinor: true } },
      enrollment: {
        select: {
          student: { select: { id: true, userId: true, fullName: true } },
          batch: { select: { code: true } },
        },
      },
    },
  });
  if (!invoice) throw notFound('Invoice not found.');
  if (invoice.status === 'VOID') throw businessRule('Payments cannot be posted to a void invoice.');

  const alreadyPaid = netPaid(invoice.payments);
  const outstanding = invoice.totalMinor - alreadyPaid;
  if (outstanding <= 0) throw businessRule('This invoice is already fully paid.');
  if (input.amountMinor > outstanding) {
    throw businessRule(
      `The amount exceeds the outstanding balance of ${outstanding} minor units on this invoice.`,
    );
  }

  if (input.reference) {
    const duplicateReference = await prisma.payment.findFirst({
      where: { method: input.method, reference: input.reference },
    });
    if (duplicateReference) {
      throw conflict('A payment with this reference already exists for the selected method.');
    }
  }

  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
  if (receivedAt.getTime() > Date.now() + 60 * 60 * 1000) {
    throw businessRule('The received date cannot be in the future.');
  }

  const settings = await getSettings();

  try {
    const paymentId = await prisma.$transaction(async (tx) => {
      const paymentNumber = await nextBusinessNumber(tx, 'receipt', settings.receiptPrefix);
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          amountMinor: input.amountMinor,
          currency: invoice.currency,
          method: input.method,
          reference: input.reference ?? null,
          receivedAt,
          receivedById: actor.actorId,
          notes: input.notes ?? null,
        },
      });

      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          allocatedAmountMinor: input.amountMinor,
        },
      });

      await recomputeInvoiceStatus(tx, invoice.id);

      await tx.idempotencyRecord.create({
        data: {
          actorId: actor.actorId,
          operation,
          key: idempotencyKey,
          requestHash,
          statusCode: 201,
          responseBody: { paymentId: payment.id },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      if (invoice.enrollment.student.userId) {
        await tx.notification.create({
          data: {
            userId: invoice.enrollment.student.userId,
            type: 'PAYMENT_RECEIVED',
            title: 'Payment received',
            body: `We received a payment of ${input.amountMinor / 100} ${invoice.currency} against invoice ${invoice.invoiceNumber}.`,
            link: '/student/fees/receipts',
          },
        });
      }

      return payment.id;
    });

    await recordAudit(prisma, {
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: 'PAYMENT_POSTED',
      entityType: 'Payment',
      entityId: paymentId,
      requestId: actor.requestId,
      ip: actor.ip,
      metadata: {
        invoiceId: invoice.id,
        amountMinor: input.amountMinor,
        method: input.method,
      },
    });

    return { payment: await getPayment(paymentId), replayed: false };
  } catch (error) {
    // A concurrent retry may have inserted the idempotency row first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const record = await prisma.idempotencyRecord.findUnique({
        where: { actorId_operation_key: { actorId: actor.actorId, operation, key: idempotencyKey } },
      });
      const stored = record?.responseBody as { paymentId?: string } | null;
      if (record && stored?.paymentId) {
        return { payment: await getPayment(stored.paymentId), replayed: true };
      }
    }
    throw error;
  }
}

/** Raised when the same idempotency key is reused with a different request body. */
export class AppIdempotencyConflict extends AppError {
  constructor() {
    super(
      409,
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key was already used with a different payment request.',
    );
  }
}

function serializePayment(payment: Payment & {
  invoice: {
    id: string;
    invoiceNumber: string;
    totalMinor: number;
    status: InvoiceStatus;
    dueAt: Date;
    enrollment: {
      id: string;
      student: { id: string; studentNumber: string; fullName: string };
      batch: { code: string; name: string };
    };
  };
  reversals: Array<{ id: string; amountMinor: number; reason: string; createdAt: Date }>;
  receivedBy: { id: string; fullName: string };
}) {
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    invoiceId: payment.invoiceId,
    amountMinor: payment.amountMinor,
    reversedAmountMinor: payment.reversedAmountMinor,
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    reference: payment.reference,
    receivedAt: payment.receivedAt,
    notes: payment.notes,
    receivedBy: payment.receivedBy,
    invoice: payment.invoice,
    reversals: payment.reversals,
  };
}

export async function getPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      reversals: { orderBy: { createdAt: 'desc' } },
      receivedBy: { select: { id: true, fullName: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalMinor: true,
          status: true,
          dueAt: true,
          enrollment: {
            select: {
              id: true,
              student: { select: { id: true, studentNumber: true, fullName: true } },
              batch: { select: { code: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!payment) throw notFound('Payment not found.');
  return serializePayment(payment);
}

export async function listPayments(query: {
  page: number;
  pageSize: number;
  studentId?: string;
  invoiceId?: string;
  method?: PaymentMethod;
  from?: Date;
  to?: Date;
  search?: string;
}) {
  const where: Prisma.PaymentWhereInput = {
    ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
    ...(query.studentId ? { invoice: { enrollment: { studentId: query.studentId } } } : {}),
    ...(query.method ? { method: query.method } : {}),
    ...(query.from || query.to
      ? {
          receivedAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: new Date(query.to.getTime() + 24 * 60 * 60 * 1000) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { paymentNumber: { contains: query.search, mode: 'insensitive' } },
            { reference: { contains: query.search, mode: 'insensitive' } },
            { invoice: { invoiceNumber: { contains: query.search, mode: 'insensitive' } } },
            { invoice: { enrollment: { student: { fullName: { contains: query.search, mode: 'insensitive' } } } } },
            {
              invoice: {
                enrollment: { student: { studentNumber: { contains: query.search, mode: 'insensitive' } } },
              },
            },
          ],
        }
      : {}),
  };

  const [total, payments] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        receivedBy: { select: { id: true, fullName: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalMinor: true,
            status: true,
            dueAt: true,
            enrollment: {
              select: {
                id: true,
                student: { select: { id: true, studentNumber: true, fullName: true } },
                batch: { select: { code: true, name: true } },
              },
            },
          },
        },
        reversals: { orderBy: { createdAt: 'desc' } },
      },
    }),
  ]);

  return { items: payments.map(serializePayment), total };
}

export async function reversePayment(
  actor: ActorMeta,
  paymentId: string,
  input: { amountMinor?: number; reason: string },
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true },
  });
  if (!payment) throw notFound('Payment not found.');

  const remaining = payment.amountMinor - payment.reversedAmountMinor;
  if (remaining <= 0) throw businessRule('This payment has already been fully reversed.');
  const amount = input.amountMinor ?? remaining;
  if (amount > remaining) {
    throw businessRule(`The reversal cannot exceed the remaining ${remaining} minor units of this payment.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentReversal.create({
      data: {
        paymentId,
        amountMinor: amount,
        reason: input.reason,
        createdById: actor.actorId,
      },
    });

    const newReversed = payment.reversedAmountMinor + amount;
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        reversedAmountMinor: newReversed,
        status: newReversed >= payment.amountMinor ? 'REVERSED' : 'PARTIALLY_REVERSED',
      },
    });

    await recomputeInvoiceStatus(tx, payment.invoiceId);
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'PAYMENT_REVERSED',
    entityType: 'Payment',
    entityId: paymentId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { amountMinor: amount, reason: input.reason, invoiceId: payment.invoiceId },
  });

  return getPayment(paymentId);
}

export async function listFeePlans() {
  const plans = await prisma.feePlan.findMany({
    include: {
      items: { orderBy: { sequence: 'asc' } },
      course: { select: { id: true, code: true, title: true } },
    },
    orderBy: { name: 'asc' },
  });
  return plans.map((plan) => ({
    ...plan,
    totalMinor: plan.items.reduce((sum, item) => sum + item.amountMinor, 0),
  }));
}

export async function createFeePlan(
  actor: ActorMeta,
  input: {
    name: string;
    courseId?: string;
    currency: string;
    installmentCount: number;
    description?: string;
    active: boolean;
    items: Array<{ description: string; amountMinor: number }>;
  },
) {
  if (input.courseId) {
    const course = await prisma.course.findUnique({ where: { id: input.courseId } });
    if (!course) throw notFound('Course not found.');
  }

  const plan = await prisma.feePlan.create({
    data: {
      name: input.name,
      courseId: input.courseId ?? null,
      currency: input.currency,
      totalFeeMinor: input.items.reduce((sum, item) => sum + item.amountMinor, 0),
      installmentCount: input.installmentCount,
      description: input.description ?? null,
      active: input.active,
      items: {
        create: input.items.map((item, index) => ({
          description: item.description,
          amountMinor: item.amountMinor,
          sequence: index + 1,
        })),
      },
    },
    include: { items: true },
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'FEE_PLAN_CREATED',
    entityType: 'FeePlan',
    entityId: plan.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { name: plan.name, totalFeeMinor: plan.totalFeeMinor },
  });

  return plan;
}

export async function getFeeCollectionsReport(from: Date, to: Date) {
  const payments = await prisma.payment.findMany({
    where: { receivedAt: { gte: from, lte: new Date(to.getTime() + 24 * 60 * 60 * 1000) } },
    include: {
      reversals: true,
      invoice: {
        select: {
          invoiceNumber: true,
          enrollment: { select: { batch: { select: { code: true } } } },
        },
      },
    },
    orderBy: { receivedAt: 'desc' },
  });

  const byMethod = new Map<string, { grossMinor: number; reversedMinor: number; count: number }>();
  let grossMinor = 0;
  let reversedMinor = 0;

  for (const payment of payments) {
    const reversed = payment.reversals.reduce((sum, reversal) => sum + reversal.amountMinor, 0);
    grossMinor += payment.amountMinor;
    reversedMinor += reversed;
    const entry = byMethod.get(payment.method) ?? { grossMinor: 0, reversedMinor: 0, count: 0 };
    entry.grossMinor += payment.amountMinor;
    entry.reversedMinor += reversed;
    entry.count += 1;
    byMethod.set(payment.method, entry);
  }

  return {
    from,
    to,
    grossMinor,
    reversedMinor,
    netMinor: grossMinor - reversedMinor,
    paymentCount: payments.length,
    byMethod: [...byMethod.entries()].map(([method, value]) => ({ method, ...value })),
    payments: payments.map((payment) => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      receivedAt: payment.receivedAt,
      method: payment.method,
      amountMinor: payment.amountMinor,
      reversedMinor: payment.reversals.reduce((sum, reversal) => sum + reversal.amountMinor, 0),
      invoiceNumber: payment.invoice.invoiceNumber,
      batchCode: payment.invoice.enrollment.batch.code,
    })),
  };
}

export async function generateReceiptPdf(paymentId: string) {
  const payment = await getPayment(paymentId);
  const settings = await getSettings();
  const invoice = await prisma.invoice.findUnique({
    where: { id: payment.invoiceId },
    select: {
      totalMinor: true,
      payments: { select: { amountMinor: true, reversedAmountMinor: true } },
    },
  });
  const paid = (invoice?.payments ?? []).reduce(
    (sum, item) => sum + item.amountMinor - item.reversedAmountMinor,
    0,
  );

  const pdf = await buildReceiptPdf({
    instituteName: settings.instituteName,
    instituteAddress: settings.addressLine,
    institutePhone: settings.phone,
    paymentNumber: payment.paymentNumber,
    receivedAt: new Date(payment.receivedAt),
    studentName: payment.invoice.enrollment.student.fullName,
    studentNumber: payment.invoice.enrollment.student.studentNumber,
    batchCode: payment.invoice.enrollment.batch.code,
    invoiceNumber: payment.invoice.invoiceNumber,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    method: payment.method,
    reference: payment.reference,
    receivedByName: payment.receivedBy.fullName,
    invoiceTotalMinor: payment.invoice.totalMinor,
    outstandingMinor: Math.max(0, (invoice?.totalMinor ?? payment.invoice.totalMinor) - paid),
  });

  return { buffer: Buffer.from(pdf), filename: `${payment.paymentNumber}.pdf`, payment };
}

export async function getOutstandingReport() {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
    include: {
      payments: { select: { amountMinor: true, reversedAmountMinor: true } },
      enrollment: {
        include: {
          student: { select: { id: true, studentNumber: true, fullName: true, phone: true } },
          batch: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { dueAt: 'asc' },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const rows = invoices
    .map((invoice) => {
      const paid = netPaid(invoice.payments);
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueAt: invoice.dueAt,
        totalMinor: invoice.totalMinor,
        paidMinor: paid,
        outstandingMinor: invoice.totalMinor - paid,
        overdue: invoice.dueAt < today,
        student: invoice.enrollment.student,
        batch: invoice.enrollment.batch,
      };
    })
    .filter((row) => row.outstandingMinor > 0);

  return {
    rows,
    totals: {
      outstandingMinor: rows.reduce((sum, row) => sum + row.outstandingMinor, 0),
      overdueMinor: rows.filter((row) => row.overdue).reduce((sum, row) => sum + row.outstandingMinor, 0),
      invoiceCount: rows.length,
    },
  };
}
