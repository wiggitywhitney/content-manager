// ABOUTME: Integration tests for YouTube Data API view count fetch.
// ABOUTME: Requires GOOGLE_SERVICE_ACCOUNT_JSON env var. Run with: npm run test:integration

'use strict';

const { getYouTubeViewCount } = require('../../src/post-microblog');

// "Me at the zoo" (jNQXAC9IVRw) — first ever YouTube video, public domain,
// hundreds of millions of views. Safe as a permanent test fixture.
const TEST_VIDEO_ID = 'jNQXAC9IVRw';

describe('YouTube Data API integration tests', () => {
  beforeAll(() => {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be set to run integration tests');
    }
  });

  test('getYouTubeViewCount returns a number greater than 0', async () => {
    const viewCount = await getYouTubeViewCount(TEST_VIDEO_ID);
    expect(typeof viewCount).toBe('number');
    expect(viewCount).toBeGreaterThan(0);
  });
});
