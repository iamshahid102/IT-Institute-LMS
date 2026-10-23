import { expect, test } from '@playwright/test';

// Deterministic codes created by prisma/seed.ts for the development database.
const ISSUED_CODE = 'w5IS-p_P8AV2n9b0DPDFYm3K';
const REVOKED_CODE = 'YUVHSsWX8Js7fY471oEM0oth';
const UNKNOWN_CODE = 'this-code-does-not-exist-000000';

test.describe('public certificate verification', () => {
  test('confirms an issued certificate without requiring a sign-in', async ({ page }) => {
    await page.goto(`/verify-certificate/${ISSUED_CODE}`);

    await expect(page.getByText('Valid · Issued')).toBeVisible();
    await expect(page.getByText('CERT-2026-000002')).toBeVisible();
    await expect(page.getByText(/currently valid/)).toBeVisible();
    await expect(page.getByText('Certificate number')).toBeVisible();
  });

  test('clearly marks a revoked certificate as not valid', async ({ page }) => {
    await page.goto(`/verify-certificate/${REVOKED_CODE}`);

    await expect(page.getByText('Revoked · Not valid')).toBeVisible();
    await expect(page.getByText(/has been revoked by the institute/)).toBeVisible();
  });

  test('reports an unknown verification code', async ({ page }) => {
    await page.goto(`/verify-certificate/${UNKNOWN_CODE}`);

    await expect(page.getByText('Certificate not found')).toBeVisible();
  });

  test('exposes the verification code form and navigates to a result', async ({ page }) => {
    await page.goto('/verify-certificate');

    await expect(page.getByRole('heading', { name: 'Verify an institute certificate' })).toBeVisible();
    await page.getByLabel('Verification code').fill(ISSUED_CODE);
    await page.getByRole('button', { name: 'Check certificate' }).click();

    await expect(page.getByText('Valid · Issued')).toBeVisible();
  });
});
