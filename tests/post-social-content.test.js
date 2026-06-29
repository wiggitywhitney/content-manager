// ABOUTME: Unit tests for post-social-content.js — covers dispatchPost video download and platform dispatch.

'use strict';

jest.mock('../src/social-posts-queue', () => ({
  fetchOldestPendingGroup: jest.fn(),
  fetchOldestPendingMicroblogPost: jest.fn(),
  checkSocialPostedToday: jest.fn(),
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
jest.mock('../src/drive-download', () => ({
  downloadFromDrive: jest.fn(),
}));
jest.mock('../src/fetch-thumbnail', () => ({
  fetchThumbnail: jest.fn(),
}));

const { dispatchPost, processPostsForDate, main, getSlot } = require('../src/post-social-content');
const { postToBluesky } = require('../src/post-bluesky');
const { postToMastodon } = require('../src/post-mastodon');
const { postToLinkedIn } = require('../src/post-linkedin');
const { postToMicroblog, scanAndPostShorts } = require('../src/post-microblog');
const { updatePostResult } = require('../src/update-social-post-status');
const { downloadFromDrive } = require('../src/drive-download');
const { fetchThumbnail } = require('../src/fetch-thumbnail');
const { fetchOldestPendingGroup, fetchOldestPendingMicroblogPost, checkSocialPostedToday } = require('../src/social-posts-queue');
const { checkCareerPostedToday } = require('../src/career-post-guard');

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
    driveVideoId: 'fake-drive-id-abc',
    ...overrides,
  };
}

describe('dispatchPost', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    downloadFromDrive.mockResolvedValue({ buffer: FAKE_VIDEO_BUFFER, mimeType: 'video/mp4', filename: 'video.mp4' });
    fetchThumbnail.mockResolvedValue(FAKE_IMAGE_BUFFER);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/test/post/1' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@test/1' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:1/' });
    postToMicroblog.mockResolvedValue({ postUrl: 'https://micro.blog/test/1' });
    updatePostResult.mockResolvedValue(undefined);
  });

  describe('short post video download via Drive', () => {
    test('calls downloadFromDrive with the drive video ID', async () => {
      await dispatchPost(makePost({ driveVideoId: 'drive-file-xyz' }), '2026-04-27');
      expect(downloadFromDrive).toHaveBeenCalledWith('drive-file-xyz');
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

    test('downloads from Drive exactly once regardless of platform count', async () => {
      await dispatchPost(makePost({ platforms: ['bluesky', 'mastodon', 'linkedin'] }), '2026-04-27');
      expect(downloadFromDrive).toHaveBeenCalledTimes(1);
    });
  });

  describe('short post Drive download failure', () => {
    test('marks post as failed when Drive download throws', async () => {
      downloadFromDrive.mockRejectedValue(new Error('Drive API 403'));
      await dispatchPost(makePost(), '2026-04-27');
      expect(updatePostResult).toHaveBeenCalledWith(5, { status: 'failed' });
    });

    test('does not call any platform posters when Drive download fails', async () => {
      downloadFromDrive.mockRejectedValue(new Error('Drive API 403'));
      await dispatchPost(makePost(), '2026-04-27');
      expect(postToBluesky).not.toHaveBeenCalled();
      expect(postToMastodon).not.toHaveBeenCalled();
      expect(postToLinkedIn).not.toHaveBeenCalled();
    });
  });

  describe('short post with missing Drive ID', () => {
    test('skips row when Drive video ID is absent, leaving status pending', async () => {
      await dispatchPost(makePost({ driveVideoId: '' }), '2026-04-27');
      expect(updatePostResult).not.toHaveBeenCalled();
    });

    test('does not call any platform posters when Drive ID is absent', async () => {
      await dispatchPost(makePost({ driveVideoId: '' }), '2026-04-27');
      expect(postToBluesky).not.toHaveBeenCalled();
      expect(postToMastodon).not.toHaveBeenCalled();
      expect(postToLinkedIn).not.toHaveBeenCalled();
    });
  });

  describe('non-short post (episode)', () => {
    test('does not call downloadFromDrive for episode posts', async () => {
      await dispatchPost(makePost({ postType: 'episode' }), '2026-04-27');
      expect(downloadFromDrive).not.toHaveBeenCalled();
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

    test('does not download Drive video for short posts', async () => {
      await dispatchPost(makePost({ postType: 'short', platforms: ['bluesky'] }), '2026-04-27');
      expect(downloadFromDrive).not.toHaveBeenCalled();
    });

    test('logs what would be dispatched', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky', 'mastodon'] }), '2026-04-27');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DRY_RUN'));
      consoleSpy.mockRestore();
    });
  });

  describe('gist post type', () => {
    test('does not call downloadFromDrive for gist posts', async () => {
      await dispatchPost(makePost({ postType: 'gist', platforms: ['bluesky', 'mastodon', 'linkedin'] }), '2026-04-27');
      expect(downloadFromDrive).not.toHaveBeenCalled();
    });

    test('calls fetchThumbnail with the post youtubeUrl for gist posts', async () => {
      await dispatchPost(makePost({ postType: 'gist', platforms: ['bluesky'] }), '2026-04-27');
      expect(fetchThumbnail).toHaveBeenCalledWith('https://youtu.be/abc123');
    });

    test('passes imageBuffer to postToBluesky for gist posts', async () => {
      await dispatchPost(makePost({ postType: 'gist', platforms: ['bluesky'] }), '2026-04-27');
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'gist' }),
        { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER }
      );
    });

    test('passes imageBuffer to postToMastodon for gist posts', async () => {
      await dispatchPost(makePost({ postType: 'gist', platforms: ['mastodon'] }), '2026-04-27');
      expect(postToMastodon).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'gist' }),
        { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER }
      );
    });

    test('passes imageBuffer to postToLinkedIn for gist posts', async () => {
      await dispatchPost(makePost({ postType: 'gist', platforms: ['linkedin'] }), '2026-04-27');
      expect(postToLinkedIn).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'gist' }),
        { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER }
      );
    });

    test('posts without image when fetchThumbnail throws for gist posts (non-fatal fallback)', async () => {
      fetchThumbnail.mockRejectedValue(new Error('network error'));
      await dispatchPost(makePost({ postType: 'gist', platforms: ['bluesky'] }), '2026-04-27');
      expect(postToBluesky).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'gist' }),
        { videoBuffer: null, imageBuffer: null }
      );
      expect(updatePostResult).toHaveBeenCalledWith(5, expect.objectContaining({ status: 'posted' }));
    });

    test('does not call fetchThumbnail when gist post has no youtubeUrl', async () => {
      await dispatchPost(makePost({ postType: 'gist', platforms: ['bluesky'], youtubeUrl: '' }), '2026-04-27');
      expect(fetchThumbnail).not.toHaveBeenCalled();
    });

    test('dispatches to micro.blog for gist posts with micro.blog platform', async () => {
      await dispatchPost(
        makePost({ postType: 'gist', platforms: ['micro.blog'], groupId: 'thunder-headlamp-gist' }),
        '2026-04-27'
      );
      expect(postToMicroblog).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'gist' }),
        { bypassViewCount: true, imageBuffer: FAKE_IMAGE_BUFFER }
      );
    });

    test('marks gist post as posted after successful dispatch', async () => {
      await dispatchPost(
        makePost({ postType: 'gist', platforms: ['bluesky'], groupId: 'thunder-headlamp-gist' }),
        '2026-04-27'
      );
      expect(updatePostResult).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ status: 'posted' })
      );
    });
  });

  describe('talk post type', () => {
    test('does not call downloadFromDrive for talk posts', async () => {
      await dispatchPost(makePost({ postType: 'talk', groupId: 'talk-otel-basics' }), '2026-04-27');
      expect(downloadFromDrive).not.toHaveBeenCalled();
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
        { bypassViewCount: true, imageBuffer: null }
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

  describe('skip platforms that already have a post URL (partial retry guard)', () => {
    test('skips Bluesky when bskyPostUrl is already populated', async () => {
      await dispatchPost(
        makePost({ postType: 'episode', platforms: ['bluesky', 'mastodon'], bskyPostUrl: 'https://bsky.app/profile/test/post/existing' }),
        '2026-04-27'
      );
      expect(postToBluesky).not.toHaveBeenCalled();
      expect(postToMastodon).toHaveBeenCalled();
    });

    test('skips Mastodon when mastodonPostUrl is already populated', async () => {
      await dispatchPost(
        makePost({ postType: 'episode', platforms: ['bluesky', 'mastodon'], mastodonPostUrl: 'https://mastodon.social/@test/existing' }),
        '2026-04-27'
      );
      expect(postToMastodon).not.toHaveBeenCalled();
      expect(postToBluesky).toHaveBeenCalled();
    });

    test('skips LinkedIn when linkedinPostUrl is already populated', async () => {
      await dispatchPost(
        makePost({ postType: 'episode', platforms: ['linkedin', 'bluesky'], linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:existing/' }),
        '2026-04-27'
      );
      expect(postToLinkedIn).not.toHaveBeenCalled();
      expect(postToBluesky).toHaveBeenCalled();
    });

    test('skips micro.blog when microblogPostUrl is already populated', async () => {
      await dispatchPost(
        makePost({ postType: 'episode', platforms: ['micro.blog', 'bluesky'], microblogPostUrl: 'https://micro.blog/test/existing' }),
        '2026-04-27'
      );
      expect(postToMicroblog).not.toHaveBeenCalled();
      expect(postToBluesky).toHaveBeenCalled();
    });

    test('still dispatches platforms that have no URL yet when some platforms already posted', async () => {
      await dispatchPost(
        makePost({
          postType: 'episode',
          platforms: ['bluesky', 'mastodon', 'linkedin'],
          bskyPostUrl: 'https://bsky.app/profile/test/post/existing',
          mastodonPostUrl: 'https://mastodon.social/@test/existing',
        }),
        '2026-04-27'
      );
      expect(postToBluesky).not.toHaveBeenCalled();
      expect(postToMastodon).not.toHaveBeenCalled();
      expect(postToLinkedIn).toHaveBeenCalled();
    });

    test('marks row as posted when all remaining platforms succeed on retry', async () => {
      await dispatchPost(
        makePost({
          postType: 'episode',
          platforms: ['bluesky', 'linkedin'],
          bskyPostUrl: 'https://bsky.app/profile/test/post/existing',
        }),
        '2026-04-27'
      );
      expect(updatePostResult).toHaveBeenCalledWith(5, expect.objectContaining({ status: 'posted' }));
    });

    test('marks row as failed when one remaining platform succeeds and another fails, capturing the successful URL', async () => {
      postToLinkedIn.mockRejectedValue(new Error('LinkedIn 401'));

      await dispatchPost(
        makePost({
          postType: 'episode',
          platforms: ['bluesky', 'mastodon', 'linkedin'],
          bskyPostUrl: 'https://bsky.app/profile/test/post/existing',
        }),
        '2026-04-27'
      );

      expect(postToBluesky).not.toHaveBeenCalled();
      expect(postToMastodon).toHaveBeenCalled();
      expect(postToLinkedIn).toHaveBeenCalled();
      expect(updatePostResult).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ status: 'failed', mastodonPostUrl: 'https://mastodon.social/@test/1' })
      );
    });

    test('dispatches normally when all URL fields are empty strings (fresh row)', async () => {
      await dispatchPost(
        makePost({
          postType: 'episode',
          platforms: ['bluesky', 'mastodon', 'linkedin'],
          bskyPostUrl: '',
          mastodonPostUrl: '',
          linkedinPostUrl: '',
          microblogPostUrl: '',
        }),
        '2026-04-27'
      );
      expect(postToBluesky).toHaveBeenCalled();
      expect(postToMastodon).toHaveBeenCalled();
      expect(postToLinkedIn).toHaveBeenCalled();
    });

    test('marks row as posted without calling any platform when all platforms already have URLs', async () => {
      await dispatchPost(
        makePost({
          postType: 'episode',
          platforms: ['bluesky', 'mastodon', 'linkedin'],
          bskyPostUrl: 'https://bsky.app/profile/test/post/existing',
          mastodonPostUrl: 'https://mastodon.social/@test/existing',
          linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:existing/',
        }),
        '2026-04-27'
      );
      expect(postToBluesky).not.toHaveBeenCalled();
      expect(postToMastodon).not.toHaveBeenCalled();
      expect(postToLinkedIn).not.toHaveBeenCalled();
      expect(updatePostResult).toHaveBeenCalledWith(5, expect.objectContaining({ status: 'posted' }));
    });
  });

  describe('micro.blog suppressCrossPosting', () => {
    test('passes suppressCrossPosting: true when micro.blog is one of multiple platforms', async () => {
      await dispatchPost(
        makePost({ postType: 'episode', platforms: ['bluesky', 'micro.blog'] }),
        '2026-04-27'
      );
      expect(postToMicroblog).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'episode' }),
        expect.objectContaining({ bypassViewCount: true, imageBuffer: FAKE_IMAGE_BUFFER, suppressCrossPosting: true })
      );
    });

    test('does not pass suppressCrossPosting: true when micro.blog is the only platform', async () => {
      await dispatchPost(
        makePost({ postType: 'episode', platforms: ['micro.blog'] }),
        '2026-04-27'
      );
      expect(postToMicroblog).toHaveBeenCalledWith(
        expect.objectContaining({ postType: 'episode' }),
        { bypassViewCount: true, imageBuffer: FAKE_IMAGE_BUFFER }
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
    checkSocialPostedToday.mockResolvedValue(false);
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

  test('(b) social day, career posted today: all dispatch skipped', async () => {
    process.env.CAREER_PRIORITY = '0';
    checkCareerPostedToday.mockResolvedValue(true);

    await processPostsForDate('2026-05-12');

    expect(fetchOldestPendingGroup).not.toHaveBeenCalled();
    expect(fetchOldestPendingMicroblogPost).not.toHaveBeenCalled();
  });

  test('(h) social day, career posted today, social pending: dispatch skipped', async () => {
    process.env.CAREER_PRIORITY = '0';
    checkCareerPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([FAKE_GROUP_POST]);

    await processPostsForDate('2026-05-12');

    expect(fetchOldestPendingGroup).not.toHaveBeenCalled();
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

  test('(f) social posted today on social-priority day: dispatch skipped', async () => {
    process.env.CAREER_PRIORITY = '0';
    checkSocialPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([FAKE_GROUP_POST]);

    await processPostsForDate('2026-05-12');

    expect(fetchOldestPendingGroup).not.toHaveBeenCalled();
    expect(fetchOldestPendingMicroblogPost).not.toHaveBeenCalled();
  });

  test('(g) social posted today on career-priority day: dispatch skipped', async () => {
    process.env.CAREER_PRIORITY = '1';
    checkCareerPostedToday.mockResolvedValue(false);
    checkSocialPostedToday.mockResolvedValue(true);

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

const TODAY_ODD = '2026-04-05'; // odd day — career priority
const EVEN_DAY = '2026-04-06'; // even day — social priority

function makeEpisodePost(overrides = {}) {
  return {
    rowIndex: 2,
    show: 'Thunder',
    title: 'Test Episode',
    postType: 'episode',
    postText: 'Check this out! https://youtu.be/abc',
    youtubeUrl: 'https://youtu.be/abc',
    altText: 'Thumbnail alt text',
    scheduledDate: '2026-04-05',
    platforms: ['bluesky'],
    status: 'pending',
    groupId: null,
    bskyPostUrl: '',
    linkedinPostUrl: '',
    mastodonPostUrl: '',
    microblogPostUrl: '',
    ...overrides,
  };
}

describe('processPostsForDate — full dispatch coverage', () => {
  beforeEach(() => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);
    checkCareerPostedToday.mockResolvedValue(false);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/abc' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@whitney/109375123456789012' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:123/' });
    postToMicroblog.mockResolvedValue({ postUrl: 'https://whitneylee.com/2026/04/test-episode' });
    scanAndPostShorts.mockResolvedValue(undefined);
    updatePostResult.mockResolvedValue(undefined);
    fetchThumbnail.mockResolvedValue(FAKE_IMAGE_BUFFER);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.CAREER_PRIORITY;
  });

  // ── Career guard ───────────────────────────────────────────────────────────

  test('skips dispatch on career-priority day (odd day) when career posted today', async () => {
    process.env.CAREER_PRIORITY = '1';
    checkCareerPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost()]);

    await processPostsForDate(TODAY_ODD);

    expect(postToBluesky).not.toHaveBeenCalled();
    expect(updatePostResult).not.toHaveBeenCalled();
  });

  test('skips dispatch on social-priority day (even day) when career already posted today', async () => {
    process.env.CAREER_PRIORITY = '0';
    checkCareerPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky'] })]);

    await processPostsForDate(EVEN_DAY);

    expect(fetchOldestPendingGroup).not.toHaveBeenCalled();
    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('proceeds normally when career has not posted today', async () => {
    checkCareerPostedToday.mockResolvedValue(false);
    const post = makeEpisodePost({ platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY_ODD);

    expect(postToBluesky).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  // ── Group dispatch ────────────────────────────────────────────────────────

  test('dispatches a single post from the group', async () => {
    const post = makeEpisodePost({ platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY_ODD);

    expect(postToBluesky).toHaveBeenCalledTimes(1);
    expect(postToBluesky).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('dispatches all posts in a group in one run', async () => {
    const bskyPost = makeEpisodePost({ rowIndex: 2, platforms: ['bluesky'], groupId: 'thunder-headlamp-ep' });
    const mastoPost = makeEpisodePost({ rowIndex: 3, platforms: ['mastodon'], groupId: 'thunder-headlamp-ep' });
    fetchOldestPendingGroup.mockResolvedValue([bskyPost, mastoPost]);

    await processPostsForDate(TODAY_ODD);

    expect(postToBluesky).toHaveBeenCalledWith(bskyPost, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
    expect(postToMastodon).toHaveBeenCalledWith(mastoPost, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
    expect(updatePostResult).toHaveBeenCalledTimes(2);
  });

  test('updates sheet with posted status and Bluesky URL on success', async () => {
    const post = makeEpisodePost({ rowIndex: 3, platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/xyz' });

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledWith(3, {
      status: 'posted',
      scheduledDate: TODAY_ODD,
      bskyPostUrl: 'https://bsky.app/profile/handle/post/xyz',
    });
  });

  test('skips Bluesky posting for rows without bluesky platform', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['mastodon'] })]);

    await processPostsForDate(TODAY_ODD);

    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('writes failed status and logs on Bluesky post failure without crashing', async () => {
    const post = makeEpisodePost({ rowIndex: 4, platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockRejectedValue(new Error('Network error'));

    await expect(processPostsForDate(TODAY_ODD)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(4, { status: 'failed' });
  });

  test('posts to Mastodon for a pending row with mastodon platform', async () => {
    const post = makeEpisodePost({ platforms: ['mastodon'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY_ODD);

    expect(postToMastodon).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('updates sheet with Mastodon URL on success', async () => {
    const post = makeEpisodePost({ rowIndex: 3, platforms: ['mastodon'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@whitney/109375987654321098' });

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledWith(3, {
      status: 'posted',
      scheduledDate: TODAY_ODD,
      mastodonPostUrl: 'https://mastodon.social/@whitney/109375987654321098',
    });
  });

  test('skips Mastodon posting for rows without mastodon platform', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky'] })]);

    await processPostsForDate(TODAY_ODD);

    expect(postToMastodon).not.toHaveBeenCalled();
  });

  test('writes failed status on Mastodon post failure without crashing', async () => {
    const post = makeEpisodePost({ rowIndex: 5, platforms: ['mastodon'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToMastodon.mockRejectedValue(new Error('Instance unavailable'));

    await expect(processPostsForDate(TODAY_ODD)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(5, { status: 'failed' });
  });

  test('posts to LinkedIn for a pending row with linkedin platform', async () => {
    const post = makeEpisodePost({ platforms: ['linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY_ODD);

    expect(postToLinkedIn).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('updates sheet with LinkedIn URL on success', async () => {
    const post = makeEpisodePost({ rowIndex: 7, platforms: ['linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:9876543210/' });

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledWith(7, {
      status: 'posted',
      scheduledDate: TODAY_ODD,
      linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:9876543210/',
    });
  });

  test('skips LinkedIn posting for rows without linkedin platform', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky'] })]);

    await processPostsForDate(TODAY_ODD);

    expect(postToLinkedIn).not.toHaveBeenCalled();
  });

  test('writes failed status on LinkedIn post failure without crashing', async () => {
    const post = makeEpisodePost({ rowIndex: 8, platforms: ['linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToLinkedIn.mockRejectedValue(new Error('Token expired'));

    await expect(processPostsForDate(TODAY_ODD)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(8, { status: 'failed' });
  });

  test('posts to all three platforms for a row with all platforms', async () => {
    const post = makeEpisodePost({ rowIndex: 9, platforms: ['bluesky', 'mastodon', 'linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY_ODD);

    expect(postToBluesky).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
    expect(postToMastodon).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
    expect(postToLinkedIn).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test("writes today's date to Column G on successful post", async () => {
    const post = makeEpisodePost({ rowIndex: 5, platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledWith(5, expect.objectContaining({
      status: 'posted',
      scheduledDate: TODAY_ODD,
    }));
  });

  test('does not write scheduledDate to Column G on failed post', async () => {
    const post = makeEpisodePost({ rowIndex: 6, platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockRejectedValue(new Error('API down'));

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledWith(6, expect.not.objectContaining({
      scheduledDate: expect.anything(),
    }));
  });

  test('includes micro.blog URL in aggregated result alongside other platforms', async () => {
    const post = makeEpisodePost({ rowIndex: 14, platforms: ['bluesky', 'micro.blog'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/ddd' });
    postToMicroblog.mockResolvedValue({ postUrl: 'https://whitneylee.com/2026/04/multi-platform' });

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledWith(14, {
      status: 'posted',
      scheduledDate: TODAY_ODD,
      bskyPostUrl: 'https://bsky.app/profile/handle/post/ddd',
      microblogPostUrl: 'https://whitneylee.com/2026/04/multi-platform',
    });
  });

  test('marks row as failed and unblocks queue when post has no dispatchable platforms', async () => {
    const post = makeEpisodePost({ rowIndex: 99, platforms: ['unknown-platform'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await expect(processPostsForDate(TODAY_ODD)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(99, { status: 'failed' });
    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('writes single aggregated result with all URLs when all three platforms succeed', async () => {
    const post = makeEpisodePost({ rowIndex: 10, platforms: ['bluesky', 'mastodon', 'linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/bbb' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@whitney/111' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:999/' });

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledTimes(1);
    expect(updatePostResult).toHaveBeenCalledWith(10, {
      status: 'posted',
      scheduledDate: TODAY_ODD,
      bskyPostUrl: 'https://bsky.app/profile/handle/post/bbb',
      mastodonPostUrl: 'https://mastodon.social/@whitney/111',
      linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:999/',
    });
  });

  test('sets status to failed but preserves successful URLs when one platform fails', async () => {
    const post = makeEpisodePost({ rowIndex: 11, platforms: ['bluesky', 'linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/ccc' });
    postToLinkedIn.mockRejectedValue(new Error('Token expired'));

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledTimes(1);
    expect(updatePostResult).toHaveBeenCalledWith(11, {
      status: 'failed',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/ccc',
    });
  });

  // ── Micro.blog deferral ────────────────────────────────────────────────────

  test('defers micro.blog when social queue is empty and career already posted today', async () => {
    process.env.CAREER_PRIORITY = '0';
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkCareerPostedToday.mockResolvedValue(true);

    await processPostsForDate(EVEN_DAY);

    expect(fetchOldestPendingMicroblogPost).not.toHaveBeenCalled();
    expect(postToMicroblog).not.toHaveBeenCalled();
  });

  test('dispatches micro.blog when social queue is empty and career has not posted today', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    const post = makeEpisodePost({ rowIndex: 20, platforms: ['micro.blog'] });
    fetchOldestPendingMicroblogPost.mockResolvedValue(post);

    await processPostsForDate(TODAY_ODD);

    expect(postToMicroblog).toHaveBeenCalledWith(post, { bypassViewCount: true, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('posts to micro.blog and writes result when eligible', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    const post = makeEpisodePost({ rowIndex: 12, platforms: ['micro.blog'] });
    fetchOldestPendingMicroblogPost.mockResolvedValue(post);
    postToMicroblog.mockResolvedValue({ postUrl: 'https://whitneylee.com/2026/04/my-episode' });

    await processPostsForDate(TODAY_ODD);

    expect(updatePostResult).toHaveBeenCalledWith(12, {
      status: 'posted',
      scheduledDate: TODAY_ODD,
      microblogPostUrl: 'https://whitneylee.com/2026/04/my-episode',
    });
  });

  test('does not dispatch micro.blog for short rows, leaves row pending (no Drive ID → skip)', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    // Short row with no driveVideoId — should be skipped, not marked failed
    const post = makeEpisodePost({ rowIndex: 15, postType: 'short', platforms: ['micro.blog'] });
    fetchOldestPendingMicroblogPost.mockResolvedValue(post);

    await processPostsForDate(TODAY_ODD);

    expect(postToMicroblog).not.toHaveBeenCalled();
    expect(updatePostResult).not.toHaveBeenCalled(); // row stays pending per PRD spec
  });

  test('does nothing when micro.blog queue is also empty and career has not posted today', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);

    await processPostsForDate(TODAY_ODD);

    expect(postToBluesky).not.toHaveBeenCalled();
    expect(postToMicroblog).not.toHaveBeenCalled();
    expect(updatePostResult).not.toHaveBeenCalled();
  });
});

describe('dispatchPost — failure flag return value', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadFromDrive.mockResolvedValue({ buffer: FAKE_VIDEO_BUFFER, mimeType: 'video/mp4', filename: 'video.mp4' });
    fetchThumbnail.mockResolvedValue(FAKE_IMAGE_BUFFER);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/test/post/1' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@test/1' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:1/' });
    postToMicroblog.mockResolvedValue({ postUrl: 'https://micro.blog/test/1' });
    updatePostResult.mockResolvedValue(undefined);
  });

  test('returns false when all platforms succeed', async () => {
    const result = await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky', 'mastodon'] }), '2026-04-27');
    expect(result).toBe(false);
  });

  test('returns true when one platform fails and others succeed', async () => {
    postToLinkedIn.mockRejectedValue(new Error('LinkedIn 401'));
    const result = await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky', 'linkedin'] }), '2026-04-27');
    expect(result).toBe(true);
  });

  test('returns true when all platforms fail', async () => {
    postToBluesky.mockRejectedValue(new Error('Bluesky down'));
    postToMastodon.mockRejectedValue(new Error('Mastodon down'));
    const result = await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky', 'mastodon'] }), '2026-04-27');
    expect(result).toBe(true);
  });

  test('returns false in DRY_RUN mode regardless of what platform mocks would do', async () => {
    process.env.DRY_RUN = 'true';
    postToBluesky.mockRejectedValue(new Error('would fail if called'));
    const result = await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky'] }), '2026-04-27');
    expect(result).toBe(false);
    delete process.env.DRY_RUN;
  });
});

describe('processPostsForDate — failure flag return value', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkSocialPostedToday.mockResolvedValue(false);
    checkCareerPostedToday.mockResolvedValue(false);
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/test/post/1' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@test/1' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:1/' });
    updatePostResult.mockResolvedValue(undefined);
    fetchThumbnail.mockResolvedValue(FAKE_IMAGE_BUFFER);
  });

  test('returns false when all platforms succeed', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky'] })]);
    const result = await processPostsForDate('2026-04-27');
    expect(result).toBe(false);
  });

  test('returns true when one platform fails', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky', 'linkedin'] })]);
    postToLinkedIn.mockRejectedValue(new Error('fail'));
    const result = await processPostsForDate('2026-04-27');
    expect(result).toBe(true);
  });

  test('returns true when all platforms fail', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky', 'mastodon'] })]);
    postToBluesky.mockRejectedValue(new Error('fail'));
    postToMastodon.mockRejectedValue(new Error('fail'));
    const result = await processPostsForDate('2026-04-27');
    expect(result).toBe(true);
  });

  test('returns false when no posts are dispatched (empty queue)', async () => {
    const result = await processPostsForDate('2026-04-27');
    expect(result).toBe(false);
  });

  test('returns false when dispatch is skipped due to social-posted-today gate', async () => {
    checkSocialPostedToday.mockResolvedValue(true);
    const result = await processPostsForDate('2026-04-27');
    expect(result).toBe(false);
  });
});

describe('main — exit code on partial platform failure', () => {
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    checkSocialPostedToday.mockResolvedValue(false);
    checkCareerPostedToday.mockResolvedValue(false);
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);
    scanAndPostShorts.mockResolvedValue(undefined);
    updatePostResult.mockResolvedValue(undefined);
    fetchThumbnail.mockResolvedValue(FAKE_IMAGE_BUFFER);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/test/post/1' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@test/1' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:1/' });
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    delete process.env.DRY_RUN;
  });

  test('exits 0 (no process.exit(1)) when all platforms succeed', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky'] })]);
    await main();
    expect(processExitSpy).not.toHaveBeenCalledWith(1);
  });

  test('exits 1 when one platform fails and others succeed', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky', 'linkedin'] })]);
    postToLinkedIn.mockRejectedValue(new Error('Token expired'));
    await main();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('exits 1 when all platforms fail', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky', 'mastodon'] })]);
    postToBluesky.mockRejectedValue(new Error('Bluesky down'));
    postToMastodon.mockRejectedValue(new Error('Mastodon down'));
    await main();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('exits 0 in DRY_RUN mode even when platforms would fail if called', async () => {
    process.env.DRY_RUN = 'true';
    fetchOldestPendingGroup.mockResolvedValue([makeEpisodePost({ platforms: ['bluesky'] })]);
    // dispatchPost returns early in DRY_RUN before calling any platform, so failures are never tracked
    await main();
    expect(processExitSpy).not.toHaveBeenCalledWith(1);
  });
});

describe('getSlot', () => {
  test('returns morning for UTC hours before 17 (covers 8am CDT cron at 13:00 UTC)', () => {
    expect(getSlot(new Date('2026-06-18T13:00:00Z'))).toBe('morning');
  });

  test('returns evening for UTC hour 21 (covers 4pm CDT cron at 21:00 UTC)', () => {
    expect(getSlot(new Date('2026-06-18T21:00:00Z'))).toBe('evening');
  });

  test('boundary: UTC hour 16 is morning', () => {
    expect(getSlot(new Date('2026-06-18T16:59:00Z'))).toBe('morning');
  });

  test('boundary: UTC hour 17 is evening', () => {
    expect(getSlot(new Date('2026-06-18T17:00:00Z'))).toBe('evening');
  });
});

describe('processPostsForDate — two-post mode (TWO_POSTS_PER_DAY=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DRY_RUN = 'true';
    process.env.TWO_POSTS_PER_DAY = 'true';
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);
    checkCareerPostedToday.mockResolvedValue(false);
    checkSocialPostedToday.mockResolvedValue(false);
  });

  afterEach(() => {
    delete process.env.DRY_RUN;
    delete process.env.TWO_POSTS_PER_DAY;
  });

  test('social dispatches even when career has already posted today', async () => {
    checkCareerPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([FAKE_GROUP_POST]);

    await processPostsForDate('2026-06-18');

    expect(fetchOldestPendingGroup).toHaveBeenCalled();
  });

  test('social guard still applies — skips if social already posted today', async () => {
    checkSocialPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([FAKE_GROUP_POST]);

    await processPostsForDate('2026-06-18');

    expect(fetchOldestPendingGroup).not.toHaveBeenCalled();
  });

  test('micro.blog is deferred when social queue empty and career has already posted', async () => {
    checkCareerPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(FAKE_MICROBLOG_POST);

    await processPostsForDate('2026-06-18');

    expect(fetchOldestPendingMicroblogPost).not.toHaveBeenCalled();
  });

  test('micro.blog dispatches when social queue empty and career has not posted', async () => {
    checkCareerPostedToday.mockResolvedValue(false);
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(FAKE_MICROBLOG_POST);

    await processPostsForDate('2026-06-18');

    expect(fetchOldestPendingMicroblogPost).toHaveBeenCalled();
  });
});

describe('processPostsForDate — single-post mode unchanged when TWO_POSTS_PER_DAY=false', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DRY_RUN = 'true';
    process.env.TWO_POSTS_PER_DAY = 'false';
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);
    checkCareerPostedToday.mockResolvedValue(false);
    checkSocialPostedToday.mockResolvedValue(false);
  });

  afterEach(() => {
    delete process.env.DRY_RUN;
    delete process.env.TWO_POSTS_PER_DAY;
  });

  test('career posted today blocks social dispatch (single-post mode behavior preserved)', async () => {
    checkCareerPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([FAKE_GROUP_POST]);

    await processPostsForDate('2026-06-18');

    expect(fetchOldestPendingGroup).not.toHaveBeenCalled();
  });
});

describe('processPostsForDate — two-post mode evening fallback (IS_MORNING_SLOT=false)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DRY_RUN = 'true';
    process.env.TWO_POSTS_PER_DAY = 'true';
    process.env.IS_MORNING_SLOT = 'false';
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);
    checkCareerPostedToday.mockResolvedValue(false);
    checkSocialPostedToday.mockResolvedValue(true); // social already posted this morning
  });

  afterEach(() => {
    delete process.env.DRY_RUN;
    delete process.env.TWO_POSTS_PER_DAY;
    delete process.env.IS_MORNING_SLOT;
  });

  test('empty career queue with pending social dispatches social (bypasses social guard)', async () => {
    fetchOldestPendingGroup.mockResolvedValue([FAKE_GROUP_POST]);

    await processPostsForDate('2026-06-19');

    expect(fetchOldestPendingGroup).toHaveBeenCalled();
  });

  test('career already posted today — skips social dispatch', async () => {
    checkCareerPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([FAKE_GROUP_POST]);

    await processPostsForDate('2026-06-19');

    expect(fetchOldestPendingGroup).not.toHaveBeenCalled();
  });

  test('both queues empty — exits cleanly returning false', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);

    await expect(processPostsForDate('2026-06-19')).resolves.toBe(false);
  });
});

const { submitPostResultMetric } = require('../src/post-social-content');

describe('submitPostResultMetric', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    delete process.env.DD_API_KEY;
  });

  test('is a no-op when DD_API_KEY is not set', async () => {
    delete process.env.DD_API_KEY;
    await submitPostResultMetric('linkedin', true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('submits gauge value 1 to Datadog on success', async () => {
    process.env.DD_API_KEY = 'test-dd-key';
    await submitPostResultMetric('bluesky', true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.datadoghq.com/api/v2/series',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'DD-API-KEY': 'test-dd-key' }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.series[0].metric).toBe('content_manager.social_post.result');
    expect(body.series[0].points[0].value).toBe(1);
    expect(body.series[0].tags).toContain('platform:bluesky');
  });

  test('submits gauge value 0 to Datadog on failure', async () => {
    process.env.DD_API_KEY = 'test-dd-key';
    await submitPostResultMetric('mastodon', false);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.series[0].points[0].value).toBe(0);
    expect(body.series[0].tags).toContain('platform:mastodon');
  });

  test('does not throw when Datadog returns a non-ok response', async () => {
    process.env.DD_API_KEY = 'test-dd-key';
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' });
    await expect(submitPostResultMetric('linkedin', true)).resolves.toBeUndefined();
  });

  test('does not throw when fetch rejects', async () => {
    process.env.DD_API_KEY = 'test-dd-key';
    fetchMock.mockRejectedValue(new Error('network error'));
    await expect(submitPostResultMetric('linkedin', false)).resolves.toBeUndefined();
  });
});

describe('dispatchPost — emits post result metrics per platform', () => {
  let fetchMock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    process.env.DD_API_KEY = 'test-dd-key';
    delete process.env.DRY_RUN;
    downloadFromDrive.mockResolvedValue({ buffer: FAKE_VIDEO_BUFFER, mimeType: 'video/mp4', filename: 'video.mp4' });
    fetchThumbnail.mockResolvedValue(FAKE_IMAGE_BUFFER);
    updatePostResult.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.DD_API_KEY;
  });

  function metricCalls() {
    return fetchMock.mock.calls.filter(call => call[0] === 'https://api.datadoghq.com/api/v2/series');
  }

  test('bluesky success emits metric with value 1', async () => {
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/post/1' });
    await dispatchPost(makePost({ postType: 'episode', platforms: ['bluesky'], driveVideoId: null, youtubeUrl: 'https://youtu.be/abc' }), '2026-06-19');

    const calls = metricCalls();
    expect(calls.length).toBe(1);
    const body = JSON.parse(calls[0][1].body);
    expect(body.series[0].tags).toContain('platform:bluesky');
    expect(body.series[0].points[0].value).toBe(1);
  });

  test('mastodon failure emits metric with value 0', async () => {
    postToMastodon.mockRejectedValue(new Error('mastodon down'));
    await dispatchPost(makePost({ postType: 'episode', platforms: ['mastodon'], driveVideoId: null, youtubeUrl: 'https://youtu.be/abc' }), '2026-06-19');

    const calls = metricCalls();
    expect(calls.length).toBe(1);
    const body = JSON.parse(calls[0][1].body);
    expect(body.series[0].tags).toContain('platform:mastodon');
    expect(body.series[0].points[0].value).toBe(0);
  });

  test('linkedin success and bluesky failure each emit independent metrics', async () => {
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://linkedin.com/post/1' });
    postToBluesky.mockRejectedValue(new Error('bluesky error'));
    const post = makePost({ postType: 'episode', platforms: ['linkedin', 'bluesky'], driveVideoId: null, youtubeUrl: 'https://youtu.be/abc' });

    await dispatchPost(post, '2026-06-19');

    const calls = metricCalls();
    expect(calls.length).toBe(2);
    const linkedinCall = calls.find(c => JSON.parse(c[1].body).series[0].tags.includes('platform:linkedin'));
    const blueskyCall = calls.find(c => JSON.parse(c[1].body).series[0].tags.includes('platform:bluesky'));
    expect(JSON.parse(linkedinCall[1].body).series[0].points[0].value).toBe(1);
    expect(JSON.parse(blueskyCall[1].body).series[0].points[0].value).toBe(0);
  });
});
