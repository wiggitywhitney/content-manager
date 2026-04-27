// ABOUTME: LinkedIn posting module using the REST API with OAuth access token auth.
// ABOUTME: Exports postToLinkedIn(post, {videoBuffer}), buildLinkedInWebUrl(urn), and checkTokenExpiry(expiresAt).

'use strict';

const LINKEDIN_API_BASE = 'https://api.linkedin.com';
// Format: YYYYMM — update when current version approaches sunset (~1 year after release)
const LINKEDIN_VERSION = '202603';
const WARNING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
 * Check whether the LinkedIn access token is nearing expiry and warn if so.
 * Refresh tokens are not available without LinkedIn partner approval, so a warning
 * is the signal to re-run the OAuth setup script before the token expires.
 *
 * @param {string|undefined} expiresAt - Unix timestamp in ms as a string (from LINKEDIN_TOKEN_EXPIRES_AT)
 */
function checkTokenExpiry(expiresAt) {
  if (!expiresAt) return;

  const expiresAtMs = parseInt(expiresAt, 10);
  const msRemaining = expiresAtMs - Date.now();

  if (msRemaining < WARNING_THRESHOLD_MS) {
    const daysRemaining = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
    console.warn(
      `[linkedin] WARNING: access token expires in ${daysRemaining} day(s). ` +
      'Re-run src/linkedin-oauth-setup.js to refresh before it expires.'
    );
  }
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
 * Post a social post to LinkedIn using OAuth access token authentication.
 *
 * @param {Object} post - Post object from the social posts queue
 * @param {string} post.postText - Text to post
 * @param {Buffer} [videoBuffer] - Optional video buffer for short posts
 * @returns {Promise<{postUrl: string}>} The URL of the created post
 */
async function postToLinkedIn(post, { videoBuffer } = {}) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;

  if (!accessToken) throw new Error('LINKEDIN_ACCESS_TOKEN environment variable is required');
  if (!personUrn) throw new Error('LINKEDIN_PERSON_URN environment variable is required');

  checkTokenExpiry(process.env.LINKEDIN_TOKEN_EXPIRES_AT);

  let videoUrn;
  if (videoBuffer) {
    videoUrn = await uploadVideoToLinkedIn(videoBuffer, personUrn, accessToken);
  }

  const body = {
    author: personUrn,
    commentary: post.postText,
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

module.exports = { postToLinkedIn, buildLinkedInWebUrl, checkTokenExpiry };
