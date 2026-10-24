import { describe, it, expect } from 'vitest';
import {
  filterProjects,
  filterReports,
  countActiveProjectFilters,
  countActiveReportFilters,
  paginateItems,
} from '@/lib/filter-utils';
import type { Project, Report, ScanSummary } from '@valorasec/shared';

const mockSummary: ScanSummary = {
  totalFindings: 0,
  bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  score: 100,
  linesAnalyzed: 50,
  rulesExecuted: 5,
};

describe('filter-utils', () => {
  const mockProjects: Project[] = [
    {
      id: 'proj-1',
      name: 'Soroban Token Bridge',
      description: 'Cross-chain bridge contracts on Soroban',
      network: 'testnet',
      userId: 'user-1',
      contracts: [
        {
          id: 'c1',
          projectId: 'proj-1',
          name: 'BridgeCore',
          address: 'CA...',
          network: 'testnet',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'proj-2',
      name: 'DeFi Lending Vault',
      description: 'Yield optimizer and lending pool',
      network: 'mainnet',
      userId: 'user-1',
      contracts: [],
      createdAt: '2026-01-02',
      updatedAt: '2026-01-02',
    },
    {
      id: 'proj-3',
      name: 'Stellar MultiSig Wallet',
      description: 'Governance and multisig contract suite',
      network: 'testnet',
      userId: 'user-1',
      contracts: [],
      createdAt: '2026-01-03',
      updatedAt: '2026-01-03',
    },
  ];

  const mockReports: Report[] = [
    {
      id: 'rep-1',
      scanId: 'scan-1',
      projectId: 'proj-1',
      contractId: 'contract-bridge-01',
      userId: 'user-1',
      title: 'Soroban Token Bridge Security Audit',
      status: 'published',
      findings: [],
      summary: mockSummary,
      verifiedOnChain: false,
      createdAt: '2026-01-10',
      updatedAt: '2026-01-10',
    },
    {
      id: 'rep-2',
      scanId: 'scan-2',
      projectId: 'proj-2',
      contractId: 'contract-vault-02',
      userId: 'user-1',
      title: 'DeFi Lending Vault Vulnerability Assessment',
      status: 'draft',
      findings: [],
      summary: mockSummary,
      verifiedOnChain: false,
      createdAt: '2026-01-12',
      updatedAt: '2026-01-12',
    },
    {
      id: 'rep-3',
      scanId: 'scan-3',
      projectId: 'proj-1',
      contractId: 'contract-gov-03',
      userId: 'user-1',
      title: 'Bridge Governance Verification Report',
      status: 'verified',
      findings: [],
      summary: mockSummary,
      verifiedOnChain: true,
      transactionHash: 'tx-hash-12345',
      createdAt: '2026-01-15',
      updatedAt: '2026-01-15',
    },
  ];

  describe('filterProjects', () => {
    it('returns all projects when criteria is empty or all', () => {
      expect(filterProjects(mockProjects, {})).toHaveLength(3);
      expect(filterProjects(mockProjects, { search: '', network: 'all' })).toHaveLength(3);
    });

    it('filters projects by name case-insensitively', () => {
      const results = filterProjects(mockProjects, { search: 'lending' });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('proj-2');
    });

    it('filters projects by description case-insensitively', () => {
      const results = filterProjects(mockProjects, { search: 'optimizer' });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('proj-2');
    });

    it('trims leading/trailing whitespace in search query', () => {
      const results = filterProjects(mockProjects, { search: '   multisig   ' });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('proj-3');
    });

    it('filters projects by network', () => {
      const testnetProjects = filterProjects(mockProjects, { network: 'testnet' });
      expect(testnetProjects).toHaveLength(2);
      expect(testnetProjects.map((p) => p.id)).toEqual(['proj-1', 'proj-3']);

      const mainnetProjects = filterProjects(mockProjects, { network: 'mainnet' });
      expect(mainnetProjects).toHaveLength(1);
      expect(mainnetProjects[0]?.id).toBe('proj-2');
    });

    it('combines search and network filters conjunctively', () => {
      const results = filterProjects(mockProjects, { search: 'bridge', network: 'testnet' });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('proj-1');

      const noMatch = filterProjects(mockProjects, { search: 'bridge', network: 'mainnet' });
      expect(noMatch).toHaveLength(0);
    });
  });

  describe('countActiveProjectFilters', () => {
    it('returns 0 when no active filters', () => {
      expect(countActiveProjectFilters({})).toBe(0);
      expect(countActiveProjectFilters({ search: '   ', network: 'all' })).toBe(0);
    });

    it('counts search filter when non-empty', () => {
      expect(countActiveProjectFilters({ search: 'hello' })).toBe(1);
    });

    it('counts network filter when not "all"', () => {
      expect(countActiveProjectFilters({ network: 'mainnet' })).toBe(1);
    });

    it('counts both filters when active', () => {
      expect(countActiveProjectFilters({ search: 'test', network: 'testnet' })).toBe(2);
    });
  });

  describe('filterReports', () => {
    it('returns all reports when criteria is empty', () => {
      expect(filterReports(mockReports, {})).toHaveLength(3);
    });

    it('filters by title keyword', () => {
      const results = filterReports(mockReports, { search: 'Vulnerability' });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('rep-2');
    });

    it('filters by contractId keyword', () => {
      const results = filterReports(mockReports, { search: 'contract-bridge-01' });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('rep-1');
    });

    it('filters by status', () => {
      const draft = filterReports(mockReports, { status: 'draft' });
      expect(draft).toHaveLength(1);
      expect(draft[0]?.id).toBe('rep-2');

      const published = filterReports(mockReports, { status: 'published' });
      expect(published).toHaveLength(1);
      expect(published[0]?.id).toBe('rep-1');

      const verified = filterReports(mockReports, { status: 'verified' });
      expect(verified).toHaveLength(1);
      expect(verified[0]?.id).toBe('rep-3');
    });

    it('filters by projectId', () => {
      const proj1Reports = filterReports(mockReports, { projectId: 'proj-1' });
      expect(proj1Reports).toHaveLength(2);
      expect(proj1Reports.map((r) => r.id)).toEqual(['rep-1', 'rep-3']);

      const proj2Reports = filterReports(mockReports, { projectId: 'proj-2' });
      expect(proj2Reports).toHaveLength(1);
      expect(proj2Reports[0]?.id).toBe('rep-2');
    });

    it('combines search, status, and projectId filters conjunctively', () => {
      const match = filterReports(mockReports, {
        search: 'bridge',
        status: 'verified',
        projectId: 'proj-1',
      });
      expect(match).toHaveLength(1);
      expect(match[0]?.id).toBe('rep-3');

      const noMatch = filterReports(mockReports, {
        search: 'bridge',
        status: 'draft',
        projectId: 'proj-1',
      });
      expect(noMatch).toHaveLength(0);
    });
  });

  describe('countActiveReportFilters', () => {
    it('returns 0 when default/empty', () => {
      expect(countActiveReportFilters({})).toBe(0);
      expect(countActiveReportFilters({ search: '  ', status: 'all', projectId: 'all' })).toBe(0);
    });

    it('counts individual and combined filters accurately', () => {
      expect(countActiveReportFilters({ search: 'audit' })).toBe(1);
      expect(countActiveReportFilters({ status: 'published' })).toBe(1);
      expect(countActiveReportFilters({ projectId: 'proj-1' })).toBe(1);
      expect(
        countActiveReportFilters({ search: 'audit', status: 'published', projectId: 'proj-1' }),
      ).toBe(3);
    });
  });

  describe('paginateItems', () => {
    const list = [1, 2, 3, 4, 5, 6, 7];

    it('correctly partitions items for first page', () => {
      const res = paginateItems(list, 1, 3);
      expect(res.currentPage).toBe(1);
      expect(res.totalPages).toBe(3);
      expect(res.totalItems).toBe(7);
      expect(res.items).toEqual([1, 2, 3]);
    });

    it('correctly partitions items for middle and last page', () => {
      const p2 = paginateItems(list, 2, 3);
      expect(p2.items).toEqual([4, 5, 6]);

      const p3 = paginateItems(list, 3, 3);
      expect(p3.items).toEqual([7]);
    });

    it('clamps page to valid range if out of bounds', () => {
      const underflow = paginateItems(list, 0, 3);
      expect(underflow.currentPage).toBe(1);

      const overflow = paginateItems(list, 999, 3);
      expect(overflow.currentPage).toBe(3);
      expect(overflow.items).toEqual([7]);
    });

    it('handles empty arrays gracefully', () => {
      const empty = paginateItems([], 1, 5);
      expect(empty.totalItems).toBe(0);
      expect(empty.totalPages).toBe(1);
      expect(empty.items).toEqual([]);
    });
  });
});
