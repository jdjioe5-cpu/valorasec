import { test, expect } from '@playwright/test';
import { setupE2EApiMocks } from './fixtures/mock-api';

test.describe('Navigation and Layout Usability Flow', () => {
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

  test('Flow 6: Core Navigation Links and Responsive Layout', async ({ page }) => {
    // 1. Visit Dashboard
    await page.goto('/dashboard');

    // 2. Click Projects link in header navigation
    const projectsLink = page.locator('nav a[href="/projects"]');
    await expect(projectsLink).toBeVisible();
    await projectsLink.click();
    await expect(page).toHaveURL(/\/projects/);

    // 3. Click Reports link in header navigation
    const reportsLink = page.locator('nav a[href="/reports"]');
    await expect(reportsLink).toBeVisible();
    await reportsLink.click();
    await expect(page).toHaveURL(/\/reports/);

    // 4. Verify main content area and accessibility landmarks exist
    await expect(page.locator('#main-content')).toBeVisible();
  });
});
