// ABOUTME: Unit tests for update-about-page.js — covers getActiveChannels, generateAboutPageMarkdown, and updateAboutPage.
'use strict';

const { getActiveChannels, generateAboutPageMarkdown, updateAboutPage } = require('../src/update-about-page');

// Fixed reference date: 2026-04-25
const TODAY = new Date('2026-04-25T12:00:00Z');

// Dates relative to TODAY (2026-04-25):
//   RECENT_2MO  = 2026-03-20 (~36 days ago) — within 60-day threshold
//   STALE_2MO   = 2026-01-01 (~114 days ago) — outside 60-day threshold
//   RECENT_5MO  = 2026-01-15 (~100 days ago) — within 150-day threshold
//   STALE_5MO   = 2025-09-01 (~236 days ago) — outside 150-day threshold

function makeRow({ type = 'Video', show = '', date = '03/20/2026' } = {}) {
  return { type, show, date, name: 'Test Item', link: 'https://example.com' };
}

describe('getActiveChannels', () => {
  describe('all channels active', () => {
    test('returns all seven channels when all have recent content', () => {
      const rows = [
        makeRow({ type: 'Video', show: 'Datadog Illuminated', date: '03/20/2026' }),
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '03/20/2026' }),
        makeRow({ type: 'Video', show: '⚡️ Enlightning', date: '03/20/2026' }),
        makeRow({ type: 'Video', show: 'You Choose', date: '03/20/2026' }),
        makeRow({ type: 'Presentations', show: '', date: '01/15/2026' }),
        makeRow({ type: 'Podcast', show: 'SDI', date: '03/20/2026' }),
      ];
      const result = getActiveChannels(rows, TODAY);
      const names = result.map(c => c.name);
      expect(names).toContain('Datadog Illuminated');
      expect(names).toContain('🌩️ Thunder');
      expect(names).toContain('⚡️ Enlightning');
      expect(names).toContain('You Choose');
      expect(names).toContain('Conference Talks');
      expect(names).toContain('GitHub');
      expect(names).toContain('Software Defined Interviews');
      expect(result).toHaveLength(7);
    });
  });

  describe('some channels inactive', () => {
    test('excludes video channel with no content in last 60 days', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '01/01/2026' }), // 114 days ago, stale
        makeRow({ type: 'Video', show: '⚡️ Enlightning', date: '03/20/2026' }), // recent
        makeRow({ type: 'Presentations', show: '', date: '01/15/2026' }), // within 5 months
      ];
      const result = getActiveChannels(rows, TODAY);
      const names = result.map(c => c.name);
      expect(names).not.toContain('🌩️ Thunder');
      expect(names).toContain('⚡️ Enlightning');
    });

    test('excludes Conference Talks when last presentation is older than 150 days', () => {
      const rows = [
        makeRow({ type: 'Presentations', show: '', date: '09/01/2025' }), // ~236 days ago, stale
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '03/20/2026' }),
      ];
      const result = getActiveChannels(rows, TODAY);
      const names = result.map(c => c.name);
      expect(names).not.toContain('Conference Talks');
    });

    test('includes Conference Talks when last presentation is within 150 days', () => {
      const rows = [
        makeRow({ type: 'Presentations', show: '', date: '01/15/2026' }), // ~100 days ago
      ];
      const result = getActiveChannels(rows, TODAY);
      const names = result.map(c => c.name);
      expect(names).toContain('Conference Talks');
    });
  });

  describe('all video channels inactive', () => {
    test('returns only GitHub and SDI when all video content is stale and no talks', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '01/01/2026' }),      // stale
        makeRow({ type: 'Video', show: '⚡️ Enlightning', date: '01/01/2026' }),  // stale
        makeRow({ type: 'Video', show: 'Datadog Illuminated', date: '01/01/2026' }), // stale
        makeRow({ type: 'Video', show: 'You Choose', date: '01/01/2026' }),       // stale
      ];
      const result = getActiveChannels(rows, TODAY);
      const names = result.map(c => c.name);
      expect(names).toEqual(['GitHub', 'Software Defined Interviews']);
    });

    test('returns only GitHub, Conference Talks, and SDI when all video stale but talk is recent', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '01/01/2026' }),      // stale
        makeRow({ type: 'Presentations', show: '', date: '01/15/2026' }),         // recent
      ];
      const result = getActiveChannels(rows, TODAY);
      const names = result.map(c => c.name);
      expect(names).toContain('Conference Talks');
      expect(names).not.toContain('🌩️ Thunder');
      expect(names).toContain('GitHub');
      expect(names).toContain('Software Defined Interviews');
    });
  });

  describe('SDI always at bottom', () => {
    test('SDI is always the last channel', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '03/20/2026' }),
        makeRow({ type: 'Podcast', show: 'SDI', date: '03/20/2026' }),
      ];
      const result = getActiveChannels(rows, TODAY);
      expect(result[result.length - 1].name).toBe('Software Defined Interviews');
    });

    test('SDI is last even when it has no matching podcast rows', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '03/20/2026' }),
      ];
      const result = getActiveChannels(rows, TODAY);
      expect(result[result.length - 1].name).toBe('Software Defined Interviews');
    });

    test('SDI is last even when all other channels are inactive', () => {
      const result = getActiveChannels([], TODAY);
      expect(result[result.length - 1].name).toBe('Software Defined Interviews');
    });
  });

  describe('ordering by most recent date', () => {
    test('channels with newer content sort before channels with older content', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '03/01/2026' }),    // 55 days ago, within threshold
        makeRow({ type: 'Video', show: '⚡️ Enlightning', date: '04/01/2026' }), // 24 days ago
      ];
      const result = getActiveChannels(rows, TODAY);
      const videoChannels = result.filter(c => ['🌩️ Thunder', '⚡️ Enlightning'].includes(c.name));
      expect(videoChannels[0].name).toBe('⚡️ Enlightning');
      expect(videoChannels[1].name).toBe('🌩️ Thunder');
    });

    test('uses most recent row date when a channel has multiple matching rows', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '02/01/2026' }),
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '04/10/2026' }), // most recent
        makeRow({ type: 'Video', show: '⚡️ Enlightning', date: '03/15/2026' }),
      ];
      const result = getActiveChannels(rows, TODAY);
      const videoChannels = result.filter(c => ['🌩️ Thunder', '⚡️ Enlightning'].includes(c.name));
      expect(videoChannels[0].name).toBe('🌩️ Thunder');
      expect(videoChannels[1].name).toBe('⚡️ Enlightning');
    });

    test('GitHub (no content dates) sorts after channels with dates but before SDI', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '03/20/2026' }),
      ];
      const result = getActiveChannels(rows, TODAY);
      const thunderIdx = result.findIndex(c => c.name === '🌩️ Thunder');
      const githubIdx = result.findIndex(c => c.name === 'GitHub');
      const sdiIdx = result.findIndex(c => c.name === 'Software Defined Interviews');
      expect(thunderIdx).toBeLessThan(githubIdx);
      expect(githubIdx).toBeLessThan(sdiIdx);
    });
  });

  describe('showFilter matching', () => {
    test('matches Datadog Illuminated via "Datadog" in show field', () => {
      const rows = [makeRow({ type: 'Video', show: 'Datadog Illuminated Series', date: '03/20/2026' })];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).toContain('Datadog Illuminated');
    });

    test('matches Datadog Illuminated via "Illuminated" in show field', () => {
      const rows = [makeRow({ type: 'Video', show: 'Illuminated', date: '03/20/2026' })];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).toContain('Datadog Illuminated');
    });

    test('matches You Choose via "YouChoose" in show field', () => {
      const rows = [makeRow({ type: 'Video', show: 'YouChoose', date: '03/20/2026' })];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).toContain('You Choose');
    });

    test('matches You Choose via "You Choose" in show field', () => {
      const rows = [makeRow({ type: 'Video', show: 'You Choose Series', date: '03/20/2026' })];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).toContain('You Choose');
    });

    test('does not match wrong type — Video row does not activate Conference Talks', () => {
      const rows = [makeRow({ type: 'Video', show: 'Some Talk', date: '03/20/2026' })];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).not.toContain('Conference Talks');
    });

    test('showFilter matching is case-insensitive', () => {
      const rows = [makeRow({ type: 'Video', show: 'thunder shorts', date: '03/20/2026' })];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).toContain('🌩️ Thunder');
    });
  });

  describe('edge cases', () => {
    test('returns only always-shown channels when validRows is empty', () => {
      const result = getActiveChannels([], TODAY);
      const names = result.map(c => c.name);
      expect(names).toContain('GitHub');
      expect(names).toContain('Software Defined Interviews');
      expect(result).toHaveLength(2);
    });

    test('ignores rows with missing or unparseable dates for threshold check', () => {
      const rows = [
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: '' }),
        makeRow({ type: 'Video', show: '🌩️ Thunder', date: 'not-a-date' }),
      ];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).not.toContain('🌩️ Thunder');
    });

    test('boundary: content exactly on the threshold day is included', () => {
      // Exactly 60 days before 2026-04-25 = 2026-02-24 — daysDiff=60, not > 60, so included
      const rows = [makeRow({ type: 'Video', show: '🌩️ Thunder', date: '02/24/2026' })];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).toContain('🌩️ Thunder');
    });

    test('boundary: content one day past threshold is excluded', () => {
      // 61 days before 2026-04-25 = 2026-02-23 — daysDiff=61, 61 > 60, so excluded
      const rows = [makeRow({ type: 'Video', show: '🌩️ Thunder', date: '02/23/2026' })];
      const result = getActiveChannels(rows, TODAY);
      expect(result.map(c => c.name)).not.toContain('🌩️ Thunder');
    });
  });
});

