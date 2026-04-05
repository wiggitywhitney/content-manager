// ABOUTME: Daily cron entry point for social post publishing.
// ABOUTME: Reads pending posts from the social queue sheet and dispatches to each platform poster.

'use strict';

const { fetchPendingPostsForToday } = require('./social-posts-queue');

const SOCIAL_POSTS_SHEET_ID = process.env.SOCIAL_POSTS_SHEET_ID;

function getTodayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function main() {
  if (!SOCIAL_POSTS_SHEET_ID) {
    console.log('[social] SOCIAL_POSTS_SHEET_ID not set — skipping social post publishing');
    process.exit(0);
  }

  const today = getTodayDate();
  console.log(`[social] Checking queue for posts due ${today}`);

  let pendingPosts;
  try {
    pendingPosts = await fetchPendingPostsForToday(SOCIAL_POSTS_SHEET_ID, today);
  } catch (err) {
    console.error('[social] Failed to read social posts queue:', err.message);
    process.exit(1);
  }

  if (pendingPosts.length === 0) {
    console.log('[social] No posts due today');
    return;
  }

  console.log(`[social] Found ${pendingPosts.length} post(s) due today`);
  for (const post of pendingPosts) {
    console.log(`[social]   Row ${post.rowIndex}: [${post.platforms.join(',')}] ${post.title} (${post.postType})`);
  }

  // Platform posting will be added in Milestones 2-4 (Bluesky, Mastodon, LinkedIn).
  console.log('[social] Platform posting not yet implemented — posts remain pending');
}

main().catch(err => {
  console.error('[social] Unexpected error:', err.message);
  process.exit(1);
});
