// ABOUTME: Unit tests for post-microblog.js — covers postToMicroblog() for episode and talk post types.

'use strict';

jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({})),
    },
    youtube: jest.fn(),
  },
}));

jest.mock('../src/video-download', () => ({
  downloadShortVideo: jest.fn(),
}));

const { google } = require('googleapis');
const { downloadShortVideo } = require('../src/video-download');
const { postToMicroblog, extractYouTubeVideoId } = require('../src/post-microblog');

const FAKE_THUMBNAIL_BUFFER = Buffer.from('fake-thumbnail');
const FAKE_VIDEO_BUFFER = Buffer.from('fake-video');

function makePost(overrides = {}) {
  return {
    rowIndex: 7,
    title: 'Test Episode',
    postType: 'episode',
    postText: 'Watch this!',
    youtubeUrl: 'https://youtu.be/vid123',
    altText: 'Episode thumbnail',
    platforms: ['micro.blog'],
    groupId: null,
    ...overrides,
  };
}

describe('extractYouTubeVideoId', () => {
  test('extracts ID from youtu.be short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/abc123')).toBe('abc123');
  });

  test('extracts ID from youtube.com watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=XYZ789')).toBe('XYZ789');
  });

  test('extracts ID from youtube.com shorts URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/SHORT1')).toBe('SHORT1');
  });

  test('returns null for unrecognized URL', () => {
    expect(extractYouTubeVideoId('https://example.com/video')).toBeNull();
  });
});

describe('postToMicroblog', () => {
  let originalEnv;
  let fetchSpy;

  beforeEach(() => {
    originalEnv = process.env.MICROBLOG_APP_TOKEN;
    process.env.MICROBLOG_APP_TOKEN = 'test-token';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });

    // Mock fetch for thumbnail fetch and Micropub calls
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url.includes('img.youtube.com')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(FAKE_THUMBNAIL_BUFFER.buffer),
        });
      }
      if (url.includes('micropub/media')) {
        return Promise.resolve({
          status: 201,
          json: () => Promise.resolve({ url: 'https://micro.blog/uploads/thumbnail.jpg' }),
        });
      }
      if (url.includes('micropub')) {
        return Promise.resolve({
          status: 201,
          headers: { get: () => 'https://micro.blog/wiggitywhitney/2026/test-post' },
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    // Mock YouTube API (view count not needed — bypassViewCount: true used in dispatch)
    google.youtube.mockReturnValue({
      videos: { list: jest.fn().mockResolvedValue({ data: { items: [{ statistics: { viewCount: '5000' } }] } }) },
    });

    downloadShortVideo.mockReturnValue({ buffer: FAKE_VIDEO_BUFFER, mimeType: 'video/mp4', filename: 'video.mp4' });
  });

  afterEach(() => {
    process.env.MICROBLOG_APP_TOKEN = originalEnv;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.restoreAllMocks();
  });

  describe('talk post type', () => {
    test('fetches thumbnail from YouTube URL (not video download) for talk posts', async () => {
      await postToMicroblog(makePost({ postType: 'talk', groupId: 'talk-otel-basics' }), { bypassViewCount: true });
      expect(downloadShortVideo).not.toHaveBeenCalled();
      const thumbnailFetchCall = fetchSpy.mock.calls.find(([url]) => url.includes('img.youtube.com'));
      expect(thumbnailFetchCall).toBeDefined();
      expect(thumbnailFetchCall[0]).toContain('vid123');
    });

    test('uploads thumbnail to media endpoint for talk posts', async () => {
      await postToMicroblog(makePost({ postType: 'talk', groupId: 'talk-otel-basics' }), { bypassViewCount: true });
      const mediaUpload = fetchSpy.mock.calls.find(([url]) => url.includes('micropub/media'));
      expect(mediaUpload).toBeDefined();
    });

    test('creates Micropub post with photo for talk posts', async () => {
      await postToMicroblog(makePost({ postType: 'talk', groupId: 'talk-otel-basics' }), { bypassViewCount: true });
      const micropubCall = fetchSpy.mock.calls.find(([url]) => url === 'https://micro.blog/micropub');
      expect(micropubCall).toBeDefined();
      const body = micropubCall[1].body;
      expect(body).toContain('photo%5B%5D=');
    });

    test('returns postUrl from Location header for talk posts', async () => {
      const result = await postToMicroblog(makePost({ postType: 'talk', groupId: 'talk-otel-basics' }), { bypassViewCount: true });
      expect(result.postUrl).toBe('https://micro.blog/wiggitywhitney/2026/test-post');
    });
  });

  describe('episode post type (baseline)', () => {
    test('fetches thumbnail from YouTube URL for episode posts', async () => {
      await postToMicroblog(makePost({ postType: 'episode' }), { bypassViewCount: true });
      expect(downloadShortVideo).not.toHaveBeenCalled();
      const thumbnailFetchCall = fetchSpy.mock.calls.find(([url]) => url.includes('img.youtube.com'));
      expect(thumbnailFetchCall).toBeDefined();
    });

    test('returns postUrl from Location header for episode posts', async () => {
      const result = await postToMicroblog(makePost({ postType: 'episode' }), { bypassViewCount: true });
      expect(result.postUrl).toBe('https://micro.blog/wiggitywhitney/2026/test-post');
    });
  });

  describe('error cases', () => {
    test('throws if MICROBLOG_APP_TOKEN is missing', async () => {
      delete process.env.MICROBLOG_APP_TOKEN;
      await expect(postToMicroblog(makePost({ postType: 'talk' }), { bypassViewCount: true }))
        .rejects.toThrow('MICROBLOG_APP_TOKEN environment variable is required');
    });

    test('throws if YouTube URL is unrecognized', async () => {
      await expect(postToMicroblog(makePost({ postType: 'talk', youtubeUrl: 'https://example.com/video' }), { bypassViewCount: true }))
        .rejects.toThrow('Could not extract video ID from');
    });
  });
});
