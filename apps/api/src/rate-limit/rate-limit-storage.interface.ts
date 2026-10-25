export interface RateLimitRecord {
  totalHits: number;
  resetTime: number; // Unix timestamp in seconds
}

export interface IRateLimitStorage {
  increment(key: string, durationSec: number): Promise<RateLimitRecord>;
  reset(key: string): Promise<void>;
  close(): Promise<void>;
}
