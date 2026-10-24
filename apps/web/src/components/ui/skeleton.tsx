import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-muted/60 dark:bg-muted/40 animate-pulse rounded-md', className)}
      {...props}
    />
  );
}
