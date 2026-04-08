// ABOUTME: Daily cron entry point for social post publishing.
// ABOUTME: Reads pending posts from the Social Posts Queue tab and dispatches to each platform poster.

'use strict';

const { fetchPendingPostsForToday } = require('./social-posts-queue');
const { checkCareerPostedToday } = require('./career-post-guard');
const { postToBluesky } = require('./post-bluesky');
const { postToMastodon } = require('./post-mastodon');
const { postToLinkedIn } = require('./post-linkedin');
const { scanAndPostShorts } = require('./post-microblog');
const { updatePostResult } = require('./update-social-post-status');

function getTodayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Dispatch a single post to all of its specified platforms.
 * Collects all results before writing to the sheet so that a failure on one
 * platform cannot overwrite a success written by an earlier platform.
 *
 * @param {Object} post - Parsed post object from the social posts queue
 * @param {string} spreadsheetId - The social posts sheet ID
 */
async function dispatchPost(post) {
  let failureCount = 0;
  let attemptCount = 0;
  let bskyPostUrl, mastodonPostUrl, linkedinPostUrl;

  if (post.platforms.includes('bluesky')) {
    attemptCount++;
    try {
      ({ postUrl: bskyPostUrl } = await postToBluesky(post));
      console.log(`[social] Posted row ${post.rowIndex} to Bluesky: ${bskyPostUrl}`); // eslint-disable-line no-console
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to Bluesky: ${err.message}`); // eslint-disable-line no-console
      failureCount++;
    }
  }

  if (post.platforms.includes('mastodon')) {
    attemptCount++;
    try {
      ({ postUrl: mastodonPostUrl } = await postToMastodon(post));
      console.log(`[social] Posted row ${post.rowIndex} to Mastodon: ${mastodonPostUrl}`); // eslint-disable-line no-console
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to Mastodon: ${err.message}`); // eslint-disable-line no-console
      failureCount++;
    }
  }

  if (post.platforms.includes('linkedin')) {
    attemptCount++;
    try {
      ({ postUrl: linkedinPostUrl } = await postToLinkedIn(post));
      console.log(`[social] Posted row ${post.rowIndex} to LinkedIn: ${linkedinPostUrl}`); // eslint-disable-line no-console
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to LinkedIn: ${err.message}`); // eslint-disable-line no-console
      failureCount++;
    }
  }

  if (attemptCount === 0) return;

  const status = failureCount === 0 ? 'posted' : 'failed';
  const resultFields = { status };
  if (bskyPostUrl) resultFields.bskyPostUrl = bskyPostUrl;
  if (mastodonPostUrl) resultFields.mastodonPostUrl = mastodonPostUrl;
  if (linkedinPostUrl) resultFields.linkedinPostUrl = linkedinPostUrl;

  await updatePostResult(post.rowIndex, resultFields);
}

/**
 * Fetch and dispatch all pending social posts due on a given date.
 * Exported for testability.
 *
 * @param {string} today - Date in YYYY-MM-DD format
 */
async function processPostsForDate(today) {
  if (await checkCareerPostedToday()) {
    return;
  }

  const pendingPosts = await fetchPendingPostsForToday(today);

  if (pendingPosts.length === 0) {
    console.log('[social] No posts due today'); // eslint-disable-line no-console
    return;
  }

  console.log(`[social] Found ${pendingPosts.length} post(s) due today`); // eslint-disable-line no-console
  for (const post of pendingPosts) {
    console.log(`[social]   Row ${post.rowIndex}: [${post.platforms.join(',')}] ${post.title} (${post.postType})`); // eslint-disable-line no-console
  }

  for (const post of pendingPosts) {
    await dispatchPost(post);
  }
}

async function main() {
  const today = getTodayDate();
  console.log(`[social] Checking queue for posts due ${today}`); // eslint-disable-line no-console

  try {
    await processPostsForDate(today);
  } catch (err) {
    console.error('[social] Failed to read social posts queue:', err.message); // eslint-disable-line no-console
    process.exit(1);
  }

  try {
    await scanAndPostShorts();
  } catch (err) {
    console.error('[social] micro.blog short scan failed:', err.message); // eslint-disable-line no-console
    // Non-fatal: regular platform dispatch already completed
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('[social] Unexpected error:', err.message); // eslint-disable-line no-console
    process.exit(1);
  });
}

module.exports = { processPostsForDate };
