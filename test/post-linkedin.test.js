// ABOUTME: Tests for the LinkedIn posting module.
// ABOUTME: Verifies token validation, expiry warning, post creation, URL extraction, and failure handling.

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
});
