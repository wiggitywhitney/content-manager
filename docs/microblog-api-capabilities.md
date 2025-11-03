# Micro.blog API Capabilities Research

**Research Date**: 2025-10-18
**Purpose**: Document what Micro.blog's APIs can and cannot do

## Available APIs

Micro.blog provides multiple APIs:

1. **Micropub API** - W3C standard for creating, updating, deleting posts
2. **XML-RPC API** - For page management and legacy compatibility
3. **JSON API** - For timelines and user data
4. **Feeds API** - RSS and feed formats
5. **Books/Bookmarks APIs** - Specialized content types

## Authentication

### App Tokens

**How to Generate**:
- Account → Edit Apps → Create new token
- Token grants full account access

**How to Use**:
```
Authorization: Bearer YOUR_TOKEN
```

**Works with**: Micropub API, XML-RPC API (token as password)

### Other Methods
- **IndieAuth** - For third-party applications
- **OAuth** - Standard OAuth flow
- **Email Sign-In** - Requires approval from Micro.blog team

## Micropub API

**Endpoint**: `POST https://micro.blog/micropub`

### Supported Operations

**Create Posts**:
```bash
POST /micropub
Authorization: Bearer TOKEN
Content-Type: application/x-www-form-urlencoded

h=entry&content=Hello&name=Title&category=podcast
```

**Update Posts**:
```json
{
  "action": "update",
  "url": "https://site.com/post-url.html",
  "replace": { "content": ["New content"] }
}
```

**Delete Posts**:
```json
{
  "action": "delete",
  "url": "https://site.com/post-url.html"
}
```

**Query Configuration**:
```
GET /micropub?q=config
```

**List Posts**:
```
GET /micropub?q=source&limit=20&offset=0
```

**List Categories**:
```
GET /micropub?q=category
GET /micropub?q=category&filter=pod  # Filter results
```

### Available Parameters

| Parameter | Purpose | Values |
|-----------|---------|--------|
| `h` | Post type (required) | `entry` |
| `content` | Post body text | Any string |
| `name` | Post title | Any string |
| `mp-slug` | Suggested URL slug (Micropub extension) | Slugified string (e.g., `my-post-title`) |
| `category` | Assign to category | Single: `podcast` or Multiple: `category[]=podcast&category[]=video` |
| `published` | Publication timestamp | ISO 8601: `2025-01-09T10:30:00Z` |
| `post-status` | Draft vs published | `draft` or omit for published |
| `photo` | Image URL | URL string |
| `mp-photo-alt` | Image alt text | Any string |
| `mp-channel` | Post vs Page | `pages` for static pages, omit for posts |
| `mp-destination` | Which blog (if multiple) | UID from config query |
| `bookmark-of` | Create bookmark post | URL string |

### Response Codes

- **201 Created** - Post created successfully
- **202 Accepted** - Post accepted, processing
- **Location header** - Contains URL of created post
- **400 Bad Request** - Invalid parameters
- **401 Unauthorized** - Authentication failed

### URL Slug Generation

**Research Date**: 2025-10-22

#### How Micro.blog Generates Post URLs

**With `name` parameter (titled posts)**:
- Micro.blog auto-generates a URL slug from the `name` value
- Posts with titles get content-based URLs: `/2025/01/09/title-based-slug.html`
- Slug generation: title → lowercase → spaces to hyphens → special char removal

**Without `name` parameter (untitled posts/notes)**:
- Results in timestamp-based URLs: `/2025/01/09/130000.html`
- These are "untitled posts" or "notes" in Micropub terminology

#### Custom Slug Control with `mp-slug`

**Micropub Extension**: `mp-slug` is a stable Micropub extension that Micro.blog supports
- **Purpose**: Allows client to suggest a custom URL slug
- **Status**: Stable extension with multiple implementations
- **Micro.blog Support**: ✅ Confirmed (Micro.blog listed as supporting client)

**How it works**:
```bash
# Suggest custom slug via mp-slug parameter
h=entry&name=My Post Title&mp-slug=custom-url-slug&content=...

# Server may accept or modify the suggestion
# Final URL: /2025/01/09/custom-url-slug.html
```

**Server Behavior** (per Micropub spec):
> "The server MAY or MAY NOT decide to respect the requested slug, based on whether it would cause conflicts with other URLs on the site."

