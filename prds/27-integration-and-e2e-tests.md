# PRD #27: Integration and E2E Test Coverage

**Issue**: [#27](https://github.com/wiggitywhitney/content-manager/issues/27)
**Status**: Not Started
**Priority**: Medium
**Created**: 2026-04-08

---

## Problem Statement

Unit tests mock all external dependencies — Google Sheets, Bluesky, Mastodon, LinkedIn, micro.blog, YouTube Data API, and yt-dlp. The acceptance gate (`npm run check-secrets`) only verifies that secrets are present in Google Secret Manager; it does not verify that any API call actually works or returns the expected shape.

This leaves a gap: API contract changes, spreadsheet schema drift, and authentication failures are only caught in production.

## Solution Overview

Two new test tiers, both running in CI:

1. **Integration tests** — read-only API calls against real credentials. Verify that the live systems respond correctly and that response shapes match what the code expects. No posts, no mutations.

2. **E2e tests** — full dispatch pipeline in dry-run mode. Add dry-run support to `post-social-content.js` (parallel to the existing `DRY_RUN` env var in `sync-content.js`), then run the complete pipeline against a dedicated test row in the Social Posts Queue. Verify expected log output and behavior. Clean up the test row after.

Neither tier posts content to any platform.

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Integration tests scope | Read-only only | Posting to real accounts in CI creates noise and requires test account setup on every platform. Read operations verify the contract without side effects. |
| E2e approach | Dry-run mode | `sync-content.js` already has `DRY_RUN`; adding parity to `post-social-content.js` is low-cost and lets us exercise the full pipeline without actually sending posts. |
| Test row cleanup | Delete after e2e run | The test row is inserted into the real Social Posts Queue; it must be removed to avoid polluting the queue for real use. |
| CI execution | GitHub Actions only | Both tiers require real credentials (GSM secrets). They cannot run locally without `vals exec`. |
| Dotfiles NOT used | Skipped | `.skip-integration` and `.skip-e2e` are for permanent opt-out only. The hook warning disappears naturally once the test files exist. |

---

## Milestones

### Milestone 1: Integration tests — spreadsheet reads

Add `tests/integration/spreadsheet.integration.test.js`. These tests run against the real live and staged spreadsheets using the service account credentials already in CI.

Tests to write:
- Read the Social Posts Queue tab (staged spreadsheet `1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts`, tab `Social Posts Queue`) and assert: the response is an array, each row has 13 columns, `status` values are lowercase strings, `scheduledDate` values match `YYYY-MM-DD` format. The column layout is defined in the `COL` constant in `src/social-posts-queue.js` — read that file first.
- Read `Sheet1!I:I` from the live production spreadsheet (`1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs`) and verify the API call succeeds and returns an array (may be empty — smoke-test for the career guard read path)
- Call `fetchPendingPostsForToday()` (in `src/social-posts-queue.js`) with today's date and verify it returns an array without throwing (may be empty)

**Run in CI via**: new `test:integration` script in `package.json`, added to `daily-sync.yml` as a separate job that runs `npm run test:integration`. Requires `GOOGLE_SERVICE_ACCOUNT_JSON` secret.

**Success criteria**: `npm run test:integration` passes in CI against real credentials. Any spreadsheet schema change breaks the test immediately.

---

### Milestone 2: Integration tests — YouTube Data API

Add YouTube view count fetch to `tests/integration/youtube.integration.test.js`.

Tests to write:
- Call `getYouTubeViewCount('jNQXAC9IVRw')` — this function is in `src/post-microblog.js`. It uses the service account with `youtube.readonly` scope (confirmed working). Verify the return value is a number > 0. The "Me at the zoo" video (`jNQXAC9IVRw`) has hundreds of millions of views and is public domain — safe as a permanent test fixture.

**Run in CI via**: same `test:integration` script. Requires `GOOGLE_SERVICE_ACCOUNT_JSON` secret only (no separate YouTube API key needed — the service account is already confirmed working).

**Success criteria**: View count fetch returns a valid number. Catches YouTube Data API scope or credential regressions.

---

### Milestone 3: Add dry-run mode to `post-social-content.js`

Add `DRY_RUN` env var support to `post-social-content.js` and `career-post-guard.js`, matching the pattern already used in `sync-content.js`:

- When `DRY_RUN=true`, `dispatchPost()` logs what it would do instead of calling platform APIs
- `checkCareerPostedToday()` still reads the spreadsheet (read is safe in dry-run)
- `scanAndPostShorts()` skips the yt-dlp download and media upload, logs what it would post
- Platform posting functions (`postToBluesky`, `postToMastodon`, `postToLinkedIn`, `postToMicroblog`) are NOT called in dry-run mode
- **Do NOT add DRY_RUN checks inside the platform posting functions themselves** — the check belongs in `dispatchPost()` only. Adding it inside `postToBluesky` etc. would scatter the dry-run concern and make it untestable.

Write unit tests for the dry-run behavior.

**Success criteria**: `DRY_RUN=true node src/post-social-content.js` runs without making any platform API calls. Log output shows which posts would have been dispatched.

---

### Milestone 4: E2e test — full dispatch pipeline

Add `tests/e2e/dispatch-pipeline.e2e.test.js`. This test:

1. Inserts a dedicated test row into the Social Posts Queue tab. Use `src/add-social-test-row.js` as the reference for how to insert a row — it already does this using the Sheets API with the correct spreadsheet ID and tab name. The test row should have: platforms `bluesky,mastodon`, status `pending`, scheduledDate today, postType `episode`, youtubeUrl `https://youtu.be/jNQXAC9IVRw`.
2. Runs `post-social-content.js` with `DRY_RUN=true` as a child process, capturing stdout
3. Verifies the log output shows the test row being picked up and dispatched to the correct platforms
4. Verifies `checkCareerPostedToday()` was called (log line appears)
5. Deletes the test row from the spreadsheet (cleanup)

**Run in CI via**: new `test:e2e` script in `package.json`, added to `daily-sync.yml` as a separate job (runs after integration tests). Requires all social posting secrets.

**Success criteria**: Full pipeline executes against a real spreadsheet row in dry-run mode. Test row is cleaned up after. Log output confirms correct platform targeting, career guard check, and shorts scan execution.

---

### Milestone 5: Wire into CI and update hook detection

- Add `test:integration` and `test:e2e` scripts to `package.json`
- Add integration and e2e jobs to `daily-sync.yml` (or a separate `test.yml` workflow)
- Verify the `check-test-tiers` hook no longer warns after the test files exist
- No new secrets are needed — all required secrets (`GOOGLE_SERVICE_ACCOUNT_JSON` and platform tokens) are already in `.vals.yaml` and in GitHub Actions secrets

**Success criteria**: `check-test-tiers` hook is silent on push. CI passes with all three test tiers (unit, integration, e2e). No dotfiles needed.

---

## Design Notes

- The feature PR created by `/prd-done` needs the `run-acceptance` label to trigger acceptance gate CI. This is handled automatically by `/prd-done` when acceptance gate tests are detected.
- Integration tests are in `tests/integration/` and e2e tests are in `tests/e2e/` to match the directory conventions the `check-test-tiers` hook looks for.
- The YouTube video used in Milestone 2 (`jNQXAC9IVRw`) is a public domain video confirmed to have > 1000 views — safe for permanent use as a test fixture.
- E2e test cleanup must run in an `afterAll` block even if assertions fail, to avoid leaving test rows in the live spreadsheet.
