// ABOUTME: Unit tests for fetch-thumbnail.js — fetchThumbnail and extractVideoId.

'use strict';

const { fetchThumbnail, extractVideoId } = require('../src/fetch-thumbnail');

const FAKE_IMAGE_BYTES = Buffer.from('fake-jpeg-data');

describe('extractVideoId', () => {
  test('extracts ID from youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/abc123')).toBe('abc123');
  });

  test('extracts ID from youtube.com watch URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=XYZ789')).toBe('XYZ789');
  });

  test('extracts ID from youtube.com without www', () => {
    expect(extractVideoId('https://youtube.com/watch?v=DEFGH')).toBe('DEFGH');
  });

  test('throws on malformed URL', () => {
    expect(() => extractVideoId('not-a-url')).toThrow('Invalid YouTube URL');
  });

  test('throws when youtu.be has no path segment', () => {
    expect(() => extractVideoId('https://youtu.be/')).toThrow('No video ID in YouTube URL');
  });

  test('throws when youtube.com has no v param', () => {
    expect(() => extractVideoId('https://www.youtube.com/watch')).toThrow('No video ID in YouTube URL');
  });

  test('throws for unrecognized YouTube domain', () => {
    expect(() => extractVideoId('https://vimeo.com/12345')).toThrow('Unrecognized YouTube URL format');
  });
});

describe('fetchThumbnail', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('returns buffer from maxresdefault on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(FAKE_IMAGE_BYTES.buffer),
    });

    const result = await fetchThumbnail('https://youtu.be/abc123');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://i.ytimg.com/vi/abc123/maxresdefault.jpg');
  });

  test('falls back to hqdefault when maxresdefault returns 404', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(FAKE_IMAGE_BYTES.buffer),
      });

    const result = await fetchThumbnail('https://youtu.be/abc123');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg');
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://i.ytimg.com/vi/abc123/hqdefault.jpg');
  });

  test('throws when maxresdefault fails with non-404 status', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchThumbnail('https://youtu.be/abc123')).rejects.toThrow('Failed to fetch thumbnail (500)');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('throws when both maxresdefault and hqdefault fail', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchThumbnail('https://youtu.be/abc123')).rejects.toThrow('Failed to fetch thumbnail (404)');
  });

  test('throws on malformed URL', async () => {
    await expect(fetchThumbnail('not-a-url')).rejects.toThrow('Invalid YouTube URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
