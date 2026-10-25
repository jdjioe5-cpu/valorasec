'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Archive,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import type { Project } from '@valorasec/shared';

export default function ProjectsPage() {
  const { shouldRender } = useAuthGuard();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Modal states
  const [modalConfig, setModalConfig] = useState<{
    open: boolean;
    type: 'archive' | 'restore' | 'delete';
    project: Project | null;
    loading: boolean;
  }>({
    open: false,
    type: 'archive',
    project: null,
    loading: false,
  });

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getProjects({ limit: 50, includeArchived });
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    if (!shouldRender) return;
    loadProjects();
  }, [shouldRender, loadProjects]);

  const handleActionConfirm = async () => {
    const { type, project } = modalConfig;
    if (!project) return;

    setModalConfig((prev) => ({ ...prev, loading: true }));
    try {
      if (type === 'archive') {
        await api.archiveProject(project.id);
      } else if (type === 'restore') {
        await api.restoreProject(project.id);
      } else if (type === 'delete') {
        await api.deleteProject(project.id);
      }
      setModalConfig((prev) => ({ ...prev, open: false, loading: false }));
      await loadProjects();
    } catch (err) {
      console.error(err);
      setModalConfig((prev) => ({ ...prev, loading: false }));
    }
  };

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  if (!shouldRender) return null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-8" tabIndex={-1}>
        <div className="animate-fade-in mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage your Soroban smart contract projects
            </p>
          </div>
          <Link href="/projects/new">
            <Button variant="cyber">
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <label htmlFor="search-projects" className="sr-only">
              Search projects
            </label>
            <input
              id="search-projects"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              id="include-archived"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
            />
            <span>Show archived projects</span>
          </label>
        </div>

        {loading ? (
          <div
            className="flex items-center justify-center py-32"
            role="status"
            aria-label="Loading projects"
          >
            <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading projects...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cyber-card p-12 text-center">
            <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
            <h3 className="mb-2 text-lg font-semibold">No projects found</h3>
            <p className="text-muted-foreground mb-6">
              {search
                ? 'No projects match your search.'
                : includeArchived
                  ? 'No archived or active projects found.'
                  : 'Create your first project to get started.'}
            </p>
            {!search && (
              <Link href="/projects/new">
                <Button variant="cyber">
                  <Plus className="mr-2 h-4 w-4" /> Create Project
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => {
              const isArchived = project.status === 'archived';

              return (
                <div
                  key={project.id}
                  className={`cyber-card flex flex-col justify-between p-6 transition-all ${
                    isArchived ? 'border-dashed border-amber-500/40 opacity-80' : ''
                  }`}
                >
                  <div>
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="hover:text-primary flex items-center gap-1.5 truncate font-semibold transition-colors"
                      >
                        <span className="truncate">{project.name}</span>
                        <ArrowRight className="text-muted-foreground inline h-4 w-4 shrink-0" />
                      </Link>
                      {isArchived ? (
                        <Badge variant="high" className="shrink-0 text-xs">
                          Archived
                        </Badge>
                      ) : (
                        <Badge variant="low" className="shrink-0 text-xs">
                          {project.network}
                        </Badge>
                      )}
                    </div>

                    {project.description && (
                      <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">
                        {project.description}
                      </p>
                    )}
                  </div>

                  <div className="border-border/50 flex items-center justify-between border-t pt-4">
                    <span className="text-muted-foreground text-xs">
                      {project.contracts?.length ?? 0} contract
                      {(project.contracts?.length ?? 0) !== 1 ? 's' : ''}
                    </span>

                    <div className="flex items-center gap-2">
                      {isArchived ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-primary h-8 text-xs"
                            onClick={() =>
                              setModalConfig({
                                open: true,
                                type: 'restore',
                                project,
                                loading: false,
                              })
                            }
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs"
                            onClick={() =>
                              setModalConfig({
                                open: true,
                                type: 'delete',
                                project,
                                loading: false,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground h-8 text-xs hover:text-amber-500"
                            onClick={() =>
                              setModalConfig({
                                open: true,
                                type: 'archive',
                                project,
                                loading: false,
                              })
                            }
                            title="Archive project"
                          >
                            <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive h-8 text-xs"
                            onClick={() =>
                              setModalConfig({
                                open: true,
                                type: 'delete',
                                project,
                                loading: false,
                              })
                            }
                            title="Delete project"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            ? `Are you sure you want to archive "${modalConfig.project?.name}"? It will be hidden from default listings and can be restored within 30 days before being permanently removed.`
            : modalConfig.type === 'restore'
              ? `Restore "${modalConfig.project?.name}" to active status? It will reappear in your default project listings.`
              : `Are you sure you want to permanently delete "${modalConfig.project?.name}" and all associated contracts, scans, and audit reports? This cascade deletion cannot be undone.`
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
