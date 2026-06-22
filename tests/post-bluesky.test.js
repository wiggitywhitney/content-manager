// ABOUTME: Tests for the Bluesky posting module.
// ABOUTME: Verifies app password auth, post creation, URL construction, video embed, image embed, and failure handling.

'use strict';

jest.mock('@atproto/api');

const { BskyAgent } = require('@atproto/api');
const { postToBluesky, buildBskyWebUrl } = require('../src/post-bluesky');

function makePost(overrides = {}) {
  return {
    postText: 'Check out this episode! https://youtu.be/abc123',
    youtubeUrl: 'https://youtu.be/abc123',
    altText: 'A test video thumbnail',
    postType: 'episode',
    ...overrides,
  };
}

describe('buildBskyWebUrl', () => {
  test('extracts rkey from AT URI and builds web URL', () => {
    const url = buildBskyWebUrl('whitney.bsky.social', 'at://did:plc:abc123/app.bsky.feed.post/testrkey');
    expect(url).toBe('https://bsky.app/profile/whitney.bsky.social/post/testrkey');
  });

  test('handles URI with only rkey segment', () => {
    const url = buildBskyWebUrl('handle.bsky.social', 'at://did:plc:xyz/app.bsky.feed.post/abc3def5ghi');
    expect(url).toBe('https://bsky.app/profile/handle.bsky.social/post/abc3def5ghi');
  });
});

describe('postToBluesky', () => {
  let mockLogin;
  let mockPost;

  beforeEach(() => {
    mockLogin = jest.fn().mockResolvedValue(undefined);
    mockPost = jest.fn().mockResolvedValue({
      uri: 'at://did:plc:testdid/app.bsky.feed.post/testkey123',
    });
    BskyAgent.mockImplementation(() => ({
      login: mockLogin,
      post: mockPost,
    }));

    process.env.BLUESKY_HANDLE = 'whitney.bsky.social';
    process.env.BLUESKY_APP_PASSWORD = 'test-app-password';
  });

  afterEach(() => {
    delete process.env.BLUESKY_HANDLE;
    delete process.env.BLUESKY_APP_PASSWORD;
    jest.clearAllMocks();
  });

  test('throws if BLUESKY_HANDLE is not set', async () => {
    delete process.env.BLUESKY_HANDLE;
    await expect(postToBluesky(makePost())).rejects.toThrow('BLUESKY_HANDLE');
  });

  test('throws if BLUESKY_APP_PASSWORD is not set', async () => {
    delete process.env.BLUESKY_APP_PASSWORD;
    await expect(postToBluesky(makePost())).rejects.toThrow('BLUESKY_APP_PASSWORD');
  });

  test('creates BskyAgent with bsky.social service', async () => {
    await postToBluesky(makePost());
    expect(BskyAgent).toHaveBeenCalledWith({ service: 'https://bsky.social' });
  });

  test('logs in with handle and app password', async () => {
    await postToBluesky(makePost());
    expect(mockLogin).toHaveBeenCalledWith({
      identifier: 'whitney.bsky.social',
      password: 'test-app-password',
    });
  });

  test('posts with the post text', async () => {
    const post = makePost({ postText: 'Hello from the test suite!' });
    await postToBluesky(post);
    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hello from the test suite!' })
    );
  });

  test('returns postUrl built from handle and AT URI rkey', async () => {
    const result = await postToBluesky(makePost());
    expect(result.postUrl).toBe('https://bsky.app/profile/whitney.bsky.social/post/testkey123');
  });

  test('propagates login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid app password'));
    await expect(postToBluesky(makePost())).rejects.toThrow('Invalid app password');
  });

  test('propagates post failure', async () => {
    mockPost.mockRejectedValue(new Error('Rate limit exceeded'));
    await expect(postToBluesky(makePost())).rejects.toThrow('Rate limit exceeded');
  });

  test('does not include embed when no videoBuffer', async () => {
    await postToBluesky(makePost());
    expect(mockPost).toHaveBeenCalledWith({ text: 'Check out this episode! https://youtu.be/abc123' });
  });
});

