import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScanHistoryTimeline } from '@/components/projects/scan-history-timeline';
import type { ScanResult } from '@valorasec/shared';

const mockScans: ScanResult[] = [
  {
    id: 'scan-1',
    projectId: 'proj-1',
    contractId: 'contract-vault',
    status: 'completed',
    findings: [],
    summary: {
      totalFindings: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      score: 95,
      linesAnalyzed: 250,
      rulesExecuted: 15,
    },
    startedAt: '2026-02-01T12:00:00Z',
    completedAt: '2026-02-01T12:00:04Z',
    duration: 4,
  },
  {
    id: 'scan-2',
    projectId: 'proj-1',
    contractId: 'contract-token',
    status: 'failed',
    findings: [],
    summary: {
      totalFindings: 2,
      bySeverity: { critical: 1, high: 1, medium: 0, low: 0, info: 0 },
      score: 35,
      linesAnalyzed: 120,
      rulesExecuted: 15,
    },
    startedAt: '2026-01-20T10:00:00Z',
  },
];

describe('ScanHistoryTimeline Component', () => {
  it('renders loading state when isLoading is true', () => {
    render(<ScanHistoryTimeline scans={[]} isLoading={true} />);
    expect(screen.getByTestId('timeline-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading scan history...')).toBeInTheDocument();
  });

  it('renders empty state when no scans exist', () => {
    render(<ScanHistoryTimeline scans={[]} isLoading={false} />);
    expect(screen.getByTestId('timeline-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No Scan History')).toBeInTheDocument();
  });

  it('renders list of scan items with contract mapping, scores, and severity indicators', () => {
    const contractMap = {
      'contract-vault': 'VaultCoreContract',
      'contract-token': 'TokenDistributor',
    };

    render(<ScanHistoryTimeline scans={mockScans} contractMap={contractMap} />);

    // Item 1
    expect(screen.getByTestId('timeline-item-scan-1')).toBeInTheDocument();
    expect(screen.getByText('VaultCoreContract')).toBeInTheDocument();
    expect(screen.getByText('Score: 95/100')).toBeInTheDocument();
    expect(screen.getByText('4s')).toBeInTheDocument();
    expect(screen.getByText('Clean (0 issues)')).toBeInTheDocument();

    // Item 2
    expect(screen.getByTestId('timeline-item-scan-2')).toBeInTheDocument();
    expect(screen.getByText('TokenDistributor')).toBeInTheDocument();
    expect(screen.getByText('Score: 35/100')).toBeInTheDocument();
    expect(screen.getByText('1 Critical')).toBeInTheDocument();
    expect(screen.getByText('1 High')).toBeInTheDocument();
  });
});
