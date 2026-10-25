'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  FileCode,
  Lightbulb,
  ExternalLink,
  ChevronsUpDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Finding, Severity } from '@valorasec/shared';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_CONFIG: Record<
  Severity,
  {
    label: string;
    badgeVariant: 'critical' | 'high' | 'medium' | 'low' | 'info';
    colorClass: string;
  }
> = {
  critical: {
    label: 'Critical Severity',
    badgeVariant: 'critical',
    colorClass: 'text-red-500 border-red-500/30 bg-red-500/10',
  },
  high: {
    label: 'High Severity',
    badgeVariant: 'high',
    colorClass: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
  },
  medium: {
    label: 'Medium Severity',
    badgeVariant: 'medium',
    colorClass: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  },
  low: {
    label: 'Low Severity',
    badgeVariant: 'low',
    colorClass: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
  },
  info: {
    label: 'Informational',
    badgeVariant: 'info',
    colorClass: 'text-gray-400 border-gray-500/30 bg-gray-500/10',
  },
};

export interface FindingsGroupedListProps {
  findings: Finding[];
}

export function FindingsGroupedList({ findings }: FindingsGroupedListProps) {
  // Group findings by severity
  const grouped = useMemo(() => {
    const map = new Map<Severity, Finding[]>();
    for (const sev of SEVERITY_ORDER) {
      map.set(sev, []);
    }
    for (const f of findings) {
      const sev = f.severity?.toLowerCase() as Severity;
      const list = map.get(sev);
      if (list) {
        list.push(f);
      } else {
        const infoList = map.get('info') ?? [];
        infoList.push(f);
        map.set('info', infoList);
      }
    }
    return map;
  }, [findings]);

  // Track expanded state for each severity group
  // Default to expanding critical, high, and medium groups
  const [expanded, setExpanded] = useState<Record<Severity, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: false,
    info: false,
  });

  const toggleGroup = (severity: Severity) => {
    setExpanded((prev) => ({ ...prev, [severity]: !prev[severity] }));
  };

  const expandAll = () => {
    setExpanded({
      critical: true,
      high: true,
      medium: true,
      low: true,
      info: true,
    });
  };

  const collapseAll = () => {
    setExpanded({
      critical: false,
      high: false,
      medium: false,
      low: false,
      info: false,
    });
  };

  if (findings.length === 0) {
    return (
      <div data-testid="findings-empty-state" className="cyber-card p-12 text-center">
        <ShieldCheck className="text-primary mx-auto mb-4 h-12 w-12" aria-hidden="true" />
        <h3 className="mb-2 text-xl font-bold">No vulnerabilities detected</h3>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          All automated security checks completed successfully with zero findings. Your smart
          contract adheres to recommended security patterns.
        </p>
      </div>
    );
  }

  const activeSeverities = SEVERITY_ORDER.filter((sev) => (grouped.get(sev) ?? []).length > 0);

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-sm">
          Showing <span className="text-foreground font-semibold">{findings.length}</span> finding
          {findings.length !== 1 ? 's' : ''} across {activeSeverities.length} severity tier
          {activeSeverities.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            data-testid="expand-all-btn"
            className="text-xs"
          >
            <ChevronsUpDown className="mr-1 h-3.5 w-3.5" /> Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            data-testid="collapse-all-btn"
            className="text-muted-foreground text-xs"
          >
            Collapse All
          </Button>
        </div>
      </div>

      {/* Severity Groups Accordion */}
      <div className="space-y-4">
        {activeSeverities.map((sev) => {
          const items = grouped.get(sev) ?? [];
          const config = SEVERITY_CONFIG[sev];
          const isExpanded = expanded[sev];

          return (
            <div
              key={sev}
              data-testid={`severity-group-${sev}`}
              className="cyber-card overflow-hidden transition-all"
            >
              {/* Group Header Toggle Button */}
              <button
                type="button"
                onClick={() => toggleGroup(sev)}
                data-testid={`toggle-group-${sev}`}
                className="hover:bg-muted/40 focus:ring-ring flex w-full items-center justify-between p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="text-muted-foreground h-5 w-5" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="text-muted-foreground h-5 w-5" aria-hidden="true" />
                  )}
                  <h3 className="font-semibold">{config.label}</h3>
                  <Badge variant={config.badgeVariant} className="text-xs">
                    {items.length}
                  </Badge>
                </div>
                <span className="text-muted-foreground text-xs">
                  {isExpanded ? 'Click to collapse' : 'Click to expand'}
                </span>
              </button>

              {/* Group Body Items */}
              {isExpanded && (
                <div className="border-border/50 divide-border/40 bg-card/40 divide-y border-t">
                  {items.map((item, index) => (
                    <div
                      key={item.id || index}
                      data-testid={`finding-card-${item.id || index}`}
                      className="space-y-3 p-5"
                    >
                      {/* Title & Rule ID */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-semibold">{item.title}</h4>
                            {item.ruleId && (
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {item.ruleId}
                              </Badge>
                            )}
                          </div>
                          {item.location && (
                            <div className="text-muted-foreground mt-1 flex items-center gap-1 font-mono text-xs">
                              <FileCode className="text-primary h-3.5 w-3.5" aria-hidden="true" />
                              <span>
                                {item.location.file}:{item.location.line}
                                {item.location.column !== undefined
                                  ? `:${item.location.column}`
                                  : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        <Badge variant={config.badgeVariant} className="flex-shrink-0 capitalize">
                          {item.severity}
                        </Badge>
                      </div>

                      {/* Description */}
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {item.description}
                      </p>

                      {/* Recommendation Box */}
                      {item.recommendation && (
                        <div className="bg-primary/5 border-primary/20 space-y-1 rounded-md border p-3.5">
                          <div className="text-primary flex items-center gap-1.5 text-xs font-semibold">
                            <Lightbulb className="h-4 w-4" aria-hidden="true" />
                            <span>Remediation Recommendation</span>
                          </div>
                          <p className="text-foreground/90 pl-5 text-sm">{item.recommendation}</p>
                        </div>
                      )}

                      {/* References Links */}
                      {item.references && item.references.length > 0 && (
                        <div className="pt-1">
                          <span className="text-muted-foreground text-xs font-medium">
                            References:
                          </span>
                          <ul className="mt-1 flex flex-wrap gap-2">
                            {item.references.map((refUrl, rIdx) => (
                              <li key={rIdx}>
                                <a
                                  href={refUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary bg-accent/40 inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs hover:underline"
                                >
                                  <span>{refUrl.replace(/^https?:\/\//, '').split('/')[0]}</span>
                                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
