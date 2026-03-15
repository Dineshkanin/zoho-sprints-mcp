import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, pick, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list: ["projectId"],
    get_details: ["projectId", "sprintId"],
    create: ["projectId", "name"],
    update: ["projectId", "sprintId"],
    start: ["projectId", "sprintId"],
    complete: ["projectId", "sprintId"],
    cancel: ["projectId", "sprintId"],
    replan: ["projectId", "sprintId"],
    reopen: ["projectId", "sprintId"],
    delete: ["projectId", "sprintId"],
    get_comments: ["projectId", "moduleId", "sprintId"],
    add_comment: ["projectId", "moduleId", "sprintId", "name"],
    delete_comment: ["projectId", "moduleId", "sprintId", "notesId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list",
    "get_details",
    "create",
    "update",
    "start",
    "complete",
    "cancel",
    "replan",
    "reopen",
    "delete",
    "get_comments",
    "add_comment",
    "delete_comment",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    // ─── Read Operations ─────────────────────────────────────────────────────

    list: (client, teamId, p) => {
        const params: Record<string, string> = {
            action: "data",
            type: p.type ?? "[1,2]",
            index: p.index ?? "1",
            range: p.range ?? "50",
        };
        if (p.searchvalue) params.searchvalue = p.searchvalue;
        return client.get(`/team/${teamId}/projects/${p.projectId}/sprints/`, params);
    },

    get_details: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/`, { action: "details" }),

    // ─── Write Operations ────────────────────────────────────────────────────

    create: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/sprints/`, {
            name: p.name!,
            ...pick(p, ["description", "startdate", "enddate", "duration", "scrummaster", "users"]),
        }),

    update: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/`,
            pick(p, ["name", "description", "startdate", "enddate", "duration", "scrummaster"]),
        ),

    // ─── Lifecycle Operations ────────────────────────────────────────────────

    start: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/start/`),

    complete: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/complete/`, { action: "complete" }),

    cancel: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/cancel/`, { action: "cancel" }),

    replan: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/replan/`),

    reopen: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/reopen/`),

    // ─── Delete Operations ───────────────────────────────────────────────────

    delete: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/`),

    // ─── Comment Operations ──────────────────────────────────────────────────

    get_comments: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/${p.sprintId}/notes/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "20" },
        ),

    add_comment: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/${p.sprintId}/notes/`,
            { action: "addnotes", name: p.name! },
        ),

    delete_comment: (client, teamId, p) =>
        client.delete(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/${p.sprintId}/notes/${p.notesId}/`,
        ),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage sprints and sprint comments.
Operations:
  list           - List sprints in a project (projectId, index, range, type, searchvalue?)
  get_details    - Get details of a specific sprint (projectId, sprintId)
  create         - Create a new sprint (projectId, name, description?, startdate?, enddate?, duration?, scrummaster?, users?)
  update         - Update a sprint (projectId, sprintId, name?, description?, startdate?, enddate?, duration?, scrummaster?)
  start          - Start a sprint (projectId, sprintId)
  complete       - Complete a sprint; all items must be closed first (projectId, sprintId)
  cancel         - Cancel a sprint; all items must be closed first (projectId, sprintId)
  replan         - Replan a sprint (projectId, sprintId)
  reopen         - Reopen a completed/canceled sprint (projectId, sprintId)
  delete         - Delete a sprint (projectId, sprintId)
  get_comments   - List sprint comments; needs moduleId from get_modules (projectId, moduleId, sprintId, index, range)
  add_comment    - Add a comment to a sprint (projectId, moduleId, sprintId, name)
  delete_comment - Delete a sprint comment (projectId, moduleId, sprintId, notesId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerSprintTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_sprints",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                sprintId: z.string().optional().describe("Sprint or Backlog ID"),
                moduleId: z.string().optional().describe("Module ID for comments (get_comments, add_comment, delete_comment)"),
                ...P.pagination(),
                name: z.string().optional().describe("Sprint name (create, update) or comment text (add_comment)"),
                description: z.string().optional().describe("Sprint description (create, update)"),
                startdate: z.string().optional().describe("Start date ISO e.g. 2025-01-01T00:00:00+05:30 (create, update)"),
                enddate: z.string().optional().describe("End date ISO (create, update)"),
                duration: z.string().optional().describe("Sprint duration e.g. '2w' — max 8 weeks with strict scrum, 30 weeks without (create, update)"),
                scrummaster: z.string().optional().describe("Scrum master user ID (create, update)"),
                users: z.string().optional().describe("JSONArray of user IDs (create)"),
                type: z.string().optional().default("[1,2]").describe("JSONArray of sprint type IDs: 1=upcoming, 2=active, 3=completed, 4=canceled. Defaults to '[1,2]' (upcoming+active). e.g. '[2]' for active only, '[3]' for completed (list)"),
                searchvalue: z.string().optional().describe("Search by sprint name (list)"),
                notesId: z.string().optional().describe("Comment ID to delete (delete_comment)"),
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
