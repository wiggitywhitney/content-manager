# PRD #36: Extend scan-new-content.js — All Shows + Weekly Automation

**GitHub Issue**: https://github.com/wiggitywhitney/content-manager/issues/36

## Problem

scan-new-content.js only scans two sources: the Thunder YouTube playlist and the SDI JSON feed. Datadog Illuminated and Enlightning episodes are not auto-detected. Sheet1 must be updated manually for those shows before the social post workflow can begin. With no automation, episodes accumulate untracked until someone notices.

## Solution

Add Datadog Illuminated and Enlightning to the script's source list. Add a weekly GitHub Actions workflow so Sheet1 stays current without manual intervention. You Choose and AI Inevitable are out of scope until playlist IDs are confirmed / shows launch.

## Source of Truth

Full workflow context: `/Users/whitney.lee/Documents/Journal/docs/social-post-workflow.md`

## Milestones

- [ ] M1: Extend scan-new-content.js with Datadog Illuminated and Enlightning playlist scans
- [ ] M2: Add weekly-scan GitHub Actions workflow
- [ ] M3: Tests for new playlist sources

## Milestone Details

### M1: Extend scan-new-content.js with Datadog Illuminated and Enlightning playlist scans

Add two new YouTube playlist sources to `src/scan-new-content.js`. Follow the existing pattern of `fetchYouTubeVideos()` (the Thunder fetch function) — it handles pagination, skips private videos, and formats video URLs as `https://youtu.be/{videoId}`.

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

**Implementation requirements**:
- Add two separate named functions — `fetchDatadogIlluminatedVideos()` and `fetchEnlightningVideos()` — using the exact signature and internal structure of the existing `fetchYouTubeVideos()`. Do NOT refactor `fetchYouTubeVideos()` into a shared helper.
- Each function must be fully implemented with complete source code. Do NOT use placeholder comments like "// same as above" or "// ... rest of function".
- Preserve the private-video skip (`snippet.title === "Private video"`)
- These playlists contain main episodes only — no shorts filter needed
- Add both new fetch calls to the existing `Promise.all()` in `main()` so they run in parallel with Thunder and SDI
- Merge results into `allContent` before duplicate filtering — no change to dedup logic; URL matching against Column G already handles all sources uniformly
- Leave placeholder comments for You Choose and AI Inevitable in the constants section (playlist IDs TBD)
- Do NOT refactor or restructure unrelated parts of the file

**Deferred shows**: You Choose (DevOps Toolkit channel, playlist ID not yet confirmed) and AI Inevitable (show not yet launched). Add only placeholder comments — no fetch logic.

**Validation**: Run `vals exec -f .vals.yaml -- node src/scan-new-content.js --dry-run` and confirm Datadog Illuminated and Enlightning episodes appear in the output alongside Thunder and SDI results.

### M2: Add weekly-scan GitHub Actions workflow

Create `.github/workflows/weekly-scan.yml`. This is a separate workflow from `daily-sync.yml` because it runs weekly (not daily), requires only one secret (not social platform credentials), and has a lower failure urgency — a stale Sheet1 for a week is acceptable; a missed social post is not.

**Schedule**: Sundays at 08:00 UTC (`0 8 * * 0`)

**Required secret**: `GOOGLE_SERVICE_ACCOUNT_JSON` only. YouTube auth uses the same service account already configured for Sheets access — no separate YouTube API key needed.

**Workflow must include**:
- `workflow_dispatch` trigger for manual testing
- `on.schedule` at `0 8 * * 0`
- Node.js 22 (matches daily-sync.yml)
- `npm ci --omit=dev`
- `node src/scan-new-content.js` (no `--dry-run` flag)
- `timeout-minutes: 10`
- `concurrency` group (e.g., `weekly-scan-${{ github.ref }}`, `cancel-in-progress: true`) to prevent overlapping runs

**Workflow must NOT include**: yt-dlp setup, social platform secrets (Bluesky, Mastodon, LinkedIn, Micro.blog), or the priority-detection step — those belong to daily-sync.yml only.

**Validation**: Trigger the workflow manually via `workflow_dispatch` and confirm it completes without error. Check Sheet1 to verify no duplicate rows were added.

### M3: Tests for new playlist sources

Create `tests/scan-new-content.test.js` if it doesn't exist. Follow the Jest patterns in `tests/sync-content.test.js` for mocking and structure.

**What the tests must verify**:

1. Each new fetch function (or the refactored shared fetch function) uses the correct playlist ID for its show
2. Column B is `"Video"` for both Datadog Illuminated and Enlightning results
3. Column C is `"Datadog Illuminated"` for Illuminated results and `"Enlightning"` for Enlightning results
4. Private videos (where `snippet.title === "Private video"`) are excluded from results
5. Video URLs are formatted as `https://youtu.be/{videoId}`
6. Pagination is handled — when the API returns a `nextPageToken`, the function fetches the next page until exhausted
7. Results from both new sources appear in the combined `allContent` array that feeds into duplicate detection

**Before writing tests**: Read `tests/sync-content.test.js` to understand whether that file tests exported functions or invokes the module indirectly. Use the same approach for scan-new-content tests. If the new fetch functions need to be exported for testing, add `module.exports` for them — do not export functions that are already internal-only in the existing file.

**Mocking**: Mock the `googleapis` YouTube client at the module boundary using `jest.mock('googleapis')`. Do not make real YouTube API calls in tests.

**Do NOT** add tests for the GitHub Actions workflow file itself — workflow correctness is validated by running it manually (M2 validation step).

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Separate weekly workflow | Yes — new `weekly-scan.yml` | Different schedule, secrets needed, and failure urgency from daily-sync.yml |
| DatadogCommunity playlist access | Use existing service account + `youtube.readonly` | Public playlists are readable regardless of channel ownership |
| You Choose / AI Inevitable | Deferred with placeholder comments only | Playlist IDs not yet confirmed / show not yet launched |
| Shorts filter | None needed for new playlists | These playlist IDs are episode playlists, not shorts playlists |

## Design Notes

- The feature PR created by `/prd-done` needs the `run-acceptance` label to trigger acceptance gate CI. This is handled automatically by `/prd-done` when acceptance gate tests are detected.

## Decision Log

*(No decisions logged yet — add entries here when implementation choices differ from the plan above.)*
