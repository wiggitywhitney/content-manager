// ABOUTME: Standalone runner — reads live spreadsheet and calls updateAboutPage.
// ABOUTME: Use for manual test runs before the feature is wired into daily-sync.yml.
'use strict';

const { google } = require('googleapis');
const { updateAboutPage } = require('./update-about-page');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const RANGE = (process.env.SHEET_NAME || 'Sheet1') + '!A:H';

async function main() {
  console.log('Reading live production spreadsheet...'); // eslint-disable-line no-console
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required');
  }
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
  const rows = (response.data.values || []).slice(1); // skip header row

  const validRows = rows
    .map(row => ({
      name: (row[0] || '').trim(),
      type: (row[1] || '').trim(),
      show: (row[2] || '').trim(),
      date: (row[3] || '').trim(),
    }))
    .filter(r => r.type && r.date);

  console.log(`Found ${validRows.length} valid rows`); // eslint-disable-line no-console
  console.log('Updating About page...'); // eslint-disable-line no-console

  const result = await updateAboutPage(validRows, new Date());
  if (result.updated) {
    console.log('About page updated. Check whitneylee.com/about to verify.'); // eslint-disable-line no-console
  } else {
    console.log('About page already up to date — no change made.'); // eslint-disable-line no-console
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
