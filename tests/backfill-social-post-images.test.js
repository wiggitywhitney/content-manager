// ABOUTME: Unit tests for backfill-social-post-images.js — covers buildLinkMap, findMatchingRow,
// ABOUTME: and batch dry-run mode ensuring no Micropub or media upload calls are made.
'use strict';

const { buildLinkMap, findMatchingRow } = require('../src/backfill-social-post-images');

describe('buildLinkMap', () => {
  test('maps link to row for Video rows that need an image', () => {
    const rows = [
      { name: 'My Talk', type: 'Video', link: 'https://youtu.be/abc123', show: '🌩️ Thunder' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(1);
    expect(map.get('https://youtu.be/abc123')).toBe(rows[0]);
  });

  test('maps link to row for Podcast rows', () => {
    const rows = [
      { name: 'Episode 122', type: 'Podcast', link: 'https://softwaredefinedinterviews.com/122', show: 'SDI' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(1);
    expect(map.get('https://softwaredefinedinterviews.com/122')).toBe(rows[0]);
  });

  test('maps link to row for Presentations rows with a link', () => {
    const rows = [
      { name: 'My Pres', type: 'Presentations', link: 'https://youtu.be/xyz', show: '' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(1);
  });

  test('maps link to row for Presentation (singular typo) rows with a link', () => {
    const rows = [
      { name: 'Singular Pres', type: 'Presentation', link: 'https://youtu.be/singular', show: '' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(1);
  });

  test('excludes Guest rows', () => {
    const rows = [
      { name: 'Guest Spot', type: 'Guest', link: 'https://some.com/ep', show: '' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(0);
  });

  test('excludes Blog rows', () => {
    const rows = [
      { name: 'Blog Post', type: 'Blog', link: 'https://blog.com/post', show: '' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(0);
  });

  test('excludes Tanzu Tuesday rows', () => {
    const rows = [
      { name: 'Tanzu Talk', type: 'Video', link: 'https://youtu.be/tanzu', show: 'Tanzu Tuesday' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(0);
  });

  test('excludes Presentations rows without a link', () => {
    const rows = [
      { name: 'No Link Talk', type: 'Presentations', link: '', show: '' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(0);
  });

  test('excludes rows where link is null or undefined', () => {
    const rows = [
      { name: 'No Link', type: 'Video', link: null, show: '🌩️ Thunder' },
      { name: 'Undef Link', type: 'Podcast', link: undefined, show: 'SDI' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(0);
  });

  test('returns empty map for empty input', () => {
    const map = buildLinkMap([]);
    expect(map.size).toBe(0);
  });

  test('includes multiple eligible rows and excludes ineligible ones', () => {
    const rows = [
      { name: 'Talk 1', type: 'Video', link: 'https://youtu.be/a', show: '🌩️ Thunder' },
      { name: 'Episode 1', type: 'Podcast', link: 'https://sdi.com/2', show: 'SDI' },
      { name: 'Guest Spot', type: 'Guest', link: 'https://other.com', show: '' },
      { name: 'Tanzu', type: 'Video', link: 'https://youtu.be/tanzu', show: 'Tanzu Tuesday' },
    ];
    const map = buildLinkMap(rows);
    expect(map.size).toBe(2);
    expect(map.has('https://youtu.be/a')).toBe(true);
    expect(map.has('https://sdi.com/2')).toBe(true);
    expect(map.has('https://other.com')).toBe(false);
    expect(map.has('https://youtu.be/tanzu')).toBe(false);
  });
});

describe('findMatchingRow', () => {
  const row1 = { name: 'My Talk', link: 'https://youtu.be/abc123' };
  const row2 = { name: 'Episode 122', link: 'https://softwaredefinedinterviews.com/122' };

  let linkMap;
  beforeEach(() => {
    linkMap = new Map([
      ['https://youtu.be/abc123', row1],
      ['https://softwaredefinedinterviews.com/122', row2],
    ]);
  });

  test('returns matching row when content includes the YouTube link', () => {
    const content = '🌩️ Thunder: [My Talk](https://youtu.be/abc123)';
    expect(findMatchingRow(content, linkMap)).toBe(row1);
  });

  test('returns matching row when content includes the SDI link', () => {
    const content = 'Software Defined Interviews: [Episode 122](https://softwaredefinedinterviews.com/122)';
    expect(findMatchingRow(content, linkMap)).toBe(row2);
  });

  test('returns null when content includes no known link', () => {
    const content = 'Something unrelated with no known links here';
    expect(findMatchingRow(content, linkMap)).toBeNull();
  });

  test('returns null when content is empty string', () => {
    expect(findMatchingRow('', linkMap)).toBeNull();
  });

  test('returns null when content is null', () => {
    expect(findMatchingRow(null, linkMap)).toBeNull();
  });

  test('returns null when linkMap is empty', () => {
    const content = 'Content containing https://youtu.be/abc123';
    expect(findMatchingRow(content, new Map())).toBeNull();
  });

  test('returns a row when content embeds the link anywhere in the string', () => {
    // Checks that the link appears inside a markdown link [title](url)
    const content = 'Some preamble 🌩️ Thunder: [Talk Title\\(subpart\\)](https://youtu.be/abc123)';
    expect(findMatchingRow(content, linkMap)).toBe(row1);
  });
});

describe('backfillSocialPostImages batch dry-run', () => {
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
                    ['Talk Title', 'Video', '🌩️ Thunder', '1/15/2026', '', '', 'https://youtu.be/abc123', ''],
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
        queryMicroblogPosts: jest.fn().mockResolvedValue(new Map([
          [
            'https://whitneylee.com/2026/04/20/post.html',
            {
              content: '🌩️ Thunder: [Talk Title](https://youtu.be/abc123)',
              category: '',
              published: '2026-04-20T12:00:00Z',
            },
          ],
        ])),
        uploadImageToMediaEndpoint: jest.fn(),
      };
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    global.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.MICROBLOG_APP_TOKEN;
    } else {
      process.env.MICROBLOG_APP_TOKEN = originalToken;
    }
    if (originalServiceAccount === undefined) {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    } else {
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalServiceAccount;
    }
    jest.resetModules();
  });

  test('makes no Micropub POST calls in dry-run mode', async () => {
    process.env.MICROBLOG_APP_TOKEN = 'test-token';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: 'service_account',
      project_id: 'test',
      private_key: 'k',
      client_email: 'e@e.com',
    });
    global.fetch = jest.fn();

    const { backfillSocialPostImages } = require('../src/backfill-social-post-images');
    await backfillSocialPostImages();

    const postCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});
