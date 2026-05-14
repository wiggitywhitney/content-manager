# PRD: Add Images to Career Posts and Backfill Existing Micro.blog Posts

**Issue**: [#53](https://github.com/wiggitywhitney/content-manager/issues/53)
**Status**: Not Started
**Priority**: Medium
**Created**: 2026-05-05
**Last Updated**: 2026-05-05

**Prerequisites**: Issue #52 (SDI image support in `fetchThumbnail`) must be merged before implementation begins.

## Problem Statement

Career posts synced to micro.blog via `sync-content.js` are text-only. The category pages at whitneylee.com (e.g., `/video/`, `/presentations/`, `/podcast/`) show only dates and titles. Posts that have an image source available (YouTube thumbnails for videos and recorded presentations, SDI episode artwork for podcast appearances) could display richer visual content.

## Solution Overview

1. Extend `sync-content.js` to attach images when creating new career posts going forward.
2. Implement a backfill script (`src/backfill-career-images.js`) to update all existing micro.blog career posts that have an image source.
3. Execute the backfill with micro.blog cross-posting temporarily disabled to prevent re-syndication to LinkedIn, Bluesky, and Mastodon.

## Image Source Rules

| Post type | Image source | Behavior |
|---|---|---|
| Video (Thunder, Enlightning, and other shows) | YouTube thumbnail via `fetchThumbnail(row.link)` | Always has image |
| **Video (Tanzu Tuesday)** | — | **No image** (Decision 10: discoverable in photos tab, content not wanted there) |
| Podcast (SDI) | SDI RSS feed via `fetchThumbnail(row.link)` (requires #52) | Always has image |
| Presentation with YouTube URL in column G | YouTube thumbnail via `fetchThumbnail(row.link)` | Image when URL present |
| Presentation without URL | — | No image |
| Guest, Blog | — | No image |

Image fetch failures are non-fatal: log a warning and proceed without image.

## Milestones

- [x] M1: Visual verification gate — before writing any code, manually attach an image to one micro.blog career post via the micro.blog UI and confirm the category page rendering at whitneylee.com is visually acceptable. This is a go/no-go gate. If the layout is wrong, pause and reassess before continuing.
- [x] M2: Image support added to `sync-content.js` for new career posts — in the post creation path only (do NOT modify the update/change-detection path), apply the image source rules table to determine whether to fetch an image; call `fetchThumbnail(row.link)` from `src/fetch-thumbnail.js`; upload the buffer to the Micropub media endpoint (follow the `uploadToMediaEndpoint` pattern in `src/post-microblog.js` — either extract it to a shared helper or inline the same logic in `sync-content.js`); add `photo[]` to the URLSearchParams in `createMicroblogPost`; posts without an image source are created as before with no `photo[]` field
- [x] M3: Backfill script implemented — implement `src/backfill-career-images.js` reading the live production spreadsheet, finding career posts with a micro.blog URL (column H) and an available image source, attaching the image via the confirmed Micropub update pattern (Decision 6 below), skipping posts already having an image, posts without an image source, and posts where image fetch fails (log warning, continue); include `--dry-run` flag and progress indicators. The confirmed API flow: fetch image buffer → `POST /micropub/media` (multipart FormData) → get hosted URL → `POST /micropub` with `{ action: "update", url: postUrl, add: { photo: [hostedUrl] } }` (no pre-implementation research needed — pattern verified in M1)
- [x] M4: Tests pass for new functionality — test coverage for image source selection logic in `sync-content.js` (all post types: video, podcast, presentation-with-URL, presentation-without-URL, guest, blog) and backfill script (dry-run mode, skip logic, image source detection)
- [x] M5: Backfill executed — follow the manual steps below to run the backfill without triggering re-syndication
- [x] M6: Fix `postHasPhoto` detection so the backfill is idempotent — during the M5 run, `postHasPhoto` returned false for all 326 posts even though 322 had just been updated, causing every post to receive a duplicate thumbnail upload on the second run. Investigate by querying `GET https://micro.blog/micropub?q=source&url=<known-image-post-url>` with the Micropub token and inspecting the raw JSON response structure for the `photo` field. Then fix `postHasPhoto` in `src/backfill-career-images.js` to match the actual response shape. Add a test. The fix must ensure a post that already has a photo is skipped (not re-uploaded) on subsequent backfill runs.
- [x] M7: Exclude Tanzu Tuesday from image source logic — update `needsImage` in `src/sync-content.js` to return `false` when `row.show` contains "Tanzu Tuesday" (Decision 10); update tests to cover this case; update `ABOUTME` comment on the function. This prevents new Tanzu Tuesday posts from receiving images going forward.
- [ ] M8: Delete photos from existing Tanzu Tuesday posts — first research whether micro.blog's Micropub endpoint supports the `delete` property action (`POST /micropub` with `{ action: "update", url, delete: ["photo"] }` or `{ action: "update", url, delete: { photo: [...] } }`); test manually on one Tanzu Tuesday post; if supported, implement `src/remove-tanzu-tuesday-images.js` that reads the live production spreadsheet, filters for show = "Tanzu Tuesday" with a micro.blog URL and a photo, and removes the photo via Micropub. Use the existing `postHasPhoto` function from `src/backfill-career-images.js` to detect whether each post has a photo; it checks `properties.content[0]` for `<img>` tags (see Decision log, 2026-05-14). Run with cross-posting disabled (Decision 9). Include `--dry-run` flag. **Success criteria includes re-enabling cross-posting: do NOT mark this milestone complete until Whitney verbally confirms in the session that cross-posting to LinkedIn, Bluesky, and Mastodon is back on in the micro.blog UI.**

## Backfill Execution Steps (Manual)

These steps must be performed in order. Do not run the backfill script without completing step 1 first.

1. **Disable micro.blog cross-posting**: In the micro.blog UI, go to Account → Edit Apps (or cross-posting settings) and disable cross-posting to LinkedIn, Bluesky, and Mastodon. This prevents micro.blog from re-syndicating updated posts to social platforms.
2. **Run the backfill script**: `vals exec -f .vals.yaml -- node src/backfill-career-images.js`
3. **Re-enable micro.blog cross-posting**: Return to micro.blog cross-posting settings and re-enable all platforms.

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-05 | Match SDI episodes by URL (not title) in RSS feed | Keeps `fetchThumbnail(url)` signature unchanged; no call site changes needed in `sync-content.js` or `post-social-content.js` |
| 2026-05-05 | Presentations without a YouTube URL stay image-free | No fallback image source exists; patchy coverage (some posts with images, some without) is acceptable and preferable to a generic placeholder |
| 2026-05-05 | Guest and Blog post types stay image-free | No reliable image source; out of scope for this PRD |
| 2026-05-05 | Image fetch failure is non-fatal | Consistent with existing behavior in `post-social-content.js`; a failed thumbnail should not block post creation |
| 2026-05-13 | M1 verification done via Micropub API, not micro.blog UI | Programmatic verification tests the actual code path; confirmed `/podcast/` category page renders images acceptably |
| 2026-05-13 | Confirmed Micropub pattern for adding photo to existing post | `POST /micropub/media` (multipart) → get hosted URL → `POST /micropub` with `{ action: "update", url: postUrl, add: { photo: [hostedUrl] } }`; verified working on episode 122 post |
| 2026-05-13 | Backfill reads from live production spreadsheet, not staged | Column H (micro.blog URL) is written by `sync-content.js` to the live production spreadsheet (`1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs`); the staged spreadsheet is a staging area for new content and has no column H data to backfill |
| 2026-05-14 | `postHasPhoto` detection was broken during M5 backfill run — all 326 posts returned false, causing duplicate thumbnail uploads | micro.blog's Micropub source query (`?q=source&url=...`) does not return a `photo` property at all; photos are embedded as `<img>` tags inside `properties.content[0]`. Fixed in M6 by checking `content.includes('<img')` instead of `properties.photo`. |
| 2026-05-14 | Tanzu Tuesday posts must run with cross-posting disabled | Micropub update/delete actions on existing posts can trigger micro.blog feed re-polling which re-syndicates to LinkedIn/Bluesky/Mastodon; same precaution as M5 applies to M8 |
| 2026-05-14 | Tanzu Tuesday posts should have no images (existing photos to be deleted) | Whitney dislikes the Tanzu Tuesday thumbnail design and the videos themselves; adding thumbnails makes these videos discoverable in the micro.blog photos tab, which she explicitly does not want. `needsImage` must be updated to exclude them (M7) and existing Tanzu Tuesday photos must be deleted via Micropub (M8) |
