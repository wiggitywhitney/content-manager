// ABOUTME: One-time setup script to create the social posts Google Sheet with the correct schema.
// ABOUTME: Run once to provision the sheet; outputs the spreadsheet ID to add to secrets.

'use strict';

/**
 * Usage:
 *   GOOGLE_SERVICE_ACCOUNT_JSON=$(gcloud secrets versions access latest \
 *     --secret=content_manager_service_account --project=demoo-ooclock) \
 *   node src/create-social-posts-sheet.js
 *
 * This script creates a new Google Sheet owned by the service account.
 * After running, share the resulting spreadsheet with your Google account
 * (via Google Drive) and add the printed ID to Secret Manager as SOCIAL_POSTS_SHEET_ID.
 */

const { google } = require('googleapis');

const HEADERS = [
  'Show',
  'Episode/Short Title',
  'Post Type',
  'Post Text',
  'YouTube URL',
  'Alt Text',
  'Scheduled Date',
  'Platforms',
  'Status',
  'LinkedIn Post URL',
  'Bluesky Post URL',
  'Mastodon Post URL',
  'micro.blog Post URL',
];

async function createSocialPostsSheet() {
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

  console.log('Creating social posts spreadsheet...');
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: 'Social Posts Queue',
      },
      sheets: [
        {
          properties: {
            title: 'Sheet1',
            gridProperties: {
              frozenRowCount: 1, // Freeze header row
            },
          },
        },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId;
  const spreadsheetUrl = createResponse.data.spreadsheetUrl;

  console.log(`Created spreadsheet: ${spreadsheetUrl}`);
  console.log(`Spreadsheet ID: ${spreadsheetId}`);

  // Write header row
  console.log('Writing header row...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1:M1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [HEADERS],
    },
  });

  // Bold and freeze header row via batchUpdate
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
              },
            },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
      ],
    },
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('Sheet created successfully!');
  console.log('');
  console.log('Next steps:');
  console.log(`1. Share the spreadsheet with your Google account: ${spreadsheetUrl}`);
  console.log(`2. Add the ID to Secret Manager:`);
  console.log(`   echo -n "${spreadsheetId}" | gcloud secrets create SOCIAL_POSTS_SHEET_ID \\`);
  console.log(`     --data-file=- --project=demoo-ooclock`);
  console.log(`3. Add SOCIAL_POSTS_SHEET_ID as a GitHub Actions secret`);
  console.log('='.repeat(60));

  return spreadsheetId;
}

createSocialPostsSheet().catch(err => {
  console.error('Failed to create spreadsheet:', err.message);
  process.exit(1);
});
