import { Router } from 'express';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { scanLimiter } from '../../middleware/rate-limit';
import { idParamSchema, paginationMeta, parseBody, parseParams, parseQuery } from '../../utils/validate';
import {
  attendanceReportQuerySchema,
  correctAttendanceSchema,
  createSessionSchema,
  listSessionsQuerySchema,
  manualAttendanceSchema,
  scanSchema,
} from './attendance.schemas';
import * as attendanceService from './attendance.service';

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

function actor(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req);
  return { actorId: auth.userId, actorRole: auth.role, requestId: req.requestId, ip: req.ip };
}

attendanceRouter.get('/sessions', requirePermission('attendance.read'), async (req, res) => {
  const query = parseQuery(listSessionsQuerySchema, req);
  const { items, total } = await attendanceService.listSessions(query);
  res.json({ data: items, meta: paginationMeta(query.page, query.pageSize, total) });
});

attendanceRouter.post(
  '/sessions',
  requirePermission('attendance.session.manage'),
  async (req, res) => {
    const body = parseBody(createSessionSchema, req);
    res.status(201).json({ data: await attendanceService.createSession(actor(req), body) });
  },
);

attendanceRouter.get('/sessions/:id', requirePermission('attendance.read'), async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  res.json({ data: await attendanceService.getSession(id) });
});

attendanceRouter.post(
  '/sessions/:id/open',
  requirePermission('attendance.session.manage'),
  async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    res.json({ data: await attendanceService.openSession(actor(req), id) });
  },
);

attendanceRouter.post(
  '/sessions/:id/finalize',
  requirePermission('attendance.finalize'),
  async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    res.json({ data: await attendanceService.finalizeSession(actor(req), id) });
  },
);

attendanceRouter.post(
  '/sessions/:id/cancel',
  requirePermission('attendance.session.manage'),
  async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    res.json({ data: await attendanceService.cancelSession(actor(req), id) });
  },
);

attendanceRouter.post('/scan', requirePermission('attendance.mark'), scanLimiter, async (req, res) => {
  const body = parseBody(scanSchema, req);
  res.json({ data: await attendanceService.markByScan(actor(req), body.sessionId, body.qrToken) });
});

attendanceRouter.post('/manual', requirePermission('attendance.mark'), async (req, res) => {
  const body = parseBody(manualAttendanceSchema, req);
  res.json({ data: await attendanceService.markManually(actor(req), body) });
});

attendanceRouter.patch(
  '/records/:id',
  requirePermission('attendance.correct'),
  async (req, res) => {
    const { id } = parseParams(idParamSchema, req);
    const body = parseBody(correctAttendanceSchema, req);
    res.json({ data: await attendanceService.correctAttendance(actor(req), id, body) });
  },
);

attendanceRouter.get('/reports', requirePermission('attendance.read'), async (req, res) => {
  const query = parseQuery(attendanceReportQuerySchema, req);
  res.json({ data: await attendanceService.getAttendanceReport(query) });
});
