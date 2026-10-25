import { test, expect } from '@playwright/test';
import { setupE2EApiMocks } from './fixtures/mock-api';
import { SEED_PROJECT } from './fixtures/seed-data';

test.describe('Project and Smart Contract Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EApiMocks(page);
    // Pre-populate mock session token in localStorage
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

  test('Flow 3: View Projects List -> Navigate to Project Details -> Inspect Contracts', async ({
    page,
  }) => {
    // 1. Visit Projects Page
    await page.goto('/projects');
    await expect(page.locator('h1')).toContainText('Projects');

    // 2. Locate seed project card
    const projectCard = page.locator(`text=${SEED_PROJECT.name}`);
    await expect(projectCard).toBeVisible();

    // 3. Click to open Project Detail
    await page.click(`text=${SEED_PROJECT.name}`);
    await expect(page).toHaveURL(new RegExp(`/projects/${SEED_PROJECT.id}`));

    // 4. Verify project name, description and contracts are displayed
    await expect(page.locator('h1')).toContainText(SEED_PROJECT.name);
    await expect(page.locator('text=VaultToken')).toBeVisible();
    await expect(page.locator('text=CDLZFC3S')).toBeVisible();
  });
});
