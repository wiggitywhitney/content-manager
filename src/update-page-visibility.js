const { google } = require('googleapis');
const https = require('https');

// ============================================================================
// Configuration
// ============================================================================

// XML-RPC configuration
const XMLRPC_TIMEOUT_MS = parseInt(process.env.XMLRPC_TIMEOUT_MS || '10000', 10);
const XMLRPC_MAX_RETRIES = parseInt(process.env.XMLRPC_MAX_RETRIES || '3', 10);

// Spreadsheet configuration
const SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = 'Sheet1';
const RANGE = `${SHEET_NAME}!A:H`; // Name, Type, Show, Date, Location, Confirmed, Link, Micro.blog URL

// Page configuration for category navigation pages
// IDs are stable and won't change unless pages are deleted/recreated
const CATEGORY_PAGES = {
  'Podcast': {
    id: 897417,
    title: 'Podcast',
    description: 'https://whitneylee.com/podcast/'
  },
  'Video': {
    id: 897489,
    title: 'Video',
    description: 'https://whitneylee.com/video/'
  },
  'Blog': {
    id: 897491,
    title: 'Blog',
    description: 'https://whitneylee.com/blog/'
  },
  'Presentations': {
    id: 897483,
    title: 'Presentations',
    description: 'https://whitneylee.com/presentations/'
  },
  'Guest': {
    id: 897488,
    title: 'Guest',
    description: 'https://whitneylee.com/guest/'
  }
};

// ============================================================================
// Logging System
// ============================================================================

/**
 * Log levels (numeric for comparison)
 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Logger configuration
 */
const logConfig = {
  // Minimum level to display (from env var or default to INFO)
  minLevel: process.env.LOG_LEVEL && LogLevel[process.env.LOG_LEVEL] !== undefined
    ? LogLevel[process.env.LOG_LEVEL]
    : LogLevel.INFO,
  // Output format: 'pretty' or 'json'
  format: (process.env.LOG_FORMAT || 'pretty').toLowerCase()
};

/**
 * Format timestamp for logging
 * @returns {string} - Formatted timestamp
 */
function formatTimestamp(format = 'pretty') {
  const now = new Date();
  if (format === 'json') {
    return now.toISOString();
  }
  // Pretty format: [YYYY-MM-DD HH:MM:SS]
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
}

/**
 * Enhanced logging function with level filtering
 * @param {string} message - Log message
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 * @param {Object} data - Optional structured data
 */
function log(message, level = 'INFO', data = null) {
  const levelValue = LogLevel[level];

  // Filter out logs below minimum level
  if (levelValue < logConfig.minLevel) {
    return;
  }

  // Route WARN/ERROR to stderr, INFO/DEBUG to stdout
  const output = (levelValue >= LogLevel.WARN) ? console.error : console.log;

  if (logConfig.format === 'json') {
    // Structured JSON logging
    const logEntry = {
      timestamp: formatTimestamp('json'),
      level: level,
      message: message
    };
    if (data) {
      logEntry.data = data;
    }
    output(JSON.stringify(logEntry));
  } else {
    // Pretty formatted logging
    output(`${formatTimestamp('pretty')} ${level}: ${message}`);
    if (data) {
      output('  Data:', JSON.stringify(data, null, 2));
    }
  }
}

// ============================================================================
// XML-RPC Utilities for Page Management
// ============================================================================

/**
 * Escape special XML characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Make XML-RPC request to Micro.blog
 * @param {string} methodName - XML-RPC method name
 * @param {Array} params - Method parameters
 * @returns {Promise<Object>} - Response with statusCode and body
 */
