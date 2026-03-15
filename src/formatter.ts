import type { ApiResponse } from "./types.js";

/**
 * Format a raw Zoho Sprints API response into a concise, LLM-friendly summary.
 * Falls back to JSON.stringify for unknown shapes.
 */
export function formatResponse (result: ApiResponse, context?: string): string {
    // If the response contains an error key, surface it prominently
    if (result.error) {
        return `❌ Error: ${JSON.stringify(result.error)}\n\n${JSON.stringify(result, null, 2)}`;
    }

    const parts: string[] = [];

    // Add context header if provided
    if (context) {
        parts.push(`── ${context} ──`);
    }

    // Extract status
    if (result.status && result.status !== "success") {
        parts.push(`Status: ${result.status}`);
    }

    // Handle paginated list responses
    const pageInfo = extractPaginationInfo(result);
    if (pageInfo) {
        parts.push(pageInfo);
    }

    // Pretty-print the payload
    parts.push(JSON.stringify(result, null, 2));

    return parts.join("\n");
}

/**
 * Extract pagination metadata from a response, if present.
 */
function extractPaginationInfo (result: ApiResponse): string | null {
    const total = result.totalCount ?? result.total ?? result.count;
    const index = result.index ?? result.startIndex;
    const range = result.range ?? result.pageSize;

    if (total !== undefined) {
        const parts = [`Total: ${total}`];
        if (index !== undefined) parts.push(`Index: ${index}`);
        if (range !== undefined) parts.push(`Range: ${range}`);
        return parts.join(" | ");
    }

    return null;
}

/**
 * Summarize a list of objects by extracting key fields.
 * Useful for giving the LLM a compact view of large result sets.
 */
export function summarizeList (
    items: Array<Record<string, unknown>>,
    fields: string[],
    maxItems = 50
): string {
    if (items.length === 0) return "(empty list)";

    const display = items.slice(0, maxItems);
    const lines = display.map((item, i) => {
        const values = fields
            .map((f) => {
                const v = item[f];
                return v !== undefined ? `${f}: ${v}` : null;
            })
            .filter(Boolean)
            .join(", ");
        return `  ${i + 1}. ${values}`;
    });

    if (items.length > maxItems) {
        lines.push(`  ... and ${items.length - maxItems} more`);
    }

    return lines.join("\n");
}
