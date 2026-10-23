import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getAuth, requireAuth, requireStudent } from '../../middleware/auth';
import { randomToken, sha256 } from '../../utils/crypto';
import { notFound } from '../../utils/errors';
import { paginationMeta, paginationSchema, parseBody, parseParams, parseQuery, idParamSchema } from '../../utils/validate';
import { getStudentAttendanceSummaries } from '../attendance/attendance.stats';
import { generateReceiptPdf, getStudentLedger } from '../fees/fees.service';
import { getCertificateFile } from '../certificates/certificates.service';
import { getSettings, attendancePolicyFrom } from '../settings/settings.service';

const QR_TTL_MS = 10 * 60 * 1000;

const profileUpdateSchema = z
  .object({
    phone: z.string().trim().min(7, 'Enter a valid phone number.').max(30).optional(),
    address: z.string().trim().max(240).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No changes were supplied.' });

function studentIdOf(req: Parameters<typeof getAuth>[0]): string {
  const auth = getAuth(req);
  if (!auth.studentId) throw notFound('Student profile not found for this account.');
  return auth.studentId;
}

export const portalRouter = Router();
portalRouter.use(requireAuth, requireStudent);

portalRouter.get('/profile', async (req, res) => {
  const studentId = studentIdOf(req);
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { email: true, lastLoginAt: true } } },
  });
  if (!student) throw notFound('Student profile not found.');

  res.json({
    data: {
      id: student.id,
      studentNumber: student.studentNumber,
      fullName: student.fullName,
      guardianName: student.guardianName,
      phone: student.phone,
      email: student.user?.email ?? student.email,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      admissionDate: student.admissionDate,
      status: student.status,
      lastLoginAt: student.user?.lastLoginAt ?? null,
    },
  });
});

portalRouter.patch('/profile', async (req, res) => {
  const studentId = studentIdOf(req);
  const body = parseBody(profileUpdateSchema, req);
  const student = await prisma.student.update({
    where: { id: studentId },
    data: {
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
    },
  });

  res.json({
    data: {
      id: student.id,
      fullName: student.fullName,
      phone: student.phone,
      address: student.address,
    },
  });
});

portalRouter.get('/enrollments', async (req, res) => {
  const studentId = studentIdOf(req);
  const [enrollments, summaries] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId },
      include: {
        batch: {
          include: {
            course: { select: { id: true, code: true, title: true, durationValue: true, durationUnit: true } },
            instructor: { select: { fullName: true } },
            schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
          },
        },
        invoices: {
          where: { status: { not: 'VOID' } },
          select: {
            totalMinor: true,
            status: true,
            dueAt: true,
            payments: { select: { amountMinor: true, reversedAmountMinor: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getStudentAttendanceSummaries(studentId),
  ]);

  const summaryById = new Map(summaries.map((summary) => [summary.enrollmentId, summary]));

  res.json({
    data: enrollments.map((enrollment) => {
      const billed = enrollment.invoices.reduce((sum, invoice) => sum + invoice.totalMinor, 0);
      const paid = enrollment.invoices.reduce(
        (sum, invoice) =>
          sum + invoice.payments.reduce((inner, payment) => inner + payment.amountMinor - payment.reversedAmountMinor, 0),
        0,
      );
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const nextDue = enrollment.invoices
        .filter((invoice) => invoice.status !== 'PAID' && invoice.dueAt >= today)
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];

      return {
        id: enrollment.id,
        status: enrollment.status,
        joinedAt: enrollment.joinedAt,
        completedAt: enrollment.completedAt,
        agreedFeeMinor: enrollment.agreedFeeMinor,
        currency: enrollment.currency,
        attendance: summaryById.get(enrollment.id)?.summary ?? null,
        fees: {
          billedMinor: billed,
          paidMinor: paid,
          outstandingMinor: Math.max(0, billed - paid),
          nextDueAt: nextDue?.dueAt ?? null,
          nextDueMinor: nextDue ? nextDue.totalMinor : null,
        },
        batch: {
          id: enrollment.batch.id,
          code: enrollment.batch.code,
          name: enrollment.batch.name,
          status: enrollment.batch.status,
          startDate: enrollment.batch.startDate,
          endDate: enrollment.batch.endDate,
          course: enrollment.batch.course,
          instructor: enrollment.batch.instructor,
          schedules: enrollment.batch.schedules,
        },
      };
    }),
  });
});

portalRouter.get('/attendance', async (req, res) => {
  const studentId = studentIdOf(req);
  const [summaries, records, settings] = await Promise.all([
    getStudentAttendanceSummaries(studentId),
    prisma.attendanceRecord.findMany({
      where: { enrollment: { studentId } },
      include: {
        session: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            topic: true,
            batch: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { session: { startsAt: 'desc' } },
      take: 200,
    }),
    getSettings(),
  ]);

  const totals = summaries.reduce(
    (accumulator, summary) => ({
      present: accumulator.present + summary.summary.present,
      absent: accumulator.absent + summary.summary.absent,
      late: accumulator.late + summary.summary.late,
      excused: accumulator.excused + summary.summary.excused,
      eligibleSessions: accumulator.eligibleSessions + summary.summary.eligibleSessions,
      countedPresent: accumulator.countedPresent + summary.summary.countedPresent,
      denominator: accumulator.denominator + summary.summary.denominator,
    }),
    { present: 0, absent: 0, late: 0, excused: 0, eligibleSessions: 0, countedPresent: 0, denominator: 0 },
  );

  const percentage =
    totals.denominator === 0 ? 0 : Math.round((totals.countedPresent / totals.denominator) * 1000) / 10;

  res.json({
    data: {
      summaries,
      totals: { ...totals, percentage },
      policy: attendancePolicyFrom(settings),
      thresholdPercent: settings.attendanceThresholdPercent,
      records: records.map((record) => ({
        id: record.id,
        status: record.status,
        method: record.method,
        markedAt: record.markedAt,
        remarks: record.remarks,
        correctionReason: record.correctionReason,
        session: record.session,
      })),
    },
  });
});

portalRouter.post('/attendance/qr', async (req, res) => {
  const studentId = studentIdOf(req);
  await prisma.qrToken.updateMany({
    where: { studentId, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  });

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + QR_TTL_MS);
  await prisma.qrToken.create({
    data: { studentId, tokenHash: sha256(token), expiresAt },
  });

  res.status(201).json({ data: { token, expiresAt } });
});

portalRouter.get('/fees', async (req, res) => {
  const studentId = studentIdOf(req);
  res.json({ data: await getStudentLedger(studentId) });
});

portalRouter.get('/receipts', async (req, res) => {
  const studentId = studentIdOf(req);
  const query = parseQuery(paginationSchema, req);
  const where = { invoice: { enrollment: { studentId } } };

  const [total, payments] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            enrollment: { select: { batch: { select: { code: true } } } },
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  res.json({
    data: payments.map((payment) => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      reference: payment.reference,
      receivedAt: payment.receivedAt,
      invoice: {
        id: payment.invoice.id,
        invoiceNumber: payment.invoice.invoiceNumber,
        batchCode: payment.invoice.enrollment.batch.code,
      },
    })),
    meta: paginationMeta(query.page, query.pageSize, total),
  });
});

