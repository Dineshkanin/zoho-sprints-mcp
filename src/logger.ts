/**
 * Lightweight debug logger for the Zoho Sprints MCP server.
 * Enabled by setting ZOHO_SPRINTS_DEBUG=true environment variable.
 * All output goes to stderr so it doesn't interfere with MCP stdio transport.
 */
export class Logger {
    private readonly enabled: boolean;
    private readonly startTime: number;

    constructor(enabled?: boolean) {
        this.enabled = enabled ?? (process.env.ZOHO_SPRINTS_DEBUG === "true");
        this.startTime = Date.now();
    }

    /** Whether debug logging is enabled. */
    get isDebug (): boolean {
        return this.enabled;
    }

    /** Always log (regardless of debug flag). */
    info (message: string, ...args: unknown[]): void {
        console.error(`[zoho-sprints] ${message}`, ...args);
    }

    /** Only log when ZOHO_SPRINTS_DEBUG=true. */
    debug (message: string, ...args: unknown[]): void {
        if (!this.enabled) return;
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.error(`[zoho-sprints DEBUG +${elapsed}s] ${message}`, ...args);
    }

    /** Log an API request (debug only). */
    request (method: string, path: string, params?: Record<string, string>): void {
        if (!this.enabled) return;
        const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
        this.debug(`→ ${method} ${path}${qs}`);
    }

    /** Log an API response (debug only). */
    response (method: string, path: string, status: number, durationMs: number): void {
        if (!this.enabled) return;
        this.debug(`← ${method} ${path} ${status} (${durationMs}ms)`);
    }

    /** Log a warning. */
    warn (message: string, ...args: unknown[]): void {
        console.error(`[zoho-sprints WARN] ${message}`, ...args);
    }

    /** Log an error. */
    error (message: string, ...args: unknown[]): void {
        console.error(`[zoho-sprints ERROR] ${message}`, ...args);
    }
}

/** Singleton logger instance. */
export const logger = new Logger();
