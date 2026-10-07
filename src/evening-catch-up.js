// ABOUTME: Decides whether a single-post-mode evening run skips or catches up a missed morning post.
// ABOUTME: CLI prints "skip" or "catch_up" to stdout; exits 1 if the posted-today check errors.

'use strict';

const { fetchCareerPostedToday } = require('./career-post-guard');
const { fetchSocialPostedToday } = require('./social-posts-queue');

// The evening cron fires at 21:17 UTC. A run that starts before 21:00 UTC has been delayed
// past midnight, so the UTC-dated posted-today checks would read the next day's records.
const EVENING_SLOT_UTC_HOUR = 21;

/**
 * Decide what a single-post-mode evening run should do.
 *
 * Skips when the run started after midnight UTC, or when a career, social, or
 * micro.blog-only post already went out today. Otherwise the run catches up the
 * morning slot. Errors from the posted-today checks propagate rather than being
 * treated as "nothing posted", which would produce a second post.
 *
 * @param {object} [options]
 * @param {Date} [options.now] - Current time (injectable for tests)
 * @param {() => Promise<boolean>} [options.fetchCareer] - Strict career-posted-today check
 * @param {() => Promise<boolean>} [options.fetchSocial] - Strict social-posted-today check
 * @returns {Promise<{decision: 'skip'|'catch_up', reason: string}>}
 */
async function decideEveningRun({
  now = new Date(),
  fetchCareer = fetchCareerPostedToday,
  fetchSocial = fetchSocialPostedToday,
} = {}) {
  if (now.getUTCHours() < EVENING_SLOT_UTC_HOUR) {
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
  try {
    const { decision, reason } = await decideEveningRun();
    console.error(`[evening-catch-up] ${decision} (${reason})`); // eslint-disable-line no-console
    process.stdout.write(decision);
  } catch (err) {
    console.error(`[evening-catch-up] Posted-today check failed: ${err.message}`); // eslint-disable-line no-console
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { decideEveningRun, EVENING_SLOT_UTC_HOUR };
