import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValoraSecClient } from '../index';

describe('ValoraSecClient export endpoints (Issue #53)', () => {
  let client: ValoraSecClient;

  beforeEach(() => {
    client = new ValoraSecClient({
      baseUrl: 'http://localhost:4000',
      accessToken: 'test-token',
    });
    vi.restoreAllMocks();
  });

  it('generates correct export URLs', () => {
    expect(client.getProjectExportUrl('proj-1', 'json')).toBe(
      'http://localhost:4000/api/projects/proj-1/export?format=json',
    );
    expect(client.getProjectExportUrl('proj-1', 'csv')).toBe(
      'http://localhost:4000/api/projects/proj-1/export?format=csv',
    );
    expect(client.getReportExportUrl('rep-1', 'json')).toBe(
      'http://localhost:4000/api/reports/rep-1/export?format=json',
    );
    expect(client.getReportExportUrl('rep-1', 'csv')).toBe(
      'http://localhost:4000/api/reports/rep-1/export?format=csv',
    );
  });

  it('fetches project export text with authorization header', async () => {
    const mockCsv = '"Project ID","Project Name"\r\n"proj-1","Demo"';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockCsv),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await client.exportProject('proj-1', 'csv');
    expect(result).toBe(mockCsv);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/projects/proj-1/export?format=csv',
      {
        headers: {
          Authorization: 'Bearer test-token',
        },
      },
    );
  });

  it('fetches report export text with authorization header', async () => {
    const mockJson = JSON.stringify({ id: 'rep-1', title: 'Audit Report' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockJson),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await client.exportReport('rep-1', 'json');
    expect(result).toBe(mockJson);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/reports/rep-1/export?format=json',
      {
        headers: {
          Authorization: 'Bearer test-token',
        },
      },
    );
  });
});
