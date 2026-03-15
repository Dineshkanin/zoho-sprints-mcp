import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
import { ActionParams, ActionHandler, pick, validateRequired, toolResult, toolError } from "./tool-utils.js";

// ─── Required Params per Operation ────────────────────────────────────────────

const REQUIRED_PARAMS: Record<string, string[]> = {
    list: [],
    get_details: ["projectId"],
    get_backlog: ["projectId"],
    get_groups: [],
    get_priorities: ["projectId"],
    create_group: ["name"],
    create: ["name", "owner", "projgroup"],
    update: ["projectId"],
    delete: ["projectId"],
};

// ─── Action Registry ──────────────────────────────────────────────────────────

const ACTION_NAMES = [
    "list",
    "get_details",
    "get_backlog",
    "get_groups",
    "get_priorities",
    "create_group",
    "create",
    "update",
    "delete",
] as const;

const ACTION_HANDLERS: Record<string, ActionHandler> = {

    // ─── Read Operations ─────────────────────────────────────────────────────

    list: (client, teamId, p) => {
        const params: Record<string, string> = {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
            ...pick(p, ["projectstatus", "viewby", "searchvalue"]),
        };
        return client.get(`/team/${teamId}/projects/`, params);
    },

    get_details: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/`, { action: "details" }),

    get_backlog: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/`, { action: "getbacklog" }),

    get_groups: (client, teamId, p) =>
        client.get(`/team/${teamId}/projectgroups/`, {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "50",
        }),

    get_priorities: (client, teamId, p) =>
        client.get(`/team/${teamId}/projects/${p.projectId}/priority/`, {
            action: "data",
            index: p.index ?? "1",
            range: p.range ?? "25",
        }),

    // ─── Write Operations ────────────────────────────────────────────────────

    create_group: (client, teamId, p) =>
        client.post(`/team/${teamId}/projectgroups/`, { action: "create", name: p.name! }),

    create: (client, teamId, p) => {
        const data: Record<string, string> = {
            name: p.name!,
            owner: p.owner!,
            projgroup: p.projgroup!,
        };
        if (p.description) data.desc = p.description;
        return client.post(`/team/${teamId}/projects/`, {
            ...data,
            ...pick(p, ["prefix", "estimationtype", "startdate", "enddate", "clonefrom",
                "itemlayoutid", "epiclayoutid", "meetinglayoutid", "projectlayoutid"]),
        });
    },

    update: (client, teamId, p) => {
        const data: Record<string, string> = {};
        if (p.name) data.name = p.name;
        if (p.description) data.desc = p.description;
        return client.post(
            `/team/${teamId}/projects/${p.projectId}/`,
            { ...data, ...pick(p, ["owner", "projgroup", "status", "startdate", "enddate", "projectlayoutid"]) },
        );
    },

    // ─── Delete Operations ───────────────────────────────────────────────────

    delete: (client, teamId, p) =>
        client.delete(`/team/${teamId}/projects/${p.projectId}/`),
};

// ─── Tool Description ─────────────────────────────────────────────────────────

const TOOL_DESCRIPTION = `Manage projects and project groups.
Operations:
  list           - List all projects in workspace (index, range, projectstatus?, viewby?, searchvalue?)
  get_details    - Get details of a specific project (projectId)
  get_backlog    - Get the backlog ID of a project (projectId)
  get_groups     - List all project groups in workspace (index, range)
  get_priorities - Get priority types of a project (projectId, index, range)
  create_group   - Create a new project group (name)
  create         - Create a new project (name, owner, projgroup, description?, prefix?, estimationtype?, startdate?, enddate?, clonefrom?, layout IDs?)
  update         - Update an existing project (projectId, name?, description?, owner?, projgroup?, status?, startdate?, enddate?, projectlayoutid?)
  delete         - Delete a project (projectId)`;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerProjectTools (
    server: McpServer,
    getClient: () => ZohoSprintsClient
) {
    server.registerTool(
        "manage_projects",
        {
            description: TOOL_DESCRIPTION,
            inputSchema: {
                operation: z.enum(ACTION_NAMES).describe("Operation to perform"),
                projectId: z.string().optional().describe("Project ID"),
                ...P.pagination(),
                name: z.string().optional().describe("Project or group name (create, update, create_group)"),
                description: z.string().optional().describe("Project description (create, update)"),
                owner: z.string().optional().describe("Owner user ID (mandatory for create, optional for update)"),
                projgroup: z.string().optional().describe("Project group ID (mandatory for create, optional for update)"),
                prefix: z.string().optional().describe("Project prefix, up to 3 chars (create)"),
                estimationtype: z.string().optional().describe("Estimation type: 0=Fibonacci, 2=Custom (create)"),
                startdate: z.string().optional().describe("Start date ISO e.g. 2025-01-01T00:00:00+05:30 (create, update)"),
                enddate: z.string().optional().describe("End date ISO (create, update)"),
                clonefrom: z.string().optional().describe("Template project ID to clone from (create)"),
                projectlayoutid: z.string().optional().describe("Project layout ID (create, update)"),
                itemlayoutid: z.string().optional().describe("Item layout ID (create)"),
                epiclayoutid: z.string().optional().describe("Epic layout ID (create)"),
                meetinglayoutid: z.string().optional().describe("Meeting layout ID (create)"),
                status: z.string().optional().describe("Project status to move to (update)"),
                projectstatus: z.string().optional().describe("1=Active, 2=Archive, 6=Template (list)"),
                viewby: z.string().optional().describe("Group projects: 0=All, 1=Favorites, 2=Group, 3=Owner (list)"),
                searchvalue: z.string().optional().describe("Search by name (list)"),
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
