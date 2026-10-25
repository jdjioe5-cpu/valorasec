/**
 * Typed errors thrown by `@valorasec/sdk` consumers.
 */

export class ValoraSecError extends Error {
  readonly statusCode: number;
  readonly code: string;
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
    case 409:
      return new ConflictError(message, options);
    default:
      if (status >= 500) {
        return new ServerError(message, { statusCode: status, ...options });
      }
      return new ValoraSecError(message, { statusCode: status, ...options });
  }
}
