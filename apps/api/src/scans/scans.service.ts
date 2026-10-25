import { Injectable, NotFoundException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { getAnalyzer } from '@valorasec/analyzer';
import type { ScanResult } from '@valorasec/shared';

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailService?: EmailService,
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

    if (this.emailService) {
      this.prisma.project
        .findUnique({ where: { id: projectId } })
        .then((project) => {
          if (project?.userId && this.emailService) {
            this.emailService.sendScanCompletedEmail(project.userId, {
              projectName: project.name,
              contractName: contract.name,
              score: result.scan.summary.score,
              findingsCount: result.scan.summary.totalFindings,
              scanUrl: `/projects/${projectId}`,
            });
          }
        })
        .catch((err) =>
          this.logger.warn(`Failed to dispatch scan completed email: ${err.message}`),
        );
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
