// ABOUTME: Downloads a video file from Google Drive using the service account.
// ABOUTME: Used by post-social-content.js for short post dispatch instead of yt-dlp.

'use strict';

const { google } = require('googleapis');

/**
 * Download a video file from Google Drive by file ID.
 * Uses service account credentials from GOOGLE_SERVICE_ACCOUNT_JSON.
 * The responseType: 'arraybuffer' option is required — omitting it returns JSON metadata instead of bytes.
 *
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<{ buffer: Buffer, mimeType: string, filename: string }>}
 *   mimeType and filename are hardcoded to 'video/mp4'/'video.mp4' — the journal skill only
 *   uploads MP4s to the Social Post Videos folder.
 */
async function downloadFromDrive(fileId) {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return {
    buffer: Buffer.from(response.data),
    mimeType: 'video/mp4',
    filename: 'video.mp4',
  };
}

module.exports = { downloadFromDrive };
