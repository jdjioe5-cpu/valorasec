import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CleanupService } from './cleanup.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '@valorasec/test-utils';

describe('CleanupService', () => {
  let service: CleanupService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    configService = { get: jest.fn((key: string, defaultValue?: unknown) => defaultValue) };

    const moduleFixture = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleFixture.get<CleanupService>(CleanupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── cleanupExpiredSessions ────────────────────────────────────────────

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(5);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('should return 0 when no expired sessions', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(0);
    });
  });

  // ─── softDeleteOldScans ────────────────────────────────────────────────

  describe('softDeleteOldScans', () => {
    it('should soft-delete scans older than retention period', async () => {
      configService.get.mockReturnValue(365);
      prisma.scan.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.softDeleteOldScans();

      expect(result).toBe(3);
      expect(prisma.scan.updateMany).toHaveBeenCalledWith({
        where: {
          startedAt: { lt: expect.any(Date) },
          status: { not: 'deleted' },
        },
        data: { status: 'deleted' },
      });
    });

    it('should use configurable retention days', async () => {
      configService.get.mockReturnValue(90); // 90 days
      prisma.scan.updateMany.mockResolvedValue({ count: 1 });

      await service.softDeleteOldScans();

      expect(configService.get).toHaveBeenCalledWith('SCAN_RETENTION_DAYS', 365);
    });

    it('should use default 365 days when env var not set', async () => {
      configService.get.mockImplementation((_key: string, defaultValue: unknown) => defaultValue);
      prisma.scan.updateMany.mockResolvedValue({ count: 0 });

      await service.softDeleteOldScans();

      expect(configService.get).toHaveBeenCalledWith('SCAN_RETENTION_DAYS', 365);
    });
  });

  // ─── hardDeleteArchivedProjects ────────────────────────────────────────

  describe('hardDeleteArchivedProjects', () => {
    it('should hard-delete archived projects older than retention period', async () => {
      configService.get.mockReturnValue(30);
      prisma.project.findMany.mockResolvedValue([{ id: 'project-1' }, { id: 'project-2' }]);
      prisma.$transaction.mockImplementation(async (fn) =>
        (fn as (tx: Record<string, unknown>) => Promise<unknown>)({
          auditRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          report: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
          scan: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
          contract: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
          project: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        }),
      );

      const result = await service.hardDeleteArchivedProjects();

      expect(result).toBe(2);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should return 0 when no archived projects found', async () => {
      configService.get.mockReturnValue(30);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.hardDeleteArchivedProjects();

      expect(result).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should query projects matching archived status and cutoff date', async () => {
      configService.get.mockReturnValue(30);
      prisma.project.findMany.mockResolvedValue([]);

      await service.hardDeleteArchivedProjects();

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'archived',
            OR: expect.arrayContaining([
              expect.objectContaining({ archivedAt: { lt: expect.any(Date) } }),
            ]),
          }),
        }),
      );
    });
  });

  // ─── runCleanup ────────────────────────────────────────────────────────

  describe('runCleanup', () => {
    it('should run all cleanup tasks and return metrics', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 5 });
      configService.get.mockReturnValue(365);
      prisma.scan.updateMany.mockResolvedValue({ count: 3 });
      prisma.project.findMany.mockResolvedValue([{ id: 'project-1' }]);
      prisma.$transaction.mockImplementation(async (fn) =>
        (fn as (tx: Record<string, unknown>) => Promise<unknown>)({
          auditRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          report: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          scan: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          contract: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          project: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        }),
      );

      const metrics = await service.runCleanup();

      expect(metrics.expiredSessionsDeleted).toBe(5);
      expect(metrics.scansSoftDeleted).toBe(3);
      expect(metrics.archivedProjectsHardDeleted).toBe(1);
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle all tasks returning zero', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 });
      prisma.scan.updateMany.mockResolvedValue({ count: 0 });
      prisma.project.findMany.mockResolvedValue([]);

      const metrics = await service.runCleanup();

      expect(metrics.expiredSessionsDeleted).toBe(0);
      expect(metrics.scansSoftDeleted).toBe(0);
      expect(metrics.archivedProjectsHardDeleted).toBe(0);
    });
  });

  // ─── scheduledCleanup ──────────────────────────────────────────────────

  describe('scheduledCleanup', () => {
    it('should execute runCleanup and log result when scheduled cron triggers', async () => {
      const runCleanupSpy = jest.spyOn(service, 'runCleanup').mockResolvedValue({
        expiredSessionsDeleted: 1,
        scansSoftDeleted: 2,
        archivedProjectsHardDeleted: 3,
        timestamp: new Date().toISOString(),
        duration: 50,
      });

      await service.scheduledCleanup();

      expect(runCleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('should catch and log error if cleanup fails during scheduled job', async () => {
      jest.spyOn(service, 'runCleanup').mockRejectedValue(new Error('DB failure'));

      await expect(service.scheduledCleanup()).resolves.toBeUndefined();
    });
  });
});
