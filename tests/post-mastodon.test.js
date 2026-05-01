// ABOUTME: Unit tests for post-mastodon.js — image attachment path.

'use strict';

jest.mock('masto', () => ({
  createRestAPIClient: jest.fn(),
}));

const { createRestAPIClient } = require('masto');
const { postToMastodon } = require('../src/post-mastodon');

const FAKE_IMAGE_BUFFER = Buffer.from('fake-jpeg-data');
const FAKE_ATTACHMENT_ID = 'attachment-image-001';
const FAKE_STATUS_URL = 'https://hachyderm.io/@whitney/109876543210';

function makePost(overrides = {}) {
  return {
    rowIndex: 3,
    title: 'Test Episode',
    postType: 'episode',
    postText: 'Check out this episode!',
    youtubeUrl: 'https://youtu.be/abc123',
    altText: 'Podcast thumbnail graphic',
    platforms: ['mastodon'],
    groupId: null,
    ...overrides,
  };
}

describe('postToMastodon with imageBuffer', () => {
  let mockMasto;

  beforeEach(() => {
    process.env.MASTODON_ACCESS_TOKEN = 'test-token';
    process.env.MASTODON_INSTANCE_URL = 'https://hachyderm.io';

    mockMasto = {
      v1: {
        statuses: {
          create: jest.fn().mockResolvedValue({ url: FAKE_STATUS_URL }),
        },
        mediaAttachments: {
          $select: jest.fn(),
        },
      },
      v2: {
        media: {
          create: jest.fn().mockResolvedValue({ id: FAKE_ATTACHMENT_ID, url: 'https://hachyderm.io/media/fake.jpg' }),
        },
      },
    };

    createRestAPIClient.mockReturnValue(mockMasto);
  });

  afterEach(() => {
    delete process.env.MASTODON_ACCESS_TOKEN;
    delete process.env.MASTODON_INSTANCE_URL;
    jest.clearAllMocks();
  });

  test('calls masto.v2.media.create with image/jpeg blob and altText', async () => {
    await postToMastodon(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    expect(mockMasto.v2.media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.any(Blob),
        description: 'Podcast thumbnail graphic',
      })
    );

    const createCall = mockMasto.v2.media.create.mock.calls[0][0];
    expect(createCall.file.type).toBe('image/jpeg');
  });

  test('adds attachment id to mediaIds in the status', async () => {
    await postToMastodon(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    expect(mockMasto.v1.statuses.create).toHaveBeenCalledWith(
      expect.objectContaining({ mediaIds: [FAKE_ATTACHMENT_ID] })
    );
  });

  test('does not poll for image attachment (images are synchronous)', async () => {
    await postToMastodon(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    // v1.mediaAttachments.$select should never be called for images
    expect(mockMasto.v1.mediaAttachments.$select).not.toHaveBeenCalled();
    // v2.media.create called exactly once
    expect(mockMasto.v2.media.create).toHaveBeenCalledTimes(1);
  });

  test('returns postUrl from status', async () => {
    const result = await postToMastodon(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });
    expect(result.postUrl).toBe(FAKE_STATUS_URL);
  });

  test('skips image attachment when videoBuffer is also provided', async () => {
    const fakeVideoBuffer = Buffer.from('fake-video');

    // video upload returns url=null so we'd need polling; mock it with a url set
    mockMasto.v2.media.create.mockResolvedValue({ id: 'video-att', url: null });
    const videoAttachment = { id: 'video-att', url: 'https://hachyderm.io/media/fake.mp4' };
    mockMasto.v1.mediaAttachments.$select = jest.fn().mockReturnValue({
      fetch: jest.fn().mockResolvedValue(videoAttachment),
    });

    await postToMastodon(makePost(), { videoBuffer: fakeVideoBuffer, imageBuffer: FAKE_IMAGE_BUFFER });

    // Only one call to v2.media.create — for the video
    expect(mockMasto.v2.media.create).toHaveBeenCalledTimes(1);
    const createCall = mockMasto.v2.media.create.mock.calls[0][0];
    expect(createCall.file.type).toBe('video/mp4');
  });
});
