import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, createMockProject } from '@valorasec/test-utils';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated projects for user', async () => {
      const mockProjects = [createMockProject({ id: 'p1' })];
      prisma.project.findMany.mockResolvedValue(mockProjects);
      prisma.project.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', { page: 1, limit: 10 });
      expect(result.data).toEqual(mockProjects);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns project if found and owned by user', async () => {
      const mockProject = createMockProject({ id: 'p1', userId: 'user-1' });
      prisma.project.findFirst.mockResolvedValue(mockProject);

      const result = await service.findOne('user-1', 'p1');
      expect(result).toEqual(mockProject);
    });

    it('throws NotFoundException if project not found', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportProject', () => {
    const mockFullProject = {
      ...createMockProject({
        id: 'proj-12345678',
        name: 'Stellar Vault',
        network: 'testnet',
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      contracts: [
        {
          id: 'contract-1',
          name: 'VaultContract',
          address: 'C_VAULT_ADDRESS',
        },
      ],
      scans: [
        {
          id: 'scan-1',
          contractId: 'contract-1',
          status: 'completed',
          startedAt: new Date('2026-01-02T00:00:00.000Z'),
          findings: [
            {
              id: 'F-1',
              severity: 'medium',
              title: 'Integer overflow potential',
              description: 'Math operations without checked arithmetic',
              recommendation: 'Use checked_add',
              file: 'src/lib.rs',
              line: 15,
            },
          ],
        },
      ],
    };

    it('exports project as JSON by default', async () => {
      prisma.project.findFirst.mockResolvedValue(mockFullProject);

      const result = await service.exportProject('user-1', 'proj-12345678', 'json');

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('application/json; charset=utf-8');
      expect(result.filename).toBe('project-stellar_vault-proj-123.json');
      expect((result.data as Record<string, unknown>).id).toBe('proj-12345678');
      expect((result.data as Record<string, unknown>).exportedAt).toBeDefined();
    });

    it('exports project as CSV with UTF-8 BOM', async () => {
      prisma.project.findFirst.mockResolvedValue(mockFullProject);

      const result = await service.exportProject('user-1', 'proj-12345678', 'csv');

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('text/csv; charset=utf-8');
      expect(result.filename).toBe('project-stellar_vault-proj-123.csv');
      expect(typeof result.data).toBe('string');
      expect((result.data as string).startsWith('\uFEFF')).toBe(true);
      expect(result.data).toContain('Stellar Vault');
      expect(result.data).toContain('VaultContract');
      expect(result.data).toContain('Integer overflow potential');
    });

    it('throws NotFoundException when project not found for user', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.exportProject('user-1', 'missing', 'csv')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for unsupported format', async () => {
      prisma.project.findFirst.mockResolvedValue(mockFullProject);

      await expect(service.exportProject('user-1', 'proj-12345678', 'yaml')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
