import { expect, test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('staff workspace', () => {
  test('loads the operations dashboard for a signed-in super admin', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Institute overview', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByText('Active batches')).toBeVisible();
  });

  test('shows the mobile navigation on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');

    const menu = page.getByRole('button', { name: 'Open navigation' });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });

  test('creates a course that appears in the course list', async ({ page }) => {
    await page.goto('/admin/courses');
    await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible();

    const suffix = Date.now().toString().slice(-6);
    const code = `E2E-${suffix}`;
    const title = `Automation Testing ${suffix}`;

    await page.getByRole('button', { name: 'New course' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Course code').fill(code);
    await page.getByLabel('Title').fill(title);
    await page.getByRole('textbox', { name: 'Duration *' }).fill('8');
    await page.getByRole('button', { name: 'Create course' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Course created.')).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(title) })).toBeVisible();
    await expect(page.getByText(code)).toBeVisible();
  });

  test('lists students and opens an admission record', async ({ page }) => {
    await page.goto('/admin/students');
    await expect(page.getByRole('heading', { name: 'Students', exact: true })).toBeVisible();

    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/STU-/).first()).toBeVisible();
  });
});
