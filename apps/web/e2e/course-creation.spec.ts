import { expect, test } from '@playwright/test';
import { SEEDED_ACCOUNTS, signIn } from './helpers';

test('a super admin creates a course that appears in the course list', async ({ page }) => {
  await signIn(page, SEEDED_ACCOUNTS.admin, '/admin');

  await page.goto('/admin/courses');
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible();

  const suffix = Date.now().toString().slice(-6);
  const code = `E2E-${suffix}`;
  const title = `Automation Testing ${suffix}`;

  await page.getByRole('button', { name: 'New course' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByLabel('Course code').fill(code);
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Duration').fill('8');
  await page.getByRole('button', { name: 'Create course' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Course created.')).toBeVisible();

  await expect(page.getByRole('cell', { name: new RegExp(title) })).toBeVisible();
  await expect(page.getByText(code)).toBeVisible();
});
