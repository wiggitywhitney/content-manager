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

## `commentary` field silently truncates on unescaped reserved characters — no error returned

The `commentary` field uses LinkedIn's `little` text format. **13 characters are reserved** and must be backslash-escaped in the field value:

```text
( )  [ ]  { }  @  #  *  _  ~  <  >  \
```

When any of these characters appear **unescaped**, LinkedIn's parser silently drops all text from that character onwards. The API still returns 201, `x-restli-id` is populated, and a GET of the post returns the full original text — but the rendered post displays only the truncated portion with no "see more" link. This affects ALL post types (text-only, image, video), not just media posts.

Social post text commonly contains parentheses (e.g., `(from the SDI podcast)`, `(link in bio)`). If the first `(` appears after the first sentence, only that sentence renders.

**Fix:** escape all reserved characters before assigning to `commentary`:

```javascript
function escapeLinkedInCommentary(text) {
  return text.replace(/[()[\]{}\@#*_~<>\\]/g, '\\$&');
}
// Usage: commentary: escapeLinkedInCommentary(post.postText)
```

**Caveat:** Do NOT escape if `post.postText` uses intentional `little` format syntax (e.g., `@[Name](URN)` for mentions). Plain prose text from Google Sheets should always be escaped.

**Backslash special case:** A literal `\` in the source text needs four backslashes in the final JSON body (`\\\\`) — the `replace` above handles this correctly since `\` is included in the character class.

**Source:** ["When a left or right parenthesis appears anywhere in the commentary, all text from that parenthesis onwards gets silently dropped from the post (no error returned)."](https://learn.microsoft.com/en-us/answers/questions/5741122/issues-when-mentioning-urns-with-special-character) — Microsoft Learn Q&A, confirmed by LinkedIn Support.

## Image alt text goes in `content.media.altText` on the post — NOT during upload

Alt text is set in the `POST /rest/posts` body, not during `initializeUpload` or binary upload. Add it as `content.media.altText`. Omit the field (or use `undefined`) when no alt text is available — do not send an empty string.

```json
"content": { "media": { "altText": "Description here", "id": "urn:li:image:..." } }
```

- Maximum 4,086 characters; recommended under 120.
- **GET responses do not return `altText`** — it is write-only. LinkedIn renders it server-side and does not echo it back.
- LinkedIn auto-generates alt text via AI when the field is omitted.

**Source:** [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-05), [LinkedIn Image API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-05)

## `content.media` does NOT cause text truncation — it is not image-specific

The `content.media` format for single-image posts does not impose any lower character limit on `commentary` vs text-only posts. The official schema defines the same `little` text `commentary` field for all post types with no type-specific limit. Apparent truncation on image posts is the reserved-character escaping issue above — coincidental because image post captions commonly contain parentheses.
