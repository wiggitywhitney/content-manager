const { google } = require('googleapis');

// Spreadsheet configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';

async function removeTestRows() {
  console.log(`\n🧹 Removing test rows from ${SHEET_NAME}...\n`);

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

  // Read all rows to find test rows
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:H`,
  });

  const rows = response.data.values || [];

  // Find rows that start with "TEST:"
  const testRowIndices = [];
  rows.forEach((row, index) => {
    if (row[0] && row[0].startsWith('TEST:')) {
      testRowIndices.push(index);
    }
  });

  if (testRowIndices.length === 0) {
    console.log('✅ No test rows found\n');
    return;
  }

  console.log(`Found ${testRowIndices.length} test rows to delete:`);
  testRowIndices.forEach(index => {
    const row = rows[index];
    console.log(`  Row ${index + 1}: ${row[0]} (${row[3]})`);
  });

  // Delete rows in reverse order (to maintain correct indices)
  console.log('\nDeleting rows...');
  for (let i = testRowIndices.length - 1; i >= 0; i--) {
    const rowIndex = testRowIndices[i];
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // Sheet1 has ID 0
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }
        ]
      }
    });
    console.log(`  ✓ Deleted row ${rowIndex + 1}`);
  }

  console.log(`\n✅ Removed ${testRowIndices.length} test rows from ${SHEET_NAME}\n`);
}

// Run the script
removeTestRows().catch(error => {
  console.error(`\n❌ Error removing test rows: ${error.message}\n`);
  process.exit(1);
});
