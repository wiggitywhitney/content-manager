# LinkedIn REST API Gotchas

Surprises when using the LinkedIn REST API from a Node.js CommonJS project.

## Refresh tokens require partner approval — NOT available by default

Standard self-serve OAuth (Share on LinkedIn product) returns only an access token valid 60 days.
Refresh tokens require the **Community Management API** partner program — a separate application
process with Development Tier / Standard Tier vetting. Without approval, re-authorization must
happen manually every 60 days.

**Source:** "Programmatic refresh tokens are available for a limited set of partners." ([Programmatic Refresh Tokens](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens))

## Two LinkedIn Developer Portal products are required, not one

- **"Share on LinkedIn"** → grants `w_member_social` (posting permission)
- **"Sign In with LinkedIn using OpenID Connect"** → grants `openid` and `profile` scope needed to call `GET /v2/userinfo` for the person ID (not `/v2/me` — see below)

Without the second product, you cannot retrieve the authenticated member's ID to construct the `author` URN.

## Use `GET /v2/userinfo` for person ID — NOT `GET /v2/me`

The "Sign In with LinkedIn using OpenID Connect" product (Standard Tier) only grants access to
`/v2/userinfo`, not `/v2/me`. Calling `/v2/me` returns 403 `ACCESS_DENIED` / `me.GET.NO_VERSION`.

Use the OIDC userinfo endpoint and the `sub` field:
```javascript
const response = await fetch('https://api.linkedin.com/v2/userinfo', {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const { sub } = await response.json();
const personUrn = `urn:li:person:${sub}`;
```

The `sub` from `/v2/userinfo` IS the member ID — use it directly in the `author` URN for posts.

## The `Linkedin-Version` header is mandatory on every request

No default version — omitting it returns an error. Format: `YYYYMM` (e.g., `202603` for March 2026).
Versions are supported for ~1 year before sunset.

**Source:** "An error response is returned when the version header is missing in the request." ([LMS API Versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning))

## POST /rest/posts returns 201 with no body — URL is in a response header

The post URN is in the `x-restli-id` response header (e.g., `urn:li:share:6844785523593134080`).
Construct the web URL as: `https://www.linkedin.com/feed/update/{urn}/`

**Source:** "You should get a 201 response and the response header x-restli-id contains the Post ID" ([Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api))

## Minimal post body shape for `POST /rest/posts`

```json
{
  "author": "urn:li:person:{id}",
  "commentary": "Post text here",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false
}
```

## Required headers on every REST API call

```http
Authorization: Bearer {access_token}
Linkedin-Version: 202603
X-Restli-Protocol-Version: 2.0.0
Content-Type: application/json
```

## OAuth token exchange requires `application/x-www-form-urlencoded`

The `/oauth/v2/accessToken` endpoint does NOT accept JSON. Body must be URL-encoded.

## Authorization code expires in 30 minutes and is single-use

If the callback handler is slow or reuses the code, you get a cryptic redirect URI mismatch error.

## Person IDs are application-scoped

Do not share person IDs across LinkedIn apps — they are unique per app context.
