import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function ProjectDetailSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading project details"
      data-testid="project-detail-skeleton"
      className={cn('space-y-8', className)}
      {...props}
    >
      <span className="sr-only">Loading project details...</span>

      {/* Header Area */}
      <div>
        {/* Back Link Placeholder */}
        <Skeleton className="mb-4 h-4 w-32" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {/* Project Name */}
            <Skeleton className="h-9 w-64 sm:w-80" />
            {/* Description */}
            <Skeleton className="h-4 w-80 sm:w-96" />

            {/* Badges / Metadata */}
            <div className="flex items-center gap-3 pt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>

          {/* Action Button Placeholder */}
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>

      {/* Contracts Section */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />

        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cyber-card flex items-center justify-between p-5">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-56 font-mono" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