- Server checks for URL conflicts
- Server can modify suggested slug to avoid collisions
- Common modification: append `-2`, `-3`, etc. for duplicates
- Example: `my-slug` → `my-slug-2` if `my-slug` already exists

#### Use Cases for `mp-slug`

**1. Duplicate Titles (Same Talk, Different Conferences)**:
```javascript
// Post 1
name: "Kubernetes is a Social Construct"
mp-slug: "kubernetes-social-construct-devopsdays-rockies"

// Post 2
name: "Kubernetes is a Social Construct"
mp-slug: "kubernetes-social-construct-conf42-devops"

// Result: Unique URLs despite identical titles
```

**2. Stable URLs for Updated Content**:
- When updating a post (edit spreadsheet row, regenerate post)
- Use the **same `mp-slug` value** for the regenerated post
- Ensures consistent URL even if title changes slightly
- Maintains link integrity and SEO value

**3. SEO-Optimized URLs**:
- Control exact slug format for better SEO
- Include keywords not in title
- Shorten long titles for cleaner URLs

#### Best Practices for Content Manager Implementation

**For Initial Post Creation**:
- Generate `mp-slug` from Column A (Title) + Column C (Show) for uniqueness
- Slugify: lowercase + hyphenate + remove special chars
- Store the generated slug for future updates

**For Post Updates**:
- **Always use the same `mp-slug` value** when updating existing posts
- Do NOT regenerate slug from updated title
- This preserves the URL even if content changes
- **Slug Persistence Strategy**: Extract slug from Column H (Micro.blog URL) on updates
  - Column H stores: `https://whitneylee.com/2025/01/09/kubernetes-social-construct-devopsdays.html`
  - Extract slug: `kubernetes-social-construct-devopsdays`
  - Reuse extracted slug in `mp-slug` parameter for updates
  - No need for separate column - URL is source of truth
- Example workflow:
  1. Initial creation: Generate `mp-slug=kubernetes-social-construct-devopsdays`
  2. Store URL in Column H: `https://whitneylee.com/2025/01/09/kubernetes-social-construct-devopsdays.html`
  3. User updates title in spreadsheet
  4. Script extracts slug from Column H URL
  5. Update post with same `mp-slug` → URL preserved

**Collision Handling Strategy**:
- For duplicate titles, append show/conference identifier to slug
- Accept server modifications (e.g., `-2` suffix) as fallback
- Log final URL from Location header for tracking

#### References

- **Micropub Extensions**: https://indieweb.org/Micropub-extensions
- **mp-slug Spec**: https://indieweb.org/Micropub-extensions#Slug
- **Micro.blog Pretty URLs Discussion**: https://help.micro.blog/t/pretty-urls/266

## Categories

### How They Work

- **URL Structure**: Category "podcast" → `/categories/podcast/`
- **RSS Feeds**: Each category gets `/categories/CATEGORY/feed.xml`
- **Multiple Categories**: Posts can belong to multiple categories
- **Archive Page**: All categories listed in blog archive

### API Usage

**Assign via Micropub**:
```
category=podcast                      # Single category
category[]=podcast&category[]=video   # Multiple categories
```

**JSON format**:
```json
{
  "properties": {
    "category": ["podcast", "video"]
  }
}
```

**Query existing categories**:
```
GET /micropub?q=category
```

### Automatic Category Filters

Micro.blog supports automatic category assignment based on:
- HTML elements (e.g., `<img>` tags)
- Emoji presence (e.g., 📚)
- Post length

**Setup**: Categories → Edit Filters (web UI only)
**Limitation**: Cannot be configured via API

## XML-RPC API

**Endpoint**: `https://micro.blog/xmlrpc`

**Authentication**: Username + app token as password

### Page Management Methods

| Method | Purpose | Key Parameters |
|--------|---------|----------------|
| `microblog.newPage` | Create static page | `title`, `description`, `date_created`, `is_navigation` |
| `microblog.getPage` | Retrieve page | `page_id` |
| `microblog.editPage` | Update page | `page_id`, `title`, `description`, `is_navigation` |
| `microblog.deletePage` | Remove page | `page_id` |
| `microblog.getPages` | List all pages | - |

### Page Parameters

- **`is_navigation`** (boolean) - Controls visibility in navigation bar
- **`is_template`** (boolean) - Indicates dynamic pages (About, Archive, Photos)
- **`is_redirect`** (boolean) - Page redirects to another URL

