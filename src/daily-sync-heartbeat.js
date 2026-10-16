// ABOUTME: Sends the daily-sync heartbeat gauge to Datadog on every run, whether it posts, skips, or fails.
// ABOUTME: Run as `node src/daily-sync-heartbeat.js <morning|midday|evening|manual>`; exports submitHeartbeatMetric(slot).

'use strict';

/**
 * Submit a gauge metric to Datadog showing that a daily-sync run reached the priority step.
 * The liveness monitor alerts when no heartbeat arrives for 26 hours.
 * No-op when DD_API_KEY is not set. Fetch errors are logged as warnings and not re-thrown.
 *
 * @param {string} slot - 'morning' | 'midday' | 'evening' | 'manual'
 */
async function submitHeartbeatMetric(slot) {
  const apiKey = process.env.DD_API_KEY;
  if (!apiKey) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api.datadoghq.com/api/v2/series', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': apiKey,
      },
      body: JSON.stringify({
        series: [{
          metric: 'content_manager.daily_sync.heartbeat',
          type: 3, // gauge
          points: [{ timestamp, value: 1 }],
          tags: ['service:content-manager', `slot:${slot}`],
        }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`[heartbeat] Warning: Datadog metric submission returned ${response.status}: ${text}`);
    }
  } catch (err) {
    console.warn(`[heartbeat] Warning: failed to submit heartbeat metric: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

if (require.main === module) {
  const slot = process.argv[2];
  if (!slot) {
    console.error('[heartbeat] Usage: node src/daily-sync-heartbeat.js <morning|midday|evening|manual>');
    process.exit(1);
  }
  if (!process.env.DD_API_KEY) {
    console.warn('[heartbeat] Warning: DD_API_KEY unset; heartbeat not sent');
  }
  submitHeartbeatMetric(slot);
}

module.exports = { submitHeartbeatMetric };
