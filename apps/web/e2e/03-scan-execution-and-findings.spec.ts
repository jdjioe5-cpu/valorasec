import { test, expect } from '@playwright/test';
import { setupE2EApiMocks } from './fixtures/mock-api';
import { SEED_PROJECT, SEED_SCAN } from './fixtures/seed-data';

test.describe('Smart Contract Security Scanning Flow', () => {
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

  test('Flow 4: Trigger Contract Security Scan -> Real-time feedback -> Review Findings and Score', async ({
    page,
  }) => {
    // 1. Visit Project Detail Page
    await page.goto(`/projects/${SEED_PROJECT.id}`);
    await expect(page.locator('h1')).toContainText(SEED_PROJECT.name);

    // 2. Click Scan button on contract
    const scanButton = page.locator('button:has-text("Scan")').first();
    await expect(scanButton).toBeVisible();
    await scanButton.click();

    // 3. Scan results card appears
    await expect(page.locator('text=Scan Complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=Score: ${SEED_SCAN.summary.score}/100`)).toBeVisible();

    // 4. Critical severity breakdown item is visible
    await expect(page.locator('text=critical').or(page.locator('text=Critical'))).toBeVisible();
  });
});
