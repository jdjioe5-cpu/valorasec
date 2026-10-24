import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function ReportDetailSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading report details"
      data-testid="report-detail-skeleton"
      className={cn('space-y-8', className)}
      {...props}
    >
      <span className="sr-only">Loading report details...</span>

      {/* Back Link Placeholder */}
      <Skeleton className="h-4 w-32" />

      {/* Header Area */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* Report Title */}
          <Skeleton className="h-9 w-72 sm:w-96" />
          {/* Metadata */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>

        {/* Action Button Placeholder */}
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>

      {/* Summary Card */}
      <div className="cyber-card p-6">
        <Skeleton className="mb-4 h-6 w-36" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Findings Section */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />

        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cyber-card space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
