'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Report, Finding } from '@valorasec/shared';
import { ScoreBreakdownCard } from '@/components/reports/score-breakdown-card';

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { shouldRender } = useAuthGuard();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!shouldRender) return;
    api
      .getReport(reportId)
      .then((res) => setReport(res.data))
      .catch(() => router.push('/reports'))
      .finally(() => setLoading(false));
  }, [reportId, shouldRender, router]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const res = await api.registerOnChain(reportId);
      setReport(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setRegistering(false);
    }
  };

  if (!shouldRender || loading || !report) {
    return (
      <div className="bg-background min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const findings = (report.findings as unknown as Finding[] | undefined) ?? [];
  const summary = report.summary as unknown as Record<string, unknown> | null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/reports"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Reports
        </Link>

        <div className="animate-fade-in mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-heading mb-2 text-3xl font-bold">{report.title}</h1>
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              <span>{formatDate(report.createdAt)}</span>
              {report.verifiedOnChain && (
                <Badge variant="low">
                  <ShieldCheck className="mr-1 h-3 w-3" /> On-Chain Verified
                </Badge>
              )}
            </div>
          </div>
          {!report.verifiedOnChain && (
            <Button variant="cyber" onClick={handleRegister} disabled={registering}>
              {registering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Register On-Chain
            </Button>
          )}
        </div>

        {/* Summary Card */}
        {summary && (
          <div className="cyber-card mb-8 p-6">
            <h2 className="font-heading mb-4 text-lg font-bold">Scan Summary</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {Object.entries(summary).map(([key, val]) =>
                key !== 'bySeverity' ? (
                  <div key={key}>
                    <div className="text-muted-foreground mb-1 text-sm capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-xl font-bold">{String(val)}</div>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}

        {/* Score Breakdown Analysis */}
        <div className="mb-8">
          <ScoreBreakdownCard
            score={report.summary?.score ?? 100}
            breakdown={report.summary?.breakdown}
            findings={findings}
            linesAnalyzed={report.summary?.linesAnalyzed ?? 100}
          />
        </div>

        {/* Findings */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="text-warning h-5 w-5" />
            <h2 className="font-heading text-lg font-bold">Findings ({findings.length})</h2>
          </div>

          {findings.length === 0 ? (
            <div className="cyber-card p-8 text-center">
              <ShieldCheck className="text-primary mx-auto mb-3 h-8 w-8" />
              <p className="text-muted-foreground">No issues found. Your contract looks secure!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((finding) => (
                <div key={finding.id} className="cyber-card p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <h3 className="font-semibold">{finding.title}</h3>
                    <Badge variant={finding.severity as 'critical' | 'high' | 'medium' | 'low'}>
                      {finding.severity}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-3 text-sm">{finding.description}</p>
                  {finding.location && (
                    <div className="text-muted-foreground mb-2 font-mono text-xs">
                      📍 {finding.location.file}:{finding.location.line}
                    </div>
                  )}
                  <div className="bg-accent/30 border-border/30 rounded-md border p-3">
                    <p className="text-sm">
                      <span className="text-primary font-semibold">Recommendation:</span>{' '}
                      {finding.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction */}
        {report.transactionHash && (
          <div className="cyber-card mt-8 p-4">
            <h3 className="mb-2 text-sm font-semibold">Stellar Transaction</h3>
            <code className="text-muted-foreground break-all font-mono text-xs">
              {report.transactionHash}
            </code>
          </div>
        )}
      </main>
    </div>
  );
}
