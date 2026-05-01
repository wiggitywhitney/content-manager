// ABOUTME: Unit tests for post-bluesky.js — image attachment path.

'use strict';

jest.mock('@atproto/api', () => ({
  BskyAgent: jest.fn(),
}));

const { BskyAgent } = require('@atproto/api');
const { postToBluesky, buildBskyWebUrl } = require('../src/post-bluesky');

const FAKE_IMAGE_BUFFER = Buffer.from('fake-jpeg-data');
const FAKE_BLOB = { $type: 'blob', ref: { $link: 'bafybeifake' }, mimeType: 'image/jpeg', size: 100 };
const FAKE_POST_URI = 'at://did:plc:testuser/app.bsky.feed.post/rkey123';

function makePost(overrides = {}) {
  return {
    rowIndex: 3,
    title: 'Test Episode',
    postType: 'episode',
    postText: 'Check out this episode!',
    youtubeUrl: 'https://youtu.be/abc123',
    altText: 'Podcast thumbnail graphic',
    platforms: ['bluesky'],
    groupId: null,
    ...overrides,
  };
}

describe('postToBluesky with imageBuffer', () => {
  let mockAgent;

  beforeEach(() => {
    process.env.BLUESKY_HANDLE = 'whitney.bsky.social';
    process.env.BLUESKY_APP_PASSWORD = 'test-app-password';

    mockAgent = {
      login: jest.fn().mockResolvedValue(undefined),
      post: jest.fn().mockResolvedValue({ uri: FAKE_POST_URI }),
      uploadBlob: jest.fn().mockResolvedValue({ data: { blob: FAKE_BLOB } }),
      session: { did: 'did:plc:testuser' },
      com: {
        atproto: {
          server: {
            getServiceAuth: jest.fn().mockResolvedValue({ data: { token: 'service-token' } }),
          },
        },
      },
    };

    BskyAgent.mockImplementation(() => mockAgent);
  });

  afterEach(() => {
    delete process.env.BLUESKY_HANDLE;
    delete process.env.BLUESKY_APP_PASSWORD;
    jest.clearAllMocks();
  });

  test('calls agent.uploadBlob with image/jpeg encoding', async () => {
    await postToBluesky(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    expect(mockAgent.uploadBlob).toHaveBeenCalledWith(
      FAKE_IMAGE_BUFFER,
      { encoding: 'image/jpeg' }
    );
  });

  test('builds app.bsky.embed.images embed with blob and alt text', async () => {
    await postToBluesky(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    expect(mockAgent.post).toHaveBeenCalledWith(
      expect.objectContaining({
        embed: {
          $type: 'app.bsky.embed.images',
          images: [{ image: FAKE_BLOB, alt: 'Podcast thumbnail graphic' }],
        },
      })
    );
  });

  test('does not use app.bsky.embed.video embed type for image posts', async () => {
    await postToBluesky(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    const postCall = mockAgent.post.mock.calls[0][0];
    expect(postCall.embed.$type).toBe('app.bsky.embed.images');
    expect(postCall.embed.$type).not.toBe('app.bsky.embed.video');
  });

  test('returns postUrl from built web URL', async () => {
    const result = await postToBluesky(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });
    expect(result.postUrl).toContain('bsky.app');
    expect(result.postUrl).toContain('rkey123');
  });

  test('skips image upload when videoBuffer is provided', async () => {
    // When videoBuffer is provided, the video path should be taken
    // We mock fetch to control the video upload flow
    const fakeVideoBuffer = Buffer.from('fake-video');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ jobId: 'job1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ jobStatus: { blob: FAKE_BLOB } }) });

    await postToBluesky(makePost(), { videoBuffer: fakeVideoBuffer, imageBuffer: FAKE_IMAGE_BUFFER });

    // uploadBlob should NOT have been called (video path was taken instead)
    expect(mockAgent.uploadBlob).not.toHaveBeenCalled();

    delete global.fetch;
  });
});

describe('buildBskyWebUrl', () => {
  test('builds web URL from handle and AT URI', () => {
    const url = buildBskyWebUrl('whitney.bsky.social', 'at://did:plc:abc/app.bsky.feed.post/rkey999');
    expect(url).toBe('https://bsky.app/profile/whitney.bsky.social/post/rkey999');
  });
});
