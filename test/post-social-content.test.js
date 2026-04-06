// ABOUTME: Tests for the daily cron dispatcher that sends pending posts to social platforms.
// ABOUTME: Verifies Bluesky, Mastodon, and LinkedIn dispatch, status updates, and graceful failure handling.

'use strict';

jest.mock('../src/social-posts-queue');
jest.mock('../src/post-bluesky');
// post-mastodon loads masto which has ESM-only transitive deps — use manual factory
jest.mock('../src/post-mastodon', () => ({
  postToMastodon: jest.fn(),
}));
jest.mock('../src/post-linkedin');
jest.mock('../src/update-social-post-status');

const { fetchPendingPostsForToday } = require('../src/social-posts-queue');
const { postToBluesky } = require('../src/post-bluesky');
const { postToMastodon } = require('../src/post-mastodon');
const { postToLinkedIn } = require('../src/post-linkedin');
const { updatePostResult } = require('../src/update-social-post-status');
const { processPostsForDate } = require('../src/post-social-content');

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
    bskyPostUrl: '',
    linkedinPostUrl: '',
    mastodonPostUrl: '',
    microblogPostUrl: '',
    ...overrides,
  };
}

const TODAY = '2026-04-05';

describe('processPostsForDate', () => {
  beforeEach(() => {
    fetchPendingPostsForToday.mockResolvedValue([]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/abc' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@whitney/109375123456789012' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:123/' });
    updatePostResult.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns early without dispatching when no posts are due', async () => {
    fetchPendingPostsForToday.mockResolvedValue([]);
    await processPostsForDate(TODAY);
    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('posts to Bluesky for a pending row with bluesky platform', async () => {
    const post = makePost({ platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post);
  });

  test('updates sheet with posted status and Bluesky URL on success', async () => {
    const post = makePost({ rowIndex: 3, platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/xyz' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(3, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/xyz',
    });
  });

  test('skips Bluesky posting for rows without bluesky platform', async () => {
    const post = makePost({ platforms: ['mastodon'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('writes failed status and logs on Bluesky post failure without crashing', async () => {
    const post = makePost({ rowIndex: 4, platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToBluesky.mockRejectedValue(new Error('Network error'));

    await expect(processPostsForDate(TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(4, { status: 'failed' });
  });

  test('continues processing remaining posts after a single failure', async () => {
    const failPost = makePost({ rowIndex: 2, platforms: ['bluesky'] });
    const okPost = makePost({ rowIndex: 3, platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([failPost, okPost]);
    postToBluesky
      .mockRejectedValueOnce(new Error('Failure'))
      .mockResolvedValueOnce({ postUrl: 'https://bsky.app/profile/handle/post/ok' });

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledTimes(2);
    expect(updatePostResult).toHaveBeenCalledWith(2, { status: 'failed' });
    expect(updatePostResult).toHaveBeenCalledWith(3, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/ok',
    });
  });

  test('processes posts with multiple platforms including bluesky', async () => {
    const post = makePost({ platforms: ['bluesky', 'mastodon'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post);
  });

  test('posts to Mastodon for a pending row with mastodon platform', async () => {
    const post = makePost({ platforms: ['mastodon'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToMastodon).toHaveBeenCalledWith(post);
  });

  test('updates sheet with posted status and Mastodon URL on success', async () => {
    const post = makePost({ rowIndex: 3, platforms: ['mastodon'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@whitney/109375987654321098' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(3, {
      status: 'posted',
      mastodonPostUrl: 'https://mastodon.social/@whitney/109375987654321098',
    });
  });

  test('skips Mastodon posting for rows without mastodon platform', async () => {
    const post = makePost({ platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToMastodon).not.toHaveBeenCalled();
  });

  test('writes failed status and logs on Mastodon post failure without crashing', async () => {
    const post = makePost({ rowIndex: 5, platforms: ['mastodon'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToMastodon.mockRejectedValue(new Error('Instance unavailable'));

    await expect(processPostsForDate(TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(5, { status: 'failed' });
  });

  test('posts to both Bluesky and Mastodon for a row with both platforms', async () => {
    const post = makePost({ rowIndex: 6, platforms: ['bluesky', 'mastodon'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post);
    expect(postToMastodon).toHaveBeenCalledWith(post);
  });

  test('posts to LinkedIn for a pending row with linkedin platform', async () => {
    const post = makePost({ platforms: ['linkedin'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToLinkedIn).toHaveBeenCalledWith(post);
  });

  test('updates sheet with posted status and LinkedIn URL on success', async () => {
    const post = makePost({ rowIndex: 7, platforms: ['linkedin'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:9876543210/' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(7, {
      status: 'posted',
      linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:9876543210/',
    });
  });

  test('skips LinkedIn posting for rows without linkedin platform', async () => {
    const post = makePost({ platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToLinkedIn).not.toHaveBeenCalled();
  });

  test('writes failed status and logs on LinkedIn post failure without crashing', async () => {
    const post = makePost({ rowIndex: 8, platforms: ['linkedin'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToLinkedIn.mockRejectedValue(new Error('Token expired'));

    await expect(processPostsForDate(TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(8, { status: 'failed' });
  });

  test('posts to all three platforms for a row with all platforms', async () => {
    const post = makePost({ rowIndex: 9, platforms: ['bluesky', 'mastodon', 'linkedin'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post);
    expect(postToMastodon).toHaveBeenCalledWith(post);
    expect(postToLinkedIn).toHaveBeenCalledWith(post);
  });

  test('writes single aggregated result with all URLs when all three platforms succeed', async () => {
    const post = makePost({ rowIndex: 10, platforms: ['bluesky', 'mastodon', 'linkedin'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/bbb' });
    postToMastodon.mockResolvedValue({ postUrl: 'https://mastodon.social/@whitney/111' });
    postToLinkedIn.mockResolvedValue({ postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:999/' });

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledTimes(1);
    expect(updatePostResult).toHaveBeenCalledWith(10, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/bbb',
      mastodonPostUrl: 'https://mastodon.social/@whitney/111',
      linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:999/',
    });
  });

  test('sets status to failed but preserves successful URLs when one platform fails', async () => {
    const post = makePost({ rowIndex: 11, platforms: ['bluesky', 'linkedin'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/ccc' });
    postToLinkedIn.mockRejectedValue(new Error('Token expired'));

    await processPostsForDate(TODAY);

    expect(updatePostResult).toHaveBeenCalledTimes(1);
    expect(updatePostResult).toHaveBeenCalledWith(11, {
      status: 'failed',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/ccc',
    });
  });
});
