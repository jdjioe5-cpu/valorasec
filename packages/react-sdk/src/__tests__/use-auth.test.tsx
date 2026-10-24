import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { renderHookWithClient, createMockValoraSecClient, mockUser, waitFor } from './test-utils';
import { useAuth } from '../hooks/use-auth';
import { valoraSecQueryKeys } from '../keys';
import type { ApiSuccess, User } from '@valorasec/shared';

describe('useAuth hook', () => {
  it('handles login mutation, sets tokens, and updates user state', async () => {
    const mockClient = createMockValoraSecClient({
      getProfile: vi.fn().mockResolvedValue(null),
    });
    const onLoginSuccess = vi.fn();

    const { result, queryClient } = renderHookWithClient(
      () => useAuth({ onLoginSuccess }),
      mockClient,
    );

    await waitFor(() => {
      expect(result.current.profileQuery.isFetched).toBe(true);
    });

    await act(async () => {
      await result.current.login({
        email: 'auditor@stellar.org',
        password: 'Password123!',
      });
    });

    expect(mockClient.login).toHaveBeenCalledWith({
      email: 'auditor@stellar.org',
      password: 'Password123!',
    });
    expect(mockClient.setTokens).toHaveBeenCalledWith({
      accessToken: 'mock-access',
      refreshToken: 'mock-refresh',
    });
    expect(onLoginSuccess).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    const cachedProfile = queryClient.getQueryData<ApiSuccess<User>>(valoraSecQueryKeys.profile());
    expect(cachedProfile?.data).toEqual(mockUser);
  });

  it('handles register mutation and updates user state', async () => {
    const mockClient = createMockValoraSecClient({
      getProfile: vi.fn().mockResolvedValue(null),
    });
    const onRegisterSuccess = vi.fn();

    const { result } = renderHookWithClient(() => useAuth({ onRegisterSuccess }), mockClient);

    await waitFor(() => {
      expect(result.current.profileQuery.isFetched).toBe(true);
    });

    await act(async () => {
      await result.current.register({
        email: 'newuser@stellar.org',
        password: 'Password123!',
        name: 'New User',
      });
    });

    expect(mockClient.register).toHaveBeenCalled();
    expect(onRegisterSuccess).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });
  });

  it('handles logout mutation, clearing cached user session', async () => {
    const mockClient = createMockValoraSecClient();
    const onLogoutSuccess = vi.fn();

    const { result } = renderHookWithClient(() => useAuth({ onLogoutSuccess }), mockClient);

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    // Logout
    await act(async () => {
      await result.current.logout();
    });

    expect(mockClient.logout).toHaveBeenCalled();
    expect(onLogoutSuccess).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
