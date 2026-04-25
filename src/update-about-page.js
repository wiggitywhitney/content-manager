// ABOUTME: Generates and updates the dynamic About page on Micro.blog.
// ABOUTME: Reads spreadsheet rows to determine active content channels, then pushes Markdown via XML-RPC.
'use strict';

const https = require('https');
const { ABOUT_PAGE_CHANNELS } = require('./config/about-page-channels');

// ============================================================================
// XML-RPC Utilities
// ============================================================================

const XMLRPC_TIMEOUT_MS = parseInt(process.env.XMLRPC_TIMEOUT_MS || '10000', 10);
const XMLRPC_MAX_RETRIES = parseInt(process.env.XMLRPC_MAX_RETRIES || '3', 10);

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str) {
  // &amp; must be replaced last to avoid double-unescaping (e.g. &amp;lt; → &lt; not <)
  return String(str ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlrpcRequest(methodName, params) {
  return new Promise((resolve, reject) => {
    const username = process.env.MICROBLOG_USERNAME || 'wiggitywhitney';
    const token = process.env.MICROBLOG_XMLRPC_TOKEN;

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
          return `<member><name>${escapeXml(key)}</name><value>${valueXml}</value></member>`;
        }).join('');
        return `<param><value><struct>${members}</struct></value></param>`;
      }
      return '';
    }).join('');

    const requestBody = `<?xml version="1.0"?>\n<methodCall>\n  <methodName>${methodName}</methodName>\n  <params>\n    ${paramsXml}\n  </params>\n</methodCall>`;

    const auth = Buffer.from(`${username}:${token}`).toString('base64');

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
      res.on('data', chunk => { data += chunk; });
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

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Parse spreadsheet date string to a Date object.
 * Handles MM/DD/YYYY, M/D/YYYY, "Month Day, Year", and YYYY-MM-DD formats.
 * @param {string} dateString
 * @returns {Date|null}
 */
