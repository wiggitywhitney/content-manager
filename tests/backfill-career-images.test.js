// ABOUTME: Unit tests for backfill-career-images.js — covers postHasPhoto, addPhotoToPost, parseTabRows, skip logic, and dry-run mode.
'use strict';

const { postHasPhoto, addPhotoToPost, parseTabRows } = require('../src/backfill-career-images');

describe('postHasPhoto', () => {
  // micro.blog's Micropub source response embeds photos as <img> tags in content[0],
  // not as a separate 'photo' property. These tests reflect the actual API response shape.
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns true when content contains an img tag (actual micro.blog response shape)', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'h-entry',
        properties: {
          content: ['My Talk post text\n\n<img src="https://whitneylee.com/uploads/2026/thumb.jpg">'],
          published: ['2025-01-22T12:00:00+00:00'],
        },
      }),
    });

    const result = await postHasPhoto('https://whitneylee.com/2025/01/01/post.html', 'tok');
    expect(result).toBe(true);
  });

  test('returns false when content has no img tag', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'h-entry',
        properties: {
          content: ['Just text, no image here'],
          published: ['2025-01-22T12:00:00+00:00'],
        },
      }),
    });

    const result = await postHasPhoto('https://whitneylee.com/2025/01/01/post.html', 'tok');
    expect(result).toBe(false);
  });

  test('returns false when content is empty', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'h-entry',
        properties: { content: [''] },
      }),
    });

    const result = await postHasPhoto('https://whitneylee.com/2025/01/01/post.html', 'tok');
    expect(result).toBe(false);
  });

  test('returns false when properties has no content field', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'h-entry', properties: {} }),
    });

    const result = await postHasPhoto('https://whitneylee.com/2025/01/01/post.html', 'tok');
    expect(result).toBe(false);
  });

  test('throws when fetch returns non-ok status', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(
      postHasPhoto('https://whitneylee.com/2025/01/01/post.html', 'tok')
    ).rejects.toThrow('Failed to query post source (401)');
  });

  test('calls Micropub source endpoint with correct URL and auth header', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'h-entry', properties: { content: ['text'] } }),
    });

    const postUrl = 'https://whitneylee.com/2025/06/01/my-talk.html';
    await postHasPhoto(postUrl, 'mytoken');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=source'),
      expect.objectContaining({ headers: { Authorization: 'Bearer mytoken' } })
    );
    expect(global.fetch.mock.calls[0][0]).toContain(encodeURIComponent(postUrl));
  });
});

describe('addPhotoToPost', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends correct Micropub update JSON body', async () => {
    global.fetch.mockResolvedValue({ status: 200 });

    await addPhotoToPost(
      'https://whitneylee.com/2025/01/01/post.html',
      'https://cdn.micro.blog/uploads/thumb.jpg',
      'mytoken'
    );

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://micro.blog/micropub');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers.Authorization).toBe('Bearer mytoken');

    const body = JSON.parse(options.body);
    expect(body.action).toBe('update');
    expect(body.url).toBe('https://whitneylee.com/2025/01/01/post.html');
    expect(body.add.photo).toEqual(['https://cdn.micro.blog/uploads/thumb.jpg']);
  });

  test('resolves successfully on 202 response', async () => {
    global.fetch.mockResolvedValue({ status: 202 });
    await expect(addPhotoToPost('https://whitneylee.com/post.html', 'https://cdn.micro.blog/thumb.jpg', 'tok')).resolves.toBeUndefined();
  });

  test('throws on non-200/202 response', async () => {
    global.fetch.mockResolvedValue({
      status: 400,
      text: async () => 'Bad request',
    });

    await expect(
      addPhotoToPost('https://whitneylee.com/post.html', 'https://cdn.micro.blog/thumb.jpg', 'tok')
    ).rejects.toThrow('Micropub update failed (400)');
  });
});

describe('parseTabRows', () => {
  const makeRaw = (name, type, show, date, link, microblogUrl) =>
    [name, type, show, date, '', '', link, microblogUrl];

  test('skips the header row (index 0)', () => {
    const rows = [
      makeRaw('Name', 'Type', 'Show', 'Date', 'Link', 'Micro.blog URL'),
      makeRaw('My Talk', 'Video', 'Thunder', '1/1/2026', 'https://youtu.be/abc', 'https://whitneylee.com/post.html'),
    ];
    const result = parseTabRows(rows, 'Sheet1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My Talk');
  });

  test('attaches tabName to each parsed row', () => {
    const rows = [
      makeRaw('Name', 'Type', 'Show', 'Date', 'Link', 'URL'),
      makeRaw('SDI 122', 'Podcast', 'SDI', '1/1/2026', 'https://softwaredefinedinterviews.com/122', 'https://whitneylee.com/post.html'),
    ];
    const result = parseTabRows(rows, '2024 & earlier');
    expect(result[0].tabName).toBe('2024 & earlier');
    expect(result[0].tabRowIndex).toBe(2);
  });

  test('filters out rows without name or type', () => {
    const rows = [
      makeRaw('Name', 'Type', 'Show', 'Date', 'Link', 'URL'),
      makeRaw('', '', '', '', '', ''), // empty row
      makeRaw('My Talk', 'Video', '', '1/1/2026', 'https://youtu.be/abc', 'https://whitneylee.com/post.html'),
    ];
    const result = parseTabRows(rows, 'Sheet1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My Talk');
  });
});

describe('backfillCareerImages dry-run mode', () => {
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
    // Mock googleapis so the spreadsheet read returns a minimal valid response
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
                    ['My Talk', 'Video', '🌩️ Thunder', '1/15/2026', '', '', 'https://youtu.be/abc123', 'https://whitneylee.com/2026/01/15/my-talk.html'],
                  ],
                },
              }),
            },
          },
        }),
      },
    }));
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
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account', project_id: 'test', private_key: 'k', client_email: 'e@e.com' });
    global.fetch = jest.fn();

    const { backfillCareerImages } = require('../src/backfill-career-images');
    await backfillCareerImages();

    const postCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});
