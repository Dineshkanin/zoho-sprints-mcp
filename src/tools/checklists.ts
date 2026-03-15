import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, pick, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list_groups: ["projectId", "sprintId", "itemId"],
    list: ["projectId", "sprintId", "itemId", "checklistGroupId"],
    add_group: ["projectId", "sprintId", "itemId", "clgroupname"],
    add: ["projectId", "sprintId", "itemId", "checklistGroupId", "clitemname", "visibility", "ownerid", "priority"],
    change_status: ["projectId", "sprintId", "itemId", "checklistGroupId", "checklistId", "status"],
    edit: ["projectId", "sprintId", "itemId", "checklistGroupId", "checklistId"],
    edit_group: ["projectId", "sprintId", "itemId", "checklistGroupId", "clgroupname"],
    delete: ["projectId", "sprintId", "itemId", "checklistGroupId", "checklistId"],
    delete_group: ["projectId", "sprintId", "itemId", "checklistGroupId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list_groups",
    "list",
    "add_group",
    "add",
    "change_status",
    "edit",
    "edit_group",
    "delete",
    "delete_group",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    list_groups: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "20" },
        ),

    list: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/${p.checklistGroupId}/clitem/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "20" },
        ),

    add_group: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/`,
            { action: "addclgroup", clgroupname: p.clgroupname! },
        ),

    add: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/${p.checklistGroupId}/clitem/`,
            pick(p, ["clitemname", "visibility", "ownerid", "priority"]),
        ),

    change_status: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/${p.checklistGroupId}/clitem/${p.checklistId}/`,
            { action: "changestatus", status: p.status! },
        ),

    edit: (client, teamId, p) => {
        const data: Record<string, string> = { action: "editclitem" };
        if (p.clitemname) data.clitemname = p.clitemname;
        if (p.togroupid) data.togroupid = p.togroupid;
        if (p.visibility) data.visibility = p.visibility;
        if (p.ownerid) data.ownerid = p.ownerid;
        if (p.priority) data.priority = p.priority;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/${p.checklistGroupId}/clitem/${p.checklistId}/`,
            data,
        );
    },

    edit_group: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/${p.checklistGroupId}/`,
            { action: "editclgroup", clgroupname: p.clgroupname! },
        ),

    delete: (client, teamId, p) =>
        client.delete(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/${p.checklistGroupId}/clitem/${p.checklistId}/`,
        ),

    delete_group: (client, teamId, p) =>
        client.delete(
            `/team/${teamId}/projects/${p.projectId}/sprints/${p.sprintId}/item/${p.itemId}/clgroup/${p.checklistGroupId}/`,
        ),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage checklists: groups and items within work items.
Operations:
  list_groups    - List checklist groups (projectId, sprintId, itemId, index, range)
  list           - List checklists in a group (projectId, sprintId, itemId, checklistGroupId, index, range)
  add_group      - Create a checklist group (projectId, sprintId, itemId, clgroupname)
  add            - Add a checklist item (projectId, sprintId, itemId, checklistGroupId, clitemname, visibility, ownerid, priority)
  change_status  - Complete/reopen a checklist (projectId, sprintId, itemId, checklistGroupId, checklistId, status)
  edit           - Edit a checklist item (projectId, sprintId, itemId, checklistGroupId, checklistId, clitemname?, togroupid?, visibility?, ownerid?, priority?)
  edit_group     - Rename a checklist group (projectId, sprintId, itemId, checklistGroupId, clgroupname)
  delete         - Delete a checklist item (projectId, sprintId, itemId, checklistGroupId, checklistId)
  delete_group   - Delete a checklist group (projectId, sprintId, itemId, checklistGroupId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerChecklistTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_checklists",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.sprintId,
                ...P.itemId,
                ...P.pagination("1", "20"),
                checklistGroupId: z.string().optional().describe("Checklist group ID (list, add, change_status, edit, edit_group, delete, delete_group)"),
                checklistId: z.string().optional().describe("Checklist item ID (change_status, edit, delete)"),
                clgroupname: z.string().optional().describe("Checklist group name (add_group, edit_group)"),
                clitemname: z.string().optional().describe("Checklist item name (add, edit)"),
                visibility: z.string().optional().describe("0=public, 1=private (add, edit)"),
                ownerid: z.string().optional().describe("Assigned user ID (add, edit)"),
                priority: z.string().optional().describe("0=none, 1=low, 2=medium, 3=high (add, edit)"),
                status: z.string().optional().describe("0=reopen, 1=complete (change_status)"),
                togroupid: z.string().optional().describe("Target checklist group ID to move to (edit)"),
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
