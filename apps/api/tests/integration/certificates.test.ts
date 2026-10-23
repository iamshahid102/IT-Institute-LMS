import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
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

interface Eligibility {
  eligible: boolean;
  checks: Array<{ key: string; passed: boolean; detail: string }>;
  existingCertificate: { id: string } | null;
}

interface IssuedCertificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  status: string;
  courseTitle: string;
}

async function completedEnrollmentContext() {
  const admin = await createUser({ role: 'SUPER_ADMIN', email: 'cert-admin@institute.test' });
  const client = await ApiClient.create(app);
  await client.login(admin.email, TEST_PASSWORD);

  const course = await createCourse({ title: 'Advanced Backend Engineering' });
  const batch = await createBatch(course.id);
  const { student, user } = await createStudentWithAccount({ email: 'cert@student.test' });
  const enrollment = await createEnrollment({
    studentId: student.id,
    batchId: batch.id,
    status: 'COMPLETED',
    completedAt: daysFromNow(-1),
  });

  const firstSession = await createSession({
    batchId: batch.id,
    status: 'FINALIZED',
    startsAt: daysFromNow(-10),
  });
  const secondSession = await createSession({
    batchId: batch.id,
    status: 'FINALIZED',
    startsAt: daysFromNow(-9),
  });
  for (const session of [firstSession, secondSession]) {
    await createAttendanceRecord({
      sessionId: session.id,
      enrollmentId: enrollment.id,
      status: 'PRESENT',
      markedById: admin.id,
    });
  }

  const studentClient = await ApiClient.create(app);
  await studentClient.login(user.email, TEST_PASSWORD);

  return { admin, client, course, batch, student, user, enrollment, studentClient };
}

describe('certificate eligibility and issuance', () => {
  it('explains why an active enrollment is not yet eligible', async () => {
    const { admin, client, batch, student } = await completedEnrollmentContext();
    const activeCourse = await createCourse();
    const activeBatch = await createBatch(activeCourse.id);
    const activeEnrollment = await createEnrollment({
      studentId: (await createStudentWithAccount({ email: 'active@student.test' })).student.id,
      batchId: activeBatch.id,
      status: 'ACTIVE',
    });

    const eligibility = await client.get(`/certificates/eligibility/${activeEnrollment.id}`);
    expect(eligibility.status).toBe(200);
    const result = dataOf<Eligibility>(eligibility);
    expect(result.eligible).toBe(false);
    const completion = result.checks.find((check) => check.key === 'completion');
    expect(completion?.passed).toBe(false);

    const issue = await client.post('/certificates/issue', { enrollmentId: activeEnrollment.id });
    expect(issue.status).toBe(422);
    expect(errorOf(issue).message).toContain('Enrollment completed');

    expect(batch.id).toBeTruthy();
    expect(student.id).toBeTruthy();
    expect(admin.id).toBeTruthy();
  });

  it('blocks issuance while fees are outstanding', async () => {
    const { client, enrollment } = await completedEnrollmentContext();

    const invoice = await client.post('/invoices', {
      enrollmentId: enrollment.id,
      dueAt: daysFromNow(5).toISOString().slice(0, 10),
      items: [{ description: 'Final instalment', quantity: 1, unitAmountMinor: 25_000 }],
    });
    expect(invoice.status).toBe(201);

    const eligibility = await client.get(`/certificates/eligibility/${enrollment.id}`);
    const result = dataOf<Eligibility>(eligibility);
    const fees = result.checks.find((check) => check.key === 'fees');
    expect(fees?.passed).toBe(false);
    expect(result.eligible).toBe(false);

    const issue = await client.post('/certificates/issue', { enrollmentId: enrollment.id });
    expect(issue.status).toBe(422);
  });

  it('issues one certificate for an eligible enrollment and refuses a duplicate', async () => {
    const { client, enrollment } = await completedEnrollmentContext();

    const eligibility = await client.get(`/certificates/eligibility/${enrollment.id}`);
    expect(dataOf<Eligibility>(eligibility).eligible).toBe(true);

    const issued = await client.post('/certificates/issue', { enrollmentId: enrollment.id });
    expect(issued.status).toBe(201);
    const certificate = dataOf<IssuedCertificate>(issued);
    expect(certificate.certificateNumber).toMatch(/^CERT-\d{4}-\d{6}$/);
    expect(certificate.status).toBe('ISSUED');
    expect(certificate.verificationCode.length).toBeGreaterThanOrEqual(20);
    expect(certificate.courseTitle).toBe('Advanced Backend Engineering');

    const duplicate = await client.post('/certificates/issue', { enrollmentId: enrollment.id });
    expect(duplicate.status).toBe(409);
  });

  it('stops a front desk manager from issuing certificates', async () => {
    const { enrollment } = await completedEnrollmentContext();
    const frontDesk = await createUser({ role: 'FRONT_DESK', email: 'cert-desk@institute.test' });
    const deskClient = await ApiClient.create(app);
    await deskClient.login(frontDesk.email, TEST_PASSWORD);

    const response = await deskClient.post('/certificates/issue', { enrollmentId: enrollment.id });
    expect(response.status).toBe(403);
  });
});

