import {
  type ApiError,
  type ApiSuccess,
  type AuthTokens,
  type Contract,
  type LoginRequest,
  type NetworkType,
  type PaginatedResponse,
  type Project,
  type RegisterRequest,
  type Report,
  type ScanResult,
  type User,
  type SessionInfo,
  type RevokeSessionsResponse,
} from '@valorasec/shared';

export {
  AuthError,
  ConflictError,
  errorForStatus,
  ForbiddenError,
  NotFoundError,
  ServerError,
  ValidationError,
  ValoraSecError,
} from './errors';
import { errorForStatus } from './errors';

export interface SdkConfig {
  baseUrl: string;
  accessToken?: string;
  refreshToken?: string;
}

export class ValoraSecClient {
  private baseUrl: string;
  private accessToken: string | null;
  private refreshToken: string | null;
  private onTokenRefresh?: (tokens: AuthTokens) => void;

  constructor(config: SdkConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken ?? null;
    this.refreshToken = config.refreshToken ?? null;
  }

  setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
  }

  setOnTokenRefresh(callback: (tokens: AuthTokens) => void): void {
    this.onTokenRefresh = callback;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    // Attempt token refresh on 401
    if (res.status === 401 && this.refreshToken) {
      const refreshRes = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (refreshRes.ok) {
        const tokens: AuthTokens = await refreshRes.json();
        this.setTokens(tokens);
        this.onTokenRefresh?.(tokens);
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        res = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
        });
      }
    }

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as ApiError | null;
      throw errorForStatus(res.status, errorBody?.message ?? res.statusText, {
        code: errorBody?.error,
        body: errorBody ?? undefined,
      });
    }

    return res.json();
  }

  // ─── Auth ──────────────────────────────────────────────────────────

  async register(data: RegisterRequest): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.accessToken = null;
    this.refreshToken = null;
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // ─── Users ─────────────────────────────────────────────────────────

  async getProfile(): Promise<ApiSuccess<User>> {
    return this.request('/api/users/profile');
  }

  // ─── Projects ──────────────────────────────────────────────────────

  async getProjects(params?: {
    page?: number;
    limit?: number;
    search?: string;
    network?: NetworkType;
  }): Promise<PaginatedResponse<Project>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.network) query.set('network', params.network);

    const qs = query.toString();
    return this.request(`/api/projects${qs ? `?${qs}` : ''}`);
  }

  async getProject(id: string): Promise<ApiSuccess<Project>> {
    return this.request(`/api/projects/${id}`);
  }

  async createProject(data: {
    name: string;
    description?: string;
    network: NetworkType;
  }): Promise<ApiSuccess<Project>> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(
    id: string,
    data: Partial<Pick<Project, 'name' | 'description'>>,
  ): Promise<ApiSuccess<Project>> {
    return this.request(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/api/projects/${id}`, { method: 'DELETE' });
  }

  // ─── Contracts ─────────────────────────────────────────────────────

  async getContracts(projectId: string): Promise<ApiSuccess<Contract[]>> {
    return this.request(`/api/projects/${projectId}/contracts`);
  }

  async createContract(
    projectId: string,
    data: { name: string; address: string; network: NetworkType },
  ): Promise<ApiSuccess<Contract>> {
    return this.request(`/api/projects/${projectId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── Scans ─────────────────────────────────────────────────────────

  async runScan(projectId: string, contractId: string): Promise<ApiSuccess<ScanResult>> {
    return this.request(`/api/projects/${projectId}/contracts/${contractId}/scan`, {
      method: 'POST',
    });
  }

  async getScanDetails(scanId: string): Promise<ApiSuccess<ScanResult>> {
    return this.request(`/api/scans/${scanId}`);
  }

  async getScanHistory(
    contractId: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<ScanResult>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    return this.request(`/api/contracts/${contractId}/scans${qs ? `?${qs}` : ''}`);
  }

  // ─── Reports ───────────────────────────────────────────────────────

  async getReports(params?: {
    page?: number;
    limit?: number;
    projectId?: string;
  }): Promise<PaginatedResponse<Report>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.projectId) query.set('projectId', params.projectId);

    const qs = query.toString();
    return this.request(`/api/reports${qs ? `?${qs}` : ''}`);
  }

  async getReport(id: string): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/${id}`);
  }

  async generateReport(scanId: string): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/scans/${scanId}/report`, {
      method: 'POST',
    });
  }

  async registerOnChain(reportId: string): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/${reportId}/register`, {
      method: 'POST',
    });
  }

  // ─── Session Management (Issue #18) ──────────────────────────────────

  async getSessions(currentRefreshToken?: string): Promise<ApiSuccess<SessionInfo[]>> {
    const qs = currentRefreshToken
      ? '?currentRefreshToken=' + encodeURIComponent(currentRefreshToken)
      : '';
    return this.request('/api/auth/sessions' + qs);
  }

  async revokeSession(id: string): Promise<ApiSuccess<{ success: boolean; message: string }>> {
    return this.request('/api/auth/sessions/' + id, {
      method: 'DELETE',
    });
  }

  async revokeOtherSessions(
    currentRefreshToken?: string,
  ): Promise<ApiSuccess<RevokeSessionsResponse>> {
    const qs = currentRefreshToken
      ? '?currentRefreshToken=' + encodeURIComponent(currentRefreshToken)
      : '';
    return this.request('/api/auth/sessions' + qs, {
      method: 'DELETE',
    });
  }
}
