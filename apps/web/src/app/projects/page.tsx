'use client';

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  ArrowRight,
  Loader2,
  AlertTriangle,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { filterProjects, countActiveProjectFilters, paginateItems } from '@/lib/filter-utils';
import { api } from '@/lib/api';
import type { Project, NetworkType } from '@valorasec/shared';

const ITEMS_PER_PAGE = 6;

function ProjectsContent() {
  const { shouldRender } = useAuthGuard();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial filter values from URL params
  const initialSearch = searchParams.get('search') ?? '';
  const initialNetwork = (searchParams.get('network') as NetworkType | 'all') ?? 'all';
  const initialPage = Number(searchParams.get('page') ?? '1');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [network, setNetwork] = useState<NetworkType | 'all'>(initialNetwork);
  const [page, setPage] = useState<number>(initialPage > 0 ? initialPage : 1);

  // Debounce search input by 300ms
  const debouncedSearch = useDebounce(searchInput, 300);

  // Sync state to URL params
  const updateUrlParams = useCallback(
    (newSearch: string, newNetwork: string, newPage: number) => {
      const params = new URLSearchParams();
      if (newSearch) params.set('search', newSearch);
      if (newNetwork !== 'all') params.set('network', newNetwork);
      if (newPage > 1) params.set('page', String(newPage));

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [pathname, router],
  );

  // When debounced search, network, or page changes, update URL
  useEffect(() => {
    updateUrlParams(debouncedSearch, network, page);
  }, [debouncedSearch, network, page, updateUrlParams]);

  useEffect(() => {
    if (!shouldRender) return;

    api
      .getProjects({ limit: 100 })
      .then((res) => setProjects(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shouldRender]);

  // Handle Search Input Change (resets page to 1)
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  // Handle Network Filter Change (resets page to 1)
  const handleNetworkChange = (value: NetworkType | 'all') => {
    setNetwork(value);
    setPage(1);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchInput('');
    setNetwork('all');
    setPage(1);
  };

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    return countActiveProjectFilters({ search: debouncedSearch, network });
  }, [debouncedSearch, network]);

  const hasActiveFilters = activeFilterCount > 0;

  // Filter projects by search and network
  const filteredProjects = useMemo(() => {
    return filterProjects(projects, { search: debouncedSearch, network });
  }, [projects, debouncedSearch, network]);

  // Paginated subset
  const pagination = useMemo(() => {
    return paginateItems(filteredProjects, page, ITEMS_PER_PAGE);
  }, [filteredProjects, page]);

  if (!shouldRender) return null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-8" tabIndex={-1}>
        {/* Header */}
        <div className="animate-fade-in mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

        {/* Search & Filter Controls */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative w-full max-w-md">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <label htmlFor="search-projects" className="sr-only">
                Search projects
              </label>
              <input
                id="search-projects"
                data-testid="projects-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search projects by name or description..."
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border py-2 pl-10 pr-9 text-sm focus:outline-none focus:ring-2"
              />
              {searchInput && (
                <button
                  type="button"
                  data-testid="clear-search-input-btn"
                  onClick={() => handleSearchChange('')}
                  className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
                  aria-label="Clear search query"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Network Filter Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="network-filter" className="sr-only">
                Filter by network
              </label>
              <select
                id="network-filter"
                data-testid="network-filter"
                value={network}
                onChange={(e) => handleNetworkChange(e.target.value as NetworkType | 'all')}
                className="border-input bg-background ring-offset-background text-foreground focus:ring-ring rounded-md border py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2"
              >
                <option value="all">All Networks</option>
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </div>
          </div>

          {/* Active Filter Indicators & Clear Action */}
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <>
                <Badge
                  variant="secondary"
                  data-testid="active-filter-badge"
                  className="flex items-center gap-1 text-xs"
                >
                  <Filter className="h-3 w-3" />
                  {activeFilterCount} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="clear-filters-btn"
                  onClick={handleClearFilters}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Clear filters
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div
            className="flex items-center justify-center py-32"
            role="status"
            aria-label="Loading projects"
          >
            <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading projects...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          hasActiveFilters ? (
            /* Filter Empty State */
            <div data-testid="filtered-empty-state" className="cyber-card p-12 text-center">
              <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
              <h3 className="mb-2 text-lg font-semibold">No results matching your filters</h3>
              <p className="text-muted-foreground mb-6">
                No projects matched your criteria. Try adjusting your search query or reset your
                filters.
              </p>
              <Button
                variant="outline"
                data-testid="clear-filters-empty-btn"
                onClick={handleClearFilters}
              >
                <X className="mr-2 h-4 w-4" /> Clear filters
              </Button>
            </div>
          ) : (
            /* Global Empty State */
            <div data-testid="global-empty-state" className="cyber-card p-12 text-center">
              <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
              <h3 className="mb-2 text-lg font-semibold">No projects found</h3>
              <p className="text-muted-foreground mb-6">
                Create your first project to get started with security audits.
              </p>
              <Link href="/projects/new">
                <Button variant="cyber">
                  <Plus className="mr-2 h-4 w-4" /> Create Project
                </Button>
              </Link>
            </div>
          )
        ) : (
          <>
            {/* Projects Grid */}
            <div
              data-testid="projects-grid"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {pagination.items.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  data-testid={`project-card-${project.id}`}
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
                    <Badge variant={project.network === 'mainnet' ? 'high' : 'low'}>
                      {project.network}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {project.contracts.length} contract
                      {project.contracts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div
                data-testid="pagination-controls"
                className="border-border/50 mt-8 flex items-center justify-between border-t pt-4"
              >
                <span data-testid="pagination-info" className="text-muted-foreground text-xs">
                  Page {page} of {pagination.totalPages} ({pagination.totalItems} total projects)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="prev-page-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="next-page-btn"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  >
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
