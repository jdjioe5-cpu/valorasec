# @valorasec/sdk

Official TypeScript/JavaScript SDK client for the ValoraSec smart contract security analysis platform.

## Features

- **Typed API Methods**: Full coverage of ValoraSec authentication, projects, contracts, scans, and reports.
- **Typed Error Hierarchy**: Categorized errors (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ServerError`, `TimeoutError`, `NetworkError`) with status codes and structured body payloads.
- **Automatic Retries & Exponential Backoff**: Transparently retries transient 5xx server errors and network dropouts with 1s, 2s, 4s exponential backoff.
- **Deterministic 4xx Handling**: Never retries client-side errors (400, 401, 403, 404, 409).
- **Configurable Request Timeouts**: Prevents hung connections (default 30s, configurable globally or per-request).
- **AbortController Cancellation**: Immediate request abort and cancellation support.
- **Retry Observability**: Emits typed retry events for logging, metrics, and tracing.

---

## Installation

```bash
pnpm add @valorasec/sdk
# or
npm install @valorasec/sdk
```

---

## Quickstart

```typescript
import { ValoraSecClient, AuthError, NotFoundError, TimeoutError } from '@valorasec/sdk';

const client = new ValoraSecClient({
  baseUrl: 'https://api.valorasec.com',
  accessToken: process.env.VALORASEC_ACCESS_TOKEN,
  timeout: 15_000, // 15 seconds
  maxRetries: 3, // 3 retries on 5xx/network errors
});

try {
  const profile = await client.getProfile();
  console.log('Logged in as:', profile.data.email);

  const projects = await client.getProjects({ page: 1, limit: 10 });
  console.log('Projects:', projects.data);
} catch (err) {
  if (err instanceof AuthError) {
    console.error('Session expired, please re-authenticate');
  } else if (err instanceof TimeoutError) {
    console.error(`Request timed out after ${err.timeoutMs}ms`);
  } else {
    console.error('API call failed:', err);
  }
}
```

---

## Configuration (`SdkConfig`)

`ValoraSecClient` accepts an `SdkConfig` object:

```typescript
export interface SdkConfig {
  /** Target API URL. Required. Trailing slashes are stripped automatically. */
  baseUrl: string;
  /** Initial bearer token for authenticated requests. */
  accessToken?: string;
  /** Refresh token used for automatic session renewal upon receiving 401. */
  refreshToken?: string;
  /** Request timeout in milliseconds (default: 30000ms / 30s). */
  timeout?: number;
  /** Max retry attempts for 5xx and network failures (default: 3). */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000ms). */
  retryDelayMs?: number;
  /** Callback fired whenever a retry attempt is scheduled. */
  onRetry?: (event: RetryEvent) => void;
}
```

---

## Timeout & Retry Behavior

### Automatic Retries

Network calls to distributed services are susceptible to transient network partitions and temporary overload. The SDK handles this automatically:

| Failure Type                                               | Retried? | Behavior                                                          |
| :--------------------------------------------------------- | :------: | :---------------------------------------------------------------- |
| **5xx Server Errors** (500, 502, 503, 504)                 | **Yes**  | Retried up to `maxRetries` (default: 3) with exponential backoff. |
| **Network / Connection Failures** (DNS drop, socket reset) | **Yes**  | Wrapped in `NetworkError` and retried up to `maxRetries`.         |
| **Request Timeout** (`TimeoutError`)                       | **Yes**  | Retried up to `maxRetries`.                                       |
| **4xx Client Errors** (400, 401, 403, 404, 409)            |  **No**  | Thrown immediately without retry.                                 |
| **Caller Cancellation** (`AbortSignal`)                    |  **No**  | Thrown immediately with abort reason.                             |

### Exponential Backoff Schedule

Retries back off exponentially to prevent thundering herds:

- **Attempt 1**: `retryDelayMs * 2^0` (default 1,000ms / 1s)
- **Attempt 2**: `retryDelayMs * 2^1` (default 2,000ms / 2s)
- **Attempt 3**: `retryDelayMs * 2^2` (default 4,000ms / 4s)

---

## Request Cancellation (`AbortController`)

Every API method accepts an optional `options?: RequestOptions` object supporting standard `AbortSignal`:

```typescript
const controller = new AbortController();

// Cancel request if user navigates away or cancels UI action
const promise = client.getScanDetails('scan-123', {
  signal: controller.signal,
});

// Cancel after 2 seconds or on user action
setTimeout(() => controller.abort(), 2000);
```

When aborted by the caller, execution terminates immediately without executing further retry attempts.

---

## Observability & Retry Events

Subscribe to retry lifecycle events for metrics or logging:

```typescript
// Via SdkConfig:
const client = new ValoraSecClient({
  baseUrl: 'https://api.valorasec.com',
  onRetry: (ev) => {
    console.warn(
      `[SDK Retry ${ev.attempt}/${ev.maxRetries}] ${ev.method} ${ev.url} failed. Waiting ${ev.delayMs}ms.`,
      ev.error,
    );
  },
});

// Or dynamically subscribe / unsubscribe:
const unsubscribe = client.onRetry((ev) => {
  metrics.increment('api_retries', { endpoint: ev.url, attempt: ev.attempt });
});

// To stop listening:
unsubscribe();
```

`RetryEvent` payload:

```typescript
interface RetryEvent {
  attempt: number; // 1-based retry index (1, 2, 3...)
  maxRetries: number; // Total retries configured
  delayMs: number; // Backoff delay before next attempt
  error: Error | ValoraSecError; // Triggering error
  url: string; // Full request URL
  method: string; // 'GET', 'POST', etc.
}
```

---

## Error Handling

All SDK exceptions inherit from `ValoraSecError`:

```typescript
import {
  ValoraSecError,
  ValidationError, // 400
  AuthError, // 401
  ForbiddenError, // 403
  NotFoundError, // 404
  ConflictError, // 409
  ServerError, // 5xx
  TimeoutError, // 408 / Timeout
  NetworkError, // 0 / Network failure
} from '@valorasec/sdk';
```
