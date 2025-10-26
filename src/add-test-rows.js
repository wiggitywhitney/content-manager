const { google } = require('googleapis');

// Spreadsheet configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';

/**
 * Test scenarios to create
 */
const TEST_SCENARIOS = {
  bulkAdd: [
    { name: 'TEST: Bulk Add 1 (Oldest)', type: 'Video', show: 'Yes', date: '01/15/2025', location: '', confirmed: 'Yes', link: 'https://example.com/test1' },
    { name: 'TEST: Bulk Add 2', type: 'Podcast', show: 'Yes', date: '02/15/2025', location: '', confirmed: 'Yes', link: 'https://example.com/test2' },
    { name: 'TEST: Bulk Add 3', type: 'Blog', show: 'Yes', date: '03/15/2025', location: '', confirmed: 'Yes', link: 'https://example.com/test3' },
    { name: 'TEST: Bulk Add 4', type: 'Presentations', show: 'Yes', date: '04/15/2025', location: '', confirmed: 'Yes', link: 'https://example.com/test4' },
    { name: 'TEST: Bulk Add 5 (Newest)', type: 'Guest', show: 'Yes', date: '05/15/2025', location: '', confirmed: 'Yes', link: 'https://example.com/test5' }
  ],
  sameDate: [
    { name: 'TEST: Same Date 1', type: 'Video', show: 'Yes', date: '06/01/2025', location: '', confirmed: 'Yes', link: 'https://example.com/samedate1' },
    { name: 'TEST: Same Date 2', type: 'Podcast', show: 'Yes', date: '06/01/2025', location: '', confirmed: 'Yes', link: 'https://example.com/samedate2' },
    { name: 'TEST: Same Date 3', type: 'Blog', show: 'Yes', date: '06/01/2025', location: '', confirmed: 'Yes', link: 'https://example.com/samedate3' }
  ]
};

async function addTestRows(scenario = 'bulkAdd') {
  console.log(`\n🧪 Adding test rows for scenario: ${scenario}\n`);

  // Authenticate with Google Sheets API
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get test rows for the scenario
  const testRows = TEST_SCENARIOS[scenario];
  if (!testRows) {
    throw new Error(`Unknown scenario: ${scenario}. Available: ${Object.keys(TEST_SCENARIOS).join(', ')}`);
  }

  // Format rows for Google Sheets (A-H columns, leave Column H empty)
  const formattedRows = testRows.map(row => [
    row.name,
    row.type,
    row.show,
    row.date,
    row.location,
    row.confirmed,
    row.link,
    '' // Column H (Micro.blog URL) - empty for testing
  ]);

  // Append rows to the spreadsheet
  console.log(`Adding ${formattedRows.length} test rows to ${SHEET_NAME}...\n`);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:H`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: formattedRows
    }
  });

  const updatedRange = response.data.updates.updatedRange;
  console.log(`✅ Added ${formattedRows.length} test rows to ${updatedRange}\n`);

  // Show what was added
  console.log('Test rows added:');
  testRows.forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.name} (${row.date})`);
  });

  console.log('\n📋 Next steps:');
  console.log('  1. Run: DRY_RUN=true npm run sync');
  console.log('  2. Verify rate limiting works (only oldest post should be selected)');
  console.log(`  3. Clean up test data with: node src/remove-test-rows.js\n`);
}

// Parse command-line arguments
const scenario = process.argv[2] || 'bulkAdd';

// Run the script
addTestRows(scenario).catch(error => {
  console.error(`\n❌ Error adding test rows: ${error.message}\n`);
  process.exit(1);
});
