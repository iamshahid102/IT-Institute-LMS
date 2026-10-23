import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { dateOnlySchema } from '../../utils/dates';
import { sendCsv, toCsv } from '../../utils/csv';
import { parseQuery } from '../../utils/validate';
import { getAttendanceReport } from '../attendance/attendance.service';
import { getFeeCollectionsReport, getOutstandingReport } from '../fees/fees.service';


const rangeQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

function defaultRange(from?: Date, to?: Date): { from: Date; to: Date } {
  const end = to ?? new Date();
  const start = from ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: start, to: end };
}

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function todayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get('/admissions', requirePermission('report.read'), async (req, res) => {
  const query = parseQuery(rangeQuerySchema, req);
  const { from, to } = defaultRange(query.from, query.to);

  const students = await prisma.student.findMany({
    where: { admissionDate: { gte: from, lte: to } },
    include: {
      enrollments: {
        include: { batch: { select: { code: true, course: { select: { title: true } } } } },
      },
    },
    orderBy: { admissionDate: 'desc' },
  });

  const rows = students.map((student) => ({
    studentNumber: student.studentNumber,
    fullName: student.fullName,
    phone: student.phone,
    admissionDate: student.admissionDate.toISOString().slice(0, 10),
    status: student.status,
    courses: student.enrollments.map((enrollment) => enrollment.batch.course.title).join(' | '),
  }));

  if (query.format === 'csv') {
    sendCsv(
      res,
      `admissions-${from.toISOString().slice(0, 10)}.csv`,
      toCsv(
        [
          { key: 'studentNumber', label: 'Student number' },
          { key: 'fullName', label: 'Student' },
          { key: 'phone', label: 'Phone' },
          { key: 'admissionDate', label: 'Admission date' },
          { key: 'status', label: 'Status' },
          { key: 'courses', label: 'Courses' },
        ],
        rows,
      ),
    );
    return;
  }

  res.json({
    data: {
      from,
      to,
      total: rows.length,
      byStatus: Object.entries(
        students.reduce<Record<string, number>>((accumulator, student) => {
          accumulator[student.status] = (accumulator[student.status] ?? 0) + 1;
          return accumulator;
        }, {}),
      ).map(([status, count]) => ({ status, count })),
      rows,
    },
  });
});

reportsRouter.get('/attendance', requirePermission('report.read'), async (req, res) => {
  const query = parseQuery(
    rangeQuerySchema.extend({ batchId: z.uuid().optional(), studentId: z.uuid().optional() }),
    req,
  );
  const report = await getAttendanceReport({
    batchId: query.batchId,
    studentId: query.studentId,
    from: query.from,
    to: query.to,
  });
  res.json({ data: report });
});

reportsRouter.get('/fees/collections', requirePermission('report.financial.read'), async (req, res) => {
  const query = parseQuery(rangeQuerySchema, req);
  const { from, to } = defaultRange(query.from, query.to);
  const report = await getFeeCollectionsReport(from, to);

  if (query.format === 'csv') {
    sendCsv(
      res,
      `collections-${from.toISOString().slice(0, 10)}.csv`,
      toCsv(
        [
          { key: 'paymentNumber', label: 'Receipt' },
          { key: 'receivedAt', label: 'Received at' },
          { key: 'method', label: 'Method' },
          { key: 'amountMinor', label: 'Amount (paisa)' },
          { key: 'reversedMinor', label: 'Reversed (paisa)' },
          { key: 'invoiceNumber', label: 'Invoice' },
          { key: 'batchCode', label: 'Batch' },
        ],
        report.payments,
      ),
    );
    return;
  }

  res.json({ data: report });
});

