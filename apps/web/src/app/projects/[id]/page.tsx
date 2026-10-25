'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  Shield,
  FileText,
  Loader2,
  Play,
  Activity,
  Edit3,
  Trash2,
  Check,
  X,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { DeleteProjectModal } from '@/components/projects/delete-project-modal';
import { ScanHistoryTimeline } from '@/components/projects/scan-history-timeline';
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
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Add Contract Form State
  const [showAddContract, setShowAddContract] = useState(false);
  const [contractName, setContractName] = useState('');
  const [contractAddress, setContractAddress] = useState('');

  // Inline Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!shouldRender) return;

    let isMounted = true;
    async function load() {
      try {
        const res = await api.getProject(projectId);
        if (!isMounted) return;
        setProject(res.data);
        const projectContracts = res.data.contracts ?? [];
        setContracts(projectContracts);
        setEditName(res.data.name);
        setEditDesc(res.data.description ?? '');

        // Fetch scan history for contracts
        if (projectContracts.length > 0) {
          setHistoryLoading(true);
          try {
            const historyPromises = projectContracts.map((c) =>
              api.getScanHistory(c.id).catch(() => ({ data: [] as ScanResult[] })),
            );
            const results = await Promise.all(historyPromises);
            if (isMounted) {
              const combined = results.flatMap((r) => r.data ?? []);
              combined.sort(
                (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
              );
              setScanHistory(combined);
            }
          } finally {
            if (isMounted) setHistoryLoading(false);
          }
        }
      } catch (err) {
        console.error(err);
        if (isMounted) router.push('/projects');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [projectId, shouldRender]);

  const contractMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of contracts) {
      map[c.id] = c.name;
    }
    return map;
  }, [contracts]);

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractName || !contractAddress) return;

    try {
      const res = await api.createContract(projectId, {
        name: contractName,
        address: contractAddress,
        network: project?.network ?? 'testnet',
      });
      const newContract = res.data;
      setContracts((prev) => [...prev, newContract]);
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
      const newScan = res.data;
      setScanResult(newScan);
      // Optimistically append to timeline
      setScanHistory((prev) => [newScan, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(null);
    }
  };

  const handleSaveInlineEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setSavingEdit(true);
    try {
      const res = await api.updateProject(projectId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setProject(res.data);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      await api.deleteProject(projectId);
      setShowDeleteModal(false);
      router.push('/projects');
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  };

  if (!shouldRender || loading) {
    return (
      <div className="bg-background min-h-screen">
        <Navbar />
        <div
          className="flex items-center justify-center py-32"
          role="status"
          aria-label="Loading project details"
        >
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <span className="sr-only">Loading project details...</span>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6" tabIndex={-1}>
        {/* Breadcrumb Navigation (Dashboard > Projects > [Project Name]) */}
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground mb-6 flex items-center gap-1.5 text-xs font-medium"
        >
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="text-muted-foreground/60 h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/projects" className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <ChevronRight className="text-muted-foreground/60 h-3.5 w-3.5" aria-hidden="true" />
          <span
            className="text-foreground max-w-[200px] truncate sm:max-w-none"
            aria-current="page"
          >
            {project.name}
          </span>
        </nav>

        {/* Project Header Card */}
        <div className="cyber-card mb-8 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Title / Description Area (or Inline Edit Form) */}
            <div className="flex-1 space-y-3">
              {!isEditing ? (
                <>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge variant="low" className="capitalize">
                      {project.network}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Created {formatDate(project.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <h1
                      data-testid="project-title"
                      className="font-heading text-2xl font-bold md:text-3xl"
                    >
                      {project.name}
                    </h1>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditName(project.name);
                        setEditDesc(project.description ?? '');
                        setIsEditing(true);
                      }}
                      data-testid="edit-project-btn"
                      className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                      title="Edit project name and description"
                      aria-label="Edit project name and description"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>

                  {project.description ? (
                    <p
                      data-testid="project-description"
                      className="text-muted-foreground max-w-2xl text-sm leading-relaxed"
                    >
                      {project.description}
                    </p>
                  ) : (
                    <p className="text-muted-foreground/60 text-xs italic">
                      No description provided. Click edit to add details.
                    </p>
                  )}
                </>
              ) : (
                /* Inline Edit Form */
                <form
                  onSubmit={handleSaveInlineEdit}
                  className="animate-fade-in max-w-xl space-y-3"
                >
                  <div>
                    <label
                      htmlFor="edit-project-name"
                      className="text-muted-foreground text-xs font-semibold uppercase tracking-wider"
                    >
                      Project Name
                    </label>
                    <input
                      id="edit-project-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      data-testid="edit-project-name-input"
                      className="border-input bg-background focus:ring-ring mt-1 block w-full rounded-md border px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-project-desc"
                      className="text-muted-foreground text-xs font-semibold uppercase tracking-wider"
                    >
                      Description (Optional)
                    </label>
                    <textarea
                      id="edit-project-desc"
                      rows={2}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      data-testid="edit-project-desc-input"
                      placeholder="Add an overview of this Soroban smart contract project..."
                      className="border-input bg-background focus:ring-ring mt-1 block w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="submit"
                      variant="cyber"
                      size="sm"
                      disabled={savingEdit}
                      data-testid="save-project-btn"
                      className="text-xs"
                    >
                      {savingEdit ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Save Changes
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      disabled={savingEdit}
                      className="text-xs"
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Quick Actions (Add Contract, Delete Project) */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddContract(!showAddContract)}
                data-testid="toggle-add-contract-btn"
                className="text-xs"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Contract
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                data-testid="delete-project-btn"
                className="text-xs"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Project
              </Button>
            </div>
          </div>
        </div>

        {/* Add Contract Form Drawer */}
        {showAddContract && (
          <div className="cyber-card animate-fade-in mb-8 p-6" data-testid="add-contract-card">
            <h3 className="font-heading mb-4 text-base font-semibold">
              Add Soroban Smart Contract
            </h3>
            <form onSubmit={handleAddContract} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="Contract Name (e.g. VaultCore)"
                data-testid="add-contract-name-input"
                className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                required
              />
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="Contract Address (e.g. C...)"
                data-testid="add-contract-address-input"
                className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-2 font-mono text-sm text-xs focus:outline-none focus:ring-2"
                required
              />
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" data-testid="submit-contract-btn">
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddContract(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Live Scan Results Banner (if active) */}
        {scanResult && (
          <div
            className="cyber-card border-primary/40 animate-fade-in mb-8 p-6"
            data-testid="live-scan-result-banner"
          >
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Activity className="text-primary h-5 w-5 animate-pulse" />
                <h3 className="text-foreground font-semibold">Scan Complete</h3>
              </div>
              <Badge
                variant={
                  scanResult.summary.score >= 70
                    ? 'low'
                    : scanResult.summary.score >= 40
                      ? 'medium'
                      : 'critical'
                }
              >
                Security Score: {scanResult.summary.score}/100
              </Badge>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(scanResult.summary.bySeverity).map(([severity, count]) => (
                <div key={severity} className="bg-accent/30 rounded-md p-2.5 text-center">
                  <div
                    className={`text-lg font-bold ${getSeverityClass(severity).replace(/severity-/, 'text-')}`}
                  >
                    {count}
                  </div>
                  <div className="text-muted-foreground text-xs capitalize">{severity}</div>
                </div>
              ))}
            </div>
            <Link href="/reports">
              <Button variant="cyber" size="sm" className="text-xs">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> View Audit Reports
              </Button>
            </Link>
          </div>
        )}

        {/* Contracts Section */}
        <section aria-labelledby="contracts-heading" className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-primary h-5 w-5" />
              <h2 id="contracts-heading" className="font-heading text-xl font-bold">
                Contracts ({contracts.length})
              </h2>
            </div>
          </div>

          {contracts.length === 0 ? (
            <div className="cyber-card p-8 text-center" data-testid="contracts-empty-state">
              <Shield className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
              <h4 className="text-foreground font-semibold">No Contracts Registered</h4>
              <p className="text-muted-foreground mb-4 mt-1 text-sm">
                Add your deployed Soroban smart contract addresses to start scanning for
                vulnerabilities.
              </p>
              <Button
                variant="cyber"
                size="sm"
                onClick={() => setShowAddContract(true)}
                data-testid="add-first-contract-btn"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add First Contract
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {contracts.map((contract) => (
                <div
                  key={contract.id}
                  data-testid={`contract-card-${contract.id}`}
                  className="cyber-card flex flex-col justify-between gap-4 p-5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-foreground font-semibold">{contract.name}</h3>
                      <Badge variant="low" className="text-[10px]">
                        {contract.network}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground font-mono text-xs">
                      {truncateAddress(contract.address)}
                    </p>
                  </div>

                  <div className="border-border/40 flex items-center justify-between border-t pt-2">
                    <span className="text-muted-foreground text-[11px]">
                      Added {formatDate(contract.createdAt)}
                    </span>
                    <Button
                      variant="cyber"
                      size="sm"
                      onClick={() => handleScan(contract.id)}
                      disabled={scanning === contract.id}
                      data-testid={`run-scan-btn-${contract.id}`}
                      className="text-xs"
                    >
                      {scanning === contract.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {scanning === contract.id ? 'Scanning...' : 'Run Scan'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Scan History Timeline Section */}
        <section aria-labelledby="scan-history-heading">
          <div className="mb-4 flex items-center gap-2">
            <History className="text-primary h-5 w-5" />
            <h2 id="scan-history-heading" className="font-heading text-xl font-bold">
              Scan History Timeline
            </h2>
          </div>

          <ScanHistoryTimeline
            scans={scanHistory}
            contractMap={contractMap}
            isLoading={historyLoading}
          />
        </section>
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteProjectModal
        isOpen={showDeleteModal}
        projectName={project.name}
        isDeleting={deleting}
        onConfirm={handleDeleteProject}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
