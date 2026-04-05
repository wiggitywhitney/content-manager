// ABOUTME: Reads and filters the social posts queue from the Google Sheet.
// ABOUTME: Provides parseSocialPostRows and filterPostsForDate for use by the daily cron.

'use strict';

const { google } = require('googleapis');

// Column indices (0-based) matching the PRD schema
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
    // Skip rows missing the required scheduledDate field
    if (!scheduledDate) continue;

    const platformsRaw = (row[COL.PLATFORMS] || '').trim();
    const platforms = platformsRaw
      ? platformsRaw.split(',').map(p => p.trim()).filter(Boolean)
      : [];

    posts.push({
      rowIndex: i + 1, // 1-indexed to match Sheets row numbers
      show: (row[COL.SHOW] || '').trim(),
      title: (row[COL.TITLE] || '').trim(),
      postType: (row[COL.POST_TYPE] || '').trim(),
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
 * Fetch pending social posts due today from the social posts Google Sheet.
 *
 * @param {string} spreadsheetId - The social posts sheet ID
 * @param {string} todayDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object[]>} Posts due today with pending status
 */
async function fetchPendingPostsForToday(spreadsheetId, todayDate) {
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
  const range = 'Sheet1!A:M';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values || [];
  // First row is header
  const posts = parseSocialPostRows(rows, { hasHeader: true });

  return filterPostsForDate(posts, todayDate);
}

module.exports = { parseSocialPostRows, filterPostsForDate, fetchPendingPostsForToday };
