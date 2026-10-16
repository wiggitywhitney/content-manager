// ABOUTME: Applies one committed Datadog monitor definition (datadog/monitors/*.json) through the v1 API.
// ABOUTME: Updates the monitor when the file has an id; otherwise creates it and writes the new id back to the file.

'use strict';

const fs = require('fs');

const MONITOR_API = 'https://api.datadoghq.com/api/v1/monitor';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Create or update the Datadog monitor described by a JSON file.
 * Requires DD_API_KEY and DD_APP_KEY. Throws when either is unset or Datadog rejects the request.
 *
 * @param {string} filePath - Path to a monitor definition JSON file
 * @returns {Promise<number>} The monitor's id
 */
async function applyMonitor(filePath) {
  for (const key of ['DD_API_KEY', 'DD_APP_KEY']) {
    if (!process.env[key]) throw new Error(`${key} is not set`);
  }

  const { id, ...definition } = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const url = id ? `${MONITOR_API}/${id}` : MONITOR_API;
  const method = id ? 'PUT' : 'POST';

  const response = await fetch(url, {
    method,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': process.env.DD_API_KEY,
      'DD-APPLICATION-KEY': process.env.DD_APP_KEY,
    },
    body: JSON.stringify(definition),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Datadog ${method} ${url} returned ${response.status}: ${text}`);
  }

  if (id) {
    console.log(`[monitor] Updated monitor ${id} from ${filePath}`); // eslint-disable-line no-console
    return id;
  }

  const created = await response.json();
  fs.writeFileSync(filePath, `${JSON.stringify({ id: created.id, ...definition }, null, 2)}\n`);
  console.log(`[monitor] Created monitor ${created.id}; wrote its id to ${filePath}`); // eslint-disable-line no-console
  return created.id;
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('[monitor] Usage: node src/apply-datadog-monitor.js datadog/monitors/<name>.json');
    process.exit(1);
  }
  applyMonitor(filePath).catch((err) => {
    console.error(`[monitor] ${err.message}`);
    process.exit(1);
  });
}

module.exports = { applyMonitor };
