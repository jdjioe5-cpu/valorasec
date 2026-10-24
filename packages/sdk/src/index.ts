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
} from '@valorasec/shared';

export {
  AuthError,
  ConflictError,
  errorForStatus,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  ServerError,
  TimeoutError,
  ValidationError,
  ValoraSecError,
} from './errors';
import { errorForStatus, NetworkError, TimeoutError, ValoraSecError } from './errors';

/** Configuration options for the ValoraSec SDK client. */
export interface SdkConfig {
  baseUrl: string;
  accessToken?: string;
  refreshToken?: string;
  /** Request timeout in milliseconds (default: 30000ms / 30s). */
  timeout?: number;
  /** Max retry attempts on 5xx errors and network failures (default: 3). */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000ms). */
  retryDelayMs?: number;
  /** Callback emitted when a retry attempt occurs. */
  onRetry?: RetryListener;
}

/** Request options extending standard RequestInit with SDK retry/timeout controls. */
export interface RequestOptions extends RequestInit {
  /** Override timeout in milliseconds for this specific request. */
  timeout?: number;
  /** Override max retries for this specific request. */
  maxRetries?: number;
  /** Override base retry delay for this specific request. */
  retryDelayMs?: number;
}

/** Emitted whenever a request fails with a retryable error and backoff is scheduled. */
export interface RetryEvent {
  /** 1-based index of this retry attempt (1, 2, 3...). */
  attempt: number;
  /** Total retry attempts configured for this request. */
  maxRetries: number;
  /** Backoff delay in milliseconds before the next attempt executes. */
  delayMs: number;
  /** The error or response failure that triggered the retry. */
  error: Error | ValoraSecError;
  /** Full URL of the request. */
  url: string;
  /** HTTP method of the request. */
  method: string;
}

export type RetryListener = (event: RetryEvent) => void;

export class ValoraSecClient {
  private baseUrl: string;
  private accessToken: string | null;
  private refreshToken: string | null;
  private timeout: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private onTokenRefresh?: (tokens: AuthTokens) => void;
  private retryListeners: Set<RetryListener> = new Set();

  constructor(config: SdkConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken ?? null;
    this.refreshToken = config.refreshToken ?? null;
    this.timeout = config.timeout ?? 30_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1_000;
    if (config.onRetry) {
      this.retryListeners.add(config.onRetry);
    }
  }

  setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
  }

  setOnTokenRefresh(callback: (tokens: AuthTokens) => void): void {
    this.onTokenRefresh = callback;
  }

  /**
   * Register a listener to observe retry attempts (e.g. for telemetry, logging).
   * Returns an unsubscribe function.
   */
  onRetry(callback: RetryListener): () => void {
    this.retryListeners.add(callback);
    return () => {
      this.retryListeners.delete(callback);
    };
  }

  private emitRetry(event: RetryEvent): void {
    for (const listener of this.retryListeners) {
      try {
        listener(event);
      } catch {
        // Observers should never crash the retry cycle
      }
    }
  }

  private async sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
    if (ms <= 0) return;
    if (signal?.aborted) {
      throw signal.reason ?? new Error('Aborted');
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal?.reason ?? new Error('Aborted'));
      };
      const timer = setTimeout(() => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        resolve();
      }, ms);
      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const fullUrl = `${this.baseUrl}${path}`;
    const method = options.method?.toUpperCase() ?? 'GET';
    const effectiveTimeout = options.timeout ?? this.timeout;
    const effectiveMaxRetries = options.maxRetries ?? this.maxRetries;
    const effectiveDelayMs = options.retryDelayMs ?? this.retryDelayMs;

    let attempt = 0;

    while (true) {
      if (options.signal?.aborted) {
        throw options.signal.reason ?? new Error('Aborted');
      }

      // Configure AbortController for per-attempt timeout and user cancellation
      const controller = new AbortController();
      let isTimedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      if (effectiveTimeout > 0) {
        timer = setTimeout(() => {
          isTimedOut = true;
          controller.abort(
            new TimeoutError(`Request timed out after ${effectiveTimeout}ms`, {
              timeoutMs: effectiveTimeout,
            }),
          );
        }, effectiveTimeout);
      }

      // Forward external caller abort to controller
      const userSignal = options.signal;
      const onUserAbort = () => {
        controller.abort(userSignal?.reason ?? new Error('Aborted'));
      };
      if (userSignal) {
        if (userSignal.aborted) {
          if (timer) clearTimeout(timer);
          throw userSignal.reason ?? new Error('Aborted');
        }
        userSignal.addEventListener('abort', onUserAbort, { once: true });
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      try {
        let res = await fetch(fullUrl, {
          ...options,
          headers,
          signal: controller.signal,
        });

        // Attempt token refresh on 401 if refreshToken is present
        if (res.status === 401 && this.refreshToken) {
          const refreshRes = await fetch(`${this.baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: this.refreshToken }),
            signal: controller.signal,
          });

          if (refreshRes.ok) {
            const tokens: AuthTokens = await refreshRes.json();
            this.setTokens(tokens);
            this.onTokenRefresh?.(tokens);
            headers['Authorization'] = `Bearer ${tokens.accessToken}`;
            res = await fetch(fullUrl, {
              ...options,
              headers,
              signal: controller.signal,
            });
          }
        }

        if (!res.ok) {
          const errorBody = (await res.json().catch(() => null)) as ApiError | null;
          const statusError = errorForStatus(res.status, errorBody?.message ?? res.statusText, {
            code: errorBody?.error,
            body: errorBody ?? undefined,
          });

          // 4xx errors should never be retried
          if (res.status >= 400 && res.status < 500) {
            throw statusError;
          }

          // 5xx errors: retry if attempts remaining
          if (res.status >= 500 && attempt < effectiveMaxRetries) {
            const delay = effectiveDelayMs * Math.pow(2, attempt);
            this.emitRetry({
              attempt: attempt + 1,
              maxRetries: effectiveMaxRetries,
              delayMs: delay,
              error: statusError,
              url: fullUrl,
              method,
            });
            attempt++;
            await this.sleep(delay, userSignal);
            continue;
          }

          throw statusError;
        }

        return (await res.json()) as T;
      } catch (err: unknown) {
        // If external user signal was triggered, rethrow without retrying
        if (userSignal?.aborted) {
          throw userSignal.reason ?? err;
        }

        // If it's a client 4xx ValoraSecError, do not retry
        if (
          err instanceof ValoraSecError &&
          err.statusCode >= 400 &&
          err.statusCode < 500 &&
          !(err instanceof TimeoutError)
        ) {
          throw err;
        }

        // Normalize network or timeout error
        let candidateError: Error | ValoraSecError;
        if (isTimedOut) {
          candidateError =
            err instanceof TimeoutError
              ? err
              : new TimeoutError(`Request timed out after ${effectiveTimeout}ms`, {
                  timeoutMs: effectiveTimeout,
                  cause: err,
                });
        } else if (err instanceof ValoraSecError) {
          candidateError = err;
        } else {
          candidateError = new NetworkError(
            err instanceof Error ? err.message : 'Network request failed',
            { cause: err },
          );
        }

        // Retry transient failure (5xx, timeout, network failure)
        if (attempt < effectiveMaxRetries) {
          const delay = effectiveDelayMs * Math.pow(2, attempt);
          this.emitRetry({
            attempt: attempt + 1,
            maxRetries: effectiveMaxRetries,
            delayMs: delay,
            error: candidateError,
            url: fullUrl,
            method,
          });
          attempt++;
          await this.sleep(delay, userSignal);
          continue;
        }

        throw candidateError;
      } finally {
        if (timer) clearTimeout(timer);
        if (userSignal) {
          userSignal.removeEventListener('abort', onUserAbort);
        }
      }
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────

  async register(
    data: RegisterRequest,
    options?: RequestOptions,
  ): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/register', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(
    data: LoginRequest,
    options?: RequestOptions,
  ): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/login', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(options?: RequestOptions): Promise<void> {
    await this.request('/api/auth/logout', { ...options, method: 'POST' });
    this.accessToken = null;
    this.refreshToken = null;
  }

  async refreshTokens(
    refreshToken: string,
    options?: RequestOptions,
  ): Promise<ApiSuccess<{ user: User; tokens: AuthTokens }>> {
    return this.request('/api/auth/refresh', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // ─── Users ─────────────────────────────────────────────────────────

  async getProfile(options?: RequestOptions): Promise<ApiSuccess<User>> {
    return this.request('/api/users/profile', options);
  }

  // ─── Projects ──────────────────────────────────────────────────────

  async getProjects(
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      network?: NetworkType;
    },
    options?: RequestOptions,
  ): Promise<PaginatedResponse<Project>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.network) query.set('network', params.network);

    const qs = query.toString();
    return this.request(`/api/projects${qs ? `?${qs}` : ''}`, options);
  }

  async getProject(id: string, options?: RequestOptions): Promise<ApiSuccess<Project>> {
    return this.request(`/api/projects/${id}`, options);
  }

  async createProject(
    data: {
      name: string;
      description?: string;
      network: NetworkType;
    },
    options?: RequestOptions,
  ): Promise<ApiSuccess<Project>> {
    return this.request('/api/projects', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(
    id: string,
    data: Partial<Pick<Project, 'name' | 'description'>>,
    options?: RequestOptions,
  ): Promise<ApiSuccess<Project>> {
    return this.request(`/api/projects/${id}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string, options?: RequestOptions): Promise<void> {
    await this.request(`/api/projects/${id}`, { ...options, method: 'DELETE' });
  }

  // ─── Contracts ─────────────────────────────────────────────────────

  async getContracts(projectId: string, options?: RequestOptions): Promise<ApiSuccess<Contract[]>> {
    return this.request(`/api/projects/${projectId}/contracts`, options);
  }

  async createContract(
    projectId: string,
    data: { name: string; address: string; network: NetworkType },
    options?: RequestOptions,
  ): Promise<ApiSuccess<Contract>> {
    return this.request(`/api/projects/${projectId}/contracts`, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── Scans ─────────────────────────────────────────────────────────

  async runScan(
    projectId: string,
    contractId: string,
    options?: RequestOptions,
  ): Promise<ApiSuccess<ScanResult>> {
    return this.request(`/api/projects/${projectId}/contracts/${contractId}/scan`, {
      ...options,
      method: 'POST',
    });
  }

  async getScanDetails(scanId: string, options?: RequestOptions): Promise<ApiSuccess<ScanResult>> {
    return this.request(`/api/scans/${scanId}`, options);
  }

  async getScanHistory(
    contractId: string,
    params?: { page?: number; limit?: number },
    options?: RequestOptions,
  ): Promise<PaginatedResponse<ScanResult>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    return this.request(`/api/contracts/${contractId}/scans${qs ? `?${qs}` : ''}`, options);
  }

  // ─── Reports ───────────────────────────────────────────────────────

  async getReports(
    params?: {
      page?: number;
      limit?: number;
      projectId?: string;
    },
    options?: RequestOptions,
  ): Promise<PaginatedResponse<Report>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.projectId) query.set('projectId', params.projectId);

    const qs = query.toString();
    return this.request(`/api/reports${qs ? `?${qs}` : ''}`, options);
  }

  async getReport(id: string, options?: RequestOptions): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/${id}`, options);
  }

  async generateReport(scanId: string, options?: RequestOptions): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/scans/${scanId}/report`, {
      ...options,
      method: 'POST',
    });
  }

  async registerOnChain(reportId: string, options?: RequestOptions): Promise<ApiSuccess<Report>> {
    return this.request(`/api/reports/${reportId}/register`, {
      ...options,
      method: 'POST',
    });
  }
}
