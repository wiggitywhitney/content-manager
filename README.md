# Content Manager

Automated content publishing system that syncs a Google Sheets content tracking spreadsheet with Micro.blog.

## Overview

This system automatically posts content (podcasts, videos, blog posts, presentations, and guest appearances) from a Google Sheets spreadsheet to the appropriate categories on whitneylee.com (powered by Micro.blog).

**Key Features:**
- ✅ Full CRUD operations (create, update, delete posts)
- ✅ Automatic URL regeneration for SEO-friendly slugs
- ✅ Hourly content sync via GitHub Actions
- ✅ Daily automatic page visibility management (6-month inactivity threshold)
- ✅ Smart error handling with retry logic
- ✅ Spreadsheet as single source of truth
- ✅ 96% API efficiency improvement (120→5 calls/day for visibility)

## How It Works

### Content Sync (Hourly)
1. Add/edit content in Google Sheets (Name, Type, Show, Date, Link)
2. System syncs hourly via GitHub Actions
3. Posts automatically appear on whitneylee.com in the correct category
4. Column H tracks Micro.blog URLs for update/delete operations

### Page Visibility (Daily)
1. System checks category activity daily at 3 AM UTC
2. Categories inactive for 6+ months are automatically hidden from navigation
3. Categories become visible again when new content is added
4. Keeps site navigation clean without manual intervention

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

Two automated workflows run via GitHub Actions:

**Content Sync** (`.github/workflows/sync-content.yml`):
- Runs every hour
- Syncs spreadsheet content to Micro.blog posts

**Page Visibility** (`.github/workflows/update-page-visibility.yml`):
- Runs daily at 3 AM UTC
- Manages category page visibility based on activity

Required secrets:
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `MICROBLOG_APP_TOKEN`
- `MICROBLOG_XMLRPC_TOKEN`
- `MICROBLOG_USERNAME`

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

## URL Regeneration

The system automatically detects and regenerates posts with poor URL slugs:
- **Timestamp URLs** (e.g., `/130000.html`) → Regenerated
- **Short hex hashes** (e.g., `/8e237a.html`) → Regenerated
- **Content-based slugs** (e.g., `/software-defined-interviews-learning-to.html`) → Kept

Regeneration happens during hourly sync with natural retry for edge cases.

## Project Structure

```
content-manager/
├── src/
│   ├── sync-content.js              # Hourly content sync
│   ├── update-page-visibility.js    # Daily page visibility management
│   └── config/
│       └── category-pages.js        # Page configuration
├── docs/
│   └── microblog-api-capabilities.md      # API research
├── .github/workflows/
│   ├── sync-content.yml             # Hourly sync automation
│   └── update-page-visibility.yml   # Daily visibility automation
└── .teller.yml                      # Local secret configuration
```

## License

ISC
