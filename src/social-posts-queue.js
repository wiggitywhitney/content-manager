// ABOUTME: Reads and filters the social posts queue from the staged spreadsheet.
// ABOUTME: Exports COL column indices and queue fetch functions for use by the daily cron and tests.

'use strict';

const { google } = require('googleapis');

// Social posts queue lives in the staged spreadsheet as a dedicated tab.
const STAGED_SPREADSHEET_ID = '1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts';
const SOCIAL_POSTS_TAB = 'Social Posts Queue';

// Column indices (0-based) matching the schema
const COL = {
  SHOW: 0,
  TITLE: 1,
  POST_TYPE: 2,
  POST_TEXT: 3,
  YOUTUBE_URL: 4,
  ALT_TEXT: 5,
  SCHEDULED_DATE: 6,
  PLATFORMS: 7,
  STATUS: 8,
  LINKEDIN_POST_URL: 9,
  BSKY_POST_URL: 10,
  MASTODON_POST_URL: 11,
  MICROBLOG_POST_URL: 12,
  GROUP_ID: 13,  // Column N — groups platform-variant rows that should post on the same day
};

/**
 * Parse raw Google Sheets rows into post objects.
 *
 * @param {string[][]} rows - Raw rows from Sheets API (no header row unless hasHeader is true)
 * @param {Object} options
 * @param {boolean} [options.hasHeader=false] - Whether the first row is a header to skip
 * @returns {Object[]} Parsed post objects
 */
function parseSocialPostRows(rows, { hasHeader = false } = {}) {
  const startIndex = hasHeader ? 1 : 0;
  const posts = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (!row || row.length === 0) continue;

    const scheduledDate = (row[COL.SCHEDULED_DATE] || '').trim();

    const platformsRaw = (row[COL.PLATFORMS] || '').trim();
    const platforms = platformsRaw
      ? platformsRaw.split(',').map(p => p.trim().toLowerCase()).filter(Boolean)
      : [];

    posts.push({
      rowIndex: i + 1, // 1-indexed to match Sheets row numbers
      show: (row[COL.SHOW] || '').trim(),
      title: (row[COL.TITLE] || '').trim(),
      postType: (row[COL.POST_TYPE] || '').trim().toLowerCase(),
      postText: (row[COL.POST_TEXT] || '').trim(),
      youtubeUrl: (row[COL.YOUTUBE_URL] || '').trim(),
      altText: (row[COL.ALT_TEXT] || '').trim(),
      scheduledDate,
      platforms,
      status: (row[COL.STATUS] || '').trim().toLowerCase(),
      linkedinPostUrl: (row[COL.LINKEDIN_POST_URL] || '').trim(),
      bskyPostUrl: (row[COL.BSKY_POST_URL] || '').trim(),
      mastodonPostUrl: (row[COL.MASTODON_POST_URL] || '').trim(),
      microblogPostUrl: (row[COL.MICROBLOG_POST_URL] || '').trim(),
      groupId: (row[COL.GROUP_ID] || '').trim() || null,
    });
  }

  return posts;
}

/**
 * Filter posts to those due on a given date with pending status.
 *
 * @param {Object[]} posts - Parsed post objects from parseSocialPostRows
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {Object} options
 * @param {string} [options.platform] - If set, only return posts that include this platform
 * @returns {Object[]} Posts matching the date, pending status, and optional platform filter
 */
function filterPostsForDate(posts, date, { platform } = {}) {
  return posts.filter(post => {
    if (post.scheduledDate !== date) return false;
    if (post.status !== 'pending') return false;
    if (platform && !post.platforms.includes(platform)) return false;
    return true;
  });
}

/**
 * Fetch pending social posts due today from the Social Posts Queue tab.
 *
 * @param {string} todayDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object[]>} Posts due today with pending status
 */
async function fetchPendingPostsForToday(todayDate) {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const range = `${SOCIAL_POSTS_TAB}!A:N`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: STAGED_SPREADSHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  // First row is header
  const posts = parseSocialPostRows(rows, { hasHeader: true });

  return filterPostsForDate(posts, todayDate);
}

