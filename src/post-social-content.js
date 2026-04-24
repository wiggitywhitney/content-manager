// ABOUTME: Daily cron entry point for social post publishing.
// ABOUTME: Reads pending posts from the Social Posts Queue tab and dispatches to each platform poster.

'use strict';

const { fetchOldestPendingPost } = require('./social-posts-queue');
const { checkCareerPostedToday } = require('./career-post-guard');
const { postToBluesky } = require('./post-bluesky');
const { postToMastodon } = require('./post-mastodon');
const { postToLinkedIn } = require('./post-linkedin');
const { scanAndPostShorts, postToMicroblog } = require('./post-microblog');
const { updatePostResult } = require('./update-social-post-status');

/**
 * Return today's date as a YYYY-MM-DD string in UTC.
 *
 * @returns {string}
 */
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
async function dispatchPost(post, today) {
  let failureCount = 0;
  let attemptCount = 0;
  let bskyPostUrl, mastodonPostUrl, linkedinPostUrl, microblogPostUrl;

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

  if (post.platforms.includes('micro.blog') && post.postType !== 'short') {
    attemptCount++;
    try {
      ({ postUrl: microblogPostUrl } = await postToMicroblog(post, { bypassViewCount: true }));
      console.log(`[social] Posted row ${post.rowIndex} to micro.blog: ${microblogPostUrl}`); // eslint-disable-line no-console
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to micro.blog: ${err.message}`); // eslint-disable-line no-console
      failureCount++;
    }
  }

  if (attemptCount === 0) return;

  const status = failureCount === 0 ? 'posted' : 'failed';
  const resultFields = { status };
  if (status === 'posted' && today) resultFields.scheduledDate = today;
  if (bskyPostUrl) resultFields.bskyPostUrl = bskyPostUrl;
  if (mastodonPostUrl) resultFields.mastodonPostUrl = mastodonPostUrl;
  if (linkedinPostUrl) resultFields.linkedinPostUrl = linkedinPostUrl;
  if (microblogPostUrl) resultFields.microblogPostUrl = microblogPostUrl;

  await updatePostResult(post.rowIndex, resultFields);
}

/**
 * Fetch and dispatch the oldest pending social post.
 * On career-priority days (odd day of month, CAREER_PRIORITY=1), defers if career posted today.
 * On social-priority days (even day of month, CAREER_PRIORITY=0), posts regardless of career.
 * Exported for testability.
 *
 * @param {string} today - Date in YYYY-MM-DD format
 */
async function processPostsForDate(today) {
  const careerFirst = process.env.CAREER_PRIORITY !== '0';

  if (careerFirst && await checkCareerPostedToday()) {
    console.log('[social] Career-priority day — skipping social dispatch (career posted today)'); // eslint-disable-line no-console
    return;
  }

  const post = await fetchOldestPendingPost();

  if (!post) {
    console.log('[social] No pending posts in queue'); // eslint-disable-line no-console
    return;
  }

  console.log(`[social] Dispatching oldest pending post — Row ${post.rowIndex}: [${post.platforms.join(',')}] ${post.title} (${post.postType})`); // eslint-disable-line no-console
  await dispatchPost(post, today);
}

/**
 * Entry point: read today's date, run the social post queue, then run the micro.blog short scan.
 */
async function main() {
  const today = getTodayDate();
  console.log(`[social] Checking queue for posts due ${today}`); // eslint-disable-line no-console

  try {
    await processPostsForDate(today);
  } catch (err) {
    console.error('[social] Failed to read social posts queue:', err.message); // eslint-disable-line no-console
    process.exit(1);
  }

  // Career > social priority: also skip the micro.blog short scan if career posted today
  const careerPostedToday = await checkCareerPostedToday().catch(() => false);
  if (!careerPostedToday) {
    try {
      await scanAndPostShorts();
    } catch (err) {
      console.error('[social] micro.blog short scan failed:', err.message); // eslint-disable-line no-console
      // Non-fatal: regular platform dispatch already completed
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('[social] Unexpected error:', err.message); // eslint-disable-line no-console
    process.exit(1);
  });
}

module.exports = { processPostsForDate };
