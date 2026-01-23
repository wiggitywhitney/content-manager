# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Content manager for Whitney Lee's content publishing workflow. Syncs content from a Google Sheet to Micro.blog, which then cross-posts to Bluesky and other platforms.

## Key Spreadsheets

| Spreadsheet | ID | Purpose |
|-------------|-----|---------|
| **Live Production** | `1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs` | Syncs to whitneylee.com via daily GitHub Action |
| **Staged** | `1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts` | Staging area for new content before going live |

Service account email: `content-manager-sheets@demoo-ooclock.iam.gserviceaccount.com`

## Content Sources to Monitor

1. **YouTube - wiggitywhitney channel** (`UCaGYZkSCN3MPwqRpt24KBKA`)
   - 🌩️ Thunder playlist: `PLBexUsYDijawXI7x707H1YDdNT2vi98e_` (short-form edited videos)
   - ⚡️ Enlightning playlist: `PLBexUsYDijaz09nH8BVPmPio_16V115i4` (full-length livestreams)

2. **Software Defined Interviews** - https://www.softwaredefinedinterviews.com/
   - Podcast episodes hosted by Whitney

## Scanning for New Content

When the user asks to scan for new content or update the staged spreadsheet:

### Option 1: Run the script
```bash
GOOGLE_SERVICE_ACCOUNT_JSON=$(gcloud secrets versions access latest --secret=content_manager_service_account --project=demoo-ooclock) node src/scan-new-content.js
```

Add `--dry-run` to preview without making changes.

### Option 2: Manual scan (if script has issues)

1. **Check YouTube Thunder playlist** using MCP tools:
   ```
   mcp__youtube__getPlaylistVideos with playlistId: PLBexUsYDijawXI7x707H1YDdNT2vi98e_
   ```

2. **Check SDI website** using WebFetch:
   ```
   WebFetch https://www.softwaredefinedinterviews.com/ - extract episode numbers, titles, dates
   ```

3. **Read staged spreadsheet** to see what's already there:
   ```javascript
   // Use gcloud to get credentials, then read spreadsheet
   GOOGLE_SERVICE_ACCOUNT_JSON=$(gcloud secrets versions access latest --secret=content_manager_service_account --project=demoo-ooclock) node -e '...'
   ```

4. **Add missing items** to the staged spreadsheet (service account has Editor access)

### Spreadsheet Row Format

| Column | Field | Example |
|--------|-------|---------|
| A | Name | Making GenAI Observable with OpenTelemetry |
| B | Type | Video, Podcast, Guest, Presentation, Blog |
| C | Show | 🌩️ Thunder, Software Defined Interviews, etc. |
| D | Date | 01/15/2026 (MM/DD/YYYY) |
| E | Location | (optional) |
| F | Confirmed | KEYNOTE (if applicable) |
| G | Link | https://youtu.be/RNaa_48LWBY |

### URL Formats
- YouTube: `https://youtu.be/{videoId}` (short form preferred)
- SDI: `https://www.softwaredefinedinterviews.com/{episodeNumber}`

## Development Setup

Get credentials for local development:
```bash
gcloud secrets versions access latest --secret=content_manager_service_account --project=demoo-ooclock
```

## Code Guidelines
- No references to PRDs, milestones, task management systems, commit hashes, or commit messages in code comments or documentation files
- Commit messages themselves can reference PRDs/milestones