'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useScanStore, type ActiveScanInfo } from '@/lib/store/scan-store';
import type { ScanResult, ScanStatus } from '@valorasec/shared';

export type ScanStep = 'idle' | 'analyzing' | 'processing' | 'complete' | 'failed';

export interface UseScanProgressOptions {
  scanId?: string | null;
  contractId?: string;
  projectId?: string;
  pollingIntervalMs?: number; // 默认 2000ms (2s) 满足 AC
  expectedDurationMs?: number; // 默认 4000ms
  enabled?: boolean;
  onCompleted?: (result: ScanResult) => void;
  onFailed?: (error: Error) => void;
}

export interface UseScanProgressResult {
  scanId: string | null;
  data: ScanResult | undefined;
  status: ScanStatus | 'idle';
  step: ScanStep;
  progressPercent: number;
  estimatedRemainingSec: number;
  elapsedMs: number;
  durationSec?: number;
  isLoading: boolean;
  isPolling: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  error: Error | null;
  activeScanInfo: ActiveScanInfo | undefined;
  reset: () => void;
}

const DEFAULT_POLLING_INTERVAL = 2000; // 2 seconds per Acceptance Criteria
const DEFAULT_EXPECTED_DURATION = 4000; // 4 seconds typical Soroban analysis

export function useScanProgress(options: UseScanProgressOptions = {}): UseScanProgressResult {
  const {
    pollingIntervalMs = DEFAULT_POLLING_INTERVAL,
    expectedDurationMs = DEFAULT_EXPECTED_DURATION,
    enabled = true,
    onCompleted,
    onFailed,
  } = options;

  const { activeScans, removeActiveScan } = useScanStore();

  // Resolve scanId: explicit option or restored from persistent active store by contractId
  const effectiveScanInfo = useMemo(() => {
    if (options.scanId) {
      return activeScans[options.scanId];
    }
    if (options.contractId) {
      return activeScans[options.contractId];
    }
    return undefined;
  }, [options.scanId, options.contractId, activeScans]);

  const effectiveScanId = options.scanId ?? effectiveScanInfo?.scanId ?? null;

  const startTime = useMemo(() => {
    return effectiveScanInfo?.startedAt ?? Date.now();
  }, [effectiveScanInfo?.startedAt]);

  const [elapsedMs, setElapsedMs] = useState(0);

  // React Query with refetchInterval function stopping at completed / failed
  const query = useQuery<ScanResult, Error>({
    queryKey: ['scan', effectiveScanId],
    enabled: Boolean(effectiveScanId) && enabled,
    queryFn: async () => {
      if (!effectiveScanId) {
        throw new Error('No scan ID provided');
      }
      const res = await api.getScanDetails(effectiveScanId);
      return res.data;
    },
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return pollingIntervalMs;
      // Stop polling on completion or failure
      if (data.status === 'completed' || data.status === 'failed') {
        return false;
      }
      return pollingIntervalMs;
    },
    refetchIntervalInBackground: true, // Ensures background polling if user navigates tabs
  });

  const scanData = query.data;
  const isTerminal =
    scanData?.status === 'completed' || scanData?.status === 'failed' || query.isError;

  // Track elapsed time ticker for real-time progress bar & estimated time countdown
  useEffect(() => {
    if (!effectiveScanId || isTerminal) return;

    const interval = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startTime));
    }, 200);

    return () => clearInterval(interval);
  }, [effectiveScanId, startTime, isTerminal]);

  // Handle completion or failure triggers and active store cleanup
  useEffect(() => {
    if (!effectiveScanId) return;

    if (scanData?.status === 'completed') {
      onCompleted?.(scanData);
      removeActiveScan(effectiveScanId);
    } else if (scanData?.status === 'failed' || query.isError) {
      const err = query.error ?? new Error('Scan failed');
      onFailed?.(err);
      removeActiveScan(effectiveScanId);
    }
  }, [
    effectiveScanId,
    scanData?.status,
    query.isError,
    query.error,
    onCompleted,
    onFailed,
    removeActiveScan,
  ]);

  // Compute current step: Analyzing -> Processing -> Complete
  const step: ScanStep = useMemo(() => {
    if (!effectiveScanId && !scanData) return 'idle';
    if (query.isError || scanData?.status === 'failed') return 'failed';
    if (scanData?.status === 'completed') return 'complete';

    const ratio = elapsedMs / expectedDurationMs;
    if (ratio < 0.45) {
      return 'analyzing';
    }
    return 'processing';
  }, [effectiveScanId, scanData, query.isError, elapsedMs, expectedDurationMs]);

  // Compute smooth progress percentage (0 - 100)
  const progressPercent = useMemo(() => {
    if (!effectiveScanId && !scanData) return 0;
    if (scanData?.status === 'completed') return 100;
    if (query.isError || scanData?.status === 'failed') return 100;

    // Asymptotic progress while in-flight: up to 92% until server returns completed
    const ratio = Math.min(0.92, (elapsedMs / expectedDurationMs) * 0.9);
    return Math.round(ratio * 100);
  }, [effectiveScanId, scanData, query.isError, elapsedMs, expectedDurationMs]);

  // Estimated remaining seconds
  const estimatedRemainingSec = useMemo(() => {
    if (scanData?.status === 'completed' || scanData?.status === 'failed') return 0;
    const remainingMs = Math.max(0, expectedDurationMs - elapsedMs);
    return Math.max(1, Math.ceil(remainingMs / 1000));
  }, [scanData?.status, expectedDurationMs, elapsedMs]);

  const durationSec = useMemo(() => {
    if (scanData?.duration) {
      return Number((scanData.duration / 1000).toFixed(1));
    }
    if (scanData?.status === 'completed') {
      return Number((elapsedMs / 1000).toFixed(1));
    }
    return undefined;
  }, [scanData?.duration, scanData?.status, elapsedMs]);

  return {
    scanId: effectiveScanId,
    data: scanData,
    status: scanData?.status ?? (effectiveScanId ? 'running' : 'idle'),
    step,
    progressPercent,
    estimatedRemainingSec,
    elapsedMs,
    durationSec,
    isLoading: query.isLoading,
    isPolling: Boolean(effectiveScanId && !isTerminal),
    isCompleted: scanData?.status === 'completed',
    isFailed: scanData?.status === 'failed' || query.isError,
    error: query.error ?? null,
    activeScanInfo: effectiveScanInfo,
    reset: () => {
      if (effectiveScanId) {
        removeActiveScan(effectiveScanId);
      }
    },
  };
}
