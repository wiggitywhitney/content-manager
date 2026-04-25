# PRD #36: Extend scan-new-content.js — All Shows + Daily Cron Integration

**GitHub Issue**: https://github.com/wiggitywhitney/content-manager/issues/36

## Problem

scan-new-content.js only scans two sources: the Thunder YouTube playlist and the SDI JSON feed. Datadog Illuminated and Enlightning episodes are not auto-detected. Sheet1 must be updated manually for those shows before the social post workflow can begin. With no automation, episodes accumulate untracked until someone notices.

## Solution

Add Datadog Illuminated, Enlightning, and You Choose to the script's source list. Add a scan step to the existing daily-sync.yml cron so Sheet1 stays current without manual intervention. AI Inevitable remains out of scope until the show launches.

## Source of Truth

Full workflow context: see `Journal/docs/social-post-workflow.md` in the Journal repo

## Milestones

- [ ] M1: Extend scan-new-content.js with Datadog Illuminated, Enlightning, and You Choose playlist scans
- [ ] M2: Add scan-new-content.js step to daily-sync.yml
- [ ] M3: Tests for new playlist sources

## Milestone Details

### M1: Extend scan-new-content.js with Datadog Illuminated, Enlightning, and You Choose playlist scans

Add three new YouTube playlist sources to `src/scan-new-content.js`. Follow the existing pattern of `fetchYouTubeVideos()` (the Thunder fetch function) — it handles pagination, skips private videos, and formats video URLs as `https://youtu.be/{videoId}`.

**Datadog Illuminated**
- Playlist ID: `PLVOmGuoGYFgpj1-kAXLRKmFWqZ99HAHu7`
- Channel: DatadogCommunity (public channel — not owned by Whitney but readable via YouTube Data API with `youtube.readonly` scope)
- Column B value: `Video`
- Column C value: `Datadog Illuminated`

**Enlightning**
- Playlist ID: `PLBexUsYDijaz09nH8BVPmPio_16V115i4`
- Channel: wiggitywhitney (`UCaGYZkSCN3MPwqRpt24KBKA`)
- Column B value: `Video`
- Column C value: `Enlightning`

**You Choose**
- Playlist ID: `PLyicRj904Z9-FzCPvGpVHgRQVYJpVmx3Z`
- Channel: DevOps Toolkit YouTube (public channel — not owned by Whitney but readable via YouTube Data API with `youtube.readonly` scope)
- Column B value: `Video`
- Column C value: `You Choose`

**Implementation requirements**:
- Add three separate named functions — `fetchDatadogIlluminatedVideos()`, `fetchEnlightningVideos()`, and `fetchYouChooseVideos()` — using the exact signature and internal structure of the existing `fetchYouTubeVideos()`. Do NOT refactor `fetchYouTubeVideos()` into a shared helper.
- Each function must be fully implemented with complete source code. Do NOT use placeholder comments like "// same as above" or "// ... rest of function".
- Preserve the private-video skip (`snippet.title === "Private video"`)
- These playlists contain main episodes only — no shorts filter needed
- Add all three new fetch calls to the existing `Promise.all()` in `main()` so they run in parallel with Thunder and SDI
- Merge results into `allContent` before duplicate filtering — no change to dedup logic; URL matching against Column G already handles all sources uniformly
- Leave a placeholder comment for AI Inevitable in the constants section (show not yet launched)
- Do NOT refactor or restructure unrelated parts of the file

**Deferred shows**: AI Inevitable only (show not yet launched). Add only a placeholder comment — no fetch logic.

**Validation**: Run `vals exec -f .vals.yaml -- node src/scan-new-content.js --dry-run` and confirm Datadog Illuminated, Enlightning, and You Choose episodes appear in the output alongside Thunder and SDI results.

### M2: Add scan-new-content.js step to daily-sync.yml

Add a new step to `.github/workflows/daily-sync.yml` that runs `scan-new-content.js` on every daily cron run. No new workflow file is needed. (Decision 2)

