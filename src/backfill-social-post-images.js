// ABOUTME: Backfills thumbnail images onto micro.blog social posts that were missed by the archive backfill.
// ABOUTME: Social posts are uncategorized (no category) and were created by the dual-post strategy alongside archive posts.

'use strict';

const { google } = require('googleapis');
const { fetchThumbnail } = require('./fetch-thumbnail');
const { needsImage, queryMicroblogPosts, uploadImageToMediaEndpoint } = require('./sync-content');
const { parseTabRows, addPhotoToPost } = require('./backfill-career-images');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';
const HISTORICAL_TAB_NAME = process.env.HISTORICAL_TAB_NAME || '2024 & earlier';

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Build a Map from link URL to spreadsheet row for rows that need an image.
 * Excludes rows without a link and rows where needsImage returns false.
 *
 * @param {Array<Object>} rows - Parsed spreadsheet rows
 * @returns {Map<string, Object>} Map of link → row
 */
function buildLinkMap(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.link && needsImage(row)) {
      map.set(row.link, row);
    }
  }
  return map;
}

/**
 * Find the spreadsheet row that corresponds to a micro.blog post, based on whether
 * the post content string includes the row's link URL.
 *
 * formatPostContent embeds the link as Markdown [title](url), so content.includes(link)
 * is the correct check — NOT an href attribute search.
 *
 * @param {string|null} content - Post content string
 * @param {Map<string, Object>} linkMap - Map of link URL → spreadsheet row
 * @returns {Object|null} Matching row or null if no match found
 */
function findMatchingRow(content, linkMap) {
  if (!content) return null;
  for (const [link, row] of linkMap) {
    if (content.includes(link)) return row;
  }
  return null;
}

/**
 * Main batch function. Reads the live production spreadsheet to build a link→row map,
 * then fetches all micro.blog posts, finds uncategorized posts without images that
 * match a spreadsheet row, and attaches the appropriate thumbnail via Micropub update.
 *
 * Social posts are identified as posts with an empty category array — they are created
 * by the dual-post strategy alongside archive posts but without a category, so the
 * archive backfill never touched them.
 *
 * Skip conditions (non-fatal, logged):
 *   - Post has a non-empty category (archive post, not a social post)
 *   - Post already has an <img> tag in content
 *   - Post content is null/empty (stale URL)
 *   - No spreadsheet row's link found in post content
 *   - Thumbnail fetch returns null or throws
 *   - Media upload fails
 *
 * @returns {Promise<void>}
 */
async function backfillSocialPostImages() {
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

  const linkMap = buildLinkMap(allRows);
  console.log(`Built link map with ${linkMap.size} image-eligible rows`);

  console.log('Fetching all micro.blog posts...');
  const allPosts = await queryMicroblogPosts();
  console.log(`Fetched ${allPosts.size} posts from micro.blog\n`);

  // Find social posts: no category, no existing image, content matches a spreadsheet link
  const candidates = [];
  for (const [postUrl, postData] of allPosts) {
    const { content, category } = postData;
    if (category) continue; // archive/career posts have a category
    if (!content) continue; // stale URL — null/empty content
    if (content.includes('<img')) continue; // already has an image
    const row = findMatchingRow(content, linkMap);
    if (row) candidates.push({ postUrl, row });
  }

  console.log(`Found ${candidates.length} social posts to backfill\n`);

  const stats = {
    total: candidates.length,
    updated: 0,
    dryRun: 0,
    skippedFetchFailed: 0,
    skippedUploadFailed: 0,
    failed: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const { postUrl, row } = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    console.log(`${progress} ${row.name} (${row.type})`);
    console.log(`  Post: ${postUrl}`);
    console.log(`  Link: ${row.link}`);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would fetch thumbnail and attach photo`);
      stats.dryRun++;
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

    // Attach photo via content-replace (never use add: { photo } — it strips categories)
    try {
      await addPhotoToPost(postUrl, photoUrl, token);
      console.log(`  ✅ Photo attached`);
      stats.updated++;
    } catch (err) {
      console.error(`  ❌ Micropub update failed: ${err.message}`);
      stats.failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SOCIAL POST IMAGE BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total social posts to backfill:  ${stats.total}`);
  if (DRY_RUN) {
    console.log(`  🔍 Dry-run (would update):       ${stats.dryRun}`);
  } else {
    console.log(`  ✅ Updated:                      ${stats.updated}`);
  }
  console.log(`  ⚠️  Fetch failed:                ${stats.skippedFetchFailed}`);
  console.log(`  ⚠️  Upload failed:               ${stats.skippedUploadFailed}`);
  console.log(`  ❌ Update failed:                ${stats.failed}`);
  console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
  backfillSocialPostImages().catch(err => {
    console.error(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { buildLinkMap, findMatchingRow, backfillSocialPostImages };
