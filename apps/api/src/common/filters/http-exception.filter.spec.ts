import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
  let mockRequest: {
    url: string;
    originalUrl: string;
    method: string;
    headers: Record<string, string>;
    user?: { sub: string };
    requestId?: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    mockRequest = {
      url: '/api/test',
      originalUrl: '/api/test',
      method: 'POST',
      headers: { 'x-request-id': 'req-test-123' },
      user: { sub: 'user-abc' },
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should format 400 Bad Request exception correctly', () => {
    const exception = new BadRequestException('Invalid email address');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-test-123');
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        path: '/api/test',
        method: 'POST',
        requestId: 'req-test-123',
        message: 'Invalid email address',
        error: 'Bad Request',
      }),
    );
  });

  it('should format 401 Unauthorized exception correctly', () => {
    const exception = new UnauthorizedException('Token has expired');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'Token has expired',
        error: 'Unauthorized',
      }),
    );
  });

  it('should format 403 Forbidden exception correctly', () => {
    const exception = new ForbiddenException('Insufficient permissions');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Insufficient permissions',
        error: 'Forbidden',
      }),
    );
  });

  it('should format 404 Not Found exception correctly', () => {
    const exception = new NotFoundException('Project not found');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Project not found',
        error: 'Not Found',
      }),
    );
  });

  it('should format 409 Conflict exception correctly', () => {
    const exception = new ConflictException('User email already in use');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'User email already in use',
        error: 'Conflict',
      }),
    );
  });

  it('should format unhandled 500 Error without leaking internal message in production', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const exception = new Error('Database disk I/O fatal error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal server error',
          error: 'Internal Server Error',
        }),
      );
      // Stack trace should NOT be exposed in production
      const sentPayload = mockResponse.json.mock.calls[0][0];
      expect(sentPayload.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('should include stack trace for 500 error in development mode', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const exception = new Error('Unexpected calculation error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const sentPayload = mockResponse.json.mock.calls[0][0];
      expect(sentPayload.stack).toBeDefined();
      expect(sentPayload.stack).toContain('Unexpected calculation error');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('should generate a fallback random UUID requestId if no header or property exists', () => {
    mockRequest.headers = {};
    delete mockRequest.requestId;

    const exception = new NotFoundException();
    filter.catch(exception, mockHost);

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    );
  });
});
