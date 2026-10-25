import type {
  AnalyzerRule,
  Finding,
  IncrementalScanStats,
  ScanResult,
  ScanSummary,
  Severity,
} from '@valorasec/shared';
import {
  computeSha256,
  extractFunctionChunks,
  diffFunctionChunks,
  preserveAndRebaseFindings,
  buildIncrementalStats,
  type FunctionChunk,
} from './incremental';

export {
  computeSha256,
  extractFunctionChunks,
  diffFunctionChunks,
  preserveAndRebaseFindings,
  buildIncrementalStats,
  type FunctionChunk,
} from './incremental';

// ─── Mock Rules ──────────────────────────────────────────────────────────

export const MOCK_RULES: AnalyzerRule[] = [
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

let findingSeq = 0;

function generateRandomMockFindings(rules: AnalyzerRule[], file: string): Finding[] {
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

export const DEFAULT_MOCK_CONTRACT_SOURCE = `
pub fn initialize(env: Env, admin: Address) {
    admin.require_auth();
    env.storage().instance().set(&DataKey::Admin, &admin);
}

pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    from.require_auth();
    let balance = get_balance(&env, &from);
    if balance < amount {
        panic!("insufficient balance");
    }
    set_balance(&env, &from, balance - amount);
    set_balance(&env, &to, get_balance(&env, &to) + amount);
}

pub fn balance(env: Env, id: Address) -> i128 {
    get_balance(&env, &id)
}

pub fn approve(env: Env, from: Address, spender: Address, amount: i128) {
    from.require_auth();
    env.storage().persistent().set(&DataKey::Allowance(from, spender), &amount);
}

pub fn mint(env: Env, to: Address, amount: i128) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    let cur = get_balance(&env, &to);
    set_balance(&env, &to, cur + amount);
}
`.trim();

// ─── Findings Generator for Chunks ───────────────────────────────────────

export function generateFindingsForChunks(
  rules: AnalyzerRule[],
  file: string,
  targetChunks: FunctionChunk[],
): Finding[] {
  const findings: Finding[] = [];
  if (targetChunks.length === 0) return findings;

  for (const chunk of targetChunks) {
    const ruleIndex =
      Math.abs(chunk.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % rules.length;

    const rule = rules[ruleIndex];
    if (!rule) continue;
    const seq = ++findingSeq;

    findings.push({
      id: `FND-${Date.now()}-${seq}`,
      ruleId: rule.id,
      title: rule.name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      description: `In function \`${chunk.name}\`: ${rule.description}`,
      severity: rule.severity,
      location: {
        file,
        line: chunk.startLine + 1,
        column: 4,
      },
      recommendation: rule.recommendation,
      references: rule.references,
    });
  }

  return findings;
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

// ─── Analyzer ────────────────────────────────────────────────────────────

export interface AnalyzerOptions {
  contractId: string;
  projectId: string;
  sourceHash?: string;
  sourceCode?: string;
  previousScan?: ScanResult;
  forceFullScan?: boolean;
  file?: string;
}

export interface AnalyzerResult {
  scan: ScanResult;
  rules: AnalyzerRule[];
  incrementalStats?: IncrementalScanStats;
}

export class SecurityAnalyzer {
  private rules: AnalyzerRule[] = [...MOCK_RULES];
  private scanCache = new Map<string, { scan: ScanResult; chunks: Map<string, FunctionChunk> }>();

  getRules(): AnalyzerRule[] {
    return [...this.rules];
  }

  addRule(rule: AnalyzerRule): void {
    this.rules.push(rule);
  }

  clearCache(): void {
    this.scanCache.clear();
  }

  async analyze(options: AnalyzerOptions): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const sourceFile = options.file ?? 'contract/src/lib.rs';

    // If completely default mock options without code, hash, or previous scan, run backward-compatible mock
    const isGenericMock = !options.sourceCode && !options.sourceHash && !options.previousScan;

    if (isGenericMock) {
      const linesAnalyzed = Math.floor(Math.random() * 500) + 100;
      const findings = generateRandomMockFindings(this.rules, sourceFile);
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

    // Incremental or scoped execution with source code or hash
    const sourceCode = options.sourceCode ?? DEFAULT_MOCK_CONTRACT_SOURCE;
    const currentSourceHash = options.sourceHash ?? computeSha256(sourceCode);
    const currentChunks = extractFunctionChunks(sourceCode);

    const cachedEntry = this.scanCache.get(options.contractId);
    const previousScan = options.previousScan ?? cachedEntry?.scan;
    const previousChunks = cachedEntry?.chunks ?? new Map<string, FunctionChunk>();

    const linesAnalyzed = sourceCode.split('\n').length;
    let finalFindings: Finding[] = [];
    let incrementalStats: IncrementalScanStats | undefined;

    const canDoIncremental =
      !options.forceFullScan &&
      previousScan &&
      previousScan.status === 'completed' &&
      previousChunks.size > 0;

    if (canDoIncremental) {
      const diff = diffFunctionChunks(
        previousChunks,
        currentChunks,
        previousScan.sourceHash,
        currentSourceHash,
      );

      if (diff.isIdentical) {
        finalFindings = [...previousScan.findings];
        incrementalStats = buildIncrementalStats(
          diff,
          currentChunks.size,
          previousScan.findings.length,
          0,
          true,
        );
      } else {
        const preservedFindings = preserveAndRebaseFindings(
          previousScan.findings,
          previousChunks,
          diff,
        );

        const scopedChunks: FunctionChunk[] = [];
        for (const fnName of [...diff.changedFunctions, ...diff.addedFunctions]) {
          const chunk = currentChunks.get(fnName);
          if (chunk) scopedChunks.push(chunk);
        }

        const newFindings = generateFindingsForChunks(this.rules, sourceFile, scopedChunks);
        finalFindings = [...preservedFindings, ...newFindings];

        incrementalStats = buildIncrementalStats(
          diff,
          currentChunks.size,
          preservedFindings.length,
          newFindings.length,
          false,
        );
      }
    } else {
      const allChunks = Array.from(currentChunks.values());
      finalFindings = generateFindingsForChunks(this.rules, sourceFile, allChunks);
      if (allChunks.length === 0) {
        finalFindings = [];
      }
    }

    const summary = computeSummary(finalFindings, linesAnalyzed);
    const duration = Math.max(1, Date.now() - startTime);

    const scan: ScanResult = {
      id: `scan-${Date.now()}`,
      projectId: options.projectId,
      contractId: options.contractId,
      status: 'completed',
      findings: finalFindings,
      summary,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      duration,
      sourceHash: currentSourceHash,
      incrementalStats,
    };

    this.scanCache.set(options.contractId, { scan, chunks: currentChunks });

    return {
      scan,
      rules: this.getRules(),
      incrementalStats,
    };
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
