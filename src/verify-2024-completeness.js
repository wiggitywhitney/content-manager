require('dotenv').config();

const { google } = require('googleapis');
const fs = require('fs');

/**
 * Verify 2024 data completeness
 *
 * Compares 2024_Work_Details spreadsheet against FINAL-2024.csv
 * to ensure all videos from the spreadsheet are represented in the final CSV.
 */

const WORK_DETAILS_SPREADSHEET_ID = '1m7DTzOMu3Bkba8Mp3z4mDL0BVyJTCuYWrc20GlsmIrs';
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
    // For other URLs, normalize by removing trailing slashes and query params
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

/**
 * Normalize title for comparison
 * @param {string} title - Title to normalize
 * @returns {string} - Normalized title
 */
function normalizeTitle(title) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if a video exists in the CSV data
 * @param {Object} video - Video object to check
 * @param {Array} csvData - Array of CSV rows
 * @returns {boolean} - True if video exists
 */
function videoExists(video, csvData) {
  const normalizedVideoURL = normalizeURL(video.Link);
  const normalizedVideoTitle = normalizeTitle(video.Name);

  for (const row of csvData) {
    const rowURL = normalizeURL(row.Link);
    const rowTitle = normalizeTitle(row.Name);

    // Match by URL (primary) or by title+date (fallback)
    if (rowURL && normalizedVideoURL && rowURL === normalizedVideoURL) {
      return true;
    }

    if (rowTitle === normalizedVideoTitle && row.Date === video.Date) {
      return true;
    }
  }

  return false;
}

/**
 * Main verification function
 */
async function verify2024Completeness() {
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

    // Read 2024_Work_Details spreadsheet (Sheet1 tab)
    console.log(`Reading 2024_Work_Details spreadsheet: ${WORK_DETAILS_SPREADSHEET_ID}`);
    console.log(`Sheet: ${SHEET_NAME}\n`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: WORK_DETAILS_SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values || [];
    console.log(`Found ${rows.length} total rows in spreadsheet (including header)\n`);

    // Parse spreadsheet data
    // This spreadsheet has different columns than 2025_Content_Created:
    // A: NAME, B: CONTENT TYPE, C: EXPORT INDICATOR, D: DATE, E: CONTENT LINK
    const spreadsheetData = [];
    for (let i = 1; i < rows.length; i++) { // Skip header
      const row = rows[i];

      // Skip section headers (rows with just 1 field like "January")
      if (row.length < 5) continue;

      // Skip rows without a link
      if (!row[4]) continue;

      const name = row[0] || '';
      const date = row[3] || '';
      let link = row[4] || '';

      // Convert youtu.be shortlinks to full YouTube URLs
      if (link.includes('youtu.be/')) {
        const videoId = link.split('youtu.be/')[1].split('?')[0];
        link = `https://www.youtube.com/watch?v=${videoId}`;
      } else if (!link.startsWith('http')) {
        // Add https:// if missing
        link = `https://${link}`;
      }

      spreadsheetData.push({
        Name: name,
        Date: date,
        Link: link
      });
    }

    console.log(`Parsed ${spreadsheetData.length} data rows from spreadsheet\n`);

    // Read FINAL-2024.csv
    const csvPath = 'data/FINAL-2024.csv';
    console.log(`Reading ${csvPath}...`);
    const final2024 = readCSV(csvPath);
    console.log(`Found ${final2024.length} videos in FINAL-2024.csv\n`);

    // Compare
    const missing = [];
    const existing = [];

    for (const video of spreadsheetData) {
      if (videoExists(video, final2024)) {
        existing.push(video);
      } else {
        missing.push(video);
      }
    }

    // Report results
    console.log('='.repeat(70));
    console.log('2024 COMPLETENESS VERIFICATION');
    console.log('='.repeat(70));
    console.log();
    console.log(`Total videos in 2024_Work_Details spreadsheet: ${spreadsheetData.length}`);
    console.log(`✅ Found in FINAL-2024.csv: ${existing.length}`);
    console.log(`❌ Missing from FINAL-2024.csv: ${missing.length}`);
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
      const missingCSVPath = 'data/2024-missing-from-final.csv';
      const headers = ['Name', 'Date', 'Link'];
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
            escape(v.Date),
            escape(v.Link)
          ].join(',');
        })
      ];

      fs.writeFileSync(missingCSVPath, csvLines.join('\n'), 'utf8');
      console.log(`✅ Wrote missing videos to ${missingCSVPath}`);
      console.log();
    } else {
      console.log('✅ All videos from 2024_Work_Details spreadsheet are present in FINAL-2024.csv!');
      console.log();
    }

    console.log('='.repeat(70));

    // Exit with error if missing videos
    if (missing.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if invoked directly
if (require.main === module) {
  verify2024Completeness();
}

module.exports = { verify2024Completeness };
