require('dotenv').config();

const { google } = require('googleapis');

/**
 * List all sheets in a spreadsheet
 */

const SPREADSHEET_ID = process.argv[2] || '1m7DTzOMu3Bkba8Mp3z4mDL0BVyJTCuYWrc20GlsmIrs';

async function listSheets() {
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

    console.log(`Reading spreadsheet: ${SPREADSHEET_ID}\n`);

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    console.log('Available sheets:');
    console.log('-'.repeat(70));
    response.data.sheets.forEach((sheet, index) => {
      console.log(`${index + 1}. ${sheet.properties.title}`);
    });
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listSheets();
