import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createPrismaMock,
  createMockScan,
  createMockReport,
  createMockAuditRecord,
} from '@valorasec/test-utils';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── generateReport ────────────────────────────────────────────────────

  describe('generateReport', () => {
    const mockScanWithRelations = createMockScan({
      contract: { id: 'contract-1', name: 'Test Contract' },
      project: { id: 'project-1' },
    });

    it('should generate a report from a scan', async () => {
      prisma.scan.findUnique.mockResolvedValue(mockScanWithRelations);
      prisma.report.create.mockResolvedValue(
        createMockReport({ title: 'Security Audit Report - Test Contract' }),
      );

      const result = await service.generateReport('user-1', 'scan-1');

      expect(result).toBeDefined();
      expect(result.title).toBe('Security Audit Report - Test Contract');
      expect(result.status).toBe('published');
      expect(prisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scanId: 'scan-1',
          userId: 'user-1',
          status: 'published',
        }),
      });
    });

    it('should throw NotFoundException when scan not found', async () => {
      prisma.scan.findUnique.mockResolvedValue(null);

      await expect(service.generateReport('user-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────

  describe('findAll', () => {
    const mockReports = [
      createMockReport({ id: 'report-1' }),
      createMockReport({ id: 'report-2' }),
    ];

    it('should return paginated reports with default params', async () => {
      prisma.report.findMany.mockResolvedValue(mockReports);
      prisma.report.count.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter by projectId', async () => {
      prisma.report.findMany.mockResolvedValue([createMockReport()]);
      prisma.report.count.mockResolvedValue(1);

      await service.findAll({ projectId: 'project-1' });

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-1' },
        }),
      );
    });

    it('should filter by userId', async () => {
      prisma.report.findMany.mockResolvedValue([createMockReport()]);
      prisma.report.count.mockResolvedValue(1);

      await service.findAll({ userId: 'user-1' });

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
    });

    it('should filter by both projectId and userId', async () => {
      prisma.report.findMany.mockResolvedValue([]);
      prisma.report.count.mockResolvedValue(0);

      await service.findAll({ projectId: 'project-1', userId: 'user-1' });

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-1', userId: 'user-1' },
        }),
      );
    });

    it('should paginate with custom page and limit', async () => {
      prisma.report.findMany.mockResolvedValue([]);
      prisma.report.count.mockResolvedValue(30);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
      expect(result.meta.totalPages).toBe(6);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a report by ID with relations', async () => {
      const mockReport = createMockReport();
      prisma.report.findUnique.mockResolvedValue(mockReport);

      const result = await service.findOne('report-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('report-1');
      expect(prisma.report.findUnique).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        include: { scan: true, contract: true, project: true, auditRecord: true },
      });
    });

    it('should throw NotFoundException when report not found', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── registerOnChain ───────────────────────────────────────────────────

  describe('registerOnChain', () => {
    const mockReport = createMockReport({
      findings: [{ id: 'F-1', title: 'Test Finding' }],
      projectId: 'project-1',
    });

    it('should register a report on-chain', async () => {
      prisma.report.findUnique.mockResolvedValue(mockReport);
      prisma.auditRecord.create.mockResolvedValue(createMockAuditRecord());
      prisma.report.update.mockResolvedValue(
        createMockReport({ verifiedOnChain: true, transactionHash: expect.any(String) }),
      );

      const result = await service.registerOnChain('report-1');

      expect(result).toBeDefined();
      expect(result.verifiedOnChain).toBe(true);
      expect(prisma.auditRecord.create).toHaveBeenCalled();
      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          verifiedOnChain: true,
        }),
        include: { scan: true, contract: true, auditRecord: true },
      });
    });

    it('should throw NotFoundException when report not found', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(service.registerOnChain('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should generate transaction hash', async () => {
      prisma.report.findUnique.mockResolvedValue(mockReport);
      prisma.auditRecord.create.mockResolvedValue(createMockAuditRecord());
      prisma.report.update.mockResolvedValue(
        createMockReport({ verifiedOnChain: true, transactionHash: '0xabc123def456' }),
      );

      const result = await service.registerOnChain('report-1');

      expect(result.transactionHash).toBeDefined();
      expect(typeof result.transactionHash).toBe('string');
    });
  });

  // ─── exportReport ────────────────────────────────────────────────────────

  describe('exportReport', () => {
    const mockFullReport = {
      ...createMockReport({
        id: 'report-12345678',
        title: 'Audit Report Soroban',
        status: 'published',
        verifiedOnChain: true,
        findings: [
          {
            id: 'F-1',
            severity: 'high',
            title: 'Reentrancy vulnerability',
            description: 'Unprotected external call',
            recommendation: 'Use reentrancy guard',
            file: 'src/token.rs',
            line: 42,
          },
        ],
      }),
      project: { name: 'DeFi Project' },
      contract: { name: 'TokenContract', address: 'C123' },
    };

    it('should export report as JSON by default', async () => {
      prisma.report.findFirst.mockResolvedValue(mockFullReport);

      const result = await service.exportReport('user-1', 'report-12345678', 'json');

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('application/json; charset=utf-8');
      expect(result.filename).toContain('report-audit_report_soroban-report-1');
      expect(result.filename.endsWith('.json')).toBe(true);
      expect((result.data as Record<string, unknown>).id).toBe('report-12345678');
      expect((result.data as Record<string, unknown>).exportedAt).toBeDefined();
    });

    it('should export report as CSV with UTF-8 BOM', async () => {
      prisma.report.findFirst.mockResolvedValue(mockFullReport);

      const result = await service.exportReport('user-1', 'report-12345678', 'csv');

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('text/csv; charset=utf-8');
      expect(result.filename.endsWith('.csv')).toBe(true);
      expect(typeof result.data).toBe('string');
      expect((result.data as string).startsWith('\uFEFF')).toBe(true);
      expect(result.data).toContain('Reentrancy vulnerability');
    });

    it('should throw NotFoundException when report does not exist or belong to user', async () => {
      prisma.report.findFirst.mockResolvedValue(null);

      await expect(service.exportReport('user-1', 'missing', 'json')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when format is unsupported', async () => {
      prisma.report.findFirst.mockResolvedValue(mockFullReport);

      await expect(service.exportReport('user-1', 'report-12345678', 'xml')).rejects.toThrow(
        'Unsupported export format',
      );
    });
  });
});
