// ABOUTME: Fetches thumbnail images for YouTube videos and SDI podcast episodes.
// ABOUTME: YouTube: tries maxresdefault.jpg first, falls back to hqdefault.jpg. SDI: parses RSS feed.

'use strict';

/**
 * Extract YouTube video ID from a URL.
 * Handles: youtu.be/{ID} (pathname) and youtube.com/watch?v={ID} (query param).
 *
 * @param {string} youtubeUrl
 * @returns {string} Video ID
 */
function extractVideoId(youtubeUrl) {
  let url;
  try {
    url = new URL(youtubeUrl);
  } catch {
    throw new Error(`Invalid YouTube URL: ${youtubeUrl}`);
  }

  if (url.hostname === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (!id) throw new Error(`No video ID in YouTube URL: ${youtubeUrl}`);
    return id;
  }

  if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
    const id = url.searchParams.get('v');
    if (!id) throw new Error(`No video ID in YouTube URL: ${youtubeUrl}`);
    return id;
  }

  throw new Error(`Unrecognized YouTube URL format: ${youtubeUrl}`);
}

/**
 * Fetch a YouTube thumbnail image as a Buffer.
 * Tries maxresdefault.jpg first; falls back to hqdefault.jpg on 404.
 * Throws a descriptive error if both URLs fail or return non-ok status.
 *
 * @param {string} youtubeUrl - YouTube video URL (youtu.be or youtube.com/watch)
 * @returns {Promise<Buffer>} Image bytes as a Buffer
 */
async function fetchThumbnail(url) {
  if (isSdiUrl(url)) {
    return fetchSdiThumbnail(url);
  }

  const youtubeUrl = url;
  const videoId = extractVideoId(youtubeUrl);
  const maxresUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const hqUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const maxresRes = await fetch(maxresUrl);
  if (maxresRes.ok) {
    return Buffer.from(await maxresRes.arrayBuffer());
  }

  if (maxresRes.status !== 404) {
    throw new Error(`Failed to fetch thumbnail (${maxresRes.status}): ${maxresUrl}`);
  }

  const hqRes = await fetch(hqUrl);
  if (!hqRes.ok) {
    throw new Error(`Failed to fetch thumbnail (${hqRes.status}): ${hqUrl}`);
  }

  return Buffer.from(await hqRes.arrayBuffer());
}

const SDI_FEED_URL = 'https://feeds.fireside.fm/softwaredefinedinterviews/rss';

/**
 * Returns true if the URL is a Software Defined Interviews episode URL.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isSdiUrl(url) {
  try {
    return new URL(url).hostname.includes('softwaredefinedinterviews.com');
  } catch {
    return false;
  }
}

/**
 * Fetch thumbnail for an SDI episode by parsing the RSS feed.
 * Returns null (with a console.warn) if the feed can't be fetched or the episode isn't found.
 *
 * @param {string} episodeUrl - Full SDI episode URL
 * @returns {Promise<Buffer|null>}
 */
async function fetchSdiThumbnail(episodeUrl) {
  const feedRes = await fetch(SDI_FEED_URL);
  if (!feedRes.ok) {
    console.warn(`[fetch-thumbnail] SDI RSS feed fetch failed (${feedRes.status}) — skipping thumbnail`); // eslint-disable-line no-console
    return null;
  }

  const rssText = await feedRes.text();

  // Normalize the episode URL for comparison (strip trailing slash)
  const normalizedTarget = episodeUrl.replace(/\/$/, '');

  // Split RSS into items and find the matching one
  const items = rssText.split('<item>').slice(1);
  let imageUrl = null;
  for (const item of items) {
    const linkMatch = item.match(/<link>([^<]+)<\/link>/);
    if (!linkMatch) continue;
    const itemUrl = linkMatch[1].trim().replace(/\/$/, '');
    if (itemUrl === normalizedTarget) {
      const imgMatch = item.match(/<itunes:image\s[^>]*href="([^"]+)"/);
      if (imgMatch) imageUrl = imgMatch[1];
      break;
    }
  }

  if (!imageUrl) {
    console.warn(`[fetch-thumbnail] SDI episode not found in RSS feed: ${episodeUrl}`); // eslint-disable-line no-console
    return null;
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    console.warn(`[fetch-thumbnail] SDI episode image fetch failed (${imgRes.status}): ${imageUrl}`); // eslint-disable-line no-console
    return null;
  }

  return Buffer.from(await imgRes.arrayBuffer());
}

module.exports = { fetchThumbnail, extractVideoId, isSdiUrl, fetchSdiThumbnail };
