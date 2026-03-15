import { z } from "zod";

// ─── Common Parameter Schemas ─────────────────────────────────────────────────
// Reusable Zod schemas for parameters that appear across many tools.
// Use these directly in inputSchema objects: { ...P.project, ...P.pagination() }

export const P = {
    // ── Entity IDs ────────────────────────────────────────────────────────────
    projectId: { projectId: z.string().describe("Project ID") },
    sprintId: { sprintId: z.string().describe("Sprint or Backlog ID") },
    itemId: { itemId: z.string().describe("Item ID") },
    moduleId: { moduleId: z.string().describe("Module ID") },
    epicId: { epicId: z.string().describe("Epic ID") },
    releaseId: { releaseId: z.string().describe("Release ID") },
    meetingId: { meetingId: z.string().describe("Meeting ID") },
    notesId: { notesId: z.string().describe("Comment (notes) ID") },

    /** index + range for list endpoints. Override defaults per-tool if needed. */
    pagination: (indexDefault = "1", rangeDefault = "50") => ({
        index: z.string().optional().default(indexDefault).describe("Start index"),
        range: z.string().optional().default(rangeDefault).describe("Number of records"),
    }),
} as const;
