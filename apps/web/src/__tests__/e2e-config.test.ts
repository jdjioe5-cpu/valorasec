import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import playwrightConfig from '../../playwright.config';
import { SEED_USER, SEED_PROJECT, SEED_SCAN, SEED_REPORT } from '../../e2e/fixtures/seed-data';

describe('Playwright E2E Suite Configuration (Issue #55)', () => {
  const e2eDir = path.resolve(__dirname, '../../e2e');

  it('exports valid Playwright configuration', () => {
    expect(playwrightConfig.testDir).toBe('./e2e');
    expect(playwrightConfig.use?.screenshot).toBe('only-on-failure');
    expect(playwrightConfig.use?.trace).toBe('on-first-retry');
    expect(playwrightConfig.projects?.length).toBeGreaterThanOrEqual(3);
  });

  it('contains valid test seed data for all entities', () => {
    expect(SEED_USER.email).toBe('e2e-developer@valorasec.com');
    expect(SEED_PROJECT.contracts.length).toBeGreaterThan(0);
    expect(SEED_SCAN.findings.length).toBeGreaterThan(0);
    expect(SEED_REPORT.verifiedOnChain).toBe(true);
  });

  it('contains all 5 core user flow test specification files', () => {
    const requiredSpecs = [
      '01-auth-flows.spec.ts',
      '02-project-and-contracts.spec.ts',
      '03-scan-execution-and-findings.spec.ts',
      '04-report-generation-and-onchain.spec.ts',
      '05-navigation-and-theme.spec.ts',
    ];

    for (const spec of requiredSpecs) {
      const fullPath = path.resolve(e2eDir, spec);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toContain("from '@playwright/test'");
    }
  });
});
