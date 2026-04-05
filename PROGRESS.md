# Progress Log

Development progress log for content-manager. Tracks implementation milestones across PRD work.

Entry format: `- (YYYY-MM-DD) Description of feature-level change (PRD #X, milestone)`

## [Unreleased]

### Added
- (2026-04-05) Added social posts queue module with Google Sheets reader, date/platform filter, and 13 unit tests (PRD #22, Milestone 1)
- (2026-04-05) Added Jest test framework and npm test script (PRD #22, Milestone 1)
- (2026-04-05) Added one-time sheet provisioning script `create-social-posts-sheet.js` (PRD #22, Milestone 1)
- (2026-04-05) Added `post-social-content.js` daily cron entry point wired into `daily-sync.yml` (PRD #22, Milestone 1)
- (2026-04-05) Added Bluesky posting via `@atproto/api` with app password auth, failure handling, and 10 unit tests (PRD #22, Milestone 2)
- (2026-04-05) Added Google Sheets status updater to write post URLs and status back after publishing (PRD #22, Milestone 2)
- (2026-04-05) Wired Bluesky dispatch into daily cron with per-post failure isolation; 41 total tests passing (PRD #22, Milestone 2)
- (2026-04-05) Added Mastodon posting via `masto.js` with access token auth, failure handling, and 12 new tests; 54 total tests passing (PRD #22, Milestone 3)
