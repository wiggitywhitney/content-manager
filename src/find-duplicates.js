const { google } = require('googleapis');
require('dotenv').config();

const SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';

async function findAndFixDuplicates() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Read Sheet1
  const sheet1 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A:H'
  });

  console.log('Looking for duplicate posts in Sheet1...\n');

  const duplicates = [
    { name: 'Headlamp', oldUrl: 'https://whitneylee.com/2025/10/28/thunder-headlamp-a-userfriendly-extensible.html', newUrl: 'https://whitneylee.com/2025/10/09/thunder-headlamp-a-userfriendly-extensible.html', oldDate: '10/28', newDate: '10/09' },
    { name: 'AI for the Rest of Us', oldUrl: 'https://whitneylee.com/2025/10/29/ai-for-the-rest-of.html', newUrl: 'https://whitneylee.com/2025/10/10/ai-for-the-rest-of.html', oldDate: '10/29', newDate: '10/10' },
    { name: 'Software Defined Interviews Saad Ansari', oldUrl: 'https://whitneylee.com/2025/10/27/software-defined-interviews-cows-tech.html', newUrl: 'https://whitneylee.com/2025/09/29/software-defined-interviews-cows-tech.html', oldDate: '10/27', newDate: '9/29' }
  ];

  for (const dup of duplicates) {
    console.log(`\n${dup.name}:`);
    console.log(`  Old URL (${dup.oldDate}): ${dup.oldUrl}`);
    console.log(`  Correct URL (${dup.newDate}): ${dup.newUrl}`);

    if (sheet1.data.values) {
      let foundOld = false;
      let foundNew = false;

      for (let i = 0; i < sheet1.data.values.length; i++) {
        const row = sheet1.data.values[i];
        const title = row[0];
        const url = row[7];

        if (url === dup.oldUrl) {
          console.log(`  ❌ Row ${i + 1}: Has OLD URL`);
          foundOld = true;
        } else if (url === dup.newUrl) {
          console.log(`  ✅ Row ${i + 1}: Has CORRECT URL`);
          foundNew = true;
        }
      }

      if (!foundOld && !foundNew) {
        console.log(`  ⚠️  Neither URL found in spreadsheet`);
      }
    }
  }
}

findAndFixDuplicates().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