portalRouter.get('/receipts/:id/download', async (req, res) => {
  const studentId = studentIdOf(req);
  const { id } = parseParams(idParamSchema, req);

  const payment = await prisma.payment.findFirst({
    where: { id, invoice: { enrollment: { studentId } } },
    select: { id: true },
  });
  if (!payment) throw notFound('Receipt not found.');

  const file = await generateReceiptPdf(payment.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
});

portalRouter.get('/certificates', async (req, res) => {
  const studentId = studentIdOf(req);
  const certificates = await prisma.certificate.findMany({
    where: { enrollment: { studentId } },
    include: {
      enrollment: {
        include: { batch: { select: { code: true, course: { select: { title: true, code: true } } } } },
      },
    },
    orderBy: { issuedAt: 'desc' },
  });

  res.json({
    data: certificates.map((certificate) => ({
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      verificationCode: certificate.verificationCode,
      status: certificate.status,
      issuedAt: certificate.issuedAt,
      revokedAt: certificate.revokedAt,
      courseTitle: certificate.enrollment.batch.course.title,
      courseCode: certificate.enrollment.batch.course.code,
      batchCode: certificate.enrollment.batch.code,
    })),
  });
});

portalRouter.get('/certificates/:id/download', async (req, res) => {
  const studentId = studentIdOf(req);
  const { id } = parseParams(idParamSchema, req);

  const certificate = await prisma.certificate.findFirst({
    where: { id, enrollment: { studentId } },
    select: { id: true, status: true },
  });
  if (!certificate) throw notFound('Certificate not found.');
  if (certificate.status !== 'ISSUED') {
    res.status(409).json({
      error: {
        code: 'CERTIFICATE_REVOKED',
        message: 'This certificate has been revoked and is no longer available for download.',
        requestId: req.requestId,
      },
    });
    return;
  }

  const file = await getCertificateFile(certificate.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
});

portalRouter.get('/announcements', async (req, res) => {
  const studentId = studentIdOf(req);
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: { in: ['ACTIVE', 'COMPLETED', 'SUSPENDED'] } },
    select: { batchId: true },
  });
  const batchIds = enrollments.map((enrollment) => enrollment.batchId);

  const announcements = await prisma.announcement.findMany({
    where: {
      status: 'PUBLISHED',
      audience: { in: ['STUDENTS', 'EVERYONE'] },
      OR: [{ batchId: null }, { batchId: { in: batchIds } }],
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  res.json({ data: announcements });
});

portalRouter.get('/notifications', async (req, res) => {
  const auth = getAuth(req);
  const query = parseQuery(paginationSchema, req);
  const where = { userId: auth.userId };

  const [total, unread, notifications] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  res.json({ data: notifications, meta: { ...paginationMeta(query.page, query.pageSize, total), unread } });
});

portalRouter.patch('/notifications/:id/read', async (req, res) => {
  const auth = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  const notification = await prisma.notification.findFirst({ where: { id, userId: auth.userId } });
  if (!notification) throw notFound('Notification not found.');

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: notification.readAt ?? new Date() },
  });
  res.json({ data: updated });
});

