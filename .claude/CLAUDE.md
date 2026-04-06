# Content Manager

Content manager for Whitney Lee's content publishing workflow. Syncs content from a Google Sheet to Micro.blog, which then cross-posts to Bluesky and other platforms.

## Key Spreadsheets

| Spreadsheet | ID | Purpose |
|-------------|-----|---------|
| **Live Production** | `1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs` | Syncs to whitneylee.com via daily GitHub Action |
| **Staged** | `1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts` | Staging area for new content before going live |
| **Social Posts Queue** | (stored as `SOCIAL_POSTS_SHEET_ID` secret) | Pending social posts for LinkedIn, Bluesky, Mastodon — run `src/create-social-posts-sheet.js` to provision |

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
vals exec -f .vals.yaml -- node src/scan-new-content.js
```

Add `--dry-run` to preview without making changes.

### Option 2: Manual scan (if script has issues)

1. **Check YouTube Thunder playlist** using MCP tools:
   ```text
   mcp__youtube__getPlaylistVideos with playlistId: PLBexUsYDijawXI7x707H1YDdNT2vi98e_
   ```

2. **Check SDI website** using WebFetch:
   ```text
   WebFetch https://www.softwaredefinedinterviews.com/ - extract episode numbers, titles, dates
   ```

3. **Read staged spreadsheet** to see what's already there:
   ```bash
   vals exec -f .vals.yaml -- node -e '...'
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

Run any script with secrets injected:
```bash
vals exec -f .vals.yaml -- node src/<script>.js
```

Or use the npm scripts (they wrap `vals exec` automatically):
```bash
npm run sync:test     # dry-run sync
npm run check-posts   # check Micro.blog post state
```

## Secrets Management

Secrets are stored in Google Secret Manager (project: `demoo-ooclock`) and injected locally via [vals](https://github.com/helmfile/vals). Install: `brew install helmfile/tap/vals`.

### Secrets currently in GSM

| GSM secret name | Env var | Used by |
|---|---|---|
| `content_manager_service_account` | `GOOGLE_SERVICE_ACCOUNT_JSON` | all scripts |
| `microblog-content-manager` | `MICROBLOG_APP_TOKEN` | sync-content.js |
| `marsedit_token` | `MICROBLOG_XMLRPC_TOKEN` | sync-content.js, update-page-visibility.js |
| `bluesky_password` | `BLUESKY_PASSWORD` | sync-content.js (cross-post check) |
| `LinkedIn_Client_ID` | `LINKEDIN_CLIENT_ID` | linkedin-oauth-setup.js |
| `LinkedIn_Client_Secret` | `LINKEDIN_CLIENT_SECRET` | linkedin-oauth-setup.js |

### Secrets that still need to be created in GSM

Run `linkedin-oauth-setup.js` to auto-create the LinkedIn tokens. Create the others manually:

```bash
# Bluesky handle (e.g. wiggitywhitney.bsky.social)
echo -n "YOUR_BLUESKY_HANDLE" | gcloud secrets create bluesky_handle \
  --data-file=- --replication-policy=automatic --project=demoo-ooclock

# Bluesky app password for direct posting (Settings > App Passwords in Bluesky)
echo -n "YOUR_APP_PASSWORD" | gcloud secrets create bluesky_app_password \
  --data-file=- --replication-policy=automatic --project=demoo-ooclock

# Mastodon access token (from your instance's Settings > Development)
echo -n "YOUR_MASTODON_TOKEN" | gcloud secrets create mastodon_access_token \
  --data-file=- --replication-policy=automatic --project=demoo-ooclock

# Mastodon instance URL (e.g. https://hachyderm.io)
echo -n "YOUR_INSTANCE_URL" | gcloud secrets create mastodon_instance_url \
  --data-file=- --replication-policy=automatic --project=demoo-ooclock

# Social posts sheet ID (the Google Sheet ID for the social posts queue)
echo -n "YOUR_SHEET_ID" | gcloud secrets create social_posts_sheet_id \
  --data-file=- --replication-policy=automatic --project=demoo-ooclock
```

After creating each secret, uncomment its entry in `.vals.yaml`.

## Library Gotchas

- masto.js: @.claude/rules/masto-js-gotchas.md
- LinkedIn REST API: @.claude/rules/linkedin-api-gotchas.md

<!-- Code guidelines (no PRD references) and git workflow enforced globally via ~/.claude/CLAUDE.md -->
