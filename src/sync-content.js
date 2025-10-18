const { google } = require('googleapis');

// Spreadsheet configuration
const SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = 'Sheet1';
const RANGE = `${SHEET_NAME}!A:G`; // Name, Type, Show, Date, Location, Confirmed, Link

// ============================================================================
// Error Classification & Recovery
// ============================================================================
//
// ERROR HANDLING & RECOVERY BEHAVIOR:
//
// 1. AUTHENTICATION ERRORS (AUTH):
//    - Causes: Missing/invalid GOOGLE_SERVICE_ACCOUNT_JSON, wrong permissions
//    - Behavior: Log error, NO RETRY, exit immediately
//    - Recovery: Fix credentials/permissions, run script again
//
// 2. NETWORK ERRORS (NETWORK):
//    - Causes: DNS failure, connection timeout, connection refused
//    - Behavior: Retry up to 3 times with exponential backoff (1s → 2s → 4s)
//    - Recovery: Automatic retry, waits for network to recover
//
// 3. API RATE LIMIT (API_RATE_LIMIT):
//    - Causes: Google API quota exceeded (rare with hourly schedule)
//    - Behavior: Retry up to 3 times with exponential backoff
//    - Recovery: Automatic retry, waits for quota to reset
//
// 4. DATA ERRORS (DATA):
//    - Causes: Invalid JSON, unexpected spreadsheet format
//    - Behavior: Log error, NO RETRY, exit immediately
//    - Recovery: Fix data format issue, run script again
//
// 5. UNKNOWN ERRORS:
//    - Causes: Unexpected/unclassified errors
//    - Behavior: Log error with details, NO RETRY, exit immediately
//    - Recovery: Investigate logs, fix root cause, run script again
//
// ============================================================================

/**
 * Error types for classification
 */
const ErrorType = {
  AUTH: 'AUTH',           // Authentication/credentials issues
  NETWORK: 'NETWORK',     // Network connectivity problems
  API_RATE_LIMIT: 'API_RATE_LIMIT',  // API quota/rate limit exceeded
  DATA: 'DATA',           // Unexpected data format or parsing issues
  UNKNOWN: 'UNKNOWN'      // Unclassified errors
};

/**
 * Classify an error by type
 * @param {Error} error - The error to classify
 * @returns {Object} - { type: ErrorType, message: string, shouldRetry: boolean }
 */
function classifyError(error) {
  const errorMessage = error.message || '';
  const errorCode = error.code;

  // Authentication errors
  if (errorMessage.includes('GOOGLE_SERVICE_ACCOUNT_JSON') ||
      errorMessage.includes('invalid_grant') ||
      errorMessage.includes('Invalid Credentials') ||
      errorCode === 'EAUTH') {
    return {
      type: ErrorType.AUTH,
      message: 'Authentication failed. Check GOOGLE_SERVICE_ACCOUNT_JSON environment variable and service account permissions.',
      shouldRetry: false  // No point retrying auth errors
    };
  }

  // Network errors
  if (errorCode === 'ENOTFOUND' ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET' ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout')) {
    return {
      type: ErrorType.NETWORK,
      message: 'Network error occurred. Will retry with exponential backoff.',
      shouldRetry: true
    };
  }

  // API rate limit errors
  if (error.response?.status === 429 ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('quota exceeded')) {
    return {
      type: ErrorType.API_RATE_LIMIT,
      message: 'API rate limit exceeded. Will retry with longer delay.',
      shouldRetry: true
    };
  }

  // Data/parsing errors
  if (errorMessage.includes('JSON') ||
      errorMessage.includes('parse') ||
      errorMessage.includes('Unexpected token')) {
    return {
      type: ErrorType.DATA,
      message: 'Data parsing error. Check spreadsheet format and service account response.',
      shouldRetry: false
    };
  }

  // Unknown error
  return {
    type: ErrorType.UNKNOWN,
    message: `Unexpected error: ${errorMessage}`,
    shouldRetry: false
  };
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Retry configuration
 */
const retryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,  // Start with 1 second
  maxDelayMs: 30000,     // Cap at 30 seconds
  backoffMultiplier: 2   // Double the delay each time
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise} - Result of function or throws after max retries
 */
