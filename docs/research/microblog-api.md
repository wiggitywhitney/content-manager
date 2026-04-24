# Research: Micro.blog API Capabilities

**Project:** content-manager
**Last Updated:** 2026-04-08

## Update Log
| Date | Summary |
|------|---------|
| 2026-04-08 | Initial structured research. Consolidates existing docs/microblog-api-capabilities.md with current (2026) web verification. Focuses on page editing (PRD #2 blocker), cross-posting architecture (PRD #7 relevance), and syndication controls. |

## Findings

### About Page Editing via API — Confirmed Possible

The `microblog.editPage` XML-RPC method can update any page's content, including template pages like About. The method signature is:

```text
microblog.editPage(pageID, username, password, { title, description, is_navigation })
```

The `description` field contains the page content (or redirect URL for redirect pages). This is already tested and working in our codebase for category navigation pages (`src/update-page-visibility.js`).

**Source says:** Template pages have `is_template: true` flag in `microblog.getPages` response.
([XML-RPC API docs](https://help.micro.blog/t/micro-blog-xml-rpc-api/108))

**Interpretation:** The About page should be editable via `editPage` the same way we edit category pages — but since it's a template page, the final rendering depends on the Hugo theme template, not just the raw `description` content. The About page's page ID can be discovered via `microblog.getPages`.

**Risk for PRD #2:** The About page uses a Hugo template for rendering. Editing the `description` field updates the raw content, but the visual result depends on how the theme renders that content. We should test this on a non-critical page first. 🟡 Medium confidence — API method is verified, but template page behavior with content edits is untested.

### Micropub Also Supports Pages

Pages can be created via Micropub with `"mp-channel": ["pages"]` in the JSON payload. The `mp-navigation` boolean (at root level, not inside properties) controls navigation visibility.

**Source says:** "Pages are created via Micropub by specifying `mp-channel: pages` in requests."
([Endpoint for creating Pages](https://help.micro.blog/t/endpoint-for-creating-pages/2234))

**Interpretation:** Micropub provides an alternative to XML-RPC for page management, but the XML-RPC `editPage` method is better documented and already battle-tested in our codebase. Stick with XML-RPC for PRD #2. 🟢 High confidence.

### Cross-Posting Architecture — Feed-Based, Not API-Triggered

Micro.blog cross-posting works by monitoring the blog's RSS/JSON feed, not by responding to Micropub API calls. This is a fundamental architectural distinction.

**Source says:** "Micro.blog processes posts from RSS/JSON feeds and automatically distributes them to connected platforms."
([Cross-posting docs](https://book.micro.blog/cross-posting/))

**Implications:**
- Cross-posting timing depends on feed polling interval, not post creation
- No API parameter exists to control which platforms receive a specific post
- Per-category filtering is possible only via category-specific feeds (`/categories/name/feed.xml`)
- There is no per-post cross-posting toggle in any API

🟢 High confidence — verified against official docs and book.

### Current Cross-Posting Platforms (as of January 2026)

9 platforms: Medium, Mastodon, LinkedIn, Tumblr, Flickr, Bluesky, Nostr, Pixelfed, Threads.

**Source says:** "We had to remove Twitter support after Twitter changed their API in 2023."
([Automatic cross-posting docs](https://help.micro.blog/t/automatic-cross-posting-to-mastodon-and-other-services/860))

**Notable limitations:**
- LinkedIn: Image cross-posting reportedly planned but not implemented (per Manton, December 2025)
- Medium: Settings are global — all posts go to Medium, no category filtering
- Category-based filtering: Only works via custom feed URLs, not reliable for selective cross-posting

🟢 High confidence.

### POSSE vs. Direct Posting — Architecture Divergence

The original POSSE vision (PRD #7) was: Micro.blog as hub → cross-posts to all platforms.

The current architecture (after PRD #22, completed April 2026) is: Google Sheets as hub → direct API posting to each platform independently.

| Aspect | POSSE (PRD #7 vision) | Current (PRD #22 reality) |
|--------|----------------------|--------------------------|
| Source of truth | Micro.blog | Google Sheets |
| Post to LinkedIn | Micro.blog cross-post | Direct API (post-linkedin.js) |
| Post to Bluesky | Micro.blog cross-post | Direct API (post-bluesky.js) |
| Post to Mastodon | Native ActivityPub federation | Direct API (post-mastodon.js) |
| Post to Micro.blog | Primary publish point | Direct API (sync-content.js) |
| Per-post control | None (feed-based) | Full (per-post, per-platform) |
| Image on LinkedIn | Not supported | Full control |
| Social-only posts | Not possible | Supported via Social Posts Queue |

**Interpretation:** The direct-posting architecture (PRD #22) has superseded the POSSE cross-posting model for social content. The spreadsheet provides more control than Micro.blog's feed-based cross-posting ever could. The remaining value from PRD #7 is the fediverse migration (Hachyderm → `@whitney@whitneylee.com`), which is independent of the POSSE architecture question. 🟢 High confidence.

### Page Customization Limitations

The Micro.blog creator acknowledged that page customization is a known limitation.

**Source says:** "This is confusing and I think Micro.blog needs some tweaks to make standalone pages work better, like extra post types."
([Customizing Pages discussion](https://help.micro.blog/t/customizing-pages-understanding-how-pages-work-on-micro-blog/516))

**Implication for PRD #2:** Complex dynamic about page layouts may be difficult to achieve purely through the API. The `description` field edit may be sufficient for content updates, but rich layout control (grids, featured sections) would require theme template changes in addition to API content updates. 🟡 Medium confidence.

## Recommendation

### For PRD #2 (Dynamic About Page)
The API supports editing the About page via `microblog.editPage`. The approach should be:
1. Discover the About page's page ID via `microblog.getPages` (look for `is_template: true` page with title "About")
2. Use `microblog.editPage` to update the `description` field with generated Markdown content
3. Test on a non-critical page first to verify how template pages render edited content

The PRD's approach is viable but should be simplified: generate Markdown content and push it via XML-RPC, rather than building a complex template system.

### For PRD #7 (POSSE)
The POSSE cross-posting architecture has been superseded by PRD #22's direct posting. Recommend:
- Extract the fediverse migration (Milestone 2) as a standalone issue
- Close PRD #7 as superseded — the goal of "manage once, post everywhere" is achieved through the spreadsheet + direct API approach, which is more flexible than Micro.blog's feed-based cross-posting

## Sources
- [Micro.blog XML-RPC API](https://help.micro.blog/t/micro-blog-xml-rpc-api/108) — method list, page management
- [Endpoint for creating Pages](https://help.micro.blog/t/endpoint-for-creating-pages/2234) — Micropub page creation, mp-channel
- [Customizing Pages](https://help.micro.blog/t/customizing-pages-understanding-how-pages-work-on-micro-blog/516) — template page limitations
- [Posting API (Micropub)](https://help.micro.blog/t/posting-api/96) — core Micropub capabilities
- [Cross-posting book chapter](https://book.micro.blog/cross-posting/) — feed-based architecture, platform rules
- [Automatic cross-posting docs](https://help.micro.blog/t/automatic-cross-posting-to-mastodon-and-other-services/860) — current platform list (9 platforms)
- [Syndication links](https://help.micro.blog/t/syndication-links/3687) — front matter syndication support
- [API overview](https://help.micro.blog/t/api-overview/93) — API landscape overview
