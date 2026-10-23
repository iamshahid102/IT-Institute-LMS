import { Router } from 'express';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { idParamSchema, paginationMeta, parseBody, parseParams, parseQuery } from '../../utils/validate';
import { createCourseSchema, listCoursesQuerySchema, updateCourseSchema } from './courses.schemas';
import * as coursesService from './courses.service';

export const coursesRouter = Router();

coursesRouter.use(requireAuth);

coursesRouter.get('/', requirePermission('course.read'), async (req, res) => {
  const query = parseQuery(listCoursesQuerySchema, req);
  const { items, total } = await coursesService.listCourses(query);
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

coursesRouter.get('/:id', requirePermission('course.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await coursesService.getCourse(id) });
});

coursesRouter.post('/', requirePermission('course.manage'), async (req, res) => {
  const auth = getAuth(req);
  const body = parseBody(createCourseSchema, req);
  const course = await coursesService.createCourse(
    { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip },
    body,
  );
  res.status(201).json({ data: course });
});

coursesRouter.patch('/:id', requirePermission('course.manage'), async (req, res) => {
  const auth = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(updateCourseSchema, req);
  const course = await coursesService.updateCourse(
    { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip },
    id,
    body,
  );
  res.json({ data: course });
});