describe('certificate verification and download', () => {
  it('publishes only the approved fields on the public verification page', async () => {
    const { client, enrollment, student } = await completedEnrollmentContext();
    const certificate = dataOf<IssuedCertificate>(
      await client.post('/certificates/issue', { enrollmentId: enrollment.id }),
    );

    const anonymous = await ApiClient.create(app);
    const verification = await anonymous.get(
      `/public/certificates/verify/${certificate.verificationCode}`,
    );

    expect(verification.status).toBe(200);
    const payload = dataOf<Record<string, unknown>>(verification);
    expect(payload.certificateNumber).toBe(certificate.certificateNumber);
    expect(payload.status).toBe('ISSUED');
    expect(payload.studentName).toBe(student.fullName);

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(student.phone);
    expect(serialized).not.toContain(student.studentNumber);
    expect(serialized).not.toContain('storageKey');
    expect(serialized).not.toContain('certificates/');
    expect(Object.keys(payload)).not.toContain('email');
    expect(Object.keys(payload)).not.toContain('address');
  });

  it('returns 404 for an unknown verification code', async () => {
    const anonymous = await ApiClient.create(app);
    const response = await anonymous.get('/public/certificates/verify/not-a-real-verification-code');

    expect(response.status).toBe(404);
  });

  it('lets the owning student download a PDF and blocks every other student', async () => {
    const { client, enrollment, studentClient } = await completedEnrollmentContext();
    const certificate = dataOf<IssuedCertificate>(
      await client.post('/certificates/issue', { enrollmentId: enrollment.id }),
    );

    const ownDownload = await studentClient.get(`/me/certificates/${certificate.id}/download`);
    expect(ownDownload.status).toBe(200);
    expect(ownDownload.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(ownDownload.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    const intruder = await createStudentWithAccount({ email: 'intruder@student.test' });
    const intruderClient = await ApiClient.create(app);
    await intruderClient.login(intruder.user.email, TEST_PASSWORD);

    const blocked = await intruderClient.get(`/me/certificates/${certificate.id}/download`);
    expect(blocked.status).toBe(404);

    expect(intruder.student.id).toBeTruthy();
  });

  it('records revocation, shows it publicly and stops further student downloads', async () => {
    const { client, enrollment, studentClient } = await completedEnrollmentContext();
    const certificate = dataOf<IssuedCertificate>(
      await client.post('/certificates/issue', { enrollmentId: enrollment.id }),
    );

    const missingReason = await client.post(`/certificates/${certificate.id}/revoke`, { reason: 'no' });
    expect(missingReason.status).toBe(400);

    const revoked = await client.post(`/certificates/${certificate.id}/revoke`, {
      reason: 'Issued against an incorrect enrollment record',
    });
    expect(revoked.status).toBe(200);
    expect((revoked.body as { data: { status: string; revocationReason: string } }).data.status).toBe(
      'REVOKED',
    );

    const anonymous = await ApiClient.create(app);
    const verification = await anonymous.get(
      `/public/certificates/verify/${certificate.verificationCode}`,
    );
    const payload = dataOf<{ status: string; revokedAt: string | null }>(verification);
    expect(payload.status).toBe('REVOKED');
    expect(payload.revokedAt).not.toBeNull();

    const download = await studentClient.get(`/me/certificates/${certificate.id}/download`);
    expect(download.status).toBe(409);
    expect(errorOf(download).code).toBe('CERTIFICATE_REVOKED');

    const reRevoke = await client.post(`/certificates/${certificate.id}/revoke`, {
      reason: 'Trying to revoke twice',
    });
    expect(reRevoke.status).toBe(422);
  });
});
