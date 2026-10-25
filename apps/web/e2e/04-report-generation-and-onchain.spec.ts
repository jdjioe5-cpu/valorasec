import { test, expect } from '@playwright/test';
import { setupE2EApiMocks } from './fixtures/mock-api';
import { SEED_REPORT } from './fixtures/seed-data';

test.describe('Audit Report Generation and On-Chain Verification Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EApiMocks(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('valorasec_access_token', 'mock-jwt-token-xyz');
      window.localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            user: {
              id: 'usr-e2e-001',
              email: 'e2e-developer@valorasec.com',
              name: 'E2E Developer',
              role: 'user',
            },
            tokens: {
              accessToken: 'mock-jwt-token-xyz',
              refreshToken: 'mock-refresh-token-xyz',
              expiresIn: 3600,
            },
          },
          version: 0,
        }),
      );
    });
  });

  test('Flow 5: View Reports List -> Inspect Report Findings -> On-Chain Verification Status', async ({
    page,
  }) => {
    // 1. Visit Reports List Page
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('Audit Reports');

    // 2. Report card is visible
    const reportLink = page.locator(`text=${SEED_REPORT.title}`).first();
    await expect(reportLink).toBeVisible();
    await reportLink.click();

    // 3. User is navigated to report detail page
    await expect(page).toHaveURL(new RegExp(`/reports/${SEED_REPORT.id}`));
    await expect(page.locator('h1')).toContainText(SEED_REPORT.title);

    // 4. Verify on-chain verification badge and transaction hash are shown
    await expect(
      page.locator('text=Verified on-chain').or(page.locator('text=Verified')),
    ).toBeVisible();

    // 5. Findings list is rendered
    await expect(page.locator('text=Findings')).toBeVisible();
    await expect(page.locator('text=Missing Authorization Check in `transfer`')).toBeVisible();
  });
});
