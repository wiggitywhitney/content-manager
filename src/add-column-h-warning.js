const { google } = require('googleapis');
require('dotenv').config();

const SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';

async function addWarning() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Update Column H header with warning
  const headerText = 'Micro.blog URL ⚠️ DO NOT EDIT';

  console.log('Adding warning to Column H header...\n');

  // Update Sheet1 header
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!H1',
    valueInputOption: 'RAW',
    resource: {
      values: [[headerText]]
    }
  });
  console.log('✅ Updated Sheet1 Column H header');

  // Update 2024 & earlier header
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '2024 & earlier!H1',
    valueInputOption: 'RAW',
    resource: {
      values: [[headerText]]
    }
  });
  console.log('✅ Updated 2024 & earlier Column H header');

  console.log('\nDone!');
}

addWarning().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
