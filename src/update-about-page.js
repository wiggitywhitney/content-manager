// ABOUTME: Generates and updates the dynamic About page on Micro.blog.
// ABOUTME: Reads spreadsheet rows to determine active content channels, then pushes Markdown via XML-RPC.
'use strict';

const { ABOUT_PAGE_CHANNELS } = require('./config/about-page-channels');

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
// Exports
// ============================================================================

module.exports = { getActiveChannels };
