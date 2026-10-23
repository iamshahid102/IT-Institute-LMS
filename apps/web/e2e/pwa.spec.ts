import { expect, test } from '@playwright/test';

test.describe('progressive web app', () => {
  test('serves a valid web app manifest with installable icons', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as {
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      theme_color: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };

    expect(manifest.name).toContain('IT Institute');
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
    expect(manifest.icons.every((icon) => icon.type === 'image/png')).toBe(true);
  });

  test('serves an uncached service worker that never caches the API', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(200);
    expect(response.headers()['service-worker-allowed']).toBe('/');
    expect(response.headers()['cache-control']).toContain('no-cache');

    const source = await response.text();
    expect(source).toContain("'/offline'");
    expect(source).not.toMatch(/caches\.put\([^)]*\/api\//);
  });

  test('registers the service worker in the browser', async ({ page }) => {
    await page.goto('/login');

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            return registration?.active?.scriptURL ?? registration?.installing?.scriptURL ?? null;
          }),
        { timeout: 20_000 },
      )
      .toContain('/sw.js');
  });

  test('shows the offline fallback page', async ({ page }) => {
    await page.goto('/offline');

    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByText(/offline/i).first()).toBeVisible();
  });
});
