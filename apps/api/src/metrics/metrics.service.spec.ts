import { MetricsService } from './metrics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockPrisma: Partial<PrismaService>;

  beforeEach(() => {
    mockPrisma = {
      user: {
        count: jest.fn().mockResolvedValue(15),
      } as unknown as PrismaService['user'],
      scan: {
        count: jest.fn().mockResolvedValue(3),
      } as unknown as PrismaService['scan'],
    };

    service = new MetricsService(mockPrisma as PrismaService);
  });

  it('records HTTP request counts and durations accurately', async () => {
    service.recordHttpRequest('GET', '/api/projects', 200, 0.04);
    service.recordHttpRequest('GET', '/api/projects', 200, 0.12);
    service.recordHttpRequest('POST', '/api/scans', 500, 0.5);

    const text = await service.getMetricsAsPrometheusText();

    expect(text).toContain(
      'http_requests_total{method="GET",route="/api/projects",status_code="200"} 2',
    );
    expect(text).toContain(
      'http_requests_total{method="POST",route="/api/scans",status_code="500"} 1',
    );
    expect(text).toContain('http_request_duration_seconds_bucket');
    expect(text).toContain('http_request_duration_seconds_sum');
    expect(text).toContain('http_request_duration_seconds_count');
  });

  it('collects dynamic user and queue gauges from database', async () => {
    const text = await service.getMetricsAsPrometheusText();

    expect(text).toContain('active_users 15');
    expect(text).toContain('scan_queue_depth 3');
    expect(text).toContain('db_connection_pool_active 1');
    expect(text).toContain('db_connection_pool_idle 5');
  });

  it('allows manual updates for pool and queue metrics', async () => {
    service.setActiveUsers(42);
    service.setScanQueueDepth(7);
    service.setDbPoolMetrics(4, 12);

    // Call without prisma collect overriding manual
    const serviceWithoutPrisma = new MetricsService();
    serviceWithoutPrisma.setActiveUsers(42);
    serviceWithoutPrisma.setScanQueueDepth(7);
    serviceWithoutPrisma.setDbPoolMetrics(4, 12);

    const text = await serviceWithoutPrisma.getMetricsAsPrometheusText();

    expect(text).toContain('active_users 42');
    expect(text).toContain('scan_queue_depth 7');
    expect(text).toContain('db_connection_pool_active 4');
    expect(text).toContain('db_connection_pool_idle 12');
  });
});
