'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Shield, FileText, Loader2, Play, Activity, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
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
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'json') => {
    if (!project) return;
    setExporting(format);
    try {
      const data = await api.exportProject(projectId, format);
      const mime = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}-${project.id.slice(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
    }
  };

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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                disabled={!!exporting}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('json')}
                disabled={!!exporting}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                {exporting === 'json' ? 'Exporting...' : 'Export JSON'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddContract(!showAddContract)}>
                <Plus className="mr-2 h-4 w-4" /> Add Contract
              </Button>
            </div>
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

        {/* Scan Results */}
        {scanResult && (
          <div className="cyber-card border-primary/30 animate-fade-in mb-8 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="text-primary h-5 w-5" />
                <h3 className="font-semibold">Scan Complete</h3>
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
                Score: {scanResult.summary.score}/100
              </Badge>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              {Object.entries(scanResult.summary.bySeverity).map(([severity, count]) =>
                count > 0 ? (
                  <div key={severity} className="bg-accent/30 rounded-md p-2 text-center">
                    <div
                      className={`text-lg font-bold ${getSeverityClass(severity).replace(/severity-/, 'text-')}`}
                    >
                      {count}
                    </div>
                    <div className="text-muted-foreground text-xs capitalize">{severity}</div>
                  </div>
                ) : null,
              )}
            </div>
            <Link href={`/reports`}>
              <Button variant="cyber" size="sm">
                <FileText className="mr-2 h-4 w-4" /> View Report
              </Button>
            </Link>
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
                      disabled={scanning === contract.id}
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
    </div>
  );
}
