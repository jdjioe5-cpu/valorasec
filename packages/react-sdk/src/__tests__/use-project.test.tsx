import { describe, it, expect } from 'vitest';
import {
  renderHookWithClient,
  createMockValoraSecClient,
  mockProject,
  waitFor,
} from './test-utils';
import { useProject } from '../hooks/use-project';

describe('useProject hook', () => {
  it('fetches single project by id and exposes unwrapped project', async () => {
    const mockClient = createMockValoraSecClient();
    const projectId = 'proj-123';

    const { result } = renderHookWithClient(() => useProject(projectId), mockClient);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockClient.getProject).toHaveBeenCalledWith(projectId);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.project).toEqual(mockProject);
    expect(result.current.data?.data).toEqual(mockProject);
  });

  it('disables query when id is empty', () => {
    const mockClient = createMockValoraSecClient();

    const { result } = renderHookWithClient(() => useProject(''), mockClient);

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPending).toBe(true);
    expect(mockClient.getProject).not.toHaveBeenCalled();
  });
});
