import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ApiSuccess, Report } from '@valorasec/shared';
import { useValoraSecClient } from '../provider';
import { valoraSecQueryKeys } from '../keys';
import type { BaseHookOptions } from '../types';

export interface UseReportOptions
  extends
    BaseHookOptions,
    Omit<
      UseQueryOptions<ApiSuccess<Report>, Error, ApiSuccess<Report>, readonly unknown[]>,
      'queryKey' | 'queryFn'
    > {}

export function useReport(id: string, options?: UseReportOptions) {
  const client = useValoraSecClient(options?.client);

  const query = useQuery({
    queryKey: valoraSecQueryKeys.reportDetails(id),
    queryFn: () => client.getReport(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
    ...options,
  });

  const report = query.data?.data ?? (query.data as unknown as Report | undefined);

  return {
    ...query,
    data: query.data,
    report,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
