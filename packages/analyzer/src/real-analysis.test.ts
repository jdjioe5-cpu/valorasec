import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityAnalyzer } from './index';
import type { Finding } from '@valorasec/shared';

describe('Real Rust Source Code Analysis (Issue #36)', () => {
  let analyzer: SecurityAnalyzer;
  const vulnerableContractPath = path.resolve(__dirname, 'fixtures/vulnerable_contract.rs');
  const secureContractPath = path.resolve(__dirname, 'fixtures/secure_contract.rs');

  beforeEach(() => {
    analyzer = new SecurityAnalyzer();
  });

  it('should detect vulnerabilities in vulnerable_contract fixture', async () => {
    const sourceCode = fs.readFileSync(vulnerableContractPath, 'utf-8');
    const result = await analyzer.analyze({
      contractId: 'vulnerable-contract',
      projectId: 'project-1',
      file: vulnerableContractPath,
      sourceCode,
    });

    const findings = result.scan.findings;
    expect(findings.length).toBeGreaterThan(0);

    // Rule R001: Missing authorization check on initialize and transfer
    const r001Findings = findings.filter((f) => f.ruleId === 'R001');
    expect(r001Findings.length).toBeGreaterThanOrEqual(1);
    expect(r001Findings.some((f) => f.title.includes('transfer'))).toBe(true);

    // Rule R003: Input validation missing on amount in transfer
    const r003Findings = findings.filter((f) => f.ruleId === 'R003');
    expect(r003Findings.length).toBeGreaterThanOrEqual(1);

    // Rule R005: Unhandled panic on unwrap / expect
    const r005Findings = findings.filter((f) => f.ruleId === 'R005');
    expect(r005Findings.length).toBeGreaterThanOrEqual(2);
    expect(r005Findings.some((f) => f.description.includes('unwrap'))).toBe(true);
    expect(r005Findings.some((f) => f.description.includes('expect'))).toBe(true);

    // Verify findings carry precise line and column locations
    for (const finding of findings) {
      expect(finding.location).toBeDefined();
      expect(finding.location?.line).toBeGreaterThan(0);
      expect(finding.location?.column).toBeGreaterThan(0);
    }
  });

  it('should pass cleanly with no critical findings on secure_contract fixture', async () => {
    const sourceCode = fs.readFileSync(secureContractPath, 'utf-8');
    const result = await analyzer.analyze({
      contractId: 'secure-contract',
      projectId: 'project-1',
      file: secureContractPath,
      sourceCode,
    });

    const findings = result.scan.findings;
    // No R001 missing auth findings
    expect(findings.filter((f) => f.ruleId === 'R001')).toHaveLength(0);
    // Score should be high (>= 90)
    expect(result.scan.summary.score).toBeGreaterThanOrEqual(90);
  });

  it('should support extensible custom rules without changing core', async () => {
    // Custom rule detecting usage of TODO comments
    analyzer.addRule({
      id: 'CUSTOM-TODO',
      name: 'todo-marker',
      category: 'code-quality',
      severity: 'low',
      description: 'Found unresolved TODO in smart contract',
      recommendation: 'Resolve or remove TODO comments before deploying to mainnet',
      references: [],
      evaluate: (context) => {
        const customFindings: Finding[] = [];
        for (let i = 0; i < context.file.lines.length; i++) {
          const lineText = context.file.lines[i];
          if (lineText && lineText.includes('TODO:')) {
            customFindings.push({
              id: `FND-TODO-${i}`,
              ruleId: 'CUSTOM-TODO',
              title: 'Unresolved TODO Comment',
              description: 'Contract contains pending TODO',
              severity: 'low',
              location: {
                file: context.file.filePath,
                line: i + 1,
                column: 1,
              },
              recommendation: 'Resolve prior to audit',
              references: [],
            });
          }
        }
        return customFindings;
      },
    });

    const customCode = `
      // TODO: implement refund logic
      pub fn dummy() {}
    `;

    const result = await analyzer.analyze({
      contractId: 'todo-ctr',
      projectId: 'proj-1',
      sourceCode: customCode,
    });

    const todoFindings = result.scan.findings.filter((f) => f.ruleId === 'CUSTOM-TODO');
    expect(todoFindings).toHaveLength(1);
    expect(todoFindings[0]!.location?.line).toBe(2);
  });
});
