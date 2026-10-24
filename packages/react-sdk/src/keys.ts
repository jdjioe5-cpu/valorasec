import type { NetworkType } from '@valorasec/shared';

export interface ProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  network?: NetworkType;
}

export interface ReportListParams {
  page?: number;
  limit?: number;
  projectId?: string;
}

export interface ScanHistoryParams {
  page?: number;
  limit?: number;
}

export const valoraSecQueryKeys = {
  all: ['valorasec'] as const,
  projects: () => [...valoraSecQueryKeys.all, 'projects'] as const,
  projectList: (params?: ProjectListParams) =>
    [...valoraSecQueryKeys.projects(), 'list', params ?? {}] as const,
  projectDetails: (id: string) => [...valoraSecQueryKeys.projects(), 'detail', id] as const,
  projectContracts: (projectId: string) =>
    [...valoraSecQueryKeys.projects(), 'contracts', projectId] as const,
  reports: () => [...valoraSecQueryKeys.all, 'reports'] as const,
  reportList: (params?: ReportListParams) =>
    [...valoraSecQueryKeys.reports(), 'list', params ?? {}] as const,
  reportDetails: (id: string) => [...valoraSecQueryKeys.reports(), 'detail', id] as const,
  scans: () => [...valoraSecQueryKeys.all, 'scans'] as const,
  scanDetails: (scanId: string) => [...valoraSecQueryKeys.scans(), 'detail', scanId] as const,
  scanHistory: (contractId: string, params?: ScanHistoryParams) =>
    [...valoraSecQueryKeys.scans(), 'history', contractId, params ?? {}] as const,
  auth: () => [...valoraSecQueryKeys.all, 'auth'] as const,
  profile: () => [...valoraSecQueryKeys.auth(), 'profile'] as const,
};
