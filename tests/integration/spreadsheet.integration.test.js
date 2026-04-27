// ABOUTME: Integration tests for Google Sheets API reads against live and staged spreadsheets.
// ABOUTME: Requires GOOGLE_SERVICE_ACCOUNT_JSON env var. Run with: npm run test:integration

'use strict';

const { google } = require('googleapis');
const { COL, fetchPendingPostsForToday } = require('../../src/social-posts-queue');

const STAGED_SPREADSHEET_ID = '1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts';
const LIVE_SPREADSHEET_ID = '1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs';
const SOCIAL_POSTS_TAB = 'Social Posts Queue';

// COL indices from src/social-posts-queue.js — 14 columns total (0-indexed, 0=SHOW to 13=GROUP_ID)
const EXPECTED_COLUMNS = 14;

function getSheets() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required for integration tests');
  }
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

describe('Spreadsheet integration tests', () => {
  beforeAll(() => {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be set to run integration tests');
    }
  });

  describe('Social Posts Queue tab (staged spreadsheet)', () => {
    let rows;

    beforeAll(async () => {
      const sheets = getSheets();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: STAGED_SPREADSHEET_ID,
        range: `${SOCIAL_POSTS_TAB}!A:N`,
      });
      rows = response.data.values || [];
    });

    test('returns an array', () => {
      expect(Array.isArray(rows)).toBe(true);
    });

    test('header row has expected number of columns', () => {
      // The header row is always fully populated
      const header = rows[0];
      expect(header).toBeDefined();
      expect(header.length).toBe(EXPECTED_COLUMNS);
    });

    test('data rows have status values that are lowercase strings', () => {
      // Row 0 is header — start from row 1
      const dataRows = rows.slice(1);
      for (const row of dataRows) {
        const status = (row[COL.STATUS] || '').trim();
        if (!status) continue; // skip rows with no status
        expect(status).toBe(status.toLowerCase());
      }
    });

    test('data rows with scheduledDate match YYYY-MM-DD format', () => {
      const dataRows = rows.slice(1);
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      for (const row of dataRows) {
        const scheduledDate = (row[COL.SCHEDULED_DATE] || '').trim();
        if (!scheduledDate) continue; // skip rows with no date
        expect(scheduledDate).toMatch(datePattern);
      }
    });
  });

  describe('Live production spreadsheet (career guard read path)', () => {
    test('Sheet1!I:I returns an array without throwing', async () => {
      const sheets = getSheets();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: LIVE_SPREADSHEET_ID,
        range: 'Sheet1!I:I',
      });
      const values = response.data.values || [];
      expect(Array.isArray(values)).toBe(true);
    });
  });

  describe('fetchPendingPostsForToday()', () => {
    test('returns an array without throwing for today', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const posts = await fetchPendingPostsForToday(today);
      expect(Array.isArray(posts)).toBe(true);
    });
  });
});
