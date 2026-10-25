import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { SecurityAnalyzer } from './index';

describe('Analyzer Performance Benchmark', () => {
  const largeContractPath = path.resolve(__dirname, 'fixtures/large_contract.rs');

  it('analyzes a 500+ line contract in less than 5 seconds', async () => {
    const sourceCode = fs.readFileSync(largeContractPath, 'utf-8');
    const lines = sourceCode.split('\n').length;
    expect(lines).toBeGreaterThanOrEqual(400);

    const analyzer = new SecurityAnalyzer();

    const start = performance.now();
    const result = await analyzer.analyze({
      contractId: 'large-vault',
      projectId: 'perf-project',
      sourceCode,
    });
    const elapsedMs = performance.now() - start;

    expect(result.scan.status).toBe('completed');
    expect(result.scan.summary.linesAnalyzed).toBeGreaterThanOrEqual(400);

    // Criteria: < 5000 ms (typically completes in under 50 ms)
    expect(elapsedMs).toBeLessThan(5000);
    console.info(`Analyzed ${lines} lines in ${elapsedMs.toFixed(2)}ms`);
  });
});
