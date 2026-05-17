// ABOUTME: Syncs historical career posts to micro.blog as archive-only posts (no social post).
// ABOUTME: For rows in the spreadsheet that have never been synced (empty column H).

'use strict';

// Force sync-content.js into live mode — this script controls dry-run itself
// via process.argv. Do NOT rely on sync-content.js's DRY_RUN env var mechanism.
process.env.DRY_RUN = 'false';

const { google } = require('googleapis');
const { fetchThumbnail } = require('./fetch-thumbnail');
const {
  createMicroblogPost,
  writeUrlToSpreadsheet,
  formatPostContent,
  needsImage,
  uploadImageToMediaEndpoint,
  parseDateToISO,
  parseRow,
} = require('./sync-content');
const { categoryForRow } = require('./restore-post-categories');
const { parseTabRows } = require('./backfill-career-images');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';
const HISTORICAL_TAB_NAME = process.env.HISTORICAL_TAB_NAME || '2024 & earlier';

const DRY_RUN = process.argv.includes('--dry-run');

// Google Sheets write rate limit: 60 writes/min; 1500ms = 40/min with buffer
const SHEETS_WRITE_DELAY_MS = 1500;

/**
 * Filter rows to those that have never been synced to micro.blog and have a
 * valid category mapping. Rows with a non-empty microblogUrl are already synced.
 *
 * @param {Array<Object>} rows - Parsed spreadsheet rows
 * @returns {Array<Object>} Rows eligible for first-time sync
 */
function findUnsynced(rows) {
  return rows.filter(row => !row.microblogUrl && categoryForRow(row) !== null);
}

/**
 * Convert a MM/DD/YYYY date string to an ISO 8601 UTC string.
 * Delegates to parseDateToISO from sync-content.js which handles all date formats.
 *
 * @param {string} dateStr - Date string in MM/DD/YYYY or M/D/YYYY format
 * @returns {string|null} ISO 8601 string, or null if unparseable
 */
function parseRowDate(dateStr) {
  return parseDateToISO(dateStr);
}

/**
 * Main batch function. Reads both spreadsheet tabs, finds rows with no
 * microblog URL, and creates archive-only posts via Micropub.
 *
 * Archive-only means: one post with the original content date and category.
 * No social post is created — that would flood the main feed with stale entries.
 *
 * Skip conditions (non-fatal, logged):
 *   - Row already has a microblogUrl
 *   - Row type has no micro.blog category mapping
 *   - Row has no date (cannot create backdate post)
 *   - Thumbnail fetch fails (image is skipped; post still created)
 *
 * @returns {Promise<void>}
 */
