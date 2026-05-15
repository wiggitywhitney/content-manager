// ABOUTME: Unit tests for sync-historical-posts.js — covers findUnsynced, parseRowDate,
// ABOUTME: and batch dry-run mode (no API calls when --dry-run flag is present).
'use strict';

const { findUnsynced, parseRowDate } = require('../src/sync-historical-posts');

describe('findUnsynced', () => {
  const videoRow = { name: 'Ep 1', type: 'Video', link: 'https://youtu.be/abc', microblogUrl: '', show: 'Enlightning' };
  const podcastRow = { name: 'Ep 1', type: 'Podcast', link: 'https://sdi.com/1', microblogUrl: null, show: 'SDI' };
  const presentationsRow = { name: 'Talk', type: 'Presentations', link: 'https://youtu.be/xyz', microblogUrl: undefined, show: '' };
  const alreadySyncedRow = { name: 'Old', type: 'Video', link: 'https://youtu.be/old', microblogUrl: 'https://whitneylee.com/2022/01/01/old.html', show: 'Enlightning' };
  const noCategoryRow = { name: 'Cred', type: 'Credential', link: '', microblogUrl: '', show: '' };
  const guestRow = { name: 'Guesting', type: 'Guest', link: 'https://some.com/ep', microblogUrl: '', show: '' };

  test('returns rows with empty microblogUrl and a valid category', () => {
    const rows = [videoRow, podcastRow, presentationsRow];
    const result = findUnsynced(rows);
    expect(result).toHaveLength(3);
  });

  test('excludes rows that already have a microblogUrl', () => {
    const rows = [videoRow, alreadySyncedRow];
    const result = findUnsynced(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(videoRow);
  });

  test('excludes rows with no valid category mapping (Credential, Teaching Assistant, etc.)', () => {
    const rows = [videoRow, noCategoryRow];
    const result = findUnsynced(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(videoRow);
  });

  test('includes Guest and Blog rows with no microblogUrl', () => {
    const blogRow = { name: 'Post', type: 'Blog', link: 'https://blog.com/post', microblogUrl: '', show: '' };
    const rows = [guestRow, blogRow];
    const result = findUnsynced(rows);
    expect(result).toHaveLength(2);
  });

  test('treats null, undefined, and empty string microblogUrl as unsynced', () => {
    const rows = [
      { ...videoRow, microblogUrl: null },
      { ...videoRow, microblogUrl: undefined },
      { ...videoRow, microblogUrl: '' },
    ];
    const result = findUnsynced(rows);
    expect(result).toHaveLength(3);
  });

  test('returns empty array for empty input', () => {
    expect(findUnsynced([])).toHaveLength(0);
  });

  test('returns empty array when all rows are synced', () => {
    const rows = [alreadySyncedRow];
    expect(findUnsynced(rows)).toHaveLength(0);
  });
});

describe('parseRowDate', () => {
  test('converts MM/DD/YYYY to ISO 8601 UTC string', () => {
    const result = parseRowDate('01/22/2025');
    expect(result).toMatch(/^2025-01-22T/);
    expect(result).toMatch(/Z$/);
  });

  test('handles single-digit month and day', () => {
    const result = parseRowDate('3/5/2023');
    expect(result).toMatch(/^2023-03-05T/);
  });

  test('returns a valid ISO string parseable by Date', () => {
    const result = parseRowDate('08/09/2024');
    const d = new Date(result);
    expect(isNaN(d.getTime())).toBe(false);
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(7); // 0-based: August = 7
    expect(d.getUTCDate()).toBe(9);
  });
});

describe('syncHistoricalPosts batch dry-run', () => {
  let originalArgv;
  let originalFetch;
  let originalToken;
  let originalServiceAccount;

  beforeEach(() => {
    originalArgv = [...process.argv];
    originalFetch = global.fetch;
    originalToken = process.env.MICROBLOG_APP_TOKEN;
    originalServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.argv.push('--dry-run');
    jest.resetModules();

    jest.doMock('googleapis', () => ({
      google: {
        auth: {
          GoogleAuth: jest.fn().mockImplementation(() => ({})),
        },
        sheets: jest.fn().mockReturnValue({
          spreadsheets: {
            values: {
              get: jest.fn().mockResolvedValue({
                data: {
                  values: [
                    ['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL'],
                    ['Ep 1', 'Video', '⚡️Enlightning', '8/9/2024', '', '', 'https://www.youtube.com/watch?v=abc123', ''],
                  ],
                },
              }),
            },
          },
        }),
      },
    }));

    jest.doMock('../src/sync-content', () => {
      const actual = jest.requireActual('../src/sync-content');
      return {
        ...actual,
        createMicroblogPost: jest.fn(),
        writeUrlToSpreadsheet: jest.fn(),
        uploadImageToMediaEndpoint: jest.fn(),
      };
    });

    jest.doMock('../src/fetch-thumbnail', () => ({
      fetchThumbnail: jest.fn(),
    }));
  });

  afterEach(() => {
    process.argv = originalArgv;
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.MICROBLOG_APP_TOKEN;
    else process.env.MICROBLOG_APP_TOKEN = originalToken;
    if (originalServiceAccount === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalServiceAccount;
    jest.resetModules();
  });

  test('makes no Micropub POST calls and no thumbnail fetches in dry-run mode', async () => {
    process.env.MICROBLOG_APP_TOKEN = 'test-token';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: 'service_account', project_id: 'test', private_key: 'k', client_email: 'e@e.com',
    });
    global.fetch = jest.fn();

    const { syncHistoricalPosts } = require('../src/sync-historical-posts');
    await syncHistoricalPosts();

    const postCalls = (global.fetch.mock?.calls || []).filter(([, opts]) => opts?.method === 'POST');
    expect(postCalls).toHaveLength(0);

    const { createMicroblogPost } = require('../src/sync-content');
    expect(createMicroblogPost).not.toHaveBeenCalled();
  });
});
