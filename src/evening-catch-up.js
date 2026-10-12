// ABOUTME: Decides whether a single-post-mode daily-sync run posts or skips, for any of the three slots.
// ABOUTME: CLI takes the slot name, prints "skip" or "catch_up" to stdout; exits 1 if the posted-today check errors.

'use strict';

const { fetchCareerPostedToday } = require('./career-post-guard');
const { fetchSocialPostedToday } = require('./social-posts-queue');

// Scheduled UTC hour of each daily-sync cron (all fire at :17). A run that starts before its
// slot's hour has been delayed past midnight, so the UTC-dated posted-today checks would read
// the next day's records. A manual run (workflow_dispatch) starts when it is triggered, so it
// has no cutoff and goes straight to the posted-today checks.
const SLOT_UTC_HOURS = { morning: 13, midday: 17, evening: 21, manual: 0 };

/**
 * Decide what a single-post-mode run of the given slot should do.
 *
 * Skips when the run started after midnight UTC, or when a career, social, or
 * micro.blog-only post already went out today. Otherwise the run posts as the
 * morning slot. Every slot goes through this check, so a morning run delayed past
 * a midday or evening catch-up does not post a second time. Errors from the
 * posted-today checks propagate rather than being treated as "nothing posted",
 * which would produce a second post.
 *
 * @param {object} options
 * @param {'morning'|'midday'|'evening'|'manual'} options.slot - Slot whose cron triggered the run, or manual
 * @param {Date} [options.now] - Current time (injectable for tests)
 * @param {() => Promise<boolean>} [options.fetchCareer] - Strict career-posted-today check
 * @param {() => Promise<boolean>} [options.fetchSocial] - Strict social-posted-today check
 * @returns {Promise<{decision: 'skip'|'catch_up', reason: string}>}
 */
async function decideSlotRun({
  slot,
  now = new Date(),
  fetchCareer = fetchCareerPostedToday,
  fetchSocial = fetchSocialPostedToday,
}) {
  if (!Object.prototype.hasOwnProperty.call(SLOT_UTC_HOURS, slot)) {
    throw new Error(`Unknown slot '${slot}' — expected one of ${Object.keys(SLOT_UTC_HOURS).join(', ')}`);
  }
  if (now.getUTCHours() < SLOT_UTC_HOURS[slot]) {
    return { decision: 'skip', reason: 'after-midnight-utc' };
  }
  if (await fetchCareer()) {
    return { decision: 'skip', reason: 'career-posted-today' };
  }
  if (await fetchSocial()) {
    return { decision: 'skip', reason: 'social-posted-today' };
  }
  return { decision: 'catch_up', reason: 'no-managed-post-today' };
}

async function main() {
  const slot = process.argv[2];
  try {
    const { decision, reason } = await decideSlotRun({ slot });
    console.error(`[evening-catch-up] ${slot}: ${decision} (${reason})`); // eslint-disable-line no-console
    process.stdout.write(decision);
  } catch (err) {
    console.error(`[evening-catch-up] Posted-today check failed: ${err.message}`); // eslint-disable-line no-console
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { decideSlotRun, SLOT_UTC_HOURS };
