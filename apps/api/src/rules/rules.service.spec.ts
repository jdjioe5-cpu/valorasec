import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { RulesService, OFFICIAL_RULES } from './rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, createMockSecurityRule } from '@valorasec/test-utils';

describe('RulesService', () => {
  let service: RulesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [RulesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get<RulesService>(RulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns official fallback rules when database is empty', async () => {
      prisma.securityRule.findMany.mockResolvedValue([]);
      prisma.securityRule.count.mockResolvedValue(0);

      const result = await service.findAll({});
      expect(result.data.length).toBe(OFFICIAL_RULES.length);
      expect(result.meta.total).toBe(OFFICIAL_RULES.length);
    });

    it('returns database rules when present', async () => {
      const mockRules = [createMockSecurityRule({ id: 'r1' })];
      prisma.securityRule.findMany.mockResolvedValue(mockRules);
      prisma.securityRule.count.mockResolvedValue(1);

      const result = await service.findAll({ category: 'authorization' });
      expect(result.data).toEqual(mockRules);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns rule from database if found', async () => {
      const mockRule = createMockSecurityRule({ id: 'r1' });
      prisma.securityRule.findUnique.mockResolvedValue(mockRule);

      const result = await service.findOne('r1');
      expect(result).toEqual(mockRule);
    });

    it('returns official baseline rule if not in database', async () => {
      prisma.securityRule.findUnique.mockResolvedValue(null);

      const result = await service.findOne('R001');
      expect(result.id).toBe('R001');
      expect(result.name).toBe('missing-authorization-check');
    });

    it('throws NotFoundException when neither database nor official rule exists', async () => {
      prisma.securityRule.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a community security rule', async () => {
      prisma.securityRule.findUnique.mockResolvedValue(null);
      const createdRule = createMockSecurityRule({
        name: 'new-auth-check',
        authorId: 'user-1',
        author: 'Alice',
      });
      prisma.securityRule.create.mockResolvedValue(createdRule);

      const result = await service.create('user-1', 'Alice', {
        name: 'new-auth-check',
        category: 'authorization',
        severity: 'high',
        description: 'New auth check',
        recommendation: 'Use guard',
      });

      expect(result).toEqual(createdRule);
      expect(prisma.securityRule.create).toHaveBeenCalled();
    });

    it('throws ConflictException when rule with name already exists', async () => {
      prisma.securityRule.findUnique.mockResolvedValue(createMockSecurityRule());

      await expect(
        service.create('user-1', 'Alice', {
          name: 'custom-auth-rule',
          category: 'authorization',
          severity: 'high',
          description: 'New auth check',
          recommendation: 'Use guard',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update & remove ownership checks', () => {
    it('allows author to update rule', async () => {
      const rule = createMockSecurityRule({ id: 'r1', authorId: 'user-1' });
      prisma.securityRule.findUnique.mockResolvedValue(rule);
      prisma.securityRule.update.mockResolvedValue({ ...rule, title: 'Updated' });

      const result = await service.update('user-1', 'r1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('rejects update if user is not author or admin', async () => {
      const rule = createMockSecurityRule({ id: 'r1', authorId: 'user-1' });
      prisma.securityRule.findUnique.mockResolvedValue(rule);

      await expect(service.update('user-2', 'r1', { title: 'Hacked' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows author to remove rule', async () => {
      const rule = createMockSecurityRule({ id: 'r1', authorId: 'user-1' });
      prisma.securityRule.findUnique.mockResolvedValue(rule);
      prisma.securityRule.delete.mockResolvedValue(rule);

      const result = await service.remove('user-1', 'r1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('toggleRule & installRule', () => {
    it('toggles rule enabled status', async () => {
      const rule = createMockSecurityRule({ id: 'r1', enabled: true });
      prisma.securityRule.findUnique.mockResolvedValue(rule);
      prisma.securityRule.update.mockResolvedValue({ ...rule, enabled: false });

      const result = await service.toggleRule('r1');
      expect(result.enabled).toBe(false);
    });

    it('installs rule and increments downloads', async () => {
      const rule = createMockSecurityRule({ id: 'r1', downloads: 10 });
      prisma.securityRule.findUnique.mockResolvedValue(rule);
      prisma.securityRule.update.mockResolvedValue({ ...rule, downloads: 11 });

      const result = await service.installRule('r1');
      expect(result.downloads).toBe(11);
    });
  });

  describe('export & import rules', () => {
    it('exports rules as JSON structure', async () => {
      prisma.securityRule.findMany.mockResolvedValue([]);

      const result = await service.exportRules();
      expect(result.version).toBe('1.0.0');
      expect(result.rules.length).toBe(OFFICIAL_RULES.length);
      expect(result.exportedAt).toBeDefined();
    });

    it('imports rules and skips duplicates', async () => {
      prisma.securityRule.findUnique.mockResolvedValue(null);
      prisma.securityRule.create.mockResolvedValue(createMockSecurityRule());

      const result = await service.importRules('user-1', 'Alice', [
        {
          name: 'rule-imported-1',
          category: 'authorization',
          severity: 'high',
          description: 'imported desc',
          recommendation: 'imported rec',
        },
      ]);

      expect(result.importedCount).toBe(1);
    });
  });
});
