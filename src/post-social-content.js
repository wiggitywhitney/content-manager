// ABOUTME: Daily cron entry point for social post publishing.
// ABOUTME: Reads pending posts from the social queue sheet and dispatches to each platform poster.

'use strict';

const { fetchPendingPostsForToday } = require('./social-posts-queue');
const { postToBluesky } = require('./post-bluesky');
const { postToMastodon } = require('./post-mastodon');
const { postToLinkedIn } = require('./post-linkedin');
const { updatePostResult } = require('./update-social-post-status');

const SOCIAL_POSTS_SHEET_ID = process.env.SOCIAL_POSTS_SHEET_ID;

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
async function dispatchPost(post, spreadsheetId) {
  let failureCount = 0;
  let attemptCount = 0;
  let bskyPostUrl, mastodonPostUrl, linkedinPostUrl;

  if (post.platforms.includes('bluesky')) {
    attemptCount++;
    try {
      ({ postUrl: bskyPostUrl } = await postToBluesky(post));
      console.log(`[social] Posted row ${post.rowIndex} to Bluesky: ${bskyPostUrl}`);
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to Bluesky: ${err.message}`);
      failureCount++;
    }
  }

  if (post.platforms.includes('mastodon')) {
    attemptCount++;
    try {
      ({ postUrl: mastodonPostUrl } = await postToMastodon(post));
      console.log(`[social] Posted row ${post.rowIndex} to Mastodon: ${mastodonPostUrl}`);
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to Mastodon: ${err.message}`);
      failureCount++;
    }
  }

  if (post.platforms.includes('linkedin')) {
    attemptCount++;
    try {
      ({ postUrl: linkedinPostUrl } = await postToLinkedIn(post));
      console.log(`[social] Posted row ${post.rowIndex} to LinkedIn: ${linkedinPostUrl}`);
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to LinkedIn: ${err.message}`);
      failureCount++;
    }
  }

  if (attemptCount === 0) return;

  const status = failureCount === 0 ? 'posted' : 'failed';
  const resultFields = { status };
  if (bskyPostUrl) resultFields.bskyPostUrl = bskyPostUrl;
  if (mastodonPostUrl) resultFields.mastodonPostUrl = mastodonPostUrl;
  if (linkedinPostUrl) resultFields.linkedinPostUrl = linkedinPostUrl;

  await updatePostResult(spreadsheetId, post.rowIndex, resultFields);
}

/**
 * Fetch and dispatch all pending social posts due on a given date.
 * Exported for testability.
 *
 * @param {string} spreadsheetId - The social posts sheet ID
 * @param {string} today - Date in YYYY-MM-DD format
 */
async function processPostsForDate(spreadsheetId, today) {
  const pendingPosts = await fetchPendingPostsForToday(spreadsheetId, today);

  if (pendingPosts.length === 0) {
    console.log('[social] No posts due today');
    return;
  }

  console.log(`[social] Found ${pendingPosts.length} post(s) due today`);
  for (const post of pendingPosts) {
    console.log(`[social]   Row ${post.rowIndex}: [${post.platforms.join(',')}] ${post.title} (${post.postType})`);
  }

  for (const post of pendingPosts) {
    await dispatchPost(post, spreadsheetId);
  }
}

async function main() {
  if (!SOCIAL_POSTS_SHEET_ID) {
    console.log('[social] SOCIAL_POSTS_SHEET_ID not set — skipping social post publishing');
    process.exit(0);
  }

  const today = getTodayDate();
  console.log(`[social] Checking queue for posts due ${today}`);

  try {
    await processPostsForDate(SOCIAL_POSTS_SHEET_ID, today);
  } catch (err) {
    console.error('[social] Failed to read social posts queue:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('[social] Unexpected error:', err.message);
    process.exit(1);
  });
}

module.exports = { processPostsForDate };
