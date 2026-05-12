// ABOUTME: Unit tests for post-social-content.js — covers dispatchPost video download and platform dispatch.

'use strict';

jest.mock('../src/social-posts-queue', () => ({
  fetchOldestPendingGroup: jest.fn(),
  fetchOldestPendingMicroblogPost: jest.fn(),
}));
jest.mock('../src/career-post-guard', () => ({
  checkCareerPostedToday: jest.fn(),
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
jest.mock('../src/fetch-thumbnail', () => ({
  fetchThumbnail: jest.fn(),
}));

const { dispatchPost, processPostsForDate } = require('../src/post-social-content');
const { postToBluesky } = require('../src/post-bluesky');
const { postToMastodon } = require('../src/post-mastodon');
const { postToLinkedIn } = require('../src/post-linkedin');
const { postToMicroblog } = require('../src/post-microblog');
const { updatePostResult } = require('../src/update-social-post-status');
const { downloadShortVideo } = require('../src/video-download');
const { fetchThumbnail } = require('../src/fetch-thumbnail');
const { fetchOldestPendingGroup, fetchOldestPendingMicroblogPost } = require('../src/social-posts-queue');
const { checkCareerPostedToday } = require('../src/career-post-guard');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FAKE_TMP_DIR = '/tmp/social-abc123';
const FAKE_VIDEO_BUFFER = Buffer.from('fake-video-data');
const FAKE_IMAGE_BUFFER = Buffer.from('fake-image-data');

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
    fetchThumbnail.mockResolvedValue(FAKE_IMAGE_BUFFER);
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

    test('passes imageBuffer null to platform posters for short posts', async () => {
      await dispatchPost(makePost(), '2026-04-27');
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'short' }),
        expect.objectContaining({ imageBuffer: null })
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

    test('calls fetchThumbnail with the post youtubeUrl for episode posts', async () => {
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(fetchThumbnail).toHaveBeenCalledWith('https://youtu.be/abc123');
    });

    test('passes imageBuffer to postToBluesky for episode posts', async () => {
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'episode' }),
        { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER }
      );
    });

    test('passes imageBuffer to postToMastodon for episode posts', async () => {
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(postToMastodon).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'episode' }),
        { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER }
      );
    });

    test('passes imageBuffer to postToLinkedIn for episode posts', async () => {
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(postToLinkedIn).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'episode' }),
        { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER }
      );
    });

    test('posts without image when fetchThumbnail throws (non-fatal fallback)', async () => {
      fetchThumbnail.mockRejectedValue(new Error('network error'));
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'episode' }),
        { videoBuffer: null, imageBuffer: null }
      );
      // Post still dispatched (not marked failed)
      expect(updatePostResult).toHaveBeenCalledWith(5, expect.objectContaining({ status: 'posted' }));
    });

    test('does not call fetchThumbnail when episode post has no youtubeUrl', async () => {
      await dispatchPost(makePost({ postType: 'episode', youtubeUrl: '' }), '2026-04-27');
      expect(fetchThumbnail).not.toHaveBeenCalled();
    });
  });

  describe('DRY_RUN mode', () => {
    beforeEach(() => {
      process.env.DRY_RUN = 'true';
    });

    afterEach(() => {
      delete process.env.DRY_RUN;
    });

    test('does not call any platform posting functions', async () => {
      await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky', 'mastodon', 'linkedin'] }), '2026-04-27');
      expect(postToBluesky).not.toHaveBeenCalled();
      expect(postToMastodon).not.toHaveBeenCalled();
      expect(postToLinkedIn).not.toHaveBeenCalled();
      expect(postToMicroblog).not.toHaveBeenCalled();
    });

    test('does not call updatePostResult', async () => {
      await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky'] }), '2026-04-27');
      expect(updatePostResult).not.toHaveBeenCalled();
    });

    test('does not download video for short posts', async () => {
      await dispatchPost(makePost({ postType: 'short', platforms: ['bluesky'] }), '2026-04-27');
      expect(downloadShortVideo).not.toHaveBeenCalled();
    });

    test('does not create a tmpDir for short posts', async () => {
      await dispatchPost(makePost({ postType: 'short', platforms: ['bluesky'] }), '2026-04-27');
      expect(mkdtempSyncSpy).not.toHaveBeenCalled();
    });

    test('logs what would be dispatched', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky', 'mastodon'] }), '2026-04-27');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DRY_RUN'));
      consoleSpy.mockRestore();
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
        { videoBuffer: null, imageBuffer: null }
      );
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'talk' }),
        { videoBuffer: null, imageBuffer: null }
      );
      expect(postToMastodon).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'talk' }),
        { videoBuffer: null, imageBuffer: null }
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

