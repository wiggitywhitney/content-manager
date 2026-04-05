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

  beforeEach(() => {
    mockStatusCreate = jest.fn().mockResolvedValue({
      url: 'https://mastodon.social/@whitney/109375123456789012',
    });
    createRestAPIClient.mockReturnValue({
      v1: {
        statuses: { create: mockStatusCreate },
      },
    });

    process.env.MASTODON_ACCESS_TOKEN = 'test-access-token';
    process.env.MASTODON_INSTANCE_URL = 'https://mastodon.social';
  });

  afterEach(() => {
    delete process.env.MASTODON_ACCESS_TOKEN;
    delete process.env.MASTODON_INSTANCE_URL;
    jest.clearAllMocks();
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
    expect(result.postUrl).toBe('https://mastodon.social/@whitney/109375123456789012');
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
});
