import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import type { Request } from 'express';

interface JwtRequest extends Request {
  user: { sub: string; email?: string; role?: string };
}

@ApiTags('Security Rules')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @ApiOperation({ summary: 'List security rule marketplace items' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['popular', 'recent', 'name'] })
  async findAll(
    @Query()
    query: PaginationDto & {
      category?: string;
      severity?: string;
      search?: string;
      sort?: 'popular' | 'recent' | 'name';
    },
  ) {
    return this.rulesService.findAll(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export security rules as JSON' })
  @ApiQuery({ name: 'category', required: false })
  async exportRules(@Query('category') category?: string) {
    const data = await this.rulesService.exportRules(category);
    return { data };
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import community security rules JSON' })
  async importRules(@Req() req: JwtRequest, @Body() body: { rules: CreateRuleDto[] }) {
    const result = await this.rulesService.importRules(
      req.user.sub,
      req.user.email || 'Contributor',
      body.rules || [],
    );
    return { data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get security rule by ID or name' })
  async findOne(@Param('id') id: string) {
    const rule = await this.rulesService.findOne(id);
    return { data: rule };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a custom security rule' })
  async create(@Req() req: JwtRequest, @Body() dto: CreateRuleDto) {
    const rule = await this.rulesService.create(
      req.user.sub,
      req.user.email || 'Community Contributor',
      dto,
    );
    return { data: rule };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a custom security rule' })
  async update(@Req() req: JwtRequest, @Param('id') id: string, @Body() dto: UpdateRuleDto) {
    const rule = await this.rulesService.update(req.user.sub, id, dto, req.user.role);
    return { data: rule };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a custom security rule' })
  async remove(@Req() req: JwtRequest, @Param('id') id: string) {
    const result = await this.rulesService.remove(req.user.sub, id, req.user.role);
    return { data: result };
  }

  @Post(':id/toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle rule enabled/disabled status' })
  async toggleRule(@Param('id') id: string) {
    const rule = await this.rulesService.toggleRule(id);
    return { data: rule };
  }

  @Post(':id/install')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Install/enable security rule and increment downloads' })
  async installRule(@Param('id') id: string) {
    const rule = await this.rulesService.installRule(id);
    return { data: rule };
  }
}
