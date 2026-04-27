// ABOUTME: Unit tests for scan-new-content.js — covers YouTube playlist fetch functions (filtering, pagination, URL format).
'use strict';

jest.mock('googleapis', () => ({
  google: {
    youtube: jest.fn(),
    auth: { GoogleAuth: jest.fn() }
  }
}));

const { google } = require('googleapis');
const {
  fetchDatadogIlluminatedVideos,
  fetchEnlightningVideos,
  fetchYouChooseVideos
} = require('../src/scan-new-content');

const PLAYLIST_IDS = {
  datadogIlluminated: 'PLVOmGuoGYFgpj1-kAXLRKmFWqZ99HAHu7',
  enlightning: 'PLBexUsYDijaz09nH8BVPmPio_16V115i4',
  youChoose: 'PLyicRj904Z9-FzCPvGpVHgRQVYJpVmx3Z'
};

function makeItem(videoId, title, publishedAt = '2026-01-15T10:00:00Z') {
  return {
    snippet: {
      title,
      publishedAt,
      resourceId: { videoId }
    }
  };
}

function makePageResponse(items, nextPageToken = undefined) {
  return { data: { items, nextPageToken } };
}

let mockList;

beforeEach(() => {
  mockList = jest.fn();
  google.youtube.mockReturnValue({ playlistItems: { list: mockList } });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('fetchDatadogIlluminatedVideos', () => {
  test('uses the Datadog Illuminated playlist ID', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    await fetchDatadogIlluminatedVideos({});
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({
      playlistId: PLAYLIST_IDS.datadogIlluminated
    }));
  });

  test('returns items with type "Video"', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    const results = await fetchDatadogIlluminatedVideos({});
    expect(results[0].type).toBe('Video');
  });

  test('returns items with show "Datadog Illuminated"', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    const results = await fetchDatadogIlluminatedVideos({});
    expect(results[0].show).toBe('Datadog Illuminated');
  });

  test('excludes private videos', async () => {
    mockList.mockResolvedValue(makePageResponse([
      makeItem('vid1', 'Episode 1'),
      makeItem('priv1', 'Private video')
    ]));
    const results = await fetchDatadogIlluminatedVideos({});
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain('vid1');
  });

  test('formats video URLs as https://youtu.be/{videoId}', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('abc123', 'Episode 1')]));
    const results = await fetchDatadogIlluminatedVideos({});
    expect(results[0].url).toBe('https://youtu.be/abc123');
  });

  test('fetches subsequent pages when nextPageToken is present', async () => {
    mockList
      .mockResolvedValueOnce(makePageResponse([makeItem('vid1', 'Episode 1')], 'nexttoken'))
      .mockResolvedValueOnce(makePageResponse([makeItem('vid2', 'Episode 2')]));
    const results = await fetchDatadogIlluminatedVideos({});
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });

  test('returns items whose URLs are dedup-compatible (lowercase-trimmable)', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('abc123', 'Episode 1')]));
    const results = await fetchDatadogIlluminatedVideos({});
    expect(results[0].url).toBe(results[0].url.toLowerCase().trim());
  });
});

describe('fetchEnlightningVideos', () => {
  test('uses the Enlightning playlist ID', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    await fetchEnlightningVideos({});
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({
      playlistId: PLAYLIST_IDS.enlightning
    }));
  });

  test('returns items with type "Video"', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    const results = await fetchEnlightningVideos({});
    expect(results[0].type).toBe('Video');
  });

  test('returns items with show "Enlightning"', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    const results = await fetchEnlightningVideos({});
    expect(results[0].show).toBe('Enlightning');
  });

  test('excludes private videos', async () => {
    mockList.mockResolvedValue(makePageResponse([
      makeItem('vid1', 'Episode 1'),
      makeItem('priv1', 'Private video')
    ]));
    const results = await fetchEnlightningVideos({});
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain('vid1');
  });

  test('formats video URLs as https://youtu.be/{videoId}', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('xyz789', 'Episode 5')]));
    const results = await fetchEnlightningVideos({});
    expect(results[0].url).toBe('https://youtu.be/xyz789');
  });

  test('fetches subsequent pages when nextPageToken is present', async () => {
    mockList
      .mockResolvedValueOnce(makePageResponse([makeItem('vid1', 'Episode 1')], 'nexttoken'))
      .mockResolvedValueOnce(makePageResponse([makeItem('vid2', 'Episode 2')]));
    const results = await fetchEnlightningVideos({});
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });
});

describe('fetchYouChooseVideos', () => {
  test('uses the You Choose playlist ID', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    await fetchYouChooseVideos({});
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({
      playlistId: PLAYLIST_IDS.youChoose
    }));
  });

  test('returns items with type "Video"', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    const results = await fetchYouChooseVideos({});
    expect(results[0].type).toBe('Video');
  });

  test('returns items with show "You Choose"', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('vid1', 'Episode 1')]));
    const results = await fetchYouChooseVideos({});
    expect(results[0].show).toBe('You Choose');
  });

  test('excludes private videos', async () => {
    mockList.mockResolvedValue(makePageResponse([
      makeItem('vid1', 'Episode 1'),
      makeItem('priv1', 'Private video')
    ]));
    const results = await fetchYouChooseVideos({});
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain('vid1');
  });

  test('formats video URLs as https://youtu.be/{videoId}', async () => {
    mockList.mockResolvedValue(makePageResponse([makeItem('def456', 'Episode 3')]));
    const results = await fetchYouChooseVideos({});
    expect(results[0].url).toBe('https://youtu.be/def456');
  });

  test('fetches subsequent pages when nextPageToken is present', async () => {
    mockList
      .mockResolvedValueOnce(makePageResponse([makeItem('vid1', 'Episode 1')], 'nexttoken'))
      .mockResolvedValueOnce(makePageResponse([makeItem('vid2', 'Episode 2')]));
    const results = await fetchYouChooseVideos({});
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });
});
