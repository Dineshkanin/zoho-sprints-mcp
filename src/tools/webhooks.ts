import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, pick, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    get_placeholders: [],
    get_triggers: [],
    list: ["projectId"],
    get_details: ["projectId", "webhookId"],
    create: ["projectId", "name", "url", "triggers", "secretToken"],
    update: ["projectId", "webhookId", "name", "url", "triggers", "secretToken"],
    delete: ["projectId", "webhookId"],
    execute_function: ["projectId", "webhookId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "get_placeholders",
    "get_triggers",
    "list",
    "get_details",
    "create",
    "update",
    "delete",
    "execute_function",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    get_placeholders: (client, teamId, _p) =>
        client.get(`/team/${teamId}/webhooks/placeholders/`, { action: "data" }),

    get_triggers: (client, teamId, _p) =>
        client.get(`/team/${teamId}/webhooks/triggers/`, { action: "data" }),

    list: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/webhooks/`, {
            action: "data", index: p.index ?? "1", range: p.range ?? "20",
        }),

    get_details: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/webhooks/${p.webhookId}/`, { action: "data" }),

    create: (client, teamId, p) => {
        const data: Record<string, string> = pick(p, [
            "name", "url", "triggers", "secretToken", "customHeaders",
        ]);
        return client.post(`/team/${teamId}/projects/${p.projectId}/webhooks/`, data);
    },

    update: (client, teamId, p) => {
        const data: Record<string, string> = pick(p, [
            "name", "url", "triggers", "secretToken", "customHeaders",
        ]);
        return client.post(`/team/${teamId}/projects/${p.projectId}/webhooks/${p.webhookId}/`, data);
    },

    delete: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/webhooks/${p.webhookId}/`),

    execute_function: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/webhooks/${p.webhookId}/execute/`, {}),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage webhooks: CRUD, triggers, placeholders, and execution.
Operations:
  get_placeholders  - Get available payload placeholders
  get_triggers      - Get available webhook trigger events
  list              - List webhooks for a project (projectId, index, range)
  get_details       - Get webhook details (projectId, webhookId)
  create            - Create a webhook (projectId, name, url, triggers, secretToken, customHeaders?)
  update            - Update a webhook (projectId, webhookId, name, url, triggers, secretToken, customHeaders?)
  delete            - Delete a webhook (projectId, webhookId)
  execute_function  - Execute a webhook function (projectId, webhookId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerWebhookTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_webhooks",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.pagination("1", "20"),
                webhookId: z.string().optional().describe("Webhook ID (get_details, update, delete, execute_function)"),
                name: z.string().optional().describe("Webhook name (create, update)"),
                url: z.string().optional().describe("Webhook callback URL (create, update)"),
                triggers: z.string().optional().describe("Comma-separated trigger IDs (create, update)"),
                secretToken: z.string().optional().describe("Secret token for verification (create, update)"),
                customHeaders: z.string().optional().describe("Custom headers JSON (create, update)"),
            },
        },
        async (params) => {
            try {
                const p = params as ActionParams;
                validateRequired(REQUIRED_PARAMS, params.operation, p);
                const client = getClient();
                const teamId = client.teamId!;
                const handler = ACTION_HANDLERS[params.operation];
                const result = await handler(client, teamId, p);
                return toolResult(result);
            } catch (err) {
                return toolError(err);
            }
        }
    );
}
