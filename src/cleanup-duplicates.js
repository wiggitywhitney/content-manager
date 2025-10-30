/**
 * Cleanup script for duplicate posts
 *
 * Deletes:
 * 1. Headlamp 10/28 post (https://whitneylee.com/2025/10/28/thunder-headlamp-a-userfriendly-extensible.html)
 * 2. AI for the Rest of Us 10/29 post
 * 3. Software Defined Interviews Saad Ansari 10/27 post
 *
 * And updates spreadsheet with correct URLs
 */

const { google } = require('googleapis');
const https = require('https');
require('dotenv').config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';

// URLs to delete from Micro.blog
const URLS_TO_DELETE = [
  'https://whitneylee.com/2025/10/28/thunder-headlamp-a-userfriendly-extensible.html',
  // Will add AI and Software Defined Interviews URLs once identified
];

// Helper to make HTTPS requests
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function deleteFromMicroblog(url) {
  console.log(`\nDeleting from Micro.blog: ${url}`);

  const options = {
    hostname: 'micro.blog',
    path: '/micropub',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MICROBLOG_APP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options, {
      action: 'delete',
      url: url
    });

    if (response.statusCode === 204 || response.statusCode === 200) {
      console.log(`✅ Successfully deleted: ${url}`);
      return true;
    } else if (response.statusCode === 404) {
      console.log(`⚠️  Post already deleted or not found`);
      return true;
    } else {
      console.log(`❌ Failed to delete (${response.statusCode}):`, response.body);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error deleting post:`, error.message);
    return false;
  }
}

async function updateSpreadsheet() {
  console.log('\nFinding duplicate posts in spreadsheet...');

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Read both sheets
  const [sheet1Data, historicalData] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:H'
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '2024 & earlier!A:H'
    })
  ]);

  // Find the posts
  const duplicates = [
    {
      name: 'Headlamp',
      deleteUrl: 'https://whitneylee.com/2025/10/28/thunder-headlamp-a-userfriendly-extensible.html',
      keepUrl: 'https://whitneylee.com/2025/10/09/thunder-headlamp-a-userfriendly-extensible.html',
      data: sheet1Data
    },
    // Add other duplicates as we identify them
  ];

  for (const dup of duplicates) {
    console.log(`\nLooking for ${dup.name}...`);

    if (dup.data.values) {
      for (let i = 0; i < dup.data.values.length; i++) {
        const row = dup.data.values[i];
        const urlCell = row[7]; // Column H

        if (urlCell === dup.deleteUrl) {
          console.log(`  Found at row ${i + 1} (to delete)`);
          console.log(`  Current URL: ${urlCell}`);
          console.log(`  Should be: ${dup.keepUrl}`);
        } else if (urlCell === dup.keepUrl) {
          console.log(`  Found at row ${i + 1} (correct URL)`);
        } else if (urlCell && urlCell.includes(dup.name.toLowerCase())) {
          console.log(`  Potential match at row ${i + 1}: ${urlCell}`);
        }
      }
    }
  }
}

async function main() {
  try {
    console.log('='.repeat(70));
    console.log('DUPLICATE CLEANUP SCRIPT');
    console.log('='.repeat(70));

    // Delete the posts
    for (const url of URLS_TO_DELETE) {
      await deleteFromMicroblog(url);
    }

    // Check spreadsheet
    await updateSpreadsheet();

    console.log('\n' + '='.repeat(70));
    console.log('Cleanup complete! Review the output above and update spreadsheet manually if needed.');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
