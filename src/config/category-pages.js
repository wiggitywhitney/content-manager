/**
 * Category page configuration for Micro.blog navigation pages
 *
 * IDs are stable and won't change unless pages are deleted/recreated.
 * These pages are used for managing navigation visibility based on category activity.
 */
const CATEGORY_PAGES = {
  'Podcast': {
    id: 897417,
    title: 'Podcast',
    description: 'https://whitneylee.com/podcast/'
  },
  'Video': {
    id: 897489,
    title: 'Video',
    description: 'https://whitneylee.com/video/'
  },
  'Blog': {
    id: 897491,
    title: 'Blog',
    description: 'https://whitneylee.com/blog/'
  },
  'Presentations': {
    id: 897483,
    title: 'Presentations',
    description: 'https://whitneylee.com/presentations/'
  },
  'Guest': {
    id: 897488,
    title: 'Guest',
    description: 'https://whitneylee.com/guest/'
  }
};

module.exports = { CATEGORY_PAGES };
