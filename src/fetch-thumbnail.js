// ABOUTME: Fetches YouTube video thumbnail images by video ID.
// ABOUTME: Tries maxresdefault.jpg first, falls back to hqdefault.jpg on 404.

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
async function fetchThumbnail(youtubeUrl) {
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

module.exports = { fetchThumbnail, extractVideoId };
