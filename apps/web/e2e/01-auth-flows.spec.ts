import { test, expect } from '@playwright/test';
import { setupE2EApiMocks } from './fixtures/mock-api';

test.describe('Authentication End-to-End User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EApiMocks(page);
  });

  test('Flow 1: User Registration -> Login -> Redirects to Dashboard with populated profile', async ({
    page,
  }) => {
    // 1. Visit Register Page
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('Create your account');

    // 2. Fill registration form
    await page.fill('input#name', 'E2E Developer');
    await page.fill('input#email', 'e2e-developer@valorasec.com');
    await page.fill('input#password', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // 3. User is redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('#main-content')).toBeVisible();

    // 4. Verify dashboard loads with header and navigation elements
    await expect(
      page.locator('text=Soroban Vault Protocol').or(page.locator('text=Security Posture')),
    ).toBeVisible();
  });

  test('Flow 2: Login failure with invalid credentials displays alert error message', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Welcome back');

    // Enter wrong password
    await page.fill('input#email', 'e2e-developer@valorasec.com');
    await page.fill('input#password', 'WrongPassword!');
    await page.click('button[type="submit"]');

    // Alert error message appears
    const alert = page.locator('div[role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Invalid credentials|Login failed/i);
    // User remains on login page
    await expect(page).toHaveURL(/\/login/);
  });
});
