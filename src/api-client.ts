import {
    ZOHO_DOMAINS,
    ZOHO_ACCOUNTS_DOMAINS,
    type ZohoSprintsConfig,
    type ApiResponse,
} from "./types.js";
import { RateLimiter } from "./rate-limiter.js";
import { RetryBudget } from "./retry-budget.js";
import { Cache } from "./cache.js";
import { logger } from "./logger.js";

/** Default Zoho Sprints custom headers */
const ZOHO_HEADERS: Record<string, string> = {
    "X-ZA-CONVERT-RESPONSE": "true",
    "X-ZA-UI-VERSION": "v2",
    "X-ZA-REQSIZE": "large",
};

/** Retry configuration */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;

/**
 * Low-level HTTP client for the Zoho Sprints REST API.
 *
 * Features:
 * - Zoho custom headers on every request
 * - Token-bucket rate limiter (30 req/min)
 * - Exponential backoff retry on transient errors (429, 5xx, network)
 * - In-memory TTL cache for GET requests (60 s)
 * - Debug logging via ZOHO_SPRINTS_DEBUG=true
 * - Auto-pagination helper
 */
export class ZohoSprintsClient {
    private accessToken: string;
    private readonly domain: string;
    private readonly baseUrl: string;
    private readonly refreshToken: string;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly accountsUrl: string;
    public teamId?: string;

    /** Rate limiter shared across all requests */
    readonly rateLimiter = new RateLimiter(30, 60_000);

    /** Global retry budget – caps total retries across all concurrent requests */
    readonly retryBudget = new RetryBudget(10, 60_000);

    /** Response cache for GET requests */
    readonly cache = new Cache(60_000);

    // ── Metrics ────────────────────────────────────────────────────────────────
    private _totalRequests = 0;
    private _cacheHits = 0;
    private _retries = 0;
    private _lastRefreshAt: Date | null = null;

    get stats () {
        return {
            totalRequests: this._totalRequests,
            cacheHits: this._cacheHits,
            retries: this._retries,
            rateLimitRemaining: this.rateLimiter.remaining,
            rateLimitUsed: this.rateLimiter.used,
            rateLimitMax: this.rateLimiter.limit,
            rateLimitWindowMs: this.rateLimiter.window,
            cacheSize: this.cache.size,
            retryBudgetUsed: this.retryBudget.used,
            retryBudgetRemaining: this.retryBudget.remaining,
            retryBudgetLimit: this.retryBudget.limit,
            lastTokenRefresh: this._lastRefreshAt?.toISOString() ?? "never",
            accessTokenPresent: this.accessToken.length > 0,
        };
    }

    constructor(config: ZohoSprintsConfig) {
        this.accessToken = config.accessToken ?? "";
        this.domain = config.domain;
        this.baseUrl =
            ZOHO_DOMAINS[config.domain] ?? ZOHO_DOMAINS["com"]!;
        this.accountsUrl =
            ZOHO_ACCOUNTS_DOMAINS[config.domain] ?? ZOHO_ACCOUNTS_DOMAINS["com"]!;
        this.refreshToken = config.refreshToken;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.teamId = config.teamId;
    }

    // ---------------------------------------------------------------------------
    // Token refresh
    // ---------------------------------------------------------------------------

