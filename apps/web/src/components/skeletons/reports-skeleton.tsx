import React from 'react';
import { SkeletonRow } from './skeleton-row';
import { cn } from '@/lib/utils';

export interface ReportsSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
}

export function ReportsSkeleton({ count = 8, className, ...props }: ReportsSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading reports"
      data-testid="reports-skeleton"
      className={cn('space-y-3', className)}
      {...props}
    >
      <span className="sr-only">Loading reports...</span>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}
