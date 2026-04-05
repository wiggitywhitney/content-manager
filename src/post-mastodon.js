// ABOUTME: Mastodon posting module using masto.js REST API client with access token auth.
// ABOUTME: Exports postToMastodon(post) helper.

'use strict';

const { createRestAPIClient } = require('masto');

/**
 * Post a social post to Mastodon using access token authentication.
 *
 * @param {Object} post - Post object from the social posts queue
 * @param {string} post.postText - Text to post
 * @returns {Promise<{postUrl: string}>} The URL of the created status
 */
async function postToMastodon(post) {
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;
  const instanceUrl = process.env.MASTODON_INSTANCE_URL;

  if (!accessToken) throw new Error('MASTODON_ACCESS_TOKEN environment variable is required');
  if (!instanceUrl) throw new Error('MASTODON_INSTANCE_URL environment variable is required');

  const masto = createRestAPIClient({ url: instanceUrl, accessToken });
  const status = await masto.v1.statuses.create({
    status: post.postText,
    visibility: 'public',
  });

  return { postUrl: status.url };
}

module.exports = { postToMastodon };
