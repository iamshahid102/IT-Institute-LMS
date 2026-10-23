import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ApiClient } from '../helpers/client';
import { resetDatabase } from '../helpers/db';
import {
  createBatch,
  createCertificate,
  createCourse,
  createEnrollment,
  createInvoice,
  createPayment,
  createStudent,
  createStudentWithAccount,
  createUser,
  TEST_PASSWORD,
} from '../helpers/fixtures';

let app: Express;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('role permissions', () => {
  it('blocks a front desk manager from privileged staff, settings, audit and reversal actions', async () => {
    const frontDesk = await createUser({ role: 'FRONT_DESK', email: 'desk@institute.test' });
    const admin = await createUser({ role: 'SUPER_ADMIN', email: 'admin@institute.test' });
    const course = await createCourse();
    const batch = await createBatch(course.id);
    const student = await createStudent();
    const enrollment = await createEnrollment({ studentId: student.id, batchId: batch.id });
    const invoice = await createInvoice({
      enrollmentId: enrollment.id,
      createdById: admin.id,
      totalMinor: 100_000,
    });
    const payment = await createPayment({
      invoiceId: invoice.id,
      receivedById: admin.id,
      amountMinor: 50_000,
    });
    const certificate = await createCertificate({
      enrollmentId: enrollment.id,
      issuedById: admin.id,
    });

    const client = await ApiClient.create(app);
    await client.login(frontDesk.email, TEST_PASSWORD);

    const attempts = await Promise.all([
      client.get('/users'),
      client.post('/users', {
        fullName: 'New Admin',
        email: 'new.admin@institute.test',
        role: 'SUPER_ADMIN',
        password: 'AnotherPass#2026',
      }),
      client.patch('/settings', { instituteName: 'Hijacked Institute' }),
      client.get('/audit-logs'),
      client.post(`/certificates/${certificate.id}/revoke`, { reason: 'Not allowed to revoke' }),
      client.post(`/payments/${payment.id}/reverse`, { reason: 'Not allowed to reverse' }),
      client.get('/reports/fees/collections'),
    ]);

    for (const response of attempts) {
      expect(response.status).toBe(403);
    }
  });

  it('allows a front desk manager to run day-to-day admissions and operations', async () => {
    const frontDesk = await createUser({ role: 'FRONT_DESK', email: 'allowed@institute.test' });
    const client = await ApiClient.create(app);
    await client.login(frontDesk.email, TEST_PASSWORD);

    const students = await client.get('/students');
    expect(students.status).toBe(200);

    const created = await client.post('/students', {
      fullName: 'Walk-in Applicant',
      guardianName: 'Applicant Guardian',
      phone: '+92 300 7770000',
      email: 'walkin@student.test',
      admissionDate: new Date().toISOString().slice(0, 10),
    });
    expect(created.status).toBe(201);

    const settings = await client.get('/settings');
    expect(settings.status).toBe(200);

    const reports = await client.get('/reports/admissions');
    expect(reports.status).toBe(200);
  });

  it('keeps students out of every staff-only surface', async () => {
    const { user } = await createStudentWithAccount({ email: 'student@student.test' });
    const client = await ApiClient.create(app);
    await client.login(user.email, TEST_PASSWORD);

    const blocked = await Promise.all([
      client.get('/students'),
      client.get('/certificates'),
      client.get('/fee-plans'),
      client.get('/audit-logs'),
      client.get('/reports/admissions'),
      client.post('/students', {
        fullName: 'Impersonated',
        guardianName: 'Nope',
        phone: '+92 300 0000000',
        admissionDate: new Date().toISOString().slice(0, 10),
      }),
    ]);

    for (const response of blocked) {
      expect(response.status).toBe(403);
    }

    const portalProfile = await client.get('/me/profile');
    expect(portalProfile.status).toBe(200);
  });
});

