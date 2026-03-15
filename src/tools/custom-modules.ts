import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, pick, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list_global: ["moduleId"],
    list_project: ["projectId", "moduleId"],
    get_details_global: ["moduleId", "recordId"],
    get_details_project: ["projectId", "moduleId", "recordId"],
    add_global: ["moduleId", "name", "statusid"],
    add_project: ["projectId", "moduleId", "name", "statusid"],
    delete_global: ["moduleId", "recordId"],
    delete_project: ["projectId", "moduleId", "recordId"],
    associate: ["projectId", "moduleId", "toprojectid", "entityidarr"],
    get_status: ["moduleId", "layoutId"],
};


// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list_global",
    "list_project",
    "get_details_global",
    "get_details_project",
    "add_global",
    "add_project",
    "delete_global",
    "delete_project",
    "associate",
    "get_status",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list_global: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/modules/${p.moduleId}/portfolioview/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "50" },
        ),

    list_project: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/portfolioview/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "50" },
        ),

    get_details_global: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/modules/${p.moduleId}/entity/${p.recordId}/`,
            { action: "details" },
        ),

    get_details_project: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/${p.recordId}/`,
            { action: "details" },
        ),

    add_global: (client, teamId, p) => {
        const data: Record<string, string> = pick(p, [
            "name", "statusid", "projectid", "owners", "description",
        ]);
        return client.post(`/team/${teamId}/modules/${p.moduleId}/entity/`, data);
    },

    add_project: (client, teamId, p) => {
        const data: Record<string, string> = pick(p, [
            "name", "statusid", "owners", "description",
        ]);
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/`,
            data,
        );
    },

    delete_global: (client, teamId, p) =>
        client.delete(`/team/${teamId}/modules/${p.moduleId}/entity/${p.recordId}/`),

    delete_project: (client, teamId, p) =>
        client.delete(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/${p.recordId}/`,
        ),

    associate: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entities/action/associate/`,
            { toprojectid: p.toprojectid!, entityidarr: p.entityidarr! },
        ),

    get_status: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/modules/${p.moduleId}/layout/${p.layoutId}/entity/status/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "50" },
        ),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage custom module records: CRUD, association, and statuses.
Operations:
  list_global         - List records globally (moduleId, index, range)
  list_project        - List records in a project (projectId, moduleId, index, range)
  get_details_global  - Get record details globally (moduleId, recordId)
  get_details_project - Get record details in project (projectId, moduleId, recordId)
  add_global          - Add a record globally (moduleId, name, statusid, projectid?, owners?, description?)
  add_project         - Add a record in project (projectId, moduleId, name, statusid, owners?, description?)
  delete_global       - Delete a record globally (moduleId, recordId)
  delete_project      - Delete a record in project (projectId, moduleId, recordId)
  associate           - Move records to another project (projectId, moduleId, toprojectid, entityidarr)
  get_status          - Get statuses for a layout (moduleId, layoutId, index, range)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerCustomModuleTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_custom_modules",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.moduleId,
                ...P.pagination(),
                recordId: z.string().optional().describe("Record ID (get_details_*, delete_*)"),
                name: z.string().optional().describe("Record name (add_global, add_project)"),
                statusid: z.string().optional().describe("Status ID (add_global, add_project)"),
                projectid: z.string().optional().describe("Project ID for global record (add_global)"),
                owners: z.string().optional().describe("JSONArray of user IDs (add_global, add_project)"),
                description: z.string().optional().describe("Description (add_global, add_project)"),
                toprojectid: z.string().optional().describe("Target project ID (associate)"),
                entityidarr: z.string().optional().describe("JSONArray of record IDs (associate)"),
                layoutId: z.string().optional().describe("Layout ID (get_status)"),
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
