// ABOUTME: Tests for the daily cron dispatcher that sends pending posts to social platforms.
// ABOUTME: Verifies group dispatch, micro.blog deferral, platform routing, status updates, and failure handling.

'use strict';

jest.mock('../src/social-posts-queue');
jest.mock('../src/career-post-guard');
jest.mock('../src/post-bluesky');
// post-mastodon loads masto which has ESM-only transitive deps — use manual factory
jest.mock('../src/post-mastodon', () => ({
  postToMastodon: jest.fn(),
}));
jest.mock('../src/post-linkedin');
jest.mock('../src/post-microblog', () => ({
  scanAndPostShorts: jest.fn(),
  postToMicroblog: jest.fn(),
}));
jest.mock('../src/update-social-post-status');
jest.mock('../src/video-download', () => ({
  downloadShortVideo: jest.fn().mockReturnValue({ buffer: Buffer.from('fake'), mimeType: 'video/mp4', filename: 'video.mp4' }),
}));
jest.mock('../src/fetch-thumbnail', () => ({
  fetchThumbnail: jest.fn(),
}));

const { fetchOldestPendingGroup, fetchOldestPendingMicroblogPost } = require('../src/social-posts-queue');
const { checkCareerPostedToday, checkAllCareerPostsPublished } = require('../src/career-post-guard');
const { postToBluesky } = require('../src/post-bluesky');
const { postToMastodon } = require('../src/post-mastodon');
const { postToLinkedIn } = require('../src/post-linkedin');
const { scanAndPostShorts, postToMicroblog } = require('../src/post-microblog');
const { updatePostResult } = require('../src/update-social-post-status');
const { fetchThumbnail } = require('../src/fetch-thumbnail');
const { processPostsForDate } = require('../src/post-social-content');

const FAKE_IMAGE_BUFFER = Buffer.from('fake-thumbnail');