async function syncHistoricalPosts() {
  if (DRY_RUN) {
    console.log('\n' + '='.repeat(60)); // eslint-disable-line no-console
    console.log('🔍 DRY-RUN MODE — No actual API calls will be made'); // eslint-disable-line no-console
    console.log('='.repeat(60) + '\n'); // eslint-disable-line no-console
  }

  const token = process.env.MICROBLOG_APP_TOKEN;
  if (!token) throw new Error('MICROBLOG_APP_TOKEN environment variable not set');

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`Reading spreadsheet ${SPREADSHEET_ID}...`); // eslint-disable-line no-console

  const [sheet1Res, historicalRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A:K` }),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${HISTORICAL_TAB_NAME}!A:K` }),
  ]);

  const allRows = [
    ...parseTabRows(sheet1Res.data.values || [], SHEET_NAME),
    ...parseTabRows(historicalRes.data.values || [], HISTORICAL_TAB_NAME),
  ];

  const candidates = findUnsynced(allRows);
  console.log(`Found ${candidates.length} unsynced rows (of ${allRows.length} total)\n`); // eslint-disable-line no-console

  const stats = {
    total: candidates.length,
    created: 0,
    dryRun: 0,
    skippedNoDate: 0,
    skippedFetchFailed: 0,
    skippedUploadFailed: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    console.log(`${progress} ${row.name} (${row.type}) — ${row.show || '—'}`); // eslint-disable-line no-console
    console.log(`  Date: ${row.date}  Link: ${row.link || '(none)'}`); // eslint-disable-line no-console

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would create archive post`); // eslint-disable-line no-console
      stats.dryRun++;
      continue;
    }

    const publishedDate = parseRowDate(row.date);
    if (!publishedDate) {
      console.warn(`  ⚠️  Could not parse date "${row.date}" — skipping`); // eslint-disable-line no-console
      stats.skippedNoDate++;
      continue;
    }

    // Fetch thumbnail if this post type supports images
    let photoUrl = null;
    if (needsImage(row) && row.link) {
      try {
        const buffer = await fetchThumbnail(row.link);
        if (buffer) {
          photoUrl = await uploadImageToMediaEndpoint(buffer, token);
          console.log(`  ✓ Thumbnail: ${photoUrl}`); // eslint-disable-line no-console
        } else {
          console.warn(`  ⚠️  Thumbnail not available — proceeding without image`); // eslint-disable-line no-console
        }
      } catch (err) {
        console.warn(`  ⚠️  Thumbnail skipped: ${err.message}`); // eslint-disable-line no-console
      }
    }

    // Create the archive post
    let postUrl;
    try {
      const postContent = formatPostContent(row);
      postUrl = await createMicroblogPost(row, postContent, publishedDate, photoUrl);
      console.log(`  ✅ Created: ${postUrl}`); // eslint-disable-line no-console
    } catch (err) {
      console.error(`  ❌ Post creation failed: ${err.message}`); // eslint-disable-line no-console
      stats.failed++;
      continue;
    }

    // Write URL back to column H (isNewPost=false: don't write timestamp to column I —
    // timestamps are used by the daily sync guard to detect whether career content ran today)
    try {
      await writeUrlToSpreadsheet(sheets, SPREADSHEET_ID, row.tabName, row.tabRowIndex, postUrl, false);
      stats.created++;
    } catch (err) {
      console.warn(`  ⚠️  Could not write URL to spreadsheet: ${err.message}`); // eslint-disable-line no-console
      stats.created++; // Post was created; spreadsheet write is secondary
    }

    // Respect Google Sheets write rate limit
    await new Promise(r => setTimeout(r, SHEETS_WRITE_DELAY_MS));
  }

  console.log('\n' + '='.repeat(60)); // eslint-disable-line no-console
  console.log('HISTORICAL SYNC SUMMARY'); // eslint-disable-line no-console
  console.log('='.repeat(60)); // eslint-disable-line no-console
  console.log(`  Total unsynced candidates:   ${stats.total}`); // eslint-disable-line no-console
  if (DRY_RUN) {
    console.log(`  🔍 Dry-run (would create):   ${stats.dryRun}`); // eslint-disable-line no-console
  } else {
    console.log(`  ✅ Posts created:            ${stats.created}`); // eslint-disable-line no-console
  }
  console.log(`  ⚠️  No date (skipped):       ${stats.skippedNoDate}`); // eslint-disable-line no-console
  console.log(`  ❌ Creation failed:          ${stats.failed}`); // eslint-disable-line no-console
  console.log('='.repeat(60) + '\n'); // eslint-disable-line no-console

  if (!DRY_RUN && stats.created > 0) {
    console.log('NOTE: Trigger a site rebuild at https://micro.blog/account/logs → Rebuild Site'); // eslint-disable-line no-console
    console.log('      to update the category pages with newly created posts.\n'); // eslint-disable-line no-console
  }
}

if (require.main === module) {
  syncHistoricalPosts().catch(err => {
    console.error(`❌ Fatal error: ${err.message}`); // eslint-disable-line no-console
    process.exit(1);
  });
}

module.exports = { findUnsynced, parseRowDate, syncHistoricalPosts };
