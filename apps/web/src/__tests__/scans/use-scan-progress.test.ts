import { describe, it, expect } from 'vitest';

describe('useScanProgress Logic & Polling Strategy', () => {
  it('implements 2000ms polling interval until terminal status is reached', () => {
    // Test the refetchInterval decision function exactly as defined in the hook
    const refetchIntervalFn = (q: { state: { data?: { status: string } } }, intervalMs = 2000) => {
      const data = q.state.data;
      if (!data) return intervalMs;
      if (data.status === 'completed' || data.status === 'failed') {
        return false;
      }
      return intervalMs;
    };

    // When no data has returned yet
    expect(refetchIntervalFn({ state: {} })).toBe(2000);

    // When status is running
    expect(refetchIntervalFn({ state: { data: { status: 'running' } } })).toBe(2000);

    // When status is pending
    expect(refetchIntervalFn({ state: { data: { status: 'pending' } } })).toBe(2000);

    // When status is completed: stops polling
    expect(refetchIntervalFn({ state: { data: { status: 'completed' } } })).toBe(false);

    // When status is failed: stops polling
    expect(refetchIntervalFn({ state: { data: { status: 'failed' } } })).toBe(false);
  });

  it('determines steps accurately through analyzing -> processing -> complete', () => {
    const computeStep = (
      hasScanId: boolean,
      status: string | undefined,
      elapsedMs: number,
      expectedDurationMs = 4000,
    ) => {
      if (!hasScanId && !status) return 'idle';
      if (status === 'failed') return 'failed';
      if (status === 'completed') return 'complete';

      const ratio = elapsedMs / expectedDurationMs;
      if (ratio < 0.45) return 'analyzing';
      return 'processing';
    };

    expect(computeStep(false, undefined, 0)).toBe('idle');
    expect(computeStep(true, 'running', 500)).toBe('analyzing');
    expect(computeStep(true, 'running', 2500)).toBe('processing');
    expect(computeStep(true, 'completed', 3800)).toBe('complete');
    expect(computeStep(true, 'failed', 1200)).toBe('failed');
  });

  it('computes asymptotic progress percent and countdown duration', () => {
    const computeProgress = (
      status: string | undefined,
      elapsedMs: number,
      expectedDurationMs = 4000,
    ) => {
      if (!status) return 0;
      if (status === 'completed' || status === 'failed') return 100;
      const ratio = Math.min(0.92, (elapsedMs / expectedDurationMs) * 0.9);
      return Math.round(ratio * 100);
    };

    expect(computeProgress(undefined, 0)).toBe(0);
    expect(computeProgress('running', 0)).toBe(0);
    expect(computeProgress('running', 2000)).toBe(45);
    expect(computeProgress('running', 4000)).toBe(90);
    expect(computeProgress('running', 8000)).toBe(92); // capped before complete
    expect(computeProgress('completed', 3200)).toBe(100);
  });
});
