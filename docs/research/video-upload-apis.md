# Research: Video Upload APIs — Bluesky, Mastodon, LinkedIn

**Project:** content-manager
**Last Updated:** 2026-04-25

## Update Log

| Date | Summary |
|------|---------|
| 2026-04-25 | Initial research — video embed for social short posts (Bluesky, Mastodon, LinkedIn) |

## Findings

### Summary

All three platforms support video upload and embedding. LinkedIn is genuinely complex (4-step flow). Bluesky requires a separate video service with its own token. Mastodon is straightforward but video processing is async. YouTube Shorts (≤60s, typically <50MB MP4) are well within every platform's size limits.

---

### Bluesky

**Flow**: service token → upload to video service → poll job → embed blob ref in post

**Source says:** "Unlike many other APIs, requests for video service-related APIs are made to the video service endpoint (https://video.bsky.app/xrpc/), and you must specify an authorization token acquired using com.atproto.server.getServiceAuth rather than a session JWT." ([Uploading Video | Bluesky](https://docs.bsky.app/docs/tutorials/video))

**Interpretation:** The `@atproto/api` agent handles PDS requests, but video upload goes to a completely separate service with a short-lived (30-min) scoped token. Use `fetch()` directly for the upload call. 🟢 High confidence

#### Step-by-step

```javascript
// 1. Get scoped service token (30-minute TTL)
const { data: serviceAuth } = await agent.com.atproto.server.getServiceAuth({
  aud: `did:web:${agent.dispatchUrl.host}`,
  lxm: 'com.atproto.repo.uploadBlob',
  exp: Math.floor(Date.now() / 1000) + 60 * 30,
});

// 2. Upload video to video.bsky.app (NOT the PDS)
const videoBuffer = fs.readFileSync(localVideoPath);
const uploadUrl = new URL('https://video.bsky.app/xrpc/app.bsky.video.uploadVideo');
uploadUrl.searchParams.set('did', agent.session.did);
uploadUrl.searchParams.set('name', 'video.mp4');

const uploadResponse = await fetch(uploadUrl.toString(), {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${serviceAuth.token}`,
    'Content-Type': 'video/mp4',
    'Content-Length': String(videoBuffer.length),
  },
  body: videoBuffer,
});
const { jobId } = await uploadResponse.json();

// 3. Poll job status until blob ref is ready
const videoAgent = new AtpAgent({ service: 'https://video.bsky.app' });
let blob;
while (!blob) {
  const { data } = await videoAgent.app.bsky.video.getJobStatus({ jobId });
  if (data.jobStatus.blob) { blob = data.jobStatus.blob; break; }
  await new Promise(r => setTimeout(r, 1000));
}

// 4. Post with video embed — aspectRatio is REQUIRED
await agent.post({
  text: postText,
  embed: {
    $type: 'app.bsky.embed.video',
    video: blob,
    aspectRatio: { width: 9, height: 16 }, // 9:16 for vertical shorts
  },
});
```

#### Gotchas

- **Different service, different token**: The video endpoint is `video.bsky.app`, NOT the user's PDS. Must use `getServiceAuth` — the session JWT is rejected.
- **`aspectRatio` is required**: Omitting it causes the embed to fail silently. For vertical shorts: `{ width: 9, height: 16 }`. Use `ffprobe` to get actual dimensions if needed.
- **Email verification required**: Bluesky-hosted accounts must have email verified before video upload is allowed. Returns an error otherwise.
- **`getServiceAuth` scope must be `com.atproto.repo.uploadBlob`**: Not a general token — it must name this specific lexicon.
- **Daily video post limits**: Enforced per account, exact number not published.
- **`already_exists` error is safe to ignore**: Can occur if the same video is uploaded twice; blob ref is still returned in job status.

#### Size/Format
MP4 required. No explicit file size limit in docs; YouTube Shorts (<50MB) are well within range. 🟡 Medium confidence (no official size limit found).

---

### Mastodon (masto.js v7)

**Flow**: upload media → wait for processing (async for video) → create status with mediaId

**Source says:** "Smaller media formats (image) will be processed synchronously and return 200 instead of 202. Larger media formats (video, gifv, audio) will continue to be processed asynchronously and return 202." ([Mastodon media API docs](https://docs.joinmastodon.org/methods/media/))

**Interpretation:** Video always returns 202 — code must poll until the attachment is ready. 🟢 High confidence

#### Step-by-step

```javascript
// 1. Upload video file
const attachment = await masto.v2.media.create({
  file: new Blob([fs.readFileSync(localVideoPath)], { type: 'video/mp4' }),
  description: altText, // accessibility text
});