const FAKE_GROUP_POST = { rowIndex: 2, title: 'Test Episode', postType: 'episode', platforms: ['bluesky'], groupId: 'ep-1', postText: 'test', youtubeUrl: '', altText: '', scheduledDate: '', status: 'pending', linkedinPostUrl: '', bskyPostUrl: '', mastodonPostUrl: '', microblogPostUrl: '' };
const FAKE_MICROBLOG_POST = { rowIndex: 5, title: 'MB Test', postType: 'episode', platforms: ['micro.blog'], groupId: null, postText: 'test', youtubeUrl: '', altText: '', scheduledDate: '', status: 'pending', linkedinPostUrl: '', bskyPostUrl: '', mastodonPostUrl: '', microblogPostUrl: '' };

describe('processPostsForDate — three-tier dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DRY_RUN = 'true';
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);
    checkCareerPostedToday.mockResolvedValue(false);
  });

  afterEach(() => {
    delete process.env.DRY_RUN;
    delete process.env.CAREER_PRIORITY;
  });

  test('(a) social day with pending social post: dispatches social, does not reach micro.blog tier', async () => {
    process.env.CAREER_PRIORITY = '0';
    fetchOldestPendingGroup.mockResolvedValue([FAKE_GROUP_POST]);

    await processPostsForDate('2026-05-12');

    expect(fetchOldestPendingGroup).toHaveBeenCalled();
    expect(fetchOldestPendingMicroblogPost).not.toHaveBeenCalled();
  });

  test('(b) social day, social empty, career posted today: micro.blog deferred', async () => {
    process.env.CAREER_PRIORITY = '0';
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkCareerPostedToday.mockResolvedValue(true);

    await processPostsForDate('2026-05-12');

    expect(fetchOldestPendingMicroblogPost).not.toHaveBeenCalled();
  });

  test('(c) social day, social empty, career not posted today: micro.blog tier reached', async () => {
    process.env.CAREER_PRIORITY = '0';
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkCareerPostedToday.mockResolvedValue(false);
    fetchOldestPendingMicroblogPost.mockResolvedValue(FAKE_MICROBLOG_POST);

    await processPostsForDate('2026-05-12');

    expect(fetchOldestPendingMicroblogPost).toHaveBeenCalled();
  });

  test('(d) career day, career posted: social and micro.blog both skipped', async () => {
    process.env.CAREER_PRIORITY = '1';
    checkCareerPostedToday.mockResolvedValue(true);

    await processPostsForDate('2026-05-13');

    expect(fetchOldestPendingGroup).not.toHaveBeenCalled();
    expect(fetchOldestPendingMicroblogPost).not.toHaveBeenCalled();
  });

  test('(e) career day, career not posted, social empty: micro.blog tier reached', async () => {
    process.env.CAREER_PRIORITY = '1';
    checkCareerPostedToday.mockResolvedValue(false);
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(FAKE_MICROBLOG_POST);

    await processPostsForDate('2026-05-13');

    expect(fetchOldestPendingMicroblogPost).toHaveBeenCalled();
  });
});
