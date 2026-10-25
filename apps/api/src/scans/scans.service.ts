import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getAnalyzer } from '@valorasec/analyzer';
import type { ScanResult } from '@valorasec/shared';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class ScansService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly webhooksService?: WebhooksService,
  ) {}

  async runScan(projectId: string, contractId: string): Promise<ScanResult> {
    // Verify contract exists in project
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, projectId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found in this project');
    }

    // Run the analyzer
    const analyzer = getAnalyzer();
    const result = await analyzer.analyze({
      contractId,
      projectId,
      sourceHash: contract.sourceHash ?? undefined,
    });

    // Save scan to database
    await this.prisma.scan.create({
      data: {
        id: result.scan.id,
        projectId,
        contractId,
        status: result.scan.status,
        findings: result.scan.findings as unknown as object,
        summary: result.scan.summary as unknown as object,
        startedAt: new Date(result.scan.startedAt),
        completedAt: result.scan.completedAt ? new Date(result.scan.completedAt) : null,
        duration: result.scan.duration ?? null,
      },
    });

    // Trigger webhook notifications for scan completion
    if (this.webhooksService) {
      try {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
        });
        if (project) {
          this.webhooksService.dispatchScanCompleted(project.userId, {
            projectId,
            contractId,
            scanId: result.scan.id,
            status: result.scan.status,
            summary: result.scan.summary,
            findingsCount: result.scan.findings.length,
          });
        }
      } catch {
        // Non-blocking notification dispatch
      }
    }

    return result.scan;
  }

  async getScan(scanId: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { contract: true },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return scan;
  }

  async getHistory(contractId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.scan.findMany({
        where: { contractId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.scan.count({ where: { contractId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
