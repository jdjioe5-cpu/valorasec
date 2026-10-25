import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import type { IRateLimitStorage, RateLimitRecord } from './rate-limit-storage.interface';

export class MemoryRateLimitStorage implements IRateLimitStorage {
  private store = new Map<string, { hits: number; expiresAt: number }>();

  async increment(key: string, durationSec: number): Promise<RateLimitRecord> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.expiresAt <= now) {
      const resetTime = Math.ceil((now + durationSec * 1000) / 1000);
      this.store.set(key, { hits: 1, expiresAt: now + durationSec * 1000 });
      return { totalHits: 1, resetTime };
    }

    entry.hits += 1;
    return {
      totalHits: entry.hits,
      resetTime: Math.ceil(entry.expiresAt / 1000),
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

export class RedisRateLimitStorage implements IRateLimitStorage {
  private readonly logger = new Logger('RedisRateLimitStorage');
  private client: Redis | null = null;
  private memoryFallback = new MemoryRateLimitStorage();
  private isConnected = false;

  constructor(redisUrl?: string, host = 'localhost', port = 6379, password?: string) {
    try {
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
      } else {
        this.client = new Redis({
          host,
          port,
          password: password || undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
      }

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected to Redis rate limiter store.');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection error, falling back to memory store: ${err.message}`);
      });
    } catch {
      this.isConnected = false;
      this.logger.warn('Failed to initialize Redis client, using in-memory store.');
    }
  }

  async increment(key: string, durationSec: number): Promise<RateLimitRecord> {
    if (!this.isConnected || !this.client) {
      return this.memoryFallback.increment(key, durationSec);
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      // Redis atomic lua script: increment and set TTL if new key, return [count, ttl]
      const script = `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        local ttl = redis.call('TTL', KEYS[1])
        return {current, ttl}
      `;

      const [count, ttl] = (await this.client.eval(script, 1, key, durationSec)) as [
        number,
        number,
      ];

      const safeTtl = ttl > 0 ? ttl : durationSec;
      return {
        totalHits: Number(count),
        resetTime: now + Number(safeTtl),
      };
    } catch (err) {
      this.logger.warn(`Redis command failed, fallback to memory: ${(err as Error).message}`);
      return this.memoryFallback.increment(key, durationSec);
    }
  }

  async reset(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch {
        // Fallback
      }
    }
    await this.memoryFallback.reset(key);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
    await this.memoryFallback.close();
  }
}
