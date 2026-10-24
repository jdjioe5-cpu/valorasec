import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ValoraSecClient,
  type Notification,
  type AuditRecord,
  type User,
  type ScanResult,
} from '../index';

describe('@valorasec/sdk extended API coverage (issue #48)', () => {
  const originalFetch = globalThis.fetch;
  let client: ValoraSecClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new ValoraSecClient({
      baseUrl: 'https://api.valorasec.com',
      accessToken: 'test-token',
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Notifications API', () => {
    it('getNotifications() requests /api/notifications with and without query params', async () => {
      const mockNotifications: Notification[] = [
        {
          id: 'n-1',
          userId: 'u-1',
          type: 'scan_complete',
          title: 'Scan Finished',
          message: 'Zero vulnerabilities found',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockNotifications,
          meta: { total: 1, page: 2, limit: 10, totalPages: 1 },
        }),
      });
      globalThis.fetch = mockFetch;

      // 1. Without params
      const res1 = await client.getNotifications();
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.valorasec.com/api/notifications',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
      expect(res1.data).toHaveLength(1);
      expect(res1.meta.page).toBe(2);

      // 2. With params
      await client.getNotifications({ page: 3, limit: 15 });
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.valorasec.com/api/notifications?page=3&limit=15',
        expect.anything(),
      );
    });

    it('markNotificationRead(id) sends PATCH to /api/notifications/:id/read', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { message: 'Notification marked as read' } }),
      });
      globalThis.fetch = mockFetch;

      const res = await client.markNotificationRead('notif-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.valorasec.com/api/notifications/notif-123/read',
        expect.objectContaining({
          method: 'PATCH',
        }),
      );
      expect(res.data.message).toBe('Notification marked as read');
    });

    it('markAllNotificationsRead() sends PATCH to /api/notifications/read-all', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { message: 'All notifications marked as read' } }),
      });
      globalThis.fetch = mockFetch;

      const res = await client.markAllNotificationsRead();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.valorasec.com/api/notifications/read-all',
        expect.objectContaining({
          method: 'PATCH',
        }),
      );
      expect(res.data.message).toBe('All notifications marked as read');
    });
  });

  describe('User Profile Update API', () => {
    it('updateProfile(data) sends PATCH to /api/users/profile with updated data', async () => {
      const updatedUser: User = {
        id: 'u-1',
        email: 'alice@example.com',
        name: 'Alice Cooper',
        avatarUrl: 'https://example.com/avatar.png',
        role: 'user',
        isVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: updatedUser }),
      });
      globalThis.fetch = mockFetch;

      const res = await client.updateProfile({
        name: 'Alice Cooper',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.valorasec.com/api/users/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            name: 'Alice Cooper',
            avatarUrl: 'https://example.com/avatar.png',
          }),
        }),
      );
      expect(res.data.name).toBe('Alice Cooper');
      expect(res.data.avatarUrl).toBe('https://example.com/avatar.png');
    });
  });

  describe('Audit Registry API', () => {
    it('getAuditRecords(projectId) sends GET to /api/audit-registry/project/:projectId', async () => {
      const records: AuditRecord[] = [
        {
          id: 'ar-1',
          reportId: 'rep-1',
          projectId: 'p-1',
          reportHash: '0xabc123',
          auditorAddress: 'GA123',
          contractAddress: 'CA123',
          transactionHash: 'tx-hash-1',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: records }),
      });
      globalThis.fetch = mockFetch;

      const res = await client.getAuditRecords('p-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.valorasec.com/api/audit-registry/project/p-1',
        expect.anything(),
      );
      expect(res.data).toHaveLength(1);
      expect(res.data[0]!.transactionHash).toBe('tx-hash-1');
    });

    it('getAuditRecord(reportId) sends GET to /api/audit-registry/report/:reportId', async () => {
      const record: AuditRecord = {
        id: 'ar-1',
        reportId: 'rep-1',
        projectId: 'p-1',
        reportHash: '0xabc123',
        auditorAddress: 'GA123',
        contractAddress: 'CA123',
        transactionHash: 'tx-hash-1',
        timestamp: new Date().toISOString(),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: record }),
      });
      globalThis.fetch = mockFetch;

      const res = await client.getAuditRecord('rep-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.valorasec.com/api/audit-registry/report/rep-1',
        expect.anything(),
      );
      expect(res.data.reportHash).toBe('0xabc123');
    });
  });

  describe('Contract Scans History API', () => {
    it('getContractScans(contractId, params) sends GET to /api/contracts/:contractId/scans', async () => {
      const scans: ScanResult[] = [
        {
          id: 'scan-1',
          projectId: 'p-1',
          contractId: 'c-1',
          status: 'completed',
          findings: [],
          summary: {
            totalFindings: 0,
            bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
            score: 100,
            linesAnalyzed: 150,
            rulesExecuted: 12,
          },
          startedAt: new Date().toISOString(),
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: scans,
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      });
      globalThis.fetch = mockFetch;

      const res = await client.getContractScans('c-1', { page: 1, limit: 10 });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.valorasec.com/api/contracts/c-1/scans?page=1&limit=10',
        expect.anything(),
      );
      expect(res.data).toHaveLength(1);
      expect(res.data[0]!.summary.score).toBe(100);

      // Verify getScanHistory alias behaves identically
      await client.getScanHistory('c-1', { page: 2, limit: 5 });
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.valorasec.com/api/contracts/c-1/scans?page=2&limit=5',
        expect.anything(),
      );
    });
  });
});
