'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Shield,
  Plus,
  ArrowRight,
  TrendingUp,
  FileText,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Scan,
  Zap,
  BarChart3,
  Network,
  Clock,
  CheckCircle2,
  GitBranch,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Project, Report } from '@valorasec/shared';

// ─── Types ────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: 'scan' | 'report' | 'project' | 'verification';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

// ─── Stat Card ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  trend,
  color = 'primary',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: { direction: 'up' | 'down'; value: string };
  color?: string;
}) {
  return (
    <div className="cyber-card group relative overflow-hidden p-6 transition-all duration-300 hover:shadow-[0_0_40px_rgba(34,197,94,0.08)]">
      {/* Hover accent bar */}
      <div className="bg-primary/20 absolute -inset-x-4 -top-px h-px scale-x-0 transition-transform duration-500 group-hover:scale-x-100" />

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-lg">
            <Icon className={`text-${color} h-4 w-4`} />
          </div>
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                trend.direction === 'up'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
        <div className="font-heading text-3xl font-bold tracking-tight">{value}</div>
        <div className="text-muted-foreground mt-0.5 text-sm">{label}</div>
        {sublabel && <div className="text-muted-foreground mt-1 text-xs">{sublabel}</div>}
      </div>
    </div>
  );
}

// ─── Security Score Ring ──────────────────────────────────────────────────

function SecurityScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 70 ? 'stroke-green-400' : score >= 40 ? 'stroke-yellow-400' : 'stroke-red-400';

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="130" height="130" className="-rotate-90 transform">
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${color} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-3xl font-bold">{score}</span>
          <span className="text-muted-foreground text-xs">/100</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${score >= 70 ? 'bg-green-400' : score >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
        />
        <span className="text-muted-foreground text-xs font-medium">
          {score >= 70 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'}
        </span>
      </div>
    </div>
  );
}

// ─── Severity Bar ─────────────────────────────────────────────────────────

function SeverityBar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-16 text-right text-xs capitalize">{label}</span>
      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-xs font-semibold tabular-nums">{count}</span>
    </div>
  );
}

// ─── Activity Timeline ────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  switch (type) {
    case 'scan':
      return <Zap className="h-3.5 w-3.5 text-blue-400" />;
    case 'report':
      return <FileText className="h-3.5 w-3.5 text-green-400" />;
    case 'project':
      return <GitBranch className="h-3.5 w-3.5 text-purple-400" />;
    case 'verification':
      return <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />;
  }
}