reportsRouter.get('/fees/outstanding', requirePermission('fee.invoice.read'), async (req, res) => {
  const query = parseQuery(rangeQuerySchema, req);
  const report = await getOutstandingReport();

  if (query.format === 'csv') {
    sendCsv(
      res,
      `outstanding-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        [
          { key: 'invoiceNumber', label: 'Invoice' },
          { key: 'studentNumber', label: 'Student number' },
          { key: 'studentName', label: 'Student' },
          { key: 'batchCode', label: 'Batch' },
          { key: 'dueAt', label: 'Due date' },
          { key: 'totalMinor', label: 'Invoice total (paisa)' },
          { key: 'paidMinor', label: 'Paid (paisa)' },
          { key: 'outstandingMinor', label: 'Outstanding (paisa)' },
        ],
        report.rows.map((row) => ({
          invoiceNumber: row.invoiceNumber,
          studentNumber: row.student.studentNumber,
          studentName: row.student.fullName,
          batchCode: row.batch.code,
          dueAt: row.dueAt.toISOString().slice(0, 10),
          totalMinor: row.totalMinor,
          paidMinor: row.paidMinor,
          outstandingMinor: row.outstandingMinor,
        })),
      ),
    );
    return;
  }

  res.json({ data: report });
});

reportsRouter.get('/fees', requirePermission('report.financial.read'), async (req, res) => {
  const query = parseQuery(rangeQuerySchema, req);
  const { from, to } = defaultRange(query.from, query.to);
  const [collections, outstanding] = await Promise.all([
    getFeeCollectionsReport(from, to),
    getOutstandingReport(),
  ]);
  res.json({ data: { collections, outstanding } });
});

reportsRouter.get('/completions', requirePermission('report.read'), async (req, res) => {
  const query = parseQuery(rangeQuerySchema, req);
  const { from, to } = defaultRange(query.from, query.to);

  const enrollments = await prisma.enrollment.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: from, lte: to } },
    include: {
      student: { select: { studentNumber: true, fullName: true } },
      batch: { select: { code: true, course: { select: { title: true } } } },
      certificates: { where: { status: 'ISSUED' }, select: { certificateNumber: true } },
    },
    orderBy: { completedAt: 'desc' },
  });

  res.json({
    data: {
      from,
      to,
      total: enrollments.length,
      rows: enrollments.map((enrollment) => ({
        studentNumber: enrollment.student.studentNumber,
        studentName: enrollment.student.fullName,
        batchCode: enrollment.batch.code,
        courseTitle: enrollment.batch.course.title,
        completedAt: enrollment.completedAt,
        certificateNumber: enrollment.certificates[0]?.certificateNumber ?? null,
      })),
    },
  });
});

export const dashboardsRouter = Router();
dashboardsRouter.use(requireAuth);

dashboardsRouter.get('/admin', requirePermission('report.read'), async (req, res) => {
  const auth = getAuth(req);
  if (auth.role === 'STUDENT') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'This dashboard is only available to staff.',
        requestId: req.requestId,
      },
    });
    return;
  }

  const today = todayStart();
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalStudents,
    activeStudents,
    activeCourses,
    activeBatches,
    attendanceToday,
    collections,
    outstanding,
    upcomingSessions,
    recentActivity,
    admissionsThisMonth,
    certificatesIssued,
    totalEnrollments,
  ] = await Promise.all([
    prisma.student.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.student.count({ where: { status: 'ACTIVE' } }),
    prisma.course.count({ where: { status: 'ACTIVE' } }),
    prisma.batch.count({ where: { status: 'ACTIVE' } }),
    prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { session: { startsAt: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } } },
      _count: { _all: true },
    }),
    prisma.payment.findMany({
      where: { receivedAt: { gte: monthStart() } },
      select: { amountMinor: true, reversedAmountMinor: true },
    }),
    getOutstandingReport(),
    prisma.classSession.findMany({
      where: { startsAt: { gte: today, lte: weekAhead }, status: { in: ['SCHEDULED', 'OPEN'] } },
      include: { batch: { select: { code: true, name: true, course: { select: { title: true } } } } },
      orderBy: { startsAt: 'asc' },
      take: 8,
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { fullName: true } } },
    }),
    prisma.student.count({ where: { admissionDate: { gte: monthStart() } } }),
    prisma.certificate.count({ where: { status: 'ISSUED' } }),
    prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
  ]);

  const attendanceCounts = attendanceToday.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.status] = row._count._all;
    return accumulator;
  }, {});

  const collectedThisMonth = collections.reduce(
    (sum, payment) => sum + payment.amountMinor - payment.reversedAmountMinor,
    0,
  );

  res.json({
    data: {
      students: { total: totalStudents, active: activeStudents, activeEnrollments: totalEnrollments },
      academics: { activeCourses, activeBatches, certificatesIssued },
      attendanceToday: {
        present: attendanceCounts.PRESENT ?? 0,
        late: attendanceCounts.LATE ?? 0,
        absent: attendanceCounts.ABSENT ?? 0,
        excused: attendanceCounts.EXCUSED ?? 0,
      },
      fees: {
        collectedThisMonthMinor: collectedThisMonth,
        outstandingMinor: outstanding.totals.outstandingMinor,
        overdueMinor: outstanding.totals.overdueMinor,
        overdueInvoices: outstanding.rows.filter((row) => row.overdue).length,
      },
      admissionsThisMonth,
      upcomingSessions,
      recentActivity,
    },
  });
});

dashboardsRouter.get('/front-desk', requirePermission('report.read'), async (req, res) => {
  if (getAuth(req).role === 'STUDENT') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'This dashboard is only available to staff.',
        requestId: req.requestId,
      },
    });
    return;
  }

  const today = todayStart();
  const [todaySessions, recentAdmissions, recentPayments, outstanding, collectionsToday] = await Promise.all([
    prisma.classSession.findMany({
      where: { startsAt: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } },
      include: {
        batch: { select: { code: true, name: true, course: { select: { title: true } } } },
        _count: { select: { attendance: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, studentNumber: true, fullName: true, admissionDate: true, status: true },
    }),
    prisma.payment.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 5,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            enrollment: { select: { student: { select: { fullName: true } } } },
          },
        },
      },
    }),
    getOutstandingReport(),
    prisma.payment.findMany({
      where: { receivedAt: { gte: today } },
      select: { amountMinor: true, reversedAmountMinor: true },
    }),
  ]);

  res.json({
    data: {
      todaySessions,
      recentAdmissions,
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        amountMinor: payment.amountMinor,
        receivedAt: payment.receivedAt,
        method: payment.method,
        studentName: payment.invoice.enrollment.student.fullName,
        invoiceNumber: payment.invoice.invoiceNumber,
      })),
      outstanding: outstanding.totals,
      collectedTodayMinor: collectionsToday.reduce(
        (sum, payment) => sum + payment.amountMinor - payment.reversedAmountMinor,
        0,
      ),
    },
  });
});
