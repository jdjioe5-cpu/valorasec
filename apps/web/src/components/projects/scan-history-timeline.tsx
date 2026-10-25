'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Clock, FileText, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { ScanResult, ScanStatus } from '@valorasec/shared';

export interface ScanHistoryTimelineProps {
  scans: ScanResult[];
  contractMap?: Record<string, string>;
  isLoading?: boolean;
}

export function ScanHistoryTimeline({
  scans,
  contractMap = {},
  isLoading = false,
}: ScanHistoryTimelineProps) {
  if (isLoading) {
    return (
      <div
        className="cyber-card text-muted-foreground p-8 text-center"
        data-testid="timeline-loading"
      >
        <Activity className="text-primary mx-auto mb-3 h-6 w-6 animate-spin" />
        <p className="text-sm">Loading scan history...</p>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="cyber-card p-8 text-center" data-testid="timeline-empty-state">
        <Activity className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
        <h4 className="text-foreground font-semibold">No Scan History</h4>
        <p className="text-muted-foreground mt-1 text-sm">
          No security scans have been executed for this project yet. Trigger a scan on any contract
          above to start auditing.
        </p>
      </div>
    );
  }

  const getStatusIcon = (status: ScanStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="text-destructive h-4 w-4" />;
      case 'running':
      case 'pending':
      default:
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getScoreBadgeVariant = (score: number): 'critical' | 'medium' | 'low' => {
    if (score >= 70) return 'low';
    if (score >= 40) return 'medium';
    return 'critical';
  };

  return (
    <div className="before:bg-border/60 relative pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-3 before:w-0.5">
      <div className="space-y-6">
        {scans.map((scan) => {
          const contractName = contractMap[scan.contractId] ?? scan.contractId;
          const score = scan.summary?.score ?? 0;
          const bySeverity = scan.summary?.bySeverity ?? {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
          };

          return (
            <div
              key={scan.id}
              data-testid={`timeline-item-${scan.id}`}
              className="cyber-card hover:border-primary/40 group relative flex flex-col justify-between gap-4 p-4 transition-all md:flex-row md:items-center"
            >
              {/* Timeline marker node */}
              <div
                aria-hidden="true"
                className="top-4.5 bg-background border-primary ring-background absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border-2 ring-4"
              />

              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground flex items-center gap-1 text-sm font-semibold">
                    {getStatusIcon(scan.status)}
                    {contractName}
                  </span>
                  <Badge variant={getScoreBadgeVariant(score)} className="text-xs">
                    Score: {score}/100
                  </Badge>
                  <span className="text-muted-foreground inline-flex items-center gap-1 font-mono text-xs">
                    <Clock className="h-3 w-3" />
                    {scan.duration ? `${scan.duration}s` : 'Instant'}
                  </span>
                </div>

                <div className="text-muted-foreground text-xs">
                  Started {formatDate(scan.startedAt)}
                  {scan.completedAt && ` • Completed ${formatDate(scan.completedAt)}`}
                </div>

                {/* Severity Breakdown Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {bySeverity.critical > 0 && (
                    <span className="rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500">
                      {bySeverity.critical} Critical
                    </span>
                  )}
                  {bySeverity.high > 0 && (
                    <span className="rounded border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-500">
                      {bySeverity.high} High
                    </span>
                  )}
                  {bySeverity.medium > 0 && (
                    <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                      {bySeverity.medium} Medium
                    </span>
                  )}
                  {bySeverity.low > 0 && (
                    <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-500">
                      {bySeverity.low} Low
                    </span>
                  )}
                  {scan.summary?.totalFindings === 0 && (
                    <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                      Clean (0 issues)
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end">
                <Link href="/reports">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5" />
                    View Reports
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
