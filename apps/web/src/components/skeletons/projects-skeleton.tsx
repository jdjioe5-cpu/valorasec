import React from 'react';
import { SkeletonCard } from './skeleton-card';
import { cn } from '@/lib/utils';

export interface ProjectsSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
}

export function ProjectsSkeleton({ count = 6, className, ...props }: ProjectsSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading projects"
      data-testid="projects-skeleton"
      className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3', className)}
      {...props}
    >
      <span className="sr-only">Loading projects...</span>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
