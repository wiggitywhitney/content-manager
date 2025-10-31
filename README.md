# Content Manager

Automated content publishing system that syncs a Google Sheets content tracking spreadsheet with Micro.blog.

## Overview

This system automatically posts content (podcasts, videos, blog posts, presentations, and guest appearances) from a Google Sheets spreadsheet to the appropriate categories on whitneylee.com (powered by Micro.blog).

**Key Features:**
- ✅ Full CRUD operations (create, update, delete posts)
- ✅ Automatic URL regeneration for SEO-friendly slugs
- ✅ Daily content sync via GitHub Actions (16:15 UTC = 11:15 am CDT / 10:15 am CST)
- ✅ Daily page visibility management (6-month inactivity threshold)
- ✅ Rate-limited publishing (max 1 post/day across Micro.blog + Bluesky)
- ✅ Smart error handling with retry logic
- ✅ Spreadsheet as single source of truth
- ✅ 96% API efficiency improvement (120→5 calls/day for visibility)

## How It Works

### Content Sync (Daily)
1. Add/edit content in Google Sheets (Name, Type, Show, Date, Link)
2. System syncs daily at 16:15 UTC (11:15 am CDT / 10:15 am CST) via GitHub Actions
3. Rate limiting: max 1 post per day across all platforms
4. Before posting, checks Micro.blog and Bluesky for posts published today
5. Posts automatically appear on whitneylee.com in the correct category
6. Column H tracks Micro.blog URLs for update/delete operations

### Page Visibility (Daily)
1. System runs alongside content sync
2. Checks category activity and calculates inactivity
3. Categories inactive for 6+ months are automatically hidden from navigation
4. Categories become visible again when new content is added
5. Keeps site navigation clean without manual intervention

## Content Categories

- **Podcast** → `/podcast/`
- **Video** → `/video/`
- **Blog** → `/blog/`
- **Presentations** → `/presentations/`
- **Guest** → `/guest/`

## Setup

### Prerequisites
- Node.js 22 (Active LTS)
- Google Cloud service account with Sheets API access
- Micro.blog app token (Micropub API)
- Micro.blog XML-RPC token (for page management)
- [Teller](https://github.com/tellerops/teller) for local secret management

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Configure secrets in Google Secret Manager:
   - `content_manager_service_account` - Google service account JSON
   - `microblog-content-manager` - Micro.blog app token
   - `microblog-xmlrpc-token` - Micro.blog XML-RPC token

3. Run sync locally:
```bash
npm run sync
```

### GitHub Actions

Automated workflow runs via GitHub Actions:

**Daily Sync** (`.github/workflows/daily-sync.yml`):
- Runs daily at 16:15 UTC (11:15 am CDT / 10:15 am CST)
- Syncs spreadsheet content to Micro.blog posts with rate limiting
- Manages category page visibility based on activity

Required secrets:
- `GOOGLE_SERVICE_ACCOUNT_JSON` - Google service account JSON
- `MICROBLOG_APP_TOKEN` - Micro.blog Micropub API token
- `MICROBLOG_XMLRPC_TOKEN` - Micro.blog XML-RPC token
- `MICROBLOG_USERNAME` - Micro.blog username
- `BLUESKY_HANDLE` - Bluesky handle (for daily publish guard)
- `BLUESKY_PASSWORD` - Bluesky password (for daily publish guard)

## Architecture

```
Google Sheets ←→ GitHub Actions ←→ Micro.blog
                       ↓
                  Column H (URL tracking)
```

**Content Sync Flow:**
1. Read spreadsheet data (Columns A-H)
2. Create posts for rows with empty Column H
3. Regenerate posts with non-title URLs (timestamps/hashes)
4. Update posts with content changes
5. Delete orphaned posts not in spreadsheet

**Page Visibility Flow:**
1. Read spreadsheet data to calculate category activity
2. Identify categories inactive for 6+ months
3. Update page visibility via XML-RPC API (5 pages)
4. Hide inactive categories, show active ones

## Post Format

```markdown
Show Name: [Title](URL)
```

Example:
```markdown
Software Defined Interviews: [Learning to learn, with Sasha Czarkowski](https://www.softwaredefinedinterviews.com/91)
```

## Spreadsheet Workflow

**Edit these columns** - changes auto-update on next sync:
- Column A: Name (title)
- Column B: Type (category)
- Column C: Show
- Column D: Date
- Column E: Link
- Column F: Confirmed (keynote)

**⚠️ Never edit Column H (Micro.blog URL)** - This is auto-managed by the system.

When you change Date, Name, Show, or Keynote: The old post is deleted and a new one is created with a new URL (Column H updates automatically).

## URL Regeneration

Posts with timestamp URLs (e.g., `/130000.html`) or hex hashes (e.g., `/8e237a.html`) are automatically regenerated with content-based slugs during daily sync.

## Project Structure

```text
content-manager/
├── src/
│   ├── sync-content.js              # Daily content sync with rate limiting
│   ├── update-page-visibility.js    # Page visibility management
│   └── config/
│       └── category-pages.js        # Page configuration
├── docs/
│   └── microblog-api-capabilities.md      # API research
├── .github/workflows/
│   └── daily-sync.yml               # Daily sync & visibility automation (combined)
├── prds/                            # Project requirement documents
│   └── 8-rate-limited-publishing.md # Rate limiting specification
└── .teller.yml                      # Local secret configuration
```

## License

ISC
