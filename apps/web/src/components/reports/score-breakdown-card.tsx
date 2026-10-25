'use client';

import React, { useMemo } from 'react';
import { Info, Gauge } from 'lucide-react';
import type { Finding, ScoreBreakdown } from '@valorasec/shared';

export interface ScoreBreakdownCardProps {
  score: number;
  breakdown?: ScoreBreakdown;
  findings?: Finding[];
  linesAnalyzed?: number;
}

export function ScoreBreakdownCard({
  score,
  breakdown,
  findings = [],
  linesAnalyzed = 100,
}: ScoreBreakdownCardProps) {
  // If breakdown was not provided by API payload, dynamically construct fallback breakdown
  const resolvedBreakdown = useMemo<ScoreBreakdown>(() => {
    if (breakdown) return breakdown;

    const deductionsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    let rawDeduction = 0;
    for (const f of findings) {
      let pts = 1;
      if (f.severity === 'critical') pts = 25;
      else if (f.severity === 'high') pts = 15;
      else if (f.severity === 'medium') pts = 8;
      else if (f.severity === 'low') pts = 3;

      deductionsBySeverity[f.severity] += pts;
      rawDeduction += pts;
    }

    const effectiveLines = Math.max(50, linesAnalyzed);
    const density = findings.length / (effectiveLines / 100);
    const densityFactor = density > 1.0 ? Math.min(1.5, 1.0 + (density - 1.0) * 0.1) : 1.0;

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
    if (score < 40) grade = 'F';
    else if (score < 60) grade = 'D';
    else if (score < 75) grade = 'C';
    else if (score < 90) grade = 'B';

    const rationale: string[] = [];
    if (findings.length === 0) {
      rationale.push(
        'No security vulnerabilities found. Contract maintains pristine safety rating.',
      );
    } else {
      if (deductionsBySeverity.critical > 0) {
        rationale.push(
          `Deducted ${deductionsBySeverity.critical} pts from Critical vulnerabilities.`,
        );
      }
      if (deductionsBySeverity.high > 0) {
        rationale.push(
          `Deducted ${deductionsBySeverity.high} pts from High severity security issues.`,
        );
      }
      if (deductionsBySeverity.medium > 0) {
        rationale.push(
          `Deducted ${deductionsBySeverity.medium} pts from Medium severity concerns.`,
        );
      }
      if (densityFactor > 1.0) {
        rationale.push(`Density penalty applied based on findings-to-code volume ratio.`);
      }
    }

    return {
      baseScore: 100,
      rawDeduction,
      densityFactor: Math.round(densityFactor * 100) / 100,
      deductionsBySeverity,
      finalScore: score,
      grade,
      rationale,
    };
  }, [breakdown, findings, linesAnalyzed, score]);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
      case 'B':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      case 'C':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'D':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'F':
      default:
        return 'text-red-500 bg-red-500/10 border-red-500/30';
    }
  };

  return (
    <div className="cyber-card p-6" data-testid="score-breakdown-card">
      <div className="border-border/50 mb-4 flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <Gauge className="text-primary h-5 w-5" />
          <h3 className="font-heading text-foreground text-lg font-bold">
            Security Score Analysis & Breakdown
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Safety Grade:
          </span>
          <span
            data-testid="score-grade-badge"
            className={`rounded-full border px-3 py-0.5 text-sm font-bold ${getGradeColor(
              resolvedBreakdown.grade,
            )}`}
          >
            Grade {resolvedBreakdown.grade}
          </span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Base & Final Metrics */}
        <div className="bg-accent/20 border-border/40 space-y-3 rounded-lg border p-4">
          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Calculation Pipeline
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Baseline Rating:</span>
            <span className="text-foreground font-mono font-bold">100.0</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Severity Deductions:</span>
            <span className="text-destructive font-mono font-bold">
              -{resolvedBreakdown.rawDeduction.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Density Multiplier:</span>
            <span className="text-foreground font-mono font-bold">
              {resolvedBreakdown.densityFactor.toFixed(2)}x
            </span>
          </div>
          <div className="border-border/40 flex items-center justify-between border-t pt-2 text-base font-bold">
            <span className="text-foreground">Final Score:</span>
            <span className="text-primary font-mono text-lg">
              {resolvedBreakdown.finalScore}/100
            </span>
          </div>
        </div>

        {/* Severity Deductions Breakdown */}
        <div className="bg-accent/20 border-border/40 space-y-2.5 rounded-lg border p-4 md:col-span-2">
          <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
            Points Deducted by Severity
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="bg-background/60 border-border/40 rounded border p-2">
              <div className="text-muted-foreground text-[11px] font-medium">Critical</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-red-500">
                -{resolvedBreakdown.deductionsBySeverity.critical} pts
              </div>
            </div>
            <div className="bg-background/60 border-border/40 rounded border p-2">
              <div className="text-muted-foreground text-[11px] font-medium">High</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-orange-500">
                -{resolvedBreakdown.deductionsBySeverity.high} pts
              </div>
            </div>
            <div className="bg-background/60 border-border/40 rounded border p-2">
              <div className="text-muted-foreground text-[11px] font-medium">Medium</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-amber-500">
                -{resolvedBreakdown.deductionsBySeverity.medium} pts
              </div>
            </div>
            <div className="bg-background/60 border-border/40 rounded border p-2">
              <div className="text-muted-foreground text-[11px] font-medium">Low / Info</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-blue-500">
                -
                {(
                  resolvedBreakdown.deductionsBySeverity.low +
                  resolvedBreakdown.deductionsBySeverity.info
                ).toFixed(1)}{' '}
                pts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rationale Bullet Points */}
      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          <Info className="h-3.5 w-3.5" />
          Scoring Rationale & Audit Insights
        </div>
        <ul className="space-y-1.5 pl-1">
          {resolvedBreakdown.rationale.map((item, idx) => (
            <li
              key={idx}
              className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
            >
              <span className="text-primary mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
