#!/usr/bin/env node

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ZohoSprintsClient } from "./api-client.js";
import { ZohoSprintsConfig, ZOHO_DOMAINS } from "./types.js";
import { logger } from "./logger.js";

// Resource registrations
import { registerResources } from "./resources.js";

// Prompt registrations
import { registerPrompts } from "./prompts.js";

// Tool registrations
import { registerWorkspaceTools } from "./tools/workspaces.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerSprintTools } from "./tools/sprints.js";
import { registerItemTools } from "./tools/items.js";
import { registerEpicTools } from "./tools/epics.js";
import { registerReleaseTools } from "./tools/releases.js";
import { registerTimesheetTools } from "./tools/timesheets.js";
import { registerMeetingTools } from "./tools/meetings.js";
import { registerUserTools } from "./tools/users.js";
import { registerProjectSettingsTools } from "./tools/project-settings.js";
import { registerChecklistTools } from "./tools/checklists.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerOKRTools } from "./tools/okr.js";
import { registerExpenseTools } from "./tools/expenses.js";
import { registerCustomModuleTools } from "./tools/custom-modules.js";

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Proactive token refresh interval – 57 minutes (tokens expire after 60 min) */
const REFRESH_INTERVAL_MS = 57 * 60 * 1000;

// ─── Configuration ──────────────────────────────────────────────────────────────

function loadConfig (): ZohoSprintsConfig {
    const domain = process.env.ZOHO_SPRINTS_DOMAIN || "com";
    const refreshToken = process.env.ZOHO_SPRINTS_REFRESH_TOKEN;
    const clientId = process.env.ZOHO_SPRINTS_CLIENT_ID;
    const clientSecret = process.env.ZOHO_SPRINTS_CLIENT_SECRET;

    // Mandatory env vars
    const missing: string[] = [];
    if (!refreshToken) missing.push("ZOHO_SPRINTS_REFRESH_TOKEN");
    if (!clientId) missing.push("ZOHO_SPRINTS_CLIENT_ID");
    if (!clientSecret) missing.push("ZOHO_SPRINTS_CLIENT_SECRET");

    if (missing.length > 0) {
        console.error(`Error: Missing required environment variable(s): ${missing.join(", ")}`);
        process.exit(1);
    }

    if (!ZOHO_DOMAINS[domain]) {
        console.error(`Error: Invalid domain "${domain}".`);
        console.error(`Valid domains: ${Object.keys(ZOHO_DOMAINS).join(", ")}`);
        process.exit(1);
    }

    const config: ZohoSprintsConfig = {
        domain,
        refreshToken: refreshToken!,
        clientId: clientId!,
        clientSecret: clientSecret!,
    };

    // Optional: pre-supplied access token (skips initial refresh)
    if (process.env.ZOHO_SPRINTS_ACCESS_TOKEN) {
        config.accessToken = process.env.ZOHO_SPRINTS_ACCESS_TOKEN;
    }

    // Optional: workspace team ID
    if (process.env.ZOHO_SPRINTS_TEAM_ID) {
        config.teamId = process.env.ZOHO_SPRINTS_TEAM_ID;
    }

    return config;
}

// ─── Server Setup ───────────────────────────────────────────────────────────────

