import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface RouteMetricKey {
  method: string;
  route: string;
  statusCode: number;
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService {
  private requestCounts: Map<string, number> = new Map();
  private requestDurations: Map<
    string,
    { sum: number; count: number; buckets: Map<number, number> }
  > = new Map();

  private activeUsers = 0;
  private scanQueueDepth = 0;
  private dbPoolActive = 1;
  private dbPoolIdle = 5;

  constructor(private readonly prisma?: PrismaService) {}

  private getMetricKey(method: string, route: string, statusCode: number): string {
    const sanitizedRoute = route || '/';
    return `${method.toUpperCase()}|${sanitizedRoute}|${statusCode}`;
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const key = this.getMetricKey(method, route, statusCode);

    // Counter
    const currentCount = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, currentCount + 1);

    // Histogram
    let durationEntry = this.requestDurations.get(key);
    if (!durationEntry) {
      durationEntry = {
        sum: 0,
        count: 0,
        buckets: new Map(DEFAULT_BUCKETS.map((b) => [b, 0])),
      };
      this.requestDurations.set(key, durationEntry);
    }

    durationEntry.sum += durationSeconds;
    durationEntry.count += 1;

    for (const le of DEFAULT_BUCKETS) {
      if (durationSeconds <= le) {
        const bCount = durationEntry.buckets.get(le) || 0;
        durationEntry.buckets.set(le, bCount + 1);
      }
    }
  }

  setActiveUsers(count: number): void {
    this.activeUsers = Math.max(0, count);
  }

  setScanQueueDepth(depth: number): void {
    this.scanQueueDepth = Math.max(0, depth);
  }

  setDbPoolMetrics(active: number, idle: number): void {
    this.dbPoolActive = Math.max(0, active);
    this.dbPoolIdle = Math.max(0, idle);
  }

  async collectDynamicMetrics(): Promise<void> {
    if (!this.prisma) return;

    try {
      const [userCount, pendingScans] = await Promise.all([
        this.prisma.user.count().catch(() => this.activeUsers),
        this.prisma.scan.count({ where: { status: 'pending' } }).catch(() => this.scanQueueDepth),
      ]);
      this.activeUsers = userCount;
      this.scanQueueDepth = pendingScans;
    } catch {
      // Gracefully retain existing metric values if db is unavailable
    }
  }

  async getMetricsAsPrometheusText(): Promise<string> {
    await this.collectDynamicMetrics();

    const lines: string[] = [];

    // HTTP Requests Total
    lines.push('# HELP http_requests_total Total number of HTTP requests processed');
    lines.push('# TYPE http_requests_total counter');
    if (this.requestCounts.size === 0) {
      lines.push('http_requests_total 0');
    } else {
      for (const [key, count] of this.requestCounts.entries()) {
        const [method, route, statusCode] = key.split('|');
        lines.push(
          `http_requests_total{method="${method}",route="${route}",status_code="${statusCode}"} ${count}`,
        );
      }
    }

    // HTTP Request Duration Seconds Histogram
    lines.push(
      '# HELP http_request_duration_seconds HTTP request duration in seconds for API calls',
    );
    lines.push('# TYPE http_request_duration_seconds histogram');
    if (this.requestDurations.size === 0) {
      lines.push('http_request_duration_seconds_count 0');
      lines.push('http_request_duration_seconds_sum 0');
    } else {
      for (const [key, duration] of this.requestDurations.entries()) {
        const [method, route, statusCode] = key.split('|');
        let cumulative = 0;
        for (const le of DEFAULT_BUCKETS) {
          cumulative += duration.buckets.get(le) || 0;
          lines.push(
            `http_request_duration_seconds_bucket{method="${method}",route="${route}",status_code="${statusCode}",le="${le}"} ${cumulative}`,
          );
        }
        lines.push(
          `http_request_duration_seconds_bucket{method="${method}",route="${route}",status_code="${statusCode}",le="+Inf"} ${duration.count}`,
        );
        lines.push(
          `http_request_duration_seconds_sum{method="${method}",route="${route}",status_code="${statusCode}"} ${duration.sum.toFixed(4)}`,
        );
        lines.push(
          `http_request_duration_seconds_count{method="${method}",route="${route}",status_code="${statusCode}"} ${duration.count}`,
        );
      }
    }

    // Active Users Gauge
    lines.push('# HELP active_users Number of registered active users in the system');
    lines.push('# TYPE active_users gauge');
    lines.push(`active_users ${this.activeUsers}`);

    // Scan Queue Depth Gauge
    lines.push('# HELP scan_queue_depth Current pending scan tasks in the queue');
    lines.push('# TYPE scan_queue_depth gauge');
    lines.push(`scan_queue_depth ${this.scanQueueDepth}`);

    // DB Connection Pool Gauges
    lines.push(
      '# HELP db_connection_pool_active Active connections currently in use by the database pool',
    );
    lines.push('# TYPE db_connection_pool_active gauge');
    lines.push(`db_connection_pool_active ${this.dbPoolActive}`);

    lines.push('# HELP db_connection_pool_idle Idle database connections available in the pool');
    lines.push('# TYPE db_connection_pool_idle gauge');
    lines.push(`db_connection_pool_idle ${this.dbPoolIdle}`);

    return lines.join('\n') + '\n';
  }
}
