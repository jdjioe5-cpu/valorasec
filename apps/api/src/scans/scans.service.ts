import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { getAnalyzer } from '@valorasec/analyzer';
import type { ScanResult } from '@valorasec/shared';

@Injectable()
export class ScansService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getHistory(contractId: string, queryOrPage: PaginationDto | number = 1, limitArg?: number) {
    const pageDto =
      typeof queryOrPage === 'number'
        ? Object.assign(new PaginationDto(), { page: queryOrPage, limit: limitArg ?? 10 })
        : Object.assign(new PaginationDto(), queryOrPage);

    const skip = pageDto.getSkip();
    const limit = pageDto.getLimit();
    const orderBy = pageDto.getOrderBy(['startedAt', 'completedAt', 'duration'], 'startedAt');

    const [data, total] = await Promise.all([
      this.prisma.scan.findMany({
        where: { contractId },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.scan.count({ where: { contractId } }),
    ]);

    return {
      data,
      meta: pageDto.buildMeta(total),
    };
  }
}
