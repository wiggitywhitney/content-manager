// ABOUTME: Bluesky posting module using @atproto/api with app password authentication.
// ABOUTME: Exports postToBluesky(post, {videoBuffer}) and buildBskyWebUrl(handle, uri) helpers.

'use strict';

const { BskyAgent } = require('@atproto/api');

const BSKY_SERVICE = 'https://bsky.social';
const VIDEO_SERVICE = 'https://video.bsky.app';
const SHORTS_ASPECT_RATIO = { width: 9, height: 16 };

/**
 * Build a Bluesky web URL from a handle and an AT Protocol URI.
 *
 * @param {string} handle - Bluesky handle (e.g. 'whitney.bsky.social')
 * @param {string} uri - AT URI (e.g. 'at://did:plc:xxx/app.bsky.feed.post/rkey')
 * @returns {string} Web URL (e.g. 'https://bsky.app/profile/handle/post/rkey')
 */
function buildBskyWebUrl(handle, uri) {
  const rkey = uri.split('/').pop();
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

async function uploadVideoToBluesky(agent, videoBuffer) {
  console.log('[bluesky] Uploading video...'); // eslint-disable-line no-console
  const { data: serviceAuth } = await agent.com.atproto.server.getServiceAuth({
    aud: 'did:web:video.bsky.app',
    lxm: 'com.atproto.repo.uploadBlob',
    exp: Math.floor(Date.now() / 1000) + 60 * 30,
  });
  if (!serviceAuth?.token) {
    throw new Error('Protocol error: getServiceAuth returned no token');
  }

  const uploadUrl = `${VIDEO_SERVICE}/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(agent.session.did)}&name=video.mp4`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceAuth.token}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.length),
    },
    body: videoBuffer,
  });
  if (!uploadRes.ok) {
    throw new Error(`Bluesky video upload failed: ${uploadRes.status}`);
  }
  const { jobId } = await uploadRes.json();
  if (!jobId) {
    throw new Error('Protocol error: video upload response missing jobId');
  }

  let blob;
  const maxPolls = 120; // 2-minute ceiling at 1s intervals
  let pollCount = 0;
  while (!blob) {
    if (pollCount++ >= maxPolls) {
      throw new Error('Bluesky video processing timed out after 2 minutes');
    }
    const statusRes = await fetch(
      `${VIDEO_SERVICE}/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(jobId)}`
    );
    if (!statusRes.ok) {
      throw new Error(`Bluesky job status check failed: ${statusRes.status}`);
    }
    const { jobStatus } = await statusRes.json();
    if (!jobStatus || typeof jobStatus !== 'object') {
      throw new Error('Protocol error: job status response missing jobStatus');
    }
    if (jobStatus.state === 'failed' || jobStatus.error) {
      throw new Error(`Bluesky video processing failed: ${jobStatus.error ? JSON.stringify(jobStatus.error) : 'unknown error'}`);
    }
    if (jobStatus.blob) {
      blob = jobStatus.blob;
    } else {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return {
    $type: 'app.bsky.embed.video',
    video: blob,
    aspectRatio: SHORTS_ASPECT_RATIO,
  };
}

/**
 * Post a social post to Bluesky using app password authentication.
 *
 * @param {Object} post - Post object from the social posts queue
 * @param {string} post.postText - Text to post
 * @param {Object} [options] - Optional posting options
 * @param {Buffer} [options.videoBuffer] - Optional video buffer for short posts
 * @returns {Promise<{postUrl: string}>} The URL of the created post
 */
async function postToBluesky(post, { videoBuffer } = {}) {
  const handle = process.env.BLUESKY_HANDLE;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;

  if (!handle) throw new Error('BLUESKY_HANDLE environment variable is required');
  if (!appPassword) throw new Error('BLUESKY_APP_PASSWORD environment variable is required');

  const agent = new BskyAgent({ service: BSKY_SERVICE });
  await agent.login({ identifier: handle, password: appPassword });

  const postArgs = { text: post.postText };
  if (videoBuffer) {
    postArgs.embed = await uploadVideoToBluesky(agent, videoBuffer);
  }

  const result = await agent.post(postArgs);
  const postUrl = buildBskyWebUrl(handle, result.uri);
  return { postUrl };
}

module.exports = { postToBluesky, buildBskyWebUrl };
