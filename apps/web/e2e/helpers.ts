import { expect, type Page } from '@playwright/test';

export const SEEDED_ACCOUNTS = {
  admin: { email: 'admin@institute.test', password: 'Admin#12345' },
  frontDesk: { email: 'frontdesk@institute.test', password: 'Frontdesk#12345' },
  student: { email: 'fatima.noor@student.test', password: 'Student#12345' },
} as const;

export async function signIn(
  page: Page,
  account: { email: string; password: string },
  expectedPath: string,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 30_000 });
  await expect(page.locator('h1').first()).toBeVisible();
}
