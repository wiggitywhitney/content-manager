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
| Video (Thunder, Enlightning) | YouTube thumbnail via `fetchThumbnail(row.link)` | Always has image |
| Podcast (SDI) | SDI RSS feed via `fetchThumbnail(row.link)` (requires #52) | Always has image |
| Presentation with YouTube URL in column G | YouTube thumbnail via `fetchThumbnail(row.link)` | Image when URL present |
| Presentation without URL | — | No image |
| Guest, Blog | — | No image |

Image fetch failures are non-fatal: log a warning and proceed without image.

## Milestones

- [x] M1: Visual verification gate — before writing any code, manually attach an image to one micro.blog career post via the micro.blog UI and confirm the category page rendering at whitneylee.com is visually acceptable. This is a go/no-go gate. If the layout is wrong, pause and reassess before continuing.
- [ ] M2: Image support added to `sync-content.js` for new career posts — in the post creation path only (do NOT modify the update/change-detection path), apply the image source rules table to determine whether to fetch an image; call `fetchThumbnail(row.link)` from `src/fetch-thumbnail.js`; upload the buffer to the Micropub media endpoint (follow the `uploadToMediaEndpoint` pattern in `src/post-microblog.js` — either extract it to a shared helper or inline the same logic in `sync-content.js`); add `photo[]` to the URLSearchParams in `createMicroblogPost`; posts without an image source are created as before with no `photo[]` field
- [ ] M3: Backfill script implemented — implement `src/backfill-career-images.js` reading the staged spreadsheet, finding career posts with a micro.blog URL (column H) and an available image source, attaching the image via the confirmed Micropub update pattern (Decision 6 below), skipping posts already having an image, posts without an image source, and posts where image fetch fails (log warning, continue); include `--dry-run` flag and progress indicators. The confirmed API flow: fetch image buffer → `POST /micropub/media` (multipart FormData) → get hosted URL → `POST /micropub` with `{ action: "update", url: postUrl, add: { photo: [hostedUrl] } }` (no pre-implementation research needed — pattern verified in M1)
- [ ] M4: Tests pass for new functionality — test coverage for image source selection logic in `sync-content.js` (all post types: video, podcast, presentation-with-URL, presentation-without-URL, guest, blog) and backfill script (dry-run mode, skip logic, image source detection)
- [ ] M5: Backfill executed — follow the manual steps below to run the backfill without triggering re-syndication

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
