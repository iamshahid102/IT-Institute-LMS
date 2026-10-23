import { expect, test } from '@playwright/test';
import { SEEDED_ACCOUNTS, signIn } from './helpers';

test.describe('student portal', () => {
  test('shows the student dashboard with their own academic snapshot', async ({ page }) => {
    await signIn(page, SEEDED_ACCOUNTS.student, '/student');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(/Fatima Noor/i).first()).toBeVisible();
  });

  test('shows attendance history and a percentage that comes from the API', async ({ page }) => {
    await signIn(page, SEEDED_ACCOUNTS.student, '/student');

    await page.getByRole('link', { name: 'Attendance' }).click();
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
    await expect(page.getByText(/Attendance by course/)).toBeVisible();
    await expect(page.getByText(/Attendance history/)).toBeVisible();
    await expect(page.getByText(/%/).first()).toBeVisible();
  });

  test('shows the fee overview, ledger and receipts', async ({ page }) => {
    await signIn(page, SEEDED_ACCOUNTS.student, '/student');

    await page.getByRole('link', { name: 'Fee overview' }).click();
    await expect(page.getByRole('heading', { name: 'Fees' })).toBeVisible();
    await expect(page.getByText(/PKR/).first()).toBeVisible();

    await page.getByRole('link', { name: 'Ledger' }).click();
    await expect(page.getByRole('heading', { name: 'Fee ledger' })).toBeVisible();

    await page.getByRole('link', { name: 'Receipts' }).click();
    await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();
  });

  test('offers only contact details as editable profile fields', async ({ page }) => {
    await signIn(page, SEEDED_ACCOUNTS.student, '/student');

    await page.goto('/student/profile');
    await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
    await expect(page.getByLabel('Phone')).toHaveValue(/\+92/);
    await expect(page.getByRole('textbox')).toHaveCount(2);
  });
});
