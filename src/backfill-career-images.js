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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to query post source (${res.status}): ${body}`);
  }
  const data = await res.json();
  // micro.blog does not return a 'photo' property in the Micropub source response.
  // Photos are embedded as <img> tags in the content field.
  const content = data.properties?.content?.[0] ?? '';
  return content.includes('<img');
}

/**
 * Add a photo to an existing micro.blog post using content-replace.
 *
 * Uses content-replace (not add:{ photo }) because the Micropub add action for
 * photo strips the post's categories on micro.blog — a confirmed platform bug.
 * Safe approach: GET existing content, append <img> tag, send replace:{ content }.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} photoUrl - Hosted image URL from the Micropub media endpoint
 * @param {string} token - micro.blog app token
 * @param {boolean} [dryRun=false] - When true, skip the Micropub update call
 * @returns {Promise<void>}
 */
async function addPhotoToPost(postUrl, photoUrl, token, dryRun = false) {
  const sourceRes = await fetch(`${MICROPUB_ENDPOINT}?q=source&url=${encodeURIComponent(postUrl)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!sourceRes.ok) {
    const body = await sourceRes.text();
    throw new Error(`Failed to fetch post source (${sourceRes.status}): ${body}`);
  }
  const sourceData = await sourceRes.json();
  const existingContent = sourceData.properties?.content?.[0] ?? '';
  const existingCategory = sourceData.properties?.category ?? [];

  if (!existingContent) {
    console.warn(`[addPhotoToPost] Skipping ${postUrl} — source content is null/empty (possibly rescheduled post with stale URL)`);
    return;
  }

  const newContent = `${existingContent}\n\n<img src="${photoUrl}">`;

  if (dryRun) return;

  // Always include the existing category in the replace payload.
  // micro.blog's replace: { content } silently clears category — same bug as add: { photo }.
  const replacePayload = { content: [newContent] };
  if (existingCategory.length > 0) {
    replacePayload.category = existingCategory;
  }

  const res = await fetch(MICROPUB_ENDPOINT, {
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

  const candidates = allRows.filter(row => row.microblogUrl && needsImage(row));
  console.log(`Found ${candidates.length} rows with micro.blog URL and image source\n`); // eslint-disable-line no-console

  const stats = {
    total: candidates.length,
    updated: 0,
    dryRun: 0,
    skippedAlreadyHasPhoto: 0,
    skippedFetchFailed: 0,
    skippedUploadFailed: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    console.log(`${progress} ${row.name} (${row.type})`); // eslint-disable-line no-console
    console.log(`  URL: ${row.microblogUrl}`); // eslint-disable-line no-console
    console.log(`  Link: ${row.link}`); // eslint-disable-line no-console

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would fetch thumbnail and attach photo`); // eslint-disable-line no-console
      stats.dryRun++;
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
      console.log(`  ⏭️  Already has photo, skipping`); // eslint-disable-line no-console
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
      console.log(`  ✓ Thumbnail uploaded: ${photoUrl}`); // eslint-disable-line no-console
    } catch (err) {
      console.warn(`  ⚠️  Media upload failed: ${err.message} — skipping`);
      stats.skippedUploadFailed++;
      continue;
    }

    // Attach photo to the post
    try {
      await addPhotoToPost(row.microblogUrl, photoUrl, token, DRY_RUN);
      console.log(`  ✅ Photo attached`); // eslint-disable-line no-console
      stats.updated++;
    } catch (err) {
      console.error(`  ❌ Micropub update failed: ${err.message}`);
      stats.failed++;
    }
  }

  console.log('\n' + '='.repeat(60)); // eslint-disable-line no-console
  console.log('BACKFILL SUMMARY'); // eslint-disable-line no-console
  console.log('='.repeat(60)); // eslint-disable-line no-console
  console.log(`  Total candidates:        ${stats.total}`); // eslint-disable-line no-console
  if (DRY_RUN) {
    console.log(`  🔍 Dry-run (would update): ${stats.dryRun}`); // eslint-disable-line no-console
  } else {
    console.log(`  ✅ Updated:              ${stats.updated}`); // eslint-disable-line no-console
  }
  console.log(`  ⏭️  Already had photo:   ${stats.skippedAlreadyHasPhoto}`); // eslint-disable-line no-console
  console.log(`  ⚠️  Fetch failed:        ${stats.skippedFetchFailed}`); // eslint-disable-line no-console
  console.log(`  ⚠️  Upload failed:       ${stats.skippedUploadFailed}`); // eslint-disable-line no-console
  console.log(`  ❌ Update failed:        ${stats.failed}`); // eslint-disable-line no-console
  console.log('='.repeat(60) + '\n'); // eslint-disable-line no-console
}

if (require.main === module) {
  backfillCareerImages().catch(err => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { backfillCareerImages, postHasPhoto, addPhotoToPost, parseTabRows };
