import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list_workspace: [],
    list_project: ["projectId"],
    list_sprint: ["projectId", "sprintId"],
    add_workspace: ["users"],
    add_project: ["projectId"],
    add_sprint: ["projectId", "sprintId", "users"],
    delete_workspace: ["userId"],
    delete_project: ["projectId", "userId"],
    delete_sprint: ["projectId", "sprintId", "userId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list_workspace",
    "list_project",
    "list_sprint",
    "add_workspace",
    "add_project",
    "add_sprint",
    "delete_workspace",
    "delete_project",
    "delete_sprint",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list_workspace: (client, teamId, p) => {
        const params: Record<string, string> = {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
        };
        if (p.type) params.type = p.type;
        return client.get(`/team/${teamId}/users/`, params);
    },

    list_project: (client, teamId, p) => {
        const params: Record<string, string> = {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
        };
        if (p.type) params.type = p.type;
        return client.get(`/team/${teamId}/projects/${p.projectId}/users/`, params);
    },

    list_sprint: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/users/`,
            { action: "alldata" },
        ),

    add_workspace: (client, teamId, p) => {
        const data: Record<string, string> = { users: p.users! };
        if (p.projids) data.projids = p.projids;
        return client.post(`/team/${teamId}/users/`, data);
    },

    add_project: (client, teamId, p) => {
        const data: Record<string, string> = {};
        if (p.newusers) data.newusers = p.newusers;
        if (p.oldusers) data.oldusers = p.oldusers;
        return client.post(`/team/${teamId}/projects/${p.projectId}/users/`, data);
    },

    add_sprint: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/users/`,
            { users: p.users! },
        ),

    delete_workspace: (client, teamId, p) =>
        client.delete(`/team/${teamId}/users/${p.userId}/`),

    delete_project: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/users/${p.userId}/`),

    delete_sprint: (client, teamId, p) =>
        client.delete(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/users/${p.userId}/`,
        ),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage users at workspace, project, and sprint levels.
Operations:
  list_workspace   - List workspace users (index, range, type?)
  list_project     - List project users (projectId, index, range, type?)
  list_sprint      - List sprint users (projectId, sprintId)
  add_workspace    - Add users to workspace (users, projids?)
  add_project      - Add/update project users (projectId, newusers?, oldusers?)
  add_sprint       - Add users to sprint (projectId, sprintId, users)
  delete_workspace - Remove user from workspace (userId)
  delete_project   - Remove user from project (projectId, userId)
  delete_sprint    - Remove user from sprint (projectId, sprintId, userId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerUserTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_users",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.sprintId,
                ...P.pagination(),
                userId: z.string().optional().describe("User ID (delete_workspace, delete_project, delete_sprint)"),
                users: z.string().optional().describe("JSONArray of user objects or IDs (add_workspace, add_sprint)"),
                type: z.string().optional().describe("User type filter (list_workspace, list_project)"),
                projids: z.string().optional().describe("JSONArray of project IDs (add_workspace)"),
                newusers: z.string().optional().describe("JSONArray of user IDs to add (add_project)"),
                oldusers: z.string().optional().describe("JSONArray of user IDs already in project (add_project)"),
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
