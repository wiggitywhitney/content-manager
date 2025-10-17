const { google } = require('googleapis');

// Spreadsheet configuration
const SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = 'Sheet1';
const RANGE = `${SHEET_NAME}!A:G`; // Name, Type, Show, Date, Location, Confirmed, Link

/**
 * Format timestamp for logging
 * @returns {string} - Formatted timestamp [YYYY-MM-DD HH:MM:SS]
 */
function formatTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
}

/**
 * Log with timestamp and formatting
 * @param {string} message - Log message
 * @param {string} level - Log level (INFO, WARN, ERROR)
 */
function log(message, level = 'INFO') {
  console.log(`${formatTimestamp()} ${level}: ${message}`);
}

/**
 * Parse a raw spreadsheet row into a structured content object
 * @param {Array} row - Raw row data from Google Sheets
 * @param {number} rowIndex - Original row index (for debugging)
 * @returns {Object|null} - Parsed content object or null if header row
 */
function parseRow(row, rowIndex) {
  // Handle header row (first row with column names)
  if (rowIndex === 0 && row[0] === 'Name') {
    return null;
  }

  // Extract fields by column position
  const [name, type, show, date, location, confirmed, link] = row;

  // Return structured object
  return {
    name: (name || '').trim(),
    type: (type || '').trim(),
    show: (show || '').trim(),
    date: (date || '').trim(),
    location: (location || '').trim(),
    confirmed: (confirmed || '').trim(),
    link: (link || '').trim(),
    rowIndex: rowIndex + 1 // Convert to 1-based for readability
  };
}

/**
 * Validate a parsed content object
 * @param {Object} content - Parsed content object
 * @returns {Object} - Validation result { valid: boolean, reason?: string, isMonthHeader?: boolean }
 */
function validateContent(content) {
  const { name, type, date, link } = content;

  // Check if this is a month header row (Name filled, but required fields empty)
  const isMonthHeader = name && !type && !date && !link;
  if (isMonthHeader) {
    return { valid: false, isMonthHeader: true, reason: 'Month header row' };
  }

  // Check if row is completely empty
  if (!name && !type && !date && !link) {
    return { valid: false, reason: 'Empty row' };
  }

  // Validate required fields
  const missingFields = [];
  if (!name) missingFields.push('Name');
  if (!type) missingFields.push('Type');
  if (!date) missingFields.push('Date');
  if (!link) missingFields.push('Link');

  if (missingFields.length > 0) {
    return { valid: false, reason: `Missing required fields: ${missingFields.join(', ')}` };
  }

  // Validate Type is one of the standard values
  const validTypes = ['Podcast', 'Video', 'Blog', 'Presentation', 'Guest'];
  if (!validTypes.includes(type)) {
    return { valid: false, reason: `Invalid Type: "${type}" (not in standard list)` };
  }

  // All validation passed
  return { valid: true };
}

/**
 * Main sync function - reads and parses spreadsheet data
 */
async function syncContent() {
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

    // Read spreadsheet data
    log(`Reading spreadsheet: ${SPREADSHEET_ID}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values || [];
    log(`Found ${rows.length} total rows (including header)\n`);

    // Parse and validate rows
    const validRows = [];
    const stats = {
      total: 0,
      valid: 0,
      monthHeaders: 0,
      emptyRows: 0,
      invalidType: 0,
      missingFields: 0,
      byType: {
        'Podcast': 0,
        'Video': 0,
        'Blog': 0,
        'Presentation': 0,
        'Guest': 0
      }
    };

    for (let i = 0; i < rows.length; i++) {
      const parsed = parseRow(rows[i], i);

      // Skip header row
      if (parsed === null) {
        continue;
      }

      stats.total++;

      // Validate the parsed content
      const validation = validateContent(parsed);

      if (validation.valid) {
        validRows.push(parsed);
        stats.valid++;
        stats.byType[parsed.type]++;

        // Pretty formatted valid content (Step 1.6)
        log(`Processing row ${parsed.rowIndex}/${stats.total}`);
        console.log(`  Title: ${parsed.name}`);
        console.log(`  Type:  ${parsed.type} → /${parsed.type.toLowerCase()}`);
        console.log(`  Date:  ${parsed.date}`);
        console.log(`  Link:  ${parsed.link}`);
        console.log(`  ✓ Valid\n`);
      } else {
        // Track skip reasons
        if (validation.isMonthHeader) {
          stats.monthHeaders++;
        } else if (validation.reason.includes('Empty row')) {
          stats.emptyRows++;
        } else if (validation.reason.includes('Invalid Type')) {
          stats.invalidType++;
          log(`Row ${parsed.rowIndex}: ✗ Skipped - ${validation.reason}`, 'WARN');
        } else if (validation.reason.includes('Missing required fields')) {
          stats.missingFields++;
          log(`Row ${parsed.rowIndex}: ✗ Skipped - ${validation.reason}`, 'WARN');
        }
      }
    }

    // Print pretty summary (Step 1.6)
    console.log('\n' + '='.repeat(60));
    log('SUMMARY STATISTICS');
    console.log('='.repeat(60));
    console.log('\n📊 Processing Overview:');
    console.log(`  Total rows processed:     ${stats.total}`);
    console.log(`  ✓ Valid content rows:     ${stats.valid}`);
    console.log(`  ✗ Skipped rows:           ${stats.total - stats.valid}`);

    console.log('\n📝 Valid Content by Type:');
    Object.entries(stats.byType).forEach(([type, count]) => {
      const url = `/${type.toLowerCase()}`;
      console.log(`  ${type.padEnd(15)} ${String(count).padStart(2)} → ${url}`);
    });

    console.log('\n🚫 Skipped Rows Breakdown:');
    console.log(`  Month headers:            ${stats.monthHeaders}`);
    console.log(`  Empty rows:               ${stats.emptyRows}`);
    console.log(`  Invalid type:             ${stats.invalidType}`);
    console.log(`  Missing required fields:  ${stats.missingFields}`);

    console.log('\n' + '='.repeat(60));
    log(`✅ Processing complete: ${stats.valid} valid rows ready for sync`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    log(`❌ Error syncing content: ${error.message}`, 'ERROR');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the sync
syncContent();
