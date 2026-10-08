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

jest.mock('../src/drive-download', () => ({
  downloadFromDrive: jest.fn(),
}));

jest.mock('../src/social-posts-queue', () => ({
  fetchRecentShortRows: jest.fn(),
}));

jest.mock('../src/update-social-post-status', () => ({
  updateMicroblogPostUrl: jest.fn(),
}));

const { google } = require('googleapis');
const { downloadShortVideo } = require('../src/video-download');
const { downloadFromDrive } = require('../src/drive-download');
const { fetchRecentShortRows } = require('../src/social-posts-queue');
const { updateMicroblogPostUrl } = require('../src/update-social-post-status');
const { postToMicroblog, extractYouTubeVideoId, getYouTubeViewCount, scanAndPostShorts } = require('../src/post-microblog');

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

  test('extracts ID ignoring query parameters', () => {
    expect(extractYouTubeVideoId('https://youtu.be/abc123?t=30')).toBe('abc123');
  });

  test('returns null for unrecognized URL', () => {
    expect(extractYouTubeVideoId('https://example.com/video')).toBeNull();
  });
});

describe('getYouTubeViewCount', () => {
  let mockVideosList;

  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
    mockVideosList = jest.fn().mockResolvedValue({ data: { items: [{ statistics: { viewCount: '5000' } }] } });
    google.youtube.mockReturnValue({ videos: { list: mockVideosList } });
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
    expect(mockVideosList).toHaveBeenCalledWith({ part: ['statistics'], id: ['myVideoId'] });
  });

  test('throws if video not found', async () => {
    google.youtube.mockReturnValue({ videos: { list: jest.fn().mockResolvedValue({ data: { items: [] } }) } });
    await expect(getYouTubeViewCount('missing')).rejects.toThrow('not found');
  });

  test('throws if GOOGLE_SERVICE_ACCOUNT_JSON is not set', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    await expect(getYouTubeViewCount('abc123')).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_JSON');
  });
});

