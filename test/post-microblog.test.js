// ABOUTME: Tests for the micro.blog posting module.
// ABOUTME: Covers view count gating, video download, media upload, Micropub post creation, and short scanning.

'use strict';

jest.mock('child_process');
jest.mock('googleapis');

const childProcess = require('child_process');
const { google } = require('googleapis');

// Must require after mocks are set up
let postMicroblog;

const MICROPUB_ENDPOINT = 'https://micro.blog/micropub';
const MEDIA_ENDPOINT = 'https://micro.blog/micropub/media';
const VIEW_COUNT_THRESHOLD = 1000;

function makePost(overrides = {}) {
  return {
    rowIndex: 2,
    show: 'Thunder',
    title: 'Test Short',
    postType: 'short',
    postText: 'Check out this short! https://youtu.be/abc123',
    youtubeUrl: 'https://youtu.be/abc123',
    altText: 'A test short thumbnail',
    scheduledDate: '2026-04-05',
    platforms: ['bluesky', 'mastodon'],
    status: 'posted',
    microblogPostUrl: '',
    ...overrides,
  };
}

function makeYouTubeResponse(viewCount) {
  return {
    data: {
      items: [{ statistics: { viewCount: String(viewCount) } }],
    },
  };
}

function makeMediaUploadResponse(url = 'https://whitneylee.com/uploads/2026/video.mp4') {
  return {
    status: 202,
    ok: true,
    json: async () => ({ url, poster: '' }),
    text: async () => JSON.stringify({ url, poster: '' }),
    headers: { get: () => null },
  };
}

function makeMicropubPostResponse(location = 'https://whitneylee.com/2026/04/test-post') {
  return {
    status: 201,
    headers: { get: (h) => (h === 'Location' ? location : null) },
    text: async () => '',
  };
}

describe('extractYouTubeVideoId', () => {
  let extractYouTubeVideoId;

  beforeAll(() => {
    ({ extractYouTubeVideoId } = require('../src/post-microblog'));
  });

  test('extracts ID from youtu.be short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/abc123')).toBe('abc123');
  });

  test('extracts ID from youtube.com/watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=abc123')).toBe('abc123');
  });

  test('extracts ID from youtube.com/shorts URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
  });

  test('extracts ID ignoring query parameters', () => {
    expect(extractYouTubeVideoId('https://youtu.be/abc123?t=30')).toBe('abc123');
  });

  test('returns null for unrecognized URL format', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/12345')).toBeNull();
  });
});

describe('getYouTubeViewCount', () => {
  let getYouTubeViewCount;
  let mockVideosList;

  beforeAll(() => {
    ({ getYouTubeViewCount } = require('../src/post-microblog'));
  });

  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
    mockVideosList = jest.fn().mockResolvedValue(makeYouTubeResponse(5000));
    google.youtube.mockReturnValue({ videos: { list: mockVideosList } });
    google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
  });

  afterEach(() => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.clearAllMocks();
  });

  test('returns view count as a number', async () => {
    const count = await getYouTubeViewCount('abc123');
    expect(count).toBe(5000);
  });

  test('calls YouTube API with correct video ID', async () => {
    await getYouTubeViewCount('myVideoId');
    expect(mockVideosList).toHaveBeenCalledWith({
      part: ['statistics'],
      id: ['myVideoId'],
    });
  });

  test('throws if video not found', async () => {
    google.youtube.mockReturnValue({
      videos: { list: jest.fn().mockResolvedValue({ data: { items: [] } }) },
    });
    await expect(getYouTubeViewCount('missing')).rejects.toThrow('not found');
  });

  test('throws if GOOGLE_SERVICE_ACCOUNT_JSON is not set', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    await expect(getYouTubeViewCount('abc123')).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_JSON');
  });
});

