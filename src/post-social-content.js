// ABOUTME: Daily cron entry point for social post publishing.
// ABOUTME: Reads pending posts from the Social Posts Queue tab and dispatches to each platform poster.

'use strict';

const { fetchOldestPendingGroup, fetchOldestPendingMicroblogPost, checkSocialPostedToday } = require('./social-posts-queue');
const { checkCareerPostedToday } = require('./career-post-guard');
const { postToBluesky } = require('./post-bluesky');
const { postToMastodon } = require('./post-mastodon');
const { postToLinkedIn } = require('./post-linkedin');
const { scanAndPostShorts, postToMicroblog } = require('./post-microblog');
const { updatePostResult } = require('./update-social-post-status');
const { downloadFromDrive } = require('./drive-download');
const { fetchThumbnail } = require('./fetch-thumbnail');

/**
 * Submit a gauge metric to Datadog reporting the result of a platform post attempt.
 * No-op when DD_API_KEY is not set. Errors are logged as warnings and not re-thrown.
 *
 * @param {string} platform - 'linkedin' | 'bluesky' | 'mastodon' | 'micro.blog'
 * @param {boolean} success - true for success (value=1), false for failure (value=0)
 */
async function submitPostResultMetric(platform, success) {
  const apiKey = process.env.DD_API_KEY;
  if (!apiKey) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api.datadoghq.com/api/v2/series', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': apiKey,
      },
      body: JSON.stringify({
        series: [{
          metric: 'content_manager.social_post.result',
          type: 3, // gauge
          points: [{ timestamp, value: success ? 1 : 0 }],
          tags: ['service:content-manager', `platform:${platform}`],
        }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`[social] Warning: Datadog metric submission returned ${response.status}: ${text}`); // eslint-disable-line no-console
    }
  } catch (err) {
    console.warn(`[social] Warning: failed to submit post result metric: ${err.message}`); // eslint-disable-line no-console
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Return today's date as a YYYY-MM-DD string in UTC.
 *
 * @returns {string}
 */
function getTodayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Return the current posting slot based on UTC hour.
 * Morning slot covers the 8am CDT cron (13:00 UTC); evening slot covers the 4pm CDT cron (21:00 UTC).
 *
 * @param {Date} [now] - Defaults to current time; pass a Date in tests to avoid clock dependency.
 * @returns {'morning'|'evening'}
 */
function getSlot(now = new Date()) {
  return now.getUTCHours() < 17 ? 'morning' : 'evening';
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
    return false;
  }

  let videoBuffer = null;
  let imageBuffer = null;
  let failureCount = 0;
  let attemptCount = 0;
  let skippedCount = 0;
  let bskyPostUrl, mastodonPostUrl, linkedinPostUrl, microblogPostUrl;

  if (post.postType === 'short') {
    if (!post.driveVideoId) {
      // No Drive ID means the journal skill hasn't uploaded the video yet — leave pending so the
      // next cron run retries. Do NOT mark failed; do NOT fall back to text-only posting.
      console.warn(`[social] Row ${post.rowIndex} has no Drive video ID — skipping (row remains pending)`); // eslint-disable-line no-console
      return false;
    }
    try {
      ({ buffer: videoBuffer } = await downloadFromDrive(post.driveVideoId));
    } catch (err) {
      // Drive API error (including transient failures) — mark failed so the operator can investigate.
      // Distinct from "no ID" above: if the file ID is present but download fails, something is wrong.
      console.error(`[social] Failed to download Drive video for row ${post.rowIndex}: ${err.message}`); // eslint-disable-line no-console
      await updatePostResult(post.rowIndex, { status: 'failed' });
      return true;
    }
  }

  if ((post.postType === 'episode' || post.postType === 'gist') && post.youtubeUrl) {
    try {
      console.log(`[social] Fetching thumbnail for row ${post.rowIndex}...`); // eslint-disable-line no-console
      imageBuffer = await fetchThumbnail(post.youtubeUrl);
    } catch (err) {
      console.warn(`[social] Warning: thumbnail fetch failed for row ${post.rowIndex} — posting without image`); // eslint-disable-line no-console
      imageBuffer = null;
    }
  }

  if (post.platforms.includes('bluesky') && !post.bskyPostUrl) {
    attemptCount++;
    try {
      ({ postUrl: bskyPostUrl } = await postToBluesky(post, { videoBuffer, imageBuffer }));
      console.log(`[social] Posted row ${post.rowIndex} to Bluesky: ${bskyPostUrl}`); // eslint-disable-line no-console
      await submitPostResultMetric('bluesky', true);
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to Bluesky: ${err.message}`); // eslint-disable-line no-console
      await submitPostResultMetric('bluesky', false);
      failureCount++;
    }
  } else if (post.platforms.includes('bluesky')) {
    skippedCount++;
  }

  if (post.platforms.includes('mastodon') && !post.mastodonPostUrl) {
    attemptCount++;
    try {
      ({ postUrl: mastodonPostUrl } = await postToMastodon(post, { videoBuffer, imageBuffer }));
      console.log(`[social] Posted row ${post.rowIndex} to Mastodon: ${mastodonPostUrl}`); // eslint-disable-line no-console
      await submitPostResultMetric('mastodon', true);
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to Mastodon: ${err.message}`); // eslint-disable-line no-console
      await submitPostResultMetric('mastodon', false);
      failureCount++;
    }
  } else if (post.platforms.includes('mastodon')) {
    skippedCount++;
  }

  if (post.platforms.includes('linkedin') && !post.linkedinPostUrl) {
    attemptCount++;
    try {
      ({ postUrl: linkedinPostUrl } = await postToLinkedIn(post, { videoBuffer, imageBuffer }));
      console.log(`[social] Posted row ${post.rowIndex} to LinkedIn: ${linkedinPostUrl}`); // eslint-disable-line no-console
      await submitPostResultMetric('linkedin', true);
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to LinkedIn: ${err.message}`); // eslint-disable-line no-console
      await submitPostResultMetric('linkedin', false);
      failureCount++;
    }
  } else if (post.platforms.includes('linkedin')) {
    skippedCount++;
  }

  if (post.platforms.includes('micro.blog') && post.postType !== 'short' && !post.microblogPostUrl) {
    attemptCount++;
    try {
      ({ postUrl: microblogPostUrl } = await postToMicroblog(post, { bypassViewCount: true, imageBuffer }));
      console.log(`[social] Posted row ${post.rowIndex} to micro.blog: ${microblogPostUrl}`); // eslint-disable-line no-console
    } catch (err) {
      console.error(`[social] Failed to post row ${post.rowIndex} to micro.blog: ${err.message}`); // eslint-disable-line no-console
      failureCount++;
    }
  } else if (post.platforms.includes('micro.blog') && post.postType !== 'short') {
    skippedCount++;
  }

  if (attemptCount === 0 && skippedCount === 0) {
    console.warn(`[social] Row ${post.rowIndex} has no dispatchable platforms (platforms: [${post.platforms.join(',')}], type: ${post.postType}); marking failed to unblock queue`); // eslint-disable-line no-console
    await updatePostResult(post.rowIndex, { status: 'failed' });
    return true;
  }

  const status = failureCount === 0 ? 'posted' : 'failed';
  const resultFields = { status };
  if (status === 'posted' && today) resultFields.scheduledDate = today;
  if (bskyPostUrl) resultFields.bskyPostUrl = bskyPostUrl;
  if (mastodonPostUrl) resultFields.mastodonPostUrl = mastodonPostUrl;
  if (linkedinPostUrl) resultFields.linkedinPostUrl = linkedinPostUrl;
  if (microblogPostUrl) resultFields.microblogPostUrl = microblogPostUrl;

  await updatePostResult(post.rowIndex, resultFields);
  return failureCount > 0;
}

/**
 * Fetch and dispatch the next eligible social post(s).
 *
 * Dispatch priority order:
 * 0. Social-posted-today gate: skip all dispatch if social content already posted today.
 * 1. Career-posted-today gate: skip all dispatch if career content already posted today (single-post mode only; bypassed when TWO_POSTS_PER_DAY=true).
 * 2. Non-micro.blog group: dispatch the oldest pending group of LinkedIn/Bluesky/Mastodon rows.
 *    If the group has a Group ID (col N), all rows sharing that ID post together in one run.
 * 3. Micro.blog fallback: only when the non-micro.blog queue is fully empty AND career has not
 *    posted today. Then post one micro.blog row.
 *
 * Exported for testability.
 *
 * @param {string} today - Date in YYYY-MM-DD format
 */
async function processPostsForDate(today) {
  const twoPosts = process.env.TWO_POSTS_PER_DAY === 'true';
  // IS_MORNING_SLOT defaults to true (morning) unless explicitly set to 'false' by the workflow
  const isMorningSlot = process.env.IS_MORNING_SLOT !== 'false';
  // Evening fallback: in two-post mode, evening slot dispatches social when career queue is empty
  const eveningFallback = twoPosts && !isMorningSlot;

  if (eveningFallback) {
    // Evening slot owns social; but if career already posted this morning, skip social fallback
    if (await checkCareerPostedToday()) {
      console.log('[social] Career content posted today in evening slot — skipping social fallback'); // eslint-disable-line no-console
      return false;
    }
    console.log('[social] Evening slot: career queue empty — falling back to social dispatch'); // eslint-disable-line no-console
  } else {
    if (await checkSocialPostedToday()) {
      console.log('[social] Social content already posted today — skipping dispatch'); // eslint-disable-line no-console
      return false;
    }

    // In single-post mode, one managed post per day — skip social if career already posted.
    // In two-post mode, career and social each have their own slot; career guard is bypassed here.
    if (!twoPosts && await checkCareerPostedToday()) {
      console.log('[social] Career content already posted today — skipping social dispatch'); // eslint-disable-line no-console
      return false;
    }
  }

  let hadFailure = false;

  // Step 1: try non-micro.blog group dispatch
  const group = await fetchOldestPendingGroup();

  if (group.length > 0) {
    const groupId = group[0].groupId || '(no group)';
    console.log(`[social] Dispatching group "${groupId}" — ${group.length} post(s)`); // eslint-disable-line no-console
    for (const post of group) {
      console.log(`[social]   Row ${post.rowIndex}: [${post.platforms.join(',')}] ${post.title} (${post.postType})`); // eslint-disable-line no-console
      const failed = await dispatchPost(post, today);
      if (failed) hadFailure = true;
    }
    return hadFailure;
  }

  // Step 2: social queue empty — defer micro.blog if career already posted today
  if (await checkCareerPostedToday()) {
    console.log('[social] No social posts pending and career posted today — micro.blog deferred'); // eslint-disable-line no-console
    return false;
  }

  // Step 3: both queues empty — dispatch oldest pending micro.blog post
  const microblogPost = await fetchOldestPendingMicroblogPost();
  if (!microblogPost) {
    console.log('[social] No pending posts in queue'); // eslint-disable-line no-console
    return false;
  }

  console.log(`[social] Dispatching micro.blog post — Row ${microblogPost.rowIndex}: ${microblogPost.title} (${microblogPost.postType})`); // eslint-disable-line no-console
  const failed = await dispatchPost(microblogPost, today);
  return !!failed;
}

/**
 * Entry point: read today's date, run the social post queue, then run the micro.blog short scan.
 */
async function main() {
  const today = getTodayDate();
  const dryRun = process.env.DRY_RUN === 'true';
  console.log(`[social] Checking queue for posts due ${today}`); // eslint-disable-line no-console
  if (dryRun) console.log('[social] DRY_RUN mode active — no posts will be sent'); // eslint-disable-line no-console

  let hadFailure = false;
  try {
    hadFailure = await processPostsForDate(today);
  } catch (err) {
    console.error('[social] Failed to read social posts queue:', err.message); // eslint-disable-line no-console
    process.exit(1);
    return;
  }

  // Skip micro.blog short scan if either career or social posted today
  const careerPostedToday = await checkCareerPostedToday().catch(() => false);
  const socialPostedToday = await checkSocialPostedToday().catch(() => false);
  if (!careerPostedToday && !socialPostedToday) {
    try {
      await scanAndPostShorts(dryRun);
    } catch (err) {
      console.error('[social] micro.blog short scan failed:', err.message); // eslint-disable-line no-console
      // Non-fatal: regular platform dispatch already completed
    }
  }

  if (hadFailure && !dryRun) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('[social] Unexpected error:', err.message); // eslint-disable-line no-console
    process.exit(1);
  });
}

module.exports = { processPostsForDate, dispatchPost, main, getSlot, submitPostResultMetric };
