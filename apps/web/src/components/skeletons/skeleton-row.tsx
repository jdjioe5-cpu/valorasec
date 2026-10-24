import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface SkeletonRowProps extends React.HTMLAttributes<HTMLDivElement> {
  hasBadge?: boolean;
}

export function SkeletonRow({ className, hasBadge = true, ...props }: SkeletonRowProps) {
  return (
    <div
      data-testid="skeleton-row"
      className={cn('cyber-card flex items-center justify-between p-5', className)}
      {...props}
    >
      <div className="flex items-center gap-4">
        {/* Left icon box placeholder */}
        <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />

        <div className="space-y-2">
          {/* Title placeholder */}
          <Skeleton className="h-5 w-44 sm:w-64" />

          {/* Subtitle / badge info placeholders */}
          <div className="flex items-center gap-2">
            {hasBadge && <Skeleton className="h-5 w-16 rounded-full" />}
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>

      {/* Right action indicator */}
      <Skeleton className="h-4 w-4 rounded-full" />
    </div>
  );
}
