import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list: ["projectId"],
    get_details: ["projectId", "epicId"],
    get_sprints: ["projectId", "epicId"],
    create: ["projectId", "name", "owner"],
    associate_items: ["projectId", "sprintId", "epicid", "rootitemidarr"],
    update: ["projectId", "epicId"],
    delete: ["projectId", "epicId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list",
    "get_details",
    "get_sprints",
    "create",
    "associate_items",
    "update",
    "delete",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list: (client, teamId, p) => {
        const params: Record<string, string> = {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
        };
        if (p.viewtype) params.viewtype = p.viewtype;
        if (p.searchvalue) params.searchvalue = p.searchvalue;
        return client.get(`/team/${teamId}/projects/${p.projectId}/epic/`, params);
    },

    get_details: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/epic/${p.epicId}/`,
            { action: "details" },
        ),

    get_sprints: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/epic/${p.epicId}/sprint/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "50" },
        ),

    create: (client, teamId, p) => {
        const body: Record<string, unknown> = { name: p.name!, owner: p.owner! };
        if (p.desc) body.desc = p.desc;
        if (p.color) body.color = p.color;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/epic/`,
            undefined,
            body,
        );
    },

    associate_items: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/associate/`,
            { epicid: p.epicid!, rootitemidarr: p.rootitemidarr! },
        ),

    update: (client, teamId, p) => {
        const body: Record<string, unknown> = {};
        if (p.name) body.name = p.name;
        if (p.owner) body.owner = p.owner;
        if (p.desc) body.desc = p.desc;
        if (p.type) body.type = parseInt(p.type);
        if (p.color) body.color = p.color;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/epic/${p.epicId}/`,
            undefined,
            body,
        );
    },

    delete: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/epic/${p.epicId}/`),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage epics: CRUD, associate items, and view associated sprints.
Operations:
  list             - List epics in a project (projectId, index, range, viewtype?, searchvalue?)
  get_details      - Get epic details (projectId, epicId)
  get_sprints      - Get sprints associated with an epic (projectId, epicId, index, range)
  create           - Create an epic (projectId, name, owner, desc?, color?)
  associate_items  - Associate items with an epic (projectId, sprintId, epicid, rootitemidarr)
  update           - Update an epic (projectId, epicId, name?, owner?, desc?, type?, color?)
  delete           - Delete an epic (projectId, epicId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerEpicTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_epics",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.sprintId,
                ...P.epicId,
                ...P.pagination(),
                name: z.string().optional().describe("Epic name (create, update)"),
                owner: z.string().optional().describe("Owner user ID (create, update)"),
                desc: z.string().optional().describe("Epic description (create, update)"),
                color: z.string().optional().describe("Color hex code e.g. #3CB371 (create, update)"),
                type: z.string().optional().describe("0=active, 1=archive (update)"),
                viewtype: z.string().optional().describe("0=Active, 1=Archive (list)"),
                searchvalue: z.string().optional().describe("Search by epic name (list)"),
                epicid: z.string().optional().describe("Epic ID to associate items with (associate_items)"),
                rootitemidarr: z.string().optional().describe("JSONArray of parent item IDs (associate_items)"),
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
