// ABOUTME: LinkedIn posting module using the REST API with OAuth access token auth.
// ABOUTME: Exports postToLinkedIn(post, {videoBuffer, imageBuffer}), buildLinkedInWebUrl(urn), and checkTokenExpiry(expiresAt).

'use strict';

const LINKEDIN_API_BASE = 'https://api.linkedin.com';
// Format: YYYYMM — update when current version approaches sunset (~1 year after release)
const LINKEDIN_VERSION = '202603';
const WARNING_THRESHOLD_MS = 21 * 24 * 60 * 60 * 1000; // 21 days

// LinkedIn's `little` text format reserves 13 characters that must be backslash-escaped.
// Unescaped reserved chars silently drop all following text — API still returns 201.
// See .claude/rules/linkedin-api-gotchas.md for full details.
const LINKEDIN_RESERVED_CHARS = /[()[\]{}\@#*_~<>\\]/g;

function escapeLinkedInCommentary(text) {
  return text.replace(LINKEDIN_RESERVED_CHARS, '\\$&');
}

/**
 * Build a LinkedIn web URL from a post URN returned in the x-restli-id header.
 *
 * @param {string} urn - LinkedIn URN (e.g. 'urn:li:share:6844785523593134080')
 * @returns {string} Web URL for the post
 */
function buildLinkedInWebUrl(urn) {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

/**
 * Submit a gauge metric to Datadog reporting how many days until the LinkedIn token expires.
 * No-op when DD_API_KEY is not set. Fetch errors are logged as warnings and not re-thrown.
 *
 * @param {number} daysUntilExpiry - Days remaining until token expiry
 */
async function submitTokenExpiryMetric(daysUntilExpiry) {
  const apiKey = process.env.DD_API_KEY;
  if (!apiKey) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api.datadoghq.com/api/v2/series', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': apiKey,
      },
      body: JSON.stringify({
        series: [{
          metric: 'content_manager.linkedin.token_days_until_expiry',
          type: 3, // gauge
          points: [{ timestamp, value: daysUntilExpiry }],
          tags: ['service:content-manager'],
        }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`[linkedin] Warning: Datadog metric submission returned ${response.status}: ${text}`);
    }
  } catch (err) {
    console.warn(`[linkedin] Warning: failed to submit token expiry metric: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check whether the LinkedIn access token is nearing expiry and warn if so.
 * Also emits a Datadog gauge metric for the token countdown.
 * Refresh tokens are not available without LinkedIn partner approval, so a warning
 * is the signal to re-run the OAuth setup script before the token expires.
 *
 * @param {string|undefined} expiresAt - Unix timestamp in ms as a string (from LINKEDIN_TOKEN_EXPIRES_AT)
 */
async function checkTokenExpiry(expiresAt) {
  if (!expiresAt) return;

  const expiresAtMs = parseInt(expiresAt, 10);
  if (!Number.isFinite(expiresAtMs)) {
    console.warn('[linkedin] Warning: LINKEDIN_TOKEN_EXPIRES_AT is not a valid millisecond timestamp');
    return;
  }
  const msRemaining = expiresAtMs - Date.now();
  const daysRemaining = Math.floor(msRemaining / (24 * 60 * 60 * 1000));

  if (msRemaining < WARNING_THRESHOLD_MS) {
    console.warn(
      `[linkedin] WARNING: access token expires in ${daysRemaining} day(s). ` +
      'Re-run src/linkedin-oauth-setup.js to refresh before it expires.'
    );
  }

  await submitTokenExpiryMetric(daysRemaining);
}

/**
 * Upload a video to LinkedIn using the 4-step Videos API flow.
 * Returns the video URN to include in the post body.
 *
 * @param {Buffer} videoBuffer - Video file bytes
 * @param {string} personUrn - LinkedIn person URN for the authenticated user
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<string>} LinkedIn video URN (e.g. 'urn:li:video:...')
 */
async function uploadVideoToLinkedIn(videoBuffer, personUrn, accessToken) {
  console.log('[linkedin] Uploading video...'); // eslint-disable-line no-console
  const jsonHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };

  // Step 1: Initialize upload — get pre-signed upload URLs and video URN
  const initRes = await fetch(`${LINKEDIN_API_BASE}/rest/videos?action=initializeUpload`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
        fileSizeBytes: videoBuffer.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (!initRes.ok) {
    throw new Error(`LinkedIn video initializeUpload failed: ${initRes.status}`);
  }
  const { value: uploadData } = await initRes.json();
  const videoUrn = uploadData.video;
  const uploadToken = uploadData.uploadToken;
  const uploadInstructions = uploadData.uploadInstructions;
  if (!Array.isArray(uploadInstructions)) {
    throw new Error(`LinkedIn initializeUpload response missing uploadInstructions: ${JSON.stringify(uploadData)}`);
  }

  // Step 2: Upload each part to the pre-signed URL, collect ETags
  const uploadedPartIds = [];
  for (const { uploadUrl, firstByte, lastByte } of uploadInstructions) {
    const chunk = videoBuffer.subarray(firstByte, lastByte + 1); // lastByte is inclusive
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunk,
    });
    if (!putRes.ok) {
      throw new Error(`LinkedIn video chunk upload failed: ${putRes.status}`);
    }
    const rawEtag = putRes.headers.get('etag');
    if (!rawEtag) {
      throw new Error('LinkedIn video chunk upload missing ETag header');
    }
    const etag = rawEtag.replace(/"/g, ''); // strip surrounding quotes
    uploadedPartIds.push(etag);
  }

  // Step 3: Finalize upload
  const finalizeRes = await fetch(`${LINKEDIN_API_BASE}/rest/videos?action=finalizeUpload`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds },
    }),
  });
  if (!finalizeRes.ok) {
    throw new Error(`LinkedIn video finalizeUpload failed: ${finalizeRes.status}`);
  }

  // Step 4: Poll until AVAILABLE — creating a post before this returns 400
  const MAX_POLLS = 40; // ~2 minutes at 3s intervals
  let pollCount = 0;
  const encodedUrn = encodeURIComponent(videoUrn);
  while (true) {
    if (++pollCount > MAX_POLLS) {
      throw new Error(`LinkedIn video processing timed out after ${MAX_POLLS * 3} seconds`);
    }
    const pollRes = await fetch(`${LINKEDIN_API_BASE}/rest/videos/${encodedUrn}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Linkedin-Version': LINKEDIN_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!pollRes.ok) {
      throw new Error(`LinkedIn video status poll failed: ${pollRes.status}`);
    }
    const { status } = await pollRes.json();
    if (status === 'AVAILABLE') break;
    if (status === 'PROCESSING_FAILED') {
      throw new Error('LinkedIn video processing failed');
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  return videoUrn;
}

/**
 * Upload an image to LinkedIn using the Images API (single-part PUT, no finalize step).
 * Returns the image URN to include in the post body.
 *
 * @param {Buffer} imageBuffer - Image file bytes (JPEG)
 * @param {string} personUrn - LinkedIn person URN for the authenticated user
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<string>} LinkedIn image URN (e.g. 'urn:li:image:...')
 */
async function uploadImageToLinkedIn(imageBuffer, personUrn, accessToken) {
  console.log('[linkedin] Uploading image...'); // eslint-disable-line no-console
  const jsonHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };

  // Step 1: Initialize upload — get pre-signed upload URL and image URN
  const initRes = await fetch(`${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      initializeUploadRequest: { owner: personUrn },
    }),
  });
  if (!initRes.ok) {
    throw new Error(`LinkedIn image initializeUpload failed: ${initRes.status}`);
  }
  const { value: uploadData } = await initRes.json();
  const imageUrn = uploadData.image;
  const uploadUrl = uploadData.uploadUrl;
  if (!imageUrn || !uploadUrl) {
    throw new Error(`LinkedIn image initializeUpload response missing fields: ${JSON.stringify(uploadData)}`);
  }

  // Step 2: Single-part PUT — images are synchronous, no finalize or polling needed
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: imageBuffer,
  });
  if (!putRes.ok) {
    throw new Error(`LinkedIn image upload failed: ${putRes.status}`);
  }

  return imageUrn;
}

/**
 * Post a social post to LinkedIn using OAuth access token authentication.
 *
 * @param {Object} post - Post object from the social posts queue
 * @param {string} post.postText - Text to post
 * @param {Object} [options] - Optional posting options
 * @param {Buffer} [options.videoBuffer] - Optional video buffer for short posts
 * @param {Buffer} [options.imageBuffer] - Optional image buffer for episode posts
 * @returns {Promise<{postUrl: string}>} The URL of the created post
 */
async function postToLinkedIn(post, { videoBuffer, imageBuffer } = {}) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;

  if (!accessToken) throw new Error('LINKEDIN_ACCESS_TOKEN environment variable is required');
  if (!personUrn) throw new Error('LINKEDIN_PERSON_URN environment variable is required');

  await checkTokenExpiry(process.env.LINKEDIN_TOKEN_EXPIRES_AT);

  let videoUrn;
  if (videoBuffer) {
    videoUrn = await uploadVideoToLinkedIn(videoBuffer, personUrn, accessToken);
  }

  let imageUrn;
  if (imageBuffer && !videoBuffer) {
    imageUrn = await uploadImageToLinkedIn(imageBuffer, personUrn, accessToken);
  }

  const body = {
    author: personUrn,
    commentary: escapeLinkedInCommentary(post.postText),
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  if (videoUrn) {
    body.content = { media: { title: 'Short video', id: videoUrn } };
  } else if (imageUrn) {
    const mediaContent = { id: imageUrn };
    if (post.altText) mediaContent.altText = post.altText;
    body.content = { media: mediaContent };
  }

  const response = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Linkedin-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status !== 201) {
    const text = await response.text();
    throw new Error(`LinkedIn API returned ${response.status}: ${text}`);
  }

  const urn = response.headers.get('x-restli-id');
  if (!urn) {
    throw new Error('LinkedIn API returned 201 but x-restli-id header was missing');
  }

  return { postUrl: buildLinkedInWebUrl(urn) };
}

module.exports = { postToLinkedIn, buildLinkedInWebUrl, checkTokenExpiry, submitTokenExpiryMetric };