// 2. Poll until processing complete (202 → 200 with url populated)
let ready = attachment;
while (!ready.url) {
  await new Promise(r => setTimeout(r, 2000));
  // GET /api/v1/media/:id — returns 206 while processing, 200 when done
  ready = await masto.v1.mediaAttachments.$select(attachment.id).fetch();
}

// 3. Create status with media attached
const status = await masto.v1.statuses.create({
  status: postText,
  visibility: 'public',
  mediaIds: [ready.id],
});
```

#### Gotchas

- **Always use `masto.v2.media.create`**, not `masto.v1.mediaAttachments.create` — the v1 endpoint is deprecated for uploads.
- **Video returns 202 — `.url` is `null`**: Do NOT use the attachment immediately. Must poll `masto.v1.mediaAttachments.$select(id).fetch()` until `.url` is populated. The poll response is 206 while processing, 200 when done.
- **Blob, not Stream**: Since masto.js moved to the web Fetch API, `fs.createReadStream()` is NOT supported. Must use `new Blob([fs.readFileSync(path)])`. 🟢 Confirmed from masto.js release notes and search results.
- **Node 20+ required**: masto.js v7.0.0 dropped Node 18 support entirely.
- **One video per post**: Mastodon only allows one video attachment per status.

#### Size/Format
- Formats: MP4, M4V, MOV, WebM
- Size: ~99MB default (instance-configurable — Hachyderm runs standard defaults)
- Resolution: 1920×1200 max
- Transcoding: H.264 MP4, max 1300kbps, 120fps

YouTube Shorts are well within limits. 🟢 High confidence.

---

### LinkedIn

**Flow**: initializeUpload → PUT parts to pre-signed URLs (save ETags) → finalizeUpload → poll status → POST /rest/posts

**Source says:** "Steps to upload a video: 1. Initialize Upload for Video 2. Split the file into 4 MB each. 3. Upload the Video 4. Finalize Video Upload" ([Videos API - LinkedIn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api))

**Source says (post with video):** `"content": { "media": { "title": "title of the video", "id": "urn:li:video:C5F10AQGKQg_6y2a4sQ" } }` ([Posts API - LinkedIn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api))

**Interpretation:** LinkedIn's flow is multi-step but the v2 Videos API (which replaced the Assets API) is simpler than the old flow. For small files (≤4MB), there is exactly one upload URL and one ETag. 🟢 High confidence

#### Step-by-step

```javascript
const videoBuffer = fs.readFileSync(localVideoPath);
const fileSizeBytes = videoBuffer.length;
const PART_SIZE = 4 * 1024 * 1024; // 4MB

// 1. Initialize upload — get pre-signed upload URLs and video URN
const initRes = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': '202603',
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    initializeUploadRequest: {
      owner: personUrn,   // e.g. "urn:li:person:{sub}"
      fileSizeBytes,
      uploadCaptions: false,
      uploadThumbnail: false,
    },
  }),
});
const { value: uploadData } = await initRes.json();
const videoUrn = uploadData.video;                          // "urn:li:video:..."
const uploadInstructions = uploadData.uploadInstructions;   // array of {uploadUrl, firstByte, lastByte}
const uploadToken = uploadData.uploadToken;                 // often empty string for small files

// 2. Upload parts via PUT, collect ETags
const uploadedPartIds = [];
for (const { uploadUrl, firstByte, lastByte } of uploadInstructions) {
  const chunk = videoBuffer.subarray(firstByte, lastByte + 1);
  const partRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: chunk,
  });
  // ETag header value (strip surrounding quotes)
  const etag = partRes.headers.get('etag').replace(/"/g, '');
  uploadedPartIds.push(etag);
}

// 3. Finalize upload
await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': '202603',
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds },
  }),
});

