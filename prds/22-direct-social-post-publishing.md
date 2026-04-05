# PRD #22: Direct Social Post Publishing for Shows

**Issue**: [#22](https://github.com/wiggitywhitney/content-manager/issues/22)
**Status**: In Progress
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
| Separate spreadsheet | New Google Sheet, separate from existing career tracking sheet | Existing sheet tracks career signal (talks, episodes, guest appearances). Social post queues are operational noise. Mixing them degrades both. |
| Scheduler | Existing daily GitHub Actions cron | Already runs weekdays; no new infrastructure (no Hetzner, no 15-minute cron) |
| Bluesky posting | Direct via `@atproto/api`, not via Micro.blog syndication | Requires turning off Micro.blog auto-syndication before launch |
| Mastodon posting | Direct via `masto.js`; use Mastodon's native `scheduled_at` where useful | Server-side scheduling is cleanest option |
| LinkedIn posting | Direct via LinkedIn REST API (`w_member_social` scope — self-service, no approval required) | 60-day access tokens; 365-day refresh tokens; must build refresh flow |
| micro.blog | Video upload only (not link posts); conditional on view count > 1000 | Whitney only wants to post there if the actual video can be uploaded; link posts are noise |
| micro.blog gate | API video upload must be confirmed working before implementing | Web UI supports it; API support is undocumented — needs hands-on testing first |
| Post style | Minimal: one sentence/phrase from the video, tag person + technology | Quantity over quality; don't over-engineer the text |

## Social Posts Spreadsheet Schema

New Google Sheet (separate document). Columns:

| Column | Field | Notes |
|---|---|---|
| A | Show | Thunder, Datadog Illuminated, SDI, etc. |
| B | Episode/Short Title | Human-readable reference |
| C | Post Type | `episode` or `short` |
| D | Post Text | Final approved text, ready to post |
| E | YouTube URL | Full YouTube URL for the episode or short |
| F | Alt Text | For image/thumbnail; skill drafts this, no approval required |
| G | Scheduled Date | YYYY-MM-DD; cron posts on this date |
| H | Platforms | Comma-separated: `linkedin,bluesky,mastodon,microblog` |
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

**Disable Micro.blog's auto-syndication to Mastodon and Bluesky** before this system goes live. Otherwise every post will be duplicated on both platforms — once via Micro.blog syndication, once via this system's direct posting.

---

## Milestones

### Milestone 1: Social Posts Spreadsheet
- [x] Create new Google Sheet with schema above
- [x] Add spreadsheet ID to content-manager config/secrets
- [x] Verify cron can read from new sheet alongside existing sheet

**Success criteria**: Running the sync locally reads both the existing career sheet and the new social posts sheet without errors.

---

### Milestone 2: Bluesky Direct Posting
- [ ] Add `@atproto/api` dependency
- [ ] Implement Bluesky posting using app password auth (`createSession` flow)
- [ ] Extend daily cron to find rows in social sheet where `scheduled_date == today` and `platforms` includes `bluesky` and `status == pending`
- [ ] Post to Bluesky, write post URL to Column J, update status to `posted`
- [ ] Handle failures gracefully — write `failed` to status, log error, do not crash the cron

**Success criteria**: A row scheduled for today with platform `bluesky` gets posted and Column J is populated. Whitney reviews the live post and confirms it looks correct before this milestone is marked complete.

---

### Milestone 3: Mastodon Direct Posting
- [ ] Add `masto.js` dependency
- [ ] Implement Mastodon posting
- [ ] Wire into daily cron (same pattern as Bluesky milestone)
- [ ] Post URL written to Column K, status updated

**Success criteria**: A row scheduled for today with platform `mastodon` gets posted and Column K is populated. Whitney reviews the live post and confirms it looks correct before this milestone is marked complete.

---

### Milestone 4: LinkedIn Posting + Token Management
- [ ] Register LinkedIn app, add "Share on LinkedIn" product (`w_member_social` scope — self-service)
- [ ] Implement OAuth 2.0 authorization code flow for initial token acquisition
- [ ] Store access token + refresh token securely (Google Secret Manager, consistent with existing secrets pattern)
- [ ] Implement pre-flight token refresh: if access token expires within 7 days, refresh automatically (60-day access / 365-day refresh cycle)
- [ ] Implement LinkedIn posting via `POST https://api.linkedin.com/rest/posts` with required headers (`Linkedin-Version: YYYYMM`, `X-Restli-Protocol-Version: 2.0.0`)
- [ ] Wire into daily cron, write post URL to Column I, update status

**Success criteria**: A row scheduled for today with platform `linkedin` gets posted and Column I is populated. Token refresh works without manual intervention. Whitney reviews the live post and confirms it looks correct before this milestone is marked complete.

---

### Milestone 5: Pre-Launch — Disable Micro.blog Auto-Syndication
- [ ] Turn off Micro.blog's auto-syndication to Mastodon and Bluesky in account settings
- [ ] Verify no duplicate posts occur by running a test post through the new system
- [ ] Confirm existing Micro.blog website content posting (whitneylee.com) is unaffected

**Success criteria**: A test post goes to Bluesky and Mastodon exactly once, via the new direct posting system. No duplicates.

---

### Milestone 6: micro.blog Video Upload
*Gated on API feasibility testing — do not start until confirmed.*

- [ ] Test micro.blog Micropub media endpoint for video upload against a real account
- [ ] If confirmed: implement video upload flow (upload → get URL → include in post)
- [ ] Add view count check via YouTube Data API: only include `microblog` platform if video has > 1000 views
- [ ] Wire into daily cron, write post URL to Column L, update status
- [ ] If API video upload is not feasible: close this milestone as out of scope

**Success criteria**: A short with > 1000 views gets video uploaded and posted to micro.blog. A short with < 1000 views is skipped for micro.blog even if `microblog` is in the platforms column.

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
New secrets needed (add to Google Secret Manager + GitHub Actions):
- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_REFRESH_TOKEN`
- `BLUESKY_HANDLE` (may already exist — check)
- `BLUESKY_APP_PASSWORD` (may already exist — check)
- `MASTODON_ACCESS_TOKEN`
- `MASTODON_INSTANCE_URL`
- `SOCIAL_POSTS_SHEET_ID`

---

## Dependencies

- **`/write-social-posts` skill** (journal repo, separate PRD/skill): populates the social posts spreadsheet with approved content and scheduled dates. This system is the consumer; that skill is the producer.
- **Existing `daily-sync.yml`** GitHub Actions workflow: this PRD extends it, does not replace it.
- **Micro.blog auto-syndication disabled** (Milestone 5 prerequisite for full launch).
