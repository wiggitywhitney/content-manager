require('dotenv').config();

const { google } = require('googleapis');
const fs = require('fs');

/**
 * Create a NEEDS_REVIEW tab in the spreadsheet and import videos needing manual review
 *
 * Includes:
 * - 46 Presentations & Guest videos (Type = NEEDS_REVIEW, need Presentations vs Guest)
 * - 29 Software Defined Interviews (Type = Podcast, but missing dates)
 */

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const TAB_NAME = 'NEEDS_REVIEW';

function readCSV(csvPath) {
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header row
  const dataLines = lines.slice(1);

  const videos = [];
  for (const line of dataLines) {
    // Simple CSV parsing
    const fields = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField);

    if (fields.length >= 7) {
      videos.push([
        fields[0], // Name
        fields[1], // Type
        fields[2], // Show
        fields[3], // Date
        fields[4], // Location
        fields[5], // Confirmed
        fields[6], // Link
        fields[7] || '' // Micro.blog URL
      ]);
    }
  }

  return videos;
}

async function createReviewTab() {
  try {
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

    console.log(`Creating NEEDS_REVIEW tab in spreadsheet: ${SPREADSHEET_ID}\n`);

    // Check if tab already exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });

    const existingTab = spreadsheet.data.sheets.find(
      sheet => sheet.properties.title === TAB_NAME
    );

    let sheetId;

    if (existingTab) {
      console.log(`Tab "${TAB_NAME}" already exists, will clear and update it`);
      sheetId = existingTab.properties.sheetId;

      // Clear existing data
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${TAB_NAME}!A:H`
      });
    } else {
      console.log(`Creating new tab "${TAB_NAME}"`);

      // Create new sheet
      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: TAB_NAME
              }
            }
          }]
        }
      });

      sheetId = addSheetResponse.data.replies[0].addSheet.properties.sheetId;
    }

    // Read NEEDS_REVIEW videos from FINAL CSVs
    console.log('\nReading NEEDS_REVIEW videos from FINAL CSVs...');
    const presentationsGuest = readCSV('data/FINAL-ALL-HISTORICAL-2020-2024.csv')
      .filter(row => row[1] === 'NEEDS_REVIEW');

    console.log(`Found ${presentationsGuest.length} Presentations & Guest videos`);

    // Read Software Defined Interviews
    const sdiVideos = readCSV('data/software-defined-interviews.csv');
    console.log(`Found ${sdiVideos.length} Software Defined Interviews episodes`);

    // Combine all videos
    const allVideos = [...presentationsGuest, ...sdiVideos];

    // Sort by date (those with dates first)
    allVideos.sort((a, b) => {
      const dateA = a[3]; // Date column
      const dateB = b[3];

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // No date goes to end
      if (!dateB) return -1;

      return new Date(dateA) - new Date(dateB);
    });

    console.log(`\nTotal videos to import: ${allVideos.length}`);

    // Prepare data with header
    const headers = ['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL'];
    const dataToImport = [headers, ...allVideos];

    // Write data to sheet
    console.log(`\nWriting data to ${TAB_NAME} tab...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TAB_NAME}!A1`,
      valueInputOption: 'RAW',
      resource: {
        values: dataToImport
      }
    });

    // Format header row (bold, freeze)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          // Bold header row
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true
                  }
                }
              },
              fields: 'userEnteredFormat.textFormat.bold'
            }
          },
          // Freeze header row
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: {
                  frozenRowCount: 1
                }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          }
        ]
      }
    });

    console.log(`\n✅ Successfully created ${TAB_NAME} tab with ${allVideos.length} videos`);
    console.log(`\nSpreadsheet URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
    console.log(`\nTODO:`);
    console.log(`  - Review ${presentationsGuest.length} Presentations & Guest videos:`);
    console.log(`    Change Type from "NEEDS_REVIEW" to either "Presentations" or "Guest"`);
    console.log(`  - Add dates to ${sdiVideos.length} Software Defined Interviews episodes`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

createReviewTab();
