import type { Finding, ScoreBreakdown, Severity } from '@valorasec/shared';

export const SEVERITY_BASE_DEDUCTIONS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 1,
};

/**
 * Calculates rule-specific exploitability multiplier based on vulnerability category/ruleId
 */
export function getExploitabilityMultiplier(ruleId: string): number {
  const normalized = ruleId.toLowerCase();
  // Authorization / Access control issues have the highest exploitability
  if (normalized.includes('auth') || normalized.includes('r009') || normalized.includes('r001')) {
    return 1.25;
  }
  // Storage or Reentrancy or Value transfer
  if (
    normalized.includes('storage') ||
    normalized.includes('drain') ||
    normalized.includes('overflow')
  ) {
    return 1.15;
  }
  // Input validation or panic
  if (
    normalized.includes('input') ||
    normalized.includes('panic') ||
    normalized.includes('uncheck')
  ) {
    return 1.1;
  }
  return 1.0;
}

/**
 * Calculates finding density multiplier (findings per 100 lines of code)
 */
export function calculateDensityFactor(totalFindings: number, linesAnalyzed: number): number {
  if (totalFindings === 0) return 1.0;
  // Floor effective lines at 50 to avoid division by zero or excessive penalization on small snippets
  const effectiveLines = Math.max(50, linesAnalyzed);
  const density = totalFindings / (effectiveLines / 100);

  if (density <= 1.0) {
    return 1.0;
  }
  // Cap density factor between 1.0 and 1.5
  const factor = 1.0 + (density - 1.0) * 0.1;
  return Math.min(1.5, Math.round(factor * 100) / 100);
}

export function determineGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Computes deterministic weighted security score with full breakdown.
 */
export function computeWeightedScore(
  findings: Finding[],
  linesAnalyzed: number,
): { score: number; breakdown: ScoreBreakdown } {
  const deductionsBySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const rationale: string[] = [];

  if (findings.length === 0) {
    const breakdown: ScoreBreakdown = {
      baseScore: 100,
      rawDeduction: 0,
      densityFactor: 1.0,
      deductionsBySeverity,
      finalScore: 100,
      grade: 'A',
      rationale: ['No security vulnerabilities found. Contract maintains pristine safety rating.'],
    };
    return { score: 100, breakdown };
  }

  const densityFactor = calculateDensityFactor(findings.length, linesAnalyzed);
  let totalDeductions = 0;

  for (const finding of findings) {
    const baseDeduction = SEVERITY_BASE_DEDUCTIONS[finding.severity] ?? 1;
    const exploitMultiplier = getExploitabilityMultiplier(finding.ruleId);
    const findingDeduction =
      Math.round(baseDeduction * exploitMultiplier * densityFactor * 10) / 10;

    deductionsBySeverity[finding.severity] =
      Math.round((deductionsBySeverity[finding.severity] + findingDeduction) * 10) / 10;
    totalDeductions += findingDeduction;
  }

  const rawDeduction = Math.round(totalDeductions * 10) / 10;
  const finalScore = Math.max(0, Math.min(100, Math.round(100 - rawDeduction)));
  const grade = determineGrade(finalScore);

  // Build rationale summary
  if (deductionsBySeverity.critical > 0) {
    rationale.push(
      `Deducted ${deductionsBySeverity.critical} pts from Critical vulnerabilities with high exploitability.`,
    );
  }
  if (deductionsBySeverity.high > 0) {
    rationale.push(`Deducted ${deductionsBySeverity.high} pts from High severity security issues.`);
  }
  if (deductionsBySeverity.medium > 0) {
    rationale.push(`Deducted ${deductionsBySeverity.medium} pts from Medium severity concerns.`);
  }
  if (deductionsBySeverity.low > 0 || deductionsBySeverity.info > 0) {
    rationale.push(
      `Deducted ${(deductionsBySeverity.low + deductionsBySeverity.info).toFixed(1)} pts from Low/Info code quality findings.`,
    );
  }
  if (densityFactor > 1.0) {
    rationale.push(
      `Density penalty of ${Math.round((densityFactor - 1.0) * 100)}% applied due to high finding concentration per 100 lines.`,
    );
  }

  const breakdown: ScoreBreakdown = {
    baseScore: 100,
    rawDeduction,
    densityFactor,
    deductionsBySeverity,
    finalScore,
    grade,
    rationale,
  };

  return { score: finalScore, breakdown };
}
