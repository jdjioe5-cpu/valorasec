import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectsPage from '@/app/projects/page';
import ReportsPage from '@/app/reports/page';
import { api } from '@/lib/api';
import type { Project, Report, ScanSummary } from '@valorasec/shared';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/projects',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/hooks/use-auth-guard', () => ({
  useAuthGuard: () => ({
    shouldRender: true,
    isAuthenticated: true,
    mounted: true,
  }),
}));

vi.mock('@/components/layout/navbar', () => ({
  Navbar: () => <nav data-testid="mock-navbar">Navbar</nav>,
}));

vi.mock('@/lib/api', () => ({
  api: {
    getProjects: vi.fn(),
    getReports: vi.fn(),
  },
}));

const mockSummary: ScanSummary = {
  totalFindings: 0,
  bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  score: 100,
  linesAnalyzed: 50,
  rulesExecuted: 5,
};

const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Soroban DEX Pool',
    description: 'Automated market maker protocol on Stellar Soroban',
    network: 'testnet',
    userId: 'u1',
    contracts: [
      {
        id: 'c1',
        projectId: 'p1',
        name: 'Pool',
        address: 'addr1',
        network: 'testnet',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'p2',
    name: 'Lending Protocol',
    description: 'Collateralized debt positions on Soroban',
    network: 'mainnet',
    userId: 'u1',
    contracts: [],
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
  },
];

const mockReports: Report[] = [
  {
    id: 'r1',
    scanId: 's1',
    projectId: 'p1',
    contractId: 'c1',
    userId: 'u1',
    title: 'Soroban DEX Pool Audit',
    status: 'published',
    findings: [],
    summary: mockSummary,
    verifiedOnChain: false,
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05',
  },
  {
    id: 'r2',
    scanId: 's2',
    projectId: 'p2',
    contractId: 'c2',
    userId: 'u1',
    title: 'Lending Protocol Verification',
    status: 'verified',
    findings: [],
    summary: mockSummary,
    verifiedOnChain: true,
    createdAt: '2026-01-06',
    updatedAt: '2026-01-06',
  },
];

describe('Search and Filter Components Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProjectsPage Integration', () => {
    it('renders project cards and filters by network dropdown', async () => {
      vi.mocked(api.getProjects).mockResolvedValue({
        data: mockProjects,
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool')).toBeInTheDocument();
        expect(screen.getByText('Lending Protocol')).toBeInTheDocument();
      });

      // Select 'testnet' network filter
      const networkSelect = screen.getByTestId('network-filter');
      fireEvent.change(networkSelect, { target: { value: 'testnet' } });

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool')).toBeInTheDocument();
        expect(screen.queryByText('Lending Protocol')).not.toBeInTheDocument();
        expect(screen.getByTestId('active-filter-badge')).toHaveTextContent('1 active');
      });

      // Clear filters
      const clearBtn = screen.getByTestId('clear-filters-btn');
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool')).toBeInTheDocument();
        expect(screen.getByText('Lending Protocol')).toBeInTheDocument();
        expect(screen.queryByTestId('active-filter-badge')).not.toBeInTheDocument();
      });
    });

    it('shows filter empty state when search finds no matching project', async () => {
      vi.mocked(api.getProjects).mockResolvedValue({
        data: mockProjects,
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('projects-search-input');
      fireEvent.change(searchInput, { target: { value: 'NonexistentProject' } });

      // Wait 350ms for debounce wrapped in act
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });

      await waitFor(() => {
        expect(screen.getByTestId('filtered-empty-state')).toBeInTheDocument();
        expect(screen.getByText('No results matching your filters')).toBeInTheDocument();
      });

      // Clear filters button in empty state
      const clearEmptyBtn = screen.getByTestId('clear-filters-empty-btn');
      fireEvent.click(clearEmptyBtn);

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool')).toBeInTheDocument();
      });
    });
  });

  describe('ReportsPage Integration', () => {
    it('renders reports and filters by status and project dropdowns', async () => {
      vi.mocked(api.getReports).mockResolvedValue({
        data: mockReports,
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      });
      vi.mocked(api.getProjects).mockResolvedValue({
        data: mockProjects,
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      render(<ReportsPage />);

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool Audit')).toBeInTheDocument();
        expect(screen.getByText('Lending Protocol Verification')).toBeInTheDocument();
      });

      // Filter by 'verified' status
      const statusSelect = screen.getByTestId('status-filter');
      fireEvent.change(statusSelect, { target: { value: 'verified' } });

      await waitFor(() => {
        expect(screen.queryByText('Soroban DEX Pool Audit')).not.toBeInTheDocument();
        expect(screen.getByText('Lending Protocol Verification')).toBeInTheDocument();
        expect(screen.getByTestId('active-filter-badge')).toHaveTextContent('1 active');
      });

      // Filter by project
      const projectSelect = screen.getByTestId('project-filter');
      fireEvent.change(projectSelect, { target: { value: 'p2' } });

      await waitFor(() => {
        expect(screen.getByTestId('active-filter-badge')).toHaveTextContent('2 active');
      });

      // Clear filters
      const clearBtn = screen.getByTestId('clear-filters-btn');
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool Audit')).toBeInTheDocument();
        expect(screen.getByText('Lending Protocol Verification')).toBeInTheDocument();
        expect(screen.queryByTestId('active-filter-badge')).not.toBeInTheDocument();
      });
    });

    it('filters reports by search query with debouncing', async () => {
      vi.mocked(api.getReports).mockResolvedValue({
        data: mockReports,
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      });
      vi.mocked(api.getProjects).mockResolvedValue({
        data: mockProjects,
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      render(<ReportsPage />);

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool Audit')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('reports-search-input');
      fireEvent.change(searchInput, { target: { value: 'DEX Pool' } });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });

      await waitFor(() => {
        expect(screen.getByText('Soroban DEX Pool Audit')).toBeInTheDocument();
        expect(screen.queryByText('Lending Protocol Verification')).not.toBeInTheDocument();
        expect(screen.getByTestId('active-filter-badge')).toHaveTextContent('1 active');
      });
    });
  });
});
