import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ApiClient, dataOf, errorOf } from '../helpers/client';
import { resetDatabase } from '../helpers/db';
import {
  createBatch,
  createCourse,
  createEnrollment,
  createStudentWithAccount,
  createUser,
  daysFromNow,
  TEST_PASSWORD,
} from '../helpers/fixtures';

let app: Express;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDatabase();
});

interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  status: string;
}

interface InvoiceDetail extends InvoiceResponse {
  paidMinor: number;
  outstandingMinor: number;
  payments: Array<{ id: string; status: string; amountMinor: number }>;
}

interface PaymentResponse {
  id: string;
  paymentNumber: string;
  amountMinor: number;
  status: string;
  reversedAmountMinor: number;
}

async function billingContext() {
  const admin = await createUser({ role: 'SUPER_ADMIN', email: 'billing-admin@institute.test' });
  const client = await ApiClient.create(app);
  await client.login(admin.email, TEST_PASSWORD);

  const course = await createCourse();
  const batch = await createBatch(course.id);
  const { student, user } = await createStudentWithAccount({ email: 'billing@student.test' });
  const enrollment = await createEnrollment({ studentId: student.id, batchId: batch.id });

  const studentClient = await ApiClient.create(app);
  await studentClient.login(user.email, TEST_PASSWORD);

  return { admin, client, course, batch, student, user, enrollment, studentClient };
}

const dueDate = () => daysFromNow(14).toISOString().slice(0, 10);

async function issueInvoice(
  client: ApiClient,
  enrollmentId: string,
  items: Array<{ description: string; unitAmountMinor: number; quantity?: number }>,
  discountMinor = 0,
): Promise<InvoiceResponse> {
  const response = await client.post('/invoices', {
    enrollmentId,
    dueAt: dueDate(),
    discountMinor,
    items: items.map((item) => ({
      description: item.description,
      quantity: item.quantity ?? 1,
      unitAmountMinor: item.unitAmountMinor,
      itemType: 'TUITION',
    })),
  });
  expect(response.status).toBe(201);
  return dataOf<InvoiceResponse>(response);
}

describe('invoices', () => {
  it('calculates invoice totals on the server from integer minor units', async () => {
    const { client, enrollment } = await billingContext();

    const invoice = await issueInvoice(
      client,
      enrollment.id,
      [
        { description: 'Tuition instalment', unitAmountMinor: 25_000_00 },
        { description: 'Lab kit', unitAmountMinor: 2_500_00, quantity: 2 },
      ],
      5_000_00,
    );

    expect(invoice.subtotalMinor).toBe(30_000_00);
    expect(invoice.discountMinor).toBe(5_000_00);
    expect(invoice.totalMinor).toBe(25_000_00);
    expect(invoice.status).toBe('ISSUED');
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
  });

  it('rejects a discount larger than the invoice subtotal', async () => {
    const { client, enrollment } = await billingContext();

    const response = await client.post('/invoices', {
      enrollmentId: enrollment.id,
      dueAt: dueDate(),
      discountMinor: 10_000,
      items: [{ description: 'Tuition', quantity: 1, unitAmountMinor: 5_000, itemType: 'TUITION' }],
    });

    expect(response.status).toBe(422);
    expect(errorOf(response).code).toBe('BUSINESS_RULE_VIOLATION');
  });
});