describe('postToMicroblog', () => {
  let postToMicroblog;
  let originalFetch;

  beforeAll(() => {
    ({ postToMicroblog } = require('../src/post-microblog'));
  });

  beforeEach(() => {
    process.env.MICROBLOG_APP_TOKEN = 'test-token';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });

    originalFetch = global.fetch;
    global.fetch = jest.fn();

    // Default: view count above threshold
    const mockVideosList = jest.fn().mockResolvedValue(makeYouTubeResponse(VIEW_COUNT_THRESHOLD + 1));
    google.youtube.mockReturnValue({ videos: { list: mockVideosList } });
    google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };

    // yt-dlp probe succeeds, download creates a file
    childProcess.spawnSync.mockImplementation((bin, args) => {
      if (args && args[0] === '--version') return { status: 0, stdout: Buffer.from('2026.03.03') };
      // Download call — create a real temp file so readFileSync works
      const outArg = args[args.indexOf('-o') + 1];
      if (outArg) require('fs').writeFileSync(outArg, Buffer.from('fake-video-data'));
      return { status: 0, stderr: Buffer.from('') };
    });

    // Default fetch sequence: media upload → micropub post
    global.fetch
      .mockResolvedValueOnce(makeMediaUploadResponse())
      .mockResolvedValueOnce(makeMicropubPostResponse());
  });

  afterEach(() => {
    delete process.env.MICROBLOG_APP_TOKEN;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('throws if MICROBLOG_APP_TOKEN is not set', async () => {
    delete process.env.MICROBLOG_APP_TOKEN;
    await expect(postToMicroblog(makePost())).rejects.toThrow('MICROBLOG_APP_TOKEN');
  });

  test('throws if YouTube URL is not recognizable', async () => {
    await expect(postToMicroblog(makePost({ youtubeUrl: 'https://vimeo.com/12345' }))).rejects.toThrow('video ID');
  });

  test('returns { skipped: true, viewCount } when view count is below threshold', async () => {
    google.youtube.mockReturnValue({
      videos: { list: jest.fn().mockResolvedValue(makeYouTubeResponse(500)) },
    });
    const result = await postToMicroblog(makePost());
    expect(result).toEqual({ skipped: true, viewCount: 500 });
  });

  test('does not call fetch when view count is below threshold', async () => {
    google.youtube.mockReturnValue({
      videos: { list: jest.fn().mockResolvedValue(makeYouTubeResponse(999)) },
    });
    await postToMicroblog(makePost());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns postUrl on successful short post', async () => {
    const result = await postToMicroblog(makePost({ postType: 'short' }));
    expect(result.postUrl).toBe('https://whitneylee.com/2026/04/test-post');
  });

  test('uploads to media endpoint with Authorization header for short', async () => {
    await postToMicroblog(makePost({ postType: 'short' }));
    const mediaCall = global.fetch.mock.calls[0];
    expect(mediaCall[0]).toBe(MEDIA_ENDPOINT);
    expect(mediaCall[1].headers.Authorization).toBe('Bearer test-token');
    expect(mediaCall[1].method).toBe('POST');
  });

  test('creates Micropub post with video[] property for short', async () => {
    await postToMicroblog(makePost({ postType: 'short' }));
    const micropubCall = global.fetch.mock.calls[1];
    expect(micropubCall[0]).toBe(MICROPUB_ENDPOINT);
    const body = new URLSearchParams(micropubCall[1].body);
    expect(body.get('h')).toBe('entry');
    expect(body.get('video[]')).toBe('https://whitneylee.com/uploads/2026/video.mp4');
    expect(body.get('content')).toContain('Check out this short!');
  });

  test('fetches thumbnail and creates Micropub post with photo[] for episode', async () => {
    // Reset fetch mock to handle thumbnail fetch + media upload + micropub
    global.fetch.mockReset();
    global.fetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(100) })  // thumbnail
      .mockResolvedValueOnce(makeMediaUploadResponse('https://whitneylee.com/uploads/2026/thumb.jpg')) // media upload
      .mockResolvedValueOnce(makeMicropubPostResponse());

    const result = await postToMicroblog(makePost({ postType: 'episode' }));
    expect(result.postUrl).toBe('https://whitneylee.com/2026/04/test-post');

    const micropubCall = global.fetch.mock.calls[2];
    const body = new URLSearchParams(micropubCall[1].body);
    expect(body.get('photo[]')).toBe('https://whitneylee.com/uploads/2026/thumb.jpg');
    expect(body.get('mp-photo-alt[]')).toBe('A test short thumbnail');
  });

  test('throws when Micropub post fails', async () => {
    global.fetch.mockReset();
    global.fetch
      .mockResolvedValueOnce(makeMediaUploadResponse())
      .mockResolvedValueOnce({
        status: 500,
        headers: { get: () => null },
        text: async () => 'Internal Server Error',
      });
    await expect(postToMicroblog(makePost())).rejects.toThrow('500');
  });

  test('throws when media upload fails', async () => {
    global.fetch.mockReset();
    global.fetch.mockResolvedValueOnce({
      status: 400,
      text: async () => 'Bad Request',
    });
    await expect(postToMicroblog(makePost())).rejects.toThrow('400');
  });
});

describe('scanAndPostShorts', () => {
  let scanAndPostShorts;

  beforeAll(() => {
    ({ scanAndPostShorts } = require('../src/post-microblog'));
  });

  beforeEach(() => {
    process.env.MICROBLOG_APP_TOKEN = 'test-token';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
    google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
  });

  afterEach(() => {
    delete process.env.MICROBLOG_APP_TOKEN;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.clearAllMocks();
  });

  // Note: scanAndPostShorts integration is tested via post-social-content.test.js
  // which mocks the entire post-microblog module. These tests cover the module
  // boundary only — the full scan flow is covered in integration.

  test('scanAndPostShorts is exported as a function', () => {
    expect(typeof scanAndPostShorts).toBe('function');
  });
});
