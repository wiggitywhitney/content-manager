// ABOUTME: Unit tests for remove-tanzu-tuesday-images.js — covers removePhotoFromPost, isTanzuTuesdayPost, and dry-run mode.
'use strict';

const { removePhotoFromPost, isTanzuTuesdayPost } = require('../src/remove-tanzu-tuesday-images');

describe('removePhotoFromPost', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends correct Micropub delete JSON body', async () => {
    global.fetch.mockResolvedValue({ status: 200 });

    await removePhotoFromPost('https://whitneylee.com/2025/01/01/post.html', 'mytoken');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://micro.blog/micropub');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers.Authorization).toBe('Bearer mytoken');

    const body = JSON.parse(options.body);
    expect(body.action).toBe('update');
    expect(body.url).toBe('https://whitneylee.com/2025/01/01/post.html');
    // Micropub spec: delete as array of property names removes all values of those properties
    expect(body.delete).toEqual(['photo']);
  });

  test('resolves successfully on 200 response', async () => {
    global.fetch.mockResolvedValue({ status: 200 });
    await expect(removePhotoFromPost('https://whitneylee.com/post.html', 'tok')).resolves.toBeUndefined();
  });

  test('resolves successfully on 202 response', async () => {
    global.fetch.mockResolvedValue({ status: 202 });
    await expect(removePhotoFromPost('https://whitneylee.com/post.html', 'tok')).resolves.toBeUndefined();
  });

  test('throws on non-200/202 response', async () => {
    global.fetch.mockResolvedValue({
      status: 400,
      text: async () => 'Bad request',
    });
    await expect(
      removePhotoFromPost('https://whitneylee.com/post.html', 'tok')
    ).rejects.toThrow('Micropub delete failed (400)');
  });

  test('throws with status code in error message', async () => {
    global.fetch.mockResolvedValue({
      status: 500,
      text: async () => 'Internal server error',
    });
    await expect(
      removePhotoFromPost('https://whitneylee.com/post.html', 'tok')
    ).rejects.toThrow('Micropub delete failed (500)');
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
