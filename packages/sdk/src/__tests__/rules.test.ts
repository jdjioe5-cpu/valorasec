import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValoraSecClient } from '../index';

describe('ValoraSecClient Security Rules Marketplace (Issue #37)', () => {
  let client: ValoraSecClient;

  beforeEach(() => {
    client = new ValoraSecClient({
      baseUrl: 'http://localhost:4000',
      accessToken: 'test-token',
    });
    vi.restoreAllMocks();
  });

  it('fetches rules list with query filters', async () => {
    const mockResponse = {
      data: [{ id: 'R001', name: 'missing-auth' }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await client.getRules({ category: 'authorization', sort: 'popular' });
    expect(res).toEqual(mockResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/rules?category=authorization&sort=popular',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('creates custom security rule', async () => {
    const newRule = {
      name: 'check-env-storage',
      category: 'storage',
      severity: 'high' as const,
      description: 'Checks storage boundaries',
      recommendation: 'Use guarded getter',
    };
    const mockCreated = { data: { id: 'r-custom-1', ...newRule } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockCreated),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await client.createRule(newRule);
    expect(res).toEqual(mockCreated);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/rules',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(newRule),
      }),
    );
  });

  it('installs rule and increments downloads', async () => {
    const mockInstalled = { data: { id: 'R001', downloads: 1421, enabled: true } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockInstalled),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await client.installRule('R001');
    expect(res).toEqual(mockInstalled);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/rules/R001/install',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
