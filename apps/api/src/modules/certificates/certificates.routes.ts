import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { publicVerificationLimiter } from '../../middleware/rate-limit';
import { idParamSchema, paginationMeta, parseBody, parseParams, parseQuery, paginationSchema } from '../../utils/validate';
import * as certificatesService from './certificates.service';

export const certificatesRouter = Router();
certificatesRouter.use(requireAuth);

function actor(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req);
  return { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip };
}

const listQuerySchema = paginationSchema.extend({
  status: z.enum(['ISSUED', 'REVOKED']).optional(),
  studentId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
});

const issueSchema = z.object({ enrollmentId: z.uuid('Select an enrollment.') });
const revokeSchema = z.object({
  reason: z.string().trim().min(5, 'Provide a revocation reason.').max(500),
});

certificatesRouter.get('/', requirePermission('certificate.read'), async (req, res) => {
  const query = parseQuery(listQuerySchema, req);
  const { items, total } = await certificatesService.listCertificates(query);
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

certificatesRouter.get('/eligibility/:id', requirePermission('certificate.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await certificatesService.getEligibility(id) });
});

certificatesRouter.get('/:id', requirePermission('certificate.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await certificatesService.getCertificate(id) });
});

certificatesRouter.post('/issue', requirePermission('certificate.issue'), async (req, res) => {
  const body = parseBody(issueSchema, req);
  res.status(201).json({ data: await certificatesService.issueCertificate(actor(req), body.enrollmentId) });
});

certificatesRouter.post('/:id/revoke', requirePermission('certificate.revoke'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(revokeSchema, req);
  res.json({ data: await certificatesService.revokeCertificate(actor(req), id, body.reason) });
});

certificatesRouter.get('/:id/download', requirePermission('certificate.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const file = await certificatesService.getCertificateFile(id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
});

export const publicRouter = Router();

publicRouter.get('/certificates/verify/:code', publicVerificationLimiter, async (req, res) => {
  const parsed = z
    .object({ code: z.string().min(10, 'Enter a valid verification code.').max(200) })
    .safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Enter a valid verification code.',
        requestId: req.requestId,
      },
    });
    return;
  }
  res.json({ data: await certificatesService.verifyCertificate(parsed.data.code) });
});
