/**
 * Token-bucket rate limiter for Zoho Sprints API.
 * Enforces a maximum of `maxCalls` requests per `windowMs` milliseconds.
 * Requests beyond the limit are queued and resolved when capacity is available.
 */
export class RateLimiter {
    private maxCalls: number;
    private windowMs: number;
    private timestamps: number[] = [];
    private queue: Array<() => void> = [];
    private drainTimer: ReturnType<typeof setTimeout> | null = null;

    /** Default values used when no server header is available */
    private static readonly DEFAULT_MAX_CALLS = 30;
    private static readonly DEFAULT_WINDOW_MS = 60_000;

    constructor(maxCalls = RateLimiter.DEFAULT_MAX_CALLS, windowMs = RateLimiter.DEFAULT_WINDOW_MS) {
        this.maxCalls = maxCalls;
        this.windowMs = windowMs;
    }

    /**
     * Sync the rate limiter with the server's `x-rate-limit` response header.
     *
     * The header value is a JSON array, e.g.:
     *   `[{"duration":120,"remaining-count":999}]`
     *
     * - `duration` (seconds) becomes the new window.
     * - `remaining-count` tells us how many calls we can still make.
     *
     * If the header is missing or unparseable we keep the current defaults.
     */
    syncFromHeader (headerValue: string | null): void {
        if (!headerValue) return;

        try {
            const entries = JSON.parse(headerValue) as Array<{
                duration?: number;
                "remaining-count"?: number;
            }>;

            const entry = entries[0];
            if (!entry) return;

            const duration = entry.duration;
            const remainingCount = entry["remaining-count"];

            if (typeof duration === "number" && duration > 0) {
                this.windowMs = duration * 1_000; // seconds → ms
            }

            if (typeof remainingCount === "number" && remainingCount >= 0) {
                // Derive maxCalls = already-used (in-window) + remaining
                this.pruneOld();
                const usedInWindow = this.timestamps.length;
                this.maxCalls = usedInWindow + remainingCount;
            }
        } catch {
            // Unparseable – keep existing limits
        }
    }

    /**
     * Wait until a request slot is available.
     * Resolves immediately if under the limit, otherwise queues.
     */
    async acquire (): Promise<void> {
        this.pruneOld();

        if (this.timestamps.length < this.maxCalls) {
            this.timestamps.push(Date.now());
            return;
        }

        // Queue the caller – resolved when a slot opens
        return new Promise<void>((resolve) => {
            this.queue.push(resolve);
            this.scheduleDrain();
        });
    }

    /** Number of calls made in the current window */
    get used (): number {
        this.pruneOld();
        return this.timestamps.length;
    }

    /** Number of remaining slots in the current window */
    get remaining (): number {
        return Math.max(0, this.maxCalls - this.used);
    }

    /** Current window duration in milliseconds */
    get window (): number {
        return this.windowMs;
    }

    /** Current maximum calls per window */
    get limit (): number {
        return this.maxCalls;
    }

    // ── internals ──────────────────────────────────────────────────────────────

    private pruneOld () {
        const cutoff = Date.now() - this.windowMs;
        this.timestamps = this.timestamps.filter((t) => t > cutoff);
    }

    private scheduleDrain () {
        if (this.drainTimer) return;
        if (this.queue.length === 0) return;

        // Wait until the oldest timestamp falls out of the window
        const oldest = this.timestamps[0];
        if (oldest === undefined) return;

        const delay = oldest + this.windowMs - Date.now() + 50; // +50 ms safety
        this.drainTimer = setTimeout(() => {
            this.drainTimer = null;
            this.drain();
        }, Math.max(delay, 50));
    }

    private drain () {
        this.pruneOld();

        while (this.queue.length > 0 && this.timestamps.length < this.maxCalls) {
            this.timestamps.push(Date.now());
            const resolve = this.queue.shift()!;
            resolve();
        }

        if (this.queue.length > 0) {
            this.scheduleDrain();
        }
    }
}
