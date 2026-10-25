import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import type { Request } from 'express';

interface JwtRequest extends Request {
  user: { sub: string };
}

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all webhooks for current user' })
  async findAll(@Req() req: JwtRequest) {
    const webhooks = await this.webhooksService.findAll(req.user.sub);
    return { data: webhooks };
  }

  @Post()
  @ApiOperation({ summary: 'Register a new webhook endpoint' })
  async create(@Req() req: JwtRequest, @Body() dto: CreateWebhookDto) {
    const webhook = await this.webhooksService.create(req.user.sub, dto);
    return { data: webhook };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook by id' })
  async findById(@Req() req: JwtRequest, @Param('id') id: string) {
    const webhook = await this.webhooksService.findById(req.user.sub, id);
    return { data: webhook };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook' })
  async delete(@Req() req: JwtRequest, @Param('id') id: string) {
    const res = await this.webhooksService.delete(req.user.sub, id);
    return { data: res };
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test webhook delivery with a ping payload' })
  async testWebhook(@Req() req: JwtRequest, @Param('id') id: string) {
    const result = await this.webhooksService.testWebhook(req.user.sub, id);
    return { data: result };
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get delivery logs for a webhook' })
  async getDeliveries(@Req() req: JwtRequest, @Param('id') id: string) {
    const deliveries = await this.webhooksService.findDeliveries(req.user.sub, id);
    return { data: deliveries };
  }
}
