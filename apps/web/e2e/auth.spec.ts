import { expect, test } from '@playwright/test';
import { SEEDED_ACCOUNTS, signIn } from './helpers';

test.describe('authentication and route protection', () => {
  test('sends an anonymous visitor to the sign-in page', async ({ page }) => {
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

  test('signs a super admin in to the operations dashboard', async ({ page }) => {
    await signIn(page, SEEDED_ACCOUNTS.admin, '/admin');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByText('Active students')).toBeVisible();
  });

  test('keeps a signed-in student out of the staff workspace', async ({ page }) => {
    await signIn(page, SEEDED_ACCOUNTS.student, '/student');

    await page.goto('/admin');
    await page.waitForURL((url) => url.pathname === '/student' || url.pathname === '/login');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByText('Institute settings')).toHaveCount(0);
  });

  test('shows the mobile navigation on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, SEEDED_ACCOUNTS.admin, '/admin');

    const menu = page.getByRole('button', { name: 'Open navigation' });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });
});
