import { Controller, Post, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryReportsDto } from './dto/query-reports.dto';
import type { Request } from 'express';

interface JwtRequest extends Request {
  user: { sub: string };
}

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List all reports' })
  async findAll(@Req() req: JwtRequest, @Query() query: QueryReportsDto) {
    return this.reportsService.findAll({ ...query, userId: req.user.sub });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  async findOne(@Param('id') id: string) {
    const report = await this.reportsService.findOne(id);
    return { data: report };
  }

  @Post('scans/:scanId/report')
  @ApiOperation({ summary: 'Generate a report from a scan' })
  async generateReport(@Req() req: JwtRequest, @Param('scanId') scanId: string) {
    const report = await this.reportsService.generateReport(req.user.sub, scanId);
    return { data: report };
  }

  @Post(':id/register')
  @ApiOperation({ summary: 'Register report on-chain (Stellar Testnet)' })
  async registerOnChain(@Param('id') id: string) {
    const report = await this.reportsService.registerOnChain(id);
    return { data: report };
  }
}
