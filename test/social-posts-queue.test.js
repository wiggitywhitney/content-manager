// ABOUTME: Tests for the social-posts-queue module that reads pending posts from the social queue sheet.

'use strict';

jest.mock('googleapis');

const { google } = require('googleapis');
const { parseSocialPostRows, filterPostsForDate, fetchOldestPendingPost, fetchRecentShortRows } = require('../src/social-posts-queue');

// Schema columns (0-indexed):
// A(0)=Show, B(1)=Episode/Short Title, C(2)=Post Type, D(3)=Post Text,
// E(4)=YouTube URL, F(5)=Alt Text, G(6)=Scheduled Date, H(7)=Platforms,
// I(8)=Status, J(9)=LinkedIn Post URL, K(10)=Bluesky Post URL,
// L(11)=Mastodon Post URL, M(12)=micro.blog Post URL

function makeRow({
  show = 'Thunder',
  title = 'Test Episode',
  postType = 'episode',
  postText = 'Hello world',
  youtubeUrl = 'https://youtu.be/abc123',
  altText = 'A test video',
  scheduledDate = '2026-04-05',
  platforms = 'bluesky,mastodon',
  status = 'pending',
  linkedinUrl = '',
  bskyUrl = '',
  mastodonUrl = '',
  microblogUrl = '',
} = {}) {
  return [show, title, postType, postText, youtubeUrl, altText, scheduledDate, platforms, status, linkedinUrl, bskyUrl, mastodonUrl, microblogUrl];
}

describe('parseSocialPostRows', () => {
  test('parses a single valid row into a post object', () => {
    const rows = [makeRow()];
    const posts = parseSocialPostRows(rows);

    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({
      rowIndex: 1, // 1-indexed (0 is header)
      show: 'Thunder',
      title: 'Test Episode',
      postType: 'episode',
      postText: 'Hello world',
      youtubeUrl: 'https://youtu.be/abc123',
      altText: 'A test video',
      scheduledDate: '2026-04-05',
      platforms: ['bluesky', 'mastodon'],
      status: 'pending',
      linkedinPostUrl: '',
      bskyPostUrl: '',
      mastodonPostUrl: '',
      microblogPostUrl: '',
    });
  });

  test('skips the header row if present', () => {
    const header = ['Show', 'Episode/Short Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LinkedIn Post URL', 'Bluesky Post URL', 'Mastodon Post URL', 'micro.blog Post URL'];
    const rows = [header, makeRow()];
    const posts = parseSocialPostRows(rows, { hasHeader: true });

    expect(posts).toHaveLength(1);
    expect(posts[0].rowIndex).toBe(2); // data row is at index 2 (1-indexed)
  });

  test('trims whitespace from platform names', () => {
    const rows = [makeRow({ platforms: ' bluesky , mastodon , linkedin ' })];
    const posts = parseSocialPostRows(rows);

    expect(posts[0].platforms).toEqual(['bluesky', 'mastodon', 'linkedin']);
  });

  test('handles single platform without comma', () => {
    const rows = [makeRow({ platforms: 'bluesky' })];
    const posts = parseSocialPostRows(rows);

    expect(posts[0].platforms).toEqual(['bluesky']);
  });

  test('parses multiple rows with correct rowIndex', () => {
    const rows = [
      makeRow({ title: 'First' }),
      makeRow({ title: 'Second' }),
      makeRow({ title: 'Third' }),
    ];
    const posts = parseSocialPostRows(rows);

    expect(posts).toHaveLength(3);
    expect(posts[0].rowIndex).toBe(1);
    expect(posts[1].rowIndex).toBe(2);
    expect(posts[2].rowIndex).toBe(3);
  });

  test('skips rows with missing required fields (empty row)', () => {
    const rows = [makeRow(), [], makeRow({ title: 'Third' })];
    const posts = parseSocialPostRows(rows);

    expect(posts).toHaveLength(2);
  });

  test('normalizes status to lowercase', () => {
    const rows = [makeRow({ status: 'Pending' }), makeRow({ status: 'POSTED' })];
    const posts = parseSocialPostRows(rows);

    expect(posts[0].status).toBe('pending');
    expect(posts[1].status).toBe('posted');
  });

  test('includes rows with empty scheduledDate (written-to-queue posts before dispatch)', () => {
    const rows = [makeRow({ scheduledDate: '' })];
    const posts = parseSocialPostRows(rows);

    expect(posts).toHaveLength(1);
    expect(posts[0].scheduledDate).toBe('');
  });
});

describe('filterPostsForDate', () => {
  test('returns posts matching the given date with pending status', () => {
    const posts = [
      { scheduledDate: '2026-04-05', status: 'pending', platforms: ['bluesky'] },
      { scheduledDate: '2026-04-06', status: 'pending', platforms: ['bluesky'] },
      { scheduledDate: '2026-04-05', status: 'posted', platforms: ['bluesky'] },
    ];

    const result = filterPostsForDate(posts, '2026-04-05');
    expect(result).toHaveLength(1);
    expect(result[0].scheduledDate).toBe('2026-04-05');
    expect(result[0].status).toBe('pending');
  });

  test('returns empty array when no posts match', () => {
    const posts = [
      { scheduledDate: '2026-04-06', status: 'pending', platforms: ['bluesky'] },
    ];

    const result = filterPostsForDate(posts, '2026-04-05');
    expect(result).toHaveLength(0);
  });

  test('returns empty array for empty input', () => {
    const result = filterPostsForDate([], '2026-04-05');
    expect(result).toHaveLength(0);
  });

  test('filters by platform when platform is specified', () => {
    const posts = [
      { scheduledDate: '2026-04-05', status: 'pending', platforms: ['bluesky', 'mastodon'] },
      { scheduledDate: '2026-04-05', status: 'pending', platforms: ['linkedin'] },
    ];

    const result = filterPostsForDate(posts, '2026-04-05', { platform: 'bluesky' });
    expect(result).toHaveLength(1);
    expect(result[0].platforms).toContain('bluesky');
  });

  test('does not filter by platform when platform is not specified', () => {
    const posts = [
      { scheduledDate: '2026-04-05', status: 'pending', platforms: ['bluesky'] },
      { scheduledDate: '2026-04-05', status: 'pending', platforms: ['linkedin'] },
    ];

    const result = filterPostsForDate(posts, '2026-04-05');
    expect(result).toHaveLength(2);
  });

  test('excludes failed posts', () => {
    const posts = [
      { scheduledDate: '2026-04-05', status: 'failed', platforms: ['bluesky'] },
    ];

    const result = filterPostsForDate(posts, '2026-04-05');
    expect(result).toHaveLength(0);
  });
});

