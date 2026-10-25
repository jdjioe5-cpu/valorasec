import type { Page } from '@playwright/test';
import { SEED_USER, SEED_PROJECT, SEED_SCAN, SEED_REPORT } from './seed-data';

export async function setupE2EApiMocks(page: Page) {
  // 1. Auth Profile & Session
  await page.route('**/api/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: SEED_USER }),
    });
  });

  // 2. Login endpoint
  await page.route('**/api/auth/login', async (route) => {
    const postData = route.request().postDataJSON();
    if (postData?.password === 'WrongPassword!') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 401,
          message: 'Invalid credentials. Please verify your email and password.',
          error: 'Unauthorized',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: 'mock-jwt-token-xyz',
          refreshToken: 'mock-refresh-token-xyz',
          expiresIn: 3600,
          user: SEED_USER,
        },
      }),
    });
  });

  // 3. Register endpoint
  await page.route('**/api/auth/register', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: 'mock-jwt-token-registered',
          refreshToken: 'mock-refresh-token-registered',
          expiresIn: 3600,
          user: SEED_USER,
        },
      }),
    });
  });

  // 4. Projects list & detail
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      const newProj = {
        ...SEED_PROJECT,
        id: `proj-${Date.now()}`,
        name: payload?.name || 'New Protocol',
        description: payload?.description || '',
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newProj }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [SEED_PROJECT],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
    });
  });

  await page.route(`**/api/projects/${SEED_PROJECT.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: SEED_PROJECT }),
    });
  });

  // 5. Contracts
  await page.route(`**/api/projects/${SEED_PROJECT.id}/contracts`, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      const newContract = {
        id: `ctr-${Date.now()}`,
        projectId: SEED_PROJECT.id,
        name: payload?.name || 'NewContract',
        address: payload?.address || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        network: 'testnet',
        createdAt: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newContract }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: SEED_PROJECT.contracts }),
    });
  });

  // 6. Scans
  await page.route(
    `**/api/projects/${SEED_PROJECT.id}/contracts/ctr-e2e-001/scan`,
    async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: SEED_SCAN }),
      });
    },
  );

  await page.route(`**/api/scans/${SEED_SCAN.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: SEED_SCAN }),
    });
  });

  // 7. Reports
  await page.route('**/api/reports', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: SEED_REPORT }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [SEED_REPORT],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
    });
  });

  await page.route(`**/api/reports/${SEED_REPORT.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: SEED_REPORT }),
    });
  });
}
