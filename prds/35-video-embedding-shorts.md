# PRD: Video Embedding for YouTube Shorts

**Issue**: [#35](https://github.com/wiggitywhitney/content-manager/issues/35)
**Status**: In Progress
**Priority**: Medium
**Created**: 2026-04-25
**Last Updated**: 2026-04-25

## Problem Statement

Short posts dispatched from the Social Posts Queue currently post as text + a YouTube URL. On Bluesky, Mastodon, and LinkedIn, followers see a bare link rather than an inline playing video. This undersells the content — embedded video plays in the feed without requiring a click-through.

Micro.blog already handles this correctly via Micropub media upload. The gap is the three remaining platforms.

## Solution Overview

When the social post dispatcher encounters a `post_type = short` row, it downloads the YouTube short via yt-dlp (already used for Micro.blog), then uploads the video buffer to each platform's media API so the video embeds inline. The download happens once in the dispatcher and the buffer is passed to each platform poster.

## Architecture

### Key Design Decisions

**Download once in the dispatcher, not per-platform.** `dispatchPost()` in `post-social-content.js` downloads the video once when `post.postType === 'short'`, then passes the buffer to each platform poster. This avoids redundant yt-dlp calls and ensures all platforms get the identical file.

**Shared download utility.** `downloadShortVideo()` currently lives as a private function in `src/post-microblog.js`. Extract it to `src/video-download.js` so all platform posters can import from a single source. Update `post-microblog.js` to import from the shared module.

**Platform posters receive optional `videoBuffer`.** Each poster's signature becomes `postToPlatform(post, { videoBuffer } = {})`. If `videoBuffer` is provided, embed the video. If not, post text only. This keeps backwards compatibility and makes each poster independently testable.

**Hard failure on download error, no text-only fallback.** Per project conventions, code fails explicitly. If yt-dlp download fails for a short post, the dispatch fails and the row is marked `failed`. No silent fallback to text-only.

### Aspect Ratio

All YouTube Shorts are vertical 9:16. Hardcode `{ width: 9, height: 16 }` in the Bluesky embed. Make it a constant so it can be updated without hunting through the code.

## Implementation Milestones

### Milestone 1: Extract shared video download utility

**Step 0:** Read related research before starting: [Research: Video Upload APIs](../docs/research/video-upload-apis.md)

- [x] Create `src/video-download.js` that exports `downloadShortVideo(youtubeUrl, tmpDir)` — move the function from `post-microblog.js` as-is, no behavior changes
- [x] Update `post-microblog.js` to import `downloadShortVideo` from `src/video-download.js`
- [x] Verify all existing `post-microblog.js` tests still pass after the refactor

**Success criteria**: All existing Micro.blog tests pass. `downloadShortVideo` is importable from `src/video-download.js`.

**Codebase context**: The function signature is `function downloadShortVideo(youtubeUrl, tmpDir)` — it returns `{ buffer, mimeType: 'video/mp4', filename: 'video.mp4' }`. It uses yt-dlp via child_process exec with the format selector from `docs/research/yt-dlp-format-selectors.md`. Copy it exactly — do not alter behavior. Do NOT add an ABOUTME header to the new file before reading the existing one — the header style must match project conventions.

---

### Milestone 2: Video download in dispatcher for short posts

**Step 0:** Read related research before starting: [Research: Video Upload APIs](../docs/research/video-upload-apis.md)

- [x] In `dispatchPost()` in `post-social-content.js`, before calling platform posters, check if `post.postType === 'short'`
- [x] If short: call `downloadShortVideo(post.youtubeUrl, tmpDir)` from the shared utility; store the resulting `{ buffer, mimeType }` in a local variable
- [x] Pass `{ videoBuffer: buffer }` as the second argument to each platform poster call that supports it (`postToBluesky`, `postToMastodon`, `postToLinkedIn`)
- [x] Clean up the temp directory in a `finally` block so cleanup runs on both success and failure
- [x] If download throws, call `updatePostResult(post.rowIndex, { status: 'failed' })` and return — do not continue with any platform dispatch

**Success criteria**: For a `post_type = short` row, `dispatchPost` downloads the video once and passes the buffer to all three platform posters. Temp directory is always cleaned up.

---

### Milestone 3: Bluesky video embed

**Step 0:** Read related research before starting: [Research: Video Upload APIs](../docs/research/video-upload-apis.md)

- [x] In `postToBluesky(post, { videoBuffer } = {})`, when `videoBuffer` is provided:
  1. Acquire a scoped service token via `agent.com.atproto.server.getServiceAuth` with `lxm: 'com.atproto.repo.uploadBlob'` and 30-minute expiry
  2. POST the buffer to `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo` with query params `did` and `name=video.mp4`; use the service token in `Authorization: Bearer`
  3. Poll `app.bsky.video.getJobStatus({ jobId })` on the `video.bsky.app` agent until `jobStatus.blob` is populated
  4. Include `embed: { $type: 'app.bsky.embed.video', video: blob, aspectRatio: { width: 9, height: 16 } }` in the `agent.post()` call
- [x] When `videoBuffer` is not provided, post text only (existing behavior unchanged)
- [x] Write unit tests: video path calls the upload flow; text-only path skips it

**Codebase context**: `post-bluesky.js` imports `BskyAgent` from `@atproto/api` and creates `const agent = new BskyAgent({ service: BSKY_SERVICE })` inside `postToBluesky`. For polling job status, create a separate `AtpAgent` (also from `@atproto/api`) pointed at `https://video.bsky.app` — do NOT reuse the `BskyAgent`. `agent.session.did` is available after `agent.login()`. Add new tests to `test/post-bluesky.test.js` (not `tests/`). The `videoBuffer` arrives from `dispatchPost()` in `post-social-content.js` — Milestone 2 is already complete.

**Critical gotchas** (from research):
- The video service is `video.bsky.app`, NOT the user's PDS — the session JWT is rejected; must use `getServiceAuth`
- `aspectRatio` is required — omitting it silently breaks the embed
- `getServiceAuth` scope must be `'com.atproto.repo.uploadBlob'` exactly
- Do NOT add the `AtpAgent` import if `BskyAgent` already covers it — check whether `@atproto/api` exports both before adding a second import line

**Implementation notes (from Milestone 3 execution)**:
- `@atproto/api`'s `AtpAgent` does NOT have `app.bsky.video` namespace in the installed version — use `fetch()` directly for both the upload POST and the job status poll GET. Do NOT attempt `videoAgent.app.bsky.video.getJobStatus()`.
- `agent.dispatchUrl` is `undefined` — hardcode `aud: 'did:web:video.bsky.app'` in `getServiceAuth`. The `aud` is the video service's DID, not the user's PDS DID.
- `agent.session.did` IS available after `agent.login()`. Use it to build the upload URL query param.

**Success criteria**: A `post_type = short` post on Bluesky embeds the video inline. Unit tests cover both paths.

---

### Milestone 4: Mastodon video embed

**Step 0:** Read related research before starting: [Research: Video Upload APIs](../docs/research/video-upload-apis.md)

- [x] In `postToMastodon(post, { videoBuffer } = {})`, when `videoBuffer` is provided:
  1. Call `masto.v2.media.create({ file: new Blob([videoBuffer], { type: 'video/mp4' }), description: post.altText })`
  2. Poll `masto.v1.mediaAttachments.$select(attachment.id).fetch()` every 2 seconds until `.url` is populated (video processing is async — upload returns 202)
  3. Include `mediaIds: [attachment.id]` in the `masto.v1.statuses.create()` call
- [x] When `videoBuffer` is not provided, post text only (existing behavior unchanged)
- [x] Write unit tests: video path calls upload + poll + attaches mediaId; text-only path skips it

**Codebase context**: `post-mastodon.js` creates `const masto = createRestAPIClient({ url: instanceUrl, accessToken })` inside `postToMastodon`. Use this same `masto` client for the v2 media upload — do not create a second client. Add new tests to `test/post-mastodon.test.js`. masto.js has ESM-only transitive deps — Jest auto-mock fails; the existing test file already uses a manual factory (`jest.mock('masto', () => ...)`). The `videoBuffer` arrives from `dispatchPost()` — Milestone 2 is already complete.

**Critical gotchas** (from research):
- Always use `masto.v2.media.create`, not v1 — v1 is deprecated for uploads
- Video returns 202 with `url: null` — must poll; do not use the attachment immediately
- Use `new Blob([videoBuffer])`, NOT `fs.createReadStream()` — masto.js v7 uses web Fetch, streams are rejected

**Success criteria**: A `post_type = short` post on Mastodon embeds the video inline. Unit tests cover both paths.

---

### Milestone 5: LinkedIn video embed

**Step 0:** Read related research before starting: [Research: Video Upload APIs](../docs/research/video-upload-apis.md)

- [ ] In `postToLinkedIn(post, { videoBuffer } = {})`, when `videoBuffer` is provided, implement the 4-step flow:
  1. `POST /rest/videos?action=initializeUpload` with `{ owner: personUrn, fileSizeBytes, uploadCaptions: false, uploadThumbnail: false }` — returns `video` URN + `uploadInstructions` array
  2. For each instruction in `uploadInstructions`: `PUT` the buffer slice (`firstByte` to `lastByte + 1`, inclusive) to the `uploadUrl`; save the `etag` response header value (strip surrounding quotes)
  3. `POST /rest/videos?action=finalizeUpload` with `{ video: videoUrn, uploadToken, uploadedPartIds: [etags...] }`
  4. Poll `GET /rest/videos/{encodedUrn}` every 3 seconds until `status === "AVAILABLE"`; throw if `PROCESSING_FAILED`
  5. Include `content: { media: { title: 'Short video', id: videoUrn } }` in the post body
- [ ] When `videoBuffer` is not provided, post text only (existing behavior unchanged)
- [ ] Write unit tests: video path runs all 4 steps; text-only path skips them; ETag stripping is correct

**Codebase context**: `post-linkedin.js` reads `personUrn` from `process.env.LINKEDIN_PERSON_URN` and `accessToken` from `process.env.LINKEDIN_ACCESS_TOKEN`. The constant `LINKEDIN_VERSION = '202603'` and `LINKEDIN_API_BASE = 'https://api.linkedin.com'` are already defined at the top of the file — use them, do not hardcode the version string inline. Add new tests to `test/post-linkedin.test.js`. The `videoBuffer` arrives from `dispatchPost()` — Milestone 2 is already complete.

**Critical gotchas** (from research):
- Must poll for `AVAILABLE` before creating the post — creating it while `WAITING_UPLOAD` returns 400
- ETags come back with surrounding quotes (`"abc123"`) — strip them before including in `uploadedPartIds`
- `lastByte` is inclusive — use `buffer.subarray(firstByte, lastByte + 1)` not `lastByte`
- `uploadToken` is often empty string in the response — pass it through as-is
- This is the Videos API (`/rest/videos`), not the deprecated Assets API — do not use `registerUpload` / `completeMultiPartUpload`

**Success criteria**: A `post_type = short` post on LinkedIn embeds the video inline. Unit tests cover all 4 steps and the text-only path.

---

### Milestone 6: Integration tests and documentation

- [ ] Run `npm test` — all existing tests pass, new tests from Milestones 1–5 pass
- [ ] Update PROGRESS.md with feature-level entry
- [ ] Verify that `downloadShortVideo` is not duplicated between `src/video-download.js` and `src/post-microblog.js` (only defined in one place)

**Success criteria**: Full test suite green. No duplicate download logic.

## Success Criteria

### Functional Requirements
- [ ] YouTube Short posts on Bluesky, Mastodon, and LinkedIn display the video inline in the feed
- [ ] Micro.blog behavior is unchanged (already embeds video)
- [ ] Non-short posts (`post_type = episode`) are unaffected — still post text only
- [ ] If video download fails, the row is marked `failed` and no platform receives the post

### Non-Functional Requirements
- [ ] Video is downloaded once per dispatch run, not once per platform
- [ ] Temp files are cleaned up after each dispatch (success or failure)
- [ ] Platform posters remain independently testable with mock buffers

## Dependencies & Risks

### Dependencies
- yt-dlp installed and accessible in the execution environment (already required by Micro.blog posting)
- Bluesky account email must be verified to upload video
- LinkedIn access token (`w_member_social`) — same permission already used for text posts

### Risks
- **Bluesky daily video limits**: Exact limit not published; shorts posted daily could hit it. Monitor for errors.
- **Mastodon instance limits**: Hachyderm uses standard ~99MB limit. YouTube Shorts are typically <50MB so this should be fine.
- **LinkedIn processing time**: Processing can take 10–30 seconds. Poll interval of 3 seconds with a reasonable timeout (2 minutes) is appropriate.
- **yt-dlp format availability**: Shorts occasionally have download issues. Already handled by existing error handling in `downloadShortVideo`.

## Design Notes

- The feature PR created by `/prd-done` needs the `run-acceptance` label to trigger acceptance gate CI. This is handled automatically by `/prd-done` when acceptance gate tests are detected.
- Research for all three platforms is in [docs/research/video-upload-apis.md](../docs/research/video-upload-apis.md) — read it before starting any milestone.
- Full gotchas reference: `~/.claude/rules/social-video-upload-gotchas.md`
