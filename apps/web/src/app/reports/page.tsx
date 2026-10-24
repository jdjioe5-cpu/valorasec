'use client';

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  FileText,
  ArrowRight,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Search,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { filterReports, countActiveReportFilters, paginateItems } from '@/lib/filter-utils';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Report, ReportStatus, Project } from '@valorasec/shared';

const ITEMS_PER_PAGE = 8;

type StatusFilter = 'all' | ReportStatus;

function ReportsContent() {
  const { shouldRender } = useAuthGuard();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial filter values from URL params
  const initialSearch = searchParams.get('search') ?? '';
  const initialStatus = (searchParams.get('status') as StatusFilter) ?? 'all';
  const initialProjectId = searchParams.get('projectId') ?? 'all';
  const initialPage = Number(searchParams.get('page') ?? '1');

  const [reports, setReports] = useState<Report[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [projectId, setProjectId] = useState<string>(initialProjectId);
  const [page, setPage] = useState<number>(initialPage > 0 ? initialPage : 1);

  // Debounce search input by 300ms
  const debouncedSearch = useDebounce(searchInput, 300);

  // Map project ID to Project for fast lookups
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const proj of projects) {
      map.set(proj.id, proj);
    }
    return map;
  }, [projects]);

  // Sync state to URL params
  const updateUrlParams = useCallback(
    (newSearch: string, newStatus: string, newProjId: string, newPage: number) => {
      const params = new URLSearchParams();
      if (newSearch) params.set('search', newSearch);
      if (newStatus !== 'all') params.set('status', newStatus);
      if (newProjId !== 'all') params.set('projectId', newProjId);
      if (newPage > 1) params.set('page', String(newPage));

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    updateUrlParams(debouncedSearch, status, projectId, page);
  }, [debouncedSearch, status, projectId, page, updateUrlParams]);

  useEffect(() => {
    if (!shouldRender) return;

    Promise.all([
      api.getReports({ limit: 100 }).then((res) => res.data),
      api
        .getProjects({ limit: 100 })
        .then((res) => res.data)
        .catch(() => [] as Project[]),
    ])
      .then(([reportsData, projectsData]) => {
        setReports(reportsData);
        setProjects(projectsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shouldRender]);

  // Handle Search Input Change (resets page to 1)
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  // Handle Status Filter Change (resets page to 1)
  const handleStatusChange = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  // Handle Project Filter Change (resets page to 1)
  const handleProjectChange = (value: string) => {
    setProjectId(value);
    setPage(1);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchInput('');
    setStatus('all');
    setProjectId('all');
    setPage(1);
  };

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    return countActiveReportFilters({
      search: debouncedSearch,
      status,
      projectId,
    });
  }, [debouncedSearch, status, projectId]);

  const hasActiveFilters = activeFilterCount > 0;

  // Filter reports by search, status, and project
  const filteredReports = useMemo(() => {
    return filterReports(reports, {
      search: debouncedSearch,
      status,
      projectId,
    });
  }, [reports, debouncedSearch, status, projectId]);

  // Paginated subset
  const pagination = useMemo(() => {
    return paginateItems(filteredReports, page, ITEMS_PER_PAGE);
  }, [filteredReports, page]);

  if (!shouldRender) return null;

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-6 py-8" tabIndex={-1}>
        {/* Header */}
        <div className="animate-fade-in mb-8">
          <h1 className="font-heading mb-2 text-3xl font-bold">Audit Reports</h1>
          <p className="text-muted-foreground">View and manage your security audit reports</p>
        </div>

        {/* Search & Filter Controls */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative w-full max-w-md">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <label htmlFor="search-reports" className="sr-only">
                Search reports
              </label>
              <input
                id="search-reports"
                data-testid="reports-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search reports by title, ID, or contract..."
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

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="sr-only">
                Filter by status
              </label>
              <select
                id="status-filter"
                data-testid="status-filter"
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
                className="border-input bg-background ring-offset-background text-foreground focus:ring-ring rounded-md border py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="verified">Verified</option>
              </select>
            </div>

            {/* Project Filter Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="project-filter" className="sr-only">
                Filter by project
              </label>
              <select
                id="project-filter"
                data-testid="project-filter"
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="border-input bg-background ring-offset-background text-foreground focus:ring-ring max-w-[200px] truncate rounded-md border py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2"
              >
                <option value="all">All Projects</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
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
            aria-label="Loading reports"
          >
            <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading reports...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          hasActiveFilters ? (
            /* Filter Empty State */
            <div data-testid="filtered-empty-state" className="cyber-card p-12 text-center">
              <AlertTriangle className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
              <h3 className="mb-2 text-lg font-semibold">No results matching your filters</h3>
              <p className="text-muted-foreground mb-6">
                No reports matched your criteria. Try adjusting your search query or reset your
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
              <h3 className="mb-2 text-lg font-semibold">No reports yet</h3>
              <p className="text-muted-foreground mb-6">
                Run a security scan on one of your contracts to generate your first report.
              </p>
              <Link href="/projects">
                <Button variant="cyber">
                  <ArrowRight className="mr-2 h-4 w-4" /> Go to Projects
                </Button>
              </Link>
            </div>
          )
        ) : (
          <>
            {/* Reports List */}
            <div data-testid="reports-list" className="space-y-3">
              {pagination.items.map((report) => {
                const projectName = projectMap.get(report.projectId)?.name;

                return (
                  <Link
                    key={report.id}
                    href={`/reports/${report.id}`}
                    data-testid={`report-card-${report.id}`}
                    className="cyber-card-hover flex items-center justify-between p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                        <FileText className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{report.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={report.verifiedOnChain ? 'low' : 'medium'}>
                            {report.verifiedOnChain ? (
                              <>
                                <ShieldCheck className="mr-1 h-3 w-3" /> Verified
                              </>
                            ) : (
                              report.status
                            )}
                          </Badge>
                          {projectName && (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                              <FolderGit2 className="h-3 w-3" />
                              {projectName}
                            </span>
                          )}
                          <span className="text-muted-foreground text-xs">
                            {formatDate(report.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="text-muted-foreground h-4 w-4" />
                  </Link>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div
                data-testid="pagination-controls"
                className="border-border/50 mt-8 flex items-center justify-between border-t pt-4"
              >
                <span data-testid="pagination-info" className="text-muted-foreground text-xs">
                  Page {page} of {pagination.totalPages} ({pagination.totalItems} total reports)
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

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
