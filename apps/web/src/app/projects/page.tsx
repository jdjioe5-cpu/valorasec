'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { ProjectsSkeleton } from '@/components/skeletons/projects-skeleton';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import type { Project } from '@valorasec/shared';

export default function ProjectsPage() {
  const { shouldRender } = useAuthGuard();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!shouldRender) return;

    api
      .getProjects({ limit: 50 })
      .then((res) => setProjects(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shouldRender]);

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

        <div className="mb-6">
          <div className="relative max-w-md">
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
        </div>

        {loading ? (
          <ProjectsSkeleton />
        ) : filtered.length === 0 ? (
          <div className="cyber-card p-12 text-center">
            <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
            <h3 className="mb-2 text-lg font-semibold">No projects found</h3>
            <p className="text-muted-foreground mb-6">
              {search
                ? 'No projects match your search.'
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
            {filtered.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="cyber-card-hover p-6"
              >
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="truncate font-semibold">{project.name}</h3>
                  <ArrowRight className="text-muted-foreground mt-1 h-4 w-4 flex-shrink-0" />
                </div>
                {project.description && (
                  <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="low">{project.network}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {project.contracts.length} contract{project.contracts.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
