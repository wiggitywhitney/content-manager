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

  test('handles youtu.be URL with trailing slash', () => {
    expect(extractVideoId('https://youtu.be/abc123/')).toBe('abc123');
  });

  test('ignores extra path segments in youtu.be URL', () => {
    expect(extractVideoId('https://youtu.be/abc123/extra')).toBe('abc123');
  });

  test('extracts ID from youtube.com/live URL', () => {
    expect(extractVideoId('https://www.youtube.com/live/Q4SE6yiujpk')).toBe('Q4SE6yiujpk');
  });

  test('extracts ID from youtube.com/live URL with timestamp param', () => {
    expect(extractVideoId('https://www.youtube.com/live/iwKzn3hMoi0?t=481s')).toBe('iwKzn3hMoi0');
  });

  test('throws when youtube.com has no v param and is not a live URL', () => {
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
    await expect(fetchThumbnail('not-a-url')).rejects.toThrow('Invalid URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchThumbnail — direct image URLs', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('returns buffer from a direct image URL', async () => {
    const FAKE_IMAGE_BYTES = Buffer.from('fake-jpeg-data');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(FAKE_IMAGE_BYTES.buffer),
    });

    const result = await fetchThumbnail('https://i.ytimg.com/vi/RNaa_48LWBY/maxresdefault.jpg');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://i.ytimg.com/vi/RNaa_48LWBY/maxresdefault.jpg');
  });

  test('throws when direct image URL returns non-200', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(
      fetchThumbnail('https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.png')
    ).rejects.toThrow('Failed to fetch image (403)');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

const FAKE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <item>
      <title>Episode 123: Some Title</title>
      <link>https://www.softwaredefinedinterviews.com/123</link>
      <itunes:image href="https://cdn.fireside.fm/artwork/episode123.jpg"/>
    </item>
    <item>
      <title>Episode 99: Another Episode</title>
      <link>https://www.softwaredefinedinterviews.com/99</link>
      <itunes:image href="https://cdn.fireside.fm/artwork/episode99.jpg"/>
    </item>
  </channel>
</rss>`;

describe('fetchThumbnail — SDI episodes', () => {
  let consoleSpy;

  beforeEach(() => {
    global.fetch = jest.fn();
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.fetch;
    consoleSpy.mockRestore();
  });

  test('fetches RSS feed and returns image buffer for matching SDI episode', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(FAKE_RSS) })         // RSS feed
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(FAKE_IMAGE_BYTES.buffer) }); // image

    const result = await fetchThumbnail('https://www.softwaredefinedinterviews.com/123');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://feeds.fireside.fm/softwaredefinedinterviews/rss');
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://cdn.fireside.fm/artwork/episode123.jpg');
  });

  test('matches episode by URL with or without trailing slash', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(FAKE_RSS) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(FAKE_IMAGE_BYTES.buffer) });

    const result = await fetchThumbnail('https://www.softwaredefinedinterviews.com/123/');

    expect(Buffer.isBuffer(result)).toBe(true);
  });

  test('returns null and logs warning when episode is not found in RSS feed', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(FAKE_RSS) });

    const result = await fetchThumbnail('https://www.softwaredefinedinterviews.com/999');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns null and logs warning when RSS feed fetch fails with non-ok status', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await fetchThumbnail('https://www.softwaredefinedinterviews.com/123');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('503'));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns null and logs warning when fetch() rejects (network error)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await fetchThumbnail('https://www.softwaredefinedinterviews.com/123');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });
});