async function withRetry(fn, operationName) {
  let lastError;

  for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      log(`${operationName}: Attempt ${attempt}/${retryConfig.maxRetries}`, 'DEBUG');
      return await fn();
    } catch (error) {
      lastError = error;
      const errorInfo = classifyError(error);

      // Don't retry if error type shouldn't be retried
      if (!errorInfo.shouldRetry) {
        log(`${operationName}: Error not retryable [${errorInfo.type}]`, 'ERROR');
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === retryConfig.maxRetries) {
        log(`${operationName}: Max retries (${retryConfig.maxRetries}) exceeded`, 'ERROR');
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
        retryConfig.maxDelayMs
      );

      log(
        `${operationName}: Attempt ${attempt} failed [${errorInfo.type}]. Retrying in ${delay}ms...`,
        'WARN',
        {
          attempt,
          maxRetries: retryConfig.maxRetries,
          errorType: errorInfo.type,
          retryDelayMs: delay
        }
      );

      await sleep(delay);
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

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
  // Note: Must check for undefined explicitly since DEBUG = 0 is falsy
  minLevel: process.env.LOG_LEVEL && LogLevel[process.env.LOG_LEVEL] !== undefined
    ? LogLevel[process.env.LOG_LEVEL]
    : LogLevel.INFO,
  // Output format: 'pretty' or 'json'
  format: process.env.LOG_FORMAT || 'pretty'
};

/**
 * Format timestamp for logging
 * @returns {string} - ISO 8601 timestamp for JSON, formatted for pretty
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
 * Enhanced logging function with level filtering and structured data support
 * @param {string} message - Log message
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 * @param {Object} data - Optional structured data to include
 */
function log(message, level = 'INFO', data = null) {
  const levelValue = LogLevel[level];

  // Filter out logs below minimum level
  if (levelValue < logConfig.minLevel) {
    return;
  }

  if (logConfig.format === 'json') {
    // Structured JSON logging for CI/production
    const logEntry = {
      timestamp: formatTimestamp('json'),
      level: level,
      message: message
    };

    // Include any additional structured data
    if (data) {
      logEntry.data = data;
    }

    console.log(JSON.stringify(logEntry));
  } else {
    // Pretty formatted logging for local development
    console.log(`${formatTimestamp('pretty')} ${level}: ${message}`);

    // If structured data provided, pretty print it
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }
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

    // Read spreadsheet data with retry logic
    log(`Reading spreadsheet: ${SPREADSHEET_ID}`);
    const response = await withRetry(
      () => sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
      }),
      'Read spreadsheet'
    );

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

        // Log valid content row with format-aware output
        if (logConfig.format === 'json') {
          // Structured JSON logging
          log(`Processing row ${parsed.rowIndex}/${stats.total}`, 'DEBUG', {
            rowIndex: parsed.rowIndex,
            title: parsed.name,
            type: parsed.type,
            date: parsed.date,
            link: parsed.link,
            valid: true
          });
        } else {
          // Pretty formatted output for local dev
          log(`Processing row ${parsed.rowIndex}/${stats.total}`);
          console.log(`  Title: ${parsed.name}`);
          console.log(`  Type:  ${parsed.type} → /${parsed.type.toLowerCase()}`);
          console.log(`  Date:  ${parsed.date}`);
          console.log(`  Link:  ${parsed.link}`);
          console.log(`  ✓ Valid\n`);
        }
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

    // Print summary with format-aware output
    if (logConfig.format === 'json') {
      // Structured JSON summary
      log('Processing complete', 'INFO', {
        summary: {
          totalRows: stats.total,
          validRows: stats.valid,
          skippedRows: stats.total - stats.valid,
          byType: stats.byType,
          skippedBreakdown: {
            monthHeaders: stats.monthHeaders,
            emptyRows: stats.emptyRows,
            invalidType: stats.invalidType,
            missingFields: stats.missingFields
          }
        }
      });
    } else {
      // Pretty formatted summary for local dev
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
    }

  } catch (error) {
    // Classify the error
    const errorInfo = classifyError(error);

    // Log error with classification
    log(`❌ Error syncing content [${errorInfo.type}]: ${errorInfo.message}`, 'ERROR', {
      errorType: errorInfo.type,
      originalError: error.message,
      shouldRetry: errorInfo.shouldRetry
    });

    // Include stack trace in DEBUG mode
    if (logConfig.minLevel === LogLevel.DEBUG && error.stack) {
      log('Stack trace:', 'DEBUG', { stack: error.stack });
    }

    // Exit with error code (will be enhanced with retry logic in Step 3)
    process.exit(1);
  }
}

// Run the sync
syncContent();
