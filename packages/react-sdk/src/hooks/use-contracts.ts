import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ApiSuccess, Contract } from '@valorasec/shared';
import { useValoraSecClient } from '../provider';
import { valoraSecQueryKeys } from '../keys';
import type { BaseHookOptions } from '../types';

export interface UseContractsOptions
  extends
    BaseHookOptions,
    Omit<
      UseQueryOptions<ApiSuccess<Contract[]>, Error, ApiSuccess<Contract[]>, readonly unknown[]>,
      'queryKey' | 'queryFn'
    > {}

export function useContracts(projectId: string, options?: UseContractsOptions) {
  const client = useValoraSecClient(options?.client);

  const query = useQuery({
    queryKey: valoraSecQueryKeys.projectContracts(projectId),
    queryFn: () => client.getContracts(projectId),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    ...options,
  });

  const contracts = query.data?.data ?? [];

  return {
    ...query,
    contracts,
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
