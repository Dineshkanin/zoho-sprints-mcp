import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    get_categories: [],
    list: ["projectId"],
    get_details: ["projectId", "expenseId"],
    create: ["projectId", "name", "amount", "expensedate"],
    delete: ["projectId", "expenseidarr"],
    get_comments: ["projectId", "moduleId", "expenseId"],
    add_comment: ["projectId", "moduleId", "expenseId", "name"],
    delete_comment: ["projectId", "moduleId", "expenseId", "notesId"],
};


// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "get_categories",
    "list",
    "get_details",
    "create",
    "delete",
    "get_comments",
    "add_comment",
    "delete_comment",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    get_categories: (client, teamId, p) =>
        client.get(`/team/${teamId}/expensecategories/`, {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "25",
        }),

    list: (client, teamId, p) => {
        const expensetype = p.expensetype ?? "0";
        const params: Record<string, string> = {
            action: "data",
            expensetype,
            index: p.index ?? "1",
            range: p.range ?? "50",
        };
        if (p.filter) params.filter = p.filter;
        if (p.searchvalue) params.searchvalue = p.searchvalue;
        return client.get(`/team/${teamId}/projects/${p.projectId}/expenses/`, params);
    },

    get_details: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/expenses/${p.expenseId}/`,
            { action: "details" },
        ),

    create: (client, teamId, p) => {
        const data: Record<string, unknown> = {
            name: p.name!,
            amount: p.amount!,
            expensedate: p.expensedate!,
        };
        if (p.categoryidorname) data.categoryidorname = p.categoryidorname;
        if (p.description) data.description = p.description;
        if (p.ownerid) data.ownerid = p.ownerid;
        if (p.usergroupid) data.usergroupid = p.usergroupid;
        if (p.sprintid) data.sprintid = p.sprintid;
        if (p.releaseid) data.releaseid = p.releaseid;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/expenses/`,
            undefined,
            { data },
        );
    },

    delete: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/expenses/`,
            { action: "delete", expenseidarr: p.expenseidarr! },
        ),

    get_comments: (client, teamId, p) =>
        client.get(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/${p.expenseId}/notes/`,
            { action: "data", index: p.index ?? "1", range: p.range ?? "20" },
        ),

    add_comment: (client, teamId, p) =>
        client.post(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/${p.expenseId}/notes/`,
            { action: "addnotes", name: p.name! },
        ),

    delete_comment: (client, teamId, p) =>
        client.delete(
            `/team/${teamId}/projects/${p.projectId}/modules/${p.moduleId}/entity/${p.expenseId}/notes/${p.notesId}/`,
        ),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage expenses: CRUD, categories, and comments.
Operations:
  get_categories  - List expense categories (index, range)
  list            - List expenses in a project (projectId, expensetype?, index, range, filter?, searchvalue?)
  get_details     - Get expense details (projectId, expenseId)
  create          - Create an expense (projectId, name, amount, expensedate, categoryidorname?, description?, ownerid?, usergroupid?, sprintid?, releaseid?)
  delete          - Delete expenses (projectId, expenseidarr)
  get_comments    - List expense comments (projectId, moduleId, expenseId, index, range)
  add_comment     - Add a comment (projectId, moduleId, expenseId, name)
  delete_comment  - Delete a comment (projectId, moduleId, expenseId, notesId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerExpenseTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_expenses",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                ...P.projectId,
                ...P.moduleId,
                ...P.notesId,
                ...P.pagination(),
                expenseId: z.string().optional().describe("Expense ID (get_details, get_comments, add_comment, delete_comment)"),
                name: z.string().optional().describe("Expense name or comment text (create, add_comment)"),
                amount: z.string().optional().describe("Expense amount (create)"),
                expensedate: z.string().optional().describe("Expense date ISO (create)"),
                categoryidorname: z.string().optional().describe("Category ID or name (create)"),
                description: z.string().optional().describe("Expense description (create)"),
                ownerid: z.string().optional().describe("Owner user ID (create)"),
                usergroupid: z.string().optional().describe("User group ID (create)"),
                sprintid: z.string().optional().describe("Sprint ID (create)"),
                releaseid: z.string().optional().describe("Release ID (create)"),
                expensetype: z.string().optional().describe("0=One time, 1=Recurring (list)"),
                filter: z.string().optional().describe("JSONObject filter (list)"),
                searchvalue: z.string().optional().describe("Search by expense name (list)"),
                expenseidarr: z.string().optional().describe("JSONArray of expense IDs (delete)"),
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
