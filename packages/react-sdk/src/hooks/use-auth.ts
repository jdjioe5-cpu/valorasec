import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiSuccess,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  User,
} from '@valorasec/shared';
import { useValoraSecClient } from '../provider';
import { valoraSecQueryKeys } from '../keys';
import type { BaseHookOptions } from '../types';

export interface UseAuthOptions extends BaseHookOptions {
  enabled?: boolean;
  onLoginSuccess?: (data: { user: User; tokens: AuthTokens }) => void;
  onRegisterSuccess?: (data: { user: User; tokens: AuthTokens }) => void;
  onLogoutSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useAuth(options?: UseAuthOptions) {
  const client = useValoraSecClient(options?.client);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: valoraSecQueryKeys.profile(),
    queryFn: () => client.getProfile(),
    enabled: options?.enabled ?? true,
    retry: false,
  });

  const loginMutation = useMutation<
    ApiSuccess<{ user: User; tokens: AuthTokens }>,
    Error,
    LoginRequest
  >({
    mutationFn: (credentials) => client.login(credentials),
    onSuccess: (response) => {
      client.setTokens(response.data.tokens);
      queryClient.setQueryData(valoraSecQueryKeys.profile(), {
        success: true,
        data: response.data.user,
      });
      queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.projects() });
      queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.reports() });
      queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.scans() });
      options?.onLoginSuccess?.(response.data);
    },
    onError: options?.onError,
  });

  const registerMutation = useMutation<
    ApiSuccess<{ user: User; tokens: AuthTokens }>,
    Error,
    RegisterRequest
  >({
    mutationFn: (payload) => client.register(payload),
    onSuccess: (response) => {
      client.setTokens(response.data.tokens);
      queryClient.setQueryData(valoraSecQueryKeys.profile(), {
        success: true,
        data: response.data.user,
      });
      queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.projects() });
      queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.reports() });
      queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.scans() });
      options?.onRegisterSuccess?.(response.data);
    },
    onError: options?.onError,
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: () => client.logout(),
    onSuccess: () => {
      queryClient.setQueryData(valoraSecQueryKeys.profile(), null);
      queryClient.removeQueries({ queryKey: valoraSecQueryKeys.all });
      options?.onLogoutSuccess?.();
    },
    onError: options?.onError,
  });

  const login = useCallback(
    (credentials: LoginRequest) => loginMutation.mutateAsync(credentials),
    [loginMutation],
  );

  const register = useCallback(
    (payload: RegisterRequest) => registerMutation.mutateAsync(payload),
    [registerMutation],
  );

  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation]);

  const user = logoutMutation.isSuccess
    ? undefined
    : (profileQuery.data?.data ??
      loginMutation.data?.data.user ??
      registerMutation.data?.data.user);

  const isAuthenticated = Boolean(user);

  const isLoading =
    profileQuery.isLoading ||
    loginMutation.isPending ||
    registerMutation.isPending ||
    logoutMutation.isPending;

  const isError =
    profileQuery.isError ||
    loginMutation.isError ||
    registerMutation.isError ||
    logoutMutation.isError;

  const error =
    loginMutation.error || registerMutation.error || logoutMutation.error || profileQuery.error;

  return {
    user,
    isAuthenticated,
    data: profileQuery.data,
    profileQuery,
    loginMutation,
    registerMutation,
    logoutMutation,
    login,
    register,
    logout,
    isLoading,
    isPending: isLoading,
    isError,
    error,
    isSuccess: profileQuery.isSuccess,
  };
}
