import { Router } from 'express';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { idParamSchema, paginationMeta, parseBody, parseParams, parseQuery } from '../../utils/validate';
import { createBatchSchema, listBatchesQuerySchema, updateBatchSchema } from './batches.schemas';
import * as batchesService from './batches.service';

export const batchesRouter = Router();

batchesRouter.use(requireAuth);

batchesRouter.get('/', requirePermission('batch.read'), async (req, res) => {
  const query = parseQuery(listBatchesQuerySchema, req);
  const { items, total } = await batchesService.listBatches(query);
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

batchesRouter.get('/:id', requirePermission('batch.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await batchesService.getBatch(id) });
});

batchesRouter.post('/', requirePermission('batch.manage'), async (req, res) => {
  const auth = getAuth(req);
  const body = parseBody(createBatchSchema, req);
  const batch = await batchesService.createBatch(
    { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip },
    body,
  );
  res.status(201).json({ data: batch });
});

batchesRouter.patch('/:id', requirePermission('batch.manage'), async (req, res) => {
  const auth = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(updateBatchSchema, req);
  const batch = await batchesService.updateBatch(
    { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip },
    id,
    body,
  );
  res.json({ data: batch });
});
