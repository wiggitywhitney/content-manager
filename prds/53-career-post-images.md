# PRD: Add Images to Career Posts and Backfill Existing Micro.blog Posts

**Issue**: [#53](https://github.com/wiggitywhitney/content-manager/issues/53)
**Status**: In Progress
**Priority**: Medium
**Created**: 2026-05-05
**Last Updated**: 2026-05-14

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
- [x] M3: Backfill script implemented — implement `src/backfill-career-images.js` reading the live production spreadsheet, finding career posts with a micro.blog URL (column H) and an available image source, attaching the image via the confirmed Micropub update pattern (Decision 6 below), skipping posts already having an image, posts without an image source, and posts where image fetch fails (log warning, continue); include `--dry-run` flag and progress indicators. The confirmed API flow: fetch image buffer → `POST /micropub/media` (multipart FormData) → get hosted URL → `POST /micropub` with `{ action: "update", url: postUrl, add: { photo: [hostedUrl] } }` (no pre-implementation research needed — pattern verified in M1) ⚠️ **The `add: { photo }` pattern used here was later discovered to strip post categories (Decision 11). M9 replaces this with content-replace.**
- [x] M4: Tests pass for new functionality — test coverage for image source selection logic in `sync-content.js` (all post types: video, podcast, presentation-with-URL, presentation-without-URL, guest, blog) and backfill script (dry-run mode, skip logic, image source detection)
- [x] M5: Backfill executed — follow the manual steps below to run the backfill without triggering re-syndication
- [x] M6: Fix `postHasPhoto` detection so the backfill is idempotent — during the M5 run, `postHasPhoto` returned false for all 326 posts even though 322 had just been updated, causing every post to receive a duplicate thumbnail upload on the second run. Investigate by querying `GET https://micro.blog/micropub?q=source&url=<known-image-post-url>` with the Micropub token and inspecting the raw JSON response structure for the `photo` field. Then fix `postHasPhoto` in `src/backfill-career-images.js` to match the actual response shape. Add a test. The fix must ensure a post that already has a photo is skipped (not re-uploaded) on subsequent backfill runs.
- [x] M7: Exclude Tanzu Tuesday from image source logic — update `needsImage` in `src/sync-content.js` to return `false` when `row.show` contains "Tanzu Tuesday" (Decision 10); update tests to cover this case; update `ABOUTME` comment on the function. This prevents new Tanzu Tuesday posts from receiving images going forward.
- [x] M8: Delete photos from existing Tanzu Tuesday posts — `src/remove-tanzu-tuesday-images.js` is implemented. The Micropub `delete: ["photo"]` action returns 500 (micro.blog stores photos as `<img>` tags in content, not as a property). The script instead fetches each post's source content, strips `<img>` tags, and replaces content via `{ action: "update", replace: { content: [stripped] } }` (Decision 10). Run with cross-posting disabled. **Success criteria includes re-enabling cross-posting: do NOT mark this milestone complete until Whitney verbally confirms in the session that cross-posting to LinkedIn, Bluesky, and Mastodon is back on in the micro.blog UI.**

- [x] M9: Fix scripts for forward correctness (Decision 12, 15, 16) — before running any further backfill operations, fix the scripts so they are safe and complete:
  - Fix `needsImage` in `src/sync-content.js` to return `true` for both `"Presentation"` (singular, spreadsheet typo) and `"Presentations"` (plural); update its tests
  - Fix `addPhotoToPost` in `src/backfill-career-images.js` to use content-replace instead of `add: { photo }`: GET source content via `?q=source`; if content is null/empty (can happen for rescheduled posts whose URL is stale), log a warning and skip; otherwise append `'\n\n<img src="' + hostedUrl + '">'` to content and send `{ action: "update", url: postUrl, replace: { content: [newContent] } }` — NEVER use `add: { photo }` again (it strips categories, Decision 11)
  - Update `~/.claude/rules/microblog-api-gotchas.md` to document: (1) `add: { photo }` strips post categories; (2) `?q=source` returns null/empty content for rescheduled posts whose URL is stale — always guard against this
  - Add test coverage for singular `needsImage` and the content-replace approach in backfill
  - Success: `needsImage` handles both type spellings; backfill `addPhotoToPost` uses content-replace; tests pass; gotcha documented

- [ ] M10: Restore categories on archive posts stripped by `add: { photo }` (Decision 11) — implement `src/restore-post-categories.js`:
  - Read the production spreadsheet; for each row with a microblogUrl (column H), query `GET https://micro.blog/micropub?q=source&url=<microblogUrl>` and check if `properties.category` is empty or missing
  - Use the same `categoryMap` as `createMicroblogPost` in `sync-content.js` to translate spreadsheet type to micro.blog category: `{ Video: 'Video', Podcast: 'Podcast', Presentations: 'Presentations', Presentation: 'Presentations', Guest: 'Guest', Blog: 'Blog' }` — note that `"Presentation"` (singular typo) maps to `"Presentations"` (plural)
  - Rows with types not in this map (Teaching Assistant, Credential, Coding Project, Pizza, empty) have no micro.blog category and should be skipped
  - If the `?q=source` query returns null/empty content (happens for rescheduled posts whose column H URL is stale), log a warning and skip that row — do not attempt to restore a URL that micro.blog can't find
  - If category is empty and a valid mapping exists, restore via `POST /micropub` with `{ action: "update", url: microblogUrl, replace: { category: [mappedCategory] } }`
  - Include `--dry-run` flag and progress indicators
  - Run with cross-posting disabled
  - After running, micro.blog may need a manual site rebuild before the category pages update. If `/video/` and `/podcast/` are still empty after the script completes, trigger a rebuild at `https://micro.blog/account/logs` → Rebuild Site before assuming the script failed.
  - Success: `whitneylee.com/video/` and `whitneylee.com/podcast/` show their posts again; category confirmed non-empty on a sample of restored posts via Micropub source query

- [ ] M11: Remove duplicate images from posts that got two `<img>` tags (Decision 12 scope) — implement `src/deduplicate-post-images.js`:
  - Fetch all posts from micro.blog using the existing `queryMicroblogPosts()` approach in `src/sync-content.js` (paged `GET https://micro.blog/micropub?q=source` without a `url` param returns all posts); or iterate the production spreadsheet column H URLs and query each individually
  - For each post whose `properties.content[0]` contains two or more `<img` tags: strip all but the first `<img>` tag using a regex replace, then send `POST /micropub` with `{ action: "update", url: postUrl, replace: { content: [deduped] } }`
  - Dedup approach: keep only the first `<img>` tag, strip all others — use a counter: `let count = 0; const deduped = content.replace(/<img[^>]*>/g, m => count++ === 0 ? m : '')`
  - Include `--dry-run` flag and progress indicators
  - Run with cross-posting disabled
  - Success: no post has more than one `<img` tag in its content; verify by re-querying a sample of previously-duplicated posts

- [ ] M12: Add images to social posts missing them (Decision 13, 14) — implement `src/backfill-social-post-images.js`:
  - Social posts are uncategorized posts created by the dual-post strategy (category is `[]`, URL not in column H); they need images but the archive-based backfill never touched them
  - **Matching strategy**: Build a lookup map keyed by link URL from the production spreadsheet: for each row where `needsImage(row)` is true, map `row.link → row`. Then query all micro.blog posts; for each post with `category: []` and no `<img>` tag in content, check `properties.content[0]` for each key in the map using `content.includes(row.link)`. `formatPostContent` embeds the link as Markdown `[title](url)` — NOT as `href="..."` — so `content.includes(row.link)` is the correct check, not an href search. If a match is found, use that row's `row.link` to fetch the thumbnail. If `content` is null/empty, skip the post with a warning.
  - **Image addition**: upload buffer to `/micropub/media`, get hosted URL, then content-replace: `{ action: "update", url: postUrl, replace: { content: [existingContent + '\n\n<img src="' + hostedUrl + '">'] } }` — do NOT use `add: { photo }` (Decision 12)
  - Include `--dry-run` flag and progress indicators
  - Run with cross-posting disabled
  - Success: the April 20–24 presentation posts and other social posts in the main feed that correspond to spreadsheet rows with needsImage=true now display their thumbnail; verify by querying those post URLs via Micropub source

- [ ] M13: Re-enable cross-posting and verify end-to-end — after M9–M12 are complete:
  - Re-enable cross-posting to LinkedIn, Bluesky, and Mastodon in the micro.blog UI
  - Verify `whitneylee.com/video/`, `whitneylee.com/podcast/`, `whitneylee.com/presentations/` show posts correctly
  - Verify main feed shows images on career posts that should have them
  - Verify no posts have duplicate images
  - **Verify new post creation safety**: the M2 code in `createMicroblogPost` sends both `category` and `photo[]` in the same form-encoded POST for new posts. This was assumed safe (Decision 12) because category is explicitly set, but it has not been verified in production since M2 is still on the feature branch. After this branch is merged and the next daily sync runs, confirm that the first new career post created with a photo still appears on its category page (not stripped to Photos-only).
  - Tell the Claude Code session "Cross-posting is re-enabled" to mark this milestone complete

## Removal Execution Steps (Manual — M8)

These steps must be performed in order. **Run dry-run first to verify scope.**

1. **Disable micro.blog cross-posting**: In the micro.blog UI, go to Account → Edit Apps and disable cross-posting to LinkedIn, Bluesky, and Mastodon.
2. **Preview what will be removed**: `vals exec -f .vals.yaml -- node src/remove-tanzu-tuesday-images.js --dry-run`
3. **Run the removal script**: `vals exec -f .vals.yaml -- node src/remove-tanzu-tuesday-images.js`
4. **Re-enable micro.blog cross-posting**: Return to micro.blog cross-posting settings and re-enable all platforms.
5. **Tell the Claude Code session**: "Cross-posting is re-enabled." — this verbal confirmation is required to mark M8 complete.

**Implementation note**: The script uses content-replace (not `delete: ["photo"]`, which returns 500). The auth and endpoint are the same as M5, but `add: { photo }` is now known to strip categories (Decision 11) and must not be used. See Decision 10 for the correct approach.

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
| 2026-05-14 | Use content-replace to remove photos, not `delete: ["photo"]` | micro.blog's Micropub `delete: ["photo"]` returns 500 for all posts — photos are stored as `<img>` tags in `properties.content[0]`, not as a separate property, so there is nothing to delete. Instead: GET the post source, strip `<img[^>]*>` tags from the content string, send `{ action: "update", replace: { content: [stripped] } }`. This is consistent with how micro.blog stores photos (discovered in M6). |
| 2026-05-14 | `add: { photo }` Micropub action strips post categories on micro.blog (M9–M13) | Confirmed by querying multiple posts post-backfill: every post updated via `{ action: "update", add: { photo: [url] } }` now has `category: []`. This is why `/video/` and `/podcast/` pages are empty — all ~322 archive posts lost their categories. Root cause: micro.blog's implementation of the Micropub `add` operation for `photo` recategorizes the post as a photo post, clearing the original category as a side effect. |
| 2026-05-14 | Never use `add: { photo }` to add images to existing posts — always use content-replace (M9) | The safe approach for adding a photo to an existing post: GET source content via `?q=source`, append `<img src="url">` to `properties.content[0]`, send `{ action: "update", replace: { content: [newContent] } }`. This preserves category and all other properties. `createMicroblogPost` in `sync-content.js` is safe for new post creation (it explicitly sets both `category` and `photo[]` in the same form-encoded POST, so category is never dropped) — no change needed there. Only UPDATE operations on existing posts are affected. |
| 2026-05-14 | Dual-post strategy creates social posts not tracked in column H; they never got images (M12) | For past-dated rows, `sync-content.js` creates two posts: (1) archive post with backdate + category → URL written to column H; (2) social post with today's date + NO category → URL not tracked anywhere. The M5 backfill only ran against column H URLs (archive posts). Social posts — visible as the April 20–24 presentations and other entries in the main feed — were never backfilled and have no images. |
| 2026-05-14 | `"Presentation"` (singular) spreadsheet typo causes `needsImage` to skip that row (M9) | One row ("How Wendy's got to 99.95% availability") uses `"Presentation"` (singular) while all others use `"Presentations"` (plural). `needsImage` checks for `"Presentations"` only, so this row was silently excluded from the backfill. Fix: update `needsImage` to accept both spellings. |
