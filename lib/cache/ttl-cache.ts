interface Entry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCacheOptions {
  maxEntries?: number;
  now?: () => number;
}

/**
 * Small in-memory cache with per-entry expiry, least-recently-used eviction
 * and in-flight request deduplication.
 *
 * It only smooths bursts of identical lookups within one server instance.
 * Entries are short-lived by design: catalog metadata is not stored long term.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: TtlCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 500;
    this.now = options.now ?? Date.now;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert so the Map's insertion order doubles as recency order.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /**
   * Returns the cached value, or runs `load` once even when several callers
   * ask for the same key at the same time. Failures are never cached.
   */
  async getOrLoad(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
