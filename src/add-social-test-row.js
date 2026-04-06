// ABOUTME: Adds a test row to the social posts queue sheet for Milestone 5 verification.
// ABOUTME: Run before triggering the daily cron to verify direct posting works without duplicates.

'use strict';

const { google } = require('googleapis');

const SOCIAL_POSTS_SHEET_ID = process.env.SOCIAL_POSTS_SHEET_ID;

function getTodayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function addSocialTestRow() {
  if (!SOCIAL_POSTS_SHEET_ID) {
    throw new Error('SOCIAL_POSTS_SHEET_ID environment variable is required');
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const today = getTodayDate();

  // Columns: Show, Title, PostType, PostText, YouTubeURL, AltText, ScheduledDate, Platforms, Status
  const testRow = [
    'TEST',
    'Milestone 5 verification post - DELETE ME',
    'episode',
    'TEST POST - please ignore. Milestone 5 verification for direct social posting.',
    'https://youtu.be/dQw4w9WgXcQ',
    'Test alt text',
    today,
    'bluesky,mastodon',
    'pending',
  ];

  console.log(`[social-test] Adding test row scheduled for ${today} (bluesky + mastodon)...`);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SOCIAL_POSTS_SHEET_ID,
    range: 'Sheet1!A:I',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [testRow] },
  });

  console.log(`[social-test] Added test row at ${response.data.updates.updatedRange}`);
  console.log('[social-test] Next steps:');
  console.log('  1. Run: vals exec -f .vals.yaml -- node src/post-social-content.js');
  console.log('  2. Check Bluesky and Mastodon — post should appear exactly once on each');
  console.log('  3. Confirm no duplicate from Micro.blog syndication');
  console.log('  4. Delete the test row from the sheet manually when done');
}

addSocialTestRow().catch(err => {
  console.error('[social-test] Error:', err.message);
  process.exit(1);
});
