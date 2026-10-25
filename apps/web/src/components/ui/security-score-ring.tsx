import React from 'react';
import { cn } from '@/lib/utils';

export interface SecurityScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export function SecurityScoreRing({
  score,
  size = 'md',
  className,
  showLabel = true,
}: SecurityScoreRingProps) {
  const dimensions = {
    sm: { size: 90, radius: 36, stroke: 6, text: 'text-xl' },
    md: { size: 130, radius: 54, stroke: 8, text: 'text-3xl' },
    lg: { size: 160, radius: 68, stroke: 10, text: 'text-4xl' },
  }[size];

  const circumference = 2 * Math.PI * dimensions.radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const color =
    score >= 70
      ? 'stroke-green-500 text-green-500'
      : score >= 40
        ? 'stroke-yellow-500 text-yellow-500'
        : 'stroke-red-500 text-red-500';

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="relative flex items-center justify-center">
        <svg
          width={dimensions.size}
          height={dimensions.size}
          className="-rotate-90 transform"
          role="img"
          aria-label={`Security Score: ${score} out of 100`}
        >
          <circle
            cx={dimensions.size / 2}
            cy={dimensions.size / 2}
            r={dimensions.radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={dimensions.stroke}
          />
          <circle
            cx={dimensions.size / 2}
            cy={dimensions.size / 2}
            r={dimensions.radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={dimensions.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(color, 'transition-all duration-1000 ease-out')}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={cn('font-heading font-bold leading-none', dimensions.text)}>
            {score}
          </span>
          {showLabel && <span className="text-muted-foreground mt-0.5 text-xs">/100</span>}
        </div>
      </div>
    </div>
  );
}
