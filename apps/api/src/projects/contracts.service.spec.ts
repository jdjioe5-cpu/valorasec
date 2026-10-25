import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, createMockContract } from '@valorasec/test-utils';
import * as crypto from 'crypto';
import * as fs from 'fs';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [ContractsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get<ContractsService>(ContractsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────

  describe('findAll', () => {
    const mockContracts = [
      createMockContract({ id: 'contract-1', name: 'LiquidityPool' }),
      createMockContract({ id: 'contract-2', name: 'TokenVault' }),
    ];

    it('should list all contracts for a project', async () => {
      prisma.contract.findMany.mockResolvedValue(mockContracts);

      const result = await service.findAll('project-1');

      expect(result).toHaveLength(2);
      expect(prisma.contract.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no contracts', async () => {
      prisma.contract.findMany.mockResolvedValue([]);

      const result = await service.findAll('project-1');

      expect(result).toHaveLength(0);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────

  describe('create', () => {
    const createData = {
      name: 'New Contract',
      address: 'CABC1234567890XYZ',
      network: 'testnet',
    };

    it('should create a new contract without file', async () => {
      const newContract = createMockContract(createData);
      prisma.contract.create.mockResolvedValue(newContract);

      const result = await service.create('project-1', createData);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Contract');
      expect(result.address).toBe('CABC1234567890XYZ');
      expect(prisma.contract.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          projectId: 'project-1',
          sourceHash: undefined,
          sourcePath: undefined,
        },
      });
    });

    it('should create a contract with valid .rs file and compute SHA-256 hash', async () => {
      const rustContent = 'pub fn hello() -> u32 { 42 }';
      const fileBuffer = Buffer.from(rustContent, 'utf-8');
      const expectedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const mockFile = {
        originalname: 'token.rs',
        size: fileBuffer.length,
        buffer: fileBuffer,
      };

      const newContract = createMockContract({
        ...createData,
        sourceHash: expectedHash,
        sourcePath: '/mock/path/token.rs',
      });
      prisma.contract.create.mockResolvedValue(newContract);

      const result = await service.create('project-1', createData, mockFile);

      expect(result).toBeDefined();
      expect(prisma.contract.create).toHaveBeenCalled();
      const createCallArg = prisma.contract.create.mock.calls[0][0];
      expect(createCallArg.data.sourceHash).toBe(expectedHash);
      expect(createCallArg.data.sourcePath).toBeDefined();
      expect(fs.existsSync(createCallArg.data.sourcePath)).toBe(true);

      // Clean up the created file from test
      fs.unlinkSync(createCallArg.data.sourcePath);
    });

    it('should reject non-.rs file upload with BadRequestException', async () => {
      const mockFile = {
        originalname: 'malicious.exe',
        size: 100,
        buffer: Buffer.from('binary'),
      };

      await expect(service.create('project-1', createData, mockFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('project-1', createData, mockFile)).rejects.toThrow(
        'Only .rs files are accepted',
      );
    });

    it('should reject files exceeding 5MB with BadRequestException', async () => {
      const mockFile = {
        originalname: 'huge.rs',
        size: 5 * 1024 * 1024 + 1,
        buffer: Buffer.alloc(10),
      };

      await expect(service.create('project-1', createData, mockFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('project-1', createData, mockFile)).rejects.toThrow(
        'File size exceeds 5MB limit',
      );
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete a contract', async () => {
      prisma.contract.findFirst.mockResolvedValue(
        createMockContract({ id: 'contract-1', projectId: 'project-1' }),
      );
      prisma.contract.delete.mockResolvedValue({});

      await service.remove('project-1', 'contract-1');

      expect(prisma.contract.delete).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
      });
    });

    it('should throw NotFoundException when contract not found', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);

      await expect(service.remove('project-1', 'non-existent')).rejects.toThrow(NotFoundException);

      await expect(service.remove('project-1', 'non-existent')).rejects.toThrow(
        'Contract not found',
      );
    });

    it('should not delete if contract belongs to different project', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);

      await expect(service.remove('project-2', 'contract-1')).rejects.toThrow(NotFoundException);

      expect(prisma.contract.delete).not.toHaveBeenCalled();
    });
  });
});
