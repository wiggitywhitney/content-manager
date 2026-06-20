// ABOUTME: Tests that syncContent logs data-problem skips (Invalid Type, Missing required fields) at ERROR level.
// ABOUTME: These skips indicate bad spreadsheet data that needs human attention, so they should be ERROR not WARN.

'use strict';

jest.mock('googleapis');

const FAKE_SERVICE_ACCOUNT = JSON.stringify({ type: 'service_account' });

describe('syncContent skip log levels', () => {
  let syncContentModule;
  let google;
  let errSpy;

  beforeEach(() => {
    // Clear module cache so sync-content.js reloads with LOG_FORMAT=json
    jest.resetModules();

    process.env.LOG_FORMAT = 'json';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_SERVICE_ACCOUNT;
    process.env.MICROBLOG_APP_TOKEN = 'test-token';

    // Re-require after resetModules — mock factory is still registered after reset
    ({ google } = require('googleapis'));
    google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };

    // Mock global fetch for Micro.blog queryMicroblogPosts (returns empty posts)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });

    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    syncContentModule = require('../src/sync-content');
  });

  afterEach(() => {
    errSpy.mockRestore();
    delete process.env.LOG_FORMAT;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.MICROBLOG_APP_TOKEN;
    jest.clearAllMocks();
  });

  function makeSheetsMock(mainRows) {
    const mockGet = jest.fn()
      .mockResolvedValueOnce({ data: { values: mainRows } })       // Sheet1 read
      .mockResolvedValueOnce({ data: { values: [] } });            // Historical tab read (orphan check)
    google.sheets.mockReturnValue({
      spreadsheets: { values: { get: mockGet } },
    });
  }

  function parseLogCalls() {
    return errSpy.mock.calls
      .map(([msg]) => { try { return JSON.parse(msg); } catch { return null; } })
      .filter(Boolean);
  }

  test('logs Invalid Type row skips at ERROR level (not WARN)', async () => {
    makeSheetsMock([
      ['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL', 'Posted At'],
      ['Keynote at Conf', 'Keynote', 'Some Show', '1/15/2026', '', '', 'https://example.com', '', ''],
    ]);

    await syncContentModule.syncContent();

    const logCalls = parseLogCalls();
    const skipLog = logCalls.find(l =>
      l.message?.includes('✗ Skipped') && l.message?.includes('Invalid Type')
    );
    expect(skipLog).toBeDefined();
    expect(skipLog.level).toBe('ERROR');
  });

  test('logs Missing required fields row skips at ERROR level (not WARN)', async () => {
    makeSheetsMock([
      ['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL', 'Posted At'],
      ['', 'Podcast', 'SDI', '1/15/2026', '', '', 'https://example.com', '', ''],
    ]);

    await syncContentModule.syncContent();

    const logCalls = parseLogCalls();
    const skipLog = logCalls.find(l =>
      l.message?.includes('✗ Skipped') && l.message?.includes('Missing required fields')
    );
    expect(skipLog).toBeDefined();
    expect(skipLog.level).toBe('ERROR');
  });

  test('does NOT log month header rows at ERROR level', async () => {
    makeSheetsMock([
      ['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL', 'Posted At'],
      ['2026 January', '', '', '', '', '', '', '', ''],
    ]);

    await syncContentModule.syncContent();

    const logCalls = parseLogCalls();
    const errorSkipLog = logCalls.find(l => l.level === 'ERROR' && l.message?.includes('✗ Skipped'));
    expect(errorSkipLog).toBeUndefined();
  });
});
