import type { ValoraSecClient } from '@valorasec/sdk';

export interface ValoraSecContextValue {
  client: ValoraSecClient;
}

export interface BaseHookOptions {
  client?: ValoraSecClient;
}

export interface ConsistentHookResult<TData, TError = Error> {
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}
