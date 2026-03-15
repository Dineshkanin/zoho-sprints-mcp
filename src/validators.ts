/**
 * Input validation helpers for Zoho Sprints MCP tool parameters.
 *
 * Provides clear, human-readable error messages so the LLM (or user)
 * can immediately understand what went wrong without hitting the API.
 */

// ── Validation result ──────────────────────────────────────────────────────────

export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

// ── Core validators ────────────────────────────────────────────────────────────

/**
 * Validate that all required string fields are non-empty.
 */
export function requireFields (
    params: Record<string, unknown>,
    fields: string[]
): ValidationResult {
    const errors: ValidationError[] = [];

    for (const field of fields) {
        const value = params[field];
        if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
            errors.push({ field, message: `"${field}" is required and must not be empty.` });
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate that a value is a valid ISO 8601 date string.
 * Accepts formats like: 2025-01-15, 2025-01-15T10:00:00, 2025-01-15T10:00:00+05:30
 */
export function validateDate (field: string, value: string | undefined): ValidationResult {
    if (!value) return { valid: true, errors: [] }; // optional

    const parsed = Date.parse(value);
    if (isNaN(parsed)) {
        return {
            valid: false,
            errors: [{
                field,
                message: `"${field}" must be a valid ISO 8601 date (e.g. "2025-01-15" or "2025-01-15T10:00:00+05:30"). Got: "${value}".`,
            }],
        };
    }

    return { valid: true, errors: [] };
}

/**
 * Validate that a value is a valid JSON array string.
 * Used for parameters like `users: "[123, 456]"`.
 */
export function validateJsonArray (field: string, value: string | undefined): ValidationResult {
    if (!value) return { valid: true, errors: [] }; // optional

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return {
                valid: false,
                errors: [{ field, message: `"${field}" must be a valid JSON array (e.g. '[1, 2, 3]'). Got a ${typeof parsed}.` }],
            };
        }
    } catch {
        return {
            valid: false,
            errors: [{ field, message: `"${field}" must be a valid JSON array. Could not parse: "${value}".` }],
        };
    }

    return { valid: true, errors: [] };
}

/**
 * Validate that a string is a positive integer (ID fields).
 */
export function validateId (field: string, value: string | undefined): ValidationResult {
    if (!value) return { valid: true, errors: [] }; // optional

    if (!/^\d+$/.test(value)) {
        return {
            valid: false,
            errors: [{ field, message: `"${field}" must be a numeric ID (digits only). Got: "${value}".` }],
        };
    }

    return { valid: true, errors: [] };
}

/**
 * Validate that a numeric string is within a range.
 */
export function validateRange (
    field: string,
    value: string | undefined,
    min: number,
    max: number
): ValidationResult {
    if (!value) return { valid: true, errors: [] }; // optional

    const num = Number(value);
    if (isNaN(num)) {
        return {
            valid: false,
            errors: [{ field, message: `"${field}" must be a number. Got: "${value}".` }],
        };
    }

    if (num < min || num > max) {
        return {
            valid: false,
            errors: [{ field, message: `"${field}" must be between ${min} and ${max}. Got: ${num}.` }],
        };
    }

    return { valid: true, errors: [] };
}

/**
 * Validate that a value is one of a set of allowed values.
 */
export function validateEnum (
    field: string,
    value: string | undefined,
    allowedValues: string[]
): ValidationResult {
    if (!value) return { valid: true, errors: [] }; // optional

    if (!allowedValues.includes(value)) {
        return {
            valid: false,
            errors: [{
                field,
                message: `"${field}" must be one of: ${allowedValues.join(", ")}. Got: "${value}".`,
            }],
        };
    }

    return { valid: true, errors: [] };
}

// ── Aggregate helper ───────────────────────────────────────────────────────────

/**
 * Run multiple validation checks and return the combined result.
 * Short-circuits on the first batch of errors if `failFast` is true.
 */
export function validate (...results: ValidationResult[]): ValidationResult {
    const allErrors: ValidationError[] = [];

    for (const r of results) {
        allErrors.push(...r.errors);
    }

    return { valid: allErrors.length === 0, errors: allErrors };
}

/**
 * Format validation errors into a readable MCP tool error response.
 */
export function validationErrorResponse (result: ValidationResult): {
    content: Array<{ type: "text"; text: string }>;
    isError: true;
} {
    const lines = result.errors.map((e) => `• ${e.message}`);
    return {
        content: [{ type: "text" as const, text: `Validation failed:\n${lines.join("\n")}` }],
        isError: true,
    };
}
