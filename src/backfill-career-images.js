// ABOUTME: Backfills thumbnail images onto existing micro.blog career posts that lack them.
// ABOUTME: Reads the live production spreadsheet, finds posts with a micro.blog URL and image source, attaches images via Micropub.

'use strict';

const { google } = require('googleapis');
const { fetchThumbnail } = require('./fetch-thumbnail');
const { needsImage, parseRow, uploadImageToMediaEndpoint } = require('./sync-content');

const MICROPUB_ENDPOINT = 'https://micro.blog/micropub';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';
const HISTORICAL_TAB_NAME = process.env.HISTORICAL_TAB_NAME || '2024 & earlier';

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Query the Micropub source endpoint for a specific post URL to check whether
 * it already has a photo attached.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} token - micro.blog app token
 * @returns {Promise<boolean>}
 */
async function postHasPhoto(postUrl, token) {
  const url = `${MICROPUB_ENDPOINT}?q=source&url=${encodeURIComponent(postUrl)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  const photos = data.properties?.photo;
  return Array.isArray(photos) && photos.length > 0;
}

/**
 * Add a photo to an existing micro.blog post via the Micropub update action.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} photoUrl - Hosted image URL from the Micropub media endpoint
 * @param {string} token - micro.blog app token
 * @returns {Promise<void>}
 */
async function addPhotoToPost(postUrl, photoUrl, token) {
  const res = await fetch(MICROPUB_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'update',
      url: postUrl,
      add: { photo: [photoUrl] },
    }),
  });

  if (res.status !== 200 && res.status !== 202) {
    const body = await res.text();
    throw new Error(`Micropub update failed (${res.status}): ${body}`);
  }
}

/**
 * Parse rows from a single spreadsheet tab into valid career post objects.
 *
 * @param {Array<Array<string>>} rawRows - Raw rows from Google Sheets API
 * @param {string} tabName - Name of the tab (for metadata)
 * @returns {Array<Object>} Parsed, valid career post rows
 */
function parseTabRows(rawRows, tabName) {
  const results = [];
  rawRows.forEach((row, idx) => {
    if (idx === 0) return; // skip header row
    const parsed = parseRow(row, idx, false);
    if (parsed && parsed.name && parsed.type) {
      parsed.tabName = tabName;
      parsed.tabRowIndex = idx + 1;
      results.push(parsed);
    }
  });
  return results;
}

/**
 * Main backfill function. Reads the live production spreadsheet, finds career
 * posts that have a micro.blog URL and an eligible image source, and attaches
 * the appropriate thumbnail via Micropub update.
 *
 * Skip conditions (non-fatal, logged with warning):
 *   - Post already has a photo
 *   - Thumbnail fetch returns null or throws
 *   - Media upload fails
 *
 * @returns {Promise<void>}
 */
async function backfillCareerImages() {
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

  const candidates = allRows.filter(row => row.microblogUrl && needsImage(row));
  console.log(`Found ${candidates.length} rows with micro.blog URL and image source\n`);

  const stats = {
    total: candidates.length,
    updated: 0,
    skippedAlreadyHasPhoto: 0,
    skippedFetchFailed: 0,
    skippedUploadFailed: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    console.log(`${progress} ${row.name} (${row.type})`);
    console.log(`  URL: ${row.microblogUrl}`);
    console.log(`  Link: ${row.link}`);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would fetch thumbnail and attach photo`);
      stats.updated++;
      continue;
    }

    // Check if the post already has a photo
    let alreadyHasPhoto = false;
    try {
      alreadyHasPhoto = await postHasPhoto(row.microblogUrl, token);
    } catch (err) {
      console.warn(`  ⚠️  Could not check existing photo: ${err.message} — proceeding with update`);
    }

    if (alreadyHasPhoto) {
      console.log(`  ⏭️  Already has photo, skipping`);
      stats.skippedAlreadyHasPhoto++;
      continue;
    }

    // Fetch thumbnail
    let imageBuffer;
    try {
      imageBuffer = await fetchThumbnail(row.link);
    } catch (err) {
      console.warn(`  ⚠️  Thumbnail fetch failed: ${err.message} — skipping`);
      stats.skippedFetchFailed++;
      continue;
    }

    if (!imageBuffer) {
      console.warn(`  ⚠️  Thumbnail not available (null) — skipping`);
      stats.skippedFetchFailed++;
      continue;
    }

    // Upload to Micropub media endpoint
    let photoUrl;
    try {
      photoUrl = await uploadImageToMediaEndpoint(imageBuffer, token);
      console.log(`  ✓ Thumbnail uploaded: ${photoUrl}`);
    } catch (err) {
      console.warn(`  ⚠️  Media upload failed: ${err.message} — skipping`);
      stats.skippedUploadFailed++;
      continue;
    }

    // Attach photo to the post
    try {
      await addPhotoToPost(row.microblogUrl, photoUrl, token);
      console.log(`  ✅ Photo attached`);
      stats.updated++;
    } catch (err) {
      console.error(`  ❌ Micropub update failed: ${err.message}`);
      stats.failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total candidates:        ${stats.total}`);
  console.log(`  ✅ Updated:              ${stats.updated}`);
  console.log(`  ⏭️  Already had photo:   ${stats.skippedAlreadyHasPhoto}`);
  console.log(`  ⚠️  Fetch failed:        ${stats.skippedFetchFailed}`);
  console.log(`  ⚠️  Upload failed:       ${stats.skippedUploadFailed}`);
  console.log(`  ❌ Update failed:        ${stats.failed}`);
  console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
  backfillCareerImages().catch(err => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { backfillCareerImages, postHasPhoto, addPhotoToPost };
