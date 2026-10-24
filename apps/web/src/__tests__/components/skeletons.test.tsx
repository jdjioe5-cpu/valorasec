import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SkeletonCard,
  SkeletonRow,
  DashboardSkeleton,
  ProjectsSkeleton,
  ReportsSkeleton,
  ProjectDetailSkeleton,
  ReportDetailSkeleton,
} from '@/components/skeletons';

describe('Skeleton Components Suite', () => {
  describe('Base Skeleton Component', () => {
    it('renders with default animate-pulse and bg-muted styling', () => {
      render(<Skeleton data-testid="base-skeleton" />);
      const el = screen.getByTestId('base-skeleton');
      expect(el).toBeInTheDocument();
      expect(el).toHaveClass('animate-pulse');
      expect(el).toHaveClass('rounded-md');
    });

    it('merges custom className properly', () => {
      render(<Skeleton data-testid="custom-skeleton" className="h-10 w-40 rounded-full" />);
      const el = screen.getByTestId('custom-skeleton');
      expect(el).toHaveClass('h-10');
      expect(el).toHaveClass('w-40');
      expect(el).toHaveClass('rounded-full');
      expect(el).toHaveClass('animate-pulse');
    });
  });

  describe('SkeletonCard', () => {
    it('renders card skeleton with default 2 description lines', () => {
      render(<SkeletonCard />);
      const card = screen.getByTestId('skeleton-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('cyber-card');

      // Card should contain pulse elements for title, indicator, lines, and badges
      const pulseElements = card.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThanOrEqual(4);
    });

    it('customizes description lines count when requested', () => {
      const { rerender } = render(<SkeletonCard lines={4} />);
      const card = screen.getByTestId('skeleton-card');
      // Title (1) + Indicator (1) + Lines (4) + Badge (1) + Meta (1) = 8
      const pulses = card.querySelectorAll('.animate-pulse');
      expect(pulses.length).toBe(8);

      rerender(<SkeletonCard lines={1} />);
      const card1 = screen.getByTestId('skeleton-card');
      const pulses1 = card1.querySelectorAll('.animate-pulse');
      expect(pulses1.length).toBe(5);
    });
  });

  describe('SkeletonRow', () => {
    it('renders list row skeleton with icon and badge placeholders', () => {
      render(<SkeletonRow />);
      const row = screen.getByTestId('skeleton-row');
      expect(row).toBeInTheDocument();
      expect(row).toHaveClass('cyber-card');

      const pulses = row.querySelectorAll('.animate-pulse');
      // Icon (1) + Title (1) + Badge (1) + Subtitle (1) + Right Icon (1) = 5
      expect(pulses.length).toBe(5);
    });

    it('omits badge when hasBadge is false', () => {
      render(<SkeletonRow hasBadge={false} />);
      const row = screen.getByTestId('skeleton-row');
      const pulses = row.querySelectorAll('.animate-pulse');
      expect(pulses.length).toBe(4);
    });
  });

  describe('DashboardSkeleton', () => {
    it('renders with accessibility status attributes and matching dashboard layout', () => {
      render(<DashboardSkeleton />);
      const dashboard = screen.getByRole('status', { name: 'Loading dashboard' });
      expect(dashboard).toBeInTheDocument();
      expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();

      // Should have 4 stat cards in top grid
      const statCards = dashboard.querySelectorAll('.grid-cols-1 > .cyber-card');
      expect(statCards.length).toBe(4);

      // Should have left column (score ring + quick actions) and right column (recent activity)
      const activityPlaceholders = dashboard.querySelectorAll('.space-y-3 > .cyber-card');
      expect(activityPlaceholders.length).toBe(4);
    });
  });

  describe('ProjectsSkeleton', () => {
    it('renders grid with accessible status and 6 default card placeholders', () => {
      render(<ProjectsSkeleton />);
      const container = screen.getByRole('status', { name: 'Loading projects' });
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('grid-cols-1 md:grid-cols-2 lg:grid-cols-3');

      const cards = screen.getAllByTestId('skeleton-card');
      expect(cards.length).toBe(6);
    });

    it('supports custom card count prop', () => {
      render(<ProjectsSkeleton count={3} />);
      const cards = screen.getAllByTestId('skeleton-card');
      expect(cards.length).toBe(3);
    });
  });

  describe('ReportsSkeleton', () => {
    it('renders list with accessible status and 8 default row placeholders', () => {
      render(<ReportsSkeleton />);
      const container = screen.getByRole('status', { name: 'Loading reports' });
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('space-y-3');

      const rows = screen.getAllByTestId('skeleton-row');
      expect(rows.length).toBe(8);
    });

    it('supports custom row count prop', () => {
      render(<ReportsSkeleton count={4} />);
      const rows = screen.getAllByTestId('skeleton-row');
      expect(rows.length).toBe(4);
    });
  });

  describe('ProjectDetailSkeleton', () => {
    it('renders project detail skeleton matching page layout', () => {
      render(<ProjectDetailSkeleton />);
      const container = screen.getByRole('status', { name: 'Loading project details' });
      expect(container).toBeInTheDocument();

      // Has 3 contract rows placeholders
      const contractRows = container.querySelectorAll('.space-y-3 > .cyber-card');
      expect(contractRows.length).toBe(3);
    });
  });

  describe('ReportDetailSkeleton', () => {
    it('renders report detail skeleton matching report summary and findings layout', () => {
      render(<ReportDetailSkeleton />);
      const container = screen.getByRole('status', { name: 'Loading report details' });
      expect(container).toBeInTheDocument();

      // Has 5 summary metric columns
      const summaryMetrics = container.querySelectorAll('.md\\:grid-cols-5 > div');
      expect(summaryMetrics.length).toBe(5);

      // Has 3 findings placeholders
      const findings = container.querySelectorAll('.space-y-3 > .cyber-card');
      expect(findings.length).toBe(3);
    });
  });
});
