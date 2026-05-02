// ABOUTME: Tests for the LinkedIn posting module.
// ABOUTME: Verifies token validation, expiry warning, post creation, URL extraction, image upload, and failure handling.

'use strict';

const { postToLinkedIn, buildLinkedInWebUrl, checkTokenExpiry } = require('../src/post-linkedin');

function makePost(overrides = {}) {
  return {
    postText: 'Check out this episode! https://youtu.be/abc123',
    youtubeUrl: 'https://youtu.be/abc123',
    altText: 'A test video thumbnail',
    postType: 'episode',
    ...overrides,
  };
}

// A timestamp 90 days in the future (well within valid range)
function futureExpiry(daysFromNow = 90) {
  return String(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

describe('buildLinkedInWebUrl', () => {
  test('constructs URL from share URN', () => {
    const url = buildLinkedInWebUrl('urn:li:share:6844785523593134080');
    expect(url).toBe('https://www.linkedin.com/feed/update/urn:li:share:6844785523593134080/');
  });

  test('constructs URL from ugcPost URN', () => {
    const url = buildLinkedInWebUrl('urn:li:ugcPost:6844785523593134080');
    expect(url).toBe('https://www.linkedin.com/feed/update/urn:li:ugcPost:6844785523593134080/');
  });
});

describe('checkTokenExpiry', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('does not warn when token expires far in the future', () => {
    checkTokenExpiry(futureExpiry(30));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('warns when token expires within 7 days', () => {
    checkTokenExpiry(futureExpiry(5));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('expires'));
  });

  test('warns when token is already expired', () => {
    checkTokenExpiry(futureExpiry(-1));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('expires'));
  });

  test('does not warn when expiresAt is not provided', () => {
    checkTokenExpiry(undefined);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('postToLinkedIn', () => {
  let originalFetch;

  beforeEach(() => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'test-access-token';
    process.env.LINKEDIN_PERSON_URN = 'urn:li:person:abc123';
    process.env.LINKEDIN_TOKEN_EXPIRES_AT = futureExpiry(30);

    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.LINKEDIN_PERSON_URN;
    delete process.env.LINKEDIN_TOKEN_EXPIRES_AT;
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  function mockSuccess(urn = 'urn:li:share:6844785523593134080') {
    global.fetch.mockResolvedValue({
      status: 201,
      headers: { get: (h) => (h === 'x-restli-id' ? urn : null) },
    });
  }

  test('throws if LINKEDIN_ACCESS_TOKEN is not set', async () => {
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    await expect(postToLinkedIn(makePost())).rejects.toThrow('LINKEDIN_ACCESS_TOKEN');
  });

  test('throws if LINKEDIN_PERSON_URN is not set', async () => {
    delete process.env.LINKEDIN_PERSON_URN;
    await expect(postToLinkedIn(makePost())).rejects.toThrow('LINKEDIN_PERSON_URN');
  });

  test('sends POST to /rest/posts with required headers', async () => {
    mockSuccess();
    await postToLinkedIn(makePost());

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.linkedin.com/rest/posts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
          'Linkedin-Version': expect.stringMatching(/^\d{6}$/),
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  test('sends correct post body with person URN and post text', async () => {
    mockSuccess();
    const post = makePost({ postText: 'Hello LinkedIn!' });
    await postToLinkedIn(post);

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.author).toBe('urn:li:person:abc123');
    expect(body.commentary).toBe('Hello LinkedIn!');
    expect(body.visibility).toBe('PUBLIC');
    expect(body.lifecycleState).toBe('PUBLISHED');
    expect(body.distribution.feedDistribution).toBe('MAIN_FEED');
  });

  test('returns postUrl constructed from x-restli-id response header', async () => {
    mockSuccess('urn:li:share:9999999999999999999');
    const result = await postToLinkedIn(makePost());
    expect(result.postUrl).toBe(
      'https://www.linkedin.com/feed/update/urn:li:share:9999999999999999999/'
    );
  });

  test('throws on non-201 response', async () => {
    global.fetch.mockResolvedValue({
      status: 403,
      headers: { get: () => null },
      text: async () => 'Forbidden',
    });
    await expect(postToLinkedIn(makePost())).rejects.toThrow('403');
  });

  test('throws if x-restli-id header is missing in 201 response', async () => {
    global.fetch.mockResolvedValue({
      status: 201,
      headers: { get: () => null },
    });
    await expect(postToLinkedIn(makePost())).rejects.toThrow('x-restli-id');
  });

  test('propagates network fetch failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    await expect(postToLinkedIn(makePost())).rejects.toThrow('Network error');
  });

  describe('text-only path (no videoBuffer)', () => {
    test('sends exactly one fetch call', async () => {
      mockSuccess();
      await postToLinkedIn(makePost());
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('post body has no content field', async () => {
      mockSuccess();
      await postToLinkedIn(makePost());
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.content).toBeUndefined();
    });
  });

  describe('image path (imageBuffer provided)', () => {
    const FAKE_IMAGE_BUFFER = Buffer.from('fake-jpeg-data');
    const FAKE_IMAGE_URN = 'urn:li:image:C5F10AQGtestimage';
    const FAKE_UPLOAD_URL = 'https://api.linkedin.com/mediaUpload/fake';

    function setupImageMocks() {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: { image: FAKE_IMAGE_URN, uploadUrl: FAKE_UPLOAD_URL } }),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          status: 201,
          headers: { get: (h) => (h === 'x-restli-id' ? 'urn:li:share:123' : null) },
        });
    }

    test('calls initializeUpload on the Images API (not the Videos API)', async () => {
      setupImageMocks();
      await postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });
      const initCall = global.fetch.mock.calls[0];
      expect(initCall[0]).toContain('/rest/images?action=initializeUpload');
      const body = JSON.parse(initCall[1].body);
      expect(body.initializeUploadRequest.owner).toBe('urn:li:person:abc123');
    });

    test('performs single-part PUT with image/jpeg content type and no finalize step', async () => {
      setupImageMocks();
      await postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });
      expect(global.fetch).toHaveBeenCalledTimes(3); // initializeUpload, PUT, POST /rest/posts
      const putCall = global.fetch.mock.calls[1];
      expect(putCall[0]).toBe(FAKE_UPLOAD_URL);
      expect(putCall[1].method).toBe('PUT');
      expect(putCall[1].headers['Content-Type']).toBe('image/jpeg');
      expect(putCall[1].body).toBe(FAKE_IMAGE_BUFFER);
    });

    test('includes image URN in post body content.media.id', async () => {
      setupImageMocks();
      await postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER });
      const postBody = JSON.parse(global.fetch.mock.calls[2][1].body);
      expect(postBody.content).toEqual({ media: { id: FAKE_IMAGE_URN } });
    });

    test('throws when initializeUpload fails', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 422 });
      await expect(postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER }))
        .rejects.toThrow('LinkedIn image initializeUpload failed: 422');
    });

    test('throws when PUT upload fails', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ value: { image: FAKE_IMAGE_URN, uploadUrl: FAKE_UPLOAD_URL } }) })
        .mockResolvedValueOnce({ ok: false, status: 400 });
      await expect(postToLinkedIn(makePost(), { imageBuffer: FAKE_IMAGE_BUFFER }))
        .rejects.toThrow('LinkedIn image upload failed: 400');
    });

    test('video takes priority over image when both buffers provided', async () => {
      const fakeVideoBuffer = Buffer.from('x'.repeat(10));
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: {
              video: 'urn:li:video:fakevideo',
              uploadToken: '',
              uploadInstructions: [{ uploadUrl: FAKE_UPLOAD_URL, firstByte: 0, lastByte: 9 }],
            },
          }),
        })
        .mockResolvedValueOnce({ ok: true, headers: { get: () => '"etag1"' } })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'AVAILABLE' }) })
        .mockResolvedValueOnce({ status: 201, headers: { get: (h) => h === 'x-restli-id' ? 'urn:li:share:123' : null } });

      await postToLinkedIn(makePost(), { videoBuffer: fakeVideoBuffer, imageBuffer: FAKE_IMAGE_BUFFER });
      const imageCalls = global.fetch.mock.calls.filter(c => c[0].includes('/rest/images?action=initializeUpload'));
      expect(imageCalls).toHaveLength(0);
    });
  });

  describe('video path (videoBuffer provided)', () => {
    const fakeBuffer = Buffer.from('x'.repeat(100));
    const MOCK_VIDEO_URN = 'urn:li:video:C5F10AQGtest123';
    const MOCK_UPLOAD_URL = 'https://storage.linkedin.com/upload/chunk1';
    const MOCK_RAW_ETAG = '"etag-abc123"';
    const MOCK_ETAG = 'etag-abc123';
    const MOCK_POST_URN = 'urn:li:share:6844785523593134080';

    function setupVideoMocks({ pollStatus = 'AVAILABLE' } = {}) {
      global.fetch
        // Step 1: initializeUpload
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: {
              video: MOCK_VIDEO_URN,
              uploadToken: '',
              uploadInstructions: [{ uploadUrl: MOCK_UPLOAD_URL, firstByte: 0, lastByte: 99 }],
            },
          }),
        })
        // Step 2: PUT chunk
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: (h) => (h === 'etag' ? MOCK_RAW_ETAG : null) },
        })
        // Step 3: finalizeUpload
        .mockResolvedValueOnce({ ok: true })
        // Step 4: poll status
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: pollStatus }),
        })
        // Step 5: POST /rest/posts
        .mockResolvedValueOnce({
          status: 201,
          headers: { get: (h) => (h === 'x-restli-id' ? MOCK_POST_URN : null) },
        });
    }

    beforeEach(() => {
      setupVideoMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('calls initializeUpload with owner, fileSizeBytes, and no captions/thumbnail', async () => {
      await postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toContain('/rest/videos?action=initializeUpload');
      const body = JSON.parse(opts.body);
      expect(body.initializeUploadRequest.owner).toBe('urn:li:person:abc123');
      expect(body.initializeUploadRequest.fileSizeBytes).toBe(fakeBuffer.length);
      expect(body.initializeUploadRequest.uploadCaptions).toBe(false);
      expect(body.initializeUploadRequest.uploadThumbnail).toBe(false);
    });

    test('uploads correct buffer slice to the upload URL', async () => {
      await postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      const [url, opts] = global.fetch.mock.calls[1];
      expect(url).toBe(MOCK_UPLOAD_URL);
      expect(opts.method).toBe('PUT');
      // lastByte 99 is inclusive → subarray(0, 100) = full 100-byte buffer
      expect(opts.body.length).toBe(100);
    });

    test('strips surrounding quotes from ETags in finalizeUpload', async () => {
      await postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      const [url, opts] = global.fetch.mock.calls[2];
      expect(url).toContain('/rest/videos?action=finalizeUpload');
      const body = JSON.parse(opts.body);
      expect(body.finalizeUploadRequest.uploadedPartIds).toEqual([MOCK_ETAG]);
    });

    test('calls finalizeUpload with video URN and uploadToken', async () => {
      await postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      const body = JSON.parse(global.fetch.mock.calls[2][1].body);
      expect(body.finalizeUploadRequest.video).toBe(MOCK_VIDEO_URN);
      expect(body.finalizeUploadRequest.uploadToken).toBe('');
    });

    test('polls video status before posting', async () => {
      await postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      const [pollUrl] = global.fetch.mock.calls[3];
      expect(pollUrl).toContain(`/rest/videos/${encodeURIComponent(MOCK_VIDEO_URN)}`);
    });

    test('post body includes video content with correct URN', async () => {
      await postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      const body = JSON.parse(global.fetch.mock.calls[4][1].body);
      expect(body.content).toEqual({ media: { title: 'Short video', id: MOCK_VIDEO_URN } });
    });

    test('returns postUrl on success', async () => {
      const result = await postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer });
      expect(result.postUrl).toBe(`https://www.linkedin.com/feed/update/${MOCK_POST_URN}/`);
    });

    test('throws if chunk PUT response is missing ETag header', async () => {
      global.fetch.mockReset();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: { video: MOCK_VIDEO_URN, uploadToken: '', uploadInstructions: [{ uploadUrl: MOCK_UPLOAD_URL, firstByte: 0, lastByte: 99 }] },
          }),
        })
        .mockResolvedValueOnce({ ok: true, headers: { get: () => null } });
      await expect(
        postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer })
      ).rejects.toThrow('missing ETag');
    });

    test('throws when video processing fails', async () => {
      global.fetch.mockReset();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: { video: MOCK_VIDEO_URN, uploadToken: '', uploadInstructions: [{ uploadUrl: MOCK_UPLOAD_URL, firstByte: 0, lastByte: 99 }] },
          }),
        })
        .mockResolvedValueOnce({ ok: true, headers: { get: () => MOCK_RAW_ETAG } })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'PROCESSING_FAILED' }) });
      await expect(
        postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer })
      ).rejects.toThrow('processing failed');
    });

    test('throws if video processing times out', async () => {
      global.fetch.mockReset();
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: { video: MOCK_VIDEO_URN, uploadToken: '', uploadInstructions: [{ uploadUrl: MOCK_UPLOAD_URL, firstByte: 0, lastByte: 99 }] },
          }),
        })
        .mockResolvedValueOnce({ ok: true, headers: { get: () => MOCK_RAW_ETAG } })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValue({ ok: true, json: async () => ({ status: 'WAITING_UPLOAD' }) });
      jest.useFakeTimers();
      const assertion = expect(
        postToLinkedIn(makePost({ postType: 'short' }), { videoBuffer: fakeBuffer })
      ).rejects.toThrow('timed out');
      await jest.runAllTimersAsync();
      await assertion;
    });
  });
});
