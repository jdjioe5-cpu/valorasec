import type { AnalyzerRule, Finding, ScanResult, ScanSummary, Severity } from '@valorasec/shared';

// ─── Mock Rules ──────────────────────────────────────────────────────────

const MOCK_RULES: AnalyzerRule[] = [
  {
    id: 'R001',
    name: 'missing-authorization-check',
    category: 'authorization',
    severity: 'critical',
    description:
      'Contract function does not verify caller authorization before executing privileged operations.',
    recommendation:
      'Add `require_auth()` or `require_auth_for_args()` to verify the caller before executing sensitive operations.',
    references: ['https://soroban.stellar.org/docs/authorization'],
  },
  {
    id: 'R002',
    name: 'unsafe-storage-access',
    category: 'storage',
    severity: 'high',
    description:
      'Storage map accessed without checking for existence, potentially leading to unexpected behavior.',
    recommendation:
      'Use `get()` with proper error handling or check for existence before accessing storage values.',
    references: ['https://soroban.stellar.org/docs/storage'],
  },
  {
    id: 'R003',
    name: 'input-validation-missing',
    category: 'input-validation',
    severity: 'high',
    description:
      'Function parameters are not validated, potentially allowing malicious or malformed inputs.',
    recommendation:
      'Add input validation checks at the beginning of each public function to ensure parameters are within expected ranges.',
    references: ['https://soroban.stellar.org/docs/best-practices'],
  },
  {
    id: 'R004',
    name: 'dead-code',
    category: 'code-quality',
    severity: 'low',
    description: 'Unreachable code detected that will never execute.',
    recommendation: 'Remove dead code to improve readability and reduce contract size.',
    references: [],
  },
  {
    id: 'R005',
    name: 'unhandled-panic',
    category: 'panic-safety',
    severity: 'medium',
    description:
      'Code contains `unwrap()` or `expect()` calls that may cause the contract to panic.',
    recommendation:
      'Replace `unwrap()` with proper error handling using `?` operator or pattern matching.',
    references: ['https://doc.rust-lang.org/book/ch09-00-error-handling.html'],
  },
  {
    id: 'R006',
    name: 'gas-inefficient-loop',
    category: 'gas-optimization',
    severity: 'medium',
    description: 'Loops with unbounded iteration may consume excessive gas.',
    recommendation: 'Limit loop iterations or use pagination patterns to control gas consumption.',
    references: ['https://soroban.stellar.org/docs/fees-and-metering'],
  },
  {
    id: 'R007',
    name: 'unsafe-randomness',
    category: 'randomness',
    severity: 'high',
    description: 'Using on-chain data as a source of randomness is predictable and exploitable.',
    recommendation:
      'Avoid using on-chain data for randomness. Use commit-reveal schemes or external oracle for randomness.',
    references: [],
  },
  {
    id: 'R008',
    name: 'authorization-misuse',
    category: 'authorization',
    severity: 'critical',
    description:
      'Authorization checks are present but incorrectly implemented, potentially allowing unauthorized access.',
    recommendation:
      'Review authorization logic to ensure all edge cases are handled and authorization cannot be bypassed.',
    references: ['https://soroban.stellar.org/docs/authorization'],
  },
];

// ─── Mock Findings Generator ─────────────────────────────────────────────

function generateMockFindings(rules: AnalyzerRule[], file: string): Finding[] {
  const shuffled = [...rules].sort(() => Math.random() - 0.5);
  const count = Math.floor(Math.random() * 5) + 2; // 2-6 findings
  return shuffled.slice(0, count).map((rule, index) => ({
    id: `FND-${Date.now()}-${index}`,
    ruleId: rule.id,
    title: rule.name
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    description: rule.description,
    severity: rule.severity,
    location: {
      file,
      line: Math.floor(Math.random() * 500) + 1,
      column: Math.floor(Math.random() * 80) + 1,
    },
    recommendation: rule.recommendation,
    references: rule.references,
  }));
}

function computeSummary(findings: Finding[], linesAnalyzed: number): ScanSummary {
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const f of findings) {
    bySeverity[f.severity]++;
  }

  // Compute score: deduct points based on severity counts
  const deductions =
    bySeverity.critical * 25 +
    bySeverity.high * 15 +
    bySeverity.medium * 8 +
    bySeverity.low * 3 +
    bySeverity.info * 1;

  const score = Math.max(0, Math.min(100, 100 - deductions));

  return {
    totalFindings: findings.length,
    bySeverity,
    score,
    linesAnalyzed,
    rulesExecuted: MOCK_RULES.length,
  };
}

// ─── Real Rust Source Analyzer ──────────────────────────────────────────

