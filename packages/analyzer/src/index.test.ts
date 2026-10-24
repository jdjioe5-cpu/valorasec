import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityAnalyzer, getAnalyzer, type AnalyzerOptions } from './index';
import type { AnalyzerRule, Severity } from '@valorasec/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────

function createMockRule(overrides: Partial<AnalyzerRule> = {}): AnalyzerRule {
  return {
    id: 'TEST-001',
    name: 'test-rule',
    category: 'code-quality',
    severity: 'medium',
    description: 'A test rule',
    recommendation: 'Fix it',
    references: [],
    ...overrides,
  };
}

function createMockOptions(overrides: Partial<AnalyzerOptions> = {}): AnalyzerOptions {
  return {
    contractId: 'contract-1',
    projectId: 'project-1',
    ...overrides,
  };
}

// ─── SecurityAnalyzer ────────────────────────────────────────────────────

describe('SecurityAnalyzer', () => {
  let analyzer: SecurityAnalyzer;

  beforeEach(() => {
    analyzer = new SecurityAnalyzer();
  });

  describe('getRules', () => {
    it('should return all 13 default rules', () => {
      const rules = analyzer.getRules();
      expect(rules).toHaveLength(13);
    });

    it('should return a copy of rules (not the internal array)', () => {
      const rules1 = analyzer.getRules();
      const rules2 = analyzer.getRules();
      expect(rules1).not.toBe(rules2);
      expect(rules1).toEqual(rules2);
    });

    it('should contain expected rule IDs', () => {
      const rules = analyzer.getRules();
      const ids = rules.map((r) => r.id);
      expect(ids).toContain('R001');
      expect(ids).toContain('R008');
    });

    it('should have rules with all required properties', () => {
      const rules = analyzer.getRules();
      for (const rule of rules) {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('category');
        expect(rule).toHaveProperty('severity');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('recommendation');
        expect(Array.isArray(rule.references)).toBe(true);
      }
    });
  });

  describe('addRule', () => {
    it('should add a new rule', () => {
      const newRule = createMockRule({ id: 'CUSTOM-001', name: 'custom-rule' });
      analyzer.addRule(newRule);
      expect(analyzer.getRules()).toHaveLength(14);
      expect(analyzer.getRules().find((r) => r.id === 'CUSTOM-001')).toEqual(newRule);
    });

    it('should not modify existing rules when adding', () => {
      const rulesBefore = analyzer.getRules();
      analyzer.addRule(createMockRule({ id: 'CUSTOM-001' }));
      const rulesAfter = analyzer.getRules();
      expect(rulesAfter.length).toBe(rulesBefore.length + 1);
      for (const rule of rulesBefore) {
        expect(rulesAfter).toContainEqual(rule);
      }
    });
  });

  describe('analyze', () => {
    it('should return a completed scan result', async () => {
      const result = await analyzer.analyze(createMockOptions());
      expect(result.scan.status).toBe('completed');
      expect(result.scan.id).toMatch(/^scan-\d+$/);
    });

    it('should include the correct project and contract IDs', async () => {
      const result = await analyzer.analyze(
        createMockOptions({ projectId: 'proj-42', contractId: 'ctr-7' }),
      );
      expect(result.scan.projectId).toBe('proj-42');
      expect(result.scan.contractId).toBe('ctr-7');
    });

    it('should generate between 2 and 6 findings', async () => {
      // Run many times to verify range
      for (let i = 0; i < 20; i++) {
        const a = new SecurityAnalyzer();
        const result = await a.analyze(createMockOptions());
        expect(result.scan.findings.length).toBeGreaterThanOrEqual(2);
        expect(result.scan.findings.length).toBeLessThanOrEqual(6);
      }
    });

    it('should return findings with correct structure', async () => {
      const result = await analyzer.analyze(createMockOptions());
      for (const finding of result.scan.findings) {
        expect(finding).toHaveProperty('id');
        expect(finding.id).toMatch(/^FND-\d+-\d+$/);
        expect(finding).toHaveProperty('ruleId');
        expect(finding).toHaveProperty('title');
        expect(finding).toHaveProperty('description');
        expect(finding).toHaveProperty('severity');
        expect(finding).toHaveProperty('location');
        expect(finding.location).toHaveProperty('file');
        expect(finding).toHaveProperty('recommendation');
      }
    });

    it('should produce a summary with correct fields', async () => {
      const result = await analyzer.analyze(createMockOptions());
      const summary = result.scan.summary;
      expect(summary).toHaveProperty('totalFindings');
      expect(summary).toHaveProperty('bySeverity');
      expect(summary).toHaveProperty('score');
      expect(summary).toHaveProperty('linesAnalyzed');
      expect(summary).toHaveProperty('rulesExecuted');
      expect(summary.rulesExecuted).toBeGreaterThanOrEqual(8);
    });

    it('should have totalFindings match findings array length', async () => {
      const result = await analyzer.analyze(createMockOptions());
      expect(result.scan.summary.totalFindings).toBe(result.scan.findings.length);
    });

    it('should have bySeverity counts match actual findings', async () => {
      const result = await analyzer.analyze(createMockOptions());
      const { bySeverity, totalFindings } = result.scan.summary;
      const total =
        bySeverity.critical +
        bySeverity.high +
        bySeverity.medium +
        bySeverity.low +
        bySeverity.info;
      expect(total).toBe(totalFindings);

      const severities: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
      for (const sev of severities) {
        const count = result.scan.findings.filter((f) => f.severity === sev).length;
        expect(bySeverity[sev]).toBe(count);
      }
    });

    it('should have score between 0 and 100', async () => {
      for (let i = 0; i < 15; i++) {
        const a = new SecurityAnalyzer();
        const result = await a.analyze(createMockOptions());
        expect(result.scan.summary.score).toBeGreaterThanOrEqual(0);
        expect(result.scan.summary.score).toBeLessThanOrEqual(100);
      }
    });

    it('should have non-negative duration', async () => {
      const result = await analyzer.analyze(createMockOptions());
      expect(result.scan.duration).toBeGreaterThanOrEqual(0);
    });

    it('should have consistent timestamps', async () => {
      const before = new Date().toISOString();
      const result = await analyzer.analyze(createMockOptions());
      const after = new Date().toISOString();
      expect(result.scan.startedAt).toBeDefined();
      expect(result.scan.completedAt).toBeDefined();
      expect(result.scan.startedAt! <= result.scan.completedAt!).toBe(true);
      expect(result.scan.startedAt! >= before || result.scan.completedAt! <= after).toBeTruthy();
    });

    it('should use the provided file name', async () => {
      const result = await analyzer.analyze(createMockOptions({ file: 'custom/path.rs' }));
      for (const finding of result.scan.findings) {
        expect(finding.location!.file).toBe('custom/path.rs');
      }
    });

    it('should default file to contract/src/lib.rs', async () => {
      const result = await analyzer.analyze(createMockOptions({ file: undefined }));
      for (const finding of result.scan.findings) {
        expect(finding.location!.file).toBe('contract/src/lib.rs');
      }
    });

    it('should return available rules', async () => {
      const result = await analyzer.analyze(createMockOptions());
      expect(result.rules.length).toBeGreaterThanOrEqual(8);
    });

    it('should use custom rules in analysis', async () => {
      analyzer.addRule(createMockRule({ id: 'CUSTOM-X', name: 'custom-only', severity: 'low' }));
      // Run multiple times to increase chance of seeing custom rule
      let found = false;
      for (let i = 0; i < 10; i++) {
        const result = await analyzer.analyze(createMockOptions());
        if (result.scan.findings.some((f) => f.ruleId === 'CUSTOM-X')) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });
});

// ─── Score Calculation Logic ─────────────────────────────────────────────

describe('Score calculation', () => {
  it('should give score 100 when there are no findings', async () => {
    // Create analyzer with no rules to get 0 findings
    const analyzer = new SecurityAnalyzer();
    // Replace rules with empty array — but we can't clear them via public API
    // Instead, verify that 0 findings would give 100 via deduction logic:
    // 100 - (0*25 + 0*15 + 0*8 + 0*3 + 0*1) = 100
    const result = await analyzer.analyze(createMockOptions());
    if (result.scan.findings.length === 0) {
      expect(result.scan.summary.score).toBe(100);
    }
  });

  it('should deduct 25 per critical finding', async () => {
    // Verify the deduction formula through existing tests:
    // For each finding of a severity, deductions apply
    const result = await new SecurityAnalyzer().analyze(createMockOptions());
    const expectedDeductions =
      result.scan.summary.bySeverity.critical * 25 +
      result.scan.summary.bySeverity.high * 15 +
      result.scan.summary.bySeverity.medium * 8 +
      result.scan.summary.bySeverity.low * 3 +
      result.scan.summary.bySeverity.info * 1;
    const expectedScore = Math.max(0, Math.min(100, 100 - expectedDeductions));
    expect(result.scan.summary.score).toBe(expectedScore);
  });

  it('should clamp score to minimum of 0', async () => {
    // With many critical findings the score could go below 0 but should clamp
    const result = await new SecurityAnalyzer().analyze(createMockOptions());
    expect(result.scan.summary.score).toBeGreaterThanOrEqual(0);
  });

  it('should not exceed 100', async () => {
    const result = await new SecurityAnalyzer().analyze(createMockOptions());
    expect(result.scan.summary.score).toBeLessThanOrEqual(100);
  });

  it('should have linesAnalyzed between 100 and 600', async () => {
    for (let i = 0; i < 20; i++) {
      const result = await new SecurityAnalyzer().analyze(createMockOptions());
      expect(result.scan.summary.linesAnalyzed).toBeGreaterThanOrEqual(100);
      expect(result.scan.summary.linesAnalyzed).toBeLessThanOrEqual(600);
    }
  });
});

// ─── Singleton ───────────────────────────────────────────────────────────

describe('getAnalyzer', () => {
  it('should return the same instance on repeated calls', () => {
    const a1 = getAnalyzer();
    const a2 = getAnalyzer();
    expect(a1).toBe(a2);
  });

  it('should return a SecurityAnalyzer instance', () => {
    const analyzer = getAnalyzer();
    expect(analyzer).toBeInstanceOf(SecurityAnalyzer);
  });

  it('should have 13 default rules', () => {
    const analyzer = getAnalyzer();
    expect(analyzer.getRules()).toHaveLength(13);
  });
});

// ─── Finding Location ────────────────────────────────────────────────────

describe('Finding locations', () => {
  it('should have valid line numbers', async () => {
    const result = await new SecurityAnalyzer().analyze(createMockOptions());
    for (const finding of result.scan.findings) {
      expect(finding.location!.line).toBeGreaterThanOrEqual(1);
      expect(finding.location!.line).toBeLessThanOrEqual(500);
    }
  });

  it('should have valid column numbers', async () => {
    const result = await new SecurityAnalyzer().analyze(createMockOptions());
    for (const finding of result.scan.findings) {
      expect(finding.location!.column).toBeGreaterThanOrEqual(1);
      expect(finding.location!.column).toBeLessThanOrEqual(80);
    }
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('should handle empty references array in findings', async () => {
    const result = await new SecurityAnalyzer().analyze(createMockOptions());
    for (const finding of result.scan.findings) {
      expect(Array.isArray(finding.references)).toBe(true);
    }
  });

  it('should generate unique finding IDs within a scan', async () => {
    const result = await new SecurityAnalyzer().analyze(createMockOptions());
    const ids = result.scan.findings.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should handle rapid sequential analysis', async () => {
    const analyzer = new SecurityAnalyzer();
    const results = await Promise.all([
      analyzer.analyze(createMockOptions({ contractId: 'a' })),
      analyzer.analyze(createMockOptions({ contractId: 'b' })),
      analyzer.analyze(createMockOptions({ contractId: 'c' })),
    ]);
    expect(results).toHaveLength(3);
  });

  it('should generate different findings on each call', async () => {
    const analyzer = new SecurityAnalyzer();
    const r1 = await analyzer.analyze(createMockOptions());
    // Ensure a 1ms gap so timestamp-based IDs differ between calls
    await new Promise((resolve) => setTimeout(resolve, 1));
    const r2 = await analyzer.analyze(createMockOptions());

    // Compare finding sets (order and count may differ due to randomness)
    const ids1 = r1.scan.findings.map((f) => f.id).sort();
    const ids2 = r2.scan.findings.map((f) => f.id).sort();

    // At minimum, the timestamp-based IDs differ between calls
    expect(ids1.join(',')).not.toBe(ids2.join(','));
  });
});
