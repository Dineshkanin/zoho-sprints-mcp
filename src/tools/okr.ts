import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    get_statuses: [],
    list: [],
    create: ["title", "type", "ownerId", "statusId", "startDate", "endDate"],
    delete: ["okrId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "get_statuses",
    "list",
    "create",
    "delete",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    get_statuses: (client, teamId, _p) =>
        client.get(`/team/${teamId}/okrsettings/status/`),

    list: (client, teamId, p) =>
        client.get(`/team/${teamId}/okrs/`, {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
        }),

    create: (client, teamId, p) => {
        const body: Record<string, unknown> = {
            title: p.title!,
            type: p.type!,
            ownerId: p.ownerId!,
            statusId: p.statusId!,
            startDate: p.startDate!,
            endDate: p.endDate!,
        };
        if (p.description) body.description = p.description;
        return client.post(`/team/${teamId}/okrs/`, undefined, body);
    },

    delete: (client, teamId, p) =>
        client.delete(`/team/${teamId}/okrs/${p.okrId}/`),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage OKR (Objectives and Key Results).
Operations:
  get_statuses - Get all OKR statuses in the workspace
  list         - List OKRs (index, range)
  create       - Create a root objective (title, type, ownerId, statusId, startDate, endDate, description?)
  delete       - Delete an OKR (okrId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerOKRTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_okr",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.pagination(),
                title: z.string().optional().describe("Objective title (create)"),
                type: z.string().optional().describe("OKR type e.g. 1 for objective (create)"),
                ownerId: z.string().optional().describe("Owner user ID (create)"),
                statusId: z.string().optional().describe("Status ID from get_statuses (create)"),
                startDate: z.string().optional().describe("Start date ISO yyyy-MM-dd'T'HH:mm:ssZ (create)"),
                endDate: z.string().optional().describe("End date ISO yyyy-MM-dd'T'HH:mm:ssZ (create)"),
                description: z.string().optional().describe("Description (create)"),
                okrId: z.string().optional().describe("OKR ID (delete)"),
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