describe('payments', () => {
  it('posts a partial payment, updates the invoice status and reports the balance', async () => {
    const { client, enrollment } = await billingContext();
    const invoice = await issueInvoice(client, enrollment.id, [
      { description: 'Tuition', unitAmountMinor: 100_000 },
    ]);

    const payment = await client
      .post('/payments', { invoiceId: invoice.id, amountMinor: 40_000, method: 'CASH' })
      .set('Idempotency-Key', 'payment-key-partial-0001');

    expect(payment.status).toBe(201);
    const posted = dataOf<PaymentResponse>(payment);
    expect(posted.paymentNumber).toMatch(/^RCPT-\d{4}-\d{6}$/);
    expect(posted.status).toBe('POSTED');

    const detail = await client.get(`/invoices/${invoice.id}`);
    expect(detail.status).toBe(200);
    const invoiceDetail = dataOf<InvoiceDetail>(detail);
    expect(invoiceDetail.status).toBe('PARTIALLY_PAID');
    expect(invoiceDetail.paidMinor).toBe(40_000);
    expect(invoiceDetail.outstandingMinor).toBe(60_000);

    const ledger = await client.get(`/students/${enrollment.studentId}/fee-ledger`);
    expect(ledger.status).toBe(200);
    const summary = (ledger.body as { data: { summary: { billedMinor: number; paidMinor: number; outstandingMinor: number } } })
      .data.summary;
    expect(summary.billedMinor).toBe(100_000);
    expect(summary.paidMinor).toBe(40_000);
    expect(summary.outstandingMinor).toBe(60_000);
  });

  it('replays the same idempotency key without posting a second payment', async () => {
    const { client, enrollment } = await billingContext();
    const invoice = await issueInvoice(client, enrollment.id, [
      { description: 'Tuition', unitAmountMinor: 100_000 },
    ]);
    const body = { invoiceId: invoice.id, amountMinor: 25_000, method: 'CASH' as const, reference: 'SLIP-1001' };

    const first = await client.post('/payments', body).set('Idempotency-Key', 'payment-key-replay-0002');
    const second = await client
      .post('/payments', body)
      .set('Idempotency-Key', 'payment-key-replay-0002');

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(dataOf<PaymentResponse>(second).id).toBe(dataOf<PaymentResponse>(first).id);

    const detail = await client.get(`/invoices/${invoice.id}`);
    expect(dataOf<InvoiceDetail>(detail).paidMinor).toBe(25_000);
  });

  it('rejects reusing an idempotency key for a different payload', async () => {
    const { client, enrollment } = await billingContext();
    const invoice = await issueInvoice(client, enrollment.id, [
      { description: 'Tuition', unitAmountMinor: 100_000 },
    ]);

    const first = await client
      .post('/payments', { invoiceId: invoice.id, amountMinor: 10_000, method: 'CASH' })
      .set('Idempotency-Key', 'payment-key-conflict-003');
    expect(first.status).toBe(201);

    const conflicting = await client
      .post('/payments', { invoiceId: invoice.id, amountMinor: 20_000, method: 'CASH' })
      .set('Idempotency-Key', 'payment-key-conflict-003');

    expect(conflicting.status).toBe(409);
    expect(errorOf(conflicting).code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('requires an idempotency key', async () => {
    const { client, enrollment } = await billingContext();
    const invoice = await issueInvoice(client, enrollment.id, [
      { description: 'Tuition', unitAmountMinor: 100_000 },
    ]);

    const response = await client.post('/payments', {
      invoiceId: invoice.id,
      amountMinor: 10_000,
      method: 'CASH',
    });

    expect(response.status).toBe(400);
    expect(errorOf(response).details?.[0]?.field).toBe('Idempotency-Key');
  });

  it('refuses to overpay an invoice or reuse a payment reference', async () => {
    const { client, enrollment } = await billingContext();
    const invoice = await issueInvoice(client, enrollment.id, [
      { description: 'Tuition', unitAmountMinor: 50_000 },
    ]);

    const overpayment = await client
      .post('/payments', { invoiceId: invoice.id, amountMinor: 60_000, method: 'CASH' })
      .set('Idempotency-Key', 'payment-key-overpay-004');
    expect(overpayment.status).toBe(422);

    const first = await client
      .post('/payments', {
        invoiceId: invoice.id,
        amountMinor: 10_000,
        method: 'BANK_TRANSFER',
        reference: 'BANK-REF-777',
      })
      .set('Idempotency-Key', 'payment-key-reference-005');
    expect(first.status).toBe(201);

    const duplicateReference = await client
      .post('/payments', {
        invoiceId: invoice.id,
        amountMinor: 10_000,
        method: 'BANK_TRANSFER',
        reference: 'BANK-REF-777',
      })
      .set('Idempotency-Key', 'payment-key-reference-006');
    expect(duplicateReference.status).toBe(409);
  });

  it('marks an invoice fully paid once the balance is settled', async () => {
    const { client, enrollment } = await billingContext();
    const invoice = await issueInvoice(client, enrollment.id, [
      { description: 'Tuition', unitAmountMinor: 20_000 },
    ]);

    await client
      .post('/payments', { invoiceId: invoice.id, amountMinor: 20_000, method: 'CASH' })
      .set('Idempotency-Key', 'payment-key-settle-007');

    const detail = await client.get(`/invoices/${invoice.id}`);
    const invoiceDetail = dataOf<InvoiceDetail>(detail);
    expect(invoiceDetail.status).toBe('PAID');
    expect(invoiceDetail.outstandingMinor).toBe(0);

    const extra = await client
      .post('/payments', { invoiceId: invoice.id, amountMinor: 1_000, method: 'CASH' })
      .set('Idempotency-Key', 'payment-key-settle-008');
    expect(extra.status).toBe(422);
  });

  it('reverses a payment with an audit trail instead of deleting it', async () => {
    const { client, enrollment, studentClient } = await billingContext();
    const invoice = await issueInvoice(client, enrollment.id, [
      { description: 'Tuition', unitAmountMinor: 60_000 },
    ]);
    const paymentResponse = await client
      .post('/payments', { invoiceId: invoice.id, amountMinor: 30_000, method: 'CASH' })
      .set('Idempotency-Key', 'payment-key-reverse-009');
    const payment = dataOf<PaymentResponse>(paymentResponse);

    const reversal = await client.post(`/payments/${payment.id}/reverse`, {
      amountMinor: 10_000,
      reason: 'Cheque returned by the bank',
    });
    expect(reversal.status).toBe(200);
    const partiallyReversed = dataOf<PaymentResponse>(reversal);
    expect(partiallyReversed.reversedAmountMinor).toBe(10_000);
    expect(partiallyReversed.status).toBe('PARTIALLY_REVERSED');

    const detail = await client.get(`/invoices/${invoice.id}`);
    const invoiceDetail = dataOf<InvoiceDetail>(detail);
    expect(invoiceDetail.paidMinor).toBe(20_000);
    expect(invoiceDetail.outstandingMinor).toBe(40_000);
    expect(invoiceDetail.payments).toHaveLength(1);

    const ledger = await studentClient.get('/me/fees');
    const summary = (ledger.body as { data: { summary: { paidMinor: number; outstandingMinor: number } } })
      .data.summary;
    expect(summary.paidMinor).toBe(20_000);
    expect(summary.outstandingMinor).toBe(40_000);

    const fullReversal = await client.post(`/payments/${payment.id}/reverse`, {
      reason: 'Payment voided in full by finance',
    });
    expect(fullReversal.status).toBe(200);
    expect(dataOf<PaymentResponse>(fullReversal).status).toBe('REVERSED');

    const beyond = await client.post(`/payments/${payment.id}/reverse`, {
      reason: 'Trying to reverse more than remains',
      amountMinor: 1_000,
    });
    expect(beyond.status).toBe(422);
  });

  it('serves a PDF receipt that the student can download, and gives the student their own copy', async () => {
    const { client, enrollment, studentClient } = await billingContext();
    const invoice = await issueInvoice(client, enrollment.id, [
      { description: 'Tuition', unitAmountMinor: 40_000 },
    ]);
    const payment = dataOf<PaymentResponse>(
      await client
        .post('/payments', { invoiceId: invoice.id, amountMinor: 40_000, method: 'CASH' })
        .set('Idempotency-Key', 'payment-key-receipt-010'),
    );

    const staffReceipt = await client.get(`/payments/${payment.id}/receipt`);
    expect(staffReceipt.status).toBe(200);
    expect(staffReceipt.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(staffReceipt.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    const studentReceipt = await studentClient.get(`/me/receipts/${payment.id}/download`);
    expect(studentReceipt.status).toBe(200);
    expect(studentReceipt.headers['content-type']).toContain('application/pdf');
  });
});

describe('fee plans', () => {
  it('creates a reusable fee plan that lists back with its items', async () => {
    const { client, course } = await billingContext();

    const created = await client.post('/fee-plans', {
      name: 'Full Stack — 3 instalments',
      courseId: course.id,
      installmentCount: 3,
      items: [
        { description: 'Tuition', amountMinor: 90_000_00 },
        { description: 'Registration', amountMinor: 5_000_00 },
      ],
    });
    expect(created.status).toBe(201);

    const list = await client.get('/fee-plans');
    expect(list.status).toBe(200);
    const plans = dataOf<Array<{ id: string; name: string; items: Array<{ description: string }> }>>(list);
    const plan = plans.find((candidate) => candidate.name === 'Full Stack — 3 instalments');
    expect(plan).toBeDefined();
    expect(plan?.items).toHaveLength(2);
  });
});
