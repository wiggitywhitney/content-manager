// ABOUTME: Restores micro.blog post categories stripped by the erroneous add:{ photo } Micropub action.
// ABOUTME: Reads the live production spreadsheet, checks each post's category, and restores missing ones via Micropub replace.

'use strict';

const { google } = require('googleapis');
const { parseTabRows } = require('./backfill-career-images');

const MICROPUB_ENDPOINT = 'https://micro.blog/micropub';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';
const HISTORICAL_TAB_NAME = process.env.HISTORICAL_TAB_NAME || '2024 & earlier';

const DRY_RUN = process.argv.includes('--dry-run');

// Includes singular "Presentation" typo that appears in at least one spreadsheet row.
const CATEGORY_MAP = {
  'Video': 'Video',
  'Podcast': 'Podcast',
  'Presentations': 'Presentations',
  'Presentation': 'Presentations',
  'Guest': 'Guest',
  'Blog': 'Blog',
};

/**
 * Map a spreadsheet row's type to its micro.blog category.
 *
 * @param {Object} row - Parsed spreadsheet row with a `type` field
 * @returns {string|null} Category string, or null if type has no micro.blog category
 */
function categoryForRow(row) {
  return CATEGORY_MAP[row.type] ?? null;
}

/**
 * Fetch and return parsed Micropub source data for a post URL.
 * Shared by postHasCategory and the main restore loop.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} token - micro.blog app token
 * @returns {Promise<Object>} Parsed JSON response from the Micropub source endpoint
 */
async function _queryPostSource(postUrl, token) {
  const url = `${MICROPUB_ENDPOINT}?q=source&url=${encodeURIComponent(postUrl)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to query post source (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Query the Micropub source endpoint for a post and return whether it has a category.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} token - micro.blog app token
 * @returns {Promise<boolean>}
 */
async function postHasCategory(postUrl, token) {
  const data = await _queryPostSource(postUrl, token);
  const categories = data.properties?.category ?? [];
  return categories.length > 0;
}

/**
 * Restore a post's category via Micropub replace.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} category - Category to set
 * @param {string} token - micro.blog app token
 * @returns {Promise<void>}
 */
async function restorePostCategory(postUrl, category, token) {
  const res = await fetch(MICROPUB_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'update',
      url: postUrl,
      replace: { category: [category] },
    }),
  });

  if (res.status !== 200 && res.status !== 202) {
    const body = await res.text();
    throw new Error(`Micropub update failed (${res.status}): ${body}`);
  }
}

/**
 * Main restore function. Reads the live production spreadsheet, checks each post's
 * category via Micropub, and restores missing categories.
 *
 * Skip conditions (non-fatal, logged):
 *   - Row type has no micro.blog category mapping
 *   - Row has no micro.blog URL (column H)
 *   - Post source content is null/empty (stale URL from rescheduled post)
 *   - Post already has a category
 *   - Category query fails
 *
 * @returns {Promise<void>}
 */
async function restorePostCategories() {
  if (DRY_RUN) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 DRY-RUN MODE — No actual API calls will be made');
    console.log('='.repeat(60) + '\n');
  }

  const token = process.env.MICROBLOG_APP_TOKEN;
  if (!token) throw new Error('MICROBLOG_APP_TOKEN environment variable not set');

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`Reading spreadsheet ${SPREADSHEET_ID}...`);

  const [sheet1Res, historicalRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A:K` }),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${HISTORICAL_TAB_NAME}!A:K` }),
  ]);

  const allRows = [
    ...parseTabRows(sheet1Res.data.values || [], SHEET_NAME),
    ...parseTabRows(historicalRes.data.values || [], HISTORICAL_TAB_NAME),
  ];

  console.log(`Found ${allRows.length} valid rows total`);

  // Only rows that have a micro.blog URL and a valid category mapping
  const candidates = allRows.filter(row => row.microblogUrl && categoryForRow(row) !== null);
  console.log(`Found ${candidates.length} rows with micro.blog URL and a category mapping\n`);

  const stats = {
    total: candidates.length,
    restored: 0,
    dryRun: 0,
    skippedAlreadyHasCategory: 0,
    skippedStaleUrl: 0,
    skippedCheckFailed: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const category = categoryForRow(row);
    const progress = `[${i + 1}/${candidates.length}]`;
    console.log(`${progress} ${row.name} (${row.type})`);
    console.log(`  URL: ${row.microblogUrl}`);
    console.log(`  Expected category: ${category}`);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would check category and restore if missing`);
      stats.dryRun++;
      continue;
    }

    // Query post source (used for both stale-URL guard and category check)
    let sourceData;
    try {
      sourceData = await _queryPostSource(row.microblogUrl, token);
    } catch (err) {
      console.warn(`  ⚠️  Could not query post source: ${err.message} — skipping`);
      stats.skippedCheckFailed++;
      continue;
    }

    // Guard against stale URLs that return null/empty content
    const content = sourceData.properties?.content?.[0] ?? '';
    if (!content) {
      console.warn(`  ⚠️  Source content is null/empty (possibly rescheduled post with stale URL) — skipping`);
      stats.skippedStaleUrl++;
      continue;
    }

    // Check if category is already populated
    const categories = sourceData.properties?.category ?? [];
    if (categories.length > 0) {
      console.log(`  ⏭️  Already has category [${categories.join(', ')}], skipping`);
      stats.skippedAlreadyHasCategory++;
      continue;
    }

    // Restore the category
    try {
      await restorePostCategory(row.microblogUrl, category, token);
      console.log(`  ✅ Category restored: ${category}`);
      stats.restored++;
    } catch (err) {
      console.error(`  ❌ Micropub update failed: ${err.message}`);
      stats.failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESTORE SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total candidates:              ${stats.total}`);
  if (DRY_RUN) {
    console.log(`  🔍 Dry-run (would process):    ${stats.dryRun}`);
  } else {
    console.log(`  ✅ Categories restored:        ${stats.restored}`);
  }
  console.log(`  ⏭️  Already had category:      ${stats.skippedAlreadyHasCategory}`);
  console.log(`  ⚠️  Stale URL (skipped):       ${stats.skippedStaleUrl}`);
  console.log(`  ⚠️  Check failed (skipped):    ${stats.skippedCheckFailed}`);
  console.log(`  ❌ Restore failed:             ${stats.failed}`);
  console.log('='.repeat(60) + '\n');

  if (stats.restored > 0 || DRY_RUN) {
    console.log('NOTE: After running, trigger a site rebuild at https://micro.blog/account/logs → Rebuild Site');
    console.log('      if category pages (/video/, /podcast/, etc.) are not yet updated.\n');
  }
}

if (require.main === module) {
  restorePostCategories().catch(err => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { restorePostCategories, postHasCategory, categoryForRow, restorePostCategory };
