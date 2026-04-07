# Zoho Sprints MCP Server

[![GitHub stars](https://img.shields.io/github/stars/dineshkanin/zoho-sprints-mcp?style=social)](https://github.com/dineshkanin/zoho-sprints-mcp/stargazers)
[![npm version](https://img.shields.io/npm/v/zoho-sprints-mcp)](https://www.npmjs.com/package/zoho-sprints-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides comprehensive access to the [Zoho Sprints](https://www.zoho.com/sprints/) agile project management API.

> If you find this useful, please ⭐ star this repo — it helps others discover it!

## Features

- **15 Tools** with **127 operations** covering the entire Zoho Sprints API
- **3 MCP Prompts**: Guided workflows for sprint planning, project summaries, and daily standups
- **4 MCP Resources**: Health Check, Config, Projects List, Team Members
- **Error handling**: Structured error responses with `isError` flag for AI self-correction
- **Response formatting**: LLM-friendly output with pagination info and error highlighting
- **Dual transport**: Stdio (VS Code, Claude Desktop, Cursor) and HTTP/SSE (ChatGPT, remote clients)
- **Multi-domain support**: Works with all 7 Zoho data centers (`.com`, `.eu`, `.in`, `.com.au`, `.com.cn`, `.jp`, `.sa`)
- **Auto token refresh**: Proactive refresh every 57 minutes + reactive refresh on 401 responses
- **Rate limiting**: Built-in token-bucket rate limiter with dynamic sync from `x-rate-limit` response header
- **Retry with backoff**: Automatic exponential backoff retry on transient errors (429, 5xx, network failures)
- **Retry budget**: Caps total retries across all concurrent requests (10/min) to prevent thundering herd
- **Input validation**: Reusable validators for dates, IDs, enums, JSON arrays with clear error messages
- **Response caching**: In-memory TTL cache (60 s) for GET requests – automatic invalidation on writes
- **Auto-pagination**: `getAll()` helper to fetch all pages of paginated endpoints automatically
- **Debug mode**: Enable `ZOHO_SPRINTS_DEBUG=true` to log all HTTP requests/responses to stderr
- **Custom Zoho headers**: `X-ZA-CONVERT-RESPONSE`, `X-ZA-UI-VERSION`, `X-ZA-REQSIZE` sent on every request
- **TypeScript**: Full type safety with strict mode

## Installation

```bash
npm install -g zoho-sprints-mcp
```

Or use directly with npx:

```bash
npx zoho-sprints-mcp
```

## Configuration

### Environment Variables

| Variable                     | Required | Description                                                                              |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `ZOHO_SPRINTS_REFRESH_TOKEN` | **Yes**  | OAuth2 refresh token – used to obtain & renew access tokens automatically                |
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

For a detailed walkthrough on creating a client and generating tokens, refer to the [Zoho OAuth Self Client Overview](https://www.zoho.com/accounts/protocol/oauth/self-client/overview.html).

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

| Operation          | Description           |
| ------------------ | --------------------- |
| `list_workspace`   | List workspace users  |
| `list_project`     | List project users    |
| `list_sprint`      | List sprint users     |
| `add_workspace`    | Add workspace users   |
| `add_project`      | Add project users     |
| `add_sprint`       | Add sprint users      |
| `delete_workspace` | Remove workspace user |
| `delete_project`   | Remove project user   |
| `delete_sprint`    | Remove sprint user    |

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

## Development

```bash
# Clone and install
git clone https://github.com/your-username/zoho-sprints-mcp.git
cd zoho-sprints-mcp
npm install

# Build
npm run build

# Run locally (stdio – for VS Code, Claude Desktop, Cursor)
ZOHO_SPRINTS_REFRESH_TOKEN=your-token ZOHO_SPRINTS_CLIENT_ID=your-id ZOHO_SPRINTS_CLIENT_SECRET=your-secret npm start

# Run locally (HTTP – for ChatGPT, remote clients)
ZOHO_SPRINTS_REFRESH_TOKEN=your-token ZOHO_SPRINTS_CLIENT_ID=your-id ZOHO_SPRINTS_CLIENT_SECRET=your-secret npm run start:http

# Test in browser (MCP Inspector)
npm run testrun

# Development mode (watch)
npm run dev
```

## MCP Resources

The server exposes read-only MCP Resources that clients can subscribe to:

| Resource URI                  | Description                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `zoho-sprints://health`       | Server health & diagnostics (uptime, rate limiter usage, cache size, token status, request metrics) |
| `zoho-sprints://config`       | Live server configuration (domain, team ID, debug mode, rate limiter & retry budget status)         |
| `zoho-sprints://projects`     | List of all projects in the current workspace                                                       |
| `zoho-sprints://team-members` | List of all team members in the current workspace                                                   |

## Rate Limiting & Retry

The server includes a **built-in token-bucket rate limiter** that enforces Zoho's API call limit. The limiter dynamically syncs with the `x-rate-limit` response header from Zoho (e.g. `[{"duration":120,"remaining-count":999}]`) — if the header is absent, it falls back to the default of 30 calls/min. Excess requests are automatically queued.

A **retry budget** caps the total number of retries across all concurrent requests to **10 per minute**, preventing thundering-herd cascades during outages.

Transient failures are retried automatically with **exponential backoff**:

| Error Type  | Behaviour                                                    |
| ----------- | ------------------------------------------------------------ |
| **401**     | Token refreshed once, request retried                        |
| **429**     | Respects `Retry-After` header, waits, and retries (up to 3×) |
| **5xx**     | Exponential backoff: 1 s → 2 s → 4 s (up to 3 attempts)      |
| **Network** | Same exponential backoff as 5xx errors                       |

## Caching

GET responses are cached in-memory for **60 seconds**. Write operations (POST/DELETE) automatically invalidate related cache entries. The cache drastically reduces redundant API calls when tools are called in rapid succession.

## Debug Mode

Set `ZOHO_SPRINTS_DEBUG=true` to enable verbose logging to stderr. This logs every HTTP request/response with method, URL, status code, and duration – useful for troubleshooting.

## License

MIT
