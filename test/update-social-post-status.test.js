// ABOUTME: Tests for the Google Sheets status updater for social posts.
// ABOUTME: Verifies correct ranges are written for status and platform post URLs.

'use strict';

jest.mock('googleapis');

const { google } = require('googleapis');
const { updatePostResult } = require('../src/update-social-post-status');

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
  const spreadsheetId = 'test-sheet-id';

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
      updatePostResult(spreadsheetId, 3, { status: 'posted' })
    ).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_JSON');
  });

  test('throws if status is not provided', async () => {
    await expect(
      updatePostResult(spreadsheetId, 3, {})
    ).rejects.toThrow('status field is required');
  });

  test('updates status column (I) for given row', async () => {
    await updatePostResult(spreadsheetId, 3, { status: 'posted' });

    const call = mockBatchUpdate.mock.calls[0][0];
    const statusRange = call.resource.data.find(d => d.range === 'Sheet1!I3');
    expect(statusRange).toBeDefined();
    expect(statusRange.values).toEqual([['posted']]);
  });

  test('updates Bluesky URL column (K) when provided', async () => {
    await updatePostResult(spreadsheetId, 5, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/abc',
    });

    const call = mockBatchUpdate.mock.calls[0][0];
    const bskyRange = call.resource.data.find(d => d.range === 'Sheet1!K5');
    expect(bskyRange).toBeDefined();
    expect(bskyRange.values).toEqual([['https://bsky.app/profile/handle/post/abc']]);
  });

  test('updates LinkedIn URL column (J) when provided', async () => {
    await updatePostResult(spreadsheetId, 2, {
      status: 'posted',
      linkedinPostUrl: 'https://linkedin.com/feed/update/abc',
    });

    const call = mockBatchUpdate.mock.calls[0][0];
    const liRange = call.resource.data.find(d => d.range === 'Sheet1!J2');
    expect(liRange).toBeDefined();
    expect(liRange.values).toEqual([['https://linkedin.com/feed/update/abc']]);
  });

  test('updates Mastodon URL column (L) when provided', async () => {
    await updatePostResult(spreadsheetId, 4, {
      status: 'posted',
      mastodonPostUrl: 'https://hachyderm.io/@whitney/1234',
    });

    const call = mockBatchUpdate.mock.calls[0][0];
    const mastRange = call.resource.data.find(d => d.range === 'Sheet1!L4');
    expect(mastRange).toBeDefined();
    expect(mastRange.values).toEqual([['https://hachyderm.io/@whitney/1234']]);
  });

  test('updates micro.blog URL column (M) when provided', async () => {
    await updatePostResult(spreadsheetId, 6, {
      status: 'posted',
      microblogPostUrl: 'https://micro.blog/whitney/post/123',
    });

    const call = mockBatchUpdate.mock.calls[0][0];
    const mbRange = call.resource.data.find(d => d.range === 'Sheet1!M6');
    expect(mbRange).toBeDefined();
    expect(mbRange.values).toEqual([['https://micro.blog/whitney/post/123']]);
  });

  test('omits URL ranges when URLs are not provided', async () => {
    await updatePostResult(spreadsheetId, 3, { status: 'failed' });

    const call = mockBatchUpdate.mock.calls[0][0];
    const ranges = call.resource.data.map(d => d.range);
    expect(ranges).toEqual(['Sheet1!I3']);
  });

  test('sends all provided URLs in a single batchUpdate call', async () => {
    await updatePostResult(spreadsheetId, 7, {
      status: 'posted',
      bskyPostUrl: 'https://bsky.app/profile/handle/post/xyz',
      linkedinPostUrl: 'https://linkedin.com/feed/update/xyz',
    });

    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.resource.data).toHaveLength(3); // status + bsky + linkedin
  });

  test('uses USER_ENTERED valueInputOption', async () => {
    await updatePostResult(spreadsheetId, 3, { status: 'posted' });

    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.resource.valueInputOption).toBe('USER_ENTERED');
  });

  test('uses the provided spreadsheetId', async () => {
    await updatePostResult('custom-sheet-id', 3, { status: 'posted' });

    const call = mockBatchUpdate.mock.calls[0][0];
    expect(call.spreadsheetId).toBe('custom-sheet-id');
  });
});
