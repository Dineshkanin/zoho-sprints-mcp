import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZohoSprintsClient } from "./api-client.js";
import type { ZohoSprintsConfig } from "./types.js";
import { ZOHO_DOMAINS } from "./types.js";
import { logger } from "./logger.js";

/**
 * Register MCP Resources – read-only data endpoints that MCP clients
 * can subscribe to and poll without invoking a tool.
 *
 * Resources exposed:
 *  - zoho-sprints://health          Health check & diagnostics
 *  - zoho-sprints://config          Current server configuration
 *  - zoho-sprints://projects        Projects list for the workspace
 *  - zoho-sprints://team-members    Team members in the workspace
 */
export function registerResources (
    server: McpServer,
    getClient: () => ZohoSprintsClient,
    startedAt: Date,
    config: ZohoSprintsConfig
): void {

    // ── Health Check ──────────────────────────────────────────────────────────
    server.registerResource(
        "health",
        "zoho-sprints://health",
        {
            description:
                "Zoho Sprints MCP server health & diagnostics – token status, " +
                "rate limiter usage, cache size, uptime, and request metrics.",
        },
        async (_uri) => {
            const client = getClient();
            const uptimeMs = Date.now() - startedAt.getTime();
            const uptimeMin = Math.round(uptimeMs / 60_000);

            const health = {
                status: "ok",
                uptime: `${uptimeMin} minutes`,
                startedAt: startedAt.toISOString(),
                ...client.stats,
            };

            return {
                contents: [
                    {
                        uri: "zoho-sprints://health",
                        mimeType: "application/json",
                        text: JSON.stringify(health, null, 2),
                    },
                ],
            };
        }
    );

    // ── Configuration ─────────────────────────────────────────────────────────
    server.registerResource(
        "config",
        "zoho-sprints://config",
        {
            description:
                "Current Zoho Sprints MCP server configuration – domain, team ID, " +
                "debug mode, rate limiter settings, retry budget, and cache status.",
        },
        async (_uri) => {
            const client = getClient();

            const configInfo = {
                domain: config.domain,
                apiBaseUrl: ZOHO_DOMAINS[config.domain] ?? "unknown",
                teamId: client.teamId ?? "not set",
                debugMode: logger.isDebug,
                rateLimiter: {
                    maxCallsPerWindow: client.rateLimiter.limit,
                    windowMs: client.rateLimiter.window,
                    currentUsed: client.rateLimiter.used,
                    currentRemaining: client.rateLimiter.remaining,
                },
                retryBudget: {
                    maxRetriesPerWindow: client.retryBudget.limit,
                    windowMs: client.retryBudget.window,
                    currentUsed: client.retryBudget.used,
                    currentRemaining: client.retryBudget.remaining,
                },
                cache: {
                    entriesCount: client.cache.size,
                },
                tokenAutoRefresh: "every 57 minutes",
            };

            return {
                contents: [
                    {
                        uri: "zoho-sprints://config",
                        mimeType: "application/json",
                        text: JSON.stringify(configInfo, null, 2),
                    },
                ],
            };
        }
    );

    // ── Projects List ─────────────────────────────────────────────────────────
    server.registerResource(
        "projects",
        "zoho-sprints://projects",
        {
            description:
                "List of all projects in the current Zoho Sprints workspace.",
        },
        async (_uri) => {
            const client = getClient();
            const teamId = client.teamId!;
            const result = await client.get(
                `/team/${teamId}/projects/`,
                { action: "allprojects" }
            );

            return {
                contents: [
                    {
                        uri: "zoho-sprints://projects",
                        mimeType: "application/json",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
    );

    // ── Team Members ──────────────────────────────────────────────────────────
    server.registerResource(
        "team-members",
        "zoho-sprints://team-members",
        {
            description:
                "List of all team members in the current Zoho Sprints workspace.",
        },
        async (_uri) => {
            const client = getClient();
            const teamId = client.teamId!;
            const result = await client.get(`/team/${teamId}/members/`);

            return {
                contents: [
                    {
                        uri: "zoho-sprints://team-members",
                        mimeType: "application/json",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
    );
}
