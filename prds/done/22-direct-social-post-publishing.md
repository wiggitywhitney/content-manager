# PRD #22: Direct Social Post Publishing for Shows

**Issue**: [#22](https://github.com/wiggitywhitney/content-manager/issues/22)
**Status**: Complete
**Priority**: High
**Created**: 2026-04-04

---

## Problem Statement

Whitney produces two types of social posts per show episode:
1. An episode announcement post (longer, goes out when the episode is live)
2. Four shorts posts (one per short, spread out over time)

These posts currently require manual work across LinkedIn, Bluesky, and Mastodon. The existing content-manager system only posts to Micro.blog, with Mastodon and Bluesky handled via Micro.blog's auto-syndication feature — which provides no control over post text, timing, or platform selection. LinkedIn is not supported at all.

The result is a growing backlog of unposted social content and a manual process that doesn't scale.

## Solution Overview

Extend content-manager to post social content directly to LinkedIn, Bluesky, and Mastodon using a new Google Sheet as the social posts queue. The existing daily GitHub Actions cron reads the queue and fires any posts due today. A separate `/write-social-posts` skill (built in the journal repo, outside this PRD) handles content creation and approval, and writes approved posts to this spreadsheet.

**What this PRD covers**: mechanical posting — reading the queue and publishing.
**What this PRD does not cover**: writing post content (handled by the skill).

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Queue location | "Social Posts Queue" tab in the staged spreadsheet (`STAGED_Content_Created`) — not a separate Google Sheet | Original concern was mixing social posts with career signal rows. A dedicated tab in the staged sheet provides sufficient separation while keeping all operational sheets together. `SOCIAL_POSTS_SHEET_ID` secret is no longer needed. *(Updated 2026-04-06 from original "separate sheet" decision)* |
| Secrets management | vals (`helmfile/vals`) injecting from Google Secret Manager | Teller was retired project-wide. vals uses the same GSM backend with a simpler config format. *(Updated 2026-04-06; previously Teller)* |
| Scheduler cadence | Weekdays only until social posts start flowing from `/write-social-posts` (PRD #24); switch to 7 days/week when that skill is implemented — update `daily-sync.yml` cron from `* * 1-5` to `* * *` at that time | Social posts will target daily cadence including weekends; no posts to skip until the queue is populated |
| Scheduler | Existing daily GitHub Actions cron | Already runs weekdays; no new infrastructure (no Hetzner, no 15-minute cron) |
| Bluesky posting | Direct via `@atproto/api`, not via Micro.blog syndication | Bluesky was never connected to Micro.blog auto-syndication — no action needed to disable it |
| Mastodon posting | Direct via `masto.js` with `write:statuses` scope only | Only scope needed for posting; server-side `scheduled_at` available if needed |
| Mastodon instance | `https://hachyderm.io/` | Whitney's Mastodon instance *(confirmed 2026-04-06)* |
| LinkedIn posting | Direct via LinkedIn REST API (`w_member_social` scope — self-service, no approval required) | 60-day access tokens; refresh tokens require partner approval — re-run `linkedin-oauth-setup.js` manually before day 60 |
| micro.blog | Video upload only (not link posts); conditional on view count > 1000 | Whitney only wants to post there if the actual video can be uploaded; link posts are noise |
| micro.blog gate | API video upload confirmed working *(2026-04-07)*: `https://micro.blog/micropub/media` returns 202 with URL | Media endpoint declared in Micropub config; upload returns `{"url":"...","poster":""}` |
| micro.blog triggering | **Independent view-count scan — not driven by the `platforms` column** *(2026-04-07)*: daily cron scans the last 10 `short` rows in the spreadsheet, checks YouTube view count for each, posts to micro.blog if count > 1000 and Column M is empty | The platforms column drives LinkedIn/Bluesky/Mastodon. micro.blog posting is a separate, automated "crossed threshold" event. `microblogPostUrl` (Column M) serves as the idempotency guard — populated means already posted, empty means eligible. Depth limit of 10 rows prevents runaway API calls; shorts outside that window that cross 1000 views are acceptable losses. |
| Mastodon/Bluesky re-syndication from Micro.blog | Re-enable after all test posts are complete *(2026-04-07)*: Whitney will turn on Mastodon and Bluesky forwarding in Micro.blog account settings once Milestone 6 is verified | Popular Shorts will be double-posted to Bluesky/Mastodon (once directly from this system, once forwarded by Micro.blog). Accepted trade-off: enables personal Micro.blog posts to auto-forward, which is the primary motivation for re-enabling. |
| Post style | Minimal: one sentence/phrase from the video, tag person + technology | Quantity over quality; don't over-engineer the text |

## Open Design Questions

### Career Content / Social Post Coordination

`sync-content.js` uses a **daily publish guard** that checks Bluesky for any post from today before deciding whether to post career content to Micro.blog (max 1 post/day). This creates a coupling risk: if a social post reaches Bluesky before the career sync runs, the career content post will be suppressed for that day.

**Current mitigation**: the GitHub Actions workflow runs career sync first (step 1), social posting second (step 2). Sequential ordering prevents the conflict in normal operation.

**Not yet solved**: what happens when both post on the same day and someone triggers the social step manually, or when the order changes? Options to evaluate at implementation time:
- Update the daily publish guard to distinguish career content posts from social queue posts (fragile)
- Move the two posting jobs into separate GitHub Actions workflows on independent schedules
- Leave one social post slot empty per week to give the career sync room
- Redesign the daily publish guard to check Micro.blog directly rather than using Bluesky as a proxy

**Tracked in**: [#23](https://github.com/wiggitywhitney/content-manager/issues/23) — must be resolved before switching the cron to 7 days/week (which happens when PRD #24 is implemented).

---

## Social Posts Spreadsheet Schema

"Social Posts Queue" tab in the staged spreadsheet (`STAGED_Content_Created`, ID: `1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts`). Columns:

| Column | Field | Notes |
|---|---|---|
| A | Show | Thunder, Datadog Illuminated, SDI, etc. |
| B | Episode/Short Title | Human-readable reference |
| C | Post Type | `episode` or `short` |
| D | Post Text | Final approved text, ready to post |
| E | YouTube URL | Full YouTube URL for the episode or short |
| F | Alt Text | For image/thumbnail; skill drafts this, no approval required |
| G | Scheduled Date | YYYY-MM-DD; cron posts on this date |
| H | Platforms | Comma-separated: `linkedin,bluesky,mastodon` |
| I | Status | `pending`, `posted`, `failed` |
| J | LinkedIn Post URL | Auto-populated after posting |
| K | Bluesky Post URL | Auto-populated after posting |
| L | Mastodon Post URL | Auto-populated after posting |
| M | micro.blog Post URL | Auto-populated after posting |

### Media Handling at Post Time

The cron resolves media from the YouTube URL at post time — nothing is pre-downloaded into the spreadsheet:

- **Episode announcement** (`post type: episode`): fetch thumbnail from `https://img.youtube.com/vi/{videoId}/maxresdefault.jpg` → upload to platform as image with alt text → create post
- **Shorts post** (`post type: short`): download video via `yt-dlp` → upload natively to platform → create post

All four platforms accept alt text: Bluesky (`alt` on image blob), Mastodon (`description` on media upload), LinkedIn (`altText` on image upload), micro.blog (Micropub `mp-photo` `alt` property).

## Human Review Philosophy

Whitney is very opinionated about how she is portrayed publicly. **The approval gate is in the creation process, not the posting pipeline.** The `/write-social-posts` skill (upstream) handles drafting and approval; once a post lands in this spreadsheet with a scheduled date, it posts automatically.

However, each new platform integration should include a manual review checkpoint during development: before enabling live posting, Whitney reviews real test posts on each platform to confirm they look right. This review is a milestone exit criterion, not a runtime mechanism. The goal is full automation with confidence, not automation with fingers crossed.

## Pre-Launch Requirement

~~**Disable Micro.blog's auto-syndication to Mastodon and Bluesky**~~ **Completed 2026-04-06.** Bluesky was never connected to Micro.blog. Mastodon syndication was disabled. No duplicate risk.

---

## Milestones

### Milestone 1: Social Posts Spreadsheet
- [x] Create new Google Sheet with schema above
- [x] Add spreadsheet ID to content-manager config/secrets
- [x] Verify cron can read from new sheet alongside existing sheet

**Success criteria**: Running the sync locally reads both the existing career sheet and the new social posts sheet without errors.

> **Note (2026-04-06):** Queue location changed from separate sheet to a "Social Posts Queue" tab in the staged spreadsheet. Implementation migration tracked in Milestone 5.

---

### Milestone 2: Bluesky Direct Posting
- [x] Add `@atproto/api` dependency
- [x] Implement Bluesky posting using app password auth (`createSession` flow)
- [x] Extend daily cron to find rows in social sheet where `scheduled_date == today` and `platforms` includes `bluesky` and `status == pending`
- [x] Post to Bluesky, write post URL to Column K, update status to `posted`
- [x] Handle failures gracefully — write `failed` to status, log error, do not crash the cron

**Success criteria**: A row scheduled for today with platform `bluesky` gets posted and Column K is populated. Whitney reviews the live post and confirms it looks correct before this milestone is marked complete.

---

### Milestone 3: Mastodon Direct Posting
- [x] Add `masto.js` dependency
- [x] Implement Mastodon posting
- [x] Wire into daily cron (same pattern as Bluesky milestone)
- [x] Post URL written to Column L, status updated

**Success criteria**: A row scheduled for today with platform `mastodon` gets posted and Column L is populated. Whitney reviews the live post and confirms it looks correct before this milestone is marked complete.

---

### Milestone 4: LinkedIn Posting + Token Management
- [x] Register LinkedIn app, add "Share on LinkedIn" product (`w_member_social` scope — self-service)
- [x] Implement OAuth 2.0 authorization code flow for initial token acquisition (`src/linkedin-oauth-setup.js`)
- [x] Store access token securely (Google Secret Manager — access token, expiry timestamp, person URN; no refresh token: requires LinkedIn partner approval not available to self-serve apps)
- [x] Implement pre-flight token expiry check: warns 7 days before expiry; auto-refresh not implemented (refresh tokens require Community Management API partner approval — re-run `src/linkedin-oauth-setup.js` manually before day 60)
- [x] Implement LinkedIn posting via `POST https://api.linkedin.com/rest/posts` with required headers (`Linkedin-Version: YYYYMM`, `X-Restli-Protocol-Version: 2.0.0`)
- [x] Wire into daily cron, write post URL to Column J (PRD had typo "Column I"), update status

**Success criteria**: A row scheduled for today with platform `linkedin` gets posted and Column J is populated. Whitney reviews the live post and confirms it looks correct before this milestone is marked complete. *(Run `vals exec -f .vals.yaml -- node src/linkedin-oauth-setup.js` first to authorize and store tokens.)*

---

### Milestone 5: Pre-Launch — Disable Micro.blog Auto-Syndication
- [x] Turn off Micro.blog's auto-syndication to Mastodon and Bluesky in account settings
- [x] Confirm existing Micro.blog website content posting (whitneylee.com) is unaffected
- [x] Migrate social posts queue from separate sheet to "Social Posts Queue" tab in staged spreadsheet
- [x] Update `social-posts-queue.js` and `update-social-post-status.js` to use staged sheet ID + tab name
- [x] Uncomment social secrets in `.vals.yaml` and verify with `npm run check-secrets`
- [x] Add "Instructions" tab to staged spreadsheet with full schema documentation
- [x] Update journal PRD #24 Milestone 2 with exact spreadsheet schema, column mapping, and platform guidance so /write-social-posts skill can write rows correctly
- [x] Verify no duplicate posts occur by running a test post through the new system (`src/add-social-test-row.js`)

**Success criteria**: A test post goes to Bluesky and Mastodon exactly once, via the new direct posting system. No duplicates. Journal PRD #24 M2 contains sufficient schema detail to implement the commit phase without referencing this codebase.

---

### Milestone 6: micro.blog Video Upload

- [x] Test micro.blog Micropub media endpoint for video upload — confirmed working *(2026-04-07)*: `https://micro.blog/micropub/media` accepts video uploads, returns 202 with `{"url":"...","poster":""}`. Media endpoint declared in Micropub `?q=config` response.
- [x] YouTube Data API v3 access confirmed *(2026-04-07)*: existing service account (`GOOGLE_SERVICE_ACCOUNT_JSON`) works with `youtube.readonly` scope — no separate API key needed. YouTube Data API v3 already enabled in GCP project `demoo-ooclock`.
- [x] Create `src/post-microblog.js`: view-count scan (last 10 `short` rows in spreadsheet → YouTube API check → skip if < 1000 views or Column M already populated → download via yt-dlp → upload to Micropub media endpoint → create post with `video[]` property → write URL to Column M)
- [x] Add `AnimMouse/setup-yt-dlp@v3` step to `daily-sync.yml` and wire `MICROBLOG_APP_TOKEN` into the "Post social content" step
- [x] Write tests for `post-microblog.js` (view count gate, skip-if-already-posted, upload flow, Micropub post creation); 111 tests passing
- [x] Run a live test post to micro.blog and verify the video renders correctly *(2026-04-07: "What is Prometheus in 30 Seconds!" posted to https://whitneylee.com/2026/04/07/prometheus-in-seconds-that-is.html — video plays correctly)*
- [x] Turn on Mastodon and Bluesky forwarding in Micro.blog account settings *(2026-04-07: both active — Bluesky via whitneylee.com feed, Mastodon via @wiggitywhitney@hachyderm.io)*

**Success criteria**: A short row in the spreadsheet with > 1000 YouTube views gets video downloaded, uploaded to micro.blog, and Column M populated. A short with < 1000 views is skipped. Running the cron a second time does not re-post (Column M guard works). Turn on Mastodon and Bluesky forwarding in Micro.blog account settings once all test posts are confirmed clean.

---

## Technical Notes

### Video Download (Shorts)

Use `yt-dlp` binary via `child_process.execFile` shell-out from Node.js. Do not use pure Node.js libraries — `ytdl-core` is abandoned (July 2023), `@distube/ytdl-core` is archived (August 2025), and `youtubei.js` requires building your own JavaScript challenge solver.

**GitHub Actions setup**: use `AnimMouse/setup-yt-dlp@v3` — handles binary install, FFmpeg, and the JS runtime requirement (yt-dlp requires Node v20+ or Deno since November 2025; the Action configures this automatically).

**Recommended format selector**:
```bash
yt-dlp \
  --format "bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/best[ext=mp4]/best" \
  --merge-output-format mp4 \
  --extractor-args "youtube:player-client=default,mweb" \
  --js-runtimes node \
  -o "%(id)s.%(ext)s" \
  <URL>
```

The `mweb` player client workaround addresses YouTube's SABR streaming issue (ongoing cat-and-mouse; keep yt-dlp updated).

**File size**: YouTube Shorts at native quality run ~20–60 MB. Binding constraint is Bluesky at 100 MB — no problem at typical Short lengths.

**Cookie auth in CI**: Test without cookies first for own public content. If needed, export from Firefox locally, store as GitHub Actions secret, rotate every ~2 weeks.

**ToS**: Downloading and re-uploading your own content is a grey area but low practical risk. YouTube's enforcement targets piracy and bulk scraping, not creators cross-posting their own work.

### Platform Libraries
| Platform | Library | Notes |
|---|---|---|
| Bluesky | `@atproto/api` | Official Bluesky TypeScript SDK |
| Mastodon | `masto.js` | v7.10.2, actively maintained |
| LinkedIn | Raw `fetch` | No widely-adopted TS client; REST API is straightforward |
| micro.blog | Raw `fetch` | Micropub is simple HTTP POST |

### LinkedIn Gotchas
- `Linkedin-Version` header is required on every request (format: `YYYYMM`); missing it causes silent failures
- Old `/ugcPosts` API is deprecated; use `POST /api/linkedin.com/rest/posts`
- Person/org tagging syntax: `@[Name](urn:li:person:{id})` — requires LinkedIn URN lookup if tagging guests
- Rate limit: ~100 API calls/day per member (irrelevant at Whitney's posting volume)

### Mastodon Notes
- Token lifetimes vary by instance — test against Whitney's specific instance
- Native `scheduled_at` (ISO 8601, minimum 5 min in future) lets the Mastodon server handle delivery

### Bluesky Notes
- App passwords are deprecated in favor of OAuth (in developer preview); revisit late 2026
- Posting YouTube links auto-generates a link card via OG metadata — no video upload needed

### Secrets
Secrets are managed via vals + Google Secret Manager. See `.vals.yaml` for the full mapping.

| GSM secret | Status | Notes |
|---|---|---|
| `bluesky_handle` | ✅ Created | `whitneylee.com` |
| `bluesky_app_password` | ✅ Created | — |
| `mastodon_access_token` | ✅ Created | hachyderm.io |
| `mastodon_instance_url` | ✅ Created | `https://hachyderm.io/` |
| `linkedin_access_token` | ⏳ Pending | Run `vals exec -f .vals.yaml -- node src/linkedin-oauth-setup.js` |
| `linkedin_token_expires_at` | ⏳ Pending | Created by oauth setup script |
| `linkedin_person_urn` | ⏳ Pending | Created by oauth setup script |
| ~~`SOCIAL_POSTS_SHEET_ID`~~ | N/A | No longer needed — queue is a tab in staged sheet |

---

## Dependencies

- **`/write-social-posts` skill** (journal repo, separate PRD/skill): populates the social posts spreadsheet with approved content and scheduled dates. This system is the consumer; that skill is the producer.
- **Existing `daily-sync.yml`** GitHub Actions workflow: this PRD extends it, does not replace it.
- **Micro.blog auto-syndication disabled** (Milestone 5 prerequisite for full launch).
