// ABOUTME: Tests for the daily cron dispatcher that sends pending posts to social platforms.
// ABOUTME: Verifies Bluesky dispatch, status updates, and graceful failure handling.

'use strict';

jest.mock('../src/social-posts-queue');
jest.mock('../src/post-bluesky');
jest.mock('../src/update-social-post-status');

const { fetchPendingPostsForToday } = require('../src/social-posts-queue');
const { postToBluesky } = require('../src/post-bluesky');
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

const SHEET_ID = 'test-sheet-id';
const TODAY = '2026-04-05';

describe('processPostsForDate', () => {
  beforeEach(() => {
    fetchPendingPostsForToday.mockResolvedValue([]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/abc' });
    updatePostResult.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns early without dispatching when no posts are due', async () => {
    fetchPendingPostsForToday.mockResolvedValue([]);
    await processPostsForDate(SHEET_ID, TODAY);
    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('posts to Bluesky for a pending row with bluesky platform', async () => {
    const post = makePost({ platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(SHEET_ID, TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post);
  });

  test('updates sheet with posted status and Bluesky URL on success', async () => {
    const post = makePost({ rowIndex: 3, platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToBluesky.mockResolvedValue({ postUrl: 'https://bsky.app/profile/handle/post/xyz' });

    await processPostsForDate(SHEET_ID, TODAY);

    expect(updatePostResult).toHaveBeenCalledWith(SHEET_ID, 3, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/xyz',
    });
  });

  test('skips Bluesky posting for rows without bluesky platform', async () => {
    const post = makePost({ platforms: ['mastodon'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(SHEET_ID, TODAY);

    expect(postToBluesky).not.toHaveBeenCalled();
  });

  test('writes failed status and logs on Bluesky post failure without crashing', async () => {
    const post = makePost({ rowIndex: 4, platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);
    postToBluesky.mockRejectedValue(new Error('Network error'));

    await expect(processPostsForDate(SHEET_ID, TODAY)).resolves.not.toThrow();

    expect(updatePostResult).toHaveBeenCalledWith(SHEET_ID, 4, { status: 'failed' });
  });

  test('continues processing remaining posts after a single failure', async () => {
    const failPost = makePost({ rowIndex: 2, platforms: ['bluesky'] });
    const okPost = makePost({ rowIndex: 3, platforms: ['bluesky'] });
    fetchPendingPostsForToday.mockResolvedValue([failPost, okPost]);
    postToBluesky
      .mockRejectedValueOnce(new Error('Failure'))
      .mockResolvedValueOnce({ postUrl: 'https://bsky.app/profile/handle/post/ok' });

    await processPostsForDate(SHEET_ID, TODAY);

    expect(postToBluesky).toHaveBeenCalledTimes(2);
    expect(updatePostResult).toHaveBeenCalledWith(SHEET_ID, 2, { status: 'failed' });
    expect(updatePostResult).toHaveBeenCalledWith(SHEET_ID, 3, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/ok',
    });
  });

  test('processes posts with multiple platforms including bluesky', async () => {
    const post = makePost({ platforms: ['bluesky', 'mastodon'] });
    fetchPendingPostsForToday.mockResolvedValue([post]);

    await processPostsForDate(SHEET_ID, TODAY);

    expect(postToBluesky).toHaveBeenCalledWith(post);
  });
});
