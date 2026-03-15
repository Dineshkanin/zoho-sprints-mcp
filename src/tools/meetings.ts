import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, pick, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list: ["projectId"],
    list_sprint: ["projectId", "sprintId"],
    get_details: ["projectId", "meetingId"],
    add: ["projectId", "sprintId", "title", "type", "scheduledon", "duration", "participants", "remindbefore"],
    delete: ["projectId", "meetingId"],
    get_comments: ["projectId", "meetingId"],
    add_comment: ["projectId", "meetingId", "note"],
    delete_comment: ["projectId", "meetingId", "notesId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list",
    "list_sprint",
    "get_details",
    "add",
    "delete",
    "get_comments",
    "add_comment",
    "delete_comment",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/meetings/`, {
            action: "data", index: p.index ?? "1", range: p.range ?? "20",
        }),

    list_sprint: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/meeting/`, {
            action: "data", index: p.index ?? "1", range: p.range ?? "20",
        }),

    get_details: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/meetings/${p.meetingId}/`, { action: "data" }),

    add: (client, teamId, p) => {
        const data: Record<string, string> = pick(p, [
            "title", "type", "scheduledon", "duration", "participants",
            "remindbefore", "location", "description",
        ]);
        return client.post(`/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/meeting/`, data);
    },

    delete: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/meetings/${p.meetingId}/`),

    get_comments: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/meetings/${p.meetingId}/notes/`, {
            action: "data", index: p.index ?? "1", range: p.range ?? "20",
        }),

    add_comment: (client, teamId, p) =>
        client.post(`/team/${teamId}/projects/${p.projectId}/meetings/${p.meetingId}/notes/`, { note: p.note! }),

    delete_comment: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/meetings/${p.meetingId}/notes/${p.notesId}/`),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage meetings: schedule, list, comment, and delete.
Operations:
  list           - List meetings in a project (projectId, index, range)
  list_sprint    - List meetings in a sprint (projectId, sprintId, index, range)
  get_details    - Get meeting details (projectId, meetingId)
  add            - Schedule a meeting (projectId, sprintId, title, type, scheduledon, duration, participants, remindbefore, location?, description?)
  delete         - Delete a meeting (projectId, meetingId)
  get_comments   - List meeting comments (projectId, meetingId, index, range)
  add_comment    - Add a comment to a meeting (projectId, meetingId, note)
  delete_comment - Delete a meeting comment (projectId, meetingId, notesId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerMeetingTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_meetings",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.sprintId,
                ...P.meetingId,
                ...P.notesId,
                ...P.pagination("1", "20"),
                title: z.string().optional().describe("Meeting title (add)"),
                type: z.string().optional().describe("1=Scrum, 2=Sprint Planning, 3=Sprint Retrospective, 4=Sprint Review, 5=Other (add)"),
                scheduledon: z.string().optional().describe("Scheduled date-time MM-dd-yyyy hh:mm a (add)"),
                duration: z.string().optional().describe("Duration in minutes (add)"),
                participants: z.string().optional().describe("Comma-separated user IDs (add)"),
                remindbefore: z.string().optional().describe("Remind before in minutes (add)"),
                location: z.string().optional().describe("Meeting location (add)"),
                description: z.string().optional().describe("Meeting description (add)"),
                note: z.string().optional().describe("Comment text (add_comment)"),
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
