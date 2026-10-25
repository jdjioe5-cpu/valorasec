import type { AnalyzerRule, Finding, ScanResult, ScanSummary, Severity } from '@valorasec/shared';
import { computeWeightedScore } from './scoring';
export {
  computeWeightedScore,
  calculateDensityFactor,
  getExploitabilityMultiplier,
  determineGrade,
  SEVERITY_BASE_DEDUCTIONS,
} from './scoring';

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

let findingSeq = 0;

function generateMockFindings(rules: AnalyzerRule[], file: string): Finding[] {
  const shuffled = [...rules].sort(() => Math.random() - 0.5);
  const count = Math.floor(Math.random() * 5) + 2; // 2-6 findings
  return shuffled.slice(0, count).map((rule, index) => ({
    id: `FND-${Date.now() * 1000 + (++findingSeq % 1000)}-${index}`,
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

  const { score, breakdown } = computeWeightedScore(findings, linesAnalyzed);

  return {
    totalFindings: findings.length,
    bySeverity,
    score,
    breakdown,
    linesAnalyzed,
    rulesExecuted: MOCK_RULES.length,
  };
}

// ─── Analyzer ────────────────────────────────────────────────────────────

export interface AnalyzerOptions {
  contractId: string;
  projectId: string;
  sourceHash?: string;
  file?: string;
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

    const linesAnalyzed = Math.floor(Math.random() * 500) + 100;
    const findings = generateMockFindings(this.rules, sourceFile);
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
