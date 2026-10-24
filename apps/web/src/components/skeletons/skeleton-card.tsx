import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export function SkeletonCard({ className, lines = 2, ...props }: SkeletonCardProps) {
  return (
    <div data-testid="skeleton-card" className={cn('cyber-card p-6', className)} {...props}>
      <div className="mb-4 flex items-start justify-between">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>

      <div className="mb-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')} />
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
