import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list: ["projectId"],
    get_details: ["projectId", "releaseId"],
    get_stages: ["projectId"],
    create: ["projectId", "name", "startdate", "enddate"],
    create_stage: ["projectId", "name", "type"],
    associate_items: ["projectId", "releaseId", "sprintid", "rootitemidarr"],
    delete: ["projectId", "releaseId"],
    delete_stage: ["projectId", "releasestatusId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list",
    "get_details",
    "get_stages",
    "create",
    "create_stage",
    "associate_items",
    "delete",
    "delete_stage",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list: (client, teamId, p) => {
        const params: Record<string, string> = {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
        };
        if (p.stagetype) params.stagetype = p.stagetype;
        if (p.searchvalue) params.searchvalue = p.searchvalue;
        return client.get(`/team/${teamId}/projects/${p.projectId}/release/`, params);
    },

    get_details: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/release/${p.releaseId}/`,
            { action: "data" },
        ),

    get_stages: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/releasestatus/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "25" },
        ),

    create: (client, teamId, p) => {
        const body: Record<string, unknown> = {
            name: p.name!,
            startdate: p.startdate!,
            enddate: p.enddate!,
        };
        if (p.statusId) body.statusId = p.statusId;
        if (p.color) body.color = p.color;
        if (p.goal) body.goal = p.goal;
        if (p.ownerIds) body.ownerIds = JSON.parse(p.ownerIds);
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/release/`,
            undefined,
            body,
        );
    },

    create_stage: (client, teamId, p) => {
        const body: Record<string, unknown> = { name: p.name!, type: p.type! };
        if (p.color) body.color = p.color;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/releasestatus/`,
            undefined,
            body,
        );
    },

    associate_items: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/release/${p.releaseId}/item/associate/`,
            { sprintid: p.sprintid!, rootitemidarr: p.rootitemidarr! },
        ),

    delete: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/release/${p.releaseId}/`),

    delete_stage: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/releasestatus/${p.releasestatusId}/`),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage releases: CRUD, stages, and item association.
Operations:
  list             - List releases in a project (projectId, index, range, stagetype?, searchvalue?)
  get_details      - Get release details (projectId, releaseId)
  get_stages       - Get release stages/statuses (projectId, index, range)
  create           - Create a release (projectId, name, startdate, enddate, statusId?, color?, goal?, ownerIds?)
  create_stage     - Create a release stage (projectId, name, type, color?)
  associate_items  - Associate items with a release (projectId, releaseId, sprintid, rootitemidarr)
  delete           - Delete a release (projectId, releaseId)
  delete_stage     - Delete a release stage (projectId, releasestatusId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerReleaseTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_releases",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.releaseId,
                ...P.pagination(),
                name: z.string().optional().describe("Release or stage name (create, create_stage)"),
                startdate: z.string().optional().describe("Start date ISO (create)"),
                enddate: z.string().optional().describe("End date ISO (create)"),
                statusId: z.string().optional().describe("Release stage/status ID (create)"),
                color: z.string().optional().describe("Color hex code (create, create_stage)"),
                goal: z.string().optional().describe("Release goal (create)"),
                ownerIds: z.string().optional().describe("JSONArray of owner user IDs (create)"),
                type: z.string().optional().describe("Stage type e.g. 'open', 'closed' (create_stage)"),
                stagetype: z.string().optional().describe("Stage type filter (list)"),
                searchvalue: z.string().optional().describe("Search by release name (list)"),
                sprintid: z.string().optional().describe("Sprint ID containing the items (associate_items)"),
                rootitemidarr: z.string().optional().describe("JSONArray of item IDs (associate_items)"),
                releasestatusId: z.string().optional().describe("Release stage/status ID to delete (delete_stage)"),
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
