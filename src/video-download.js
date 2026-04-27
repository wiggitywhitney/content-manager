// ABOUTME: Shared yt-dlp video download utility for YouTube Shorts.
// ABOUTME: Exports downloadShortVideo(youtubeUrl, tmpDir) used by platform posting modules.

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
    // Prefer a pre-merged MP4 (no ffmpeg needed); fall back to best+merge when ffmpeg is available (CI)
    '--format', 'best[ext=mp4]/bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/best',
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

module.exports = { downloadShortVideo };
