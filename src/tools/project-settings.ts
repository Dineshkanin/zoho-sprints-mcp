import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    get_item_types: ["projectId"],
    get_priority_types: ["projectId"],
    get_project_status: ["projectId"],
    create_project_status: ["projectId", "name", "type"],
    update_project_status: ["projectId", "statusId"],
    delete_project_status: ["projectId", "statusId"],
    get_modules: [],
    get_custom_layouts: ["moduleId"],
    get_custom_fields: ["moduleId"],
    get_layout_fields: ["moduleId", "layoutId"],
    get_project_custom_fields: ["projectId", "moduleId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "get_item_types",
    "get_priority_types",
    "get_project_status",
    "create_project_status",
    "update_project_status",
    "delete_project_status",
    "get_modules",
    "get_custom_layouts",
    "get_custom_fields",
    "get_layout_fields",
    "get_project_custom_fields",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    get_item_types: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/itemtype/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "25" },
        ),

    get_priority_types: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/priority/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "25" },
        ),

    get_project_status: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/itemstatus/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "25" },
        ),

    create_project_status: (client, teamId, p) => {
        const data: Record<string, string> = { name: p.name!, type: p.type! };
        if (p.color) data.color = p.color;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/itemstatus/`,
            data,
        );
    },

    update_project_status: (client, teamId, p) => {
        const data: Record<string, string> = {};
        if (p.name) data.name = p.name;
        if (p.type) data.type = p.type;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/itemstatus/${p.statusId}/`,
            data,
        );
    },

    delete_project_status: (client, teamId, p) =>
        client.delete(
            `/team/${teamId}/projects/${p.projectId}/itemstatus/${p.statusId}/`,
        ),

    get_modules: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/settings/customization/modules/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "25" },
        ),

    get_custom_layouts: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/settings/customization/modules/${p.moduleId}/layout/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "25" },
        ),

    get_custom_fields: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/settings/customization/modules/${p.moduleId}/fields/`,
            { action: "data" },
        ),

    get_layout_fields: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/settings/customization/modules/${p.moduleId}/layout/${p.layoutId}/`,
            { action: "formfields" },
        ),

    get_project_custom_fields: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/`,
            { action: "formfields" },
        ),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage project settings: item types, priorities, statuses, modules, layouts, and custom fields.
Operations:
  get_item_types            - Get item types in a project (projectId, index, range)
  get_priority_types        - Get priority types (projectId, index, range)
  get_project_status        - Get item statuses (projectId, index, range)
  create_project_status     - Create an item status (projectId, name, type, color?)
  update_project_status     - Update an item status (projectId, statusId, name?, type?)
  delete_project_status     - Delete an item status (projectId, statusId)
  get_modules               - Get all modules in workspace (index, range)
  get_custom_layouts        - Get custom layouts for a module (moduleId, index, range)
  get_custom_fields         - Get custom fields for a module (moduleId)
  get_layout_fields         - Get fields of a layout (moduleId, layoutId)
  get_project_custom_fields - Get custom fields in a project (projectId, moduleId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerProjectSettingsTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_project_settings",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.moduleId,
                ...P.pagination("1", "25"),
                statusId: z.string().optional().describe("Status ID (update_project_status, delete_project_status)"),
                layoutId: z.string().optional().describe("Layout ID (get_layout_fields)"),
                name: z.string().optional().describe("Status name (create_project_status, update_project_status)"),
                type: z.string().optional().describe("Status type e.g. 'open', 'inprogress', 'closed' (create_project_status, update_project_status)"),
                color: z.string().optional().describe("Color hex code (create_project_status)"),
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
