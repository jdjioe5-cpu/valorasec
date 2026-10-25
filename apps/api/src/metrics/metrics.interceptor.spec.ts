import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
    jest.spyOn(metricsService, 'recordHttpRequest');
    interceptor = new MetricsInterceptor(metricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockContext(method: string, route: string, statusCode = 200): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          route: { path: route },
          path: route,
        }),
        getResponse: () => ({
          statusCode,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('records successful requests with duration and status code', (done) => {
    const context = createMockContext('GET', '/api/projects', 200);
    const next: CallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
          'GET',
          '/api/projects',
          200,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('records failed requests with error status code', (done) => {
    const context = createMockContext('POST', '/api/auth/login', 200);
    const next: CallHandler = {
      handle: () => throwError(() => ({ status: 401, message: 'Invalid credentials' })),
    };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
          'POST',
          '/api/auth/login',
          401,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('ignores internal /metrics requests to avoid noise', (done) => {
    const context = createMockContext('GET', '/api/metrics', 200);
    const next: CallHandler = {
      handle: () => of('metrics'),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(metricsService.recordHttpRequest).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
