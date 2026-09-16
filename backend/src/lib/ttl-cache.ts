interface CacheEntry<V> {
  value: Promise<V>;
  expiresAt: number;
}

/**
 * In-memory async cache, keyed by string, with a fixed TTL per instance. `getOrCompute` also dedupes
 * concurrent calls for the same key (they share the one in-flight promise) rather than firing off
 * duplicate requests. A rejected computation is never cached — a transient failure shouldn't keep
 * failing for the rest of the TTL window, it should just be retried on the next call.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, CacheEntry<V>>();

  constructor(private readonly ttlMs: number) {}

  async getOrCompute(key: string, compute: () => Promise<V>): Promise<V> {
    const existing = this.getIfFresh(key);
    if (existing) {
      return existing;
    }

    const value = compute();
    this.set(key, value);
    return value;
  }

  /** Returns the cached value for `key` if present and not expired, without triggering a compute. */
  getIfFresh(key: string): Promise<V> | undefined {
    const existing = this.entries.get(key);
    return existing && existing.expiresAt > Date.now() ? existing.value : undefined;
  }

  /** Registers an in-flight (or resolved) value for `key`, e.g. one produced by a batched fetch. */
  set(key: string, value: Promise<V>): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    value.catch(() => this.entries.delete(key));
  }
}
