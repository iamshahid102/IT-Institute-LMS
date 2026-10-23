import { Router } from 'express';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { idParamSchema, paginationMeta, parseBody, parseParams, parseQuery } from '../../utils/validate';
import {
  createEnrollmentSchema,
  listEnrollmentsQuerySchema,
  updateEnrollmentSchema,
} from './enrollments.schemas';
import * as enrollmentsService from './enrollments.service';

export const enrollmentsRouter = Router();

enrollmentsRouter.use(requireAuth);

enrollmentsRouter.get('/', requirePermission('enrollment.read'), async (req, res) => {
  const query = parseQuery(listEnrollmentsQuerySchema, req);
  const { items, total } = await enrollmentsService.listEnrollments(query);
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

enrollmentsRouter.get('/:id', requirePermission('enrollment.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await enrollmentsService.getEnrollment(id) });
});

enrollmentsRouter.post('/', requirePermission('enrollment.manage'), async (req, res) => {
  const auth = getAuth(req);
  const body = parseBody(createEnrollmentSchema, req);
  const enrollment = await enrollmentsService.createEnrollment(
    { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip },
    body,
  );
  res.status(201).json({ data: enrollment });
});

enrollmentsRouter.patch('/:id', requirePermission('enrollment.manage'), async (req, res) => {
  const auth = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(updateEnrollmentSchema, req);
  const enrollment = await enrollmentsService.updateEnrollment(
    { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip },
    id,
    body,
  );
  res.json({ data: enrollment });
});
