import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatReportCsv } from '../common/export/csv-export.helper';

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

  async findAll(query: { page?: number; limit?: number; projectId?: string; userId?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.userId) where.userId = query.userId;

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: { contract: true, project: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
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

  async exportReport(userId: string, reportId: string, format: string = 'json') {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      include: {
        scan: true,
        contract: true,
        project: true,
        auditRecord: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const exportFormat = (format || 'json').toLowerCase();
    const sanitizedTitle = (report.title || 'report').toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    if (exportFormat === 'csv') {
      const csvData = formatReportCsv(report);
      return {
        data: csvData,
        filename: `report-${sanitizedTitle}-${report.id.slice(0, 8)}.csv`,
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    if (exportFormat === 'json') {
      const exportPayload = {
        ...report,
        exportedAt: new Date().toISOString(),
      };
      return {
        data: exportPayload,
        filename: `report-${sanitizedTitle}-${report.id.slice(0, 8)}.json`,
        mimeType: 'application/json; charset=utf-8',
      };
    }

    throw new BadRequestException(
      `Unsupported export format '${format}'. Supported formats: csv, json`,
    );
  }
}
