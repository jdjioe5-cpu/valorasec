import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { PaginatedResponse, Report } from '@valorasec/shared';
import { useValoraSecClient } from '../provider';
import { valoraSecQueryKeys, type ReportListParams } from '../keys';
import type { BaseHookOptions } from '../types';

export interface UseReportsOptions
  extends
    BaseHookOptions,
    Omit<
      UseQueryOptions<
        PaginatedResponse<Report>,
        Error,
        PaginatedResponse<Report>,
        readonly unknown[]
      >,
      'queryKey' | 'queryFn'
    > {}

export function useReports(params?: ReportListParams, options?: UseReportsOptions) {
  const client = useValoraSecClient(options?.client);

  const query = useQuery({
    queryKey: valoraSecQueryKeys.reportList(params),
    queryFn: () => client.getReports(params),
    enabled: options?.enabled,
    ...options,
  });

  return {
    ...query,
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
