import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register MCP Prompts – pre-built workflow templates that guide
 * AI clients through common multi-step Zoho Sprints operations.
 */

export function registerPrompts (server: McpServer): void {

    // ─── My Overdue Work Items ────────────────────────────────────────────────

    server.registerPrompt(
        "my_overdue_workitems",
        {
            title: "My Overdue Work Items",
            description:
                "Fetch all overdue work items assigned to me across all active projects.",
        },
        async () => ({
            messages: [
                {
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: [
                            "Find all my overdue work items across all active projects. Follow these steps:",
                            "",
                            '1. Use manage_projects (operation: list, projectstatus: "1") to get all active projects.',
                            "2. Use manage_users (operation: list_workspace) to find my user (zsUserId).",
                            "3. For each active project, use manage_items (operation: get_item_count_by_sprint) with the filter parameter:",
                            '   filter: {"I-owner":["<my_zsUserId>"],"I-enddate":["overdue"],"queryType":1,"jsontmpl":"item_default"}',
                            '   The response contains "groupIdVScount" — a map of sprintId → item count. Only sprints with count > 0 have matching items.',
                            "4. For each sprint that has count > 0 in groupIdVScount, use manage_items (operation: list, range: \"200\") with the same filter parameter:",
                            '   filter: {"I-owner":["<my_zsUserId>"],"I-enddate":["overdue"],"queryType":1,"jsontmpl":"item_default"}',
                            '   If the user mentions a search keyword, also pass searchby: "both" and searchvalue: "<keyword>" to narrow results.',
                            "   Skip sprints that had 0 or were absent from groupIdVScount — they have no matching items.",
                            "",
                            "Present the results as a table with columns: Project | Sprint | Item Name | Priority | Due Date | Status.",
                            "If any sprint returned 200 items (the max per request), let me know that there may be more items and I can ask to fetch more.",
                            "If no overdue items are found, say so.",
                        ].join("\n"),
                    },
                },
            ],
        }),
    );

    // ─── My Work Items ───────────────────────────────────────────────────────

    server.registerPrompt(
        "my_workitems",
        {
            title: "My Work Items",
            description:
                "Fetch all work items assigned to me across all active projects.",
        },
        async () => ({
            messages: [
                {
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: [
                            "Find all work items assigned to me across all active projects. Follow these steps:",
                            "",
                            '1. Use manage_projects (operation: list, projectstatus: "1") to get all active projects.',
                            "2. Use manage_users (operation: list_workspace) to find my user (zsUserId).",
                            "3. For each active project, use manage_items (operation: get_item_count_by_sprint) with the filter parameter:",
                            '   filter: {"I-owner":["<my_zsUserId>"],"queryType":1,"jsontmpl":"item_default"}',
                            '   The response contains "groupIdVScount" — a map of sprintId → item count. Only sprints with count > 0 have matching items.',
                            "4. For each sprint that has count > 0 in groupIdVScount, use manage_items (operation: list, range: \"200\") with the same filter parameter:",
                            '   filter: {"I-owner":["<my_zsUserId>"],"queryType":1,"jsontmpl":"item_default"}',
                            '   If the user mentions a search keyword, also pass searchby: "both" and searchvalue: "<keyword>" to narrow results.',
                            "   Skip sprints that had 0 or were absent from groupIdVScount — they have no matching items.",
                            "",
                            "Present the results as a table with columns: Project | Sprint | Item Name | Priority | Due Date | Status.",
                            "If any sprint returned 200 items (the max per request), let me know that there may be more items and I can ask to fetch more.",
                            "If no items are found, say so.",
                        ].join("\n"),
                    },
                },
            ],
        }),
    );

    // ─── My Work Items Due Today ──────────────────────────────────────────────

    server.registerPrompt(
        "my_workitems_due_today",
        {
            title: "My Work Items Due Today",
            description:
                "Fetch all work items assigned to me that are due today across all active projects.",
        },
        async () => ({
            messages: [
                {
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: [
                            "Find all my work items due today across all active projects. Follow these steps:",
                            "",
                            '1. Use manage_projects (operation: list, projectstatus: "1") to get all active projects.',
                            "2. Use manage_users (operation: list_workspace) to find my user (zsUserId).",
                            "3. For each active project, use manage_items (operation: get_item_count_by_sprint) with the filter parameter:",
                            '   filter: {"I-owner":["<my_zsUserId>"],"I-enddate":["today"],"queryType":1,"jsontmpl":"item_default"}',
                            '   The response contains "groupIdVScount" — a map of sprintId → item count. Only sprints with count > 0 have matching items.',
                            "4. For each sprint that has count > 0 in groupIdVScount, use manage_items (operation: list, range: \"200\") with the same filter parameter:",
                            '   filter: {"I-owner":["<my_zsUserId>"],"I-enddate":["today"],"queryType":1,"jsontmpl":"item_default"}',
                            '   If the user mentions a search keyword, also pass searchby: "both" and searchvalue: "<keyword>" to narrow results.',
                            "   Skip sprints that had 0 or were absent from groupIdVScount — they have no matching items.",
                            "",
                            "Present the results as a table with columns: Project | Sprint | Item Name | Priority | Due Date | Status.",
                            "If any sprint returned 200 items (the max per request), let me know that there may be more items and I can ask to fetch more.",
                            "If no items are due today, say so.",
                        ].join("\n"),
                    },
                },
            ],
        }),
    );

    // ─── Due Today Items ──────────────────────────────────────────────────────

    server.registerPrompt(
        "due_today_items",
        {
            title: "Due Today Items",
            description:
                "Fetch all work items due today across all active projects (any assignee).",
        },
        async () => ({
            messages: [
                {
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: [
                            "Find all work items due today across all active projects. Follow these steps:",
                            "",
                            '1. Use manage_projects (operation: list, projectstatus: "1") to get all active projects.',
                            "2. For each active project, use manage_items (operation: get_item_count_by_sprint) with the filter parameter:",
                            '   filter: {"I-enddate":["today"],"queryType":1,"jsontmpl":"item_default"}',
                            '   The response contains "groupIdVScount" — a map of sprintId → item count. Only sprints with count > 0 have matching items.',
                            "3. For each sprint that has count > 0 in groupIdVScount, use manage_items (operation: list, range: \"200\") with the same filter parameter:",
                            '   filter: {"I-enddate":["today"],"queryType":1,"jsontmpl":"item_default"}',
                            '   If the user mentions a search keyword, also pass searchby: "both" and searchvalue: "<keyword>" to narrow results.',
                            "   Skip sprints that had 0 or were absent from groupIdVScount — they have no matching items.",
                            "",
                            "Present the results as a table with columns: Project | Sprint | Item Name | Owner | Priority | Due Date | Status.",
                            "If any sprint returned 200 items (the max per request), let me know that there may be more items and I can ask to fetch more.",
                            "If no items are due today, say so.",
                        ].join("\n"),
                    },
                },
            ],
        }),
    );
}

