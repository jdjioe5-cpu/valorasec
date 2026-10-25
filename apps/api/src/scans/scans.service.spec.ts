import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScansService } from './scans.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, createMockContract, createMockScan } from '@valorasec/test-utils';
import { getAnalyzer } from '@valorasec/analyzer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the analyzer module
jest.mock('@valorasec/analyzer', () => {
  const analyzeMock = jest.fn().mockResolvedValue({
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
  });

  return {
    getAnalyzer: jest.fn(() => ({
      analyze: analyzeMock,
    })),
  };
});

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

    it('should read contract source file and pass sourceCode to analyzer', async () => {
      const tempPath = path.join(os.tmpdir(), `test-contract-${Date.now()}.rs`);
      const rustContent = 'pub fn deposit() { env.storage(); }';
      fs.writeFileSync(tempPath, rustContent);

      try {
        prisma.contract.findFirst.mockResolvedValue(
          createMockContract({
            id: 'contract-with-source',
            projectId: 'project-1',
            sourcePath: tempPath,
            sourceHash: 'some-hash',
          }),
        );
        prisma.scan.create.mockResolvedValue(createMockScan());

        await service.runScan('project-1', 'contract-with-source');

        const analyzer = getAnalyzer();
        expect(analyzer.analyze).toHaveBeenCalledWith(
          expect.objectContaining({
            contractId: 'contract-with-source',
            projectId: 'project-1',
            sourceCode: rustContent,
          }),
        );
      } finally {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
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

  // ─── getHistory ─────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('should return paginated scan history', async () => {
      const mockScans = [createMockScan({ id: 'scan-1' }), createMockScan({ id: 'scan-2' })];
      prisma.scan.findMany.mockResolvedValue(mockScans);
      prisma.scan.count.mockResolvedValue(2);

      const result = await service.getHistory('contract-1', 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(prisma.scan.findMany).toHaveBeenCalledWith({
        where: { contractId: 'contract-1' },
        orderBy: { startedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should calculate totalPages correctly', async () => {
      prisma.scan.findMany.mockResolvedValue([]);
      prisma.scan.count.mockResolvedValue(25);

      const result = await service.getHistory('contract-1', 1, 10);

      expect(result.meta.totalPages).toBe(3);
    });

    it('should default page to 1 and limit to 10', async () => {
      prisma.scan.findMany.mockResolvedValue([]);
      prisma.scan.count.mockResolvedValue(0);

      await service.getHistory('contract-1');

      expect(prisma.scan.findMany).toHaveBeenCalledWith({
        where: { contractId: 'contract-1' },
        orderBy: { startedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });
  });
});