function makePost(overrides = {}) {
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

const TODAY = '2026-04-05'; // odd day — career priority
const EVEN_DAY = '2026-04-06'; // even day — social priority

describe('processPostsForDate', () => {
  beforeEach(() => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);
    checkCareerPostedToday.mockResolvedValue(false);
    checkAllCareerPostsPublished.mockResolvedValue(false);
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
    fetchOldestPendingGroup.mockResolvedValue([makePost()]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).not.toHaveBeenCalled();
    expect(updatePostResult).not.toHaveBeenCalled();
  });

  test('dispatches on social-priority day (even day) even when career posted today', async () => {
    process.env.CAREER_PRIORITY = '0';
    checkCareerPostedToday.mockResolvedValue(true);
    fetchOldestPendingGroup.mockResolvedValue([makePost({ platforms: ['bluesky'] })]);

    await processPostsForDate(EVEN_DAY);

    expect(postToBluesky).toHaveBeenCalled();
  });

  test('proceeds normally when career has not posted today', async () => {
    checkCareerPostedToday.mockResolvedValue(false);
    const post = makePost({ platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  // ── Non-micro.blog group dispatch ─────────────────────────────────────────

  test('returns early without dispatching when queue is empty and career backlog is not clear', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkAllCareerPostsPublished.mockResolvedValue(false);

    await processPostsForDate(TODAY);

    expect(postToBluesky).not.toHaveBeenCalled();
    expect(postToMicroblog).not.toHaveBeenCalled();
  });

  test('dispatches a single post from the group', async () => {
    const post = makePost({ platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledTimes(1);
    expect(postToBluesky).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('dispatches all posts in a group in one run', async () => {
    const bskyPost = makePost({ rowIndex: 2, platforms: ['bluesky'], groupId: 'thunder-headlamp-ep' });
    const mastoPost = makePost({ rowIndex: 3, platforms: ['mastodon'], groupId: 'thunder-headlamp-ep' });
    fetchOldestPendingGroup.mockResolvedValue([bskyPost, mastoPost]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(bskyPost, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
    expect(postToMastodon).toHaveBeenCalledWith(mastoPost, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
    expect(updatePostResult).toHaveBeenCalledTimes(2);
  });

  test('posts to Bluesky for a pending row with bluesky platform', async () => {
    const post = makePost({ platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('updates sheet with posted status and Bluesky URL on success', async () => {
    const post = makePost({ rowIndex: 3, platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/xyz' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(3, {
      status: 'posted',
      scheduledDate: TODAY,
      bskyPostUrl: 'https://bsky.app/profile/handle/post/xyz',
    });
  });

  test('skips Bluesky posting for rows without bluesky platform', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makePost({ platforms: ['mastodon'] })]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('writes failed status and logs on Bluesky post failure without crashing', async () => {
    const post = makePost({ rowIndex: 4, platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockRejectedValue(new Error('Network error'));

    await expect(processPostsForDate(TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(4, { status: 'failed' });
  });

  test('marks row as failed and unblocks queue when post has no dispatchable platforms', async () => {
    const post = makePost({ rowIndex: 99, platforms: ['unknown-platform'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await expect(processPostsForDate(TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(99, { status: 'failed' });
    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('posts to Mastodon for a pending row with mastodon platform', async () => {
    const post = makePost({ platforms: ['mastodon'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToMastodon).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('updates sheet with posted status and Mastodon URL on success', async () => {
    const post = makePost({ rowIndex: 3, platforms: ['mastodon'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@whitney/109375987654321098' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(3, {
      status: 'posted',
      scheduledDate: TODAY,
      mastodonPostUrl: 'https://mastodon.social/@whitney/109375987654321098',
    });
  });

  test('skips Mastodon posting for rows without mastodon platform', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makePost({ platforms: ['bluesky'] })]);

    await processPostsForDate(TODAY);

    expect(postToMastodon).not.toHaveBeenCalled();
  });

  test('writes failed status and logs on Mastodon post failure without crashing', async () => {
    const post = makePost({ rowIndex: 5, platforms: ['mastodon'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToMastodon.mockRejectedValue(new Error('Instance unavailable'));

    await expect(processPostsForDate(TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(5, { status: 'failed' });
  });

  test('posts to LinkedIn for a pending row with linkedin platform', async () => {
    const post = makePost({ platforms: ['linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToLinkedIn).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('updates sheet with posted status and LinkedIn URL on success', async () => {
    const post = makePost({ rowIndex: 7, platforms: ['linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:9876543210/' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(7, {
      status: 'posted',
      scheduledDate: TODAY,
      linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:9876543210/',
    });
  });

  test('skips LinkedIn posting for rows without linkedin platform', async () => {
    fetchOldestPendingGroup.mockResolvedValue([makePost({ platforms: ['bluesky'] })]);

    await processPostsForDate(TODAY);

    expect(postToLinkedIn).not.toHaveBeenCalled();
  });

  test('writes failed status and logs on LinkedIn post failure without crashing', async () => {
    const post = makePost({ rowIndex: 8, platforms: ['linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToLinkedIn.mockRejectedValue(new Error('Token expired'));

    await expect(processPostsForDate(TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(8, { status: 'failed' });
  });

  test('posts to all three platforms for a row with all platforms', async () => {
    const post = makePost({ rowIndex: 9, platforms: ['bluesky', 'mastodon', 'linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
    expect(postToMastodon).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
    expect(postToLinkedIn).toHaveBeenCalledWith(post, { videoBuffer: null, imageBuffer: FAKE_IMAGE_BUFFER });
  });

  test('writes today\'s date to Column G on successful post', async () => {
    const post = makePost({ rowIndex: 5, platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(5, expect.objectContaining({
      status: 'posted',
      scheduledDate: TODAY,
    }));
  });

  test('does not write scheduledDate to Column G on failed post', async () => {
    const post = makePost({ rowIndex: 6, platforms: ['bluesky'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockRejectedValue(new Error('API down'));

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(6, expect.not.objectContaining({
      scheduledDate: expect.anything(),
    }));
  });

  test('writes single aggregated result with all URLs when all three platforms succeed', async () => {
    const post = makePost({ rowIndex: 10, platforms: ['bluesky', 'mastodon', 'linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/bbb' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@whitney/111' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:999/' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledTimes(1);
    expect(updatePostResult).toHaveBeenCalledWith(10, {
      status: 'posted',
      scheduledDate: TODAY,
      bskyPostUrl: 'https://bsky.app/profile/handle/post/bbb',
      mastodonPostUrl: 'https://mastodon.social/@whitney/111',
      linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:999/',
    });
  });

  test('sets status to failed but preserves successful URLs when one platform fails', async () => {
    const post = makePost({ rowIndex: 11, platforms: ['bluesky', 'linkedin'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/ccc' });
    postToLinkedIn.mockRejectedValue(new Error('Token expired'));

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledTimes(1);
    expect(updatePostResult).toHaveBeenCalledWith(11, {
      status: 'failed',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/ccc',
    });
  });

  test('includes micro.blog URL in aggregated result alongside other platforms', async () => {
    // A row with bluesky + micro.blog is NOT micro.blog-only so it dispatches normally
    const post = makePost({ rowIndex: 14, platforms: ['bluesky', 'micro.blog'] });
    fetchOldestPendingGroup.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/ddd' });
    postToMicroblog.mockResolvedValue({ postUrl: 'https://whitneylee.com/2026/04/multi-platform' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledTimes(1);
    expect(updatePostResult).toHaveBeenCalledWith(14, {
      status: 'posted',
      scheduledDate: TODAY,
      bskyPostUrl: 'https://bsky.app/profile/handle/post/ddd',
      microblogPostUrl: 'https://whitneylee.com/2026/04/multi-platform',
    });
  });

  // ── Micro.blog deferral ────────────────────────────────────────────────────

  test('defers micro.blog when non-micro.blog queue is empty but career backlog is not clear', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkAllCareerPostsPublished.mockResolvedValue(false);

    await processPostsForDate(TODAY);

    expect(fetchOldestPendingMicroblogPost).not.toHaveBeenCalled();
    expect(postToMicroblog).not.toHaveBeenCalled();
  });

  test('dispatches micro.blog when non-micro.blog queue is empty and career backlog is clear', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkAllCareerPostsPublished.mockResolvedValue(true);
    const post = makePost({ rowIndex: 20, platforms: ['micro.blog'] });
    fetchOldestPendingMicroblogPost.mockResolvedValue(post);

    await processPostsForDate(TODAY);

    expect(postToMicroblog).toHaveBeenCalledWith(post, { bypassViewCount: true });
  });

  test('posts to micro.blog and writes result when eligible', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkAllCareerPostsPublished.mockResolvedValue(true);
    const post = makePost({ rowIndex: 12, platforms: ['micro.blog'] });
    fetchOldestPendingMicroblogPost.mockResolvedValue(post);
    postToMicroblog.mockResolvedValue({ postUrl: 'https://whitneylee.com/2026/04/my-episode' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(12, {
      status: 'posted',
      scheduledDate: TODAY,
      microblogPostUrl: 'https://whitneylee.com/2026/04/my-episode',
    });
  });

  test('does not dispatch micro.blog for short rows (dispatchPost safeguard)', async () => {
    // fetchOldestPendingMicroblogPost excludes shorts at the data layer; this tests
    // dispatchPost's own guard in case a short reaches it through other means.
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkAllCareerPostsPublished.mockResolvedValue(true);
    const post = makePost({ rowIndex: 15, postType: 'short', platforms: ['micro.blog'] });
    fetchOldestPendingMicroblogPost.mockResolvedValue(post);

    await processPostsForDate(TODAY);

    expect(postToMicroblog).not.toHaveBeenCalled();
    expect(updatePostResult).toHaveBeenCalledWith(15, { status: 'failed' });
  });

  test('writes failed status and logs on micro.blog post failure without crashing', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkAllCareerPostsPublished.mockResolvedValue(true);
    const post = makePost({ rowIndex: 13, platforms: ['micro.blog'] });
    fetchOldestPendingMicroblogPost.mockResolvedValue(post);
    postToMicroblog.mockRejectedValue(new Error('Micropub API error'));

    await expect(processPostsForDate(TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(13, { status: 'failed' });
  });

  test('does nothing when micro.blog queue is also empty after career backlog clears', async () => {
    fetchOldestPendingGroup.mockResolvedValue([]);
    checkAllCareerPostsPublished.mockResolvedValue(true);
    fetchOldestPendingMicroblogPost.mockResolvedValue(null);

    await processPostsForDate(TODAY);

    expect(postToBluesky).not.toHaveBeenCalled();
    expect(postToMicroblog).not.toHaveBeenCalled();
    expect(updatePostResult).not.toHaveBeenCalled();
  });
});
