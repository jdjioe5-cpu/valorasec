'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Shield, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import { formatDate, truncateAddress } from '@/lib/utils';
import { useScanProgress } from '@/lib/hooks/use-scan-progress';
import { useScanStore } from '@/lib/store/scan-store';
import { ScanProgress } from '@/components/scans/scan-progress';
import type { Project, Contract, ScanResult } from '@valorasec/shared';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { shouldRender } = useAuthGuard();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningContractId, setScanningContractId] = useState<string | null>(null);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);

  const [showAddContract, setShowAddContract] = useState(false);
  const [contractName, setContractName] = useState('');
  const [contractAddress, setContractAddress] = useState('');

  const { activeScans, setActiveScan } = useScanStore();

  // Restore background active scan if user navigated away and returned
  useEffect(() => {
    if (!projectId || currentScanId) return;
    const found = Object.values(activeScans).find((s) => s.projectId === projectId);
    if (found) {
      setCurrentScanId(found.scanId);
      setScanningContractId(found.contractId);
    }
  }, [projectId, activeScans, currentScanId]);

  // Hook for real-time polling (2s interval, react-query enabled)
  const scanProgress = useScanProgress({
    scanId: currentScanId,
    contractId: scanningContractId ?? undefined,
    projectId,
    onCompleted: (_result: ScanResult) => {
      setScanningContractId(null);
    },
    onFailed: (_err) => {
      setScanningContractId(null);
    },
  });

  useEffect(() => {
    if (!shouldRender) return;

    async function load() {
      try {
        const res = await api.getProject(projectId);
        setProject(res.data);
        setContracts(res.data.contracts ?? []);
      } catch (err) {
        console.error(err);
        router.push('/projects');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, shouldRender, router]);

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractName || !contractAddress) return;

    try {
      const res = await api.createContract(projectId, {
        name: contractName,
        address: contractAddress,
        network: project?.network ?? 'testnet',
      });
      setContracts([...contracts, res.data]);
      setContractName('');
      setContractAddress('');
      setShowAddContract(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScan = async (contractId: string) => {
    setScanningContractId(contractId);
    try {
      const res = await api.runScan(projectId, contractId);
      const targetContract = contracts.find((c) => c.id === contractId);

      // Register active background scan in store & initiate polling
      setActiveScan({
        scanId: res.data.id,
        contractId,
        projectId,
        contractName: targetContract?.name,
        startedAt: Date.now(),
        expectedDurationMs: res.data.duration ?? 4000,
      });

      setCurrentScanId(res.data.id);
    } catch (err) {
      console.error(err);
      setScanningContractId(null);
    }
  };

  const activeContractName = useMemo(() => {
    if (!scanningContractId) return undefined;
    return contracts.find((c) => c.id === scanningContractId)?.name;
  }, [contracts, scanningContractId]);

  if (!shouldRender || loading) {
    return (
      <div className="bg-background min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="animate-fade-in mb-8">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center text-sm"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Projects
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <Badge variant="low">{project.network}</Badge>
                <span className="text-muted-foreground text-sm">
                  {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
                </span>
                <span className="text-muted-foreground text-xs">
                  Created {formatDate(project.createdAt)}
                </span>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowAddContract(!showAddContract)}>
              <Plus className="mr-2 h-4 w-4" /> Add Contract
            </Button>
          </div>
        </div>

        {/* Add Contract Form */}
        {showAddContract && (
          <div className="cyber-card animate-fade-in mb-8 p-6">
            <h3 className="mb-4 font-semibold">Add Soroban Contract</h3>
            <form onSubmit={handleAddContract} className="flex gap-4">
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="Contract Name"
                className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                required
              />
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="Contract Address (C...)"
                className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                required
              />
              <Button type="submit">Add</Button>
              <Button variant="ghost" onClick={() => setShowAddContract(false)}>
                Cancel
              </Button>
            </form>
          </div>
        )}

        {/* Real-time Scan Progress Feedback & Results */}
        {(currentScanId || scanProgress.data) && (
          <div className="animate-fade-in mb-8">
            <ScanProgress
              progress={scanProgress}
              contractName={activeContractName}
              onRetry={() => {
                if (scanningContractId) {
                  handleScan(scanningContractId);
                }
              }}
            />
          </div>
        )}

        {/* Contracts List */}
        <div>
          <h2 className="font-heading mb-4 text-xl font-bold">Contracts</h2>
          {contracts.length === 0 ? (
            <div className="cyber-card p-8 text-center">
              <Shield className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
              <p className="text-muted-foreground mb-4">No contracts added yet</p>
              <Button variant="cyber" size="sm" onClick={() => setShowAddContract(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add First Contract
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {contracts.map((contract) => (
                <div key={contract.id} className="cyber-card flex items-center justify-between p-5">
                  <div>
                    <h3 className="font-semibold">{contract.name}</h3>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">
                      {truncateAddress(contract.address)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="cyber"
                      size="sm"
                      onClick={() => handleScan(contract.id)}
                      disabled={
                        scanningContractId === contract.id ||
                        (scanProgress.isPolling && currentScanId === contract.id)
                      }
                    >
                      {scanningContractId === contract.id ||
                      (scanProgress.isPolling && currentScanId === contract.id) ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-4 w-4" />
                      )}
                      Scan
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