describe('fetchOldestPendingPost', () => {
  let mockGet;

  function makeSheetsMock(rows) {
    mockGet = jest.fn().mockResolvedValue({ data: { values: rows } });
    google.sheets.mockReturnValue({ spreadsheets: { values: { get: mockGet } } });
    google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
  }

  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
  });

  afterEach(() => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.clearAllMocks();
  });

  test('throws if GOOGLE_SERVICE_ACCOUNT_JSON is not set', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    await expect(fetchOldestPendingPost()).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_JSON');
  });

  test('returns the oldest pending post regardless of scheduledDate', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    const oldPending = makeRow({ title: 'Old Post', scheduledDate: '', status: 'pending' });
    const newPending = makeRow({ title: 'New Post', scheduledDate: '', status: 'pending' });
    makeSheetsMock([header, oldPending, newPending]);

    const result = await fetchOldestPendingPost();
    expect(result).not.toBeNull();
    expect(result.title).toBe('Old Post');
  });

  test('returns null when queue has no pending posts', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    const postedRow = makeRow({ status: 'posted' });
    makeSheetsMock([header, postedRow]);

    const result = await fetchOldestPendingPost();
    expect(result).toBeNull();
  });

  test('returns null when queue is empty', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    makeSheetsMock([header]);

    const result = await fetchOldestPendingPost();
    expect(result).toBeNull();
  });

  test('skips posted and failed rows, returns oldest pending', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    const postedRow = makeRow({ title: 'Posted', status: 'posted' });
    const failedRow = makeRow({ title: 'Failed', status: 'failed' });
    const pendingRow = makeRow({ title: 'Pending', status: 'pending' });
    makeSheetsMock([header, postedRow, failedRow, pendingRow]);

    const result = await fetchOldestPendingPost();
    expect(result.title).toBe('Pending');
  });

  test('skips short posts — they are handled by view-count scan, not regular dispatch', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    const shortRow = makeRow({ title: 'Short', postType: 'short', status: 'pending' });
    const episodeRow = makeRow({ title: 'Episode', postType: 'episode', status: 'pending' });
    makeSheetsMock([header, shortRow, episodeRow]);

    const result = await fetchOldestPendingPost();
    expect(result.title).toBe('Episode');
  });
});

describe('fetchRecentShortRows', () => {
  let mockGet;

  function makeSheetsMock(rows) {
    mockGet = jest.fn().mockResolvedValue({ data: { values: rows } });
    google.sheets.mockReturnValue({ spreadsheets: { values: { get: mockGet } } });
    google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
  }

  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
  });

  afterEach(() => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.clearAllMocks();
  });

  test('throws if GOOGLE_SERVICE_ACCOUNT_JSON is not set', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    await expect(fetchRecentShortRows()).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_JSON');
  });

  test('returns only rows with postType short', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    const shortRow = makeRow({ postType: 'short' });
    const episodeRow = makeRow({ postType: 'episode' });
    makeSheetsMock([header, shortRow, episodeRow]);

    const result = await fetchRecentShortRows();
    expect(result).toHaveLength(1);
    expect(result[0].postType).toBe('short');
  });

  test('returns the last N short rows when more than limit exist', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    const rows = [header];
    for (let i = 1; i <= 15; i++) {
      rows.push(makeRow({ postType: 'short', title: `Short ${i}`, youtubeUrl: `https://youtu.be/id${i}` }));
    }
    makeSheetsMock(rows);

    const result = await fetchRecentShortRows(10);
    expect(result).toHaveLength(10);
    expect(result[0].title).toBe('Short 6');
    expect(result[9].title).toBe('Short 15');
  });

  test('returns empty array when no short rows exist', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    makeSheetsMock([header, makeRow({ postType: 'episode' })]);

    const result = await fetchRecentShortRows();
    expect(result).toHaveLength(0);
  });

  test('includes rows of all statuses (not filtered by status or date)', async () => {
    const header = ['Show', 'Title', 'Post Type', 'Post Text', 'YouTube URL', 'Alt Text', 'Scheduled Date', 'Platforms', 'Status', 'LI', 'BSky', 'Masto', 'MB'];
    makeSheetsMock([
      header,
      makeRow({ postType: 'short', status: 'pending' }),
      makeRow({ postType: 'short', status: 'posted', youtubeUrl: 'https://youtu.be/id2' }),
      makeRow({ postType: 'short', status: 'failed', youtubeUrl: 'https://youtu.be/id3' }),
    ]);

    const result = await fetchRecentShortRows();
    expect(result).toHaveLength(3);
  });
});
