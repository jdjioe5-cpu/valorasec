'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { ReportsSkeleton } from '@/components/skeletons/reports-skeleton';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Report } from '@valorasec/shared';

export default function ReportsPage() {
  const { shouldRender } = useAuthGuard();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shouldRender) return;
    api
      .getReports({ limit: 50 })
      .then((res) => setReports(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-8" tabIndex={-1}>
        <div className="animate-fade-in">
          <h1 className="font-heading mb-2 text-3xl font-bold">Audit Reports</h1>
          <p className="text-muted-foreground mb-8">View and manage your security audit reports</p>
        </div>

        {loading ? (
          <ReportsSkeleton />
        ) : reports.length === 0 ? (
          <div className="cyber-card p-12 text-center">
            <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
            <h3 className="mb-2 text-lg font-semibold">No reports yet</h3>
            <p className="text-muted-foreground mb-6">
              Run a security scan on one of your contracts to generate your first report.
            </p>
            <Link href="/projects">
              <Button variant="cyber">
                <ArrowRight className="mr-2 h-4 w-4" /> Go to Projects
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="cyber-card-hover flex items-center justify-between p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                    <FileText className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{report.title}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={report.verifiedOnChain ? 'low' : 'medium'}>
                        {report.verifiedOnChain ? (
                          <>
                            <ShieldCheck className="mr-1 h-3 w-3" /> Verified
                          </>
                        ) : (
                          report.status
                        )}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
