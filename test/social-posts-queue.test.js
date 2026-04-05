// ABOUTME: Tests for the social-posts-queue module that reads pending posts from the social queue sheet.

'use strict';

const { parseSocialPostRows, filterPostsForDate } = require('../src/social-posts-queue');

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

  test('skips rows with missing scheduledDate', () => {
    const rows = [makeRow({ scheduledDate: '' })];
    const posts = parseSocialPostRows(rows);

    expect(posts).toHaveLength(0);
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
