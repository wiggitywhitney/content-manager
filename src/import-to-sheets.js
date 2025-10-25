const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const TAB_NAME = '2024 & earlier';
const TEST_MODE = process.env.TEST_MODE === 'true';
const CSV_FILE = path.join(__dirname, '../data/FINAL-ALL-HISTORICAL-2020-2024.csv');

// Sample row indices for test mode (1-indexed, excluding header)
const TEST_SAMPLES = [2, 11, 43, 154, 167]; // 2020, 2021, 2022, 2023, 2024

async function main() {
  console.log(`\n=== Google Sheets Import Script ===`);
  console.log(`Mode: ${TEST_MODE ? 'TEST (5 samples)' : 'FULL (all rows)'}`);
  console.log(`Target: ${SPREADSHEET_ID}`);
  console.log(`Tab: "${TAB_NAME}"\n`);

  // Authenticate
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

  // Read CSV
  console.log(`Reading CSV: ${CSV_FILE}`);
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.trim().split('\n');
  const allRows = lines.map(line => parseCSVLine(line));

  console.log(`Total rows in CSV: ${allRows.length - 1} (+ 1 header)`);

  // Select rows based on mode
  let rowsToImport;
  if (TEST_MODE) {
    rowsToImport = [
      allRows[0], // header
      ...TEST_SAMPLES.map(idx => allRows[idx])
    ];
    console.log(`Test samples: rows ${TEST_SAMPLES.join(', ')}\n`);
  } else {
    rowsToImport = allRows;
  }

  // Get spreadsheet info
  console.log(`Fetching spreadsheet info...`);
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  // Delete unwanted tabs
  const tabsToDelete = ['NEEDS_REVIEW', 'YouTube Shorts'];
  for (const tabName of tabsToDelete) {
    const tabToDelete = spreadsheet.data.sheets.find(
      sheet => sheet.properties.title === tabName
    );
    if (tabToDelete) {
      console.log(`Deleting tab "${tabName}" (ID: ${tabToDelete.properties.sheetId})...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteSheet: {
              sheetId: tabToDelete.properties.sheetId,
            },
          }],
        },
      });
      console.log(`✅ Deleted tab "${tabName}"`);
    }
  }

  // Check if target tab exists
  console.log(`Checking if tab "${TAB_NAME}" exists...`);
  const existingTab = spreadsheet.data.sheets.find(
    sheet => sheet.properties.title === TAB_NAME
  );

  let sheetId;
  if (existingTab) {
    console.log(`Tab "${TAB_NAME}" already exists (ID: ${existingTab.properties.sheetId})`);
    sheetId = existingTab.properties.sheetId;

    // Clear existing data
    console.log('Clearing existing data...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TAB_NAME}!A:H`,
    });
  } else {
    // Create new tab
    console.log(`Creating new tab "${TAB_NAME}"...`);
    const addSheetResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: TAB_NAME,
              gridProperties: {
                frozenRowCount: 1, // Freeze header row
              },
            },
          },
        }],
      },
    });
    sheetId = addSheetResponse.data.replies[0].addSheet.properties.sheetId;
    console.log(`Created tab with ID: ${sheetId}`);
  }

  // Write data to sheet
  console.log(`\nWriting ${rowsToImport.length - 1} rows to "${TAB_NAME}"...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: rowsToImport,
    },
  });

  console.log('✅ Import successful!');

  // Format header row (bold)
  console.log('Formatting header row...');
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: true,
              },
            },
          },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      }],
    },
  });

  console.log('\n=== Summary ===');
  console.log(`Spreadsheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
  console.log(`Tab: "${TAB_NAME}"`);
  console.log(`Rows imported: ${rowsToImport.length - 1}`);
  console.log(`\nTo import all data, run: TEST_MODE=false npm run import-historical`);
}

// Simple CSV parser (handles quoted fields with commas)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

main().catch(console.error);
