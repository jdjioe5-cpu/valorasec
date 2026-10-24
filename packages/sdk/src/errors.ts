/**
 * Typed errors thrown by `@valorasec/sdk` consumers.
 *
 * The SDK previously threw plain `Error` objects with a `[<statusCode>] <message>`
 * payload which forced callers to parse strings for routing. Issue #50 replaces
 * that surface with a small hierarchy keyed on HTTP status (and an optional
 * `code` field matching the API's `ApiError.code` for programmatic handling).
 * Issue #47 adds `TimeoutError` and `NetworkError` for transient failure handling.
 *
 * Each error type:
 *   - extends `ValoraSecError` (so callers can `instanceof` the parent and
 *     inspect `statusCode` + `code` uniformly)
 *   - carries its semantically meaningful HTTP status code in `statusCode`
 *   - forwards `message`, `code`, and the original response body when present
 *     via `cause` so the JSON body is not lost behind the wrapper
 *
 * Consumers can write:
 *   try {
 *     await client.getProfile();
 *   } catch (err) {
 *     if (err instanceof AuthError) return redirectToLogin();
 *     if (err instanceof NotFoundError) return render404();
 *     if (err instanceof TimeoutError) return showTimeoutRetry();
 *     throw err;
 *   }
 *
 * `code` matches the API's typed `ApiError.code` field. The exact set of
 * codes is owned by the server; this client treats it as opaque.
 */

/**
 * Base error class for every typed error thrown by the SDK.
 * Catch it when you only care about "the SDK failed" without branching on
 * the specific reason.
 */
export class ValoraSecError extends Error {
  /** HTTP status code that triggered the error (0 means network / unknown / timeout). */
  readonly statusCode: number;
  /** Stable API error code from the server, or empty string if absent. */
  readonly code: string;
  /** Original response body when available, kept for diagnostics. */
  readonly body: unknown;

  constructor(
    message: string,
    options: { statusCode: number; code?: string; body?: unknown; cause?: unknown } = {
      statusCode: 0,
    },
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.code = options.code ?? '';
    this.body = options.body;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/** 400 Bad Request — validation failure or malformed input. */
export class ValidationError extends ValoraSecError {
  constructor(message: string, options: { code?: string; body?: unknown; cause?: unknown } = {}) {
    super(message, { statusCode: 400, ...options });
  }
}

/** 401 Unauthorized — credentials missing, expired, or invalid. */
export class AuthError extends ValoraSecError {
  constructor(message: string, options: { code?: string; body?: unknown; cause?: unknown } = {}) {
    super(message, { statusCode: 401, ...options });
  }
}

/** 403 Forbidden — credentials valid but caller lacks permission. */
export class ForbiddenError extends ValoraSecError {
  constructor(message: string, options: { code?: string; body?: unknown; cause?: unknown } = {}) {
    super(message, { statusCode: 403, ...options });
  }
}

/** 404 Not Found — resource does not exist (or is hidden behind auth). */
export class NotFoundError extends ValoraSecError {
  constructor(message: string, options: { code?: string; body?: unknown; cause?: unknown } = {}) {
    super(message, { statusCode: 404, ...options });
  }
}

/** 409 Conflict — duplicate resource, stale version, or other state mismatch. */
export class ConflictError extends ValoraSecError {
  constructor(message: string, options: { code?: string; body?: unknown; cause?: unknown } = {}) {
    super(message, { statusCode: 409, ...options });
  }
}

/** 5xx Server Error — server-side fault, transient or persistent. */
export class ServerError extends ValoraSecError {
  constructor(
    message: string,
    options: { statusCode?: number; code?: string; body?: unknown; cause?: unknown } = {},
  ) {
    super(message, { statusCode: options.statusCode ?? 500, ...options });
  }
}

/** Request timed out before completing (Issue #47). */
export class TimeoutError extends ValoraSecError {
  readonly timeoutMs: number;

  constructor(
    message = 'Request timed out',
    options: { timeoutMs?: number; code?: string; body?: unknown; cause?: unknown } = {},
  ) {
    super(message, { statusCode: 408, code: options.code ?? 'timeout', ...options });
    this.timeoutMs = options.timeoutMs ?? 0;
  }
}

/** Network connectivity failure or connection error (Issue #47). */
export class NetworkError extends ValoraSecError {
  constructor(message: string, options: { code?: string; body?: unknown; cause?: unknown } = {}) {
    super(message, { statusCode: 0, code: options.code ?? 'network_error', ...options });
  }
}

/** Map an HTTP status code to the matching ValoraSecError constructor. */
export function errorForStatus(
  status: number,
  message: string,
  options: { code?: string; body?: unknown; cause?: unknown } = {},
): ValoraSecError {
  switch (status) {
    case 400:
      return new ValidationError(message, options);
    case 401:
      return new AuthError(message, options);
    case 403:
      return new ForbiddenError(message, options);
    case 404:
      return new NotFoundError(message, options);
    case 408:
      return new TimeoutError(message, options);
    case 409:
      return new ConflictError(message, options);
    default:
      if (status >= 500) {
        return new ServerError(message, { statusCode: status, ...options });
      }
      return new ValoraSecError(message, { statusCode: status, ...options });
  }
}
