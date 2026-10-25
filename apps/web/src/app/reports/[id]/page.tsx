'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Share2,
  Printer,
  Check,
  ExternalLink,
  Layers,
  FileCode2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { SecurityScoreRing } from '@/components/ui/security-score-ring';
import { FindingsGroupedList } from '@/components/reports/findings-grouped-list';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Report, Finding } from '@valorasec/shared';

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { shouldRender } = useAuthGuard();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shouldRender) return;
    api
      .getReport(reportId)
      .then((res) => setReport(res.data))
      .catch(() => router.push('/reports'))
      .finally(() => setLoading(false));
  }, [reportId, shouldRender]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const res = await api.registerOnChain(reportId);
      const updated = res?.data ?? res;
      setReport(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setRegistering(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const findings = useMemo(() => {
    return (report?.findings as unknown as Finding[] | undefined) ?? [];
  }, [report]);

  const score = useMemo(() => {
    if (report?.summary?.score !== undefined) {
      return report.summary.score;
    }
    // Fallback simple calculation
    let calc = 100;
    for (const f of findings) {
      if (f.severity === 'critical') calc -= 25;
      else if (f.severity === 'high') calc -= 15;
      else if (f.severity === 'medium') calc -= 5;
      else if (f.severity === 'low') calc -= 2;
    }
    return Math.max(0, calc);
  }, [report, findings]);

  if (!shouldRender || loading || !report) {
    return (
      <div className="bg-background min-h-screen">
        <Navbar />
        <div
          className="flex items-center justify-center py-32"
          role="status"
          aria-label="Loading report"
        >
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <span className="sr-only">Loading report details...</span>
        </div>
      </div>
    );
  }

  const explorerUrl = report.transactionHash
    ? `https://stellar.expert/explorer/testnet/tx/${report.transactionHash}`
    : null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-8" tabIndex={-1}>
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link
            href="/reports"
            className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Reports
          </Link>

          {/* Action Bar */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              data-testid="share-report-btn"
              className="text-xs"
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" /> Copied!
                </>
              ) : (
                <>
                  <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share Report
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              data-testid="print-report-btn"
              className="text-xs"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Hero Header Card */}
        <div className="cyber-card mb-8 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant={report.verifiedOnChain ? 'low' : 'medium'}>
                  {report.verifiedOnChain ? (
                    <>
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" /> On-Chain Verified
                    </>
                  ) : (
                    report.status
                  )}
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(report.createdAt)}
                </span>
                {report.contractId && (
                  <span className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
                    <FileCode2 className="h-3.5 w-3.5" />
                    Contract: {report.contractId}
                  </span>
                )}
              </div>

              <h1
                data-testid="report-title"
                className="font-heading text-2xl font-bold md:text-3xl"
              >
                {report.title}
              </h1>

              <p className="text-muted-foreground max-w-2xl text-sm">
                Comprehensive security audit and vulnerability assessment conducted by ValoraSec
                Soroban analyzer.
              </p>

              {/* On-Chain Registration Action & Proof */}
              <div className="pt-2">
                {!report.verifiedOnChain ? (
                  <Button
                    variant="cyber"
                    onClick={handleRegister}
                    disabled={registering}
                    data-testid="register-onchain-btn"
                  >
                    {registering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {registering ? 'Registering on Stellar...' : 'Register On-Chain'}
                  </Button>
                ) : (
                  explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="stellar-tx-link"
                      className="text-primary bg-primary/10 border-primary/20 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs hover:underline"
                    >
                      <ShieldCheck className="text-primary h-4 w-4" />
                      <span>Stellar Tx: {report.transactionHash?.slice(0, 16)}...</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )
                )}
              </div>
            </div>

            {/* Score Ring Section */}
            <div className="border-border/50 bg-background/50 flex flex-shrink-0 flex-col items-center justify-center rounded-lg border p-6 text-center">
              <SecurityScoreRing score={score} size="md" />
              <div className="text-muted-foreground mt-2 text-xs font-semibold uppercase tracking-wider">
                Security Score
              </div>
            </div>
          </div>
        </div>

        {/* Summary Metric Cards */}
        {report.summary && (
          <div data-testid="scan-summary-card" className="cyber-card mb-8 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Layers className="text-primary h-5 w-5" />
              <h2 className="font-heading text-lg font-bold">Audit Overview</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="bg-accent/30 rounded-lg p-3 text-center">
                <div className="text-muted-foreground text-xs font-medium">Findings Detected</div>
                <div
                  data-testid="summary-total-findings"
                  className="font-heading mt-1 text-2xl font-bold"
                >
                  {report.summary.totalFindings ?? findings.length}
                </div>
              </div>
              <div className="bg-accent/30 rounded-lg p-3 text-center">
                <div className="text-muted-foreground text-xs font-medium">Rules Executed</div>
                <div className="font-heading mt-1 text-2xl font-bold">
                  {report.summary.rulesExecuted ?? 13}
                </div>
              </div>
              <div className="bg-accent/30 rounded-lg p-3 text-center">
                <div className="text-muted-foreground text-xs font-medium">Lines Analyzed</div>
                <div className="font-heading mt-1 text-2xl font-bold">
                  {report.summary.linesAnalyzed ?? 0}
                </div>
              </div>
              <div className="bg-accent/30 rounded-lg p-3 text-center">
                <div className="text-muted-foreground text-xs font-medium">Verification Status</div>
                <div className="font-heading text-primary mt-1 text-sm font-semibold capitalize">
                  {report.verifiedOnChain ? 'Verified' : report.status}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Findings Section */}
        <div>
          <h2 className="font-heading mb-4 text-xl font-bold">Vulnerability Findings</h2>
          <FindingsGroupedList findings={findings} />
        </div>
      </main>
    </div>
  );
}
