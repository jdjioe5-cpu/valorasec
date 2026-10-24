import {
  type ApiError,
  type ApiSuccess,
  type AuditRecord,
  type AuthTokens,
  type Contract,
  type Finding,
  type LoginRequest,
  type NetworkType,
  type Notification,
  type NotificationType,
  type PaginatedResponse,
  type Project,
  type RegisterRequest,
  type Report,
  type ReportStatus,
  type ScanResult,
  type ScanStatus,
  type ScanSummary,
  type Severity,
  type User,
  type UserRole,
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

// ─── Exported Domain Types ───────────────────────────────────────────────────

export type {
  ApiError,
  ApiSuccess,
  AuditRecord,
  AuthTokens,
  Contract,
  Finding,
  LoginRequest,
  NetworkType,
  Notification,
  NotificationType,
  PaginatedResponse,
  Project,
  RegisterRequest,
  Report,
  ReportStatus,
  ScanResult,
  ScanStatus,
  ScanSummary,
  Severity,
  User,
  UserRole,
};

/** Request payload for updating user profile attributes. */
export interface UpdateProfileRequest {
  name?: string;
  avatarUrl?: string;
}

/** Pagination query parameters for notification listing. */
export interface NotificationQueryParams {
  page?: number;
  limit?: number;
}

/** Pagination query parameters for contract scan history. */
export interface ScanHistoryQueryParams {
  page?: number;
  limit?: number;
}

/** Filter and pagination query parameters for project listing. */
export interface ProjectQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  network?: NetworkType;
}

/** Filter and pagination query parameters for report listing. */
export interface ReportQueryParams {
  page?: number;
  limit?: number;
  projectId?: string;
}

/** Configuration options required to instantiate the ValoraSec SDK client. */
export interface SdkConfig {
  baseUrl: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Official client for interacting with the ValoraSec API platform.
 */
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

