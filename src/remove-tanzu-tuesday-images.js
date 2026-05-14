// ABOUTME: Removes thumbnail photos from existing Tanzu Tuesday micro.blog posts via Micropub.
// ABOUTME: Reads the live production spreadsheet, finds Tanzu Tuesday posts with photos, removes them.

'use strict';

const { google } = require('googleapis');
const { postHasPhoto, parseTabRows } = require('./backfill-career-images');

const MICROPUB_ENDPOINT = 'https://micro.blog/micropub';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';
const HISTORICAL_TAB_NAME = process.env.HISTORICAL_TAB_NAME || '2024 & earlier';

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Returns true if the row belongs to the Tanzu Tuesday show.
 *
 * @param {Object} row - Parsed spreadsheet row
 * @returns {boolean}
 */
function isTanzuTuesdayPost(row) {
  return !!(row.show && row.show.includes('Tanzu Tuesday'));
}

/**
 * Remove the photo property from an existing micro.blog post via Micropub update.
 * Uses the Micropub spec's array-form delete to remove all values of the photo property.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} token - micro.blog app token
 * @returns {Promise<void>}
 */
async function removePhotoFromPost(postUrl, token) {
  const res = await fetch(MICROPUB_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'update',
      url: postUrl,
      delete: ['photo'],
    }),
  });

  if (res.status !== 200 && res.status !== 202) {
    const body = await res.text();
    throw new Error(`Micropub delete failed (${res.status}): ${body}`);
  }
}

/**
 * Main removal function. Reads the live production spreadsheet, finds Tanzu Tuesday
 * posts that have a micro.blog URL and a photo, and removes the photo via Micropub.
 *
 * Skip conditions (non-fatal, logged):
 *   - Post has no photo (already clean)
 *   - Photo status check fails
 *
 * @returns {Promise<void>}
 */
async function removeTanzuTuesdayImages() {
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

  const candidates = allRows.filter(row => isTanzuTuesdayPost(row) && row.microblogUrl);
  console.log(`Found ${candidates.length} Tanzu Tuesday rows with micro.blog URL\n`);

  const stats = {
    total: candidates.length,
    removed: 0,
    dryRun: 0,
    skippedNoPhoto: 0,
    skippedCheckFailed: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    console.log(`${progress} ${row.name} (${row.show})`);
    console.log(`  URL: ${row.microblogUrl}`);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would check for photo and remove if present`);
      stats.dryRun++;
      continue;
    }

    let hasPhoto = false;
    try {
      hasPhoto = await postHasPhoto(row.microblogUrl, token);
    } catch (err) {
      console.warn(`  ⚠️  Could not check photo status: ${err.message} — skipping`);
      stats.skippedCheckFailed++;
      continue;
    }

    if (!hasPhoto) {
      console.log(`  ⏭️  No photo, skipping`);
      stats.skippedNoPhoto++;
      continue;
    }

    try {
      await removePhotoFromPost(row.microblogUrl, token);
      console.log(`  ✅ Photo removed`);
      stats.removed++;
    } catch (err) {
      console.error(`  ❌ Micropub delete failed: ${err.message}`);
      stats.failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('REMOVAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total Tanzu Tuesday posts: ${stats.total}`);
  if (DRY_RUN) {
    console.log(`  🔍 Dry-run (would process): ${stats.dryRun}`);
  } else {
    console.log(`  ✅ Photos removed:          ${stats.removed}`);
  }
  console.log(`  ⏭️  No photo (skipped):     ${stats.skippedNoPhoto}`);
  console.log(`  ⚠️  Check failed (skipped):  ${stats.skippedCheckFailed}`);
  console.log(`  ❌ Remove failed:            ${stats.failed}`);
  console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
  removeTanzuTuesdayImages().catch(err => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { removeTanzuTuesdayImages, removePhotoFromPost, isTanzuTuesdayPost };
