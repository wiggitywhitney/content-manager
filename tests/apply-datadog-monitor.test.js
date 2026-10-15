// ABOUTME: Unit tests for apply-datadog-monitor.js — covers create vs. update requests, writing a new
// ABOUTME: monitor's id back to its file, and failing loudly on a missing key or a rejected request.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { applyMonitor } = require('../src/apply-datadog-monitor');

function makeDefinition(overrides = {}) {
  return {
    name: 'content-manager: test monitor',
    type: 'metric alert',
    query: 'max(last_1h):max:content_manager.daily_sync.heartbeat{service:content-manager} < 1',
    message: 'Test message @someone@example.com',
    tags: ['service:content-manager'],
    options: { notify_no_data: true, no_data_timeframe: 1560, thresholds: { critical: 1 } },
    ...overrides,
  };
}

function writeDefinition(dir, definition) {
  const filePath = path.join(dir, 'monitor.json');
  fs.writeFileSync(filePath, `${JSON.stringify(definition, null, 2)}\n`);
  return filePath;
}

describe('applyMonitor', () => {
  let originalFetch;
  let tmpDir;
  let logSpy;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-monitor-'));
    process.env.DD_API_KEY = 'test-api-key';
    process.env.DD_APP_KEY = 'test-app-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    logSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DD_API_KEY;
    delete process.env.DD_APP_KEY;
  });

  test('creates the monitor with POST when the file has no id, and writes the new id back to the file', async () => {
    const definition = makeDefinition();
    const filePath = writeDefinition(tmpDir, definition);
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 12345, ...definition }) });

    const id = await applyMonitor(filePath);

    expect(id).toBe(12345);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.datadoghq.com/api/v1/monitor');
    expect(opts.method).toBe('POST');
    expect(opts.headers['DD-API-KEY']).toBe('test-api-key');
    expect(opts.headers['DD-APPLICATION-KEY']).toBe('test-app-key');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual(definition);

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(saved).toEqual({ id: 12345, ...definition });
  });

  test('updates the monitor with PUT to its id when the file has one, sending the definition without the id', async () => {
    const definition = makeDefinition();
    const filePath = writeDefinition(tmpDir, { id: 295791590, ...definition });
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 295791590, ...definition }) });

    const id = await applyMonitor(filePath);

    expect(id).toBe(295791590);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.datadoghq.com/api/v1/monitor/295791590');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual(definition);
  });

  test('leaves the file unchanged after an update', async () => {
    const filePath = writeDefinition(tmpDir, { id: 295791590, ...makeDefinition() });
    const before = fs.readFileSync(filePath, 'utf8');
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 295791590 }) });

    await applyMonitor(filePath);

    expect(fs.readFileSync(filePath, 'utf8')).toBe(before);
  });

  test('throws with the status and body when Datadog rejects the request, and does not write an id', async () => {
    const filePath = writeDefinition(tmpDir, makeDefinition());
    const before = fs.readFileSync(filePath, 'utf8');
    global.fetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"errors":["bad query"]}' });

    await expect(applyMonitor(filePath)).rejects.toThrow(/400.*bad query/);
    expect(fs.readFileSync(filePath, 'utf8')).toBe(before);
  });

  test.each(['DD_API_KEY', 'DD_APP_KEY'])('throws without calling Datadog when %s is unset', async (key) => {
    const filePath = writeDefinition(tmpDir, makeDefinition());
    delete process.env[key];

    await expect(applyMonitor(filePath)).rejects.toThrow(key);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('committed monitor definitions', () => {
  const monitorsDir = path.join(__dirname, '../datadog/monitors');
  const load = (name) => JSON.parse(fs.readFileSync(path.join(monitorsDir, name), 'utf8'));

  test('liveness monitor alerts on 26 hours without a heartbeat and notifies both addresses', () => {
    const monitor = load('daily-sync-liveness.json');
    expect(monitor.query).toContain('content_manager.daily_sync.heartbeat');
    expect(monitor.options.notify_no_data).toBe(true);
    expect(monitor.options.no_data_timeframe).toBe(1560);
    expect(monitor.message).toContain('https://github.com/wiggitywhitney/content-manager/actions/workflows/daily-sync.yml');
    expect(monitor.message).toContain('@whitney.lee@datadoghq.com');
    expect(monitor.message).toContain('@wiggitywhitney@gmail.com');
  });

  test('token monitor targets monitor 295791590, keeps a recent value all day, and does not alert on no data', () => {
    const monitor = load('linkedin-token-expiry.json');
    expect(monitor.id).toBe(295791590);
    expect(monitor.query).toMatch(/^min\(last_1d\):min:content_manager\.linkedin\.token_days_until_expiry/);
    expect(monitor.options.notify_no_data).toBe(false);
    expect(monitor.message).not.toContain('is_no_data');
    expect(monitor.message).toContain('{{#is_recovery}}');
    // Without -i, vals exec drops PATH and a Homebrew node is not found
    expect(monitor.message).toContain('vals exec -i -f .vals.yaml -- node src/linkedin-oauth-setup.js');
    expect(monitor.message).toContain('@whitney.lee@datadoghq.com');
    expect(monitor.message).toContain('@wiggitywhitney@gmail.com');
  });
});
