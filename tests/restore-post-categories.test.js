// ABOUTME: Unit tests for restore-post-categories.js — covers postHasCategory, categoryForRow, restorePostCategory.
'use strict';

const { postHasCategory, categoryForRow, restorePostCategory } = require('../src/restore-post-categories');

describe('categoryForRow', () => {
  test.each([
    ['Video', 'Video'],
    ['Podcast', 'Podcast'],
    ['Presentations', 'Presentations'],
    ['Presentation', 'Presentations'],  // singular typo maps to plural
    ['Guest', 'Guest'],
    ['Blog', 'Blog'],
  ])('maps type %s to category %s', (type, expected) => {
    expect(categoryForRow({ type })).toBe(expected);
  });

  test.each([
    ['Teaching Assistant'],
    ['Credential'],
    ['Coding Project'],
    ['Pizza'],
    [''],
    [undefined],
  ])('returns null for type %s (no micro.blog category)', (type) => {
    expect(categoryForRow({ type })).toBeNull();
  });
});

describe('postHasCategory', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns true when category array is non-empty', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'h-entry',
        properties: {
          content: ['Post text'],
          category: ['Video'],
        },
      }),
    });

    const result = await postHasCategory('https://whitneylee.com/post.html', 'tok');
    expect(result).toBe(true);
  });

  test('returns false when category array is empty', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'h-entry',
        properties: {
          content: ['Post text'],
          category: [],
        },
      }),
    });

    const result = await postHasCategory('https://whitneylee.com/post.html', 'tok');
    expect(result).toBe(false);
  });

  test('returns false when category property is absent', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'h-entry',
        properties: { content: ['Post text'] },
      }),
    });

    const result = await postHasCategory('https://whitneylee.com/post.html', 'tok');
    expect(result).toBe(false);
  });

  test('returns false when properties is absent', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'h-entry' }),
    });

    const result = await postHasCategory('https://whitneylee.com/post.html', 'tok');
    expect(result).toBe(false);
  });

  test('throws when fetch returns non-ok status', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await expect(
      postHasCategory('https://whitneylee.com/post.html', 'tok')
    ).rejects.toThrow('404');
  });

  test('sends Authorization header and q=source param', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ properties: { category: ['Video'] } }),
    });

    await postHasCategory('https://whitneylee.com/post.html', 'mytoken');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('q=source');
    expect(url).toContain(encodeURIComponent('https://whitneylee.com/post.html'));
    expect(opts.headers.Authorization).toBe('Bearer mytoken');
  });
});

describe('restorePostCategory', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends Micropub replace with correct category', async () => {
    global.fetch.mockResolvedValue({ status: 200 });

    await restorePostCategory('https://whitneylee.com/post.html', 'Video', 'tok');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://micro.blog/micropub');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers.Authorization).toBe('Bearer tok');

    const body = JSON.parse(opts.body);
    expect(body.action).toBe('update');
    expect(body.url).toBe('https://whitneylee.com/post.html');
    expect(body.replace.category).toEqual(['Video']);
  });

  test('resolves on 202 response', async () => {
    global.fetch.mockResolvedValue({ status: 202 });

    await expect(
      restorePostCategory('https://whitneylee.com/post.html', 'Podcast', 'tok')
    ).resolves.toBeUndefined();
  });

  test('throws when Micropub update fails', async () => {
    global.fetch.mockResolvedValue({
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(
      restorePostCategory('https://whitneylee.com/post.html', 'Video', 'tok')
    ).rejects.toThrow('500');
  });
});
