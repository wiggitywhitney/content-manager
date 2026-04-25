// ABOUTME: Unit tests for update-about-page.js — covers getActiveChannels logic.
'use strict';

const { getActiveChannels } = require('../src/update-about-page');

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
