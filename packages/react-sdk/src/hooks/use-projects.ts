import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { PaginatedResponse, Project } from '@valorasec/shared';
import { useValoraSecClient } from '../provider';
import { valoraSecQueryKeys, type ProjectListParams } from '../keys';
import type { BaseHookOptions } from '../types';

export interface UseProjectsOptions
  extends
    BaseHookOptions,
    Omit<
      UseQueryOptions<
        PaginatedResponse<Project>,
        Error,
        PaginatedResponse<Project>,
        readonly unknown[]
      >,
      'queryKey' | 'queryFn'
    > {}

export function useProjects(params?: ProjectListParams, options?: UseProjectsOptions) {
  const client = useValoraSecClient(options?.client);

  const query = useQuery({
    queryKey: valoraSecQueryKeys.projectList(params),
    queryFn: () => client.getProjects(params),
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
