// ABOUTME: Unit tests for sync-content.js — covers parseRow highlight column parsing and runAboutPageUpdate integration.
'use strict';

const { parseRow, runAboutPageUpdate } = require('../src/sync-content');

// Minimal valid row fixture (columns A-I, no highlight columns)
function makeRow({ name = 'Test Talk', type = 'Podcast', show = 'SDI', date = '1/1/2026',
  location = '', confirmed = '', link = 'https://example.com', microblogUrl = '', postedAt = '',
  highlight = '', highlightPriority = '' } = {}) {
  return [name, type, show, date, location, confirmed, link, microblogUrl, postedAt, highlight, highlightPriority];
}

describe('parseRow', () => {
  describe('highlight field (Column J)', () => {
    test('returns highlight: false when column J is empty', () => {
      const result = parseRow(makeRow({ highlight: '' }), 1);
      expect(result.highlight).toBe(false);
    });

    test('returns highlight: true when column J is "Yes"', () => {
      const result = parseRow(makeRow({ highlight: 'Yes' }), 1);
      expect(result.highlight).toBe(true);
    });

    test('returns highlight: true when column J is "yes" (case-insensitive)', () => {
      const result = parseRow(makeRow({ highlight: 'yes' }), 1);
      expect(result.highlight).toBe(true);
    });

    test('returns highlight: true when column J is "YES"', () => {
      const result = parseRow(makeRow({ highlight: 'YES' }), 1);
      expect(result.highlight).toBe(true);
    });

    test('returns highlight: false when column J is "No"', () => {
      const result = parseRow(makeRow({ highlight: 'No' }), 1);
      expect(result.highlight).toBe(false);
    });

    test('returns highlight: false when column J is missing (short row without J/K)', () => {
      const shortRow = ['Test Talk', 'Podcast', 'SDI', '1/1/2026', '', '', 'https://example.com', '', ''];
      const result = parseRow(shortRow, 1);
      expect(result.highlight).toBe(false);
    });
  });

  describe('highlightPriority field (Column K)', () => {
    test('returns highlightPriority: null when column K is empty', () => {
      const result = parseRow(makeRow({ highlightPriority: '' }), 1);
      expect(result.highlightPriority).toBeNull();
    });

    test('returns highlightPriority: 3 when column K is "3"', () => {
      const result = parseRow(makeRow({ highlightPriority: '3' }), 1);
      expect(result.highlightPriority).toBe(3);
    });

    test('returns highlightPriority: 1 when column K is "1"', () => {
      const result = parseRow(makeRow({ highlightPriority: '1' }), 1);
      expect(result.highlightPriority).toBe(1);
    });

    test('returns highlightPriority: null when column K is non-numeric', () => {
      const result = parseRow(makeRow({ highlightPriority: 'high' }), 1);
      expect(result.highlightPriority).toBeNull();
    });

    test('returns highlightPriority: null when column K is missing (short row without K)', () => {
      const shortRow = ['Test Talk', 'Podcast', 'SDI', '1/1/2026', '', '', 'https://example.com', '', '', 'Yes'];
      const result = parseRow(shortRow, 1);
      expect(result.highlightPriority).toBeNull();
    });
  });

  describe('backward compatibility', () => {
    test('parses existing fields correctly alongside new highlight fields', () => {
      const result = parseRow(makeRow({ name: 'My Talk', type: 'Video', link: 'https://youtu.be/abc', highlight: 'Yes', highlightPriority: '5' }), 2);
      expect(result.name).toBe('My Talk');
      expect(result.type).toBe('Video');
      expect(result.link).toBe('https://youtu.be/abc');
      expect(result.highlight).toBe(true);
      expect(result.highlightPriority).toBe(5);
    });

    test('returns null for header row', () => {
      const result = parseRow(['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL', 'Posted At', 'Highlight', 'Priority'], 0, true);
      expect(result).toBeNull();
    });
  });
});

describe('runAboutPageUpdate', () => {
  const sampleRows = [
    { type: 'Video', show: '🌩️ Thunder', date: '1/1/2026' },
    { type: 'Podcast', show: 'Software Defined Interviews', date: '1/15/2026' },
  ];

  test('calls the update function with validRows and a Date', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({ updated: true });
    await runAboutPageUpdate(sampleRows, { updateFn: mockUpdate });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(sampleRows, expect.any(Date));
  });

  test('does not throw when updateFn rejects', async () => {
    const mockUpdate = jest.fn().mockRejectedValue(new Error('XML-RPC timeout'));
    await expect(runAboutPageUpdate(sampleRows, { updateFn: mockUpdate })).resolves.toBeUndefined();
  });

  test('works with empty validRows', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({ updated: false });
    await runAboutPageUpdate([], { updateFn: mockUpdate });
    expect(mockUpdate).toHaveBeenCalledWith([], expect.any(Date));
  });
});
