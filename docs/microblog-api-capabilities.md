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

## References

- **Micropub API**: https://help.micro.blog/t/posting-api/96
- **Micropub Book**: https://book.micro.blog/micropub/
- **W3C Micropub Spec**: https://www.w3.org/TR/micropub/
- **XML-RPC API**: https://help.micro.blog/t/micro-blog-xml-rpc-api/108
- **Authentication**: https://help.micro.blog/2018/api-authentication/
- **Categories**: https://help.micro.blog/t/using-categories/68
- **Creating Pages**: https://help.micro.blog/t/endpoint-for-creating-pages/2234
- **API Overview**: https://help.micro.blog/t/api-overview/93
