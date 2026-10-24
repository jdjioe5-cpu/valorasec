import type { Project, NetworkType, Report, ReportStatus } from '@valorasec/shared';

export interface ProjectFilterCriteria {
  search?: string;
  network?: NetworkType | 'all';
}

export function filterProjects(projects: Project[], criteria: ProjectFilterCriteria): Project[] {
  const query = criteria.search?.trim().toLowerCase() ?? '';
  const network = criteria.network ?? 'all';

  return projects.filter((project) => {
    const matchesSearch =
      query === '' ||
      project.name.toLowerCase().includes(query) ||
      (Boolean(project.description) && project.description!.toLowerCase().includes(query));

    const matchesNetwork = network === 'all' || project.network === network;

    return matchesSearch && matchesNetwork;
  });
}

export interface ReportFilterCriteria {
  search?: string;
  status?: ReportStatus | 'all';
  projectId?: string | 'all';
}

export function filterReports(reports: Report[], criteria: ReportFilterCriteria): Report[] {
  const query = criteria.search?.trim().toLowerCase() ?? '';
  const status = criteria.status ?? 'all';
  const projectId = criteria.projectId ?? 'all';

  return reports.filter((report) => {
    const matchesSearch =
      query === '' ||
      report.title.toLowerCase().includes(query) ||
      report.id.toLowerCase().includes(query) ||
      (Boolean(report.contractId) && report.contractId.toLowerCase().includes(query));

    const matchesStatus =
      status === 'all' ||
      (status === 'verified'
        ? report.status === 'verified' || report.verifiedOnChain === true
        : report.status === status);

    const matchesProject = projectId === 'all' || report.projectId === projectId;

    return matchesSearch && matchesStatus && matchesProject;
  });
}

export function countActiveProjectFilters(criteria: ProjectFilterCriteria): number {
  let count = 0;
  if (criteria.search?.trim()) count++;
  if (criteria.network && criteria.network !== 'all') count++;
  return count;
}

export function countActiveReportFilters(criteria: ReportFilterCriteria): number {
  let count = 0;
  if (criteria.search?.trim()) count++;
  if (criteria.status && criteria.status !== 'all') count++;
  if (criteria.projectId && criteria.projectId !== 'all') count++;
  return count;
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): {
  items: T[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
} {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = items.slice(start, start + pageSize);

  return {
    items: paginated,
    totalPages,
    currentPage,
    totalItems,
  };
}
