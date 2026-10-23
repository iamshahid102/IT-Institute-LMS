import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { ApiClient, errorOf } from '../helpers/client';
import { resetDatabase } from '../helpers/db';
import { TEST_PASSWORD, createUser } from '../helpers/fixtures';

let app: Express;

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('authentication', () => {
  it('signs a user in with an HttpOnly session cookie and returns permissions', async () => {
    const user = await createUser({ role: 'SUPER_ADMIN', email: 'admin@institute.test' });
    const client = await ApiClient.create(app);

    const response = await client.post('/auth/login', {
      email: user.email,
      password: TEST_PASSWORD,
    });

    expect(response.status).toBe(200);
    const sessionCookie = (response.headers['set-cookie'] as unknown as string[]).find((cookie) =>
      cookie.startsWith('lms_session='),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');

    const body = response.body as { data: { user: { email: string; role: string; permissions: string[] } } };
    expect(body.data.user.email).toBe(user.email);
    expect(body.data.user.role).toBe('SUPER_ADMIN');
    expect(body.data.user.permissions).toContain('settings.manage');
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('rejects unsafe requests that do not echo the CSRF token', async () => {
    const user = await createUser({ role: 'SUPER_ADMIN', email: 'csrf@institute.test' });
    const client = await ApiClient.create(app);

    const response = await client.agent
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(response.status).toBe(403);
    expect(errorOf(response).code).toBe('CSRF_INVALID');
  });

  it('returns the current user for an authenticated session and 401 without one', async () => {
    const user = await createUser({ role: 'FRONT_DESK', email: 'frontdesk@institute.test' });
    const anonymous = await ApiClient.create(app);

    const unauthenticated = await anonymous.get('/auth/me');
    expect(unauthenticated.status).toBe(401);
    expect(errorOf(unauthenticated).code).toBe('UNAUTHENTICATED');

    const client = await ApiClient.create(app);
    await client.login(user.email, TEST_PASSWORD);

    const authenticated = await client.get('/auth/me');
    expect(authenticated.status).toBe(200);
    expect((authenticated.body as { data: { user: { email: string } } }).data.user.email).toBe(user.email);
  });

  it('gives the same generic answer for a wrong password and an unknown email', async () => {
    await createUser({ role: 'SUPER_ADMIN', email: 'known@institute.test' });
    const client = await ApiClient.create(app);

    const wrongPassword = await client.post('/auth/login', {
      email: 'known@institute.test',
      password: 'CompletelyWrong#1',
    });
    const unknownEmail = await client.post('/auth/login', {
      email: 'nobody@institute.test',
      password: TEST_PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(errorOf(wrongPassword).code).toBe('INVALID_CREDENTIALS');
    expect(errorOf(unknownEmail).code).toBe('INVALID_CREDENTIALS');
    expect(errorOf(wrongPassword).message).toBe(errorOf(unknownEmail).message);
  });

  it('refuses to sign in a suspended account and never leaks a stack trace', async () => {
    const user = await createUser({
      role: 'FRONT_DESK',
      email: 'suspended@institute.test',
      status: 'SUSPENDED',
    });
    const client = await ApiClient.create(app);

    const response = await client.post('/auth/login', {
      email: user.email,
      password: TEST_PASSWORD,
    });

    expect(response.status).toBe(401);
    const error = errorOf(response);
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(JSON.stringify(response.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  it('validates the login payload before touching the database', async () => {
    const client = await ApiClient.create(app);

    const response = await client.post('/auth/login', { email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
    const error = errorOf(response);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((detail) => detail.field)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('revokes the session on logout', async () => {
    const user = await createUser({ role: 'SUPER_ADMIN', email: 'logout@institute.test' });
    const client = await ApiClient.create(app);
    await client.login(user.email, TEST_PASSWORD);

    const logout = await client.post('/auth/logout');
    expect(logout.status).toBe(204);

    const afterLogout = await client.get('/auth/me');
    expect(afterLogout.status).toBe(401);

    const sessions = await prisma.authSession.findMany({ where: { userId: user.id } });
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
  });

  it('rotates the password and signs out every other session', async () => {
    const user = await createUser({ role: 'SUPER_ADMIN', email: 'rotate@institute.test' });
    const firstDevice = await ApiClient.create(app);
    await firstDevice.login(user.email, TEST_PASSWORD);
    const secondDevice = await ApiClient.create(app);
    await secondDevice.login(user.email, TEST_PASSWORD);

    const newPassword = 'FreshPass#2026';
    const change = await firstDevice.patch('/auth/change-password', {
      currentPassword: TEST_PASSWORD,
      newPassword,
    });
    expect(change.status).toBe(200);

    const otherSession = await secondDevice.get('/auth/me');
    expect(otherSession.status).toBe(401);

    const oldPasswordClient = await ApiClient.create(app);
    const oldLogin = await oldPasswordClient.post('/auth/login', {
      email: user.email,
      password: TEST_PASSWORD,
    });
    expect(oldLogin.status).toBe(401);

    const newPasswordClient = await ApiClient.create(app);
    const newLogin = await newPasswordClient.post('/auth/login', {
      email: user.email,
      password: newPassword,
    });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a password change when the current password is wrong', async () => {
    const user = await createUser({ role: 'SUPER_ADMIN', email: 'wrongchange@institute.test' });
    const client = await ApiClient.create(app);
    await client.login(user.email, TEST_PASSWORD);

    const response = await client.patch('/auth/change-password', {
      currentPassword: 'NotMyPassword#1',
      newPassword: 'AnotherPass#2026',
    });

    expect(response.status).toBe(400);
    const error = errorOf(response);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.[0]?.field).toBe('currentPassword');
  });

  it('answers password reset requests generically for known and unknown accounts', async () => {
    await createUser({ role: 'SUPER_ADMIN', email: 'reset@institute.test' });
    const client = await ApiClient.create(app);

    const known = await client.post('/auth/forgot-password', { email: 'reset@institute.test' });
    const unknown = await client.post('/auth/forgot-password', { email: 'ghost@institute.test' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('serves health and readiness endpoints', async () => {
    const client = await ApiClient.create(app);

    const live = await client.agent.get('/health');
    expect(live.status).toBe(200);
    expect(live.body).toEqual({ status: 'ok', service: 'lms-api' });

    const ready = await client.agent.get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: 'ready' });
  });
});
