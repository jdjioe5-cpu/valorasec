import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { renderHookWithClient, createMockValoraSecClient, mockScanResult } from './test-utils';
import { useRunScan } from '../hooks/use-run-scan';
import type { ApiSuccess, ScanResult } from '@valorasec/shared';

describe('useRunScan hook', () => {
  it('triggers scan mutation and returns terminal scan result', async () => {
    const mockClient = createMockValoraSecClient();
    const onScanComplete = vi.fn();

    const { result } = renderHookWithClient(
      () =>
        useRunScan('proj-123', 'contract-1', {
          onScanComplete,
        }),
      mockClient,
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPolling).toBe(false);

    let scanRes: ApiSuccess<ScanResult> | undefined;
    await act(async () => {
      scanRes = await result.current.runScan();
    });

    expect(mockClient.runScan).toHaveBeenCalledWith('proj-123', 'contract-1');
    expect(onScanComplete).toHaveBeenCalledWith(mockScanResult);
    expect(scanRes?.data).toEqual(mockScanResult);
    expect(result.current.scanResult).toEqual(mockScanResult);
  });

  it('polls scan progress when initial status is pending/running', async () => {
    const pendingScan: ScanResult = {
      ...mockScanResult,
      status: 'running',
    };
    const completedScan: ScanResult = {
      ...mockScanResult,
      status: 'completed',
      summary: {
        ...mockScanResult.summary,
        score: 95,
      },
    };

    const mockClient = createMockValoraSecClient({
      runScan: vi.fn().mockResolvedValue({ success: true, data: pendingScan }),
      getScanDetails: vi.fn().mockResolvedValue({ success: true, data: completedScan }),
    });

    const onProgress = vi.fn();
    const onScanComplete = vi.fn();

    const { result } = renderHookWithClient(
      () =>
        useRunScan('proj-123', 'contract-1', {
          pollingInterval: 10,
          onProgress,
          onScanComplete,
        }),
      mockClient,
    );

    await act(async () => {
      await result.current.runScan();
    });

    expect(mockClient.runScan).toHaveBeenCalledWith('proj-123', 'contract-1');
    expect(mockClient.getScanDetails).toHaveBeenCalledWith(pendingScan.id);
    expect(onProgress).toHaveBeenCalledWith(completedScan);
    expect(onScanComplete).toHaveBeenCalledWith(completedScan);
    expect(result.current.scanResult?.summary.score).toBe(95);
  });

  it('throws error when neither default nor variables provide required ids', async () => {
    const mockClient = createMockValoraSecClient();
    const onError = vi.fn();

    const { result } = renderHookWithClient(
      () => useRunScan(undefined, undefined, { onError }),
      mockClient,
    );

    await act(async () => {
      try {
        await result.current.runScan();
      } catch (e: unknown) {
        if (e instanceof Error) {
          expect(e.message).toContain('Both projectId and contractId are required');
        }
      }
    });

    expect(onError).toHaveBeenCalled();
  });
});
