const { google } = require('googleapis');

// Spreadsheet configuration
const SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SHEET_NAME = 'Sheet1';
const RANGE = `${SHEET_NAME}!A:H`; // Name, Type, Show, Date, Location, Confirmed, Link, Micro.blog URL

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

  // Network errors (including transient server errors)
  const httpStatus = error.response?.status;
  if (errorCode === 'ENOTFOUND' ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET' ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      httpStatus === 500 ||  // Internal Server Error (transient)
      httpStatus === 503 ||  // Service Unavailable (transient)
      httpStatus === 504) {  // Gateway Timeout (transient)
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

      // Calculate delay with exponential backoff, Retry-After header support, and jitter
      const baseDelay = retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);

      // Check for server-provided Retry-After header (in seconds)
      const retryAfterHeader = error.response?.headers?.['retry-after'] ||
                               error.response?.headers?.['Retry-After'];
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;

      // Use the larger of exponential backoff or server hint
      const candidateDelay = retryAfterMs ? Math.max(baseDelay, retryAfterMs) : baseDelay;

      // Add jitter (up to 10% random variance) to avoid thundering herd
      const jitter = Math.floor(candidateDelay * 0.1 * Math.random());
      const delay = Math.min(candidateDelay + jitter, retryConfig.maxDelayMs);

      log(
        `${operationName}: Attempt ${attempt} failed [${errorInfo.type}]. Retrying in ${delay}ms...`,
        'WARN',
        {
          attempt,
          maxRetries: retryConfig.maxRetries,
          errorType: errorInfo.type,
          retryDelayMs: delay,
          retryAfterMs: retryAfterMs || undefined
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
  // Output format: 'pretty' or 'json' (normalized to lowercase)
  format: (process.env.LOG_FORMAT || 'pretty').toLowerCase()
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

  // Route WARN/ERROR to stderr, INFO/DEBUG to stdout
  const output = (levelValue >= LogLevel.WARN) ? console.error : console.log;

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

    output(JSON.stringify(logEntry));
  } else {
    // Pretty formatted logging for local development
    output(`${formatTimestamp('pretty')} ${level}: ${message}`);

    // If structured data provided, pretty print it
    if (data) {
      output('  Data:', JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Writes Micro.blog URL back to spreadsheet Column H
 * @param {Object} sheets - Google Sheets API client
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {number} rowIndex - 1-based row index (matches spreadsheet row numbers)
 * @param {string} url - Micro.blog post URL from Location header
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function writeUrlToSpreadsheet(sheets, spreadsheetId, rowIndex, url) {
  try {
    const range = `${SHEET_NAME}!H${rowIndex}`;  // e.g., "Sheet1!H15"
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: {
        values: [[url]]
      }
    });
    log(`Wrote URL to row ${rowIndex}: ${url}`, 'DEBUG');
    return true;
  } catch (error) {
    // Don't fail entire sync if write fails
    log(`Failed to write URL to row ${rowIndex}: ${error.message}`, 'WARN');
    return false;
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

  // Extract fields by column position (A-H)
  const [name, type, show, date, location, confirmed, link, microblogUrl] = row;

  // Return structured object
  return {
    name: (name || '').trim(),
    type: (type || '').trim(),
    show: (show || '').trim(),
    date: (date || '').trim(),
    location: (location || '').trim(),
    confirmed: (confirmed || '').trim(),
    link: (link || '').trim(),
    microblogUrl: (microblogUrl || '').trim(),  // Column H
    rowIndex: rowIndex + 1 // Convert to 1-based for readability (matches spreadsheet row numbers)
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

  // Link is required for all types EXCEPT Presentations (which can be listed without links)
  if (!link && type !== 'Presentations') {
    missingFields.push('Link');
  }

  if (missingFields.length > 0) {
    return { valid: false, reason: `Missing required fields: ${missingFields.join(', ')}` };
  }

  // Validate Type is one of the standard values
  const validTypes = ['Podcast', 'Video', 'Blog', 'Presentations', 'Guest'];
  if (!validTypes.includes(type)) {
    return { valid: false, reason: `Invalid Type: "${type}" (not in standard list)` };
  }

  // All validation passed
  return { valid: true };
}

/**
 * Format post content with keynote prefix and show name
 * Format: `[Keynote] Show Name: [Title](url)` or `Show Name: [Title](url)`
 * @param {Object} content - Parsed content object
 * @returns {string} - Formatted post content
 */
function formatPostContent(content) {
  const { name, type, show, link, confirmed } = content;

  // Determine show name
  let showName = '';
  if (type === 'Podcast') {
    // Podcasts are always "Software Defined Interviews"
    showName = 'Software Defined Interviews';
  } else if (show) {
    // Use Column C (Show) for other types if available
    showName = show;
  }

  // Check if this is a keynote (Column F contains "KEYNOTE", case-insensitive)
  const isKeynote = confirmed && confirmed.toUpperCase().includes('KEYNOTE');

  // Build the formatted content
  let content_text = '';

  // Add keynote prefix if applicable
  if (isKeynote) {
    content_text = '[Keynote] ';
  }

  // Add show name if available
  if (showName) {
    content_text += `${showName}: `;
  }

  // Add title (with or without link)
  if (link) {
    content_text += `[${name}](${link})`;
  } else {
    // No link - just show title (for Presentations without URLs)
    content_text += `${name}`;
  }

  return content_text;
}

/**
 * Create a post on Micro.blog via Micropub API
 * @param {Object} content - Content object with name, type, date, link, etc.
 * @param {string} postContent - Formatted post content
 * @param {string} publishedDate - ISO 8601 published date
 * @returns {Promise<string>} - Post URL from Location header
 */
async function createMicroblogPost(content, postContent, publishedDate) {
  const token = process.env.MICROBLOG_APP_TOKEN;
  if (!token) {
    throw new Error('MICROBLOG_APP_TOKEN environment variable not set');
  }

  // Map content type to Micro.blog category
  const categoryMap = {
    'Podcast': 'Podcast',
    'Video': 'Video',
    'Blog': 'Blog',
    'Presentation': 'Presentations',
    'Guest': 'Guest'
  };
  const category = categoryMap[content.type];

  // Build form-encoded request body
  const params = new URLSearchParams();
  params.append('h', 'entry');
  params.append('content', postContent);
  params.append('category', category);
  params.append('published', publishedDate);

  // Make POST request to Micropub endpoint
  const response = await fetch('https://micro.blog/micropub', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  // Check for success (201 or 202)
  if (response.status !== 201 && response.status !== 202) {
    const errorText = await response.text();
    throw new Error(`Micropub API error (${response.status}): ${errorText}`);
  }

  // Extract post URL from Location header
  const postUrl = response.headers.get('Location');
  if (!postUrl) {
    throw new Error('Micropub API did not return Location header');
  }

  return postUrl;
}

/**
 * Query all posts from Micro.blog across all categories
 * @returns {Promise<Map>} - Map of postUrl -> {content, category, published}
 */
async function queryMicroblogPosts() {
  const token = process.env.MICROBLOG_APP_TOKEN;
  if (!token) {
    throw new Error('MICROBLOG_APP_TOKEN environment variable not set');
  }

  const allPosts = new Map();
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `https://micro.blog/micropub?q=source&limit=${limit}&offset=${offset}`;
    log(`Querying Micro.blog: offset=${offset}, limit=${limit}`, 'DEBUG');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to query posts (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const posts = data.items || [];

    log(`Received ${posts.length} posts from API`, 'DEBUG');

    // Build map of post URL -> post data
    for (const post of posts) {
      // FIX: post.url is inside post.properties, not at top level
      const postUrl = post.properties?.url?.[0];
      if (postUrl) {
        allPosts.set(postUrl, {
          content: post.properties?.content?.[0] || '',
          category: post.properties?.category?.[0] || '',
          published: post.properties?.published?.[0] || ''
        });
        log(`Mapped post: ${postUrl}`, 'DEBUG');
      } else {
        log(`Post missing URL: ${JSON.stringify(post)}`, 'DEBUG');
      }
    }

    // Check if there are more posts to fetch
    hasMore = posts.length === limit;
    offset += limit;

    log(`Fetched ${posts.length} posts from Micro.blog (offset: ${offset - limit}, total so far: ${allPosts.size})`, 'DEBUG');
  }

  log(`Total posts fetched from Micro.blog: ${allPosts.size}`, 'INFO');
  return allPosts;
}

/**
 * Normalize ISO 8601 timestamp to UTC with Z format
 * Handles both "2025-01-09T12:00:00Z" and "2025-01-09T12:00:00+00:00"
 * @param {string} dateString - ISO 8601 timestamp
 * @returns {string} - Normalized timestamp with Z format
 */
function normalizeTimestamp(dateString) {
  if (!dateString) return '';

  // Parse to Date object and back to ISO string (always uses Z format)
  const date = new Date(dateString);
  return date.toISOString();
}

/**
 * Detect changes between spreadsheet row and existing Micro.blog post
 * @param {Object} row - Spreadsheet row data
 * @param {Object} existingPost - Existing post data from Micro.blog
 * @returns {Object} - {needsUpdate: boolean, changes: {content?, category?, published?}}
 */
function detectChanges(row, existingPost) {
  const changes = {};

  // Generate expected content
  const expectedContent = formatPostContent(row);
  if (expectedContent !== existingPost.content) {
    changes.content = expectedContent;
  }

  // Generate expected category
  const categoryMap = {
    'Podcast': 'Podcast',
    'Video': 'Video',
    'Blog': 'Blog',
    'Presentations': 'Presentations',
    'Guest': 'Guest'
  };
  const expectedCategory = categoryMap[row.type];
  if (expectedCategory && expectedCategory !== existingPost.category) {
    changes.category = expectedCategory;
  }

  // Generate expected published date and normalize both for comparison
  const expectedPublished = parseDateToISO(row.date);
  if (expectedPublished) {
    const normalizedExpected = normalizeTimestamp(expectedPublished);
    const normalizedExisting = normalizeTimestamp(existingPost.published);

    if (normalizedExpected !== normalizedExisting) {
      changes.published = expectedPublished;
    }
  }

  return {
    needsUpdate: Object.keys(changes).length > 0,
    changes
  };
}

/**
 * Update a post on Micro.blog via Micropub API
 * @param {string} postUrl - URL of the post to update
 * @param {Object} changes - Changes to apply {content?, category?, published?}
 * @returns {Promise<void>}
 */
async function updateMicroblogPost(postUrl, changes) {
  const token = process.env.MICROBLOG_APP_TOKEN;
  if (!token) {
    throw new Error('MICROBLOG_APP_TOKEN environment variable not set');
  }

  // Build replace object with only changed fields
  // Note: Values must be arrays per Micropub spec
  const replace = {};
  if (changes.content !== undefined) {
    replace.content = [changes.content];
  }
  if (changes.category !== undefined) {
    replace.category = [changes.category];
  }
  if (changes.published !== undefined) {
    replace.published = [changes.published];
  }

  // Make JSON POST request with update action
  const response = await fetch('https://micro.blog/micropub', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'update',
      url: postUrl,
      replace
    })
  });

  // Check for success (200 or 202)
  if (response.status !== 200 && response.status !== 202) {
    const errorText = await response.text();
    throw new Error(`Micropub update failed (${response.status}): ${errorText}`);
  }
}

/**
 * Delete a post from Micro.blog via Micropub API
 * @param {string} postUrl - URL of the post to delete
 * @returns {Promise<boolean>} - True if deleted successfully, false otherwise
 */
async function deleteMicroblogPost(postUrl) {
  const token = process.env.MICROBLOG_APP_TOKEN;
  if (!token) {
    throw new Error('MICROBLOG_APP_TOKEN environment variable not set');
  }

  // Make JSON POST request with delete action
  const response = await fetch('https://micro.blog/micropub', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'delete',
      url: postUrl
    })
  });

  // Check for success (200, 202, or 404 if already deleted)
  if (response.status === 200 || response.status === 202) {
    return true;
  } else if (response.status === 404) {
    // Post already deleted - treat as success
    log(`Post already deleted: ${postUrl}`, 'DEBUG');
    return true;
  } else {
    const errorText = await response.text();
    throw new Error(`Micropub delete failed (${response.status}): ${errorText}`);
  }
}