## XML-RPC API - Detailed Implementation Guide

**Research Date**: 2025-10-24
**Status**: ✅ Fully tested and validated

### Authentication Requirements

**Critical Finding**: XML-RPC requires a **different app token** than Micropub API.

1. **Token Type**: Use the **MarsEdit token** from Account → Edit Apps
   - The "content-manager" token (used for Micropub) will return `403 User not authorized`
   - Must use the token labeled "MarsEdit" for XML-RPC operations

2. **Authentication Method**: HTTP Basic Auth (NOT Bearer token)
   ```javascript
   const auth = Buffer.from(`${username}:${token}`).toString('base64');
   headers: { 'Authorization': 'Basic ' + auth }
   ```

3. **Required Credentials**:
   - **Username**: Your Micro.blog username (e.g., `wiggitywhitney`)
   - **Password**: MarsEdit app token
   - **Blog ID**: Found in RSD file at `https://yourdomain.com/rsd.xml`

### RSD Discovery

To find your Blog ID:
```bash
curl https://whitneylee.com/rsd.xml
```

Example RSD file:
```xml
<api name="Micro.blog" blogID="169604" preferred="true"
     apiLink="https://micro.blog/xmlrpc"/>
```

The `blogID` (169604 in this example) is required for some XML-RPC methods.

### Method Parameter Orders

**IMPORTANT**: Parameter order varies by method. Incorrect order causes errors like "Page title can't be blank".

#### `microblog.getPages` - List All Pages
**Parameter Order**:
1. Blog ID (integer)
2. Username (string)
3. Password (string - use MarsEdit token)
4. Number of pages (integer) - how many to fetch
5. Offset (integer) - pagination offset

**Example**:
```javascript
xmlrpcRequest('microblog.getPages', [
  169604,              // blogID
  'wiggitywhitney',    // username
  'MARSEDIT_TOKEN',    // password
  100,                 // fetch up to 100 pages
  0                    // offset 0
]);
```

**Returns**: Array of page structs with fields:
- `id` (integer) - Page ID
- `title` (string) - Page title
- `permalink` (string) - Page URL
- `description` (string) - Page content or redirect URL
- `is_navigation` (boolean) - Visible in nav?
- `is_template` (boolean) - Dynamic template page?
- `is_redirect` (boolean) - Redirects elsewhere?

#### `microblog.getPage` - Get Single Page
**Parameter Order**:
1. Page ID (integer)
2. Username (string)
3. Password (string - use MarsEdit token)

**Example**:
```javascript
xmlrpcRequest('microblog.getPage', [
  897491,              // pageID
  'wiggitywhitney',    // username
  'MARSEDIT_TOKEN'     // password
]);
```

#### `microblog.editPage` - Update Page
**Parameter Order**:
1. Page ID (integer)
2. Username (string)
3. Password (string - use MarsEdit token)
4. Content struct (object)

**Content Struct Fields**:
- `title` (string, required) - Page title
- `description` (string, required) - Page content or redirect URL
- `is_navigation` (boolean, optional) - Show in navigation?

**Example - Hide Page from Navigation**:
```javascript
xmlrpcRequest('microblog.editPage', [
  897491,              // pageID
  'wiggitywhitney',    // username
  'MARSEDIT_TOKEN',    // password
  {
    title: 'Blog',
    description: 'https://whitneylee.com/blog',
    is_navigation: false  // HIDE from navigation
  }
]);
```

**Example - Show Page in Navigation**:
```javascript
xmlrpcRequest('microblog.editPage', [
  897491,              // pageID
  'wiggitywhitney',    // username
  'MARSEDIT_TOKEN',    // password
  {
    title: 'Blog',
    description: 'https://whitneylee.com/blog',
    is_navigation: true   // SHOW in navigation
  }
]);
```

**Response**: `<boolean>1</boolean>` on success

### Complete Working Example