describe('postToMicroblog', () => {
  let originalMicroblogToken;
  let originalGoogleServiceAccountJson;
  let fetchSpy;

  beforeEach(() => {
    originalMicroblogToken = process.env.MICROBLOG_APP_TOKEN;
    originalGoogleServiceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
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
    process.env.MICROBLOG_APP_TOKEN = originalMicroblogToken;
    if (originalGoogleServiceAccountJson === undefined) {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    } else {
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalGoogleServiceAccountJson;
    }
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

  describe('gist post type with imageBuffer', () => {
    const BOARD_JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG magic bytes

    test('uses provided imageBuffer directly without fetching from YouTube', async () => {
      await postToMicroblog(
        makePost({ postType: 'gist', youtubeUrl: 'https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.jpg' }),
        { bypassViewCount: true, imageBuffer: BOARD_JPEG_BUFFER }
      );
      const ytFetch = fetchSpy.mock.calls.find(([url]) => url.includes('img.youtube.com'));
      expect(ytFetch).toBeUndefined();
    });

    test('uploads provided imageBuffer to media endpoint', async () => {
      await postToMicroblog(
        makePost({ postType: 'gist', youtubeUrl: 'https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.jpg' }),
        { bypassViewCount: true, imageBuffer: BOARD_JPEG_BUFFER }
      );
      const mediaUpload = fetchSpy.mock.calls.find(([url]) => url.includes('micropub/media'));
      expect(mediaUpload).toBeDefined();
    });

    test('returns postUrl when imageBuffer is provided with a non-YouTube URL', async () => {
      const result = await postToMicroblog(
        makePost({ postType: 'gist', youtubeUrl: 'https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.jpg' }),
        { bypassViewCount: true, imageBuffer: BOARD_JPEG_BUFFER }
      );
      expect(result.postUrl).toBe('https://micro.blog/wiggitywhitney/2026/test-post');
    });
  });

  describe('error cases', () => {
    test('throws if MICROBLOG_APP_TOKEN is missing', async () => {
      delete process.env.MICROBLOG_APP_TOKEN;
      await expect(postToMicroblog(makePost({ postType: 'talk' }), { bypassViewCount: true }))
        .rejects.toThrow('MICROBLOG_APP_TOKEN environment variable is required');
    });

    test('throws if YouTube URL is not recognizable and no imageBuffer provided', async () => {
      await expect(postToMicroblog(makePost({ postType: 'talk', youtubeUrl: 'https://example.com/video' }), { bypassViewCount: true }))
        .rejects.toThrow('Could not extract video ID from');
    });

    test('does not throw when URL is not YouTube if imageBuffer is provided', async () => {
      const boardBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await expect(
        postToMicroblog(
          makePost({ postType: 'gist', youtubeUrl: 'https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.jpg' }),
          { bypassViewCount: true, imageBuffer: boardBuffer }
        )
      ).resolves.toMatchObject({ postUrl: expect.any(String) });
    });

    test('throws when imageBuffer is provided with bypassViewCount false — videoId would be null', async () => {
      const boardBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await expect(
        postToMicroblog(
          makePost({ postType: 'gist', youtubeUrl: 'https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.jpg' }),
          { bypassViewCount: false, imageBuffer: boardBuffer }
        )
      ).rejects.toThrow('imageBuffer requires bypassViewCount: true');
    });

    test('skips view count check and posts text-only when videoId is null for a gist post (bypassViewCount: false)', async () => {
      const mockVideosList = google.youtube().videos.list;
      const result = await postToMicroblog(
        makePost({ postType: 'gist', youtubeUrl: 'https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.png' }),
        { bypassViewCount: false }
      );
      expect(result).toMatchObject({ postUrl: expect.any(String) });
      expect(mockVideosList).not.toHaveBeenCalled();
    });

    test('posts text-only for a gist post when imageBuffer is null and URL is non-YouTube', async () => {
      const result = await postToMicroblog(
        makePost({ postType: 'gist', youtubeUrl: 'https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.png' }),
        { bypassViewCount: true, imageBuffer: null }
      );
      expect(result).toMatchObject({ postUrl: expect.any(String) });
      // No upload to the media endpoint
      const mediaCalls = fetchSpy.mock.calls.filter(c => c[0].includes('micropub/media'));
      expect(mediaCalls).toHaveLength(0);
      // Micropub post body must not include photo or video
      const micropubCall = fetchSpy.mock.calls.find(c => c[0].includes('micropub') && !c[0].includes('/media'));
      expect(micropubCall[1].body).not.toContain('photo');
      expect(micropubCall[1].body).not.toContain('video');
    });

    test('detectMimeType throws for unrecognized image format', async () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await expect(
        postToMicroblog(
          makePost({ postType: 'gist', youtubeUrl: 'https://raw.githubusercontent.com/wiggitywhitney/board-notes/main/thunder/ep19/board.jpg' }),
          { bypassViewCount: true, imageBuffer: unknownBuffer }
        )
      ).rejects.toThrow('Unrecognized image format');
    });
  });

  describe('suppressCrossPosting option', () => {
    test('includes mp-syndicate-to[] blank value in Micropub request when suppressCrossPosting is true', async () => {
      await postToMicroblog(makePost(), { bypassViewCount: true, suppressCrossPosting: true });
      const micropubCall = fetchSpy.mock.calls.find(([url]) => url === 'https://micro.blog/micropub');
      expect(micropubCall[1].body).toContain('mp-syndicate-to%5B%5D=');
    });

    test('does not include mp-syndicate-to in Micropub request when suppressCrossPosting is false', async () => {
      await postToMicroblog(makePost(), { bypassViewCount: true, suppressCrossPosting: false });
      const micropubCall = fetchSpy.mock.calls.find(([url]) => url === 'https://micro.blog/micropub');
      expect(micropubCall[1].body).not.toContain('mp-syndicate-to');
    });

    test('does not include mp-syndicate-to in Micropub request when suppressCrossPosting is omitted', async () => {
      await postToMicroblog(makePost(), { bypassViewCount: true });
      const micropubCall = fetchSpy.mock.calls.find(([url]) => url === 'https://micro.blog/micropub');
      expect(micropubCall[1].body).not.toContain('mp-syndicate-to');
    });
  });
});

describe('scanAndPostShorts', () => {
  const DRIVE_VIDEO_BUFFER = Buffer.from('drive-video');
  let fetchSpy;
  let viewCounts;
  let originalMicroblogToken;
  let originalGoogleServiceAccountJson;

  function makeShort(overrides = {}) {
    return makePost({
      postType: 'short',
      status: 'posted',
      platforms: ['linkedin', 'bluesky', 'mastodon'],
      youtubeUrl: 'https://youtu.be/short1',
      driveVideoId: 'drive-1',
      microblogPostUrl: '',
      ...overrides,
    });
  }

  function micropubCalls() {
    return fetchSpy.mock.calls.filter(([url]) => url === 'https://micro.blog/micropub');
  }

  beforeEach(() => {
    originalMicroblogToken = process.env.MICROBLOG_APP_TOKEN;
    originalGoogleServiceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.MICROBLOG_APP_TOKEN = 'test-token';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
    viewCounts = {};
    google.youtube.mockReturnValue({
      videos: {
        list: jest.fn().mockImplementation(({ id }) => Promise.resolve({
          data: { items: [{ statistics: { viewCount: String(viewCounts[id] ?? 5000) } }] },
        })),
      },
    });
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url.includes('micropub/media')) {
        return Promise.resolve({ status: 201, json: () => Promise.resolve({ url: 'https://micro.blog/uploads/video.mp4' }) });
      }
      if (url.includes('micropub')) {
        return Promise.resolve({ status: 201, headers: { get: () => 'https://whitneylee.com/2026/10/07/short.html' } });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    downloadFromDrive.mockResolvedValue({ buffer: DRIVE_VIDEO_BUFFER, mimeType: 'video/mp4', filename: 'video.mp4' });
    updateMicroblogPostUrl.mockResolvedValue();
  });

  afterEach(() => {
    process.env.MICROBLOG_APP_TOKEN = originalMicroblogToken;
    if (originalGoogleServiceAccountJson === undefined) {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    } else {
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalGoogleServiceAccountJson;
    }
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('posts a short and its Bluesky variant row to micro.blog once, using the main row', async () => {
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: 'show-topic-s1', platforms: ['linkedin', 'mastodon'], postText: 'Main text' }),
      makeShort({ rowIndex: 11, groupId: 'show-topic-s1', platforms: ['bluesky'], postText: 'Bluesky text' }),
    ]);

    await scanAndPostShorts();

    expect(micropubCalls()).toHaveLength(1);
    expect(micropubCalls()[0][1].body).toContain('Main+text');
  });

  test('records the micro.blog URL and posted date on every row in the group', async () => {
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: 'show-topic-s1', platforms: ['linkedin', 'mastodon'] }),
      makeShort({ rowIndex: 11, groupId: 'show-topic-s1', platforms: ['bluesky'] }),
    ]);

    await scanAndPostShorts();

    expect(updateMicroblogPostUrl.mock.calls).toEqual([
      [10, 'https://whitneylee.com/2026/10/07/short.html'],
      [11, 'https://whitneylee.com/2026/10/07/short.html'],
    ]);
  });

  test('posts at most one short per run, oldest first', async () => {
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: 'show-a-s1', postText: 'First short', youtubeUrl: 'https://youtu.be/a' }),
      makeShort({ rowIndex: 12, groupId: 'show-b-s1', postText: 'Second short', youtubeUrl: 'https://youtu.be/b' }),
    ]);

    await scanAndPostShorts();

    expect(micropubCalls()).toHaveLength(1);
    expect(micropubCalls()[0][1].body).toContain('First+short');
    expect(updateMicroblogPostUrl.mock.calls.map(([row]) => row)).toEqual([10]);
  });

  test('treats ungrouped rows as separate shorts', async () => {
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: null, youtubeUrl: 'https://youtu.be/a' }),
      makeShort({ rowIndex: 11, groupId: null, youtubeUrl: 'https://youtu.be/b' }),
    ]);

    await scanAndPostShorts();

    expect(updateMicroblogPostUrl.mock.calls.map(([row]) => row)).toEqual([10]);
  });

  test('suppresses micro.blog cross-posting, since the short already went to the other platforms directly', async () => {
    fetchRecentShortRows.mockResolvedValue([makeShort({ rowIndex: 10 })]);

    await scanAndPostShorts();

    expect(micropubCalls()[0][1].body).toContain('mp-syndicate-to%5B%5D=');
  });

  test('uploads the Drive copy of the short instead of downloading from YouTube', async () => {
    fetchRecentShortRows.mockResolvedValue([makeShort({ rowIndex: 10, driveVideoId: 'drive-xyz' })]);

    await scanAndPostShorts();

    expect(downloadFromDrive).toHaveBeenCalledWith('drive-xyz');
    expect(downloadShortVideo).not.toHaveBeenCalled();
    const mediaCall = fetchSpy.mock.calls.find(([url]) => url.includes('micropub/media'));
    expect(mediaCall[1].body.get('file').size).toBe(DRIVE_VIDEO_BUFFER.length);
  });

  test('skips a group that already has a micro.blog URL on any row', async () => {
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: 'show-a-s1', platforms: ['linkedin', 'mastodon'] }),
      makeShort({ rowIndex: 11, groupId: 'show-a-s1', platforms: ['bluesky'], microblogPostUrl: 'https://whitneylee.com/old.html' }),
    ]);

    await scanAndPostShorts();

    expect(micropubCalls()).toHaveLength(0);
    expect(updateMicroblogPostUrl).not.toHaveBeenCalled();
  });

  test('skips a short below the view-count threshold and posts the next one', async () => {
    viewCounts = { low: 999 };
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: 'show-a-s1', youtubeUrl: 'https://youtu.be/low' }),
      makeShort({ rowIndex: 12, groupId: 'show-b-s1', youtubeUrl: 'https://youtu.be/high' }),
    ]);

    await scanAndPostShorts();

    expect(downloadFromDrive).toHaveBeenCalledTimes(1);
    expect(updateMicroblogPostUrl.mock.calls.map(([row]) => row)).toEqual([12]);
  });

  test('skips a short with no Drive video ID and posts the next one', async () => {
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: 'show-a-s1', driveVideoId: null }),
      makeShort({ rowIndex: 12, groupId: 'show-b-s1' }),
    ]);

    await scanAndPostShorts();

    expect(updateMicroblogPostUrl.mock.calls.map(([row]) => row)).toEqual([12]);
  });

  test('moves on to the next short when a post fails', async () => {
    downloadFromDrive.mockRejectedValueOnce(new Error('Drive unavailable'));
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: 'show-a-s1' }),
      makeShort({ rowIndex: 12, groupId: 'show-b-s1' }),
    ]);

    await scanAndPostShorts();

    expect(updateMicroblogPostUrl.mock.calls.map(([row]) => row)).toEqual([12]);
  });

  test('stops the scan and reports the post URL when recording it fails, so no second short posts', async () => {
    updateMicroblogPostUrl.mockRejectedValueOnce(new Error('Sheets unavailable'));
    fetchRecentShortRows.mockResolvedValue([
      makeShort({ rowIndex: 10, groupId: 'show-a-s1' }),
      makeShort({ rowIndex: 12, groupId: 'show-b-s1' }),
    ]);

    const err = await scanAndPostShorts().catch(e => e);

    expect(micropubCalls()).toHaveLength(1);
    expect(err.code).toBe('MICROBLOG_RECORD_FAILED');
    expect(err.message).toContain('https://whitneylee.com/2026/10/07/short.html');
    expect(err.message).toContain('Sheets unavailable');
  });

  test('posts nothing in dry-run mode', async () => {
    fetchRecentShortRows.mockResolvedValue([makeShort({ rowIndex: 10 })]);

    await scanAndPostShorts(true);

    expect(micropubCalls()).toHaveLength(0);
    expect(downloadFromDrive).not.toHaveBeenCalled();
    expect(updateMicroblogPostUrl).not.toHaveBeenCalled();
  });
});
