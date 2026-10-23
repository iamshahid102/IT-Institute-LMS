import { Router } from 'express';
import { openapiDocument } from './openapi';
import { announcementsRouter } from '../modules/announcements/announcements.module';
import { assessmentsRouter } from '../modules/assessments/assessments.module';
import { attendanceRouter } from '../modules/attendance/attendance.routes';
import { auditRouter } from '../modules/audit/audit.module';
import { authRouter } from '../modules/auth/auth.routes';
import { batchesRouter } from '../modules/batches/batches.routes';
import { certificatesRouter, publicRouter } from '../modules/certificates/certificates.routes';
import { coursesRouter } from '../modules/courses/courses.routes';
import { enrollmentsRouter } from '../modules/enrollments/enrollments.routes';
import { feesRouter } from '../modules/fees/fees.routes';
import { instructorsRouter } from '../modules/instructors/instructors.module';
import { portalRouter } from '../modules/portal/portal.module';
import { dashboardsRouter, reportsRouter } from '../modules/reports/reports.module';
import { settingsRouter } from '../modules/settings/settings.routes';
import { studentsRouter } from '../modules/students/students.routes';
import { usersRouter } from '../modules/users/users.routes';

export const apiRouter = Router();

apiRouter.use('/public', publicRouter);

apiRouter.get('/', (_req, res) => {
  res.json({
    data: {
      name: 'IT Institute LMS API',
      version: 'v1',
      documentation: '/api/v1/openapi.json',
    },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/students', studentsRouter);
apiRouter.use('/courses', coursesRouter);
apiRouter.use('/instructors', instructorsRouter);
apiRouter.use('/batches', batchesRouter);
apiRouter.use('/enrollments', enrollmentsRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/assessments', assessmentsRouter);
apiRouter.use('/certificates', certificatesRouter);
apiRouter.use(feesRouter);
apiRouter.use('/announcements', announcementsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/dashboards', dashboardsRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/me', portalRouter);

apiRouter.get('/openapi.json', (_req, res) => {
  res.json(openapiDocument);
});
