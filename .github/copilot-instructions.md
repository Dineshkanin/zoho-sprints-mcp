# Zoho Sprints MCP Server — Copilot Instructions

This is a **Model Context Protocol (MCP) server** for Zoho Sprints, written in TypeScript (ESM). It exposes Zoho Sprints REST API operations as MCP tools that AI assistants (Claude, ChatGPT, Cursor, VS Code Copilot) can call.

---

## Project Structure

```
src/
├── index.ts              # Entry point — config, auth, server bootstrap, transport
├── api-client.ts         # HTTP client wrapping Zoho Sprints REST API
├── types.ts              # Shared types: ZohoSprintsConfig, ZOHO_DOMAINS, ApiResponse
├── schemas.ts            # Reusable Zod parameter schemas (P.projectId, P.pagination, etc.)
├── validators.ts         # Input validation helpers (requireFields, validateDate, etc.)
├── resources.ts          # MCP Resources (health, config, projects, team-members)
├── rate-limiter.ts       # Token-bucket rate limiter with dynamic sync from x-rate-limit header
├── retry-budget.ts       # Global retry budget (10 retries/minute)
├── cache.ts              # In-memory TTL cache (60s default)
├── logger.ts             # Debug logger (ZOHO_SPRINTS_DEBUG=true → stderr)
├── formatter.ts          # Response formatting utilities
└── tools/                # One file per Zoho Sprints API domain
    ├── workspaces.ts
    ├── projects.ts
    ├── sprints.ts
    ├── items.ts
    ├── epics.ts
    ├── releases.ts
    ├── timesheets.ts
    ├── meetings.ts
    ├── users.ts
    ├── project-settings.ts
    ├── checklists.ts
    ├── webhooks.ts
    ├── okr.ts
    ├── expenses.ts
    └── custom-modules.ts
```

---

## Adding a New Tool — Step-by-Step

### 1. Choose the right file

Each file in `src/tools/` covers one Zoho Sprints API domain. Add the tool to the existing file that matches. Only create a new file if the API domain is genuinely new.

### 2. Tool registration pattern

Use `server.registerTool()` — **not** `server.tool()` (deprecated).

```typescript
server.registerTool(
    "tool_name_snake_case",
    {
        description: "Clear, one-line description of what the tool does",
        inputSchema: {
            ...P.projectId,
            ...P.sprintId,
            ...P.pagination("1", "20"),
            customParam: z.string().optional().describe("What this param does (optional)"),
        },
    },
    async ({ projectId, sprintId, index, range, customParam }) => {
        index = index ?? "1";
        range = range ?? "20";
        const client = getClient();
        const teamId = client.teamId!;
        // ... API call ...
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
);
```

### 3. Register in index.ts (only for new files)

If you created a new tool file, add the import and registration call in `src/index.ts`:

```typescript
import { registerNewDomainTools } from "./tools/new-domain.js";
// ... in main():
registerNewDomainTools(server, getClient);
```

---

## Critical Rules

### Parameter Schemas — Zod Only

- **MUST** use Zod types (`z.string()`, `z.string().optional()`, etc.) for all `inputSchema` properties.
- **NEVER** use plain objects like `{ type: "string", description: "..." }` — the MCP SDK silently drops them, resulting in `properties: {}` (no parameters visible to the AI).
- Always add `.describe("...")` to every parameter for AI visibility.

### Shared Schema Constants (`src/schemas.ts`)

Use spread syntax with `P.*` for commonly repeated parameters:

| Constant | Expands to |
|---|---|
| `...P.projectId` | `projectId: z.string().describe("Project ID")` |
| `...P.sprintId` | `sprintId: z.string().describe("Sprint or Backlog ID")` |
| `...P.itemId` | `itemId: z.string().describe("Item ID")` |
| `...P.moduleId` | `moduleId: z.string().describe("Module ID")` |
| `...P.epicId` | `epicId: z.string().describe("Epic ID")` |
| `...P.releaseId` | `releaseId: z.string().describe("Release ID")` |
| `...P.meetingId` | `meetingId: z.string().describe("Meeting ID")` |
| `...P.notesId` | `notesId: z.string().describe("Comment (notes) ID")` |
| `...P.pagination()` | `index` (default "1") + `range` (default "50") |
| `...P.pagination("1", "20")` | Custom range default |

If a parameter has a **context-specific description** (e.g., "Source Project ID", "Parent Item ID"), define it inline instead of using the shared constant.

When adding a new commonly-used parameter, add it to `src/schemas.ts` and spread it everywhere.

