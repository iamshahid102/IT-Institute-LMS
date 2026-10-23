import { expect, test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/student.json' });

test.describe('student portal', () => {
  test('shows the student dashboard with their own academic snapshot', async ({ page }) => {
    await page.goto('/student');

    await expect(page.getByRole('heading', { name: /Welcome back, Fatima/ })).toBeVisible();
    await expect(page.getByText(/Student STU-/)).toBeVisible();
  });

  test('shows attendance history and a percentage that comes from the API', async ({ page }) => {
    await page.goto('/student/attendance');

    await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
    await expect(page.getByText(/Attendance by course/)).toBeVisible();
    await expect(page.getByText(/Attendance history/)).toBeVisible();
    await expect(page.getByText(/%/).first()).toBeVisible();
  });

  test('shows the fee overview, ledger and receipts', async ({ page }) => {
    await page.goto('/student/fees');
    await expect(page.getByRole('heading', { name: 'Fees', exact: true })).toBeVisible();
    await expect(page.getByText(/PKR/).first()).toBeVisible();

    await page.getByRole('link', { name: 'Ledger', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Fee ledger', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Receipts', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Receipts', exact: true })).toBeVisible();
  });

  test('offers only contact details as editable profile fields', async ({ page }) => {
    await page.goto('/student/profile');

    await expect(page.getByRole('heading', { name: 'My profile', exact: true })).toBeVisible();
    const phone = page.locator('input[autocomplete="tel"]');
    await expect(phone).toHaveValue(/\+92/);
    await expect(page.getByRole('textbox')).toHaveCount(2);
  });

  test('cannot reach the staff workspace', async ({ page }) => {
    await page.goto('/admin');

    await page.waitForURL((url) => url.pathname === '/student' || url.pathname === '/login');
    await expect(page.getByText('Institute settings')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });
});
