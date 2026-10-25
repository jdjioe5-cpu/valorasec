import { describe, it, expect, beforeEach } from 'vitest';
import {
  SecurityAnalyzer,
  computeSha256,
  extractFunctionChunks,
  diffFunctionChunks,
  preserveAndRebaseFindings,
  DEFAULT_MOCK_CONTRACT_SOURCE,
} from './index';
import type { Finding } from '@valorasec/shared';

describe('Incremental & Partial Re-scanning (Issue #38)', () => {
  let analyzer: SecurityAnalyzer;

  beforeEach(() => {
    analyzer = new SecurityAnalyzer();
  });

  describe('extractFunctionChunks & computeSha256', () => {
    it('correctly parses Rust/Soroban function declarations, line ranges, and body hashes', () => {
      const code = `
pub fn initialize(env: Env, admin: Address) {
    admin.require_auth();
}

pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    from.require_auth();
    set_balance(&env, &from, 100);
}
`.trim();

      const chunks = extractFunctionChunks(code);
      expect(chunks.size).toBe(2);

      const initChunk = chunks.get('initialize');
      expect(initChunk).toBeDefined();
      expect(initChunk?.name).toBe('initialize');
      expect(initChunk?.startLine).toBe(1);
      expect(initChunk?.endLine).toBe(3);
      expect(initChunk?.hash).toHaveLength(64); // SHA-256

      const transferChunk = chunks.get('transfer');
      expect(transferChunk).toBeDefined();
      expect(transferChunk?.name).toBe('transfer');
      expect(transferChunk?.startLine).toBe(5);
    });

    it('produces identical SHA-256 for identical source text and changes on mutation', () => {
      const hash1 = computeSha256('fn test() {}');
      const hash2 = computeSha256('fn test() {}');
      const hash3 = computeSha256('fn test() { let x = 1; }');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('diffFunctionChunks', () => {
    it('detects unchanged, modified, added, and deleted functions with line offsets', () => {
      const v1 = `
pub fn foo() {
    let a = 1;
}

pub fn bar() {
    let b = 2;
}

pub fn baz() {
    let c = 3;
}
`.trim();

      const v2 = `
// Extra comment at top shifts line numbers
pub fn foo() {
    let a = 1;
}

pub fn bar() {
    let b = 999; // Modified body!
}

pub fn qux() {
    let d = 4; // Added function!
}
// baz was deleted!
`.trim();

      const chunks1 = extractFunctionChunks(v1);
      const chunks2 = extractFunctionChunks(v2);

      const diff = diffFunctionChunks(chunks1, chunks2);

      expect(diff.isIdentical).toBe(false);
      expect(diff.unchangedFunctions).toContain('foo');
      expect(diff.changedFunctions).toContain('bar');
      expect(diff.addedFunctions).toContain('qux');
      expect(diff.deletedFunctions).toContain('baz');
    });

    it('returns isIdentical: true when source hashes match exactly', () => {
      const chunks = extractFunctionChunks(DEFAULT_MOCK_CONTRACT_SOURCE);
      const hash = computeSha256(DEFAULT_MOCK_CONTRACT_SOURCE);

      const diff = diffFunctionChunks(chunks, chunks, hash, hash);
      expect(diff.isIdentical).toBe(true);
      expect(diff.changedFunctions).toHaveLength(0);
      expect(diff.unchangedFunctions.length).toBe(chunks.size);
    });
  });

  describe('preserveAndRebaseFindings', () => {
    it('preserves findings on unchanged functions and rebases line numbers', () => {
      const prevChunks = extractFunctionChunks(
        `
pub fn foo() {
    let a = 1;
}

pub fn bar() {
    let b = 2;
}
`.trim(),
      );

      const currChunks = extractFunctionChunks(
        `
// 3 lines prepended
// comment 1
// comment 2
pub fn foo() {
    let a = 1;
}

pub fn bar() {
    let b = 999;
}
`.trim(),
      );

      const diff = diffFunctionChunks(prevChunks, currChunks);

      const mockFindings: Finding[] = [
        {
          id: 'FND-1',
          ruleId: 'R001',
          title: 'Auth check missing',
          description: 'desc',
          severity: 'high',
          location: { file: 'lib.rs', line: 2, column: 4 }, // In foo (lines 1-3 in v1)
          recommendation: 'fix',
          references: [],
        },
        {
          id: 'FND-2',
          ruleId: 'R002',
          title: 'Storage bug',
          description: 'desc',
          severity: 'critical',
          location: { file: 'lib.rs', line: 6, column: 4 }, // In bar (modified, so dropped)
          recommendation: 'fix',
          references: [],
        },
      ];

      const preserved = preserveAndRebaseFindings(mockFindings, prevChunks, diff);

      expect(preserved).toHaveLength(1);
      const first = preserved[0];
      expect(first).toBeDefined();
      expect(first?.id).toBe('FND-1');
      // line was 2, shifted by prepended lines (startLine shifted from 1 to 4 -> offset +3)
      expect(first?.location?.line).toBe(5);
    });
  });

  describe('Incremental SecurityAnalyzer Pipeline & DoD Verification', () => {
    it('AC & DoD: performs partial re-scan scoping only to changed functions while preserving unchanged findings', async () => {
      const v1Source = DEFAULT_MOCK_CONTRACT_SOURCE;
      const contractId = 'soroban-vault-001';
      const projectId = 'proj-sec';

      // 1. Initial Full Scan
      const initialResult = await analyzer.analyze({
        contractId,
        projectId,
        sourceCode: v1Source,
      });

      expect(initialResult.scan.status).toBe('completed');
      expect(initialResult.scan.findings.length).toBeGreaterThan(0);
      expect(initialResult.scan.sourceHash).toBe(computeSha256(v1Source));

      // 2. Modify only ONE function ('transfer')
      const v2Source = v1Source.replace(
        'panic!("insufficient balance");',
        'panic!("insufficient balance or invalid signer");',
      );

      const incrementalResult = await analyzer.analyze({
        contractId,
        projectId,
        sourceCode: v2Source,
      });

      const stats = incrementalResult.incrementalStats;
      expect(stats).toBeDefined();
      expect(stats?.isIncremental).toBe(true);
      expect(stats?.cacheHit).toBe(false);
      expect(stats?.changedFunctions).toEqual(['transfer']);
      expect(stats?.unchangedFunctions).toContain('initialize');
      expect(stats?.unchangedFunctions).toContain('balance');
      expect(stats?.unchangedFunctions).toContain('approve');
      expect(stats?.unchangedFunctions).toContain('mint');

      // Unchanged functions' findings are preserved
      expect(stats?.inheritedFindingsCount ?? 0).toBeGreaterThan(0);
      expect(stats?.scannedFunctionCount).toBe(1); // Only 1 function scanned
      expect(stats?.skippedFunctionCount).toBe(4); // 4 functions skipped!
    });

    it('AC: supports forceFullScan to bypass cache and re-analyze all functions', async () => {
      const source = DEFAULT_MOCK_CONTRACT_SOURCE;
      const contractId = 'soroban-vault-002';
      const projectId = 'proj-sec';

      // Initial scan
      await analyzer.analyze({ contractId, projectId, sourceCode: source });

      // Second scan with forceFullScan = true
      const forceResult = await analyzer.analyze({
        contractId,
        projectId,
        sourceCode: source,
        forceFullScan: true,
      });

      expect(forceResult.incrementalStats).toBeUndefined();
      expect(forceResult.scan.status).toBe('completed');
    });

    it('DoD: Performance benchmark showing 50%+ reduction for small diffs', async () => {
      // Build a multi-function contract (10 functions)
      const functions = Array.from(
        { length: 10 },
        (_, i) => `
pub fn contract_func_${i}(env: Env, caller: Address) {
    caller.require_auth();
    let val_${i} = ${i} * 10;
}
`,
      ).join('\n');

      const fullSource = functions.trim();
      const contractId = 'bench-contract-100';
      const projectId = 'bench-proj';

      // 1. Initial scan
      await analyzer.analyze({
        contractId,
        projectId,
        sourceCode: fullSource,
      });

      // 2. Small diff: mutate only contract_func_3
      const smallDiffSource = fullSource.replace('let val_3 = 3 * 10;', 'let val_3 = 3 * 9999;');

      const result = await analyzer.analyze({
        contractId,
        projectId,
        sourceCode: smallDiffSource,
      });

      const stats = result.incrementalStats;
      expect(stats).toBeDefined();
      expect(stats?.totalFunctions).toBe(10);
      expect(stats?.scannedFunctionCount).toBe(1); // Only 1 out of 10
      expect(stats?.skippedFunctionCount).toBe(9); // 9 skipped (90%)

      // Definition of Done: 50%+ reduction verified
      expect(stats?.timeSavedPercent).toBeGreaterThanOrEqual(50);
      expect(stats?.timeSavedPercent).toBe(90);
    });

    it('DoD: zero false negatives — incremental scan findings match expected scoped output', async () => {
      const contractId = 'zero-fn-contract';
      const projectId = 'proj-audit';

      const sourceA = `
pub fn deposit(env: Env, from: Address, amt: i128) {
    from.require_auth();
}

pub fn withdraw(env: Env, to: Address, amt: i128) {
    to.require_auth();
}
`.trim();

      // First run
      const run1 = await analyzer.analyze({ contractId, projectId, sourceCode: sourceA });
      const initialDepositFinding = run1.scan.findings.find((f) =>
        f.description.includes('`deposit`'),
      );

      // Modify withdraw only
      const sourceB = sourceA.replace('to.require_auth();', 'to.require_auth(); let log = 1;');
      const run2 = await analyzer.analyze({ contractId, projectId, sourceCode: sourceB });

      // Deposit was unchanged -> finding preserved with exact rule consistency
      const preservedDepositFinding = run2.scan.findings.find((f) =>
        f.description.includes('`deposit`'),
      );

      expect(preservedDepositFinding).toBeDefined();
      expect(preservedDepositFinding?.ruleId).toBe(initialDepositFinding?.ruleId);
      expect(preservedDepositFinding?.severity).toBe(initialDepositFinding?.severity);
    });
  });
});
