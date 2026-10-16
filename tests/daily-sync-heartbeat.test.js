// ABOUTME: Unit tests for daily-sync-heartbeat.js — covers the no-op path, the Datadog request shape,
// ABOUTME: and that a failed request logs a warning without throwing.

'use strict';

const { submitHeartbeatMetric } = require('../src/daily-sync-heartbeat');

describe('submitHeartbeatMetric', () => {
  let originalFetch;
  let warnSpy;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.DD_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    warnSpy.mockRestore();
    delete process.env.DD_API_KEY;
    jest.clearAllMocks();
  });

  test('is a no-op when DD_API_KEY is not set', async () => {
    await submitHeartbeatMetric('morning');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('POSTs a gauge of 1 to Datadog v2/series tagged with service and slot', async () => {
    process.env.DD_API_KEY = 'test-dd-api-key';
    global.fetch.mockResolvedValue({ ok: true });

    await submitHeartbeatMetric('midday');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.datadoghq.com/api/v2/series');
    expect(opts.method).toBe('POST');
    expect(opts.headers['DD-API-KEY']).toBe('test-dd-api-key');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.series).toHaveLength(1);
    expect(body.series[0].metric).toBe('content_manager.daily_sync.heartbeat');
    expect(body.series[0].type).toBe(3); // gauge
    expect(body.series[0].points).toHaveLength(1);
    expect(body.series[0].points[0].value).toBe(1);
    expect(body.series[0].tags).toEqual(['service:content-manager', 'slot:midday']);
  });

  test('sends the current time in seconds as the point timestamp', async () => {
    process.env.DD_API_KEY = 'test-dd-api-key';
    global.fetch.mockResolvedValue({ ok: true });
    const before = Math.floor(Date.now() / 1000);

    await submitHeartbeatMetric('evening');

    const after = Math.floor(Date.now() / 1000);
    const { timestamp } = JSON.parse(global.fetch.mock.calls[0][1].body).series[0].points[0];
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  test('passes an AbortSignal to fetch for timeout enforcement', async () => {
    process.env.DD_API_KEY = 'test-dd-api-key';
    global.fetch.mockResolvedValue({ ok: true });

    await submitHeartbeatMetric('manual');

    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  test('does not throw when fetch fails, and logs a warning', async () => {
    process.env.DD_API_KEY = 'test-dd-api-key';
    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(submitHeartbeatMetric('morning')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'));
  });

  test('logs a warning when Datadog API returns a non-OK status', async () => {
    process.env.DD_API_KEY = 'test-dd-api-key';
    global.fetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' });

    await expect(submitHeartbeatMetric('morning')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('403'));
  });
});
