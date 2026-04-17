# Generating OAuth2 Credentials

This guide walks you through creating Zoho OAuth credentials (Client ID, Client Secret, and Refresh Token) required to run the Zoho Sprints MCP Server.

## Step 1: Create a Zoho Developer Application

1. Go to the [Zoho API Console](https://api-console.zoho.com/)
2. Click **"Add Client"**
3. Choose **"Self Client"** (recommended for personal/development use) or **"Server-based Applications"**
4. Fill in the application details:
   - **Client Name**: e.g., `Zoho Sprints MCP`
   - **Homepage URL**: Your website or `http://localhost`
   - **Authorized Redirect URIs**: `http://localhost:8080/callback` (or your preferred redirect URL)
5. Click **"Create"** and note down:
   - **Client ID** (e.g., `1000.XXXXXXXXXX`)
   - **Client Secret** — keep this secure!

## Step 2: Generate Authorization Code

1. Build the authorization URL with the required scopes:

   ```
   https://accounts.zoho.{REGION}/oauth/v2/auth?
     scope=ZohoSprints.projects.ALL,ZohoSprints.sprints.ALL,ZohoSprints.items.ALL,ZohoSprints.teams.READ,ZohoSprints.timesheets.ALL,ZohoSprints.meetings.ALL,ZohoSprints.release.ALL,ZohoSprints.epic.ALL,ZohoSprints.settings.READ,ZohoSprints.teamusers.ALL
     &client_id=YOUR_CLIENT_ID
     &response_type=code
     &access_type=offline
     &redirect_uri=YOUR_REDIRECT_URI
   ```

   Replace `{REGION}` with your Zoho data center:

   | Region    | Domain   |
   | --------- | -------- |
   | US        | `com`    |
   | EU        | `eu`     |
   | India     | `in`     |
   | Australia | `com.au` |
   | China     | `com.cn` |
   | Japan     | `jp`     |
   | Saudi Arabia | `sa`  |

2. Open this URL in your browser
3. Log in to your Zoho account and **authorize** the application
4. You'll be redirected to your redirect URI with a `code` parameter:

   ```
   http://localhost:8080/callback?code=1000.XXXXX.XXXXX&location=in&accounts-server=https://accounts.zoho.in
   ```

5. Copy the `code` value — **it expires in ~2 minutes**, so use it immediately in the next step!

## Step 3: Exchange Code for Tokens

Use this `curl` command to exchange the authorization code for access and refresh tokens:

```bash
curl -X POST "https://accounts.zoho.{REGION}/oauth/v2/token" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=YOUR_REDIRECT_URI" \
  -d "grant_type=authorization_code"
```

The response will contain your tokens:

```json
{
  "access_token": "1000.xxxx.yyyy",
  "refresh_token": "1000.zzzz.aaaa",
  "expires_in": 3600,
  "api_domain": "https://www.zohoapis.in",
  "token_type": "Bearer"
}
```

> **Important**: Save the `refresh_token` from the response — this is your `ZOHO_SPRINTS_REFRESH_TOKEN`. The MCP server uses it to automatically obtain and refresh access tokens, so you don't need to save the `access_token`.

## Step 4: Verify Your Credentials

Test your setup by fetching your workspaces:

```bash
curl -X GET "https://sprintsapi.zoho.{REGION}/zsapi/teams/" \
  -H "Authorization: Zoho-oauthtoken YOUR_ACCESS_TOKEN"
```

You should receive a JSON response listing your Zoho Sprints workspaces.

## Using the Credentials

Set the following environment variables when configuring the MCP server:

| Variable                       | Value                                           |
| ------------------------------ | ----------------------------------------------- |
| `ZOHO_SPRINTS_CLIENT_ID`       | Client ID from Step 1                           |
| `ZOHO_SPRINTS_CLIENT_SECRET`   | Client Secret from Step 1                       |
| `ZOHO_SPRINTS_REFRESH_TOKEN`   | `refresh_token` from Step 3                     |
| `ZOHO_SPRINTS_DOMAIN`          | Your region domain (e.g., `com`, `eu`, `in`)    |

See the [README](../README.md#configuration) for full configuration options and MCP client setup.
