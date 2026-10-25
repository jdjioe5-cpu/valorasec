import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import type { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    const startTime = process.hrtime();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetric(req, res, startTime);
        },
        error: (err: { status?: number; statusCode?: number }) => {
          const status = err?.status || (err?.statusCode ? Number(err.statusCode) : 500);
          this.recordMetric(req, res, startTime, status);
        },
      }),
    );
  }

  private recordMetric(
    req: Request,
    res: Response,
    startTime: [number, number],
    forcedStatus?: number,
  ): void {
    const elapsed = process.hrtime(startTime);
    const durationSeconds = elapsed[0] + elapsed[1] / 1e9;

    const statusCode = forcedStatus ?? res.statusCode ?? 200;
    const method = req.method || 'GET';
    const route = req.route?.path || req.baseUrl || req.path || '/';

    // Avoid recording metrics scraping itself to prevent feedback loop noise
    if (route.includes('/metrics')) {
      return;
    }

    this.metricsService.recordHttpRequest(method, route, statusCode, durationSeconds);
  }
}
