import { Router } from 'express';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { parseBody, parseParams, parseQuery, paginationMeta, idParamSchema } from '../../utils/validate';
import { issueResetLink } from '../auth/auth.service';
import { createStaffSchema, listUsersQuerySchema, updateStaffSchema } from './users.schemas';
import * as usersService from './users.service';

export const usersRouter = Router();

usersRouter.use(requireAuth, requirePermission('user.manage'));

function meta(req: Parameters<typeof getAuth>[0]) {
  return { ip: req.ip ?? null, requestId: req.requestId };
}

usersRouter.get('/', async (req, res) => {
  const query = parseQuery(listUsersQuerySchema, req);
  const { items, total } = await usersService.listStaff(query);
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

usersRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const user = await usersService.getStaff(id);
  res.json({ data: user });
});

usersRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const body = parseBody(createStaffSchema, req);
  const user = await usersService.createStaff(
    { actorId: auth.userId, actorRole: auth.role, ...meta(req) },
    body,
  );
  res.status(201).json({ data: user });
});

usersRouter.patch('/:id', async (req, res) => {
  const auth = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(updateStaffSchema, req);
  const user = await usersService.updateStaff(
    { actorId: auth.userId, actorRole: auth.role, ...meta(req) },
    id,
    body,
  );
  res.json({ data: user });
});

usersRouter.post('/:id/reset-link', async (req, res) => {
  const auth = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  const result = await issueResetLink(auth.userId, auth.role, id, meta(req));
  res.json({ data: result });
});
