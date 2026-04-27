// ABOUTME: Tests for the Mastodon posting module.
// ABOUTME: Verifies access token auth, status creation, URL extraction, and failure handling.

'use strict';

// masto.js CJS bundle has ESM-only transitive dependencies (change-case) that Jest
// cannot parse, so we use a manual factory mock to avoid loading the actual module.
jest.mock('masto', () => ({
  createRestAPIClient: jest.fn(),
}));

const { createRestAPIClient } = require('masto');
const { postToMastodon } = require('../src/post-mastodon');

const MOCK_STATUS_URL = 'https://mastodon.social/@whitney/109375123456789012';
const MOCK_MEDIA_ID = 'media-abc123';
const MOCK_MEDIA_URL = 'https://mastodon.social/system/media_attachments/files/media-abc123/original/video.mp4';

function makePost(overrides = {}) {
  return {
    postText: 'Check out this episode! https://youtu.be/abc123',
    youtubeUrl: 'https://youtu.be/abc123',
    altText: 'A test video thumbnail',
    postType: 'episode',
    ...overrides,
  };
}

describe('postToMastodon', () => {
  let mockStatusCreate;
  let mockMediaCreate;
  let mockMediaFetch;
  let mockSelectFn;

  beforeEach(() => {
    mockStatusCreate = jest.fn().mockResolvedValue({ url: MOCK_STATUS_URL });
    mockMediaFetch = jest.fn().mockResolvedValue({ id: MOCK_MEDIA_ID, url: MOCK_MEDIA_URL });
    mockSelectFn = jest.fn().mockReturnValue({ fetch: mockMediaFetch });
    mockMediaCreate = jest.fn().mockResolvedValue({ id: MOCK_MEDIA_ID, url: null });

    createRestAPIClient.mockReturnValue({
      v1: {
        statuses: { create: mockStatusCreate },
        mediaAttachments: { $select: mockSelectFn },
      },
      v2: {
        media: { create: mockMediaCreate },
      },
    });

    process.env.MASTODON_ACCESS_TOKEN = 'test-access-token';
    process.env.MASTODON_INSTANCE_URL = 'https://mastodon.social';
  });

  afterEach(() => {
    delete process.env.MASTODON_ACCESS_TOKEN;
    delete process.env.MASTODON_INSTANCE_URL;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('throws if MASTODON_ACCESS_TOKEN is not set', async () => {
    delete process.env.MASTODON_ACCESS_TOKEN;
    await expect(postToMastodon(makePost())).rejects.toThrow('MASTODON_ACCESS_TOKEN');
  });

  test('throws if MASTODON_INSTANCE_URL is not set', async () => {
    delete process.env.MASTODON_INSTANCE_URL;
    await expect(postToMastodon(makePost())).rejects.toThrow('MASTODON_INSTANCE_URL');
  });

  test('creates REST client with instance URL and access token', async () => {
    await postToMastodon(makePost());
    expect(createRestAPIClient).toHaveBeenCalledWith({
      url: 'https://mastodon.social',
      accessToken: 'test-access-token',
    });
  });

  test('creates status with the post text', async () => {
    const post = makePost({ postText: 'Hello Mastodon!' });
    await postToMastodon(post);
    expect(mockStatusCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Hello Mastodon!' })
    );
  });

  test('returns postUrl from status url', async () => {
    const result = await postToMastodon(makePost());
    expect(result.postUrl).toBe(MOCK_STATUS_URL);
  });

  test('propagates status creation failure', async () => {
    mockStatusCreate.mockRejectedValue(new Error('Rate limit exceeded'));
    await expect(postToMastodon(makePost())).rejects.toThrow('Rate limit exceeded');
  });

  test('propagates client creation failure', async () => {
    createRestAPIClient.mockImplementation(() => {
      throw new Error('Invalid instance URL');
    });
    await expect(postToMastodon(makePost())).rejects.toThrow('Invalid instance URL');
  });

  describe('text-only path (no videoBuffer)', () => {
    test('does not call v2 media create', async () => {
      await postToMastodon(makePost());
      expect(mockMediaCreate).not.toHaveBeenCalled();
    });

    test('does not include mediaIds in status create', async () => {
      await postToMastodon(makePost());
      expect(mockStatusCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ mediaIds: expect.anything() })
      );
    });
  });

  describe('video path (videoBuffer provided)', () => {
    const fakeBuffer = Buffer.from('fake-video-data');

    test('calls v2 media create with video blob and alt text', async () => {
      jest.useFakeTimers();
      const promise = postToMastodon(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      await jest.runAllTimersAsync();
      await promise;
      expect(mockMediaCreate).toHaveBeenCalledWith({
        file: expect.any(Blob),
        description: 'A test video thumbnail',
      });
      const [{ file }] = mockMediaCreate.mock.calls[0];
      expect(file.type).toBe('video/mp4');
    });

    test('polls mediaAttachments until url is populated', async () => {
      jest.useFakeTimers();
      const promise = postToMastodon(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      await jest.runAllTimersAsync();
      await promise;
      expect(mockSelectFn).toHaveBeenCalledWith(MOCK_MEDIA_ID);
      expect(mockMediaFetch).toHaveBeenCalled();
    });

    test('retries poll when url is not yet populated', async () => {
      mockMediaFetch
        .mockResolvedValueOnce({ id: MOCK_MEDIA_ID, url: null })
        .mockResolvedValueOnce({ id: MOCK_MEDIA_ID, url: MOCK_MEDIA_URL });
      jest.useFakeTimers();
      const promise = postToMastodon(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      await jest.runAllTimersAsync();
      await promise;
      expect(mockMediaFetch).toHaveBeenCalledTimes(2);
    });

    test('includes mediaIds in status create', async () => {
      jest.useFakeTimers();
      const promise = postToMastodon(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      await jest.runAllTimersAsync();
      await promise;
      expect(mockStatusCreate).toHaveBeenCalledWith(
        expect.objectContaining({ mediaIds: [MOCK_MEDIA_ID] })
      );
    });

    test('returns postUrl on success', async () => {
      jest.useFakeTimers();
      const promise = postToMastodon(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      await jest.runAllTimersAsync();
      const result = await promise;
      expect(result.postUrl).toBe(MOCK_STATUS_URL);
    });

    test('throws if video processing times out', async () => {
      // url never gets populated — all polls return null
      mockMediaFetch.mockResolvedValue({ id: MOCK_MEDIA_ID, url: null });
      jest.useFakeTimers();
      // Register the assertion before advancing timers so the rejection is handled immediately
      const assertion = expect(
        postToMastodon(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer })
      ).rejects.toThrow('timed out');
      await jest.runAllTimersAsync();
      await assertion;
    });

    test('throws if media attachment processing fails with error field', async () => {
      jest.useFakeTimers();
      mockMediaFetch.mockResolvedValue({ id: MOCK_MEDIA_ID, url: null, error: 'codec not supported' });
      const assertion = expect(
        postToMastodon(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer })
      ).rejects.toThrow('Mastodon video processing failed');
      await jest.runAllTimersAsync();
      await assertion;
    });

    test('propagates media upload failure', async () => {
      mockMediaCreate.mockRejectedValue(new Error('Upload failed'));
      await expect(postToMastodon(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer })).rejects.toThrow('Upload failed');
    });
  });
});
