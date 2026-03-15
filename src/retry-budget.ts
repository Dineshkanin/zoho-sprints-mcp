/**
 * Global retry budget – caps the total number of retries across all
 * concurrent requests within a sliding time window.
 *
 * Prevents thundering-herd scenarios where many failing requests all
 * start retrying simultaneously and overwhelm the API / exhaust rate limits.
 */
export class RetryBudget {
    /** Maximum retries allowed within the window */
    private readonly maxRetries: number;

    /** Sliding window duration in ms */
    private readonly windowMs: number;

    /** Timestamps of retries within the current window */
    private retryTimestamps: number[] = [];

    /**
     * @param maxRetries  Total retries allowed across ALL requests within `windowMs` (default: 10)
     * @param windowMs    Sliding window in ms (default: 60 000 = 1 minute)
     */
    constructor(maxRetries = 10, windowMs = 60_000) {
        this.maxRetries = maxRetries;
        this.windowMs = windowMs;
    }

    /**
     * Try to consume one retry slot.
     * @returns `true` if a retry is allowed, `false` if the budget is exhausted.
     */
    tryConsume (): boolean {
        this.prune();

        if (this.retryTimestamps.length >= this.maxRetries) {
            return false;
        }

        this.retryTimestamps.push(Date.now());
        return true;
    }

    /** Number of retries used in the current window */
    get used (): number {
        this.prune();
        return this.retryTimestamps.length;
    }

    /** Number of retries remaining in the current window */
    get remaining (): number {
        return Math.max(0, this.maxRetries - this.used);
    }

    /** Configured maximum retries per window */
    get limit (): number {
        return this.maxRetries;
    }

    /** Configured window duration in ms */
    get window (): number {
        return this.windowMs;
    }

    // ── internals ──────────────────────────────────────────────────────────────

    private prune () {
        const cutoff = Date.now() - this.windowMs;
        this.retryTimestamps = this.retryTimestamps.filter((t) => t > cutoff);
    }
}
