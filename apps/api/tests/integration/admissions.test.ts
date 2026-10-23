import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { ApiClient, dataOf, errorOf } from '../helpers/client';
import { resetDatabase } from '../helpers/db';
import {
  createBatch,
  createCourse,
  createStudent,
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

interface StudentRecord {
  id: string;
  studentNumber: string;
  fullName: string;
  status: string;
}

interface EnrollmentRecord {
  id: string;
  status: string;
  agreedFeeMinor: number;
  student: { id: string; studentNumber: string };
  batch: { id: string; code: string };
}

const admissionDate = () => daysFromNow(-1).toISOString().slice(0, 10);

async function frontDeskClient() {
  const user = await createUser({ role: 'FRONT_DESK', email: 'admissions@institute.test' });
  const client = await ApiClient.create(app);
  await client.login(user.email, TEST_PASSWORD);
  return { user, client };
}

describe('student admissions', () => {
  it('creates a student with a generated unique student number', async () => {
    const { client } = await frontDeskClient();

    const first = await client.post('/students', {
      fullName: 'Ayesha Siddiqui',
      guardianName: 'Siddiqui Ahmed',
      phone: '+92 300 2220001',
      email: 'ayesha@student.test',
      admissionDate: admissionDate(),
    });
    expect(first.status).toBe(201);
    const created = dataOf<StudentRecord>(first);
    expect(created.studentNumber).toMatch(/^STU-\d{4}-\d{4,6}$/);
    expect(created.status).toBe('ACTIVE');

    const second = await client.post('/students', {
      fullName: 'Bilal Ahmed',
      phone: '+92 300 2220002',
      admissionDate: admissionDate(),
    });
    expect(second.status).toBe(201);
    expect(dataOf<StudentRecord>(second).studentNumber).not.toBe(created.studentNumber);
  });

  it('validates the admission form on the server', async () => {
    const { client } = await frontDeskClient();

    const response = await client.post('/students', {
      fullName: 'A',
      phone: '12',
      email: 'not-an-email',
      admissionDate: 'yesterday',
    });

    expect(response.status).toBe(400);
    const fields = errorOf(response).details?.map((detail) => detail.field) ?? [];
    expect(fields).toEqual(expect.arrayContaining(['fullName', 'phone', 'email', 'admissionDate']));
  });

  it('archives a student instead of deleting their history', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN', email: 'archive-admin@institute.test' });
    const client = await ApiClient.create(app);
    await client.login(admin.email, TEST_PASSWORD);
    const student = await createStudent();

    const response = await client.post(`/students/${student.id}/archive`);
    expect(response.status).toBe(200);

    const stored = await prisma.student.findUnique({ where: { id: student.id } });
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe('ARCHIVED');
    expect(stored?.archivedAt).not.toBeNull();

    const archivedOnly = await client.get('/students?status=ARCHIVED');
    expect(dataOf<StudentRecord[]>(archivedOnly).map((row) => row.id)).toContain(student.id);

    const activeOnly = await client.get('/students?status=ACTIVE');
    expect(dataOf<StudentRecord[]>(activeOnly).map((row) => row.id)).not.toContain(student.id);
  });

  it('rejects a portal account without an email address', async () => {
    const { client } = await frontDeskClient();
    const student = await createStudent();

    const response = await client.post(`/students/${student.id}/account`, {
      email: 'not-an-email',
      password: 'PortalPass#2026',
    });

    expect(response.status).toBe(400);
  });
});

describe('enrollments', () => {
  it('enrolls a student in a batch and exposes the agreed fee', async () => {
    const { client } = await frontDeskClient();
    const course = await createCourse();
    const batch = await createBatch(course.id);
    const student = await createStudent();

    const response = await client.post('/enrollments', {
      studentId: student.id,
      batchId: batch.id,
      joinedAt: daysFromNow(-10).toISOString().slice(0, 10),
      agreedFeeMinor: 45_000_00,
      status: 'ACTIVE',
    });

    expect(response.status).toBe(201);
    const enrollment = dataOf<EnrollmentRecord>(response);
    expect(enrollment.student.id).toBe(student.id);
    expect(enrollment.batch.id).toBe(batch.id);
    expect(enrollment.agreedFeeMinor).toBe(45_000_00);
    expect(enrollment.status).toBe('ACTIVE');

    const detail = await client.get(`/enrollments/${enrollment.id}`);
    expect(detail.status).toBe(200);
  });

  it('prevents the same student from being enrolled twice in one batch', async () => {
    const { client } = await frontDeskClient();
    const course = await createCourse();
    const batch = await createBatch(course.id);
    const student = await createStudent();
    const payload = {
      studentId: student.id,
      batchId: batch.id,
      joinedAt: daysFromNow(-10).toISOString().slice(0, 10),
      agreedFeeMinor: 10_000,
    };

    const first = await client.post('/enrollments', payload);
    expect(first.status).toBe(201);

    const duplicate = await client.post('/enrollments', payload);
    expect(duplicate.status).toBe(409);
  });

  it('records completion through the enrollment status transition', async () => {
    const { client } = await frontDeskClient();
    const course = await createCourse();
    const batch = await createBatch(course.id);
    const student = await createStudent();
    const enrollment = dataOf<EnrollmentRecord>(
      await client.post('/enrollments', {
        studentId: student.id,
        batchId: batch.id,
        joinedAt: daysFromNow(-60).toISOString().slice(0, 10),
        agreedFeeMinor: 10_000,
      }),
    );

    const completionDate = daysFromNow(-1).toISOString().slice(0, 10);
    const updated = await client.patch(`/enrollments/${enrollment.id}`, {
      status: 'COMPLETED',
      completedAt: completionDate,
    });

    expect(updated.status).toBe(200);
    const stored = await prisma.enrollment.findUnique({ where: { id: enrollment.id } });
    expect(stored?.status).toBe('COMPLETED');
    expect(stored?.completedAt?.toISOString().slice(0, 10)).toBe(completionDate);
  });

  it('rejects an enrollment for an unknown student', async () => {
    const { client } = await frontDeskClient();
    const course = await createCourse();
    const batch = await createBatch(course.id);

    const response = await client.post('/enrollments', {
      studentId: '00000000-0000-4000-8000-000000000000',
      batchId: batch.id,
      agreedFeeMinor: 10_000,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });
});