describe('postToBluesky - image path', () => {
  const FAKE_IMAGE_BUFFER = Buffer.from('fake-jpeg-data');
  const FAKE_BLOB = { $type: 'blob', ref: { $link: 'bafybeifake' }, mimeType: 'image/jpeg', size: 100 };
  const FAKE_POST_URI = 'at://did:plc:testuser/app.bsky.feed.post/rkey123';

  let mockAgent;

  beforeEach(() => {
    process.env.BLUESKY_HANDLE = 'whitney.bsky.social';
    process.env.BLUESKY_APP_PASSWORD = 'test-app-password';

    mockAgent = {
      login: jest.fn().mockResolvedValue(undefined),
      post: jest.fn().mockResolvedValue({ uri: FAKE_POST_URI }),
      uploadBlob: jest.fn().mockResolvedValue({ data: { blob: FAKE_BLOB } }),
      session: { did: 'did:plc:testuser' },
      pdsUrl: 'https://oyster.us-east.host.bsky.network/',
      com: { atproto: { server: { getServiceAuth: jest.fn().mockResolvedValue({ data: { token: 'service-token' } }) } } },
    };

    BskyAgent.mockImplementation(() => mockAgent);
  });

  afterEach(() => {
    delete process.env.BLUESKY_HANDLE;
    delete process.env.BLUESKY_APP_PASSWORD;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('calls agent.uploadBlob with image/jpeg encoding', async () => {
    await postToBluesky({ postText: 'Episode!', altText: 'Thumbnail' }, { imageBuffer: FAKE_IMAGE_BUFFER });
    expect(mockAgent.uploadBlob).toHaveBeenCalledWith(FAKE_IMAGE_BUFFER, { encoding: 'image/jpeg' });
  });

  test('builds app.bsky.embed.images embed with blob and alt text', async () => {
    await postToBluesky({ postText: 'Episode!', altText: 'Thumbnail' }, { imageBuffer: FAKE_IMAGE_BUFFER });
    expect(mockAgent.post).toHaveBeenCalledWith(
      expect.objectContaining({
        embed: {
          $type: 'app.bsky.embed.images',
          images: [{ image: FAKE_BLOB, alt: 'Thumbnail' }],
        },
      })
    );
  });

  test('does not use app.bsky.embed.video embed type for image posts', async () => {
    await postToBluesky({ postText: 'Episode!', altText: 'Thumbnail' }, { imageBuffer: FAKE_IMAGE_BUFFER });
    const postCall = mockAgent.post.mock.calls[0][0];
    expect(postCall.embed.$type).toBe('app.bsky.embed.images');
  });

  test('returns postUrl from built web URL', async () => {
    const result = await postToBluesky({ postText: 'Episode!', altText: 'Thumbnail' }, { imageBuffer: FAKE_IMAGE_BUFFER });
    expect(result.postUrl).toContain('bsky.app');
    expect(result.postUrl).toContain('rkey123');
  });

  test('throws when image upload times out', async () => {
    jest.useFakeTimers();
    mockAgent.uploadBlob.mockImplementation(() => new Promise(() => {}));
    const assertion = expect(
      postToBluesky({ postText: 'Episode!', altText: 'Thumbnail' }, { imageBuffer: FAKE_IMAGE_BUFFER })
    ).rejects.toThrow('Bluesky image upload timed out after 60 seconds');
    await jest.runAllTimersAsync();
    await assertion;
  });

  test('video takes priority over image when both buffers provided', async () => {
    const fakeVideoBuffer = Buffer.from('fake-video');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ jobId: 'job1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ jobStatus: { blob: FAKE_BLOB } }) });

    await postToBluesky({ postText: 'Short!', altText: 'Alt' }, { videoBuffer: fakeVideoBuffer, imageBuffer: FAKE_IMAGE_BUFFER });

    expect(mockAgent.uploadBlob).not.toHaveBeenCalled();
    delete global.fetch;
  });
});

describe('postToBluesky - video path', () => {
  let mockLogin;
  let mockPost;
  let mockGetServiceAuth;
  let mockFetch;

  const MOCK_DID = 'did:plc:testdid';
  const MOCK_PDS_URL = 'https://oyster.us-east.host.bsky.network/';
  const MOCK_PDS_DID = 'did:web:oyster.us-east.host.bsky.network';
  const MOCK_SERVICE_TOKEN = 'service-token-123';
  const MOCK_JOB_ID = 'job-abc-456';
  const MOCK_BLOB = { $type: 'blob', ref: { $link: 'bafytest' }, mimeType: 'video/mp4', size: 12345 };

  beforeEach(() => {
    mockGetServiceAuth = jest.fn().mockResolvedValue({ data: { token: MOCK_SERVICE_TOKEN } });
    mockLogin = jest.fn().mockResolvedValue(undefined);
    mockPost = jest.fn().mockResolvedValue({ uri: 'at://did:plc:testdid/app.bsky.feed.post/testkey123' });

    BskyAgent.mockImplementation(() => ({
      login: mockLogin,
      post: mockPost,
      session: { did: MOCK_DID },
      pdsUrl: MOCK_PDS_URL,
      com: { atproto: { server: { getServiceAuth: mockGetServiceAuth } } },
    }));

    mockFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: MOCK_JOB_ID }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobStatus: { blob: MOCK_BLOB } }),
      });
    global.fetch = mockFetch;

    process.env.BLUESKY_HANDLE = 'whitney.bsky.social';
    process.env.BLUESKY_APP_PASSWORD = 'test-app-password';
  });

  afterEach(() => {
    delete process.env.BLUESKY_HANDLE;
    delete process.env.BLUESKY_APP_PASSWORD;
    delete global.fetch;
    jest.clearAllMocks();
  });

  test('acquires service auth token with PDS DID as aud', async () => {
    await postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') });
    expect(mockGetServiceAuth).toHaveBeenCalledWith({
      aud: MOCK_PDS_DID,
      lxm: 'com.atproto.repo.uploadBlob',
      exp: expect.any(Number),
    });
  });

  test('uploads video to video.bsky.app with service token and DID', async () => {
    await postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') });
    const [uploadUrl, uploadOptions] = mockFetch.mock.calls[0];
    expect(uploadUrl).toContain('video.bsky.app/xrpc/app.bsky.video.uploadVideo');
    expect(uploadUrl).toContain(`did=${encodeURIComponent(MOCK_DID)}`);
    expect(uploadOptions.method).toBe('POST');
    expect(uploadOptions.headers['Authorization']).toBe(`Bearer ${MOCK_SERVICE_TOKEN}`);
    expect(uploadOptions.headers['Content-Type']).toBe('video/mp4');
  });

  test('polls job status until blob is ready', async () => {
    await postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') });
    const [pollUrl] = mockFetch.mock.calls[1];
    expect(pollUrl).toContain('video.bsky.app/xrpc/app.bsky.video.getJobStatus');
    expect(pollUrl).toContain(`jobId=${encodeURIComponent(MOCK_JOB_ID)}`);
  });

  test('includes video embed with correct type and aspect ratio in post', async () => {
    await postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') });
    expect(mockPost).toHaveBeenCalledWith({
      text: expect.any(String),
      embed: {
        $type: 'app.bsky.embed.video',
        video: MOCK_BLOB,
        aspectRatio: { width: 9, height: 16 },
      },
    });
  });

  test('returns postUrl on success', async () => {
    const result = await postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') });
    expect(result.postUrl).toBe('https://bsky.app/profile/whitney.bsky.social/post/testkey123');
  });

  test('throws if video upload returns non-ok response', async () => {
    mockFetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    global.fetch = mockFetch;
    await expect(postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') })).rejects.toThrow('500');
  });

  test('throws if job status poll returns non-ok response', async () => {
    mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: MOCK_JOB_ID }) })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    global.fetch = mockFetch;
    await expect(postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') })).rejects.toThrow('503');
  });

  test('throws if job status indicates failure and retry also fails', async () => {
    // Retry gets one chance: upload + poll for each attempt = 4 total fetch calls
    mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: MOCK_JOB_ID }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobStatus: { state: 'failed', error: 'codec not supported' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: 'job-retry' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobStatus: { state: 'failed', error: 'codec not supported' } }) });
    global.fetch = mockFetch;
    await expect(postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') })).rejects.toThrow('codec not supported');
  });

  test('throws with clear message if agent.pdsUrl is undefined after login', async () => {
    BskyAgent.mockImplementation(() => ({
      login: mockLogin,
      post: mockPost,
      session: { did: MOCK_DID },
      pdsUrl: undefined,
      com: { atproto: { server: { getServiceAuth: mockGetServiceAuth } } },
    }));
    await expect(postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') })).rejects.toThrow('pdsUrl');
  });

  test('retries once when first job fails and succeeds on second attempt', async () => {
    const MOCK_JOB_ID_2 = 'job-retry-789';
    const MOCK_BLOB_2 = { $type: 'blob', ref: { $link: 'bafyretry' }, mimeType: 'video/mp4', size: 99 };
    mockFetch = jest.fn()
      // First upload
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: MOCK_JOB_ID }) })
      // First job status — fails
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobStatus: { state: 'failed', error: 'transient I/O error' } }) })
      // Retry upload
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: MOCK_JOB_ID_2 }) })
      // Retry job status — succeeds
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobStatus: { blob: MOCK_BLOB_2 } }) });
    global.fetch = mockFetch;

    const result = await postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') });

    // Post was created with the blob from the successful retry
    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        embed: expect.objectContaining({ video: MOCK_BLOB_2 }),
      })
    );
    expect(result.postUrl).toContain('bsky.app');
  });

  test('throws when retry job also fails — does not attempt a third upload', async () => {
    mockFetch = jest.fn()
      // First upload
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: MOCK_JOB_ID }) })
      // First job status — fails
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobStatus: { state: 'failed', error: 'first error' } }) })
      // Retry upload
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: 'job-retry-again' }) })
      // Retry job status — also fails
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobStatus: { state: 'failed', error: 'second error' } }) });
    global.fetch = mockFetch;

    await expect(
      postToBluesky(makePost(), { videoBuffer: Buffer.from('fake-video') })
    ).rejects.toThrow('second error');

    // Only 4 fetch calls: 2 uploads + 2 status polls (no third upload attempt)
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
