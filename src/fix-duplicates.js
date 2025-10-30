const { google } = require('googleapis');
require('dotenv').config();

const SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';

async function fixDuplicates() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Fixes to apply: row (1-indexed), new URL
  const fixes = [
    { row: 96, name: 'Headlamp', oldUrl: 'https://whitneylee.com/2025/10/28/thunder-headlamp-a-userfriendly-extensible.html', newUrl: 'https://whitneylee.com/2025/10/09/thunder-headlamp-a-userfriendly-extensible.html' },
    { row: 97, name: 'AI for the Rest of Us', oldUrl: 'https://whitneylee.com/2025/10/29/ai-for-the-rest-of.html', newUrl: 'https://whitneylee.com/2025/10/10/ai-for-the-rest-of.html' },
    { row: 90, name: 'Software Defined Interviews Saad Ansari', oldUrl: 'https://whitneylee.com/2025/10/27/software-defined-interviews-cows-tech.html', newUrl: 'https://whitneylee.com/2025/09/29/software-defined-interviews-cows-tech.html' }
  ];

  console.log('Fixing duplicate post URLs in spreadsheet...\n');

  for (const fix of fixes) {
    console.log(`Fixing Row ${fix.row}: ${fix.name}`);
    console.log(`  Replacing: ${fix.oldUrl}`);
    console.log(`  With:      ${fix.newUrl}`);

    // Clear the old URL by setting it to empty string
    // This way the next sync will see it as orphaned and delete it
    // And we'll manually ensure the correct URL is there
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Sheet1!H${fix.row}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[fix.newUrl]]
      }
    });

    console.log(`  ✅ Updated\n`);
  }

  console.log('='.repeat(70));
  console.log('All URLs fixed!');
  console.log('Next sync will:');
  console.log('  1. Detect old URLs (10/28, 10/29, 10/27) as orphaned');
  console.log('  2. Delete them from Micro.blog');
  console.log('='.repeat(70));
}

fixDuplicates().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
