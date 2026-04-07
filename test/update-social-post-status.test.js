// ABOUTME: Tests for the Google Sheets status updater for social posts.
// ABOUTME: Verifies correct ranges are written to the Social Posts Queue tab.

'use strict';

jest.mock('googleapis');

const { google } = require('googleapis');
const { updatePostResult, updateMicroblogPostUrl } = require('../src/update-social-post-status');

const STAGED_ID = '1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts';

function makeSheetsMock() {
  const mockBatchUpdate = jest.fn().mockResolvedValue({});
  const sheetsMock = {
    spreadsheets: {
      values: {
        batchUpdate: mockBatchUpdate,
      },
    },
  };
  google.sheets.mockReturnValue(sheetsMock);
  return { mockBatchUpdate, sheetsMock };
}

describe('updatePostResult', () => {
  let mockBatchUpdate;

  beforeEach(() => {
    ({ mockBatchUpdate } = makeSheetsMock());

    google.auth = {
      GoogleAuth: jest.fn().mockImplementation(() => ({})),
    };

    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
  });

  afterEach(() => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.clearAllMocks();
  });

  test('throws if GOOGLE_SERVICE_ACCOUNT_JSON is not set', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    await expect(
      updatePostResult(3, { status: 'posted' })
    ).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_JSON');
  });

  test('throws if status is not provided', async () => {
    await expect(
      updatePostResult(3, {})
    ).rejects.toThrow('status field is required');
  });

  test('updates status column (I) for given row', async () => {
    await updatePostResult(3, { status: 'posted' });

    const call = mockBatchUpdate.mock.calls[0][0];
    const statusRange = call.resource.data.find(d => d.range === 'Social Posts Queue!I3');
    expect(statusRange).toBeDefined();
    expect(statusRange.values).toEqual([['posted']]);
  });

  test('updates Bluesky URL column (K) when provided', async () => {
    await updatePostResult(5, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/abc',
    });

    const call = mockBatchUpdate.mock.calls[0][0];
    const bskyRange = call.resource.data.find(d => d.range === 'Social Posts Queue!K5');
    expect(bskyRange).toBeDefined();
    expect(bskyRange.values).toEqual([['https://bsky.app/profile/handle/post/abc']]);
  });

  test('updates LinkedIn URL column (J) when provided', async () => {
    await updatePostResult(2, {
      status: 'posted',
      linkedinPostUrl: 'https://linkedin.com/feed/update/abc',
    });

    const call = mockBatchUpdate.mock.calls[0][0];
    const liRange = call.resource.data.find(d => d.range === 'Social Posts Queue!J2');
    expect(liRange).toBeDefined();
    expect(liRange.values).toEqual([['https://linkedin.com/feed/update/abc']]);
  });

  test('updates Mastodon URL column (L) when provided', async () => {
    await updatePostResult(4, {
      status: 'posted',
      mastodonPostUrl: 'https://hachyderm.io/@whitney/1234',
    });

    const call = mockBatchUpdate.mock.calls[0][0];
    const mastRange = call.resource.data.find(d => d.range === 'Social Posts Queue!L4');
    expect(mastRange).toBeDefined();
    expect(mastRange.values).toEqual([['https://hachyderm.io/@whitney/1234']]);
  });

  test('updates micro.blog URL column (M) when provided', async () => {
    await updatePostResult(6, {
      status: 'posted',
      microblogPostUrl: 'https://micro.blog/whitney/post/123',
    });

    const call = mockBatchUpdate.mock.calls[0][0];
    const mbRange = call.resource.data.find(d => d.range === 'Social Posts Queue!M6');
    expect(mbRange).toBeDefined();
    expect(mbRange.values).toEqual([['https://micro.blog/whitney/post/123']]);
  });

  test('omits URL ranges when URLs are not provided', async () => {
    await updatePostResult(3, { status: 'failed' });

    const call = mockBatchUpdate.mock.calls[0][0];
    const ranges = call.resource.data.map(d => d.range);
    expect(ranges).toEqual(['Social Posts Queue!I3']);
  });

  test('sends all provided URLs in a single batchUpdate call', async () => {
    await updatePostResult(7, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/xyz',
      linkedinPostUrl: 'https://linkedin.com/feed/update/xyz',
    });

    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.resource.data).toHaveLength(3); // status + bsky + linkedin
  });

  test('uses USER_ENTERED valueInputOption', async () => {
    await updatePostResult(3, { status: 'posted' });

    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.resource.valueInputOption).toBe('USER_ENTERED');
  });

  test('writes to the staged spreadsheet', async () => {
    await updatePostResult(3, { status: 'posted' });

    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.spreadsheetId).toBe(STAGED_ID);
  });
});

describe('updateMicroblogPostUrl', () => {
  let mockBatchUpdate;

  beforeEach(() => {
    ({ mockBatchUpdate } = makeSheetsMock());
    google.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
  });

  afterEach(() => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.clearAllMocks();
  });

  test('throws if microblogPostUrl is not provided', async () => {
    await expect(updateMicroblogPostUrl(3, '')).rejects.toThrow('microblogPostUrl is required');
  });

  test('throws if GOOGLE_SERVICE_ACCOUNT_JSON is not set', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    await expect(updateMicroblogPostUrl(3, 'https://micro.blog/post/1')).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_JSON');
  });

  test('writes micro.blog URL to Column M only — does not touch status column', async () => {
    await updateMicroblogPostUrl(5, 'https://whitneylee.com/2026/04/test');

    const call = mockBatchUpdate.mock.calls[0][0];
    const ranges = call.resource.data.map(d => d.range);
    expect(ranges).toEqual(['Social Posts Queue!M5']);
    expect(ranges).not.toContain('Social Posts Queue!I5');
  });

  test('writes the correct URL value', async () => {
    await updateMicroblogPostUrl(7, 'https://whitneylee.com/2026/04/my-post');

    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.resource.data[0].values).toEqual([['https://whitneylee.com/2026/04/my-post']]);
  });

  test('writes to the staged spreadsheet', async () => {
    await updateMicroblogPostUrl(3, 'https://whitneylee.com/2026/04/test');

    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.spreadsheetId).toBe(STAGED_ID);
  });
});
