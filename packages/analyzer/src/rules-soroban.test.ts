import { describe, it, expect } from 'vitest';
import { SecurityAnalyzer, SOROBAN_SPECIFIC_RULES, SOROBAN_RULE_FIXTURES } from './index';

describe('Soroban-Specific Vulnerability Rules (Issue #40)', () => {
  it('should define all 5 required Soroban rules (R009 to R013)', () => {
    expect(SOROBAN_SPECIFIC_RULES).toHaveLength(5);
    const ruleIds = SOROBAN_SPECIFIC_RULES.map((r) => r.id);
    expect(ruleIds).toEqual(['R009', 'R010', 'R011', 'R012', 'R013']);
  });

  describe('Rule Taxonomy & Standards Mapping', () => {
    it('R009 should link to CWE-841 and SWC-107 (Reentrancy)', () => {
      const r009 = SOROBAN_SPECIFIC_RULES.find((r) => r.id === 'R009')!;
      expect(r009.name).toBe('cross-contract-reentrancy');
      expect(r009.severity).toBe('critical');
      expect(r009.references.some((ref) => ref.includes('SWC-107'))).toBe(true);
      expect(r009.references.some((ref) => ref.includes('841'))).toBe(true);
    });

    it('R010 should link to SWC-124 and CWE-1258 (Storage Collision)', () => {
      const r010 = SOROBAN_SPECIFIC_RULES.find((r) => r.id === 'R010')!;
      expect(r010.name).toBe('storage-collision-overlapping-keys');
      expect(r010.severity).toBe('high');
      expect(r010.references.some((ref) => ref.includes('SWC-124'))).toBe(true);
      expect(r010.references.some((ref) => ref.includes('1258'))).toBe(true);
    });

    it('R011 should link to SWC-128 and CWE-400 (Unbounded Host Iteration)', () => {
      const r011 = SOROBAN_SPECIFIC_RULES.find((r) => r.id === 'R011')!;
      expect(r011.name).toBe('unbounded-host-iteration');
      expect(r011.severity).toBe('high');
      expect(r011.references.some((ref) => ref.includes('SWC-128'))).toBe(true);
      expect(r011.references.some((ref) => ref.includes('400'))).toBe(true);
    });

    it('R012 should link to SEP-41 specification and CWE-573', () => {
      const r012 = SOROBAN_SPECIFIC_RULES.find((r) => r.id === 'R012')!;
      expect(r012.name).toBe('sep41-token-interface-compliance');
      expect(r012.severity).toBe('high');
      expect(r012.references.some((ref) => ref.includes('sep-0041'))).toBe(true);
      expect(r012.references.some((ref) => ref.includes('573'))).toBe(true);
    });

    it('R013 should link to SWC-101 and CWE-190 (Integer Overflow Protection)', () => {
      const r013 = SOROBAN_SPECIFIC_RULES.find((r) => r.id === 'R013')!;
      expect(r013.name).toBe('missing-overflow-protection');
      expect(r013.severity).toBe('high');
      expect(r013.references.some((ref) => ref.includes('SWC-101'))).toBe(true);
      expect(r013.references.some((ref) => ref.includes('190'))).toBe(true);
    });
  });

  describe('Test Fixtures Completeness (Definition of Done: >=3 fixtures per rule)', () => {
    const requiredRules = ['R009', 'R010', 'R011', 'R012', 'R013'];

    for (const ruleId of requiredRules) {
      it(`rule ${ruleId} must provide vulnerable, safe, and edge-case code fixtures`, () => {
        const fixture = SOROBAN_RULE_FIXTURES[ruleId]!;
        expect(fixture).toBeDefined();
        expect(fixture.ruleId).toBe(ruleId);

        // 1. Vulnerable fixture
        expect(fixture.vulnerable.title).toBeTruthy();
        expect(fixture.vulnerable.description).toBeTruthy();
        expect(fixture.vulnerable.code.length).toBeGreaterThan(20);

        // 2. Safe fixture
        expect(fixture.safe.title).toBeTruthy();
        expect(fixture.safe.description).toBeTruthy();
        expect(fixture.safe.code.length).toBeGreaterThan(20);

        // 3. Edge-case fixture
        expect(fixture.edgeCase.title).toBeTruthy();
        expect(fixture.edgeCase.description).toBeTruthy();
        expect(fixture.edgeCase.code.length).toBeGreaterThan(20);
      });
    }
  });

  describe('Analyzer Integration', () => {
    it('SecurityAnalyzer includes all 13 rules in total (8 core + 5 Soroban)', () => {
      const analyzer = new SecurityAnalyzer();
      const rules = analyzer.getRules();
      expect(rules).toHaveLength(13);

      for (const expectedId of ['R009', 'R010', 'R011', 'R012', 'R013']) {
        expect(rules.some((r) => r.id === expectedId)).toBe(true);
      }
    });

    it('analyze scan result executes all 13 rules', async () => {
      const analyzer = new SecurityAnalyzer();
      const result = await analyzer.analyze({
        contractId: 'contract-soroban-1',
        projectId: 'project-stellar-1',
      });

      expect(result.scan.summary.rulesExecuted).toBe(13);
      expect(result.rules).toHaveLength(13);
    });
  });
});
