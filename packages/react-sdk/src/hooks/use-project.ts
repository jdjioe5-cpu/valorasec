import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ApiSuccess, Project } from '@valorasec/shared';
import { useValoraSecClient } from '../provider';
import { valoraSecQueryKeys } from '../keys';
import type { BaseHookOptions } from '../types';

export interface UseProjectOptions
  extends
    BaseHookOptions,
    Omit<
      UseQueryOptions<ApiSuccess<Project>, Error, ApiSuccess<Project>, readonly unknown[]>,
      'queryKey' | 'queryFn'
    > {}

export function useProject(id: string, options?: UseProjectOptions) {
  const client = useValoraSecClient(options?.client);

  const query = useQuery({
    queryKey: valoraSecQueryKeys.projectDetails(id),
    queryFn: () => client.getProject(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
    ...options,
  });

  const project = query.data?.data ?? (query.data as unknown as Project | undefined);

  return {
    ...query,
    data: query.data,
    project,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
