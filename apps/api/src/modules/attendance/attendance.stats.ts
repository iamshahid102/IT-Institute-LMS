import { computeAttendance, type AttendancePolicy, type AttendanceSummary } from '@lms/shared';
import type { AttendanceStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getSettings, attendancePolicyFrom } from '../settings/settings.service';

interface SessionWindow {
  id: string;
  batchId: string;
  startsAt: Date;
}

function windowFilter(joinedAt: Date, completedAt: Date | null) {
  return {
    gte: joinedAt,
    ...(completedAt ? { lte: completedAt } : {}),
  };
}

function summarise(sessionIds: string[], records: Array<{ sessionId: string; status: AttendanceStatus }>, policy: AttendancePolicy) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  const bySession = new Map<string, AttendanceStatus>();
  for (const record of records) bySession.set(record.sessionId, record.status);

  for (const sessionId of sessionIds) {
    const status = bySession.get(sessionId);
    if (status === 'PRESENT') counts.present += 1;
    else if (status === 'LATE') counts.late += 1;
    else if (status === 'EXCUSED') counts.excused += 1;
    else counts.absent += 1;
  }

  return computeAttendance(counts, policy);
}

export interface EnrollmentAttendance {
  enrollmentId: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  courseTitle: string;
  summary: AttendanceSummary;
}

async function policy(): Promise<AttendancePolicy> {
  return attendancePolicyFrom(await getSettings());
}

export async function getEnrollmentAttendance(enrollmentId: string): Promise<AttendanceSummary> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, batchId: true, joinedAt: true, completedAt: true },
  });
  if (!enrollment) return computeAttendance({ present: 0, absent: 0, late: 0, excused: 0 }, await policy());

  const sessions = await prisma.classSession.findMany({
    where: {
      batchId: enrollment.batchId,
      status: 'FINALIZED',
      startsAt: windowFilter(enrollment.joinedAt, enrollment.completedAt),
    },
    select: { id: true },
  });
  const records = await prisma.attendanceRecord.findMany({
    where: { enrollmentId, sessionId: { in: sessions.map((session) => session.id) } },
    select: { sessionId: true, status: true },
  });

  return summarise(
    sessions.map((session) => session.id),
    records,
    await policy(),
  );
}

export async function getStudentAttendanceSummaries(studentId: string): Promise<EnrollmentAttendance[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: {
      id: true,
      batchId: true,
      joinedAt: true,
      completedAt: true,
      batch: {
        select: {
          code: true,
          name: true,
          course: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (enrollments.length === 0) return [];

  const batchIds = [...new Set(enrollments.map((enrollment) => enrollment.batchId))];
  const sessions: SessionWindow[] = await prisma.classSession.findMany({
    where: { batchId: { in: batchIds }, status: 'FINALIZED' },
    select: { id: true, batchId: true, startsAt: true },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: { enrollmentId: { in: enrollments.map((enrollment) => enrollment.id) } },
    select: { enrollmentId: true, sessionId: true, status: true },
  });

  const policyValue = await policy();

  return enrollments.map((enrollment) => {
    const eligible = sessions.filter(
      (session) =>
        session.batchId === enrollment.batchId &&
        session.startsAt >= enrollment.joinedAt &&
        (!enrollment.completedAt || session.startsAt <= enrollment.completedAt),
    );
    const eligibleIds = new Set(eligible.map((session) => session.id));
    const enrollmentRecords = records.filter(
      (record) => record.enrollmentId === enrollment.id && eligibleIds.has(record.sessionId),
    );

    return {
      enrollmentId: enrollment.id,
      batchId: enrollment.batchId,
      batchCode: enrollment.batch.code,
      batchName: enrollment.batch.name,
      courseTitle: enrollment.batch.course.title,
      summary: summarise(
        eligible.map((session) => session.id),
        enrollmentRecords,
        policyValue,
      ),
    };
  });
}

/** Batch-wide roster for a report: one row per active enrollment with its percentage. */
export async function getBatchAttendanceReport(batchId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { batchId, status: { in: ['ACTIVE', 'COMPLETED', 'SUSPENDED'] } },
    include: {
      student: { select: { id: true, studentNumber: true, fullName: true } },
    },
    orderBy: { student: { fullName: 'asc' } },
  });

  const policyValue = await policy();

  return Promise.all(
    enrollments.map(async (enrollment) => {
      const sessions = await prisma.classSession.findMany({
        where: {
          batchId,
          status: 'FINALIZED',
          startsAt: windowFilter(enrollment.joinedAt, enrollment.completedAt),
        },
        select: { id: true },
      });
      const records = await prisma.attendanceRecord.findMany({
        where: { enrollmentId: enrollment.id },
        select: { sessionId: true, status: true },
      });
      return {
        enrollmentId: enrollment.id,
        student: enrollment.student,
        enrollmentStatus: enrollment.status,
        summary: summarise(
          sessions.map((session) => session.id),
          records,
          policyValue,
        ),
      };
    }),
  );
}