portalRouter.post('/notifications/read-all', async (req, res) => {
  const auth = getAuth(req);
  await prisma.notification.updateMany({
    where: { userId: auth.userId, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).send();
});

portalRouter.get('/timetable', async (req, res) => {
  const studentId = studentIdOf(req);
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: 'ACTIVE' },
    include: {
      batch: {
        include: {
          course: { select: { title: true, code: true } },
          instructor: { select: { fullName: true } },
          schedules: true,
          sessions: {
            where: { status: { in: ['SCHEDULED', 'OPEN'] }, startsAt: { gte: new Date() } },
            orderBy: { startsAt: 'asc' },
            take: 10,
          },
        },
      },
    },
  });

  res.json({
    data: enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      batch: {
        id: enrollment.batch.id,
        code: enrollment.batch.code,
        name: enrollment.batch.name,
        courseTitle: enrollment.batch.course.title,
        instructor: enrollment.batch.instructor?.fullName ?? null,
      },
      schedules: enrollment.batch.schedules,
      upcomingSessions: enrollment.batch.sessions,
    })),
  });
});

portalRouter.get('/overview', async (req, res) => {
  const studentId = studentIdOf(req);
  const auth = getAuth(req);

  const [student, summaries, ledger, latestPayment, certificates, unread, announcements, activeEnrollments] =
    await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: { fullName: true, studentNumber: true, status: true },
      }),
      getStudentAttendanceSummaries(studentId),
      getStudentLedger(studentId),
      prisma.payment.findFirst({
        where: { invoice: { enrollment: { studentId } } },
        include: { invoice: { select: { invoiceNumber: true } } },
        orderBy: { receivedAt: 'desc' },
      }),
      prisma.certificate.count({ where: { enrollment: { studentId }, status: 'ISSUED' } }),
      prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
      prisma.announcement.findMany({
        where: { status: 'PUBLISHED', audience: { in: ['STUDENTS', 'EVERYONE'] } },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        select: { id: true, title: true, publishedAt: true },
      }),
      prisma.enrollment.findMany({
        where: { studentId, status: 'ACTIVE' },
        include: {
          batch: {
            include: {
              course: { select: { title: true, code: true } },
              schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
              sessions: {
                where: { status: { in: ['SCHEDULED', 'OPEN'] }, startsAt: { gte: new Date() } },
                orderBy: { startsAt: 'asc' },
                take: 1,
              },
            },
          },
        },
        take: 3,
      }),
    ]);

  const totals = summaries.reduce(
    (accumulator, summary) => ({
      countedPresent: accumulator.countedPresent + summary.summary.countedPresent,
      denominator: accumulator.denominator + summary.summary.denominator,
      present: accumulator.present + summary.summary.present,
      absent: accumulator.absent + summary.summary.absent,
      late: accumulator.late + summary.summary.late,
      excused: accumulator.excused + summary.summary.excused,
    }),
    { countedPresent: 0, denominator: 0, present: 0, absent: 0, late: 0, excused: 0 },
  );

  res.json({
    data: {
      student,
      attendance: {
        ...totals,
        percentage:
          totals.denominator === 0
            ? 0
            : Math.round((totals.countedPresent / totals.denominator) * 1000) / 10,
      },
      fees: ledger.summary,
      latestPayment,
      issuedCertificates: certificates,
      unreadNotifications: unread,
      announcements,
      enrollments: activeEnrollments.map((enrollment) => ({
        id: enrollment.id,
        batchCode: enrollment.batch.code,
        batchName: enrollment.batch.name,
        courseTitle: enrollment.batch.course.title,
        schedules: enrollment.batch.schedules,
        nextSession: enrollment.batch.sessions[0] ?? null,
        attendance: summaries.find((summary) => summary.enrollmentId === enrollment.id)?.summary ?? null,
      })),
    },
  });
});
