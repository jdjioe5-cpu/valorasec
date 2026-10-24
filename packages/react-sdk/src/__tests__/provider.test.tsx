import { describe, it, expect } from 'vitest';
import { renderHookWithClient, createMockValoraSecClient } from './test-utils';
import { useValoraSecClient } from '../provider';

describe('ValoraSecProvider and useValoraSecClient', () => {
  it('successfully retrieves client from context', () => {
    const mockClient = createMockValoraSecClient();
    const { result } = renderHookWithClient(() => useValoraSecClient(), mockClient);

    expect(result.current).toBe(mockClient);
  });

  it('allows overriding client directly in hook', () => {
    const contextClient = createMockValoraSecClient();
    const customClient = createMockValoraSecClient();

    const { result } = renderHookWithClient(() => useValoraSecClient(customClient), contextClient);

    expect(result.current).toBe(customClient);
    expect(result.current).not.toBe(contextClient);
  });
});