function xmlrpcRequest(methodName, params) {
  return new Promise((resolve, reject) => {
    // Early auth validation
    if (!process.env.MICROBLOG_XMLRPC_TOKEN) {
      return reject(new Error('MICROBLOG_XMLRPC_TOKEN not set'));
    }
    const username = process.env.MICROBLOG_USERNAME || 'wiggitywhitney';

    // Build XML-RPC request body
    const paramsXml = params.map(param => {
      if (typeof param === 'string') {
        return `<param><value><string>${escapeXml(param)}</string></value></param>`;
      } else if (typeof param === 'number') {
        return `<param><value><int>${param}</int></value></param>`;
      } else if (typeof param === 'boolean') {
        return `<param><value><boolean>${param ? 1 : 0}</boolean></value></param>`;
      } else if (param && typeof param === 'object' && !Array.isArray(param)) {
        const members = Object.entries(param).map(([key, value]) => {
          let valueXml = '<string></string>';
          if (typeof value === 'string') {
            valueXml = `<string>${escapeXml(value)}</string>`;
          } else if (typeof value === 'boolean') {
            valueXml = `<boolean>${value ? 1 : 0}</boolean>`;
          } else if (typeof value === 'number') {
            valueXml = `<int>${value}</int>`;
          }
          return `<member><name>${key}</name><value>${valueXml}</value></member>`;
        }).join('');
        return `<param><value><struct>${members}</struct></value></param>`;
      }
    }).join('');

    const requestBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>
    ${paramsXml}
  </params>
</methodCall>`;

    // XML-RPC uses HTTP Basic Auth
    const auth = Buffer.from(`${username}:${process.env.MICROBLOG_XMLRPC_TOKEN}`).toString('base64');

    const options = {
      hostname: 'micro.blog',
      path: '/xmlrpc',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(requestBody),
        'Authorization': 'Basic ' + auth
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.setTimeout(XMLRPC_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timeout after ${XMLRPC_TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

/**
 * Edit a page's navigation visibility
 * @param {number} pageId - Micro.blog page ID
 * @param {string} title - Page title
 * @param {string} description - Page description/URL
 * @param {boolean} isNavigation - Whether page should appear in navigation
 * @returns {Promise<boolean>} - Success status
 */
async function setPageNavigationVisibility(pageId, title, description, isNavigation) {
  const params = [
    pageId,
    process.env.MICROBLOG_USERNAME || 'wiggitywhitney',
    process.env.MICROBLOG_XMLRPC_TOKEN,
    {
      title: title,
      description: description,
      is_navigation: isNavigation
    }
  ];

  for (let attempt = 1; attempt <= XMLRPC_MAX_RETRIES; attempt++) {
    try {
      const response = await xmlrpcRequest('microblog.editPage', params);
      // Check for success (no fault in response)
      return !response.body.includes('<fault>');
    } catch (error) {
      if (attempt === XMLRPC_MAX_RETRIES) {
        log(`XML-RPC error for page ${pageId}: ${error.message}`, 'ERROR');
        return false;
      }
      const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      log(`editPage failed (attempt ${attempt}); retrying in ${backoff}ms`, 'WARN');
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

// ============================================================================
// Date Parsing Utilities
// ============================================================================

/**
 * Parse spreadsheet date to ISO 8601 format (UTC noon)
 * Handles formats like "1/9/2025", "01/09/2025", "January 9, 2025"
 * @param {string} dateString - Date string from spreadsheet
 * @returns {string|null} - ISO 8601 timestamp or null if invalid
 */
function parseDateToISO(dateString) {
  if (!dateString || !dateString.trim()) {
    return null;
  }

  const trimmed = dateString.trim();

  // Try MM/DD/YYYY or M/D/YYYY format
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`;
  }

  // Try "Month Day, Year" format
  const monthNames = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };

  const textMatch = trimmed.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (textMatch) {
    const [, monthName, day, year] = textMatch;
    const month = monthNames[monthName.toLowerCase()];
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}T12:00:00Z`;
    }
  }

  log(`Invalid date format: "${dateString}"`, 'WARN');
  return null;
}

// ============================================================================
// Row Parsing & Validation
// ============================================================================

/**
 * Parse a raw spreadsheet row into a structured content object
 * @param {Array} row - Raw row data from Google Sheets
 * @param {number} rowIndex - Original row index
 * @returns {Object|null} - Parsed content object or null if header row
 */
function parseRow(row, rowIndex) {
  // Handle header row
  if (rowIndex === 0 && row[0] === 'Name') {
    return null;
  }

  const [name, type, show, date, location, confirmed, link, microblogUrl] = row;

  return {
    name: (name || '').trim(),
    type: (type || '').trim(),
    show: (show || '').trim(),
    date: (date || '').trim(),
    location: (location || '').trim(),
    confirmed: (confirmed || '').trim(),
    link: (link || '').trim(),
    microblogUrl: (microblogUrl || '').trim(),
    rowIndex: rowIndex + 1 // 1-based for spreadsheet row numbers
  };
}

/**
 * Validate a parsed content object
 * @param {Object} content - Parsed content object
 * @returns {Object} - Validation result
 */
function validateContent(content) {
  const { name, type, date, link } = content;

  // Check if this is a month header row
  const isMonthHeader = name && !type && !date && !link;
  if (isMonthHeader) {
    return { valid: false, isMonthHeader: true };
  }

  // Check if row is completely empty
  if (!name && !type && !date && !link) {
    return { valid: false };
  }

  // Validate required fields
  if (!name || !type || !date) {
    return { valid: false };
  }

  // Link is required for all types EXCEPT Presentations
  if (!link && type !== 'Presentations') {
    return { valid: false };
  }

  // Validate Type is one of the standard values
  const validTypes = ['Podcast', 'Video', 'Blog', 'Presentations', 'Guest'];
  if (!validTypes.includes(type)) {
    return { valid: false };
  }

  return { valid: true };
}

// ============================================================================
// Category Activity Calculation
// ============================================================================

/**
 * Calculate last post date and activity status for each category
 * Uses today's date from OS to determine if categories are inactive (4+ months)
 * @param {Array} validRows - Array of validated content rows
 * @returns {Object} - Activity data by category
 */
function calculateCategoryActivity(validRows) {
  const activity = {};
  const today = new Date(); // Get today's date from OS
  const INACTIVE_THRESHOLD_DAYS = 120; // 4 months

  // Initialize all 5 managed categories
  const categories = ['Podcast', 'Video', 'Blog', 'Presentations', 'Guest'];
  for (const category of categories) {
    activity[category] = {
      lastPostDate: null,
      lastPostDateString: null,
      daysSincePost: null,
      isInactive: false,
      postCount: 0
    };
  }

  // Find most recent date for each category
  for (const row of validRows) {
    const category = row.type;

    if (!activity[category]) {
      continue;
    }

    activity[category].postCount++;

    const isoDate = parseDateToISO(row.date);
    if (!isoDate) {
      log(`Skipping row ${row.rowIndex} for activity tracking - invalid date: ${row.date}`, 'WARN');
      continue;
    }

    const postDate = new Date(isoDate);

    if (!activity[category].lastPostDate || postDate > activity[category].lastPostDate) {
      activity[category].lastPostDate = postDate;
      activity[category].lastPostDateString = row.date;
    }
  }

  // Calculate days since last post and inactive status
  for (const category in activity) {
    if (activity[category].lastPostDate) {
      const daysSince = Math.floor((today - activity[category].lastPostDate) / (1000 * 60 * 60 * 24));
      activity[category].daysSincePost = daysSince;
      activity[category].isInactive = daysSince >= INACTIVE_THRESHOLD_DAYS;
    } else {
      // Category has no posts
      activity[category].daysSincePost = null;
      activity[category].isInactive = true;
    }
  }

  return activity;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Main function - update page visibility based on category activity
 * Algorithm:
 * 1. Read Google Sheets to get all posts with Type and Date
 * 2. Get today's date from OS
 * 3. Calculate which categories are inactive (4+ months since last post)
 * 4. Make 5 XML-RPC calls to update page visibility on Micro.blog
 */
async function updatePageVisibility() {
  try {
    log('Starting page visibility update');

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
    log(`Found ${rows.length} total rows (including header)`);

    // Parse and validate rows
    const validRows = [];
    for (let i = 0; i < rows.length; i++) {
      const parsed = parseRow(rows[i], i);
      if (parsed === null) continue; // Skip header

      const validation = validateContent(parsed);
      if (validation.valid) {
        validRows.push(parsed);
      }
    }

    log(`Validated ${validRows.length} content rows`);

    // Calculate category activity (compares spreadsheet dates to today's date from OS)
    const categoryActivity = calculateCategoryActivity(validRows);

    log('\n' + '='.repeat(60));
    log('Category Activity Status');
    log('='.repeat(60) + '\n');

    for (const category of ['Podcast', 'Video', 'Blog', 'Presentations', 'Guest']) {
      const activity = categoryActivity[category];
      log(`${category}:`);

      if (activity.postCount === 0) {
        console.log(`  Posts: 0`);
        console.log(`  Status: ✗ No posts (inactive)`);
      } else {
        console.log(`  Posts: ${activity.postCount}`);
        console.log(`  Last post: ${activity.lastPostDateString} (${activity.daysSincePost} days ago)`);
        console.log(`  Status: ${activity.isInactive ? '✗ Inactive (4+ months)' : '✓ Active'}`);
      }
      console.log('');
    }

    // Update page visibility (5 XML-RPC API calls)
    log('='.repeat(60));
    log('Page Visibility Management');
    log('='.repeat(60) + '\n');

    const updateStats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      visible: 0,
      hidden: 0
    };

    for (const category of ['Podcast', 'Video', 'Blog', 'Presentations', 'Guest']) {
      const activity = categoryActivity[category];
      const pageConfig = CATEGORY_PAGES[category];

      if (!pageConfig) {
        log(`${category}: ⚠️  No page configuration found (skipped)`, 'WARN');
        continue;
      }

      log(`${category} (Page ID: ${pageConfig.id}):`);
      updateStats.attempted++;

      try {
        // Determine desired visibility state
        const shouldBeVisible = !activity.isInactive && activity.postCount > 0;

        const success = await setPageNavigationVisibility(
          pageConfig.id,
          pageConfig.title,
          pageConfig.description,
          shouldBeVisible
        );

        if (success) {
          updateStats.successful++;
          if (shouldBeVisible) {
            updateStats.visible++;
            console.log(`  ✓ Page visible in navigation (active category)`);
          } else {
            updateStats.hidden++;
            console.log(`  ✗ Page hidden from navigation (inactive 4+ months)`);
          }
        } else {
          updateStats.failed++;
          log(`  ❌ Failed to update page visibility`, 'ERROR');
        }
      } catch (error) {
        updateStats.failed++;
        log(`  ❌ Error updating visibility: ${error.message}`, 'ERROR');
      }

      console.log('');
    }

    // Summary
    log('='.repeat(60));
    log('Update Summary');
    log('='.repeat(60));
    console.log(`  Pages checked:           ${updateStats.attempted}`);
    console.log(`  ✅ Successfully updated: ${updateStats.successful}`);
    console.log(`  ❌ Failed:               ${updateStats.failed}`);
    console.log(`  👁️  Visible:              ${updateStats.visible}`);
    console.log(`  🚫 Hidden:               ${updateStats.hidden}`);
    log('='.repeat(60));

    if (updateStats.successful === updateStats.attempted) {
      log('✅ Page visibility update complete');
    } else {
      log(`⚠️  Page visibility update complete with ${updateStats.failed} errors`);
      process.exit(1);
    }

  } catch (error) {
    log(`❌ Error updating page visibility: ${error.message}`, 'ERROR');
    if (error.stack) {
      log('Stack trace:', 'DEBUG', { stack: error.stack });
    }
    process.exit(1);
  }
}

// Run if invoked directly
if (require.main === module) {
  updatePageVisibility();
}

module.exports = { updatePageVisibility };
