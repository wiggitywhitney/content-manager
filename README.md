# Content Manager

Automated content publishing system that syncs a Google Sheets content tracking spreadsheet with Micro.blog.

## Overview

This system automatically posts content (podcasts, videos, blog posts, presentations, and guest appearances) from a Google Sheets spreadsheet to the appropriate categories on whitneylee.com (powered by Micro.blog).

**Key Features:**
- ✅ Full CRUD operations (create, update, delete posts)
- ✅ Automatic URL regeneration for SEO-friendly slugs
- ✅ Hourly sync via GitHub Actions
- ✅ Smart error handling with retry logic
- ✅ Spreadsheet as single source of truth

## How It Works

1. Add/edit content in Google Sheets (Name, Type, Show, Date, Link)
2. System syncs hourly via GitHub Actions
3. Posts automatically appear on whitneylee.com in the correct category
4. Column H tracks Micro.blog URLs for update/delete operations

## Content Categories

- **Podcast** → `/categories/Podcast/`
- **Video** → `/categories/Video/`
- **Blog** → `/categories/Blog/`
- **Presentations** → `/categories/Presentations/`
- **Guest** → `/categories/Guest/`

## Setup

### Prerequisites
- Node.js 18+
- Google Cloud service account with Sheets API access
- Micro.blog app token
- [Teller](https://github.com/tellerops/teller) for local secret management

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Configure secrets in Google Secret Manager:
   - `content_manager_service_account` - Google service account JSON
   - `microblog-content-manager` - Micro.blog app token

3. Run sync locally:
```bash
npm run sync
```

### GitHub Actions

The sync runs automatically every hour via `.github/workflows/sync-content.yml`.

Secrets configured:
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `MICROBLOG_APP_TOKEN`

## Architecture

```
Google Sheets ←→ GitHub Actions ←→ Micro.blog
                       ↓
                  Column H (URL tracking)
```

**Sync Flow:**
1. Read spreadsheet data (Columns A-H)
2. Create posts for rows with empty Column H
3. Regenerate posts with non-title URLs (timestamps/hashes)
4. Update posts with content changes
5. Delete orphaned posts not in spreadsheet

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
│   └── sync-content.js       # Main sync logic
├── docs/
│   └── microblog-api-capabilities.md      # API research
├── .github/workflows/
│   └── sync-content.yml      # Hourly sync automation
└── .teller.yml               # Local secret configuration
```

## License

ISC
