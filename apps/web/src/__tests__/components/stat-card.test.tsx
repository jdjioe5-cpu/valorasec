import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';

describe('StatCard component', () => {
  it('renders value and label', () => {
    render(<StatCard icon={TrendingUp} label="Total Projects" value="42" />);

    expect(screen.getByTestId('stat-card')).toBeInTheDocument();
    expect(screen.getByTestId('stat-card-value')).toHaveTextContent('42');
    expect(screen.getByTestId('stat-card-label')).toHaveTextContent('Total Projects');
    expect(screen.queryByTestId('stat-card-sublabel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-card-trend')).not.toBeInTheDocument();
  });

  it('renders sublabel when provided', () => {
    render(
      <StatCard
        icon={TrendingUp}
        label="Vulnerabilities"
        value={15}
        sublabel="3 critical findings"
      />,
    );

    expect(screen.getByTestId('stat-card-sublabel')).toHaveTextContent('3 critical findings');
  });

  it('renders upward trend indicator correctly', () => {
    render(
      <StatCard
        icon={TrendingUp}
        label="Audits Completed"
        value="128"
        trend={{ direction: 'up', value: '18%' }}
      />,
    );

    const trend = screen.getByTestId('stat-card-trend');
    expect(trend).toBeInTheDocument();
    expect(trend).toHaveTextContent('↑ 18%');
    expect(trend).toHaveClass('text-green-400');
  });

  it('renders downward trend indicator correctly', () => {
    render(
      <StatCard
        icon={TrendingUp}
        label="Risk Index"
        value="12"
        trend={{ direction: 'down', value: '5%' }}
      />,
    );

    const trend = screen.getByTestId('stat-card-trend');
    expect(trend).toBeInTheDocument();
    expect(trend).toHaveTextContent('↓ 5%');
    expect(trend).toHaveClass('text-red-400');
  });
});