function parseDateString(dateString) {
  if (!dateString || !dateString.trim()) return null;
  const trimmed = dateString.trim();

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`);
  }

  const monthNames = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12'
  };
  const textMatch = trimmed.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (textMatch) {
    const [, monthName, day, year] = textMatch;
    const month = monthNames[monthName.toLowerCase()];
    if (month) return new Date(`${year}-${month}-${day.padStart(2, '0')}T12:00:00Z`);
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(`${y}-${m}-${d}T12:00:00Z`);
  }

  return null;
}

// ============================================================================
// Channel Activity
// ============================================================================

/**
 * Determine which channels are active given a set of spreadsheet rows and today's date.
 *
 * Returns channels ordered by most recent content date (newest first), with
 * alwaysShow channels that have no content dates sorted after date-bearing channels.
 * Channels with sortLast: true always appear at the end.
 *
 * @param {Array<{type: string, show: string, date: string}>} validRows
 * @param {Date} todayDate
 * @returns {Array} Active channel config objects, augmented with mostRecentDate
 */
function getActiveChannels(validRows, todayDate) {
  const active = [];

  for (const channel of ABOUT_PAGE_CHANNELS) {
    let mostRecentDate = null;

    if (!channel.alwaysShow && channel.type) {
      // Find rows that match this channel's type and optional show filter
      const matchingRows = validRows.filter(row => {
        if (row.type !== channel.type) return false;
        if (!channel.showFilter) return true;
        // showFilter matching is case-insensitive
        const showLower = (row.show || '').toLowerCase();
        return channel.showFilter.some(f => showLower.includes(f.toLowerCase()));
      });

      // Find the most recent valid date among matching rows
      for (const row of matchingRows) {
        const d = parseDateString(row.date);
        if (d && (!mostRecentDate || d > mostRecentDate)) {
          mostRecentDate = d;
        }
      }

      // Check freshness: skip if no date found or date is outside threshold.
      // Uses strict > so content published exactly thresholdDays ago is still included.
      if (!mostRecentDate) continue;
      const daysDiff = Math.floor((todayDate - mostRecentDate) / (1000 * 60 * 60 * 24));
      if (daysDiff > channel.thresholdDays) continue;
    }

    active.push({ ...channel, mostRecentDate });
  }

  // Sort: non-sortLast channels by mostRecentDate desc (null last), then sortLast channels
  const regular = active.filter(c => !c.sortLast);
  const last = active.filter(c => c.sortLast);

  regular.sort((a, b) => {
    if (a.mostRecentDate && b.mostRecentDate) return b.mostRecentDate - a.mostRecentDate;
    if (a.mostRecentDate) return -1;
    if (b.mostRecentDate) return 1;
    return 0;
  });

  return [...regular, ...last];
}

// ============================================================================
// About Page Markdown Generation
// ============================================================================

// Bio text per PRD Decision 3 — finalized by Whitney 2026-04-25
const BIO_TEXT = 'Whitney Lee is a creator and systems thinker who explores how observability, AI, and platform engineering connect across the cloud native ecosystem. She brings humor, depth, and clarity to complex technologies while building original frameworks that help others understand how systems fit together. She runs a vibrant YouTube channel, hosts Datadog Illuminated and Software Defined Interviews, has delivered two KubeCon keynotes and countless breakout talks, and combines storytelling and technical rigor to illuminate the human side of cloud native engineering.';

// Photo layout matches the original About page — flex container with photo left, bio right
const PHOTO_BLOCK = `<div style="display: flex; align-items: flex-start; gap: 3rem; margin-bottom: 1rem;">
<img src="https://whitneylee.com/uploads/2025/whitney-square.jpg" alt="Whitney Lee" style="width: 200px; border-radius: 0 !important;">
<div style="text-align: left;">
${BIO_TEXT}
</div>
</div>`;

/**
 * Generate the About page content from an ordered list of active channels.
 * Produces: photo+bio HTML block, then a flat channel list (no headings, no separator).
 * sortLast channels (SDI) are already ordered last by getActiveChannels.
 *
 * @param {Array} activeChannels - Ordered array from getActiveChannels
 * @returns {string} Page content string (HTML block + Markdown links)
 */
function generateAboutPageMarkdown(activeChannels) {
  const links = activeChannels.map(c => `- [${c.name}](${c.url})`).join('\n');
  return `${PHOTO_BLOCK}\n\n${links}`;
}

// ============================================================================
// About Page Content Injection
// ============================================================================

/**
 * Extract a named member value from an XML-RPC struct string.
 * Handles <string>, <int>, and <boolean> value types.
 *
 * @param {string} structContent - Raw struct XML content
 * @param {string} memberName - Member name to extract
 * @returns {string|null}
 */
function extractMember(structContent, memberName) {
  // Micro.blog uses <i4> for integers (standard XML-RPC alias for <int>)
  const regex = new RegExp(
    `<name>\\s*${memberName}\\s*<\\/name>\\s*<value>\\s*` +
    `(?:<string>([\\s\\S]*?)<\\/string>|<int>(\\d+)<\\/int>|<i4>(\\d+)<\\/i4>|<boolean>([01])<\\/boolean>|<string\\/>)`,
    'i'
  );
  const match = structContent.match(regex);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
}

/**
 * Parse the XML-RPC response from microblog.getPages into page objects.
 *
 * @param {string} body - Raw XML response body
 * @returns {Array<{pageID: string, title: string, description: string}>}
 */
function parseGetPagesResponse(body) {
  const pages = [];
  let searchFrom = 0;

  while (searchFrom < body.length) {
    const openIdx = body.indexOf('<struct>', searchFrom);
    if (openIdx === -1) break;

    // Find the matching </struct> using depth-counting to handle nested structs.
    // A non-greedy regex would stop at the first inner </struct>, truncating the page.
    let depth = 1;
    let pos = openIdx + '<struct>'.length;

    while (pos < body.length && depth > 0) {
      const nextOpen = body.indexOf('<struct>', pos);
      const nextClose = body.indexOf('</struct>', pos);

      if (nextClose === -1) { depth = -1; break; }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + '<struct>'.length;
      } else {
        depth--;
        pos = nextClose + '</struct>'.length;
      }
    }

    if (depth !== 0) break;

    const closeIdx = pos - '</struct>'.length;
    const content = body.substring(openIdx + '<struct>'.length, closeIdx);

    // Micro.blog uses 'id' (not 'pageID') for the page identifier
    const pageID = extractMember(content, 'id');
    const title = extractMember(content, 'title');
    const description = extractMember(content, 'description');

    if (pageID !== null && title !== null) {
      pages.push({
        pageID: pageID.trim(),
        title: unescapeXml(title.trim()),
        description: description !== null ? unescapeXml(description) : ''
      });
    }

    searchFrom = pos;
  }

  return pages;
}

/**
 * Update the Micro.blog About page if content has changed.
 * Calls microblog.getPages to find the current description, compares with
 * the generated Markdown, and calls microblog.editPage only if different.
 *
 * @param {Array} validRows - Parsed spreadsheet rows (type, show, date fields)
 * @param {Date} todayDate - Reference date for freshness checks
 * @param {Object} [options]
 * @param {Function} [options.xmlrpcFn] - XML-RPC call function (for testing)
 * @returns {Promise<{updated: boolean}>}
 */
async function updateAboutPage(validRows, todayDate, { xmlrpcFn = xmlrpcRequest } = {}) {
  const token = process.env.MICROBLOG_XMLRPC_TOKEN;
  if (!token) throw new Error('MICROBLOG_XMLRPC_TOKEN not set');

  const username = process.env.MICROBLOG_USERNAME || 'wiggitywhitney';
  // Micro.blog uses the username as the blogId (not integer 1 as standard Blogger API expects)
  const blogId = username;

  const activeChannels = getActiveChannels(validRows, todayDate);
  const newMarkdown = generateAboutPageMarkdown(activeChannels);

  const pagesResponse = await xmlrpcFn('microblog.getPages', [blogId, username, token, 100, 0]);

  if (pagesResponse.body.includes('<fault>')) {
    throw new Error('microblog.getPages returned a fault');
  }

  const pages = parseGetPagesResponse(pagesResponse.body);
  const aboutPage = pages.find(p => p.title === 'About');

  if (!aboutPage) {
    throw new Error('About page not found in microblog.getPages response');
  }

  if (aboutPage.description === newMarkdown) {
    console.log('[update-about-page] About page content unchanged, skipping update'); // eslint-disable-line no-console
    return { updated: false };
  }

  const pageId = parseInt(aboutPage.pageID, 10);
  if (!Number.isFinite(pageId)) {
    throw new Error(`Invalid About page ID: ${aboutPage.pageID}`);
  }

  for (let attempt = 1; attempt <= XMLRPC_MAX_RETRIES; attempt++) {
    try {
      const editResponse = await xmlrpcFn('microblog.editPage', [
        pageId,
        username,
        token,
        { title: 'About', description: newMarkdown }
      ]);

      if (editResponse.body.includes('<fault>')) {
        throw new Error('microblog.editPage returned a fault');
      }

      console.log('[update-about-page] About page updated successfully'); // eslint-disable-line no-console
      return { updated: true };
    } catch (error) {
      if (attempt === XMLRPC_MAX_RETRIES) throw error;
      const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.warn(`[update-about-page] editPage failed (attempt ${attempt}); retrying in ${backoff}ms`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = { getActiveChannels, generateAboutPageMarkdown, updateAboutPage };
