import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface CleanupMetrics {
  expiredSessionsDeleted: number;
  scansSoftDeleted: number;
  archivedProjectsHardDeleted: number;
  timestamp: string;
  duration: number;
}

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Clean up expired refresh tokens (sessions).
   * Runs weekly by default via cron.
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    this.logger.log(`Deleted ${result.count} expired sessions`);
    return result.count;
  }

  /**
   * Soft-delete scans older than the configured retention period.
   * Default: 365 days (1 year).
   */
  async softDeleteOldScans(): Promise<number> {
    const retentionDays = this.config.get<number>('SCAN_RETENTION_DAYS', 365);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.scan.updateMany({
      where: {
        startedAt: { lt: cutoffDate },
        status: { not: 'deleted' },
      },
      data: {
        status: 'deleted',
      },
    });

    this.logger.log(
      `Soft-deleted ${result.count} scans older than ${retentionDays} days (cutoff: ${cutoffDate.toISOString()})`,
    );
    return result.count;
  }

  /**
   * Hard-delete archived projects after the configured grace period.
   * Default: 30 days after archival.
   */
  async hardDeleteArchivedProjects(): Promise<number> {
    const retentionDays = this.config.get<number>('ARCHIVED_PROJECT_RETENTION_DAYS', 30);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Find projects archived before the cutoff
    const archivedProjects = await this.prisma.project.findMany({
      where: {
        status: 'archived',
        OR: [
          { archivedAt: { lt: cutoffDate } },
          { archivedAt: null, updatedAt: { lt: cutoffDate } },
        ],
      },
      select: { id: true },
    });

    if (archivedProjects.length === 0) {
      return 0;
    }

    const projectIds = archivedProjects.map((p) => p.id);

    // Delete related records first, then the projects
    // Using transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.auditRecord.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      await tx.report.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      await tx.scan.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      await tx.contract.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      return tx.project.deleteMany({
        where: { id: { in: projectIds } },
      });
    });

    this.logger.log(
      `Hard-deleted ${result.count} archived projects (older than ${retentionDays} days)`,
    );
    return result.count;
  }

  /**
   * Run all cleanup tasks and return metrics.
   */
  async runCleanup(): Promise<CleanupMetrics> {
    const startTime = Date.now();

    const expiredSessionsDeleted = await this.cleanupExpiredSessions();
    const scansSoftDeleted = await this.softDeleteOldScans();
    const archivedProjectsHardDeleted = await this.hardDeleteArchivedProjects();

    const duration = Date.now() - startTime;

    const metrics: CleanupMetrics = {
      expiredSessionsDeleted,
      scansSoftDeleted,
      archivedProjectsHardDeleted,
      timestamp: new Date().toISOString(),
      duration,
    };

    this.logger.log(
      `Cleanup complete: ${expiredSessionsDeleted} sessions, ${scansSoftDeleted} scans, ${archivedProjectsHardDeleted} projects (${duration}ms)`,
    );

    return metrics;
  }

  /**
   * Scheduled cleanup job (runs weekly on Sunday at 2 AM).
   */
  @Cron(CronExpression.EVERY_WEEK)
  async scheduledCleanup(): Promise<void> {
    this.logger.log('Running scheduled cleanup...');
    try {
      const metrics = await this.runCleanup();
      this.logger.log(`Scheduled cleanup finished: ${JSON.stringify(metrics)}`);
    } catch (error) {
      this.logger.error('Scheduled cleanup failed', error);
    }
  }
}
