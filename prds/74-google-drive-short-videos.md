# PRD: Store Short Videos in Google Drive for CI Dispatch

**GitHub Issue**: [#74](https://github.com/wiggitywhitney/content-manager/issues/74)

**Status**: In Progress

**Priority**: High

---

## Problem Statement

`post-social-content.js` downloads YouTube Shorts via yt-dlp during GitHub Actions runs. GitHub Actions runners use shared datacenter IPs that YouTube explicitly flags as bot traffic, returning:

```text
ERROR: [youtube] VIDEO_ID: Sign in to confirm you're not a bot.
```

This is an IP reputation problem, not a yt-dlp version problem. Keeping yt-dlp current (the previous attempted fix) does not help. When a short post row fails to download, the row stays `pending` and blocks the dispatch queue — nothing else can post until it is resolved.

As of 2026-06-03, rows 15–18 and 23–26 in the Social Posts Queue are pending short posts that have been blocked by this issue.

## Solution Overview

Move video storage to Google Drive. The journal skill (which runs on Whitney's local machine with a residential IP) downloads the YouTube Short and uploads it to a designated Drive folder when creating the queue row. CI reads the Drive file ID from the spreadsheet and downloads the video from Drive instead of touching YouTube directly.

The `content-manager-sheets` service account already has Google Drive access confirmed.

## Rejected Alternatives

These were considered and ruled out during design. Do not revisit them without new information.

| Approach | Rejected because |
|---|---|
| `yt-dlp -U` self-update in CI | Fixes version staleness; does not fix datacenter IP reputation |
| `bgutil-ytdlp-pot-provider` (PO token plugin) | "Does not guarantee bypassing 403 errors" per official README; adds complexity without reliability |
| Firefox cookies stored as CI secret | Expires every ~2 weeks; requires manual rotation; uses Whitney's personal Google account credentials |
| Different download tool (pytube, ytdl-core, etc.) | Same datacenter IP problem regardless of tool |
| Text + YouTube link fallback when video fails | Whitney wants video or nothing — text-only posts are not acceptable |

## Design Notes

- **Video or nothing**: when a short post row has no Drive link, skip the row entirely. Do NOT post text + YouTube link as a fallback.
- **Drive file ID format**: store the Drive file ID (not a shareable URL) in the spreadsheet. File IDs are stable and don't expire. Download via `drive.files.get({ fileId, alt: 'media' })` using the service account.
- **Journal skill boundary**: `Journal/.claude/skills/write-social-posts/SKILL.md` must NOT be edited directly from this repo. Whitney relays what the skill needs to do to the journal repo's Claude Code instance (see Milestone 6).
- **Cross-repo schema changes**: whenever the spreadsheet column schema changes, three places must be updated together: the Social Instructions tab (gid=444239135), `Journal/docs/social-posts-queue.md`, and `src/post-social-content.js`. See CLAUDE.md "Cross-repo relationship — Social Posts Queue."

## Success Criteria

- Short post rows dispatch with the actual video attached to LinkedIn, Bluesky, and Mastodon
- No yt-dlp invocation occurs in GitHub Actions for short post dispatch
- Rows with no Drive link are skipped (not failed, not posted as text-only)
- The 8 existing pending short rows (15–18, 23–26) are backfilled and dispatch successfully
- All existing tests pass; new tests cover the Drive download path

## Milestones

- [x] **M1: Schema and Drive folder decision** — Decisions confirmed by Whitney on 2026-06-04. See Decision Log: column O, header "Drive Video ID", Drive folder "Social Post Videos" (ID: `1EfuS2Z0hXeQm0OFlAe8BlJUaQzNUlN1f`). M2, M3, M5, and M6 are unblocked.

- [ ] **M2: `post-social-content.js` updated for Drive download** — Step 0: Read the M1 Decision Log entry — it must exist before this milestone begins. Read the Drive file ID from the decided column. If the column is populated, download the video as binary using `drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'arraybuffer' })` with the service account — the `responseType: 'arraybuffer'` option is required to receive video bytes; omitting it returns JSON metadata instead. Pass the resulting buffer to platform uploads (same as the current yt-dlp output path in `src/post-social-content.js`). If the column is absent or empty, leave the row status as `pending` and log a warning — do NOT mark it `failed`, do NOT fall back to text posting, do NOT throw. Remove the yt-dlp invocation from the short post dispatch path. Do NOT introduce new npm packages — `googleapis` is already installed in the project; check existing Drive usage in the codebase before writing any API calls.

- [ ] **M3: Tests updated** — Step 0: Read the M1 Decision Log entry. Add tests covering: Drive link present → video fetched and post attempted on each platform; Drive link absent → row skipped with no post attempt; Drive API error → row marked failed, not silently swallowed. Existing tests must continue to pass.

- [ ] **M4: CI workflow cleanup** — Audit `daily-sync.yml` for all yt-dlp usages. If short post dispatch was the only consumer, remove `AnimMouse/setup-yt-dlp@v3` and the `yt-dlp -U` self-update step. If yt-dlp is used elsewhere in the workflow, leave those steps in place and add an inline comment in `daily-sync.yml` next to the retained step explaining what still uses it. This milestone has no dependency on M1.

- [ ] **M5: Social Instructions tab updated** — Step 0: Read the M1 Decision Log entry — it must exist before this milestone begins. Update the Social Instructions tab in the Staged spreadsheet (`1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts`, gid=444239135) to describe the new column O and instruct the journal skill to populate it for `short` post type rows. This is the only change that can be made from this repo — `Journal/docs/social-posts-queue.md` and `Journal/.claude/skills/write-social-posts/SKILL.md` both live in the journal repo and are handled in M6.

- [ ] **M6: Journal team handoff** — Step 0: Confirm M5 is complete (Social Instructions tab updated). This is the handoff milestone — all work from here requires Whitney to relay instructions to the journal repo's Claude Code instance. Whitney relays three things: (1) update `Journal/docs/social-posts-queue.md` to add column O ("Drive Video ID") to the schema table; (2) update the `/write-social-posts` skill so that for `short` post type rows it downloads the video locally using yt-dlp (works on residential IP), uploads it to the "Social Post Videos" Drive folder (ID: `1EfuS2Z0hXeQm0OFlAe8BlJUaQzNUlN1f`) using the service account, and writes the Drive file ID to column O; (3) run the skill for at least one short row to confirm column O is populated correctly. Do NOT attempt to edit any journal repo files directly from this repo. This milestone is complete when the journal skill produces rows with column O populated.

- [ ] **M7: Existing rows backfilled and end-to-end verified** — The 8 pending short rows (15–18 and 23–26) predate this feature and have no Drive link. Backfill column O for each by running the updated journal skill or uploading videos to Drive manually and writing the file IDs. Row 15 ("Beyond Container Logs: Logging Operator's Extensions") is the highest priority — it has been blocked the longest. After backfill, verify using `npm run sync:test` (dry-run mode) that the dispatch selects row 15 and that the log output shows the Drive file ID being read and video bytes downloaded for that row — no post should go live. Confirm the exit code is 0 and no error is logged for row 15. Do NOT trigger the GitHub Actions workflow to verify — that requires Whitney's explicit approval.

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-06-03 | Store videos in Google Drive instead of downloading from YouTube in CI | GitHub Actions datacenter IPs are blocked by YouTube bot detection regardless of tool; journal skill runs on residential IP where yt-dlp works; service account Drive access already confirmed |
| 2026-06-03 | Video or nothing — no text fallback | Whitney's explicit requirement |
| 2026-06-04 | Drive folder: use existing "Social Post Videos" folder, ID `1EfuS2Z0hXeQm0OFlAe8BlJUaQzNUlN1f` | Folder already exists; confirmed by Whitney |
| 2026-06-04 | Spreadsheet column: column O, header "Drive Video ID" | Appended after existing Group ID column N; confirmed by Whitney |

## Open Questions

- What should happen when the journal skill tries to download a short that isn't yet public (private/scheduled)? Skip writing the Drive link and leave column O empty, or fail the row creation?

## Progress Log

### 2026-06-04
- M1 decisions confirmed by Whitney: column O / "Drive Video ID", existing "Social Post Videos" folder (ID: `1EfuS2Z0hXeQm0OFlAe8BlJUaQzNUlN1f`)
- M1 marked complete; M2, M3, M5, M6 unblocked

### 2026-06-03
- PRD created
- Root cause confirmed: datacenter IP reputation, not yt-dlp version
- All alternative approaches evaluated and rejected (see Rejected Alternatives table)
- 8 existing pending short rows (15–18, 23–26) identified as blocked by this issue
- Service account Drive access confirmed via test call
