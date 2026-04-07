// ABOUTME: Bluesky posting module using @atproto/api with app password authentication.
// ABOUTME: Exports postToBluesky(post) and buildBskyWebUrl(handle, uri) helpers.

'use strict';

const { BskyAgent } = require('@atproto/api');

const BSKY_SERVICE = 'https://bsky.social';

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

/**
 * Post a social post to Bluesky using app password authentication.
 *
 * @param {Object} post - Post object from the social posts queue
 * @param {string} post.postText - Text to post
 * @returns {Promise<{postUrl: string}>} The URL of the created post
 */
async function postToBluesky(post) {
  const handle = process.env.BLUESKY_HANDLE;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;

  if (!handle) throw new Error('BLUESKY_HANDLE environment variable is required');
  if (!appPassword) throw new Error('BLUESKY_APP_PASSWORD environment variable is required');

  const agent = new BskyAgent({ service: BSKY_SERVICE });
  await agent.login({ identifier: handle, password: appPassword });

  const result = await agent.post({ text: post.postText });
  const postUrl = buildBskyWebUrl(handle, result.uri);
  return { postUrl };
}

module.exports = { postToBluesky, buildBskyWebUrl };