async function main () {
    const config = loadConfig();
    const client = new ZohoSprintsClient(config);
    const startedAt = new Date();

    // Bootstrap: fetch initial access token if one was not provided
    if (!config.accessToken) {
        console.error("Fetching initial access token via refresh token...");
        await client.refreshAccessToken();
        console.error("Access token obtained successfully.");
    }

    // Auto-detect team ID if not provided
    if (!client.teamId) {
        console.error("ZOHO_SPRINTS_TEAM_ID not set – detecting workspace...");
        try {
            const teamsResponse = await client.get("/teams/");
            const portals = (teamsResponse as any).portals as Array<{ teamId?: string; zsoid?: string; name?: string; team_name?: string }> | undefined;

            if (!portals || portals.length === 0) {
                console.error("Error: No workspaces (portals) found for this account.");
                process.exit(1);
            }

            if (portals.length === 1) {
                const portal = portals[0]!;
                const detectedId = portal.zsoid || portal.teamId || "";
                client.teamId = detectedId;
                console.error(`Auto-selected workspace: ${portal.team_name || portal.name || detectedId} (${detectedId})`);
            } else {
                console.error("\nError: Multiple workspaces found. Set ZOHO_SPRINTS_TEAM_ID to one of:\n");
                for (const portal of portals) {
                    const id = portal.zsoid || portal.teamId || "unknown";
                    const name = portal.team_name || portal.name || "Unnamed";
                    console.error(`  • ${name}  →  ZOHO_SPRINTS_TEAM_ID=${id}`);
                }
                console.error("");
                process.exit(1);
            }
        } catch (err) {
            console.error("Error: Failed to fetch workspaces for auto-detection:", err);
            console.error("Please set ZOHO_SPRINTS_TEAM_ID manually.");
            process.exit(1);
        }
    }

    // Proactive refresh – renew the access token every 57 minutes
    setInterval(async () => {
        try {
            await client.refreshAccessToken();
            logger.info("Access token refreshed proactively.");
        } catch (err) {
            logger.error("Proactive token refresh failed:", err);
        }
    }, REFRESH_INTERVAL_MS);

    const server = new McpServer({
        name: "zoho-sprints",
        version: "1.0.0",
        description:
            "MCP server for Zoho Sprints - Agile project management. " +
            "Manage workspaces, projects, sprints, items, epics, releases, " +
            "timesheets, meetings, users, checklists, webhooks, OKR, expenses, " +
            "custom fields, and custom modules.",
    });

    // Provide a getter so tools always use the latest client
    const getClient = () => client;

    // Register MCP resources (health check, config, projects, team members)
    registerResources(server, getClient, startedAt, config);

    // Register MCP prompts (plan_sprint, project_summary, daily_standup)
    registerPrompts(server);

    // Register all tool modules
    registerWorkspaceTools(server, getClient);
    registerProjectTools(server, getClient);
    registerSprintTools(server, getClient);
    registerItemTools(server, getClient);
    registerEpicTools(server, getClient);
    registerReleaseTools(server, getClient);
    registerTimesheetTools(server, getClient);
    registerMeetingTools(server, getClient);
    registerUserTools(server, getClient);
    registerProjectSettingsTools(server, getClient);
    registerChecklistTools(server, getClient);
    registerWebhookTools(server, getClient);
    registerOKRTools(server, getClient);
    registerExpenseTools(server, getClient);
    registerCustomModuleTools(server, getClient);

    // ── Transport Selection ─────────────────────────────────────────────────
    const transportMode = (process.env.MCP_TRANSPORT || "stdio").toLowerCase();

    if (transportMode === "http") {
        await startHttpTransport(server);
    } else {
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }

    console.error("Zoho Sprints MCP server started successfully.");
    console.error(`Transport: ${transportMode}`);
    console.error(`Domain: ${config.domain} (${ZOHO_DOMAINS[config.domain]})`);
    if (config.teamId) {
        console.error(`Team ID: ${config.teamId}`);
    }
    console.error(`Token auto-refresh: every 57 minutes`);
    console.error(`Debug mode: ${logger.isDebug ? "ON" : "OFF"}`);
    console.error(`Features: rate-limiting, caching (60s TTL), retry (3x backoff), retry budget`);
}

// ─── HTTP Transport ─────────────────────────────────────────────────────────────

/**
 * Start the MCP server with Streamable HTTP transport.
 * Allows remote MCP clients (e.g. ChatGPT) to connect via a public URL.
 *
 * Environment variables:
 *   MCP_HTTP_PORT  – port to listen on (default: 3000)
 *   MCP_HTTP_HOST  – host to bind to (default: 0.0.0.0)
 *   MCP_HTTP_PATH  – endpoint path (default: /mcp)
 */
async function startHttpTransport (server: McpServer): Promise<void> {
    const port = parseInt(process.env.MCP_HTTP_PORT || "3000", 10);
    const host = process.env.MCP_HTTP_HOST || "0.0.0.0";
    const mcpPath = process.env.MCP_HTTP_PATH || "/mcp";

    // Map of session ID → transport for stateful session management
    const transports = new Map<string, StreamableHTTPServerTransport>();

    const httpServer = createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

        // CORS headers for browser-based clients
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
        res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }

        // Health endpoint for load balancers / uptime checks
        if (url.pathname === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok" }));
            return;
        }

        if (url.pathname !== mcpPath) {
            res.writeHead(404);
            res.end("Not Found");
            return;
        }

        // For new sessions (POST without session ID), create a new transport
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (req.method === "POST" && !sessionId) {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
            });

            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid) transports.delete(sid);
            };

            await server.connect(transport);

            const sid = transport.sessionId;
            if (sid) transports.set(sid, transport);

            await transport.handleRequest(req, res);
            return;
        }

        // For existing sessions, look up the transport
        if (sessionId) {
            const transport = transports.get(sessionId);
            if (transport) {
                await transport.handleRequest(req, res);
                return;
            }
        }

        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or missing session ID" }));
    });

    httpServer.listen(port, host, () => {
        console.error(`HTTP transport listening on http://${host}:${port}${mcpPath}`);
    });
}

main().catch((error) => {
    console.error("Fatal error starting Zoho Sprints MCP server:", error);
    process.exit(1);
});
