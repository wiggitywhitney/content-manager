// ABOUTME: Tests for the Bluesky posting module.
// ABOUTME: Verifies app password auth, post creation, URL construction, and failure handling.

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
});
