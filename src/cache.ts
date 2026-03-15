/**
 * Simple in-memory TTL cache for read-only API responses.
 * Reduces redundant API calls for frequently accessed data.
 */
export class Cache {
    private readonly store = new Map<string, { data: unknown; expiresAt: number }>();
    private readonly defaultTtlMs: number;

    constructor(defaultTtlMs = 60_000) {
        this.defaultTtlMs = defaultTtlMs;
    }

    /** Get a cached value. Returns `undefined` on miss or expiry. */
    get<T = unknown> (key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }

        return entry.data as T;
    }

    /** Store a value with optional custom TTL. */
    set (key: string, data: unknown, ttlMs?: number): void {
        this.store.set(key, {
            data,
            expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
        });
    }

    /** Invalidate a specific key. */
    delete (key: string): void {
        this.store.delete(key);
    }

    /** Invalidate all keys matching a prefix. */
    invalidatePrefix (prefix: string): void {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }

    /** Remove all expired entries. */
    prune (): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }

    /** Clear the entire cache. */
    clear (): void {
        this.store.clear();
    }

    /** Number of cached entries (including possibly expired). */
    get size (): number {
        return this.store.size;
    }
}
