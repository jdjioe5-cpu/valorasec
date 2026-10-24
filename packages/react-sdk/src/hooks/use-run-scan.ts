import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiSuccess, ScanResult, ScanStatus } from '@valorasec/shared';
import { useValoraSecClient } from '../provider';
import { valoraSecQueryKeys } from '../keys';
import type { BaseHookOptions } from '../types';

export interface RunScanVariables {
  projectId?: string;
  contractId?: string;
}

export interface UseRunScanOptions extends BaseHookOptions {
  pollingInterval?: number;
  maxPollAttempts?: number;
  pollUntilComplete?: boolean;
  onScanComplete?: (result: ScanResult) => void;
  onProgress?: (result: ScanResult) => void;
  onError?: (error: Error) => void;
}

const TERMINAL_STATUSES: readonly ScanStatus[] = ['completed', 'failed', 'deleted'];

export function useRunScan(
  defaultProjectId?: string,
  defaultContractId?: string,
  options?: UseRunScanOptions,
) {
  const client = useValoraSecClient(options?.client);
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);
  const [currentScan, setCurrentScan] = useState<ScanResult | undefined>(undefined);

  const pollingInterval = options?.pollingInterval ?? 1000;
  const maxPollAttempts = options?.maxPollAttempts ?? 60;
  const shouldPoll = options?.pollUntilComplete ?? true;

  const mutation = useMutation<ApiSuccess<ScanResult>, Error, RunScanVariables | void>({
    mutationFn: async (variables) => {
      const pId = variables?.projectId ?? defaultProjectId;
      const cId = variables?.contractId ?? defaultContractId;

      if (!pId || !cId) {
        throw new Error('Both projectId and contractId are required to run a scan.');
      }

      const initialRes = await client.runScan(pId, cId);
      let scan = initialRes.data;
      setCurrentScan(scan);

      if (shouldPoll && !TERMINAL_STATUSES.includes(scan.status)) {
        setIsPolling(true);
        let attempts = 0;

        try {
          while (attempts < maxPollAttempts && !TERMINAL_STATUSES.includes(scan.status)) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, pollingInterval));

            const pollRes = await client.getScanDetails(scan.id);
            scan = pollRes.data;
            setCurrentScan(scan);
            options?.onProgress?.(scan);

            if (TERMINAL_STATUSES.includes(scan.status)) {
              break;
            }
          }
        } finally {
          setIsPolling(false);
        }
      }

      options?.onScanComplete?.(scan);

      // Invalidate scans, reports, projects caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.scans() }),
        queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.reports() }),
        queryClient.invalidateQueries({ queryKey: valoraSecQueryKeys.projectDetails(pId) }),
      ]);

      return {
        ...initialRes,
        data: scan,
      };
    },
    onError: (err) => {
      setIsPolling(false);
      options?.onError?.(err);
    },
  });

  const runScan = useCallback(
    (variables?: RunScanVariables) => mutation.mutateAsync(variables),
    [mutation],
  );

  const latestScan = currentScan ?? mutation.data?.data;

  return {
    ...mutation,
    runScan,
    data: mutation.data,
    scanResult: latestScan,
    isLoading: mutation.isPending || isPolling,
    isPending: mutation.isPending,
    isPolling,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess && !isPolling,
  };
}
