import React from 'react';

export function DashboardSkeleton() {
  return (
    <div
      data-testid="dashboard-loading-skeleton"
      className="animate-pulse space-y-8"
      role="status"
      aria-label="Loading dashboard"
    >
      {/* Stats Row Skeleton */}
      <div
        data-testid="skeleton-stats-row"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            data-testid="skeleton-stat-card"
            className="cyber-card bg-muted/40 h-32 rounded-lg p-6"
          />
        ))}
      </div>
      {/* Charts Row Skeleton */}
      <div data-testid="skeleton-charts-row" className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="cyber-card bg-muted/40 h-80 rounded-lg p-6 lg:col-span-1" />
        <div className="cyber-card bg-muted/40 h-80 rounded-lg p-6 lg:col-span-2" />
      </div>
      <span className="sr-only">Loading dashboard data...</span>
    </div>
  );
}
