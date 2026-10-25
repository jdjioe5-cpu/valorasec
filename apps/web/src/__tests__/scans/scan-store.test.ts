import { describe, it, expect, beforeEach } from 'vitest';
import { useScanStore } from '@/lib/store/scan-store';

describe('useScanStore', () => {
  beforeEach(() => {
    useScanStore.getState().clearAllActiveScans();
  });

  it('stores and retrieves active scan by contractId or scanId', () => {
    const scanInfo = {
      scanId: 'scan-uuid-1',
      contractId: 'contract-c-1',
      projectId: 'proj-p-1',
      contractName: 'Governance',
      startedAt: Date.now(),
      expectedDurationMs: 4000,
    };

    useScanStore.getState().setActiveScan(scanInfo);

    const fromContract = useScanStore.getState().getActiveScanForContract('contract-c-1');
    expect(fromContract).toBeDefined();
    expect(fromContract?.scanId).toBe('scan-uuid-1');
    expect(fromContract?.contractName).toBe('Governance');

    // Also accessible by scanId directly
    expect(useScanStore.getState().activeScans['scan-uuid-1']?.contractId).toBe('contract-c-1');
  });

  it('removes active scan cleanly across both lookup keys', () => {
    const scanInfo = {
      scanId: 'scan-uuid-2',
      contractId: 'contract-c-2',
      projectId: 'proj-p-1',
      startedAt: Date.now(),
    };

    useScanStore.getState().setActiveScan(scanInfo);
    expect(useScanStore.getState().getActiveScanForContract('contract-c-2')).toBeDefined();

    useScanStore.getState().removeActiveScan('scan-uuid-2');
    expect(useScanStore.getState().getActiveScanForContract('contract-c-2')).toBeUndefined();
    expect(useScanStore.getState().activeScans['scan-uuid-2']).toBeUndefined();
  });
});
