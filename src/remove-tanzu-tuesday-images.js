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
 * Remove the photo from an existing micro.blog post by fetching the current content,
 * stripping <img> tags, and replacing the content via Micropub update.
 *
 * micro.blog stores photos as <img> tags embedded in properties.content[0] rather
 * than as a separate 'photo' property, so delete: ["photo"] returns 500. Instead,
 * we read the current content, strip <img> tags, and write it back via replace.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} token - micro.blog app token
 * @returns {Promise<void>}
 */
async function removePhotoFromPost(postUrl, token) {
  const sourceUrl = `${MICROPUB_ENDPOINT}?q=source&url=${encodeURIComponent(postUrl)}`;
  const sourceRes = await fetch(sourceUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!sourceRes.ok) {
    const body = await sourceRes.text();
    throw new Error(`Failed to query post source (${sourceRes.status}): ${body}`);
  }
  const data = await sourceRes.json();
  const content = data.properties?.content?.[0] ?? '';
  const existingCategory = data.properties?.category ?? [];
  const strippedContent = content.replace(/<img[^>]*>/g, '').trimEnd();

  // Always include the existing category in the replace payload.
  // micro.blog's replace: { content } silently clears category — same bug as add: { photo }.
  const replacePayload = { content: [strippedContent] };
  if (existingCategory.length > 0) {
    replacePayload.category = existingCategory;
  }

  const updateRes = await fetch(MICROPUB_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'update',
      url: postUrl,
      replace: replacePayload,
    }),
  });

  if (updateRes.status !== 200 && updateRes.status !== 202) {
    const body = await updateRes.text();
    throw new Error(`Micropub update failed (${updateRes.status}): ${body}`);
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

  console.log(`Found ${allRows.length} valid rows total`); // eslint-disable-line no-console

  const candidates = allRows.filter(row => isTanzuTuesdayPost(row) && row.microblogUrl);
  console.log(`Found ${candidates.length} Tanzu Tuesday rows with micro.blog URL\n`); // eslint-disable-line no-console

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
    console.log(`${progress} ${row.name} (${row.show})`); // eslint-disable-line no-console
    console.log(`  URL: ${row.microblogUrl}`); // eslint-disable-line no-console

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would check for photo and remove if present`); // eslint-disable-line no-console
      stats.dryRun++;
      continue;
    }

    let hasPhoto = false;
    try {
      hasPhoto = await postHasPhoto(row.microblogUrl, token);
    } catch (err) {
      console.warn(`  ⚠️  Could not check photo status: ${err.message} — skipping`); // eslint-disable-line no-console
      stats.skippedCheckFailed++;
      continue;
    }

    if (!hasPhoto) {
      console.log(`  ⏭️  No photo, skipping`); // eslint-disable-line no-console
      stats.skippedNoPhoto++;
      continue;
    }

    try {
      await removePhotoFromPost(row.microblogUrl, token);
      console.log(`  ✅ Photo removed`); // eslint-disable-line no-console
      stats.removed++;
    } catch (err) {
      console.error(`  ❌ Micropub delete failed: ${err.message}`); // eslint-disable-line no-console
      stats.failed++;
    }
  }

  console.log('\n' + '='.repeat(60)); // eslint-disable-line no-console
  console.log('REMOVAL SUMMARY'); // eslint-disable-line no-console
  console.log('='.repeat(60)); // eslint-disable-line no-console
  console.log(`  Total Tanzu Tuesday posts: ${stats.total}`); // eslint-disable-line no-console
  if (DRY_RUN) {
    console.log(`  🔍 Dry-run (would process): ${stats.dryRun}`); // eslint-disable-line no-console
  } else {
    console.log(`  ✅ Photos removed:          ${stats.removed}`); // eslint-disable-line no-console
  }
  console.log(`  ⏭️  No photo (skipped):     ${stats.skippedNoPhoto}`); // eslint-disable-line no-console
  console.log(`  ⚠️  Check failed (skipped):  ${stats.skippedCheckFailed}`); // eslint-disable-line no-console
  console.log(`  ❌ Remove failed:            ${stats.failed}`); // eslint-disable-line no-console
  console.log('='.repeat(60) + '\n'); // eslint-disable-line no-console
}

if (require.main === module) {
  removeTanzuTuesdayImages().catch(err => {
    console.error(`❌ Fatal error: ${err.message}`); // eslint-disable-line no-console
    process.exit(1);
  });
}

module.exports = { removeTanzuTuesdayImages, removePhotoFromPost, isTanzuTuesdayPost };