  /**
   * Set or update active authentication tokens.
   */
  setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
  }

  /**
   * Register a callback triggered when authentication tokens are refreshed automatically.
   */
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

  /**
   * Register a new user account.
   *
   * @param data - Registration credentials (email, password, name).
   * @returns User profile and initial authentication tokens.
   */
  async register(data: RegisterRequest): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Authenticate an existing user with email and password.
   *
   * @param data - User login credentials.
   * @returns User profile and authentication tokens.
   */
  async login(data: LoginRequest): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Log out the current user session and revoke local tokens.
   */
  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Manually exchange a refresh token for new access and refresh tokens.
   *
   * @param refreshToken - Valid refresh token string.
   * @returns Updated tokens and user details.
   */
  async refreshTokens(
    refreshToken: string,
  ): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // ─── Users & Profile ─────────────────────────────────────────────────

  /**
   * Fetch profile information for the authenticated user.
   *
   * @returns The user's account details.
   */
  async getProfile(): Promise<ApiSuccess<User>> {
    return this.request('/api/users/profile');
  }

  /**
   * Update profile information (e.g. display name, avatar URL) for the authenticated user.
   *
   * @param data - Profile fields to update.
   * @returns Updated user record.
   */
  async updateProfile(data: UpdateProfileRequest): Promise<ApiSuccess<User>> {
    return this.request('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ─── Notifications ───────────────────────────────────────────────────

  /**
   * Retrieve a paginated list of notifications for the authenticated user.
   *
   * @param params - Optional pagination query parameters (page, limit).
   * @returns Paginated notification list.
   */
  async getNotifications(
    params?: NotificationQueryParams,
  ): Promise<PaginatedResponse<Notification>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    return this.request(`/api/notifications${qs ? `?${qs}` : ''}`);
  }

  /**
   * Mark a specific notification as read by its unique identifier.
   *
   * @param id - Notification identifier.
   * @returns Success response with confirmation message.
   */
  async markNotificationRead(id: string): Promise<ApiSuccess<{ message: string }>> {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  /**
   * Mark all unread notifications as read for the authenticated user.
   *
   * @returns Success response with confirmation message.
   */
  async markAllNotificationsRead(): Promise<ApiSuccess<{ message: string }>> {
    return this.request('/api/notifications/read-all', {
      method: 'PATCH',
    });
  }

  // ─── Projects ──────────────────────────────────────────────────────

  /**
   * Fetch a paginated list of security projects matching optional filters.
   *
   * @param params - Optional query filters (page, limit, search, network).
   * @returns Paginated project list.
   */
  async getProjects(params?: ProjectQueryParams): Promise<PaginatedResponse<Project>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.network) query.set('network', params.network);

    const qs = query.toString();
    return this.request(`/api/projects${qs ? `?${qs}` : ''}`);
  }

  /**
   * Retrieve details for a single project by ID.
   *
   * @param id - Project identifier.
   * @returns Project record with linked contracts.
   */
  async getProject(id: string): Promise<ApiSuccess<Project>> {
    return this.request(`/api/projects/${id}`);
  }

  /**
   * Create a new project workspace.
   *
   * @param data - Project creation parameters (name, network, description).
   * @returns Created project record.
   */
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

  /**
   * Update an existing project's metadata.
   *
   * @param id - Project identifier.
   * @param data - Name or description updates.
   * @returns Updated project record.
   */
  async updateProject(
    id: string,
    data: Partial<Pick<Project, 'name' | 'description'>>,
  ): Promise<ApiSuccess<Project>> {
    return this.request(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a project and its associated scan data.
   *
   * @param id - Project identifier.
   */
  async deleteProject(id: string): Promise<void> {
    await this.request(`/api/projects/${id}`, { method: 'DELETE' });
  }

  // ─── Contracts ─────────────────────────────────────────────────────

  /**
   * List all smart contracts registered under a given project.
   *
   * @param projectId - Project identifier.
   * @returns List of contract records.
   */
  async getContracts(projectId: string): Promise<ApiSuccess<Contract[]>> {
    return this.request(`/api/projects/${projectId}/contracts`);
  }

  /**
   * Register a new smart contract to a project.
   *
   * @param projectId - Project identifier.
   * @param data - Contract address, name, and network type.
   * @returns Created contract record.
   */
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

  /**
   * Trigger an automated security scan on a registered contract.
   *
   * @param projectId - Project identifier.
   * @param contractId - Target contract identifier.
   * @returns Initiated scan result with findings.
   */
  async runScan(projectId: string, contractId: string): Promise<ApiSuccess<ScanResult>> {
    return this.request(`/api/projects/${projectId}/contracts/${contractId}/scan`, {
      method: 'POST',
    });
  }

  /**
   * Retrieve full details and findings for a specific scan execution.
   *
   * @param scanId - Scan identifier.
   * @returns Scan details, summary score, and findings.
   */
  async getScanDetails(scanId: string): Promise<ApiSuccess<ScanResult>> {
    return this.request(`/api/scans/${scanId}`);
  }

  /**
   * Retrieve historical scan executions for a specific contract.
   *
   * @param contractId - Target contract identifier.
   * @param params - Optional pagination parameters (page, limit).
   * @returns Paginated list of scan results.
   */
  async getContractScans(
    contractId: string,
    params?: ScanHistoryQueryParams,
  ): Promise<PaginatedResponse<ScanResult>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    return this.request(`/api/contracts/${contractId}/scans${qs ? `?${qs}` : ''}`);
  }

  /**
   * Retrieve historical scan executions for a contract (alias for getContractScans).
   *
   * @param contractId - Target contract identifier.
   * @param params - Optional pagination parameters (page, limit).
   * @returns Paginated list of scan results.
   */
  async getScanHistory(
    contractId: string,
    params?: ScanHistoryQueryParams,
  ): Promise<PaginatedResponse<ScanResult>> {
    return this.getContractScans(contractId, params);
  }

  // ─── Reports ───────────────────────────────────────────────────────

  /**
   * Retrieve a paginated list of security audit reports.
   *
   * @param params - Optional filters (page, limit, projectId).
   * @returns Paginated list of reports.
   */
  async getReports(params?: ReportQueryParams): Promise<PaginatedResponse<Report>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.projectId) query.set('projectId', params.projectId);

    const qs = query.toString();
    return this.request(`/api/reports${qs ? `?${qs}` : ''}`);
  }

  /**
   * Fetch an audit report by its unique identifier.
   *
   * @param id - Report identifier.
   * @returns Report details and findings.
   */
  async getReport(id: string): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/${id}`);
  }

  /**
   * Compile and generate a formalized audit report from a completed scan.
   *
   * @param scanId - Scan identifier.
   * @returns Generated report.
   */
  async generateReport(scanId: string): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/scans/${scanId}/report`, {
      method: 'POST',
    });
  }

  /**
   * Register a verified security report on the Stellar / Soroban audit registry contract.
   *
   * @param reportId - Report identifier.
   * @returns Updated report with on-chain transaction hash.
   */
  async registerOnChain(reportId: string): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/${reportId}/register`, {
      method: 'POST',
    });
  }

  // ─── Audit Registry ────────────────────────────────────────────────

  /**
   * List all on-chain audit records registered for a specific project.
   *
   * @param projectId - Project identifier.
   * @returns List of audit records.
   */
  async getAuditRecords(projectId: string): Promise<ApiSuccess<AuditRecord[]>> {
    return this.request(`/api/audit-registry/project/${projectId}`);
  }

  /**
   * Retrieve an on-chain audit record by its linked report ID.
   *
   * @param reportId - Security report identifier.
   * @returns The matching audit record.
   */
  async getAuditRecord(reportId: string): Promise<ApiSuccess<AuditRecord>> {
    return this.request(`/api/audit-registry/report/${reportId}`);
  }
}
