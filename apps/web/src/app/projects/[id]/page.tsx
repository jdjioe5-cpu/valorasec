'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Shield,
  Loader2,
  Play,
  Archive,
  RotateCcw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import { formatDate, getSeverityClass, truncateAddress } from '@/lib/utils';
import type { Project, Contract, ScanResult } from '@valorasec/shared';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { shouldRender } = useAuthGuard();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const [showAddContract, setShowAddContract] = useState(false);
  const [contractName, setContractName] = useState('');
  const [contractAddress, setContractAddress] = useState('');

  // Confirmation modal
  const [modalConfig, setModalConfig] = useState<{
    open: boolean;
    type: 'archive' | 'restore' | 'delete';
    loading: boolean;
  }>({
    open: false,
    type: 'archive',
    loading: false,
  });

  const loadProject = useCallback(async () => {
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
  }, [projectId, router]);

  useEffect(() => {
    if (!shouldRender) return;
    loadProject();
  }, [projectId, shouldRender, loadProject]);

  const handleActionConfirm = async () => {
    const { type } = modalConfig;
    setModalConfig((prev) => ({ ...prev, loading: true }));
    try {
      if (type === 'archive') {
        const res = await api.archiveProject(projectId);
        setProject(res.data);
        setModalConfig((prev) => ({ ...prev, open: false, loading: false }));
      } else if (type === 'restore') {
        const res = await api.restoreProject(projectId);
        setProject(res.data);
        setModalConfig((prev) => ({ ...prev, open: false, loading: false }));
      } else if (type === 'delete') {
        await api.deleteProject(projectId);
        setModalConfig((prev) => ({ ...prev, open: false, loading: false }));
        router.push('/projects');
      }
    } catch (err) {
      console.error(err);
      setModalConfig((prev) => ({ ...prev, loading: false }));
    }
  };

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
    setScanning(contractId);
    setScanResult(null);
    try {
      const res = await api.runScan(projectId, contractId);
      setScanResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(null);
    }
  };

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

  const isArchived = project.status === 'archived';

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading text-3xl font-bold">{project.name}</h1>
                {isArchived && (
                  <Badge variant="high" className="text-xs">
                    Archived
                  </Badge>
                )}
              </div>
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

            <div className="flex flex-wrap items-center gap-2">
              {isArchived ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setModalConfig({ open: true, type: 'restore', loading: false })}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Restore Project
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setModalConfig({ open: true, type: 'delete', loading: false })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setShowAddContract(!showAddContract)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Contract
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-amber-500"
                    onClick={() => setModalConfig({ open: true, type: 'archive', loading: false })}
                  >
                    <Archive className="mr-2 h-4 w-4" /> Archive
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setModalConfig({ open: true, type: 'delete', loading: false })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Archived Banner */}
        {isArchived && (
          <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="flex-1 text-sm">
                <strong className="font-semibold text-amber-300">This project is archived.</strong>{' '}
                It will be permanently deleted along with all its contracts, scans, and reports
                after the 30-day recovery window. You can restore it at any time within this window.
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-500/40 bg-transparent text-amber-200 hover:bg-amber-500/20"
                onClick={() => setModalConfig({ open: true, type: 'restore', loading: false })}
              >
                Restore Now
              </Button>
            </div>
          </div>
        )}

        {/* Add Contract Form */}
        {showAddContract && !isArchived && (
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

        {/* Scan Results */}
        {scanResult && (
          <div className="cyber-card border-primary/30 animate-fade-in mb-8 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Latest Scan Results</h3>
              <Badge
                variant={
                  scanResult.summary.score >= 80
                    ? 'low'
                    : scanResult.summary.score >= 50
                      ? 'medium'
                      : 'critical'
                }
              >
                Security Score: {scanResult.summary.score}/100
              </Badge>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <span className="text-muted-foreground text-xs">Total Findings</span>
                <p className="font-heading text-xl font-bold">{scanResult.summary.totalFindings}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <span className="text-muted-foreground text-xs">Critical</span>
                <p className="font-heading text-destructive text-xl font-bold">
                  {scanResult.summary.bySeverity.critical}
                </p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <span className="text-muted-foreground text-xs">High</span>
                <p className="font-heading text-xl font-bold text-orange-400">
                  {scanResult.summary.bySeverity.high}
                </p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <span className="text-muted-foreground text-xs">Medium</span>
                <p className="font-heading text-xl font-bold text-yellow-400">
                  {scanResult.summary.bySeverity.medium}
                </p>
              </div>
            </div>

            {scanResult.findings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-muted-foreground text-sm font-medium">Findings</h4>
                {scanResult.findings.map((f) => (
                  <div
                    key={f.id}
                    className="bg-background/40 flex items-start justify-between rounded-md p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{f.title}</span>
                        <span className={`text-xs uppercase ${getSeverityClass(f.severity)}`}>
                          [{f.severity}]
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">{f.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contracts List */}
        <div>
          <h2 className="font-heading mb-4 text-xl font-bold">Contracts</h2>
          {contracts.length === 0 ? (
            <div className="cyber-card p-8 text-center">
              <Shield className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
              <p className="text-muted-foreground mb-4">No contracts added yet</p>
              {!isArchived && (
                <Button variant="cyber" size="sm" onClick={() => setShowAddContract(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add First Contract
                </Button>
              )}
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
                      disabled={scanning === contract.id || isArchived}
                    >
                      {scanning === contract.id ? (
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

      {/* Confirmation Modal */}
      <ConfirmModal
        open={modalConfig.open}
        onOpenChange={(open) => setModalConfig((prev) => ({ ...prev, open }))}
        title={
          modalConfig.type === 'archive'
            ? 'Archive Project'
            : modalConfig.type === 'restore'
              ? 'Restore Project'
              : 'Permanently Delete Project'
        }
        description={
          modalConfig.type === 'archive'
            ? `Are you sure you want to archive "${project.name}"? It will be removed from default listings and can be restored within 30 days before permanent deletion.`
            : modalConfig.type === 'restore'
              ? `Restore "${project.name}" to active status? You will be able to add contracts and run scans again.`
              : `Are you sure you want to permanently delete "${project.name}" and all associated contracts, scans, and audit reports? This cascade deletion cannot be undone.`
        }
        confirmText={
          modalConfig.type === 'archive'
            ? 'Archive'
            : modalConfig.type === 'restore'
              ? 'Restore'
              : 'Delete Permanently'
        }
        variant={
          modalConfig.type === 'restore'
            ? 'cyber'
            : modalConfig.type === 'archive'
              ? 'default'
              : 'destructive'
        }
        loading={modalConfig.loading}
        onConfirm={handleActionConfirm}
      />
    </div>
  );
}