```javascript
const https = require('https');

const MICROBLOG_XMLRPC_TOKEN = process.env.MICROBLOG_XMLRPC_TOKEN; // MarsEdit token
const MICROBLOG_USERNAME = 'wiggitywhitney';
const BLOG_ID = 169604;

function xmlrpcRequest(methodName, params) {
  return new Promise((resolve, reject) => {
    // Build params XML
    const paramsXml = params.map(param => {
      if (typeof param === 'string') {
        return `<param><value><string>${escapeXml(param)}</string></value></param>`;
      } else if (typeof param === 'number') {
        return `<param><value><int>${param}</int></value></param>`;
      } else if (typeof param === 'object') {
        const members = Object.entries(param).map(([key, value]) => {
          let valueXml;
          if (typeof value === 'string') {
            valueXml = `<string>${escapeXml(value)}</string>`;
          } else if (typeof value === 'boolean') {
            valueXml = `<boolean>${value ? 1 : 0}</boolean>`;
          }
          return `<member><name>${key}</name><value>${valueXml}</value></member>`;
        }).join('');
        return `<param><value><struct>${members}</struct></value></param>`;
      }
    }).join('');

    const requestBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>${paramsXml}</params>
</methodCall>`;

    const auth = Buffer.from(`${MICROBLOG_USERNAME}:${MICROBLOG_XMLRPC_TOKEN}`).toString('base64');

    const options = {
      hostname: 'micro.blog',
      path: '/xmlrpc',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(requestBody),
        'Authorization': 'Basic ' + auth
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Example: Get all pages
const response = await xmlrpcRequest('microblog.getPages', [
  BLOG_ID,
  MICROBLOG_USERNAME,
  MICROBLOG_XMLRPC_TOKEN,
  100,
  0
]);

// Example: Hide a page
await xmlrpcRequest('microblog.editPage', [
  897491,  // Page ID for "Blog"
  MICROBLOG_USERNAME,
  MICROBLOG_XMLRPC_TOKEN,
  {
    title: 'Blog',
    description: 'https://whitneylee.com/blog',
    is_navigation: false
  }
]);
```

### Tested Use Cases

**✅ Successfully Tested (2025-10-24)**:

1. **Authentication with MarsEdit token** - Works perfectly
2. **Query all pages** (`microblog.getPages`) - Returns 14 pages with full metadata
3. **Get single page** (`microblog.getPage`) - Returns complete page data
4. **Hide page from navigation** (`microblog.editPage` with `is_navigation: false`) - Verified working
5. **Show page in navigation** (`microblog.editPage` with `is_navigation: true`) - Verified working
6. **Changes persist** - Page visibility changes immediately visible in Micro.blog UI

**Category Navigation Pages Found**:
- Video: Page ID 897489
- Podcast: Page ID 897417
- Guest: Page ID 897488
- Blog: Page ID 897491
- Presentations: Page ID 897483

### Common Errors and Solutions

**Error: "User not authorized" (403)**
- **Cause**: Using wrong app token (Micropub token instead of MarsEdit token)
- **Solution**: Use the MarsEdit token from Account → Edit Apps

**Error: "Page title can't be blank" (500)**
- **Cause**: Wrong parameter order for `microblog.editPage`
- **Solution**: Use order: pageID, username, password, content_struct (NOT blogID first)

**Error: HTTP 500 with no details**
- **Cause**: Trying to use standard MetaWeblog methods that Micro.blog doesn't fully support
- **Solution**: Use `microblog.*` methods instead of `wp.*` or `metaWeblog.*` methods

### XML Response Parsing

Responses contain nested structs. Example parser:

```javascript
function parseXmlRpcArray(xml) {
  const pages = [];
  const arrayMatch = xml.match(/<array><data>([\s\S]*?)<\/data><\/array>/);
  if (!arrayMatch) return pages;

  let content = arrayMatch[1];
  let pos = 0;

  // Extract top-level structs by counting depth
  while (pos < content.length) {
    const valueStart = content.indexOf('<value><struct>', pos);
    if (valueStart === -1) break;

    // Find matching </struct></value> by counting depth
    let depth = 0;
    let i = valueStart;
    let structEnd = -1;

    while (i < content.length) {
      if (content.substring(i, i + 15) === '<value><struct>') {
        depth++;
        i += 15;
      } else if (content.substring(i, i + 17) === '</struct></value>') {
        depth--;
        if (depth === 0) {
          structEnd = i + 17;
          break;
        }
        i += 17;
      } else {
        i++;
      }
    }

    if (structEnd === -1) break;

    const structXml = content.substring(valueStart, structEnd);
    const page = {};

    // Extract fields
    const idMatch = structXml.match(/<name>id<\/name><value><i4>(\d+)<\/i4>/);
    if (idMatch) page.id = parseInt(idMatch[1], 10);

    const titleMatch = structXml.match(/<name>title<\/name><value><string>(.*?)<\/string>/);
    if (titleMatch) page.title = titleMatch[1];

    const navMatch = structXml.match(/<name>is_navigation<\/name><value><boolean>([01])<\/boolean>/);
    if (navMatch) page.is_navigation = navMatch[1] === '1';

    if (page.id && page.title) {
      pages.push(page);
    }

    pos = structEnd;
  }

  return pages;
}
```

### Environment Configuration

Add to `.teller.yml`:
```yaml
keys:
  marsedit_token: MICROBLOG_XMLRPC_TOKEN
```

Add to `.env`:
```bash
MICROBLOG_USERNAME=wiggitywhitney
MICROBLOG_BLOG_ID=169604
```

## Key Architectural Concepts

### Pages vs Categories vs Posts

**Pages**:
- Static content outside chronological feed
- Examples: About, Contact, Archive
- Not date-based
- Managed via XML-RPC or Micropub with `mp-channel=pages`

**Categories**:
- Content organization within posts
- Automatic URL generation at `/categories/NAME/`
- Individual RSS feeds
- Assigned via `category` parameter

**Posts**:
- Chronological content
- Default Micropub behavior
- Can have multiple categories
- Appear in main feed and category feeds

### Navigation Management

**For Pages**:
- Control via `is_navigation` parameter in XML-RPC API
- Or manually toggle in web UI

**For Categories**:
- Create a page linking to `/categories/NAME/`
- Enable "Include this page in your blog navigation"
- No direct API for category navigation visibility

## Limitations & Constraints

### Cannot Do via API

- **Automatic category navigation management** - Must manually create/manage pages that link to categories
- **Theme customization** - Requires web UI or theme file editing
- **Account settings** - Some settings only available in web UI
- **Filter management** - Automatic category filters configured in web UI only

### Rate Limits

- Not explicitly documented
- Best practice: Respect server with reasonable delays between requests
- Retry with exponential backoff on 429 responses

### Content Constraints

- **Post titles** - Optional, can be omitted for micro-posts
- **Character limits** - No hard limit documented
- **Media uploads** - Supported via separate media endpoint (query via `q=config`)
- **Markdown support** - Fully supported in content

## Testing & Debugging

### Test Authentication
```bash
curl -H "Authorization: Bearer TOKEN" \
  https://micro.blog/micropub?q=config
```

### Test Post Creation
```bash
curl -X POST https://micro.blog/micropub \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "h=entry&content=Test+post&post-status=draft"
```

### Check Response Headers
- **Location** - URL of created post
- **Retry-After** - Wait time if rate limited

## Implementation Learnings (2025-10-19)

### Published Date Behavior

**Feed Placement**: The `published` parameter controls chronological placement in feeds
- Posts appear at their `published` date position, not creation time
- Backdated posts (e.g., `published=2025-01-09T12:00:00Z`) appear in January, not at feed top
- Users must scroll to the historical date to see backdated posts
- Perfect for bulk-importing historical content without feed spam

**Timezone Handling**: Critical for correct date display
- JavaScript `new Date()` parses dates in **local timezone** by default
- This causes off-by-one date errors when converting to UTC
- **Solution**: Parse MM/DD/YYYY manually and create UTC date directly
- Set time to noon UTC (`12:00:00Z`) to avoid timezone edge cases
- Example: `01/09/2025` → `Date.UTC(2025, 0, 9, 12, 0, 0)` → `2025-01-09T12:00:00.000Z`

**Verified URL Behavior**: Post URLs reflect the published date
- `published=2025-01-09T12:00:00Z` → `/2025/01/09/post-slug.html`
- Date in URL matches the `published` parameter date

### Cross-Posting with Backdated Posts

**Uncertainty**: Documentation unclear on cross-posting behavior for backdated posts
- Micro.blog docs state: "Once enabled, any new posts (after you enable cross-posting) will be sent"
- Unclear if "new" means creation time or published date
- **Risk**: Bulk-creating 61 backdated posts might spam all connected social accounts

**Recommendation**: Test before bulk operations
1. Create 1 backdated test post with cross-posting enabled
2. Check connected social accounts (Bluesky, LinkedIn, Mastodon, etc.)
3. If post appears on socials → disable cross-posting before bulk import
4. If post doesn't appear → safe to proceed with bulk creation

**Draft Posts Option**: Use `post-status=draft` to avoid cross-posting during testing
- Draft posts are not cross-posted
- Visible via direct URL but not in feeds
- Can be published later via web UI or API update

### Content Formatting

**Markdown Support**: Full Markdown rendering in post content
- **Line breaks**: Use single `:` for inline separation (works well)
- **Double newline** (`\n\n`): Creates paragraph break with blank line (too much spacing)
- **Soft break** (`  \n`): Two spaces + newline didn't render as expected
- **Recommended format**: `Show Name: [Title](url)` (colon separator, single line)

**Tested Formats**:
```
✗ "Show Name\n[Title](url)" - Renders as "Show Name Title"
✗ "Show Name\n\n[Title](url)" - Too much spacing (blank line)
✗ "Show Name  \n[Title](url)" - Soft break didn't work
✅ "Show Name: [Title](url)" - Clean, clear visual separation
```

**Example Post Content**:
```
Software Defined Interviews: [Learning to learn, with Sasha Czarkowski](https://www.softwaredefinedinterviews.com/91)
```

### Update Operation Timing

**Cache/Rendering Delays**: Updates take time to appear
- Post creation is fast (seconds)
- Updates via Micropub may take 1-2 minutes to render
- Hard refresh required (Cmd+Shift+R on Mac)
- New posts appear faster than updates to existing posts

### Testing Best Practices

1. **Small batches first**: Test with 3 posts before bulk operations
2. **Verify date display**: Check URLs and feed placement match expectations
3. **Test cross-posting**: Single post test before bulk import
4. **Use drafts for format testing**: Keeps test posts out of feeds
5. **Delete test posts**: Clean up via Micropub delete operation
6. **Clear spreadsheet state**: Reset Column H after deleting test posts

## Known Issues & Workarounds

### Scheduled Post Rescheduling Bug

**Research Date**: 2025-11-01
**Status**: Known issue since 2023, unresolved

#### Problem Description

When rescheduling a post to a different publication time, Micro.blog may publish the post at **all scheduled times** instead of just the final scheduled time. This creates duplicate "phantom posts" that:
- Appear on the live site at multiple dates
- Cannot be deleted normally via the web UI or Micropub API
- Return 404 when attempting to delete via Micropub API (backend knows they're deleted)
- Still render in the static HTML (site generator includes them despite deletion)

**Example**:
- Schedule post "Pixie" for October 31
- Reschedule to November 1
- Reschedule again to November 2
- **Result**: Post appears on all three dates (Oct 31, Nov 1, Nov 2)

#### Root Cause

Disconnect between backend database and static site generator:
1. Backend database marks posts as deleted (Micropub API returns 404)
2. Static site generator still includes deleted posts in HTML output
3. Site rebuilds with phantom posts baked into HTML

#### Solution

**Force a full site rebuild** to clear phantom posts:

1. Navigate to https://micro.blog/account/logs (requires login)
2. Click the **"Rebuild"** button
3. Wait 2-3 minutes for rebuild to complete
4. Phantom posts should be removed from the site

**Prevention**:
- Avoid rescheduling posts multiple times if possible
- If you must reschedule, be prepared to force a site rebuild
- Consider deleting and recreating posts instead of rescheduling

#### References

- **Help Thread (2023)**: https://help.micro.blog/t/rescheduling-posts-is-creating-extra-phantom-posts/2071
- **Support Contact**: help@micro.blog
- **Site Rebuild**: https://micro.blog/account/logs

## References

- **Micropub API**: https://help.micro.blog/t/posting-api/96
- **Micropub Book**: https://book.micro.blog/micropub/
- **W3C Micropub Spec**: https://www.w3.org/TR/micropub/
- **XML-RPC API**: https://help.micro.blog/t/micro-blog-xml-rpc-api/108
- **Authentication**: https://help.micro.blog/2018/api-authentication/
- **Categories**: https://help.micro.blog/t/using-categories/68
- **Creating Pages**: https://help.micro.blog/t/endpoint-for-creating-pages/2234
- **API Overview**: https://help.micro.blog/t/api-overview/93
