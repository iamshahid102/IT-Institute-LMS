import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { ApiClient, dataOf, errorOf } from '../helpers/client';
import { resetDatabase } from '../helpers/db';
import {
  createAttendanceRecord,
  createBatch,
  createCourse,
  createEnrollment,
  createSession,
  createStudentWithAccount,
  createUser,
  daysFromNow,
  TEST_PASSWORD,
} from '../helpers/fixtures';

let app: Express;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDatabase();
});

interface MarkResponse {
  record: { id: string; status: string; method: string };
  student: { fullName: string; studentNumber: string };
  sessionId: string;
}

async function setupBatchWithStudent(studentEmail = 'attendee@student.test') {
  const admin = await createUser({ role: 'SUPER_ADMIN', email: `admin-${Date.now()}@institute.test` });
  const course = await createCourse();
  const batch = await createBatch(course.id);
  const { student, user } = await createStudentWithAccount({ email: studentEmail });
  const enrollment = await createEnrollment({ studentId: student.id, batchId: batch.id });

  const adminClient = await ApiClient.create(app);
  await adminClient.login(admin.email, TEST_PASSWORD);

  const studentClient = await ApiClient.create(app);
  await studentClient.login(user.email, TEST_PASSWORD);

  return { admin, adminClient, student, studentClient, user, course, batch, enrollment };
}

describe('attendance sessions', () => {
  it('creates, opens and finalizes a session with an audited lifecycle', async () => {
    const { adminClient, batch } = await setupBatchWithStudent();

    const startsAt = daysFromNow(-2);
    const created = await adminClient.post('/attendance/sessions', {
      batchId: batch.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 90 * 60 * 1000).toISOString(),
      topic: 'Unit testing session',
    });
    expect(created.status).toBe(201);
    const session = dataOf<{ id: string; status: string }>(created);
    expect(session.status).toBe('SCHEDULED');

    const opened = await adminClient.post(`/attendance/sessions/${session.id}/open`);
    expect(opened.status).toBe(200);
    expect(dataOf<{ status: string }>(opened).status).toBe('OPEN');

    const finalized = await adminClient.post(`/attendance/sessions/${session.id}/finalize`);
    expect(finalized.status).toBe(200);

    const records = await prisma.attendanceRecord.findMany({ where: { sessionId: session.id } });
    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe('ABSENT');

    const reFinalize = await adminClient.post(`/attendance/sessions/${session.id}/finalize`);
    expect(reFinalize.status).toBe(422);
  });

  it('rejects a session whose end time is before its start time', async () => {
    const { adminClient, batch } = await setupBatchWithStudent();
    const startsAt = daysFromNow(-1);

    const response = await adminClient.post('/attendance/sessions', {
      batchId: batch.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() - 60_000).toISOString(),
    });

    expect(response.status).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
  });
});

describe('manual attendance', () => {
  it('records attendance once and rejects a duplicate entry', async () => {
    const { adminClient, batch, student } = await setupBatchWithStudent();
    const session = await createSession({ batchId: batch.id, status: 'OPEN' });

    const first = await adminClient.post('/attendance/manual', {
      sessionId: session.id,
      studentNumber: student.studentNumber,
      status: 'LATE',
      remarks: 'Arrived ten minutes late',
    });

    expect(first.status).toBe(200);
    const marked = dataOf<MarkResponse>(first);
    expect(marked.record.status).toBe('LATE');
    expect(marked.record.method).toBe('MANUAL');
    expect(marked.student.studentNumber).toBe(student.studentNumber);

    const duplicate = await adminClient.post('/attendance/manual', {
      sessionId: session.id,
      studentNumber: student.studentNumber,
      status: 'PRESENT',
    });

    expect(duplicate.status).toBe(409);
    expect(errorOf(duplicate).code).toBe('DUPLICATE_ATTENDANCE');

    const count = await prisma.attendanceRecord.count({ where: { sessionId: session.id } });
    expect(count).toBe(1);
  });

  it('rejects attendance for an unknown student number', async () => {
    const { adminClient, batch } = await setupBatchWithStudent();
    const session = await createSession({ batchId: batch.id, status: 'OPEN' });

    const response = await adminClient.post('/attendance/manual', {
      sessionId: session.id,
      studentNumber: 'STU-DOES-NOT-EXIST',
      status: 'PRESENT',
    });

    expect(response.status).toBe(404);
  });

  it('refuses to mark attendance in a session that is not open', async () => {
    const { adminClient, batch, student } = await setupBatchWithStudent();
    const session = await createSession({ batchId: batch.id, status: 'FINALIZED' });

    const response = await adminClient.post('/attendance/manual', {
      sessionId: session.id,
      studentNumber: student.studentNumber,
      status: 'PRESENT',
    });

    expect(response.status).toBe(409);
    expect(errorOf(response).code).toBe('SESSION_NOT_OPEN');
  });
});

