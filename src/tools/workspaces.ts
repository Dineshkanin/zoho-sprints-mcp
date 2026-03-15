import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list: [],
    get_settings: [],
    get_link_types: [],
    get_tags: [],
    add_tag: ["name"],
    delete_tag: ["tagId"],
    delete_link_type: ["linktypeId"],
    get_global_logs: ["moduleId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list",
    "get_settings",
    "get_link_types",
    "get_tags",
    "add_tag",
    "delete_tag",
    "delete_link_type",
    "get_global_logs",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list: (client, _teamId, _p) =>
        client.get("/teams/"),

    get_settings: (client, teamId, _p) =>
        client.get(`/team/${teamId}/settings/`),

    get_link_types: (client, teamId, _p) =>
        client.get(`/team/${teamId}/linktype/`, { action: "data" }),

    get_tags: (client, teamId, p) =>
        client.get(`/team/${teamId}/tags/`, {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "100",
        }),

    add_tag: (client, teamId, p) => {
        const color = p.color ?? "#fa335c";
        return client.post(`/team/${teamId}/tag/`, { name: p.name!, color });
    },

    delete_tag: (client, teamId, p) =>
        client.delete(`/team/${teamId}/tag/${p.tagId}/`),

    delete_link_type: (client, teamId, p) =>
        client.delete(`/team/${teamId}/linktype/${p.linktypeId}/`),

    get_global_logs: (client, teamId, p) => {
        const viewType = p.viewType ?? "0";
        const viewNumber = p.viewNumber ?? "10";
        return client.get(
            `/team/${teamId}/portfolio/${viewType}/modules/${p.moduleId}/view/${viewNumber}/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "50" },
        );
    },
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage workspace-level settings: workspaces, tags, link types, and global log hours.
Operations:
  list             - List all workspaces
  get_settings     - Get workspace settings
  get_link_types   - Get default and custom link types
  get_tags         - List custom tags (index, range)
  add_tag          - Create a custom tag (name, color?)
  delete_tag       - Delete a custom tag (tagId)
  delete_link_type - Delete a custom link type (linktypeId)
  get_global_logs  - Get global log hours across projects (moduleId, viewType?, viewNumber?, index, range)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerWorkspaceTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_workspaces",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.pagination("1", "100"),
                name: z.string().optional().describe("Tag name (add_tag)"),
                color: z.string().optional().describe("Color hex code e.g. #fa335c (add_tag)"),
                tagId: z.string().optional().describe("Tag ID (delete_tag)"),
                linktypeId: z.string().optional().describe("Link type ID (delete_link_type)"),
                moduleId: z.string().optional().describe("Module ID (get_global_logs)"),
                viewType: z.string().optional().describe("0=Team, 1=My (get_global_logs)"),
                viewNumber: z.string().optional().describe("10 if viewType=0, 12 if viewType=1 (get_global_logs)"),
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
