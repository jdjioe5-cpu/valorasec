import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportDetailPage from '@/app/reports/[id]/page';
import { api } from '@/lib/api';
import type { Report } from '@valorasec/shared';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'rep-123' }),
  useRouter: () => mockRouter,
  usePathname: () => '/reports/rep-123',
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
    getReport: vi.fn(),
    registerOnChain: vi.fn(),
  },
}));

const mockReportData: Report = {
  id: 'rep-123',
  scanId: 'scan-abc',
  projectId: 'proj-xyz',
  contractId: 'C_VAULT_CONTRACT_01',
  userId: 'user-1',
  title: 'DeFi Vault Core Contract Audit',
  status: 'published',
  findings: [
    {
      id: 'f-1',
      ruleId: 'R009',
      title: 'Missing Authorization Check',
      description: 'The contract function lacks require_auth invocation.',
      severity: 'critical',
      location: { file: 'src/lib.rs', line: 55 },
      recommendation: 'Add require_auth() at start of handler.',
    },
  ],
  summary: {
    totalFindings: 1,
    bySeverity: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
    score: 75,
    linesAnalyzed: 140,
    rulesExecuted: 13,
  },
  verifiedOnChain: false,
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
};

describe('ReportDetailPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders report details, score ring, and summary overview', async () => {
    vi.mocked(api.getReport).mockResolvedValue({
      data: mockReportData,
    });

    render(<ReportDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('report-title')).toHaveTextContent(
        'DeFi Vault Core Contract Audit',
      );
      expect(screen.getByTestId('scan-summary-card')).toBeInTheDocument();
      expect(screen.getByTestId('summary-total-findings')).toHaveTextContent('1');
      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.getByText('Missing Authorization Check')).toBeInTheDocument();
    });
  });

  it('handles Share Report button and writes URL to clipboard', async () => {
    const clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteMock,
      },
    });

    vi.mocked(api.getReport).mockResolvedValue({
      data: mockReportData,
    });

    render(<ReportDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('share-report-btn')).toBeInTheDocument();
    });

    const shareBtn = screen.getByTestId('share-report-btn');
    fireEvent.click(shareBtn);

    expect(clipboardWriteMock).toHaveBeenCalledWith(window.location.href);
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('handles Export PDF / Print button action', async () => {
    const printMock = vi.fn();
    window.print = printMock;

    vi.mocked(api.getReport).mockResolvedValue({
      data: mockReportData,
    });

    render(<ReportDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('print-report-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('print-report-btn'));
    expect(printMock).toHaveBeenCalled();
  });

  it('executes on-chain registration and displays Stellar transaction proof', async () => {
    vi.mocked(api.getReport).mockResolvedValue({
      data: mockReportData,
    });

    vi.mocked(api.registerOnChain).mockResolvedValue({
      data: {
        ...mockReportData,
        verifiedOnChain: true,
        transactionHash: 'tx_hash_stellar_proof_998877',
      },
    });

    render(<ReportDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('register-onchain-btn')).toBeInTheDocument();
    });

    const registerBtn = screen.getByTestId('register-onchain-btn');
    await act(async () => {
      fireEvent.click(registerBtn);
    });

    await waitFor(() => {
      expect(api.registerOnChain).toHaveBeenCalledWith('rep-123');
      const txLink = screen.getByTestId('stellar-tx-link');
      expect(txLink).toBeInTheDocument();
      expect(txLink).toHaveTextContent(/tx_hash_stellar_/);
    });
  });
});
