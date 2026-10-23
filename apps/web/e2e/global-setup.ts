import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';
import { SEEDED_ACCOUNTS } from './helpers';

export const AUTH_DIR = path.join(__dirname, '.auth');

/**
 * Signs the seeded roles in once per run and stores their cookies. Individual tests reuse that
 * state instead of logging in repeatedly, which keeps them fast and keeps the API's sign-in
 * rate limiter out of the way.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000';
  await mkdir(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const [role, account] of Object.entries(SEEDED_ACCOUNTS)) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto('/login');
      await page.getByLabel('Email address').fill(account.email);
      await page.getByLabel('Password').fill(account.password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((url) => url.pathname !== '/login', { timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      await context.storageState({ path: path.join(AUTH_DIR, `${role}.json`) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
