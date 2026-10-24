import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';

describe('Dashboard Loading & Empty States', () => {
  describe('DashboardSkeleton', () => {
    it('renders skeleton loading structure with accessibility status', () => {
      render(<DashboardSkeleton />);

      const skeletonContainer = screen.getByTestId('dashboard-loading-skeleton');
      expect(skeletonContainer).toBeInTheDocument();
      expect(skeletonContainer).toHaveAttribute('role', 'status');
      expect(skeletonContainer).toHaveAttribute('aria-label', 'Loading dashboard');

      expect(screen.getByTestId('skeleton-stats-row')).toBeInTheDocument();
      const statCards = screen.getAllByTestId('skeleton-stat-card');
      expect(statCards).toHaveLength(4);

      expect(screen.getByTestId('skeleton-charts-row')).toBeInTheDocument();
      expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();
    });
  });

  describe('DashboardEmptyState', () => {
    it('renders empty state message and call to action button', () => {
      render(<DashboardEmptyState />);

      expect(screen.getByTestId('dashboard-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No projects yet')).toBeInTheDocument();

      const ctaButton = screen.getByTestId('create-project-cta');
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton).toHaveTextContent('Create your first project');

      const link = screen.getByRole('link', { name: /create your first project/i });
      expect(link).toHaveAttribute('href', '/projects/new');
    });
  });
});
