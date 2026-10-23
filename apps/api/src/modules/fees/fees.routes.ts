import { Router } from 'express';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { parseBody, parseParams, parseQuery, paginationMeta, idParamSchema } from '../../utils/validate';
import { validationError } from '../../utils/errors';
import {
  createFeePlanSchema,
  createInvoicePlanSchema,
  createInvoiceSchema,
  createPaymentSchema,
  listInvoicesQuerySchema,
  listPaymentsQuerySchema,
  reversePaymentSchema,
} from './fees.schemas';
import * as feesService from './fees.service';

export const feesRouter = Router();

function actor(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req);
  return {
    actorId: auth.userId,
    actorRole: auth.role,
    requestId: req.requestId,
    ip: req.ip,
  };
}

feesRouter.get('/fee-plans', requireAuth, requirePermission('fee.read'), async (_req, res) => {
  res.json({ data: await feesService.listFeePlans() });
});

feesRouter.post('/fee-plans', requireAuth, requirePermission('fee.plan.manage'), async (req, res) => {
  const body = parseBody(createFeePlanSchema, req);
  res.status(201).json({ data: await feesService.createFeePlan(actor(req), body) });
});

feesRouter.get('/invoices', requireAuth, requirePermission('fee.invoice.read'), async (req, res) => {
  const query = parseQuery(listInvoicesQuerySchema, req);
  const { items, total } = await feesService.listInvoices({
    ...query,
    overdue: query.overdue === 'true',
  });
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

feesRouter.post('/invoices', requireAuth, requirePermission('fee.invoice.create'), async (req, res) => {
  const body = parseBody(createInvoiceSchema, req);
  res.status(201).json({ data: await feesService.createInvoice(actor(req), body) });
});

feesRouter.post(
  '/invoices/plan',
  requireAuth,
  requirePermission('fee.invoice.create'),
  async (req, res) => {
    const body = parseBody(createInvoicePlanSchema, req);
    const invoices = await feesService.createInvoicePlan(actor(req), body);
    res.status(201).json({ data: invoices });
  },
);

feesRouter.get('/invoices/:id', requireAuth, requirePermission('fee.invoice.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await feesService.getInvoice(id) });
});

feesRouter.get('/payments', requireAuth, requirePermission('fee.invoice.read'), async (req, res) => {
  const query = parseQuery(listPaymentsQuerySchema, req);
  const { items, total } = await feesService.listPayments(query);
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

feesRouter.post('/payments', requireAuth, requirePermission('fee.payment.receive'), async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key || key.length < 8 || key.length > 128) {
    throw validationError([
      {
        field: 'Idempotency-Key',
        message: 'Send an Idempotency-Key header of 8-128 characters with this request.',
      },
    ]);
  }

  const body = parseBody(createPaymentSchema, req);
  const result = await feesService.createPayment(actor(req), body, key);
  if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
  res.status(201).json({ data: result.payment });
});

feesRouter.get('/payments/:id', requireAuth, requirePermission('fee.invoice.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await feesService.getPayment(id) });
});

feesRouter.post(
  '/payments/:id/reverse',
  requireAuth,
  requirePermission('fee.reverse'),
  async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const body = parseBody(reversePaymentSchema, req);
    res.json({ data: await feesService.reversePayment(actor(req), id, body) });
  },
);

feesRouter.get(
  '/payments/:id/receipt',
  requireAuth,
  requirePermission('fee.invoice.read'),
  async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const file = await feesService.generateReceiptPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  },
);
