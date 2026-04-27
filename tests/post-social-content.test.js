// ABOUTME: Unit tests for post-social-content.js — covers dispatchPost video download and platform dispatch.

'use strict';

jest.mock('../src/social-posts-queue', () => ({
  fetchOldestPendingGroup: jest.fn(),
  fetchOldestPendingMicroblogPost: jest.fn(),
}));
jest.mock('../src/career-post-guard', () => ({
  checkCareerPostedToday: jest.fn(),
  checkAllCareerPostsPublished: jest.fn(),
}));
jest.mock('../src/post-bluesky', () => ({
  postToBluesky: jest.fn(),
}));
// Manual factory required: masto.js has ESM-only transitive deps (change-case) that Jest can't parse
jest.mock('../src/post-mastodon', () => ({
  postToMastodon: jest.fn(),
}));
jest.mock('../src/post-linkedin', () => ({
  postToLinkedIn: jest.fn(),
}));
jest.mock('../src/post-microblog', () => ({
  scanAndPostShorts: jest.fn(),
  postToMicroblog: jest.fn(),
}));
jest.mock('../src/update-social-post-status', () => ({
  updatePostResult: jest.fn(),
}));
jest.mock('../src/video-download', () => ({
  downloadShortVideo: jest.fn(),
}));

const { dispatchPost } = require('../src/post-social-content');
const { postToBluesky } = require('../src/post-bluesky');
const { postToMastodon } = require('../src/post-mastodon');
const { postToLinkedIn } = require('../src/post-linkedin');
const { postToMicroblog } = require('../src/post-microblog');
const { updatePostResult } = require('../src/update-social-post-status');
const { downloadShortVideo } = require('../src/video-download');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FAKE_TMP_DIR = '/tmp/social-abc123';
const FAKE_VIDEO_BUFFER = Buffer.from('fake-video-data');

function makePost(overrides = {}) {
  return {
    rowIndex: 5,
    title: 'Test Short',
    postType: 'short',
    postText: 'Check out this short!',
    youtubeUrl: 'https://youtu.be/abc123',
    altText: 'A short video',
    platforms: ['bluesky', 'mastodon', 'linkedin'],
    groupId: null,
    ...overrides,
  };
}

describe('dispatchPost', () => {
  let mkdtempSyncSpy;
  let rmSyncSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    mkdtempSyncSpy = jest.spyOn(fs, 'mkdtempSync').mockReturnValue(FAKE_TMP_DIR);
    rmSyncSpy = jest.spyOn(fs, 'rmSync').mockReturnValue(undefined);
    jest.spyOn(os, 'tmpdir').mockReturnValue('/tmp');
    jest.spyOn(path, 'join').mockImplementation((...parts) => parts.join('/'));

    downloadShortVideo.mockReturnValue({ buffer: FAKE_VIDEO_BUFFER, mimeType: 'video/mp4', filename: 'video.mp4' });
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/test/post/1' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@test/1' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:1/' });
    postToMicroblog.mockResolvedValue({ postUrl: 'https://micro.blog/test/1' });
    updatePostResult.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('short post video download', () => {
    test('creates a temp directory for short post', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(mkdtempSyncSpy).toHaveBeenCalledTimes(1);
    });

    test('calls downloadShortVideo with the post URL and tmpDir', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(downloadShortVideo).toHaveBeenCalledWith('https://youtu.be/abc123', FAKE_TMP_DIR);
    });

    test('passes videoBuffer to postToBluesky', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'short' }),
        expect.objectContaining({ videoBuffer: FAKE_VIDEO_BUFFER })
      );
    });

    test('passes videoBuffer to postToMastodon', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(postToMastodon).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'short' }),
        expect.objectContaining({ videoBuffer: FAKE_VIDEO_BUFFER })
      );
    });

    test('passes videoBuffer to postToLinkedIn', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(postToLinkedIn).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'short' }),
        expect.objectContaining({ videoBuffer: FAKE_VIDEO_BUFFER })
      );
    });

    test('downloads video exactly once regardless of platform count', async () => {
      await dispatchPost(makePost({ platforms: ['bluesky', 'mastodon', 'linkedin'] }), '2026-04-27');
      expect(downloadShortVideo).toHaveBeenCalledTimes(1);
    });

    test('cleans up tmpDir in finally on success', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(rmSyncSpy).toHaveBeenCalledWith(FAKE_TMP_DIR, { recursive: true, force: true });
    });

    test('cleans up tmpDir even when a platform poster throws', async () => {
      postToBluesky.mockRejectedValue(new Error('Bluesky API error'));
      await dispatchPost(makePost(), '2026-04-27');
      expect(rmSyncSpy).toHaveBeenCalledWith(FAKE_TMP_DIR, { recursive: true, force: true });
    });
  });

  describe('short post download failure', () => {
    beforeEach(() => {
      downloadShortVideo.mockImplementation(() => {
        throw new Error('yt-dlp failed (exit 1): network error');
      });
    });

    test('marks post as failed when download throws', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(updatePostResult).toHaveBeenCalledWith(5, { status: 'failed' });
    });

    test('does not call any platform posters when download fails', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(postToBluesky).not.toHaveBeenCalled();
      expect(postToMastodon).not.toHaveBeenCalled();
      expect(postToLinkedIn).not.toHaveBeenCalled();
    });

    test('still cleans up tmpDir when download fails', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(rmSyncSpy).toHaveBeenCalledWith(FAKE_TMP_DIR, { recursive: true, force: true });
    });
  });

  describe('non-short post (episode)', () => {
    test('does not call downloadShortVideo for episode posts', async () => {
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(downloadShortVideo).not.toHaveBeenCalled();
    });

    test('does not create a tmpDir for episode posts', async () => {
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(mkdtempSyncSpy).not.toHaveBeenCalled();
    });

    test('calls postToBluesky without videoBuffer for episode posts', async () => {
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'episode' }),
        { videoBuffer: null }
      );
    });
  });

  describe('talk post type', () => {
    test('does not call downloadShortVideo for talk posts', async () => {
      await dispatchPost(makePost({ postType: 'talk', groupId: 'talk-otel-basics' }), '2026-04-27');
      expect(downloadShortVideo).not.toHaveBeenCalled();
    });

    test('does not create a tmpDir for talk posts', async () => {
      await dispatchPost(makePost({ postType: 'talk', groupId: 'talk-otel-basics' }), '2026-04-27');
      expect(mkdtempSyncSpy).not.toHaveBeenCalled();
    });

    test('dispatches to all specified platforms for talk posts', async () => {
      await dispatchPost(
        makePost({ postType: 'talk', platforms: ['linkedin', 'bluesky', 'mastodon'], groupId: 'talk-otel-basics' }),
        '2026-04-27'
      );
      expect(postToLinkedIn).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'talk' }),
        { videoBuffer: null }
      );
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'talk' }),
        { videoBuffer: null }
      );
      expect(postToMastodon).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'talk' }),
        { videoBuffer: null }
      );
    });

    test('dispatches to micro.blog for talk posts with micro.blog platform', async () => {
      await dispatchPost(
        makePost({ postType: 'talk', platforms: ['micro.blog'], groupId: 'talk-otel-basics' }),
        '2026-04-27'
      );
      expect(postToMicroblog).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'talk' }),
        { bypassViewCount: true }
      );
    });

    test('marks talk post as posted after successful dispatch', async () => {
      await dispatchPost(
        makePost({ postType: 'talk', platforms: ['linkedin'], groupId: 'talk-otel-basics' }),
        '2026-04-27'
      );
      expect(updatePostResult).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ status: 'posted' })
      );
    });
  });
});
