// ABOUTME: Removes duplicate <img> tags from micro.blog career posts that received two thumbnails.
// ABOUTME: Reads the live production spreadsheet, finds posts with 2+ img tags, keeps only the first.

'use strict';

const { google } = require('googleapis');
const { parseTabRows } = require('./backfill-career-images');

const MICROPUB_ENDPOINT = 'https://micro.blog/micropub';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';
const HISTORICAL_TAB_NAME = process.env.HISTORICAL_TAB_NAME || '2024 & earlier';

const DRY_RUN = process.argv.includes('--dry-run');

class SourceQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceQueryError';
  }
}

/**
 * Returns true if the content string contains two or more <img> tags.
 *
 * @param {string|null} content
 * @returns {boolean}
 */
function hasMultipleImages(content) {
  if (!content) return false;
  const matches = content.match(/<img[^>]*>/g);
  return matches !== null && matches.length >= 2;
}

/**
 * Returns the content string with all but the first <img> tag removed.
 * Leaves the content unchanged if it has zero or one <img> tags.
 *
 * @param {string} content
 * @returns {string}
 */
function deduplicateContent(content) {
  let count = 0;
  return content.replace(/<img[^>]*>/g, (m) => count++ === 0 ? m : '');
}

/**
 * Fetch the Micropub source for a post, deduplicate its <img> tags if needed,
 * and replace the content via Micropub update.
 *
 * @param {string} postUrl - Full micro.blog post URL
 * @param {string} token - micro.blog app token
 * @param {boolean} [dryRun=false] - When true, skip the Micropub update call
 * @returns {Promise<{outcome: string, imgCount?: number}>} Result object:
 *   - outcome 'deduped' (with imgCount) — post was updated (or would be in dry-run)
 *   - outcome 'skippedNoImage' — post has no img tags
 *   - outcome 'skippedSingleImage' — post has exactly one img tag
 *   - outcome 'skippedStaleUrl' — source content is null/empty
 *   Throws SourceQueryError on source fetch errors; throws on Micropub update errors.
 */
async function deduplicatePostImages(postUrl, token, dryRun = false) {
  const sourceUrl = `${MICROPUB_ENDPOINT}?q=source&url=${encodeURIComponent(postUrl)}`;
  const sourceRes = await fetch(sourceUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!sourceRes.ok) {
    const body = await sourceRes.text();
    throw new SourceQueryError(`Failed to query post source (${sourceRes.status}): ${body}`);
  }
  const data = await sourceRes.json();
  const content = data.properties?.content?.[0] ?? '';
  const existingCategory = data.properties?.category ?? [];

  if (!content) {
    return { outcome: 'skippedStaleUrl' };
  }

  const imgMatches = content.match(/<img[^>]*>/g);
  const imgCount = imgMatches ? imgMatches.length : 0;

  if (imgCount === 0) {
    return { outcome: 'skippedNoImage' };
  }

  if (imgCount === 1) {
    return { outcome: 'skippedSingleImage' };
  }

  const deduped = deduplicateContent(content);

  if (dryRun) {
    return { outcome: 'deduped', imgCount };
  }

  // Always include the existing category in the replace payload.
  // micro.blog's replace: { content } silently clears category — same bug as add: { photo }.
  const replacePayload = { content: [deduped] };
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

  return { outcome: 'deduped', imgCount };
}

/**
 * Main batch function. Reads the live production spreadsheet, finds posts with
 * a micro.blog URL, and deduplicates <img> tags on any that have more than one.
 *
 * Skip conditions (non-fatal, logged):
 *   - Row has no micro.blog URL
 *   - Post content is null/empty (stale URL from rescheduled post)
 *   - Post has zero or one img tag (already clean)
 *   - Source query fails
 *
 * @returns {Promise<void>}
 */
async function deduplicatePostImagesBatch() {
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

  const candidates = allRows.filter(row => row.microblogUrl);
  console.log(`Found ${candidates.length} rows with micro.blog URL\n`);

  const stats = {
    total: candidates.length,
    deduped: 0,
    dryRun: 0,
    skippedNoImage: 0,
    skippedSingleImage: 0,
    skippedStaleUrl: 0,
    skippedCheckFailed: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    console.log(`${progress} ${row.name} (${row.type})`);
    console.log(`  URL: ${row.microblogUrl}`);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would check for duplicate images and deduplicate if needed`);
      stats.dryRun++;
      continue;
    }

    try {
      const result = await deduplicatePostImages(row.microblogUrl, token, DRY_RUN);
      switch (result.outcome) {
        case 'deduped':
          console.log(`  ✅ Deduplicated (kept 1 of ${result.imgCount} images)`);
          stats.deduped++;
          break;
        case 'skippedNoImage':
          console.log(`  ⏭️  No images, skipping`);
          stats.skippedNoImage++;
          break;
        case 'skippedSingleImage':
          console.log(`  ⏭️  Single image, already clean`);
          stats.skippedSingleImage++;
          break;
        case 'skippedStaleUrl':
          console.warn(`  ⚠️  Source content is null/empty (possibly rescheduled post with stale URL) — skipping`);
          stats.skippedStaleUrl++;
          break;
      }
    } catch (err) {
      if (err instanceof SourceQueryError) {
        console.warn(`  ⚠️  Could not query post source: ${err.message} — skipping`);
        stats.skippedCheckFailed++;
      } else {
        console.error(`  ❌ Failed to deduplicate: ${err.message}`);
        stats.failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DEDUPLICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total rows with micro.blog URL:     ${stats.total}`);
  if (DRY_RUN) {
    console.log(`  🔍 Dry-run (would process):         ${stats.dryRun}`);
  } else {
    console.log(`  ✅ Posts deduplicated:              ${stats.deduped}`);
  }
  console.log(`  ⏭️  No images (skipped):            ${stats.skippedNoImage}`);
  console.log(`  ⏭️  Single image, clean (skipped):  ${stats.skippedSingleImage}`);
  console.log(`  ⚠️  Stale URL (skipped):            ${stats.skippedStaleUrl}`);
  console.log(`  ⚠️  Check failed (skipped):         ${stats.skippedCheckFailed}`);
  console.log(`  ❌ Dedup failed:                    ${stats.failed}`);
  console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
  deduplicatePostImagesBatch().catch(err => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { SourceQueryError, deduplicateContent, hasMultipleImages, deduplicatePostImages, deduplicatePostImagesBatch };
