// ABOUTME: Unit tests for deduplicate-post-images.js — covers deduplicateContent, hasMultipleImages,
// ABOUTME: deduplicatePostImages (fetch/replace flow), and dry-run mode.
'use strict';

const { deduplicateContent, hasMultipleImages, deduplicatePostImages } = require('../src/deduplicate-post-images');

describe('hasMultipleImages', () => {
  test('returns false for content with no img tags', () => {
    expect(hasMultipleImages('Just some text')).toBe(false);
  });

  test('returns false for content with exactly one img tag', () => {
    expect(hasMultipleImages('Text\n\n<img src="https://cdn.micro.blog/thumb.jpg">')).toBe(false);
  });

  test('returns true for content with two img tags', () => {
    expect(hasMultipleImages('<img src="a.jpg"><img src="b.jpg">')).toBe(true);
  });

  test('returns true for content with three or more img tags', () => {
    expect(hasMultipleImages('<img src="a.jpg"><img src="b.jpg"><img src="c.jpg">')).toBe(true);
  });

  test('returns false for empty string', () => {
    expect(hasMultipleImages('')).toBe(false);
  });

  test('returns false for null', () => {
    expect(hasMultipleImages(null)).toBe(false);
  });
});

describe('deduplicateContent', () => {
  test('returns content unchanged when there is one img tag', () => {
    const content = 'Post text\n\n<img src="https://cdn.micro.blog/thumb.jpg">';
    expect(deduplicateContent(content)).toBe(content);
  });

  test('keeps only the first img tag when two are present', () => {
    const content = 'Text\n\n<img src="first.jpg">\n\n<img src="second.jpg">';
    const result = deduplicateContent(content);
    expect(result).toBe('Text\n\n<img src="first.jpg">\n\n');
  });

  test('keeps only the first img tag when three are present', () => {
    const content = '<img src="a.jpg"><img src="b.jpg"><img src="c.jpg">';
    const result = deduplicateContent(content);
    expect(result).toBe('<img src="a.jpg">');
  });

  test('preserves img tag attributes on the kept tag', () => {
    const content = '<img src="first.jpg" alt="First"><img src="second.jpg" alt="Second">';
    const result = deduplicateContent(content);
    expect(result).toContain('<img src="first.jpg" alt="First">');
    expect(result).not.toContain('second.jpg');
  });

  test('returns empty string unchanged', () => {
    expect(deduplicateContent('')).toBe('');
  });
});

describe('deduplicatePostImages', () => {
  const makeSourceResponse = (content) => ({
    ok: true,
    json: async () => ({
      type: 'h-entry',
      properties: { content: [content] },
    }),
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fetches source and replaces content when two img tags found', async () => {
    const original = 'Post text\n\n<img src="first.jpg">\n\n<img src="second.jpg">';
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse(original))
      .mockResolvedValueOnce({ status: 200 });

    const result = await deduplicatePostImages('https://whitneylee.com/2025/01/01/post.html', 'mytoken');

    expect(result).toBe(true);

    // First call: GET source
    const [sourceUrl, sourceOpts] = global.fetch.mock.calls[0];
    expect(sourceUrl).toContain('q=source');
    expect(sourceUrl).toContain(encodeURIComponent('https://whitneylee.com/2025/01/01/post.html'));
    expect(sourceOpts.headers.Authorization).toBe('Bearer mytoken');

    // Second call: POST replace
    const [updateUrl, updateOpts] = global.fetch.mock.calls[1];
    expect(updateUrl).toBe('https://micro.blog/micropub');
    expect(updateOpts.method).toBe('POST');
    expect(updateOpts.headers['Content-Type']).toBe('application/json');
    expect(updateOpts.headers.Authorization).toBe('Bearer mytoken');

    const body = JSON.parse(updateOpts.body);
    expect(body.action).toBe('update');
    expect(body.url).toBe('https://whitneylee.com/2025/01/01/post.html');
    expect(body.replace.content[0]).toContain('<img src="first.jpg">');
    expect(body.replace.content[0]).not.toContain('second.jpg');
  });

  test('returns false and makes no update call when content has only one img tag', async () => {
    global.fetch.mockResolvedValueOnce(makeSourceResponse('Text\n\n<img src="only.jpg">'));

    const result = await deduplicatePostImages('https://whitneylee.com/post.html', 'tok');

    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns false and makes no update call when content has no img tags', async () => {
    global.fetch.mockResolvedValueOnce(makeSourceResponse('Just text, no images'));

    const result = await deduplicatePostImages('https://whitneylee.com/post.html', 'tok');

    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns false and makes no update call when content is null', async () => {
    global.fetch.mockResolvedValueOnce(makeSourceResponse(null));

    const result = await deduplicatePostImages('https://whitneylee.com/post.html', 'tok');

    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('resolves successfully on 202 update response', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse('<img src="a.jpg"><img src="b.jpg">'))
      .mockResolvedValueOnce({ status: 202 });

    await expect(deduplicatePostImages('https://whitneylee.com/post.html', 'tok')).resolves.toBe(true);
  });

  test('throws when source fetch returns non-ok status', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(
      deduplicatePostImages('https://whitneylee.com/post.html', 'tok')
    ).rejects.toThrow('Failed to query post source (401)');
  });

  test('throws when Micropub update returns non-200/202 status', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse('<img src="a.jpg"><img src="b.jpg">'))
      .mockResolvedValueOnce({
        status: 500,
        text: async () => 'Internal Server Error',
      });

    await expect(
      deduplicatePostImages('https://whitneylee.com/post.html', 'tok')
    ).rejects.toThrow('Micropub update failed (500)');
  });
});

describe('deduplicatePostImagesBatch dry-run mode', () => {
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
                    ['Talk Title', 'Presentations', '⚡️ Enlightning', '1/15/2026', '', '', 'https://youtu.be/abc123', 'https://whitneylee.com/2026/01/15/post.html'],
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
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: 'service_account',
      project_id: 'test',
      private_key: 'k',
      client_email: 'e@e.com',
    });
    global.fetch = jest.fn();

    const { deduplicatePostImagesBatch } = require('../src/deduplicate-post-images');
    await deduplicatePostImagesBatch();

    const postCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});
