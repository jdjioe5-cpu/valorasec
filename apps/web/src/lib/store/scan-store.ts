import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveScanInfo {
  scanId: string;
  contractId: string;
  projectId: string;
  contractName?: string;
  startedAt: number;
  expectedDurationMs?: number;
}

interface ScanState {
  activeScans: Record<string, ActiveScanInfo>;
  setActiveScan: (scan: ActiveScanInfo) => void;
  removeActiveScan: (scanIdOrContractId: string) => void;
  getActiveScanForContract: (contractId: string) => ActiveScanInfo | undefined;
  clearAllActiveScans: () => void;
}

export const useScanStore = create<ScanState>()(
  persist(
    (set, get) => ({
      activeScans: {},

      setActiveScan: (scan) =>
        set((state) => ({
          activeScans: {
            ...state.activeScans,
            [scan.scanId]: scan,
            [scan.contractId]: scan,
          },
        })),

      removeActiveScan: (id) =>
        set((state) => {
          const next = { ...state.activeScans };
          const found = next[id];
          if (found) {
            delete next[found.scanId];
            delete next[found.contractId];
          } else {
            delete next[id];
          }
          return { activeScans: next };
        }),

      getActiveScanForContract: (contractId: string) => {
        return get().activeScans[contractId];
      },

      clearAllActiveScans: () => set({ activeScans: {} }),
    }),
    {
      name: 'valorasec-active-scans',
      partialize: (state) => ({
        activeScans: state.activeScans,
      }),
    },
  ),
);