describe('QR attendance', () => {
  it('accepts a valid student token once and rejects the replay', async () => {
    const { adminClient, studentClient, batch, student } = await setupBatchWithStudent(
      'qr-student@student.test',
    );
    const session = await createSession({ batchId: batch.id, status: 'OPEN' });

    const issued = await studentClient.post('/me/attendance/qr');
    expect(issued.status).toBe(201);
    const { token } = dataOf<{ token: string; expiresAt: string }>(issued);
    expect(token).toBeTruthy();

    const scan = await adminClient.post('/attendance/scan', { sessionId: session.id, qrToken: token });
    expect(scan.status).toBe(200);
    const marked = dataOf<MarkResponse>(scan);
    expect(marked.record.method).toBe('QR');
    expect(marked.student.studentNumber).toBe(student.studentNumber);

    const replay = await adminClient.post('/attendance/scan', { sessionId: session.id, qrToken: token });
    expect(replay.status).toBe(409);
    expect(errorOf(replay).code).toBe('DUPLICATE_ATTENDANCE');
  });

  it('rejects a token from a student who is not enrolled in the session batch', async () => {
    const { adminClient, batch } = await setupBatchWithStudent('enrolled@student.test');
    const course = await createCourse();
    const otherBatch = await createBatch(course.id);
    const outsider = await createStudentWithAccount({ email: 'outsider@student.test' });
    await createEnrollment({ studentId: outsider.student.id, batchId: otherBatch.id });

    const outsiderClient = await ApiClient.create(app);
    await outsiderClient.login(outsider.user.email, TEST_PASSWORD);
    const issued = await outsiderClient.post('/me/attendance/qr');
    const { token } = dataOf<{ token: string }>(issued);

    const session = await createSession({ batchId: batch.id, status: 'OPEN' });
    const scan = await adminClient.post('/attendance/scan', { sessionId: session.id, qrToken: token });

    expect(scan.status).toBe(422);
    expect(errorOf(scan).code).toBe('STUDENT_NOT_ENROLLED');
  });

  it('rejects an unrecognised token', async () => {
    const { adminClient, batch } = await setupBatchWithStudent('invalid-token@student.test');
    const session = await createSession({ batchId: batch.id, status: 'OPEN' });

    const scan = await adminClient.post('/attendance/scan', {
      sessionId: session.id,
      qrToken: 'this-token-was-never-issued-by-the-api',
    });

    expect(scan.status).toBe(422);
    expect(errorOf(scan).code).toBe('QR_TOKEN_INVALID');
  });

  it('rejects an expired token', async () => {
    const { adminClient, batch, student } = await setupBatchWithStudent('expired@student.test');
    const session = await createSession({ batchId: batch.id, status: 'OPEN' });
    const token = 'expired-token-value-1234567890';
    const { sha256 } = await import('../../src/utils/crypto');
    await prisma.qrToken.create({
      data: {
        studentId: student.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const scan = await adminClient.post('/attendance/scan', { sessionId: session.id, qrToken: token });

    expect(scan.status).toBe(422);
    expect(errorOf(scan).code).toBe('QR_TOKEN_EXPIRED');
  });
});

describe('attendance corrections and reporting', () => {
  it('only lets a permitted role correct a record, and requires a reason', async () => {
    const { adminClient, batch, enrollment, admin } = await setupBatchWithStudent(
      'correction@student.test',
    );
    const session = await createSession({ batchId: batch.id, status: 'FINALIZED' });
    const record = await createAttendanceRecord({
      sessionId: session.id,
      enrollmentId: enrollment.id,
      status: 'ABSENT',
      markedById: admin.id,
    });

    const frontDesk = await createUser({ role: 'FRONT_DESK', email: 'desk-correction@institute.test' });
    const frontDeskClient = await ApiClient.create(app);
    await frontDeskClient.login(frontDesk.email, TEST_PASSWORD);

    const denied = await frontDeskClient.patch(`/attendance/records/${record.id}`, {
      status: 'PRESENT',
      reason: 'Student produced a medical certificate',
    });
    expect(denied.status).toBe(403);

    const missingReason = await adminClient.patch(`/attendance/records/${record.id}`, {
      status: 'PRESENT',
      reason: 'ok',
    });
    expect(missingReason.status).toBe(400);

    const corrected = await adminClient.patch(`/attendance/records/${record.id}`, {
      status: 'PRESENT',
      reason: 'Student produced a medical certificate',
    });
    expect(corrected.status).toBe(200);

    const stored = await prisma.attendanceRecord.findUnique({ where: { id: record.id } });
    expect(stored?.status).toBe('PRESENT');
    expect(stored?.correctionReason).toBe('Student produced a medical certificate');

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'AttendanceRecord', entityId: record.id },
    });
    expect(audit).not.toBeNull();
  });

  it('computes a student percentage that ignores cancelled sessions', async () => {
    const { studentClient, batch, enrollment, admin } = await setupBatchWithStudent(
      'report@student.test',
    );

    const firstSession = await createSession({
      batchId: batch.id,
      status: 'FINALIZED',
      startsAt: daysFromNow(-5),
    });
    const secondSession = await createSession({
      batchId: batch.id,
      status: 'FINALIZED',
      startsAt: daysFromNow(-4),
    });
    const cancelledSession = await createSession({
      batchId: batch.id,
      status: 'CANCELLED',
      startsAt: daysFromNow(-3),
    });

    await createAttendanceRecord({
      sessionId: firstSession.id,
      enrollmentId: enrollment.id,
      status: 'PRESENT',
      markedById: admin.id,
    });
    await createAttendanceRecord({
      sessionId: secondSession.id,
      enrollmentId: enrollment.id,
      status: 'ABSENT',
      markedById: admin.id,
    });

    const response = await studentClient.get('/me/attendance');
    expect(response.status).toBe(200);
    const attendance = dataOf<{
      totals: { percentage: number; eligibleSessions: number; present: number; absent: number };
      summaries: Array<{ enrollmentId: string; summary: { percentage: number; eligibleSessions: number } }>;
    }>(response);

    expect(attendance.totals.eligibleSessions).toBe(2);
    expect(attendance.totals.present).toBe(1);
    expect(attendance.totals.absent).toBe(1);
    expect(attendance.totals.percentage).toBe(50);
    expect(attendance.summaries[0]?.summary.eligibleSessions).toBe(2);

    const cancelledRecords = await prisma.attendanceRecord.count({
      where: { sessionId: cancelledSession.id },
    });
    expect(cancelledRecords).toBe(0);
  });
});
