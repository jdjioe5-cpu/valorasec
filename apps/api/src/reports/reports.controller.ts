import { Controller, Post, Get, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import type { Request, Response } from 'express';

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
  async findAll(@Req() req: JwtRequest, @Query() query: PaginationDto & { projectId?: string }) {
    return this.reportsService.findAll({ ...query, userId: req.user.sub });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  async findOne(@Param('id') id: string) {
    const report = await this.reportsService.findOne(id);
    return { data: report };
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export report data (CSV or JSON)' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async exportReport(
    @Req() req: JwtRequest,
    @Param('id') id: string,
    @Query('format') format: string = 'json',
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.exportReport(req.user.sub, id, format);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return result.data;
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
