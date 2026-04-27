// ABOUTME: Mastodon posting module using masto.js REST API client with access token auth.
// ABOUTME: Exports postToMastodon(post, {videoBuffer}) helper.

'use strict';

const { createRestAPIClient } = require('masto');

/**
 * Post a social post to Mastodon using access token authentication.
 *
 * @param {Object} post - Post object from the social posts queue
 * @param {string} post.postText - Text to post
 * @param {string} [post.altText] - Alt text for video attachment
 * @param {Buffer} [videoBuffer] - Optional video buffer for short posts
 * @returns {Promise<{postUrl: string}>} The URL of the created status
 */
async function postToMastodon(post, { videoBuffer } = {}) {
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;
  const instanceUrl = process.env.MASTODON_INSTANCE_URL;

  if (!accessToken) throw new Error('MASTODON_ACCESS_TOKEN environment variable is required');
  if (!instanceUrl) throw new Error('MASTODON_INSTANCE_URL environment variable is required');

  const masto = createRestAPIClient({ url: instanceUrl, accessToken });

  const statusArgs = {
    status: post.postText,
    visibility: 'public',
  };

  if (videoBuffer) {
    const attachment = await masto.v2.media.create({
      file: new Blob([videoBuffer], { type: 'video/mp4' }),
      description: post.altText,
    });

    // Video processing is async — upload returns 202 with url=null; poll until populated
    const MAX_POLLS = 60; // ~2 minutes at 2s intervals
    let ready = attachment;
    let pollCount = 0;
    while (!ready.url) {
      if (++pollCount > MAX_POLLS) {
        throw new Error(`Mastodon video processing timed out after ${MAX_POLLS * 2} seconds`);
      }
      await new Promise(r => setTimeout(r, 2000));
      ready = await masto.v1.mediaAttachments.$select(attachment.id).fetch();
    }

    statusArgs.mediaIds = [attachment.id];
  }

  const status = await masto.v1.statuses.create(statusArgs);
  return { postUrl: status.url };
}

module.exports = { postToMastodon };
