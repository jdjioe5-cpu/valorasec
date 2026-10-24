import React from 'react';

export interface SecurityScoreRingProps {
  score: number;
}

export function SecurityScoreRing({ score }: SecurityScoreRingProps) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 70 ? 'stroke-green-400' : score >= 40 ? 'stroke-yellow-400' : 'stroke-red-400';

  const dotColor = score >= 70 ? 'bg-green-400' : score >= 40 ? 'bg-yellow-400' : 'bg-red-400';

  const label = score >= 70 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';

  return (
    <div data-testid="security-score-ring" className="flex flex-col items-center">
      <div className="relative">
        <svg width="130" height="130" className="-rotate-90 transform">
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <circle
            data-testid="score-ring-circle"
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${color} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span data-testid="score-value" className="font-heading text-3xl font-bold">
            {score}
          </span>
          <span className="text-muted-foreground text-xs">/100</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div data-testid="score-status-dot" className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span
          data-testid="score-status-label"
          className="text-muted-foreground text-xs font-medium"
        >
          {label}
        </span>
      </div>
    </div>
  );
}
