// ABOUTME: Unit tests for remove-tanzu-tuesday-images.js — covers removePhotoFromPost, isTanzuTuesdayPost, and dry-run mode.
'use strict';

const { removePhotoFromPost, isTanzuTuesdayPost } = require('../src/remove-tanzu-tuesday-images');

describe('removePhotoFromPost', () => {
  // micro.blog stores photos as <img> tags in content, not as a 'photo' property.
  // delete: ["photo"] returns 500 because the property doesn't exist in micro.blog's store.
  // The real approach: fetch source content, strip <img> tags, replace content via Micropub.
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

  test('fetches source then strips img tag and replaces content', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse('Post text\n\n<img src="https://cdn.micro.blog/thumb.jpg">'))
      .mockResolvedValueOnce({ status: 200 });

    await removePhotoFromPost('https://whitneylee.com/2025/01/01/post.html', 'mytoken');

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
    expect(body.replace.content).toEqual(['Post text']);
  });

  test('strips img tag and trims trailing whitespace/newlines', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse('My Talk\n\n<img src="https://cdn.micro.blog/thumb.jpg">'))
      .mockResolvedValueOnce({ status: 200 });

    await removePhotoFromPost('https://whitneylee.com/post.html', 'tok');

    const body = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(body.replace.content[0]).toBe('My Talk');
  });

  test('strips multiple img tags if present', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse('Text <img src="a.jpg"> more <img src="b.jpg">'))
      .mockResolvedValueOnce({ status: 200 });

    await removePhotoFromPost('https://whitneylee.com/post.html', 'tok');

    const body = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(body.replace.content[0]).toBe('Text  more');
  });

  test('resolves successfully on 202 update response', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse('Text\n\n<img src="a.jpg">'))
      .mockResolvedValueOnce({ status: 202 });

    await expect(removePhotoFromPost('https://whitneylee.com/post.html', 'tok')).resolves.toBeUndefined();
  });

  test('throws when source fetch returns non-ok status', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(
      removePhotoFromPost('https://whitneylee.com/post.html', 'tok')
    ).rejects.toThrow('Failed to query post source (401)');
  });

  test('throws when update POST returns non-200/202 status', async () => {
    global.fetch
      .mockResolvedValueOnce(makeSourceResponse('Text\n\n<img src="a.jpg">'))
      .mockResolvedValueOnce({
        status: 400,
        text: async () => 'Bad request',
      });

    await expect(
      removePhotoFromPost('https://whitneylee.com/post.html', 'tok')
    ).rejects.toThrow('Micropub update failed (400)');
  });
});

describe('isTanzuTuesdayPost', () => {
  test('returns true for exact Tanzu Tuesday show match', () => {
    expect(isTanzuTuesdayPost({ show: 'Tanzu Tuesday' })).toBe(true);
  });

  test('returns true when show contains Tanzu Tuesday with extra text', () => {
    expect(isTanzuTuesdayPost({ show: 'Tanzu Tuesday Live' })).toBe(true);
  });

  test('returns false for other show names', () => {
    expect(isTanzuTuesdayPost({ show: '🌩️ Thunder' })).toBe(false);
    expect(isTanzuTuesdayPost({ show: 'Software Defined Interviews' })).toBe(false);
    expect(isTanzuTuesdayPost({ show: '⚡️ Enlightning' })).toBe(false);
  });

  test('returns false for empty show', () => {
    expect(isTanzuTuesdayPost({ show: '' })).toBe(false);
  });

  test('returns false when show is null', () => {
    expect(isTanzuTuesdayPost({ show: null })).toBe(false);
  });

  test('returns false when show is undefined', () => {
    expect(isTanzuTuesdayPost({ show: undefined })).toBe(false);
  });

  test('returns false when show field is missing', () => {
    expect(isTanzuTuesdayPost({})).toBe(false);
  });
});

describe('removeTanzuTuesdayImages dry-run mode', () => {
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
                    ['Tanzu Tuesday Ep 1', 'Video', 'Tanzu Tuesday', '1/15/2026', '', '', 'https://youtu.be/abc123', 'https://whitneylee.com/2026/01/15/tanzu-ep1.html'],
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

    const { removeTanzuTuesdayImages } = require('../src/remove-tanzu-tuesday-images');
    await removeTanzuTuesdayImages();

    const postCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});
