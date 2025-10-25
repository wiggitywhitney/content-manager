require('dotenv').config();

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Verify 2025 data in Sheet1 against YouTube playlist extracts
 *
 * Compares what's currently in Sheet1 with what was extracted from YouTube
 * to identify missing videos that should be added.
 */

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = 'Sheet1';
const RANGE = `${SHEET_NAME}!A:H`;

/**
 * Read CSV file and parse into array of objects
 * @param {string} csvPath - Path to CSV file
 * @returns {Array} - Array of video objects
 */
function readCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header row
  const dataLines = lines.slice(1);

  const videos = [];
  for (const line of dataLines) {
    // Simple CSV parsing (handles quoted fields)
    const fields = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField); // Last field

    if (fields.length >= 7) {
      videos.push({
        Name: fields[0],
        Type: fields[1],
        Show: fields[2],
        Date: fields[3],
        Location: fields[4],
        Confirmed: fields[5],
        Link: fields[6],
        'Micro.blog URL': fields[7] || ''
      });
    }
  }

  return videos;
}

/**
 * Normalize URL for comparison (remove query params, trailing slashes)
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
 */
function normalizeURL(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    // For YouTube, just use the video ID
    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Check if a video exists in the spreadsheet data
 * @param {Object} video - Video object to check
 * @param {Array} sheetData - Array of spreadsheet rows
 * @returns {boolean} - True if video exists
 */
function videoExists(video, sheetData) {
  const normalizedVideoURL = normalizeURL(video.Link);

  for (const row of sheetData) {
    const rowURL = normalizeURL(row.Link);
    if (rowURL === normalizedVideoURL) {
      return true;
    }
  }

  return false;
}

/**
 * Main verification function
 */
async function verifySheet1() {
  try {
    // Authenticate with Google Sheets API
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

    // Read Sheet1
    console.log(`Reading spreadsheet: ${SPREADSHEET_ID}`);
    console.log(`Sheet: ${SHEET_NAME}\n`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values || [];
    console.log(`Found ${rows.length} total rows in Sheet1 (including header)\n`);

    // Parse Sheet1 data
    const sheetData = [];
    for (let i = 1; i < rows.length; i++) { // Skip header
      const row = rows[i];
      if (row.length >= 7) {
        sheetData.push({
          Name: row[0] || '',
          Type: row[1] || '',
          Show: row[2] || '',
          Date: row[3] || '',
          Location: row[4] || '',
          Confirmed: row[5] || '',
          Link: row[6] || '',
          'Micro.blog URL': row[7] || ''
        });
      }
    }

    console.log(`Parsed ${sheetData.length} data rows from Sheet1\n`);

    // Read 2025 You Choose! CSV
    const csvPath = 'data/you-choose-2025.csv';
    console.log(`Reading ${csvPath}...`);
    const youChoose2025 = readCSV(csvPath);
    console.log(`Found ${youChoose2025.length} videos in You Choose! 2025 CSV\n`);

    // Compare
    const missing = [];
    const existing = [];

    for (const video of youChoose2025) {
      if (videoExists(video, sheetData)) {
        existing.push(video);
      } else {
        missing.push(video);
      }
    }

    // Report results
    console.log('='.repeat(70));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(70));
    console.log();
    console.log(`Total You Choose! 2025 videos: ${youChoose2025.length}`);
    console.log(`✅ Already in Sheet1: ${existing.length}`);
    console.log(`❌ Missing from Sheet1: ${missing.length}`);
    console.log();

    if (missing.length > 0) {
      console.log('Missing videos:');
      console.log('-'.repeat(70));
      for (const video of missing) {
        console.log(`  📹 ${video.Name}`);
        console.log(`     Date: ${video.Date}`);
        console.log(`     Link: ${video.Link}`);
        console.log();
      }

      // Write missing videos to CSV
      const missingCSVPath = 'data/you-choose-2025-missing.csv';
      const headers = ['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL'];
      const csvLines = [
        headers.join(','),
        ...missing.map(v => {
          const escape = (field) => {
            const str = String(field || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          };

          return [
            escape(v.Name),
            escape(v.Type),
            escape(v.Show),
            escape(v.Date),
            escape(v.Location),
            escape(v.Confirmed),
            escape(v.Link),
            escape(v['Micro.blog URL'])
          ].join(',');
        })
      ];

      fs.writeFileSync(missingCSVPath, csvLines.join('\n'), 'utf8');
      console.log(`✅ Wrote missing videos to ${missingCSVPath}`);
      console.log();
    }

    if (existing.length > 0) {
      console.log(`✅ ${existing.length} You Choose! 2025 videos already exist in Sheet1`);
      console.log();
    }

    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if invoked directly
if (require.main === module) {
  verifySheet1();
}

module.exports = { verifySheet1 };
