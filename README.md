# Zoho Sprints MCP Server

[![GitHub stars](https://img.shields.io/github/stars/dineshkanin/zoho-sprints-mcp?style=social)](https://github.com/dineshkanin/zoho-sprints-mcp/stargazers)
[![npm version](https://img.shields.io/npm/v/zoho-sprints-mcp)](https://www.npmjs.com/package/zoho-sprints-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that lets AI assistants like Claude, ChatGPT, GitHub Copilot, and Cursor manage your [Zoho Sprints](https://www.zoho.com/sprints/) projects through natural language. Instead of clicking through the UI, just tell your AI what you need — create items, plan sprints, log time, and more.

> If you find this useful, please ⭐ star this repo — it helps others discover it!

## Features

- **15 Tools** with **127 operations** covering the entire Zoho Sprints API
- **3 MCP Prompts**: Guided workflows for sprint planning, project summaries, and daily standups
- **4 MCP Resources**: Health Check, Config, Projects List, Team Members
- **Error handling**: Structured error responses with `isError` flag for AI self-correction
- **Response formatting**: LLM-friendly output with pagination info and error highlighting
- **Multi-domain support**: Works with all 7 Zoho data centers (`.com`, `.eu`, `.in`, `.com.au`, `.com.cn`, `.jp`, `.sa`)
- **Auto token refresh**: Proactive refresh every 57 minutes + reactive refresh on 401 responses
- **Input validation**: Reusable validators for dates, IDs, enums, JSON arrays with clear error messages
- **Response caching**: In-memory TTL cache (60 s) for GET requests – automatic invalidation on writes
- **Debug mode**: Enable `ZOHO_SPRINTS_DEBUG=true` to log all HTTP requests/responses to stderr
- **Custom Zoho headers**: `X-ZA-CONVERT-RESPONSE`, `X-ZA-UI-VERSION`, `X-ZA-REQSIZE` sent on every request

## Prerequisites

- **Node.js 20+** and **npm 10+** — [Download here](https://nodejs.org/)
- **Zoho Sprints account** — [Sign up](https://www.zoho.com/sprints/)
- **Zoho OAuth credentials** (Client ID, Client Secret, Refresh Token) — [How to get them](#how-to-get-client-id-client-secret--refresh-token)

## Installation

```bash
npm install -g zoho-sprints-mcp
```

Or use directly with npx:

```bash
npx zoho-sprints-mcp
```

## Quick Start

1. **Get your Zoho OAuth credentials** — Follow the [guide below](#how-to-get-client-id-client-secret--refresh-token) to get your Client ID, Client Secret, and Refresh Token
2. **Add the MCP server to your AI client** — Copy the config for your client ([Claude](#claude-desktop) / [VS Code](#vs-code) / [Cursor](#cursor) / [ChatGPT](#chatgpt-remote--http-mode)) and replace the placeholder values with your credentials
3. **Start talking to your AI** — Ask things like:
   - *"Show all my active sprints"*
   - *"Create a new bug item in Project X"*
   - *"What items are overdue?"*
   - *"Log 2 hours on item #1234"*

That's it — no server setup, no coding required. The MCP server runs automatically when your AI client starts.

## Configuration

### Environment Variables

| Variable                     | Required | Description                                                                              |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `ZOHO_SPRINTS_REFRESH_TOKEN` | **Yes**  | OAuth2 refresh token – [how to generate](docs/configuration.md)                          |
| `ZOHO_SPRINTS_CLIENT_ID`     | **Yes**  | OAuth2 Client ID                                                                         |
| `ZOHO_SPRINTS_CLIENT_SECRET` | **Yes**  | OAuth2 Client Secret                                                                     |
| `ZOHO_SPRINTS_DOMAIN`        | No       | Zoho domain (default: `com`). Options: `com`, `eu`, `in`, `com.au`, `com.cn`, `jp`, `sa` |
| `ZOHO_SPRINTS_ACCESS_TOKEN`  | No       | Initial access token (if omitted, fetched automatically via refresh token on startup)    |
| `ZOHO_SPRINTS_TEAM_ID`       | No       | Workspace (team) ID – auto-detected if only one workspace exists                         |
| `ZOHO_SPRINTS_DEBUG`         | No       | Set to `true` to enable verbose debug logging to stderr                                  |
| `MCP_TRANSPORT`              | No       | Transport mode: `stdio` (default) or `http` for remote clients like ChatGPT              |
| `MCP_HTTP_PORT`              | No       | Port for HTTP transport (default: `3000`)                                                |
| `MCP_HTTP_HOST`              | No       | Bind address for HTTP transport (default: `0.0.0.0`)                                     |
| `MCP_HTTP_PATH`              | No       | Endpoint path for HTTP transport (default: `/mcp`)                                       |

### Generating OAuth2 Credentials

#### How to get Client ID, Client Secret & Refresh Token

Follow our **[step-by-step OAuth setup guide](docs/configuration.md)** to create a Zoho developer application and generate your Client ID, Client Secret, and Refresh Token.

You can also refer to the official [Zoho OAuth Self Client Overview](https://www.zoho.com/accounts/protocol/oauth/self-client/overview.html).

#### Required OAuth Scopes

```
ZohoSprints.projects.ALL,ZohoSprints.sprints.ALL,ZohoSprints.items.ALL,ZohoSprints.teams.READ,ZohoSprints.timesheets.ALL,ZohoSprints.meetings.ALL,ZohoSprints.release.ALL,ZohoSprints.epic.ALL,ZohoSprints.settings.READ,ZohoSprints.teamusers.ALL
```

### MCP Client Configuration

#### Claude Desktop

Add to your `claude_desktop_config.json`:

**To use Local development** (run from your local build):

```json
{
  "mcpServers": {
    "zoho-sprints": {
      "command": "node",
      "args": ["${absolute-path}/SprintsMCP/dist/index.js"],
      "env": {
        "ZOHO_SPRINTS_DOMAIN": "com",
        "ZOHO_SPRINTS_REFRESH_TOKEN": "your-refresh-token",
        "ZOHO_SPRINTS_CLIENT_ID": "your-client-id",
        "ZOHO_SPRINTS_CLIENT_SECRET": "your-client-secret",
        "ZOHO_SPRINTS_TEAM_ID": "your-team-id"
      }
    }
  }
}
```

> Replace `/absolute/path/to/SprintsMCP/dist/index.js` with the actual path to your built `dist/index.js`. Make sure you run `npm run build` first.

**To use published npm package**:

```json
{
  "mcpServers": {
    "zoho-sprints": {
      "command": "npx",
      "args": ["-y", "zoho-sprints-mcp"],
      "env": {
        "ZOHO_SPRINTS_DOMAIN": "com",
        "ZOHO_SPRINTS_REFRESH_TOKEN": "your-refresh-token",
        "ZOHO_SPRINTS_CLIENT_ID": "your-client-id",
        "ZOHO_SPRINTS_CLIENT_SECRET": "your-client-secret",
        "ZOHO_SPRINTS_TEAM_ID": "your-team-id"
      }
    }
  }
}
```

#### Cursor

Add to your Cursor MCP settings:

**To use Local development** (run from your local build):

```json
{
  "mcpServers": {
    "zoho-sprints": {
      "command": "node",
      "args": ["${absolute-path}/SprintsMCP/dist/index.js"],
      "env": {
        "ZOHO_SPRINTS_DOMAIN": "com",
        "ZOHO_SPRINTS_REFRESH_TOKEN": "your-refresh-token",
        "ZOHO_SPRINTS_CLIENT_ID": "your-client-id",
        "ZOHO_SPRINTS_CLIENT_SECRET": "your-client-secret",
        "ZOHO_SPRINTS_TEAM_ID": "your-team-id"
      }
    }
  }
}
```

> Replace `${absolute-path}/SprintsMCP/dist/index.js` with the actual path to your built `dist/index.js`. Make sure you run `npm run build` first.

**To use published npm package**:

```json
{
  "mcpServers": {
    "zoho-sprints": {
      "command": "npx",
      "args": ["-y", "zoho-sprints-mcp"],
      "env": {
        "ZOHO_SPRINTS_DOMAIN": "com",
        "ZOHO_SPRINTS_REFRESH_TOKEN": "your-refresh-token",
        "ZOHO_SPRINTS_CLIENT_ID": "your-client-id",
        "ZOHO_SPRINTS_CLIENT_SECRET": "your-client-secret",
        "ZOHO_SPRINTS_TEAM_ID": "your-team-id"
      }
    }
  }
}
```

#### VS Code

Add to your VS Code MCP settings (`.vscode/mcp.json`):

**To use Local development** (run from your local build):

```json
{
  "servers": {
    "zoho-sprints": {
      "command": "node",
      "args": ["${absolute-path}/SprintsMCP/dist/index.js"],
      "env": {
        "ZOHO_SPRINTS_DOMAIN": "com",
        "ZOHO_SPRINTS_REFRESH_TOKEN": "your-refresh-token",
        "ZOHO_SPRINTS_CLIENT_ID": "your-client-id",
        "ZOHO_SPRINTS_CLIENT_SECRET": "your-client-secret",
        "ZOHO_SPRINTS_TEAM_ID": "your-team-id"
      }
    }
  }
}
```

> Replace `${absolute-path}/SprintsMCP/dist/index.js` with the actual path to your built `dist/index.js`. Make sure you run `npm run build` first.

**To use published npm package**:

```json
{
  "servers": {
    "zoho-sprints": {
      "command": "npx",
      "args": ["-y", "zoho-sprints-mcp"],
      "env": {
        "ZOHO_SPRINTS_DOMAIN": "com",
        "ZOHO_SPRINTS_REFRESH_TOKEN": "your-refresh-token",
        "ZOHO_SPRINTS_CLIENT_ID": "your-client-id",
        "ZOHO_SPRINTS_CLIENT_SECRET": "your-client-secret",
        "ZOHO_SPRINTS_TEAM_ID": "your-team-id"
      }
    }
  }
}
```

#### ChatGPT (Remote / HTTP mode)

ChatGPT requires a publicly accessible URL. Deploy the server and start in HTTP mode:

```bash
# Start in HTTP mode
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 npm start

# Or use the convenience script
npm run start:http
```

Then in ChatGPT → Settings → Developer → Apps → Add MCP Server:

```
Server URL: https://your-domain.com/mcp
```

> **Note**: You must deploy behind HTTPS (e.g. nginx, Caddy, or a cloud platform like Railway/Render/Fly.io). The server includes CORS headers and a `/health` endpoint for load balancer checks.

## Available Tools

Each tool is a single MCP tool with an `operation` parameter that selects the action. Pass additional parameters as needed for each operation.

### `manage_workspaces` (8 operations)

| Operation          | Description                   |
| ------------------ | ----------------------------- |
| `list`             | List all workspaces           |
| `get_settings`     | Get workspace settings        |
| `get_link_types`   | Get link types                |
| `get_tags`         | Get custom tags               |
| `add_tag`          | Create a custom tag           |
| `delete_tag`       | Delete a custom tag           |
| `delete_link_type` | Delete a link type            |
| `get_global_logs`  | Get log hours across projects |

### `manage_projects` (9 operations)

| Operation        | Description                  |
| ---------------- | ---------------------------- |
| `list`           | List projects (with filters) |
| `get_details`    | Get project details          |
| `get_backlog`    | Get backlog ID               |
| `get_groups`     | List project groups          |
| `get_priorities` | Get project priorities       |
| `create_group`   | Create a project group       |
| `create`         | Create a project             |
| `update`         | Update a project             |
| `delete`         | Delete a project             |

### `manage_sprints` (13 operations)

| Operation        | Description                                       |
| ---------------- | ------------------------------------------------- |
| `list`           | List sprints (Active/Upcoming/Completed/Canceled) |
| `get_details`    | Get sprint details                                |
| `create`         | Create a sprint                                   |
| `update`         | Update a sprint                                   |
| `start`          | Start a sprint                                    |
| `complete`       | Complete a sprint                                 |
| `cancel`         | Cancel a sprint                                   |
| `replan`         | Replan a sprint                                   |
| `reopen`         | Reopen a sprint                                   |
| `delete`         | Delete a sprint                                   |
| `get_comments`   | Get sprint comments                               |
| `add_comment`    | Add a sprint comment                              |
| `delete_comment` | Delete a sprint comment                           |

### `manage_items` (20 operations)

| Operation          | Description                  |
| ------------------ | ---------------------------- |
| `list`             | List items in sprint/backlog |
| `get_details`      | Get item details             |
| `get_activity`     | Get item activity log        |
| `get_multiple`     | Get multiple items by IDs    |
| `create`           | Create an item               |
| `create_subitem`   | Create a subitem             |
| `update`           | Update an item               |
| `move`             | Move items between sprints   |
| `delete`           | Delete an item               |
| `get_comments`     | Get comments                 |
| `add_comment`      | Add a comment                |
| `delete_comment`   | Delete a comment             |
| `get_linked`       | Get linked items             |
| `link`             | Link work items              |
| `delink`           | Remove item links            |
| `get_tags`         | Get item tags                |
| `update_tags`      | Update item tags             |
| `get_followers`    | Get item followers           |
| `update_followers` | Add/remove followers         |
| `get_timer`        | Get timer details            |

### `manage_epics` (7 operations)

| Operation         | Description            |
| ----------------- | ---------------------- |
| `list`            | List epics             |
| `get_details`     | Get epic details       |
| `get_sprints`     | Get associated sprints |
| `create`          | Create an epic         |
| `associate_items` | Link items to epic     |
| `update`          | Update an epic         |
| `delete`          | Delete an epic         |

### `manage_releases` (8 operations)

| Operation         | Description            |
| ----------------- | ---------------------- |
| `list`            | List releases          |
| `get_details`     | Get release details    |
| `get_stages`      | Get release stages     |
| `create`          | Create a release       |
| `create_stage`    | Create a release stage |
| `associate_items` | Link items to release  |
| `delete`          | Delete a release       |
| `delete_stage`    | Delete a release stage |

### `manage_timesheets` (4 operations)

| Operation      | Description           |
| -------------- | --------------------- |
| `list`         | Fetch time logs       |
| `add_item_log` | Log hours for an item |
| `add_general`  | Log general hours     |
| `delete`       | Delete time logs      |

### `manage_meetings` (8 operations)

| Operation        | Description           |
| ---------------- | --------------------- |
| `list`           | List project meetings |
| `list_sprint`    | List sprint meetings  |
| `get_details`    | Get meeting details   |
| `add`            | Schedule a meeting    |
| `delete`         | Delete a meeting      |
| `get_comments`   | Get comments          |
| `add_comment`    | Add a comment         |
| `delete_comment` | Delete a comment      |

### `manage_users` (9 operations)

| Operation               | Description           |
| ----------------------- | --------------------- |
| `list_workspace_user`   | List workspace users  |
| `list_project_user`     | List project users    |
| `list_sprint_user`      | List sprint users     |
| `add_workspace_user`    | Add workspace users   |
| `add_project_user`      | Add project users     |
| `add_sprint_user`       | Add sprint users      |
| `delete_workspace_user` | Remove workspace user |
| `delete_project_user`   | Remove project user   |
| `delete_sprint_user`    | Remove sprint user    |

### `manage_project_settings` (11 operations)

| Operation                   | Description               |
| --------------------------- | ------------------------- |
| `get_item_types`            | Get item types            |
| `get_priority_types`        | Get priority types        |
| `get_project_status`        | Get project statuses      |
| `create_project_status`     | Create a status           |
| `update_project_status`     | Update a status           |
| `delete_project_status`     | Delete a status           |
| `get_modules`               | Get modules list          |
| `get_custom_layouts`        | Get layouts               |
| `get_custom_fields`         | Get custom fields         |
| `get_layout_fields`         | Get layout fields         |
| `get_project_custom_fields` | Get project custom fields |

### `manage_checklists` (9 operations)

| Operation       | Description           |
| --------------- | --------------------- |
| `list_groups`   | Get checklist groups  |
| `list`          | Get checklists        |
| `add_group`     | Create a group        |
| `add`           | Add a checklist item  |
| `change_status` | Check/uncheck         |
| `edit`          | Edit checklist item   |
| `edit_group`    | Edit group            |
| `delete`        | Delete checklist item |
| `delete_group`  | Delete group          |

### `manage_webhooks` (8 operations)

| Operation          | Description             |
| ------------------ | ----------------------- |
| `get_placeholders` | Get placeholders        |
| `get_triggers`     | Get triggers            |
| `list`             | List webhooks           |
| `get_details`      | Get webhook details     |
| `create`           | Create a webhook        |
| `update`           | Update a webhook        |
| `delete`           | Delete a webhook        |
| `execute_function` | Execute custom function |

### `manage_okr` (4 operations)

| Operation      | Description         |
| -------------- | ------------------- |
| `get_statuses` | Get OKR statuses    |
| `list`         | Get objectives      |
| `create`       | Create an objective |
| `delete`       | Delete an objective |

### `manage_expenses` (8 operations)

| Operation        | Description            |
| ---------------- | ---------------------- |
| `get_categories` | Get expense categories |
| `list`           | List expenses          |
| `get_details`    | Get expense details    |
| `create`         | Create an expense      |
| `delete`         | Delete expenses        |
| `get_comments`   | Get comments           |
| `add_comment`    | Add a comment          |
| `delete_comment` | Delete a comment       |

### `manage_custom_modules` (10 operations)

| Operation             | Description                    |
| --------------------- | ------------------------------ |
| `list_global`         | Get records (workspace)        |
| `list_project`        | Get records (project)          |
| `get_details_global`  | Get record details (workspace) |
| `get_details_project` | Get record details (project)   |
| `add_global`          | Add record (workspace)         |
| `add_project`         | Add record (project)           |
| `delete_global`       | Delete record (workspace)      |
| `delete_project`      | Delete record (project)        |
| `associate`           | Associate records with items   |
| `get_status`          | Get record statuses            |

## MCP Prompts

Pre-built workflow templates that guide AI clients through common multi-step operations:

| Prompt                   | Parameters                             | Description                                                                           |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `my_overdue_workitems`   | _(none)_                               | Fetch all overdue work items assigned to me across all active projects                |
| `my_workitems`           | _(none)_                               | Fetch all work items assigned to me across all active projects                        |
| `my_workitems_due_today` | _(none)_                               | Fetch all my work items due today across all active projects                          |
| `due_today_items`        | _(none)_                               | Fetch all work items due today across all active projects (any assignee)              |
| `project_summary`        | `projectId`                            | Comprehensive dashboard: project details, active sprint, items, team, epics, releases |
| `plan_sprint`            | `projectId`, `sprintName`, `duration?` | Guided workflow: create sprint → add backlog items → assign users → start             |
| `daily_standup`          | `projectId`, `sprintId`                | Standup report: done, in progress, to do, and potential blockers                      |

## Rate Limiting, Retry & Caching

Rate limiting, automatic retries with exponential backoff, and response caching are all handled internally — no configuration needed.

## Usage Examples

Here are some things you can ask your AI assistant once the server is connected:

| What you say | What happens |
|---|---|
| *"List all my projects"* | Fetches all projects from your Zoho Sprints workspace |
| *"Show items in the current sprint of Project X"* | Lists all work items in the active sprint |
| *"Create a task called 'Fix login bug' in Project X"* | Creates a new work item |
| *"Move item #1234 to the next sprint"* | Moves an item between sprints |
| *"Log 3 hours on item #1234 for today"* | Adds a timesheet entry |
| *"Create an epic called 'Q3 Launch' and link items to it"* | Creates an epic and associates work items |
| *"Schedule a meeting for Project X on Friday at 2 PM"* | Creates a project meeting |
| *"What are my overdue items?"* | Uses the built-in prompt to find overdue work across all projects |
| *"Give me a standup report for Sprint 5"* | Summarizes done, in-progress, and to-do items |
| *"Give me a project summary for Project X"* | Comprehensive dashboard: sprint, items, team, epics, releases |

## Debug Mode

Set `ZOHO_SPRINTS_DEBUG=true` to enable verbose logging to stderr. This logs every HTTP request/response with method, URL, status code, and duration – useful for troubleshooting.

## License

MIT
