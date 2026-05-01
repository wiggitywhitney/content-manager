// ABOUTME: Daily cron entry point for social post publishing.
// ABOUTME: Reads pending posts from the Social Posts Queue tab and dispatches to each platform poster.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { fetchOldestPendingGroup, fetchOldestPendingMicroblogPost } = require('./social-posts-queue');
const { checkCareerPostedToday, checkAllCareerPostsPublished } = require('./career-post-guard');
const { postToBluesky } = require('./post-bluesky');
const { postToMastodon } = require('./post-mastodon');
const { postToLinkedIn } = require('./post-linkedin');
const { scanAndPostShorts, postToMicroblog } = require('./post-microblog');
const { updatePostResult } = require('./update-social-post-status');
const { downloadShortVideo } = require('./video-download');
const { fetchThumbnail } = require('./fetch-thumbnail');

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
 * When DRY_RUN=true, logs what would be dispatched and returns immediately.
 * Otherwise, collects all results before writing to the sheet so that a failure
 * on one platform cannot overwrite a success written by an earlier platform.
 *
 * @param {Object} post - Parsed post object from the social posts queue
 * @param {string} today - Date in YYYY-MM-DD format used for Column G write-back
 */
async function dispatchPost(post, today) {
  if (process.env.DRY_RUN === 'true') {
    console.log(`[social] DRY_RUN: Would dispatch row ${post.rowIndex} to [${post.platforms.join(',')}] (${post.postType}): ${post.title}`); // eslint-disable-line no-console
    return;
  }

  let tmpDir = null;
  let videoBuffer = null;
  let imageBuffer = null;
  let failureCount = 0;
  let attemptCount = 0;
  let bskyPostUrl, mastodonPostUrl, linkedinPostUrl, microblogPostUrl;

  try {
    if (post.postType === 'short') {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-'));
      try {
        ({ buffer: videoBuffer } = downloadShortVideo(post.youtubeUrl, tmpDir));
      } catch (err) {
        console.error(`[social] Failed to download video for row ${post.rowIndex}: ${err.message}`); // eslint-disable-line no-console
        await updatePostResult(post.rowIndex, { status: 'failed' });
        return;
      }
    }

    if (post.postType === 'episode' && post.youtubeUrl) {
      try {
        imageBuffer = await fetchThumbnail(post.youtubeUrl);
      } catch (err) {
        console.warn(`[social] Warning: thumbnail fetch failed for row ${post.rowIndex} — posting without image`); // eslint-disable-line no-console
        imageBuffer = null;
      }
    }

    if (post.platforms.includes('bluesky')) {
      attemptCount++;
      try {
        ({ postUrl: bskyPostUrl } = await postToBluesky(post, { videoBuffer, imageBuffer }));
        console.log(`[social] Posted row ${post.rowIndex} to Bluesky: ${bskyPostUrl}`); // eslint-disable-line no-console
      } catch (err) {
        console.error(`[social] Failed to post row ${post.rowIndex} to Bluesky: ${err.message}`); // eslint-disable-line no-console
        failureCount++;
      }
    }

    if (post.platforms.includes('mastodon')) {
      attemptCount++;
      try {
        ({ postUrl: mastodonPostUrl } = await postToMastodon(post, { videoBuffer, imageBuffer }));
        console.log(`[social] Posted row ${post.rowIndex} to Mastodon: ${mastodonPostUrl}`); // eslint-disable-line no-console
      } catch (err) {
        console.error(`[social] Failed to post row ${post.rowIndex} to Mastodon: ${err.message}`); // eslint-disable-line no-console
        failureCount++;
      }
    }

    if (post.platforms.includes('linkedin')) {
      attemptCount++;
      try {
        ({ postUrl: linkedinPostUrl } = await postToLinkedIn(post, { videoBuffer, imageBuffer }));
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

    if (attemptCount === 0) {
      console.warn(`[social] Row ${post.rowIndex} has no dispatchable platforms (platforms: [${post.platforms.join(',')}], type: ${post.postType}); marking failed to unblock queue`); // eslint-disable-line no-console
      await updatePostResult(post.rowIndex, { status: 'failed' });
      return;
    }

    const status = failureCount === 0 ? 'posted' : 'failed';
    const resultFields = { status };
    if (status === 'posted' && today) resultFields.scheduledDate = today;
    if (bskyPostUrl) resultFields.bskyPostUrl = bskyPostUrl;
    if (mastodonPostUrl) resultFields.mastodonPostUrl = mastodonPostUrl;
    if (linkedinPostUrl) resultFields.linkedinPostUrl = linkedinPostUrl;
    if (microblogPostUrl) resultFields.microblogPostUrl = microblogPostUrl;

    await updatePostResult(post.rowIndex, resultFields);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Fetch and dispatch the next eligible social post(s).
 *
 * Dispatch priority order:
 * 1. Career-priority check: when CAREER_PRIORITY env var is not '0', skip if career posted today.
 * 2. Non-micro.blog group: dispatch the oldest pending group of LinkedIn/Bluesky/Mastodon rows.
 *    If the group has a Group ID (col N), all rows sharing that ID post together in one run.
 * 3. Micro.blog fallback: only when the non-micro.blog queue is fully empty AND the career post
 *    backlog is cleared (no unpublished rows in the live spreadsheet). Then post one micro.blog row.
 *
 * Micro.blog rows from the social queue are held back because posting to micro.blog triggers
 * its cross-posting to LinkedIn/Bluesky/Mastodon, which would duplicate posts already sent
 * directly. Deferring until all other queues are clear prevents that duplication.
 *
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

  // Step 1: try non-micro.blog group dispatch
  const group = await fetchOldestPendingGroup();

  if (group.length > 0) {
    const groupId = group[0].groupId || '(no group)';
    console.log(`[social] Dispatching group "${groupId}" — ${group.length} post(s)`); // eslint-disable-line no-console
    for (const post of group) {
      console.log(`[social]   Row ${post.rowIndex}: [${post.platforms.join(',')}] ${post.title} (${post.postType})`); // eslint-disable-line no-console
      await dispatchPost(post, today);
    }
    return;
  }

  // Step 2: non-micro.blog queue is empty — check micro.blog eligibility
  const careerBacklogClear = await checkAllCareerPostsPublished();
  if (!careerBacklogClear) {
    console.log('[social] No non-micro.blog posts pending; micro.blog deferred until career backlog clears'); // eslint-disable-line no-console
    return;
  }

  // Step 3: all clear — dispatch oldest pending micro.blog post
  const microblogPost = await fetchOldestPendingMicroblogPost();
  if (!microblogPost) {
    console.log('[social] No pending posts in queue'); // eslint-disable-line no-console
    return;
  }

  console.log(`[social] Dispatching micro.blog post — Row ${microblogPost.rowIndex}: ${microblogPost.title} (${microblogPost.postType})`); // eslint-disable-line no-console
  await dispatchPost(microblogPost, today);
}

/**
 * Entry point: read today's date, run the social post queue, then run the micro.blog short scan.
 */
async function main() {
  const today = getTodayDate();
  const dryRun = process.env.DRY_RUN === 'true';
  console.log(`[social] Checking queue for posts due ${today}`); // eslint-disable-line no-console
  if (dryRun) console.log('[social] DRY_RUN mode active — no posts will be sent'); // eslint-disable-line no-console

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
      await scanAndPostShorts(dryRun);
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

module.exports = { processPostsForDate, dispatchPost };
