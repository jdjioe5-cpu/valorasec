import { describe, it, expect } from 'vitest';
import type { Finding } from '@valorasec/shared';
import {
  computeWeightedScore,
  calculateDensityFactor,
  getExploitabilityMultiplier,
  determineGrade,
} from './scoring';

describe('Severity Scoring Algorithm', () => {
  describe('calculateDensityFactor', () => {
    it('returns 1.0 when there are no findings', () => {
      expect(calculateDensityFactor(0, 500)).toBe(1.0);
    });

    it('returns 1.0 when finding density is low (<= 1 finding per 100 lines)', () => {
      // 2 findings in 300 lines = density 0.67 <= 1.0
      expect(calculateDensityFactor(2, 300)).toBe(1.0);
    });

    it('applies density penalty when findings are concentrated (> 1 per 100 lines)', () => {
      // 5 findings in 100 lines = density 5.0 -> 1.0 + (5 - 1)*0.1 = 1.4
      expect(calculateDensityFactor(5, 100)).toBe(1.4);
    });

    it('caps maximum density multiplier at 1.5', () => {
      // 30 findings in 100 lines
      expect(calculateDensityFactor(30, 100)).toBe(1.5);
    });
  });

  describe('getExploitabilityMultiplier', () => {
    it('gives 1.25x for authorization-related vulnerabilities', () => {
      expect(getExploitabilityMultiplier('R001')).toBe(1.25);
      expect(getExploitabilityMultiplier('missing-auth-check')).toBe(1.25);
    });

    it('gives 1.15x for storage and value drain vulnerabilities', () => {
      expect(getExploitabilityMultiplier('unsafe-storage-access')).toBe(1.15);
      expect(getExploitabilityMultiplier('token-drain')).toBe(1.15);
    });

    it('gives 1.0x for standard code quality rules', () => {
      expect(getExploitabilityMultiplier('R999_style')).toBe(1.0);
    });
  });

  describe('determineGrade', () => {
    it('maps scores to correct letter grades', () => {
      expect(determineGrade(95)).toBe('A');
      expect(determineGrade(85)).toBe('B');
      expect(determineGrade(70)).toBe('C');
      expect(determineGrade(50)).toBe('D');
      expect(determineGrade(25)).toBe('F');
    });
  });

  describe('computeWeightedScore', () => {
    it('returns perfect 100 and grade A when findings array is empty', () => {
      const { score, breakdown } = computeWeightedScore([], 350);
      expect(score).toBe(100);
      expect(breakdown.finalScore).toBe(100);
      expect(breakdown.grade).toBe('A');
      expect(breakdown.rawDeduction).toBe(0);
      expect(breakdown.densityFactor).toBe(1.0);
      expect(breakdown.rationale[0]).toContain('No security vulnerabilities found');
    });

    it('clamps minimum score to 0 on catastrophic critical issues', () => {
      const criticalFindings: Finding[] = Array.from({ length: 6 }, (_, i) => ({
        id: `f-${i}`,
        ruleId: 'R001', // auth -> 1.25 multiplier
        title: 'Missing Auth',
        description: 'Critical unauthorized access',
        severity: 'critical', // base 25
        recommendation: 'Fix auth',
      }));

      const { score, breakdown } = computeWeightedScore(criticalFindings, 80);
      expect(score).toBe(0);
      expect(breakdown.finalScore).toBe(0);
      expect(breakdown.grade).toBe('F');
      expect(breakdown.rawDeduction).toBeGreaterThanOrEqual(150);
    });

    it('produces reproducible and deterministic scores on identical inputs', () => {
      const findings: Finding[] = [
        {
          id: 'f-1',
          ruleId: 'R001',
          title: 'Auth issue',
          description: 'Auth issue',
          severity: 'critical',
          recommendation: 'Fix',
        },
        {
          id: 'f-2',
          ruleId: 'R002',
          title: 'Storage issue',
          description: 'Storage issue',
          severity: 'medium',
          recommendation: 'Fix',
        },
      ];

      const res1 = computeWeightedScore(findings, 200);
      const res2 = computeWeightedScore(findings, 200);

      expect(res1.score).toBe(res2.score);
      expect(res1.breakdown.rawDeduction).toBe(res2.breakdown.rawDeduction);
      expect(res1.breakdown.densityFactor).toBe(res2.breakdown.densityFactor);
      expect(res1.breakdown.grade).toBe(res2.breakdown.grade);
    });

    it('generates structured rationale and deductions breakdown', () => {
      const findings: Finding[] = [
        {
          id: 'f-1',
          ruleId: 'R001',
          title: 'Auth Bypass',
          description: 'desc',
          severity: 'high',
          recommendation: 'Fix',
        },
        {
          id: 'f-2',
          ruleId: 'R003',
          title: 'Unchecked Input',
          description: 'desc',
          severity: 'low',
          recommendation: 'Fix',
        },
      ];

      const { breakdown } = computeWeightedScore(findings, 150);
      expect(breakdown.deductionsBySeverity.high).toBeGreaterThan(0);
      expect(breakdown.deductionsBySeverity.low).toBeGreaterThan(0);
      expect(breakdown.rationale.length).toBeGreaterThan(0);
    });
  });
});
