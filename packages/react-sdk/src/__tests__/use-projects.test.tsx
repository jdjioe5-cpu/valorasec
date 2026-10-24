import { describe, it, expect, vi } from 'vitest';
import {
  renderHookWithClient,
  createMockValoraSecClient,
  mockProjectsResponse,
  waitFor,
} from './test-utils';
import { useProjects } from '../hooks/use-projects';

describe('useProjects hook', () => {
  it('fetches projects with pagination params as query keys', async () => {
    const mockClient = createMockValoraSecClient();
    const params = { page: 2, limit: 20, search: 'vault' };

    const { result } = renderHookWithClient(() => useProjects(params), mockClient);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockClient.getProjects).toHaveBeenCalledWith(params);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(mockProjectsResponse);
    expect(result.current.error).toBeNull();
  });

  it('handles error states properly', async () => {
    const mockClient = createMockValoraSecClient({
      getProjects: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    const { result } = renderHookWithClient(() => useProjects(), mockClient);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.data).toBeUndefined();
  });
});