    /**
     * Fetch a new access token using the refresh token.
     * Called automatically on 401 responses, proactively on a timer,
     * and at startup to bootstrap.
     */
    async refreshAccessToken (): Promise<void> {
        const url = `${this.accountsUrl}/oauth/v2/token`;
        const body = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: this.refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
        });

        logger.debug("Refreshing access token...");

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Token refresh failed (${res.status}): ${text}`);
        }

        const json = (await res.json()) as { access_token?: string };
        if (!json.access_token) {
            throw new Error("Token refresh response missing access_token");
        }

        this.accessToken = json.access_token;
        this._lastRefreshAt = new Date();
        logger.debug("Access token refreshed successfully.");
    }

    // ---------------------------------------------------------------------------
    // Core HTTP helpers
    // ---------------------------------------------------------------------------

    private authHeaders (): Record<string, string> {
        return {
            ...ZOHO_HEADERS,
            Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        };
    }

    /**
     * Execute a fetch with rate limiting, retry with exponential backoff,
     * and automatic 401 token refresh.
     */
    private async executeWithRetry (
        method: string,
        url: string,
        options: RequestInit,
        path: string,
        attempt = 0
    ): Promise<Response> {
        // Rate limit
        await this.rateLimiter.acquire();

        this._totalRequests++;
        const start = Date.now();
        logger.request(method, path);

        let res: Response;
        try {
            res = await fetch(url, options);
        } catch (err) {
            // Network error – retry if attempts remain AND budget allows
            if (attempt < MAX_RETRIES && this.retryBudget.tryConsume()) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                this._retries++;
                logger.warn(`Network error on ${method} ${path}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
                await this.sleep(delay);
                return this.executeWithRetry(method, url, options, path, attempt + 1);
            }
            throw err;
        }

        const durationMs = Date.now() - start;
        logger.response(method, path, res.status, durationMs);

        // Sync rate limiter from server's x-rate-limit header
        this.rateLimiter.syncFromHeader(res.headers.get("x-rate-limit"));

        // Token expired – refresh and retry once
        if (res.status === 401 && attempt === 0) {
            logger.debug("401 received, refreshing token and retrying...");
            await this.refreshAccessToken();
            // Update auth header in options
            const headers = options.headers as Record<string, string>;
            headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
            return this.executeWithRetry(method, url, options, path, attempt + 1);
        }

        // // Zoho auth failure – code 7700 / "Authentication failed" (may arrive as any HTTP status)
        // if (attempt === 0) {
        //     const cloned = res.clone();
        //     try {
        //         const body = await cloned.json() as { code?: number; message?: string };
        //         if (body.code === 7700 && body.message === "Authentication failed") {
        //             logger.debug("Zoho auth failure (code 7700) received, refreshing token and retrying...");
        //             await this.refreshAccessToken();
        //             const headers = options.headers as Record<string, string>;
        //             headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
        //             return this.executeWithRetry(method, url, options, path, attempt + 1);
        //         }
        //     } catch {
        //         // Not JSON or parse error – fall through to normal handling
        //     }
        // }

        // Rate limited by Zoho – wait and retry (if budget allows)
        if (res.status === 429 && attempt < MAX_RETRIES && this.retryBudget.tryConsume()) {
            const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5", 10);
            const delay = retryAfter * 1000;
            this._retries++;
            logger.warn(`429 rate limited on ${method} ${path}, retrying in ${delay}ms...`);
            await this.sleep(delay);
            return this.executeWithRetry(method, url, options, path, attempt + 1);
        }

        // Server error – retry with backoff (if budget allows)
        if (res.status >= 500 && attempt < MAX_RETRIES && this.retryBudget.tryConsume()) {
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            this._retries++;
            logger.warn(`${res.status} on ${method} ${path}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
            await this.sleep(delay);
            return this.executeWithRetry(method, url, options, path, attempt + 1);
        }

        return res;
    }

    async get (
        path: string,
        params?: Record<string, string>
    ): Promise<ApiResponse> {
        const url = new URL(`${this.baseUrl}${path}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, v);
            }
        }

        // Check cache
        const cacheKey = url.toString();
        const cached = this.cache.get<ApiResponse>(cacheKey);
        if (cached) {
            this._cacheHits++;
            logger.debug(`Cache HIT: ${path}`);
            return cached;
        }

        const res = await this.executeWithRetry("GET", url.toString(), {
            method: "GET",
            headers: this.authHeaders(),
        }, path);

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`GET ${path} failed (${res.status}): ${text}`);
        }

        const data = (await res.json()) as ApiResponse;

        // Cache GET responses
        this.cache.set(cacheKey, data);

        return data;
    }

    async post (
        path: string,
        data?: Record<string, string>,
        jsonBody?: unknown
    ): Promise<ApiResponse> {
        const url = `${this.baseUrl}${path}`;

        const headers: Record<string, string> = { ...this.authHeaders() };
        let body: string | undefined;

        if (jsonBody !== undefined) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(jsonBody);
        } else if (data) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            body = new URLSearchParams(data).toString();
        }

        const res = await this.executeWithRetry("POST", url, {
            method: "POST",
            headers,
            body,
        }, path);

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`POST ${path} failed (${res.status}): ${text}`);
        }

        // Invalidate cache for this path's prefix (write operations)
        const prefix = `${this.baseUrl}${path.split("/").slice(0, -1).join("/")}`;
        this.cache.invalidatePrefix(prefix);

        return (await res.json()) as ApiResponse;
    }

    async delete (
        path: string,
        params?: Record<string, string>
    ): Promise<ApiResponse> {
        const url = new URL(`${this.baseUrl}${path}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, v);
            }
        }

        const res = await this.executeWithRetry("DELETE", url.toString(), {
            method: "DELETE",
            headers: this.authHeaders(),
        }, path);

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`DELETE ${path} failed (${res.status}): ${text}`);
        }

        // Invalidate cache for this path's prefix
        const prefix = `${this.baseUrl}${path.split("/").slice(0, -1).join("/")}`;
        this.cache.invalidatePrefix(prefix);

        return (await res.json()) as ApiResponse;
    }

    // ---------------------------------------------------------------------------
    // Auto-pagination
    // ---------------------------------------------------------------------------

    /**
     * Fetch all pages of a paginated endpoint automatically.
     * Keeps fetching until fewer results than `pageSize` are returned.
     *
     * @param path      API path (e.g. `/team/{id}/projects/`)
     * @param params    Base query params (should include `action`, etc.)
     * @param dataKey   Key in the response that holds the array of records
     * @param pageSize  Number of records per page (default: 100)
     * @param maxPages  Safety limit on pages to fetch (default: 20)
     * @returns         Merged array of all records
     */
    async getAll (
        path: string,
        params: Record<string, string> = {},
        dataKey: string,
        pageSize = 100,
        maxPages = 20
    ): Promise<unknown[]> {
        const allRecords: unknown[] = [];
        let index = 1;

        for (let page = 0; page < maxPages; page++) {
            const pageParams = {
                ...params,
                index: String(index),
                range: String(pageSize),
            };

            const result = await this.get(path, pageParams);
            const records = (result as Record<string, unknown>)[dataKey];

            if (!Array.isArray(records) || records.length === 0) {
                break;
            }

            allRecords.push(...records);

            if (records.length < pageSize) {
                break; // last page
            }

            index += records.length;
        }

        logger.debug(`getAll ${path}: fetched ${allRecords.length} records`);
        return allRecords;
    }

    // ---------------------------------------------------------------------------
    // Utilities
    // ---------------------------------------------------------------------------

    private sleep (ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
