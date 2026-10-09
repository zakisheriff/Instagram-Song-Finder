export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window, per-key request limiter held in server memory.
 *
 * On serverless hosting each instance keeps its own counters, so this is a
 * guard against bursts and accidental loops rather than a global quota. For a
 * hard cross-instance limit, back the same interface with a shared store.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.maxKeys = options.maxKeys ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (this.buckets.size >= this.maxKeys) this.prune(now);
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    const allowed = bucket.count <= this.limit;
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    // Still full of live windows: drop the oldest keys to bound memory.
    while (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}

/** Best-effort client address from standard proxy headers. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