function analyzeRustSource(rules: AnalyzerRule[], sourceCode: string, file: string): Finding[] {
  const findings: Finding[] = [];
  const lines = sourceCode.split('\n');
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  // 1. Check for unhandled panic (.unwrap(), .expect())
  const r005 = ruleMap.get('R005');
  if (r005) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

      const unwrapIndex = line.indexOf('.unwrap()');
      if (unwrapIndex !== -1) {
        findings.push({
          id: `FND-REAL-${findings.length + 1}`,
          ruleId: r005.id,
          title: 'Unhandled Panic via unwrap()',
          description: 'Code contains `.unwrap()` which may panic at runtime if an error occurs.',
          severity: r005.severity,
          location: { file, line: i + 1, column: unwrapIndex + 1 },
          recommendation: r005.recommendation,
          references: r005.references,
        });
      }

      const expectIndex = line.indexOf('.expect(');
      if (expectIndex !== -1) {
        findings.push({
          id: `FND-REAL-${findings.length + 1}`,
          ruleId: r005.id,
          title: 'Unhandled Panic via expect()',
          description: 'Code contains `.expect()` which causes an unhandled panic on None or Err.',
          severity: r005.severity,
          location: { file, line: i + 1, column: expectIndex + 1 },
          recommendation: r005.recommendation,
          references: r005.references,
        });
      }
    }
  }

  // 2. Check for missing authorization check in public functions (R001)
  const r001 = ruleMap.get('R001');
  if (r001) {
    let inPublicFn = false;
    let currentFnName = '';
    let fnStartLine = 0;
    let fnStartCol = 0;
    let fnBodyHasAuth = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) continue;

      const pubFnMatch = line.match(/pub\s+fn\s+([a-zA-Z0-9_]+)/);
      if (pubFnMatch && !inPublicFn) {
        currentFnName = pubFnMatch[1] ?? '';
        inPublicFn = true;
        fnStartLine = i + 1;
        fnStartCol = line.indexOf('pub fn') + 1;
        fnBodyHasAuth = false;
        braceCount = 0;
      }

      if (inPublicFn) {
        if (line.includes('require_auth') || line.includes('require_auth_for_args')) {
          fnBodyHasAuth = true;
        }

        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }

        if (braceCount === 0 && line.includes('}')) {
          const isPrivilegedName =
            /transfer|withdraw|mint|burn|set_|update_|admin|delete|upgrade|authorize/i.test(
              currentFnName,
            );
          if (isPrivilegedName && !fnBodyHasAuth) {
            findings.push({
              id: `FND-REAL-${findings.length + 1}`,
              ruleId: r001.id,
              title: `Missing Authorization Check in ${currentFnName}`,
              description: `Privileged function '${currentFnName}' executes without verifying caller authorization via require_auth().`,
              severity: r001.severity,
              location: { file, line: fnStartLine, column: fnStartCol },
              recommendation: r001.recommendation,
              references: r001.references,
            });
          }
          inPublicFn = false;
        }
      }
    }
  }

  // 3. Check for gas-inefficient loop (R006)
  const r006 = ruleMap.get('R006');
  if (r006) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) continue;
      if (/^\s*(while\s+|loop\s*\{)/.test(line)) {
        findings.push({
          id: `FND-REAL-${findings.length + 1}`,
          ruleId: r006.id,
          title: 'Potentially Unbounded Loop',
          description:
            'Loop with potentially unbounded iterations may exhaust gas limits on Soroban.',
          severity: r006.severity,
          location: { file, line: i + 1, column: 1 },
          recommendation: r006.recommendation,
          references: r006.references,
        });
      }
    }
  }

  // 4. Check for dead code (R004)
  const r004 = ruleMap.get('R004');
  if (r004) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (line.includes('#[allow(dead_code)]')) {
        findings.push({
          id: `FND-REAL-${findings.length + 1}`,
          ruleId: r004.id,
          title: 'Suppressed Dead Code Warning',
          description:
            'Dead code is explicitly allowed via attribute, which can bloat contract binary size.',
          severity: r004.severity,
          location: { file, line: i + 1, column: line.indexOf('#[allow(dead_code)]') + 1 },
          recommendation: r004.recommendation,
          references: r004.references,
        });
      }
    }
  }

  // 5. Check for unsafe storage access (R002)
  const r002 = ruleMap.get('R002');
  if (r002) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) continue;
      if (
        line.includes('.storage().instance().get') ||
        line.includes('.storage().persistent().get')
      ) {
        if (!line.includes('.unwrap_or') && !line.includes('has(')) {
          findings.push({
            id: `FND-REAL-${findings.length + 1}`,
            ruleId: r002.id,
            title: 'Direct Storage Access without Safe Fallback',
            description: 'Direct storage retrieval without existence check or fallback value.',
            severity: r002.severity,
            location: { file, line: i + 1, column: line.indexOf('.storage()') + 1 },
            recommendation: r002.recommendation,
            references: r002.references,
          });
        }
      }
    }
  }

  return findings;
}

// ─── Analyzer ────────────────────────────────────────────────────────────

export interface AnalyzerOptions {
  contractId: string;
  projectId: string;
  sourceHash?: string;
  file?: string;
  sourceCode?: string;
}

export interface AnalyzerResult {
  scan: ScanResult;
  rules: AnalyzerRule[];
}

export class SecurityAnalyzer {
  private rules: AnalyzerRule[] = [...MOCK_RULES];

  getRules(): AnalyzerRule[] {
    return [...this.rules];
  }

  addRule(rule: AnalyzerRule): void {
    this.rules.push(rule);
  }

  async analyze(options: AnalyzerOptions): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const sourceFile = options.file ?? 'contract/src/lib.rs';

    let linesAnalyzed: number;
    let findings: Finding[];

    if (options.sourceCode !== undefined) {
      linesAnalyzed = options.sourceCode.split('\n').length;
      findings = analyzeRustSource(this.rules, options.sourceCode, sourceFile);
    } else {
      linesAnalyzed = Math.floor(Math.random() * 500) + 100;
      findings = generateMockFindings(this.rules, sourceFile);
    }

    const summary = computeSummary(findings, linesAnalyzed);

    const scan: ScanResult = {
      id: `scan-${Date.now()}`,
      projectId: options.projectId,
      contractId: options.contractId,
      status: 'completed',
      findings,
      summary,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    };

    return { scan, rules: this.getRules() };
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────

let defaultAnalyzer: SecurityAnalyzer | null = null;

export function getAnalyzer(): SecurityAnalyzer {
  if (!defaultAnalyzer) {
    defaultAnalyzer = new SecurityAnalyzer();
  }
  return defaultAnalyzer;
}
