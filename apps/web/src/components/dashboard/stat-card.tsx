import React from 'react';

export interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: { direction: 'up' | 'down'; value: string };
  color?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  trend,
  color = 'primary',
}: StatCardProps) {
  return (
    <div
      data-testid="stat-card"
      className="cyber-card group relative overflow-hidden p-6 transition-all duration-300 hover:shadow-[0_0_40px_rgba(34,197,94,0.08)]"
    >
      {/* Hover accent bar */}
      <div className="bg-primary/20 absolute -inset-x-4 -top-px h-px scale-x-0 transition-transform duration-500 group-hover:scale-x-100" />

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-lg">
            <Icon className={`text-${color} h-4 w-4`} />
          </div>
          {trend && (
            <span
              data-testid="stat-card-trend"
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                trend.direction === 'up'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
        <div
          data-testid="stat-card-value"
          className="font-heading text-3xl font-bold tracking-tight"
        >
          {value}
        </div>
        <div data-testid="stat-card-label" className="text-muted-foreground mt-0.5 text-sm">
          {label}
        </div>
        {sublabel && (
          <div data-testid="stat-card-sublabel" className="text-muted-foreground mt-1 text-xs">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
