// ABOUTME: Fetches thumbnail images for YouTube videos and SDI podcast episodes.
// ABOUTME: YouTube: tries maxresdefault.jpg first, falls back to hqdefault.jpg. SDI: parses RSS feed.

'use strict';

/**
 * Extract YouTube video ID from a URL.
 * Handles: youtu.be/{ID}, youtube.com/watch?v={ID}, youtube.com/live/{ID}.
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
    // Standard watch URL: ?v=ID
    const id = url.searchParams.get('v');
    if (id) return id;

    // Live URL: /live/ID
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'live' && pathParts[1]) return pathParts[1];

    throw new Error(`No video ID in YouTube URL: ${youtubeUrl}`);
  }

  throw new Error(`Unrecognized YouTube URL format: ${youtubeUrl}`);
}

/**
 * Fetch a thumbnail image as a Buffer.
 * For YouTube URLs: tries maxresdefault.jpg first, falls back to hqdefault.jpg on 404,
 * throws on other failures.
 * For SDI episode URLs: parses the SDI RSS feed to find the episode artwork,
 * returns null (with console.warn) on RSS fetch failure or missing episode.
 *
 * @param {string} url - YouTube video URL or SDI episode URL
 * @returns {Promise<Buffer|null>} Image bytes as a Buffer, or null if SDI lookup fails
 */
async function fetchThumbnail(url) {
  if (isSdiUrl(url)) {
    return fetchSdiThumbnail(url);
  }

  const videoId = extractVideoId(url);
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
    const h = new URL(url).hostname;
    return h === 'softwaredefinedinterviews.com' || h.endsWith('.softwaredefinedinterviews.com');
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
  try {
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
  } catch (err) {
    console.warn(`[fetch-thumbnail] SDI thumbnail lookup failed: ${err.message} — skipping thumbnail`); // eslint-disable-line no-console
    return null;
  }
}

module.exports = { fetchThumbnail, extractVideoId, isSdiUrl, fetchSdiThumbnail };
