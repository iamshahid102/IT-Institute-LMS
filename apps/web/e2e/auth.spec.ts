import { expect, test } from '@playwright/test';

test.describe('anonymous access control', () => {
  test('sends a visitor without a session to the sign-in page', async ({ page }) => {
    await page.goto('/admin/students');

    await page.waitForURL((url) => url.pathname === '/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('rejects invalid credentials without revealing whether the account exists', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill('admin@institute.test');
    await page.getByLabel('Password').fill('DefinitelyWrong#1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