**Placement**: Insert the step after `npm ci --omit=dev` and before the `Determine post priority` step. Running the scan before the priority and sync steps means any newly discovered Sheet1 rows are available to `sync-content.js` in the same run.

**Step definition**:
```yaml
- name: Scan for new content
  env:
    GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
  run: node src/scan-new-content.js
```

**Requirements**:
- The step runs unconditionally on every daily-sync.yml execution (no `if:` condition)
- Only `GOOGLE_SERVICE_ACCOUNT_JSON` is needed — YouTube auth uses the same service account already configured for Sheets access
- Do NOT add yt-dlp setup, social platform secrets, or priority-detection logic to this step — those belong to their own steps in daily-sync.yml

**Validation**: Trigger the `daily-sync` workflow manually via `workflow_dispatch` and confirm the new "Scan for new content" step completes without error. Check that no duplicate Sheet1 rows were added.

### M3: Tests for new playlist sources

Create `tests/scan-new-content.test.js` if it doesn't exist. Follow the Jest patterns in `tests/sync-content.test.js` for mocking and structure.

**What the tests must verify**:

1. Each new fetch function uses the correct playlist ID for its show
2. Column B is `"Video"` for Datadog Illuminated, Enlightning, and You Choose results
3. Column C is `"Datadog Illuminated"`, `"Enlightning"`, and `"You Choose"` respectively for each source
4. Private videos (where `snippet.title === "Private video"`) are excluded from results
5. Video URLs are formatted as `https://youtu.be/{videoId}`
6. Pagination is handled — when the API returns a `nextPageToken`, the function fetches the next page until exhausted
7. Results from all three new sources appear in the combined `allContent` array that feeds into duplicate detection

**Before writing tests**: Read `tests/sync-content.test.js` to understand whether that file tests exported functions or invokes the module indirectly. Use the same approach for scan-new-content tests. If the new fetch functions need to be exported for testing, add `module.exports` for them — do not export functions that are already internal-only in the existing file.

**Mocking**: Mock the `googleapis` YouTube client at the module boundary using `jest.mock('googleapis')`. Do not make real YouTube API calls in tests.

**Do NOT** add tests for the daily-sync.yml workflow change itself — workflow correctness is validated by triggering the workflow manually (M2 validation step).

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Automation approach | Step in daily-sync.yml — no separate workflow | Simpler than a second workflow file; scan is fast and idempotent so running daily is fine (Decision 2) |
| DatadogCommunity playlist access | Use existing service account + `youtube.readonly` | Public playlists are readable regardless of channel ownership |
| You Choose | Included — playlist ID confirmed | Playlist `PLyicRj904Z9-FzCPvGpVHgRQVYJpVmx3Z` on DevOps Toolkit YouTube (Decision 1) |
| AI Inevitable | Deferred with placeholder comment only | Show not yet launched |
| Shorts filter | None needed for new playlists | These playlist IDs are episode playlists, not shorts playlists |

## Design Notes

- The feature PR created by `/prd-done` needs the `run-acceptance` label to trigger acceptance gate CI. This is handled automatically by `/prd-done` when acceptance gate tests are detected.

## Decision Log

| # | Decision | Date | Rationale |
|---|---|---|---|
| 1 | Include You Choose in M1 — playlist ID confirmed as `PLyicRj904Z9-FzCPvGpVHgRQVYJpVmx3Z` on DevOps Toolkit YouTube | 2026-04-25 | Playlist ID was previously unknown; now confirmed. No reason to defer. Channel is public and readable with existing `youtube.readonly` auth. |
| 2 | Run scan as a step in daily-sync.yml instead of a separate weekly workflow | 2026-04-25 | Simpler to maintain one workflow file. Scan is fast and idempotent — running daily causes no harm and means Sheet1 is never more than one day stale. |
| 3 | Datadog Illuminated playlist URL confirmed: `https://www.youtube.com/playlist?list=PLVOmGuoGYFgpj1-kAXLRKmFWqZ99HAHu7` | 2026-04-25 | URL was previously unknown (TODO placeholder). Now confirmed — also resolves the TODO in `src/config/about-page-channels.js` and unblocks PRD #2 M2. |
