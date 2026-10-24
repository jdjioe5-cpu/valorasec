import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ApiSuccess, ScanResult } from '@valorasec/shared';
import { useValoraSecClient } from '../provider';
import { valoraSecQueryKeys } from '../keys';
import type { BaseHookOptions } from '../types';

export interface UseScanDetailsOptions
  extends
    BaseHookOptions,
    Omit<
      UseQueryOptions<ApiSuccess<ScanResult>, Error, ApiSuccess<ScanResult>, readonly unknown[]>,
      'queryKey' | 'queryFn'
    > {}

export function useScanDetails(scanId: string, options?: UseScanDetailsOptions) {
  const client = useValoraSecClient(options?.client);

  const query = useQuery({
    queryKey: valoraSecQueryKeys.scanDetails(scanId),
    queryFn: () => client.getScanDetails(scanId),
    enabled: Boolean(scanId) && (options?.enabled ?? true),
    ...options,
  });

  const scan = query.data?.data;

  return {
    ...query,
    scan,
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