/**
 * Parse spreadsheet date to ISO 8601 format (UTC noon)
 * Handles formats like "1/9/2025", "01/09/2025", "January 9, 2025"
 * @param {string} dateString - Date string from spreadsheet Column D
 * @returns {string|null} - ISO 8601 timestamp (UTC noon) or null if invalid
 */
function parseDateToISO(dateString) {
  if (!dateString || !dateString.trim()) {
    return null;
  }

  const trimmed = dateString.trim();

  // Try MM/DD/YYYY or M/D/YYYY format first (e.g., "1/9/2025", "01/09/2025")
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    // Use UTC noon to avoid timezone shifts (Decision 12)
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`;
    return isoDate;
  }

  // Try "Month Day, Year" format (e.g., "January 9, 2025")
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
      const isoDate = `${year}-${month}-${day.padStart(2, '0')}T12:00:00Z`;
      return isoDate;
    }
  }

  // Invalid format
  log(`Invalid date format: "${dateString}"`, 'WARN');
  return null;
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
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],  // Full access for Column H writes
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
        'Presentations': 0,
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

    // ========================================================================
    // Step 5.2: New Row Detection & Post Creation
    // ========================================================================

    // Filter rows that need to be posted (empty Column H)
    const rowsToPost = validRows.filter(row => !row.microblogUrl);

    log(`\nFound ${rowsToPost.length} rows without Micro.blog URLs (need to be posted)`);

    // Track post creation statistics
    const postStats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Create posts for rows with empty Column H
    for (const row of rowsToPost) {
      postStats.attempted++;

      try {
        // Parse date to ISO 8601
        const publishedDate = parseDateToISO(row.date);
        if (!publishedDate) {
          postStats.failed++;
          postStats.errors.push({
            row: row.rowIndex,
            title: row.name,
            error: 'Invalid date format'
          });
          log(`Row ${row.rowIndex}: Failed to parse date "${row.date}"`, 'ERROR');
          continue;
        }

        // Format post content
        const postContent = formatPostContent(row);

        log(`Creating post for row ${row.rowIndex}: ${row.name}`, 'INFO');
        log(`  Content: ${postContent}`, 'DEBUG');
        log(`  Category: ${row.type.toLowerCase()}`, 'DEBUG');
        log(`  Published: ${publishedDate}`, 'DEBUG');

        // Create post on Micro.blog with retry logic
        const postUrl = await withRetry(
          () => createMicroblogPost(row, postContent, publishedDate),
          `Create post for row ${row.rowIndex}`
        );

        log(`✅ Post created: ${postUrl}`, 'INFO');

        // Write URL back to spreadsheet Column H
        const writeSuccess = await writeUrlToSpreadsheet(sheets, SPREADSHEET_ID, row.rowIndex, postUrl);

        if (writeSuccess) {
          postStats.successful++;
          log(`✅ URL written to row ${row.rowIndex}`, 'DEBUG');
        } else {
          // Post created but URL write failed (non-fatal)
          postStats.successful++;
          log(`⚠️  Post created but failed to write URL to row ${row.rowIndex}`, 'WARN');
        }

      } catch (error) {
        postStats.failed++;
        postStats.errors.push({
          row: row.rowIndex,
          title: row.name,
          error: error.message
        });
        log(`❌ Failed to create post for row ${row.rowIndex}: ${error.message}`, 'ERROR');
        // Continue with next row (partial failure handling)
      }
    }

    // ========================================================================
    // Step 5.3: Update Detection
    // ========================================================================

    // Query all existing posts from Micro.blog
    log(`\nQuerying existing posts from Micro.blog...`);
    const existingPosts = await withRetry(
      () => queryMicroblogPosts(),
      'Query Micro.blog posts'
    );

    // Filter rows that already have Micro.blog URLs (existing posts)
    const rowsToCheck = validRows.filter(row => row.microblogUrl);

    log(`Found ${rowsToCheck.length} rows with Micro.blog URLs (checking for updates)`);

    // Track update statistics
    const updateStats = {
      checked: 0,
      needsUpdate: 0,
      attempted: 0,
      successful: 0,
      failed: 0,
      errors: [],
      changeDetails: []
    };

    // Check each existing post for changes
    for (const row of rowsToCheck) {
      updateStats.checked++;

      const existingPost = existingPosts.get(row.microblogUrl);

      if (!existingPost) {
        // Post exists in spreadsheet but not on Micro.blog (orphaned or deleted manually)
        log(`Row ${row.rowIndex}: Post not found on Micro.blog (${row.microblogUrl})`, 'WARN');
        continue;
      }

      // Detect changes
      const changeDetection = detectChanges(row, existingPost);

      if (changeDetection.needsUpdate) {
        updateStats.needsUpdate++;
        updateStats.attempted++;

        // Log what changed
        const changedFields = Object.keys(changeDetection.changes);
        log(`Row ${row.rowIndex}: Changes detected in ${changedFields.join(', ')}`, 'INFO');

        // Track change details for summary
        updateStats.changeDetails.push({
          row: row.rowIndex,
          title: row.name,
          fields: changedFields,
          changes: changeDetection.changes
        });

        try {
          // Apply updates to Micro.blog
          await withRetry(
            () => updateMicroblogPost(row.microblogUrl, changeDetection.changes),
            `Update post for row ${row.rowIndex}`
          );

          updateStats.successful++;
          log(`✅ Post updated: ${row.microblogUrl}`, 'INFO');

        } catch (error) {
          updateStats.failed++;
          updateStats.errors.push({
            row: row.rowIndex,
            title: row.name,
            error: error.message
          });
          log(`❌ Failed to update post for row ${row.rowIndex}: ${error.message}`, 'ERROR');
          // Continue with next row (partial failure handling)
        }
      }
    }

    // ========================================================================
    // Step 5.4: Delete Detection & Removal
    // ========================================================================

    const MANAGED_CATEGORIES = ['Podcast', 'Video', 'Blog', 'Presentations', 'Guest'];

    // Filter existingPosts to only posts with our managed categories
    // This prevents deletion of uncategorized personal posts (photos, book mentions, etc.)
    const categorizedPosts = Array.from(existingPosts.entries()).filter(([url, post]) => {
      return MANAGED_CATEGORIES.includes(post.category);
    });

    log(`\nChecking for orphaned posts (exist in Micro.blog but not in spreadsheet)...`);
    log(`Total posts in Micro.blog: ${existingPosts.size}`, 'DEBUG');
    log(`Posts with managed categories: ${categorizedPosts.length}`, 'DEBUG');
    log(`Uncategorized posts (ignored): ${existingPosts.size - categorizedPosts.length}`, 'DEBUG');

    // Build set of all post URLs from spreadsheet
    const spreadsheetUrls = new Set(
      validRows
        .filter(row => row.microblogUrl) // Only rows with Micro.blog URLs
        .map(row => row.microblogUrl)
    );

    log(`Posts in spreadsheet: ${spreadsheetUrls.size}`, 'DEBUG');

    // Find orphaned posts: exist in Micro.blog but not in spreadsheet
    const orphanedPosts = categorizedPosts.filter(([url, post]) => {
      return !spreadsheetUrls.has(url);
    });

    log(`Orphaned posts to delete: ${orphanedPosts.length}`, 'INFO');

    // Track deletion statistics
    const deleteStats = {
      checked: categorizedPosts.length,
      orphaned: orphanedPosts.length,
      attempted: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Delete orphaned posts
    for (const [postUrl, post] of orphanedPosts) {
      deleteStats.attempted++;

      try {
        log(`Deleting orphaned post: ${postUrl}`, 'INFO');
        log(`  Category: ${post.category}`, 'DEBUG');
        log(`  Content preview: ${post.content.substring(0, 50)}...`, 'DEBUG');

        // Delete post with retry logic
        await withRetry(
          () => deleteMicroblogPost(postUrl),
          `Delete post ${postUrl}`
        );

        deleteStats.successful++;
        log(`✅ Deleted: ${postUrl}`, 'INFO');

      } catch (error) {
        deleteStats.failed++;
        deleteStats.errors.push({
          url: postUrl,
          category: post.category,
          error: error.message
        });
        log(`❌ Failed to delete post ${postUrl}: ${error.message}`, 'ERROR');
        // Continue with next post (partial failure handling)
      }
    }

    // ========================================================================
    // Summary Statistics
    // ========================================================================

    // Print summary with format-aware output
    if (logConfig.format === 'json') {
      // Structured JSON summary
      log('Processing complete', 'INFO', {
        summary: {
          parsing: {
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
          },
          posting: {
            rowsToPost: rowsToPost.length,
            attempted: postStats.attempted,
            successful: postStats.successful,
            failed: postStats.failed,
            errors: postStats.errors
          },
          updating: {
            checked: updateStats.checked,
            needsUpdate: updateStats.needsUpdate,
            attempted: updateStats.attempted,
            successful: updateStats.successful,
            failed: updateStats.failed,
            errors: updateStats.errors,
            changeDetails: updateStats.changeDetails
          },
          deleting: {
            checked: deleteStats.checked,
            orphaned: deleteStats.orphaned,
            attempted: deleteStats.attempted,
            successful: deleteStats.successful,
            failed: deleteStats.failed,
            errors: deleteStats.errors
          }
        }
      });
    } else {
      // Pretty formatted summary for local dev (only at INFO level and above)
      if (logConfig.minLevel <= LogLevel.INFO) {
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

        // Post creation summary
        if (rowsToPost.length > 0) {
          console.log('\n📤 Post Creation Results:');
          console.log(`  Rows needing posts:       ${rowsToPost.length}`);
          console.log(`  Posts attempted:          ${postStats.attempted}`);
          console.log(`  ✅ Successfully created:  ${postStats.successful}`);
          console.log(`  ❌ Failed:                ${postStats.failed}`);

          if (postStats.errors.length > 0) {
            console.log('\n  Errors:');
            postStats.errors.forEach(err => {
              console.log(`    Row ${err.row} (${err.title}): ${err.error}`);
            });
          }
        }

        // Post update summary
        if (updateStats.checked > 0) {
          console.log('\n📝 Post Update Results:');
          console.log(`  Posts checked:            ${updateStats.checked}`);
          console.log(`  Updates needed:           ${updateStats.needsUpdate}`);
          console.log(`  Updates attempted:        ${updateStats.attempted}`);
          console.log(`  ✅ Successfully updated:  ${updateStats.successful}`);
          console.log(`  ❌ Failed:                ${updateStats.failed}`);

          if (updateStats.changeDetails.length > 0) {
            console.log('\n  Changes detected:');
            updateStats.changeDetails.forEach(detail => {
              console.log(`    Row ${detail.row} (${detail.title}): ${detail.fields.join(', ')}`);
            });
          }

          if (updateStats.errors.length > 0) {
            console.log('\n  Errors:');
            updateStats.errors.forEach(err => {
              console.log(`    Row ${err.row} (${err.title}): ${err.error}`);
            });
          }
        }

        // Post deletion summary
        if (deleteStats.checked > 0) {
          console.log('\n🗑️  Post Deletion Results:');
          console.log(`  Categorized posts checked:${deleteStats.checked}`);
          console.log(`  Orphaned posts found:     ${deleteStats.orphaned}`);
          console.log(`  Deletions attempted:      ${deleteStats.attempted}`);
          console.log(`  ✅ Successfully deleted:  ${deleteStats.successful}`);
          console.log(`  ❌ Failed:                ${deleteStats.failed}`);

          if (deleteStats.errors.length > 0) {
            console.log('\n  Errors:');
            deleteStats.errors.forEach(err => {
              console.log(`    ${err.url} (${err.category}): ${err.error}`);
            });
          }
        }

        console.log('\n' + '='.repeat(60));
        const totalChanges = postStats.successful + updateStats.successful + deleteStats.successful;
        if (totalChanges > 0) {
          const changes = [];
          if (postStats.successful > 0) changes.push(`${postStats.successful} created`);
          if (updateStats.successful > 0) changes.push(`${updateStats.successful} updated`);
          if (deleteStats.successful > 0) changes.push(`${deleteStats.successful} deleted`);
          log(`✅ Sync complete: ${changes.join(', ')}`);
        } else if (rowsToPost.length === 0 && updateStats.needsUpdate === 0 && deleteStats.orphaned === 0) {
          log(`✅ Sync complete: All content up to date (no changes needed)`);
        } else {
          log(`⚠️  Sync complete with errors: ${postStats.successful}/${postStats.attempted} posts created, ${updateStats.successful}/${updateStats.attempted} posts updated, ${deleteStats.successful}/${deleteStats.attempted} posts deleted`);
        }
        console.log('='.repeat(60) + '\n');
      }
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

// Run the sync if invoked directly (not imported as module)
if (require.main === module) {
  syncContent();
}

// Export for testing and programmatic use
module.exports = { syncContent };