// ============================================================================
// generateAboutPageMarkdown tests
// ============================================================================

const BIO_TEXT = 'Whitney Lee is a creator and systems thinker who explores how observability, AI, and platform engineering connect across the cloud native ecosystem. She brings humor, depth, and clarity to complex technologies while building original frameworks that help others understand how systems fit together. She runs a vibrant YouTube channel, hosts Datadog Illuminated and Software Defined Interviews, has delivered two KubeCon keynotes and countless breakout talks, and combines storytelling and technical rigor to illuminate the human side of cloud native engineering.';

describe('generateAboutPageMarkdown', () => {
  const thunder = { name: '🌩️ Thunder', url: 'https://thunder.example.com/', sortLast: false };
  const github = { name: 'GitHub', url: 'https://github.com/wiggitywhitney', sortLast: false };
  const sdi = { name: 'Software Defined Interviews', url: 'https://www.softwaredefinedinterviews.com/', sortLast: true };

  test('includes bio text verbatim', () => {
    expect(generateAboutPageMarkdown([sdi])).toContain(BIO_TEXT);
  });

  test('includes photo img tag', () => {
    expect(generateAboutPageMarkdown([sdi])).toContain('<img src="https://whitneylee.com/uploads/2025/whitney-square.jpg"');
  });

  test('includes flex layout container', () => {
    expect(generateAboutPageMarkdown([sdi])).toContain('display: flex');
  });

  test('does not include any heading elements', () => {
    const result = generateAboutPageMarkdown([thunder, sdi]);
    expect(result).not.toMatch(/^#{1,6} /m);
  });

  test('does not include --- separator', () => {
    const result = generateAboutPageMarkdown([thunder, sdi]);
    expect(result).not.toContain('\n---\n');
  });

  test('formats all channels as markdown links in a flat list', () => {
    const result = generateAboutPageMarkdown([thunder, sdi]);
    expect(result).toContain('- [🌩️ Thunder](https://thunder.example.com/)');
    expect(result).toContain('- [Software Defined Interviews](https://www.softwaredefinedinterviews.com/)');
  });

  test('non-sortLast channels appear before sortLast channels', () => {
    const result = generateAboutPageMarkdown([thunder, sdi]);
    const thunderIdx = result.indexOf('- [🌩️ Thunder]');
    const sdiIdx = result.indexOf('- [Software Defined Interviews]');
    expect(thunderIdx).toBeLessThan(sdiIdx);
  });

  test('all channels appear in the output regardless of sortLast', () => {
    const result = generateAboutPageMarkdown([thunder, github, sdi]);
    expect(result).toContain('- [🌩️ Thunder]');
    expect(result).toContain('- [GitHub]');
    expect(result).toContain('- [Software Defined Interviews]');
  });
});

// ============================================================================
// updateAboutPage tests
// ============================================================================

describe('updateAboutPage', () => {
  const TODAY = new Date('2026-04-25T12:00:00Z');

  const rows = [
    { type: 'Video', show: '🌩️ Thunder', date: '03/20/2026', name: 'Test Video', link: 'https://youtube.com' }
  ];

  beforeEach(() => {
    process.env.MICROBLOG_XMLRPC_TOKEN = 'test-token';
    process.env.MICROBLOG_USERNAME = 'testuser';
  });

  afterEach(() => {
    delete process.env.MICROBLOG_XMLRPC_TOKEN;
    delete process.env.MICROBLOG_USERNAME;
  });

  function xmlEscape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function makePagesXml(description) {
    const escaped = xmlEscape(description);
    return `<?xml version="1.0"?><methodResponse><params><param><value><array><data><value><struct><member><name>id</name><value><string>6</string></value></member><member><name>title</name><value><string>About</string></value></member><member><name>description</name><value><string>${escaped}</string></value></member><member><name>is_template</name><value><boolean>1</boolean></value></member></struct></value></data></array></value></param></params></methodResponse>`;
  }

  const editSuccessXml = '<?xml version="1.0"?><methodResponse><params><param><value><boolean>1</boolean></value></param></params></methodResponse>';

  test('calls editPage when description differs from generated Markdown', async () => {
    const xmlrpcFn = jest.fn()
      .mockResolvedValueOnce({ statusCode: 200, body: makePagesXml('old stale content') })
      .mockResolvedValueOnce({ statusCode: 200, body: editSuccessXml });

    const result = await updateAboutPage(rows, TODAY, { xmlrpcFn });
    expect(result.updated).toBe(true);
    expect(xmlrpcFn).toHaveBeenCalledTimes(2);
    expect(xmlrpcFn.mock.calls[1][0]).toBe('microblog.editPage');
  });

  test('does not call editPage when description matches generated Markdown', async () => {
    const activeChannels = getActiveChannels(rows, TODAY);
    const currentMarkdown = generateAboutPageMarkdown(activeChannels);

    const xmlrpcFn = jest.fn()
      .mockResolvedValueOnce({ statusCode: 200, body: makePagesXml(currentMarkdown) });

    const result = await updateAboutPage(rows, TODAY, { xmlrpcFn });
    expect(result.updated).toBe(false);
    expect(xmlrpcFn).toHaveBeenCalledTimes(1);
  });

  test('throws when About page not found in response', async () => {
    const emptyXml = '<?xml version="1.0"?><methodResponse><params><param><value><array><data></data></array></value></param></params></methodResponse>';
    const xmlrpcFn = jest.fn().mockResolvedValueOnce({ statusCode: 200, body: emptyXml });

    await expect(updateAboutPage(rows, TODAY, { xmlrpcFn })).rejects.toThrow('About page not found');
  });

  test('throws when getPages returns a fault', async () => {
    const faultXml = '<?xml version="1.0"?><methodResponse><fault><value><struct><member><name>faultCode</name><value><int>500</int></value></member></struct></value></fault></methodResponse>';
    const xmlrpcFn = jest.fn().mockResolvedValueOnce({ statusCode: 200, body: faultXml });

    await expect(updateAboutPage(rows, TODAY, { xmlrpcFn })).rejects.toThrow('fault');
  });

  test('throws when MICROBLOG_XMLRPC_TOKEN is not set', async () => {
    delete process.env.MICROBLOG_XMLRPC_TOKEN;
    await expect(updateAboutPage(rows, TODAY)).rejects.toThrow('MICROBLOG_XMLRPC_TOKEN');
  });

  test('passes correct pageId and Markdown in editPage call', async () => {
    const xmlrpcFn = jest.fn()
      .mockResolvedValueOnce({ statusCode: 200, body: makePagesXml('old content') })
      .mockResolvedValueOnce({ statusCode: 200, body: editSuccessXml });

    await updateAboutPage(rows, TODAY, { xmlrpcFn });

    const [method, params] = xmlrpcFn.mock.calls[1];
    expect(method).toBe('microblog.editPage');
    expect(params[0]).toBe(6);
    expect(params[3].title).toBe('About');
    expect(params[3].description).toContain('whitney-square.jpg');
  });

  test('uses MICROBLOG_USERNAME from env in XML-RPC params', async () => {
    process.env.MICROBLOG_USERNAME = 'myuser';
    const xmlrpcFn = jest.fn()
      .mockResolvedValueOnce({ statusCode: 200, body: makePagesXml('old') })
      .mockResolvedValueOnce({ statusCode: 200, body: editSuccessXml });

    await updateAboutPage(rows, TODAY, { xmlrpcFn });

    const [, pagesParams] = xmlrpcFn.mock.calls[0];
    expect(pagesParams[1]).toBe('myuser');
  });

  test('correctly finds About page when response contains nested structs', async () => {
    // Simulate a getPages response where each page struct contains an author nested struct
    const nestedStructXml = `<?xml version="1.0"?><methodResponse><params><param><value><array><data><value><struct><member><name>id</name><value><string>6</string></value></member><member><name>author</name><value><struct><member><name>name</name><value><string>Whitney</string></value></member></struct></value></member><member><name>title</name><value><string>About</string></value></member><member><name>description</name><value><string>old content</string></value></member><member><name>is_template</name><value><boolean>1</boolean></value></member></struct></value></data></array></value></param></params></methodResponse>`;

    const xmlrpcFn = jest.fn()
      .mockResolvedValueOnce({ statusCode: 200, body: nestedStructXml })
      .mockResolvedValueOnce({ statusCode: 200, body: editSuccessXml });

    const result = await updateAboutPage(rows, TODAY, { xmlrpcFn });
    expect(result.updated).toBe(true);
    expect(xmlrpcFn.mock.calls[1][0]).toBe('microblog.editPage');
  });
});