function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="cyber-card p-8 text-center">
        <Clock className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
        <p className="text-muted-foreground text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="cyber-card p-5">
      <div className="space-y-0">
        {items.map((item, idx) => (
          <div key={item.id} className="relative flex gap-4 pb-4 last:pb-0">
            {/* Timeline line */}
            {idx < items.length - 1 && (
              <div className="bg-border absolute left-[13px] top-6 h-full w-px" />
            )}
            {/* Icon */}
            <div className="bg-accent relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full">
              <ActivityIcon type={item.type} />
            </div>
            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <span className="text-muted-foreground flex-shrink-0 text-xs tabular-nums">
                  {formatDate(item.timestamp)}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { shouldRender } = useAuthGuard();
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shouldRender) return;

    async function loadData() {
      try {
        const [projectsRes, reportsRes] = await Promise.all([
          api.getProjects({ limit: 5 }),
          api.getReports({ limit: 50 }),
        ]);
        setProjects(projectsRes.data);
        setReports(reportsRes.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [shouldRender]);

  // Compute derived stats
  const stats = useMemo(() => {
    const totalContracts = projects.reduce((acc, p) => acc + (p.contracts?.length ?? 0), 0);
    const verifiedReports = reports.filter((r) => r.verifiedOnChain).length;
    const totalScans = reports.length; // approximate: each report comes from a scan

    // Aggregate severity counts from reports
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const report of reports) {
      const findings = report.findings as unknown as Array<{ severity: string }> | undefined;
      if (findings) {
        for (const f of findings) {
          const sev = f.severity as keyof typeof severityCounts;
          if (sev in severityCounts) severityCounts[sev]++;
        }
      }
    }

    // Compute average score from report summaries
    let totalScore = 0;
    let scoreCount = 0;
    for (const report of reports) {
      const summary = report.summary as unknown as { score?: number } | undefined;
      if (summary?.score !== undefined) {
        totalScore += summary.score;
        scoreCount++;
      }
    }
    const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

    const maxSeverity = Math.max(...Object.values(severityCounts), 1);

    return { totalContracts, verifiedReports, totalScans, avgScore, severityCounts, maxSeverity };
  }, [projects, reports]);

  // Build activity feed
  const activityFeed = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    for (const p of projects) {
      items.push({
        id: `p-${p.id}`,
        type: 'project',
        title: `Project created: ${p.name}`,
        description: `Network: ${p.network}`,
        timestamp: p.createdAt,
      });
    }

    for (const r of reports) {
      items.push({
        id: `r-${r.id}`,
        type: 'report',
        title: r.title,
        description: `Status: ${r.status}${r.verifiedOnChain ? ' • Verified on-chain' : ''}`,
        timestamp: r.createdAt,
      });
    }

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 7);
  }, [projects, reports]);

  if (!shouldRender) return null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-8" tabIndex={-1}>
        {/* Header */}
        <div className="animate-fade-in mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold sm:text-3xl">
                Welcome back, {user?.name?.split(' ')[0] ?? 'User'}
              </h1>
              <Sparkles className="text-primary h-5 w-5 animate-pulse" />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Monitor your Soroban smart contract security across all projects
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:gap-3">
            <Link href="/projects" className="w-full sm:w-auto">
              <Button variant="outline" className="min-h-[44px] w-full touch-manipulation">
                <Layers className="mr-2 h-4 w-4" /> All Projects
              </Button>
            </Link>
            <Link href="/projects/new" className="w-full sm:w-auto">
              <Button variant="cyber" className="min-h-[44px] w-full touch-manipulation">
                <Plus className="mr-2 h-4 w-4" /> New Project
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div
            className="flex items-center justify-center py-32"
            role="status"
            aria-label="Loading dashboard"
          >
            <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading dashboard data...</span>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={TrendingUp}
                label="Projects"
                value={projects.length}
                sublabel={`${stats.totalContracts} contract${stats.totalContracts !== 1 ? 's' : ''} tracked`}
              />
              <StatCard
                icon={Scan}
                label="Total Scans"
                value={stats.totalScans}
                sublabel={
                  reports.length > 0 ? `${stats.verifiedReports} verified on-chain` : 'No scans yet'
                }
              />
              <StatCard
                icon={Network}
                label="Network"
                value="Connected"
                sublabel="Stellar Testnet"
              />
              <StatCard
                icon={Shield}
                label="Avg. Security Score"
                value={stats.avgScore || '--'}
                sublabel={stats.avgScore > 0 ? 'Across all reports' : 'No reports yet'}
              />
            </div>

            {/* Main Grid */}
            <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Security Score & Severity */}
              <div className="lg:col-span-1">
                <div className="cyber-card p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="font-heading text-lg font-bold">Security Overview</h2>
                    <BarChart3 className="text-muted-foreground h-4 w-4" />
                  </div>

                  <div className="mb-6 flex justify-center">
                    <SecurityScoreRing score={stats.avgScore} />
                  </div>

                  <div className="space-y-2.5">
                    <SeverityBar
                      label="critical"
                      count={stats.severityCounts.critical}
                      max={stats.maxSeverity}
                      color="bg-red-500"
                    />
                    <SeverityBar
                      label="high"
                      count={stats.severityCounts.high}
                      max={stats.maxSeverity}
                      color="bg-orange-500"
                    />
                    <SeverityBar
                      label="medium"
                      count={stats.severityCounts.medium}
                      max={stats.maxSeverity}
                      color="bg-yellow-500"
                    />
                    <SeverityBar
                      label="low"
                      count={stats.severityCounts.low}
                      max={stats.maxSeverity}
                      color="bg-blue-500"
                    />
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="cyber-card mt-4 p-5">
                  <h3 className="mb-4 text-sm font-semibold">Quick Actions</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <Link href="/projects/new">
                      <Button variant="outline" className="w-full justify-start">
                        <Plus className="mr-2 h-4 w-4" /> New Project
                      </Button>
                    </Link>
                    <Link href="/projects">
                      <Button variant="outline" className="w-full justify-start">
                        <Zap className="mr-2 h-4 w-4" /> Run a Scan
                      </Button>
                    </Link>
                    <Link href="/reports">
                      <Button variant="outline" className="w-full justify-start">
                        <FileText className="mr-2 h-4 w-4" /> View Reports
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Activity Feed */}
              <div className="lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-heading text-lg font-bold">Recent Activity</h2>
                  <span className="text-muted-foreground text-xs">
                    {activityFeed.length} events
                  </span>
                </div>
                <ActivityTimeline items={activityFeed} />
              </div>
            </div>

            {/* Bottom Row: Recent Projects & Reports */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Recent Projects */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-heading text-lg font-bold">Recent Projects</h2>
                  <Link
                    href="/projects"
                    className="text-primary flex items-center gap-1 text-sm hover:underline"
                  >
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {projects.length === 0 ? (
                  <div className="cyber-card p-8 text-center">
                    <AlertTriangle className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
                    <p className="text-muted-foreground mb-4 text-sm">No projects yet</p>
                    <Link href="/projects/new">
                      <Button variant="cyber" size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Create your first project
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => {
                      const contractCount = project.contracts?.length ?? 0;
                      return (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className="cyber-card-hover group flex items-center justify-between p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
                              <GitBranch className="text-primary h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="font-medium">{project.name}</h3>
                              <div className="mt-0.5 flex items-center gap-2">
                                <Badge variant="low" className="text-[10px]">
                                  {project.network}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                  {contractCount} contract{contractCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Reports */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-heading text-lg font-bold">Recent Reports</h2>
                  <Link
                    href="/reports"
                    className="text-primary flex items-center gap-1 text-sm hover:underline"
                  >
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {reports.length === 0 ? (
                  <div className="cyber-card p-8 text-center">
                    <AlertTriangle className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
                    <p className="text-muted-foreground mb-6 text-sm">
                      No reports yet. Run your first scan to generate one.
                    </p>
                    <Link href="/projects">
                      <Button variant="cyber" size="sm">
                        <Zap className="mr-2 h-4 w-4" /> Run a Scan
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reports.slice(0, 5).map((report) => (
                      <Link
                        key={report.id}
                        href={`/reports/${report.id}`}
                        className="cyber-card-hover group p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
                              <FileText className="text-primary h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-medium">{report.title}</h3>
                              <div className="mt-0.5 flex items-center gap-2">
                                <Badge
                                  variant={
                                    report.verifiedOnChain
                                      ? 'low'
                                      : report.status === 'published'
                                        ? 'high'
                                        : 'medium'
                                  }
                                  className="text-[10px]"
                                >
                                  {report.verifiedOnChain
                                    ? 'Verified'
                                    : report.status === 'published'
                                      ? 'Published'
                                      : 'Draft'}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                  {formatDate(report.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="text-muted-foreground mt-2.5 h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
