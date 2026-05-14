// ABOUTME: Unit tests for backfill-career-images.js — covers postHasPhoto, addPhotoToPost, and skip logic.
'use strict';

const { postHasPhoto, addPhotoToPost } = require('../src/backfill-career-images');

describe('postHasPhoto', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns true when Micropub source response has non-empty photo array', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ properties: { photo: ['https://cdn.micro.blog/uploads/thumb.jpg'] } }),
    });

    const result = await postHasPhoto('https://whitneylee.com/2025/01/01/post.html', 'tok');
    expect(result).toBe(true);
  });

  test('returns false when Micropub source response has empty photo array', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ properties: { photo: [] } }),
    });

    const result = await postHasPhoto('https://whitneylee.com/2025/01/01/post.html', 'tok');
    expect(result).toBe(false);
  });

  test('returns false when Micropub source response has no photo property', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ properties: { content: ['some text'] } }),
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
      json: async () => ({ properties: {} }),
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
