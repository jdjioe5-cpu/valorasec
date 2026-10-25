'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, RotateCw, Search, Cpu, FileCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ScanStep, UseScanProgressResult } from '@/lib/hooks/use-scan-progress';
import { getSeverityClass } from '@/lib/utils';
import Link from 'next/link';

export interface ScanProgressProps {
  progress: UseScanProgressResult;
  contractName?: string;
  onRetry?: () => void;
  className?: string;
}

interface StepItem {
  key: 'analyzing' | 'processing' | 'complete';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepItem[] = [
  {
    key: 'analyzing',
    label: 'Analyzing',
    description: 'Parsing AST & Soroban rules',
    icon: Search,
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Evaluating severity & density',
    icon: Cpu,
  },
  {
    key: 'complete',
    label: 'Complete',
    description: 'Report & findings generated',
    icon: FileCheck,
  },
];

function getStepState(
  stepKey: 'analyzing' | 'processing' | 'complete',
  currentStep: ScanStep,
): 'pending' | 'active' | 'completed' {
  if (currentStep === 'complete') return 'completed';
  if (currentStep === 'failed') {
    if (stepKey === 'complete') return 'pending';
    return 'active';
  }

  const order = ['analyzing', 'processing', 'complete'];
  const currentIndex = order.indexOf(currentStep);
  const targetIndex = order.indexOf(stepKey);

  if (targetIndex < currentIndex) return 'completed';
  if (targetIndex === currentIndex) return 'active';
  return 'pending';
}

export function ScanProgress({
  progress,
  contractName,
  onRetry,
  className = '',
}: ScanProgressProps) {
  const {
    scanId,
    data,
    step,
    progressPercent,
    estimatedRemainingSec,
    durationSec,
    isCompleted,
    isFailed,
    error,
  } = progress;

  if (!scanId && !data) return null;

  return (
    <div
      className={`cyber-card border-primary/40 relative overflow-hidden p-6 shadow-lg ${className}`}
      data-testid="scan-progress-container"
    >
      {/* Top Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2
              className="h-5 w-5 text-emerald-400"
              data-testid="scan-status-icon-completed"
            />
          ) : isFailed ? (
            <AlertTriangle className="h-5 w-5 text-red-400" data-testid="scan-status-icon-failed" />
          ) : (
            <RotateCw
              className="text-primary h-5 w-5 animate-spin"
              data-testid="scan-status-icon-running"
            />
          )}
          <div>
            <h3 className="font-heading text-base font-semibold">
              {isCompleted
                ? 'Scan Completed Successfully'
                : isFailed
                  ? 'Security Scan Interrupted'
                  : `Scanning Contract${contractName ? `: ${contractName}` : ''}...`}
            </h3>
            <p className="text-muted-foreground font-mono text-xs">
              Scan ID: <span className="text-foreground">{scanId ?? data?.id ?? '—'}</span>
            </p>
          </div>
        </div>

        {/* Right Status / Timer Badge */}
        <div className="flex items-center gap-2">
          {!isCompleted && !isFailed && (
            <Badge variant="outline" className="flex items-center gap-1 font-mono text-xs">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              <span>~{estimatedRemainingSec}s remaining</span>
            </Badge>
          )}

          {isCompleted && durationSec !== undefined && (
            <Badge variant="low" className="font-mono text-xs">
              Finished in {durationSec}s
            </Badge>
          )}

          {isCompleted && data?.summary && (
            <Badge
              variant={
                data.summary.score >= 70 ? 'low' : data.summary.score >= 40 ? 'medium' : 'critical'
              }
              className="font-bold"
            >
              Score: {data.summary.score}/100
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">
            {isCompleted
              ? 'Analysis finished'
              : isFailed
                ? 'Failed during execution'
                : `Progress: ${progressPercent}%`}
          </span>
          <span className="text-primary font-mono font-semibold">{progressPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Security scan progress"
          className="bg-accent/40 relative h-2.5 w-full overflow-hidden rounded-full"
        >
          <div
            className={`h-full transition-all duration-300 ease-out ${
              isFailed
                ? 'bg-red-500'
                : isCompleted
                  ? 'bg-emerald-500'
                  : 'from-primary/80 via-primary bg-gradient-to-r to-cyan-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3 Steps Indicator */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STEPS.map((s) => {
          const state = getStepState(s.key, step);
          const Icon = s.icon;

          return (
            <div
              key={s.key}
              data-testid={`step-${s.key}`}
              className={`rounded-lg border p-3 transition-colors ${
                state === 'completed'
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : state === 'active'
                    ? 'border-primary bg-primary/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                    : 'border-border/40 bg-accent/10 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    state === 'completed'
                      ? 'bg-emerald-500 text-black'
                      : state === 'active'
                        ? 'bg-primary animate-pulse text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {state === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className="text-sm font-semibold">{s.label}</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{s.description}</p>
            </div>
          );
        })}
      </div>

      {/* Terminal Completed Details / Findings Summary */}
      {isCompleted && data?.summary && (
        <div className="border-border/40 mt-6 border-t pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Scan Summary & Findings
            </span>
            <span className="text-muted-foreground text-xs">
              {data.summary.totalFindings} finding{data.summary.totalFindings === 1 ? '' : 's'}{' '}
              identified
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
            {Object.entries(data.summary.bySeverity).map(([severity, count]) => (
              <div
                key={severity}
                className="bg-accent/30 flex items-center justify-between rounded-md px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground capitalize">{severity}</span>
                <span
                  className={`font-mono font-bold ${getSeverityClass(severity).replace(/severity-/, 'text-')}`}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/reports">
              <Button variant="cyber" size="sm">
                View Full Report
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Error state */}
      {isFailed && (
        <div className="border-border/40 mt-6 border-t pt-4">
          <div className="flex items-start justify-between rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <div>
              <p className="text-sm font-medium text-red-400">Analysis encountered an error</p>
              <p className="text-muted-foreground text-xs">
                {error?.message ?? 'Unknown scan execution failure occurred.'}
              </p>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
                Retry Scan
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
