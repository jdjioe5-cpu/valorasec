import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IRateLimitStorage, RateLimitRecord } from './rate-limit-storage.interface';
import { RedisRateLimitStorage, MemoryRateLimitStorage } from './redis-rate-limit.storage';

@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private storage: IRateLimitStorage;

  constructor(private readonly config: ConfigService) {
    const isTest = process.env.NODE_ENV === 'test';
    const redisUrl = this.config.get<string>('REDIS_URL');
    const redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    const redisPort = Number(this.config.get<number>('REDIS_PORT', 6379));
    const redisPassword = this.config.get<string>('REDIS_PASSWORD');

    if (isTest || (!redisUrl && !this.config.get<string>('REDIS_HOST'))) {
      this.storage = new MemoryRateLimitStorage();
    } else {
      this.storage = new RedisRateLimitStorage(redisUrl, redisHost, redisPort, redisPassword);
    }
  }

  getStorage(): IRateLimitStorage {
    return this.storage;
  }

  setStorage(storage: IRateLimitStorage): void {
    this.storage = storage;
  }

  async checkRateLimit(
    key: string,
    limit: number,
    durationSec: number,
  ): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    totalHits: number;
  }> {
    const record: RateLimitRecord = await this.storage.increment(key, durationSec);
    const remaining = Math.max(0, limit - record.totalHits);
    const allowed = record.totalHits <= limit;

    return {
      allowed,
      limit,
      remaining,
      resetTime: record.resetTime,
      totalHits: record.totalHits,
    };
  }

  async reset(key: string): Promise<void> {
    await this.storage.reset(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.storage.close();
  }
}
