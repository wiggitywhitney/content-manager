// ABOUTME: Unit tests for post-linkedin.js — image upload flow and postToLinkedIn with imageBuffer.

'use strict';

const { postToLinkedIn } = require('../src/post-linkedin');

const FAKE_IMAGE_BUFFER = Buffer.from('fake-jpeg-data');
const FAKE_IMAGE_URN = 'urn:li:image:C5F10AQGtestimage';
const FAKE_UPLOAD_URL = 'https://api.linkedin.com/mediaUpload/fake';
const ACCESS_TOKEN = 'test-access-token';
const PERSON_URN = 'urn:li:person:test123';

function makePost(overrides = {}) {
  return {
    rowIndex: 3,
    title: 'Test Episode',
    postType: 'episode',
    postText: 'Check out this episode!',
    youtubeUrl: 'https://youtu.be/abc123',
    altText: 'Podcast thumbnail graphic',
    platforms: ['linkedin'],
    groupId: null,
    ...overrides,
  };
}

describe('postToLinkedIn with imageBuffer', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.LINKEDIN_ACCESS_TOKEN = ACCESS_TOKEN;
    process.env.LINKEDIN_PERSON_URN = PERSON_URN;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.LINKEDIN_PERSON_URN;
    delete process.env.LINKEDIN_TOKEN_EXPIRES_AT;
  });

  test('calls initializeUpload with Images API (not Videos API)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    // initializeUpload
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: { image: FAKE_IMAGE_URN, uploadUrl: FAKE_UPLOAD_URL } }),
    });
    // PUT upload
    fetchMock.mockResolvedValueOnce({ ok: true });
    // POST /rest/posts
    fetchMock.mockResolvedValueOnce({
      status: 201,
      headers: { get: (h) => h === 'x-restli-id' ? 'urn:li:share:123' : null },
    });

    await postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rest/images?action=initializeUpload'),
      expect.objectContaining({ method: 'POST' })
    );
    // Verify the initializeUpload body has the owner URN
    const initCall = fetchMock.mock.calls[0];
    const initBody = JSON.parse(initCall[1].body);
    expect(initBody.initializeUploadRequest.owner).toBe(PERSON_URN);
  });

  test('performs single-part PUT with image/jpeg content type (no finalize step)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: { image: FAKE_IMAGE_URN, uploadUrl: FAKE_UPLOAD_URL } }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true });
    fetchMock.mockResolvedValueOnce({
      status: 201,
      headers: { get: (h) => h === 'x-restli-id' ? 'urn:li:share:123' : null },
    });

    await postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    // Only 3 calls: initializeUpload, PUT, POST /rest/posts — no finalize, no polling
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const putCall = fetchMock.mock.calls[1];
    expect(putCall[0]).toBe(FAKE_UPLOAD_URL);
    expect(putCall[1].method).toBe('PUT');
    expect(putCall[1].headers['Content-Type']).toBe('image/jpeg');
    expect(putCall[1].body).toBe(FAKE_IMAGE_BUFFER);
  });

  test('includes image URN in post body content.media.id', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: { image: FAKE_IMAGE_URN, uploadUrl: FAKE_UPLOAD_URL } }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true });
    fetchMock.mockResolvedValueOnce({
      status: 201,
      headers: { get: (h) => h === 'x-restli-id' ? 'urn:li:share:123' : null },
    });

    await postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });

    const postCall = fetchMock.mock.calls[2];
    const postBody = JSON.parse(postCall[1].body);
    expect(postBody.content).toEqual({ media: { id: FAKE_IMAGE_URN } });
  });

  test('does not upload image when videoBuffer is also provided', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const fakeVideoBuffer = Buffer.from('fake-video');

    // initializeUpload for video
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        value: {
          video: 'urn:li:video:fakevideo',
          uploadToken: '',
          uploadInstructions: [{ uploadUrl: FAKE_UPLOAD_URL, firstByte: 0, lastByte: fakeVideoBuffer.length - 1 }],
        },
      }),
    });
    // Video chunk PUT
    fetchMock.mockResolvedValueOnce({ ok: true, headers: { get: () => '"etag1"' } });
    // finalizeUpload
    fetchMock.mockResolvedValueOnce({ ok: true });
    // Video status poll
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'AVAILABLE' }) });
    // POST /rest/posts
    fetchMock.mockResolvedValueOnce({
      status: 201,
      headers: { get: (h) => h === 'x-restli-id' ? 'urn:li:share:123' : null },
    });

    await postToLinkedIn(makePost(), { videoBuffer: fakeVideoBuffer, imageBuffer: FAKE_IMAGE_BUFFER });

    // Video takes priority — no image initializeUpload call
    const initCalls = fetchMock.mock.calls.filter(c => c[0].includes('/rest/images?action=initializeUpload'));
    expect(initCalls).toHaveLength(0);

    const videoCalls = fetchMock.mock.calls.filter(c => c[0].includes('/rest/videos?action=initializeUpload'));
    expect(videoCalls).toHaveLength(1);
  });

  test('throws when initializeUpload fails', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 422 });

    await expect(postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER }))
      .rejects.toThrow('LinkedIn image initializeUpload failed: 422');
  });

  test('throws when PUT upload fails', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: { image: FAKE_IMAGE_URN, uploadUrl: FAKE_UPLOAD_URL } }),
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER }))
      .rejects.toThrow('LinkedIn image upload failed: 400');
  });
});
