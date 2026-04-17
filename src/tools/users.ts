import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list_workspace_user: [],
    list_project_user: ["projectId"],
    list_sprint_user: ["projectId", "sprintId"],
    add_workspace_user: ["users"],
    add_project_user: ["projectId"],
    add_sprint_user: ["projectId", "sprintId", "users"],
    delete_workspace_user: ["userId"],
    delete_project_user: ["projectId", "userId"],
    delete_sprint_user: ["projectId", "sprintId", "userId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list_workspace_user",
    "list_project_user",
    "list_sprint_user",
    "add_workspace_user",
    "add_project_user",
    "add_sprint_user",
    "delete_workspace_user",
    "delete_project_user",
    "delete_sprint_user",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list_workspace_user: (client, teamId, p) => {
        const params: Record<string, string> = {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
        };
        if (p.type) params.type = p.type;
        return client.get(`/team/${teamId}/users/`, params);
    },

    list_project_user: (client, teamId, p) => {
        const params: Record<string, string> = {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
        };
        if (p.type) params.type = p.type;
        return client.get(`/team/${teamId}/projects/${p.projectId}/users/`, params);
    },

    list_sprint_user: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/users/`,
            { action: "alldata" },
        ),

    add_workspace_user: (client, teamId, p) => {
        const data: Record<string, string> = { users: p.users! };
        if (p.projids) data.projids = p.projids;
        return client.post(`/team/${teamId}/users/`, data);
    },

    add_project_user: (client, teamId, p) => {
        const data: Record<string, string> = {};
        if (p.newusers) data.newusers = p.newusers;
        if (p.oldusers) data.oldusers = p.oldusers;
        return client.post(`/team/${teamId}/projects/${p.projectId}/users/`, data);
    },

    add_sprint_user: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/users/`,
            { users: p.users! },
        ),

    delete_workspace_user: (client, teamId, p) =>
        client.delete(`/team/${teamId}/users/${p.userId}/`),

    delete_project_user: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/users/${p.userId}/`),

    delete_sprint_user: (client, teamId, p) =>
        client.delete(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/users/${p.userId}/`,
        ),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage users at workspace, project, and sprint levels.
Operations:
  list_workspace_user   - List workspace users (index, range, type?)
  list_project_user     - List project users (projectId, index, range, type?)
  list_sprint_user      - List sprint users (projectId, sprintId)
  add_workspace_user    - Add users to workspace (users, projids?)
  add_project_user      - Add/update project users (projectId, newusers?, oldusers?)
  add_sprint_user       - Add users to sprint (projectId, sprintId, users)
  delete_workspace_user - Remove user from workspace (userId)
  delete_project_user   - Remove user from project (projectId, userId)
  delete_sprint_user    - Remove user from sprint (projectId, sprintId, userId)`;

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
                userId: z.string().optional().describe("User ID (delete_workspace_user, delete_project_user, delete_sprint_user)"),
                users: z.string().optional().describe("JSONArray of user objects or IDs (add_workspace_user, add_sprint_user)"),
                type: z.string().optional().describe("User type filter (list_workspace_user, list_project_user)"),
                projids: z.string().optional().describe("JSONArray of project IDs (add_workspace_user)"),
                newusers: z.string().optional().describe("JSONArray of user IDs to add (add_project_user)"),
                oldusers: z.string().optional().describe("JSONArray of user IDs already in project (add_project_user)"),
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
