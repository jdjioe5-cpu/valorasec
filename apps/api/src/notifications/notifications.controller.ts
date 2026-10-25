import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateNotificationPreferencesDto } from './dto/update-preferences.dto';
import type { Request } from 'express';

interface JwtRequest extends Request {
  user: { sub: string };
}

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all notifications' })
  async findAll(@Req() req: JwtRequest) {
    return this.notificationsService.findAll(req.user.sub);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Req() req: JwtRequest, @Param('id') id: string) {
    await this.notificationsService.markRead(req.user.sub, id);
    return { data: { message: 'Notification marked as read' } };
  }

  @Post('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Req() req: JwtRequest) {
    await this.notificationsService.markAllRead(req.user.sub);
    return { data: { message: 'All notifications marked as read' } };
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get email notification preferences' })
  async getPreferences(@Req() req: JwtRequest) {
    const preferences = await this.notificationsService.getPreferences(req.user.sub);
    return { data: preferences };
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update email notification preferences' })
  async updatePreferences(@Req() req: JwtRequest, @Body() dto: UpdateNotificationPreferencesDto) {
    const preferences = await this.notificationsService.updatePreferences(req.user.sub, dto);
    return { data: preferences };
  }

  @Get('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from email notifications via token' })
  async unsubscribeGet(@Query('token') token: string, @Query('type') type?: string) {
    const result = await this.notificationsService.unsubscribe(token, type);
    return { data: result };
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from email notifications via token POST' })
  async unsubscribePost(@Body() body: { token: string; type?: string }) {
    const result = await this.notificationsService.unsubscribe(body.token, body.type);
    return { data: result };
  }
}
