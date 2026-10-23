import { defineConfig } from '@playwright/test';

const WEB_URL = 'http://localhost:3000';
const API_URL = 'http://127.0.0.1:4000';

/**
 * Browser end-to-end suite. Runs against the production builds of both apps and the seeded
 * development database (`lms_dev`), so start PostgreSQL with `npm run db:start` first.
 * Uses the locally installed Chrome so no Playwright browser download is required.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: '../../test-results',
  use: {
    baseURL: WEB_URL,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'desktop-chrome', use: { viewport: { width: 1366, height: 900 } } }],
  webServer: [
    {
      command: 'npm run start -w @lms/api',
      cwd: '../..',
      url: `${API_URL}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run start -w @lms/web',
      cwd: '../..',
      url: `${WEB_URL}/login`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
