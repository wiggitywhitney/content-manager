// ABOUTME: Tests for career-post-guard — checks whether career content was posted today.
// ABOUTME: Verifies spreadsheet-based daily guard logic used by post-social-content.js.

'use strict';

jest.mock('googleapis');

const { google } = require('googleapis');
const { checkCareerPostedToday } = require('../src/career-post-guard');

const LIVE_SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';

function makeSheetsMock(colIValues) {
  const mockGet = jest.fn().mockResolvedValue({
    data: { values: colIValues },
  });
  google.sheets.mockReturnValue({ spreadsheets: { values: { get: mockGet } } });
  google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
  return { mockGet };
}

function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

describe('checkCareerPostedToday', () => {
  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
  });

  afterEach(() => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.clearAllMocks();
  });

  test('returns true when a row has a timestamp from today', async () => {
    makeSheetsMock([
      ['Micro.blog Posted At'],
      ['2026-01-15T10:00:00.000Z'],
      [`${todayPrefix()}T16:15:00.000Z`],
    ]);
    const result = await checkCareerPostedToday();
    expect(result).toBe(true);
  });

  test('returns false when all Column I timestamps are from earlier dates', async () => {
    makeSheetsMock([
      ['Micro.blog Posted At'],
      ['2026-01-15T10:00:00.000Z'],
      ['2026-03-01T12:00:00.000Z'],
    ]);
    const result = await checkCareerPostedToday();
    expect(result).toBe(false);
  });

  test('returns false when Column I is empty', async () => {
    makeSheetsMock([]);
    const result = await checkCareerPostedToday();
    expect(result).toBe(false);
  });

  test('returns false when all Column I cells are empty strings', async () => {
    makeSheetsMock([[''], [''], ['']]);
    const result = await checkCareerPostedToday();
    expect(result).toBe(false);
  });

  test('reads from the correct spreadsheet and range (Sheet1!I:I)', async () => {
    const { mockGet } = makeSheetsMock([]);
    await checkCareerPostedToday();
    expect(mockGet).toHaveBeenCalledWith({
      spreadsheetId: LIVE_SPREADSHEET_ID,
      range: 'Sheet1!I:I',
    });
  });

  test('returns false (not throws) when GOOGLE_SERVICE_ACCOUNT_JSON is not set', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const result = await checkCareerPostedToday();
    expect(result).toBe(false);
  });

  test('returns false (not throws) when the Sheets API call fails', async () => {
    google.sheets.mockReturnValue({
      spreadsheets: { values: { get: jest.fn().mockRejectedValue(new Error('Network error')) } },
    });
    google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
    const result = await checkCareerPostedToday();
    expect(result).toBe(false);
  });
});
