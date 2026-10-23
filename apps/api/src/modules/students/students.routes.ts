import { Router } from 'express';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { idParamSchema, paginationMeta, parseBody, parseParams, parseQuery } from '../../utils/validate';
import { getStudentLedger } from '../fees/fees.service';
import {
  createStudentAccountSchema,
  createStudentSchema,
  listStudentsQuerySchema,
  updateStudentSchema,
} from './students.schemas';
import * as studentsService from './students.service';

export const studentsRouter = Router();

studentsRouter.use(requireAuth);

function actor(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req);
  return { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip };
}

studentsRouter.get('/', requirePermission('student.read'), async (req, res) => {
  const query = parseQuery(listStudentsQuerySchema, req);
  const { items, total } = await studentsService.listStudents(query);
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

studentsRouter.post('/', requirePermission('student.create'), async (req, res) => {
  const body = parseBody(createStudentSchema, req);
  const student = await studentsService.createStudent(actor(req), body);
  res.status(201).json({ data: student });
});

studentsRouter.get('/:id', requirePermission('student.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await studentsService.getStudentDetail(id) });
});

studentsRouter.patch('/:id', requirePermission('student.update'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(updateStudentSchema, req);
  res.json({ data: await studentsService.updateStudent(actor(req), id, body) });
});

studentsRouter.post('/:id/archive', requirePermission('student.archive'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await studentsService.archiveStudent(actor(req), id) });
});

studentsRouter.post('/:id/account', requirePermission('student.update'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const body = parseBody(createStudentAccountSchema, req);
  res.status(201).json({ data: await studentsService.createPortalAccount(actor(req), id, body) });
});

studentsRouter.get('/:id/attendance', requirePermission('attendance.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await studentsService.getStudentAttendance(id) });
});

studentsRouter.get('/:id/fee-ledger', requirePermission('fee.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await getStudentLedger(id) });
});

studentsRouter.get('/:id/certificates', requirePermission('certificate.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await studentsService.getStudentCertificates(id) });
});
