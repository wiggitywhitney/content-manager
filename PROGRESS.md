# Progress Log

Development progress log for content-manager. Tracks implementation milestones across PRD work.

Entry format: `- (YYYY-MM-DD) Description of feature-level change (PRD #X, milestone)`

## [Unreleased]

### Added
- (2026-04-25) Added channel config and activity detection for the dynamic About page: `src/config/about-page-channels.js` defines which content channels (Thunder, Enlightning, Datadog Illuminated, You Choose, Conference Talks, GitHub, SDI) appear based on freshness thresholds, and `getActiveChannels()` in `src/update-about-page.js` filters spreadsheet rows by type and show name to determine which channels have published recently enough to appear. 22 unit tests cover all activity scenarios. Channels sort by most recent content date; SDI always appears last regardless of activity.
- (2026-04-05) Added social posts queue module with Google Sheets reader, date/platform filter, and 13 unit tests (PRD #22, Milestone 1)
- (2026-04-05) Added Jest test framework and npm test script (PRD #22, Milestone 1)
- (2026-04-05) Added one-time sheet provisioning script `create-social-posts-sheet.js` (PRD #22, Milestone 1)
- (2026-04-05) Added `post-social-content.js` daily cron entry point wired into `daily-sync.yml` (PRD #22, Milestone 1)
- (2026-04-05) Added Bluesky posting via `@atproto/api` with app password auth, failure handling, and 10 unit tests (PRD #22, Milestone 2)
- (2026-04-05) Added Google Sheets status updater to write post URLs and status back after publishing (PRD #22, Milestone 2)
- (2026-04-05) Wired Bluesky dispatch into daily cron with per-post failure isolation; 41 total tests passing (PRD #22, Milestone 2)
- (2026-04-05) Added Mastodon posting via `masto.js` with access token auth, failure handling, and 12 new tests; 54 total tests passing (PRD #22, Milestone 3)
- (2026-04-06) Added LinkedIn posting via REST API with OAuth access token auth, expiry warning, and 14 unit tests (PRD #22, Milestone 4)
- (2026-04-06) Added one-time OAuth setup script `linkedin-oauth-setup.js` to authorize and store access token + person URN in Secret Manager (PRD #22, Milestone 4)
- (2026-04-06) Wired LinkedIn dispatch into daily cron with per-post failure isolation; 73 total tests passing (PRD #22, Milestone 4)
- (2026-04-06) Migrated secrets management from Teller to vals; added .vals.yaml, acceptance gate check-secrets.js, and 6 vals config tests; 81 total tests passing (PRD #22, Milestone 5)
- (2026-04-06) Confirmed Micro.blog auto-syndication to Bluesky/Mastodon was not active; verified existing content sync unaffected via dry run (PRD #22, Milestone 5)
- (2026-04-06) Migrated social posts queue from separate sheet to "Social Posts Queue" tab in staged spreadsheet; removed SOCIAL_POSTS_SHEET_ID env var dependency throughout; 81 tests passing (PRD #22, Milestone 5)
- (2026-04-06) Verified live posting to all three platforms: Bluesky, Mastodon, LinkedIn — Milestone 5 complete (PRD #22)
- (2026-04-06) Fixed linkedin-oauth-setup.js: switched to /v2/userinfo for person URN (Sign In with LinkedIn OIDC product only grants /v2/userinfo, not /v2/me); print-commands pattern for GSM storage (PRD #22)
- (2026-04-07) Added micro.blog posting module with Micropub media upload, yt-dlp video download, and YouTube view-count gating (> 1000 views threshold) (PRD #22, Milestone 6)
- (2026-04-07) Added daily view-count scan for shorts: checks last 10 short rows, posts to micro.blog when threshold crossed, uses Column M as idempotency guard (PRD #22, Milestone 6)
- (2026-04-07) Added fetchRecentShortRows to social-posts-queue and updateMicroblogPostUrl to update-social-post-status; wired micro.blog scan into post-social-content.js cron (PRD #22, Milestone 6)
- (2026-04-07) Added AnimMouse/setup-yt-dlp@v3 to daily-sync.yml and fixed Post social content step secrets; 111 tests passing (PRD #22, Milestone 6)
- (2026-04-07) Fixed yt-dlp format selector to prefer pre-merged MP4 (no ffmpeg needed locally); verified live post to micro.blog plays correctly (PRD #22, Milestone 6)
- (2026-04-24) Wired micro.blog episode post dispatch into the daily social cron: `dispatchPost()` now handles `platforms = micro.blog` rows by calling `postToMicroblog()` with view-count check bypassed. Scheduled episode posts launch on their scheduled date rather than waiting for the 1,000-view threshold. The threshold-gated short scan (`scanAndPostShorts`) is unchanged.
- (2026-04-24) Changed social queue dispatch to post the oldest pending row regardless of scheduled date, exactly one per run. After a successful post, today's date is written to Column G as the actual post date. Rows with empty scheduled dates are now valid pending posts.
- (2026-04-24) Added date-parity alternation between career and social posts: odd days of the month give career priority, even days give social priority, with fallback to the other type when the priority queue is empty. On even days the workflow skips the career sync step when social has a pending post, and social skips its career-posted-today guard via `CAREER_PRIORITY` env var.
- (2026-04-24) Added Group ID column (col N) to the Social Posts Queue schema. Rows sharing the same Group ID now post together in a single cron run, so all platform variants of an episode announcement (LinkedIn, Mastodon, Bluesky) go out on the same day instead of one per day.
- (2026-04-24) Added micro.blog deferral logic to the social post dispatcher: micro.blog-only rows are held back until the non-micro.blog queue is fully drained AND the career post backlog is clear. This prevents Micro.blog's cross-posting from creating duplicate posts on LinkedIn, Bluesky, and Mastodon after those platforms have already received direct posts.
- (2026-04-24) Extended `sync-content.js` to read the new Highlight (col J) and Highlight Priority (col K) columns from the live production spreadsheet, in preparation for the dynamic about page feature. `parseRow` now returns `highlight: bool` and `highlightPriority: int|null`. Added 13 unit tests covering all normalization cases.
