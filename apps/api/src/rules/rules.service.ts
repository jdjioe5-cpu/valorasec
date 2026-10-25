import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import type { SecurityRule, SecurityRuleExportData } from '@valorasec/shared';

export const OFFICIAL_RULES: Array<Omit<SecurityRule, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'R001',
    name: 'missing-authorization-check',
    title: 'Missing Authorization Check',
    category: 'authorization',
    severity: 'critical',
    description:
      'Contract function does not verify caller authorization before executing privileged operations.',
    recommendation:
      'Add `require_auth()` or `require_auth_for_args()` to verify the caller before executing sensitive operations.',
    pattern: 'require_auth\\(',
    author: 'ValoraSec Official',
    downloads: 1420,
    isCommunity: false,
    enabled: true,
  },
  {
    id: 'R002',
    name: 'unsafe-storage-access',
    title: 'Unsafe Storage Access',
    category: 'storage',
    severity: 'high',
    description:
      'Storage map accessed without checking for existence, potentially leading to unexpected behavior.',
    recommendation:
      'Use `get()` with proper error handling or check for existence before accessing storage values.',
    pattern: 'env\\.storage\\(\\)\\.instance\\(\\)\\.get',
    author: 'ValoraSec Official',
    downloads: 980,
    isCommunity: false,
    enabled: true,
  },
  {
    id: 'R003',
    name: 'input-validation-missing',
    title: 'Input Validation Missing',
    category: 'input-validation',
    severity: 'high',
    description:
      'Function parameters are not validated, potentially allowing malicious or malformed inputs.',
    recommendation:
      'Add input validation checks at the beginning of each public function to ensure parameters are within expected ranges.',
    pattern: 'fn\\s+\\w+\\([^)]*\\)',
    author: 'ValoraSec Official',
    downloads: 875,
    isCommunity: false,
    enabled: true,
  },
  {
    id: 'R004',
    name: 'dead-code',
    title: 'Dead Code Elimination',
    category: 'code-quality',
    severity: 'low',
    description: 'Unreachable code detected that will never execute.',
    recommendation: 'Remove dead code to improve readability and reduce contract size.',
    author: 'ValoraSec Official',
    downloads: 410,
    isCommunity: false,
    enabled: true,
  },
  {
    id: 'R005',
    name: 'unhandled-panic',
    title: 'Unhandled Panic Safety',
    category: 'panic-safety',
    severity: 'medium',
    description:
      'Code contains `unwrap()` or `expect()` calls that may cause the contract to panic.',
    recommendation:
      'Replace `unwrap()` with proper error handling using `?` operator or pattern matching.',
    pattern: '\\.unwrap\\(\\)|\\.expect\\(',
    author: 'ValoraSec Official',
    downloads: 730,
    isCommunity: false,
    enabled: true,
  },
  {
    id: 'R006',
    name: 'gas-inefficient-loop',
    title: 'Gas Inefficient Loop',
    category: 'gas-optimization',
    severity: 'medium',
    description: 'Loops with unbounded iteration may consume excessive gas.',
    recommendation: 'Limit loop iterations or use pagination patterns to control gas consumption.',
    pattern: 'for\\s+\\w+\\s+in',
    author: 'ValoraSec Official',
    downloads: 620,
    isCommunity: false,
    enabled: true,
  },
];

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    category?: string;
    severity?: string;
    search?: string;
    sort?: 'popular' | 'recent' | 'name';
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.category) {
      where.category = query.category;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Record<string, string> = { downloads: 'desc' };
    if (query.sort === 'recent') {
      orderBy = { createdAt: 'desc' };
    } else if (query.sort === 'name') {
      orderBy = { name: 'asc' };
    }

    const [dbRules, total] = await Promise.all([
      this.prisma.securityRule.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.securityRule.count({ where }),
    ]);

    // If database rules table is empty and no specific search was requested,
    // present official baseline rules
    let data = dbRules;
    let effectiveTotal = total;

    if (total === 0 && !query.search && !query.category && !query.severity) {
      data = OFFICIAL_RULES.map((r) => ({
        ...r,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      })) as unknown as typeof dbRules;
      effectiveTotal = OFFICIAL_RULES.length;
    }

    return {
      data,
      meta: {
        total: effectiveTotal,
        page,
        limit,
        totalPages: Math.ceil(effectiveTotal / limit),
      },
    };
  }

  async findOne(id: string) {
    const rule = await this.prisma.securityRule.findUnique({
      where: { id },
    });

    if (rule) {
      return rule;
    }

    const official = OFFICIAL_RULES.find((r) => r.id === id || r.name === id);
    if (official) {
      return {
        ...official,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
    }

    throw new NotFoundException(`Security rule '${id}' not found`);
  }

  async create(userId: string, authorName: string, dto: CreateRuleDto) {
    const existing = await this.prisma.securityRule.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Security rule with name '${dto.name}' already exists`);
    }

    return this.prisma.securityRule.create({
      data: {
        ...dto,
        author: authorName || 'Community Contributor',
        authorId: userId,
        isCommunity: true,
        downloads: 0,
        enabled: true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateRuleDto, userRole?: string) {
    const rule = await this.findOne(id);

    // Only creator or admin can update
    if (rule.authorId && rule.authorId !== userId && userRole !== 'admin') {
      throw new ForbiddenException('You do not have permission to modify this rule');
    }

    return this.prisma.securityRule.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string, userRole?: string) {
    const rule = await this.findOne(id);

    if (rule.authorId && rule.authorId !== userId && userRole !== 'admin') {
      throw new ForbiddenException('You do not have permission to delete this rule');
    }

    await this.prisma.securityRule.delete({
      where: { id },
    });

    return { message: 'Security rule deleted successfully' };
  }

  async toggleRule(id: string) {
    const rule = await this.findOne(id);

    return this.prisma.securityRule.update({
      where: { id },
      data: {
        enabled: !rule.enabled,
      },
    });
  }

  async installRule(id: string) {
    await this.findOne(id);

    return this.prisma.securityRule.update({
      where: { id },
      data: {
        downloads: { increment: 1 },
        enabled: true,
      },
    });
  }

  async exportRules(category?: string): Promise<SecurityRuleExportData> {
    const where: Record<string, unknown> = {};
    if (category) {
      where.category = category;
    }

    let rules = await this.prisma.securityRule.findMany({ where });
    if (rules.length === 0) {
      rules = OFFICIAL_RULES.map((r) => ({
        ...r,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      })) as unknown as typeof rules;
    }

    return {
      rules: rules.map((r) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        updatedAt: r.updatedAt
          ? r.updatedAt instanceof Date
            ? r.updatedAt.toISOString()
            : String(r.updatedAt)
          : undefined,
      })) as unknown as SecurityRule[],
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  async importRules(userId: string, authorName: string, rules: CreateRuleDto[]) {
    const created: unknown[] = [];
    for (const ruleDto of rules) {
      try {
        const item = await this.create(userId, authorName, ruleDto);
        created.push(item);
      } catch {
        // Skip duplicate rule names during import
      }
    }
    return {
      importedCount: created.length,
      rules: created,
    };
  }
}
