import { ZohoSprintsClient } from "../api-client.js";
import { formatResponse } from "../formatter.js";
import type { ApiResponse } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionParams = Record<string, string | undefined>;
export type ActionHandler = (client: ZohoSprintsClient, teamId: string, p: ActionParams) => Promise<unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pick only defined values from params for the given keys */
export function pick (p: ActionParams, keys: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const k of keys) if (p[k]) result[k] = p[k]!;
    return result;
}

/** Validate that all required params for an operation are present */
export function validateRequired (
    requiredParams: Record<string, string[]>,
    operation: string,
    p: ActionParams,
): void {
    const missing = (requiredParams[operation] ?? []).filter(k => !p[k]);
    if (missing.length > 0) {
        throw new Error(`Operation "${operation}" requires: ${missing.join(", ")}`);
    }
}

/** Format an API result into an MCP tool response, detecting Zoho failure responses */
export function toolResult (result: unknown, context?: string) {
    // Zoho Sprints API returns { status: "failure", message: "..." } on errors
    if (typeof result === "object" && result !== null) {
        const res = result as Record<string, unknown>;
        if (res.status === "failure") {
            const msg = typeof res.message === "string" ? res.message : JSON.stringify(result, null, 2);
            return { content: [{ type: "text" as const, text: msg }], isError: true as const };
        }
        return { content: [{ type: "text" as const, text: formatResponse(res as ApiResponse, context) }] };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

/** Format an error into an MCP tool response with isError flag */
export function toolError (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: message }], isError: true as const };
}
