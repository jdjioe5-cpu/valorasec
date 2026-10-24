import { describe, it, expect } from 'vitest';
import {
  renderHookWithClient,
  createMockValoraSecClient,
  mockReportsResponse,
  waitFor,
} from './test-utils';
import { useReports } from '../hooks/use-reports';

describe('useReports hook', () => {
  it('fetches paginated reports with filter params', async () => {
    const mockClient = createMockValoraSecClient();
    const params = { page: 1, limit: 10, projectId: 'proj-123' };

    const { result } = renderHookWithClient(() => useReports(params), mockClient);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockClient.getReports).toHaveBeenCalledWith(params);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(mockReportsResponse);
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0]?.summary.score).toBe(92);
  });
});
