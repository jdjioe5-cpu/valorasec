import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScanProgress } from '@/components/scans/scan-progress';
import type { UseScanProgressResult } from '@/lib/hooks/use-scan-progress';
import type { ScanResult } from '@valorasec/shared';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ScanProgress Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const mockRunningProgress: UseScanProgressResult = {
    scanId: 'scan-test-123',
    data: undefined,
    status: 'running',
    step: 'analyzing',
    progressPercent: 42,
    estimatedRemainingSec: 3,
    elapsedMs: 1500,
    durationSec: undefined,
    isLoading: false,
    isPolling: true,
    isCompleted: false,
    isFailed: false,
    error: null,
    activeScanInfo: undefined,
    reset: vi.fn(),
  };

  const mockCompletedScan: ScanResult = {
    id: 'scan-test-123',
    projectId: 'proj-1',
    contractId: 'contract-1',
    status: 'completed',
    findings: [],
    summary: {
      totalFindings: 2,
      bySeverity: { critical: 0, high: 1, medium: 1, low: 0, info: 0 },
      score: 85,
      linesAnalyzed: 120,
      rulesExecuted: 18,
    },
    startedAt: new Date(Date.now() - 3200).toISOString(),
    completedAt: new Date().toISOString(),
    duration: 3200,
  };

  it('renders running progress bar and step indicators correctly', () => {
    act(() => {
      root.render(<ScanProgress progress={mockRunningProgress} contractName="TokenEscrow" />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('42');
    expect(progressbar?.getAttribute('aria-valuemin')).toBe('0');
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('100');

    // Title and scan id
    expect(container.textContent).toContain('Scanning Contract: TokenEscrow...');
    expect(container.textContent).toContain('scan-test-123');
    expect(container.textContent).toContain('~3s remaining');

    // Steps
    const analyzingStep = container.querySelector('[data-testid="step-analyzing"]');
    const processingStep = container.querySelector('[data-testid="step-processing"]');
    const completeStep = container.querySelector('[data-testid="step-complete"]');

    expect(analyzingStep).not.toBeNull();
    expect(processingStep).not.toBeNull();
    expect(completeStep).not.toBeNull();
  });

  it('renders completed scan results with score and severity summary', () => {
    const completedProgress: UseScanProgressResult = {
      ...mockRunningProgress,
      data: mockCompletedScan,
      status: 'completed',
      step: 'complete',
      progressPercent: 100,
      estimatedRemainingSec: 0,
      durationSec: 3.2,
      isPolling: false,
      isCompleted: true,
    };

    act(() => {
      root.render(<ScanProgress progress={completedProgress} contractName="TokenEscrow" />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('100');

    expect(container.textContent).toContain('Scan Completed Successfully');
    expect(container.textContent).toContain('Score: 85/100');
    expect(container.textContent).toContain('Finished in 3.2s');
    expect(container.textContent).toContain('2 findings identified');
    expect(container.textContent).toContain('View Full Report');
  });

  it('renders failure state and triggers retry callback', () => {
    const handleRetry = vi.fn();
    const failedProgress: UseScanProgressResult = {
      ...mockRunningProgress,
      status: 'failed',
      step: 'failed',
      progressPercent: 100,
      isPolling: false,
      isFailed: true,
      error: new Error('Network timeout during AST extraction'),
    };

    act(() => {
      root.render(
        <ScanProgress progress={failedProgress} contractName="TokenEscrow" onRetry={handleRetry} />,
      );
    });

    expect(container.textContent).toContain('Security Scan Interrupted');
    expect(container.textContent).toContain('Network timeout during AST extraction');

    const retryBtn = container.querySelector('button');
    expect(retryBtn?.textContent).toContain('Retry Scan');

    act(() => {
      retryBtn?.click();
    });

    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
