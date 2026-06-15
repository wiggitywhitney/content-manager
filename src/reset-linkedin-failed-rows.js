// ABOUTME: One-time backlog cleanup script — resets failed LinkedIn rows in the Social Posts Queue back to pending.
// ABOUTME: Run after fixing the LinkedIn credential issue to allow the dispatcher to retry these posts.

'use strict';

const { google } = require('googleapis');
const { fetchAllSocialPosts } = require('./social-posts-queue');

const STAGED_SPREADSHEET_ID = '1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts';
const STATUS_COL = 'I'; // Column I = status

/**
 * Filter posts to those that failed LinkedIn dispatch without writing a LinkedIn URL.
 * These are safe to reset to pending for retry.
 *
 * @param {Object[]} posts
 * @returns {Object[]}
 */
function findFailedLinkedInRows(posts) {
  return posts.filter(p =>
    p.status === 'failed' &&
    !p.linkedinPostUrl &&
    p.platforms.includes('linkedin')
  );
}

async function resetFailedLinkedInRows() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required');

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const all = await fetchAllSocialPosts();
  const toReset = findFailedLinkedInRows(all);

  if (toReset.length === 0) {
    console.log('[reset] No failed LinkedIn rows found — nothing to do.'); // eslint-disable-line no-console
    return;
  }

  console.log(`[reset] Resetting ${toReset.length} failed LinkedIn row(s) to pending: ${toReset.map(p => p.rowIndex).join(', ')}`); // eslint-disable-line no-console

  const data = toReset.map(p => ({
    range: `Social Posts Queue!${STATUS_COL}${p.rowIndex}`,
    values: [['pending']],
  }));

  if (process.env.DRY_RUN === 'true') {
    console.log('[reset] DRY_RUN active — no changes written.'); // eslint-disable-line no-console
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: STAGED_SPREADSHEET_ID,
    resource: { valueInputOption: 'USER_ENTERED', data },
  });

  console.log('[reset] Done.'); // eslint-disable-line no-console
}

module.exports = { findFailedLinkedInRows };

if (require.main === module) {
  resetFailedLinkedInRows().catch(err => {
    console.error('[reset] Error:', err.message);
    process.exit(1);
  });
}
