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
  // addPhotoToPost uses content-replace (not add:{ photo }) to preserve post categories.
  // It first GETs the source content, appends the img tag, then sends replace:{ content }.
  const POST_URL = 'https://whitneylee.com/2025/01/01/post.html';
  const PHOTO_URL = 'https://cdn.micro.blog/uploads/thumb.jpg';
  const TOKEN = 'mytoken';
  const EXISTING_CONTENT = 'My Talk post text with a [link](https://youtu.be/abc123)';

  const makeSourceResponse = (content) => ({
    ok: true,
    json: async () => ({ type: 'h-entry', properties: { content: [content] } }),
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fetches source content before sending update', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse(EXISTING_CONTENT))
      .mockResolvedValueOnce({ status: 200 });

    await addPhotoToPost(POST_URL, PHOTO_URL, TOKEN);

    const [sourceUrl, sourceOpts] = global.fetch.mock.calls[0];
    expect(sourceUrl).toContain('q=source');
    expect(sourceUrl).toContain(encodeURIComponent(POST_URL));
    expect(sourceOpts.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  test('sends content-replace with img tag appended to existing content', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse(EXISTING_CONTENT))
      .mockResolvedValueOnce({ status: 200 });

    await addPhotoToPost(POST_URL, PHOTO_URL, TOKEN);

    const [updateUrl, updateOpts] = global.fetch.mock.calls[1];
    expect(updateUrl).toBe('https://micro.blog/micropub');
    expect(updateOpts.method).toBe('POST');
    expect(updateOpts.headers['Content-Type']).toBe('application/json');
    expect(updateOpts.headers.Authorization).toBe(`Bearer ${TOKEN}`);

    const body = JSON.parse(updateOpts.body);
    expect(body.action).toBe('update');
    expect(body.url).toBe(POST_URL);
    expect(body.replace.content[0]).toBe(`${EXISTING_CONTENT}\n\n<img src="${PHOTO_URL}">`);
    expect(body.add).toBeUndefined();
  });

  test('skips update and logs warning when source content is null/empty', async () => {
    global.fetch.mockResolvedValueOnce(makeSourceResponse(''));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(addPhotoToPost(POST_URL, PHOTO_URL, TOKEN)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(POST_URL));

    warnSpy.mockRestore();
  });

  test('resolves successfully on 202 response', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse(EXISTING_CONTENT))
      .mockResolvedValueOnce({ status: 202 });

    await expect(addPhotoToPost(POST_URL, PHOTO_URL, TOKEN)).resolves.toBeUndefined();
  });

  test('throws on non-200/202 update response', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse(EXISTING_CONTENT))
      .mockResolvedValueOnce({ status: 400, text: async () => 'Bad request' });

    await expect(addPhotoToPost(POST_URL, PHOTO_URL, TOKEN)).rejects.toThrow('Micropub update failed (400)');
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
