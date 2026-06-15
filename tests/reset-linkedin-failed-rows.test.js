// ABOUTME: Tests for the reset-linkedin-failed-rows script's filter and reset logic.
'use strict';

const { findFailedLinkedInRows } = require('../src/reset-linkedin-failed-rows');

function makePost(overrides = {}) {
  return {
    rowIndex: 2,
    status: 'pending',
    linkedinPostUrl: '',
    platforms: ['linkedin'],
    ...overrides,
  };
}

describe('findFailedLinkedInRows', () => {
  test('returns rows where status is failed, linkedin is in platforms, and no linkedin URL was written', () => {
    const posts = [makePost({ status: 'failed' })];
    expect(findFailedLinkedInRows(posts)).toHaveLength(1);
    expect(findFailedLinkedInRows(posts)[0]).toBe(posts[0]);
  });

  test('excludes rows that are not failed', () => {
    const posts = [
      makePost({ status: 'pending' }),
      makePost({ status: 'posted' }),
      makePost({ status: 'failed' }),
    ];
    const result = findFailedLinkedInRows(posts);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('failed');
  });

  test('excludes failed rows that already have a linkedin post URL', () => {
    const posts = [
      makePost({ status: 'failed', linkedinPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:123/' }),
    ];
    expect(findFailedLinkedInRows(posts)).toHaveLength(0);
  });

  test('excludes failed rows where linkedin is not in platforms', () => {
    const posts = [
      makePost({ status: 'failed', platforms: ['bluesky', 'mastodon'] }),
    ];
    expect(findFailedLinkedInRows(posts)).toHaveLength(0);
  });

  test('includes failed rows where linkedin is one of multiple platforms', () => {
    const posts = [
      makePost({ status: 'failed', platforms: ['bluesky', 'linkedin', 'mastodon'] }),
    ];
    expect(findFailedLinkedInRows(posts)).toHaveLength(1);
  });

  test('returns empty array when no posts match', () => {
    expect(findFailedLinkedInRows([])).toHaveLength(0);
  });

  test('returns all matching rows when multiple qualify', () => {
    const posts = [
      makePost({ rowIndex: 2, status: 'failed' }),
      makePost({ rowIndex: 3, status: 'failed' }),
      makePost({ rowIndex: 4, status: 'posted' }),
    ];
    const result = findFailedLinkedInRows(posts);
    expect(result).toHaveLength(2);
    expect(result.map(p => p.rowIndex)).toEqual([2, 3]);
  });
});
