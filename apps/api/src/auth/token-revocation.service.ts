import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RevokedTokenEntry {
  userId: string;
  revokedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);
  private readonly inMemoryRevokedTokens = new Map<string, RevokedTokenEntry>();
  private readonly defaultTtlMs: number;

  constructor(private readonly config: ConfigService) {
    this.defaultTtlMs =
      parseInt(this.config.get<string>('JWT_REFRESH_EXPIRES_IN_MS', '604800000'), 10) || 604800000; // 7 days default
  }

  /**
   * Records a refresh token as revoked/rotated.
   */
  async recordRevokedToken(
    token: string,
    userId: string,
    ttlMs: number = this.defaultTtlMs,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    this.inMemoryRevokedTokens.set(token, {
      userId,
      revokedAt: now,
      expiresAt,
    });

    this.logger.debug(`Token recorded as revoked for user: ${userId}`);
    this.cleanupExpiredTokens();
  }

  /**
   * Checks whether a refresh token was previously revoked/rotated.
   */
  async checkRevocation(token: string): Promise<{ isRevoked: boolean; userId?: string }> {
    const entry = this.inMemoryRevokedTokens.get(token);
    if (!entry) {
      return { isRevoked: false };
    }

    if (entry.expiresAt < new Date()) {
      this.inMemoryRevokedTokens.delete(token);
      return { isRevoked: false };
    }

    return {
      isRevoked: true,
      userId: entry.userId,
    };
  }

  /**
   * Cleans up expired revocation records from memory.
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, entry] of this.inMemoryRevokedTokens.entries()) {
      if (entry.expiresAt < now) {
        this.inMemoryRevokedTokens.delete(token);
      }
    }
  }

  /**
   * Clears all in-memory revocation records (primarily for testing).
   */
  clear(): void {
    this.inMemoryRevokedTokens.clear();
  }
}