/**
 * Returns true if a post's only platform is micro.blog.
 * These rows are held back until the non-micro.blog queue and career backlog are clear.
 *
 * @param {Object} post - Parsed post object
 * @returns {boolean}
 */
function isMicroblogOnly(post) {
  return post.platforms.length === 1 && post.platforms[0] === 'micro.blog';
}

/**
 * Shared helper: authenticates with Sheets API and reads all Social Posts Queue rows.
 *
 * @returns {Promise<Object[]>} All parsed post objects
 */
async function fetchAllSocialPosts() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: STAGED_SPREADSHEET_ID,
    range: `${SOCIAL_POSTS_TAB}!A:N`,
  });

  const rows = response.data.values || [];
  return parseSocialPostRows(rows, { hasHeader: true });
}

/**
 * Fetch the oldest pending post from the Social Posts Queue tab, regardless of scheduled date.
 * Excludes micro.blog-only rows — those are dispatched separately by fetchOldestPendingMicroblogPost.
 * Returns the first pending non-micro.blog row in sheet order, or null if none exist.
 *
 * @returns {Promise<Object|null>} The oldest pending non-micro.blog post, or null
 */
async function fetchOldestPendingPost() {
  const posts = await fetchAllSocialPosts();
  const pending = posts.filter(p =>
    (!p.status || p.status === 'pending') && !isMicroblogOnly(p)
  );
  return pending.length > 0 ? pending[0] : null;
}

/**
 * Fetch the oldest pending group of non-micro.blog posts.
 * If the oldest pending post has a Group ID, returns all pending non-micro.blog posts
 * sharing that Group ID so they can be dispatched together on the same day.
 * If no Group ID, returns a single-element array.
 * Returns an empty array if no pending non-micro.blog posts exist.
 *
 * @returns {Promise<Object[]>} Posts to dispatch together, or empty array
 */
async function fetchOldestPendingGroup() {
  const posts = await fetchAllSocialPosts();
  const pending = posts.filter(p =>
    (!p.status || p.status === 'pending') && !isMicroblogOnly(p)
  );

  if (pending.length === 0) return [];

  const oldest = pending[0];
  if (!oldest.groupId) return [oldest];

  // Return all pending non-micro.blog posts sharing the same Group ID
  return pending.filter(p => p.groupId === oldest.groupId);
}

/**
 * Fetch the oldest pending micro.blog-only post.
 * Only called after the non-micro.blog queue and career backlog are confirmed empty.
 * Returns null if no pending micro.blog posts exist.
 *
 * @returns {Promise<Object|null>} The oldest pending micro.blog post, or null
 */
async function fetchOldestPendingMicroblogPost() {
  const posts = await fetchAllSocialPosts();
  const pending = posts.filter(p =>
    (!p.status || p.status === 'pending') && p.postType !== 'short' && isMicroblogOnly(p)
  );
  return pending.length > 0 ? pending[0] : null;
}

/**
 * Fetch the most recent short rows from the Social Posts Queue tab, regardless of status.
 * Used by the micro.blog view-count scan to find candidates for posting.
 *
 * @param {number} limit - Maximum number of short rows to return (default 10)
 * @returns {Promise<Object[]>} The last `limit` rows with postType === 'short', newest first
 */
async function fetchRecentShortRows(limit = 10) {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const range = `${SOCIAL_POSTS_TAB}!A:N`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: STAGED_SPREADSHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  const allPosts = parseSocialPostRows(rows, { hasHeader: true });
  const shortPosts = allPosts.filter(p => p.postType === 'short');

  // Return the last `limit` rows in sheet order (most recently added last)
  return shortPosts.slice(-limit);
}

module.exports = { COL, parseSocialPostRows, filterPostsForDate, fetchPendingPostsForToday, fetchOldestPendingPost, fetchOldestPendingGroup, fetchOldestPendingMicroblogPost, fetchRecentShortRows, isMicroblogOnly };
