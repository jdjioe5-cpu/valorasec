import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getAnalyzer } from '@valorasec/analyzer';
import type { Finding, ScanResult, ScanStatus, ScanSummary } from '@valorasec/shared';

@Injectable()
export class ScansService {
  constructor(private readonly prisma: PrismaService) {}

  async runScan(projectId: string, contractId: string, forceFullScan = false): Promise<ScanResult> {
    // Verify contract exists in project
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, projectId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found in this project');
    }

    // Retrieve previous completed scan for incremental analysis if not forced
    let previousScan: ScanResult | undefined;
    if (!forceFullScan) {
      const lastScan = await this.prisma.scan.findFirst({
        where: { contractId, status: 'completed' },
        orderBy: { startedAt: 'desc' },
      });

      if (lastScan) {
        previousScan = {
          id: lastScan.id,
          projectId: lastScan.projectId,
          contractId: lastScan.contractId,
          status: lastScan.status as ScanStatus,
          findings: lastScan.findings as unknown as Finding[],
          summary: lastScan.summary as unknown as ScanSummary,
          startedAt: lastScan.startedAt.toISOString(),
          completedAt: lastScan.completedAt ? lastScan.completedAt.toISOString() : undefined,
          duration: lastScan.duration ?? undefined,
          sourceHash: contract.sourceHash ?? undefined,
        };
      }
    }

    // Run the analyzer with incremental diff & scoping
    const analyzer = getAnalyzer();
    const result = await analyzer.analyze({
      contractId,
      projectId,
      sourceHash: contract.sourceHash ?? undefined,
      previousScan,
      forceFullScan,
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
