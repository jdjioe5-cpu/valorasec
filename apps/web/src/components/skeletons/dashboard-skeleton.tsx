import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function DashboardSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      data-testid="dashboard-skeleton"
      className={cn('space-y-8', className)}
      {...props}
    >
      <span className="sr-only">Loading dashboard data...</span>

      {/* 4 Stat Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="cyber-card p-6">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="mb-2 h-8 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>

      {/* Two Column Layout (Quick Actions + Security Score vs Recent Activity) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column (1 / 3) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Security Score Ring Card */}
          <div className="cyber-card flex flex-col items-center justify-center p-6 text-center">
            <Skeleton className="mb-4 h-6 w-36" />
            <Skeleton className="mb-4 h-32 w-32 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>

          {/* Quick Actions Card */}
          <div className="cyber-card space-y-3 p-6">
            <Skeleton className="mb-4 h-5 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>

        {/* Right Column (2 / 3) */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Activity List Placeholders */}
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="cyber-card flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
