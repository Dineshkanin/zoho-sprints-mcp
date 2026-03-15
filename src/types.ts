/**
 * Zoho Sprints API domain configuration.
 * Maps data center regions to their API base URLs.
 */
export const ZOHO_DOMAINS: Record<string, string> = {
    com: "https://sprintsapi.zoho.com/zsapi",
    eu: "https://sprintsapi.zoho.eu/zsapi",
    in: "https://sprintsapi.zoho.in/zsapi",
    "com.au": "https://sprintsapi.zoho.com.au/zsapi",
    "com.cn": "https://sprintsapi.zoho.com.cn/zsapi",
    jp: "https://sprintsapi.zoho.jp/zsapi",
    sa: "https://sprintsapi.zoho.sa/zsapi",
};

/**
 * Zoho Accounts domain mapping for OAuth token refresh.
 */
export const ZOHO_ACCOUNTS_DOMAINS: Record<string, string> = {
    com: "https://accounts.zoho.com",
    eu: "https://accounts.zoho.eu",
    in: "https://accounts.zoho.in",
    "com.au": "https://accounts.zoho.com.au",
    "com.cn": "https://accounts.zoho.com.cn",
    jp: "https://accounts.zoho.jp",
    sa: "https://accounts.zoho.sa",
};

export interface ZohoSprintsConfig {
    /** Zoho domain key (e.g., "com", "eu", "in") */
    domain: string;
    /** OAuth2 refresh token – used to obtain and renew access tokens */
    refreshToken: string;
    /** OAuth2 client ID */
    clientId: string;
    /** OAuth2 client secret */
    clientSecret: string;
    /** OAuth2 access token (optional – auto-fetched from refresh token if omitted) */
    accessToken?: string;
    /** Default workspace (team) ID – avoids passing it to every tool call */
    teamId?: string;
}

export interface ApiResponse {
    status?: string;
    [key: string]: unknown;
}