describe('student record ownership', () => {
  it('serves a student only their own financial and certificate records', async () => {
    const staff = await createUser({ role: 'SUPER_ADMIN', email: 'owner-admin@institute.test' });
    const course = await createCourse();
    const batch = await createBatch(course.id);

    const first = await createStudentWithAccount({
      fullName: 'First Student',
      email: 'first@student.test',
    });
    const second = await createStudentWithAccount({
      fullName: 'Second Student',
      email: 'second@student.test',
    });

    const firstEnrollment = await createEnrollment({
      studentId: first.student.id,
      batchId: batch.id,
    });
    const secondEnrollment = await createEnrollment({
      studentId: second.student.id,
      batchId: batch.id,
    });

    const firstInvoice = await createInvoice({
      enrollmentId: firstEnrollment.id,
      createdById: staff.id,
      totalMinor: 30_000,
    });
    await createPayment({
      invoiceId: firstInvoice.id,
      receivedById: staff.id,
      amountMinor: 10_000,
    });

    const secondInvoice = await createInvoice({
      enrollmentId: secondEnrollment.id,
      createdById: staff.id,
      totalMinor: 90_000,
    });
    const secondPayment = await createPayment({
      invoiceId: secondInvoice.id,
      receivedById: staff.id,
      amountMinor: 45_000,
    });
    const secondCertificate = await createCertificate({
      enrollmentId: secondEnrollment.id,
      issuedById: staff.id,
    });

    const client = await ApiClient.create(app);
    await client.login(first.user.email, TEST_PASSWORD);

    const myFees = await client.get('/me/fees');
    expect(myFees.status).toBe(200);
    const fees = (myFees.body as { data: { student: { id: string }; summary: { billedMinor: number } } }).data;
    expect(fees.student.id).toBe(first.student.id);
    expect(fees.summary.billedMinor).toBe(30_000);

    const otherReceipt = await client.get(`/me/receipts/${secondPayment.id}/download`);
    expect(otherReceipt.status).toBe(404);

    const otherCertificate = await client.get(`/me/certificates/${secondCertificate.id}/download`);
    expect(otherCertificate.status).toBe(404);

    const otherProfile = await client.get(`/students/${second.student.id}`);
    expect(otherProfile.status).toBe(403);

    const receipts = await client.get('/me/receipts');
    expect(receipts.status).toBe(200);
    const receiptRows = (receipts.body as { data: Array<{ invoice: { id: string } }> }).data;
    expect(receiptRows).toHaveLength(1);
    expect(receiptRows[0]?.invoice.id).toBe(firstInvoice.id);
  });

  it('ignores attempts to change protected profile fields through the portal', async () => {
    const { student, user } = await createStudentWithAccount({ email: 'profile@student.test' });
    const client = await ApiClient.create(app);
    await client.login(user.email, TEST_PASSWORD);

    const response = await client.patch('/me/profile', {
      phone: '+92 300 1112223',
      address: '12 Learning Street',
      fullName: 'Name Injected By Client',
      status: 'GRADUATED',
      studentNumber: 'HACKED-001',
    });

    expect(response.status).toBe(200);
    const updated = await client.get('/me/profile');
    const profile = (updated.body as { data: { fullName: string; phone: string; status: string } }).data;
    expect(profile.fullName).toBe(student.fullName);
    expect(profile.phone).toBe('+92 300 1112223');
    expect(profile.status).toBe('ACTIVE');

    const stored = await client.get('/me/profile');
    expect((stored.body as { data: { studentNumber: string } }).data.studentNumber).toBe(
      student.studentNumber,
    );
  });

  it('returns an empty portal state for a student with no enrollments', async () => {
    const { user } = await createStudentWithAccount({ email: 'empty@student.test' });
    const client = await ApiClient.create(app);
    await client.login(user.email, TEST_PASSWORD);

    const [enrollments, certificates, receipts] = await Promise.all([
      client.get('/me/enrollments'),
      client.get('/me/certificates'),
      client.get('/me/receipts'),
    ]);

    expect(enrollments.status).toBe(200);
    expect((enrollments.body as { data: unknown[] }).data).toEqual([]);
    expect((certificates.body as { data: unknown[] }).data).toEqual([]);
    expect((receipts.body as { data: unknown[] }).data).toEqual([]);
  });
});
