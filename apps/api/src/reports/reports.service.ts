import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

export class ReportQueryDto extends PaginationDto {
  projectId?: string;
  userId?: string;
  status?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(userId: string, scanId: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { contract: true, project: true },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const report = await this.prisma.report.create({
      data: {
        scanId,
        projectId: scan.projectId,
        contractId: scan.contractId,
        userId,
        title: `Security Audit Report - ${scan.contract.name}`,
        status: 'published',
        findings: scan.findings as object,
        summary: scan.summary as object,
      },
    });

    return report;
  }

  async findAll(query: ReportQueryDto = new PaginationDto()) {
    const pageDto = Object.assign(new PaginationDto(), query);
    const skip = pageDto.getSkip();
    const limit = pageDto.getLimit();
    const orderBy = pageDto.getOrderBy(['createdAt', 'updatedAt', 'title'], 'createdAt');

    const where: Record<string, unknown> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    if (pageDto.search) {
      where.title = { contains: pageDto.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: { contract: true, project: true },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data,
      meta: pageDto.buildMeta(total),
    };
  }

  async findOne(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { scan: true, contract: true, project: true, auditRecord: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async registerOnChain(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Mock on-chain registration - in production, this would call Soroban contract
    const reportHash = `0x${Buffer.from(JSON.stringify(report.findings)).toString('hex').slice(0, 64)}`;
    const transactionHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

    await this.prisma.auditRecord.create({
      data: {
        reportId,
        projectId: report.projectId,
        reportHash,
        auditorAddress: 'G...MOCK...ADDRESS',
        contractAddress: 'C...MOCK...CONTRACT',
        transactionHash,
      },
    });

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        verifiedOnChain: true,
        transactionHash,
      },
      include: { scan: true, contract: true, auditRecord: true },
    });
  }
}
