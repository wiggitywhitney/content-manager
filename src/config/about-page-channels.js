// ABOUTME: Channel configuration for the dynamic About page.
// ABOUTME: Defines which content channels appear based on freshness thresholds.
'use strict';

// thresholdDays: 60 = ~2 months, 150 = ~5 months (per PRD Decision 2)
// showFilter: array of strings to match against col C (case-insensitive, any match)
// alwaysShow: true = include regardless of recent content
// sortLast: true = always placed after all other active channels

const ABOUT_PAGE_CHANNELS = [
  {
    name: 'Datadog Illuminated',
    type: 'Video',
    showFilter: ['Datadog', 'Illuminated'],
    thresholdDays: 60,
    url: 'TODO: add Datadog Illuminated playlist URL',
    alwaysShow: false,
    sortLast: false
  },
  {
    name: '🌩️ Thunder',
    type: 'Video',
    showFilter: ['Thunder'],
    thresholdDays: 60,
    url: 'https://www.youtube.com/playlist?list=PLBexUsYDijawXI7x707H1YDdNT2vi98e_',
    alwaysShow: false,
    sortLast: false
  },
  {
    name: '⚡️ Enlightning',
    type: 'Video',
    showFilter: ['Enlightning'],
    thresholdDays: 60,
    url: 'https://www.youtube.com/playlist?list=PLBexUsYDijaz09nH8BVPmPio_16V115i4',
    alwaysShow: false,
    sortLast: false
  },
  {
    name: 'You Choose',
    type: 'Video',
    showFilter: ['YouChoose', 'You Choose'],
    thresholdDays: 60,
    url: 'TODO: add You Choose playlist URL',
    alwaysShow: false,
    sortLast: false
  },
  {
    name: 'Conference Talks',
    type: 'Presentations',
    showFilter: null,
    thresholdDays: 150,
    url: 'https://whitneylee.com/presentations/',
    alwaysShow: false,
    sortLast: false
  },
  {
    name: 'GitHub',
    type: null,
    showFilter: null,
    thresholdDays: null,
    url: 'https://github.com/wiggitywhitney',
    alwaysShow: true,
    sortLast: false
  },
  {
    name: 'Software Defined Interviews',
    type: 'Podcast',
    showFilter: null,
    thresholdDays: null,
    url: 'https://www.softwaredefinedinterviews.com/',
    alwaysShow: true,
    sortLast: true
  }
];

module.exports = { ABOUT_PAGE_CHANNELS };
