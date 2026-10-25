import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'RATE_LIMIT_OPTIONS';
export const SKIP_RATE_LIMIT_KEY = 'SKIP_RATE_LIMIT';

export interface RateLimitOptions {
  points: number; // Maximum allowed requests
  durationSec: number; // Time window in seconds
  keyPrefix?: string; // Cache key prefix (e.g., 'login', 'register')
}

/**
 * Configure endpoint-specific rate limit options.
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);

/**
 * Bypass rate limiting completely (e.g. for health checks).
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
