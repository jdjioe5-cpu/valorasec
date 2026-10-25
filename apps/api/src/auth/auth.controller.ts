import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthService, type ClientMeta } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import type { Request } from 'express';

interface JwtRequest extends Request {
  user: { sub: string };
}

function extractClientMeta(req: Request): ClientMeta {
  const userAgent = (req.headers['user-agent'] as string) || undefined;
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim() || undefined
      : req.ip || req.socket.remoteAddress || undefined;

  return { userAgent, ipAddress };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const meta = extractClientMeta(req);
    const result = await this.authService.register(dto, meta);
    return { data: result };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const meta = extractClientMeta(req);
    const result = await this.authService.login(dto, meta);
    return { data: result };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const meta = extractClientMeta(req);
    const result = await this.authService.refreshToken(dto.refreshToken, meta);
    return { data: result };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { data: { message: 'Logged out successfully' } };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async profile(@Req() req: JwtRequest) {
    const user = await this.authService.getProfile(req.user.sub);
    return { data: user };
  }

  // ─── Session Management Endpoints (Issue #18) ──────────────────────────

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions for current user' })
  @ApiQuery({
    name: 'currentRefreshToken',
    required: false,
    description: 'Current session refresh token to highlight active device',
  })
  async getSessions(
    @Req() req: JwtRequest,
    @Headers('x-refresh-token') headerRefreshToken?: string,
    @Query('currentRefreshToken') queryRefreshToken?: string,
  ) {
    const currentToken = headerRefreshToken || queryRefreshToken;
    const sessions = await this.authService.getUserSessions(req.user.sub, currentToken);
    return { data: sessions };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiParam({ name: 'id', description: 'Session ID to revoke' })
  async revokeSession(@Req() req: JwtRequest, @Param('id') sessionId: string) {
    const result = await this.authService.revokeSession(req.user.sub, sessionId);
    return { data: result };
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all other sessions except current' })
  @ApiQuery({
    name: 'currentRefreshToken',
    required: false,
    description: 'Current session refresh token to preserve',
  })
  async revokeOtherSessions(
    @Req() req: JwtRequest,
    @Headers('x-refresh-token') headerRefreshToken?: string,
    @Query('currentRefreshToken') queryRefreshToken?: string,
  ) {
    const currentToken = headerRefreshToken || queryRefreshToken;
    const result = await this.authService.revokeOtherSessions(req.user.sub, currentToken);
    return { data: result };
  }
}
