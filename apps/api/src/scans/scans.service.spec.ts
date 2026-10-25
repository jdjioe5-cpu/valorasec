import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScansService } from './scans.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, createMockContract, createMockScan } from '@valorasec/test-utils';

// Mock the analyzer module
jest.mock('@valorasec/analyzer', () => ({
  getAnalyzer: jest.fn(() => ({
    analyze: jest.fn().mockResolvedValue({
      scan: {
        id: 'scan-1',
        projectId: 'project-1',
        contractId: 'contract-1',
        status: 'completed',
        findings: [
          {
            id: 'F-1',
            ruleId: 'R001',
            title: 'Test Finding',
            description: 'desc',
            severity: 'high',
            recommendation: 'fix it',
            references: [],
          },
        ],
        summary: {
          totalFindings: 1,
          bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
          score: 85,
          linesAnalyzed: 100,
          rulesExecuted: 8,
        },
        startedAt: '2025-01-01T00:00:00.000Z',
        completedAt: '2025-01-01T00:00:01.000Z',
        duration: 1500,
      },
    }),
  })),
}));

describe('ScansService', () => {
  let service: ScansService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [ScansService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get<ScansService>(ScansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── runScan ───────────────────────────────────────────────────────────

  describe('runScan', () => {
    it('should run a scan successfully', async () => {
      prisma.contract.findFirst.mockResolvedValue(createMockContract());
      prisma.scan.create.mockResolvedValue(createMockScan());

      const result = await service.runScan('project-1', 'contract-1');

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.projectId).toBe('project-1');
      expect(prisma.contract.findFirst).toHaveBeenCalledWith({
        where: { id: 'contract-1', projectId: 'project-1' },
      });
      expect(prisma.scan.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when contract is not found', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);

      await expect(service.runScan('project-1', 'non-existent')).rejects.toThrow(NotFoundException);

      await expect(service.runScan('project-1', 'non-existent')).rejects.toThrow(
        'Contract not found in this project',
      );
    });

    it('should handle contract without sourceHash', async () => {
      prisma.contract.findFirst.mockResolvedValue(createMockContract({ sourceHash: null }));
      prisma.scan.create.mockResolvedValue(createMockScan());

      const result = await service.runScan('project-1', 'contract-1');

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should query previous scan when forceFullScan is false', async () => {
      const mockContract = createMockContract({ sourceHash: 'hash-abc' });
      const mockPrevScan = createMockScan({
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
      });
      prisma.contract.findFirst.mockResolvedValue(mockContract);
      prisma.scan.findFirst.mockResolvedValue(mockPrevScan);
      prisma.scan.create.mockResolvedValue(createMockScan());

      const result = await service.runScan('project-1', 'contract-1', false);

      expect(result).toBeDefined();
      expect(prisma.scan.findFirst).toHaveBeenCalledWith({
        where: { contractId: 'contract-1', status: 'completed' },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('should bypass previous scan query when forceFullScan is true', async () => {
      const mockContract = createMockContract({ sourceHash: 'hash-abc' });
      prisma.contract.findFirst.mockResolvedValue(mockContract);
      prisma.scan.create.mockResolvedValue(createMockScan());

      const result = await service.runScan('project-1', 'contract-1', true);

      expect(result).toBeDefined();
      expect(prisma.scan.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── getScan ───────────────────────────────────────────────────────────

  describe('getScan', () => {
    it('should return a scan by ID with contract relation', async () => {
      const mockScan = createMockScan();
      prisma.scan.findUnique.mockResolvedValue(mockScan);

      const result = await service.getScan('scan-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('scan-1');
      expect(prisma.scan.findUnique).toHaveBeenCalledWith({
        where: { id: 'scan-1' },
        include: { contract: true },
      });
    });

    it('should throw NotFoundException when scan not found', async () => {
      prisma.scan.findUnique.mockResolvedValue(null);

      await expect(service.getScan('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.getScan('non-existent')).rejects.toThrow('Scan not found');
    });
  });

  // ─── getHistory ────────────────────────────────────────────────────────

  describe('getHistory', () => {
    const mockScans = [createMockScan({ id: 'scan-1' }), createMockScan({ id: 'scan-2' })];

    it('should return paginated scan history with default pagination', async () => {
      prisma.scan.findMany.mockResolvedValue(mockScans);
      prisma.scan.count.mockResolvedValue(2);

      const result = await service.getHistory('contract-1');

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
      expect(prisma.scan.findMany).toHaveBeenCalledWith({
        where: { contractId: 'contract-1' },
        orderBy: { startedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should paginate with custom page and limit', async () => {
      prisma.scan.findMany.mockResolvedValue([]);
      prisma.scan.count.mockResolvedValue(25);

      const result = await service.getHistory('contract-1', 2, 5);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
      expect(result.meta.totalPages).toBe(5);
      expect(prisma.scan.findMany).toHaveBeenCalledWith({
        where: { contractId: 'contract-1' },
        orderBy: { startedAt: 'desc' },
        skip: 5,
        take: 5,
      });
    });

    it('should return empty data when no scans found', async () => {
      prisma.scan.findMany.mockResolvedValue([]);
      prisma.scan.count.mockResolvedValue(0);

      const result = await service.getHistory('contract-1');

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });
});
