import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, pick, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list: ["projectId"],
    add_item_log: ["projectId", "sprintId", "itemId", "action", "users", "logdate", "hours"],
    add_general: ["projectId", "sprintId", "users", "logdate", "hours"],
    delete: ["projectId", "sprintId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list",
    "add_item_log",
    "add_general",
    "delete",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/logs/`, {
            action: "data", index: p.index ?? "1", range: p.range ?? "20",
        }),

    add_item_log: (client, teamId, p) => {
        const data: Record<string, string> = {
            action: "additemlog",
            ...pick(p, ["users", "logdate", "hours", "notes"]),
        };
        if (p.billstatus) data.billstatus = p.billstatus;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/logs/`,
            data,
        );
    },

    add_general: (client, teamId, p) => {
        const data: Record<string, string> = {
            action: "addgenerallog",
            ...pick(p, ["users", "logdate", "hours", "notes"]),
        };
        if (p.billstatus) data.billstatus = p.billstatus;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/generallog/`,
            data,
        );
    },

    delete: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/logs/`, {
            action: "delete",
            logidarr: p.logidarr!,
        }),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage timesheets: list, add item/general log hours, and delete logs.
Operations:
  list         - List log hours for a project (projectId, index, range)
  add_item_log - Log hours against a work item (projectId, sprintId, itemId, users, logdate, hours, notes?, billstatus?)
  add_general  - Log general hours (not item-specific) (projectId, sprintId, users, logdate, hours, notes?, billstatus?)
  delete       - Delete log entries (projectId, sprintId, logidarr)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerTimesheetTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_timesheets",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.sprintId,
                ...P.itemId,
                ...P.pagination("1", "20"),
                action: z.string().optional().describe("additemlog or addgenerallog (add_item_log)"),
                users: z.string().optional().describe("JSONArray of user IDs (add_item_log, add_general)"),
                logdate: z.string().optional().describe("Log date MM-dd-yyyy (add_item_log, add_general)"),
                hours: z.string().optional().describe("Hours in hh:mm format (add_item_log, add_general)"),
                billstatus: z.string().optional().describe("Billable=1, Non-billable=0 (add_item_log, add_general)"),
                notes: z.string().optional().describe("Description about the time log (add_item_log, add_general)"),
                logidarr: z.string().optional().describe("JSONArray of log hour IDs to delete (delete)"),
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
