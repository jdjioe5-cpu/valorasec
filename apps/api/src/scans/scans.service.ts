import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getAnalyzer } from '@valorasec/analyzer';
import type { ScanResult } from '@valorasec/shared';
import * as fs from 'fs';

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

    let sourceCode: string | undefined;
    if (contract.sourcePath && fs.existsSync(contract.sourcePath)) {
      try {
        sourceCode = fs.readFileSync(contract.sourcePath, 'utf-8');
      } catch {
        sourceCode = undefined;
      }
    }

    // Run the analyzer with sourceCode if available
    const analyzer = getAnalyzer();
    const result = await analyzer.analyze({
      contractId,
      projectId,
      sourceHash: contract.sourceHash ?? undefined,
      sourceCode,
      file: contract.name.endsWith('.rs') ? contract.name : `${contract.name}.rs`,
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
