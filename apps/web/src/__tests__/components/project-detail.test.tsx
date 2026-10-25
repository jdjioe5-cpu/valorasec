import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectDetailPage from '@/app/projects/[id]/page';
import { api } from '@/lib/api';
import type { Project, ScanResult } from '@valorasec/shared';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'proj-123' }),
  useRouter: () => mockRouter,
  usePathname: () => '/projects/proj-123',
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
    getProject: vi.fn(),
    getScanHistory: vi.fn(),
    createContract: vi.fn(),
    runScan: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

const mockProjectData: Project = {
  id: 'proj-123',
  userId: 'user-1',
  name: 'Yield Optimizer Protocol',
  description: 'Automated yield routing smart contracts on Soroban.',
  network: 'testnet',
  contracts: [
    {
      id: 'c-1',
      projectId: 'proj-123',
      name: 'VaultRegistry',
      address: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      network: 'testnet',
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
    },
  ],
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
};

const mockExistingScan: ScanResult = {
  id: 'scan-init',
  projectId: 'proj-123',
  contractId: 'c-1',
  status: 'completed',
  findings: [],
  summary: {
    totalFindings: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    score: 100,
    linesAnalyzed: 180,
    rulesExecuted: 14,
  },
  startedAt: '2026-01-02T10:00:00Z',
  completedAt: '2026-01-02T10:00:02Z',
  duration: 2,
};

describe('ProjectDetailPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders breadcrumb, project details, contract cards, and timeline', async () => {
    vi.mocked(api.getProject).mockResolvedValue({
      data: mockProjectData,
    });
    vi.mocked(api.getScanHistory).mockResolvedValue({
      data: [mockExistingScan],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    render(<ProjectDetailPage />);

    await waitFor(() => {
      // Breadcrumb
      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(breadcrumb).toBeInTheDocument();
      expect(breadcrumb).toHaveTextContent('Yield Optimizer Protocol');

      // Title & Description
      expect(screen.getByTestId('project-title')).toHaveTextContent('Yield Optimizer Protocol');
      expect(screen.getByTestId('project-description')).toHaveTextContent(
        'Automated yield routing smart contracts on Soroban.',
      );
      // Contract card
      const contractCard = screen.getByTestId('contract-card-c-1');
      expect(contractCard).toBeInTheDocument();
      expect(contractCard).toHaveTextContent('VaultRegistry');
      // Timeline item
      const timelineItem = screen.getByTestId('timeline-item-scan-init');
      expect(timelineItem).toBeInTheDocument();
      expect(timelineItem).toHaveTextContent('VaultRegistry');
    });
  });

  it('supports inline editing of project name and description', async () => {
    vi.mocked(api.getProject).mockResolvedValue({
      data: mockProjectData,
    });
    vi.mocked(api.getScanHistory).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
    vi.mocked(api.updateProject).mockResolvedValue({
      data: {
        ...mockProjectData,
        name: 'Yield Optimizer V2',
        description: 'Updated description for multi-vault routing.',
      },
    });

    render(<ProjectDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-project-btn')).toBeInTheDocument();
    });

    // Enter inline edit mode
    fireEvent.click(screen.getByTestId('edit-project-btn'));
    expect(screen.getByTestId('edit-project-name-input')).toBeInTheDocument();

    // Modify values
    fireEvent.change(screen.getByTestId('edit-project-name-input'), {
      target: { value: 'Yield Optimizer V2' },
    });
    fireEvent.change(screen.getByTestId('edit-project-desc-input'), {
      target: { value: 'Updated description for multi-vault routing.' },
    });

    // Save
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-project-btn'));
    });

    await waitFor(() => {
      expect(api.updateProject).toHaveBeenCalledWith('proj-123', {
        name: 'Yield Optimizer V2',
        description: 'Updated description for multi-vault routing.',
      });
      expect(screen.getByTestId('project-title')).toHaveTextContent('Yield Optimizer V2');
      expect(screen.getByTestId('project-description')).toHaveTextContent(
        'Updated description for multi-vault routing.',
      );
    });
  });

  it('triggers Run Scan on a contract and prepends scan to timeline', async () => {
    vi.mocked(api.getProject).mockResolvedValue({
      data: mockProjectData,
    });
    vi.mocked(api.getScanHistory).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    const newScanResult: ScanResult = {
      id: 'scan-live-999',
      projectId: 'proj-123',
      contractId: 'c-1',
      status: 'completed',
      findings: [],
      summary: {
        totalFindings: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        score: 92,
        linesAnalyzed: 220,
        rulesExecuted: 14,
      },
      startedAt: '2026-02-10T12:00:00Z',
      duration: 3,
    };

    vi.mocked(api.runScan).mockResolvedValue({
      data: newScanResult,
    });

    render(<ProjectDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('run-scan-btn-c-1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('run-scan-btn-c-1'));
    });

    await waitFor(() => {
      expect(api.runScan).toHaveBeenCalledWith('proj-123', 'c-1');
      expect(screen.getByTestId('live-scan-result-banner')).toBeInTheDocument();
      expect(screen.getByText('Security Score: 92/100')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-item-scan-live-999')).toBeInTheDocument();
    });
  });

  it('handles delete project flow with confirmation modal', async () => {
    vi.mocked(api.getProject).mockResolvedValue({
      data: mockProjectData,
    });
    vi.mocked(api.getScanHistory).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
    vi.mocked(api.deleteProject).mockResolvedValue(undefined as unknown as void);

    render(<ProjectDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-project-btn')).toBeInTheDocument();
    });

    // Click Delete Project to open modal
    fireEvent.click(screen.getByTestId('delete-project-btn'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();

    // Confirm deletion
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    });

    await waitFor(() => {
      expect(api.deleteProject).toHaveBeenCalledWith('proj-123');
      expect(mockPush).toHaveBeenCalledWith('/projects');
    });
  });
});
