require('dotenv').config();

const { google } = require('googleapis');

/**
 * Debug 2024_Work_Details spreadsheet structure
 */

const SPREADSHEET_ID = '1m7DTzOMu3Bkba8Mp3z4mDL0BVyJTCuYWrc20GlsmIrs';
const SHEET_NAME = 'Sheet1';
const RANGE = `${SHEET_NAME}!A:H`;

async function debugSpreadsheet() {
  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');
    }

    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log(`Reading spreadsheet: ${SPREADSHEET_ID}`);
    console.log(`Sheet: ${SHEET_NAME}\n`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values || [];
    console.log(`Total rows: ${rows.length}\n`);

    // Show header
    console.log('Header row:');
    console.log(rows[0]);
    console.log();

    // Show first 5 data rows
    console.log('First 5 data rows:');
    for (let i = 1; i <= Math.min(5, rows.length - 1); i++) {
      console.log(`\nRow ${i}:`);
      console.log(`  Length: ${rows[i].length}`);
      console.log(`  Data:`, rows[i]);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugSpreadsheet();