// 4. Poll video status until AVAILABLE (usually <30s for a short)
let available = false;
while (!available) {
  await new Promise(r => setTimeout(r, 3000));
  const statusRes = await fetch(
    `https://api.linkedin.com/rest/videos/${encodeURIComponent(videoUrn)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, 'Linkedin-Version': '202603', 'X-Restli-Protocol-Version': '2.0.0' } }
  );
  const { status } = await statusRes.json();
  if (status === 'AVAILABLE') available = true;
  if (status === 'PROCESSING_FAILED') throw new Error('LinkedIn video processing failed');
}

// 5. Create post referencing the video URN
const postRes = await fetch('https://api.linkedin.com/rest/posts', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': '202603',
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    author: personUrn,
    commentary: postText,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    content: { media: { title: 'Short video', id: videoUrn } },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }),
});
const postUrn = postRes.headers.get('x-restli-id');
```

#### Gotchas

- **Must poll for AVAILABLE before posting**: The post creation will fail (400 `MEDIA_ASSET_WAITING_UPLOAD`) if the video URN is used before processing completes.
- **ETag stripping**: The PUT response returns ETags with surrounding quotes (`"abc123"`). LinkedIn's finalizeUpload expects the value WITHOUT quotes.
- **`uploadToken` is often empty string**: For simple uploads it's blank in the response. Pass it through as-is — do not assume it needs to be populated.
- **Parts are 4MB each (`0` to `4194303` for first part)**: `lastByte` is inclusive. Use `subarray(firstByte, lastByte + 1)`.
- **`w_member_social` scope is sufficient**: Same permission as text posts. No additional scope needed for video.
- **PROCESSING_FAILED with no useful reason**: If the video codec or format is wrong, the reason field is sometimes vague. Always use MP4 (H.264).
- **Videos API replaced Assets API**: Old docs using `registerUpload` / `completeMultiPartUpload` are from the deprecated Assets API. Use `initializeUpload` / `finalizeUpload` from the Videos API.
- **No need to separately track `uploadToken` for YouTube Shorts**: For files <4MB the response has one upload instruction, one PUT, one ETag. Still must call finalize.

#### Size/Format
- Format: MP4 only
- Size: 75KB–500MB
- Length: 3 seconds–30 minutes

YouTube Shorts are well within limits. 🟢 High confidence.

---

### Platform Comparison

| Aspect | Bluesky | Mastodon | LinkedIn |
|--------|---------|----------|----------|
| Steps | 3 (token, upload, post) | 2 (upload, post) + async poll | 4 (init, upload parts, finalize, post) + async poll |
| Auth for upload | Special scoped token via getServiceAuth | Same OAuth token | Same OAuth token |
| Format | MP4 | MP4, M4V, MOV, WebM | MP4 only |
| Max size | Not documented | ~99MB (instance) | 500MB |
| Async processing | Yes — poll jobStatus | Yes — poll media until url populated | Yes — poll video until AVAILABLE |
| Key lib method | `agent.com.atproto.server.getServiceAuth` + `fetch()` | `masto.v2.media.create()` | `fetch()` directly |
| Aspect ratio | Required in embed | Not required | Not required |

### yt-dlp Integration

The existing `downloadShortVideo()` function in `src/post-microblog.js` already handles yt-dlp download and returns `{ buffer, mimeType: 'video/mp4', filename: 'video.mp4' }`. All three platform upload implementations can use this buffer directly — no changes to the download layer needed.

## Sources

- [Uploading Video | Bluesky](https://docs.bsky.app/docs/tutorials/video) — official Bluesky video upload tutorial with flow details
- [app.bsky.video.uploadVideo | Bluesky](https://docs.bsky.app/docs/api/app-bsky-video-upload-video) — endpoint reference
- [Bluesky video upload gist (mozzius)](https://gist.github.com/mozzius/5cbbd15e12cdc0cb1d0d992b7c3b1d0f) — TypeScript implementation example with token/poll/embed pattern
- [Videos API - LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2026-03) — initializeUpload/finalize flow, schema, ETags
- [Posts API - LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-03) — video post body shape (`content.media.id`)
- [Mastodon media API docs](https://docs.joinmastodon.org/methods/media/) — async upload behavior, 202 vs 200, polling pattern
- [masto.js create-new-status-with-image example](https://github.com/neet/masto.js/blob/main/examples/create-new-status-with-image.ts) — masto.v2.media.create + mediaIds in status
- [masto.js v7.0.0 release](https://github.com/neet/masto.js/releases/tag/v7.0.0) — Node 20+ requirement, Blob-only upload
