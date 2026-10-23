import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { ApiClient, dataOf, errorOf } from '../helpers/client';
import { resetDatabase } from '../helpers/db';
import {
  createBatch,
  createCourse,
  createEnrollment,
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

async function staffClient(role: 'SUPER_ADMIN' | 'FRONT_DESK' = 'SUPER_ADMIN') {
  const user = await createUser({ role, email: `${role.toLowerCase()}@institute.test` });
  const client = await ApiClient.create(app);
  await client.login(user.email, TEST_PASSWORD);
  return { user, client };
}

describe('institute settings', () => {
  it('lets an administrator change settings and exposes them to staff', async () => {
    const { client } = await staffClient('SUPER_ADMIN');

    const updated = await client.patch('/settings', {
      instituteName: 'Karachi Institute of Technology',
      attendanceThresholdPercent: 80,
      lateCountsAsPresent: true,
    });
    expect(updated.status).toBe(200);

    const frontDesk = await staffClient('FRONT_DESK');
    const read = await frontDesk.client.get('/settings');
    expect(read.status).toBe(200);
    const settings = dataOf<{ instituteName: string; attendanceThresholdPercent: number }>(read);
    expect(settings.instituteName).toBe('Karachi Institute of Technology');
    expect(settings.attendanceThresholdPercent).toBe(80);
  });

  it('validates settings values such as the time zone', async () => {
    const { client } = await staffClient('SUPER_ADMIN');

    const response = await client.patch('/settings', { timeZone: 'Mars/Olympus' });

    expect(response.status).toBe(400);
    expect(errorOf(response).details?.[0]?.field).toBe('timeZone');
  });

  it('stops a front desk manager from changing settings', async () => {
    const { client } = await staffClient('FRONT_DESK');

    const response = await client.patch('/settings', { instituteName: 'Not Allowed' });

    expect(response.status).toBe(403);
  });
});

describe('announcements', () => {
  it('shows published student announcements and hides drafts and staff-only posts', async () => {
    const { client } = await staffClient('SUPER_ADMIN');
    const { user } = await createStudentWithAccount({ email: 'announce@student.test' });
    const studentClient = await ApiClient.create(app);
    await studentClient.login(user.email, TEST_PASSWORD);

    const published = await client.post('/announcements', {
      title: 'Mid-term timetable published',
      body: 'The mid-term assessment timetable is now available in your portal.',
      audience: 'STUDENTS',
      status: 'PUBLISHED',
    });
    expect(published.status).toBe(201);

    await client.post('/announcements', {
      title: 'Draft internal note',
      body: 'This note is not published yet and must stay hidden from students.',
      audience: 'STUDENTS',
      status: 'DRAFT',
    });
    await client.post('/announcements', {
      title: 'Staff briefing',
      body: 'Internal staff briefing that students must never see in the portal.',
      audience: 'STAFF',
      status: 'PUBLISHED',
    });

    const feed = await studentClient.get('/me/announcements');
    expect(feed.status).toBe(200);
    const titles = dataOf<Array<{ title: string }>>(feed).map((item) => item.title);
    expect(titles).toContain('Mid-term timetable published');
    expect(titles).not.toContain('Draft internal note');
    expect(titles).not.toContain('Staff briefing');
  });

  it('requires a meaningful announcement body', async () => {
    const { client } = await staffClient('SUPER_ADMIN');

    const response = await client.post('/announcements', {
      title: 'Too short',
      body: 'short',
    });

    expect(response.status).toBe(400);
  });
});

describe('assessments', () => {
  it('records results and derives pass/fail from the configured pass marks', async () => {
    const { user, client } = await staffClient('SUPER_ADMIN');
    const course = await createCourse();
    const batch = await createBatch(course.id);
    const first = await createStudentWithAccount({ email: 'result-a@student.test' });
    const second = await createStudentWithAccount({ email: 'result-b@student.test' });
    const firstEnrollment = await createEnrollment({ studentId: first.student.id, batchId: batch.id });
    const secondEnrollment = await createEnrollment({ studentId: second.student.id, batchId: batch.id });

    const created = await client.post('/assessments', {
      courseId: course.id,
      batchId: batch.id,
      title: 'JavaScript fundamentals',
      maxMarks: 100,
      passMarks: 50,
      assessmentDate: daysFromNow(-2).toISOString().slice(0, 10),
      status: 'PUBLISHED',
    });
    expect(created.status).toBe(201);
    const assessment = dataOf<{ id: string }>(created);

    const results = await client.put(`/assessments/${assessment.id}/results`, {
      results: [
        { enrollmentId: firstEnrollment.id, marksObtained: 72 },
        { enrollmentId: secondEnrollment.id, marksObtained: 31 },
      ],
    });
    expect(results.status).toBe(200);

    const stored = await prisma.assessmentResult.findMany({
      where: { assessmentId: assessment.id },
      select: { enrollmentId: true, status: true, marksObtained: true },
    });
    const byEnrollment = new Map(stored.map((row) => [row.enrollmentId, row]));
    expect(byEnrollment.get(firstEnrollment.id)?.status).toBe('PASS');
    expect(byEnrollment.get(secondEnrollment.id)?.status).toBe('FAIL');
    expect(byEnrollment.get(firstEnrollment.id)?.marksObtained).toBe(72);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: assessment.id, action: 'ASSESSMENT_RESULTS_RECORDED' },
    });
    expect(audit).not.toBeNull();
    expect(user.id).toBeTruthy();
  });

  it('rejects marks above the maximum and invalid pass marks', async () => {
    const { client } = await staffClient('SUPER_ADMIN');
    const course = await createCourse();
    const batch = await createBatch(course.id);
    const student = await createStudentWithAccount({ email: 'result-c@student.test' });
    const enrollment = await createEnrollment({ studentId: student.student.id, batchId: batch.id });

    const invalidPass = await client.post('/assessments', {
      courseId: course.id,
      batchId: batch.id,
      title: 'Invalid pass marks',
      maxMarks: 50,
      passMarks: 80,
      assessmentDate: daysFromNow(-2).toISOString().slice(0, 10),
    });
    expect(invalidPass.status).toBe(400);

    const created = dataOf<{ id: string }>(
      await client.post('/assessments', {
        courseId: course.id,
        batchId: batch.id,
        title: 'Database design',
        maxMarks: 40,
        passMarks: 20,
        assessmentDate: daysFromNow(-2).toISOString().slice(0, 10),
      }),
    );

    const tooManyMarks = await client.put(`/assessments/${created.id}/results`, {
      results: [{ enrollmentId: enrollment.id, marksObtained: 41 }],
    });

    expect(tooManyMarks.status).toBe(422);
  });
});

describe('reports', () => {
  it('exports fee collections as CSV for an authorised administrator', async () => {
    const { client } = await staffClient('SUPER_ADMIN');

    const response = await client.get('/reports/fees/collections?format=csv');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text.split('\n')[0]).toContain('Receipt');
  });

  it('returns real dashboard figures from the database', async () => {
    const { client } = await staffClient('SUPER_ADMIN');
    const course = await createCourse();
    const batch = await createBatch(course.id);
    const student = await createStudentWithAccount({ email: 'dashboard@student.test' });
    await createEnrollment({ studentId: student.student.id, batchId: batch.id });

    const response = await client.get('/dashboards/admin');
    expect(response.status).toBe(200);
    const payload = dataOf<{
      students: { total: number; active: number; activeEnrollments: number };
      academics: { activeBatches: number };
    }>(response);

    expect(payload.students.total).toBe(await prisma.student.count({ where: { status: { not: 'ARCHIVED' } } }));
    expect(payload.students.activeEnrollments).toBe(1);
    expect(payload.academics.activeBatches).toBe(1);
  });
});
