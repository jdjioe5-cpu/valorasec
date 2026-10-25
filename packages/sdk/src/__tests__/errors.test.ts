import { describe, it, expect } from 'vitest';
import {
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServerError,
  ValidationError,
  ValoraSecError,
  errorForStatus,
} from '../errors';

describe('@valorasec/sdk typed errors (issue #50)', () => {
  describe('errorForStatus HTTP mapping', () => {
    it('maps 400 to ValidationError', () => {
      const err = errorForStatus(400, 'bad input', { code: 'invalid_payload' });
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(ValoraSecError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('invalid_payload');
      expect(err.message).toBe('bad input');
    });

    it('maps 401 to AuthError', () => {
      const err = errorForStatus(401, 'token expired', { code: 'auth_expired' });
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('auth_expired');
    });

    it('maps 403 to ForbiddenError', () => {
      const err = errorForStatus(403, 'not allowed');
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
    });

    it('maps 404 to NotFoundError', () => {
      const err = errorForStatus(404, 'missing', { code: 'not_found' });
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe('not_found');
    });

    it('maps 409 to ConflictError', () => {
      const err = errorForStatus(409, 'duplicate');
      expect(err).toBeInstanceOf(ConflictError);
    });

    it('maps 5xx range to ServerError', () => {
      for (const code of [500, 502, 503, 504]) {
        const err = errorForStatus(code, 'downstream');
        expect(err).toBeInstanceOf(ServerError);
        expect(err.statusCode).toBe(code);
      }
    });

    it('falls back to plain ValoraSecError for unknown status codes', () => {
      const err = errorForStatus(418, "I'm a teapot");
      expect(err.constructor).toBe(ValoraSecError);
      expect(err.statusCode).toBe(418);
      expect(err.message).toBe("I'm a teapot");
    });
  });

  describe('ValoraSecError fields', () => {
    it('preserves the original body on the error', () => {
      const body = { error: 'invalid_payload', message: 'field x required' };
      const err = errorForStatus(400, body.message, { code: body.error, body });
      expect(err.body).toEqual(body);
    });

    it('preserves the cause when callers attach one', () => {
      const cause = new Error('transport reset');
      const err = errorForStatus(503, 'upstream', { cause });
      expect((err as Error & { cause?: unknown }).cause).toBe(cause);
    });

    it('defaults code to empty string when the server omits it', () => {
      const err = errorForStatus(500, 'boom');
      expect(err.code).toBe('');
    });
  });
});