### Runtime Default Fallbacks

Every optional parameter with a `.default()` value **must** also have a `??` fallback in the handler body. Zod `default()` only declares the schema default — the MCP SDK does not enforce it at runtime.

```typescript
// In inputSchema:
index: z.string().optional().default("1").describe("Start index"),

// In handler — REQUIRED:
index = index ?? "1";
```

### Tool Naming

- Use `snake_case` for tool names: `get_items`, `create_item`, `delete_item_comment`.
- Prefix with verb: `get_`, `create_`, `update_`, `delete_`, `add_`, `move_`, `link_`.
- Name must be unique across all tool files.

### Function Signature

Every tool file exports one function:

```typescript
export function registerXxxTools(
    server: McpServer,
    getClient: () => ZohoSprintsClient
): void { ... }
```

- `server` is typed as `McpServer` (from `@modelcontextprotocol/sdk/server/mcp.js`) — not `any`.
- `getClient` is a getter so tools always use the latest client instance (with refreshed tokens).

### API Client Usage

- `client.get(path, params?)` — GET request. Responses are cached (60s TTL).
- `client.post(path, data?, jsonBody?)` — POST request. Invalidates cache for the path prefix.
- `client.delete(path, params?)` — DELETE request. Invalidates cache.
- `client.getAll(path, params, dataKey, pageSize?, maxPages?)` — Auto-paginated GET.
- All paths are relative to the API base, e.g., `/team/${teamId}/projects/${projectId}/...`.
- Always include the trailing slash in paths (Zoho API requires it).
- `teamId` is accessed via `client.teamId!` (auto-detected at startup).

### Response Format

Every tool **must** return the standard MCP content response:

```typescript
return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
```

### Imports

Every tool file requires these imports:

```typescript
import { z } from "zod";
import { P } from "../schemas.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoSprintsClient } from "../api-client.js";
```

Use `.js` extensions in all import paths (ESM requirement).

---

## MCP Resources

Resources use `server.registerResource()` — **not** `server.resource()` (deprecated).

```typescript
server.registerResource(
    "resource-name",
    "zoho-sprints://resource-name",
    { description: "What this resource provides" },
    async (_uri) => ({
        contents: [{
            uri: "zoho-sprints://resource-name",
            mimeType: "application/json",
            text: JSON.stringify(data, null, 2),
        }],
    })
);
```

---

## Do's and Don'ts

### Do

- Use Zod schemas with `.describe()` for every parameter.
- Use shared `P.*` constants for repeated parameters.
- Add `??` runtime fallbacks for every `.default()` value.
- Use `Record<string, string>` for building query params / form data.
- Guard optional params with `if (param) data.param = param`.
- Use trailing slashes on all API paths.
- Type `server` as `McpServer`, never `any`.
- Add a section comment before each tool: `// ─── Tool Name ────────`.
- Keep tool descriptions concise — one clear sentence.

### Don't

- Don't use `server.tool()` — it's deprecated. Use `server.registerTool()`.
- Don't use `server.resource()` — deprecated. Use `server.registerResource()`.
- Don't use plain object schemas `{ type: "string" }` — invisible to AI clients.
- Don't forget the `??` fallback for defaults — the schema default alone won't work.
- Don't hardcode `teamId` — always use `client.teamId!`.
- Don't return raw strings — always wrap in `{ content: [{ type: "text", text: ... }] }`.
- Don't add `try/catch` in tool handlers — the MCP SDK and `api-client.ts` handle errors.
- Don't import from paths without `.js` extension.

---

## Tech Stack

- **Runtime**: Node.js ≥ 18, ESM (`"type": "module"`)
- **Language**: TypeScript 5.x, strict mode, ES2022 target, Node16 module resolution
- **MCP SDK**: `@modelcontextprotocol/sdk` — `McpServer`, `registerTool`, `registerResource`
- **Schema**: Zod (via MCP SDK peer dependency)
- **Auth**: Zoho OAuth2 with refresh tokens, 7 data centers, 57-minute auto-refresh
- **Transport**: Stdio (default) or HTTP/SSE (`MCP_TRANSPORT=http`)
- **Build**: `npm run build` → `tsc` → `dist/`
- **Test**: `npm run testrun` → MCP Inspector

---

## Build & Verify

After any change:

```bash
npm run build          # Must pass with zero errors
npm run testrun        # Opens MCP Inspector to verify tools are visible
```

If a tool shows `properties: {}` in the inspector, the schema is wrong — check that all parameters use Zod types.
