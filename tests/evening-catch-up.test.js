// ABOUTME: Tests for evening-catch-up — decides whether a single-post-mode evening run
// ABOUTME: skips or catches up a missed morning post, failing loudly when the posted-today check errors.

'use strict';

jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn().mockImplementation(() => ({})) },
    sheets: jest.fn(),
  },
}));

const { google } = require('googleapis');
const { decideEveningRun } = require('../src/evening-catch-up');
const { fetchSocialPostedToday } = require('../src/social-posts-queue');

// Evening cron fires at 21:17 UTC; GitHub delays push most runs to 22:00-01:00 UTC.
const EVENING_SAME_DAY = new Date('2026-10-05T23:42:00.000Z');
const EVENING_AT_SLOT_HOUR = new Date('2026-10-05T21:17:00.000Z');
const EVENING_AFTER_MIDNIGHT = new Date('2026-10-06T00:03:00.000Z');

function fetchers({ career = false, social = false } = {}) {
  return {
    fetchCareer: jest.fn().mockResolvedValue(career),
    fetchSocial: jest.fn().mockResolvedValue(social),
  };
}

describe('decideEveningRun', () => {
  test('catches up when nothing posted today and the run is still on the evening slot UTC date', async () => {
    const result = await decideEveningRun({ now: EVENING_SAME_DAY, ...fetchers() });
    expect(result).toEqual({ decision: 'catch_up', reason: 'no-managed-post-today' });
  });

  test('catches up at the evening slot hour itself (21:xx UTC)', async () => {
    const result = await decideEveningRun({ now: EVENING_AT_SLOT_HOUR, ...fetchers() });
    expect(result.decision).toBe('catch_up');
  });

  test('skips when career content already posted today', async () => {
    const result = await decideEveningRun({ now: EVENING_SAME_DAY, ...fetchers({ career: true }) });
    expect(result).toEqual({ decision: 'skip', reason: 'career-posted-today' });
  });

  test('skips when a social or micro.blog-only queue post already went out today', async () => {
    const result = await decideEveningRun({ now: EVENING_SAME_DAY, ...fetchers({ social: true }) });
    expect(result).toEqual({ decision: 'skip', reason: 'social-posted-today' });
  });

  test('skips without querying the spreadsheets when the run started after midnight UTC', async () => {
    const f = fetchers();
    const result = await decideEveningRun({ now: EVENING_AFTER_MIDNIGHT, ...f });
    expect(result).toEqual({ decision: 'skip', reason: 'after-midnight-utc' });
    expect(f.fetchCareer).not.toHaveBeenCalled();
    expect(f.fetchSocial).not.toHaveBeenCalled();
  });

  test('rejects when the career check errors, instead of treating it as nothing posted', async () => {
    const fetchCareer = jest.fn().mockRejectedValue(new Error('Sheets unavailable'));
    const fetchSocial = jest.fn().mockResolvedValue(false);
    await expect(decideEveningRun({ now: EVENING_SAME_DAY, fetchCareer, fetchSocial }))
      .rejects.toThrow('Sheets unavailable');
  });

  test('rejects when the social check errors, instead of treating it as nothing posted', async () => {
    const fetchCareer = jest.fn().mockResolvedValue(false);
    const fetchSocial = jest.fn().mockRejectedValue(new Error('Sheets unavailable'));
    await expect(decideEveningRun({ now: EVENING_SAME_DAY, fetchCareer, fetchSocial }))
      .rejects.toThrow('Sheets unavailable');
  });
});

describe('decideEveningRun with a view-count short posted this morning', () => {
  // Queue columns A-Q: show, title, post type, text, YouTube URL, alt text, scheduled date (G),
  // platforms, status (I), LinkedIn/Bluesky/Mastodon/micro.blog URLs (J-M), group ID, Drive ID,
  // retry count, micro.blog posted-at date (Q).
  function queueRow({ postType, scheduledDate, status, microblogUrl = '', microblogPostedAt = '' }) {
    return ['Thunder', 'Title', postType, 'Text', 'https://youtu.be/abc123', '', scheduledDate,
      'linkedin,bluesky,mastodon', status, '', '', '', microblogUrl, '', '', '', microblogPostedAt];
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: EVENING_SAME_DAY.getTime() });
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    jest.clearAllMocks();
  });

  test('skips instead of dispatching a queue row added after the morning run', async () => {
    // 1. The morning queue dispatch found nothing, so the short scan posted a short dispatched to
    //    the other platforms on an earlier day. 2. A pending row was added later in the day.
    google.sheets.mockReturnValue({
      spreadsheets: { values: { get: jest.fn().mockResolvedValue({ data: { values: [
        ['header'],
        queueRow({ postType: 'short', scheduledDate: '2026-10-01', status: 'posted',
          microblogUrl: 'https://whitneylee.com/2026/10/05/short.html', microblogPostedAt: '2026-10-05' }),
        queueRow({ postType: 'episode', scheduledDate: '', status: 'pending' }),
      ] } }) } },
    });

    // 3. The evening run starts before 00:00 UTC.
    const result = await decideEveningRun({
      now: EVENING_SAME_DAY,
      fetchCareer: jest.fn().mockResolvedValue(false),
      fetchSocial: fetchSocialPostedToday,
    });

    expect(result).toEqual({ decision: 'skip', reason: 'social-posted-today' });
  });
});
