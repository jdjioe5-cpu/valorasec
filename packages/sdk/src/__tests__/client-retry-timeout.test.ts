import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ValoraSecClient,
  type SdkConfig,
  type RetryEvent,
  TimeoutError,
  NetworkError,
  ServerError,
  ValidationError,
  AuthError,
  NotFoundError,
} from '../index';

describe('@valorasec/sdk client retry & timeout (issue #47)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Configuration & Defaults', () => {
    it('initializes with default timeout (30s) and maxRetries (3)', async () => {
      const client = new ValoraSecClient({ baseUrl: 'https://api.valorasec.com' });
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: 'u1' } }),
      });
      globalThis.fetch = mockFetch;

      const res = await client.getProfile();
      expect(res.data).toEqual({ id: 'u1' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('allows overriding timeout and maxRetries via SdkConfig', async () => {
      const config: SdkConfig = {
        baseUrl: 'https://api.valorasec.com',
        timeout: 5000,
        maxRetries: 2,
        retryDelayMs: 10,
      };
      const client = new ValoraSecClient(config);

      const mockFetch = vi.fn().mockRejectedValue(new Error('connection reset'));
      globalThis.fetch = mockFetch;

      await expect(client.getProfile()).rejects.toThrow();
      // 1 initial + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('5xx Error Retries & Exponential Backoff', () => {
    it('retries up to 3 times on 5xx errors and recovers if subsequent attempt succeeds', async () => {
      const events: RetryEvent[] = [];
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        maxRetries: 3,
        retryDelayMs: 5,
        onRetry: (ev) => events.push(ev),
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: async () => ({ error: 'service_unavailable', message: 'Busy' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 'p1', name: 'Alpha' } }),
        };
      });

      const res = await client.getProject('p1');
      expect(res.data.name).toEqual('Alpha');
      expect(callCount).toBe(3);
      expect(events).toHaveLength(2);

      const first = events[0]!;
      expect(first.attempt).toBe(1);
      expect(first.maxRetries).toBe(3);
      expect(first.delayMs).toBe(5);
      expect(first.error).toBeInstanceOf(ServerError);
      expect(first.url).toBe('https://api.valorasec.com/api/projects/p1');
      expect(first.method).toBe('GET');

      const second = events[1]!;
      expect(second.attempt).toBe(2);
      expect(second.delayMs).toBe(10); // 5 * 2^1
    });

    it('throws ServerError after exhausting maxRetries on continuous 5xx', async () => {
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        maxRetries: 3,
        retryDelayMs: 2,
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'internal_error', message: 'Fatal' }),
      });

      await expect(client.getProfile()).rejects.toThrow(ServerError);
      expect(globalThis.fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe('Network Failure Retries', () => {
    it('retries on network failures (e.g. TypeError fetch failed) with backoff', async () => {
      const events: RetryEvent[] = [];
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        maxRetries: 2,
        retryDelayMs: 5,
        onRetry: (ev) => events.push(ev),
      });

      let attempts = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        };
      });

      const res = await client.getContracts('proj-1');
      expect(res.data).toEqual([]);
      expect(attempts).toBe(2);
      expect(events).toHaveLength(1);
      expect(events[0]!.error).toBeInstanceOf(NetworkError);
    });
  });

  describe('4xx Client Errors - Never Retried', () => {
    it('does not retry 400 ValidationError', async () => {
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        maxRetries: 3,
        retryDelayMs: 5,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'validation_error', message: 'Name required' }),
      });
      globalThis.fetch = mockFetch;

      await expect(client.createProject({ name: '', network: 'testnet' })).rejects.toThrow(
        ValidationError,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry 404 NotFoundError', async () => {
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        maxRetries: 3,
        retryDelayMs: 5,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'not_found', message: 'Missing' }),
      });
      globalThis.fetch = mockFetch;

      await expect(client.getProject('unknown')).rejects.toThrow(NotFoundError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry 401 AuthError when token refresh fails or is absent', async () => {
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        maxRetries: 3,
        retryDelayMs: 5,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'unauthorized', message: 'Invalid credentials' }),
      });
      globalThis.fetch = mockFetch;

      await expect(client.getProfile()).rejects.toThrow(AuthError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configurable Timeout & TimeoutError', () => {
    it('aborts request and throws TimeoutError when request exceeds timeout limit', async () => {
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        timeout: 50,
        maxRetries: 1,
        retryDelayMs: 5,
      });

      globalThis.fetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              reject(init.signal?.reason ?? new Error('Aborted'));
            });
          }
        });
      });

      await expect(client.getProfile()).rejects.toThrow(TimeoutError);
      // 1 initial + 1 retry = 2 attempts
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('allows per-request timeout override', async () => {
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        timeout: 10000,
        maxRetries: 0,
      });

      globalThis.fetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              reject(init.signal?.reason ?? new Error('Aborted'));
            });
          }
        });
      });

      await expect(client.getProfile({ timeout: 20 })).rejects.toThrow(TimeoutError);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('AbortController Cancellation Support', () => {
    it('aborts request immediately when external AbortSignal is cancelled without retrying', async () => {
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        maxRetries: 3,
        retryDelayMs: 50,
      });

      const controller = new AbortController();

      globalThis.fetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason ?? new Error('Caller cancelled'));
          });
        });
      });

      const promise = client.getProfile({ signal: controller.signal });
      controller.abort(new Error('Caller cancelled'));

      await expect(promise).rejects.toThrow('Caller cancelled');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Observability & Event Emission', () => {
    it('notifies listeners registered via onRetry() and unsubscribe removes listener', async () => {
      const client = new ValoraSecClient({
        baseUrl: 'https://api.valorasec.com',
        maxRetries: 2,
        retryDelayMs: 2,
      });

      const events: RetryEvent[] = [];
      const unsubscribe = client.onRetry((ev) => events.push(ev));

      let call = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        call++;
        if (call === 1) {
          return {
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            json: async () => ({ message: 'Bad Gateway' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { status: 'ok' } }),
        };
      });

      await client.getProfile();
      expect(events).toHaveLength(1);
      expect(events[0]!.attempt).toBe(1);

      // Unsubscribe and test subsequent retry
      unsubscribe();
      call = 0;
      await client.getProfile();
      // Should not add any new events because listener was removed
      expect(events).toHaveLength(1);
    });
  });
});
