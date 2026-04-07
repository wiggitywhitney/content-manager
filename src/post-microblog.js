// ABOUTME: micro.blog posting module using Micropub API with view-count gating.
// ABOUTME: Exports postToMicroblog(post) for individual posts and scanAndPostShorts() for the daily view-count scan.

'use strict';

const { spawnSync } = require('child_process');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MICROPUB_ENDPOINT = 'https://micro.blog/micropub';
const MICROPUB_MEDIA_ENDPOINT = 'https://micro.blog/micropub/media';
const VIEW_COUNT_THRESHOLD = 1000;
const SHORT_SCAN_DEPTH = 10;

/**
 * Extract the YouTube video ID from various URL formats.
 * Handles youtu.be/ID, youtube.com/watch?v=ID, youtube.com/shorts/ID.
 *
 * @param {string} url
 * @returns {string|null} Video ID, or null if unrecognized
 */
function extractYouTubeVideoId(url) {
  const patterns = [
    /youtu\.be\/([^?&#/]+)/,
    /youtube\.com\/(?:watch\?v=|shorts\/)([^?&#/]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch the view count for a YouTube video using the Data API v3.
 * Uses the existing service account credentials (youtube.readonly scope).
 *
 * @param {string} videoId
 * @returns {Promise<number>} View count
 */
async function getYouTubeViewCount(videoId) {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
  });

  const youtube = google.youtube({ version: 'v3', auth });
  const response = await youtube.videos.list({ part: ['statistics'], id: [videoId] });

  const items = response.data.items;
  if (!items || items.length === 0) {
    throw new Error(`Video ${videoId} not found via YouTube Data API`);
  }

  return parseInt(items[0].statistics.viewCount, 10);
}

/**
 * Locate the yt-dlp binary. Checks PATH-based resolution then common Homebrew locations.
 *
 * @returns {string} Path to yt-dlp binary
 */
function findYtDlp() {
  const candidates = ['yt-dlp', '/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp'];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version']);
    if (probe.status === 0) return candidate;
  }
  throw new Error('yt-dlp not found. Install with: brew install yt-dlp');
}

/**
 * Download a YouTube short video to a temp directory using yt-dlp.
 *
 * @param {string} youtubeUrl
 * @param {string} tmpDir - Directory to write the output file into
 * @returns {{ buffer: Buffer, mimeType: string, filename: string }}
 */
function downloadShortVideo(youtubeUrl, tmpDir) {
  const outputPath = path.join(tmpDir, 'video.mp4');
  const ytdlpBin = findYtDlp();

  const result = spawnSync(ytdlpBin, [
    '--format', 'bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--extractor-args', 'youtube:player-client=default,mweb',
    '--js-runtimes', 'node',
    '-o', outputPath,
    youtubeUrl,
  ], { timeout: 120000 });

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : '';
    throw new Error(`yt-dlp failed (exit ${result.status}): ${stderr}`);
  }

  return { buffer: fs.readFileSync(outputPath), mimeType: 'video/mp4', filename: 'video.mp4' };
}

/**
 * Fetch the maxresdefault thumbnail for a YouTube video as a buffer.
 *
 * @param {string} videoId
 * @returns {Promise<{ buffer: Buffer, mimeType: string, filename: string }>}
 */
async function fetchEpisodeThumbnail(videoId) {
  const url = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch thumbnail for ${videoId}: ${res.status}`);
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mimeType: 'image/jpeg',
    filename: `${videoId}-thumbnail.jpg`,
  };
}

/**
 * Upload a file buffer to the micro.blog Micropub media endpoint.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} filename
 * @param {string} token - micro.blog app token
 * @returns {Promise<string>} URL of the uploaded file
 */
async function uploadToMediaEndpoint(buffer, mimeType, filename, token) {
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(MICROPUB_MEDIA_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.status !== 201 && res.status !== 202) {
    const body = await res.text();
    throw new Error(`Media upload failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.url) throw new Error('Media upload response has no url field');
  return data.url;
}

/**
 * Create a Micropub entry post with attached media.
 * Uses photo[] for images (episode thumbnails) and video[] for video (shorts).
 *
 * @param {string} postText
 * @param {string} mediaUrl - URL returned by the media endpoint
 * @param {string} mimeType
 * @param {string} altText
 * @param {string} token
 * @returns {Promise<string>} Post URL from the Location header
 */
async function createMicropubPost(postText, mediaUrl, mimeType, altText, token) {
  const params = new URLSearchParams();
  params.append('h', 'entry');
  params.append('content', postText);

  if (mimeType.startsWith('image/')) {
    params.append('photo[]', mediaUrl);
    if (altText) params.append('mp-photo-alt[]', altText);
  } else {
    params.append('video[]', mediaUrl);
  }

  const res = await fetch(MICROPUB_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (res.status !== 201 && res.status !== 202) {
    const body = await res.text();
    throw new Error(`Micropub post failed (${res.status}): ${body}`);
  }

  const postUrl = res.headers.get('Location');
  if (!postUrl) throw new Error('Micropub post succeeded but no Location header returned');
  return postUrl;
}

/**
 * Post a single short or episode to micro.blog via Micropub.
 *
 * Checks the YouTube view count first. Returns { skipped: true, viewCount } without
 * posting if the view count is below the threshold.
 *
 * @param {Object} post - Post object from the social posts queue
 * @returns {Promise<{postUrl: string}|{skipped: true, viewCount: number}>}
 */
async function postToMicroblog(post) {
  const token = process.env.MICROBLOG_APP_TOKEN;
  if (!token) throw new Error('MICROBLOG_APP_TOKEN environment variable is required');

  const videoId = extractYouTubeVideoId(post.youtubeUrl);
  if (!videoId) throw new Error(`Could not extract video ID from: ${post.youtubeUrl}`);

  const viewCount = await getYouTubeViewCount(videoId);
  if (viewCount < VIEW_COUNT_THRESHOLD) {
    console.log(`[microblog] Row ${post.rowIndex}: ${viewCount} views < ${VIEW_COUNT_THRESHOLD} threshold, skipping`);
    return { skipped: true, viewCount };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'microblog-'));
  try {
    let media;
    if (post.postType === 'short') {
      media = downloadShortVideo(post.youtubeUrl, tmpDir);
    } else {
      media = await fetchEpisodeThumbnail(videoId);
    }

    const mediaUrl = await uploadToMediaEndpoint(media.buffer, media.mimeType, media.filename, token);
    const postUrl = await createMicropubPost(post.postText, mediaUrl, media.mimeType, post.altText, token);
    return { postUrl };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Scan the last SHORT_SCAN_DEPTH short rows in the Social Posts Queue for videos
 * that have crossed VIEW_COUNT_THRESHOLD views, and post any unposted ones to micro.blog.
 *
 * This runs independently of the platforms column — micro.blog posting is driven
 * entirely by view count, not by what platforms are listed in Column H.
 */
async function scanAndPostShorts() {
  const { fetchRecentShortRows } = require('./social-posts-queue');
  const { updateMicroblogPostUrl } = require('./update-social-post-status');

  const shortRows = await fetchRecentShortRows(SHORT_SCAN_DEPTH);

  if (shortRows.length === 0) {
    console.log('[microblog] No short rows found in queue');
    return;
  }

  console.log(`[microblog] Scanning ${shortRows.length} recent short(s) for view count ≥ ${VIEW_COUNT_THRESHOLD}`);

  for (const post of shortRows) {
    if (post.microblogPostUrl) {
      console.log(`[microblog] Row ${post.rowIndex}: already posted to micro.blog, skipping`);
      continue;
    }

    try {
      const result = await postToMicroblog(post);
      if (result.skipped) {
        // Already logged inside postToMicroblog
      } else {
        console.log(`[microblog] Row ${post.rowIndex}: posted → ${result.postUrl}`);
        await updateMicroblogPostUrl(post.rowIndex, result.postUrl);
      }
    } catch (err) {
      console.error(`[microblog] Row ${post.rowIndex}: failed — ${err.message}`);
    }
  }
}

module.exports = { postToMicroblog, scanAndPostShorts, extractYouTubeVideoId, getYouTubeViewCount };
