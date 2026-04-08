// ABOUTME: Checks whether career content was posted to Micro.blog today by reading the live spreadsheet.
// ABOUTME: Used by post-social-content.js to enforce the one-managed-post-per-day rule (career > social).

'use strict';

const { google } = require('googleapis');

// Live production spreadsheet — career content rows, Column I = "Micro.blog Posted At" timestamp
const LIVE_SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
// Must match the tab names used by sync-content.js (respects env overrides)
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';
const HISTORICAL_TAB_NAME = process.env.HISTORICAL_TAB_NAME || '2024 & earlier';

/**
 * Returns true if career content was posted to Micro.blog today.
 *
 * Reads Column I ("Micro.blog Posted At") of the live production spreadsheet and checks
 * for any timestamp matching today's UTC date. Returns false (not throws) on any error
 * so a transient failure does not suppress social posts.
 *
 * Personal posts are automatically exempt because Whitney posts those directly via the
 * Micro.blog UI, which never touches this spreadsheet.
 *
 * @returns {Promise<boolean>}
 */
async function checkCareerPostedToday() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.warn('[career-guard] GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping career post check'); // eslint-disable-line no-console
    return false;
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Read Column I from both tabs — sync-content.js can write to either
    const [mainResponse, historicalResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: LIVE_SPREADSHEET_ID,
        range: `${SHEET_NAME}!I:I`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: LIVE_SPREADSHEET_ID,
        range: `${HISTORICAL_TAB_NAME}!I:I`,
      }),
    ]);

    const allRows = [
      ...(mainResponse.data.values || []),
      ...(historicalResponse.data.values || []),
    ];
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

    const posted = allRows.some(row => {
      const val = (row[0] || '').trim();
      return val.startsWith(today);
    });

    if (posted) {
      console.log(`[career-guard] Career content already posted today (${today}) — skipping social dispatch`); // eslint-disable-line no-console
    }
    return posted;
  } catch (err) {
    console.warn(`[career-guard] Error checking career post status: ${err.message} — proceeding with social dispatch`); // eslint-disable-line no-console
    return false;
  }
}

module.exports = { checkCareerPostedToday };
